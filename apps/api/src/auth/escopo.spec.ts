import { describe, expect, it } from '@jest/globals';

import { podeVerPpg, podeVerRede, RECORTE_OBRIGATORIO } from './escopo';
import type { EscopoAcesso } from './identidade.service';

const escopo = (parcial: Partial<EscopoAcesso> = {}): EscopoAcesso => ({
  global: false,
  ppgIds: [],
  redeIds: [],
  ...parcial,
});

const PPG_A = '11111111-1111-4111-8111-111111111111';
const PPG_B = '22222222-2222-4222-8222-222222222222';
const REDE_A = '33333333-3333-4333-8333-333333333333';

describe('recorte por escopo de acesso', () => {
  it('escopo global ve qualquer PPG e qualquer rede', () => {
    expect(podeVerPpg(escopo({ global: true }), PPG_A)).toBe(true);
    expect(podeVerRede(escopo({ global: true }), REDE_A)).toBe(true);
  });

  it('escopo de PPG ve o proprio e nao ve o alheio', () => {
    const meu = escopo({ ppgIds: [PPG_A] });
    expect(podeVerPpg(meu, PPG_A)).toBe(true);
    expect(podeVerPpg(meu, PPG_B)).toBe(false);
  });

  it('quem tem escopo de rede nao passa a ver todos os PPGs', () => {
    // Este e o caso que a implementacao ingenua erra: "sem escopo de PPG" e
    // tratado como "nao configurado" e liberaria tudo. Quem foi configurado
    // para rede **foi** configurado; a ausencia de PPG e recorte, nao lacuna.
    const gestorDeRede = escopo({ redeIds: [REDE_A] });
    expect(podeVerPpg(gestorDeRede, PPG_A)).toBe(false);
    expect(podeVerRede(gestorDeRede, REDE_A)).toBe(true);
  });

  it('conta sem escopo nenhum segue o modo de transicao', () => {
    // Enquanto `RECORTE_OBRIGATORIO` for falso, quem ainda nao foi configurado
    // continua vendo tudo — do contrario, ligar o recorte antes de a PROPESP
    // atribuir escopos deixaria todo coordenador sem dado, de uma vez.
    const naoConfigurado = escopo();
    expect(podeVerPpg(naoConfigurado, PPG_A)).toBe(!RECORTE_OBRIGATORIO);
    expect(podeVerRede(naoConfigurado, REDE_A)).toBe(!RECORTE_OBRIGATORIO);
  });

  it('o modo de transicao esta desligado, e isso e deliberado', () => {
    // Fixa a decisao: mudar para `true` fecha o sistema para quem nao tem
    // escopo, e este teste obriga quem mudar a mexer aqui de proposito.
    expect(RECORTE_OBRIGATORIO).toBe(false);
  });
});
