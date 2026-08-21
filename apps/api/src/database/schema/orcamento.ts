import { relations, sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  dinheiro,
  id,
  statusComposicaoAnualEnum,
  statusOrcamentoEnum,
  timestamps,
} from './comum';
import { instituicao } from './institucional';
import { areaTematica, ciclo } from './programa';

/**
 * Orçamento, premissas e fontes documentais.
 *
 * Nada de derivado é gravado aqui: `totalPrevisto`, saldo, utilização e
 * divergência são calculados (RN-05 a RN-08). Persistir um total é como a
 * planilha entra em contradição consigo mesma — ver system-structl.md §9.1.
 */

export const orcamentoTematica = pgTable(
  'orcamento_tematica',
  {
    id: id(),
    areaTematicaId: uuid('area_tematica_id')
      .notNull()
      .references(() => areaTematica.id, { onDelete: 'cascade' }),
    ano: integer('ano').notNull(),
    /**
     * As três rubricas. Ficam em colunas separadas porque na planilha vinham
     * como texto multilinha numa célula só (§9.3) — e porque o plano de
     * aplicação agora detalha as três (Q3).
     */
    valorBolsas: dinheiro('valor_bolsas'),
    valorManutencao: dinheiro('valor_manutencao'),
    valorMissoes: dinheiro('valor_missoes'),
    /**
     * O que a FONTE alegava — não o que o sistema calcula.
     *
     * Parece contradizer a regra de não guardar derivado, mas não é derivado
     * nosso: é a afirmação do anexo, guardada como evidência. RN-08 compara o
     * saldo que o sistema calcula com este número. Foi dessa comparação que
     * surgiram PEND-001 e PEND-003, depois conciliadas com a equipe. Sem guardar
     * a alegação, não haveria como detectar uma divergência futura.
     */
    custoBolsasInformado: dinheiro('custo_bolsas_informado'),
    saldoInformado: dinheiro('saldo_informado'),
    status: statusOrcamentoEnum('status').notNull().default('A_DEFINIR'),
    /**
     * Orçamento aprovado e composição aprovada são fatos diferentes. A
     * UNICAMP, por exemplo, já tem teto por temática, mas ainda não definiu as
     * modalidades e quantidades. O status é manual porque a CAPES é a fonte do
     * ato; o Gerenciador apenas o registra.
     */
    statusComposicao: statusComposicaoAnualEnum('status_composicao')
      .notNull()
      .default('A_DEFINIR'),
    fonte: varchar('fonte', { length: 200 }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orcamento_tematica_ano_uk').on(t.areaTematicaId, t.ano),
    index('orcamento_tematica_ano_idx').on(t.ano),
    // Orçamento `A_DEFINIR` fica com valores nulos — nulo e zero significam
    // coisas diferentes aqui, e tratar pendente como zero é justamente o erro
    // que a UNICAMP provocaria nos indicadores.
    check(
      'orcamento_tematica_definido_ck',
      sql`${t.status} <> 'DEFINIDO' or ${t.valorBolsas} is not null`,
    ),
  ],
);

export const orcamentoComiteGestor = pgTable(
  'orcamento_comite_gestor',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    ano: integer('ano').notNull(),
    valorAnual: dinheiro('valor_anual').notNull(),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orcamento_comite_gestor_uk').on(
      t.cicloId,
      t.instituicaoId,
      t.ano,
    ),
  ],
);

export const premissa = pgTable(
  'premissa',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    item: varchar('item', { length: 200 }).notNull(),
    valor: varchar('valor', { length: 200 }).notNull(),
    unidade: varchar('unidade', { length: 60 }),
    natureza: varchar('natureza', { length: 120 }),
    fonte: varchar('fonte', { length: 200 }),
    dataBase: date('data_base'),
    responsavel: varchar('responsavel', { length: 200 }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('premissa_ciclo_item_uk').on(t.cicloId, t.item)],
);

export const fonteDocumental = pgTable(
  'fonte_documental',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    nome: varchar('nome', { length: 240 }).notNull(),
    conteudoUtilizado: text('conteudo_utilizado'),
    escopo: varchar('escopo', { length: 200 }),
    status: varchar('status', { length: 40 }).notNull().default('INCORPORADO'),
    arquivoOrigem: varchar('arquivo_origem', { length: 240 }),
    dataRecebimento: date('data_recebimento'),
    referenciaNormativa: text('referencia_normativa'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('fonte_documental_ciclo_nome_uk').on(t.cicloId, t.nome)],
);

export const orcamentoTematicaRelations = relations(
  orcamentoTematica,
  ({ one }) => ({
    areaTematica: one(areaTematica, {
      fields: [orcamentoTematica.areaTematicaId],
      references: [areaTematica.id],
    }),
  }),
);

export const orcamentoComiteGestorRelations = relations(
  orcamentoComiteGestor,
  ({ one }) => ({
    ciclo: one(ciclo, {
      fields: [orcamentoComiteGestor.cicloId],
      references: [ciclo.id],
    }),
    instituicao: one(instituicao, {
      fields: [orcamentoComiteGestor.instituicaoId],
      references: [instituicao.id],
    }),
  }),
);

export const premissaRelations = relations(premissa, ({ one }) => ({
  ciclo: one(ciclo, { fields: [premissa.cicloId], references: [ciclo.id] }),
}));

export const fonteDocumentalRelations = relations(
  fonteDocumental,
  ({ one }) => ({
    ciclo: one(ciclo, {
      fields: [fonteDocumental.cicloId],
      references: [ciclo.id],
    }),
  }),
);
