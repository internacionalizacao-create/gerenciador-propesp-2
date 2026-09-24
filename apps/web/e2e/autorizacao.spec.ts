import { execFileSync } from 'node:child_process';
import type { Page } from '@playwright/test';
import { test, expect, entrar, abrir, salvar, ciclo } from './fixtures';
import { ambiente, raiz } from '../../../scripts/e2e-ambiente.mjs';

const modelos = ['administrador', 'secretaria', 'responsavel-ppg', 'responsavel-tematica', 'gestor-rede', 'comite-gestor', 'consulta'];
const sondas = [
  { menu: 'Resumo do orçamento anual', acoes: ['painel:read'], api: '/programas/padrao/painel' },
  { menu: 'Mapa e destinos', acoes: ['bolsa:read'], api: '/mobilidade/panorama' },
  { menu: 'Bolsistas', acoes: ['bolsa:read'], api: '/bolsistas' },
  { menu: 'Ciclo atual', acoes: ['programa:read'], api: ciclo },
  { menu: 'Redes e temáticas', acoes: ['orcamento:read'], api: `${ciclo}/redes` },
  { menu: 'Orçamento', acoes: ['orcamento:read'], api: `${ciclo}/orcamento` },
  { menu: 'Comitê Gestor e Administração', acoes: ['equipe-gestao:read'], api: `${ciclo}/comite-gestor` },
  { menu: 'Eventos da CAPES', acoes: ['evento:read'], api: `${ciclo}/eventos-bolsista` },
  { menu: 'Catálogo de bolsas', acoes: ['catalogo:read'], api: '/catalogo/bolsas?programa=programa-teste' },
  { menu: 'PPGs', acoes: ['ppg:read'], api: '/ppgs' },
  { menu: 'Programas', acoes: ['programa:read'], api: '/programas' },
  { menu: 'Plano de aplicação', acoes: ['plano:read'], api: `${ciclo}/plano` },
  { menu: 'Mobilidade', acoes: ['bolsa:read'], api: '/mobilidade/panorama' },
  { menu: 'Produção', acoes: ['bolsa:read', 'produto:read'], api: '/mobilidade/producao' },
  { menu: 'Parceiros', acoes: ['parceiro:read'], api: '/parceiros' },
  { menu: 'Modalidades', acoes: ['catalogo:read'], api: '/catalogo/modalidades' },
  { menu: 'Acessos', acoes: ['acesso:read'], api: '/acesso/usuarios' },
];

async function permissoes(page: Page): Promise<string[]> {
  const resposta = await page.request.get('/api/bff/me');
  expect(resposta.status()).toBe(200);
  const me = await resposta.json();
  expect(me).not.toHaveProperty('escopo');
  return me.permissions;
}

async function concederPelaTela(page: Page, usuarioId: string, acoes: string[], ppg?: { id: string; cicloId: string }) {
  await page.goto(`/configuracoes/acessos/${usuarioId}`);
  const painel = await abrir(page, 'Conceder acesso');
  for (const acao of acoes) await painel.locator('label').filter({ has: page.getByText(acao, { exact: true }) }).getByRole('checkbox').check();
  if (ppg) {
    await painel.getByLabel('Alcance', { exact: false }).selectOption('PPG');
    await painel.getByLabel('Onde', { exact: false }).selectOption(ppg.id);
    await painel.getByRole('combobox', { name: /^Ciclo/ }).selectOption(ppg.cicloId);
  }
  await painel.getByLabel('Motivo', { exact: false }).fill('Validação do alcance em sessão real.');
  await salvar(painel, 'Conceder');
}

for (const modeloId of modelos) {
  test(`modelo ${modeloId}: concessão pela tela, menu, API e revogação imediata`, async ({ page, browser, dados }) => {
    await entrar(page, 'admin', `/configuracoes/acessos/${dados.semAcesso.usuarioId}`);
    const contexto = await browser.newContext({ baseURL: ambiente.APP_BASE_URL });
    const destinatario = await contexto.newPage();
    try {
      await entrar(destinatario, 'sem-acesso');
      expect(await permissoes(destinatario)).toEqual([]);
      const catalogo = await (await page.request.get('/api/bff/acesso/catalogo')).json();
      expect(catalogo.modelos.map((m: { id: string }) => m.id).sort()).toEqual([...modelos].sort());
      const modelo = catalogo.modelos.find((m: { id: string }) => m.id === modeloId);
      const painel = await abrir(page, 'Conceder acesso');
      await painel.getByLabel('Começar de um modelo', { exact: false }).selectOption(modeloId);
      await expect(painel.locator('input[type="checkbox"]:checked')).toHaveCount(modelo.permissoes.length);
      await painel.getByLabel('Motivo', { exact: false }).fill(`Validação do modelo ${modeloId}.`);
      await painel.getByRole('button', { name: 'Conferir', exact: true }).click();
      await expect(painel.getByText(/nova\(s\)/)).toBeVisible();
      expect(await permissoes(destinatario)).toEqual([]);
      await salvar(painel, 'Conceder');
      expect((await permissoes(destinatario)).sort()).toEqual([...modelo.permissoes].sort());
      await destinatario.reload();
      const menu = destinatario.getByRole('navigation', { name: 'Navegação principal' });
      await expect(menu.getByRole('link', { name: 'Avisos', exact: true })).toHaveCount(1);
      for (const sonda of sondas) {
        const permitido = sonda.acoes.every(acao => modelo.permissoes.includes(acao));
        await expect(menu.getByRole('link', { name: sonda.menu, exact: true })).toHaveCount(permitido ? 1 : 0);
        expect((await destinatario.request.get(`/api/bff${sonda.api}`)).status(), sonda.api).toBe(permitido ? 200 : 403);
      }
      // Requisicao valida exercita escrita; consulta nao deve ganhar cadastro.
      const criar = await destinatario.request.post('/api/bff/ppgs', { data: { nome: 'PPG da jornada', sigla: 'JORNADA' } });
      expect(criar.status()).toBe(modelo.permissoes.includes('ppg:create') ? 201 : 403);
      const { concessoes } = await (await page.request.get(`/api/bff/acesso/usuarios/${dados.semAcesso.usuarioId}/concessoes`)).json();
      for (const concessao of concessoes) {
        const revogar = await page.request.post(`/api/bff/acesso/concessoes/${concessao.id}/revogacao`, { data: { motivo: 'Fim da jornada do modelo.' } });
        expect(revogar.status()).toBe(201);
      }
      expect(await permissoes(destinatario)).toEqual([]);
      for (const sonda of sondas) expect((await destinatario.request.get(`/api/bff${sonda.api}`)).status()).toBe(403);
      await destinatario.reload();
      for (const sonda of sondas) await expect(menu.getByRole('link', { name: sonda.menu, exact: true })).toHaveCount(0);
      await expect(destinatario.getByRole('main').getByText('Sua conta ainda não recebeu acesso', { exact: true })).toBeVisible();
    } finally { await contexto.close(); }
  });
}

test('duas contas com plano em PPGs distintos não compartilham linhas nem agregados', async ({ page, browser, dados }) => {
  await entrar(page, 'admin');
  await concederPelaTela(page, dados.leitor.usuarioId, ['plano:read'], { id: dados.ppgId, cicloId: dados.cicloId });
  await concederPelaTela(page, dados.semAcesso.usuarioId, ['ppg:read']);
  await concederPelaTela(page, dados.semAcesso.usuarioId, ['plano:read'], { id: dados.ppgVizinhoId, cicloId: dados.cicloId });
  for (const [perfil, proprio, alheio, quantidade] of [
    ['leitor', dados.ppgId, dados.ppgVizinhoId, 1],
    ['sem-acesso', dados.ppgVizinhoId, dados.ppgId, 0],
  ] as const) {
    const contexto = await browser.newContext({ baseURL: ambiente.APP_BASE_URL });
    try {
      const conta = await contexto.newPage();
      await entrar(conta, perfil);
      const lista = await (await conta.request.get('/api/bff/ppgs')).json();
      expect(lista.find((p: { id: string }) => p.id === proprio)).toMatchObject({ podeLerPlano: true, bolsasAno: quantidade });
      expect(lista.find((p: { id: string }) => p.id === alheio)).toMatchObject({ podeLerPlano: false, bolsasAno: null, custoAno: null });
      const detalhe = await (await conta.request.get(`/api/bff/ppgs/${alheio}`)).json();
      expect(detalhe.plano).toBeNull();
      await conta.goto(`/ppgs/${alheio}`);
      await expect(conta.getByText('Sem acesso ao planejamento', { exact: true })).toBeVisible();
    } finally { await contexto.close(); }
  }
});

test.describe('ativação numa base sem contas locais', () => {
  test.use({ semContas: true });
  test('primeiro login, CLI de bootstrap e dois administradores sem autoampliação', async ({ page, browser, dados }) => {
    expect(dados.ppgId).toBeTruthy();
    await entrar(page, 'admin');
    expect(await permissoes(page)).toEqual([]);
    const me = await (await page.request.get('/api/bff/me')).json();
    const args = ['dist/auth/autorizacao-v1/bootstrap-cli.js', '--sub', me.id, '--motivo', 'Ativação da jornada descartável.'];
    const opcoes = { cwd: `${raiz}apps/api`, env: { ...process.env, ...ambiente }, encoding: 'utf8' as const, timeout: 30_000 };
    expect(execFileSync('node', args, opcoes)).toContain('Previa apenas');
    expect(await permissoes(page)).toEqual([]);
    expect(execFileSync('node', [...args, '--aplicar'], opcoes)).toContain('Aplicado');
    expect((await permissoes(page)).sort()).toEqual(['acesso:delegate', 'acesso:manage-identidade', 'acesso:read', 'acesso:write']);
    expect((await page.request.get('/api/bff/ppgs')).status()).toBe(403);
    const contexto = await browser.newContext({ baseURL: ambiente.APP_BASE_URL });
    try {
      const segundo = await contexto.newPage();
      await entrar(segundo, 'leitor');
      expect(await permissoes(segundo)).toEqual([]);
      const contas = await (await page.request.get('/api/bff/acesso/usuarios')).json();
      const primeiroId = contas.find((c: { sub: string }) => c.sub === me.id).id;
      const segundoId = contas.find((c: { sub: string }) => c.sub !== me.id).id;
      expect(contas).toHaveLength(2);
      const auto = await page.request.post(`/api/bff/acesso/usuarios/${primeiroId}/concessoes`, { data: {
        motivo: 'Tentativa de ampliar o próprio acesso.', concessoes: [{ permissao: 'ppg:read', escopo: { tipo: 'GLOBAL' } }],
      } });
      expect(auto.status()).toBe(403);
      await concederPelaTela(page, segundoId, ['acesso:read', 'acesso:write', 'acesso:delegate']);
      await concederPelaTela(segundo, primeiroId, ['ppg:read']);
      expect((await page.request.get('/api/bff/ppgs')).status()).toBe(200);
      expect((await segundo.request.get('/api/bff/ppgs')).status()).toBe(403);
    } finally { await contexto.close(); }
  });
});
