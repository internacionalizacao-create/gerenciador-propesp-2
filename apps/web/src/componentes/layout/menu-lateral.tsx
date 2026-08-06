"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import type { GrupoMenu } from "@/lib/navegacao";

/**
 * Menu lateral.
 *
 * É cliente porque precisa de `usePathname` para marcar o item atual, e porque
 * em tela estreita ele vira uma gaveta. O conteúdo do menu vem pronto do
 * servidor — este componente não sabe o que existe no sistema, só desenha.
 */
export function MenuLateral({ grupos }: { grupos: GrupoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const caminho = usePathname();

  // So um item fica marcado como atual. Rotas do ciclo se aninham
  // (/programas, /programas/x/y, /programas/x/y/plano...), entao mais de um
  // href pode "bater" por prefixo ao mesmo tempo; fica o mais especifico
  // (maior href) entre os que batem.
  const hrefAtual = grupos
    .flatMap((grupo) => grupo.itens)
    .filter((item) => item.disponivel)
    .map((item) => item.href)
    .filter(
      (href) => caminho === href || caminho.startsWith(`${href}/`),
    )
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="fixed bottom-4 left-4 z-30 rounded-full border border-border-strong bg-surface px-4 py-2.5 text-sm font-medium text-foreground shadow-lg lg:hidden"
      >
        ☰ Menu
      </button>

      {aberto ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Navegação principal"
        className={`
          fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r
          border-border bg-surface px-3 py-5 transition-transform
          lg:sticky lg:top-0 lg:z-0 lg:h-dvh lg:translate-x-0
          ${aberto ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Link
          href="/"
          className="mb-6 block px-3 text-sm font-semibold tracking-tight text-foreground"
        >
          Gerenciador
          <span className="block text-xs font-normal text-subtle">
            PROPESP · UEA
          </span>
        </Link>

        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-5">
            <p className="mb-1.5 px-3 text-[0.65rem] font-semibold uppercase tracking-wider text-subtle">
              {grupo.titulo}
            </p>
            <ul>
              {grupo.itens.map((item) => {
                const atual = item.href === hrefAtual;

                if (!item.disponivel) {
                  return (
                    <li key={item.href}>
                      <span
                        title={item.motivo}
                        aria-disabled="true"
                        className="flex cursor-help items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm text-subtle"
                      >
                        {item.rotulo}
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide">
                          em breve
                        </span>
                      </span>
                    </li>
                  );
                }

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setAberto(false)}
                      aria-current={atual ? "page" : undefined}
                      className={`block rounded-lg px-3 py-1.5 text-sm ${
                        atual
                          ? "bg-primary-soft font-medium text-on-primary-soft"
                          : "text-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      {item.rotulo}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
