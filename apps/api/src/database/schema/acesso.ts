import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import {
  id,
  origemVinculoUsuarioEnum,
  tipoAlvoConcessaoEnum,
  tipoEscopoAcessoEnum,
  timestamps,
} from './comum';
import { pessoa, ppg } from './institucional';
import {
  areaTematica,
  ciclo,
  participacaoPpg,
  redeCoordenadora,
} from './programa';

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

/**
 * Concessao individual: **esta conta**, **esta acao**, **este alvo** (V1-011).
 *
 * E a tabela do modelo aprovado em 2026-09-15, que substitui "papel do Keycloak
 * decide o que pode, `escopo_acesso` decide sobre o que". Aqui as duas metades
 * vivem na mesma linha, porque e assim que a pergunta e feita de verdade:
 * ninguem precisa saber "quais PPGs esta conta enxerga", precisa saber "em
 * quais PPGs ela pode **lancar bolsa**" — e a resposta pode ser diferente da de
 * "em quais ela pode **consultar o plano**". Com as metades separadas, conceder
 * escrita num PPG obrigava a conceder leitura em todos os outros do mesmo
 * escopo, ou a fatiar a conta em duas.
 *
 * **A tabela legada continua de pe ate V1-021.** As duas coexistem de proposito:
 * apagar `escopo_acesso` agora deixaria o recorte de PPG que ja funciona sem
 * fonte, antes de a conversao nominal ter sido revisada. O resolver de V1-012 e
 * quem passa a ler daqui.
 *
 * ## Por que `permissao` e texto, e nao enum do banco
 *
 * O catalogo e codigo (`auth/autorizacao-v1/catalogo.ts`): nasce com 79 acoes e
 * ganha uma a cada rota nova. Como enum do Postgres, cada acao viraria uma
 * migration, e uma acao **retirada** ficaria para sempre — `ALTER TYPE` nao sabe
 * remover valor. O preco e o banco nao recusar um nome inventado; por isso a
 * fronteira valida com Zod contra o catalogo, o `check` abaixo recusa o que nem
 * parece uma permissao, e ha teste conferindo que toda permissao gravada existe
 * no catalogo.
 */
export const concessaoAcesso = pgTable(
  'concessao_acesso',
  {
    id: id(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => usuarioSistema.id, { onDelete: 'cascade' }),
    /** Chave do catalogo em codigo, ex.: `plano:create`. */
    permissao: varchar('permissao', { length: 60 }).notNull(),
    tipoAlvo: tipoAlvoConcessaoEnum('tipo_alvo').notNull(),
    /**
     * Colunas de alvo explicitas, pelo mesmo motivo de `escopo_acesso`: o par
     * generico `tipo`/`alvo_id` nao aceita chave estrangeira, e sem ela um
     * ciclo apagado deixaria concessao apontando para o nada — a pior forma de
     * uma regra de acesso falhar, porque nao falha, so para de recortar.
     */
    cicloId: uuid('ciclo_id').references(() => ciclo.id, {
      onDelete: 'cascade',
    }),
    ppgId: uuid('ppg_id').references(() => ppg.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id').references(() => redeCoordenadora.id, {
      onDelete: 'cascade',
    }),
    areaTematicaId: uuid('area_tematica_id').references(() => areaTematica.id, {
      onDelete: 'cascade',
    }),
    participacaoId: uuid('participacao_id').references(
      () => participacaoPpg.id,
      { onDelete: 'cascade' },
    ),
    /**
     * Modelo que sugeriu esta linha, quando veio de um.
     *
     * **E explicativo, nunca heranca.** Editar o modelo depois nao altera esta
     * concessao; o campo existe para a tela de revisao poder dizer "veio do
     * modelo Secretaria" e para a conversao de V1-011 marcar o que propos.
     */
    origem: varchar('origem', { length: 40 }),
    /** Obrigatoria: conceder acesso e ato administrativo que se justifica. */
    justificativa: text('justificativa').notNull(),
    /** `sub` de quem concedeu — nao e FK; o usuario vive no Keycloak. */
    concedidoPorId: varchar('concedido_por_id', { length: 200 }),
    concedidoEm: timestamp('concedido_em', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    ativo: boolean('ativo').notNull().default(true),
    revogadoEm: timestamp('revogado_em', { withTimezone: true }),
    revogadoPorId: varchar('revogado_por_id', { length: 200 }),
    ...timestamps,
  },
  (t) => [
    /**
     * Unicidade por **conta + acao + alvo**, e nao por conta + alvo: conceder
     * `plano:read` e `bolsa:create` no mesmo PPG sao duas linhas legitimas, e
     * um indice sem a permissao recusaria a segunda.
     *
     * O indice cobre linha inativa tambem: revogar e reconceder reativa a
     * mesma linha, como ja acontece em `escopo_acesso`. Quem quiser a historia
     * do vaivem le `registro_auditoria` — duplicar a linha para guarda-la
     * faria a consulta de acesso ter de escolher entre versoes.
     *
     * Sao seis indices parciais, um por tipo, porque `coalesce` sobre o enum
     * nao e IMMUTABLE e o Postgres recusa a expressao (mesma restricao de
     * `escopo_acesso`).
     */
    uniqueIndex('concessao_global_uk')
      .on(t.usuarioId, t.permissao)
      .where(sql`${t.tipoAlvo} = 'GLOBAL'`),
    uniqueIndex('concessao_ciclo_uk')
      .on(t.usuarioId, t.permissao, t.cicloId)
      .where(sql`${t.tipoAlvo} = 'CICLO'`),
    uniqueIndex('concessao_ppg_uk')
      .on(t.usuarioId, t.permissao, t.ppgId, t.cicloId)
      .where(sql`${t.tipoAlvo} = 'PPG'`),
    uniqueIndex('concessao_rede_uk')
      .on(t.usuarioId, t.permissao, t.redeId)
      .where(sql`${t.tipoAlvo} = 'REDE'`),
    uniqueIndex('concessao_tematica_uk')
      .on(t.usuarioId, t.permissao, t.areaTematicaId)
      .where(sql`${t.tipoAlvo} = 'TEMATICA'`),
    uniqueIndex('concessao_participacao_uk')
      .on(t.usuarioId, t.permissao, t.participacaoId)
      .where(sql`${t.tipoAlvo} = 'PARTICIPACAO'`),
    /** O resolver carrega as concessoes ativas de uma conta por requisicao. */
    index('concessao_usuario_idx').on(t.usuarioId, t.ativo),
    index('concessao_permissao_idx').on(t.permissao, t.ativo),
    /**
     * Cada tipo exige o seu alvo e **proibe os demais**. Sem a segunda metade,
     * uma linha `REDE` com `ppg_id` preenchido passaria no banco e o resolver
     * teria de decidir em runtime qual coluna vale — decisao que duas consultas
     * diferentes tomariam de formas diferentes.
     *
     * `PPG` exige ciclo junto: PPG sem ciclo concederia o planejamento de todos
     * os anos seguintes. `TEMATICA` e `PARTICIPACAO` nao repetem o ciclo porque
     * ja o alcancam pela estrutura (tematica -> rede -> ciclo), e uma segunda
     * fonte so criaria a chance de as duas discordarem.
     */
    check(
      'concessao_alvo_ck',
      sql`(${t.tipoAlvo} = 'GLOBAL' and ${t.cicloId} is null and ${t.ppgId} is null and ${t.redeId} is null and ${t.areaTematicaId} is null and ${t.participacaoId} is null)
       or (${t.tipoAlvo} = 'CICLO' and ${t.cicloId} is not null and ${t.ppgId} is null and ${t.redeId} is null and ${t.areaTematicaId} is null and ${t.participacaoId} is null)
       or (${t.tipoAlvo} = 'PPG' and ${t.ppgId} is not null and ${t.cicloId} is not null and ${t.redeId} is null and ${t.areaTematicaId} is null and ${t.participacaoId} is null)
       or (${t.tipoAlvo} = 'REDE' and ${t.redeId} is not null and ${t.cicloId} is null and ${t.ppgId} is null and ${t.areaTematicaId} is null and ${t.participacaoId} is null)
       or (${t.tipoAlvo} = 'TEMATICA' and ${t.areaTematicaId} is not null and ${t.cicloId} is null and ${t.ppgId} is null and ${t.redeId} is null and ${t.participacaoId} is null)
       or (${t.tipoAlvo} = 'PARTICIPACAO' and ${t.participacaoId} is not null and ${t.cicloId} is null and ${t.ppgId} is null and ${t.redeId} is null and ${t.areaTematicaId} is null)`,
    ),
    /**
     * Forma minima de uma permissao do catalogo (`dominio:acao`).
     *
     * Nao substitui a validacao contra o catalogo — nao ha como o banco
     * conhecer 79 nomes que mudam a cada tarefa —, mas impede que lixo ou um
     * fragmento de texto qualquer vire linha de autorizacao.
     */
    check('concessao_permissao_ck', sql`${t.permissao} ~ '^[a-z-]+:[a-z-]+$'`),
    /**
     * Concessao inativa tem que dizer **quando** deixou de valer. Sem isso, a
     * revogacao vira um booleano sem data e a auditoria perde o unico fato que
     * a linha ainda poderia contar sozinha.
     */
    check(
      'concessao_revogacao_ck',
      sql`${t.ativo} or ${t.revogadoEm} is not null`,
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
    concessoes: many(concessaoAcesso),
  }),
);

export const concessaoAcessoRelations = relations(
  concessaoAcesso,
  ({ one }) => ({
    usuario: one(usuarioSistema, {
      fields: [concessaoAcesso.usuarioId],
      references: [usuarioSistema.id],
    }),
    ciclo: one(ciclo, {
      fields: [concessaoAcesso.cicloId],
      references: [ciclo.id],
    }),
    ppg: one(ppg, { fields: [concessaoAcesso.ppgId], references: [ppg.id] }),
    rede: one(redeCoordenadora, {
      fields: [concessaoAcesso.redeId],
      references: [redeCoordenadora.id],
    }),
    areaTematica: one(areaTematica, {
      fields: [concessaoAcesso.areaTematicaId],
      references: [areaTematica.id],
    }),
    participacao: one(participacaoPpg, {
      fields: [concessaoAcesso.participacaoId],
      references: [participacaoPpg.id],
    }),
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
