import "server-only";

import { z } from "zod";

/**
 * Contrato de ambiente do BFF.
 *
 * `server-only` faz o build quebrar se este modulo for importado por engano de
 * um Client Component — o que vazaria `KEYCLOAK_CLIENT_SECRET` e `SESSION_SECRET`
 * para o bundle do browser.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** URL publica desta app. Base do redirect_uri registrado no Keycloak. */
  APP_BASE_URL: z.url(),

  /** URL da API NestJS, acessada apenas server-side. */
  API_BASE_URL: z.url(),

  /** Issuer do realm, igual a claim `iss` dos tokens. */
  KEYCLOAK_ISSUER_URL: z.url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  /** Segredo do client confidencial. So o servidor do Next conhece. */
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),

  /**
   * Chave de 32 bytes em base64url que criptografa o cookie de sessao.
   * Gere com: openssl rand -base64 32 | tr '+/' '-_' | tr -d '='
   */
  SESSION_SECRET: z
    .string()
    .min(1)
    .refine(
      (value) => decodeBase64Url(value)?.length === 32,
      "SESSION_SECRET precisa ser exatamente 32 bytes em base64url",
    ),
});

function decodeBase64Url(value: string): Uint8Array | undefined {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return undefined;
  }
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Variaveis de ambiente invalidas em apps/web:\n${detalhes}\n\n` +
      `Copie apps/web/.env.example para apps/web/.env.local e preencha.`,
  );
}

export const env = parsed.data;

/**
 * Em HTTP (dev) o browser descarta cookies `Secure`, entao a flag acompanha o
 * protocolo do APP_BASE_URL em vez de ser fixa.
 */
export const usaHttps = env.APP_BASE_URL.startsWith("https://");

export const sessionKey = new Uint8Array(
  Buffer.from(env.SESSION_SECRET, "base64url"),
);

/**
 * Monta a URL de um endpoint da API preservando o caminho do `API_BASE_URL`.
 *
 * `new URL("/me", "https://host/api")` devolve `https://host/me` — o `/api` some,
 * porque um caminho absoluto substitui o da base. Hoje a base nao tem prefixo e
 * ninguem notaria; atras de um gateway com prefixo, toda chamada iria para o
 * lugar errado com cara de erro de rota.
 */
export function urlDaApi(path: string): URL {
  const base = env.API_BASE_URL.replace(/\/+$/, "");
  return new URL(`${base}/${path.replace(/^\/+/, "")}`);
}
