import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { normalizarReturnTo } from "./auth-transaction";
import { CABECALHO_ROTA } from "./cabecalhos";
import { limparCookieSessao } from "./session";

/**
 * Interrompe o render e manda para o login.
 *
 * Existe em módulo próprio porque os dois caminhos que descobrem a sessão morta
 * precisam terminar igual: `requireSession()` (layout) e `apiFetch` (página e
 * Server Action). Eles renderizam **em paralelo**, então qualquer um pode
 * chegar primeiro — e antes disto cada um fazia uma coisa: o layout
 * redirecionava sem `returnTo`, a página estourava um erro sem tratamento e a
 * pessoa via a tela de erro do Next em vez do login.
 *
 * Limpar o cookie é parte da correção: um envelope selado válido com tokens
 * mortos passaria pelo proxy em toda navegação seguinte.
 *
 * `redirect` sinaliza por exceção; quem chamar isto dentro de `try/catch`
 * precisa de `unstable_rethrow` (ver [acao.ts](./acao.ts)).
 */
export async function irParaLogin(): Promise<never> {
  try {
    limparCookieSessao(await cookies());
  } catch {
    // Contexto de render: cookies são somente leitura. O proxy limpa na
    // próxima requisição.
  }

  const returnTo = normalizarReturnTo((await headers()).get(CABECALHO_ROTA));

  redirect(
    returnTo === "/"
      ? "/login"
      : `/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
}
