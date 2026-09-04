import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

import {
  categoriaAnexoEnum,
  entidadeAnexoEnum,
  escopoPendenciaEnum,
  id,
  nivelImpactoEnum,
  origemPendenciaEnum,
  statusPendenciaEnum,
  timestamps,
  visibilidadeAnexoEnum,
} from './comum';
import { ciclo } from './programa';

/**
 * Governança: pendências, anexos e trilha de auditoria.
 *
 * A auditoria não é enfeite: o problema que motivou o sistema inclui "não há
 * histórico" — quando a UFMG transformou sobras em Capacitação, a programação
 * anterior só sobreviveu porque alguém criou uma aba à mão.
 */

export const acaoAuditoriaEnum = pgEnum('acao_auditoria', [
  'CRIACAO',
  'EDICAO',
  'EXCLUSAO',
]);

export const pendencia = pgTable(
  'pendencia',
  {
    id: id(),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    escopoTipo: escopoPendenciaEnum('escopo_tipo').notNull().default('GERAL'),
    /**
     * Id da entidade do escopo. Sem FK: aponta para rede, temática ou PPG
     * conforme `escopoTipo`, e uma FK só valeria para uma das três.
     */
    escopoId: uuid('escopo_id'),
    escopoDescricao: varchar('escopo_descricao', { length: 200 }),
    assunto: varchar('assunto', { length: 240 }).notNull(),
    descricao: text('descricao').notNull(),
    impacto: text('impacto'),
    nivelImpacto: nivelImpactoEnum('nivel_impacto'),
    responsavelSugerido: varchar('responsavel_sugerido', { length: 200 }),
    prazoMomento: varchar('prazo_momento', { length: 200 }),
    status: statusPendenciaEnum('status').notNull().default('PENDENTE'),
    /** Pendência criada pelo sistema (divergência de saldo, catálogo sem match) não se apaga. */
    origem: origemPendenciaEnum('origem').notNull().default('MANUAL'),
    resolucao: text('resolucao'),
    resolvidaEm: timestamp('resolvida_em', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('pendencia_codigo_uk').on(t.cicloId, t.codigo),
    index('pendencia_status_idx').on(t.status),
    index('pendencia_escopo_idx').on(t.escopoTipo, t.escopoId),
  ],
);

/**
 * Documento anexado a qualquer entidade do dominio (CG-014/CG-051).
 *
 * Ver [docs/modelo-documental.md](../../../../../docs/modelo-documental.md)
 * para a decisao completa. O essencial:
 *
 * - `caminho` guarda uma **chave opaca**, nunca o nome enviado pelo usuario.
 *   Nome de arquivo vira caminho previsivel e vaza dado (nome de bolsista,
 *   numero de processo). Ela nunca sai para o browser;
 * - substituir cria **linha nova** apontando para a anterior por
 *   `substitui_id`; a anterior fica. O parecer do Comite cita documentos, e um
 *   arquivo sobrescrito faria o parecer citar algo que ninguem mais ve;
 * - nao ha exclusao, so `ativo = false`.
 */
export const anexo = pgTable(
  'anexo',
  {
    id: id(),
    /** Nome original, so para exibir e para o `Content-Disposition`. */
    nome: varchar('nome', { length: 300 }).notNull(),
    mimeType: varchar('mime_type', { length: 120 }).notNull(),
    tamanho: integer('tamanho').notNull(),
    /** Chave opaca no armazenamento. Nunca devolvida ao cliente. */
    caminho: varchar('caminho', { length: 500 }).notNull(),
    /** SHA-256 do conteudo: integridade e deteccao de duplicata exata. */
    hashSha256: char('hash_sha256', { length: 64 }),
    categoria: categoriaAnexoEnum('categoria').notNull().default('OUTRO'),
    visibilidade: visibilidadeAnexoEnum('visibilidade')
      .notNull()
      .default('INTERNA'),
    entidadeTipo: entidadeAnexoEnum('entidade_tipo').notNull(),
    entidadeId: uuid('entidade_id').notNull(),
    /** Versao dentro da cadeia de substituicoes; comeca em 1. */
    versao: integer('versao').notNull().default(1),
    substituiId: uuid('substitui_id').references((): AnyPgColumn => anexo.id),
    ativo: boolean('ativo').notNull().default(true),
    /** `sub` do Keycloak — nome muda, identificador nao. */
    enviadoPorId: varchar('enviado_por_id', { length: 200 }),
    enviadoPor: varchar('enviado_por', { length: 200 }),
    enviadoEm: timestamp('enviado_em', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /* Campos da galeria (secao 27); nulos fora dela. */
    legenda: varchar('legenda', { length: 300 }),
    dataEvidencia: date('data_evidencia'),
    localEvidencia: varchar('local_evidencia', { length: 240 }),
    ...timestamps,
  },
  (t) => [
    index('anexo_entidade_idx').on(t.entidadeTipo, t.entidadeId),
    index('anexo_categoria_idx').on(t.categoria),
    uniqueIndex('anexo_caminho_uk').on(t.caminho),
    check('anexo_versao_ck', sql`${t.versao} >= 1`),
    check('anexo_tamanho_ck', sql`${t.tamanho} > 0`),
  ],
);

export const registroAuditoria = pgTable(
  'registro_auditoria',
  {
    id: id(),
    entidadeTipo: varchar('entidade_tipo', { length: 80 }).notNull(),
    entidadeId: uuid('entidade_id').notNull(),
    acao: acaoAuditoriaEnum('acao').notNull(),
    campo: varchar('campo', { length: 120 }),
    valorAnterior: text('valor_anterior'),
    valorNovo: text('valor_novo'),
    /** `sub` do Keycloak; não é FK porque o usuário vive no provedor de identidade. */
    usuarioId: varchar('usuario_id', { length: 120 }),
    usuarioNome: varchar('usuario_nome', { length: 200 }),
    justificativa: text('justificativa'),
    ocorridoEm: timestamp('ocorrido_em', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Data de referência do fato, quando difere do momento do registro. */
    dataReferencia: date('data_referencia'),
  },
  (t) => [
    index('auditoria_entidade_idx').on(t.entidadeTipo, t.entidadeId),
    index('auditoria_ocorrido_idx').on(t.ocorridoEm),
  ],
);

export const pendenciaRelations = relations(pendencia, ({ one }) => ({
  ciclo: one(ciclo, { fields: [pendencia.cicloId], references: [ciclo.id] }),
}));
