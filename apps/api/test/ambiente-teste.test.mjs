import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { test } from 'node:test';
import { Pool } from 'pg';
import { conferirBancoTeste, validarUrlTeste } from './ambiente-teste.ts';

for (const destino of [
  undefined,
  'inválida-senha-secreta',
  'postgresql://u:senha-secreta@localhost/gerenciador',
  'postgresql://u:senha-secreta@localhost/contest',
  'postgresql://u:senha-secreta@localhost/producao?db=/gerenciador_test',
  'postgresql://u:senha-secreta@localhost/gerenciador_test?dbname=producao',
  'postgresql://u:senha-secreta@localhost/gerenciador_test#fragmento',
  'postgresql://u:senha-secreta@servidor.institucional/gerenciador_test',
  'https://localhost/gerenciador_test',
]) {
  test(`recusa destino inseguro ${destino === undefined ? 'ausente' : new URL(destino, 'http://exemplo').pathname}`, () => {
    assert.throws(
      () => validarUrlTeste(destino),
      (erro) => {
        assert.doesNotMatch(erro.message, /senha-secreta/);
        return true;
      },
    );
  });
}

test('aceita somente os destinos locais documentados', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const url = `postgresql://u:senha@${host}:55432/gerenciador_test`;
    assert.equal(validarUrlTeste(url), url);
  }
});

test('recusa conexão cujo servidor informa outro banco', async () => {
  await assert.rejects(
    conferirBancoTeste({
      query: async () => ({ rows: [{ banco: 'gerenciador' }] }),
    }),
    /não confirmou/,
  );
});

test('conexão indisponível falha sem expor senha e libera o pool', async () => {
  // Porta local reservada, mas sem listener: nao depende de porta livre fixa.
  const servidor = createServer();
  await new Promise((resolve) => servidor.listen(0, '127.0.0.1', resolve));
  const porta = servidor.address().port;
  await new Promise((resolve) => servidor.close(resolve));
  const pool = new Pool({
    connectionString: `postgresql://u:senha-secreta@127.0.0.1:${porta}/gerenciador_test`,
    connectionTimeoutMillis: 500,
  });
  try {
    await assert.rejects(conferirBancoTeste(pool), (erro) => {
      assert.match(erro.message, /Banco de testes indisponível/);
      assert.doesNotMatch(erro.message, /senha-secreta|postgresql:/);
      assert.equal(erro.cause, undefined);
      return true;
    });
  } finally {
    await pool.end();
  }
});
