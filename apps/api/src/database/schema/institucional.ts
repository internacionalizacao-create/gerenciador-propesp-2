import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import { id, timestamps } from './comum';

/**
 * Domínio institucional: países, instituições, PPGs e pessoas.
 *
 * É a base compartilhada por todos os programas de mobilidade — o que sobra
 * quando se tira tudo que é específico do CAPES Global (system-structl.md §3.2).
 */

export const tipoInstituicaoEnum = pgEnum('tipo_instituicao', [
  'PROPRIA',
  'REDE_COORDENADORA',
  'PARCEIRA_INTERNACIONAL',
]);

export const nivelPpgEnum = pgEnum('nivel_ppg', [
  'MESTRADO',
  'DOUTORADO',
  'MESTRADO_DOUTORADO',
  'MESTRADO_PROFISSIONAL',
]);

export const modalidadePpgEnum = pgEnum('modalidade_ppg', [
  'ACADEMICO',
  'PROFISSIONAL',
]);

export const situacaoPpgEnum = pgEnum('situacao_ppg', [
  'ATIVO',
  'INATIVO',
  'EM_IMPLANTACAO',
]);

export const tipoPessoaEnum = pgEnum('tipo_pessoa', [
  'DOCENTE',
  'DISCENTE',
  'PESQUISADOR',
  'EXTERNO',
]);

export const pais = pgTable(
  'pais',
  {
    id: id(),
    codigoIso2: char('codigo_iso2', { length: 2 }).notNull(),
    codigoIso3: char('codigo_iso3', { length: 3 }).notNull(),
    nome: varchar('nome', { length: 120 }).notNull(),
    continente: varchar('continente', { length: 40 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pais_iso2_uk').on(t.codigoIso2),
    uniqueIndex('pais_iso3_uk').on(t.codigoIso3),
  ],
);

export const instituicao = pgTable(
  'instituicao',
  {
    id: id(),
    nome: varchar('nome', { length: 240 }).notNull(),
    sigla: varchar('sigla', { length: 40 }),
    tipo: tipoInstituicaoEnum('tipo').notNull(),
    paisId: uuid('pais_id').references(() => pais.id),
    cidade: varchar('cidade', { length: 120 }),
    site: varchar('site', { length: 240 }),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('instituicao_nome_uk').on(t.nome),
    index('instituicao_tipo_idx').on(t.tipo),
  ],
);

export const pessoa = pgTable(
  'pessoa',
  {
    id: id(),
    nome: varchar('nome', { length: 240 }).notNull(),
    email: varchar('email', { length: 240 }),
    documento: varchar('documento', { length: 40 }),
    tipo: tipoPessoaEnum('tipo').notNull(),
    /**
     * Vínculo com PPG. `pessoa` e `ppg` se referenciam mutuamente (o PPG aponta
     * para coordenador e vice), e a forma `() => ppg.id` é o que resolve isso:
     * ela adia a leitura da tabela, que só é declarada mais abaixo no arquivo.
     */
    ppgId: uuid('ppg_id').references((): AnyPgColumn => ppg.id),
    instituicaoId: uuid('instituicao_id').references(() => instituicao.id),
    lattes: varchar('lattes', { length: 240 }),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('pessoa_nome_idx').on(t.nome),
    index('pessoa_ppg_idx').on(t.ppgId),
    // E-mail é opcional, mas quando existe não se repete. `uniqueIndex` do
    // Postgres já ignora NULL, então pessoas sem e-mail não colidem entre si.
    uniqueIndex('pessoa_email_uk').on(t.email),
  ],
);

export const ppg = pgTable(
  'ppg',
  {
    id: id(),
    nome: varchar('nome', { length: 300 }).notNull(),
    sigla: varchar('sigla', { length: 40 }).notNull(),
    unidade: varchar('unidade', { length: 200 }),
    nivel: nivelPpgEnum('nivel'),
    modalidade: modalidadePpgEnum('modalidade'),
    /**
     * Conceito CAPES de 1 a 7. O protótipo sugeria até 5, mas o
     * `PPG em Medicina Tropical` tem nota 7 — o CHECK abaixo existe para que
     * ninguém "corrija" isso para 5 depois.
     */
    notaCapes: integer('nota_capes'),
    areaCapes: varchar('area_capes', { length: 200 }),
    situacao: situacaoPpgEnum('situacao').notNull().default('ATIVO'),
    coordenadorId: uuid('coordenador_id').references(() => pessoa.id),
    viceCoordenadorId: uuid('vice_coordenador_id').references(() => pessoa.id),
    /** PPG em rede nacional (BIONORTE, REAMEC, PROFMAT…): o recurso pode ser compartilhado. */
    emRede: boolean('em_rede').notNull().default(false),
    redeAcademica: varchar('rede_academica', { length: 120 }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('ppg_sigla_uk').on(t.sigla),
    index('ppg_nome_idx').on(t.nome),
    check(
      'ppg_nota_capes_ck',
      sql`${t.notaCapes} is null or (${t.notaCapes} between 1 and 7)`,
    ),
  ],
);

export const linhaPesquisa = pgTable(
  'linha_pesquisa',
  {
    id: id(),
    ppgId: uuid('ppg_id')
      .notNull()
      .references(() => ppg.id, { onDelete: 'cascade' }),
    nome: varchar('nome', { length: 300 }).notNull(),
    descricao: text('descricao'),
    ativa: boolean('ativa').notNull().default(true),
    ...timestamps,
  },
  (t) => [uniqueIndex('linha_pesquisa_ppg_nome_uk').on(t.ppgId, t.nome)],
);

// ---------------------------------------------------------------------------
// Relações (para as consultas relacionais do Drizzle)
// ---------------------------------------------------------------------------

export const paisRelations = relations(pais, ({ many }) => ({
  instituicoes: many(instituicao),
}));

export const instituicaoRelations = relations(instituicao, ({ one, many }) => ({
  pais: one(pais, { fields: [instituicao.paisId], references: [pais.id] }),
  pessoas: many(pessoa),
}));

export const pessoaRelations = relations(pessoa, ({ one }) => ({
  ppg: one(ppg, { fields: [pessoa.ppgId], references: [ppg.id] }),
  instituicao: one(instituicao, {
    fields: [pessoa.instituicaoId],
    references: [instituicao.id],
  }),
}));

export const ppgRelations = relations(ppg, ({ one, many }) => ({
  coordenador: one(pessoa, {
    fields: [ppg.coordenadorId],
    references: [pessoa.id],
    relationName: 'coordenador',
  }),
  viceCoordenador: one(pessoa, {
    fields: [ppg.viceCoordenadorId],
    references: [pessoa.id],
    relationName: 'viceCoordenador',
  }),
  linhasPesquisa: many(linhaPesquisa),
}));

export const linhaPesquisaRelations = relations(linhaPesquisa, ({ one }) => ({
  ppg: one(ppg, { fields: [linhaPesquisa.ppgId], references: [ppg.id] }),
}));
