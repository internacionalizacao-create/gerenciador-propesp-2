import { z } from 'zod';

import type { Permission } from './permissions';

/**
 * Formato do access token emitido pelo Keycloak (apenas o que consumimos).
 *
 * A assinatura ja foi conferida contra o JWKS antes disso rodar; este schema
 * cuida da outra metade do problema, que a criptografia nao resolve: garantir
 * que o *conteudo* tem a forma que o codigo assume. Sem isso, um `realm_access`
 * ausente vira `undefined.roles` em tempo de execucao.
 */
export const accessTokenClaimsSchema = z.object({
  sub: z.string().min(1),
  /** Keycloak marca access tokens com `Bearer`; ID tokens vem com `ID`. */
  typ: z.string().optional(),
  /** clientId que solicitou o token (authorized party). */
  azp: z.string().optional(),
  /** id da sessao SSO — util para correlacionar logs com o Keycloak. */
  sid: z.string().optional(),
  jti: z.string().optional(),
  exp: z.number().optional(),
  preferred_username: z.string().optional(),
  email: z.email().optional(),
  name: z.string().optional(),
  given_name: z.string().optional(),
  family_name: z.string().optional(),
  realm_access: z.object({ roles: z.array(z.string()).default([]) }).optional(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

/**
 * Identidade autenticada anexada a `request.user`.
 *
 * `permissions` **nao vem do token**: desde 2026-09-16 ela e preenchida pelo
 * `JwtAuthGuard` a partir das concessoes locais da conta. Um `AuthUser` montado
 * fora do guard nasce sem permissao nenhuma, e essa e a falha segura — o token
 * sozinho nao autoriza nada.
 */
export interface AuthUser {
  /** `sub` do Keycloak — identificador estavel do usuario. */
  readonly id: string;
  readonly username?: string;
  readonly email?: string;
  readonly name?: string;
  readonly sessionId?: string;
  readonly roles: readonly string[];
  readonly permissions: readonly Permission[];
}

/**
 * Claims -> identidade, **sem autorizacao nenhuma**.
 *
 * Os papeis continuam sendo lidos porque aparecem no `/me` e ajudam o suporte a
 * reconhecer a conta no console do Keycloak. Eles nao concedem acesso: quem
 * concede e `concessao_acesso`, e o guard preenche `permissions` a partir dela.
 */
export function toAuthUser(claims: AccessTokenClaims): AuthUser {
  return {
    id: claims.sub,
    username: claims.preferred_username,
    email: claims.email,
    name: claims.name ?? claims.preferred_username,
    sessionId: claims.sid,
    roles: claims.realm_access?.roles ?? [],
    permissions: [],
  };
}
