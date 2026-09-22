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

import { statusBolsaConcedidaEnum, timestamps, id } from './comum';
import { bolsaConcedida } from './planejamento';

/**
 * Eventos externos do beneficiario (V1-036, contrato em
 * docs/eventos-externos-v1.md).
 *
 * O Gerenciador **nao decide** nada disto: desistencia, interrupcao,
 * falecimento e substituicao acontecem na plataforma da CAPES, e a tabela e o
 * livro-razao do que ja aconteceu la. A movimentacao de recurso (grupo A) fica
 * em `remanejamento`, que ja existia; este arquivo cuida so do grupo B.
 */

/**
 * Tipos de evento como **dado**, nao enum (contrato §7.1, a moda da CG-019).
 *
 * A PROPESP pode conhecer tipos que a especificacao nao nomeia — prorrogacao,
 * suspensao —, e um tipo novo nao deve exigir migration. Por isso o efeito
 * tambem e dado: `estados_origem` diz de onde o evento pode partir e
 * `estado_destino` para onde leva a bolsa. Destino nulo e evento que so
 * registra, sem mudar a situacao.
 *
 * `codigo` e a chave primaria de proposito: e o que viaja no payload e no
 * historico, e um UUID ali obrigaria a tela a traduzir o que o texto ja diz.
 */
export const tipoEventoBolsista = pgTable(
  'tipo_evento_bolsista',
  {
    codigo: varchar('codigo', { length: 40 }).primaryKey(),
    rotulo: varchar('rotulo', { length: 120 }).notNull(),
    descricao: text('descricao'),
    estadosOrigem: statusBolsaConcedidaEnum('estados_origem').array().notNull(),
    estadoDestino: statusBolsaConcedidaEnum('estado_destino'),
    /** A substituicao liga a bolsa que sai a que entra na mesma vaga. */
    aceitaSubstituta: boolean('aceita_substituta').notNull().default(false),
    aceitaPrevisaoRetorno: boolean('aceita_previsao_retorno')
      .notNull()
      .default(false),
    ativo: boolean('ativo').notNull().default(true),
    ordem: integer('ordem').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    check(
      'tipo_evento_bolsista_origem_ck',
      sql`cardinality(${t.estadosOrigem}) > 0`,
    ),
  ],
);

export const eventoBolsista = pgTable(
  'evento_bolsista',
  {
    id: id(),
    /** `restrict`: o evento e a memoria da bolsa, e nao some com ela. */
    bolsaConcedidaId: uuid('bolsa_concedida_id')
      .notNull()
      .references(() => bolsaConcedida.id, { onDelete: 'restrict' }),
    tipo: varchar('tipo', { length: 40 })
      .notNull()
      .references(() => tipoEventoBolsista.codigo, { onDelete: 'restrict' }),
    /**
     * Quando aconteceu **na CAPES** (contrato §7.2). A data do registro e
     * `criado_em`: as duas divergem em semanas, e uma coluna so erraria metade
     * das perguntas.
     */
    dataAto: date('data_ato').notNull(),
    justificativa: text('justificativa').notNull(),
    /** Numero do oficio, processo ou e-mail. O arquivo entra por `anexo`. */
    referenciaExterna: varchar('referencia_externa', { length: 200 }),
    previsaoRetorno: date('previsao_retorno'),
    /**
     * A bolsa que entra na vaga. Pode chegar depois do evento: enquanto a
     * bolsa que sai ocupa a vaga, a que entra nao consegue ser cadastrada.
     */
    bolsaSubstitutaId: uuid('bolsa_substituta_id').references(
      () => bolsaConcedida.id,
      { onDelete: 'restrict' },
    ),
    /**
     * O efeito aplicado, fotografado. E o que permite conferir, anos depois,
     * de onde a bolsa saiu — e desfazer o efeito numa correcao de tipo sem
     * adivinhar o estado anterior.
     */
    statusAnterior: statusBolsaConcedidaEnum('status_anterior').notNull(),
    statusPosterior: statusBolsaConcedidaEnum('status_posterior').notNull(),
    /**
     * Gerada por quem envia. O reenvio com a mesma chave devolve o registro
     * existente em vez de aplicar o efeito outra vez.
     */
    chaveIdempotencia: uuid('chave_idempotencia').notNull(),
    /** `sub` do Keycloak, como em `registro_auditoria`. */
    registradoPorId: varchar('registrado_por_id', { length: 120 }).notNull(),
    registradoPorNome: varchar('registrado_por_nome', { length: 200 }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('evento_bolsista_chave_uk').on(t.chaveIdempotencia),
    // Uma bolsa entra no lugar de outra uma vez so; duas substituicoes
    // apontando o mesmo substituto contariam a mesma vaga duas vezes.
    uniqueIndex('evento_bolsista_substituta_uk')
      .on(t.bolsaSubstitutaId)
      .where(sql`${t.bolsaSubstitutaId} is not null`),
    index('evento_bolsista_bolsa_idx').on(t.bolsaConcedidaId),
    check(
      'evento_bolsista_substituta_ck',
      sql`${t.bolsaSubstitutaId} is null
           or ${t.bolsaSubstitutaId} <> ${t.bolsaConcedidaId}`,
    ),
    check(
      'evento_bolsista_justificativa_ck',
      sql`length(trim(${t.justificativa})) > 0`,
    ),
  ],
);

export const eventoBolsistaRelations = relations(eventoBolsista, ({ one }) => ({
  bolsa: one(bolsaConcedida, {
    fields: [eventoBolsista.bolsaConcedidaId],
    references: [bolsaConcedida.id],
  }),
  tipoEvento: one(tipoEventoBolsista, {
    fields: [eventoBolsista.tipo],
    references: [tipoEventoBolsista.codigo],
  }),
}));
