import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formularioModalidadeSchema } from "../src/lib/formularios/catalogo.ts";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

test("o schema de modalidade recusa envio invalido e preserva valores validos", () => {
  const invalido = formularioModalidadeSchema.safeParse({
    nome: "AB",
    publicoAlvo: "FORA_DO_CONTRATO",
    ativa: "true",
  });
  assert.equal(invalido.success, false);

  const valido = formularioModalidadeSchema.parse({
    nome: "Doutorado Sanduíche",
    publicoAlvo: "DISCENTE",
    ativa: false,
  });
  assert.deepEqual(valido, {
    nome: "Doutorado Sanduíche",
    publicoAlvo: "DISCENTE",
    ativa: false,
  });
});

test("a lista explica destinos, situacao, vigencia e os estados vazio/responsivo", async () => {
  const fonte = await readFile(
    raiz("src/componentes/consultas/lista-modalidades.tsx"),
    "utf8",
  );
  assert.match(fonte, /<EstadoVazio/);
  assert.match(fonte, /Nenhum destino publicado/);
  assert.match(fonte, /Ativa/);
  assert.match(fonte, /Inativa/);
  assert.match(fonte, /A duração não pertence à modalidade/);
  assert.match(fonte, /hidden md:block/);
  assert.match(fonte, /md:hidden/);
});

test("o formulario usa RHF, devolve erros da API e mantem a mutacao autorizada", async () => {
  const formulario = await readFile(
    raiz("src/componentes/formularios/form-modalidade.tsx"),
    "utf8",
  );
  const acoes = await readFile(raiz("src/acoes/catalogo.ts"), "utf8");
  const pagina = await readFile(
    raiz("src/app/(app)/catalogos/modalidades/page.tsx"),
    "utf8",
  );

  assert.match(formulario, /useForm<DadosFormularioModalidade>/);
  assert.match(formulario, /zodResolver\(formularioModalidadeSchema\)/);
  assert.match(formulario, /useErrosDaAcao\(estado, setError, CAMPOS_DA_API\)/);
  assert.match(formulario, /useToastDaAcao\(estado, aoConcluir\)/);
  assert.match(acoes, /export async function criarModalidade/);
  assert.match(acoes, /export async function atualizarModalidade/);
  assert.match(acoes, /\[MODALIDADES, BOLSAS\]/);
  assert.match(pagina, /me\.permissions\.includes\("catalogo:write"\)/);
});
