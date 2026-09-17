import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { filtrarItensCatalogo } from "../src/componentes/consultas/catalogo-logica.ts";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);
const itens = [
  {
    codigo: "PDSE-EXT",
    modalidade: "Doutorado Sanduíche",
    destino: "EXTERIOR",
    fonte: "Portaria 33",
    observacao: null,
  },
  {
    codigo: "PVN-BR",
    modalidade: "Professor Visitante",
    destino: "BRASIL",
    fonte: null,
    observacao: "Até quinze dias",
  },
];

test("o catalogo carregado mantem todos os itens quando nao ha filtro", () => {
  assert.deepEqual(filtrarItensCatalogo(itens, "", "TODOS"), itens);
});

test("o catalogo filtra por destino e busca sem depender de maiusculas", () => {
  assert.deepEqual(filtrarItensCatalogo(itens, "sanduíche", "EXTERIOR"), [itens[0]]);
  assert.deepEqual(filtrarItensCatalogo(itens, "quinze", "BRASIL"), [itens[1]]);
  assert.deepEqual(filtrarItensCatalogo(itens, "portaria", "BRASIL"), []);
});

test("a interface cobre vazio, acesso restrito, tema e variantes responsivas", async () => {
  const pagina = await readFile(
    raiz("src/app/(app)/catalogos/bolsas/page.tsx"),
    "utf8",
  );
  const lista = await readFile(
    raiz("src/componentes/consultas/lista-itens-catalogo.tsx"),
    "utf8",
  );
  const css = await readFile(raiz("src/app/globals.css"), "utf8");

  // A permissão continua decidida no servidor; ocultar ações não é autorização.
  assert.match(pagina, /me\.permissions\.includes\("catalogo:create"\)/);
  assert.match(lista, /podeEditar \? \(/);
  assert.match(lista, /<EstadoVazio/);
  assert.match(lista, /hidden md:block/);
  assert.match(lista, /md:hidden/);
  // Os componentes usam tokens que existem tanto no claro quanto no escuro.
  assert.match(lista, /bg-surface/);
  assert.match(lista, /text-foreground/);
  assert.match(css, /\[data-theme="dark"\]/);
});
