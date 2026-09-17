import { concessaoV1Schema } from './concessao';
import { podeAdministrarConcessao } from './administracao';
import { copiarModelo, IDS_MODELOS_V1 } from './modelos';
import { permissaoV1Schema, type PermissaoV1 } from './catalogo';

const id = '39a32be2-c9bd-4943-a2cf-360d1549f0be';
const outroId = '8cc4045a-efc1-4ff4-93f6-bbf63bcae13d';

describe('contrato de concessoes individuais da V1', () => {
  it('aceita decisao por rede sem exigir papel do Keycloak ou modelo', () => {
    expect(
      concessaoV1Schema.parse({
        permissao: 'missao:decide',
        escopo: { tipo: 'REDE', redeId: id },
      }).permissao,
    ).toBe('missao:decide');
  });

  it.each([
    { tipo: 'PPG', ppgId: id },
    { tipo: 'PPG', ppgId: id, cicloId: 'invalido' },
    { tipo: 'GLOBAL', ppgId: id },
    { tipo: 'PARTICIPACAO', participacaoId: id, ppgId: outroId },
    { tipo: 'REDE', redeId: id, cicloId: outroId },
  ])('recusa alvo incompleto ou ambiguo: %j', (escopo) => {
    expect(
      concessaoV1Schema.safeParse({ permissao: 'plano:read', escopo }).success,
    ).toBe(false);
  });

  it('exige ciclo de PPG e conserva a intersecao no contrato', () => {
    const entrada = {
      permissao: 'plano:create',
      escopo: { tipo: 'PPG', ppgId: id, cicloId: outroId },
    };
    expect(concessaoV1Schema.parse(entrada)).toEqual(entrada);
  });

  it.each(['acesso:write', 'parceiro:edit', 'missao:decide', 'orcamento:edit'])(
    'recusa recorte de participacao incompativel com %s',
    (permissao) => {
      expect(
        concessaoV1Schema.safeParse({
          permissao,
          escopo: { tipo: 'PARTICIPACAO', participacaoId: id },
        }).success,
      ).toBe(false);
    },
  );

  it('nao aceita papeis, curingas, permissao legada ampla ou campos ocultos', () => {
    for (const permissao of ['admin', '*', 'bolsa:write', 'missao:all-redes']) {
      expect(permissaoV1Schema.safeParse(permissao).success).toBe(false);
    }
    expect(
      concessaoV1Schema.safeParse({
        permissao: 'bolsa:read',
        escopo: { tipo: 'GLOBAL' },
        efeito: 'NEGAR',
      }).success,
    ).toBe(false);
  });

  it('personalizar copia nao altera outros usuarios e nao exige modelo', () => {
    const ana = copiarModelo('responsavel-ppg');
    ana.permissoes.push('missao:decide');
    ana.permissoes.splice(ana.permissoes.indexOf('bolsa:edit'), 1);
    const bia = copiarModelo('responsavel-ppg');
    expect(bia.permissoes).toContain('bolsa:edit');
    expect(bia.permissoes).not.toContain('missao:decide');
    expect(
      concessaoV1Schema.safeParse({
        permissao: 'missao:decide',
        escopo: { tipo: 'CICLO', cicloId: id },
      }).success,
    ).toBe(true);
  });

  it('modelos comuns nao incluem capacidades pessoais nem administrativas por acidente', () => {
    for (const nome of [
      'consulta',
      'gestor-rede',
      'comite-gestor',
      'responsavel-ppg',
    ] as const) {
      const { permissoes } = copiarModelo(nome);
      expect(permissoes).not.toContain('pessoa:read-cpf');
      expect(permissoes).not.toContain('documento:read-pessoal');
      expect(permissoes).not.toContain('acesso:write');
    }
    expect(copiarModelo('secretaria').permissoes).toContain(
      'documento:read-pessoal',
    );
    expect(copiarModelo('comite-gestor').permissoes).not.toContain(
      'prestacao:review',
    );
    expect(copiarModelo('gestor-rede').permissoes).not.toContain(
      'missao:decide',
    );
    for (const modelo of IDS_MODELOS_V1) {
      const { permissoes } = copiarModelo(modelo);
      expect(permissoes).not.toContain('acesso:delegate');
      expect(new Set(permissoes).size).toBe(permissoes.length);
      for (const permissao of permissoes)
        expect(permissaoV1Schema.safeParse(permissao).success).toBe(true);
    }
  });
});

describe('politica de administracao a integrar em V1-017', () => {
  const entrada = {
    atorId: id,
    alvoId: outroId,
    atorAtivo: true,
    capacidadesGlobais: ['acesso:write'] as PermissaoV1[],
    permissao: 'missao:decide' as PermissaoV1,
  };

  it('permite ao administrador atribuir acao de negocio que ele nao exerce', () => {
    expect(podeAdministrarConcessao(entrada)).toBe(true);
    expect(
      podeAdministrarConcessao({ ...entrada, capacidadesGlobais: [] }),
    ).toBe(false);
  });

  it('exige delegacao adicional para conceder, editar ou revogar privilegio de acesso', () => {
    for (const permissao of [
      'acesso:read',
      'acesso:write',
      'acesso:delegate',
      'acesso:manage-identidade',
    ] as const) {
      expect(podeAdministrarConcessao({ ...entrada, permissao })).toBe(false);
      expect(
        podeAdministrarConcessao({
          ...entrada,
          permissao,
          capacidadesGlobais: ['acesso:write', 'acesso:delegate'],
        }),
      ).toBe(true);
    }
  });

  it('nao permite autoalteracao nem bypass de conta inativa mesmo com delegacao', () => {
    const delegado = {
      ...entrada,
      capacidadesGlobais: ['acesso:write', 'acesso:delegate'] as PermissaoV1[],
    };
    expect(podeAdministrarConcessao({ ...delegado, alvoId: id })).toBe(false);
    expect(podeAdministrarConcessao({ ...delegado, atorAtivo: false })).toBe(
      false,
    );
    expect(
      podeAdministrarConcessao({
        ...entrada,
        capacidadesGlobais: ['acesso:delegate'],
      }),
    ).toBe(false);
  });
});
