"use client";

import { ResponsiveContainer } from "recharts";

import { A_DEFINIR, moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Base dos graficos.
 *
 * As cores sao passadas como `var(--token)` direto no SVG, e nao como valor
 * resolvido em JavaScript. E o que faz o grafico acompanhar a troca de tema sem
 * remontar: quando `[data-theme]` muda, o navegador recalcula a variavel e
 * repinta. Ler a cor com `getComputedStyle` no cliente daria a cor do tema que
 * estava ativo na montagem e congelaria nela.
 *
 * Escala das redes: `network-1..3` sao identidade de navegacao, os mesmos tons
 * que a P10 usa nas abas (AGENTS.md §8). Um grafico de rede pintado com outra
 * paleta obrigaria a reaprender a associacao a cada tela.
 */
export const CORES_REDE = [
  "var(--network-1)",
  "var(--network-2)",
  "var(--network-3)",
] as const;

/** Sequencia para series que nao sao rede (rubricas, situacoes). */
export const CORES_SERIE = [
  "var(--primary)",
  "var(--info)",
  "var(--warning)",
  "var(--success)",
] as const;

export const EIXO_GRAFICO = {
  stroke: "var(--subtle)",
  fontSize: 12,
  tickLine: false,
} as const;

export const GRADE_GRAFICO = {
  stroke: "var(--border)",
  strokeDasharray: "3 3",
} as const;

/**
 * Moldura responsiva com titulo acessivel.
 *
 * O `<figure>`/`<figcaption>` nao e decoracao: o SVG do Recharts e uma arvore de
 * `<path>` sem texto alternativo util, entao sem a legenda amarrada o grafico e
 * um buraco para quem usa leitor de tela. A tabela que acompanha cada grafico
 * neste sistema continua sendo a fonte precisa do numero — o grafico mostra a
 * forma, a tabela mostra o valor.
 */
export function Grafico({
  titulo,
  descricao,
  altura = 280,
  className,
  children,
}: {
  titulo: string;
  descricao?: string;
  altura?: number;
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <figure
      className={cn(
        "rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-28px_var(--border-strong)]",
        className,
      )}
    >
      <figcaption className="mb-3">
        <span className="block text-sm font-medium text-foreground">
          {titulo}
        </span>
        {descricao ? (
          <span className="mt-0.5 block text-xs text-muted">{descricao}</span>
        ) : null}
      </figcaption>
      <div style={{ height: altura }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

interface ItemDica {
  name?: string;
  dataKey?: string | number;
  value?: number | string | null;
  color?: string;
}

/**
 * Balao do Recharts com os tokens do sistema.
 *
 * Serie nula aparece como "A definir", nunca como R$ 0,00 — a mesma regra do
 * componente `Moeda` (§9.2 da especificacao). Num grafico o risco e maior: uma
 * barra ausente ja se parece com zero, e o balao e a unica chance de dizer que
 * o valor nao foi informado em vez de ser nulo.
 */
export function DicaMoeda({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: ItemDica[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-[0_18px_40px_-24px_var(--border-strong)]">
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      <ul className="space-y-1">
        {payload.map((item) => (
          <li
            key={String(item.dataKey ?? item.name)}
            className="flex items-center gap-2"
          >
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            <span className="text-muted">{item.name}</span>
            <span className="ml-auto font-medium text-foreground">
              {item.value === null || item.value === undefined
                ? A_DEFINIR
                : moeda(item.value)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
