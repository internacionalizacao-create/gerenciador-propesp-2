/**
 * Menu do sistema (system-structl.md §6).
 *
 * Os módulos que ainda não existem continuam listados aqui com
 * `disponivel: false` e o motivo, como régua do escopo que ainda vem. Desde
 * 2026-09-10 o menu lateral **não os mostra**: a tela passou a ser usada em
 * apresentação, e item "em breve" lia como sistema inacabado. Para voltar a
 * exibi-los, basta o `MenuLateral` deixar de filtrar por `disponivel`.
 *
 * **Desde V1-019 o menu é montado por capacidade.** Cada item declara em
 * `exige` as ações que a sua tela precisa — as mesmas que o guard cobra do
 * endpoint principal dela —, e quem não as tem não vê o item. O motivo não é
 * segurança (quem barra é a API, e editar a URL não contorna nada): é que item
 * que só responde "sem acesso" faz o sistema parecer quebrado para quem foi
 * configurado corretamente para outra coisa.
 *
 * A consequência é proposital: **conta recém-criada vê quase nada**, porque
 * ainda não recebeu concessão nenhuma. O menu curto é a resposta certa, e o
 * lugar que explica isso é a tela "Sua conta".
 */

export interface ItemMenu {
  rotulo: string;
  href: string;
  disponivel: boolean;
  /** Por que ainda não está disponível — vira o `title` do item. */
  motivo?: string;
  /**
   * Ações que a tela exige, todas elas. Item sem `exige` aparece sempre: são
   * as telas que qualquer conta autenticada abre (a caixa de avisos é dela
   * mesma; "Sua conta" explica o próprio acesso).
   */
  exige?: readonly string[];
}

export interface GrupoMenu {
  titulo: string;
  itens: ItemMenu[];
}

export function menu(
  programaSlug: string,
  cicloNome: string,
  permissoes: readonly string[] = [],
): GrupoMenu[] {
  const ciclo = `/programas/${programaSlug}/${cicloNome}`;

  const grupos: GrupoMenu[] = [
    {
      titulo: "Visão geral",
      itens: [
        {
          rotulo: "Resumo do orçamento anual",
          href: "/",
          disponivel: true,
          exige: ["painel:read"],
        },
        {
          rotulo: "Mobilidade",
          href: "/mobilidade",
          disponivel: true,
          exige: ["bolsa:read"],
        },
        {
          rotulo: "Mapa e destinos",
          href: "/mobilidade/mapa",
          disponivel: true,
          exige: ["bolsa:read"],
        },
        {
          rotulo: "Produção",
          href: "/producao",
          disponivel: true,
          // Duas ações porque a tela junta produto de bolsa e de missão numa
          // consulta só (`union all`); sem as duas, metade da tabela some.
          exige: ["bolsa:read", "produto:read"],
        },
        {
          rotulo: "Bolsistas",
          href: "/mobilidade/bolsistas",
          disponivel: true,
          exige: ["bolsa:read"],
        },
      ],
    },
    {
      titulo: "Planejamento",
      itens: [
        {
          rotulo: "Programas",
          href: "/programas",
          disponivel: true,
          exige: ["programa:read"],
        },
        {
          rotulo: "Ciclo atual",
          href: ciclo,
          disponivel: true,
          exige: ["programa:read"],
        },
        {
          rotulo: "Redes e temáticas",
          href: `${ciclo}/redes`,
          disponivel: true,
          exige: ["orcamento:read"],
        },
        {
          rotulo: "Orçamento",
          href: `${ciclo}/orcamento`,
          disponivel: true,
          exige: ["orcamento:read"],
        },
        {
          rotulo: "Plano de aplicação",
          href: `${ciclo}/plano`,
          disponivel: true,
          exige: ["plano:read"],
        },
        {
          rotulo: "Comitê Gestor e Administração",
          href: `${ciclo}/comite-gestor`,
          disponivel: true,
          exige: ["equipe-gestao:read"],
        },
        // Sob o ciclo porque o vínculo com rede é do ciclo; a instituição em si
        // é global e o detalhe mostra o histórico inteiro dela.
        {
          rotulo: "Parceiros",
          href: `${ciclo}/parceiros`,
          disponivel: true,
          exige: ["parceiro:read"],
        },
      ],
    },
    {
      titulo: "Execução",
      itens: [
        {
          rotulo: "Execução financeira",
          href: `${ciclo}/execucao`,
          disponivel: false,
          motivo:
            "Fora do escopo do CAPES Global: os recursos são pagos diretamente pela CAPES e não entram no caixa da UEA.",
        },
        {
          rotulo: "Remanejamentos",
          href: `${ciclo}/remanejamentos`,
          disponivel: false,
          motivo:
            "O Gerenciador apenas registrará movimentações já realizadas na CAPES, sempre dentro da mesma temática.",
        },
      ],
    },
    {
      titulo: "Cadastros",
      itens: [
        // A caixa de entrada é da pessoa, não de um ciclo (D-11): fica fora
        // de `programas/[programa]/[ciclo]` porque um aviso sobre missão de
        // ciclo encerrado continua sendo dela. Sem `exige`: o endpoint lista
        // as notificações do próprio destinatário e não cobra permissão.
        { rotulo: "Avisos", href: "/avisos", disponivel: true },
        {
          rotulo: "PPGs",
          href: "/ppgs",
          disponivel: true,
          exige: ["ppg:read"],
        },
        {
          rotulo: "Catálogo de bolsas",
          href: "/catalogos/bolsas",
          disponivel: true,
          exige: ["catalogo:read"],
        },
        {
          rotulo: "Modalidades",
          href: "/catalogos/modalidades",
          disponivel: true,
          exige: ["catalogo:read"],
        },
        {
          rotulo: "Acessos",
          href: "/configuracoes/acessos",
          disponivel: true,
          exige: ["acesso:read"],
        },
      ],
    },
    {
      titulo: "Ainda por vir",
      itens: [
        {
          rotulo: "Convênios",
          href: "/convenios",
          disponivel: false,
          motivo: "Fase 2 — nenhum convênio foi levantado ainda.",
        },

        {
          rotulo: "Relatórios",
          href: "/relatorios",
          disponivel: false,
          motivo:
            "Precisa consolidar planejamento, bolsistas, documentos, produtos e movimentações registradas.",
        },
        {
          rotulo: "Importação",
          href: "/importacao",
          disponivel: false,
          motivo:
            "Precisa dos adaptadores por programa (GCUB, Erasmus) — resposta Q9.",
        },
      ],
    },
  ];

  return grupos
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter(alcancado(permissoes)),
    }))
    .filter((grupo) => grupo.itens.length > 0);
}

/**
 * Item que a conta alcança.
 *
 * O que ainda não existe continua passando: `disponivel: false` é escopo
 * futuro, não falta de permissão, e misturar os dois faria o módulo por vir
 * sumir da régua no dia em que alguém rodasse o sistema sem concessões.
 */
function alcancado(permissoes: readonly string[]) {
  return (item: ItemMenu) =>
    !item.exige || item.exige.every((acao) => permissoes.includes(acao));
}
