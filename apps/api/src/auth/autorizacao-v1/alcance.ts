import { sql, type SQL } from 'drizzle-orm';

import type { PermissaoV1 } from './catalogo';
import { alvoDaLinha, type LinhaDeAlvo } from './persistencia';

/**
 * Alcance de uma acao: **onde** aquela permissao vale (V1-012).
 *
 * O modelo antigo respondia duas perguntas separadas — "pode listar bolsa?" e
 * "quais PPGs este usuario enxerga?" — e as cruzava. Aqui a resposta e uma so,
 * por acao: quem pode *criar* bolsa no PPG A e *consultar* plano na rede inteira
 * tem dois alcances diferentes, e nenhum deles vaza para o outro.
 *
 * ## A regra de composicao
 *
 * **OR entre concessoes, AND dentro de cada alvo.** Duas concessoes da mesma
 * acao somam alcance (dois PPGs, dois ciclos); dentro de uma concessao de PPG,
 * o PPG **e** o ciclo precisam casar — e por isso `ppgs` guarda o par, nunca
 * duas listas soltas. Com listas separadas, quem tivesse PPG A no ciclo 1 e PPG
 * B no ciclo 2 passaria a alcancar A no ciclo 2, que ninguem concedeu.
 */

/** Par PPG + ciclo: o alvo de planejamento nao existe sem os dois. */
export interface AlvoPpg {
  readonly ppgId: string;
  readonly cicloId: string;
}

export interface Alcance {
  /** Sem recorte: a acao vale em qualquer lugar. */
  readonly global: boolean;
  readonly ciclos: readonly string[];
  readonly ppgs: readonly AlvoPpg[];
  readonly redes: readonly string[];
  readonly tematicas: readonly string[];
  readonly participacoes: readonly string[];
}

/** Alcance de quem nao tem a acao: nenhuma linha passa. */
export const SEM_ALCANCE: Alcance = {
  global: false,
  ciclos: [],
  ppgs: [],
  redes: [],
  tematicas: [],
  participacoes: [],
};

export interface LinhaDeConcessao extends LinhaDeAlvo {
  readonly permissao: string;
}

/**
 * Agrupa as concessoes ativas de uma conta por acao.
 *
 * Permissao fora do catalogo e **ignorada**, nao assumida: o banco aceita
 * qualquer texto no formato `dominio:acao` (ver `concessao_acesso`), e uma linha
 * com nome desconhecido nao pode virar acesso a nada. Linha com alvo incoerente
 * derruba a resolucao inteira, por `alvoDaLinha` — quem le concessao esta
 * decidindo acesso, e adivinhar ali e o pior desfecho possivel.
 */
export function agruparAlcances(
  linhas: readonly LinhaDeConcessao[],
  permissaoValida: (valor: string) => valor is PermissaoV1,
): Map<PermissaoV1, Alcance> {
  const mapa = new Map<PermissaoV1, Alcance>();

  for (const linha of linhas) {
    if (!permissaoValida(linha.permissao)) continue;

    const alvo = alvoDaLinha(linha);
    const atual = mapa.get(linha.permissao) ?? SEM_ALCANCE;

    mapa.set(linha.permissao, somar(atual, alvo));
  }

  return mapa;
}

function somar(
  alcance: Alcance,
  alvo: ReturnType<typeof alvoDaLinha>,
): Alcance {
  switch (alvo.tipo) {
    case 'GLOBAL':
      return { ...alcance, global: true };
    case 'CICLO':
      return { ...alcance, ciclos: [...alcance.ciclos, alvo.cicloId] };
    case 'PPG':
      return {
        ...alcance,
        ppgs: [...alcance.ppgs, { ppgId: alvo.ppgId, cicloId: alvo.cicloId }],
      };
    case 'REDE':
      return { ...alcance, redes: [...alcance.redes, alvo.redeId] };
    case 'TEMATICA':
      return { ...alcance, tematicas: [...alcance.tematicas, alvo.tematicaId] };
    case 'PARTICIPACAO':
      return {
        ...alcance,
        participacoes: [...alcance.participacoes, alvo.participacaoId],
      };
  }
}

/**
 * Colunas que a consulta oferece para o recorte.
 *
 * Cada consulta passa os fragmentos que ela de fato tem (`sql`p.ppg_id``), e
 * **dimensao ausente nao autoriza**: uma concessao por temática numa consulta
 * que nao expoe temática e simplesmente ignorada, nunca aproximada pelo PPG.
 * Aproximar seria inventar alcance que ninguem concedeu; ignorar so nega a mais,
 * e a falta aparece como tela vazia — que se investiga — em vez de vazamento,
 * que nao se percebe.
 */
export interface ColunasDeRecorte {
  readonly ciclo?: SQL;
  readonly ppg?: SQL;
  readonly rede?: SQL;
  readonly tematica?: SQL;
  readonly participacao?: SQL;
}

const TUDO = sql`true`;
const NADA = sql`false`;

/**
 * Traduz o alcance de uma acao em condicao SQL.
 *
 * Sem alcance a condicao e `false` — **ausencia de concessao nega**, e essa e a
 * diferenca de fundo para o `RECORTE_OBRIGATORIO` do modelo antigo, que liberava
 * tudo para quem nao estivesse configurado. Aqui nao existe modo permissivo:
 * conta nova ve uma tela vazia ate alguem conceder alguma coisa.
 */
export function condicaoDoAlcance(
  alcance: Alcance,
  colunas: ColunasDeRecorte,
): SQL {
  if (alcance.global) return TUDO;

  const partes: SQL[] = [];

  if (colunas.ciclo && alcance.ciclos.length > 0) {
    partes.push(pertence(colunas.ciclo, alcance.ciclos));
  }
  if (colunas.ppg && alcance.ppgs.length > 0) {
    // O par inteiro, em AND: PPG de um ciclo nao alcanca o mesmo PPG no outro.
    for (const alvo of alcance.ppgs) {
      partes.push(
        colunas.ciclo
          ? sql`(${colunas.ppg} = ${alvo.ppgId}::uuid and ${colunas.ciclo} = ${alvo.cicloId}::uuid)`
          : // Sem coluna de ciclo a consulta nao sabe distinguir os ciclos, e
            // aceitar so o PPG entregaria os demais. Concessao de PPG nao vale
            // aqui; quem precisa dela precisa expor o ciclo.
            NADA,
      );
    }
  }
  if (colunas.rede && alcance.redes.length > 0) {
    partes.push(pertence(colunas.rede, alcance.redes));
  }
  if (colunas.tematica && alcance.tematicas.length > 0) {
    partes.push(pertence(colunas.tematica, alcance.tematicas));
  }
  if (colunas.participacao && alcance.participacoes.length > 0) {
    partes.push(pertence(colunas.participacao, alcance.participacoes));
  }

  if (partes.length === 0) return NADA;
  return sql`(${sql.join(partes, sql` or `)})`;
}

/** `true` quando o alvo concreto esta dentro do alcance — leitura de um item. */
export function alcancaAlvo(
  alcance: Alcance,
  alvo: {
    cicloId?: string | null;
    ppgId?: string | null;
    redeIds?: readonly string[];
    tematicaId?: string | null;
    participacaoId?: string | null;
  },
): boolean {
  if (alcance.global) return true;

  if (alvo.cicloId && alcance.ciclos.includes(alvo.cicloId)) return true;
  if (
    alvo.ppgId &&
    alvo.cicloId &&
    alcance.ppgs.some(
      (p) => p.ppgId === alvo.ppgId && p.cicloId === alvo.cicloId,
    )
  ) {
    return true;
  }
  if (alvo.redeIds?.some((rede) => alcance.redes.includes(rede))) return true;
  if (alvo.tematicaId && alcance.tematicas.includes(alvo.tematicaId)) {
    return true;
  }
  if (
    alvo.participacaoId &&
    alcance.participacoes.includes(alvo.participacaoId)
  ) {
    return true;
  }

  return false;
}

function pertence(coluna: SQL, valores: readonly string[]): SQL {
  return sql`${coluna} in (${sql.join(
    valores.map((valor) => sql`${valor}::uuid`),
    sql`, `,
  )})`;
}
