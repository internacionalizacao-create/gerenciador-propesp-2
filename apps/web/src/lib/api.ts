import "server-only";

import { unstable_rethrow } from "next/navigation";

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

/**
 * Consulta cujo 403 é resposta legítima: a tela funciona sem aquele pedaço.
 *
 * Existe porque **recorte não é tudo ou nada** (V1-019). Quem tem `plano:read`
 * e não tem `catalogo:read` deve ver o plano sem o formulário de nova linha, e
 * não uma tela de erro — a alternativa seria exigir, para abrir uma tela, todas
 * as permissões que qualquer parte dela usa, que é o oposto do acesso granular.
 *
 * Só o 403 vira `null`. 404, 500 e falha de rede continuam estourando: são
 * defeito ou dado ausente, e engoli-los faria a tela mentir que a pessoa não
 * tem acesso.
 */
export async function apiFetchOuNada<T>(
  path: string,
  init: RequestInit = {},
): Promise<T | null> {
  try {
    return await apiFetch<T>(path, init);
  } catch (erro) {
    // `redirect` da sessão morta sinaliza por exceção e precisa passar.
    unstable_rethrow(erro);
    if (erro instanceof ApiError && erro.status === 403) return null;
    throw erro;
  }
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
