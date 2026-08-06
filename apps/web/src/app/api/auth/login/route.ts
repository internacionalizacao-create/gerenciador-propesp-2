import { NextResponse, type NextRequest } from "next/server";
import * as client from "openid-client";

import {
  normalizarReturnTo,
  opcoesCookieTransacao,
  selarTransacao,
  TRANSACTION_COOKIE,
} from "@/lib/auth-transaction";
import { getOidcConfig, redirectUri, scope } from "@/lib/oidc";

/**
 * Inicia o Authorization Code Flow com PKCE.
 *
 * Redireciona o usuario para a tela de login do Keycloak. Nenhuma senha passa
 * por esta aplicacao: quem coleta e valida credencial e o Keycloak, o que faz
 * MFA, politica de senha e federacao (LDAP/AD) virarem configuracao de console
 * em vez de codigo aqui.
 */
export async function GET(request: NextRequest) {
  const config = await getOidcConfig();

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const authorizationUrl = client.buildAuthorizationUrl(config, {
    redirect_uri: redirectUri,
    scope,
    // So o desafio vai na URL; o verifier fica no cookie. Quem interceptar o
    // code na volta nao consegue troca-lo por token sem o verifier.
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  const response = NextResponse.redirect(authorizationUrl);

  response.cookies.set(
    TRANSACTION_COOKIE,
    await selarTransacao({
      state,
      nonce,
      codeVerifier,
      returnTo: normalizarReturnTo(request.nextUrl.searchParams.get("returnTo")),
    }),
    opcoesCookieTransacao,
  );

  return response;
}
