/**
 * Catalogo de permissoes da aplicacao.
 *
 * Os controllers falam SEMPRE em permissao (`plano:write`), nunca em papel
 * (`coordenador`). Papel e uma forma de conceder permissao, e hoje a unica —
 * quando o sistema evoluir para escopo por PPG (system-structl.md §3.5), so
 * `permissionsForRoles` e substituido; nenhum controller muda.
 *
 * Os verbos seguem o dominio de system-structl.md, nao o generico de CRUD:
 * `orcamento:write` e ato da PROPESP, `plano:write` e ato de quem planeja.
 */
export const PERMISSIONS = [
  'painel:read',
  'programa:read',
  'programa:write',
  'ppg:read',
  'ppg:write',
  'orcamento:read',
  'orcamento:write',
  'plano:read',
  'plano:write',
  /** Editar registro existente e ato administrativo com trilha de auditoria. */
  'plano:edit',
  'bolsa:read',
  'bolsa:write',
  'produto:read',
  'produto:write',
  'catalogo:read',
  /** Mantida para programas futuros; no CAPES Global o catalogo e fechado. */
  'catalogo:write',
  'pendencia:read',
  'pendencia:write',
  'premissa:read',
  'premissa:write',
  'relatorio:read',
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

export type Permission = (typeof PERMISSIONS)[number];

const SOMENTE_LEITURA = [
  'painel:read',
  'programa:read',
  'ppg:read',
  'orcamento:read',
  'plano:read',
  'bolsa:read',
  'produto:read',
  'catalogo:read',
  'pendencia:read',
  'premissa:read',
  'relatorio:read',
] as const satisfies readonly Permission[];

/**
 * Papeis de realm do Keycloak -> permissoes que cada um concede.
 *
 * O mapa traduz os quatro perfis de system-structl.md §3.5 para os papeis que o
 * realm ja tem: `admin` e a Gestao PROPESP, `coordenador` e a Coordenacao de
 * PPG, `docente` e o membro de comite tematico, `discente` e consulta.
 *
 * Papel que nao estiver aqui simplesmente nao concede nada (nao e erro): o
 * Keycloak adiciona papeis proprios como `offline_access` e `uma_authorization`
 * a todo token, e eles nao significam nada para o dominio.
 */
export const ROLE_PERMISSIONS: Readonly<Record<string, readonly Permission[]>> =
  {
    /** Gestao PROPESP: administra o cadastro; atos da CAPES sao apenas registrados. */
    admin: PERMISSIONS,

    /**
     * Coordenacao de PPG: lanca o que e do seu PPG e le o consolidado.
     * Nao edita orcamento nem catalogo — sao atos que atravessam PPGs (§3.5).
     */
    coordenador: [
      ...SOMENTE_LEITURA,
      'ppg:write',
      'plano:write',
      'bolsa:write',
      'produto:write',
      'pendencia:write',
    ],

    /** Apoio administrativo da PROPESP: registra, nao decide. */
    secretaria: [
      ...SOMENTE_LEITURA,
      'bolsa:write',
      'produto:write',
      'pendencia:write',
    ],

    /** Membro de comite tematico: acompanha e aponta pendencia na sua tematica. */
    docente: [...SOMENTE_LEITURA, 'pendencia:write'],

    /** Consulta. */
    discente: [...SOMENTE_LEITURA],
  };

/** Uniao das permissoes de todos os papeis do usuario, sem repeticao. */
export function permissionsForRoles(roles: readonly string[]): Permission[] {
  const concedidas = new Set<Permission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSIONS[role] ?? []) {
      concedidas.add(permission);
    }
  }

  return [...concedidas];
}
