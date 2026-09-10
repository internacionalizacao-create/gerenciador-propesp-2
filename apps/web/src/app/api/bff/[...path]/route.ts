import { NextResponse, type NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { env, urlDaApi } from "@/lib/env";

/**
 * Repassa chamadas do browser para a API NestJS, injetando o access token.
 *
 * E a peca que fecha o desenho BFF do lado do cliente: um Client Component que
 * precise buscar dados chama `/api/bff/...` com o cookie de sessao, e o token
 * so aparece deste lado. Sem esta rota, a primeira tela que precisasse de fetch
 * no browser criaria pressao para expor o token — que e exatamente o que o
 * desenho quer evitar.
 *
 * Server Components e Server Actions nao passam por aqui: usam `apiFetch`
 * diretamente, sem o salto HTTP extra.
 */

const METODOS_SEM_EFEITO = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Headers que descrevem a conexao entre browser e Next, e nao a requisicao em
 * si. Repassa-los adulteraria a chamada para a API.
 */
const HEADERS_NAO_REPASSADOS = new Set([
  "host",
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "content-length",
  // O browser nao dita a credencial: quem monta o Authorization e este proxy.
  "authorization",
  // O cookie de sessao para aqui; a API nunca deve ve-lo.
  "cookie",
]);

async function handler(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  // O cookie e `SameSite=Lax`, o que ja barra POST cross-site. A conferencia de
  // Origin e a segunda tranca: cobre o caso de um browser antigo sem suporte a
  // SameSite e deixa a intencao explicita no codigo.
  if (!METODOS_SEM_EFEITO.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && origin !== env.APP_BASE_URL) {
      return NextResponse.json({ message: "Origem não permitida" }, { status: 403 });
    }
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ message: "Não autenticado" }, { status: 401 });
  }

  const { path } = await context.params;
  const destino = urlDaApi(path.join("/"));
  destino.search = request.nextUrl.search;

  const headers = new Headers();
  request.headers.forEach((valor, nome) => {
    if (!HEADERS_NAO_REPASSADOS.has(nome.toLowerCase())) {
      headers.set(nome, valor);
    }
  });
  headers.set("Authorization", `Bearer ${session.accessToken}`);

  const resposta = await fetch(destino, {
    method: request.method,
    headers,
    body: METODOS_SEM_EFEITO.has(request.method) ? undefined : request.body,
    // Requisito do fetch do Node quando o corpo e um stream.
    duplex: "half",
    redirect: "manual",
    cache: "no-store",
  } as RequestInit);

  return new NextResponse(resposta.body, {
    status: resposta.status,
    statusText: resposta.statusText,
    headers: limparHeadersDeResposta(resposta.headers),
  });
}

function limparHeadersDeResposta(origem: Headers): Headers {
  const headers = new Headers(origem);
  // `content-encoding`/`content-length` descrevem o corpo ja decodificado pelo
  // fetch; repassa-los faria o browser tentar descomprimir texto puro.
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("transfer-encoding");
  // A API nao deveria mandar Set-Cookie, mas se mandar, nao e para o browser.
  headers.delete("set-cookie");
  return headers;
}

export {
  handler as GET,
  handler as POST,
  handler as PUT,
  handler as PATCH,
  handler as DELETE,
};
