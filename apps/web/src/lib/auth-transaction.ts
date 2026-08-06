import "server-only";

import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";

import { sessionKey, usaHttps } from "./env";

/**
 * Estado efemero de um login em andamento, guardado entre o redirect para o
 * Keycloak e a volta no callback.
 *
 * Vive em um cookie proprio, separado da sessao, porque tem tempo de vida e
 * ciclo diferentes: nasce no `/api/auth/login`, e consumido uma unica vez no
 * callback e some. Nao ha nada aqui que sobreviva ao login.
 */
export interface AuthTransaction {
  /** Amarra a resposta do Keycloak a esta requisicao (anti-CSRF do OAuth). */
  state: string;
  /** Amarra o ID token a esta requisicao (anti-replay do OIDC). */
  nonce: string;
  /** Segredo do PKCE: prova que quem troca o code e quem o pediu. */
  codeVerifier: string;
  /** Para onde mandar o usuario depois do login. Sempre um caminho relativo. */
  returnTo: string;
}

const transactionSchema = z.object({
  state: z.string().min(1),
  nonce: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnTo: z.string().startsWith("/"),
});

export const TRANSACTION_COOKIE = usaHttps ? "__Host-gr_auth_tx" : "gr_auth_tx";

/** Tempo para o usuario digitar usuario e senha no Keycloak. */
const DURACAO_TRANSACAO_S = 10 * 60;

export const opcoesCookieTransacao = {
  httpOnly: true,
  secure: usaHttps,
  // `lax` e obrigatorio aqui: o cookie precisa acompanhar o GET de topo com que
  // o Keycloak devolve o usuario. Com `strict` ele nao viria, e todo login
  // falharia na validacao de state.
  sameSite: "lax" as const,
  path: "/",
  maxAge: DURACAO_TRANSACAO_S,
};

export async function selarTransacao(tx: AuthTransaction): Promise<string> {
  return new EncryptJWT({ ...tx })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_TRANSACAO_S}s`)
    .encrypt(sessionKey);
}

export async function abrirTransacao(
  selada: string | undefined,
): Promise<AuthTransaction | undefined> {
  if (!selada) return undefined;

  try {
    const { payload } = await jwtDecrypt(selada, sessionKey);
    const parsed = transactionSchema.safeParse(payload);
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reduz um `returnTo` vindo da URL a um caminho interno seguro.
 *
 * Sem isso, `/api/auth/login?returnTo=https://site-falso/` transformaria o login
 * em um redirecionador aberto: o usuario confere o dominio, digita a senha e e
 * cuspido em outro site com a aparencia de ter vindo de nos. `//host` e
 * `/\host` sao rejeitados porque o browser os trata como URL absoluta.
 */
export function normalizarReturnTo(bruto: string | null): string {
  // O painel executivo e a primeira tela do sistema.
  const padrao = "/";
  if (!bruto) return padrao;

  const semEscape = bruto.replace(/\\/g, "/");
  if (!semEscape.startsWith("/") || semEscape.startsWith("//")) return padrao;

  return semEscape;
}
