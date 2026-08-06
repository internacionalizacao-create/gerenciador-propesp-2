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
    await ctx.encerrar();
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

    it('carrega 13 membros de comitê, com 2 na UNICAMP-T1', async () => {
      const [{ total }] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.membroComite);
      expect(total).toBe(13);

      const doisMembros = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.membroComite)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.membroComite.areaTematicaId),
        )
        .where(eq(s.areaTematica.codigo, 'UNICAMP-T1'));
      expect(doisMembros[0].total).toBe(2);
    });

    it('cadastra os demais programas de mobilidade, ainda sem dados', async () => {
      const programas = await ctx.db
        .select({ slug: s.programa.slug })
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
    });
  });

  // ------------------------------------------------------------------ //
  describe('orçamento', () => {
    it('aporte anual conhecido = R$ 1.250.355,59', async () => {
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

      expect(total).toBe('1250355.59');
    });

    it('aporte do ciclo = R$ 5.001.422,36 (RN-09)', async () => {
      const [{ total }] = await ctx.db
        .select({
          total: sql<string>`sum(
            coalesce(${s.orcamentoTematica.valorBolsas}, 0)
          + coalesce(${s.orcamentoTematica.valorManutencao}, 0)
          + coalesce(${s.orcamentoTematica.valorMissoes}, 0))`,
        })
        .from(s.orcamentoTematica)
        .where(eq(s.orcamentoTematica.status, 'DEFINIDO'));

      expect(total).toBe('5001422.36');
    });

    it('4 temáticas sem orçamento definido, todas da UNICAMP', async () => {
      const pendentes = await ctx.db
        .selectDistinct({ codigo: s.areaTematica.codigo })
        .from(s.areaTematica)
        .where(eq(s.areaTematica.statusOrcamento, 'A_DEFINIR'));

      expect(pendentes).toHaveLength(4);
      expect(pendentes.every((t) => t.codigo.startsWith('UNICAMP-'))).toBe(
        true,
      );
    });

    it('temática A_DEFINIR guarda nulo, não zero', async () => {
      // A diferença que impede a UNICAMP de baixar as médias do painel.
      const [orc] = await ctx.db
        .select({ valorBolsas: s.orcamentoTematica.valorBolsas })
        .from(s.orcamentoTematica)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.orcamentoTematica.areaTematicaId),
        )
        .where(eq(s.areaTematica.codigo, 'UNICAMP-T1'))
        .limit(1);

      expect(orc.valorBolsas).toBeNull();
    });
  });

  // ------------------------------------------------------------------ //
  describe('plano de bolsas', () => {
    it('custo anual das bolsas = R$ 1.144.357,20', async () => {
      const [{ total }] = await ctx.db
        .select({ total: custoAnualPorTematica })
        .from(s.itemPlanejado)
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(eq(s.itemPlanejado.cicloId, cicloId));

      expect(total).toBe('1144357.20');
    });

    it('custo anual por rede: UNESP R$ 624.867,50 e UFMG R$ 519.489,70', async () => {
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
        .groupBy(s.redeCoordenadora.nome);

      const mapa = Object.fromEntries(porRede.map((r) => [r.rede, r.custo]));
      expect(mapa).toEqual({ UNESP: '624867.50', UFMG: '519489.70' });
    });

    it('25 bolsas por ano: 2 IN e 23 OUT (RN-11)', async () => {
      const porFluxo = await ctx.db
        .select({
          fluxo: s.itemPlanejado.fluxo,
          // Soma de QUANTIDADES, não contagem de linhas: 23 linhas rendem 25 bolsas.
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
      expect(mapa.get('OUT')).toBe(23);
      expect((mapa.get('IN') ?? 0) + (mapa.get('OUT') ?? 0)).toBe(25);
    });

    it('23 linhas de planejamento programadas — a contagem que gerou confusão', async () => {
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

      expect(linhas).toBe(23);
    });

    it('100 bolsas no ciclo', async () => {
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

      expect(total).toBe(100);
    });

    it('10 linhas da UNICAMP pendentes, sem catálogo e sem quantidade', async () => {
      const pendentes = await ctx.db
        .select({
          codigo: s.itemPlanejado.codigo,
          quantidade: s.itemPlanejado.quantidadeAnual,
          catalogo: s.itemPlanejado.itemCatalogoId,
        })
        .from(s.itemPlanejado)
        .where(eq(s.itemPlanejado.status, 'PENDENTE'));

      expect(pendentes).toHaveLength(10);
      expect(pendentes.every((p) => p.quantidade === 0)).toBe(true);
      expect(pendentes.every((p) => p.catalogo === null)).toBe(true);
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
        );

      expect(linhas).toHaveLength(23);
      expect(linhas.every((l) => Number(l.doCatalogo) > 0)).toBe(true);
    });
  });

  // ------------------------------------------------------------------ //
  describe('saldo e divergência', () => {
    it('saldo potencial anual = R$ 36.247,25 (RN-06)', async () => {
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
            eq(s.orcamentoTematica.status, 'DEFINIDO'),
          ),
        );

      expect(saldo).toBe('36247.25');
    });

    it('saldo potencial do ciclo = R$ 144.989,00', async () => {
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
        .where(eq(s.orcamentoTematica.status, 'DEFINIDO'));

      expect(saldo).toBe('144989.00');
    });

    it('detecta as 2 divergências entre saldo calculado e informado (RN-08)', async () => {
      // O sistema calcula o saldo e compara com o que o anexo alegava. As duas
      // diferenças que aparecem — R$ 206,10 e R$ 11.005,49 — são exatamente a
      // origem de PEND-001 e PEND-003, e o sistema tem que achá-las sozinho.
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

      const mapa = Object.fromEntries(
        divergentes.map((d) => [d.codigo, d.divergencia]),
      );
      expect(mapa).toEqual({
        'UNESP-T3': '206.10',
        'UNESP-T1': '11005.49',
      });
    });
  });

  // ------------------------------------------------------------------ //
  describe('governança', () => {
    it('14 pendências carregadas — e não as 10 que o painel anunciava', async () => {
      const [{ total }] = await ctx.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.pendencia);

      expect(total).toBe(14);
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

      expect(bolsas).toBe('1250355.59');
      expect(bolsas).not.toBe('1631688.59');
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
      expect(fontes).toBe(2);
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
      expect(comTexto).toBe(23);
    });
  });
});
