import "server-only";

import { getSession } from "./auth";
import { urlDaApi } from "./env";

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

/** Nao ha sessao valida para montar o `Authorization`. */
export class SemSessaoError extends Error {
  constructor() {
    super("Nenhuma sessao ativa");
    this.name = "SemSessaoError";
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
  const session = await getSession();
  if (!session) throw new SemSessaoError();

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
