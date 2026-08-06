import type { Metadata } from "next";
import Link from "next/link";

import {
  Aviso,
  Pagina,
  Selo,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Programa } from "@/lib/dominio";
import { inteiro, moeda } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Programas de mobilidade — Gerenciador PROPESP",
};

/**
 * P05 · Programas de mobilidade.
 *
 * Os programas sem dado aparecem aqui de propósito. O sistema nasce
 * multiprograma, e um cartão vazio de GCUB ou Erasmus+ é o lembrete visível de
 * que a estrutura já os comporta — o oposto de "cada programa é uma planilha
 * nova", que é o problema que este sistema resolve.
 */
export default async function Programas() {
  const programas = await apiFetch<Programa[]>("/programas");
  const comDados = programas.filter((p) => p.linhasPlano > 0);
  const semDados = programas.filter((p) => p.linhasPlano === 0);

  return (
    <Pagina
      titulo="Programas de mobilidade"
      descricao="Fontes de recurso e regras para internacionalização da pós-graduação."
    >
      <div className="mb-10 grid gap-3 lg:grid-cols-2">
        {comDados.map((programa) => (
          <CartaoPrograma key={programa.id} programa={programa} />
        ))}
      </div>

      {semDados.length > 0 ? (
        <>
          <Aviso tom="info" titulo="Cadastrados, ainda sem dados">
            Estes programas existem no mundo real e já têm lugar na estrutura.
            Quando a planilha de cada um chegar, ela entra por importação — sem
            precisar de um modelo de dados novo (resposta Q9).
          </Aviso>

          <div className="grid gap-3 lg:grid-cols-2">
            {semDados.map((programa) => (
              <CartaoPrograma key={programa.id} programa={programa} />
            ))}
          </div>
        </>
      ) : null}
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
