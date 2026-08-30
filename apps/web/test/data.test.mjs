import assert from "node:assert/strict";
import test from "node:test";

import {
  dataBrParaIso,
  dataIsoParaBr,
  mascararDataBr,
} from "../src/lib/formato.ts";

test("converte datas entre o formato brasileiro e o contrato ISO", () => {
  assert.equal(dataBrParaIso("03/01/2027"), "2027-01-03");
  assert.equal(dataBrParaIso("30/07/2027"), "2027-07-30");
  assert.equal(dataIsoParaBr("2027-07-30"), "30/07/2027");
});

test("mantém a ordem cronológica do período informado na tela", () => {
  const inicio = dataBrParaIso("03/01/2027");
  const fim = dataBrParaIso("30/07/2027");

  assert.ok(inicio);
  assert.ok(fim);
  assert.ok(fim >= inicio);
});

test("rejeita datas inexistentes e mascara a digitação", () => {
  assert.equal(dataBrParaIso("31/02/2027"), null);
  assert.equal(dataBrParaIso("07/30/2027"), null);
  assert.equal(mascararDataBr("30072027"), "30/07/2027");
});
