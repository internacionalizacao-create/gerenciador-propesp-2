/**
 * Identidade visual e chave de URL de cada rede coordenadora.
 *
 * Uma rede tem a mesma cor em toda tela — abas da P10, gráfico da P09, cartões
 * da P01. A cor sai do **nome**, e não da posição na lista: por posição, a
 * ordem alfabética dava `network-1` à UFMG no gráfico enquanto as abas da P10 a
 * davam à UNESP, e a mesma rede trocava de cor de uma tela para outra.
 *
 * Módulo neutro, sem "use client": o Server Component e o gráfico no cliente
 * leem a mesma função, e o `node --test` alcança o `.ts`.
 */

/** Ordem das redes conhecidas; rede nova cai na posição que ocupa na lista. */
const ORDEM_CONHECIDA = ["UNESP", "UFMG", "UNICAMP"] as const;

export const IDENTIDADES_REDE = [
  {
    borda: "border-l-network-1",
    fundo: "bg-network-1-soft",
    marcador: "bg-network-1 text-on-network-1",
    texto: "text-on-network-1-soft",
    abaAtiva: "border-network-1 bg-network-1-soft text-on-network-1-soft",
    ponto: "bg-network-1",
    barra: "bg-network-1",
    cor: "var(--network-1)",
  },
  {
    borda: "border-l-network-2",
    fundo: "bg-network-2-soft",
    marcador: "bg-network-2 text-on-network-2",
    texto: "text-on-network-2-soft",
    abaAtiva: "border-network-2 bg-network-2-soft text-on-network-2-soft",
    ponto: "bg-network-2",
    barra: "bg-network-2",
    cor: "var(--network-2)",
  },
  {
    borda: "border-l-network-3",
    fundo: "bg-network-3-soft",
    marcador: "bg-network-3 text-on-network-3",
    texto: "text-on-network-3-soft",
    abaAtiva: "border-network-3 bg-network-3-soft text-on-network-3-soft",
    ponto: "bg-network-3",
    barra: "bg-network-3",
    cor: "var(--network-3)",
  },
] as const;

export type IdentidadeRede = (typeof IDENTIDADES_REDE)[number];

/** Posição da rede na escala `network-1..3`. */
export function posicaoDaRede(nome: string, indice: number): number {
  const conhecida = ORDEM_CONHECIDA.findIndex((sigla) =>
    nome.toLocaleUpperCase("pt-BR").includes(sigla),
  );
  return (conhecida >= 0 ? conhecida : indice) % IDENTIDADES_REDE.length;
}

export function identidadeDaRede(nome: string, indice: number): IdentidadeRede {
  return IDENTIDADES_REDE[posicaoDaRede(nome, indice)];
}

/** "UNESP" -> "unesp": o valor de `?rede=` na P10. */
export function chaveDaRede(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
