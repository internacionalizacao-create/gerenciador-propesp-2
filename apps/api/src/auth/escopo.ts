import { sql, type SQL } from 'drizzle-orm';

import type { EscopoAcesso } from './identidade.service';

/**
 * Traducao do escopo de acesso para condicao SQL.
 *
 * A autorizacao por papel responde "pode listar PPG?". Esta camada responde a
 * outra metade — "**quais** PPGs?" — e ela precisa estar na consulta, nao na
 * interface: esconder item de menu nao e autorizacao, e a API e a fronteira que
 * de fato protege o dado.
 */

/**
 * **Enquanto for `false`, usuario sem escopo configurado continua vendo tudo.**
 *
 * Esta e a decisao mais consequente deste arquivo, e por isso esta explicita e
 * num lugar so. O recorte esta sendo introduzido num sistema em que ninguem
 * tem escopo cadastrado ainda: ligar o modo restritivo antes de a PROPESP
 * atribuir os escopos deixaria todo coordenador sem enxergar nada, no mesmo
 * instante, sem nenhuma tela dizendo por que.
 *
 * Quem ja tem escopo cadastrado **ja e recortado hoje** — o modo permissivo nao
 * enfraquece quem foi configurado, so poupa quem ainda nao foi.
 *
 * Trocar para `true` fecha o sistema: sem escopo, sem dado. Faca isso quando os
 * escopos estiverem atribuidos, e nao antes. Os dois modos tem teste.
 */
export const RECORTE_OBRIGATORIO = false;

/** Nao ha o que recortar: o usuario ve tudo dentro do que o papel permite. */
const SEM_RECORTE = sql`true`;

/** Recorta tudo: nenhuma linha passa. */
const NADA = sql`false`;

/**
 * Condicao para uma coluna que guarda `ppg_id`.
 *
 * `coluna` entra como fragmento SQL cru — quem chama escreve `sql`p.ppg_id``,
 * nunca texto vindo do usuario.
 */
export function filtroPorPpg(escopo: EscopoAcesso, coluna: SQL): SQL {
  if (escopo.global) return SEM_RECORTE;
  if (escopo.ppgIds.length > 0) {
    return sql`${coluna} in (${sql.join(
      escopo.ppgIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
  }
  // Sem escopo de PPG. Um usuario que tem escopo **de rede** e nenhum de PPG
  // nao esta "sem configuracao": ele foi configurado para outra dimensao, e
  // deixa-lo ver todos os PPGs seria vazamento. Por isso a checagem olha os
  // dois tipos antes de concluir que ninguem configurou nada.
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO ? SEM_RECORTE : NADA;
}

/** Condicao para uma coluna que guarda `rede_id`. */
export function filtroPorRede(escopo: EscopoAcesso, coluna: SQL): SQL {
  if (escopo.global) return SEM_RECORTE;
  if (escopo.redeIds.length > 0) {
    return sql`${coluna} in (${sql.join(
      escopo.redeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
  }
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO ? SEM_RECORTE : NADA;
}

/** Verdadeiro quando o usuario pode ver aquele PPG. */
export function podeVerPpg(escopo: EscopoAcesso, ppgId: string): boolean {
  if (escopo.global) return true;
  if (escopo.ppgIds.includes(ppgId)) return true;
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO;
}

/** Verdadeiro quando o usuario pode ver aquela rede. */
export function podeVerRede(escopo: EscopoAcesso, redeId: string): boolean {
  if (escopo.global) return true;
  if (escopo.redeIds.includes(redeId)) return true;
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO;
}

/** Nenhum escopo de nenhum tipo: conta que ainda nao foi configurada. */
function semNenhumEscopo(escopo: EscopoAcesso): boolean {
  return (
    !escopo.global && escopo.ppgIds.length === 0 && escopo.redeIds.length === 0
  );
}
