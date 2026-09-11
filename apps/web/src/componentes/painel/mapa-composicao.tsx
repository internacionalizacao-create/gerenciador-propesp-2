import Link from "next/link";

import { RolagemHorizontal } from "@/componentes/ui/rolagem";
import type { LinhaComposicao, StatusComposicaoAnual } from "@/lib/dominio";
import { inteiro } from "@/lib/formato";
import { chaveDaRede, identidadeDaRede } from "@/lib/redes";

/**
 * Temáticas × exercícios, com o estado da composição em cada cruzamento.
 *
 * É a peça que responde "o que ainda falta decidir no ciclo" — antes espalhada
 * entre um cartão, uma tabela por ano e selos. É uma `<table>` de verdade, e
 * não uma grade de `div`s pintadas: cabeçalho de linha e de coluna amarram cada
 * célula à temática e ao ano para quem usa leitor de tela, e cada estado tem
 * símbolo e texto além da cor, que sozinha não serve a quem não distingue
 * verde de âmbar.
 */
const ESTADOS: Record<
  StatusComposicaoAnual,
  { rotulo: string; simbolo: string; classe: string }
> = {
  APROVADA: {
    rotulo: "Aprovada",
    simbolo: "✓",
    classe: "bg-success-soft text-on-success-soft",
  },
  EM_ELABORACAO: {
    rotulo: "Em elaboração",
    simbolo: "…",
    classe: "bg-warning-soft text-on-warning-soft",
  },
  A_DEFINIR: {
    rotulo: "A definir",
    simbolo: "—",
    classe: "bg-surface-muted text-subtle",
  },
};

export function MapaComposicao({
  linhas,
  anos,
  anoSelecionado,
  base,
}: {
  linhas: LinhaComposicao[];
  anos: number[];
  anoSelecionado: number;
  base: string;
}) {
  const redes = [...new Set(linhas.map((linha) => linha.rede))];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-26px_var(--border-strong)]">
      <RolagemHorizontal rotulo="Mapa de composição">
        <table className="w-full border-separate border-spacing-1 text-sm">
          <caption className="sr-only">
            Estado da composição de bolsas de cada área temática em cada
            exercício do ciclo
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-2 pb-1 text-left text-xs font-medium text-muted">
                Temática
              </th>
              {anos.map((ano) => (
                <th
                  key={ano}
                  scope="col"
                  className={`w-20 pb-1 text-center text-xs font-medium tabular-nums ${
                    ano === anoSelecionado ? "text-foreground" : "text-muted"
                  }`}
                >
                  {ano}
                </th>
              ))}
            </tr>
          </thead>
          {redes.map((rede, indice) => {
            const identidade = identidadeDaRede(rede, indice);
            return (
              <tbody key={rede}>
                <tr>
                  <th
                    scope="colgroup"
                    colSpan={anos.length + 1}
                    className="px-2 pb-0.5 pt-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-foreground"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span aria-hidden className={`size-2 rounded-full ${identidade.ponto}`} />
                      {rede}
                    </span>
                  </th>
                </tr>
                {linhas
                  .filter((linha) => linha.rede === rede)
                  .map((linha) => (
                    <tr key={linha.codigo}>
                      <th
                        scope="row"
                        className="max-w-[16rem] px-2 text-left font-normal"
                        title={linha.tematica}
                      >
                        <span className="font-mono text-xs text-muted">{linha.codigo}</span>
                        <span className="block truncate text-foreground">{linha.tematica}</span>
                      </th>
                      {linha.anos.map((celula) => {
                        const estado = ESTADOS[celula.status];
                        const descricao =
                          celula.status === "APROVADA"
                            ? `${estado.rotulo}, ${inteiro(celula.bolsas)} ${celula.bolsas === 1 ? "bolsa" : "bolsas"}`
                            : estado.rotulo;
                        return (
                          <td key={celula.ano} className="p-0">
                            <Link
                              href={`${base}/plano?rede=${chaveDaRede(linha.rede)}&ano=${celula.ano}`}
                              title={`${linha.codigo} · ${celula.ano}: ${descricao}`}
                              className={`flex h-10 items-center justify-center rounded-lg text-sm font-medium tabular-nums transition-[filter] hover:brightness-95 ${estado.classe} ${
                                celula.ano === anoSelecionado ? "ring-1 ring-border-strong" : ""
                              }`}
                            >
                              <span aria-hidden>
                                {estado.simbolo}
                                {celula.status === "APROVADA" ? ` ${celula.bolsas}` : ""}
                              </span>
                              <span className="sr-only">{descricao}</span>
                            </Link>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            );
          })}
        </table>
      </RolagemHorizontal>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border pt-3 text-xs text-muted">
        {(Object.keys(ESTADOS) as StatusComposicaoAnual[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className={`grid size-5 place-items-center rounded ${ESTADOS[status].classe}`}
            >
              {ESTADOS[status].simbolo}
            </span>
            {ESTADOS[status].rotulo}
          </li>
        ))}
        <li>O número na célula aprovada é a quantidade de bolsas.</li>
      </ul>
    </div>
  );
}
