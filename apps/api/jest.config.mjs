/**
 * Jest em modo ESM.
 *
 * `jose` e `openid-client` sao ESM-only. Em producao isso nao e problema — o
 * Node 24 sabe dar `require()` em ESM —, mas o runtime de modulos do Jest nao
 * implementa essa ponte, e um `import` de `jose` dentro de um teste CJS estoura
 * com "Unexpected token 'export'". Rodar a suite em ESM resolve na raiz, em vez
 * de mandar o Jest transpilar a biblioteca.
 *
 * O `NODE_OPTIONS=--experimental-vm-modules` no script `test` e exigido pelo
 * Jest 30 para habilitar modulos ESM na VM.
 */

/** @type {import('jest').Config} */
export default {
  rootDir: 'src',
  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        // O tsconfig do app compila para CommonJS (o que o `nest build` quer).
        // Aqui a saida precisa ser ESM, entao os campos de modulo sao trocados —
        // e so os de modulo; decorators e metadata continuam ligados, senao a
        // injecao de dependencia do Nest para de funcionar nos testes.
        tsconfig: {
          module: 'esnext',
          moduleResolution: 'bundler',
          target: 'ES2023',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          esModuleInterop: true,
          strictNullChecks: true,
        },
      },
    ],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
};
