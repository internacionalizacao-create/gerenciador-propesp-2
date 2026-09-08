/**
 * Menu do sistema (system-structl.md §6).
 *
 * Os módulos que ainda não têm dado aparecem com `disponivel: false` em vez de
 * sumirem. O sistema é multiprograma e plurianual: esconder o que falta daria a
 * impressão de que o escopo é o que existe hoje, e a equipe perderia a régua do
 * que ainda vem. O item desabilitado diz o que falta para ele existir.
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
        { rotulo: "Painel executivo", href: "/", disponivel: true },
        {
          rotulo: "Mobilidade",
          href: "/mobilidade",
          disponivel: false,
          motivo:
            "Depende de bolsas concedidas a pessoas — nenhuma foi registrada ainda.",
        },
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
        { rotulo: "Pendências", href: "/pendencias", disponivel: true },
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
          rotulo: "Produção",
          href: "/producao",
          disponivel: false,
          motivo:
            "Fase 2 — visão consolidada e vínculos com convênios; produtos individuais ficam em Bolsistas.",
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
