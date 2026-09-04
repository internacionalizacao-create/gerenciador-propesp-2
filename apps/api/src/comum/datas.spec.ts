import { calcularDiasInclusivos } from './datas';

describe('datas civis', () => {
  it('conta saida e retorno no numero de dias', () => {
    expect(calcularDiasInclusivos('2027-03-01', '2027-03-10')).toBe(10);
  });

  it('uma atividade no mesmo dia dura um dia', () => {
    expect(calcularDiasInclusivos('2027-03-10', '2027-03-10')).toBe(1);
  });

  it('atravessa mudanca de mes sem depender do fuso local', () => {
    expect(calcularDiasInclusivos('2027-02-27', '2027-03-02')).toBe(4);
  });
});
