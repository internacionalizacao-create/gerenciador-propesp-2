import { NextResponse, type NextRequest } from "next/server";

import { CABECALHO_ROTA } from "@/lib/cabecalhos";
import { refreshVencido } from "@/lib/sessao-expiracao";
import {
  abrirSessao,
  lerCookieSessao,
  limparCookieSessao,
} from "@/lib/session";

/**
 * Checagem otimista de sessao (o antigo `middleware.ts`, renomeado no Next 16).
 *
 * Roda antes de renderizar e serve para uma coisa so: evitar que quem nao esta
 * logado veja o esqueleto de uma pagina protegida piscar antes do redirect.
 *
 * NAO e a linha de defesa. O proxy roda ate em rota pre-carregada por prefetch,
 * entao aqui so se le o cookie — nada de chamada de rede ou banco. Quem de fato
 * protege dado e o `requireSession()` no layout e, acima de tudo, o guard da
 * API: mesmo que este arquivo suma, nenhuma pagina renderiza dado sem token.
 *
 * A lista e de rotas PUBLICAS, nao de protegidas. Com o sistema inteiro atras de
 * login, enumerar o que e protegido significaria lembrar de acrescentar cada
 * tela nova — e esquecer seria uma falha silenciosa. Enumerar o que e publico
 * falha do lado seguro: no maximo pede login onde nao precisava.
 */
const ROTAS_PUBLICAS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const publica = ROTAS_PUBLICAS.some(
    (rota) => pathname === rota || pathname.startsWith(`${rota}/`),
  );
  if (publica) return NextResponse.next();

  const selada = lerCookieSessao(request.cookies);
  const session = selada ? await abrirSessao(selada) : undefined;

  /**
   * Cookie selado valido **nao** significa sessao viva: o envelope dura 8h e os
   * tokens de dentro morrem muito antes. Quando o proprio Keycloak disse ate
   * quando o refresh valeria, da para saber aqui — sem rede — que renovar nao
   * tem como dar certo, e mandar para o login antes de renderizar.
   */
  if (session && !refreshVencido(session)) {
    // A rota pedida segue no cabecalho para o `apiFetch` montar o `returnTo` se
    // a sessao morrer no meio do render.
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set(CABECALHO_ROTA, `${pathname}${search}`);
    return NextResponse.next({ request: { headers: cabecalhos } });
  }

  const login = new URL("/login", request.nextUrl.origin);
  // Depois de autenticar, o usuario volta para onde estava tentando ir.
  login.searchParams.set("returnTo", `${pathname}${search}`);

  const resposta = NextResponse.redirect(login);
  // Cookie morto apagado aqui, onde a escrita e permitida: deixa-lo passaria
  // pelo mesmo caminho em toda navegacao seguinte.
  if (selada) limparCookieSessao(resposta.cookies);
  return resposta;
}

export const config = {
  // Sem matcher o proxy rodaria ate em CSS e imagem. As rotas de `/api` ficam
  // de fora: `/api/auth/*` e o caminho de quem ainda nao tem sessao, e
  // `/api/bff/*` ja faz a propria checagem antes de repassar para a API.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.svg$).*)"],
};
