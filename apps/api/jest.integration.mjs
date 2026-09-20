import base from './jest.config.mjs';

/**
 * Testes de integração (`*.int-spec.ts`): rodam contra um Postgres de verdade.
 *
 * Ficam separados dos unitários porque exigem infraestrutura no ar
 * (`pnpm infra:up`) e são mais lentos. `pnpm test` continua rápido e sem
 * dependência externa; `pnpm test:int` valida o que só o banco sabe responder.
 *
 * `maxWorkers: 1` porque todos compartilham o mesmo banco e cada arquivo o
 * trunca — rodar em paralelo faria um teste apagar os dados do outro.
 */
/** @type {import('jest').Config} */
export default {
  ...base,
  rootDir: '.',
  globalSetup: '<rootDir>/test/preparar-integracao.mjs',
  testRegex: '.*\\.int-spec\\.ts$',
  maxWorkers: 1,
  testTimeout: 30_000,
};
