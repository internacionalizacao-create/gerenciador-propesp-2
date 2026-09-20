import { and, eq, isNotNull, sql } from 'drizzle-orm';

import * as s from '../src/database/schema';
import { executarSeed } from '../src/database/seed/seed';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

/**
 * Teste de aceite da migração (system-structl.md §8.3).
 *
 * Com a seed carregada, o sistema tem que reproduzir os indicadores das
 * planilhas. Todo valor aqui é **calculado por consulta**, nunca lido de uma
 * coluna que a seed tenha gravado — senão o teste só provaria que a seed sabe
 * copiar, e não que o modelo sabe calcular.
 *
 * Se algum destes falhar, ou a fórmula está errada ou o dado migrou sujo. É a
 * diferença entre "migramos" e "migramos e conferimos".
 */
describe('Seed — aceite da migração CAPES Global 2027–2030', () => {
  let ctx: ContextoTeste;
  let cicloId: string;

  /** Custo anual de bolsas por temática: quantidade × valor do catálogo (RN-04). */
  const custoAnualPorTematica = sql<string>`
    sum(${s.itemPlanejado.quantidadeAnual} * ${s.itemCatalogoBolsa.valorBrl})
  `;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    await ctx.limpar();
    await executarSeed(ctx.db);

    const [ciclo] = await ctx.db.select().from(s.ciclo);
    cicloId = ciclo.id;
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  // ------------------------------------------------------------------ //
  describe('estrutura', () => {
    it('carrega 24 PPGs, distribuídos 8 / 6 / 10 entre as redes', async () => {
      const porRede = await ctx.db
        .select({
          rede: s.redeCoordenadora.nome,
          total: sql<number>`count(distinct ${s.participacaoPpg.ppgId})::int`,
        })
        .from(s.participacaoPpg)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
        )
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .groupBy(s.redeCoordenadora.nome);

      const mapa = Object.fromEntries(porRede.map((r) => [r.rede, r.total]));
      expect(mapa).toEqual({ UNESP: 8, UFMG: 6, UNICAMP: 10 });

      const [{ total }] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.ppg);
      expect(total).toBe(24);
    });

    it('carrega 60 itens de catálogo e 12 áreas temáticas', async () => {
      const [cat] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.itemCatalogoBolsa);
      const [areas] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.areaTematica);

      expect(cat.total).toBe(60);
      expect(areas.total).toBe(12);
    });

    it('preserva os nomes oficiais das temáticas da UNICAMP', async () => {
      const areas = await ctx.db
        .select({ codigo: s.areaTematica.codigo, nome: s.areaTematica.nome })
        .from(s.areaTematica)
        .where(sql`${s.areaTematica.codigo} in ('UNICAMP-T2', 'UNICAMP-T3')`)
        .orderBy(s.areaTematica.codigo);

      expect(areas).toEqual([
        { codigo: 'UNICAMP-T2', nome: 'Educação, Saberes e Culturas' },
        {
          codigo: 'UNICAMP-T3',
          nome: 'Biodiversidade e Transformação Territorial Sustentável',
        },
      ]);
    });

    it('vincula um coordenador a cada PPG dentro da tematica', async () => {
      const coordenacoes = await ctx.db
        .select({
          area: s.areaTematica.codigo,
          ppg: s.ppg.sigla,
          coordenador: s.pessoa.nome,
        })
        .from(s.participacaoPpg)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
        )
        .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
        .innerJoin(
          s.pessoa,
          eq(s.pessoa.id, s.participacaoPpg.coordenadorTematicaId),
        );

      expect(coordenacoes).toHaveLength(24);
      const unicampT1 = coordenacoes.filter((c) => c.area === 'UNICAMP-T1');
      expect(unicampT1).toHaveLength(5);
      expect(new Set(unicampT1.map((c) => c.coordenador)).size).toBe(2);
    });

    it('carrega a composicao formal das equipes para as tres redes', async () => {
      const membros = await ctx.db
        .select({
          nome: s.pessoa.nome,
          tipoPessoa: s.pessoa.tipo,
          instituicao: s.instituicao.sigla,
          tipoEquipe: s.membroEquipeGestao.tipoEquipe,
          funcao: s.membroEquipeGestao.funcao,
          dataInicio: s.membroEquipeGestao.dataInicio,
        })
        .from(s.membroEquipeGestao)
        .innerJoin(s.pessoa, eq(s.pessoa.id, s.membroEquipeGestao.pessoaId))
        .innerJoin(s.instituicao, eq(s.instituicao.id, s.pessoa.instituicaoId));

      expect(membros).toHaveLength(10);
      expect(
        membros.filter((m) => m.tipoEquipe === 'COMITE_GESTOR'),
      ).toHaveLength(2);
      expect(
        membros.filter((m) => m.tipoEquipe === 'ADMINISTRACAO'),
      ).toHaveLength(8);
      expect(new Set(membros.map((m) => m.tipoPessoa))).toEqual(
        new Set(['SERVIDOR']),
      );
      expect(new Set(membros.map((m) => m.instituicao))).toEqual(
        new Set(['UEA']),
      );
      expect(new Set(membros.map((m) => m.dataInicio))).toEqual(
        new Set(['2027-01-01']),
      );

      const associacoes = await ctx.db
        .select({
          nome: s.pessoa.nome,
          rede: s.redeCoordenadora.nome,
        })
        .from(s.membroEquipeGestaoRede)
        .innerJoin(
          s.membroEquipeGestao,
          eq(s.membroEquipeGestao.id, s.membroEquipeGestaoRede.membroEquipeId),
        )
        .innerJoin(s.pessoa, eq(s.pessoa.id, s.membroEquipeGestao.pessoaId))
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.membroEquipeGestaoRede.redeId),
        );

      expect(associacoes).toHaveLength(19);
      const redesPorPessoa = Object.fromEntries(
        membros.map(({ nome }) => [
          nome,
          associacoes
            .filter((item) => item.nome === nome)
            .map((item) => item.rede)
            .sort(),
        ]),
      );
      expect(redesPorPessoa).toEqual({
        'Roberto Sanches Mubarac Sobrinho': ['UFMG', 'UNESP', 'UNICAMP'],
        'Patricia Melchionna Albuquerque': ['UFMG', 'UNESP', 'UNICAMP'],
        'André Luiz Nunes Zogahib': ['UFMG', 'UNESP', 'UNICAMP'],
        'Andréa Monteiro Tarragô': ['UFMG', 'UNESP', 'UNICAMP'],
        'Jessica Mie Ferreira Koyama Takahashi': ['UFMG'],
        'Sara do Nascimento Maia': ['UFMG'],
        'Carlos Renato R. de Jesus': ['UNESP'],
        'Elisa Gomes de Lima': ['UNESP', 'UNICAMP'],
        'João Victor Verçosa': ['UNESP'],
        'Katia de Abreu Chulata': ['UNICAMP'],
      });
    });

    it('mantém somente o CAPES Global ativo para operação', async () => {
      const programas = await ctx.db
        .select({ slug: s.programa.slug, ativo: s.programa.ativo })
        .from(s.programa);
      const slugs = programas.map((p) => p.slug).sort();

      expect(slugs).toEqual([
        'capes-global',
        'erasmus',
        'gcub',
        'move-la-america',
        'pdse',
        'proafri',
      ]);
      expect(programas.filter((p) => p.ativo).map((p) => p.slug)).toEqual([
        'capes-global',
      ]);
    });
  });

  // ------------------------------------------------------------------ //
  describe('orçamento', () => {
    it('aporte anual conhecido = R$ 2.315.444,58', async () => {
      const [{ total }] = await ctx.db
        .select({
          total: sql<string>`sum(
            coalesce(${s.orcamentoTematica.valorBolsas}, 0)
          + coalesce(${s.orcamentoTematica.valorManutencao}, 0)
          + coalesce(${s.orcamentoTematica.valorMissoes}, 0))`,
        })
        .from(s.orcamentoTematica)
        .where(
          and(
            eq(s.orcamentoTematica.ano, 2027),
            eq(s.orcamentoTematica.status, 'DEFINIDO'),
          ),
        );

      expect(total).toBe('2315444.58');
    });

    it('aporte do ciclo = R$ 9.261.778,32 (RN-09)', async () => {
      const [{ total }] = await ctx.db
        .select({
          total: sql<string>`sum(
            coalesce(${s.orcamentoTematica.valorBolsas}, 0)
          + coalesce(${s.orcamentoTematica.valorManutencao}, 0)
          + coalesce(${s.orcamentoTematica.valorMissoes}, 0))`,
        })
        .from(s.orcamentoTematica)
        .where(eq(s.orcamentoTematica.status, 'DEFINIDO'));

      expect(total).toBe('9261778.32');
    });

    it('4 composições de 2027 a definir, todas da UNICAMP', async () => {
      const pendentes = await ctx.db
        .selectDistinct({ codigo: s.areaTematica.codigo })
        .from(s.orcamentoTematica)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.orcamentoTematica.areaTematicaId),
        )
        .where(
          and(
            eq(s.orcamentoTematica.ano, 2027),
            eq(s.orcamentoTematica.statusComposicao, 'A_DEFINIR'),
          ),
        );

      expect(pendentes).toHaveLength(4);
      expect(pendentes.every((t) => t.codigo.startsWith('UNICAMP-'))).toBe(
        true,
      );
    });

    it('UNICAMP guarda orçamento anual e utilizado sem criar a composição', async () => {
      const orcamentos = await ctx.db
        .select({
          codigo: s.areaTematica.codigo,
          valorBolsas: s.orcamentoTematica.valorBolsas,
          custoBolsasInformado: s.orcamentoTematica.custoBolsasInformado,
          valorManutencao: s.orcamentoTematica.valorManutencao,
          status: s.orcamentoTematica.status,
          statusComposicao: s.orcamentoTematica.statusComposicao,
        })
        .from(s.orcamentoTematica)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.orcamentoTematica.areaTematicaId),
        )
        .where(
          and(
            eq(s.orcamentoTematica.ano, 2027),
            sql`${s.areaTematica.codigo} like 'UNICAMP-%'`,
          ),
        )
        .orderBy(s.areaTematica.codigo);

      expect(orcamentos).toEqual([
        {
          codigo: 'UNICAMP-T1',
          valorBolsas: '538291.22',
          custoBolsasInformado: '530737.40',
          valorManutencao: null,
          status: 'DEFINIDO',
          statusComposicao: 'A_DEFINIR',
        },
        {
          codigo: 'UNICAMP-T2',
          valorBolsas: '270894.75',
          custoBolsasInformado: '331122.00',
          valorManutencao: null,
          status: 'DEFINIDO',
          statusComposicao: 'A_DEFINIR',
        },
        {
          codigo: 'UNICAMP-T3',
          valorBolsas: '96835.65',
          custoBolsasInformado: '97308.80',
          valorManutencao: null,
          status: 'DEFINIDO',
          statusComposicao: 'A_DEFINIR',
        },
        {
          codigo: 'UNICAMP-T4',
          valorBolsas: '159067.37',
          custoBolsasInformado: '173690.60',
          valorManutencao: null,
          status: 'DEFINIDO',
          statusComposicao: 'A_DEFINIR',
        },
      ]);
    });
  });

  // ------------------------------------------------------------------ //
  describe('plano de bolsas', () => {
    it('custo aprovado de 2027 = R$ 1.033.513,40', async () => {
      const [{ total }] = await ctx.db
        .select({ total: custoAnualPorTematica })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(
          and(
            eq(s.itemPlanejado.cicloId, cicloId),
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
          ),
        );

      expect(total).toBe('1033513.40');
    });

    it('custo aprovado por rede: UNESP R$ 636.531,80 e UFMG R$ 396.981,60', async () => {
      const porRede = await ctx.db
        .select({ rede: s.redeCoordenadora.nome, custo: custoAnualPorTematica })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.itemPlanejado.areaTematicaId),
        )
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'))
        .groupBy(s.redeCoordenadora.nome);

      const mapa = Object.fromEntries(porRede.map((r) => [r.rede, r.custo]));
      expect(mapa).toEqual({ UNESP: '636531.80', UFMG: '396981.60' });
    });

    it('22 bolsas aprovadas em 2027: 2 IN e 20 OUT (RN-11)', async () => {
      const porFluxo = await ctx.db
        .select({
          fluxo: s.itemPlanejado.fluxo,
          // Soma de QUANTIDADES, não contagem de linhas.
          bolsas: sql<number>`sum(${s.itemPlanejado.quantidadeAnual})::int`,
        })
        .from(s.itemPlanejado)
        .where(
          and(
            eq(s.itemPlanejado.cicloId, cicloId),
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
          ),
        )
        .groupBy(s.itemPlanejado.fluxo);

      const mapa = new Map(porFluxo.map((f) => [f.fluxo, f.bolsas]));
      expect(mapa.get('IN')).toBe(2);
      expect(mapa.get('OUT')).toBe(20);
      expect((mapa.get('IN') ?? 0) + (mapa.get('OUT') ?? 0)).toBe(22);
    });

    it('18 linhas aprovadas em 2027', async () => {
      // O PNG de insight dizia 23 "bolsas"; eram linhas. Guardar os dois números
      // com nomes diferentes é o que impede o equívoco de voltar.
      const [{ linhas }] = await ctx.db
        .select({ linhas: sql<number>`count(*)::int` })
        .from(s.itemPlanejado)
        .where(
          and(
            eq(s.itemPlanejado.cicloId, cicloId),
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
          ),
        );

      expect(linhas).toBe(18);
    });

    it('não replica as 22 bolsas de 2027 nos anos futuros', async () => {
      const [{ total }] = await ctx.db
        .select({
          total: sql<number>`sum(${s.planejamentoAnual.quantidade})::int`,
        })
        .from(s.planejamentoAnual)
        .innerJoin(
          s.itemPlanejado,
          eq(s.itemPlanejado.id, s.planejamentoAnual.itemPlanejadoId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'));

      expect(total).toBe(22);

      const [{ futuras }] = await ctx.db
        .select({
          futuras: sql<number>`sum(${s.planejamentoAnual.quantidade})::int`,
        })
        .from(s.planejamentoAnual)
        .where(sql`${s.planejamentoAnual.ano} > 2027`);
      expect(futuras).toBe(0);
    });

    it('4 Capacitações da UFMG pendentes, com impacto tabelado', async () => {
      const pendentes = await ctx.db
        .select({
          codigo: s.itemPlanejado.codigo,
          quantidade: s.itemPlanejado.quantidadeAnual,
          catalogo: s.itemPlanejado.itemCatalogoId,
        })
        .from(s.itemPlanejado)
        .where(eq(s.itemPlanejado.status, 'PENDENTE'));

      expect(pendentes).toHaveLength(4);
      expect(pendentes.every((p) => p.quantidade === 1)).toBe(true);
      expect(pendentes.every((p) => p.catalogo !== null)).toBe(true);
    });

    it('toda bolsa programada tem preço vindo do catálogo (RN-01)', async () => {
      // A garantia central do sistema: nenhum custo de bolsa é valor digitado.
      const [{ semCatalogo }] = await ctx.db
        .select({ semCatalogo: sql<number>`count(*)::int` })
        .from(s.itemPlanejado)
        .where(
          and(
            eq(s.itemPlanejado.rubrica, 'BOLSAS'),
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
            sql`${s.itemPlanejado.itemCatalogoId} is null`,
          ),
        );

      expect(semCatalogo).toBe(0);
    });

    it('o valor do catálogo coincide com o que a planilha informava', async () => {
      // Cruza o preço resolvido pelo sistema com o valor unitário que a planilha
      // trazia em cada linha. Divergência aqui seria erro de PROCV na origem.
      const linhas = await ctx.db
        .select({
          codigo: s.itemPlanejado.codigo,
          doCatalogo: s.itemCatalogoBolsa.valorBrl,
        })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'));

      expect(linhas).toHaveLength(18);
      expect(linhas.every((l) => Number(l.doCatalogo) > 0)).toBe(true);
    });
  });

  // ------------------------------------------------------------------ //
  describe('saldo e divergência', () => {
    it('saldo potencial aprovado de 2027 = R$ 147.091,05 (RN-06)', async () => {
      const custos = ctx.db
        .select({
          areaId: s.itemPlanejado.areaTematicaId,
          custo: custoAnualPorTematica.as('custo'),
        })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'))
        .groupBy(s.itemPlanejado.areaTematicaId)
        .as('custos');

      const [{ saldo }] = await ctx.db
        .select({
          saldo: sql<string>`sum(${s.orcamentoTematica.valorBolsas} - ${custos.custo})`,
        })
        .from(s.orcamentoTematica)
        .innerJoin(
          custos,
          eq(custos.areaId, s.orcamentoTematica.areaTematicaId),
        )
        .where(
          and(
            eq(s.orcamentoTematica.ano, 2027),
            eq(s.orcamentoTematica.statusComposicao, 'APROVADA'),
          ),
        );

      expect(saldo).toBe('147091.05');
    });

    it('não apresenta os anos sem composição como saldo livre', async () => {
      const custos = ctx.db
        .select({
          areaId: s.itemPlanejado.areaTematicaId,
          custo: custoAnualPorTematica.as('custo'),
        })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'))
        .groupBy(s.itemPlanejado.areaTematicaId)
        .as('custos');

      const [{ saldo }] = await ctx.db
        .select({
          saldo: sql<string>`sum(${s.orcamentoTematica.valorBolsas} - ${custos.custo})`,
        })
        .from(s.orcamentoTematica)
        .innerJoin(
          custos,
          eq(custos.areaId, s.orcamentoTematica.areaTematicaId),
        )
        .where(eq(s.orcamentoTematica.statusComposicao, 'APROVADA'));

      expect(saldo).toBe('147091.05');
    });

    it('não mantém divergência depois da conciliação da UNESP-T1 (RN-08)', async () => {
      const custos = ctx.db
        .select({
          areaId: s.itemPlanejado.areaTematicaId,
          custo: custoAnualPorTematica.as('custo'),
        })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(eq(s.itemPlanejado.status, 'PROGRAMADO'))
        .groupBy(s.itemPlanejado.areaTematicaId)
        .as('custos');

      const divergentes = await ctx.db
        .select({
          codigo: s.areaTematica.codigo,
          divergencia: sql<string>`
            (${s.orcamentoTematica.valorBolsas} - ${custos.custo})
            - ${s.orcamentoTematica.saldoInformado}`,
        })
        .from(s.orcamentoTematica)
        .innerJoin(
          custos,
          eq(custos.areaId, s.orcamentoTematica.areaTematicaId),
        )
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.orcamentoTematica.areaTematicaId),
        )
        .where(
          and(
            eq(s.orcamentoTematica.ano, 2027),
            isNotNull(s.orcamentoTematica.saldoInformado),
            sql`(${s.orcamentoTematica.valorBolsas} - ${custos.custo})
                 <> ${s.orcamentoTematica.saldoInformado}`,
          ),
        );

      expect(divergentes).toEqual([]);
    });
  });

  // ------------------------------------------------------------------ //
  describe('governança', () => {
    it('preserva 14 pendências históricas, com 5 ainda abertas', async () => {
      const [{ total }] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.pendencia);
      const [{ abertas }] = await ctx.db
        .select({ abertas: sql<number>`count(*)::int` })
        .from(s.pendencia)
        .where(sql`${s.pendencia.status} <> 'RESOLVIDA'`);

      expect(total).toBe(14);
      expect(abertas).toBe(5);
    });

    it('registra as decisões de fluxo e mantém a composição da UNICAMP aberta', async () => {
      const respostas = await ctx.db
        .select({
          codigo: s.pendencia.codigo,
          status: s.pendencia.status,
          resolucao: s.pendencia.resolucao,
          descricao: s.pendencia.descricao,
        })
        .from(s.pendencia)
        .where(sql`${s.pendencia.codigo} in ('PEN-011', 'PEN-012', 'PEN-013')`)
        .orderBy(s.pendencia.codigo);

      expect(respostas).toEqual([
        {
          codigo: 'PEN-011',
          status: 'RESOLVIDA',
          resolucao:
            'Todos os recursos são pagos diretamente pela CAPES; não há entrada em caixa nem execução financeira na UEA.',
          descricao:
            'Confirmar se os recursos do CAPES Global entram no caixa da UEA ou são pagos diretamente pela CAPES.',
        },
        {
          codigo: 'PEN-012',
          status: 'RESOLVIDA',
          resolucao:
            'IN significa entrada no Brasil e OUT significa destino no exterior.',
          descricao:
            'Validar institucionalmente IN como entrada no Brasil e OUT como destino no exterior.',
        },
        {
          codigo: 'PEN-013',
          status: 'PENDENTE',
          resolucao: null,
          descricao:
            'Os orçamentos anuais por temática estão definidos, mas modalidades, quantidades, vigências, implementação e distribuição das bolsas ainda não foram definidas.',
        },
      ]);
    });

    it('Comitê Gestor = R$ 381.333,00/ano e R$ 1.525.332,00 no ciclo (RN-14)', async () => {
      const [{ anual }] = await ctx.db
        .select({
          anual: sql<string>`sum(${s.orcamentoComiteGestor.valorAnual})`,
        })
        .from(s.orcamentoComiteGestor)
        .where(eq(s.orcamentoComiteGestor.ano, 2026));

      const [{ ciclo }] = await ctx.db
        .select({
          ciclo: sql<string>`sum(${s.orcamentoComiteGestor.valorAnual})`,
        })
        .from(s.orcamentoComiteGestor);

      expect(anual).toBe('381333.00');
      expect(ciclo).toBe('1525332.00');
    });

    it('o aporte anual não inclui o Comitê Gestor (RN-14)', async () => {
      // O erro que este teste vigia: somar os dois daria R$ 1.631.688,59 e
      // inflaria em 30% o recurso de bolsas. O painel do Comitê Gestor precisou
      // dizer isso por escrito justamente porque a confusão é fácil.
      const [{ bolsas }] = await ctx.db
        .select({
          bolsas: sql<string>`sum(
            coalesce(${s.orcamentoTematica.valorBolsas}, 0)
          + coalesce(${s.orcamentoTematica.valorManutencao}, 0)
          + coalesce(${s.orcamentoTematica.valorMissoes}, 0))`,
        })
        .from(s.orcamentoTematica)
        .where(eq(s.orcamentoTematica.ano, 2027));

      expect(bolsas).toBe('2315444.58');
      expect(bolsas).not.toBe('2696777.58');
    });

    it('registra as premissas e fontes documentais do modelo', async () => {
      const premissas = await ctx.db
        .select({ item: s.premissa.item, valor: s.premissa.valor })
        .from(s.premissa);
      const [{ fontes }] = await ctx.db
        .select({ fontes: sql<number>`count(*)::int` })
        .from(s.fonteDocumental);

      const cotacao = premissas.find((p) =>
        p.item.toLowerCase().includes('cotação'),
      );
      expect(cotacao?.valor).toBe('6.59');
      expect(fontes).toBe(4);
    });

    it('a cotação do catálogo é a mesma da premissa (RN-03)', async () => {
      const [tabela] = await ctx.db
        .select({ cotacao: s.tabelaValores.cotacaoDolar })
        .from(s.tabelaValores);

      expect(Number(tabela.cotacao)).toBe(6.59);
    });
  });

  // ------------------------------------------------------------------ //
  describe('manutenção e missões', () => {
    it('R$ 69.751,14/ano de orçamento sem nenhum item planejado', async () => {
      // Não é falha da seed: os anexos informam o valor global mas não detalham
      // o gasto (PEND-009 e PEND-010). A lacuna precisa ficar visível.
      const [{ apoio }] = await ctx.db
        .select({
          apoio: sql<string>`sum(
            coalesce(${s.orcamentoTematica.valorManutencao}, 0)
          + coalesce(${s.orcamentoTematica.valorMissoes}, 0))`,
        })
        .from(s.orcamentoTematica)
        .where(eq(s.orcamentoTematica.ano, 2027));

      const [{ itens }] = await ctx.db
        .select({ itens: sql<number>`count(*)::int` })
        .from(s.itemPlanejado)
        .where(sql`${s.itemPlanejado.rubrica} <> 'BOLSAS'`);

      expect(apoio).toBe('69751.14');
      expect(itens).toBe(0);
    });
  });

  // ------------------------------------------------------------------ //
  describe('rastreabilidade', () => {
    it('guarda o texto original da planilha em cada linha do plano', async () => {
      const [{ comTexto }] = await ctx.db
        .select({ comTexto: sql<number>`count(*)::int` })
        .from(s.itemPlanejado)
        .where(
          and(
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
            isNotNull(s.itemPlanejado.textoFonte),
          ),
        );

      // Sem a frase original, uma divergência futura não teria como ser
      // conferida contra a fonte.
      expect(comTexto).toBe(18);
    });
  });
});
