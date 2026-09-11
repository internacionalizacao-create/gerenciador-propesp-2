import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularExpiracaoDoRefresh,
  refreshVencido,
} from "../src/lib/sessao-expiracao.ts";

/**
 * Regressões da sessão expirada.
 *
 * O que se trava aqui é a decisão de mandar para o login em vez de deixar o
 * render estourar: o proxy corta a sessão cujo refresh token já venceu, e para
 * isso precisa saber quando ele vence — sem chamar o Keycloak.
 */

const AGORA = 1_700_000_000_000;

test("le o refresh_expires_in que o Keycloak manda fora da tipagem", () => {
  const tokens = { access_token: "a", refresh_token: "b", refresh_expires_in: 1800 };
  assert.equal(calcularExpiracaoDoRefresh(tokens, AGORA), AGORA + 1_800_000);
});

test("realm que nao informa o prazo nao inventa um", () => {
  // Sem o parametro a resposta e `undefined`, e nao um prazo chutado: chutar
  // curto deslogaria quem ainda podia renovar.
  assert.equal(calcularExpiracaoDoRefresh({ access_token: "a" }, AGORA), undefined);
  assert.equal(calcularExpiracaoDoRefresh({ refresh_expires_in: 0 }, AGORA), undefined);
  assert.equal(calcularExpiracaoDoRefresh(undefined, AGORA), undefined);
});

test("sessao sem prazo gravado continua tentando renovar", () => {
  // Sessao selada antes do campo existir. Trata-la como vencida deslogaria
  // todo mundo no instante em que esta mudanca subisse.
  assert.equal(refreshVencido({}, AGORA), false);
});

test("refresh vencido e vencido, inclusive no instante exato", () => {
  assert.equal(refreshVencido({ refreshExpiresAt: AGORA - 1 }, AGORA), true);
  assert.equal(refreshVencido({ refreshExpiresAt: AGORA }, AGORA), true);
  assert.equal(refreshVencido({ refreshExpiresAt: AGORA + 1 }, AGORA), false);
});
