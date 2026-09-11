import "server-only";

import { getSession } from "./auth";
import { urlDaApi } from "./env";
import { irParaLogin } from "./sessao-encerrada";

/** A API respondeu, mas com status de erro. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}


/**
 * Chama a API NestJS em nome do usuario logado.
 *
 * Server-side apenas. O access token e lido da sessao e colado no header aqui —
 * e o unico lugar do front que toca em token, e ele roda onde o browser nao ve.
 */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  // Sem sessão, ou com token que a API recusa, o render não continua: vai para
  // o login em vez de estourar um erro que ninguém trata (ver sessao-encerrada).
  const session = await getSession();
  if (!session) return irParaLogin();

  const response = await fetch(urlDaApi(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...init.headers,
      Authorization: `Bearer ${session.accessToken}`,
    },
    // Resposta depende de quem esta logado: cachear serviria dado de um usuario
    // para outro.
    cache: "no-store",
  });

  // 401 aqui é a sessão que morreu entre a leitura do cookie e a chamada: o
  // token estava dentro da validade, mas o Keycloak já o invalidara (logout,
  // revogação, realm recriado). Não é erro de aplicação.
  if (response.status === 401) return irParaLogin();

  const corpo: unknown = await lerCorpo(response);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `${init.method ?? "GET"} ${path} respondeu ${response.status}`,
      corpo,
    );
  }

  return corpo as T;
}

async function lerCorpo(response: Response): Promise<unknown> {
  const texto = await response.text();
  if (!texto) return undefined;

  try {
    return JSON.parse(texto);
  } catch {
    return texto;
  }
}
