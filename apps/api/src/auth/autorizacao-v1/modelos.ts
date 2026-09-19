import { CATALOGO_PERMISSOES_V1, type PermissaoV1 } from './catalogo';

const CONSULTA = [
  'painel:read',
  'programa:read',
  'ppg:read',
  'catalogo:read',
  'orcamento:read',
  'plano:read',
  'bolsa:read',
  'produto:read',
  'pendencia:read',
  'premissa:read',
  'documento:read',
  'documento:download',
] as const satisfies readonly PermissaoV1[];

const RESPONSAVEL = [
  ...CONSULTA,
  'plano:create',
  'plano:cancel',
  'bolsa:create',
  'bolsa:edit',
  'produto:create',
  'produto:edit',
  'pendencia:create',
  'pendencia:resolve',
  'documento:create',
  'documento:replace',
] as const satisfies readonly PermissaoV1[];

interface ModeloAcesso {
  readonly rotulo: string;
  readonly permissoes: readonly PermissaoV1[];
}

// Modelos selecionam acoes, nunca inventam GLOBAL quando falta um alvo.
// Nao sao papeis: a UI exige o alcance de cada acao antes de salvar concessoes.
const MODELOS = {
  administrador: {
    rotulo: 'Administrador PROPESP',
    // Delegar administracao e escolha separada, inclusive neste modelo.
    permissoes: (Object.keys(CATALOGO_PERMISSOES_V1) as PermissaoV1[]).filter(
      (p) => p !== 'acesso:delegate',
    ),
  },
  secretaria: {
    rotulo: 'Apoio administrativo PROPESP',
    permissoes: [
      ...CONSULTA,
      'bolsa:create',
      'bolsa:edit',
      'bolsa:export',
      'produto:create',
      'produto:edit',
      'pendencia:create',
      'pendencia:resolve',
      'pessoa:read-cpf',
      'pessoa:edit-cpf',
      'pessoa:read-contato',
      'documento:read-pessoal',
      'documento:create',
      'documento:replace',
    ],
  },
  'responsavel-ppg': { rotulo: 'Responsável de PPG', permissoes: RESPONSAVEL },
  'responsavel-tematica': {
    rotulo: 'Responsável temático',
    permissoes: RESPONSAVEL,
  },
  'gestor-rede': {
    rotulo: 'Gestor da Rede',
    permissoes: [
      ...CONSULTA,
      'equipe-gestao:read',
      'missao:read',
      'missao:create',
      'missao:edit',
      'missao:relato',
      'missao:confirm',
      'missao:cancel',
      'missao:close',
      'missao:reopen-execucao',
      'missao:submit',
      'missao:export',
      'produto-missao:read',
      'produto-missao:create',
      'produto-missao:edit',
      'produto-missao:delete',
      'produto-missao:declare',
      'prestacao:read',
      'prestacao:create',
      'prestacao:edit',
      'prestacao:delete',
      'prestacao:submit',
      'prestacao:export',
      'parceiro:read',
      'parceiro:create',
      'parceiro:edit',
      'parceiro:status',
      'parceiro:merge',
      'parceiro:export',
      'convenio:read',
      'convenio:create',
      'convenio:edit',
      'convenio:status',
      'documento:create',
      'documento:replace',
      'documento:deactivate',
    ],
  },
  'comite-gestor': {
    rotulo: 'Comitê Gestor',
    permissoes: [
      ...CONSULTA,
      'equipe-gestao:read',
      'missao:read',
      'missao:decide',
      'missao:dispensa',
      'missao:export',
      'produto-missao:read',
      'prestacao:read',
      'prestacao:export',
      'parceiro:read',
      'parceiro:export',
      'convenio:read',
      'documento:read-restrito',
    ],
  },
  consulta: { rotulo: 'Consulta interna', permissoes: CONSULTA },
} as const satisfies Record<string, ModeloAcesso>;

export type ModeloAcessoV1 = keyof typeof MODELOS;
export const IDS_MODELOS_V1 = Object.keys(MODELOS) as ModeloAcessoV1[];

/** Copia independente: personalizar uma conta nao muda o modelo nem outra conta. */
export function copiarModelo(id: ModeloAcessoV1): {
  rotulo: string;
  permissoes: PermissaoV1[];
} {
  return {
    rotulo: MODELOS[id].rotulo,
    permissoes: [...MODELOS[id].permissoes],
  };
}
