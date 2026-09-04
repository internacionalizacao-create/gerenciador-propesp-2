/**
 * Cliente HTTP do lado do browser.
 *
 * **Nao e o `apiFetch`.** Aquele e `server-only`, cola o access token no header
 * e so roda em Server Component ou Server Action. Este roda no browser e fala
 * exclusivamente com `/api/bff/*`, a rota que injeta o token do lado do
 * servidor. A regra que sustenta o desenho BFF continua valendo: o token nunca
 * chega ao JavaScript da pagina.
 *
 * Nao use isto para o primeiro carregamento de uma tela — dado que a pagina ja
 * pode buscar no servidor deve ser buscado la, onde nao custa um salto HTTP
 * extra nem um estado de carregamento. O lugar deste modulo e a interacao
 * depois da pintura: busca conforme se digita, filtro que nao vale uma
 * navegacao, lista que se reconsulta.
 */

export class BffError extends Error {
  readonly status: number;
  readonly body: unknown;

  // Campos declarados e atribuidos um a um em vez de "parameter properties"
  // (`constructor(readonly status: number)`). A forma curta e sintaxe que o
  // TypeScript apaga em tempo de compilacao, e o modo strip-only do Node — que
  // e como `node --test` carrega estes arquivos — recusa. Ver AGENTS.md §7.
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "BffError";
    this.status = status;
    this.body = body;
  }
}

export function caminhoBff(
  recurso: string,
  parametros: Record<string, string | number | boolean | undefined> = {},
): string {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(parametros)) {
    if (valor === undefined || valor === "") continue;
    busca.set(chave, String(valor));
  }
  const query = busca.toString();
  const limpo = recurso.startsWith("/") ? recurso.slice(1) : recurso;
  return `/api/bff/${limpo}${query ? `?${query}` : ""}`;
}

export async function buscarNoBff<T>(
  caminho: string,
  init: RequestInit = {},
): Promise<T> {
  const resposta = await fetch(caminho, {
    ...init,
    headers: { Accept: "application/json", ...init.headers },
  });

  const texto = await resposta.text();
  let corpo: unknown = undefined;
  if (texto) {
    try {
      corpo = JSON.parse(texto);
    } catch {
      corpo = texto;
    }
  }

  if (!resposta.ok) {
    throw new BffError(
      resposta.status,
      `${init.method ?? "GET"} ${caminho} respondeu ${resposta.status}`,
      corpo,
    );
  }

  return corpo as T;
}
