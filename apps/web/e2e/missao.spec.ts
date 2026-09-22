import { test, expect, entrar, abrir, salvar, proximo, arquivoPdf, ciclo } from './fixtures';

test('missão: cadastro, ajuste, aprovação, confirmação, produto, prestação e encerramento', async ({ page, dados }) => {
  test.setTimeout(240_000);
  await entrar(page, 'admin', `${ciclo}/comite-gestor?aba=missoes`);
  let painel = await abrir(page, /Nova missão|Cadastrar missão/);
  await painel.getByLabel('Título da missão', { exact: false }).fill('Missão Sintética E2E');
  await painel.getByLabel('Objetivo', { exact: false }).fill('Verificar a jornada completa com dados sintéticos.');
  await painel.getByLabel('Início da viagem', { exact: false }).fill('01/03/2027');
  await painel.getByLabel('Fim da viagem', { exact: false }).fill('05/03/2027');
  await painel.getByLabel('Situação inicial').selectOption('PLANEJADA');
  await painel.getByRole('checkbox', { name: 'REDE-TESTE' }).check();
  await proximo(painel);
  await painel.getByLabel('Título da atividade', { exact: false }).fill('Visita sintética');
  await painel.getByLabel('País', { exact: false }).selectOption(dados.paisId);
  await painel.getByLabel('Início da atividade', { exact: false }).fill('02/03/2027');
  await painel.getByLabel('Fim da atividade', { exact: false }).fill('04/03/2027');
  await proximo(painel);
  await painel.getByRole('combobox', { name: 'Pessoa', exact: true }).selectOption(dados.coordenadorTematicaId);
  await painel.getByLabel('Papel na missão').selectOption('RESPONSAVEL');
  await proximo(painel);
  await salvar(painel, 'Cadastrar missão');
  await page.getByRole('link', { name: /Missão Sintética E2E/ }).click();
  await expect(page).toHaveURL(/comite-gestor\/missoes\/[0-9a-f-]{36}/);
  const detalhe = page.url().split('?')[0];

  await page.getByRole('link', { name: 'Documentos', exact: true }).click();
  for (const categoria of ['PROJETO', 'JUSTIFICATIVA']) {
    painel = await abrir(page, 'Anexar documento');
    await painel.locator('input[type=file]').setInputFiles(await arquivoPdf());
    await painel.getByLabel('Categoria', { exact: false }).selectOption(categoria);
    await salvar(painel, 'Anexar');
  }
  await page.getByRole('link', { name: 'Análise', exact: true }).click();
  await page.getByRole('button', { name: 'Enviar para análise', exact: true }).click();
  painel = await abrir(page, 'Registrar decisão');
  await painel.getByLabel('Decisão', { exact: false }).selectOption('SOLICITAR_AJUSTES');
  await painel.getByLabel('Parecer', { exact: false }).fill('Detalhar os objetivos antes da aprovação.');
  await salvar(painel, 'Registrar decisão');
  await expect(page.getByText('Detalhar os objetivos antes da aprovação.', { exact: true })).toBeVisible();
  await page.goto(detalhe);
  painel = await abrir(page, /Editar missão/);
  // A edição abre com as datas gravadas (defeito do campo de data, V1-059).
  await expect(painel.getByLabel('Início da viagem', { exact: false })).toHaveValue('01/03/2027');
  await expect(painel.getByLabel('Fim da viagem', { exact: false })).toHaveValue('05/03/2027');
  await painel.getByLabel('Objetivo', { exact: false }).fill('Objetivo revisado após a solicitação do Comitê.');
  await proximo(painel); await proximo(painel); await proximo(painel);
  await salvar(painel, 'Cadastrar missão');
  await page.getByRole('link', { name: 'Análise', exact: true }).click();
  await page.getByRole('button', { name: /Reenviar para análise|Enviar para análise/ }).click();
  painel = await abrir(page, 'Registrar decisão');
  await painel.getByLabel('Data da reunião', { exact: false }).fill('01/01/2026');
  await painel.getByLabel('Parecer', { exact: false }).fill('Planejamento revisado e aprovado para execução.');
  await salvar(painel, 'Registrar decisão');
  await page.goto(detalhe);
  await page.getByRole('button', { name: 'Confirmar missão', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Confirmar missão', exact: true })).toHaveCount(0);

  painel = await abrir(page, 'Cadastrar produto');
  await painel.getByLabel('Título', { exact: false }).fill('Artigo sintético da missão');
  await salvar(painel, 'Cadastrar');
  await expect(page.getByText('Artigo sintético da missão', { exact: true })).toBeVisible();
  painel = await abrir(page, 'Registrar relato');
  await painel.getByLabel('Relato geral', { exact: false }).fill('A visita foi realizada com os participantes e objetivos previstos.');
  await painel.getByLabel('A missão alcançou o que se propunha?', { exact: false }).selectOption('SIM');
  await painel.getByLabel('Situação', { exact: true }).selectOption('REALIZADA');
  await painel.getByLabel('O que foi realizado', { exact: false }).fill('Reunião e elaboração conjunta de artigo sintético.');
  await salvar(painel, 'Salvar relato');

  await page.getByRole('link', { name: 'Prestação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prestação de contas' })).toBeVisible();
  const iniciar = page.getByRole('button', { name: 'Iniciar prestação', exact: true });
  if (await iniciar.count()) {
    await iniciar.click();
    await expect(iniciar).toHaveCount(0);
  }
  painel = await abrir(page, 'Nova despesa');
  await painel.getByLabel('Tipo de despesa', { exact: false }).selectOption('OUTRA');
  await painel.getByLabel('Descrição', { exact: false }).fill('Despesa sintética da visita');
  await painel.getByLabel('Valor total (R$)', { exact: false }).fill('100.00');
  await painel.getByLabel('Exercício', { exact: false }).fill('2027');
  await salvar(painel, 'Lançar');
  painel = await abrir(page, 'Anexar documento');
  await painel.locator('input[type=file]').setInputFiles(await arquivoPdf());
  await salvar(painel, 'Anexar');
  await page.getByRole('button', { name: 'Enviar para revisão', exact: true }).click();
  painel = await abrir(page, 'Devolver');
  await painel.getByLabel('Pendência', { exact: false }).fill('Conferir o comprovante antes de reenviar.');
  await salvar(painel, 'Devolver');
  await page.getByRole('button', { name: 'Reenviar para revisão', exact: true }).click();
  painel = await abrir(page, 'Validar');
  await painel.getByLabel('Parecer', { exact: false }).fill('Comprovante conferido e prestação aprovada.');
  await salvar(painel, 'Validar');
  await expect(page.getByRole('button', { name: 'Nova despesa', exact: true })).toHaveCount(0);
  await page.goto(detalhe);
  await page.getByRole('button', { name: 'Encerrar missão', exact: true }).click();
  painel = await abrir(page, 'Reabrir execução');
  await painel.getByLabel(/Justificativa|Motivo/).fill('Complementação sintética do relato após encerramento.');
  await salvar(painel, 'Reabrir execução');
  // Reabrir devolve a execução a "planejada": confirmar volta a ser o próximo
  // passo, e a aprovação não se move (V1-030).
  await expect(page.getByRole('button', { name: 'Confirmar missão', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reabrir execução', exact: true })).toHaveCount(0);
});
