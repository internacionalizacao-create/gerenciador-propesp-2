import { describe, expect, it } from '@jest/globals';

import {
  disposicaoDoAnexo,
  idAnexoSchema,
  temControle,
} from './anexos.service';

describe('seguranca da fronteira de anexos (CG-061)', () => {
  it('recusa identificador adulterado antes de consultar o banco', () => {
    expect(idAnexoSchema.safeParse('../../arquivo').success).toBe(false);
    expect(idAnexoSchema.safeParse('nao-e-uuid').success).toBe(false);
    expect(
      idAnexoSchema.safeParse('11111111-1111-4111-8111-111111111111').success,
    ).toBe(true);
  });

  it('monta download Unicode sem permitir injecao no cabecalho', () => {
    const valor = disposicaoDoAnexo('../Relatório "final"; 2027.pdf');
    expect(valor).toContain('filename="Relatorio _final__ 2027.pdf"');
    expect(valor).toContain(
      "filename*=UTF-8''Relat%C3%B3rio%20%22final%22%3B%202027.pdf",
    );
    expect(valor).not.toContain('../');
    expect(valor).not.toMatch(/[\r\n]/);
  });

  it('reconhece caractere de controle sem depender de regex', () => {
    expect(temControle('comprovante.pdf')).toBe(false);
    expect(temControle('Relatório 2027.pdf')).toBe(false);
    expect(temControle('comprovante.pdf\r\nX-Injetado: sim')).toBe(true);
    expect(temControle('nota\u0000.pdf')).toBe(true);
    expect(temControle('nota\u007f.pdf')).toBe(true);
  });
});
