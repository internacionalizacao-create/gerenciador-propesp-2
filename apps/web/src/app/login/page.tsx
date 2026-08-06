import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";
import { normalizarReturnTo } from "@/lib/auth-transaction";

export const metadata: Metadata = {
  title: "Entrar — Gerenciador PROPESP",
};

/** Mensagens dos codigos que o callback devolve em `?erro=`. */
const MENSAGENS_DE_ERRO: Record<string, string> = {
  sessao_de_login_expirada:
    "O login demorou demais para ser concluido. Tente novamente.",
  sem_refresh_token:
    "O Keycloak nao emitiu um token de renovacao. Avise a equipe de TI.",
  id_token_sem_claims:
    "A resposta do Keycloak veio sem os dados do usuario. Avise a equipe de TI.",
  falha_na_autenticacao: "Nao foi possivel concluir a autenticacao.",
};

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Gerenciador PROPESP
      </h1>
      <p className="mt-2 text-sm text-muted">
        Acesse com sua conta institucional para continuar.
      </p>

      {erro ? (
        <p
          role="alert"
          className="mt-6 rounded-lg bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
        >
          {MENSAGENS_DE_ERRO[erro] ?? "Ocorreu um erro inesperado no login."}
        </p>
      ) : null}

      {/* Link e nao formulario: iniciar o login e uma navegacao GET, sem efeito
          colateral no servidor alem do cookie da transacao. */}
      <a
        href={destinoLogin}
        className="mt-8 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-on-primary hover:bg-primary-hover"
      >
        Entrar com a conta institucional
      </a>

      <p className="mt-4 text-xs text-subtle">
        Voce sera levado ao servidor de autenticacao. Sua senha e digitada la, e
        nunca passa por este sistema.
      </p>
    </main>
  );
}
