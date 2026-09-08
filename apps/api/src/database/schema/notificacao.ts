import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { id, timestamps } from './comum';
import { missaoComite } from './comite-gestor';
import { pessoa } from './institucional';

/**
 * Notificacoes (D-11, decidido em 2026-09-07).
 *
 * **Outbox duravel mais caixa de entrada no sistema.** E-mail fica fora
 * enquanto nao houver servidor SMTP; havera, e o ponto de insercao ja esta
 * aqui.
 *
 * A razao de existir um outbox, e nao um envio direto: um aviso disparado
 * dentro da transacao cria um dilema sem saida boa. Se ele falha e a transacao
 * aborta, o Comite aprovou uma missao e o sistema esqueceu — por causa do canal
 * de aviso. Se ele falha e o erro e ignorado, alguem foi aprovado e nunca
 * soube. Gravando a notificacao **na mesma transacao** do fato, a decisao nunca
 * depende do canal, e a entrega vira um passo separado que pode ser tentado de
 * novo.
 */

/** O que aconteceu. Um valor por fato que o responsavel decidiu notificar. */
export const tipoNotificacaoEnum = pgEnum('tipo_notificacao', [
  /** Missao enviada para analise: avisa quem decide que ha coisa na fila. */
  'MISSAO_SUBMETIDA',
  /** Aprovada, devolvida para ajustes ou reprovada. */
  'DECISAO_COMITE',
  /** Analise reaberta por ato administrativo. */
  'ANALISE_REABERTA',
  'PRESTACAO_DEVOLVIDA',
  'PRESTACAO_VALIDADA',
  /** Viagem encerrada e prestacao nao iniciada; ver `notificacao_unica_uk`. */
  'PRESTACAO_PENDENTE',
]);

/**
 * Estado da entrega por canal externo.
 *
 * `NAO_APLICAVEL` e o estado de hoje: nao ha canal configurado, entao nao ha
 * entrega pendente. **Isso nao e detalhe.** Se as notificacoes nascessem
 * `PENDENTE` sem canal, o dia em que o SMTP entrasse despejaria meses de aviso
 * atrasado na caixa de todo mundo — e o primeiro contato da instituicao com o
 * e-mail do sistema seria uma enxurrada.
 */
export const estadoEntregaEnum = pgEnum('estado_entrega_notificacao', [
  'NAO_APLICAVEL',
  'PENDENTE',
  'ENTREGUE',
  'FALHOU',
]);

export const notificacao = pgTable(
  'notificacao',
  {
    id: id(),
    tipo: tipoNotificacaoEnum('tipo').notNull(),
    /**
     * Quem deve ler. Pessoa, e nao usuario do sistema: o destinatario pode
     * ainda nao ter conta, e a notificacao precisa esperar por ele em vez de
     * se perder.
     */
    destinatarioId: uuid('destinatario_id')
      .notNull()
      .references(() => pessoa.id),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    titulo: varchar('titulo', { length: 240 }).notNull(),
    corpo: text('corpo').notNull(),
    /**
     * Quem causou o fato, quando houve alguem.
     *
     * Nulo na `PRESTACAO_PENDENTE`, que decorre do calendario e nao de uma
     * acao — e dizer "gerada pelo sistema" e mais honesto que atribui-la a
     * quem por acaso abriu a caixa de entrada primeiro.
     */
    origemPor: varchar('origem_por', { length: 200 }),
    lidaEm: timestamp('lida_em', { withTimezone: true }),
    entregaEstado: estadoEntregaEnum('entrega_estado')
      .notNull()
      .default('NAO_APLICAVEL'),
    entregaTentativas: integer('entrega_tentativas').notNull().default(0),
    /** Ultimo erro do canal; guardado para diagnostico, nunca apagado. */
    entregaUltimoErro: text('entrega_ultimo_erro'),
    entregueEm: timestamp('entregue_em', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    index('notificacao_destinatario_idx').on(t.destinatarioId, t.lidaEm),
    index('notificacao_missao_idx').on(t.missaoId),
    index('notificacao_entrega_idx')
      .on(t.entregaEstado)
      .where(sql`${t.entregaEstado} = 'PENDENTE'`),
    /**
     * **Uma pendencia de prestacao por missao e destinatario.**
     *
     * `PRESTACAO_PENDENTE` nao nasce de uma acao: e decorrencia do calendario,
     * e quem a percebe e a varredura idempotente que roda ao abrir a caixa de
     * entrada. Sem esta unicidade cada abertura criaria uma copia, e a caixa
     * viraria ruido — o oposto do que a notificacao serve para fazer.
     *
     * Parcial, porque os outros tipos **devem** repetir: duas decisoes sobre a
     * mesma missao sao dois avisos.
     */
    uniqueIndex('notificacao_pendencia_uk')
      .on(t.missaoId, t.destinatarioId, t.tipo)
      .where(sql`${t.tipo} = 'PRESTACAO_PENDENTE'`),
    check(
      'notificacao_entrega_ck',
      sql`(${t.entregaEstado} = 'ENTREGUE') = (${t.entregueEm} is not null)`,
    ),
  ],
);

export const notificacaoRelations = relations(notificacao, ({ one }) => ({
  destinatario: one(pessoa, {
    fields: [notificacao.destinatarioId],
    references: [pessoa.id],
  }),
  missao: one(missaoComite, {
    fields: [notificacao.missaoId],
    references: [missaoComite.id],
  }),
}));
