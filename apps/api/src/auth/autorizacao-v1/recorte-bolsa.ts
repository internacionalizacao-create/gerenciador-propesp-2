import { sql, type SQL } from 'drizzle-orm';

import { condicaoDoAlcance, type Alcance } from './alcance';

/**
 * Todas as consultas de bolsa usam o alias bc. Subconsultas correlacionadas
 * preservam uma linha por concessao, inclusive sem item ou participacao.
 * A tematica da bolsa prevalece; o item so completa registros anteriores.
 */
export function condicaoDaBolsa(alcance: Alcance) {
  const tematica = sql`coalesce(bc.area_tematica_id,
    (select ib.area_tematica_id from item_planejado ib where ib.id = bc.item_planejado_id))`;
  // Subconsultas sem classificacao devolvem NULL. Normalizar para false e
  // essencial tambem em NOT e bool_and, que de outro modo ignorariam a linha.
  return sql`coalesce(${condicaoDoAlcance(alcance, {
    ciclo: sql`bc.ciclo_id`,
    ppg: sql`bc.ppg_id`,
    tematica,
    rede: sql`(select ab.rede_id from area_tematica ab where ab.id = ${tematica})`,
    participacao: sql`(select pb.id from participacao_ppg pb
      where pb.ppg_id = bc.ppg_id and pb.area_tematica_id = ${tematica})`,
  })}, false)`;
}

/**
 * Colunas da missao que a consulta expoe, para o recorte se correlacionar.
 *
 * O padrao serve as consultas cruas, que junta-se `missao_comite mc`. As
 * consultas escritas no construtor do Drizzle passam as suas, porque o alias
 * gerado nao e `mc` — e uma condicao que cita alias inexistente nao falha em
 * silencio, derruba a consulta.
 */
export interface ColunasDaMissao {
  readonly id: SQL;
  readonly ciclo: SQL;
}

const MISSAO_CRUA: ColunasDaMissao = {
  id: sql`mc.id`,
  ciclo: sql`mc.ciclo_id`,
};

/** Missao multirrede aparece uma vez; sem rede exige alcance global. */
export function condicaoDaMissao(
  alcance: Alcance,
  colunas: ColunasDaMissao = MISSAO_CRUA,
) {
  if (alcance.global) return sql`true`;
  return sql`exists (select 1 from missao_rede mr
    where mr.missao_id = ${colunas.id} and ${condicaoDoAlcance(alcance, {
      ciclo: colunas.ciclo,
      rede: sql`mr.rede_id`,
    })})`;
}
