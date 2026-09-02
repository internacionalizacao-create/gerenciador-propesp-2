import Link from "next/link";

import { MenuLateral } from "@/componentes/layout/menu-lateral";
import { ThemeToggle } from "@/componentes/layout/theme-toggle";
import { ToastProvider } from "@/componentes/ui/toast";
import { apiFetch } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import type { Me } from "@/lib/dominio";
import { menu } from "@/lib/navegacao";

/**
 * Casca do sistema.
 *
 * `requireSession()` aqui protege todas as páginas do grupo de uma vez — e é
 * redundante com `proxy.ts` de propósito: a checagem que vale é a que fica
 * colada no dado, não a que roda longe dele. Acima das duas, quem realmente
 * barra é o guard da API.
 */
export default async function LayoutDoApp({
  children,
}: {
  children: React.ReactNode;
}) {
  const sessao = await requireSession();

  // Papéis e permissões vêm da API, não do cookie: quem decide o que o usuário
  // pode é o dono do dado.
  const me = await apiFetch<Me>("/me");

  // O menu do ciclo é montado a partir do que existe no banco. Fixar
  // "capes-global/2027-2030" no código faria o sistema deixar de ser
  // multiprograma no primeiro link.
  const ciclo = await cicloPadrao();
  const nome = me.name ?? sessao.user.username ?? "Usuário";
  const iniciais = nome
    .split(" ")
    .slice(0, 2)
    .map((parte) => parte[0])
    .join("")
    .toUpperCase();

  return (
    <ToastProvider>
    <div className="flex min-h-dvh">
      <MenuLateral grupos={menu(ciclo.programa, ciclo.nome, me.permissions)} />

      <div className="flex min-w-0 flex-1 flex-col bg-[radial-gradient(circle_at_90%_5%,var(--primary-soft),transparent_22rem)]">
        <header className="sticky top-0 z-20 flex min-h-[4.5rem] flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/85 px-5 py-3 backdrop-blur-xl sm:px-7">
          <div className="min-w-0 pl-12 lg:pl-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-primary-soft">
              Gestão integrada
            </p>
            <p className="mt-0.5 truncate text-sm text-muted">
              Planejamento e internacionalização
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/configuracoes" className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-surface-muted">
              <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-xs font-semibold text-on-primary-soft">{iniciais}</span>
              <span className="hidden min-w-0 text-left sm:block">
                <span className="block max-w-36 truncate text-sm font-medium text-foreground">{nome}</span>
                <span className="block max-w-36 truncate text-[0.68rem] text-subtle">{me.roles.filter((p) => !p.includes("_")).join(" · ") || "sem papel"}</span>
              </span>
            </Link>
            {/* POST e não link: sair muda estado, e um <img> em página externa
                não pode disparar isso. */}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-sm font-medium text-muted hover:border-border-strong hover:bg-surface-muted hover:text-foreground"
              >
                Sair
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
    </ToastProvider>
  );
}

/**
 * Programa e ciclo que o menu aponta.
 *
 * Se a API ainda não tem nada, o menu continua montando com um alvo inexistente
 * — as páginas do ciclo mostram o estado vazio. É melhor do que derrubar a
 * casca inteira por falta de dado.
 */
async function cicloPadrao(): Promise<{ programa: string; nome: string }> {
  try {
    const painel = await apiFetch<{
      ciclo: { programaSlug: string; cicloNome: string };
    } | null>("/programas/padrao/painel");

    if (painel) {
      return {
        programa: painel.ciclo.programaSlug,
        nome: painel.ciclo.cicloNome,
      };
    }
  } catch {
    // Sem ciclo, o menu ainda precisa existir.
  }

  return { programa: "capes-global", nome: "2027-2030" };
}
