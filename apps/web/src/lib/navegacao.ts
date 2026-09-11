/**
 * Menu do sistema (system-structl.md §6).
 *
 * Os módulos que ainda não existem continuam listados aqui com
 * `disponivel: false` e o motivo, como régua do escopo que ainda vem. Desde
 * 2026-09-10 o menu lateral **não os mostra**: a tela passou a ser usada em
 * apresentação, e item "em breve" lia como sistema inacabado. Para voltar a
 * exibi-los, basta o `MenuLateral` deixar de filtrar por `disponivel`.
 */

export interface ItemMenu {
  rotulo: string;
  href: string;
  disponivel: boolean;
  /** Por que ainda não está disponível — vira o `title` do item. */
  motivo?: string;
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

  return [
    {
      titulo: "Visão geral",
      itens: [
        { rotulo: "Resumo do orçamento anual", href: "/", disponivel: true },
        {
          rotulo: "Mobilidade",
          href: "/mobilidade",
          disponivel: true,
        },
        {
          rotulo: "Mapa e destinos",
          href: "/mobilidade/mapa",
          disponivel: true,
        },
        { rotulo: "Produção", href: "/producao", disponivel: true },
        {
          rotulo: "Bolsistas",
          href: "/mobilidade/bolsistas",
          disponivel: true,
        },
      ],
    },
    {
      titulo: "Planejamento",
      itens: [
        { rotulo: "Programas", href: "/programas", disponivel: true },
        { rotulo: "Ciclo atual", href: ciclo, disponivel: true },
        {
          rotulo: "Redes e temáticas",
          href: `${ciclo}/redes`,
          disponivel: true,
        },
        { rotulo: "Orçamento", href: `${ciclo}/orcamento`, disponivel: true },
        {
          rotulo: "Plano de aplicação",
          href: `${ciclo}/plano`,
          disponivel: true,
        },
        ...(permissoes.includes("equipe-gestao:read")
          ? [
              {
                rotulo: "Comitê Gestor e Administração",
                href: `${ciclo}/comite-gestor`,
                disponivel: true,
              },
            ]
          : []),
        // Sob o ciclo porque o vínculo com rede é do ciclo; a instituição em si
        // é global e o detalhe mostra o histórico inteiro dela.
        ...(permissoes.includes("parceiro:read")
          ? [
              {
                rotulo: "Parceiros",
                href: `${ciclo}/parceiros`,
                disponivel: true,
              },
            ]
          : []),
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
        // ciclo encerrado continua sendo dela.
        { rotulo: "Avisos", href: "/avisos", disponivel: true },
        { rotulo: "PPGs", href: "/ppgs", disponivel: true },
        {
          rotulo: "Catálogo de bolsas",
          href: "/catalogos/bolsas",
          disponivel: true,
        },
        {
          rotulo: "Modalidades",
          href: "/catalogos/modalidades",
          disponivel: true,
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
}
