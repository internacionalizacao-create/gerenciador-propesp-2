import Link from "next/link";
import type { ReactNode } from "react";

import { faixaDeUtilizacao } from "@/lib/formato";

/**
 * Cartão de indicador do painel: o número e o contexto que o faz ser lido.
 *
 * "R$ 1,03 mi" sozinho diz pouco; "88% do teto, saldo R$ 147 mil" diz o que
 * fazer. Por isso o cartão tem espaço para a barra e para uma linha de contexto,
 * que o `Cartao` genérico não tem — e a barra não cabe no `<p>` da nota dele.
 */
export function CartaoKpi({
  rotulo,
  valor,
  contexto,
  barra,
  href,
}: {
  rotulo: string;
  valor: ReactNode;
  contexto?: ReactNode;
  barra?: ReactNode;
  href?: string;
}) {
  const conteudo = (
    <>
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
        {rotulo}
      </p>
      <p className="mt-2 text-[1.65rem] font-semibold leading-tight tracking-[-0.025em] text-foreground tabular-nums">
        {valor}
      </p>
      {barra ? <div className="mt-3">{barra}</div> : null}
      {contexto ? (
        <p className="mt-2 text-xs leading-5 text-muted">{contexto}</p>
      ) : null}
    </>
  );

  const classe =
    "block h-full rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-26px_var(--border-strong)]";

  return href ? (
    <Link
      href={href}
      className={`${classe} transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_35px_-24px_var(--border-strong)]`}
    >
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  );
}

const TOM_DA_FAIXA = {
  ocioso: "bg-warning",
  saudavel: "bg-success",
  estouro: "bg-danger",
  indefinido: "bg-border-strong",
} as const;

/**
 * Barra de proporção. É `aria-hidden` de propósito: o valor já está escrito no
 * cartão, e uma barra anunciada repetiria o número para quem usa leitor de
 * tela. A cor segue o semáforo da RN-07 quando `semaforo` é pedido — a mesma
 * régua da P08 e da P09, para uma cor dizer a mesma coisa em toda tela.
 */
export function BarraDeProporcao({
  fracao,
  semaforo = false,
  classeCor = "bg-primary",
}: {
  fracao: number;
  semaforo?: boolean;
  classeCor?: string;
}) {
  const largura = Math.max(0, Math.min(fracao, 1)) * 100;
  const cor = semaforo ? TOM_DA_FAIXA[faixaDeUtilizacao(fracao)] : classeCor;
  return (
    <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
      <div className={`h-full rounded-full ${cor}`} style={{ width: `${largura}%` }} />
    </div>
  );
}
