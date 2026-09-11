import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";
import { z } from "zod";

import { calcularExpiracao, calcularExpiracaoDoRefresh } from "@/lib/auth";
import { abrirTransacao, TRANSACTION_COOKIE } from "@/lib/auth-transaction";
import { env } from "@/lib/env";
import { getOidcConfig, redirectUri } from "@/lib/oidc";
import {
  gravarCookieSessao,
  selarSessao,
  type Session,
} from "@/lib/session";

/** Claims do ID token que viram o perfil exibido na interface. */
const idTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  preferred_username: z.string().optional(),
  name: z.string().optional(),
  email: z.string().optional(),
});

/**
 * Recebe o usuario de volta do Keycloak e troca o `code` por tokens.
 *
 * A troca acontece server-side, com o client secret: o `code` que passou pelo
 * browser sozinho nao vale nada. Da troca sai a sessao selada em cookie — e o
 * unico momento do fluxo em que os tokens existem fora do servidor e dentro de
 * um envelope criptografado.
 */
export async function GET(request: NextRequest) {
  const tx = await abrirTransacao(request.cookies.get(TRANSACTION_COOKIE)?.value);

  if (!tx) {
    // Sem a transacao nao ha como validar state, nonce nem PKCE. Recomecar o
    // login e a unica saida segura.
    return redirecionarComErro("sessao_de_login_expirada");
  }

  try {
    const config = await getOidcConfig();

    // Reconstruir a URL a partir de APP_BASE_URL em vez de `request.url`: atras
    // de um proxy reverso o `request.url` traz o host interno, e a biblioteca
    // compara a URL recebida com o `redirect_uri` esperado.
    const currentUrl = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      env.APP_BASE_URL,
    );

    const tokens = await client.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: tx.codeVerifier,
        expectedState: tx.state,
        expectedNonce: tx.nonce,
        idTokenExpected: true,
      },
      { redirect_uri: redirectUri },
    );

    if (!tokens.refresh_token) {
      // Sem refresh token a sessao morreria em 5 minutos. Sinaliza realm mal
      // configurado, nao erro do usuario.
      return redirecionarComErro("sem_refresh_token");
    }

    const claims = idTokenClaimsSchema.safeParse(tokens.claims());
    if (!claims.success) {
      return redirecionarComErro("id_token_sem_claims");
    }

    const session: Session = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      idToken: tokens.id_token,
      expiresAt: calcularExpiracao(tokens.expiresIn()),
      refreshExpiresAt: calcularExpiracaoDoRefresh(tokens),
      user: {
        id: claims.data.sub,
        username: claims.data.preferred_username,
        name: claims.data.name ?? claims.data.preferred_username,
        email: claims.data.email,
      },
    };

    const response = NextResponse.redirect(new URL(tx.returnTo, env.APP_BASE_URL));
    gravarCookieSessao(response.cookies, await selarSessao(session));
    // A transacao ja cumpriu seu papel; deixa-la viva so aumentaria a janela de
    // reuso de um `code` interceptado.
    response.cookies.delete(TRANSACTION_COOKIE);

    return response;
  } catch (error) {
    console.error("Falha ao concluir o login OIDC:", error);
    return redirecionarComErro("falha_na_autenticacao");
  }
}

function redirecionarComErro(codigo: string) {
  const destino = new URL("/login", env.APP_BASE_URL);
  destino.searchParams.set("erro", codigo);

  const response = NextResponse.redirect(destino);
  response.cookies.delete(TRANSACTION_COOKIE);
  return response;
}
