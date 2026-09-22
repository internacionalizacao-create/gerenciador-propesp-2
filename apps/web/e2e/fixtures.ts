import { test as base, expect, type Page, type Locator } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { ambiente, raiz } from '../../../scripts/e2e-ambiente.mjs';

interface Dados {
  paisId: string; linhaId: string; redeId: string; cicloId: string;
  ppgId: string; coordenadorTematicaId: string; areaTematicaId: string;
  modalidadeId: string; instituicaoId: string;
  ppgVizinhoId: string; ppgAvulsoId: string;
  leitor: { usuarioId: string }; semAcesso: { usuarioId: string };
}
export const test = base.extend<{ dados: Dados }>({
  dados: async ({}, executarTeste) => {
    const saida = execFileSync('pnpm', ['exec', 'ts-node', '--transpile-only', '--compiler-options',
      '{"module":"CommonJS","moduleResolution":"node","resolvePackageJsonExports":false}', 'test/e2e-seed.ts'], {
      cwd: `${raiz}apps/api`, env: { ...process.env, ...ambiente }, encoding: 'utf8', timeout: 60_000,
    });
    await executarTeste(JSON.parse(saida.trim().split('\n').at(-1)!));
  },
});
export { expect };
export const ciclo = '/programas/programa-teste/2027-2030';
export async function entrar(page: Page, perfil = 'admin', destino = '/ppgs') {
  await page.goto(`/api/auth/login?returnTo=${encodeURIComponent(destino)}`);
  await expect(page).toHaveURL(/38459/);
  await page.locator('#username').fill(`e2e-${perfil}`);
  await page.locator('#password').fill('TesteE2e123!');
  await page.locator('#kc-login').click();
  await expect(page).toHaveURL(new RegExp(`33058${destino.replace(/[?]/g, '\\?')}`));
  const me = await page.request.get('/api/bff/me');
  expect(me.status()).toBe(200);
}
export async function abrir(page: Page, botao: string | RegExp) {
  // Cabecalho e estado vazio oferecem o mesmo painel; qualquer um dos dois serve.
  await page.getByRole('button', { name: botao, exact: typeof botao === 'string' }).first().click();
  const painel = page.getByRole('dialog');
  await expect(painel).toBeVisible();
  return painel;
}
export async function salvar(painel: Locator, botao: string) {
  await painel.getByRole('button', { name: botao, exact: true }).click();
  await expect(painel).not.toBeVisible();
}
export async function proximo(painel: Locator) {
  await painel.getByRole('button', { name: /Próxim|Avançar/ }).click();
}
export async function arquivoPdf() {
  const require = createRequire(`${raiz}apps/api/package.json`);
  const { PDFDocument } = require('pdf-lib');
  const doc = await PDFDocument.create();
  doc.addPage().drawText('Documento sintetico V1-059');
  return { name: 'documento-sintetico.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await doc.save()) };
}
