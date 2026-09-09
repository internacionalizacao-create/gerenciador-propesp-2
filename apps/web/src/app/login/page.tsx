import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Aviso, Selo } from "@/componentes/ui/basicos";
import { Botao } from "@/componentes/ui/botao";
import { getSession } from "@/lib/auth";
import { normalizarReturnTo } from "@/lib/auth-transaction";

export const metadata: Metadata = {
  title: "Entrar — Gerenciador PROPESP",
};

/** Mensagens dos codigos que o callback devolve em `?erro=`. */
const MENSAGENS_DE_ERRO: Record<string, string> = {
  sessao_de_login_expirada:
    "O login demorou demais para ser concluído. Tente novamente.",
  sem_refresh_token:
    "O Keycloak não emitiu um token de renovação. Avise a equipe de TI.",
  id_token_sem_claims:
    "A resposta do Keycloak veio sem os dados do usuário. Avise a equipe de TI.",
  falha_na_autenticacao: "Não foi possível concluir a autenticação.",
};

function MarcaPropesp() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-11 place-items-center rounded-xl bg-primary text-on-primary shadow-sm">
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 18c4.8 0 8-3.2 8-8" />
          <path d="M8 21c0-7.2 3.6-12 11-14" />
          <path d="M13 7c1-2.7 3.7-4 7-4 0 3.6-1.5 6.4-5 7.5" />
        </svg>
      </span>
      <span>
        <span className="block text-sm font-semibold tracking-wide text-foreground">
          PROPESP
        </span>
        <span className="block text-xs text-muted">
          Planejamento e gestão
        </span>
      </span>
    </div>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; erro?: string }>;
}) {
  const { returnTo, erro } = await searchParams;

  // Quem ja tem sessao nao precisa ver esta tela.
  if (await getSession()) {
    redirect(normalizarReturnTo(returnTo ?? null));
  }

  const destinoLogin = `/api/auth/login?returnTo=${encodeURIComponent(
    normalizarReturnTo(returnTo ?? null),
  )}`;

  return (
    <main className="relative isolate flex min-h-svh flex-1 overflow-hidden bg-background">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_12%_18%,var(--primary-soft),transparent_31%),radial-gradient(circle_at_88%_82%,var(--surface-muted),transparent_28%)] opacity-70"
      />

      <div className="mx-auto grid w-full max-w-7xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden min-h-svh flex-col justify-between border-r border-border px-12 py-10 lg:flex xl:px-20 xl:py-14">
          <MarcaPropesp />

          <div className="max-w-xl pb-12">
            <div className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.22em] text-on-primary-soft">
              <span className="h-px w-8 bg-primary" />
              Gestão integrada
            </div>
            <h1 className="text-5xl font-semibold leading-[1.08] tracking-[-0.045em] text-foreground xl:text-6xl">
              Recursos que ampliam horizontes.
            </h1>
            <p className="mt-7 max-w-lg text-lg leading-8 text-muted">
              Planeje bolsas, mobilidade e investimentos de internacionalização
              em um só lugar, com clareza e segurança.
            </p>

            <div className="mt-12 grid max-w-lg grid-cols-3 gap-3">
              {[
                ["Planejamento", "por programa"],
                ["Orçamento", "em tempo real"],
                ["Governança", "com segurança"],
              ].map(([titulo, detalhe]) => (
                <div
                  key={titulo}
                  className="rounded-2xl border border-border bg-surface/70 px-4 py-4 backdrop-blur-sm"
                >
                  <span className="block text-sm font-semibold text-foreground">
                    {titulo}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{detalhe}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-subtle">
            Pró-Reitoria de Pesquisa e Pós-Graduação
          </p>
        </section>

        <section className="flex min-h-svh items-center justify-center px-5 py-8 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="mb-10 lg:hidden">
              <MarcaPropesp />
            </div>

            <div className="rounded-3xl border border-border bg-surface p-7 shadow-[0_24px_70px_-32px_var(--border-strong)] sm:p-10">
              <Selo tom="primario">Ambiente institucional</Selo>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-foreground">
                Boas-vindas
              </h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                Entre com sua conta institucional para acessar o Gerenciador
                PROPESP.
              </p>

              {erro ? (
                <div className="mt-6">
                  <Aviso tom="perigo" titulo="Não foi possível entrar">
                    {MENSAGENS_DE_ERRO[erro] ??
                      "Ocorreu um erro inesperado no login."}
                  </Aviso>
                </div>
              ) : null}

              {/* Link e nao formulario: iniciar o login e uma navegacao GET, sem
                  efeito colateral no servidor alem do cookie da transacao. */}
              <Botao comoFilho className="mt-8 h-12 w-full">
                <a href={destinoLogin}>
                  Entrar com conta institucional
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="size-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14m-5-5 5 5-5 5" />
                  </svg>
                </a>
              </Botao>

              <div className="mt-6 flex items-start gap-3 border-t border-border pt-6">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="mt-0.5 size-4 shrink-0 text-subtle"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="5" y="10" width="14" height="10" rx="2" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                <p className="text-xs leading-5 text-subtle">
                  Sua senha é informada diretamente ao servidor de autenticação
                  e nunca passa por este sistema.
                </p>
              </div>
            </div>

            <p className="mt-7 text-center text-xs text-subtle">
              Acesso restrito a usuários autorizados
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
