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

const nextConfig: NextConfig = {
  // O Next bloqueia assets de dev vindos de outra origem. No demo, o hostname
  // e o dominio HTTPS entregue pelo ngrok e precisa hidratar Client Components.
  allowedDevOrigins: hostname ? [hostname] : undefined,
};

export default nextConfig;
