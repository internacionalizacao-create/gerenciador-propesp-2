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

  it('reserva a edicao auditavel do plano ao admin', () => {
    expect(permissionsForRoles(['admin'])).toContain('plano:edit');
    for (const papel of ['coordenador', 'secretaria', 'docente', 'discente']) {
      expect(permissionsForRoles([papel])).not.toContain('plano:edit');
    }
  });

  it('permite a coordenacao e a secretaria registrarem bolsas e produtos', () => {
    for (const papel of ['coordenador', 'secretaria']) {
      const permissoes = permissionsForRoles([papel]);
      expect(permissoes).toContain('bolsa:write');
      expect(permissoes).toContain('produto:write');
    }
    for (const papel of ['docente', 'discente']) {
      const permissoes = permissionsForRoles([papel]);
      expect(permissoes).not.toContain('bolsa:write');
      expect(permissoes).not.toContain('produto:write');
    }
  });

  it('reserva orcamento, catalogo e cadastro de PPG a PROPESP', () => {
    // §3.5: acoes que atravessam PPGs — definir orcamento, publicar catalogo —
    // nao pertencem a quem coordena um PPG so. Este teste e o que impede a
    // regra de se perder num ajuste distraido do mapa.
    //
    // `ppg:write` entrou na lista em 2026-09-08: o cadastro institucional
    // (PPG, modalidade e catalogo) passou a ser exclusivo do administrador.
    for (const papel of ['coordenador', 'secretaria', 'docente', 'discente']) {
      const permissoes = permissionsForRoles([papel]);
      expect(permissoes).not.toContain('orcamento:write');
      expect(permissoes).not.toContain('catalogo:write');
      expect(permissoes).not.toContain('ppg:write');
    }

    expect(permissionsForRoles(['admin'])).toEqual(
      expect.arrayContaining(['ppg:write', 'catalogo:write']),
    );
  });

  it('reserva comite gestor, missoes e prestacoes ao admin nesta etapa', () => {
    const novas = [
      'equipe-gestao:read',
      'equipe-gestao:write',
      'missao:read',
      'missao:write',
      'missao:edit',
      'parceiro:read',
      'parceiro:write',
      'prestacao:read',
      'prestacao:write',
      'prestacao:review',
    ] as const;

    for (const permissao of novas) {
      expect(permissionsForRoles(['admin'])).toContain(permissao);
      for (const papel of [
        'coordenador',
        'secretaria',
        'docente',
        'discente',
      ]) {
        expect(permissionsForRoles([papel])).not.toContain(permissao);
      }
    }
  });

  it('todo papel mapeado enxerga o painel', () => {
    // O consolidado institucional e governanca, nao sigilo (§3.5).
    for (const papel of Object.keys(ROLE_PERMISSIONS)) {
      expect(permissionsForRoles([papel])).toContain('painel:read');
    }
  });

  it('quem decide sobre a missao nao pode altera-la', () => {
    const comite = permissionsForRoles(['comite-gestor']);

    expect(comite).toContain('missao:decide');
    // A separacao e o ponto do papel: julgar o que se pode reescrever no meio
    // da analise esvaziaria a decisao registrada.
    expect(comite).not.toContain('missao:write');
    expect(comite).not.toContain('missao:edit');
    expect(comite).not.toContain('missao:submit');
    // Desfazer decisao ja tomada e ato do `admin`, com justificativa.
    expect(comite).not.toContain('missao:reopen');
  });

  it('o gestor de rede envia, mas nao decide', () => {
    const gestor = permissionsForRoles(['gestor-rede']);

    expect(gestor).toContain('missao:submit');
    expect(gestor).toContain('missao:write');
    expect(gestor).not.toContain('missao:decide');
    expect(gestor).not.toContain('missao:reopen');
  });

  it('reabrir analise e exclusivo do admin', () => {
    expect(permissionsForRoles(['admin'])).toContain('missao:reopen');
    for (const papel of Object.keys(ROLE_PERMISSIONS)) {
      if (papel === 'admin') continue;
      expect(permissionsForRoles([papel])).not.toContain('missao:reopen');
    }
  });

  it('conceder acesso e ato exclusivo do admin', () => {
    for (const papel of Object.keys(ROLE_PERMISSIONS)) {
      if (papel === 'admin') continue;
      expect(permissionsForRoles([papel])).not.toContain('acesso:write');
    }
  });
});
