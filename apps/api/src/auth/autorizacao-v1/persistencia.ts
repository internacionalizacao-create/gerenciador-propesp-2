import { escopoV1Schema, type EscopoV1 } from './concessao';

/**
 * Traducao entre o alvo tipado (`EscopoV1`) e as colunas de `concessao_acesso`.
 *
 * Existe para que essa conversao aconteca **em um lugar so**. Ela e mecanica e
 * parece dispensavel — ate a terceira consulta escrever `ppg_id` sem `ciclo_id`
 * e conceder, sem querer, o planejamento de todos os ciclos. O `check` do banco
 * pega esse caso; a forma de nao depender do banco para isso e nao ter tres
 * copias da regra.
 *
 * As duas direcoes sao testadas em ida e volta: o que o resolver de V1-012 ler
 * do banco tem que reproduzir exatamente o alvo que a API de V1-017 gravou.
 */

/** Colunas de alvo de `concessao_acesso`, todas presentes e explicitamente nulas. */
export interface ColunasDoAlvo {
  readonly tipoAlvo: EscopoV1['tipo'];
  readonly cicloId: string | null;
  readonly ppgId: string | null;
  readonly redeId: string | null;
  readonly areaTematicaId: string | null;
  readonly participacaoId: string | null;
}

const VAZIO = {
  cicloId: null,
  ppgId: null,
  redeId: null,
  areaTematicaId: null,
  participacaoId: null,
} as const;

/**
 * Alvo tipado -> colunas.
 *
 * Devolve **todas** as colunas, inclusive as nulas: um `update` parcial que
 * omitisse as demais deixaria o alvo antigo colado no novo, e a linha passaria
 * a casar com dois recortes ao mesmo tempo.
 */
export function colunasDoAlvo(escopo: EscopoV1): ColunasDoAlvo {
  switch (escopo.tipo) {
    case 'GLOBAL':
      return { tipoAlvo: 'GLOBAL', ...VAZIO };
    case 'CICLO':
      return { tipoAlvo: 'CICLO', ...VAZIO, cicloId: escopo.cicloId };
    case 'PPG':
      // O unico alvo com duas colunas: PPG sem ciclo concederia os proximos.
      return {
        tipoAlvo: 'PPG',
        ...VAZIO,
        ppgId: escopo.ppgId,
        cicloId: escopo.cicloId,
      };
    case 'REDE':
      return { tipoAlvo: 'REDE', ...VAZIO, redeId: escopo.redeId };
    case 'TEMATICA':
      return {
        tipoAlvo: 'TEMATICA',
        ...VAZIO,
        areaTematicaId: escopo.tematicaId,
      };
    case 'PARTICIPACAO':
      return {
        tipoAlvo: 'PARTICIPACAO',
        ...VAZIO,
        participacaoId: escopo.participacaoId,
      };
  }
}

/** Linha lida do banco, no formato do Drizzle. */
export interface LinhaDeAlvo {
  readonly tipoAlvo: string;
  readonly cicloId: string | null;
  readonly ppgId: string | null;
  readonly redeId: string | null;
  readonly areaTematicaId: string | null;
  readonly participacaoId: string | null;
}

/**
 * Colunas -> alvo tipado.
 *
 * **Lanca em vez de devolver um alvo aproximado.** Uma linha incoerente so
 * chega aqui se o `check` do banco tiver sido contornado (migration escrita a
 * mao, `copy` direto); nesse caso, adivinhar o alvo e o que transforma um dado
 * corrompido em autorizacao concedida. Falhar alto e o comportamento seguro:
 * quem le concessao esta decidindo acesso.
 */
export function alvoDaLinha(linha: LinhaDeAlvo): EscopoV1 {
  const bruto = montar(linha);
  const resultado = escopoV1Schema.safeParse(bruto);
  if (!resultado.success) {
    throw new Error(
      `Concessao com alvo incoerente no banco (tipo ${linha.tipoAlvo}).`,
    );
  }
  return resultado.data;
}

function montar(linha: LinhaDeAlvo): unknown {
  switch (linha.tipoAlvo) {
    case 'GLOBAL':
      return { tipo: 'GLOBAL' };
    case 'CICLO':
      return { tipo: 'CICLO', cicloId: linha.cicloId };
    case 'PPG':
      return { tipo: 'PPG', ppgId: linha.ppgId, cicloId: linha.cicloId };
    case 'REDE':
      return { tipo: 'REDE', redeId: linha.redeId };
    case 'TEMATICA':
      return { tipo: 'TEMATICA', tematicaId: linha.areaTematicaId };
    case 'PARTICIPACAO':
      return { tipo: 'PARTICIPACAO', participacaoId: linha.participacaoId };
    default:
      // Tipo fora do enum: nao ha alvo plausivel a montar.
      return { tipo: linha.tipoAlvo };
  }
}
