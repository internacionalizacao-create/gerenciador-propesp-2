import assert from "node:assert/strict";
import test from "node:test";

import { deveNotificarAcao } from "../src/componentes/ui/toast-logica.ts";

test("não notifica estados inicial e de erro", () => {
  assert.equal(deveNotificarAcao({ ok: false }, null), false);
  assert.equal(
    deveNotificarAcao({ ok: false, mensagem: "Falhou" }, null),
    false,
  );
});

test("notifica um novo resultado de sucesso", () => {
  const sucesso = { ok: true, mensagem: "Cadastrado" };
  assert.equal(deveNotificarAcao(sucesso, null), true);
});

test("não repete o toast quando o mesmo sucesso renderiza novamente", () => {
  const sucesso = { ok: true, mensagem: "Cadastrado" };
  assert.equal(deveNotificarAcao(sucesso, sucesso), false);
  assert.equal(
    deveNotificarAcao({ ok: true, mensagem: "Outro cadastro" }, sucesso),
    true,
  );
});
