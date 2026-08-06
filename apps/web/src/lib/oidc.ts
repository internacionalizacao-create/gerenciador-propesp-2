import "server-only";

import * as client from "openid-client";

import { env, usaHttps } from "./env";

/**
 * Cliente OIDC do BFF, configurado por discovery a partir do issuer do realm.
 *
 * Usamos a `openid-client` (certificada pela OpenID Foundation) em vez de montar
 * as requisicoes na mao: ela cuida das validacoes chatas e faceis de errar em
 * silencio — assinatura e `nonce` do ID token, conferencia de `state`, `iss` na
 * resposta de autorizacao, PKCE. Errar qualquer uma delas nao quebra o login,
 * so abre um buraco.
 */
let configuracao: Promise<client.Configuration> | undefined;

export function getOidcConfig(): Promise<client.Configuration> {
  // O discovery e feito uma unica vez por processo e reaproveitado.
  configuracao ??= descobrir();
  return configuracao;
}

async function descobrir(): Promise<client.Configuration> {
  return client.discovery(
    new URL(env.KEYCLOAK_ISSUER_URL),
    env.KEYCLOAK_CLIENT_ID,
    env.KEYCLOAK_CLIENT_SECRET,
    undefined,
    // A biblioteca exige HTTPS por padrao, e com razao. Em dev o Keycloak sobe
    // em http://localhost:8080, entao a restricao e afrouxada apenas ali — com
    // HTTPS (qualquer ambiente real) a checagem continua valendo.
    usaHttps ? undefined : { execute: [client.allowInsecureRequests] },
  );
}

/** URI de retorno; precisa bater com o cadastrado no client do Keycloak. */
export const redirectUri = new URL(
  "/api/auth/callback",
  env.APP_BASE_URL,
).toString();

/**
 * `openid` e obrigatorio para receber ID token; os demais trazem nome, email e
 * papeis do usuario nas claims.
 */
export const scope = "openid profile email";
