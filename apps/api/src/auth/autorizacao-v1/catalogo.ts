import { z } from 'zod';

// Contrato futuro: nao alimentar permissionsForRoles com este catalogo.
// A ativacao depende das concessoes persistidas e do resolver (V1-011/012).
const INSTITUCIONAL = ['GLOBAL'] as const;
const CICLO = ['GLOBAL', 'CICLO'] as const;
const MISSAO = ['GLOBAL', 'CICLO', 'REDE'] as const;
const ORCAMENTO = ['GLOBAL', 'CICLO', 'REDE', 'TEMATICA'] as const;
const PLANEJAMENTO = [...ORCAMENTO, 'PPG', 'PARTICIPACAO'] as const;

export const TIPOS_ESCOPO_V1 = PLANEJAMENTO;
export type TipoEscopoV1 = (typeof TIPOS_ESCOPO_V1)[number];

export const CATALOGO_PERMISSOES_V1 = {
  'painel:read': { rotulo: 'Consultar painel', escopos: PLANEJAMENTO },
  'programa:read': {
    rotulo: 'Consultar programas e ciclos',
    escopos: PLANEJAMENTO,
  },
  'ppg:read': {
    rotulo: 'Consultar cadastro institucional de PPGs',
    escopos: INSTITUCIONAL,
  },
  'ppg:create': { rotulo: 'Cadastrar PPG', escopos: INSTITUCIONAL },
  'ppg:edit': { rotulo: 'Editar PPG', escopos: INSTITUCIONAL },
  // Participacao PPG-tematica (V1-034). Escopo **institucional**, e nao por
  // ciclo ou tematica, pelo mesmo argumento que tirou `ppg:write` do
  // coordenador: a participacao e ela propria alvo de concessao, e quem a cria
  // decide, de lado, o que outras contas passam a alcancar.
  'participacao:create': {
    rotulo: 'Associar PPG a área temática',
    escopos: INSTITUCIONAL,
  },
  'participacao:edit': {
    rotulo: 'Editar participação e responsável',
    escopos: INSTITUCIONAL,
  },
  'participacao:delete': {
    rotulo: 'Remover participação de PPG',
    escopos: INSTITUCIONAL,
  },
  'catalogo:read': {
    rotulo: 'Consultar catálogo e modalidades',
    escopos: INSTITUCIONAL,
  },
  'catalogo:create': {
    rotulo: 'Cadastrar item de catálogo ou modalidade',
    escopos: INSTITUCIONAL,
  },
  'catalogo:edit': {
    rotulo: 'Editar item de catálogo ou modalidade',
    escopos: INSTITUCIONAL,
  },
  'catalogo:delete': {
    rotulo: 'Excluir item de catálogo',
    escopos: INSTITUCIONAL,
  },
  'orcamento:read': { rotulo: 'Consultar orçamento', escopos: PLANEJAMENTO },
  'orcamento:edit': { rotulo: 'Alterar orçamento', escopos: ORCAMENTO },
  'plano:read': {
    rotulo: 'Consultar linhas e histórico',
    escopos: PLANEJAMENTO,
  },
  'plano:create': {
    rotulo: 'Criar linha de planejamento',
    escopos: PLANEJAMENTO,
  },
  'plano:edit': {
    rotulo: 'Editar linha de planejamento',
    escopos: PLANEJAMENTO,
  },
  'plano:cancel': {
    rotulo: 'Cancelar linha de planejamento',
    escopos: PLANEJAMENTO,
  },
  'bolsa:read': {
    rotulo: 'Consultar bolsas e mobilidade',
    escopos: PLANEJAMENTO,
  },
  'bolsa:create': {
    rotulo: 'Cadastrar concessão de bolsa',
    escopos: PLANEJAMENTO,
  },
  'bolsa:edit': { rotulo: 'Editar concessão de bolsa', escopos: PLANEJAMENTO },
  'bolsa:export': { rotulo: 'Exportar mobilidades', escopos: PLANEJAMENTO },
  'produto:read': {
    rotulo: 'Consultar produtos de bolsa',
    escopos: PLANEJAMENTO,
  },
  'produto:create': {
    rotulo: 'Cadastrar produto de bolsa',
    escopos: PLANEJAMENTO,
  },
  'produto:edit': { rotulo: 'Editar produto de bolsa', escopos: PLANEJAMENTO },
  'pessoa:read-cpf': {
    rotulo: 'Consultar CPF completo',
    escopos: PLANEJAMENTO,
  },
  'pessoa:edit-cpf': {
    rotulo: 'Corrigir CPF cadastrado',
    escopos: PLANEJAMENTO,
  },
  'pessoa:read-contato': {
    rotulo: 'Consultar contatos pessoais',
    escopos: PLANEJAMENTO,
  },
  // Eventos externos da CAPES (V1-036): o registro do que ja aconteceu la —
  // desistencia, substituicao, movimentacao de recurso. Permissao propria, e
  // nao `bolsa:edit`: corrigir periodo e rotina, registrar que alguem faleceu
  // nao e. A leitura separada permite dar o historico a quem nao registra.
  'evento:read': {
    rotulo: 'Consultar eventos externos e movimentações',
    escopos: PLANEJAMENTO,
  },
  'evento:create': {
    rotulo: 'Registrar evento externo ou movimentação',
    escopos: PLANEJAMENTO,
  },
  'evento:edit': {
    rotulo: 'Corrigir registro de evento externo',
    escopos: PLANEJAMENTO,
  },
  'pendencia:read': { rotulo: 'Consultar pendências', escopos: PLANEJAMENTO },
  'pendencia:create': { rotulo: 'Registrar pendência', escopos: PLANEJAMENTO },
  'pendencia:resolve': { rotulo: 'Resolver pendência', escopos: PLANEJAMENTO },
  'pendencia:delete': { rotulo: 'Excluir pendência', escopos: PLANEJAMENTO },
  'premissa:read': { rotulo: 'Consultar premissas', escopos: CICLO },
  'equipe-gestao:read': {
    rotulo: 'Consultar pessoas e equipes de gestão',
    escopos: MISSAO,
  },
  'equipe-gestao:create-pessoa': {
    rotulo: 'Cadastrar pessoa de gestão',
    escopos: INSTITUCIONAL,
  },
  'equipe-gestao:create': {
    rotulo: 'Cadastrar equipe de gestão',
    escopos: MISSAO,
  },
  'equipe-gestao:edit': { rotulo: 'Editar equipe de gestão', escopos: MISSAO },
  'missao:read': { rotulo: 'Consultar missões e análise', escopos: MISSAO },
  'missao:create': { rotulo: 'Criar missão', escopos: MISSAO },
  'missao:edit': { rotulo: 'Editar missão', escopos: MISSAO },
  'missao:relato': { rotulo: 'Registrar relato', escopos: MISSAO },
  'missao:confirm': { rotulo: 'Confirmar missão', escopos: MISSAO },
  'missao:cancel': { rotulo: 'Cancelar missão', escopos: MISSAO },
  'missao:close': { rotulo: 'Encerrar missão', escopos: MISSAO },
  'missao:reopen-execucao': { rotulo: 'Reabrir execução', escopos: MISSAO },
  'missao:submit': { rotulo: 'Submeter missão', escopos: MISSAO },
  'missao:decide': { rotulo: 'Decidir análise de missão', escopos: MISSAO },
  'missao:reopen-analise': { rotulo: 'Reabrir análise', escopos: MISSAO },
  'missao:dispensa': {
    rotulo: 'Conceder ou revogar dispensa de encerramento',
    escopos: MISSAO,
  },
  'missao:export': { rotulo: 'Exportar relatórios e dossiê', escopos: MISSAO },
  'produto-missao:read': {
    rotulo: 'Consultar produtos de missão',
    escopos: MISSAO,
  },
  'produto-missao:create': {
    rotulo: 'Cadastrar produto de missão',
    escopos: MISSAO,
  },
  'produto-missao:edit': {
    rotulo: 'Editar produto de missão',
    escopos: MISSAO,
  },
  'produto-missao:delete': {
    rotulo: 'Remover produto de missão',
    escopos: MISSAO,
  },
  'produto-missao:declare': {
    rotulo: 'Declarar existência de produtos',
    escopos: MISSAO,
  },
  'prestacao:read': {
    rotulo: 'Consultar prestação e despesas',
    escopos: MISSAO,
  },
  'prestacao:create': {
    rotulo: 'Cadastrar prestação e despesas',
    escopos: MISSAO,
  },
  'prestacao:edit': { rotulo: 'Editar prestação e despesas', escopos: MISSAO },
  'prestacao:delete': { rotulo: 'Remover despesa', escopos: MISSAO },
  'prestacao:submit': { rotulo: 'Enviar prestação', escopos: MISSAO },
  'prestacao:review': {
    rotulo: 'Validar ou devolver prestação',
    escopos: MISSAO,
  },
  'prestacao:export': {
    rotulo: 'Exportar relatório financeiro',
    escopos: MISSAO,
  },
  'parceiro:read': {
    rotulo: 'Consultar parceiros e contatos institucionais',
    escopos: INSTITUCIONAL,
  },
  'parceiro:create': {
    rotulo: 'Cadastrar parceiro ou contato',
    escopos: INSTITUCIONAL,
  },
  'parceiro:edit': {
    rotulo: 'Editar parceiro ou contato',
    escopos: INSTITUCIONAL,
  },
  'parceiro:status': {
    rotulo: 'Inativar ou reativar parceiro ou contato',
    escopos: INSTITUCIONAL,
  },
  'parceiro:merge': { rotulo: 'Conciliar parceiros', escopos: INSTITUCIONAL },
  'parceiro:export': {
    rotulo: 'Exportar ficha de parceiro',
    escopos: INSTITUCIONAL,
  },
  'convenio:read': { rotulo: 'Consultar convênios', escopos: INSTITUCIONAL },
  'convenio:create': { rotulo: 'Cadastrar convênio', escopos: INSTITUCIONAL },
  'convenio:edit': { rotulo: 'Editar convênio', escopos: INSTITUCIONAL },
  'convenio:status': {
    rotulo: 'Inativar ou reativar convênio',
    escopos: INSTITUCIONAL,
  },
  'documento:read': {
    rotulo: 'Consultar documentos e versões',
    escopos: PLANEJAMENTO,
  },
  'documento:create': { rotulo: 'Enviar documento', escopos: PLANEJAMENTO },
  'documento:replace': {
    rotulo: 'Substituir documento',
    escopos: PLANEJAMENTO,
  },
  'documento:deactivate': {
    rotulo: 'Inativar documento',
    escopos: PLANEJAMENTO,
  },
  'documento:download': { rotulo: 'Baixar documento', escopos: PLANEJAMENTO },
  'documento:read-pessoal': {
    rotulo: 'Acessar documento pessoal',
    escopos: PLANEJAMENTO,
  },
  'documento:read-restrito': {
    rotulo: 'Acessar documento restrito de missão',
    escopos: MISSAO,
  },
  'acesso:read': {
    rotulo: 'Consultar contas e concessões',
    escopos: INSTITUCIONAL,
  },
  'acesso:write': {
    rotulo: 'Administrar concessões de negócio',
    escopos: INSTITUCIONAL,
  },
  'acesso:delegate': {
    rotulo: 'Delegar administração de acessos',
    escopos: INSTITUCIONAL,
  },
  'acesso:manage-identidade': {
    rotulo: 'Administrar identidade e ativação de contas',
    escopos: INSTITUCIONAL,
  },
} as const;

export type PermissaoV1 = keyof typeof CATALOGO_PERMISSOES_V1;

// z.enum recebe o objeto para preservar as chaves sem uma tupla com cast.
const valores = Object.fromEntries(
  Object.keys(CATALOGO_PERMISSOES_V1).map((chave) => [chave, chave]),
) as { [P in PermissaoV1]: P };
export const permissaoV1Schema = z.enum(valores);

export function aceitaEscopo(
  permissao: PermissaoV1,
  tipo: TipoEscopoV1,
): boolean {
  const escopos: readonly TipoEscopoV1[] =
    CATALOGO_PERMISSOES_V1[permissao].escopos;
  return escopos.includes(tipo);
}
