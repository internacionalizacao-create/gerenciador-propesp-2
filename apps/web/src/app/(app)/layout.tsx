import Link from "next/link";

import { MenuLateral } from "@/componentes/layout/menu-lateral";
import { ThemeToggle } from "@/componentes/layout/theme-toggle";
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

  return (
    <div className="flex min-h-dvh">
      <MenuLateral grupos={menu(ciclo.programa, ciclo.nome)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface/90 px-6 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {me.name ?? sessao.user.username}
            </p>
            <p className="truncate text-xs text-subtle">
              {me.roles.filter((p) => !p.includes("_")).join(" · ") ||
                "sem papel"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/configuracoes"
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
            >
              Conta
            </Link>
            {/* POST e não link: sair muda estado, e um <img> em página externa
                não pode disparar isso. */}
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Sair
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
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
