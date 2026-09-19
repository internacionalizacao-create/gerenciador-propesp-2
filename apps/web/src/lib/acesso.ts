/**
 * Capacidades efetivas da conta, do lado da interface (V1-019).
 *
 * Desde V1-012 a lista de `/me` vem de `concessao_acesso`, e não mais de papel
 * — então ela **é** a resposta para "esta tela tem o que mostrar?". Quem barra
 * de fato continua sendo o guard da API; o que estas funções evitam é a tela
 * que só existe para devolver 403.
 *
 * Módulo neutro de propósito: sem `server-only` e sem JSX, para o
 * `node --test` conseguir carregá-lo (AGENTS.md §9).
 */

/**
 * O que falta para a tela funcionar, na ordem em que foi pedido.
 *
 * Devolve a lista, e não um booleano, porque a tela precisa **dizer** o que
 * falta: "você não tem acesso" sem o quê deixa a pessoa sem nada para pedir a
 * quem administra.
 */
export function faltando(
  concedidas: readonly string[],
  exigidas: readonly string[],
): string[] {
  return exigidas.filter((permissao) => !concedidas.includes(permissao));
}

/** `true` só quando a conta tem **todas** as ações — o mesmo AND do guard. */
export function pode(
  concedidas: readonly string[],
  ...exigidas: readonly string[]
): boolean {
  return faltando(concedidas, exigidas).length === 0;
}

/**
 * Nome de cada módulo do catálogo, em linguagem de tela.
 *
 * Mora aqui, e não no formulário de concessão, porque as três telas de acesso
 * usam o mesmo vocabulário — e porque este módulo não importa nada: é o que o
 * `node --test` consegue carregar (AGENTS.md §9).
 */
export const NOME_DO_MODULO: Record<string, string> = {
  acesso: "Administração de acessos",
  bolsa: "Bolsas e mobilidade",
  catalogo: "Catálogo e modalidades",
  convenio: "Convênios",
  documento: "Documentos",
  "equipe-gestao": "Equipes de gestão",
  missao: "Missões do Comitê",
  orcamento: "Orçamento",
  painel: "Painel",
  parceiro: "Parceiros e contatos",
  pendencia: "Pendências",
  pessoa: "Dados pessoais",
  plano: "Plano de aplicação",
  premissa: "Premissas",
  produto: "Produtos de bolsa",
  "produto-missao": "Produtos de missão",
  programa: "Programas e ciclos",
  prestacao: "Prestação de contas",
  ppg: "PPGs",
};

/**
 * Verbo de cada sufixo de ação.
 *
 * A tabela existe para a tela falar em português: `plano:create` é código de
 * autorização, e mostrá-lo sozinho a quem não administra acessos não explica
 * nada. Sufixo desconhecido cai nele mesmo — inventar um verbo seria pior do
 * que mostrar o nome cru de uma ação nova.
 */
const VERBO_DA_ACAO: Record<string, string> = {
  read: "consultar",
  "read-cpf": "consultar CPF completo",
  "edit-cpf": "corrigir CPF cadastrado",
  "read-contato": "consultar contatos pessoais",
  "read-pessoal": "consultar documentos pessoais",
  "read-restrito": "consultar documentos restritos",
  create: "cadastrar",
  "create-pessoa": "cadastrar pessoa",
  edit: "editar",
  write: "alterar",
  delete: "excluir",
  cancel: "cancelar",
  close: "encerrar",
  confirm: "confirmar",
  decide: "decidir",
  declare: "declarar",
  delegate: "delegar administração",
  export: "exportar",
  "manage-identidade": "reassociar identidade",
  merge: "conciliar",
  relato: "relatar",
  "reopen-analise": "reabrir análise",
  "reopen-execucao": "reabrir execução",
  resolve: "resolver",
  review: "revisar",
  status: "ativar ou inativar",
  submit: "enviar para análise",
};

/** Uma ação do catálogo em linguagem de tela: "Plano de aplicação · consultar". */
export function descreverPermissao(permissao: string): string {
  const [modulo, acao = ""] = permissao.split(":");

  return `${NOME_DO_MODULO[modulo] ?? modulo} · ${VERBO_DA_ACAO[acao] ?? acao}`;
}
