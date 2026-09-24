import { describe, expect, it } from '@jest/globals';

import { RecorteDeMissoes } from './escopo';

const REDE_A = '33333333-3333-4333-8333-333333333333';
const REDE_B = '44444444-4444-4444-8444-444444444444';

const recorte = (redeIds: string[], global = false) =>
  new RecorteDeMissoes({ global, ppgIds: [], redeIds }, false);

describe('recorte de missoes por rede', () => {
  it('alcance global ve qualquer rede', () => {
    expect(recorte([], true).alcanca(REDE_A)).toBe(true);
    expect(RecorteDeMissoes.irrestrito().alcanca(REDE_B)).toBe(true);
  });

  it('alcance de rede ve a propria e nao ve a alheia', () => {
    const meu = recorte([REDE_A]);
    expect(meu.alcanca(REDE_A)).toBe(true);
    expect(meu.alcanca(REDE_B)).toBe(false);
  });

  it('conta sem alcance nenhum nao ve nada', () => {
    // Nao ha modo permissivo: sem rede no escopo, nenhuma passa.
    const naoConfigurado = recorte([]);
    expect(naoConfigurado.alcanca(REDE_A)).toBe(false);
    expect(naoConfigurado.semRecorte).toBe(false);
  });
});
