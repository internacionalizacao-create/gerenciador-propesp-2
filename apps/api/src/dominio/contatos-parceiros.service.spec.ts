import {
  atualizarContatoParceiroSchema,
  criarContatoParceiroSchema,
  listarContatosParceirosSchema,
} from './contatos-parceiros.service';

describe('schemas de contatos dos parceiros', () => {
  it('aplica defaults somente no cadastro', () => {
    const criado = criarContatoParceiroSchema.parse({
      instituicaoId: '00000000-0000-4000-8000-000000000001',
      nome: 'Contato Internacional',
    });
    expect(criado).toMatchObject({
      principal: false,
      confirmarPossivelDuplicidade: false,
    });

    expect(atualizarContatoParceiroSchema.parse({ cargo: 'Diretora' })).toEqual(
      { cargo: 'Diretora' },
    );
  });

  it('valida e-mail e converte campos vazios em nulo', () => {
    const resultado = atualizarContatoParceiroSchema.parse({
      email: '',
      telefone: '',
    });
    expect(resultado).toEqual({ email: null, telefone: null });
    expect(
      atualizarContatoParceiroSchema.safeParse({ email: 'invalido' }).success,
    ).toBe(false);
  });

  it('normaliza a opcao de incluir inativos da query string', () => {
    expect(listarContatosParceirosSchema.parse({}).incluirInativos).toBe(false);
    expect(
      listarContatosParceirosSchema.parse({ incluirInativos: 'true' })
        .incluirInativos,
    ).toBe(true);
  });
});
