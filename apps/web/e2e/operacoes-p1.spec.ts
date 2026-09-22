import { test, expect, entrar, abrir, salvar, arquivoPdf, ciclo } from './fixtures';

/**
 * Operações P1 incorporadas à V1 (V1-059): eventos da CAPES (V1-036/037),
 * participação PPG–temática (V1-034) e convênio (V1-032). Tudo pela sessão
 * real, com guard e API de verdade; o que não passa pela tela é pedido
 * adulterado, e a API precisa recusá-lo.
 */

test('eventos da CAPES: registro, erro sem perda, comprovante, correção e movimentação', async ({ page, browser, dados }) => {
  test.setTimeout(180_000);
  await entrar(page, 'admin', '/mobilidade/bolsistas');
  const criada = await page.request.post('/api/bff/bolsistas', { data: {
    itemPlanejadoId: dados.linhaId, nome: 'Bolsista Evento E2E', cpf: '39053344705',
    nivelBeneficiario: 'DOUTORADO', paisOrigemId: dados.paisId,
    modoInstituicaoOrigem: 'livre', instituicaoOrigemNome: 'Instituição Sintética Origem',
    paisDestinoNome: 'Brasil', instituicaoDestinoNome: 'Instituição Sintética Destino',
    dataInicio: '2027-03-01', dataFim: '2027-08-31', status: 'EM_ANDAMENTO',
  }});
  expect(criada.status()).toBe(201);
  const bolsa = (await criada.json()) as { id: string };
  await page.goto(`/mobilidade/bolsistas/${bolsa.id}`);

  // Registro com erro da API: o painel fica aberto e nada do que foi digitado some.
  let painel = await abrir(page, 'Registrar evento');
  await painel.getByRole('combobox', { name: 'Evento', exact: true }).selectOption('DESISTENCIA');
  await expect(painel.getByText(/passa de Em andamento para Cancelada/)).toBeVisible();
  await expect(painel.getByText(/O custo do plano e o teto da temática não mudam/)).toBeVisible();
  await painel.getByLabel('Data do ato na CAPES', { exact: false }).fill('01/01/2999');
  await painel.getByLabel('Referência externa', { exact: false }).fill('Ofício sintético 12');
  await painel.getByLabel('Justificativa', { exact: false }).fill('Desistência sintética informada pela CAPES.');
  await painel.getByRole('button', { name: 'Registrar evento', exact: true }).click();
  await expect(painel.getByRole('alert')).toContainText('não pode estar no futuro');
  await expect(painel.getByLabel('Justificativa', { exact: false })).toHaveValue('Desistência sintética informada pela CAPES.');
  await expect(painel.getByLabel('Referência externa', { exact: false })).toHaveValue('Ofício sintético 12');
  await painel.getByLabel('Data do ato na CAPES', { exact: false }).fill('12/05/2026');
  await salvar(painel, 'Registrar evento');

  const linha = page.getByRole('row').filter({ hasText: 'Desistência' });
  await expect(linha).toContainText('Em andamento → Cancelada');
  await expect(linha).toContainText('Sem comprovante');
  await expect(linha).toContainText('12/05/2026');

  painel = await abrir(page, 'Anexar comprovante');
  await painel.locator('input[type=file]').setInputFiles(await arquivoPdf());
  await salvar(painel, 'Anexar');
  await expect(linha).toContainText('1 comprovante(s)');

  await linha.getByRole('button', { name: 'Corrigir', exact: true }).click();
  painel = page.getByRole('dialog');
  await painel.getByLabel('Data do ato na CAPES', { exact: false }).fill('10/05/2026');
  await painel.getByLabel('Motivo da correção', { exact: false }).fill('Data conferida no ofício.');
  await salvar(painel, 'Salvar correção');
  await expect(linha).toContainText('Corrigido');
  await expect(linha).toContainText('10/05/2026');

  // A cancelada sai do panorama, e a edição não a reabre por fora do evento.
  const panorama = await (await page.request.get('/api/bff/mobilidade/panorama')).json();
  expect(panorama.totais.mobilidades).toBe(0);
  painel = await abrir(page, 'Atualizar bolsa');
  await expect(painel.getByLabel('Data inicial', { exact: false })).toHaveValue('01/03/2027');
  const opcoes = await painel.getByRole('combobox', { name: 'Situação registrada' }).locator('option').allTextContents();
  expect(opcoes).not.toContain('Interrompida');
  await painel.getByRole('button', { name: 'Cancelar', exact: true }).click();
  const adulterada = await page.request.patch(`/api/bff/bolsistas/${bolsa.id}`, { data: {
    dataInicio: '2027-03-01', dataFim: '2027-08-31', status: 'EM_ANDAMENTO',
  }});
  expect(adulterada.status()).toBe(422);

  // P12: a movimentação na mesma temática, e as recusas do que a tela não oferece.
  await page.goto(`${ciclo}/remanejamentos`);
  await expect(page.getByRole('row').filter({ hasText: 'Bolsista Evento E2E' })).toContainText('Desistência');
  painel = await abrir(page, 'Registrar movimentação');
  await painel.getByRole('combobox', { name: 'Área temática' }).selectOption(dados.areaTematicaId);
  await painel.getByRole('combobox', { name: 'PPG que cedeu' }).selectOption(dados.ppgId);
  await painel.getByRole('combobox', { name: 'PPG que recebeu' }).selectOption(dados.ppgVizinhoId);
  await painel.getByLabel('Data do ato na CAPES', { exact: false }).fill('01/06/2026');
  await painel.getByLabel('Valor (R$)', { exact: false }).fill('82902,20');
  await painel.getByLabel('Justificativa', { exact: false }).fill('Vaga realocada pela CAPES na mesma temática.');
  await salvar(painel, 'Registrar movimentação');
  await expect(page.getByRole('row').filter({ hasText: 'REM-001' })).toContainText('PPGT → PPGVIZ');

  const corpo = {
    chave: crypto.randomUUID(), dataAto: '2026-06-01', ano: 2027, areaTematicaId: dados.areaTematicaId,
    ppgOrigemId: dados.ppgId, ppgDestinoId: dados.ppgAvulsoId, rubrica: 'MISSOES',
    valor: '100.00', justificativa: 'Destino fora da temática.',
  };
  const caminho = `/api/bff${ciclo}/movimentacoes`;
  expect((await page.request.post(caminho, { data: corpo })).status()).toBe(422);
  expect((await page.request.post(caminho, { data: { ...corpo, ppgDestinoId: dados.ppgVizinhoId, status: 'PROPOSTO' } })).status()).toBe(400);

  // Perfil sem `evento:read`: explicação na tela e 403 na API.
  const contexto = await browser.newContext({ baseURL: 'http://localhost:33058' });
  try {
    const leitor = await contexto.newPage();
    await entrar(leitor, 'leitor', `${ciclo}/remanejamentos`);
    await expect(leitor.getByRole('main').getByText('REM-001')).toHaveCount(0);
    await expect(leitor.getByRole('main').getByText('evento:read').first()).toBeVisible();
    expect((await leitor.request.get(caminho)).status()).toBe(403);
    expect((await leitor.request.post(`/api/bff/bolsistas/${bolsa.id}/eventos`, { data: {
      chave: crypto.randomUUID(), tipo: 'INTERRUPCAO', dataAto: '2026-05-01', justificativa: 'Indevido.',
    }})).status()).toBe(403);
  } finally { await contexto.close(); }
});

test('participação PPG–temática e convênio do parceiro pela tela', async ({ page, dados }) => {
  await entrar(page, 'admin', `${ciclo}/tematicas/TESTE-T1`);
  let painel = await abrir(page, 'Associar PPG');
  await painel.getByRole('combobox', { name: 'PPG', exact: true }).selectOption(dados.ppgAvulsoId);
  await painel.getByRole('combobox', { name: 'Coordenador de Temática' }).selectOption(dados.coordenadorTematicaId);
  await salvar(painel, 'Associar');
  await expect(page.getByRole('main').getByText('PPGAVU').first()).toBeVisible();

  const parceiro = await page.request.post('/api/bff/parceiros', { data: {
    nome: 'Universidade Parceira E2E', paisId: dados.paisId, redeIds: [dados.redeId],
    origemRelacionamento: 'OUTRO', confirmarPossivelDuplicidade: true,
  }});
  expect(parceiro.status()).toBe(201);
  const { id: parceiroId } = (await parceiro.json()) as { id: string };
  await page.goto(`${ciclo}/parceiros/${parceiroId}`);
  painel = await abrir(page, 'Cadastrar acordo');
  await painel.getByLabel('Título do acordo', { exact: false }).fill('Acordo Sintético E2E');
  await salvar(painel, 'Cadastrar');
  const acordo = page.getByRole('row').filter({ hasText: 'Acordo Sintético E2E' });
  await expect(acordo).toBeVisible();
  await acordo.getByRole('button', { name: 'Inativar', exact: true }).click();
  painel = page.getByRole('dialog');
  await painel.getByLabel('Justificativa', { exact: false }).fill('Encerramento sintético do acordo.');
  await salvar(painel, 'Inativar acordo');
  await expect(page.getByRole('main').getByText('Acordo Sintético E2E').first()).toBeVisible();
});
