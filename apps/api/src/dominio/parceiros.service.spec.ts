import {
  atualizarParceiroSchema,
  criarParceiroSchema,
  listarParceirosSchema,
} from './parceiros.service';

describe('schemas de parceiros', () => {
  it('aplica defaults somente na criacao', () => {
    const criado = criarParceiroSchema.parse({ nome: 'Universidade Parceira' });
    expect(criado).toMatchObject({
      cadastroProvisorio: false,
      redeIds: [],
      confirmarPossivelDuplicidade: false,
    });

    const atualizado = atualizarParceiroSchema.parse({ cidade: 'Lisboa' });
    expect(atualizado).toEqual({ cidade: 'Lisboa' });
  });

  it('normaliza filtros booleanos recebidos pela query string', () => {
    expect(listarParceirosSchema.parse({}).incluirInativos).toBe(false);
    expect(
      listarParceirosSchema.parse({ incluirInativos: 'true' }).incluirInativos,
    ).toBe(true);
  });
});
