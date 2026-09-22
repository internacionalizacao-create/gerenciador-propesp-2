#!/usr/bin/env node
// Driver do Gerenciador PROPESP: loga pelo Keycloak e dirige a aplicacao.
// Ferramenta de agente, nao superficie de produto -- pode ser mais tosco que o resto do repo.
//
//   node .claude/skills/run-gerenciador/driver.mjs tour [rota...]
//   node .claude/skills/run-gerenciador/driver.mjs abrir <rota>
//   node .claude/skills/run-gerenciador/driver.mjs api <METODO> <rota> [json]
//   node .claude/skills/run-gerenciador/driver.mjs repl
//   node .claude/skills/run-gerenciador/driver.mjs conceder <usuario> <senha> [modelo]
//
// Ambiente: GR_WEB (http://localhost:3000), GR_USUARIO (admin), GR_SENHA (admin123),
//           GR_SAIDA (<skill>/saida), GR_JANELA=1 abre o browser visivel.

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '../../..');
// O playwright e dependencia de apps/web; com pnpm ele nao resolve da raiz.
const require = createRequire(join(RAIZ, 'apps/web/package.json'));
const { chromium } = require('@playwright/test');

const WEB = process.env.GR_WEB ?? 'http://localhost:3000';
const USUARIO = process.env.GR_USUARIO ?? 'admin';
const SENHA = process.env.GR_SENHA ?? 'admin123';
const SAIDA_BASE = process.env.GR_SAIDA ?? join(AQUI, 'saida');
// Uma pasta por conta: duas contas veem telas diferentes, e um nome so faria a
// segunda rodada sobrescrever a prova da primeira.
const SAIDA = join(SAIDA_BASE, USUARIO);
const SESSAO = join(SAIDA_BASE, `.sessao-${USUARIO}.json`);

mkdirSync(SAIDA, { recursive: true });

const problemas = [];
function vigiar(pagina) {
  pagina.on('console', (m) => m.type() === 'error' && problemas.push(`console: ${m.text().slice(0, 200)}`));
  pagina.on('pageerror', (e) => problemas.push(`pageerror: ${String(e).slice(0, 200)}`));
  pagina.on('response', (r) => r.status() >= 500 && problemas.push(`${r.status()} ${r.url()}`));
}

async function abrirNavegador() {
  const navegador = await chromium.launch({ headless: !process.env.GR_JANELA });
  // A sessao gravada evita repetir o login do Keycloak a cada invocacao.
  const contexto = await navegador.newContext({
    baseURL: WEB,
    viewport: { width: 1280, height: 900 },
    ...(existsSync(SESSAO) ? { storageState: SESSAO } : {}),
  });
  const pagina = await contexto.newPage();
  vigiar(pagina);
  return { navegador, contexto, pagina };
}

async function entrar(pagina, contexto, destino = '/ppgs') {
  await pagina.goto(`/api/auth/login?returnTo=${encodeURIComponent(destino)}`, { waitUntil: 'domcontentloaded' });
  if (pagina.url().includes('/realms/gerenciador/protocol')) {
    await pagina.locator('#username').fill(USUARIO);
    await pagina.locator('#password').fill(SENHA);
    await pagina.locator('#kc-login').click();
    await pagina.waitForURL((u) => u.origin === new URL(WEB).origin, { timeout: 60_000 });
  }
  // O vinculo local (usuario_sistema) nasce em GET /me, nao no guard: sem esta
  // chamada, uma conta recem-criada no Keycloak segue sem pessoa associada.
  const me = await pagina.request.get('/api/bff/me');
  if (me.status() !== 200) throw new Error(`/me respondeu ${me.status()} -- sessao nao estabelecida`);
  await contexto.storageState({ path: SESSAO });
  return me.json();
}

function apelido(rota) {
  return (rota.replace(/^\//, '').replace(/[/?=&]+/g, '-') || 'inicio').slice(0, 80);
}

async function visitar(pagina, rota) {
  problemas.length = 0;
  const resposta = await pagina.goto(rota, { waitUntil: 'networkidle', timeout: 60_000 });
  const arquivo = join(SAIDA, `${apelido(rota)}.png`);
  await pagina.screenshot({ path: arquivo, fullPage: true });
  const titulo = (await pagina.locator('h1').first().textContent().catch(() => null))?.trim() ?? '(sem h1)';
  const corpo = await pagina.locator('body').innerText().catch(() => '');
  const semAcesso = /Sua conta ainda não|Seu acesso não cobre/.test(corpo);
  const quebrou = /Application error|Unhandled Runtime Error/.test(corpo);
  return { rota, status: resposta?.status() ?? 0, titulo, semAcesso, quebrou, arquivo, problemas: [...problemas] };
}

function relatar(r) {
  const marca = r.quebrou ? 'QUEBROU' : r.semAcesso ? 'SEM ACESSO' : r.status === 200 ? 'ok' : `HTTP ${r.status}`;
  console.log(`[${marca}] ${r.rota} -- ${r.titulo}`);
  console.log(`         ${r.arquivo}`);
  for (const p of r.problemas.slice(0, 5)) console.log(`         ! ${p}`);
  return !r.quebrou && r.status < 400;
}

// Descobre programa e ciclo pela API: as rotas do ciclo dependem da seed carregada.
async function rotasPadrao(pagina) {
  // Nao existe pagina em /catalogos: so /catalogos/bolsas e /catalogos/modalidades.
  const base = ['/', '/ppgs', '/programas', '/mobilidade', '/mobilidade/bolsistas', '/mobilidade/mapa',
    '/producao', '/catalogos/bolsas', '/catalogos/modalidades', '/avisos', '/configuracoes', '/configuracoes/acessos'];
  const r = await pagina.request.get('/api/bff/programas');
  if (r.status() !== 200) return base;
  const [programa] = await r.json();
  if (!programa?.slug || !programa?.cicloAtual) return base;
  const c = `/programas/${programa.slug}/${programa.cicloAtual}`;
  return [...base, c, `${c}/plano`, `${c}/orcamento`, `${c}/redes`, `${c}/parceiros`,
    `${c}/comite-gestor`, `${c}/remanejamentos`];
}

const [comando, ...resto] = process.argv.slice(2);

if (comando === 'tour' || comando === 'abrir' || !comando) {
  const { navegador, contexto, pagina } = await abrirNavegador();
  const quem = await entrar(pagina, contexto);
  console.log(`Sessao: ${quem.username} -- ${quem.permissions?.length ?? 0} acoes concedidas\n`);
  const rotas = resto.length ? resto : comando === 'abrir' ? ['/'] : await rotasPadrao(pagina);
  let falhas = 0;
  for (const rota of rotas) if (!relatar(await visitar(pagina, rota))) falhas += 1;
  await navegador.close();
  console.log(`\n${rotas.length - falhas}/${rotas.length} telas ok -- imagens em ${SAIDA}`);
  process.exit(falhas ? 1 : 0);
}

if (comando === 'api') {
  const [metodo = 'GET', rota = '/me', corpo] = resto;
  const { navegador, contexto, pagina } = await abrirNavegador();
  await entrar(pagina, contexto);
  const r = await pagina.request.fetch(`/api/bff${rota.startsWith('/') ? rota : `/${rota}`}`, {
    method: metodo.toUpperCase(),
    ...(corpo ? { data: JSON.parse(corpo), headers: { 'content-type': 'application/json' } } : {}),
  });
  const texto = await r.text();
  console.log(`HTTP ${r.status()}`);
  try { console.log(JSON.stringify(JSON.parse(texto), null, 2)); } catch { console.log(texto); }
  await navegador.close();
  process.exit(r.ok() ? 0 : 1);
}

if (comando === 'repl') {
  const { navegador, contexto, pagina } = await abrirNavegador();
  await entrar(pagina, contexto);
  console.log('comandos: ir <rota> | foto [nome] | clicar <texto> | preencher <seletor> <valor> | texto [seletor] | eval <js> | url | sair');
  console.log('>> pronto');
  const linhas = createInterface({ input: process.stdin });
  for await (const linha of linhas) {
    const [cmd, ...args] = linha.trim().split(/\s+/);
    const arg = args.join(' ');
    try {
      if (!cmd) { /* linha vazia */ }
      else if (cmd === 'sair') break;
      else if (cmd === 'ir') { problemas.length = 0; await pagina.goto(arg, { waitUntil: 'networkidle' }); console.log(pagina.url()); }
      else if (cmd === 'foto') {
        const arquivo = join(SAIDA, `${(arg || 'foto').replace(/\W+/g, '-')}.png`);
        // <dialog> cobre so a viewport: com fullPage o sidesheet sai flutuando
        // sobre metros de pagina nao escurecida.
        const painelAberto = (await pagina.locator('dialog[open]').count()) > 0;
        await pagina.screenshot({ path: arquivo, fullPage: !painelAberto });
        console.log(`${arquivo}${painelAberto ? ' (painel aberto: so a viewport)' : ''}`);
      } else if (cmd === 'clicar') {
        const alvo = pagina.getByRole('button', { name: arg }).or(pagina.getByRole('link', { name: arg })).first();
        const antes = pagina.url();
        await alvo.click({ timeout: 15_000 });
        // A aba do Next e um <Link> com query: a navegacao e leve demais para o
        // networkidle sozinho, e a foto sairia com a aba anterior ainda ativa.
        await Promise.race([
          pagina.waitForURL((u) => u.href !== antes, { timeout: 5_000 }).catch(() => {}),
          pagina.locator('dialog[open]').waitFor({ state: 'attached', timeout: 5_000 }).catch(() => {}),
        ]);
        await pagina.waitForLoadState('networkidle').catch(() => {});
        console.log(`clicado: ${arg} -- ${pagina.url()}`);
      } else if (cmd === 'preencher') {
        const [sel, ...v] = args; await pagina.locator(sel).first().fill(v.join(' ')); console.log('ok');
      } else if (cmd === 'texto') {
        console.log((await pagina.locator(arg || 'main').first().innerText()).slice(0, 4000));
      } else if (cmd === 'eval') {
        console.log(JSON.stringify(await pagina.evaluate(arg), null, 2));
      } else if (cmd === 'url') console.log(pagina.url());
      else console.log(`comando desconhecido: ${cmd}`);
      for (const p of problemas.splice(0)) console.log(`! ${p}`);
    } catch (e) { console.log(`ERRO: ${String(e).split('\n')[0]}`); }
    console.log('>> pronto');
  }
  await navegador.close();
  process.exit(0);
}

if (comando === 'conceder') {
  const [alvoUsuario, alvoSenha, modelo = 'administrador'] = resto;
  if (!alvoUsuario || !alvoSenha) { console.error('uso: conceder <usuario> <senha> [modelo]'); process.exit(2); }
  const navegador = await chromium.launch({ headless: true });

  // O alvo precisa entrar uma vez: o vinculo local nasce em GET /me, e antes
  // disso a conta nem aparece na lista que o admin consulta.
  const ctxAlvo = await navegador.newContext({ baseURL: WEB });
  const pgAlvo = await ctxAlvo.newPage();
  await pgAlvo.goto(`/api/auth/login?returnTo=%2F`, { waitUntil: 'domcontentloaded' });
  await pgAlvo.locator('#username').fill(alvoUsuario);
  await pgAlvo.locator('#password').fill(alvoSenha);
  await pgAlvo.locator('#kc-login').click();
  await pgAlvo.waitForURL((u) => u.origin === new URL(WEB).origin, { timeout: 60_000 });
  const eu = await (await pgAlvo.request.get('/api/bff/me')).json();
  console.log(`alvo ${alvoUsuario}: sub ${eu.id}`);

  const admUsuario = process.env.GR_ADMIN_USUARIO ?? 'admin';
  const admSenha = process.env.GR_ADMIN_SENHA ?? 'admin123';
  const ctxAdm = await navegador.newContext({ baseURL: WEB });
  const pgAdm = await ctxAdm.newPage();
  await pgAdm.goto(`/api/auth/login?returnTo=%2F`, { waitUntil: 'domcontentloaded' });
  await pgAdm.locator('#username').fill(admUsuario);
  await pgAdm.locator('#password').fill(admSenha);
  await pgAdm.locator('#kc-login').click();
  await pgAdm.waitForURL((u) => u.origin === new URL(WEB).origin, { timeout: 60_000 });

  const contas = await (await pgAdm.request.get('/api/bff/acesso/usuarios')).json();
  // Casa por `sub`, nunca por username: a conta semeada com --admin-sub entra
  // na lista com username e email nulos, e e ai que o acesso-dev.sh desiste.
  const conta = contas.find?.((c) => c.sub === eu.id);
  if (!conta) { console.error('conta do alvo nao apareceu na lista do admin'); process.exit(1); }

  const catalogo = await (await pgAdm.request.get('/api/bff/acesso/catalogo')).json();
  const escolhido = catalogo.modelos.find((m) => m.id === modelo);
  if (!escolhido) { console.error(`modelo ${modelo} nao existe`); process.exit(1); }

  const r = await pgAdm.request.post(`/api/bff/acesso/usuarios/${conta.id}/concessoes`, {
    data: {
      motivo: 'Provisionamento de ambiente de desenvolvimento pelo driver.',
      origem: escolhido.id,
      concessoes: escolhido.permissoes.map((permissao) => ({ permissao, escopo: { tipo: 'GLOBAL' } })),
    },
  });
  console.log(`HTTP ${r.status()} -- modelo ${modelo} (${escolhido.permissoes.length} acoes) em GLOBAL para ${alvoUsuario}`);
  if (!r.ok()) console.log((await r.text()).slice(0, 500));
  await navegador.close();
  process.exit(r.ok() ? 0 : 1);
}

console.error(`comando desconhecido: ${comando}`);
process.exit(2);
