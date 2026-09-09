import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioLinhaPlanoSchema,
  payloadLinhaPlano,
} from "../src/lib/formularios/plano.ts";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);
const base = {
  rubrica: "BOLSAS", ppgId: "ppg-1", areaTematicaId: "", ano: "2026",
  quantidadeAnual: "2", mesImplementacao: "MARCO", descricao: "", textoFonte: "",
  destino: "EXTERIOR", modalidadeId: "modalidade-1", vigenciaMeses: "6", fluxo: "",
  tipoDespesa: "", tipoMissao: "", numeroParticipantes: "", numeroDiarias: "",
  incluiPassagem: false, valorUnitarioInformado: "", justificativaEstimativa: "",
  status: "PROGRAMADO", justificativaEdicao: "",
};

test("linha de bolsa exige combinacao de catalogo e preserva valor fora do payload", () => {
  assert.equal(formularioLinhaPlanoSchema.safeParse({ ...base, modalidadeId: "" }).success, false);
  assert.deepEqual(payloadLinhaPlano(formularioLinhaPlanoSchema.parse(base)), {
    rubrica: "BOLSAS", ppgId: "ppg-1", areaTematicaId: undefined, ano: 2026,
    quantidadeAnual: 2, mesImplementacao: "MARCO", descricao: undefined,
    textoFonte: undefined, destino: "EXTERIOR", modalidadeId: "modalidade-1",
    vigenciaMeses: "6", fluxo: undefined,
  });
});

test("estimativa nao passa por number e exige justificativa", () => {
  const estimativa = { ...base, rubrica: "MANUTENCAO", modalidadeId: "", vigenciaMeses: "", valorUnitarioInformado: "1234,56", justificativaEstimativa: "Média de três cotações válidas.", tipoDespesa: "SERVICO" };
  const dados = formularioLinhaPlanoSchema.parse(estimativa);
  assert.equal(payloadLinhaPlano(dados).valorUnitarioInformado, "1234,56");
  assert.equal(formularioLinhaPlanoSchema.safeParse({ ...estimativa, justificativaEstimativa: "curta" }).success, false);
});

test("plano mantem URL, carga no servidor e seletores acessiveis", async () => {
  const fonte = await readFile(raiz("src/app/(app)/programas/[programa]/[ciclo]/plano/page.tsx"), "utf8");
  const formulario = await readFile(raiz("src/componentes/formularios/form-linha-plano.tsx"), "utf8");
  assert.match(fonte, /apiFetch<RespostaPlano>/);
  assert.match(fonte, /parametros\.set\("rede"/);
  assert.match(fonte, /new URLSearchParams\(\{ ano: String\(ano\) \}\)/);
  assert.match(fonte, /<Botao/);
  assert.match(formulario, /useWatch/);
  assert.match(formulario, /formularioLinhaPlanoSchema/);
  assert.doesNotMatch(formulario, /useQuery|buscarNoBff/);
});
