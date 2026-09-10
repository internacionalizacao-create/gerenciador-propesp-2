"use client";

import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { useState } from "react";
import topologia from "world-atlas/countries-110m.json";

import { inteiro } from "@/lib/formato";

/**
 * P04 · mapa de intensidade por país (BOL-042).
 *
 * **A cor vem de `var(--token)` no SVG, nunca resolvida em JavaScript.** É a
 * regra do §8 do AGENTS.md, e num mapa ela importa mais: `getComputedStyle` na
 * montagem congelaria a cor do tema ativo, e trocar de tema deixaria o mapa
 * claro sobre fundo escuro.
 *
 * **O casamento é pelo código numérico da ISO 3166-1**, que é o `id` do
 * topojson. Casar por nome falharia em silêncio — o arquivo escreve
 * "W. Sahara" onde o ICU escreve "Western Sahara" —, e um país sem cor é
 * indistinguível de um país sem mobilidade.
 *
 * **O mapa acompanha a tabela, não a substitui.** Ele mostra a forma; a tabela
 * mostra o número, e é ela que serve a quem usa leitor de tela. Por isso o
 * `<figure>` traz legenda amarrada e o SVG é `aria-hidden`: repetir 177 nomes
 * de país na árvore de acessibilidade não ajudaria ninguém.
 */

export interface PaisNoMapa {
  codigoNumerico: string | null;
  rotulo: string;
  quantidade: number;
}

export function MapaMundi({
  paises,
  legenda,
}: {
  paises: PaisNoMapa[];
  legenda: string;
}) {
  const [foco, setFoco] = useState<string | null>(null);

  const porCodigo = new Map(
    paises
      .filter((pais) => pais.codigoNumerico)
      .map((pais) => [pais.codigoNumerico!.replace(/^0+/, ""), pais]),
  );
  const maximo = Math.max(1, ...paises.map((pais) => pais.quantidade));

  return (
    <figure className="rounded-2xl border border-border bg-surface p-2">
      <div aria-hidden className="w-full">
        <ComposableMap
          projection="geoEqualEarth"
          projectionConfig={{ scale: 155 }}
          width={800}
          height={380}
          style={{ width: "100%", height: "auto" }}
        >
          {/*
            O `as never` cobre uma lacuna de tipagem, não de comportamento:
            `Geographies` aceita topojson em execução — usa `topojson-client`
            por dentro —, mas o tipo declara só GeoJSON. Converter o arquivo
            para GeoJSON no cliente custaria o triplo do payload.
          */}
          <Geographies geography={topologia as never}>
            {({ geographies }) =>
              geographies.map((geografia) => {
                // O `id` do topojson vem com zeros à esquerda em alguns países
                // e sem, em outros; normalizar os dois lados evita o mapa
                // "quase certo", que é o pior resultado possível aqui.
                const codigo = String(geografia.id).replace(/^0+/, "");
                const pais = porCodigo.get(codigo);
                const intensidade = pais
                  ? 0.25 + (pais.quantidade / maximo) * 0.75
                  : 0;

                return (
                  <Geography
                    key={geografia.rsmKey}
                    geography={geografia}
                    onMouseEnter={() => setFoco(pais?.rotulo ?? null)}
                    onMouseLeave={() => setFoco(null)}
                    fill={
                      pais ? "var(--color-primary)" : "var(--color-surface-muted)"
                    }
                    fillOpacity={pais ? intensidade : 1}
                    stroke="var(--color-border)"
                    strokeWidth={0.4}
                    className="outline-none"
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <figcaption className="px-3 pb-1 pt-2 text-xs text-muted">
        {legenda}
        {foco ? (
          <span className="ml-2 font-medium text-foreground">· {foco}</span>
        ) : null}
        {paises.length > 0 ? (
          <span className="ml-2">
            · intensidade proporcional ao número de mobilidades (máximo{" "}
            {inteiro(maximo)})
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}
