/**
 * Cabeçalho interno com a rota que o usuário pediu.
 *
 * O `proxy.ts` o escreve na requisição que segue para o render; `apiFetch` o lê
 * para montar o `returnTo` do login quando a sessão morre no meio da página.
 * Sem ele, quem fosse expulso de uma tela funda voltaria para a home depois de
 * autenticar de novo.
 *
 * É de entrada, nunca de saída: o proxy o injeta com
 * `NextResponse.next({ request: { headers } })`, então ele não chega ao browser.
 */
export const CABECALHO_ROTA = "x-rota-atual";
