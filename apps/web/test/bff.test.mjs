import assert from "node:assert/strict";
import test from "node:test";

import { caminhoBff } from "../src/lib/bff.ts";

test("monta o caminho sob /api/bff, nunca a URL da API", () => {
  // O browser nao pode falar com a API direto: o token so existe do lado do
  // servidor, e quem o injeta e esta rota.
  assert.equal(caminhoBff("parceiros"), "/api/bff/parceiros");
  assert.equal(caminhoBff("/parceiros"), "/api/bff/parceiros");
});

test("parametro vazio ou indefinido nao entra na query", () => {
  // `?busca=` faria a API filtrar por string vazia em vez de nao filtrar.
  assert.equal(
    caminhoBff("parceiros", { busca: "", redeId: undefined }),
    "/api/bff/parceiros",
  );
});

test("so acrescenta ? quando ha algo para mandar", () => {
  assert.equal(caminhoBff("parceiros", {}), "/api/bff/parceiros");
  assert.equal(
    caminhoBff("parceiros", { busca: "montreal" }),
    "/api/bff/parceiros?busca=montreal",
  );
});

test("escapa o que o usuario digitou", () => {
  assert.equal(
    caminhoBff("parceiros", { busca: "a&b=c" }),
    "/api/bff/parceiros?busca=a%26b%3Dc",
  );
});
