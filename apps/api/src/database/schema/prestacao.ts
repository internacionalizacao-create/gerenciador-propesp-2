import { relations } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import {
  dinheiro,
  id,
  statusPrestacaoMissaoEnum,
  tipoDespesaMissaoEnum,
  timestamps,
} from './comum';
import { missaoComite, missaoParticipante } from './comite-gestor';
import { pais } from './institucional';

/**
 * Prestação de contas da missão (CG-013).
 *
 * Este é o orçamento **do Comitê Gestor** — R$ 381.333,00/ano para missões e
 * articulação institucional —, não o de bolsas. Não confunda com a P11: no
 * CAPES Global não há execução financeira de bolsa na UEA, porque a CAPES paga
 * direto. A missão do Comitê, essa sim, gasta e presta contas.
 *
 * **Tudo em reais (CG-009).** A equipe de orçamento decidiu que o sistema
 * trabalha só em BRL: não há moeda de origem, cotação nem valor convertido. A
 * conversão de uma despesa feita no exterior acontece antes do lançamento, e é
 * o valor em real que se registra. Por isso `dinheiro()` basta e não existe
 * coluna de câmbio — acrescentá-la depois seria mudança de contrato, não ajuste.
 *
 * O que este módulo **não** faz: reduzir o saldo do aporte. A regra homologada
 * é que **prestação `VALIDADA` abate o aporte anual do Comitê Gestor**, e essa
 * integração é a CG-055 — aqui é só o registro. Enquanto a prestação não for
 * validada, nada do que está lançado toca o orçamento oficial.
 */

/**
 * No máximo uma prestação por missão, e ela pode simplesmente não existir.
 *
 * `NAO_INICIADA` **não** é um valor deste enum: é a ausência da linha. Guardar
 * "não iniciada" como estado obrigaria a criar uma prestação vazia para toda
 * missão cadastrada, e a lista de missões teria de distinguir a vazia da que
 * ninguém começou — que é a mesma coisa dita duas vezes. A API já deriva
 * `NAO_INICIADA` de `left join` sem linha.
 */
export const prestacaoContasMissao = pgTable(
  'prestacao_contas_missao',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    status: statusPrestacaoMissaoEnum('status')
      .notNull()
      .default('EM_PREENCHIMENTO'),
    enviadaEm: date('enviada_em'),
    enviadaPor: varchar('enviada_por', { length: 200 }),
    validadaEm: date('validada_em'),
    validadaPor: varchar('validada_por', { length: 200 }),
    /** Parecer de quem validou ou devolveu com pendência. */
    parecer: text('parecer'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('prestacao_missao_uk').on(t.missaoId),
    index('prestacao_status_idx').on(t.status),
    // Estado e evidência andam juntos: não existe prestação "enviada" sem data
    // de envio, nem "validada" sem data de validação. Sem isto, um update
    // parcial deixaria o histórico contando uma coisa e o estado outra.
    check(
      'prestacao_envio_ck',
      sql`${t.status} = 'EM_PREENCHIMENTO' or ${t.enviadaEm} is not null`,
    ),
    check(
      'prestacao_validacao_ck',
      sql`${t.status} <> 'VALIDADA' or ${t.validadaEm} is not null`,
    ),
  ],
);

/**
 * Despesa da prestação.
 *
 * Os campos comuns ficam aqui e as especializações em tabelas próprias, para
 * não virar uma tabela larga em que cada linha usa um terço das colunas e o
 * resto é nulo. `quantidade` e `valorUnitario` são genéricos de propósito:
 * servem tanto para "3 diárias × R$ 400" quanto para "1 passagem × R$ 4.200",
 * e por isso a diária não repete quantidade na sua tabela.
 *
 * A **estimativa** apresentada antes da aprovação não entra aqui. Ela pertence
 * ao fluxo de aprovação e, se confirmada, continua sendo outra coisa: misturar
 * as duas faria o total da prestação contar dinheiro que ninguém gastou.
 */
export const despesaMissao = pgTable(
  'despesa_missao',
  {
    id: id(),
    prestacaoId: uuid('prestacao_id')
      .notNull()
      .references(() => prestacaoContasMissao.id, { onDelete: 'cascade' }),
    tipo: tipoDespesaMissaoEnum('tipo').notNull(),
    /**
     * A quem a despesa se refere. `restrict` porque remover um participante que
     * já tem despesa lançada apagaria dinheiro prestado; a remoção tem de
     * passar pela despesa primeiro.
     */
    participanteId: uuid('participante_id').references(
      () => missaoParticipante.id,
      { onDelete: 'restrict' },
    ),
    /** Exercício é obrigatório: a prestação é sempre imputada a um ano. */
    exercicio: integer('exercicio').notNull(),
    quantidade: numeric('quantidade', { precision: 10, scale: 2 }),
    valorUnitario: dinheiro('valor_unitario'),
    /**
     * Valor efetivo da despesa. É o autoritativo — não o produto — porque nota
     * fiscal arredonda e taxa entra fora da multiplicação. O `check` abaixo
     * exige coerência quando os três existem.
     */
    valorTotal: dinheiro('valor_total').notNull(),
    dataDocumento: date('data_documento'),
    descricao: varchar('descricao', { length: 300 }).notNull(),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    index('despesa_prestacao_idx').on(t.prestacaoId),
    index('despesa_exercicio_idx').on(t.exercicio, t.tipo),
    index('despesa_participante_idx').on(t.participanteId),
    check('despesa_valor_total_ck', sql`${t.valorTotal} >= 0`),
    check(
      'despesa_valor_unitario_ck',
      sql`${t.valorUnitario} is null or ${t.valorUnitario} >= 0`,
    ),
    check(
      'despesa_quantidade_ck',
      sql`${t.quantidade} is null or ${t.quantidade} >= 0`,
    ),
    // Coerência só é exigida quando quantidade e unitário existem; despesa
    // avulsa informa apenas o total, e isso continua válido.
    check(
      'despesa_produto_ck',
      sql`${t.quantidade} is null or ${t.valorUnitario} is null
          or round(${t.quantidade} * ${t.valorUnitario}, 2) = ${t.valorTotal}`,
    ),
    check(
      'despesa_exercicio_valido_ck',
      sql`${t.exercicio} between 2000 and 2100`,
    ),
  ],
);

/**
 * Dados de passagem. Chave primária é o próprio `despesa_id`: a relação é 1:1
 * e uma chave própria só criaria um segundo jeito de endereçar a mesma linha.
 */
export const despesaPassagem = pgTable('despesa_passagem', {
  despesaId: uuid('despesa_id')
    .primaryKey()
    .references(() => despesaMissao.id, { onDelete: 'cascade' }),
  empresa: varchar('empresa', { length: 200 }),
  /**
   * Origem e destino separados, e nao um "trecho" em texto livre (secao 21 do
   * documento da equipe). Trecho unico obrigaria a interpretar string para
   * responder "quanto foi gasto por pais", que e pergunta do dashboard.
   */
  origem: varchar('origem', { length: 200 }),
  destino: varchar('destino', { length: 200 }),
  numeroVoo: varchar('numero_voo', { length: 40 }),
  /** Data do voo — diferente da data da compra, que costuma ser bem anterior. */
  dataVoo: date('data_voo'),
  compradaEm: date('comprada_em'),
  formaPagamento: varchar('forma_pagamento', { length: 120 }),
  ...timestamps,
});

/**
 * Cotações que embasaram a escolha da passagem — várias por despesa.
 *
 * O documento da cotação não vira coluna de arquivo aqui: anexo é a tabela
 * genérica `anexo`, endereçada por `entidade_tipo`/`entidade_id`. O modelo
 * documental definitivo (categoria, hash, versão) é a CG-014, e antecipá-lo
 * agora seria inventar decisão não homologada.
 */
export const cotacaoPassagem = pgTable(
  'cotacao_passagem',
  {
    id: id(),
    despesaId: uuid('despesa_id')
      .notNull()
      .references(() => despesaPassagem.despesaId, { onDelete: 'cascade' }),
    empresa: varchar('empresa', { length: 200 }).notNull(),
    valor: dinheiro('valor').notNull(),
    obtidaEm: date('obtida_em'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    index('cotacao_despesa_idx').on(t.despesaId),
    check('cotacao_valor_ck', sql`${t.valor} >= 0`),
  ],
);

/**
 * Dados de diária.
 *
 * Beneficiário e quantidade **não** se repetem aqui: o beneficiário é o
 * `participante_id` da despesa e a quantidade é a `quantidade` dela. Duplicar
 * criaria dois campos concorrentes para o mesmo fato — o erro que a CG-018 já
 * evitou em missão, atividade e participante.
 */
export const despesaDiaria = pgTable(
  'despesa_diaria',
  {
    despesaId: uuid('despesa_id')
      .primaryKey()
      .references(() => despesaMissao.id, { onDelete: 'cascade' }),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    paisId: uuid('pais_id').references(() => pais.id),
    cidade: varchar('cidade', { length: 120 }),
    ...timestamps,
  },
  (t) => [check('diaria_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`)],
);

export const prestacaoContasMissaoRelations = relations(
  prestacaoContasMissao,
  ({ one, many }) => ({
    missao: one(missaoComite, {
      fields: [prestacaoContasMissao.missaoId],
      references: [missaoComite.id],
    }),
    despesas: many(despesaMissao),
  }),
);

export const despesaMissaoRelations = relations(
  despesaMissao,
  ({ one, many }) => ({
    prestacao: one(prestacaoContasMissao, {
      fields: [despesaMissao.prestacaoId],
      references: [prestacaoContasMissao.id],
    }),
    participante: one(missaoParticipante, {
      fields: [despesaMissao.participanteId],
      references: [missaoParticipante.id],
    }),
    passagem: one(despesaPassagem),
    diaria: one(despesaDiaria),
    cotacoes: many(cotacaoPassagem),
  }),
);

export const despesaPassagemRelations = relations(
  despesaPassagem,
  ({ one, many }) => ({
    despesa: one(despesaMissao, {
      fields: [despesaPassagem.despesaId],
      references: [despesaMissao.id],
    }),
    cotacoes: many(cotacaoPassagem),
  }),
);

export const cotacaoPassagemRelations = relations(
  cotacaoPassagem,
  ({ one }) => ({
    passagem: one(despesaPassagem, {
      fields: [cotacaoPassagem.despesaId],
      references: [despesaPassagem.despesaId],
    }),
  }),
);

export const despesaDiariaRelations = relations(despesaDiaria, ({ one }) => ({
  despesa: one(despesaMissao, {
    fields: [despesaDiaria.despesaId],
    references: [despesaMissao.id],
  }),
}));
