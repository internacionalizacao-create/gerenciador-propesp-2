"use server";

import { revalidatePath } from "next/cache";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadConvenio,
  type DadosFormularioConvenio,
} from "@/lib/formularios/convenio";

/**
 * Server Actions dos convênios (V1-032).
 *
 * Cada verbo tem a sua permissão — `convenio:create`, `:edit` e `:status` para
 * inativar e reativar —, e a API já é a dona das regras desde a CG-056. Aqui só
 * há payload e revalidação.
 *
 * **Não existe exclusão**, e a ausência é a decisão: o produto do tipo convênio
 * aponta para o acordo, e apagá-lo deixaria o produto sem o vínculo que o
 * `check` bicondicional exige. A saída é inativar, com justificativa.
 */

/**
 * O que precisa ser relido depois de mexer num acordo.
 *
 * Além da própria página do parceiro, a **lista** — porque `parceriaFormalizada`
 * é derivada de convênio vigente (BOL-030) e muda de estado com este ato — e a
 * missão, onde o acordo aparece como opção do produto do tipo convênio.
 */
async function comRevalidacao(estado: Promise<EstadoDaAcao>) {
  const resultado = await estado;
  if (resultado.ok) {
    revalidatePath("/programas/[programa]/[ciclo]/parceiros/[id]", "page");
    revalidatePath("/programas/[programa]/[ciclo]/parceiros", "page");
    revalidatePath(
      "/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]",
      "page",
    );
  }
  return resultado;
}

export async function criarConvenio(
  instituicaoId: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioConvenio,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      "/convenios",
      "POST",
      { ...payloadConvenio(dados), instituicaoId },
      [],
      "Acordo cadastrado.",
    ),
  );
}

export async function atualizarConvenio(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioConvenio,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/convenios/${id}`,
      "PATCH",
      payloadConvenio(dados),
      [],
      "Acordo atualizado.",
    ),
  );
}

/**
 * Inativa e reativa.
 *
 * A justificativa é obrigatória nos **dois** sentidos, e é a API que exige. Faz
 * sentido: reativar um acordo inativado também é ato que alguém precisa
 * explicar depois.
 */
export async function alternarConvenio(
  contexto: { id: string; ativo: boolean },
  _anterior: EstadoDaAcao,
  dados: { justificativa: string },
): Promise<EstadoDaAcao> {
  const acao = contexto.ativo ? "inativacao" : "reativacao";
  return comRevalidacao(
    enviar(
      `/convenios/${contexto.id}/${acao}`,
      "POST",
      { justificativa: dados.justificativa },
      [],
      contexto.ativo ? "Acordo inativado." : "Acordo reativado.",
    ),
  );
}
