import {
  atualizarMembroEquipeSchema,
  criarMembroEquipeSchema,
  pessoaRapidaSchema,
} from './comite-gestor.service';

const vinculo = {
  tipoEquipe: 'COMITE_GESTOR' as const,
  funcao: 'Coordenadora',
  dataInicio: '2027-01-01',
  dataFim: null,
};

describe('schemas do Comite Gestor', () => {
  it('aceita uma pessoa existente no vinculo', () => {
    const resultado = criarMembroEquipeSchema.safeParse({
      ...vinculo,
      pessoaId: '00000000-0000-4000-8000-000000000001',
    });
    expect(resultado.success).toBe(true);
  });

  it('aceita e normaliza uma nova pessoa reutilizavel', () => {
    const resultado = criarMembroEquipeSchema.parse({
      ...vinculo,
      novaPessoa: {
        nome: 'Pessoa de Teste',
        cpf: '529.982.247-25',
        tipo: 'EXTERNO',
      },
    });
    expect(resultado.novaPessoa?.cpf).toBe('52998224725');
  });

  it('aceita servidor no cadastro de pessoa', () => {
    const resultado = pessoaRapidaSchema.safeParse({
      nome: 'Servidor da Universidade',
      tipo: 'SERVIDOR',
    });
    expect(resultado.success).toBe(true);
  });

  it('exige escolher entre pessoa existente e nova', () => {
    expect(criarMembroEquipeSchema.safeParse(vinculo).success).toBe(false);
    expect(
      criarMembroEquipeSchema.safeParse({
        ...vinculo,
        pessoaId: '00000000-0000-4000-8000-000000000001',
        novaPessoa: { nome: 'Pessoa de Teste', tipo: 'EXTERNO' },
      }).success,
    ).toBe(false);
  });

  it('recusa CPF e periodo invalidos', () => {
    expect(
      pessoaRapidaSchema.safeParse({
        nome: 'Pessoa de Teste',
        cpf: '111.111.111-11',
        tipo: 'EXTERNO',
      }).success,
    ).toBe(false);
    expect(
      atualizarMembroEquipeSchema.safeParse({
        ...vinculo,
        dataInicio: '2027-02-01',
        dataFim: '2027-01-31',
      }).success,
    ).toBe(false);
  });
});
