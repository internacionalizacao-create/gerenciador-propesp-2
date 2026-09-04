import assert from "node:assert/strict";
import test from "node:test";

test("permite que o dominio do demo carregue os assets do Next em desenvolvimento", async () => {
  const anterior = process.env.APP_BASE_URL;
  process.env.APP_BASE_URL = "https://equipe-teste.ngrok-free.app";

  try {
    const { default: config } = await import(
      `../next.config.ts?demo=${Date.now()}`
    );
    assert.deepEqual(config.allowedDevOrigins, ["equipe-teste.ngrok-free.app"]);
  } finally {
    if (anterior === undefined) delete process.env.APP_BASE_URL;
    else process.env.APP_BASE_URL = anterior;
  }
});
