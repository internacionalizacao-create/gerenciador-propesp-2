"use client";

import Link from "next/link";
import { useEffect } from "react";

import { Botao } from "@/componentes/ui/botao";

/**
 * Erro inesperado dentro da área logada.
 *
 * Sem este arquivo, qualquer exceção de Server Component caía na tela de erro
 * padrão do Next — em produção, um "Application error" sem saída nenhuma. O
 * caso que mais aparecia era o da sessão que morreu no Keycloak: o redirect
 * para o login agora acontece em `apiFetch`, e esta tela é a rede embaixo dele,
 * para o resto.
 *
 * Os dois caminhos existem porque a causa não é conhecida aqui: recarregar
 * resolve falha momentânea da API; entrar de novo resolve credencial morta.
 */
export default function ErroDaAplicacao({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // O digest é o que liga esta tela à linha correspondente no log do
    // servidor; a mensagem em si não chega ao cliente em produção.
    console.error("Erro na área logada:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
        Não foi possível carregar esta página
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Pode ter sido uma falha momentânea do servidor ou sua sessão pode ter
        expirado. Tente de novo; se continuar, entre novamente.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-subtle">
          Código para o suporte: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Botao type="button" onClick={reset}>
          Tentar de novo
        </Botao>
        <Botao comoFilho variante="contorno">
          <Link href="/login">Entrar novamente</Link>
        </Botao>
      </div>
    </main>
  );
}
