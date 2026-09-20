import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

/**
 * Fontes locais (V1-052).
 *
 * `next/font/google` serve tudo do próprio domínio depois, então o runtime
 * nunca falava com o Google — mas **o build sim**, e um build de intranet que
 * precisa de saída para a internet é um build que quebra no dia em que a saída
 * não existe. O caso abaixo é o que impede o import de voltar por descuido:
 * ele reaparece com uma linha, e a falha só apareceria num servidor sem rede.
 */

const raiz = new URL("../src/", import.meta.url);

async function arquivosDe(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const caminhos = [];
  for (const entrada of entradas) {
    const filho = new URL(
      `${entrada.name}${entrada.isDirectory() ? "/" : ""}`,
      diretorio,
    );
    if (entrada.isDirectory()) caminhos.push(...(await arquivosDe(filho)));
    else if (/\.(ts|tsx|css)$/.test(entrada.name)) caminhos.push(filho);
  }
  return caminhos;
}

test("nada importa next/font/google", async () => {
  // Casa o **import**, e não a menção: o comentário do próprio `layout.tsx`
  // explica por que o carregador do Google saiu, e buscar a string crua
  // marcaria a explicação como se fosse o defeito.
  const importa = /(from|require\()\s*["']next\/font\/google["']/;
  const culpados = [];
  for (const arquivo of await arquivosDe(raiz)) {
    const fonte = await readFile(arquivo, "utf8");
    if (importa.test(fonte)) culpados.push(arquivo.pathname);
  }
  assert.deepEqual(culpados, []);
});

test("o CSS não busca fonte de terceiros", async () => {
  const culpados = [];
  for (const arquivo of await arquivosDe(raiz)) {
    const fonte = await readFile(arquivo, "utf8");
    // `@import` de fonte externa faria o **navegador** buscar no Google, que é
    // pior que o build: vazaria o acesso de cada pessoa que abre a tela.
    if (/fonts\.(googleapis|gstatic)\.com/.test(fonte)) {
      culpados.push(arquivo.pathname);
    }
  }
  assert.deepEqual(culpados, []);
});

test("o layout usa as fontes locais com os mesmos tokens", async () => {
  const layout = await readFile(new URL("app/layout.tsx", raiz), "utf8");
  assert.match(layout, /from "geist\/font\/sans"/);
  assert.match(layout, /from "geist\/font\/mono"/);

  // Os nomes das variáveis são os mesmos que o `globals.css` consome; trocar a
  // origem da fonte não pode mudar a tipografia.
  const css = await readFile(new URL("app/globals.css", raiz), "utf8");
  assert.match(css, /--font-sans: var\(--font-geist-sans\)/);
  assert.match(css, /--font-mono: var\(--font-geist-mono\)/);
});
