import type { Alcance } from './alcance';

/**
 * Alcance em linguagem institucional (V1-019).
 *
 * A pessoa que recebe um acesso nao le `{"tipo":"PPG","ppgId":"8f3a..."}`; ela
 * pergunta "o que eu consigo ver?". Esta traducao existe para a tela **da
 * propria conta** responder isso sem UUID e sem nome de coluna.
 *
 * Fica na API, e nao no front, porque so aqui existem os nomes: a tela de quem
 * nao administra acessos nao pode chamar `/acesso/alvos` — aquela rota exige
 * `acesso:read`, e exigi-la para alguem ler o proprio acesso inverteria a
 * regra.
 */

/** Rotulo ja pronto de cada alvo, indexado por id. Quem monta e o servico. */
export interface NomesDosAlvos {
  readonly ciclos: ReadonlyMap<string, string>;
  readonly ppgs: ReadonlyMap<string, string>;
  readonly redes: ReadonlyMap<string, string>;
  readonly tematicas: ReadonlyMap<string, string>;
  readonly participacoes: ReadonlyMap<string, string>;
}

export const SEM_NOMES: NomesDosAlvos = {
  ciclos: new Map(),
  ppgs: new Map(),
  redes: new Map(),
  tematicas: new Map(),
  participacoes: new Map(),
};

/**
 * Alvo que sumiu do cadastro continua aparecendo, dito assim.
 *
 * Trocar a linha por um UUID cru devolveria o codigo interno que esta funcao
 * existe para evitar; some-la esconderia uma concessao que ainda vale.
 */
const DESCONHECIDO = 'cadastro não encontrado';

function nome(mapa: ReadonlyMap<string, string>, id: string): string {
  return mapa.get(id) ?? DESCONHECIDO;
}

/**
 * Onde uma acao vale, uma frase por alvo.
 *
 * **`GLOBAL` nao se soma aos demais**: quem alcanca tudo ja alcanca cada parte,
 * e listar "Todo o sistema" ao lado de "PPGCLIAMB" faria a segunda linha
 * parecer um limite que nao existe.
 */
export function descreverAlcance(
  alcance: Alcance,
  nomes: NomesDosAlvos,
): string[] {
  if (alcance.global) return ['Todo o sistema'];

  return [
    ...alcance.ciclos.map((id) => `Ciclo ${nome(nomes.ciclos, id)}`),
    // O par PPG + ciclo vira uma frase so: sao duas condicoes que valem
    // juntas, e separa-las leria como dois alcances independentes.
    ...alcance.ppgs.map(
      (alvo) =>
        `${nome(nomes.ppgs, alvo.ppgId)} no ciclo ${nome(nomes.ciclos, alvo.cicloId)}`,
    ),
    ...alcance.redes.map((id) => `Rede ${nome(nomes.redes, id)}`),
    ...alcance.tematicas.map(
      (id) => `Área temática ${nome(nomes.tematicas, id)}`,
    ),
    ...alcance.participacoes.map(
      (id) => `Participação ${nome(nomes.participacoes, id)}`,
    ),
  ];
}
