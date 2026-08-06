import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  permissionsForRoles,
} from './permissions';

describe('permissionsForRoles', () => {
  it('nao concede nada para quem nao tem papel', () => {
    expect(permissionsForRoles([])).toEqual([]);
  });

  it('ignora papeis internos do Keycloak', () => {
    // O Keycloak coloca estes em todo token; eles nao significam nada aqui.
    expect(
      permissionsForRoles(['offline_access', 'uma_authorization']),
    ).toEqual([]);
  });

  it('da a admin todas as permissoes do catalogo', () => {
    expect(permissionsForRoles(['admin']).sort()).toEqual(
      [...PERMISSIONS].sort(),
    );
  });

  it('une as permissoes de multiplos papeis sem repetir', () => {
    const permissoes = permissionsForRoles(['docente', 'coordenador']);

    expect(new Set(permissoes).size).toBe(permissoes.length);
    // `ppg:read` vem dos dois papeis e aparece uma vez so.
    expect(permissoes).toContain('ppg:read');
    // `plano:write` so existe em coordenador.
    expect(permissoes).toContain('plano:write');
  });

  it('nao deixa docente lancar plano', () => {
    expect(permissionsForRoles(['docente'])).not.toContain('plano:write');
  });

  it('reserva orcamento e catalogo a PROPESP', () => {
    // §3.5: acoes que atravessam PPGs — definir orcamento, publicar catalogo —
    // nao pertencem a quem coordena um PPG so. Este teste e o que impede a
    // regra de se perder num ajuste distraido do mapa.
    for (const papel of ['coordenador', 'secretaria', 'docente', 'discente']) {
      const permissoes = permissionsForRoles([papel]);
      expect(permissoes).not.toContain('orcamento:write');
      expect(permissoes).not.toContain('catalogo:write');
    }
  });

  it('todo papel mapeado enxerga o painel', () => {
    // O consolidado institucional e governanca, nao sigilo (§3.5).
    for (const papel of Object.keys(ROLE_PERMISSIONS)) {
      expect(permissionsForRoles([papel])).toContain('painel:read');
    }
  });
});
