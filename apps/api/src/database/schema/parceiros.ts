import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { id, timestamps } from './comum';
import { instituicao, pais } from './institucional';
import { redeCoordenadora } from './programa';

/**
 * Base reutilizavel de parceiros internacionais.
 *
 * O contato pertence a instituicao, nunca a uma rede ou missao. As associacoes
 * posteriores apenas guardam seu id e preservam uma unica fonte de verdade.
 */
export const instituicaoRede = pgTable(
  'instituicao_rede',
  {
    id: id(),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('instituicao_rede_uk').on(t.instituicaoId, t.redeId),
    index('instituicao_rede_rede_idx').on(t.redeId),
  ],
);

export const contatoInstituicao = pgTable(
  'contato_instituicao',
  {
    id: id(),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    nome: varchar('nome', { length: 240 }).notNull(),
    /** Auxilia busca e conciliacao sem impor que homonimos sejam duplicados. */
    nomeNormalizado: varchar('nome_normalizado', { length: 240 }).notNull(),
    cargo: varchar('cargo', { length: 160 }),
    departamento: varchar('departamento', { length: 240 }),
    area: varchar('area', { length: 160 }),
    email: varchar('email', { length: 240 }),
    /** Identidade de e-mail para deduplicacao sem diferenca de caixa. */
    emailNormalizado: varchar('email_normalizado', { length: 240 }),
    telefone: varchar('telefone', { length: 80 }),
    paisId: uuid('pais_id').references(() => pais.id),
    idiomaComunicacao: varchar('idioma_comunicacao', { length: 80 }),
    principal: boolean('principal').notNull().default(false),
    observacoes: text('observacoes'),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('contato_instituicao_instituicao_nome_idx').on(
      t.instituicaoId,
      t.nomeNormalizado,
    ),
    index('contato_instituicao_pais_idx').on(t.paisId),
    uniqueIndex('contato_instituicao_principal_ativo_uk')
      .on(t.instituicaoId)
      .where(sql`${t.principal} is true and ${t.ativo} is true`),
    uniqueIndex('contato_instituicao_email_uk').on(
      t.instituicaoId,
      t.emailNormalizado,
    ),
    check(
      'contato_instituicao_nome_normalizado_ck',
      sql`length(trim(${t.nomeNormalizado})) > 0`,
    ),
    check(
      'contato_instituicao_principal_ativo_ck',
      sql`${t.principal} is false or ${t.ativo} is true`,
    ),
    check(
      'contato_instituicao_email_normalizado_ck',
      sql`${t.emailNormalizado} is null or (${t.email} is not null and ${t.emailNormalizado} = lower(trim(${t.email})))`,
    ),
  ],
);

export const instituicaoRedeRelations = relations(
  instituicaoRede,
  ({ one }) => ({
    instituicao: one(instituicao, {
      fields: [instituicaoRede.instituicaoId],
      references: [instituicao.id],
    }),
    rede: one(redeCoordenadora, {
      fields: [instituicaoRede.redeId],
      references: [redeCoordenadora.id],
    }),
  }),
);

export const contatoInstituicaoRelations = relations(
  contatoInstituicao,
  ({ one }) => ({
    instituicao: one(instituicao, {
      fields: [contatoInstituicao.instituicaoId],
      references: [instituicao.id],
    }),
    pais: one(pais, {
      fields: [contatoInstituicao.paisId],
      references: [pais.id],
    }),
  }),
);
