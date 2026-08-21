import {
  classificarSituacaoProduto,
  classificarSituacaoTemporal,
} from './bolsistas.service';

describe('alertas de bolsas e produtos', () => {
  const bolsa = {
    status: 'SELECIONADO' as const,
    dataInicio: '2027-09-01',
    dataFim: '2027-10-31',
  };

  it('distingue programada, proxima, vigente e prestes a expirar', () => {
    expect(classificarSituacaoTemporal(bolsa, '2027-01-01')).toBe('PROGRAMADA');
    expect(classificarSituacaoTemporal(bolsa, '2027-08-01')).toBe('PROXIMA');
    expect(classificarSituacaoTemporal(bolsa, '2027-09-15')).toBe(
      'EM_VIGENCIA',
    );
    expect(classificarSituacaoTemporal(bolsa, '2027-10-15')).toBe(
      'PRESTES_A_EXPIRAR',
    );
  });

  it('sinaliza bolsa expirada quando a data passa sem conclusao', () => {
    expect(classificarSituacaoTemporal(bolsa, '2027-11-01')).toBe('EXPIRADA');
  });

  it('preserva os estados administrativos terminais', () => {
    expect(
      classificarSituacaoTemporal(
        { ...bolsa, status: 'CONCLUIDA' },
        '2027-11-01',
      ),
    ).toBe('CONCLUIDA');
    expect(
      classificarSituacaoTemporal(
        { ...bolsa, status: 'CANCELADA' },
        '2027-09-01',
      ),
    ).toBe('CANCELADA');
  });

  it('deriva atraso do prazo sem gravar um status que ficaria obsoleto', () => {
    expect(
      classificarSituacaoProduto(
        { status: 'PREVISTO', prazoEntrega: '2027-10-31' },
        '2027-11-01',
      ),
    ).toBe('ATRASADO');
    expect(
      classificarSituacaoProduto(
        { status: 'ENTREGUE', prazoEntrega: '2027-10-31' },
        '2027-11-01',
      ),
    ).toBe('ENTREGUE');
  });
});
