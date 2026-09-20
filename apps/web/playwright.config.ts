import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: '../../.e2e/resultados',
  reporter: [['list'], ['html', { outputFolder: '../../.e2e/relatorio', open: 'never' }]],
  use: {
    actionTimeout: 15_000,
    baseURL: 'http://localhost:33058',
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
