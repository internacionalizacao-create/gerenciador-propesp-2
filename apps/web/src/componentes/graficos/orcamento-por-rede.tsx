"use client";

import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

import {
  CORES_REDE,
  DicaMoeda,
  EIXO_GRAFICO,
  GRADE_GRAFICO,
  Grafico,
} from "@/componentes/ui/grafico";
import { montarSerie } from "@/componentes/graficos/orcamento-por-rede-serie";
import type { LinhaRede } from "@/lib/dominio";

/**
 * P09 · Total previsto por rede ao longo do ciclo.
 *
 * Acompanha a tabela, nao a substitui: o grafico mostra a forma da distribuicao
 * entre redes e exercicios, e a tabela ao lado continua sendo onde se le o
 * numero exato.
 */
export function OrcamentoPorRede({
  redes,
  anos,
}: {
  redes: LinhaRede[];
  anos: number[];
}) {
  const { nomes, dados, temAlgumValor } = montarSerie(redes, anos);
  if (!temAlgumValor) return null;

  return (
    <Grafico
      titulo="Total previsto por rede e exercício"
      descricao="Exercício sem orçamento definido não aparece como zero: a barra fica ausente."
      altura={300}
    >
      <BarChart
        accessibilityLayer
        data={dados}
        margin={{ top: 4, right: 8, bottom: 4, left: 8 }}
      >
        <CartesianGrid {...GRADE_GRAFICO} vertical={false} />
        <XAxis dataKey="ano" {...EIXO_GRAFICO} axisLine={false} />
        <YAxis
          {...EIXO_GRAFICO}
          axisLine={false}
          width={72}
          tickFormatter={(valor: number) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              maximumFractionDigits: 1,
            }).format(valor)
          }
        />
        <Tooltip
          content={<DicaMoeda />}
          cursor={{ fill: "var(--surface-muted)" }}
        />
        <Legend
          wrapperStyle={{ fontSize: 12, color: "var(--muted)" }}
          iconType="circle"
        />
        {nomes.map((nome, indice) => (
          <Bar
            key={nome}
            dataKey={nome}
            name={nome}
            fill={CORES_REDE[indice % CORES_REDE.length]}
            radius={[4, 4, 0, 0]}
            maxBarSize={56}
          />
        ))}
      </BarChart>
    </Grafico>
  );
}
