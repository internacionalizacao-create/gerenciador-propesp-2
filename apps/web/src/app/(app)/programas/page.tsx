import type { Metadata } from "next";
import Link from "next/link";

import { Pagina, Selo } from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Programa } from "@/lib/dominio";
import { inteiro, moeda } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Programa — Gerenciador PROPESP",
};

/**
 * P05 · Programa ativo.
 *
 * A arquitetura continua aceitando mais programas, mas a operacao atual esta
 * restrita ao CAPES Global. A API nao devolve cadastros inativos.
 */
export default async function Programas() {
  const programas = await apiFetch<Programa[]>("/programas");

  return (
    <Pagina
      titulo="Programa"
      descricao="Programa de internacionalização atualmente gerenciado pela PROPESP."
    >
      <div className="grid max-w-3xl gap-3">
        {programas.map((programa) => (
          <CartaoPrograma key={programa.id} programa={programa} />
        ))}
      </div>
    </Pagina>
  );
}

function CartaoPrograma({ programa }: { programa: Programa }) {
  const vazio = programa.linhasPlano === 0 || !programa.cicloAtual;

  const conteudo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-foreground">{programa.nome}</p>
          <p className="mt-0.5 text-sm text-muted">
            {programa.orgaoFinanciador ?? "Financiador não informado"}
          </p>
        </div>
        {vazio ? (
          <Selo tom="neutro">Sem dados</Selo>
        ) : (
          <Selo tom="primario">{inteiro(programa.ciclos)} ciclo(s)</Selo>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div>
          <dt className="text-xs text-subtle">Aporte anual</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {moeda(programa.aporteAnual)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Linhas de plano</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {inteiro(programa.linhasPlano)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">PPGs</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {inteiro(programa.ppgs)}
          </dd>
        </div>
      </dl>

      <p className="mt-4 text-xs text-subtle">
        {programa.usaRedes
          ? "Organizado em redes coordenadoras e áreas temáticas."
          : "Sem redes nem áreas temáticas — a bolsa se liga direto ao PPG."}
      </p>
    </>
  );

  const classe = "rounded-xl border border-border bg-surface p-5";

  return vazio ? (
    <div className={`${classe} opacity-80`}>{conteudo}</div>
  ) : (
    <Link
      href={`/programas/${programa.slug}/${programa.cicloAtual}`}
      className={`${classe} block transition-colors hover:border-border-strong`}
    >
      {conteudo}
    </Link>
  );
}
