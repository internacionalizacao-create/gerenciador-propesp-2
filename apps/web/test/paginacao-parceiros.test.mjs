import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarPaginaParceiros } from '../src/lib/paginacao-parceiros.ts';

test('URL aceita inteiros positivos e normaliza pagina invalida antes da API', () => {
  for (const valor of [null, undefined, '', '0', '-1', '1.5', 'abc', 'Infinity', '2147483648']) {
    assert.equal(normalizarPaginaParceiros(valor), 1);
  }
  assert.equal(normalizarPaginaParceiros('2'), 2);
  assert.equal(normalizarPaginaParceiros('2147483647'), 2147483647);
});
