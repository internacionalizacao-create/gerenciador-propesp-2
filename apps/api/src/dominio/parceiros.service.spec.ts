import {
  atualizarParceiroSchema,
  criarParceiroSchema,
  listarParceirosSchema,
} from './parceiros.service';

describe('schemas de parceiros', () => {
  it('aplica defaults somente na criacao', () => {
    const criado = criarParceiroSchema.parse({
      nome: 'Universidade Parceira',
      // Obrigatoria desde a BOL-030: nao ha default, e nao pode haver — um
      // default inventaria de onde a instituicao veio.
      origemRelacionamento: 'PROSPECCAO_INSTITUCIONAL',
    });
    expect(criado).toMatchObject({
      cadastroProvisorio: false,
      redeIds: [],
      confirmarPossivelDuplicidade: false,
      estagioRelacionamento: 'IDENTIFICADA',
    });

    const atualizado = atualizarParceiroSchema.parse({ cidade: 'Lisboa' });
    expect(atualizado).toEqual({ cidade: 'Lisboa' });
  });

  it('a origem e obrigatoria no cadastro e ausente na edicao', () => {
    // Sem origem o cadastro nao passa: e a pergunta que o proximo contato
    // precisa responder, e seis meses depois ninguem lembra.
    expect(() => criarParceiroSchema.parse({ nome: 'Sem Origem' })).toThrow();

    // E reescreve-la e impossivel pelo endpoint de edicao: o campo enviado a
    // mais e simplesmente descartado.
    const atualizado = atualizarParceiroSchema.parse({
      cidade: 'Porto',
      origemRelacionamento: 'EVENTO_INTERNACIONAL',
    });
    expect(atualizado).toEqual({ cidade: 'Porto' });
  });

  it('normaliza filtros booleanos recebidos pela query string', () => {
    expect(listarParceirosSchema.parse({}).incluirInativos).toBe(false);
    expect(
      listarParceirosSchema.parse({ incluirInativos: 'true' }).incluirInativos,
    ).toBe(true);
  });
});
