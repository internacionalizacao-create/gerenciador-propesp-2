import Link from "next/link";
import type { ReactNode } from "react";

import { A_DEFINIR, faixaDeUtilizacao, moeda, percentual } from "@/lib/formato";

/** Peças de leitura usadas por todas as telas. Server Components. */

export function Pagina({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[112rem] px-5 py-7 sm:px-7 lg:px-8">
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <div className="mb-3 h-1 w-9 rounded-full bg-primary" />
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-foreground sm:text-[1.75rem]">
            {titulo}
          </h1>
          {descricao ? (
            <div className="mt-2 text-sm leading-6 text-muted">{descricao}</div>
          ) : null}
        </div>
        {acoes ? <div className="flex gap-2">{acoes}</div> : null}
      </header>
      {children}
    </div>
  );
}

export function Secao({
  titulo,
  descricao,
  acoes,
  children,
}: {
  titulo: string;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-9">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">{titulo}</h2>
          {descricao ? (
            <p className="mt-1 max-w-3xl text-sm text-muted">{descricao}</p>
          ) : null}
        </div>
        {acoes}
      </div>
      {children}
    </section>
  );
}

export function Cartao({
  titulo,
  valor,
  nota,
  destaque,
  href,
}: {
  titulo: string;
  valor: ReactNode;
  nota?: ReactNode;
  destaque?: boolean;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
        {titulo}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tracking-[-0.025em] tabular-nums ${
          destaque ? "text-primary" : "text-foreground"
        }`}
      >
        {valor}
      </p>
      {nota ? <p className="mt-2 text-xs leading-5 text-subtle">{nota}</p> : null}
    </>
  );

  const classe =
    "block rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-26px_var(--border-strong)] " +
    (href ? "transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_35px_-24px_var(--border-strong)]" : "");

  return href ? (
    <Link href={href} className={classe}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

export function Selo({
  children,
  tom = "neutro",
  titulo,
}: {
  children: ReactNode;
  tom?: "neutro" | "primario" | "sucesso" | "aviso" | "perigo" | "info";
  titulo?: string;
}) {
  const tons = {
    neutro: "bg-surface-muted text-muted",
    primario: "bg-primary-soft text-on-primary-soft",
    sucesso: "bg-success-soft text-on-success-soft",
    aviso: "bg-warning-soft text-on-warning-soft",
    perigo: "bg-danger-soft text-on-danger-soft",
    info: "bg-info-soft text-on-info-soft",
  } as const;

  return (
    <span
      title={titulo}
      className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tons[tom]}`}
    >
      {children}
    </span>
  );
}

/**
 * Célula de dinheiro.
 *
 * Nulo vira "A definir" em itálico — nunca "R$ 0,00". A distinção é a regra que
 * impede a UNICAMP de baixar as médias do painel (system-structl.md §9.2), e
 * misturar as duas coisas na apresentação anularia o cuidado que o banco tem em
 * guardar nulo.
 */
export function Moeda({
  valor,
  forte,
}: {
  valor: string | number | null | undefined;
  forte?: boolean;
}) {
  if (valor === null || valor === undefined) {
    return (
      <span className="italic text-subtle" title="Valor ainda não definido">
        {A_DEFINIR}
      </span>
    );
  }

  const negativo = Number(valor) < 0;
  return (
    <span
      className={`tabular-nums ${forte ? "font-semibold" : ""} ${
        negativo ? "text-danger" : ""
      }`}
    >
      {moeda(valor)}
    </span>
  );
}

/** Utilização com o semáforo de RN-07. */
export function Utilizacao({ fracao }: { fracao: number | null }) {
  const faixa = faixaDeUtilizacao(fracao);
  if (faixa === "indefinido") {
    return <span className="italic text-subtle">{A_DEFINIR}</span>;
  }

  const tons = {
    ocioso: "aviso",
    saudavel: "sucesso",
    estouro: "perigo",
  } as const;

  const explicacoes = {
    ocioso: "Abaixo de 90% — sobra recurso não programado",
    saudavel: "Entre 90% e 100% — saudável",
    estouro: "Acima de 100% — o plano ultrapassa o orçamento",
  } as const;

  return (
    <Selo tom={tons[faixa]} titulo={explicacoes[faixa]}>
      {percentual(fracao)}
    </Selo>
  );
}

export function Tabela({
  colunas,
  children,
  rodape,
}: {
  colunas: { chave: string; texto: ReactNode; alinhamento?: "direita" }[];
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    // Tabela larga rola dentro do próprio contêiner; a página nunca rola na
    // horizontal.
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-[0_12px_30px_-28px_var(--border-strong)]">
      <table className="w-full min-w-[48rem] border-collapse text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {colunas.map((coluna) => (
              <th
                key={coluna.chave}
                scope="col"
                className={`whitespace-nowrap px-3 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-subtle ${
                  coluna.alinhamento === "direita" ? "text-right" : "text-left"
                }`}
              >
                {coluna.texto}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-surface [&_tr]:transition-colors [&_tr:hover]:bg-surface-muted/45">
          {children}
        </tbody>
        {rodape ? (
          <tfoot className="border-t-2 border-border-strong bg-surface-muted font-medium">
            {rodape}
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

export function Celula({
  children,
  direita,
  className = "",
}: {
  children: ReactNode;
  direita?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-2 align-top ${direita ? "text-right" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

export function EstadoVazio({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border-strong bg-surface p-10 text-center shadow-[0_12px_30px_-28px_var(--border-strong)]">
      <p className="text-base font-medium text-foreground">{titulo}</p>
      <div className="mx-auto mt-2 max-w-lg text-sm text-muted">
        {descricao}
      </div>
      {acao ? <div className="mt-5 flex justify-center">{acao}</div> : null}
    </div>
  );
}

/**
 * Aviso fixo de tela.
 *
 * Usado onde um número precisa vir com o contexto colado nele — o caso claro é
 * o Comitê Gestor (RN-14), cujo painel original teve que dizer por escrito que
 * aquele orçamento não se soma ao de bolsas.
 */
export function Aviso({
  tom = "info",
  titulo,
  children,
}: {
  tom?: "info" | "aviso" | "perigo";
  titulo?: string;
  children: ReactNode;
}) {
  const tons = {
    info: "border-info bg-info-soft text-on-info-soft",
    aviso: "border-warning bg-warning-soft text-on-warning-soft",
    perigo: "border-danger bg-danger-soft text-on-danger-soft",
  } as const;

  return (
    <div className={`mb-6 rounded-2xl border-l-4 px-4 py-3.5 text-sm shadow-[0_10px_25px_-26px_var(--border-strong)] ${tons[tom]}`}>
      {titulo ? <p className="font-semibold">{titulo}</p> : null}
      <div className={titulo ? "mt-1" : ""}>{children}</div>
    </div>
  );
}

/** Grade de cartões que acomoda de 1 a 4 colunas conforme a largura. */
export function Cartoes({ children }: { children: ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
  );
}
