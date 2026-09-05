import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  id,
  origemVinculoUsuarioEnum,
  tipoEscopoAcessoEnum,
  timestamps,
} from './comum';
import { pessoa, ppg } from './institucional';
import { redeCoordenadora } from './programa';

/**
 * Identidade e escopo de acesso.
 *
 * Ate aqui a identidade vivia so no token: o `sub` do Keycloak entrava, virava
 * papeis e permissoes, e nada ligava aquilo a uma pessoa do cadastro. Isso
 * bastava enquanto toda permissao era global — e deixou de bastar na primeira
 * regra que diz "**o seu** PPG", "**a sua** rede", "somente o responsavel pela
 * missao".
 *
 * A separacao entre as duas tabelas e proposital:
 *
 * - `usuario_sistema` responde **quem e** — liga `sub` a `pessoa`.
 * - `escopo_acesso` responde **sobre o que** — recorta PPG e rede.
 *
 * Papel continua respondendo **o que pode fazer**, e continua vindo do
 * Keycloak. Sao tres perguntas independentes, e misturar duas delas e o que
 * costuma produzir a matriz de acesso que ninguem consegue mais ler.
 */

/**
 * Uma conta do Keycloak ligada a uma pessoa do cadastro local.
 *
 * O vinculo e 1:1 nos dois sentidos: uma conta aponta para uma pessoa, e uma
 * pessoa tem no maximo uma conta. Duas contas para a mesma pessoa tornariam
 * ambiguo qualquer "as missoes em que sou responsavel".
 *
 * A pessoa nao ganhou uma coluna `keycloak_sub` porque a maioria das pessoas
 * cadastradas **nao** tem login — participantes de missao, coordenadores
 * historicos — e uma coluna quase sempre nula nao registra quando nem como o
 * vinculo aconteceu, que e o que a auditoria precisa saber.
 */
export const usuarioSistema = pgTable(
  'usuario_sistema',
  {
    id: id(),
    /** `sub` do Keycloak: estavel, ao contrario de username e e-mail. */
    sub: varchar('sub', { length: 200 }).notNull(),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id, { onDelete: 'restrict' }),
    /** Copias do token no momento do vinculo, so para leitura da auditoria. */
    username: varchar('username', { length: 200 }),
    email: varchar('email', { length: 240 }),
    origem: origemVinculoUsuarioEnum('origem').notNull(),
    vinculadoEm: timestamp('vinculado_em', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    /** `sub` de quem associou a mao; nulo quando o vinculo foi automatico. */
    vinculadoPorId: varchar('vinculado_por_id', { length: 200 }),
    ultimoAcessoEm: timestamp('ultimo_acesso_em', { withTimezone: true }),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('usuario_sistema_sub_uk').on(t.sub),
    uniqueIndex('usuario_sistema_pessoa_uk').on(t.pessoaId),
    index('usuario_sistema_email_idx').on(t.email),
  ],
);

/**
 * O recorte de dados que um usuario enxerga.
 *
 * As colunas de alvo sao **explicitas** (`ppg_id`, `rede_id`), e nao um par
 * `tipo`/`alvo_id` generico: o par generico nao aceita chave estrangeira, e sem
 * ela um PPG apagado deixaria escopo apontando para o nada — silenciosamente,
 * que e o pior jeito de uma regra de acesso falhar. O `check` amarra o tipo ao
 * alvo correspondente.
 *
 * Acumular escopos e o caso normal: quem coordena dois PPGs tem duas linhas.
 * `GLOBAL` dispensa alvo e vence os demais.
 */
export const escopoAcesso = pgTable(
  'escopo_acesso',
  {
    id: id(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarioSistema.id, { onDelete: 'cascade' }),
    tipo: tipoEscopoAcessoEnum('tipo').notNull(),
    ppgId: uuid('ppg_id').references(() => ppg.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id').references(() => redeCoordenadora.id, {
      onDelete: 'cascade',
    }),
    /** `sub` de quem concedeu — concessao de acesso sempre tem responsavel. */
    concedidoPorId: varchar('concedido_por_id', { length: 200 }),
    concedidoEm: timestamp('concedido_em', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ativo: boolean('ativo').notNull().default(true),
    ...timestamps,
  },
  (t) => [
    /**
     * Um escopo por alvo, e nao mais. `coalesce` resolveria os tres casos num
     * indice so, mas o cast de enum nao e IMMUTABLE e o Postgres recusa a
     * expressao — por isso sao tres indices parciais, um por tipo.
     */
    uniqueIndex('escopo_acesso_global_uk')
      .on(t.usuarioId)
      .where(sql`${t.tipo} = 'GLOBAL'`),
    uniqueIndex('escopo_acesso_ppg_uk')
      .on(t.usuarioId, t.ppgId)
      .where(sql`${t.tipo} = 'PPG'`),
    uniqueIndex('escopo_acesso_rede_uk')
      .on(t.usuarioId, t.redeId)
      .where(sql`${t.tipo} = 'REDE'`),
    index('escopo_acesso_usuario_idx').on(t.usuarioId, t.ativo),
    check(
      'escopo_acesso_alvo_ck',
      sql`(${t.tipo} = 'GLOBAL' and ${t.ppgId} is null and ${t.redeId} is null)
       or (${t.tipo} = 'PPG' and ${t.ppgId} is not null and ${t.redeId} is null)
       or (${t.tipo} = 'REDE' and ${t.redeId} is not null and ${t.ppgId} is null)`,
    ),
  ],
);

// ---------------------------------------------------------------------------

export const usuarioSistemaRelations = relations(
  usuarioSistema,
  ({ one, many }) => ({
    pessoa: one(pessoa, {
      fields: [usuarioSistema.pessoaId],
      references: [pessoa.id],
    }),
    escopos: many(escopoAcesso),
  }),
);

export const escopoAcessoRelations = relations(escopoAcesso, ({ one }) => ({
  usuario: one(usuarioSistema, {
    fields: [escopoAcesso.usuarioId],
    references: [usuarioSistema.id],
  }),
  ppg: one(ppg, { fields: [escopoAcesso.ppgId], references: [ppg.id] }),
  rede: one(redeCoordenadora, {
    fields: [escopoAcesso.redeId],
    references: [redeCoordenadora.id],
  }),
}));
