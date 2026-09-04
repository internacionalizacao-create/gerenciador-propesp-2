"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { BffError } from "@/lib/bff";

/**
 * Provedor do TanStack Query.
 *
 * O `QueryClient` nasce dentro de `useState` e nao em modulo. Em modulo ele
 * viraria um singleton do processo do servidor, e o cache de um usuario logado
 * poderia ser servido para o proximo — o mesmo motivo pelo qual `apiFetch` usa
 * `cache: "no-store"`.
 */
export function ProvedorDeConsultas({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A pagina ja chega renderizada do servidor. Sem este intervalo, a
            // montagem no cliente dispararia de imediato uma segunda busca do
            // mesmo dado que acabou de ser pintado.
            staleTime: 30_000,
            retry: (tentativas, erro) => {
              // 401/403 nao melhoram com insistencia: ou a sessao caiu, ou o
              // perfil nao permite. Repetir so atrasa a mensagem correta.
              if (erro instanceof BffError && erro.status < 500) return false;
              return tentativas < 2;
            },
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}
