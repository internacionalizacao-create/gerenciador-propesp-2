import { sql } from 'drizzle-orm';
import { numeric, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Peças reutilizadas por todas as tabelas do schema.
 *
 * Ver `system-structl.md` §4 para o modelo completo e a justificativa de cada
 * entidade. Este arquivo cuida só do que se repete.
 */

/** Chave primária padrão: UUID gerado pelo banco. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/**
 * Dinheiro em `numeric(14,2)`.
 *
 * Nunca `double precision`: o teste de aceite da migração exige reproduzir
 * R$ 1.144.357,20 somando 23 parcelas, e ponto flutuante erra centavo em soma
 * dessa ordem. `numeric` soma exato no proprio Postgres.
 *
 * O driver devolve `string` de proposito — converter para `number` no limite do
 * banco reintroduziria o erro que o `numeric` evita.
 */
export const dinheiro = (nome: string) =>
  numeric(nome, { precision: 14, scale: 2 });

/**
 * Vigência em meses. Precisa de uma casa decimal porque bolsa de ate 15 dias
 * vale 0,5 mes (regra do anexo da CAPES — RN-02).
 */
export const meses = (nome: string) =>
  numeric(nome, { precision: 4, scale: 1 });

/** Percentual/fração com precisão suficiente para participação no custo. */
export const fracao = (nome: string) =>
  numeric(nome, { precision: 9, scale: 8 });

/** Colunas de auditoria presentes em toda tabela de domínio. */
export const timestamps = {
  criadoEm: timestamp('criado_em', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
};

// ---------------------------------------------------------------------------
// Enums do domínio. Os valores são os termos do glossário (system-structl.md §2)
// em MAIUSCULA_COM_UNDERSCORE; a interface traduz para o texto do usuário.
// ---------------------------------------------------------------------------

export const destinoEnum = pgEnum('destino', ['BRASIL', 'EXTERIOR']);

export const fluxoEnum = pgEnum('fluxo', ['IN', 'OUT']);

export const rubricaEnum = pgEnum('rubrica', [
  'BOLSAS',
  'MANUTENCAO',
  'MISSOES',
]);

export const statusOrcamentoEnum = pgEnum('status_orcamento', [
  'DEFINIDO',
  'A_DEFINIR',
]);

export const statusItemPlanejadoEnum = pgEnum('status_item_planejado', [
  'PROGRAMADO',
  'PENDENTE',
  'CANCELADO',
]);

export const situacaoParticipacaoEnum = pgEnum('situacao_participacao', [
  'CONTEMPLADO',
  'CADASTRO_PRELIMINAR',
  'NAO_CONTEMPLADO',
]);

export const statusPendenciaEnum = pgEnum('status_pendencia', [
  'PENDENTE',
  'EM_ANALISE',
  'MONITORAR',
  'RESOLVIDA',
]);

export const nivelImpactoEnum = pgEnum('nivel_impacto', [
  'ALTA',
  'MEDIA',
  'BAIXA',
]);

export const escopoPendenciaEnum = pgEnum('escopo_pendencia', [
  'GERAL',
  'REDE',
  'AREA_TEMATICA',
  'PPG',
]);

export const origemPendenciaEnum = pgEnum('origem_pendencia', [
  'MANUAL',
  'AUTOMATICA',
]);

export const statusCicloEnum = pgEnum('status_ciclo', [
  'PLANEJAMENTO',
  'VIGENTE',
  'ENCERRADO',
]);

export const statusBolsaConcedidaEnum = pgEnum('status_bolsa_concedida', [
  'SELECIONADO',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
  'INTERROMPIDA',
]);

export const nivelBeneficiarioEnum = pgEnum('nivel_beneficiario', [
  'MESTRADO',
  'DOUTORADO',
  'POS_DOC',
  'DOCENTE',
  'MOBILIDADE_BREVE',
]);

export const statusExecucaoEnum = pgEnum('status_execucao', [
  'NAO_INICIADO',
  'EMPENHADO',
  'PAGO',
  'CANCELADO',
]);

export const statusRemanejamentoEnum = pgEnum('status_remanejamento', [
  'PROPOSTO',
  'AUTORIZADO',
  'EXECUTADO',
  'REJEITADO',
]);
