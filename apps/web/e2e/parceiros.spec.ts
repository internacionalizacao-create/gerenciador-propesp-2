import { test, expect, entrar, abrir, salvar, ciclo } from './fixtures';

test('V1-042: pagina, restaura busca e atualiza cadastro/edicao sem duplicar', async ({ page, dados, browser }) => {
  await entrar(page, 'admin', `${ciclo}/parceiros`);
  for (let i = 0; i < 51; i++) {
    const resposta = await page.request.post('/api/bff/parceiros', { data: {
      nome: `Volume ${String(i).padStart(3, '0')}`, paisId: dados.paisId,
      redeIds: [dados.redeId], origemRelacionamento: 'OUTRO',
      confirmarPossivelDuplicidade: true,
    }});
    expect(resposta.status()).toBe(201);
  }
  await page.reload();
  const tabela = page.getByRole('table');
  await expect(tabela.locator('tbody tr')).toHaveCount(50);
  await page.getByRole('button', { name: 'Próxima', exact: true }).click();
  await expect(page).toHaveURL(/pagina=2/);
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await page.goBack();
  await expect(tabela.locator('tbody tr')).toHaveCount(50);
  await page.goForward();
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await expect(tabela.getByText('Volume 050', { exact: true })).toBeVisible();
  await tabela.getByRole('link', { name: 'Volume 050', exact: true }).click();
  const inativacao = await abrir(page, 'Inativar');
  await inativacao.getByLabel('Justificativa', { exact: false }).fill('Retirada sintética da última página');
  await salvar(inativacao, 'Inativar parceiro');
  await page.goBack();
  await page.getByRole('button', { name: 'Ir para a última página disponível' }).click();
  await expect(tabela.locator('tbody tr')).toHaveCount(50);
  await page.getByLabel('Busca', { exact: true }).fill('Volume 049');
  await expect(page).not.toHaveURL(/pagina=2/);
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await page.reload();
  await expect(page.getByLabel('Busca', { exact: true })).toHaveValue('Volume 049');
  await page.getByLabel('Busca', { exact: true }).fill('Universidade Aurora');
  await expect(page.getByText('Nenhum parceiro para este filtro')).toBeVisible();
  let painel = await abrir(page, 'Novo parceiro');
  await painel.getByLabel('Nome da instituição', { exact: false }).fill('Universidade Aurora');
  await painel.getByLabel('Como esta instituição foi identificada', { exact: false }).selectOption('OUTRO');
  await salvar(painel, 'Cadastrar parceiro');
  await expect(tabela.getByText('Universidade Aurora', { exact: true })).toBeVisible();
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await tabela.getByRole('link', { name: 'Universidade Aurora', exact: true }).click();
  painel = await abrir(page, 'Editar');
  await painel.getByLabel('Nome da instituição', { exact: false }).fill('Instituto Boreal');
  await salvar(painel, 'Salvar parceiro');
  await page.goBack();
  await expect(page.getByLabel('Busca', { exact: true })).toHaveValue('Universidade Aurora');
  await expect(page.getByText('Nenhum parceiro para este filtro')).toBeVisible();
  await page.getByLabel('Busca', { exact: true }).fill('Instituto Boreal');
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  await expect(tabela.getByText('Instituto Boreal', { exact: true })).toBeVisible();

  await page.goto(`${ciclo}/parceiros?busca=Instituto+Boreal&pagina=999`);
  await page.getByRole('button', { name: 'Ir para a última página disponível' }).click();
  await expect(tabela.locator('tbody tr')).toHaveCount(1);
  for (const query of ['pagina=0', 'pagina=1.5', 'tamanho=201']) {
    expect((await page.request.get(`/api/bff/parceiros?${query}`)).status()).toBe(400);
  }
  const contexto = await browser.newContext({ baseURL: 'http://localhost:33058' });
  try {
    const semAcesso = await contexto.newPage();
    await entrar(semAcesso, 'sem-acesso');
    expect((await semAcesso.request.get('/api/bff/parceiros?pagina=1')).status()).toBe(403);
  } finally { await contexto.close(); }
});
