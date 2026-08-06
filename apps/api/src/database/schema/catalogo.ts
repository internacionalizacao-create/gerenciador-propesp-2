import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { destinoEnum, dinheiro, id, meses, timestamps } from './comum';
import { programa } from './programa';

/**
 * Catálogo oficial de bolsas: a tabela (destino × modalidade × vigência → valor)
 * de onde sai TODO custo de bolsa do sistema (RN-01).
 *
 * É versionado porque a CAPES pode reajustar os valores (PEND-007) e porque uma
 * bolsa já planejada precisa continuar valendo o preço da tabela em que foi
 * calculada. Sobrescrever a tabela vigente apagaria a base de cálculo de um
 * planejamento já aprovado.
 */

export const publicoModalidadeEnum = pgEnum('publico_modalidade', [
  'DOCENTE',
  'DISCENTE',
  'POS_DOC',
  'AMBOS',
]);

export const modalidade = pgTable(
  'modalidade',
  {
    id: id(),
    nome: varchar('nome', { length: 120 }).notNull(),
    publicoAlvo: publicoModalidadeEnum('publico_alvo')
      .notNull()
      .default('AMBOS'),
    permiteBrasil: boolean('permite_brasil').notNull().default(false),
    permiteExterior: boolean('permite_exterior').notNull().default(false),
    ativa: boolean('ativa').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('modalidade_nome_uk').on(t.nome)],
);

export const tabelaValores = pgTable(
  'tabela_valores',
  {
    id: id(),
    programaId: uuid('programa_id')
      .notNull()
      .references(() => programa.id, { onDelete: 'cascade' }),
    versao: varchar('versao', { length: 40 }).notNull(),
    dataBase: date('data_base').notNull(),
    /** Cotação usada para converter as bolsas no exterior (RN-03). */
    cotacaoDolar: numeric('cotacao_dolar', {
      precision: 10,
      scale: 4,
    }).notNull(),
    referenciaNormativa: text('referencia_normativa'),
    vigenteDe: date('vigente_de').notNull(),
    vigenteAte: date('vigente_ate'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('tabela_valores_programa_versao_uk').on(t.programaId, t.versao),
    check(
      'tabela_valores_vigencia_ck',
      sql`${t.vigenteAte} is null or ${t.vigenteAte} >= ${t.vigenteDe}`,
    ),
  ],
);

export const itemCatalogoBolsa = pgTable(
  'item_catalogo_bolsa',
  {
    id: id(),
    tabelaValoresId: uuid('tabela_valores_id')
      .notNull()
      .references(() => tabelaValores.id, { onDelete: 'cascade' }),
    /** Código de negócio, ex.: `CAT-001`. */
    codigo: varchar('codigo', { length: 20 }).notNull(),
    destino: destinoEnum('destino').notNull(),
    modalidadeId: uuid('modalidade_id')
      .notNull()
      .references(() => modalidade.id),
    vigenciaMeses: meses('vigencia_meses').notNull(),
    valorUsd: dinheiro('valor_usd'),
    valorBrl: dinheiro('valor_brl').notNull(),
    fonte: varchar('fonte', { length: 200 }),
    observacao: text('observacao'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('item_catalogo_codigo_uk').on(t.tabelaValoresId, t.codigo),
    // Chave de busca do cálculo de custo. Sem unicidade aqui, uma tabela com
    // linha duplicada faria o mesmo planejamento render custos diferentes
    // conforme a ordem de leitura.
    uniqueIndex('item_catalogo_busca_uk').on(
      t.tabelaValoresId,
      t.destino,
      t.modalidadeId,
      t.vigenciaMeses,
    ),
    index('item_catalogo_tabela_idx').on(t.tabelaValoresId),
    check('item_catalogo_valor_brl_ck', sql`${t.valorBrl} > 0`),
    check('item_catalogo_vigencia_ck', sql`${t.vigenciaMeses} > 0`),
  ],
);

export const modalidadeRelations = relations(modalidade, ({ many }) => ({
  itensCatalogo: many(itemCatalogoBolsa),
}));

export const tabelaValoresRelations = relations(
  tabelaValores,
  ({ one, many }) => ({
    programa: one(programa, {
      fields: [tabelaValores.programaId],
      references: [programa.id],
    }),
    itens: many(itemCatalogoBolsa),
  }),
);

export const itemCatalogoBolsaRelations = relations(
  itemCatalogoBolsa,
  ({ one }) => ({
    tabelaValores: one(tabelaValores, {
      fields: [itemCatalogoBolsa.tabelaValoresId],
      references: [tabelaValores.id],
    }),
    modalidade: one(modalidade, {
      fields: [itemCatalogoBolsa.modalidadeId],
      references: [modalidade.id],
    }),
  }),
);
