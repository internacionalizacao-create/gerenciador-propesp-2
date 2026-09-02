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

import { id, timestamps } from './comum';
import { instituicao, pais, pessoa } from './institucional';
import { tipoMissaoEnum } from './planejamento';
import { ciclo, redeCoordenadora } from './programa';

/** Equipes operacionais vinculadas ao orcamento paralelo do Comite Gestor. */
export const tipoEquipeGestaoEnum = pgEnum('tipo_equipe_gestao', [
  'COMITE_GESTOR',
  'ADMINISTRACAO',
]);

export const papelMissaoEnum = pgEnum('papel_missao', [
  'RESPONSAVEL',
  'PARTICIPANTE',
  'APOIO',
]);

export const statusMissaoComiteEnum = pgEnum('status_missao_comite', [
  'RASCUNHO',
  'PLANEJADA',
  'CONFIRMADA',
  'CONCLUIDA',
  'CANCELADA',
]);

export const statusAtividadeMissaoEnum = pgEnum('status_atividade_missao', [
  'PLANEJADA',
  'REALIZADA',
  'NAO_REALIZADA',
]);

export const membroEquipeGestao = pgTable(
  'membro_equipe_gestao',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    tipoEquipe: tipoEquipeGestaoEnum('tipo_equipe').notNull(),
    funcao: varchar('funcao', { length: 160 }).notNull(),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('membro_equipe_gestao_inicio_uk').on(
      t.cicloId,
      t.pessoaId,
      t.tipoEquipe,
      t.dataInicio,
    ),
    // So pode haver um vinculo sem encerramento por pessoa/equipe. Periodos
    // historicos adicionais sao validados contra sobreposicao no servico.
    uniqueIndex('membro_equipe_gestao_ativo_uk')
      .on(t.cicloId, t.pessoaId, t.tipoEquipe)
      .where(sql`${t.dataFim} is null`),
    index('membro_equipe_gestao_ciclo_idx').on(t.cicloId),
    index('membro_equipe_gestao_pessoa_idx').on(t.pessoaId),
    check(
      'membro_equipe_gestao_periodo_ck',
      sql`${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
  ],
);

/** Redes cujos documentos formais fundamentam o vinculo da pessoa. */
export const membroEquipeGestaoRede = pgTable(
  'membro_equipe_gestao_rede',
  {
    id: id(),
    membroEquipeId: uuid('membro_equipe_id')
      .notNull()
      .references(() => membroEquipeGestao.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('membro_equipe_gestao_rede_uk').on(t.membroEquipeId, t.redeId),
    index('membro_equipe_gestao_rede_membro_idx').on(t.membroEquipeId),
    index('membro_equipe_gestao_rede_rede_idx').on(t.redeId),
  ],
);

/** Viagem institucional do Comite Gestor, independente do plano de aplicacao. */
export const missaoComite = pgTable(
  'missao_comite',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    objetivo: text('objetivo').notNull(),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    status: statusMissaoComiteEnum('status').notNull().default('RASCUNHO'),
    relatoGeral: text('relato_geral'),
    resultados: text('resultados'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_comite_codigo_uk').on(t.cicloId, t.codigo),
    index('missao_comite_ciclo_status_idx').on(t.cicloId, t.status),
    index('missao_comite_periodo_idx').on(t.dataInicio, t.dataFim),
    check('missao_comite_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`),
  ],
);

/**
 * Redes coordenadoras a que a missao pertence.
 *
 * E muitos-para-muitos porque a missao conjunta das tres redes e justamente o
 * caso que o modulo quer registrar (CG-007). Uma coluna singular em
 * `missao_comite` teria de ser substituida na primeira missao compartilhada.
 *
 * Nao ha coluna de "rede principal": nenhuma regra atual precisa eleger uma, e
 * a contagem oficial ja resolve o duplo pertencimento contando a missao uma
 * unica vez em "todas as redes". Se a governanca passar a exigir um responsavel
 * unico, ele entra aqui como coluna nova, sem remodelar a associacao.
 *
 * A rede pertence a um ciclo, entao o servico exige que rede e missao sejam do
 * mesmo ciclo; o banco sozinho nao consegue afirmar isso.
 */
export const missaoRede = pgTable(
  'missao_rede',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_rede_uk').on(t.missaoId, t.redeId),
    index('missao_rede_missao_idx').on(t.missaoId),
    index('missao_rede_rede_idx').on(t.redeId),
  ],
);

/**
 * Pessoa que viaja ou apoia uma missao.
 *
 * O vinculo com a equipe e opcional: uma pessoa pode participar sem integrar o
 * Comite Gestor nem a Administracao. Quando informado, preserva qual composicao
 * de equipe fundamentou a participacao naquele momento.
 */
export const missaoParticipante = pgTable(
  'missao_participante',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    membroEquipeId: uuid('membro_equipe_id').references(
      () => membroEquipeGestao.id,
      { onDelete: 'set null' },
    ),
    papel: papelMissaoEnum('papel').notNull().default('PARTICIPANTE'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_participante_pessoa_uk').on(t.missaoId, t.pessoaId),
    index('missao_participante_missao_idx').on(t.missaoId),
    index('missao_participante_pessoa_idx').on(t.pessoaId),
    index('missao_participante_equipe_idx').on(t.membroEquipeId),
  ],
);

/** Uma parada do roteiro: visita, universidade, instituicao ou evento. */
export const atividadeMissao = pgTable(
  'atividade_missao',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull().default(0),
    tipo: tipoMissaoEnum('tipo').notNull(),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    paisId: uuid('pais_id')
      .notNull()
      .references(() => pais.id),
    cidade: varchar('cidade', { length: 120 }),
    instituicaoId: uuid('instituicao_id').references(() => instituicao.id),
    instituicaoNome: varchar('instituicao_nome', { length: 240 }),
    eventoNome: varchar('evento_nome', { length: 300 }),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    planejamento: text('planejamento'),
    relatoRealizado: text('relato_realizado'),
    resultados: text('resultados'),
    status: statusAtividadeMissaoEnum('status').notNull().default('PLANEJADA'),
    /**
     * Atividade que aconteceu sem constar do roteiro planejado.
     *
     * E uma coluna, e nao uma deducao a partir de `planejamento` estar vazio:
     * o relato precisa continuar distinguindo o que foi previsto do que
     * simplesmente aconteceu, mesmo anos depois.
     */
    naoPrevista: boolean('nao_prevista').notNull().default(false),
    justificativaInclusao: text('justificativa_inclusao'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('atividade_missao_ordem_uk').on(t.missaoId, t.ordem),
    index('atividade_missao_missao_idx').on(t.missaoId),
    index('atividade_missao_pais_idx').on(t.paisId),
    index('atividade_missao_instituicao_idx').on(t.instituicaoId),
    check('atividade_missao_ordem_ck', sql`${t.ordem} >= 0`),
    check('atividade_missao_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`),
    // Evita que catalogo e texto livre disputem qual instituicao e a correta.
    check(
      'atividade_missao_instituicao_ck',
      sql`num_nonnulls(${t.instituicaoId}, ${t.instituicaoNome}) <= 1`,
    ),
    // Incluir no relato o que nao estava previsto exige dizer por que.
    check(
      'atividade_missao_nao_prevista_ck',
      sql`${t.naoPrevista} is false or ${t.justificativaInclusao} is not null`,
    ),
  ],
);

export const membroEquipeGestaoRelations = relations(
  membroEquipeGestao,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [membroEquipeGestao.cicloId],
      references: [ciclo.id],
    }),
    pessoa: one(pessoa, {
      fields: [membroEquipeGestao.pessoaId],
      references: [pessoa.id],
    }),
    redes: many(membroEquipeGestaoRede),
    participacoes: many(missaoParticipante),
  }),
);

export const membroEquipeGestaoRedeRelations = relations(
  membroEquipeGestaoRede,
  ({ one }) => ({
    membro: one(membroEquipeGestao, {
      fields: [membroEquipeGestaoRede.membroEquipeId],
      references: [membroEquipeGestao.id],
    }),
    rede: one(redeCoordenadora, {
      fields: [membroEquipeGestaoRede.redeId],
      references: [redeCoordenadora.id],
    }),
  }),
);

export const missaoComiteRelations = relations(
  missaoComite,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [missaoComite.cicloId],
      references: [ciclo.id],
    }),
    participantes: many(missaoParticipante),
    atividades: many(atividadeMissao),
    redes: many(missaoRede),
  }),
);

export const missaoRedeRelations = relations(missaoRede, ({ one }) => ({
  missao: one(missaoComite, {
    fields: [missaoRede.missaoId],
    references: [missaoComite.id],
  }),
  rede: one(redeCoordenadora, {
    fields: [missaoRede.redeId],
    references: [redeCoordenadora.id],
  }),
}));

export const missaoParticipanteRelations = relations(
  missaoParticipante,
  ({ one }) => ({
    missao: one(missaoComite, {
      fields: [missaoParticipante.missaoId],
      references: [missaoComite.id],
    }),
    pessoa: one(pessoa, {
      fields: [missaoParticipante.pessoaId],
      references: [pessoa.id],
    }),
    membroEquipe: one(membroEquipeGestao, {
      fields: [missaoParticipante.membroEquipeId],
      references: [membroEquipeGestao.id],
    }),
  }),
);

export const atividadeMissaoRelations = relations(
  atividadeMissao,
  ({ one }) => ({
    missao: one(missaoComite, {
      fields: [atividadeMissao.missaoId],
      references: [missaoComite.id],
    }),
    pais: one(pais, {
      fields: [atividadeMissao.paisId],
      references: [pais.id],
    }),
    instituicao: one(instituicao, {
      fields: [atividadeMissao.instituicaoId],
      references: [instituicao.id],
    }),
  }),
);
