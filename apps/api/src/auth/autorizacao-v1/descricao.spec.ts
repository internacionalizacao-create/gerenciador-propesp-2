import { SEM_ALCANCE, type Alcance } from './alcance';
import { descreverAlcance, SEM_NOMES, type NomesDosAlvos } from './descricao';

const ciclo = '11111111-1111-4111-8111-111111111111';
const ppg = '22222222-2222-4222-8222-222222222222';
const rede = '33333333-3333-4333-8333-333333333333';

const NOMES: NomesDosAlvos = {
  ciclos: new Map([[ciclo, '2027-2030']]),
  ppgs: new Map([[ppg, 'PPGCLIAMB']]),
  redes: new Map([[rede, 'UNESP (2027-2030)']]),
  tematicas: new Map(),
  participacoes: new Map(),
};

function alcance(parcial: Partial<Alcance>): Alcance {
  return { ...SEM_ALCANCE, ...parcial };
}

describe('alcance em linguagem institucional', () => {
  it('nao mostra id nenhum: o alvo aparece pelo nome', () => {
    expect(
      descreverAlcance(
        alcance({ ppgs: [{ ppgId: ppg, cicloId: ciclo }] }),
        NOMES,
      ),
    ).toEqual(['PPGCLIAMB no ciclo 2027-2030']);

    expect(descreverAlcance(alcance({ redes: [rede] }), NOMES)).toEqual([
      'Rede UNESP (2027-2030)',
    ]);
  });

  it('descreve o alcance total numa frase so, sem listar as partes', () => {
    // Quem alcanca tudo ja alcanca cada pedaco; a lista ao lado leria como
    // limite.
    expect(
      descreverAlcance(alcance({ global: true, redes: [rede] }), NOMES),
    ).toEqual(['Todo o sistema']);
  });

  it('mantem PPG e ciclo na mesma frase', () => {
    // Duas frases separadas leriam como dois alcances independentes, e e
    // justamente o par que a concessao guarda.
    const frases = descreverAlcance(
      alcance({ ppgs: [{ ppgId: ppg, cicloId: ciclo }] }),
      NOMES,
    );

    expect(frases).toHaveLength(1);
    expect(frases[0]).toContain('PPGCLIAMB');
    expect(frases[0]).toContain('2027-2030');
  });

  it('diz que o cadastro sumiu, em vez de devolver o id cru', () => {
    expect(descreverAlcance(alcance({ redes: [rede] }), SEM_NOMES)).toEqual([
      'Rede cadastro não encontrado',
    ]);
  });

  it('sem concessao, nao ha frase alguma', () => {
    // Lista vazia e o que faz a tela dizer "sem acesso"; uma frase generica
    // aqui viraria promessa de acesso que nao existe.
    expect(descreverAlcance(SEM_ALCANCE, NOMES)).toEqual([]);
  });
});
