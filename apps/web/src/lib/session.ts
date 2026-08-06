import "server-only";

import { EncryptJWT, jwtDecrypt } from "jose";
import { z } from "zod";

import { sessionKey, usaHttps } from "./env";

/**
 * Sessao do BFF: os tokens do Keycloak, criptografados em um cookie httpOnly.
 *
 * O browser recebe apenas bytes opacos — nao consegue ler nem usar os tokens.
 * Isso e o que torna um XSS incapaz de roubar credencial: sem `document.cookie`
 * (httpOnly) e sem token em memoria JS, nao ha o que exfiltrar.
 */
export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Guardado para o `id_token_hint` do logout iniciado pela aplicacao. */
  idToken?: string;
  /** Epoch em ms em que o access token expira. */
  expiresAt: number;
  user: SessionUser;
}

export interface SessionUser {
  id: string;
  username?: string;
  name?: string;
  email?: string;
}

const sessionSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  idToken: z.string().optional(),
  expiresAt: z.number(),
  user: z.object({
    id: z.string().min(1),
    username: z.string().optional(),
    name: z.string().optional(),
    email: z.string().optional(),
  }),
});

/**
 * Prefixo `__Host-` (so quando ha HTTPS) instrui o browser a recusar o cookie se
 * ele nao vier com Secure, Path=/ e sem Domain — fecha a porta para subdominio
 * comprometido sobrescrever a sessao. Em HTTP local o prefixo e invalido, entao
 * o nome cai para a versao sem ele.
 */
export const SESSION_COOKIE = usaHttps ? "__Host-gr_session" : "gr_session";

/**
 * Cookie tem teto de ~4 KB por navegador, e access + refresh + id token do
 * Keycloak criptografados passam disso com folga. A sessao e fatiada em
 * `gr_session.0`, `gr_session.1`, ... e remontada na leitura.
 */
const TAMANHO_FATIA = 3500;
/** Teto defensivo: sem isso, ler cookies viraria um laco sem fim. */
const MAX_FATIAS = 8;

/** A sessao expira antes do `ssoSessionMaxLifespan` (10h) do realm. */
const DURACAO_SESSAO_S = 8 * 60 * 60;

/** Subconjunto de `cookies()` do Next que este modulo precisa (leitura). */
interface CookieReader {
  get(name: string): { value: string } | undefined;
}

/** Subconjunto de escrita — Route Handlers e Server Actions expoem isso. */
interface CookieWriter extends CookieReader {
  set(name: string, value: string, options?: CookieOptions): unknown;
  delete(name: string): unknown;
}

interface CookieOptions {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  maxAge?: number;
}

export const opcoesCookieSessao: CookieOptions = {
  httpOnly: true,
  secure: usaHttps,
  // `lax` deixa o cookie acompanhar a navegacao de volta do Keycloak (redirect
  // GET de topo) e, ao mesmo tempo, nao acompanha POST vindo de outro site —
  // que e a defesa base contra CSRF.
  sameSite: "lax",
  path: "/",
  maxAge: DURACAO_SESSAO_S,
};

export async function selarSessao(session: Session): Promise<string> {
  return new EncryptJWT({ ...session })
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .encrypt(sessionKey);
}

export async function abrirSessao(
  selada: string,
): Promise<Session | undefined> {
  try {
    const { payload } = await jwtDecrypt(selada, sessionKey);
    const parsed = sessionSchema.safeParse(payload);
    return parsed.success ? parsed.data : undefined;
  } catch {
    // Cookie adulterado, assinado com outra SESSION_SECRET ou expirado.
    return undefined;
  }
}

export function lerCookieSessao(store: CookieReader): string | undefined {
  const fatias: string[] = [];

  for (let i = 0; i < MAX_FATIAS; i += 1) {
    const fatia = store.get(`${SESSION_COOKIE}.${i}`)?.value;
    if (fatia === undefined) break;
    fatias.push(fatia);
  }

  return fatias.length > 0 ? fatias.join("") : undefined;
}

export function gravarCookieSessao(store: CookieWriter, selada: string): void {
  const fatias: string[] = [];
  for (let i = 0; i < selada.length; i += TAMANHO_FATIA) {
    fatias.push(selada.slice(i, i + TAMANHO_FATIA));
  }

  if (fatias.length > MAX_FATIAS) {
    throw new Error(
      `Sessao com ${selada.length} bytes nao cabe em ${MAX_FATIAS} cookies.`,
    );
  }

  fatias.forEach((fatia, i) => {
    store.set(`${SESSION_COOKIE}.${i}`, fatia, opcoesCookieSessao);
  });

  // Uma sessao anterior pode ter usado mais fatias; sobras nao apagadas seriam
  // concatenadas na proxima leitura e corromperiam o texto cifrado.
  for (let i = fatias.length; i < MAX_FATIAS; i += 1) {
    store.delete(`${SESSION_COOKIE}.${i}`);
  }
}

export function limparCookieSessao(store: CookieWriter): void {
  for (let i = 0; i < MAX_FATIAS; i += 1) {
    store.delete(`${SESSION_COOKIE}.${i}`);
  }
}
