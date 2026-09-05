import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  acaoDecisaoComiteEnum,
  categoriaAnexoEnum,
  id,
  momentoRequisitoEnum,
  origemRodadaAnaliseEnum,
  timestamps,
} from './comum';
import { ciclo } from './programa';
import { missaoComite } from './comite-gestor';
import { anexo } from './governanca';
import { pessoa } from './institucional';
import { tipoMissaoEnum } from './planejamento';

/**
 * Submissao, rodadas de analise e decisoes do Comite Gestor (CG-019).
 *
 * **Modelo B, homologado em 2026-09-05.** O colegiado delibera fora do sistema
 * — reuniao semanal, podendo haver semana sem reuniao — e um relator registra o
 * parecer identificando a data dessa deliberacao. O sistema **nao** simula
 * votacao: nao ha quorum, voto por membro nem desempate. Se um dia a UEA quiser
 * o modelo C, `decisao_comite` ja tem rodada e autoria, e a votacao entra como
 * tabela filha sem migrar nada do que ja foi decidido.
 *
 * A garantia central e negativa: **nenhuma decisao e apagada ou sobrescrita.**
 * Nao existe `UPDATE` de parecer nem `DELETE` de rodada no fluxo. Reenviar
 * cria rodada nova; reabrir cria rodada nova. O historico e a soma das linhas.
 */

/**
 * Uma passagem da missao pela analise do Comite.
 *
 * A rodada e a unidade do historico, e nao a decisao, porque existe rodada sem
 * decisao: a missao submetida e ainda nao analisada. Numerar a rodada (e nao
 * so ordenar por data) e o que permite a interface dizer "3a rodada" sem
 * recontar, e o que sobrevive a duas submissoes no mesmo instante.
 */
export const rodadaAnalise = pgTable(
  'rodada_analise',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    /** 1, 2, 3... dentro da missao. Nunca reaproveitado. */
    numero: integer('numero').notNull(),
    origem: origemRodadaAnaliseEnum('origem').notNull().default('SUBMISSAO'),
    /**
     * Justificativa da reabertura administrativa. Obrigatoria quando a rodada
     * nasce de reabertura, proibida quando nasce de submissao — a decisao
     * homologada exige justificar quem desfaz uma decisao ja tomada.
     */
    justificativa: text('justificativa'),
    /** `sub` do Keycloak: o nome muda, o identificador nao. */
    submetidoPorId: varchar('submetido_por_id', { length: 200 }),
    submetidoPor: varchar('submetido_por', { length: 200 }),
    /**
     * Quem submeteu, no cadastro local de pessoas.
     *
     * A decisao homologada e "somente o responsavel pela missao envia", mas
     * hoje o `sub` do Keycloak nao tem vinculo com `pessoa` (AGENTS.md §9).
     * A coluna existe para que a regra passe a ser verificavel no dia em que o
     * provisionamento existir, sem migracao de dados ja gravados.
     */
    submetidoPorPessoaId: uuid('submetido_por_pessoa_id').references(
      () => pessoa.id,
      { onDelete: 'set null' },
    ),
    submetidoEm: timestamp('submetido_em', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** Nulo enquanto a rodada aguarda decisao. E o que define a fila. */
    encerradaEm: timestamp('encerrada_em', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('rodada_analise_numero_uk').on(t.missaoId, t.numero),
    /**
     * No maximo uma rodada aberta por missao.
     *
     * Sem isto, dois cliques em "enviar para analise" produziriam duas rodadas
     * abertas e a missao apareceria duas vezes na fila do Comite — e nada
     * diria qual delas a decisao encerra. O indice parcial resolve no banco o
     * que uma checagem em aplicacao perde numa corrida.
     */
    uniqueIndex('rodada_analise_aberta_uk')
      .on(t.missaoId)
      .where(sql`${t.encerradaEm} is null`),
    index('rodada_analise_missao_idx').on(t.missaoId),
    index('rodada_analise_fila_idx')
      .on(t.submetidoEm)
      .where(sql`${t.encerradaEm} is null`),
    check('rodada_analise_numero_ck', sql`${t.numero} >= 1`),
    check(
      'rodada_analise_justificativa_ck',
      sql`(${t.origem} = 'REABERTURA') = (${t.justificativa} is not null)`,
    ),
    check(
      'rodada_analise_encerramento_ck',
      sql`${t.encerradaEm} is null or ${t.encerradaEm} >= ${t.submetidoEm}`,
    ),
  ],
);

/**
 * A decisao que encerra uma rodada.
 *
 * Uma rodada, uma decisao: a unicidade esta no banco. Duas decisoes na mesma
 * rodada seriam dois estados finais para o mesmo exame — o caso que a CG-039
 * cobre como concorrencia.
 */
export const decisaoComite = pgTable(
  'decisao_comite',
  {
    id: id(),
    rodadaId: uuid('rodada_id')
      .notNull()
      .references(() => rodadaAnalise.id, { onDelete: 'cascade' }),
    acao: acaoDecisaoComiteEnum('acao').notNull(),
    /**
     * Sempre obrigatorio, inclusive ao aprovar.
     *
     * Aprovacao sem parecer produziria historico que diz "aprovada" e nao diz
     * por que — e e justamente o registro que a auditoria institucional cobra.
     */
    parecer: text('parecer').notNull(),
    /**
     * Data da reuniao em que o colegiado deliberou (modelo B).
     *
     * **Informada, nunca derivada.** As reunioes sao semanais, mas ha semanas
     * sem reuniao: calcular a data a partir de um calendario registraria
     * deliberacao que nao aconteceu. O servico so verifica que a data e real e
     * nao esta no futuro.
     *
     * Nula em `SOLICITAR_AJUSTES`, que e devolucao do relator e nao decisao do
     * colegiado; o `check` exige a data nas duas decisoes terminais.
     */
    reuniaoData: date('reuniao_data'),
    observacoes: text('observacoes'),
    decididoPorId: varchar('decidido_por_id', { length: 200 }),
    decididoPor: varchar('decidido_por', { length: 200 }),
    decididoEm: timestamp('decidido_em', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('decisao_comite_rodada_uk').on(t.rodadaId),
    index('decisao_comite_acao_idx').on(t.acao, t.decididoEm),
    check('decisao_comite_parecer_ck', sql`length(btrim(${t.parecer})) >= 3`),
    check(
      'decisao_comite_reuniao_ck',
      sql`(${t.acao} in ('APROVAR', 'REPROVAR')) = (${t.reuniaoData} is not null)`,
    ),
  ],
);

/**
 * Os documentos que existiam e foram analisados naquela decisao (§19).
 *
 * Tabela de ligacao, nunca vinculo direto a missao: se a decisao apontasse para
 * "os anexos da missao", anexar um arquivo depois mudaria retroativamente o que
 * o Comite diz ter analisado. Ver `docs/modelo-documental.md` §3.
 *
 * `onDelete: 'restrict'` no anexo porque nao ha exclusao de documento no
 * dominio — so inativacao — e um parecer nao pode perder a referencia do que
 * examinou.
 */
export const decisaoDocumento = pgTable(
  'decisao_documento',
  {
    id: id(),
    decisaoId: uuid('decisao_id')
      .notNull()
      .references(() => decisaoComite.id, { onDelete: 'cascade' }),
    anexoId: uuid('anexo_id')
      .notNull()
      .references(() => anexo.id, { onDelete: 'restrict' }),
    /** Versao do anexo no momento da analise; o arquivo pode ser substituido. */
    versao: integer('versao').notNull().default(1),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('decisao_documento_uk').on(t.decisaoId, t.anexoId),
    index('decisao_documento_decisao_idx').on(t.decisaoId),
    index('decisao_documento_anexo_idx').on(t.anexoId),
  ],
);

/**
 * Requisitos documentais, **como dado e nao como codigo**.
 *
 * Decisao de 2026-09-05: projeto e justificativa sao obrigatorios hoje, mas a
 * lista nao pode ser fechada — "uma missao pode ser diferente da outra, e se
 * fecharmos o escopo pode ser que nao seja possivel adicionar uma nova missao
 * no futuro". Uma constante `['PROJETO', 'JUSTIFICATIVA']` no servico atenderia
 * o caso atual e bloquearia o primeiro tipo novo de missao, exigindo deploy
 * para um ajuste que e de regra institucional.
 *
 * `tipoMissao` nulo significa **todos os tipos**; uma linha com tipo preenchido
 * acrescenta exigencia so daquele tipo. `obrigatorio = false` registra requisito
 * recomendado, que a interface mostra sem bloquear a submissao.
 *
 * `momento = 'ENCERRAMENTO'` existe para a CG-058 e ainda nao e consultado por
 * ninguem: a coluna esta aqui porque o checklist de encerramento e a mesma
 * pergunta em outro instante, e criar uma segunda tabela depois duplicaria o
 * vocabulario.
 */
export const requisitoSubmissao = pgTable(
  'requisito_submissao',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    /** Nulo = vale para todo tipo de missao. */
    tipoMissao: tipoMissaoEnum('tipo_missao'),
    momento: momentoRequisitoEnum('momento').notNull().default('SUBMISSAO'),
    categoria: categoriaAnexoEnum('categoria').notNull(),
    obrigatorio: boolean('obrigatorio').notNull().default(true),
    descricao: varchar('descricao', { length: 300 }),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    /**
     * Dois indices parciais, e nao um `coalesce(tipo_missao::text, '*')`.
     *
     * Em Postgres dois NULL nao colidem, entao o indice ingenuo deixaria
     * cadastrar duas vezes a mesma exigencia "para todos os tipos". A saida
     * obvia — normalizar o nulo com `coalesce` — nao compila: o cast de enum
     * para texto nao e IMMUTABLE e o banco recusa a expressao no indice. Os
     * dois parciais cobrem exatamente os mesmos casos sem funcao nenhuma.
     */
    uniqueIndex('requisito_submissao_tipo_uk')
      .on(t.cicloId, t.momento, t.categoria, t.tipoMissao)
      .where(sql`${t.tipoMissao} is not null`),
    uniqueIndex('requisito_submissao_geral_uk')
      .on(t.cicloId, t.momento, t.categoria)
      .where(sql`${t.tipoMissao} is null`),
    index('requisito_submissao_consulta_idx').on(t.cicloId, t.momento, t.ativo),
  ],
);

// ---------------------------------------------------------------------------

export const rodadaAnaliseRelations = relations(
  rodadaAnalise,
  ({ one, many }) => ({
    missao: one(missaoComite, {
      fields: [rodadaAnalise.missaoId],
      references: [missaoComite.id],
    }),
    submetidoPorPessoa: one(pessoa, {
      fields: [rodadaAnalise.submetidoPorPessoaId],
      references: [pessoa.id],
    }),
    decisoes: many(decisaoComite),
  }),
);

export const decisaoComiteRelations = relations(
  decisaoComite,
  ({ one, many }) => ({
    rodada: one(rodadaAnalise, {
      fields: [decisaoComite.rodadaId],
      references: [rodadaAnalise.id],
    }),
    documentos: many(decisaoDocumento),
  }),
);

export const decisaoDocumentoRelations = relations(
  decisaoDocumento,
  ({ one }) => ({
    decisao: one(decisaoComite, {
      fields: [decisaoDocumento.decisaoId],
      references: [decisaoComite.id],
    }),
    anexo: one(anexo, {
      fields: [decisaoDocumento.anexoId],
      references: [anexo.id],
    }),
  }),
);

export const requisitoSubmissaoRelations = relations(
  requisitoSubmissao,
  ({ one }) => ({
    ciclo: one(ciclo, {
      fields: [requisitoSubmissao.cicloId],
      references: [ciclo.id],
    }),
  }),
);
