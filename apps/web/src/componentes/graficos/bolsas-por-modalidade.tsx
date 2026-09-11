"use client";

import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import { EIXO_GRAFICO, GRADE_GRAFICO, Grafico } from "@/componentes/ui/grafico";
import type { Destino } from "@/lib/dominio";
import { inteiro, moeda } from "@/lib/formato";

/**
 * P01 · Quantas bolsas de cada modalidade o exercício programa.
 *
 * Barras horizontais porque o rótulo é longo ("Professor Visitante Sênior") e
 * na vertical viraria texto inclinado. A cor diz o sentido da mobilidade —
 * Brasil traz alguém para a UEA, exterior leva alguém daqui —, e a legenda
 * escrita diz o mesmo, para a cor não ser o único canal. A tabela com o custo
 * fica logo abaixo, em "Ver dados": o gráfico mostra a forma, ela o número.
 */
const COR_DO_DESTINO: Record<Destino, string> = {
  BRASIL: "var(--info)",
  EXTERIOR: "var(--primary)",
};

export interface BarraModalidade {
  modalidade: string;
  destino: Destino;
  quantidade: number;
  custo: string;
}

export function BolsasPorModalidade({
  titulo,
  linhas,
}: {
  titulo: string;
  linhas: BarraModalidade[];
}) {
  if (linhas.length === 0) return null;

  const dados = linhas.map((linha) => ({
    ...linha,
    rotulo: `${linha.modalidade} · ${linha.destino === "BRASIL" ? "Brasil" : "Exterior"}`,
  }));

  return (
    <Grafico
      titulo={titulo}
      altura={Math.max(160, dados.length * 44 + 24)}
    >
      <BarChart
        accessibilityLayer
        layout="vertical"
        data={dados}
        margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
      >
        <CartesianGrid {...GRADE_GRAFICO} horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          {...EIXO_GRAFICO}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="rotulo"
          width={230}
          {...EIXO_GRAFICO}
          axisLine={false}
        />
        <Tooltip content={<DicaModalidade />} cursor={{ fill: "var(--surface-muted)" }} />
        <Bar dataKey="quantidade" name="Bolsas" radius={[0, 4, 4, 0]} maxBarSize={26}>
          {dados.map((linha) => (
            <Cell key={linha.rotulo} fill={COR_DO_DESTINO[linha.destino]} />
          ))}
        </Bar>
      </BarChart>
    </Grafico>
  );
}

export function LegendaDestino() {
  return (
    <ul className="mt-2 flex gap-4 text-xs text-muted">
      {(["BRASIL", "EXTERIOR"] as const).map((destino) => (
        <li key={destino} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="size-2.5 rounded-full"
            style={{ background: COR_DO_DESTINO[destino] }}
          />
          {destino === "BRASIL" ? "Destino Brasil (IN)" : "Destino exterior (OUT)"}
        </li>
      ))}
    </ul>
  );
}

function DicaModalidade({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: BarraModalidade & { rotulo: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const linha = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-[0_18px_40px_-24px_var(--border-strong)]">
      <p className="font-medium text-foreground">{linha.rotulo}</p>
      <p className="mt-1 text-muted">
        {inteiro(linha.quantidade)} bolsas · {moeda(linha.custo)}
      </p>
    </div>
  );
}
