/**
 * Montagem dos links do painel e dos relatórios (CG-066/CG-068).
 *
 * Fora do componente porque `node --test` não carrega `.tsx`, e porque é aqui
 * que mora a garantia que o critério de aceite das duas tasks exige: **o
 * recorte precisa viajar no link**. Perdê-lo faz o clique abrir uma contagem
 * maior do que a exibida no cartão, e não há nada na tela que denuncie isso —
 * quem clica vê um número plausível e acredita.
 */

export interface RecorteDoPainel {
  ano: number | null;
  redeId: string | null;
  redeNome?: string | null;
}

/** Os quatro relatórios homologados em 2026-09-07. */
export const RELATORIOS = [
  "missoes",
  "parceiros",
  "financas",
  "resultados",
] as const;
export type Relatorio = (typeof RELATORIOS)[number];

/**
 * Link para a lista que produziu o número, carregando o recorte do painel.
 *
 * A ordem dos parâmetros é estável — `aba`, depois o recorte, depois os
 * filtros do cartão — para que o mesmo clique gere sempre a mesma URL. URL
 * instável quebra o histórico do navegador e o cache da rota.
 */
export function linkDaLista(
  base: string,
  recorte: RecorteDoPainel,
  filtros: Record<string, string> = {},
  aba: "missoes" | "analise" = "missoes",
): string {
  const query = new URLSearchParams({ aba });
  if (recorte.ano) query.set("ano", String(recorte.ano));
  if (recorte.redeId) query.set("redeId", recorte.redeId);
  for (const [campo, valor] of Object.entries(filtros)) query.set(campo, valor);
  return `${base}?${query}`;
}

/**
 * Relatório pedido na URL; o de missões é o padrão.
 *
 * Valor desconhecido **cai no padrão em vez de quebrar**: a aba é alcançável
 * por link colado, e um 500 por causa de `?relatorio=xpto` seria pior do que
 * mostrar o primeiro relatório.
 */
export function relatorioDaConsulta(
  bruto: string | string[] | undefined,
): Relatorio {
  const valor = Array.isArray(bruto) ? bruto[0] : bruto;
  return RELATORIOS.includes(valor as Relatorio)
    ? (valor as Relatorio)
    : "missoes";
}

/** Descreve o recorte em uma linha, para a nota do cartão. */
export function notaDoRecorte(recorte: RecorteDoPainel): string {
  return [
    recorte.ano ? `Exercício ${recorte.ano}` : "Ciclo inteiro",
    recorte.redeNome ?? "Todas as redes",
  ].join(" · ");
}
