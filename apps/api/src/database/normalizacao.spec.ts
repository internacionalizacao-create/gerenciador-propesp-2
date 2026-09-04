import { normalizarNomeInstituicao } from './normalizacao';

describe('normalizacao de instituicoes', () => {
  it('elimina apenas variacoes inequivocas de escrita', () => {
    expect(
      normalizarNomeInstituicao('  Université   Paris-Saclay (UPS)  '),
    ).toBe('universite paris saclay ups');
  });

  it('preserva letras e numeros de outros alfabetos', () => {
    expect(normalizarNomeInstituicao('東京大学 7')).toBe('東京大学 7');
  });

  it('nao considera sigla e traducao como o mesmo nome', () => {
    expect(normalizarNomeInstituicao('UFMG')).not.toBe(
      normalizarNomeInstituicao('Universidade Federal de Minas Gerais'),
    );
  });
});
