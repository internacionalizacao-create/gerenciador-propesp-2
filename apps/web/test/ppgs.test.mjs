import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioPpgSchema,
  payloadPpg,
} from "../src/lib/formularios/ppg.ts";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

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
