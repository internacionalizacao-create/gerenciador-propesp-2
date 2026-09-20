import { test, expect, entrar, abrir, salvar, proximo } from './fixtures';

test('leitura, recusa de escrita adulterada, concessão e revogação pela tela', async ({ page, browser, dados }) => {
  await entrar(page, 'leitor');
  await expect(page.getByRole('table').getByText('PPG de Teste', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Novo PPG' })).toHaveCount(0);
  const negada = await page.request.post('/api/bff/ppgs', { data: { nome: 'Tentativa indevida' } });
  expect(negada.status()).toBe(403);

  const contexto = await browser.newContext({ baseURL: 'http://localhost:33058' });
  const admin = await contexto.newPage();
  try {
    await entrar(admin, 'admin', `/configuracoes/acessos/${dados.leitor.usuarioId}`);
    const painel = await abrir(admin, 'Conceder acesso');
    await painel.getByRole('checkbox', { name: /ppg:create/ }).check();
    await painel.getByLabel('Motivo', { exact: false }).fill('Concessão temporária para jornada sintética.');
    await salvar(painel, 'Conceder');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Novo PPG' })).toBeVisible();
    const linha = admin.getByRole('row').filter({ hasText: 'ppg:create' });
    await linha.getByRole('button', { name: 'Revogar', exact: true }).click();
    const revogar = admin.getByRole('dialog');
    await revogar.getByLabel('Motivo', { exact: false }).fill('Fim da concessão temporária.');
    await salvar(revogar, 'Revogar acesso');
    expect((await page.request.post('/api/bff/ppgs', { data: { nome: 'Tentativa revogada' } })).status()).toBe(403);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Novo PPG' })).toHaveCount(0);
  } finally { await contexto.close(); }
});

test('sidesheet prende e devolve foco; erro preserva formulário; cadastro persiste', async ({ page, dados }) => {
  expect(dados.ppgId).toBeTruthy();
  await entrar(page);
  const botao = page.getByRole('button', { name: 'Novo PPG' });
  await botao.focus();
  await page.keyboard.press('Enter');
  let painel = page.getByRole('dialog');
  await expect(painel).toBeVisible();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press('Tab');
    expect(await painel.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body)).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(painel).not.toBeVisible();
  await expect(botao).toBeFocused();
  painel = await abrir(page, 'Novo PPG');
  await painel.getByLabel('Sigla', { exact: false }).fill('E2E');
  await proximo(painel);
  await expect(painel.getByLabel('Nome do PPG', { exact: false })).toBeVisible();
  await expect(painel.getByLabel('Sigla', { exact: false })).toHaveValue('E2E');
  await painel.getByLabel('Nome do PPG', { exact: false }).fill('Programa Sintético E2E');
  await proximo(painel);
  await proximo(painel);
  await salvar(painel, 'Cadastrar PPG');
  await page.reload();
  await expect(page.getByRole('table').getByText('Programa Sintético E2E', { exact: true })).toBeVisible();
});

test('conta sem concessão recebe orientação e sessão inválida volta ao login', async ({ page, dados }) => {
  expect(dados.semAcesso.usuarioId).toBeTruthy();
  await entrar(page, 'sem-acesso');
  await expect(page.getByText('PPG de Teste', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Sua conta ainda não recebeu acesso', { exact: true })).toBeVisible();
  expect((await page.request.get('/api/bff/ppgs')).status()).toBe(403);
  const cookies = await page.context().cookies();
  const sessao = cookies.filter(c => c.name.startsWith('gr_session.'));
  expect(sessao.length).toBeGreaterThan(0);
  expect(sessao.every(c => c.httpOnly)).toBe(true);
  // Expiracao do cookie pelo navegador, sem fabricar token ou contornar guard.
  await page.context().addCookies(sessao.map(c => ({ ...c, expires: 1 })));
  await page.goto('/ppgs');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: /erro|something went wrong/i })).toHaveCount(0);
});
