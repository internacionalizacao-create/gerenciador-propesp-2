import type { NextConfig } from "next";

function hostnameDaAplicacao(): string | undefined {
  try {
    return process.env.APP_BASE_URL
      ? new URL(process.env.APP_BASE_URL).hostname
      : undefined;
  } catch {
    // A validacao autoritativa e feita em src/lib/env.ts, com mensagem completa.
    return undefined;
  }
}

const hostname = hostnameDaAplicacao();

/**
 * Teto do corpo das requisicoes que carregam upload.
 *
 * O arquivo passa por uma Server Action antes de chegar a API (o browser nunca
 * fala com ela), e o Next tem dois limites no caminho: 1 MB na Server Action,
 * que recusava quase todo PDF real, e 10 MB no `proxy.ts`, que **trunca em
 * silencio** o que passar disso. Os dois acompanham o limite da API
 * (`ANEXO_TAMANHO_MAXIMO`, 25 MB) com folga para os bytes do multipart.
 */
const LIMITE_DE_UPLOAD = "26mb";

const nextConfig: NextConfig = {
  // O Next bloqueia assets de dev vindos de outra origem. No demo, o hostname
  // e o dominio HTTPS entregue pelo ngrok e precisa hidratar Client Components.
  allowedDevOrigins: hostname ? [hostname] : undefined,
  experimental: {
    serverActions: { bodySizeLimit: LIMITE_DE_UPLOAD },
    proxyClientMaxBodySize: LIMITE_DE_UPLOAD,
  },
};

export default nextConfig;
