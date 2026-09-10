import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioBolsaConcedidaSchema,
  payloadBolsaConcedida,
} from "../src/lib/formularios/bolsa-concedida.ts";

/**
 * Regressões da BOL-010 — as pontas da mobilidade ligadas ao cadastro central.
 *
 * O que se trava aqui é a decisão de 2026-09-09: país sempre do catálogo ISO, e
 * instituição do catálogo **ou** digitada, nunca as duas ao mesmo tempo.
 */

const base = {
  itemPlanejadoId: "11111111-1111-4111-8111-111111111111",
  nome: "Bolsista de Regressão",
  email: "",
  cpf: "529.982.247-25",
  telefone: "",
  lattes: "",
  orcid: "",
  linhaPesquisaId: "",
  orientadorNome: "",
  nivelBeneficiario: "DOUTORADO",
  paisOrigemId: "22222222-2222-4222-8222-222222222222",
  modoInstituicaoOrigem: "catalogo",
  instituicaoOrigemId: "33333333-3333-4333-8333-333333333333",
  instituicaoOrigemNome: "",
  paisDestinoId: "44444444-4444-4444-8444-444444444444",
  modoInstituicaoDestino: "livre",
  instituicaoDestinoId: "",
  instituicaoDestinoNome: "Universidade de Coimbra",
  dataInicio: "03/01/2027",
  dataFim: "30/07/2027",
  status: "SELECIONADO",
  processo: "",
  observacoes: "",
};

test("aceita catalogo numa ponta e texto livre na outra", () => {
  const resultado = formularioBolsaConcedidaSchema.safeParse(base);
  assert.equal(resultado.success, true);
});

test("modo catalogo sem instituicao selecionada e recusado", () => {
  const resultado = formularioBolsaConcedidaSchema.safeParse({
    ...base,
    instituicaoOrigemId: "",
  });
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path.join("."), "instituicaoOrigemId");
});

test("modo livre sem nome digitado e recusado", () => {
  const resultado = formularioBolsaConcedidaSchema.safeParse({
    ...base,
    instituicaoDestinoNome: "",
  });
  assert.equal(resultado.success, false);
  assert.equal(
    resultado.error.issues[0].path.join("."),
    "instituicaoDestinoNome",
  );
});

test("pais e obrigatorio: nao ha mais texto livre para ele", () => {
  const resultado = formularioBolsaConcedidaSchema.safeParse({
    ...base,
    paisDestinoId: "",
  });
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path.join("."), "paisDestinoId");
});

test("data final anterior a inicial e recusada no campo certo", () => {
  const resultado = formularioBolsaConcedidaSchema.safeParse({
    ...base,
    dataFim: "02/01/2027",
  });
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path.join("."), "dataFim");
});

test("o payload manda exatamente uma coluna por ponta", () => {
  const payload = payloadBolsaConcedida(base);

  // Catalogo: vai o id, e o nome nem aparece no corpo.
  assert.equal(payload.modoInstituicaoOrigem, "catalogo");
  assert.equal(
    payload.instituicaoOrigemId,
    "33333333-3333-4333-8333-333333333333",
  );
  assert.equal("instituicaoOrigemNome" in payload, false);

  // Livre: vai o nome, e o id nem aparece — senao a API teria de escolher.
  assert.equal(payload.modoInstituicaoDestino, "livre");
  assert.equal(payload.instituicaoDestinoNome, "Universidade de Coimbra");
  assert.equal("instituicaoDestinoId" in payload, false);
});

test("o ORCID aceita o digito verificador X", () => {
  // Um em cada onze ORCIDs validos termina em X. Tratar o campo como numerico
  // recusaria justamente esses.
  for (const orcid of ["0000-0002-1825-0097", "0000-0002-1694-233X"]) {
    assert.equal(
      formularioBolsaConcedidaSchema.safeParse({ ...base, orcid }).success,
      true,
      orcid,
    );
  }
  const invalido = formularioBolsaConcedidaSchema.safeParse({
    ...base,
    orcid: "0000-0002-1825",
  });
  assert.equal(invalido.success, false);
  assert.equal(invalido.error.issues[0].path.join("."), "orcid");
});

test("o payload converte data BR para ISO e vazio para nulo", () => {
  const payload = payloadBolsaConcedida(base);
  assert.equal(payload.dataInicio, "2027-01-03");
  assert.equal(payload.dataFim, "2027-07-30");
  assert.equal(payload.email, null);
  assert.equal(payload.processo, null);
  // Campos academicos opcionais nao viram string vazia no corpo.
  assert.equal(payload.telefone, null);
  assert.equal(payload.orcid, null);
  assert.equal(payload.linhaPesquisaId, null);
  assert.equal(payload.orientadorNome, null);
});

test("o formulario nao volta a usar FormData", async () => {
  const fonte = await readFile(
    new URL("../src/componentes/formularios/form-bolsa-concedida.tsx", import.meta.url),
    "utf8",
  );
  // A concessao migrou para React Hook Form na BOL-010 (AGENTS.md secao 7).
  assert.match(fonte, /zodResolver\(formularioBolsaConcedidaSchema\)/);
  assert.match(fonte, /useErrosDaAcao\(estado, setError, CAMPOS_DA_API\)/);
  // O seletor de instituicao filtra no servidor; o de pais, no cliente.
  assert.match(fonte, /CampoInstituicao</);
  assert.match(fonte, /CampoCombobox</);
});

test("o seletor de instituicao nao refiltra no cliente o que o servidor filtrou", async () => {
  const fonte = await readFile(
    new URL("../src/componentes/consultas/campo-instituicao.tsx", import.meta.url),
    "utf8",
  );
  assert.match(fonte, /filtrarNoCliente=\{false\}/);
  // `initialData` so vale para o termo vazio: e a lista que o servidor buscou.
  assert.match(fonte, /initialData: termoAdiado === "" \? iniciais : undefined/);
  // A escolhida fica fixada, senao sumiria da lista ao buscar outra coisa.
  assert.match(fonte, /fixada && !encontradas\.some/);
});
