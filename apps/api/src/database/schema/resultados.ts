import { relations, sql } from 'drizzle-orm';
import {
  boolean,
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
  id,
  situacaoConvenioEnum,
  situacaoProdutoMissaoEnum,
  timestamps,
  tipoAcordoConvenioEnum,
  tipoProdutoMissaoEnum,
} from './comum';
import { missaoComite } from './comite-gestor';
import { instituicao, pessoa } from './institucional';
import { redeCoordenadora } from './programa';

/**
 * Resultados da missao: produtos e convenios (CG-056).
 *
 * **Dominio proprio, separado de `produto_bolsa`.** Sao duas cobrancas
 * diferentes sobre coisas diferentes: o produto de bolsa pertence ao
 * beneficiario e responde "o que rendeu esta concessao"; o produto da missao
 * pertence a instituicao e responde "o que rendeu esta viagem do Comite".
 * Reaproveitar a tabela obrigaria `bolsa_concedida_id` a ficar nulo na metade
 * das linhas e faria toda consulta de P03 filtrar por uma origem que ela nunca
 * precisou conhecer.
 *
 * **O convenio nao pertence a missao.** Um acordo assinado sobrevive a viagem
 * que o originou, aparece no historico do parceiro (CG-027) e continua vigente
 * ciclos depois. Por isso ele se ancora na `instituicao` e guarda a missao
 * apenas como **origem**, opcional: convenio anterior ao sistema, ou nascido
 * fora de missao, e caso legitimo e nao pode exigir uma missao inventada.
 */

/**
 * Acordo formal com a instituicao parceira.
 *
 * Os campos sao os de system-structl.md §4.8 mais o que a CG-056 pede
 * explicitamente — assinatura, vigencia, area, objetivo e situacao.
 *
 * Nao ha `pais_id`: o pais e da instituicao, e repeti-lo aqui criaria a chance
 * de os dois discordarem no dia em que a instituicao for conciliada (CG-025).
 */
export const convenio = pgTable(
  'convenio',
  {
    id: id(),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    /**
     * Missao que originou o acordo, quando houve uma.
     *
     * `set null` e nao `cascade`: apagar a missao nao pode apagar o convenio,
     * que e o registro institucional mais duradouro dos dois.
     */
    missaoOrigemId: uuid('missao_origem_id').references(() => missaoComite.id, {
      onDelete: 'set null',
    }),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    tipoAcordo: tipoAcordoConvenioEnum('tipo_acordo').notNull(),
    area: varchar('area', { length: 160 }),
    objetivo: text('objetivo'),
    situacao: situacaoConvenioEnum('situacao')
      .notNull()
      .default('EM_TRAMITACAO'),
    numeroProcesso: varchar('numero_processo', { length: 80 }),
    dataAssinatura: date('data_assinatura'),
    dataInicio: date('data_inicio'),
    /** Nulo = vigencia indeterminada, que existe e nao pode virar data falsa. */
    dataFim: date('data_fim'),
    observacoes: text('observacoes'),
    /**
     * Nao ha exclusao, so inativacao — mesma regra dos parceiros (CG-026): o
     * produto que aponta para o convenio perderia o vinculo historico.
     */
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index('convenio_instituicao_idx').on(t.instituicaoId),
    index('convenio_missao_origem_idx').on(t.missaoOrigemId),
    index('convenio_situacao_idx').on(t.situacao),
    check(
      'convenio_vigencia_ck',
      sql`${t.dataInicio} is null or ${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
    // Acordo em vigor sem data de assinatura seria vigencia sem ato que a
    // funde. Em tramitacao, sim: e exatamente o que ainda nao foi assinado.
    check(
      'convenio_assinatura_ck',
      sql`${t.situacao} <> 'VIGENTE' or ${t.dataAssinatura} is not null`,
    ),
  ],
);

/**
 * Redes da UEA servidas pelo acordo.
 *
 * N:N porque o mesmo convenio pode interessar as tres redes coordenadoras, e
 * uma coluna singular teria de ser substituida no primeiro acordo compartilhado
 * — foi o que aconteceu com `missao_rede`.
 */
export const convenioRede = pgTable(
  'convenio_rede',
  {
    id: id(),
    convenioId: uuid('convenio_id')
      .notNull()
      .references(() => convenio.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('convenio_rede_uk').on(t.convenioId, t.redeId),
    index('convenio_rede_convenio_idx').on(t.convenioId),
    index('convenio_rede_rede_idx').on(t.redeId),
  ],
);

/** Resultado concreto que a missao gerou. */
export const produtoMissao = pgTable(
  'produto_missao',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    tipo: tipoProdutoMissaoEnum('tipo').notNull(),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    descricao: text('descricao'),
    situacao: situacaoProdutoMissaoEnum('situacao')
      .notNull()
      .default('PREVISTO'),
    /** Ano de referencia do produto; nulo enquanto so ha previsao. */
    ano: integer('ano'),
    /** DOI, processo, link — o identificador externo que houver. */
    referencia: varchar('referencia', { length: 500 }),
    convenioId: uuid('convenio_id').references(() => convenio.id, {
      onDelete: 'restrict',
    }),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    index('produto_missao_missao_idx').on(t.missaoId),
    index('produto_missao_convenio_idx').on(t.convenioId),
    index('produto_missao_tipo_idx').on(t.tipo),
    check(
      'produto_missao_ano_ck',
      sql`${t.ano} is null or ${t.ano} between 2000 and 2100`,
    ),
    /**
     * Bicondicional, e nao duas regras soltas: produto do tipo `CONVENIO` sem
     * acordo apontado seria a afirmacao de que a missao rendeu um convenio que
     * nao existe, e acordo apontado por produto de outro tipo esconderia o
     * convenio do checklist de encerramento, que procura pelo tipo.
     */
    check(
      'produto_missao_convenio_ck',
      sql`(${t.tipo} = 'CONVENIO') = (${t.convenioId} is not null)`,
    ),
  ],
);

/**
 * Instituicoes envolvidas no produto.
 *
 * Aponta para o cadastro central, nunca para texto livre: e o que faz o produto
 * aparecer no historico do parceiro sem duplicar instituicao — criterio de
 * aceite da CG-056.
 */
export const produtoMissaoInstituicao = pgTable(
  'produto_missao_instituicao',
  {
    id: id(),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtoMissao.id, { onDelete: 'cascade' }),
    instituicaoId: uuid('instituicao_id')
      .notNull()
      .references(() => instituicao.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('produto_missao_instituicao_uk').on(
      t.produtoId,
      t.instituicaoId,
    ),
    index('produto_missao_instituicao_produto_idx').on(t.produtoId),
    index('produto_missao_instituicao_instituicao_idx').on(t.instituicaoId),
  ],
);

/** Redes da UEA a que o produto se atribui. */
export const produtoMissaoRede = pgTable(
  'produto_missao_rede',
  {
    id: id(),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtoMissao.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('produto_missao_rede_uk').on(t.produtoId, t.redeId),
    index('produto_missao_rede_produto_idx').on(t.produtoId),
    index('produto_missao_rede_rede_idx').on(t.redeId),
  ],
);

/**
 * Pessoas responsaveis pelo produto.
 *
 * Independe de `missao_participante`: quem responde por um convenio pode nao
 * ter viajado, e quem viajou pode nao responder por nada.
 */
export const produtoMissaoResponsavel = pgTable(
  'produto_missao_responsavel',
  {
    id: id(),
    produtoId: uuid('produto_id')
      .notNull()
      .references(() => produtoMissao.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    papel: varchar('papel', { length: 160 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('produto_missao_responsavel_uk').on(t.produtoId, t.pessoaId),
    index('produto_missao_responsavel_produto_idx').on(t.produtoId),
    index('produto_missao_responsavel_pessoa_idx').on(t.pessoaId),
  ],
);

export const convenioRelations = relations(convenio, ({ one, many }) => ({
  instituicao: one(instituicao, {
    fields: [convenio.instituicaoId],
    references: [instituicao.id],
  }),
  missaoOrigem: one(missaoComite, {
    fields: [convenio.missaoOrigemId],
    references: [missaoComite.id],
  }),
  redes: many(convenioRede),
  produtos: many(produtoMissao),
}));

export const convenioRedeRelations = relations(convenioRede, ({ one }) => ({
  convenio: one(convenio, {
    fields: [convenioRede.convenioId],
    references: [convenio.id],
  }),
  rede: one(redeCoordenadora, {
    fields: [convenioRede.redeId],
    references: [redeCoordenadora.id],
  }),
}));

export const produtoMissaoRelations = relations(
  produtoMissao,
  ({ one, many }) => ({
    missao: one(missaoComite, {
      fields: [produtoMissao.missaoId],
      references: [missaoComite.id],
    }),
    convenio: one(convenio, {
      fields: [produtoMissao.convenioId],
      references: [convenio.id],
    }),
    instituicoes: many(produtoMissaoInstituicao),
    redes: many(produtoMissaoRede),
    responsaveis: many(produtoMissaoResponsavel),
  }),
);

export const produtoMissaoInstituicaoRelations = relations(
  produtoMissaoInstituicao,
  ({ one }) => ({
    produto: one(produtoMissao, {
      fields: [produtoMissaoInstituicao.produtoId],
      references: [produtoMissao.id],
    }),
    instituicao: one(instituicao, {
      fields: [produtoMissaoInstituicao.instituicaoId],
      references: [instituicao.id],
    }),
  }),
);

export const produtoMissaoRedeRelations = relations(
  produtoMissaoRede,
  ({ one }) => ({
    produto: one(produtoMissao, {
      fields: [produtoMissaoRede.produtoId],
      references: [produtoMissao.id],
    }),
    rede: one(redeCoordenadora, {
      fields: [produtoMissaoRede.redeId],
      references: [redeCoordenadora.id],
    }),
  }),
);

export const produtoMissaoResponsavelRelations = relations(
  produtoMissaoResponsavel,
  ({ one }) => ({
    produto: one(produtoMissao, {
      fields: [produtoMissaoResponsavel.produtoId],
      references: [produtoMissao.id],
    }),
    pessoa: one(pessoa, {
      fields: [produtoMissaoResponsavel.pessoaId],
      references: [pessoa.id],
    }),
  }),
);
