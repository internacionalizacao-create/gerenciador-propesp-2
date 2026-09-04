#!/usr/bin/env node

import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPOSE_BASE = path.join(RAIZ, "infra/docker-compose.yml");
const COMPOSE_COMPARTILHAR = path.join(
  RAIZ,
  "infra/docker-compose.compartilhar.yml",
);
const INFRA_ENV = path.join(RAIZ, "infra/.env");
const API_ENV = path.join(RAIZ, "apps/api/.env");
const WEB_ENV = path.join(RAIZ, "apps/web/.env.local");
const NEXT_DEV_LOCK = path.join(RAIZ, "apps/web/.next/dev/lock");

const PORTA_WEB = 3334;
const PORTA_API = 3333;
const PORTA_KEYCLOAK = 8888;
const PORTA_KEYCLOAK_LOCAL = 8080;
const PORTA_GATEWAY = Number(process.env.NGROK_DEMO_GATEWAY_PORT ?? 3335);
const REALM = "gerenciador";
const CLIENT_ID = "gerenciador-web";

let urlPublica;
let gateway;
let ngrok;
let api;
let web;
let clienteOriginal;
let composeCompartilhadoIniciado = false;
let encerrando = false;

const paradaSolicitada = new Promise((resolve) => {
  for (const sinal of ["SIGINT", "SIGTERM"]) {
    process.once(sinal, () => resolve({ tipo: "sinal", sinal }));
  }
});

async function main() {
  validarPortaGateway();
  await validarPreRequisitos();
  await validarNextDevLivre();
  await validarPortasLivres([
    PORTA_API,
    PORTA_WEB,
    PORTA_KEYCLOAK,
    PORTA_GATEWAY,
  ]);

  gateway = await iniciarGateway();
  ngrok = await iniciarNgrok();
  urlPublica = await aguardarUrlDoNgrok(ngrok);

  console.log(`\nURL HTTPS criada: ${urlPublica}`);
  console.log("Preparando Keycloak e aplicacao...\n");

  composeCompartilhadoIniciado = true;
  await subirInfraCompartilhada();

  const issuer = `${urlPublica}/realms/${REALM}`;
  await aguardarKeycloak(issuer);
  clienteOriginal = await configurarClienteKeycloak(urlPublica);

  await executar("pnpm", ["--filter", "api", "db:migrate"]);

  api = iniciarProcesso("API", "pnpm", ["--filter", "api", "dev"], {
    KEYCLOAK_ISSUER_URL: issuer,
    PORT: String(PORTA_API),
  });
  web = iniciarProcesso(
    "Web",
    "pnpm",
    ["--filter", "web", "dev", "--port", String(PORTA_WEB)],
    {
      APP_BASE_URL: urlPublica,
      API_BASE_URL: `http://127.0.0.1:${PORTA_API}`,
      KEYCLOAK_ISSUER_URL: issuer,
    },
  );

  await Promise.all([
    aguardarHttp(`http://127.0.0.1:${PORTA_API}/health`, "API"),
    aguardarHttp(`http://127.0.0.1:${PORTA_WEB}/login`, "Web"),
  ]);

  console.log("\n============================================================");
  console.log(` Sistema disponivel para a equipe: ${urlPublica}`);
  console.log(" Use os mesmos usuarios e permissoes do ambiente local.");
  console.log(" Para acesso total ao app, use o usuario de teste admin.");
  console.log(" Pressione Ctrl+C para fechar o link e voltar ao modo local.");
  console.log("============================================================\n");

  const fim = await Promise.race([
    paradaSolicitada,
    processoTerminou(api, "API"),
    processoTerminou(web, "Web"),
    processoTerminou(ngrok, "ngrok"),
  ]);

  if (fim.tipo === "processo") {
    throw new Error(
      `${fim.nome} encerrou inesperadamente (codigo ${fim.codigo}).`,
    );
  }
}

async function validarNextDevLivre() {
  let lock;
  try {
    lock = JSON.parse(await readFile(NEXT_DEV_LOCK, "utf8"));
  } catch {
    return;
  }

  if (!Number.isInteger(lock.pid)) return;

  try {
    process.kill(lock.pid, 0);
  } catch (erro) {
    if (erro.code === "ESRCH") return;
    if (erro.code !== "EPERM") throw erro;
  }

  throw new Error(
    `Ja existe um Next dev deste projeto em ${lock.appUrl ?? `PID ${lock.pid}`}. ` +
      "Encerre-o antes de iniciar o demo.",
  );
}

function validarPortaGateway() {
  if (
    !Number.isInteger(PORTA_GATEWAY) ||
    PORTA_GATEWAY < 1 ||
    PORTA_GATEWAY > 65535
  ) {
    throw new Error(
      "NGROK_DEMO_GATEWAY_PORT precisa ser uma porta TCP valida.",
    );
  }
}

async function validarPreRequisitos() {
  for (const arquivo of [INFRA_ENV, API_ENV, WEB_ENV]) {
    try {
      await access(arquivo);
    } catch {
      throw new Error(
        `Arquivo ausente: ${path.relative(RAIZ, arquivo)}. ` +
          "Prepare o ambiente local antes de compartilhar.",
      );
    }
  }

  try {
    await executar("ngrok", ["version"], { silencioso: true });
  } catch {
    throw new Error(
      "ngrok nao foi encontrado no PATH. Confirme a instalacao com `ngrok version`.",
    );
  }

  await executar("docker", ["compose", "version"], { silencioso: true });
}

async function validarPortasLivres(portas) {
  for (const porta of portas) {
    const resultado = await testarPorta(porta);
    if (resultado.livre) continue;
    if (resultado.erro?.code === "EADDRINUSE") {
      throw new Error(
        `A porta ${porta} ja esta em uso. Encerre o processo local antes de compartilhar.`,
      );
    }
    throw new Error(
      `Nao foi possivel validar a porta ${porta}: ${resultado.erro?.message ?? "erro desconhecido"}.`,
    );
  }
}

function testarPorta(porta) {
  return new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once("error", (erro) => resolve({ livre: false, erro }));
    servidor.listen(porta, "127.0.0.1", () => {
      servidor.close(() => resolve({ livre: true }));
    });
  });
}

function iniciarGateway() {
  const servidor = http.createServer((requisicao, resposta) => {
    if (!urlPublica) {
      resposta.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
      resposta.end("Ambiente compartilhado ainda esta iniciando.\n");
      return;
    }

    const caminho = requisicao.url ?? "/";
    const porta = portaDoDestino(caminho);
    const headers = headersDoProxy(
      requisicao.headers,
      requisicao.socket.remoteAddress,
    );

    const destino = http.request(
      {
        hostname: "127.0.0.1",
        port: porta,
        path: caminho,
        method: requisicao.method,
        headers,
      },
      (respostaDestino) => {
        resposta.writeHead(
          respostaDestino.statusCode ?? 502,
          respostaDestino.statusMessage,
          respostaDestino.headers,
        );
        respostaDestino.pipe(resposta);
      },
    );

    destino.on("error", (erro) => {
      if (!resposta.headersSent) {
        resposta.writeHead(502, {
          "content-type": "text/plain; charset=utf-8",
        });
      }
      resposta.end(`Servico local indisponivel: ${erro.message}\n`);
    });
    requisicao.on("aborted", () => destino.destroy());
    requisicao.pipe(destino);
  });

  servidor.on("upgrade", (requisicao, socket, cabecalhoInicial) => {
    if (!urlPublica) {
      socket.destroy();
      return;
    }

    const caminho = requisicao.url ?? "/";
    const porta = portaDoDestino(caminho);
    const headers = headersDoProxy(
      requisicao.headers,
      requisicao.socket.remoteAddress,
    );
    headers.connection = "Upgrade";
    headers.upgrade = requisicao.headers.upgrade ?? "websocket";

    const destino = net.createConnection(porta, "127.0.0.1", () => {
      const inicio = [
        `${requisicao.method ?? "GET"} ${caminho} HTTP/${requisicao.httpVersion}`,
        ...Object.entries(headers).flatMap(([nome, valor]) =>
          Array.isArray(valor)
            ? valor.map((item) => `${nome}: ${item}`)
            : valor === undefined
              ? []
              : [`${nome}: ${valor}`],
        ),
        "",
        "",
      ].join("\r\n");

      destino.write(inicio);
      if (cabecalhoInicial.length > 0) destino.write(cabecalhoInicial);
      socket.pipe(destino).pipe(socket);
    });

    destino.on("error", () => socket.destroy());
    socket.on("error", () => destino.destroy());
  });

  return new Promise((resolve, reject) => {
    servidor.once("error", reject);
    servidor.listen(PORTA_GATEWAY, "127.0.0.1", () => resolve(servidor));
  });
}

function portaDoDestino(caminho) {
  const keycloak =
    caminho === `/realms/${REALM}` ||
    caminho.startsWith(`/realms/${REALM}/`) ||
    caminho === "/resources" ||
    caminho.startsWith("/resources/");
  return keycloak ? PORTA_KEYCLOAK : PORTA_WEB;
}

function headersDoProxy(originais, enderecoRemoto) {
  const headers = { ...originais };
  const publica = new URL(urlPublica);

  // Estes valores sao definidos pelo gateway, nunca aceitos do cliente.
  delete headers.forwarded;
  delete headers["x-forwarded-host"];
  delete headers["x-forwarded-for"];
  delete headers["x-forwarded-port"];
  delete headers["x-forwarded-proto"];
  headers.host = publica.host;
  headers["x-forwarded-host"] = publica.host;
  headers["x-forwarded-for"] = enderecoRemoto ?? "127.0.0.1";
  headers["x-forwarded-port"] = "443";
  headers["x-forwarded-proto"] = "https";

  return headers;
}

function iniciarNgrok() {
  const args = [
    "http",
    `http://127.0.0.1:${PORTA_GATEWAY}`,
    "--log=stdout",
    "--log-format=json",
  ];
  if (process.env.NGROK_URL) {
    args.push("--url", normalizarUrlPublica(process.env.NGROK_URL));
  }

  return iniciarProcesso("ngrok", "ngrok", args, {}, "pipe");
}

function aguardarUrlDoNgrok(processo) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("O ngrok nao informou a URL publica em 30 segundos."));
    }, 30_000);

    let resolvido = false;
    const consumir = (stream) => {
      const linhas = readline.createInterface({ input: stream });
      linhas.on("line", (linha) => {
        const url = extrairUrlNgrok(linha);
        if (url && !resolvido) {
          resolvido = true;
          clearTimeout(timeout);
          resolve(url);
          return;
        }

        const mensagem = extrairMensagemNgrok(linha);
        if (mensagem) console.error(`[ngrok] ${mensagem}`);
      });
    };

    consumir(processo.stdout);
    consumir(processo.stderr);
    processo.once("error", (erro) => {
      if (!resolvido) {
        clearTimeout(timeout);
        reject(erro);
      }
    });
    processo.once("exit", (codigo) => {
      if (!resolvido) {
        clearTimeout(timeout);
        reject(
          new Error(
            `ngrok encerrou antes de abrir o tunel (codigo ${codigo}). ` +
              "Confirme a autenticacao com `ngrok config check`.",
          ),
        );
      }
    });
  });
}

function extrairUrlNgrok(linha) {
  try {
    const evento = JSON.parse(linha);
    if (typeof evento.url === "string" && evento.url.startsWith("https://")) {
      return normalizarUrlPublica(evento.url);
    }
  } catch {
    const encontrada = linha.match(/https:\/\/[^\s"']+/)?.[0];
    if (encontrada) return normalizarUrlPublica(encontrada);
  }
  return undefined;
}

function extrairMensagemNgrok(linha) {
  try {
    const evento = JSON.parse(linha);
    if (evento.lvl === "eror" || evento.lvl === "warn") {
      return evento.err ? `${evento.msg}: ${evento.err}` : evento.msg;
    }
  } catch {
    if (/error|failed|ERR_NGROK/i.test(linha)) return linha;
  }
  return undefined;
}

function normalizarUrlPublica(valor) {
  const comProtocolo = /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
  const url = new URL(comProtocolo);
  if (url.protocol !== "https:") {
    throw new Error("A URL publica do ngrok precisa usar HTTPS.");
  }
  return url.origin;
}

async function subirInfraCompartilhada() {
  await executar(
    "docker",
    [
      "compose",
      "-f",
      COMPOSE_BASE,
      "-f",
      COMPOSE_COMPARTILHAR,
      "--env-file",
      INFRA_ENV,
      "up",
      "-d",
      "--wait",
      "--wait-timeout",
      "60",
    ],
    { env: { GERENCIADOR_PUBLIC_URL: urlPublica } },
  );
}

async function aguardarKeycloak(issuer, porta = PORTA_KEYCLOAK) {
  const discovery = `http://localhost:${porta}/realms/${REALM}/.well-known/openid-configuration`;
  await repetirAte(
    async () => {
      const resposta = await fetch(discovery);
      if (!resposta.ok) return false;
      const metadados = await resposta.json();
      return metadados.issuer === issuer;
    },
    60_000,
    "Keycloak nao ficou pronto com o issuer publico esperado.",
  );
}

async function configurarClienteKeycloak(baseUrl) {
  const envInfra = parseEnv(await readFile(INFRA_ENV, "utf8"));
  const usuario = envInfra.KEYCLOAK_ADMIN ?? "admin";
  const senha = envInfra.KEYCLOAK_ADMIN_PASSWORD ?? "admin";
  const token = await obterTokenAdmin(usuario, senha, PORTA_KEYCLOAK);
  const headers = { Authorization: `Bearer ${token}` };

  const busca = new URL(
    `http://127.0.0.1:${PORTA_KEYCLOAK}/admin/realms/${REALM}/clients`,
  );
  busca.searchParams.set("clientId", CLIENT_ID);
  const clientes = await fetchJson(busca, { headers });
  const encontrado = clientes.find((cliente) => cliente.clientId === CLIENT_ID);
  if (!encontrado?.id) {
    throw new Error(`Client ${CLIENT_ID} nao encontrado no Keycloak.`);
  }

  const endpoint = `http://127.0.0.1:${PORTA_KEYCLOAK}/admin/realms/${REALM}/clients/${encontrado.id}`;
  const original = await fetchJson(endpoint, { headers });
  const atualizado = structuredClone(original);
  atualizado.redirectUris = adicionarUnico(
    atualizado.redirectUris,
    `${baseUrl}/api/auth/callback`,
  );
  atualizado.webOrigins = adicionarUnico(atualizado.webOrigins, baseUrl);

  const logoutAtual =
    atualizado.attributes?.["post.logout.redirect.uris"] ?? "";
  atualizado.attributes = {
    ...atualizado.attributes,
    "post.logout.redirect.uris": adicionarListaKeycloak(
      logoutAtual,
      `${baseUrl}/*`,
    ),
  };

  await atualizarCliente(endpoint, atualizado, token);
  return { id: encontrado.id, representacao: original };
}

async function obterTokenAdmin(usuario, senha, porta) {
  const corpo = new URLSearchParams({
    grant_type: "password",
    client_id: "admin-cli",
    username: usuario,
    password: senha,
  });
  const resposta = await fetch(
    `http://127.0.0.1:${porta}/realms/master/protocol/openid-connect/token`,
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: corpo,
    },
  );
  if (!resposta.ok) {
    throw new Error(
      `Nao foi possivel autenticar no Admin REST do Keycloak (${resposta.status}).`,
    );
  }
  const dados = await resposta.json();
  if (!dados.access_token)
    throw new Error("Keycloak nao devolveu o token de admin.");
  return dados.access_token;
}

async function atualizarCliente(endpoint, representacao, token) {
  const resposta = await fetch(endpoint, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(representacao),
  });
  if (!resposta.ok) {
    throw new Error(
      `Falha ao atualizar o client do Keycloak (${resposta.status}).`,
    );
  }
}

async function restaurarClienteKeycloak(porta = PORTA_KEYCLOAK) {
  if (!clienteOriginal) return;
  const envInfra = parseEnv(await readFile(INFRA_ENV, "utf8"));
  const token = await obterTokenAdmin(
    envInfra.KEYCLOAK_ADMIN ?? "admin",
    envInfra.KEYCLOAK_ADMIN_PASSWORD ?? "admin",
    porta,
  );
  const endpoint = `http://127.0.0.1:${porta}/admin/realms/${REALM}/clients/${clienteOriginal.id}`;
  await atualizarCliente(endpoint, clienteOriginal.representacao, token);
}

function adicionarUnico(valores = [], valor) {
  return valores.includes(valor) ? valores : [...valores, valor];
}

function adicionarListaKeycloak(lista, valor) {
  const valores = lista.split("##").filter(Boolean);
  return adicionarUnico(valores, valor).join("##");
}

function parseEnv(conteudo) {
  const resultado = {};
  for (const linhaOriginal of conteudo.split(/\r?\n/)) {
    const linha = linhaOriginal.trim();
    if (!linha || linha.startsWith("#")) continue;
    const separador = linha.indexOf("=");
    if (separador < 1) continue;
    const chave = linha.slice(0, separador).trim();
    let valor = linha.slice(separador + 1).trim();
    if (
      (valor.startsWith('"') && valor.endsWith('"')) ||
      (valor.startsWith("'") && valor.endsWith("'"))
    ) {
      valor = valor.slice(1, -1);
    }
    resultado[chave] = valor;
  }
  return resultado;
}

async function fetchJson(url, opcoes) {
  const resposta = await fetch(url, opcoes);
  if (!resposta.ok) {
    throw new Error(`Keycloak respondeu ${resposta.status} em ${url}.`);
  }
  return resposta.json();
}

async function aguardarHttp(url, nome) {
  await repetirAte(
    async () => {
      const resposta = await fetch(url, { redirect: "manual" });
      return resposta.status >= 200 && resposta.status < 500;
    },
    60_000,
    `${nome} nao respondeu em ${url}.`,
  );
}

async function repetirAte(tentativa, limiteMs, mensagem) {
  const inicio = Date.now();
  let ultimoErro;
  while (Date.now() - inicio < limiteMs) {
    try {
      if (await tentativa()) return;
    } catch (erro) {
      ultimoErro = erro;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    ultimoErro ? `${mensagem} Ultimo erro: ${ultimoErro.message}` : mensagem,
  );
}

function iniciarProcesso(
  nome,
  comando,
  args,
  envExtra = {},
  stdio = "inherit",
) {
  const processo = spawn(comando, args, {
    cwd: RAIZ,
    env: { ...process.env, ...envExtra },
    stdio,
  });
  processo.once("error", (erro) => {
    if (!encerrando) console.error(`${nome}: ${erro.message}`);
  });
  return processo;
}

function processoTerminou(processo, nome) {
  return new Promise((resolve) => {
    processo.once("error", () => {
      if (!encerrando) resolve({ tipo: "processo", nome, codigo: "erro" });
    });
    processo.once("exit", (codigo) => {
      if (!encerrando) resolve({ tipo: "processo", nome, codigo });
    });
  });
}

function executar(comando, args, opcoes = {}) {
  return new Promise((resolve, reject) => {
    const processo = spawn(comando, args, {
      cwd: RAIZ,
      env: { ...process.env, ...opcoes.env },
      stdio: opcoes.silencioso ? "ignore" : "inherit",
    });
    processo.once("error", reject);
    processo.once("exit", (codigo) => {
      if (codigo === 0) resolve();
      else reject(new Error(`${comando} encerrou com codigo ${codigo}.`));
    });
  });
}

async function encerrarProcesso(processo) {
  if (!processo || processo.exitCode !== null || processo.signalCode !== null)
    return;
  processo.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => processo.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 5_000)),
  ]);
  if (processo.exitCode === null && processo.signalCode === null) {
    processo.kill("SIGKILL");
  }
}

async function restaurarComposeLocal() {
  if (!composeCompartilhadoIniciado) return;
  await executar("docker", [
    "compose",
    "-f",
    COMPOSE_BASE,
    "--env-file",
    INFRA_ENV,
    "up",
    "-d",
    "keycloak",
  ]);
}

async function limpar() {
  if (encerrando) return;
  encerrando = true;
  console.log("\nFechando o link publico e restaurando o ambiente local...");

  await encerrarProcesso(ngrok);
  await Promise.all([encerrarProcesso(api), encerrarProcesso(web)]);

  let restauracaoClienteFalhou = false;
  try {
    await restaurarClienteKeycloak();
  } catch (erro) {
    restauracaoClienteFalhou = true;
    console.error(
      `Aviso: nao foi possivel restaurar o client: ${erro.message}`,
    );
  }

  try {
    await restaurarComposeLocal();
  } catch (erro) {
    console.error(
      `Aviso: nao foi possivel restaurar o Keycloak local: ${erro.message}`,
    );
  }

  if (restauracaoClienteFalhou) {
    try {
      await aguardarKeycloak(
        `http://localhost:${PORTA_KEYCLOAK_LOCAL}/realms/${REALM}`,
        PORTA_KEYCLOAK_LOCAL,
      );
      await restaurarClienteKeycloak(PORTA_KEYCLOAK_LOCAL);
    } catch (erro) {
      console.error(
        `Aviso: a segunda tentativa de restaurar o client falhou: ${erro.message}`,
      );
    }
  }

  if (gateway) {
    gateway.closeAllConnections();
    await new Promise((resolve) => gateway.close(resolve));
  }
}

let codigoSaida = 0;
try {
  await main();
} catch (erro) {
  codigoSaida = 1;
  console.error(`\nErro ao compartilhar: ${erro.message}`);
} finally {
  await limpar();
  process.exitCode = codigoSaida;
}
