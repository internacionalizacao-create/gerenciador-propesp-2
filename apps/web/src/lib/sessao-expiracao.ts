import { z } from "zod";

/**
 * Quando a sessão do BFF deixa de ter conserto.
 *
 * Módulo neutro de propósito: `lib/auth.ts` é `server-only` e carrega o cliente
 * OIDC e o ambiente validado, então não abre no `node --test`. A regra que
 * decide se ainda dá para renovar é justamente a que precisa de regressão.
 */

/**
 * `refresh_expires_in` não está na tipagem do openid-client — é parâmetro extra
 * do Keycloak, e espelha o ocioso da sessão SSO do realm. Por isso é lido com
 * zod, e não por `as`: se o realm deixar de mandá-lo, vira `undefined` e o
 * fluxo segue como antes, renovando até o Keycloak recusar.
 */
const refreshExpiresInSchema = z.object({
  refresh_expires_in: z.number().positive(),
});

export function calcularExpiracaoDoRefresh(
  tokens: unknown,
  agora: number = Date.now(),
): number | undefined {
  const lido = refreshExpiresInSchema.safeParse(tokens);
  return lido.success ? agora + lido.data.refresh_expires_in * 1000 : undefined;
}

/**
 * Refresh token que o Keycloak já não aceitaria.
 *
 * Sem `refreshExpiresAt` a resposta é `false`: sessão selada antes do campo, ou
 * realm que não informa o prazo, continua tentando renovar — tratar a ausência
 * como vencida deslogaria todo mundo no dia em que isto subisse.
 */
export function refreshVencido(
  sessao: { refreshExpiresAt?: number },
  agora: number = Date.now(),
): boolean {
  return (
    sessao.refreshExpiresAt !== undefined && agora >= sessao.refreshExpiresAt
  );
}
