import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import * as client from "openid-client";

import { getOidcConfig } from "./oidc";
import { irParaLogin } from "./sessao-encerrada";
import {
  calcularExpiracaoDoRefresh,
  refreshVencido,
} from "./sessao-expiracao";
import {
  abrirSessao,
  gravarCookieSessao,
  lerCookieSessao,
  limparCookieSessao,
  selarSessao,
  type Session,
  type SessionUser,
} from "./session";

export { calcularExpiracaoDoRefresh } from "./sessao-expiracao";

/**
 * Camada de acesso a sessao (o "DAL" da documentacao do Next).
 *
 * Toda leitura de identidade passa por aqui. Concentrar isso em um lugar e o que
 * permite afirmar, olhando um arquivo so, que nao existe caminho que leia o
 * cookie sem validar — o contrario de espalhar `cookies().get(...)` pelas paginas.
 */

/**
 * Access tokens do realm duram 5 minutos. Renovar 30s antes do vencimento evita
 * mandar para a API um token que expira no meio do voo.
 */
const MARGEM_RENOVACAO_MS = 30_000;

/**
 * `cache` memoiza por passagem de render: varios Server Components na mesma
 * pagina chamando `getSession()` decifram o cookie uma vez so.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const store = await cookies();

  const selada = lerCookieSessao(store);
  if (!selada) return null;

  const session = await abrirSessao(selada);
  if (!session) return null;

  // Refresh vencido nao tem volta: tentar renovar so gastaria uma ida ao
  // Keycloak para receber o mesmo "nao".
  if (refreshVencido(session)) {
    tentarEscreverCookie(() => limparCookieSessao(store));
    return null;
  }

  if (session.expiresAt - Date.now() > MARGEM_RENOVACAO_MS) {
    return session;
  }

  const renovada = await renovarSessao(session);
  if (!renovada) {
    // Refresh token morto (logout no Keycloak, sessao expirada, revogacao).
    tentarEscreverCookie(() => limparCookieSessao(store));
    return null;
  }

  // Em Server Component o cookie store e somente leitura e isto lanca. Nao e
  // erro: a sessao renovada vale para este render, e a proxima navegacao passa
  // pelo proxy ou por um Route Handler, que conseguem persistir.
  const seladaNova = await selarSessao(renovada);
  tentarEscreverCookie(() => gravarCookieSessao(store, seladaNova));

  return renovada;
});

/**
 * Igual a `getSession`, mas manda para o login em vez de devolver `null`.
 *
 * Pelo mesmo caminho de `apiFetch`: os dois descobrem a sessao morta no mesmo
 * render, em paralelo, e qualquer um pode chegar primeiro — se cada um
 * redirecionasse de um jeito, o `returnTo` dependeria de quem ganhasse a
 * corrida.
 */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) return irParaLogin();
  return session;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/**
 * Troca o refresh token por um par novo. Devolve `undefined` quando o Keycloak
 * recusa — o que e um resultado esperado, nao uma excecao.
 */
export async function renovarSessao(
  session: Session,
): Promise<Session | undefined> {
  try {
    const config = await getOidcConfig();
    const tokens = await client.refreshTokenGrant(config, session.refreshToken);

    return {
      accessToken: tokens.access_token,
      // O realm pode ter rotacao de refresh token ligada; se veio um novo, ele
      // substitui o antigo (que o Keycloak acabou de invalidar).
      refreshToken: tokens.refresh_token ?? session.refreshToken,
      idToken: tokens.id_token ?? session.idToken,
      expiresAt: calcularExpiracao(tokens.expiresIn()),
      refreshExpiresAt: calcularExpiracaoDoRefresh(tokens),
      user: session.user,
    };
  } catch {
    return undefined;
  }
}

export function calcularExpiracao(expiresInSegundos: number | undefined): number {
  // Sem `expires_in` na resposta, assume o pior caso curto e deixa a proxima
  // requisicao renovar — melhor renovar a toa do que usar token vencido.
  return Date.now() + (expiresInSegundos ?? 60) * 1000;
}

function tentarEscreverCookie(escrita: () => void): void {
  try {
    escrita();
  } catch {
    // Contexto de render: cookies sao somente leitura.
  }
}
