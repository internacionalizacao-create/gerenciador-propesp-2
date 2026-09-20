import assert from "node:assert/strict";
import test from "node:test";

import {
  convenioVazio,
  formularioConvenioSchema,
  payloadConvenio,
  valoresDoConvenio,
} from "../src/lib/formularios/convenio.ts";

/**
 * Formulário de convênio (V1-032).
 *
 * O que estes casos protegem é a ida e a volta: o acordo lido do histórico
 * precisa voltar para a API **inteiro**, porque `atualizarConvenio` reconcilia
 * a lista de redes e trata campo enviado como intenção explícita.
 */

const redeA = "11111111-1111-4111-8111-111111111111";
const redeB = "22222222-2222-4222-8222-222222222222";
const missaoId = "33333333-3333-4333-8333-333333333333";

function convenioValido(sobrescrever = {}) {
  return {
    ...convenioVazio(),
    titulo: "Acordo de dupla titulação",
    ...sobrescrever,
  };
}

test("o acordo válido vira payload com nulos no lugar de strings vazias", () => {
  const dados = formularioConvenioSchema.parse(convenioValido());
  const payload = payloadConvenio(dados);

  assert.equal(payload.titulo, "Acordo de dupla titulação");
  // Campo vazio vira `null`, e não `""`: é o que faz "limpei este campo"
  // chegar igual na criação e na edição.
  assert.equal(payload.area, null);
  assert.equal(payload.objetivo, null);
  assert.equal(payload.numeroProcesso, null);
  assert.equal(payload.dataFim, null);
  // Missão de origem em branco é "acordo firmado fora de missão", e não um id
  // vazio que a API recusaria como UUID inválido.
  assert.equal(payload.missaoOrigemId, null);
});

test("redesIds viaja sempre, inclusive vazio", () => {
  // A API reconcilia a lista inteira: omitir o campo preservaria as redes que
  // a pessoa acabou de desmarcar, e a tela mostraria o contrário do que salvou.
  const dados = formularioConvenioSchema.parse(convenioValido({ redesIds: [] }));
  assert.deepEqual(payloadConvenio(dados).redesIds, []);

  const comRedes = formularioConvenioSchema.parse(
    convenioValido({ redesIds: [redeA, redeB] }),
  );
  assert.deepEqual(payloadConvenio(comRedes).redesIds, [redeA, redeB]);
});

test("acordo vigente sem data de assinatura é recusado no campo certo", () => {
  const resultado = formularioConvenioSchema.safeParse(
    convenioValido({ situacao: "VIGENTE" }),
  );
  assert.equal(resultado.success, false);
  assert.deepEqual(resultado.error.issues[0].path, ["dataAssinatura"]);

  const comAssinatura = formularioConvenioSchema.safeParse(
    convenioValido({ situacao: "VIGENTE", dataAssinatura: "2027-06-01" }),
  );
  assert.equal(comAssinatura.success, true);
});

test("fim de vigência anterior ao início é recusado antes da ida", () => {
  // A API não compara as duas datas — lá a vigência indeterminada é nula e a
  // comparação não existe. Sem esta guarda, o período impossível só apareceria
  // na leitura, meses depois.
  const resultado = formularioConvenioSchema.safeParse(
    convenioValido({ dataInicio: "2027-06-01", dataFim: "2027-01-01" }),
  );
  assert.equal(resultado.success, false);
  assert.deepEqual(resultado.error.issues[0].path, ["dataFim"]);
});

test("o acordo lido do histórico volta igual para a API", () => {
  // Este é o caso que a V1-032 acrescentou campo por campo ao histórico: se
  // algum deles faltasse na leitura, o formulário o enviaria vazio e a edição
  // apagaria o que ninguém pediu para apagar.
  const doHistorico = {
    titulo: "Acordo de cooperação técnica",
    tipoAcordo: "COOPERACAO_TECNICA",
    area: "Biodiversidade",
    objetivo: "Intercâmbio de pesquisadores",
    situacao: "VIGENTE",
    numeroProcesso: "23456.000123/2027-10",
    dataAssinatura: "2027-06-01",
    dataInicio: "2027-06-15",
    dataFim: null,
    observacoes: "Renovação automática por 4 anos.",
    missaoOrigemId: missaoId,
    redes: [{ id: redeA }, { id: redeB }],
  };

  const dados = formularioConvenioSchema.parse(valoresDoConvenio(doHistorico));
  const payload = payloadConvenio(dados);

  assert.equal(payload.numeroProcesso, "23456.000123/2027-10");
  assert.equal(payload.objetivo, "Intercâmbio de pesquisadores");
  assert.equal(payload.observacoes, "Renovação automática por 4 anos.");
  assert.equal(payload.missaoOrigemId, missaoId);
  assert.deepEqual(payload.redesIds, [redeA, redeB]);
  // Vigência indeterminada continua nula, e não vira data inventada.
  assert.equal(payload.dataFim, null);
});
