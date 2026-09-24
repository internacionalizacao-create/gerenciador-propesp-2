import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  agruparPorModulo,
  alcanceDoFormulario,
  alcancesCompativeis,
  descreverAlcance,
  formularioConcessaoSchema,
  formularioVinculoSchema,
  payloadConcessao,
} from "../src/lib/formularios/acessos.ts";

const cicloId = "11111111-1111-4111-8111-111111111111";
const ppgId = "22222222-2222-4222-8222-222222222222";
const redeId = "33333333-3333-4333-8333-333333333333";

const CATALOGO = [
  { permissao: "plano:read", escopos: ["GLOBAL", "CICLO", "REDE", "PPG"] },
  { permissao: "plano:create", escopos: ["GLOBAL", "CICLO", "REDE", "PPG"] },
  { permissao: "missao:read", escopos: ["GLOBAL", "CICLO", "REDE"] },
  { permissao: "catalogo:read", escopos: ["GLOBAL"] },
];

function concessaoValida(sobrescrever = {}) {
  return {
    permissoes: ["plano:read"],
    tipoAlvo: "PPG",
    alvoId: ppgId,
    cicloDoPpg: cicloId,
    motivo: "Coordenação do PPG no ciclo 2027-2030.",
    origem: "",
    ...sobrescrever,
  };
}

test("o alvo PPG exige o ciclo junto", () => {
  assert.equal(formularioConcessaoSchema.safeParse(concessaoValida()).success, true);

  // Sem o ciclo, a concessão entregaria também o planejamento dos anos
  // seguintes — e é por isso que o campo é próprio, e não herdado da tela.
  const semCiclo = formularioConcessaoSchema.safeParse(
    concessaoValida({ cicloDoPpg: "" }),
  );
  assert.equal(semCiclo.success, false);
  assert.match(
    semCiclo.error.issues.map((i) => i.path.join(".")).join(","),
    /cicloDoPpg/,
  );
});

test("alcance diferente de GLOBAL exige o alvo escolhido", () => {
  const semAlvo = formularioConcessaoSchema.safeParse(
    concessaoValida({ tipoAlvo: "REDE", alvoId: "", cicloDoPpg: "" }),
  );
  assert.equal(semAlvo.success, false);

  // GLOBAL não tem alvo, e exigir um travaria a concessão institucional.
  assert.equal(
    formularioConcessaoSchema.safeParse(
      concessaoValida({ tipoAlvo: "GLOBAL", alvoId: "", cicloDoPpg: "" }),
    ).success,
    true,
  );
});

test("sem ação marcada não há o que conceder", () => {
  assert.equal(
    formularioConcessaoSchema.safeParse(concessaoValida({ permissoes: [] }))
      .success,
    false,
  );
});

test("o motivo é obrigatório: vai para a trilha de auditoria", () => {
  assert.equal(
    formularioConcessaoSchema.safeParse(concessaoValida({ motivo: "ok" }))
      .success,
    false,
  );
});

test("cada ação vira uma linha, com o mesmo alcance", () => {
  const corpo = payloadConcessao(
    concessaoValida({ permissoes: ["plano:read", "plano:create"] }),
  );

  assert.equal(corpo.concessoes.length, 2);
  for (const item of corpo.concessoes) {
    assert.deepEqual(item.escopo, { tipo: "PPG", ppgId, cicloId });
  }
  assert.equal(corpo.motivo, "Coordenação do PPG no ciclo 2027-2030.");
});

test("o modelo entra como origem explicativa, não como herança", () => {
  const corpo = payloadConcessao(
    concessaoValida({ origem: "responsavel-ppg" }),
  );
  assert.equal(corpo.origem, "responsavel-ppg");

  // Sem modelo, o campo nem vai no corpo: nulo ali significaria "veio de um
  // modelo sem nome".
  assert.equal("origem" in payloadConcessao(concessaoValida()), false);
});

test("o alcance montado carrega os dois ids do PPG", () => {
  assert.deepEqual(alcanceDoFormulario(concessaoValida()), {
    tipo: "PPG",
    ppgId,
    cicloId,
  });
  assert.deepEqual(
    alcanceDoFormulario(concessaoValida({ tipoAlvo: "REDE", alvoId: redeId })),
    { tipo: "REDE", redeId },
  );
});

test("os alcances oferecidos são a interseção, nunca a união", () => {
  assert.deepEqual(alcancesCompativeis(["plano:read"], CATALOGO), [
    "GLOBAL",
    "CICLO",
    "REDE",
    "PPG",
  ]);

  // Missão não aceita PPG: marcar as duas reduz o seletor ao que ambas aceitam.
  assert.deepEqual(alcancesCompativeis(["plano:read", "missao:read"], CATALOGO), [
    "GLOBAL",
    "CICLO",
    "REDE",
  ]);

  // Ação institucional só existe em GLOBAL, e arrasta a seleção inteira para lá
  // — em vez de deixar a pessoa escolher um alcance que a API recusaria.
  assert.deepEqual(
    alcancesCompativeis(["plano:read", "catalogo:read"], CATALOGO),
    ["GLOBAL"],
  );

  assert.deepEqual(alcancesCompativeis([], CATALOGO), []);
});

test("as ações são agrupadas pelo domínio do próprio nome", () => {
  const grupos = agruparPorModulo(CATALOGO);

  assert.deepEqual(
    grupos.map((g) => g.modulo),
    ["catalogo", "missao", "plano"],
  );
  assert.equal(grupos.find((g) => g.modulo === "plano").acoes.length, 2);
});

test("o alcance é descrito por nome, sem UUID na tela", () => {
  const nomes = {
    ciclos: { [cicloId]: "2027-2030" },
    ppgs: { [ppgId]: "PPGCLIAMB" },
    redes: { [redeId]: "UNESP" },
  };

  assert.equal(
    descreverAlcance({ tipo: "PPG", ppgId, cicloId }, nomes),
    "PPGCLIAMB · ciclo 2027-2030",
  );
  assert.equal(descreverAlcance({ tipo: "GLOBAL" }, nomes), "Todo o sistema");
  assert.equal(
    descreverAlcance({ tipo: "REDE", redeId }, nomes),
    "Rede UNESP",
  );

  // Alvo que sumiu do cadastro não vira UUID cru na tela: a linha continua
  // legível e o problema fica visível.
  assert.equal(
    descreverAlcance({ tipo: "REDE", redeId: "outro" }, nomes),
    "Rede alvo não encontrado",
  );
});

test("a tela de acessos não promete criar conta nem trocar senha", async () => {
  const pagina = await readFile(
    new URL("../src/app/(app)/configuracoes/acessos/page.tsx", import.meta.url),
    "utf8",
  );

  // A credencial é do Keycloak; prometer o contrário aqui produziria a
  // pergunta "cadastrei e a pessoa não consegue entrar".
  // A quebra de linha do prettier entra no meio da frase: casar com espaço
  // rígido faria o teste falhar por formatação, não por conteúdo.
  assert.match(pagina, /não\s+cria conta nem redefine senha/i);
  assert.match(pagina, /primeiro login/i);
});

test("a própria conta não se administra pela tela", async () => {
  const pagina = await readFile(
    new URL(
      "../src/app/(app)/configuracoes/acessos/[id]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  // A API recusa de todo jeito; a tela não deve oferecer o caminho e deixar a
  // pessoa descobrir no erro.
  assert.match(pagina, /ehAPropriaConta/);
  assert.match(pagina, /podeAdministrar && !ehAPropriaConta/);
});

test("vincular exige confirmação só quando a pessoa está com outra conta", () => {
  const motivo = "Conta nova após recriação do realm.";

  // Sem outra conta, não há o que confirmar.
  assert.equal(
    formularioVinculoSchema(false).safeParse({ motivo, transferir: false })
      .success,
    true,
  );

  // Com outra conta, a caixa desmarcada recusa, apontando o campo.
  const recusa = formularioVinculoSchema(true).safeParse({
    motivo,
    transferir: false,
  });
  assert.equal(recusa.success, false);
  assert.deepEqual(recusa.error.issues[0].path, ["transferir"]);

  assert.equal(
    formularioVinculoSchema(true).safeParse({ motivo, transferir: true })
      .success,
    true,
  );

  // Motivo continua obrigatório nos dois casos: vai para a trilha.
  assert.equal(
    formularioVinculoSchema(false).safeParse({ motivo: "", transferir: false })
      .success,
    false,
  );
});

test("conta pendente não recebe o painel de concessão", async () => {
  const pagina = await readFile(
    new URL(
      "../src/app/(app)/configuracoes/acessos/[id]/page.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  // A API recusa conceder a conta sem pessoa; a tela oferece vincular.
  assert.match(pagina, /pendente && dados\.conta\.ativo/);
  assert.match(pagina, /<VincularPessoa/);
});
