"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import type { GrupoMenu } from "@/lib/navegacao";

/**
 * Menu lateral recolhido por padrao.
 *
 * No desktop, os icones preservam o acesso rapido e o botao no topo revela os
 * rotulos quando a pessoa precisa se orientar. No celular continua sendo uma
 * gaveta completa: uma barra apenas de icones seria estreita demais para toque.
 */
export function MenuLateral({ grupos }: { grupos: GrupoMenu[] }) {
  const [aberto, setAberto] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const caminho = usePathname();

  const hrefAtual = grupos
    .flatMap((grupo) => grupo.itens)
    .filter((item) => item.disponivel)
    .map((item) => item.href)
    .filter((href) => caminho === href || caminho.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label="Abrir menu"
        className="fixed bottom-5 left-5 z-30 grid size-12 place-items-center rounded-2xl border border-border-strong bg-surface text-foreground shadow-lg lg:hidden"
      >
        <IconeMenuGenerico />
      </button>

      {aberto ? (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-30 bg-foreground/35 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <nav
        aria-label="Navegação principal"
        className={`
          fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col overflow-hidden
          border-r border-border bg-surface transition-[width,transform] duration-200
          lg:sticky lg:top-0 lg:z-30 lg:h-dvh lg:translate-x-0
          ${aberto ? "translate-x-0" : "-translate-x-full"}
          ${expandido ? "lg:w-72" : "lg:w-[4.75rem]"}
        `}
      >
        <div className="flex h-[4.5rem] shrink-0 items-center border-b border-border px-4">
          <Link
            href="/"
            onClick={() => setAberto(false)}
            aria-label="Gerenciador PROPESP"
            className="flex min-w-0 flex-1 items-center gap-3"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-on-primary shadow-sm">
              <IconeMarca />
            </span>
            <span
              className={`min-w-0 transition-opacity ${expandido ? "lg:opacity-100" : "lg:pointer-events-none lg:opacity-0"}`}
            >
              <span className="block whitespace-nowrap text-sm font-semibold text-foreground">
                Gerenciador
              </span>
              <span className="block whitespace-nowrap text-xs text-subtle">
                PROPESP · UEA
              </span>
            </span>
          </Link>

          <button
            type="button"
            onClick={() => setAberto(false)}
            aria-label="Fechar menu"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-surface-muted hover:text-foreground lg:hidden"
          >
            <IconeFechar />
          </button>
        </div>

        <div className="shrink-0 border-b border-border p-3 lg:block">
          <button
            type="button"
            onClick={() => setExpandido((valor) => !valor)}
            aria-expanded={expandido}
            aria-label={expandido ? "Recolher menu" : "Expandir menu"}
            title={expandido ? "Recolher menu" : "Expandir menu"}
            className="hidden h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground lg:flex"
          >
            <span className={`transition-transform ${expandido ? "rotate-180" : ""}`}>
              <IconeSeta />
            </span>
            <span className={expandido ? "block" : "hidden"}>Recolher menu</span>
          </button>
          <p className="px-3 py-1 text-xs text-subtle lg:hidden">
            Navegação do sistema
          </p>
        </div>

        <div
          className={`min-h-0 flex-1 overflow-x-hidden px-3 py-4 ${expandido ? "overflow-y-auto" : "overflow-y-auto lg:overflow-y-hidden"}`}
        >
          {grupos.map((grupo, indiceGrupo) => {
            const temItemDisponivel = grupo.itens.some((item) => item.disponivel);

            return (
              <div
                key={grupo.titulo}
                className={`${indiceGrupo > 0 ? "mt-4 border-t border-border pt-4" : ""} ${!expandido && !temItemDisponivel ? "lg:hidden" : ""}`}
              >
              <p
                className={`mb-1.5 h-4 whitespace-nowrap px-3 text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-subtle transition-opacity ${expandido ? "lg:opacity-100" : "lg:opacity-0"}`}
              >
                {grupo.titulo}
              </p>
              <ul className="space-y-1">
                {grupo.itens.map((item) => {
                  const atual = item.href === hrefAtual;
                  const conteudo = (
                    <>
                      <span className="grid size-5 shrink-0 place-items-center">
                        <IconeDaRota href={item.href} />
                      </span>
                      <span
                        className={`min-w-0 flex-1 truncate transition-opacity ${expandido ? "lg:opacity-100" : "lg:pointer-events-none lg:opacity-0"}`}
                      >
                        {item.rotulo}
                      </span>
                    </>
                  );

                  if (!item.disponivel) {
                    return (
                      <li
                        key={item.href}
                        className={!expandido ? "lg:hidden" : ""}
                      >
                        <span
                          title={expandido ? item.motivo : `${item.rotulo} · Em breve`}
                          aria-disabled="true"
                          className="flex h-10 cursor-help items-center gap-3 rounded-xl px-3 text-sm text-subtle opacity-60"
                        >
                          {conteudo}
                          <span
                            className={`rounded bg-surface-muted px-1.5 py-0.5 text-[0.6rem] uppercase tracking-wide ${expandido ? "lg:block" : "lg:hidden"}`}
                          >
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
                        title={expandido ? undefined : item.rotulo}
                        onClick={() => setAberto(false)}
                        aria-current={atual ? "page" : undefined}
                        className={`relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm transition-colors ${
                          atual
                            ? "bg-primary-soft font-medium text-on-primary-soft"
                            : "text-muted hover:bg-surface-muted hover:text-foreground"
                        }`}
                      >
                        {atual ? (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" />
                        ) : null}
                        {conteudo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              </div>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function IconeDaRota({ href }: { href: string }) {
  if (href === "/") return <IconePainel />;
  if (href.includes("pendencias")) return <IconePendencia />;
  if (href.includes("ppgs")) return <IconePessoas />;
  if (href.includes("catalogos")) return <IconeCatalogo />;
  if (href.includes("orcamento") || href.includes("execucao")) return <IconeMoeda />;
  if (href.includes("plano") || href.includes("premissas")) return <IconeDocumento />;
  if (href.includes("redes") || href.includes("tematicas")) return <IconeRede />;
  if (href.includes("mobilidade") || href.includes("convenios")) return <IconeGlobo />;
  if (href.includes("programas")) return <IconePrograma />;
  return <IconeQuadrado />;
}

function Svg({ children }: { children: ReactNode }) {
  return <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[1.125rem]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function IconeMarca() { return <Svg><path d="M3 15c4 0 6.7-2.7 6.7-6.7"/><path d="M6.3 17.5c0-6 3-10 9.2-11.7"/><path d="M10.5 5.8c.8-2.3 3.1-3.3 5.8-3.3 0 3-1.3 5.3-4.2 6.2"/></Svg>; }
function IconePainel() { return <Svg><path d="M3 10a7 7 0 1 1 14 0"/><path d="m10 10 3.5-3.5"/><path d="M4.5 15.5h11"/></Svg>; }
function IconePendencia() { return <Svg><path d="M10 3 18 17H2L10 3Z"/><path d="M10 8v3.5m0 2.5v.01"/></Svg>; }
function IconePessoas() { return <Svg><circle cx="7" cy="7" r="2.5"/><path d="M2.5 16c.5-3 2-4.5 4.5-4.5s4 1.5 4.5 4.5"/><path d="M12.5 5.3a2.5 2.5 0 0 1 0 4.4M14 11.5c2 0 3.2 1.5 3.5 4.5"/></Svg>; }
function IconeCatalogo() { return <Svg><path d="M4 3h10a2 2 0 0 1 2 2v12H6a2 2 0 0 1-2-2V3Z"/><path d="M4 14.5c0-1.4.8-2.5 2.5-2.5H16M7 6h6"/></Svg>; }
function IconeMoeda() { return <Svg><circle cx="10" cy="10" r="7"/><path d="M12.5 7.5H9a1.5 1.5 0 0 0 0 3h2a1.5 1.5 0 0 1 0 3H7.5M10 5.5v9"/></Svg>; }
function IconeDocumento() { return <Svg><path d="M5 2.5h7l3 3V17.5H5V2.5Z"/><path d="M12 2.5v3h3M8 9h4M8 12h4"/></Svg>; }
function IconeRede() { return <Svg><circle cx="10" cy="4" r="2"/><circle cx="4" cy="15" r="2"/><circle cx="16" cy="15" r="2"/><path d="m9 6-4 7m6-7 4 7M6 15h8"/></Svg>; }
function IconeGlobo() { return <Svg><circle cx="10" cy="10" r="7"/><path d="M3 10h14M10 3a11 11 0 0 1 0 14M10 3a11 11 0 0 0 0 14"/></Svg>; }
function IconePrograma() { return <Svg><path d="M3 17h14M5 17V7h10v10M3 7l7-4 7 4M8 10v4m4-4v4"/></Svg>; }
function IconeQuadrado() { return <Svg><rect x="3" y="3" width="14" height="14" rx="3"/><path d="M7 10h6"/></Svg>; }
function IconeSeta() { return <Svg><path d="m8 5 5 5-5 5"/></Svg>; }
function IconeFechar() { return <Svg><path d="m6 6 8 8m0-8-8 8"/></Svg>; }
function IconeMenuGenerico() { return <Svg><path d="M4 6h12M4 10h12M4 14h12"/></Svg>; }
