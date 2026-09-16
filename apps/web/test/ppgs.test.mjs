import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioPpgSchema,
  payloadPpg,
} from "../src/lib/formularios/ppg.ts";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

const ppgMinimo = {
  nome: "Programa de Teste", sigla: "PPGT", unidade: "", nivel: "", modalidade: "",
  notaCapes: "", areaCapes: "", situacao: "ATIVO", emRede: false,
  redeAcademica: "", observacoes: "", linhasPesquisa: [],
};

test("o cadastro minimo aceita opcionais vazios e envia nulo para a API", () => {
  const payload = payloadPpg(formularioPpgSchema.parse(ppgMinimo));
  assert.equal(payload.notaCapes, null);
  assert.equal(payload.nivel, null);
  assert.equal(payload.modalidade, null);
  assert.deepEqual(payload.linhasPesquisa, []);
});

test("o formulario respeita os limites da API e recusa conceito fracionario", () => {
  for (const [campo, limite] of Object.entries({ nome: 300, sigla: 40, unidade: 200, areaCapes: 200, redeAcademica: 120, observacoes: 2000 })) {
    assert.equal(formularioPpgSchema.safeParse({ ...ppgMinimo, [campo]: "a".repeat(limite) }).success, true, campo);
    const resultado = formularioPpgSchema.safeParse({ ...ppgMinimo, [campo]: "a".repeat(limite + 1) });
    assert.equal(resultado.success, false, campo);
    assert.equal(resultado.error.issues[0].path[0], campo);
  }
  assert.equal(formularioPpgSchema.safeParse({ ...ppgMinimo, notaCapes: "5.5" }).success, false);
  assert.equal(formularioPpgSchema.safeParse({ ...ppgMinimo, linhasPesquisa: ["a"] }).success, false);
  assert.equal(formularioPpgSchema.safeParse({ ...ppgMinimo, linhasPesquisa: ["a".repeat(301)] }).success, false);
});

test("o schema de PPG recusa identificacao e conceito invalidos", () => {
  const resultado = formularioPpgSchema.safeParse({
    nome: "AB", sigla: "X", unidade: "", nivel: "", modalidade: "",
    notaCapes: "8", areaCapes: "", situacao: "ATIVO", emRede: false,
    redeAcademica: "", observacoes: "", linhasPesquisa: [],
  });
  assert.equal(resultado.success, false);
});

test("o payload de PPG preserva booleano e converte campos vazios em nulo", () => {
  const dados = formularioPpgSchema.parse({
    nome: "Programa de Teste", sigla: "PPGT", unidade: "", nivel: "MESTRADO",
    modalidade: "ACADEMICO", notaCapes: "6", areaCapes: "", situacao: "ATIVO",
    emRede: true, redeAcademica: "BIONORTE", observacoes: "", linhasPesquisa: ["Ecologia"],
  });
  assert.deepEqual(payloadPpg(dados), {
    nome: "Programa de Teste", sigla: "PPGT", unidade: null, nivel: "MESTRADO",
    modalidade: "ACADEMICO", notaCapes: 6, areaCapes: null, situacao: "ATIVO",
    emRede: true, redeAcademica: "BIONORTE", observacoes: null, linhasPesquisa: ["Ecologia"],
  });
});

test("PPGs preserva filtros, acesso, detalhe no servidor e estados responsivos", async () => {
  const lista = await readFile(raiz("src/componentes/consultas/lista-ppgs.tsx"), "utf8");
  const detalhe = await readFile(raiz("src/app/(app)/ppgs/[id]/page.tsx"), "utf8");
  const formulario = await readFile(raiz("src/componentes/formularios/form-ppg.tsx"), "utf8");
  const acoes = await readFile(raiz("src/acoes/ppgs.ts"), "utf8");

  assert.match(lista, /useDeferredValue/);
  assert.match(lista, /window\.history\.replaceState/);
  assert.match(lista, /<EstadoVazio/);
  assert.match(lista, /hidden md:block/);
  assert.match(lista, /md:hidden/);
  assert.match(detalhe, /notFound\(\)/);
  assert.match(detalhe, /<Cartoes>/);
  assert.match(formulario, /useForm<DadosFormularioPpg>/);
  assert.match(formulario, /zodResolver\(formularioPpgSchema\)/);
  assert.match(acoes, /payloadPpg\(dados\)/);
  assert.match(acoes, /\["\/ppgs", "\/"\]/);
});
