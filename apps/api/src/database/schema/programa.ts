import { relations } from 'drizzle-orm';
import {
  boolean,
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
  id,
  situacaoParticipacaoEnum,
  statusCicloEnum,
  statusOrcamentoEnum,
  timestamps,
} from './comum';
import { instituicao, pessoa, ppg } from './institucional';

/**
 * Estrutura de um programa de mobilidade.
 *
 * `rede` e `areaTematica` são estruturas do CAPES Global. Erasmus não tem redes;
 * PDSE não tem áreas temáticas. Por isso as flags `usaRedes`/`usaAreasTematicas`
 * no programa, e por isso `areaTematicaId` é opcional em tudo que vem depois
 * (system-structl.md §3.2).
 */

export const papelComiteEnum = pgEnum('papel_comite', ['TITULAR', 'SUPLENTE']);

export const programa = pgTable(
  'programa',
  {
    id: id(),
    nome: varchar('nome', { length: 200 }).notNull(),
    sigla: varchar('sigla', { length: 40 }),
    slug: varchar('slug', { length: 80 }).notNull(),
    orgaoFinanciador: varchar('orgao_financiador', { length: 120 }),
    descricao: text('descricao'),
    usaRedes: boolean('usa_redes').notNull().default(false),
    usaAreasTematicas: boolean('usa_areas_tematicas').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('programa_slug_uk').on(t.slug)],
);

export const ciclo = pgTable(
  'ciclo',
  {
    id: id(),
    programaId: uuid('programa_id')
      .notNull()
      .references(() => programa.id, { onDelete: 'cascade' }),
    nome: varchar('nome', { length: 80 }).notNull(),
    anoInicio: integer('ano_inicio').notNull(),
    anoFim: integer('ano_fim').notNull(),
    status: statusCicloEnum('status').notNull().default('PLANEJAMENTO'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('ciclo_programa_nome_uk').on(t.programaId, t.nome)],
);

export const redeCoordenadora = pgTable(
  'rede_coordenadora',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    nome: varchar('nome', { length: 120 }).notNull(),
    statusOrcamento: statusOrcamentoEnum('status_orcamento')
      .notNull()
      .default('A_DEFINIR'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('rede_ciclo_nome_uk').on(t.cicloId, t.nome)],
);

export const areaTematica = pgTable(
  'area_tematica',
  {
    id: id(),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'cascade' }),
    /** Código de negócio, ex.: `UNESP-T4`. É como a equipe se refere à temática. */
    codigo: varchar('codigo', { length: 40 }).notNull(),
    nome: varchar('nome', { length: 300 }).notNull(),
    temaNumero: integer('tema_numero'),
    statusOrcamento: statusOrcamentoEnum('status_orcamento')
      .notNull()
      .default('A_DEFINIR'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('area_tematica_codigo_uk').on(t.codigo),
    index('area_tematica_rede_idx').on(t.redeId),
  ],
);

export const membroComite = pgTable(
  'membro_comite',
  {
    id: id(),
    areaTematicaId: uuid('area_tematica_id')
      .notNull()
      .references(() => areaTematica.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    papel: papelComiteEnum('papel').notNull().default('TITULAR'),
    desde: varchar('desde', { length: 10 }),
    ate: varchar('ate', { length: 10 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('membro_comite_uk').on(t.areaTematicaId, t.pessoaId),
    index('membro_comite_pessoa_idx').on(t.pessoaId),
  ],
);

export const participacaoPpg = pgTable(
  'participacao_ppg',
  {
    id: id(),
    areaTematicaId: uuid('area_tematica_id')
      .notNull()
      .references(() => areaTematica.id, { onDelete: 'cascade' }),
    ppgId: uuid('ppg_id')
      .notNull()
      .references(() => ppg.id),
    /** Responsavel por este PPG dentro da tematica; pode coordenar varios PPGs. */
    coordenadorTematicaId: uuid('coordenador_tematica_id')
      .notNull()
      .references(() => pessoa.id),
    situacao: situacaoParticipacaoEnum('situacao')
      .notNull()
      .default('CADASTRO_PRELIMINAR'),
    modalidadesPrevistas: text('modalidades_previstas'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    // Um PPG não participa duas vezes da MESMA temática. Participar de duas
    // temáticas diferentes é permitido — é o caso do PROFSAÚDE (PEND-006) —, e a
    // detecção disso é regra de negócio, não constraint: o banco não deve
    // impedir um dado que existe de verdade.
    uniqueIndex('participacao_ppg_uk').on(t.areaTematicaId, t.ppgId),
    index('participacao_ppg_ppg_idx').on(t.ppgId),
    index('participacao_ppg_coordenador_idx').on(t.coordenadorTematicaId),
  ],
);

// ---------------------------------------------------------------------------
// Relações
// ---------------------------------------------------------------------------

export const programaRelations = relations(programa, ({ many }) => ({
  ciclos: many(ciclo),
}));

export const cicloRelations = relations(ciclo, ({ one, many }) => ({
  programa: one(programa, {
    fields: [ciclo.programaId],
    references: [programa.id],
  }),
  redes: many(redeCoordenadora),
}));

export const redeCoordenadoraRelations = relations(
  redeCoordenadora,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [redeCoordenadora.cicloId],
      references: [ciclo.id],
    }),
    instituicao: one(instituicao, {
      fields: [redeCoordenadora.instituicaoId],
      references: [instituicao.id],
    }),
    areasTematicas: many(areaTematica),
  }),
);

export const areaTematicaRelations = relations(
  areaTematica,
  ({ one, many }) => ({
    rede: one(redeCoordenadora, {
      fields: [areaTematica.redeId],
      references: [redeCoordenadora.id],
    }),
    membros: many(membroComite),
    participacoes: many(participacaoPpg),
  }),
);

export const membroComiteRelations = relations(membroComite, ({ one }) => ({
  areaTematica: one(areaTematica, {
    fields: [membroComite.areaTematicaId],
    references: [areaTematica.id],
  }),
  pessoa: one(pessoa, {
    fields: [membroComite.pessoaId],
    references: [pessoa.id],
  }),
}));

export const participacaoPpgRelations = relations(
  participacaoPpg,
  ({ one }) => ({
    areaTematica: one(areaTematica, {
      fields: [participacaoPpg.areaTematicaId],
      references: [areaTematica.id],
    }),
    ppg: one(ppg, { fields: [participacaoPpg.ppgId], references: [ppg.id] }),
    coordenadorTematica: one(pessoa, {
      fields: [participacaoPpg.coordenadorTematicaId],
      references: [pessoa.id],
    }),
  }),
);
