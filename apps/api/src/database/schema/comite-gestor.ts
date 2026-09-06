import { relations, sql } from 'drizzle-orm';
import {
  boolean,
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
} from 'drizzle-orm/pg-core';

import {
  avaliacaoObjetivosEnum,
  id,
  statusAprovacaoMissaoEnum,
  timestamps,
} from './comum';
import { instituicao, pais, pessoa } from './institucional';
import { contatoInstituicao } from './parceiros';
import { tipoMissaoEnum } from './planejamento';
import { ciclo, redeCoordenadora } from './programa';

/** Equipes operacionais vinculadas ao orcamento paralelo do Comite Gestor. */
export const tipoEquipeGestaoEnum = pgEnum('tipo_equipe_gestao', [
  'COMITE_GESTOR',
  'ADMINISTRACAO',
]);

export const papelMissaoEnum = pgEnum('papel_missao', [
  'RESPONSAVEL',
  'PARTICIPANTE',
  'APOIO',
]);

export const statusMissaoComiteEnum = pgEnum('status_missao_comite', [
  'RASCUNHO',
  'PLANEJADA',
  'CONFIRMADA',
  'CONCLUIDA',
  'CANCELADA',
]);

export const statusAtividadeMissaoEnum = pgEnum('status_atividade_missao', [
  'PLANEJADA',
  'REALIZADA',
  'NAO_REALIZADA',
]);

export const tipoRelacionamentoMissaoEnum = pgEnum(
  'tipo_relacionamento_missao',
  [
    'REUNIAO_INSTITUCIONAL',
    'COOPERACAO_ACADEMICA',
    'PESQUISA',
    'MOBILIDADE',
    'CONVENIO',
    'PROJETO',
    'EVENTO',
    'VISITA_TECNICA',
    'OUTRO',
  ],
);

export const membroEquipeGestao = pgTable(
  'membro_equipe_gestao',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    tipoEquipe: tipoEquipeGestaoEnum('tipo_equipe').notNull(),
    funcao: varchar('funcao', { length: 160 }).notNull(),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('membro_equipe_gestao_inicio_uk').on(
      t.cicloId,
      t.pessoaId,
      t.tipoEquipe,
      t.dataInicio,
    ),
    // So pode haver um vinculo sem encerramento por pessoa/equipe. Periodos
    // historicos adicionais sao validados contra sobreposicao no servico.
    uniqueIndex('membro_equipe_gestao_ativo_uk')
      .on(t.cicloId, t.pessoaId, t.tipoEquipe)
      .where(sql`${t.dataFim} is null`),
    index('membro_equipe_gestao_ciclo_idx').on(t.cicloId),
    index('membro_equipe_gestao_pessoa_idx').on(t.pessoaId),
    check(
      'membro_equipe_gestao_periodo_ck',
      sql`${t.dataFim} is null or ${t.dataFim} >= ${t.dataInicio}`,
    ),
  ],
);

/** Redes cujos documentos formais fundamentam o vinculo da pessoa. */
export const membroEquipeGestaoRede = pgTable(
  'membro_equipe_gestao_rede',
  {
    id: id(),
    membroEquipeId: uuid('membro_equipe_id')
      .notNull()
      .references(() => membroEquipeGestao.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'cascade' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('membro_equipe_gestao_rede_uk').on(t.membroEquipeId, t.redeId),
    index('membro_equipe_gestao_rede_membro_idx').on(t.membroEquipeId),
    index('membro_equipe_gestao_rede_rede_idx').on(t.redeId),
  ],
);

/** Viagem institucional do Comite Gestor, independente do plano de aplicacao. */
export const missaoComite = pgTable(
  'missao_comite',
  {
    id: id(),
    cicloId: uuid('ciclo_id')
      .notNull()
      .references(() => ciclo.id, { onDelete: 'cascade' }),
    codigo: varchar('codigo', { length: 20 }).notNull(),
    /** Tipo geral; o roteiro pode conter atividades de tipos diferentes. */
    tipo: tipoMissaoEnum('tipo'),
    unidadeDepartamento: varchar('unidade_departamento', { length: 240 }),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    objetivo: text('objetivo').notNull(),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    status: statusMissaoComiteEnum('status').notNull().default('RASCUNHO'),
    /**
     * Dimensao de aprovacao (CG-019), independente de `status`.
     *
     * Nao foi acrescentado valor a `status_missao_comite` porque as duas
     * dimensoes se cruzam: a missao aprovada pode estar planejada, confirmada
     * ou concluida, e uma coluna unica precisaria de um valor novo para cada
     * combinacao. O derivado fica fora do banco — quem decide o que a tela
     * mostra e o servico, lendo as duas.
     */
    statusAprovacao: statusAprovacaoMissaoEnum('status_aprovacao')
      .notNull()
      .default('RASCUNHO'),
    relatoGeral: text('relato_geral'),
    resultados: text('resultados'),
    /**
     * Declaracao de que a missao **nao** gerou produto (CG-056).
     *
     * Nao existe coluna `gerou_produto`. A resposta afirmativa ja e um fato
     * consultavel — ha linha em `produto_missao` —, e um booleano ao lado dela
     * so poderia divergir no dia em que alguem apagasse o ultimo produto. E
     * exatamente o que a CG-058 proibe: "nao persistir booleanos que apenas
     * duplicam existencia de outros registros".
     *
     * A resposta negativa, essa sim, nao e derivavel: zero produto significa
     * tanto "nao gerou" quanto "ninguem respondeu ainda", e o checklist de
     * encerramento precisa distinguir as duas. Por isso so ela e gravada, com
     * autor e momento.
     */
    semProdutoDeclaradoEm: timestamp('sem_produto_declarado_em', {
      withTimezone: true,
    }),
    semProdutoDeclaradoPor: varchar('sem_produto_declarado_por', {
      length: 200,
    }),
    semProdutoJustificativa: text('sem_produto_justificativa'),
    /**
     * Avaliacao do alcance dos objetivos (CG-058).
     *
     * Fica na missao, e nao numa tabela de relatorio: e resposta unica por
     * missao, e uma tabela 1:1 so criaria um segundo lugar para procura-la.
     * Nula significa "ninguem respondeu" — e o checklist de encerramento exige
     * a resposta.
     */
    avaliacaoObjetivos: avaliacaoObjetivosEnum('avaliacao_objetivos'),
    avaliacaoJustificativa: text('avaliacao_justificativa'),
    /** O que a missao desdobra depois de encerrada: acordos, visitas, projetos. */
    desdobramentos: text('desdobramentos'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_comite_codigo_uk').on(t.cicloId, t.codigo),
    index('missao_comite_ciclo_status_idx').on(t.cicloId, t.status),
    index('missao_comite_periodo_idx').on(t.dataInicio, t.dataFim),
    check('missao_comite_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`),
    // Declaracao sem autor nao e declaracao, e justificativa sem declaracao e
    // texto orfao que a tela mostraria como se alguem tivesse respondido.
    check(
      'missao_comite_sem_produto_ck',
      sql`(${t.semProdutoDeclaradoEm} is null) = (${t.semProdutoDeclaradoPor} is null)
       and (${t.semProdutoDeclaradoEm} is not null or ${t.semProdutoJustificativa} is null)`,
    ),
    /**
     * Justificativa e obrigatoria quando o objetivo nao foi plenamente
     * alcancado, e proibida sem avaliacao nenhuma.
     *
     * A assimetria e proposital: "atingiu" nao precisa explicacao, "nao
     * atingiu" precisa — sem isso o relatorio final registra um insucesso sem
     * dizer por que. E texto sem resposta seria justificativa de coisa nenhuma.
     */
    check(
      'missao_comite_avaliacao_ck',
      sql`(${t.avaliacaoObjetivos} is not null
            or ${t.avaliacaoJustificativa} is null)
       and (${t.avaliacaoObjetivos} is null
            or ${t.avaliacaoObjetivos} = 'SIM'
            or ${t.avaliacaoJustificativa} is not null)`,
    ),
  ],
);

/**
 * Dispensa de um requisito de encerramento, para uma missao especifica
 * (CG-058).
 *
 * Decisao do responsavel em 2026-09-06: dispensam `admin` e o Comite, e a
 * dispensa vale **so para a missao apontada** — nunca para um tipo inteiro.
 * Dispensa por tipo seria mudanca de politica disfarcada de excecao: mudaria o
 * que se exige de toda missao futura sem passar por `requisito_submissao`, que
 * e onde a politica mora.
 *
 * `chave` guarda tanto o requisito de fato (`PRESTACAO_VALIDADA`) quanto o
 * documental (`DOCUMENTO:ATA`). Nao ha FK para `requisito_submissao` porque
 * metade das chaves nao vem de la; quem garante que a chave existe e o
 * servico, que so aceita dispensar o que aparece no checklist daquela missao.
 *
 * Nao ha exclusao: revogar preenche `revogada_em`. A dispensa foi o que abriu
 * o encerramento, e apagar a linha apagaria a explicacao de por que a missao
 * pode fechar sem o requisito.
 */
export const dispensaRequisitoEncerramento = pgTable(
  'dispensa_requisito_encerramento',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    chave: varchar('chave', { length: 80 }).notNull(),
    justificativa: text('justificativa').notNull(),
    dispensadaEm: timestamp('dispensada_em', { withTimezone: true })
      .notNull()
      .defaultNow(),
    dispensadaPor: varchar('dispensada_por', { length: 200 }),
    dispensadaPorId: varchar('dispensada_por_id', { length: 120 }),
    revogadaEm: timestamp('revogada_em', { withTimezone: true }),
    revogadaPor: varchar('revogada_por', { length: 200 }),
    revogadaJustificativa: text('revogada_justificativa'),
    ...timestamps,
  },
  (t) => [
    /**
     * Uma dispensa vigente por requisito. O indice e parcial porque a revogada
     * fica na tabela: sem o `where`, revogar e dispensar de novo colidiria, e a
     * unica saida seria apagar o historico que a revogacao existe para manter.
     */
    uniqueIndex('dispensa_requisito_vigente_uk')
      .on(t.missaoId, t.chave)
      .where(sql`${t.revogadaEm} is null`),
    index('dispensa_requisito_missao_idx').on(t.missaoId),
    check(
      'dispensa_requisito_revogacao_ck',
      sql`(${t.revogadaEm} is null) = (${t.revogadaPor} is null)
       and (${t.revogadaEm} is not null or ${t.revogadaJustificativa} is null)`,
    ),
  ],
);

/**
 * Redes coordenadoras a que a missao pertence.
 *
 * E muitos-para-muitos porque a missao conjunta das tres redes e justamente o
 * caso que o modulo quer registrar (CG-007). Uma coluna singular em
 * `missao_comite` teria de ser substituida na primeira missao compartilhada.
 *
 * Nao ha coluna de "rede principal": nenhuma regra atual precisa eleger uma, e
 * a contagem oficial ja resolve o duplo pertencimento contando a missao uma
 * unica vez em "todas as redes". A pessoa responsavel vive na participacao da
 * missao, sem eleger uma rede principal nem duplicar o vinculo com pessoa.
 *
 * A rede pertence a um ciclo, entao o servico exige que rede e missao sejam do
 * mesmo ciclo; o banco sozinho nao consegue afirmar isso.
 */
export const missaoRede = pgTable(
  'missao_rede',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    redeId: uuid('rede_id')
      .notNull()
      .references(() => redeCoordenadora.id, { onDelete: 'restrict' }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_rede_uk').on(t.missaoId, t.redeId),
    index('missao_rede_missao_idx').on(t.missaoId),
    index('missao_rede_rede_idx').on(t.redeId),
  ],
);

/**
 * Pessoa que viaja ou apoia uma missao.
 *
 * O vinculo com a equipe e opcional: uma pessoa pode participar sem integrar o
 * Comite Gestor nem a Administracao. Quando informado, preserva qual composicao
 * de equipe fundamentou a participacao naquele momento.
 */
export const missaoParticipante = pgTable(
  'missao_participante',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    pessoaId: uuid('pessoa_id')
      .notNull()
      .references(() => pessoa.id),
    membroEquipeId: uuid('membro_equipe_id').references(
      () => membroEquipeGestao.id,
      { onDelete: 'set null' },
    ),
    papel: papelMissaoEnum('papel').notNull().default('PARTICIPANTE'),
    cargo: varchar('cargo', { length: 160 }),
    area: varchar('area', { length: 160 }),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('missao_participante_pessoa_uk').on(t.missaoId, t.pessoaId),
    index('missao_participante_missao_idx').on(t.missaoId),
    index('missao_participante_pessoa_idx').on(t.pessoaId),
    index('missao_participante_equipe_idx').on(t.membroEquipeId),
    uniqueIndex('missao_participante_responsavel_uk')
      .on(t.missaoId)
      .where(sql`${t.papel} = 'RESPONSAVEL'`),
    check(
      'missao_participante_periodo_ck',
      sql`${t.dataFim} >= ${t.dataInicio}`,
    ),
  ],
);

/** Uma parada do roteiro: visita, universidade, instituicao ou evento. */
export const atividadeMissao = pgTable(
  'atividade_missao',
  {
    id: id(),
    missaoId: uuid('missao_id')
      .notNull()
      .references(() => missaoComite.id, { onDelete: 'cascade' }),
    ordem: integer('ordem').notNull().default(0),
    tipo: tipoMissaoEnum('tipo').notNull(),
    titulo: varchar('titulo', { length: 300 }).notNull(),
    paisId: uuid('pais_id')
      .notNull()
      .references(() => pais.id),
    cidade: varchar('cidade', { length: 120 }),
    estadoRegiao: varchar('estado_regiao', { length: 120 }),
    local: varchar('local', { length: 240 }),
    endereco: text('endereco'),
    instituicaoId: uuid('instituicao_id').references(() => instituicao.id),
    instituicaoNome: varchar('instituicao_nome', { length: 240 }),
    contatoInstituicaoId: uuid('contato_instituicao_id').references(
      () => contatoInstituicao.id,
    ),
    tipoRelacionamento: tipoRelacionamentoMissaoEnum('tipo_relacionamento'),
    objetivoRelacionamento: text('objetivo_relacionamento'),
    eventoNome: varchar('evento_nome', { length: 300 }),
    eventoTipo: varchar('evento_tipo', { length: 160 }),
    eventoSite: varchar('evento_site', { length: 500 }),
    objetivoParticipacao: text('objetivo_participacao'),
    relacaoInternacionalizacao: text('relacao_internacionalizacao'),
    dataInicio: date('data_inicio').notNull(),
    dataFim: date('data_fim').notNull(),
    planejamento: text('planejamento'),
    relatoRealizado: text('relato_realizado'),
    resultados: text('resultados'),
    status: statusAtividadeMissaoEnum('status').notNull().default('PLANEJADA'),
    /**
     * Atividade que aconteceu sem constar do roteiro planejado.
     *
     * E uma coluna, e nao uma deducao a partir de `planejamento` estar vazio:
     * o relato precisa continuar distinguindo o que foi previsto do que
     * simplesmente aconteceu, mesmo anos depois.
     */
    naoPrevista: boolean('nao_prevista').notNull().default(false),
    justificativaInclusao: text('justificativa_inclusao'),
    observacoes: text('observacoes'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('atividade_missao_ordem_uk').on(t.missaoId, t.ordem),
    index('atividade_missao_missao_idx').on(t.missaoId),
    index('atividade_missao_pais_idx').on(t.paisId),
    index('atividade_missao_instituicao_idx').on(t.instituicaoId),
    index('atividade_missao_contato_idx').on(t.contatoInstituicaoId),
    check('atividade_missao_ordem_ck', sql`${t.ordem} >= 0`),
    check('atividade_missao_periodo_ck', sql`${t.dataFim} >= ${t.dataInicio}`),
    // Evita que catalogo e texto livre disputem qual instituicao e a correta.
    check(
      'atividade_missao_instituicao_ck',
      sql`num_nonnulls(${t.instituicaoId}, ${t.instituicaoNome}) <= 1`,
    ),
    // Contato central sempre pertence a uma instituicao central, nao a texto.
    check(
      'atividade_missao_contato_instituicao_ck',
      sql`${t.contatoInstituicaoId} is null or ${t.instituicaoId} is not null`,
    ),
    // Incluir no relato o que nao estava previsto exige dizer por que.
    check(
      'atividade_missao_nao_prevista_ck',
      sql`${t.naoPrevista} is false or ${t.justificativaInclusao} is not null`,
    ),
  ],
);

export const membroEquipeGestaoRelations = relations(
  membroEquipeGestao,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [membroEquipeGestao.cicloId],
      references: [ciclo.id],
    }),
    pessoa: one(pessoa, {
      fields: [membroEquipeGestao.pessoaId],
      references: [pessoa.id],
    }),
    redes: many(membroEquipeGestaoRede),
    participacoes: many(missaoParticipante),
  }),
);

export const membroEquipeGestaoRedeRelations = relations(
  membroEquipeGestaoRede,
  ({ one }) => ({
    membro: one(membroEquipeGestao, {
      fields: [membroEquipeGestaoRede.membroEquipeId],
      references: [membroEquipeGestao.id],
    }),
    rede: one(redeCoordenadora, {
      fields: [membroEquipeGestaoRede.redeId],
      references: [redeCoordenadora.id],
    }),
  }),
);

export const missaoComiteRelations = relations(
  missaoComite,
  ({ one, many }) => ({
    ciclo: one(ciclo, {
      fields: [missaoComite.cicloId],
      references: [ciclo.id],
    }),
    participantes: many(missaoParticipante),
    atividades: many(atividadeMissao),
    redes: many(missaoRede),
  }),
);

export const missaoRedeRelations = relations(missaoRede, ({ one }) => ({
  missao: one(missaoComite, {
    fields: [missaoRede.missaoId],
    references: [missaoComite.id],
  }),
  rede: one(redeCoordenadora, {
    fields: [missaoRede.redeId],
    references: [redeCoordenadora.id],
  }),
}));

export const missaoParticipanteRelations = relations(
  missaoParticipante,
  ({ one }) => ({
    missao: one(missaoComite, {
      fields: [missaoParticipante.missaoId],
      references: [missaoComite.id],
    }),
    pessoa: one(pessoa, {
      fields: [missaoParticipante.pessoaId],
      references: [pessoa.id],
    }),
    membroEquipe: one(membroEquipeGestao, {
      fields: [missaoParticipante.membroEquipeId],
      references: [membroEquipeGestao.id],
    }),
  }),
);

export const atividadeMissaoRelations = relations(
  atividadeMissao,
  ({ one }) => ({
    missao: one(missaoComite, {
      fields: [atividadeMissao.missaoId],
      references: [missaoComite.id],
    }),
    pais: one(pais, {
      fields: [atividadeMissao.paisId],
      references: [pais.id],
    }),
    instituicao: one(instituicao, {
      fields: [atividadeMissao.instituicaoId],
      references: [instituicao.id],
    }),
    contatoInstituicao: one(contatoInstituicao, {
      fields: [atividadeMissao.contatoInstituicaoId],
      references: [contatoInstituicao.id],
    }),
  }),
);
