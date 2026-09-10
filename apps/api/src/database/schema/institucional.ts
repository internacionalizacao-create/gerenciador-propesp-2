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

import {
  estagioRelacionamentoEnum,
  id,
  origemRelacionamentoEnum,
  timestamps,
} from './comum';

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
  'SERVIDOR',
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
    /**
     * Codigo numerico da ISO 3166-1 (BOL-042).
     *
     * E por ele que o mapa casa dado e geografia: o topojson identifica pais
     * por numero. Nulo apenas para as linhas anteriores ao campo; a seed
     * preenche as 249.
     */
    codigoNumerico: char('codigo_numerico', { length: 3 }),
    nome: varchar('nome', { length: 120 }).notNull(),
    continente: varchar('continente', { length: 40 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pais_iso2_uk').on(t.codigoIso2),
    uniqueIndex('pais_iso3_uk').on(t.codigoIso3),
    uniqueIndex('pais_numerico_uk').on(t.codigoNumerico),
  ],
);

export const instituicao = pgTable(
  'instituicao',
  {
    id: id(),
    nome: varchar('nome', { length: 240 }).notNull(),
    /** Chave canonica usada para bloquear variacoes inequivocamente iguais. */
    nomeNormalizado: varchar('nome_normalizado', { length: 240 }).notNull(),
    sigla: varchar('sigla', { length: 40 }),
    tipo: tipoInstituicaoEnum('tipo').notNull(),
    paisId: uuid('pais_id').references(() => pais.id),
    cidade: varchar('cidade', { length: 120 }),
    estadoRegiao: varchar('estado_regiao', { length: 120 }),
    tipoOrganizacao: varchar('tipo_organizacao', { length: 120 }),
    faculdadeDepartamento: varchar('faculdade_departamento', { length: 240 }),
    site: varchar('site', { length: 240 }),
    emailInstitucional: varchar('email_institucional', { length: 240 }),
    telefone: varchar('telefone', { length: 80 }),
    endereco: text('endereco'),
    /**
     * Como a instituicao foi identificada (BOL-030).
     *
     * **Nulo apenas para o que ja existia**: obrigatoria em todo cadastro novo,
     * pela regra do servico. Nao ha default no banco de proposito — um default
     * inventaria a resposta para as instituicoes anteriores ao campo, e
     * "prospeccao institucional" seria uma afirmacao que ninguem fez.
     */
    origemRelacionamento: origemRelacionamentoEnum('origem_relacionamento'),
    origemObservacao: text('origem_observacao'),
    /**
     * Estagio declarado. Os dois estados verificaveis do documento —
     * mobilidade realizada e parceria formalizada — sao derivados na leitura,
     * nunca gravados aqui. Ver `estagioRelacionamentoEnum`.
     */
    estagioRelacionamento: estagioRelacionamentoEnum('estagio_relacionamento')
      .notNull()
      .default('IDENTIFICADA'),
    /**
     * Texto livre, e nao lista estruturada.
     *
     * Uma taxonomia de areas so vale se alguem a mantiver; sem isso, "Ciencias
     * Ambientais" e "Ciencias ambientais" viram duas areas e toda contagem sai
     * errada — foi o que aconteceu com evento contado pelo nome (CG-067). O
     * campo descreve para quem le; contar por area fica para quando houver
     * taxonomia de verdade.
     */
    areasAtuacao: text('areas_atuacao'),
    programaRelacionado: varchar('programa_relacionado', { length: 240 }),
    grupoPesquisa: varchar('grupo_pesquisa', { length: 240 }),
    observacoes: text('observacoes'),
    /** Referencia temporaria que ainda deve ser conciliada por um admin. */
    cadastroProvisorio: boolean('cadastro_provisorio').notNull().default(false),
    ativo: boolean('ativo').notNull().default(true),
    /** Instituicao canonica que substituiu este cadastro apos conciliacao. */
    substituidaPorId: uuid('substituida_por_id').references(
      (): AnyPgColumn => instituicao.id,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('instituicao_nome_uk').on(t.nome),
    uniqueIndex('instituicao_nome_normalizado_uk').on(t.nomeNormalizado),
    index('instituicao_tipo_idx').on(t.tipo),
    index('instituicao_estagio_idx').on(t.estagioRelacionamento),
    index('instituicao_substituida_por_idx').on(t.substituidaPorId),
    check(
      'instituicao_nome_normalizado_ck',
      sql`length(trim(${t.nomeNormalizado})) > 0`,
    ),
    check(
      'instituicao_substituida_inativa_ck',
      sql`${t.substituidaPorId} is null or (${t.ativo} is false and ${t.substituidaPorId} <> ${t.id})`,
    ),
  ],
);

export const pessoa = pgTable(
  'pessoa',
  {
    id: id(),
    nome: varchar('nome', { length: 240 }).notNull(),
    email: varchar('email', { length: 240 }),
    documento: varchar('documento', { length: 40 }),
    /** CPF normalizado, usado para aplicar regras por beneficiario no ciclo. */
    cpf: char('cpf', { length: 11 }),
    tipo: tipoPessoaEnum('tipo').notNull(),
    /**
     * Vínculo com PPG. `pessoa` e `ppg` se referenciam mutuamente (o PPG aponta
     * para coordenador e vice), e a forma `() => ppg.id` é o que resolve isso:
     * ela adia a leitura da tabela, que só é declarada mais abaixo no arquivo.
     */
    ppgId: uuid('ppg_id').references((): AnyPgColumn => ppg.id),
    instituicaoId: uuid('instituicao_id').references(() => instituicao.id),
    lattes: varchar('lattes', { length: 240 }),
    telefone: varchar('telefone', { length: 80 }),
    /**
     * ORCID no formato canonico `0000-0000-0000-000X` (BOL-012).
     *
     * Coluna propria, e nao um `lattes` generico de "identificador academico":
     * sao dois registros distintos, mantidos por instituicoes distintas, e a
     * pessoa costuma ter os dois. O ultimo digito pode ser `X`, que e o digito
     * verificador do padrao — tratar como numerico recusaria ORCID valido.
     */
    orcid: varchar('orcid', { length: 19 }),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('pessoa_nome_idx').on(t.nome),
    index('pessoa_ppg_idx').on(t.ppgId),
    // E-mail é opcional, mas quando existe não se repete. `uniqueIndex` do
    // Postgres já ignora NULL, então pessoas sem e-mail não colidem entre si.
    uniqueIndex('pessoa_email_uk').on(t.email),
    uniqueIndex('pessoa_cpf_uk').on(t.cpf),
    // ORCID identifica a pessoa: repetido, sao duas linhas para o mesmo
    // pesquisador — o mesmo motivo do indice de CPF.
    uniqueIndex('pessoa_orcid_uk').on(t.orcid),
    check(
      'pessoa_orcid_ck',
      sql`${t.orcid} is null or ${t.orcid} ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'`,
    ),
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
  substituidaPor: one(instituicao, {
    fields: [instituicao.substituidaPorId],
    references: [instituicao.id],
    relationName: 'instituicaoSubstituida',
  }),
  substituidas: many(instituicao, { relationName: 'instituicaoSubstituida' }),
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
