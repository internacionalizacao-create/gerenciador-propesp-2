import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

test("a fundacao de UI oferece estados de consulta acessiveis", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/basicos.tsx"), "utf8");
  assert.match(fonte, /export function Esqueleto/);
  assert.match(fonte, /aria-hidden="true"/);
  assert.match(fonte, /export function Paginacao/);
  assert.match(fonte, /aria-label="Paginação"/);
  assert.match(fonte, /role=\{tom === "perigo" \? "alert" : undefined\}/);
});

test("o login usa componentes locais sem transformar OIDC em formulario", async () => {
  const fonte = await readFile(raiz("src/app/login/page.tsx"), "utf8");
  assert.match(fonte, /import \{ Aviso, Selo \}/);
  assert.match(fonte, /<Botao comoFilho/);
  assert.match(fonte, /href=\{destinoLogin\}/);
  assert.match(fonte, /normalizarReturnTo/);
  assert.doesNotMatch(fonte, /type="password"/);
});

test("o catalogo filtra dados ja carregados e compartilha o recorte na URL", async () => {
  const fonte = await readFile(
    raiz("src/componentes/consultas/lista-itens-catalogo.tsx"),
    "utf8",
  );
  assert.match(fonte, /useDeferredValue/);
  assert.match(fonte, /window\.history\.replaceState/);
  assert.match(fonte, /<EstadoVazio/);
  assert.match(fonte, /md:hidden/);
  assert.match(fonte, /hidden md:block/);
  assert.doesNotMatch(fonte, /buscarNoBff|useQuery/);
});
