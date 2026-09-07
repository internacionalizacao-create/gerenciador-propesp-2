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
  /** Enviar a missao para analise do Comite (CG-037). */
  'missao:submit',
  /** Decidir sobre uma rodada de analise: aprovar, ajustar, reprovar (CG-038). */
  'missao:decide',
  /** Reabrir analise ja decidida; so `admin`, e sempre com justificativa. */
  'missao:reopen',
  /**
   * Atua sobre missao de **qualquer** rede — o desligamento do recorte (CG-028).
   *
   * Esta e a unica permissao do catalogo que fala de *quais linhas* em vez de
   * *o que se pode fazer*, e a excecao e proposital. A alternativa seria o
   * servico perguntar pelo papel, e "controller nunca menciona papel" e a
   * indirecao que sustenta o modulo inteiro de autorizacao.
   *
   * Ela existe porque **quem decide precisa ver o que vai decidir**: o Comite
   * Gestor recortado por rede receberia uma fila incompleta e aprovaria menos
   * do que lhe cabe, sem nada na tela dizendo que falta missao. Deduzir isso
   * do vinculo em `membro_equipe_gestao_rede` seria fragil — hoje os dois
   * membros do Comite estao ligados as tres redes por coincidencia da carga
   * formal, e um membro novo cadastrado com uma rede so passaria a decidir
   * sobre um terco da fila em silencio.
   *
   * Ela **nao** concede escrita: o que o Comite pode fazer continua definido
   * pelas outras permissoes, e ele nao tem `missao:write` nem `missao:edit`.
   */
  'missao:all-redes',
  /** Ler e conceder escopo de acesso; ato administrativo, so do `admin`. */
  'acesso:read',
  'acesso:write',
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

    /**
     * Gestor da Rede: cuida das missoes da propria rede e as submete.
     *
     * **Recortado por rede desde a CG-028**: as missoes que ele ve e altera sao
     * as das redes do seu vinculo ativo em `membro_equipe_gestao_rede`. Nao tem
     * `missao:all-redes`, e e essa ausencia que o limita — o papel nao aparece
     * em lugar nenhum do codigo que decide o recorte.
     *
     * `parceiro:read`/`parceiro:write` sem recorte, como a matriz aprovada
     * manda: o cadastro institucional e compartilhado, e um parceiro invisivel
     * seria recadastrado em duplicidade pela rede vizinha.
     */
    'gestor-rede': [
      ...SOMENTE_LEITURA,
      'equipe-gestao:read',
      'missao:read',
      'missao:write',
      'missao:edit',
      'missao:submit',
      'parceiro:read',
      'parceiro:write',
      'prestacao:read',
      'prestacao:write',
    ],

    /**
     * Comite Gestor: analisa e decide, nao lanca.
     *
     * Nao tem `missao:write` nem `missao:edit` de proposito: quem decide sobre
     * uma missao nao deveria poder alterar o que esta julgando. `missao:reopen`
     * tambem fica de fora — desfazer decisao ja tomada e ato do `admin`.
     *
     * **`prestacao:review` saiu em 2026-09-07.** A matriz aprovada na CG-003
     * poe "le" na coluna de prestacao do Comite e reserva a validacao ao
     * Administrador; a permissao estava aqui desde antes da homologacao e
     * contradizia a decisao. Validar prestacao abate o aporte (CG-009), e quem
     * decide sobre a missao nao e quem confere a despesa dela.
     *
     * `missao:all-redes` porque o Comite le e decide sobre as tres redes.
     */
    'comite-gestor': [
      ...SOMENTE_LEITURA,
      'equipe-gestao:read',
      'missao:read',
      'missao:all-redes',
      'missao:decide',
      'parceiro:read',
      'prestacao:read',
    ],
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
