import { TIPOS_ESCOPO_V1 } from './catalogo';
import type { EscopoV1 } from './concessao';
import { alvoDaLinha, colunasDoAlvo } from './persistencia';

const ppgId = '39a32be2-c9bd-4943-a2cf-360d1549f0be';
const cicloId = '8cc4045a-efc1-4ff4-93f6-bbf63bcae13d';
const redeId = 'f0f2a2b4-6b1b-4f0e-9a3a-6f2a1c6f2b11';
const tematicaId = 'c1b7a0d2-9f42-4a55-8d21-7a0b93f4c8e0';
const participacaoId = 'd44f1c8e-2b3a-4c6d-9e7f-1a2b3c4d5e6f';

const ALVOS: Record<(typeof TIPOS_ESCOPO_V1)[number], EscopoV1> = {
  GLOBAL: { tipo: 'GLOBAL' },
  CICLO: { tipo: 'CICLO', cicloId },
  PPG: { tipo: 'PPG', ppgId, cicloId },
  REDE: { tipo: 'REDE', redeId },
  TEMATICA: { tipo: 'TEMATICA', tematicaId },
  PARTICIPACAO: { tipo: 'PARTICIPACAO', participacaoId },
};

describe('alvo da concessao entre o contrato e as colunas', () => {
  it.each(TIPOS_ESCOPO_V1)('preserva o alvo %s na ida e na volta', (tipo) => {
    const escopo = ALVOS[tipo];
    expect(alvoDaLinha(colunasDoAlvo(escopo))).toEqual(escopo);
  });

  it('zera as colunas que o alvo nao usa', () => {
    // Um update parcial deixaria o alvo anterior colado no novo, e a linha
    // passaria a casar com dois recortes ao mesmo tempo.
    expect(colunasDoAlvo({ tipo: 'REDE', redeId })).toEqual({
      tipoAlvo: 'REDE',
      cicloId: null,
      ppgId: null,
      redeId,
      areaTematicaId: null,
      participacaoId: null,
    });
  });

  it('leva o ciclo junto quando o alvo e PPG', () => {
    const colunas = colunasDoAlvo({ tipo: 'PPG', ppgId, cicloId });
    expect(colunas.ppgId).toBe(ppgId);
    expect(colunas.cicloId).toBe(cicloId);
  });

  it.each([
    { tipoAlvo: 'PPG', ppgId, cicloId: null },
    { tipoAlvo: 'CICLO', cicloId: null },
    { tipoAlvo: 'REDE', redeId: null },
    { tipoAlvo: 'TEMATICA', areaTematicaId: null },
    { tipoAlvo: 'MUNICIPIO', cicloId },
  ])('recusa linha incoerente em vez de adivinhar o alvo: %j', (parcial) => {
    const vazia = {
      tipoAlvo: 'GLOBAL',
      cicloId: null,
      ppgId: null,
      redeId: null,
      areaTematicaId: null,
      participacaoId: null,
    };
    const linha = { ...vazia, ...parcial };
    expect(() => alvoDaLinha(linha)).toThrow(/incoerente/);
  });
});
