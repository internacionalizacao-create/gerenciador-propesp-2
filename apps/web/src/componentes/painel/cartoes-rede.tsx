import Link from "next/link";
import type { ReactNode } from "react";

import { BarraDeProporcao } from "@/componentes/painel/kpis";
import { Moeda, Selo } from "@/componentes/ui/basicos";
import type { CoordenacaoRede, LinhaRede } from "@/lib/dominio";
import { inteiro, percentual } from "@/lib/formato";
import { chaveDaRede, identidadeDaRede } from "@/lib/redes";

/**
 * Um cartão por rede coordenadora, no lugar da tabela de nove colunas.
 *
 * São exatamente três redes, e três cartões lado a lado se comparam num olhar;
 * a tabela exigia ler coluna por coluna. A cor é a da rede em todo o sistema
 * (`lib/redes.ts`). A coordenação entra recolhida: é referência, não indicador,
 * e aberta ocupava uma seção inteira da home com treze nomes.
 */
export function CartoesRede({
  redes,
  coordenacao,
  base,
  ano,
}: {
  redes: LinhaRede[];
  coordenacao: CoordenacaoRede[];
  base: string;
  ano: number;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {redes.map((rede, indice) => (
        <CartaoRede
          key={rede.redeId}
          rede={rede}
          indice={indice}
          coordenacao={coordenacao.find((c) => c.redeId === rede.redeId)}
          href={`${base}/plano?rede=${chaveDaRede(rede.rede)}&ano=${ano}`}
        />
      ))}
    </div>
  );
}

function CartaoRede({
  rede,
  indice,
  coordenacao,
  href,
}: {
  rede: LinhaRede;
  indice: number;
  coordenacao?: CoordenacaoRede;
  href: string;
}) {
  const identidade = identidadeDaRede(rede.rede, indice);
  const idTitulo = `rede-${rede.redeId}`;
  // Sem composição, a API devolve custo e bolsas zerados — não há linha para
  // somar. Na tela isso leria "decidiram zero bolsas", quando o certo é "ainda
  // não decidiram": nulo não é zero, a mesma regra do componente `Moeda`.
  const aDefinir = rede.statusComposicao !== "APROVADA" && rede.bolsas === 0;
  const composicao =
    rede.statusComposicao === "APROVADA"
      ? { tom: "sucesso" as const, texto: "Composição aprovada" }
      : rede.statusComposicao === "EM_ELABORACAO"
        ? { tom: "aviso" as const, texto: "Composição em elaboração" }
        : { tom: "aviso" as const, texto: "Composição a definir" };

  return (
    <section
      aria-labelledby={idTitulo}
      className={`flex flex-col rounded-2xl border border-l-4 border-border ${identidade.borda} bg-surface p-5 shadow-[0_12px_30px_-26px_var(--border-strong)]`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={idTitulo} className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <span aria-hidden className={`size-2.5 rounded-full ${identidade.ponto}`} />
          {rede.rede}
        </h3>
        <Link href={href} className="text-sm font-medium text-primary hover:underline">
          Abrir plano →
        </Link>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Selo tom={rede.statusOrcamento === "DEFINIDO" ? "sucesso" : "aviso"}>
          Orçamento {rede.statusOrcamento === "DEFINIDO" ? "definido" : "pendente"}
        </Selo>
        <Selo tom={composicao.tom}>{composicao.texto}</Selo>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between text-sm">
          <span className="text-muted">Teto de bolsas comprometido</span>
          <span className="font-semibold tabular-nums text-foreground">
            {rede.utilizacao === null ? (
              <span className="font-normal italic text-subtle">A definir</span>
            ) : (
              percentual(rede.utilizacao)
            )}
          </span>
        </div>
        {rede.utilizacao === null ? (
          <BarraDeProporcao fracao={0} />
        ) : (
          <BarraDeProporcao fracao={rede.utilizacao} semaforo />
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <Dado rotulo="Orçamento">
          <Moeda valor={rede.totalPrevisto} />
        </Dado>
        <Dado rotulo="Custo de bolsas">
          <Moeda valor={aDefinir ? null : rede.custoBolsas} />
        </Dado>
        <Dado rotulo="Manutenção e missões">
          <Moeda valor={rede.apoio} />
        </Dado>
        <Dado rotulo="Saldo potencial">
          <Moeda valor={rede.saldoPotencial} />
        </Dado>
        <Dado rotulo="Bolsas">
          {aDefinir ? (
            <span className="font-normal italic text-subtle">A definir</span>
          ) : (
            inteiro(rede.bolsas)
          )}
        </Dado>
        <Dado rotulo="Temáticas · PPGs">
          {inteiro(rede.tematicas)} · {inteiro(rede.ppgs)}
        </Dado>
      </dl>

      {coordenacao && coordenacao.tematicas.length > 0 ? (
        <details className="group mt-4 border-t border-border pt-3 text-sm">
          <summary className="cursor-pointer select-none font-medium text-foreground marker:text-subtle">
            Coordenadores de temática
          </summary>
          <dl className="mt-3 space-y-2.5">
            {coordenacao.tematicas.map((tematica) => (
              <div key={tematica.codigo}>
                <dt className="text-xs text-muted">
                  <span className="font-mono">{tematica.codigo}</span> · {tematica.nome}
                </dt>
                <dd className="mt-0.5 text-foreground">
                  {tematica.coordenadores.length > 0 ? (
                    tematica.coordenadores.join(" · ")
                  ) : (
                    <span className="italic text-subtle">A definir</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </section>
  );
}

function Dado({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="mt-0.5 font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  );
}
