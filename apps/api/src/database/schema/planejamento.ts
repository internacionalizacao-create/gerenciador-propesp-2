import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  destinoEnum,
  dinheiro,
  fluxoEnum,
  id,
  meses,
  nivelBeneficiarioEnum,
  rubricaEnum,
  statusBolsaConcedidaEnum,
  statusItemPlanejadoEnum,
  statusProdutoBolsaEnum,
  timestamps,
  tipoProdutoBolsaEnum,
} from './comum';
import { itemCatalogoBolsa, modalidade } from './catalogo';
import { instituicao, pais, pessoa, ppg } from './institucional';
import { areaTematica, ciclo, programa } from './programa';

/**
 * Planejamento e concessão.
 *
 * `itemPlanejado` cobre as TRÊS rubricas num modelo só (Q3). Bolsas, manutenção
 * e missões compartilham temática, PPG, quantidade, mês e projeção plurianual —
 * e diferem apenas no que define o valor unitário. Três tabelas paralelas
 * obrigariam a somar orçamento em três lugares e a manter três vezes a mesma
 * lógica de projeção.
 */

export const mesImplementacaoEnum = pgEnum('mes_implementacao', [
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]);

export const tipoMissaoEnum = pgEnum('tipo_missao', [
  'VISITA_TECNICA',
  'EVENTO',
  'ARTICULACAO',
  'BANCA',
  'OUTRO',
]);

export const tipoDespesaEnum = pgEnum('tipo_despesa', [
  'MATERIAL_CONSUMO',
  'SERVICO',
  'EQUIPAMENTO',
  'PUBLICACAO',
  'OUTRO',
]);

export const itemPlanejado = pgTable(
  'item_planejado',
  {
    id: id(),
    /** Código de negócio: `BOL-001`, `MAN-001`, `MIS-001`. */
    codigo: varchar('codigo', { length: 20 }).notNull(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    rubrica: rubricaEnum('rubrica').notNull(),
    areaTematicaId: uuid('area_tematica_id').references(() => areaTematica.id),
    /**
     * Sempre presente. É o que permite filtrar por escopo quando o coordenador
     * de PPG usar o sistema (§3.5) — sem isso, não há como responder "o que é
     * meu" sem varrer o caminho inteiro até a temática.
     */
    ppgId: uuid('ppg_id')
      .notNull()
      .references(() => ppg.id),
    descricao: text('descricao'),
    quantidadeAnual: integer('quantidade_anual').notNull().default(0),
    mesImplementacao: mesImplementacaoEnum('mes_implementacao'),
    /**
     * Só para MANUTENCAO e MISSOES, onde não existe tabela oficial: o valor é
     * uma estimativa. Para BOLSAS fica nulo — o valor vem do catálogo.
     */
    valorUnitarioInformado: dinheiro('valor_unitario_informado'),
    justificativaEstimativa: text('justificativa_estimativa'),
    status: statusItemPlanejadoEnum('status').notNull().default('PROGRAMADO'),
    textoFonte: text('texto_fonte'),
    validacaoPendencia: text('validacao_pendencia'),
    observacoes: text('observacoes'),

    // --- exclusivo de rubrica = BOLSAS ---
    destino: destinoEnum('destino'),
    modalidadeId: uuid('modalidade_id').references(() => modalidade.id),
    vigenciaMeses: meses('vigencia_meses'),
    itemCatalogoId: uuid('item_catalogo_id').references(
      () => itemCatalogoBolsa.id,
    ),
    fluxo: fluxoEnum('fluxo'),

    // --- exclusivo de rubrica = MISSOES ---
    tipoMissao: tipoMissaoEnum('tipo_missao'),
    paisDestinoId: uuid('pais_destino_id').references(() => pais.id),
    instituicaoDestinoId: uuid('instituicao_destino_id').references(
      () => instituicao.id,
    ),
    numeroParticipantes: integer('numero_participantes'),
    numeroDiarias: integer('numero_diarias'),
    incluiPassagem: boolean('inclui_passagem'),

    // --- exclusivo de rubrica = MANUTENCAO ---
    tipoDespesa: tipoDespesaEnum('tipo_despesa'),

    ...timestamps,
  },
  (t) => [
    uniqueIndex('item_planejado_codigo_uk').on(t.cicloId, t.codigo),
    index('item_planejado_tematica_idx').on(t.areaTematicaId),
    index('item_planejado_ppg_idx').on(t.ppgId),
    index('item_planejado_rubrica_idx').on(t.rubrica),
    check('item_planejado_qtd_ck', sql`${t.quantidadeAnual} >= 0`),
    /**
     * Item de bolsa PROGRAMADO precisa estar resolvido no catálogo. É o que
     * garante que nenhum custo de bolsa venha de valor digitado (RN-01).
     * `PENDENTE` escapa para registrar propostas ainda não aprovadas. Quando a
     * combinação já é conhecida, como nas quatro Capacitações da UFMG, ela
     * continua vinculada ao catálogo para mostrar seu impacto potencial.
     */
    check(
      'item_planejado_bolsa_catalogo_ck',
      sql`${t.rubrica} <> 'BOLSAS'
           or ${t.status} <> 'PROGRAMADO'
           or (${t.itemCatalogoId} is not null
               and ${t.destino} is not null
               and ${t.modalidadeId} is not null
               and ${t.vigenciaMeses} is not null)`,
    ),
    /** Bolsa nunca usa valor informado; manutenção e missão nunca usam catálogo. */
    check(
      'item_planejado_valor_por_rubrica_ck',
      sql`(${t.rubrica} = 'BOLSAS' and ${t.valorUnitarioInformado} is null)
           or (${t.rubrica} <> 'BOLSAS' and ${t.itemCatalogoId} is null)`,
    ),
  ],
);

export const planejamentoAnual = pgTable(
  'planejamento_anual',
  {
    id: id(),
    itemPlanejadoId: uuid('item_planejado_id')
      .notNull()
      .references(() => itemPlanejado.id, { onDelete: 'cascade' }),
    ano: integer('ano').notNull(),
    quantidade: integer('quantidade').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('planejamento_anual_uk').on(t.itemPlanejadoId, t.ano),
    index('planejamento_anual_ano_idx').on(t.ano),
    check('planejamento_anual_qtd_ck', sql`${t.quantidade} >= 0`),
  ],
);

export const bolsaConcedida = pgTable(
  'bolsa_concedida',
  {
    id: id(),
    /** Opcional: GCUB e Erasmus podem chegar sem planejamento nesta ferramenta. */
    itemPlanejadoId: uuid('item_planejado_id').references(
      () => itemPlanejado.id,
    ),
    programaId: uuid('programa_id')
      .notNull()
      .references(() => programa.id),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id),
    ppgId: uuid('ppg_id')
      .notNull()
      .references(() => ppg.id),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    modalidadeId: uuid('modalidade_id')
      .notNull()
      .references(() => modalidade.id),
    destino: destinoEnum('destino').notNull(),
    nivelBeneficiario: nivelBeneficiarioEnum('nivel_beneficiario').notNull(),
    paisOrigemId: uuid('pais_origem_id').references(() => pais.id),
    instituicaoOrigemId: uuid('instituicao_origem_id').references(
      () => instituicao.id,
    ),
    /** Texto preserva origem e destino enquanto o catalogo institucional nao existe. */
    paisOrigemNome: varchar('pais_origem_nome', { length: 120 }),
    instituicaoOrigemNome: varchar('instituicao_origem_nome', {
      length: 240,
    }),
    paisDestinoId: uuid('pais_destino_id').references(() => pais.id),
    instituicaoDestinoId: uuid('instituicao_destino_id').references(
      () => instituicao.id,
    ),
    paisDestinoNome: varchar('pais_destino_nome', { length: 120 }),
    instituicaoDestinoNome: varchar('instituicao_destino_nome', {
      length: 240,
    }),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    vigenciaMeses: meses('vigencia_meses').notNull(),
    valorConcedido: dinheiro('valor_concedido').notNull(),
    fluxo: fluxoEnum('fluxo').notNull(),
    status: statusBolsaConcedidaEnum('status').notNull().default('SELECIONADO'),
    processo: varchar('processo', { length: 120 }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    index('bolsa_concedida_ppg_idx').on(t.ppgId),
    index('bolsa_concedida_pessoa_idx').on(t.pessoaId),
    index('bolsa_concedida_ciclo_idx').on(t.cicloId),
    index('bolsa_concedida_item_idx').on(t.itemPlanejadoId),
    check('bolsa_concedida_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`),
    check('bolsa_concedida_valor_ck', sql`${t.valorConcedido} >= 0`),
  ],
);

/**
 * Entrega cobrada individualmente de uma bolsa concedida.
 *
 * O prazo faz parte do registro desde a criação: guardar só o produto pronto
 * permitiria contar publicações, mas não descobrir quem ainda deve uma entrega.
 */
export const produtoBolsa = pgTable(
  'produto_bolsa',
  {
    id: id(),
    bolsaConcedidaId: uuid('bolsa_concedida_id')
      .notNull()
      .references(() => bolsaConcedida.id, { onDelete: 'cascade' }),
    tipo: tipoProdutoBolsaEnum('tipo').notNull(),
    titulo: varchar('titulo', { length: 400 }).notNull(),
    descricao: text('descricao'),
    prazoEntrega: date('prazo_entrega').notNull(),
    status: statusProdutoBolsaEnum('status').notNull().default('PREVISTO'),
    dataEntrega: date('data_entrega'),
    doi: varchar('doi', { length: 240 }),
    link: varchar('link', { length: 500 }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    index('produto_bolsa_concessao_idx').on(t.bolsaConcedidaId),
    index('produto_bolsa_prazo_idx').on(t.prazoEntrega),
    index('produto_bolsa_status_idx').on(t.status),
    check(
      'produto_bolsa_entrega_ck',
      sql`${t.status} not in ('ENTREGUE', 'VALIDADO') or ${t.dataEntrega} is not null`,
    ),
  ],
);

export const itemPlanejadoRelations = relations(
  itemPlanejado,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [itemPlanejado.cicloId],
      references: [ciclo.id],
    }),
    areaTematica: one(areaTematica, {
      fields: [itemPlanejado.areaTematicaId],
      references: [areaTematica.id],
    }),
    ppg: one(ppg, { fields: [itemPlanejado.ppgId], references: [ppg.id] }),
    modalidade: one(modalidade, {
      fields: [itemPlanejado.modalidadeId],
      references: [modalidade.id],
    }),
    itemCatalogo: one(itemCatalogoBolsa, {
      fields: [itemPlanejado.itemCatalogoId],
      references: [itemCatalogoBolsa.id],
    }),
    planejamentoAnual: many(planejamentoAnual),
    bolsasConcedidas: many(bolsaConcedida),
  }),
);

export const planejamentoAnualRelations = relations(
  planejamentoAnual,
  ({ one }) => ({
    item: one(itemPlanejado, {
      fields: [planejamentoAnual.itemPlanejadoId],
      references: [itemPlanejado.id],
    }),
  }),
);

export const bolsaConcedidaRelations = relations(
  bolsaConcedida,
  ({ one, many }) => ({
    item: one(itemPlanejado, {
      fields: [bolsaConcedida.itemPlanejadoId],
      references: [itemPlanejado.id],
    }),
    ppg: one(ppg, { fields: [bolsaConcedida.ppgId], references: [ppg.id] }),
    pessoa: one(pessoa, {
      fields: [bolsaConcedida.pessoaId],
      references: [pessoa.id],
    }),
    paisDestino: one(pais, {
      fields: [bolsaConcedida.paisDestinoId],
      references: [pais.id],
    }),
    paisOrigem: one(pais, {
      fields: [bolsaConcedida.paisOrigemId],
      references: [pais.id],
    }),
    produtos: many(produtoBolsa),
  }),
);

export const produtoBolsaRelations = relations(produtoBolsa, ({ one }) => ({
  bolsaConcedida: one(bolsaConcedida, {
    fields: [produtoBolsa.bolsaConcedidaId],
    references: [bolsaConcedida.id],
  }),
}));
