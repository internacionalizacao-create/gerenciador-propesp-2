import "server-only";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { ApiError, apiFetch } from "./api";
import type { CandidatoDuplicidade, EstadoDaAcao } from "./acao-tipos";

export type { EstadoDaAcao } from "./acao-tipos";

/**
 * Peças compartilhadas pelas Server Actions.
 *
 * **Não é um arquivo `"use server"`.** Só os módulos em `src/acoes/` são, e eles
 * exportam exclusivamente as ações. Um helper dentro de um módulo `"use server"`
 * viraria um endpoint RPC exposto ao browser — o que não se quer para um
 * utilitário que lê `FormData`.
 *
 * Os formulários falam com a API por aqui, no servidor, e não por `fetch` do
 * browser. É o desenho BFF sendo respeitado: o access token nunca sai do
 * servidor, e a página não precisa de rota intermediária para gravar.
 */

export async function enviar(
  caminho: string,
  metodo: "POST" | "PATCH" | "DELETE",
  corpo: unknown,
  revalidar: string[],
  sucesso: string,
): Promise<EstadoDaAcao> {
  try {
    await apiFetch(caminho, {
      method: metodo,
      // `DELETE` sem corpo: mandar `"undefined"` como JSON faria a API tentar
      // validar um payload que ninguem enviou.
      ...(corpo === undefined
        ? {}
        : {
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(corpo),
          }),
    });

    for (const rota of revalidar) revalidatePath(rota);
    return { ok: true, mensagem: sucesso };
  } catch (erro) {
    // Sessão morta faz `apiFetch` chamar `redirect`, que sinaliza por exceção.
    // Sem isto, o `catch` a engoliria e a tela mostraria "não foi possível
    // salvar" no lugar de mandar a pessoa para o login.
    unstable_rethrow(erro);
    return traduzirErro(erro);
  }
}

/**
 * Envia arquivo para a API, repassando o `FormData` do navegador.
 *
 * **Não define `Content-Type`**: o `fetch` precisa gerar o boundary do
 * multipart sozinho, e fixar o cabeçalho aqui produziria um corpo que o Nest
 * não consegue separar — o sintoma é "arquivo vazio" com o arquivo presente.
 *
 * O arquivo atravessa o servidor do Next, e não vai direto do browser para a
 * API: é o mesmo desenho BFF do resto, e o token continua sem chegar ao
 * JavaScript da página.
 */
export async function enviarArquivo(
  caminho: string,
  corpo: FormData,
  revalidar: string[],
  sucesso: string,
): Promise<EstadoDaAcao> {
  try {
    await apiFetch(caminho, { method: "POST", body: corpo });
    for (const rota of revalidar) revalidatePath(rota);
    return { ok: true, mensagem: sucesso };
  } catch (erro) {
    unstable_rethrow(erro);
    return traduzirErro(erro);
  }
}

/**
 * Traduz a resposta de erro da API para o que a tela mostra.
 *
 * A mensagem do 422 do catálogo vem da própria API e é repassada inteira: ela
 * explica que o valor **não pode** ser estimado (RN-01), e trocá-la por um
 * "erro ao salvar" genérico apagaria justamente a informação que faz a pessoa
 * agir certo.
 *
 * O 403 vira uma frase sobre perfil. A interface esconde o que o usuário não
 * pode fazer, mas quem barra de fato é o guard da API — e quando ele barra, a
 * pessoa precisa saber que foi permissão, não falha.
 */
export function traduzirErro(erro: unknown): EstadoDaAcao {
  if (!(erro instanceof ApiError)) {
    return {
      ok: false,
      mensagem: "Não foi possível falar com o servidor. Tente novamente.",
    };
  }

  if (erro.status === 403) {
    return { ok: false, mensagem: "Seu perfil não permite esta ação." };
  }

  const corpo = erro.body as
    | {
        message?: string;
        erros?: { campo: string; mensagem: string }[];
        candidatos?: CandidatoDuplicidade[];
        pendencias?: string[];
      }
    | undefined;

  return {
    ok: false,
    mensagem:
      typeof corpo?.message === "string"
        ? corpo.message
        : "Não foi possível salvar.",
    erros: corpo?.erros,
    // Repassado inteiro: o 409 de duplicidade so e util se a tela puder
    // mostrar QUAIS cadastros a API considerou equivalentes.
    candidatos: corpo?.candidatos,
    // Mesmo motivo no 422 da submissao: sem a lista, "nao foi possivel
    // enviar" nao diz qual documento anexar.
    pendencias: corpo?.pendencias,
  };
}

/** Campo de texto do formulário; vazio vira `undefined`, não string vazia. */
export function texto(
  formulario: FormData,
  campo: string,
): string | undefined {
  const valor = formulario.get(campo);
  if (typeof valor !== "string" || valor.trim() === "") return undefined;
  return valor.trim();
}

export function numero(
  formulario: FormData,
  campo: string,
): number | undefined {
  const valor = texto(formulario, campo);
  return valor === undefined ? undefined : Number(valor);
}

export function lista(formulario: FormData, campo: string): string[] {
  return formulario
    .getAll(campo)
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter(Boolean);
}
