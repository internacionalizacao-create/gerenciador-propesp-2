import assert from "node:assert/strict";
import test from "node:test";

import { chaveDaRede, identidadeDaRede, posicaoDaRede } from "../src/lib/redes.ts";

test("a cor da rede sai do nome, e não da posição na lista", () => {
  // Em ordem alfabética a UFMG vem primeiro; por posição ela ganharia
  // network-1 no gráfico enquanto a P10 dá network-1 à UNESP.
  const alfabetica = ["UFMG", "UNESP", "UNICAMP"];
  const cores = alfabetica.map((nome, i) => identidadeDaRede(nome, i).cor);
  assert.deepEqual(cores, [
    "var(--network-2)",
    "var(--network-1)",
    "var(--network-3)",
  ]);
});

test("rede desconhecida cai na posição que ocupa", () => {
  assert.equal(posicaoDaRede("Rede Nova", 1), 1);
  assert.equal(posicaoDaRede("Rede Nova", 4), 1);
});

test("a chave de URL é a mesma da P10", () => {
  assert.equal(chaveDaRede("UNESP"), "unesp");
  assert.equal(chaveDaRede("Rede Amazônica de Pesquisa"), "rede-amazonica-de-pesquisa");
});
