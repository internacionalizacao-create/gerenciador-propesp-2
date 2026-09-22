import assert from "node:assert/strict";
import test from "node:test";

import {
  consequenciasDoTipo,
  eventoVazio,
  formularioCorrecaoEventoSchema,
  formularioEventoSchema,
  formularioMovimentacaoSchema,
  movimentacaoVazia,
  payloadCorrecaoMovimentacao,
  payloadEvento,
  payloadMovimentacao,
  situacoesEditaveis,
  tiposElegiveis,
  valoresDaMovimentacao,
  valoresDoEvento,
} from "../src/lib/formularios/eventos-externos.ts";

/**
 * Formulários dos eventos externos da CAPES (V1-037).
 *
 * O que se protege aqui é que a tela só ofereça o que a API aceitaria, diga
 * antes o efeito do registro e não mande campo abandonado — a API continua
 * sendo a fronteira, e estes casos evitam a ida que ela recusaria.
 */

const tipos = [
  {
    codigo: "DESISTENCIA",
    rotulo: "Desistência",
    descricao: null,
    estadosOrigem: ["SELECIONADO", "EM_ANDAMENTO"],
    estadoDestino: "CANCELADA",
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: false,
  },
  {
    codigo: "INTERRUPCAO",
    rotulo: "Interrupção",
    descricao: null,
    estadosOrigem: ["EM_ANDAMENTO"],
    estadoDestino: "INTERROMPIDA",
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: true,
  },
  {
    codigo: "SUBSTITUICAO",
    rotulo: "Substituição",
    descricao: null,
    estadosOrigem: ["SELECIONADO", "EM_ANDAMENTO"],
    estadoDestino: "CANCELADA",
    aceitaSubstituta: true,
    aceitaPrevisaoRetorno: false,
  },
];

const ppgA = "11111111-1111-4111-8111-111111111111";
const ppgB = "22222222-2222-4222-8222-222222222222";
const tematica = "33333333-3333-4333-8333-333333333333";
const bolsa = "44444444-4444-4444-8444-444444444444";

test("só oferece os eventos que partem da situação atual", () => {
  assert.deepEqual(
    tiposElegiveis(tipos, "SELECIONADO").map((t) => t.codigo),
    ["DESISTENCIA", "SUBSTITUICAO"],
  );
  assert.deepEqual(tiposElegiveis(tipos, "CANCELADA"), []);
});

test("diz o efeito antes de salvar, sem prometer mudança no orçamento", () => {
  const desistencia = consequenciasDoTipo(tipos[0], "EM_ANDAMENTO");
  assert.match(desistencia[0], /de Em andamento para Cancelada/);
  assert.match(desistencia.join(" "), /volta a ficar disponível/);
  assert.match(desistencia.at(-1), /não mudam/);

  const interrupcao = consequenciasDoTipo(tipos[1], "EM_ANDAMENTO");
  assert.match(interrupcao.join(" "), /continua ocupada/);

  // Nenhuma frase sugere que o sistema autoriza ou solicita algo.
  for (const linha of [...desistencia, ...interrupcao]) {
    assert.doesNotMatch(linha, /autoriz|solicit|aprov/i);
  }
});

test("a edição da bolsa não oferece cancelada nem interrompida", () => {
  assert.deepEqual(situacoesEditaveis("EM_ANDAMENTO"), [
    "SELECIONADO",
    "EM_ANDAMENTO",
    "CONCLUIDA",
  ]);
  // A situação atual continua na lista, para o campo não ficar vazio.
  assert.equal(situacoesEditaveis("CANCELADA").includes("CANCELADA"), true);
});

test("o evento viaja com a chave e em ISO, sem campo que o tipo não aceita", () => {
  const dados = formularioEventoSchema.parse({
    ...eventoVazio(),
    tipo: "DESISTENCIA",
    dataAto: "12/05/2026",
    justificativa: "Aprovada em concurso público.",
    // Digitado numa interrupção e abandonado ao trocar de tipo.
    previsaoRetorno: "01/12/2026",
    bolsaSubstitutaId: bolsa,
  });
  assert.deepEqual(payloadEvento(dados, "chave-1", tipos[0]), {
    chave: "chave-1",
    tipo: "DESISTENCIA",
    dataAto: "2026-05-12",
    justificativa: "Aprovada em concurso público.",
    referenciaExterna: null,
    previsaoRetorno: null,
    bolsaSubstitutaId: null,
  });

  const substituicao = payloadEvento(
    { ...dados, tipo: "SUBSTITUICAO" },
    "chave-2",
    tipos[2],
  );
  assert.equal(substituicao.bolsaSubstitutaId, bolsa);
});

test("recusa previsão de retorno anterior ao ato e correção sem motivo", () => {
  const resultado = formularioEventoSchema.safeParse({
    ...eventoVazio(),
    tipo: "INTERRUPCAO",
    dataAto: "12/05/2026",
    justificativa: "Licença médica.",
    previsaoRetorno: "01/05/2026",
  });
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path[0], "previsaoRetorno");

  const correcao = valoresDoEvento({
    tipo: "DESISTENCIA",
    dataAto: "2026-05-12",
    justificativa: "Motivo.",
    referenciaExterna: null,
    previsaoRetorno: null,
    bolsaSubstitutaId: null,
  });
  assert.equal(correcao.dataAto, "12/05/2026");
  assert.equal(formularioCorrecaoEventoSchema.safeParse(correcao).success, false);
});

test("movimentação exige PPGs diferentes e só manda modalidade em bolsas", () => {
  const base = {
    ...movimentacaoVazia(2027),
    dataAto: "01/06/2026",
    areaTematicaId: tematica,
    ppgOrigemId: ppgA,
    ppgDestinoId: ppgA,
    valor: "82902,20",
    justificativa: "Realocada pela CAPES.",
  };
  const repetido = formularioMovimentacaoSchema.safeParse(base);
  assert.equal(repetido.success, false);
  assert.equal(repetido.error.issues[0].path[0], "ppgDestinoId");

  const dados = formularioMovimentacaoSchema.parse({
    ...base,
    ppgDestinoId: ppgB,
    rubrica: "BOLSAS",
    quantidade: "1",
  });
  assert.deepEqual(payloadMovimentacao(dados, "chave-3"), {
    chave: "chave-3",
    status: "EXECUTADO",
    dataAto: "2026-06-01",
    ano: 2027,
    areaTematicaId: tematica,
    ppgOrigemId: ppgA,
    ppgDestinoId: ppgB,
    rubrica: "BOLSAS",
    modalidadeId: null,
    quantidade: 1,
    valor: "82902.20",
    justificativa: "Realocada pela CAPES.",
    referenciaExterna: null,
    observacoes: null,
  });
});

test("a correção da movimentação volta como foi digitada e não reenvia a chave", () => {
  const valores = valoresDaMovimentacao({
    dataAto: "2026-06-01",
    ano: 2027,
    areaTematicaId: tematica,
    ppgOrigemId: ppgA,
    ppgDestinoId: ppgB,
    rubrica: "MISSOES",
    modalidadeId: null,
    quantidade: null,
    valor: "1500.00",
    justificativa: "Ajuste.",
    referenciaExterna: "Ofício 3",
    observacoes: null,
  });
  assert.equal(valores.valor, "1500,00");
  const payload = payloadCorrecaoMovimentacao({ ...valores, motivo: "Valor." });
  assert.equal("chave" in payload, false);
  assert.equal("status" in payload, false);
  assert.equal(payload.valor, "1500.00");
  assert.equal(payload.motivo, "Valor.");
});
