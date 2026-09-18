import {
  describe,
  expect,
  it,
  beforeAll,
  beforeEach,
  afterAll,
} from '@jest/globals';
import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import type { Alcance } from '../src/auth/autorizacao-v1/alcance';
import * as s from '../src/database/schema';
import { CatalogoService } from '../src/dominio/catalogo.service';
import { ContextoService } from '../src/dominio/contexto.service';
import { OrcamentoService } from '../src/dominio/orcamento.service';
import { PainelService } from '../src/dominio/painel.service';
import { PlanoService } from '../src/dominio/plano.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { bolsaValida, criarBase, type BaseFixture } from './fixtures';

describe('Recorte por acao no planejamento', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let plano: PlanoService;
  let orcamento: OrcamentoService;
  let painel: PainelService;
  let contexto: ContextoService;
  let outroPpgId: string;
  let outraAreaId: string;
  let itemDentroId: string;
  let itemForaId: string;
  let orcamentoForaId: string;

  const operador: AuthUser = {
    id: 'sub-operador-recortado',
    name: 'Operador Recortado',
    roles: [],
    permissions: ['plano:edit', 'orcamento:edit'],
  };

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    orcamento = new OrcamentoService(ctx.db);
    plano = new PlanoService(ctx.db, new CatalogoService(ctx.db));
    painel = new PainelService(ctx.db, orcamento);
    contexto = new ContextoService(ctx.db);
  });

  afterAll(async () => ctx.encerrar());

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [outroPpg] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG fora do alcance', sigla: 'FORA' })
      .returning({ id: s.ppg.id });
    outroPpgId = outroPpg.id;

    const [outraArea] = await ctx.db
      .insert(s.areaTematica)
      .values({
        redeId: base.redeId,
        codigo: 'TESTE-T2',
        nome: 'Outra área temática',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.areaTematica.id });
    outraAreaId = outraArea.id;

    await ctx.db.insert(s.participacaoPpg).values([
      {
        ppgId: base.ppgId,
        areaTematicaId: base.areaTematicaId,
        coordenadorTematicaId: base.coordenadorTematicaId,
        situacao: 'CONTEMPLADO',
      },
      {
        ppgId: outroPpgId,
        areaTematicaId: outraAreaId,
        coordenadorTematicaId: base.coordenadorTematicaId,
        situacao: 'CONTEMPLADO',
      },
    ]);

    const [doEscopo, deFora] = await ctx.db
      .insert(s.itemPlanejado)
      .values([
        bolsaValida(base, 'BOL-ESCOPO'),
        {
          ...bolsaValida(base, 'BOL-FORA'),
          ppgId: outroPpgId,
          areaTematicaId: outraAreaId,
        },
      ])
      .returning({ id: s.itemPlanejado.id });
    itemDentroId = doEscopo.id;
    itemForaId = deFora.id;
    await ctx.db.insert(s.planejamentoAnual).values([
      { itemPlanejadoId: doEscopo.id, ano: 2027, quantidade: 1 },
      { itemPlanejadoId: deFora.id, ano: 2027, quantidade: 3 },
    ]);

    const orcamentos = await ctx.db
      .insert(s.orcamentoTematica)
      .values([
        {
          areaTematicaId: base.areaTematicaId,
          ano: 2027,
          status: 'DEFINIDO',
          statusComposicao: 'APROVADA',
          valorBolsas: '100000.00',
          fonte: 'Teto reservado da primeira temática',
        },
        {
          areaTematicaId: outraAreaId,
          ano: 2027,
          status: 'DEFINIDO',
          statusComposicao: 'APROVADA',
          valorBolsas: '400000.00',
          fonte: 'Teto reservado da segunda temática',
        },
      ])
      .returning({ id: s.orcamentoTematica.id });
    orcamentoForaId = orcamentos[1].id;
  });

  const alcanceDoPpg = (): Alcance => ({
    global: false,
    ciclos: [],
    ppgs: [{ ppgId: base.ppgId, cicloId: base.cicloId }],
    redes: [],
    tematicas: [],
    participacoes: [],
  });

  const alcanceDaTematica = (): Alcance => ({
    global: false,
    ciclos: [],
    ppgs: [],
    redes: [],
    tematicas: [base.areaTematicaId],
    participacoes: [],
  });

  it('lista somente as linhas do PPG concedido', async () => {
    const linhas = await plano.listar(base.cicloId, {}, alcanceDoPpg());
    expect(linhas.map((linha) => linha.codigo)).toEqual(['BOL-ESCOPO']);
  });

  it('mostra custo proprio sem revelar teto e saldo da tematica', async () => {
    const linhas = await orcamento.porTematica(
      base.cicloId,
      2027,
      alcanceDoPpg(),
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      areaTematicaId: base.areaTematicaId,
      custoBolsas: '82902.20',
      bolsas: 1,
      valorBolsas: null,
      saldoPotencial: null,
      fonte: null,
    });
  });

  it('libera teto e saldo quando o alcance cobre a tematica inteira', async () => {
    const [linha] = await orcamento.porTematica(
      base.cicloId,
      2027,
      alcanceDaTematica(),
    );
    expect(linha).toMatchObject({
      valorBolsas: '100000.00',
      custoBolsas: '82902.20',
      saldoPotencial: '17097.80',
      fonte: 'Teto reservado da primeira temática',
    });
  });

  it('recalcula o painel sem contar linhas fora do alcance', async () => {
    const ciclo = await contexto.resolver(
      'programa-teste',
      '2027-2030',
      alcanceDoPpg(),
    );
    const dados = await painel.montar(ciclo, 2027, alcanceDoPpg());

    expect(dados.porModalidade).toEqual([
      expect.objectContaining({ quantidadeAno: 1, custoAno: '82902.20' }),
    ]);
    expect(dados.fluxo).toEqual({ in: 0, out: 1 });
    expect(dados.indicadores.find((i) => i.chave === 'bolsas-ano')?.valor).toBe(
      1,
    );
    expect(
      dados.indicadores.find((i) => i.chave === 'aporte-anual')?.valor,
    ).toBeNull();
  });

  it('responde 404 para ciclo fora do alcance', async () => {
    const fora: Alcance = {
      ...alcanceDoPpg(),
      ppgs: [{ ppgId: outroPpgId, cicloId: crypto.randomUUID() }],
    };
    await expect(
      contexto.resolver('programa-teste', '2027-2030', fora),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('oferece ao formulario somente alvos e itens permitidos para a acao', async () => {
    const referencias = await plano.referencias(base.cicloId, alcanceDoPpg());

    expect(referencias.ppgs).toEqual([
      expect.objectContaining({ id: base.ppgId }),
    ]);
    expect(referencias.areas).toEqual([
      expect.objectContaining({
        id: base.areaTematicaId,
        ppgIds: [base.ppgId],
      }),
    ]);
    expect(referencias.itens).toEqual([itemDentroId]);
  });

  it('recusa criacao no PPG de fora sem deixar escrita parcial', async () => {
    const ciclo = await contexto.resolver('programa-teste', '2027-2030');
    const antes = await ctx.db
      .select({ id: s.itemPlanejado.id })
      .from(s.itemPlanejado);

    await expect(
      plano.criar(
        ciclo,
        {
          rubrica: 'BOLSAS',
          ppgId: outroPpgId,
          areaTematicaId: outraAreaId,
          destino: 'EXTERIOR',
          modalidadeId: base.modalidadeId,
          vigenciaMeses: 6,
          ano: 2027,
          quantidadeAnual: 1,
        },
        alcanceDoPpg(),
      ),
    ).rejects.toMatchObject({ status: 403 });

    const depois = await ctx.db
      .select({ id: s.itemPlanejado.id })
      .from(s.itemPlanejado);
    expect(depois).toHaveLength(antes.length);
  });

  it('recusa editar objeto oculto e transferir objeto visivel para fora', async () => {
    const ciclo = await contexto.resolver('programa-teste', '2027-2030');
    const dto = {
      rubrica: 'BOLSAS' as const,
      ppgId: outroPpgId,
      areaTematicaId: outraAreaId,
      destino: 'EXTERIOR' as const,
      modalidadeId: base.modalidadeId,
      vigenciaMeses: 6,
      ano: 2027,
      quantidadeAnual: 2,
      status: 'PROGRAMADO' as const,
      justificativaEdicao: 'Transferência solicitada para testar o recorte.',
    };

    await expect(
      plano.atualizar(ciclo, itemForaId, dto, operador, alcanceDoPpg()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      plano.atualizar(ciclo, itemDentroId, dto, operador, alcanceDoPpg()),
    ).rejects.toMatchObject({ status: 403 });

    const [preservado] = await ctx.db
      .select({ ppgId: s.itemPlanejado.ppgId })
      .from(s.itemPlanejado)
      .where(eq(s.itemPlanejado.id, itemDentroId));
    expect(preservado.ppgId).toBe(base.ppgId);
  });

  it('recusa cancelamento e alteracao orcamentaria fora do alcance', async () => {
    const ciclo = await contexto.resolver('programa-teste', '2027-2030');

    await expect(
      plano.cancelar(
        base.cicloId,
        itemForaId,
        'Cancelamento fora do alcance concedido.',
        alcanceDoPpg(),
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      orcamento.atualizar(
        ciclo,
        orcamentoForaId,
        {
          valorBolsas: '450000.00',
          valorManutencao: null,
          valorMissoes: null,
          status: 'DEFINIDO',
          statusComposicao: 'APROVADA',
          fonte: 'Fonte preservada pelo teste',
          justificativa: 'Tentativa fora do alcance concedido.',
        },
        operador,
        alcanceDaTematica(),
      ),
    ).rejects.toMatchObject({ status: 404 });

    const [item] = await ctx.db
      .select({ status: s.itemPlanejado.status })
      .from(s.itemPlanejado)
      .where(eq(s.itemPlanejado.id, itemForaId));
    const [orcamentoPreservado] = await ctx.db
      .select({ valor: s.orcamentoTematica.valorBolsas })
      .from(s.orcamentoTematica)
      .where(eq(s.orcamentoTematica.id, orcamentoForaId));
    expect(item.status).toBe('PROGRAMADO');
    expect(orcamentoPreservado.valor).toBe('400000.00');
  });
});
