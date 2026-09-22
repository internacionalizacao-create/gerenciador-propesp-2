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
  rubricaEnum,
  statusExecucaoEnum,
  statusRemanejamentoEnum,
  timestamps,
} from './comum';
import { modalidade } from './catalogo';
import { ppg } from './institucional';
import { bolsaConcedida } from './planejamento';
import { areaTematica, ciclo, redeCoordenadora } from './programa';

/**
 * Estrutura generica de execução financeira e movimentações.
 *
 * `valorLiquido = valorPago − valorCancelado` (RN-12). Não é coluna: é conta.
 * `valorEmpenhado` fica de fora do líquido de propósito — empenho é compromisso,
 * não desembolso —, mas alimenta o indicador de comprometido, que é o que diz
 * quanto do orçamento já não está livre. Ela nao e usada pelo CAPES Global:
 * nesse programa os pagamentos ocorrem diretamente na CAPES, sem caixa na UEA.
 */

export const lancamentoExecucao = pgTable(
  'lancamento_execucao',
  {
    id: id(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    data: date('data'),
    ano: integer('ano').notNull(),
    areaTematicaId: uuid('area_tematica_id').references(() => areaTematica.id),
    ppgId: uuid('ppg_id').references(() => ppg.id),
    rubrica: rubricaEnum('rubrica').notNull(),
    descricao: text('descricao'),
    documentoProcesso: varchar('documento_processo', { length: 160 }),
    valorEmpenhado: dinheiro('valor_empenhado').notNull().default('0'),
    valorPago: dinheiro('valor_pago').notNull().default('0'),
    valorCancelado: dinheiro('valor_cancelado').notNull().default('0'),
    status: statusExecucaoEnum('status').notNull().default('NAO_INICIADO'),
    bolsaConcedidaId: uuid('bolsa_concedida_id').references(
      () => bolsaConcedida.id,
    ),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('lancamento_execucao_codigo_uk').on(t.cicloId, t.codigo),
    index('lancamento_execucao_ano_idx').on(t.ano),
    index('lancamento_execucao_tematica_idx').on(t.areaTematicaId),
    index('lancamento_execucao_ppg_idx').on(t.ppgId),
    check(
      'lancamento_execucao_valores_ck',
      sql`${t.valorEmpenhado} >= 0 and ${t.valorPago} >= 0 and ${t.valorCancelado} >= 0`,
    ),
  ],
);

export const remanejamento = pgTable(
  'remanejamento',
  {
    id: id(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    data: date('data'),
    ano: integer('ano').notNull(),
    redeId: uuid('rede_id').references(() => redeCoordenadora.id),
    temaOrigemId: uuid('tema_origem_id').references(() => areaTematica.id),
    temaDestinoId: uuid('tema_destino_id').references(() => areaTematica.id),
    ppgOrigemId: uuid('ppg_origem_id').references(() => ppg.id),
    ppgDestinoId: uuid('ppg_destino_id').references(() => ppg.id),
    /**
     * Campos genericos para outros programas. No CAPES Global, a camada de
     * dominio deve exigir mesmo ano e mesma tematica e apenas registrar o ato
     * ja realizado na CAPES.
     */
    anoOrigem: integer('ano_origem'),
    anoDestino: integer('ano_destino'),
    rubrica: rubricaEnum('rubrica').notNull(),
    /** Quando a movimentacao e de bolsa: qual modalidade e quantas vagas. */
    modalidadeId: uuid('modalidade_id').references(() => modalidade.id),
    quantidade: integer('quantidade'),
    valor: dinheiro('valor').notNull(),
    justificativa: text('justificativa'),
    /**
     * Numero do oficio ou processo — a referencia externa do contrato V1-036.
     * O arquivo, quando houver, entra por `anexo` (`REMANEJAMENTO`).
     */
    documentoAutorizacao: varchar('documento_autorizacao', { length: 200 }),
    status: statusRemanejamentoEnum('status').notNull().default('PROPOSTO'),
    observacoes: text('observacoes'),
    /**
     * Registro do ato externo (V1-036). Nulos so nas linhas de outros
     * programas; no CAPES Global o servico sempre os preenche.
     */
    chaveIdempotencia: uuid('chave_idempotencia'),
    registradoPorId: varchar('registrado_por_id', { length: 120 }),
    registradoPorNome: varchar('registrado_por_nome', { length: 200 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('remanejamento_codigo_uk').on(t.cicloId, t.codigo),
    index('remanejamento_ano_idx').on(t.ano),
    index('remanejamento_status_idx').on(t.status),
    check('remanejamento_valor_ck', sql`${t.valor} > 0`),
    check(
      'remanejamento_quantidade_ck',
      sql`${t.quantidade} is null or ${t.quantidade} > 0`,
    ),
    uniqueIndex('remanejamento_chave_uk').on(t.chaveIdempotencia),
    /**
     * `remanejamento_autorizacao_ck` saiu na V1-036. Exigia numero de oficio
     * para todo registro fora de PROPOSTO, e no CAPES Global a referencia e
     * opcional (contrato §7.4): travar o registro enquanto o oficio nao chega
     * faria o fato nunca ser registrado.
     */
  ],
);

export const lancamentoExecucaoRelations = relations(
  lancamentoExecucao,
  ({ one }) => ({
    ciclo: one(ciclo, {
      fields: [lancamentoExecucao.cicloId],
      references: [ciclo.id],
    }),
    areaTematica: one(areaTematica, {
      fields: [lancamentoExecucao.areaTematicaId],
      references: [areaTematica.id],
    }),
    ppg: one(ppg, { fields: [lancamentoExecucao.ppgId], references: [ppg.id] }),
    bolsaConcedida: one(bolsaConcedida, {
      fields: [lancamentoExecucao.bolsaConcedidaId],
      references: [bolsaConcedida.id],
    }),
  }),
);

export const remanejamentoRelations = relations(remanejamento, ({ one }) => ({
  ciclo: one(ciclo, {
    fields: [remanejamento.cicloId],
    references: [ciclo.id],
  }),
  rede: one(redeCoordenadora, {
    fields: [remanejamento.redeId],
    references: [redeCoordenadora.id],
  }),
}));
