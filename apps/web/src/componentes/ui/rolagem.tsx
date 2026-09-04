"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Contêiner que rola na horizontal e continua alcançável pelo teclado.
 *
 * Uma tabela larga dentro de `overflow-x-auto` é uma armadilha silenciosa: o
 * mouse arrasta, o dedo arrasta, e quem usa só teclado não tem como chegar nas
 * colunas escondidas — nenhum elemento focável mora ali dentro. A correção
 * conhecida é dar `tabIndex` ao contêiner, que passa a receber foco e responder
 * às setas.
 *
 * **O `tabIndex` é condicional de propósito.** Aplicá-lo sempre criaria uma
 * parada de tabulação morta em cada uma das dezenas de tabelas do sistema
 * quando a tela é larga e nada rola. Por isso a medição acontece no cliente e
 * reage a redimensionamento: a parada existe exatamente quando há conteúdo
 * escondido, que é quando ela serve para alguma coisa.
 *
 * O `role="region"` só entra junto com o `tabIndex`, e sempre com nome: região
 * sem nome acessível é pior do que região nenhuma.
 */
export function RolagemHorizontal({
  rotulo = "Conteúdo com rolagem horizontal",
  className,
  children,
}: {
  rotulo?: string;
  className?: string;
  children: ReactNode;
}) {
  const alvo = useRef<HTMLDivElement>(null);
  const [rolavel, setRolavel] = useState(false);

  useEffect(() => {
    const elemento = alvo.current;
    if (!elemento) return;

    // A margem de 1px evita que arredondamento de layout ligue e desligue a
    // parada de tabulação a cada repintura.
    const medir = () =>
      setRolavel(elemento.scrollWidth > elemento.clientWidth + 1);

    medir();
    if (typeof ResizeObserver === "undefined") return;
    const observador = new ResizeObserver(medir);
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={alvo}
      className={className}
      tabIndex={rolavel ? 0 : undefined}
      role={rolavel ? "region" : undefined}
      aria-label={rolavel ? rotulo : undefined}
    >
      {children}
    </div>
  );
}
