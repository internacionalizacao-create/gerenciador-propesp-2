"use client";

import { useEffect } from "react";

/**
 * Rede de segurança do layout raiz.
 *
 * Só entra quando o erro acontece antes do layout da área logada existir — aí
 * nem a casca do sistema está montada, e por isso este arquivo traz `<html>` e
 * `<body>` próprios e nenhum componente do sistema. Estilo inline pelo mesmo
 * motivo: o CSS global pode não ter chegado.
 */
export default function ErroGlobal({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro global:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f7f8f7",
          color: "#14201a",
        }}
      >
        <main style={{ maxWidth: "32rem", padding: "2rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", margin: 0 }}>
            Não foi possível carregar o sistema
          </h1>
          <p style={{ lineHeight: 1.6, color: "#4a5b52" }}>
            Tente de novo. Se o problema continuar, entre novamente no sistema.
          </p>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              justifyContent: "center",
              marginTop: "1.5rem",
            }}
          >
            <button
              type="button"
              onClick={reset}
              style={{
                padding: "0.625rem 1rem",
                borderRadius: "0.5rem",
                border: "none",
                background: "#1f5d3f",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Tentar de novo
            </button>
            <a
              href="/login"
              style={{
                padding: "0.625rem 1rem",
                borderRadius: "0.5rem",
                border: "1px solid #c7d2cb",
                color: "#14201a",
                textDecoration: "none",
              }}
            >
              Entrar novamente
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
