import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";

import { env } from "@/lib/env";
import { getOidcConfig } from "@/lib/oidc";
import { abrirSessao, lerCookieSessao, limparCookieSessao } from "@/lib/session";

/**
 * Encerra a sessao aqui e tambem no Keycloak (RP-Initiated Logout).
 *
 * Apagar so o cookie daria a impressao de ter saido: no clique seguinte em
 * "Entrar" o SSO reconheceria a sessao ainda viva e devolveria o usuario logado
 * sem pedir senha. Em maquina compartilhada isso e um problema de verdade.
 *
 * Exposto apenas em POST: um `<img src="/api/auth/logout">` em qualquer pagina
 * da internet deslogaria o usuario se GET funcionasse.
 */
export async function POST(request: NextRequest) {
  const selada = lerCookieSessao(request.cookies);
  const session = selada ? await abrirSessao(selada) : undefined;

  const destino = await urlDeSaida(session?.idToken);
  const response = NextResponse.redirect(destino, {
    // 303 troca o POST por um GET no destino, como manda o HTTP para
    // redirecionamento apos submissao de formulario.
    status: 303,
  });

  limparCookieSessao(response.cookies);
  return response;
}

async function urlDeSaida(idToken: string | undefined): Promise<URL> {
  if (!idToken) return new URL("/", env.APP_BASE_URL);

  try {
    const config = await getOidcConfig();
    return client.buildEndSessionUrl(config, {
      // Identifica qual sessao encerrar; sem ele o Keycloak abre uma tela de
      // confirmacao em vez de deslogar direto.
      id_token_hint: idToken,
      post_logout_redirect_uri: new URL("/", env.APP_BASE_URL).toString(),
    });
  } catch (error) {
    console.error("Nao foi possivel montar a URL de logout do Keycloak:", error);
    // O cookie local ja vai ser apagado de qualquer forma.
    return new URL("/", env.APP_BASE_URL);
  }
}
