"use server";

import { revalidatePath } from "next/cache";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadContato,
  payloadParceiro,
  payloadParceiroNovo,
  type DadosFormularioContato,
  type DadosFormularioParceiro,
} from "@/lib/formularios/parceiros";

/**
 * Server Actions de parceiros e contatos (CG-049).
 *
 * Consomem as APIs CG-025 e CG-026, que são as donas das regras: deduplicação,
 * contato principal único e a recusa de exclusão. Aqui não há regra de negócio
 * nenhuma — só o payload e o que revalidar.
 */

/**
 * As telas moram dentro do ciclo, e a ação não sabe qual: por isso o padrão da
 * rota, e não um caminho literal. Revalidar `/parceiros`, que não existe, era o
 * que fazia o cadastro gravar e a lista continuar sem ele.
 */
async function comRevalidacao(estado: Promise<EstadoDaAcao>) {
  const resultado = await estado;
  if (resultado.ok) {
    revalidatePath("/programas/[programa]/[ciclo]/parceiros", "page");
    revalidatePath("/programas/[programa]/[ciclo]/parceiros/[id]", "page");
  }
  return resultado;
}

export async function criarParceiro(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioParceiro,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      "/parceiros",
      "POST",
      payloadParceiroNovo(dados),
      [],
      "Parceiro cadastrado.",
    ),
  );
}

export async function atualizarParceiro(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioParceiro,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/parceiros/${id}`,
      "PATCH",
      payloadParceiro(dados),
      [],
      "Parceiro atualizado.",
    ),
  );
}

export async function inativarParceiro(
  id: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/parceiros/${id}/inativacao`,
      "POST",
      { justificativa: String(formulario.get("justificativa") ?? "").trim() },
      [],
      "Parceiro inativado.",
    ),
  );
}

/**
 * Conciliação de cadastros duplicados (CG-025).
 *
 * A origem fica inativa e passa a apontar para o destino; redes, contatos,
 * atividades de missão, pessoas e documentos são transferidos na mesma
 * transação. Nada é apagado — por isso a origem continua acessível e o
 * histórico dela não some.
 */
export async function conciliarParceiro(
  origemId: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/parceiros/${origemId}/conciliacao`,
      "POST",
      {
        destinoId: String(formulario.get("destinoId") ?? ""),
        justificativa: String(formulario.get("justificativa") ?? "").trim(),
      },
      [],
      "Cadastros conciliados.",
    ),
  );
}

export async function criarContato(
  instituicaoId: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioContato,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      "/contatos-parceiros",
      "POST",
      payloadContato(dados, instituicaoId),
      [],
      "Contato cadastrado.",
    ),
  );
}

export async function atualizarContato(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioContato,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/contatos-parceiros/${contexto.id}`,
      "PATCH",
      payloadContato(dados, contexto.instituicaoId),
      [],
      "Contato atualizado.",
    ),
  );
}

export async function definirContatoPrincipal(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  _formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/contatos-parceiros/${contexto.id}/principal`,
      "POST",
      {},
      [],
      "Contato principal atualizado.",
    ),
  );
}

/**
 * Não existe exclusão de contato, e isso é da API: a atividade da missão
 * referencia o `id` central, então apagar romperia o histórico. A saída de
 * operação é inativar, sempre com justificativa.
 */
export async function inativarContato(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/contatos-parceiros/${contexto.id}/inativacao`,
      "POST",
      { justificativa: String(formulario.get("justificativa") ?? "").trim() },
      [],
      "Contato inativado.",
    ),
  );
}

export async function reativarContato(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/contatos-parceiros/${contexto.id}/reativacao`,
      "POST",
      { justificativa: String(formulario.get("justificativa") ?? "").trim() },
      [],
      "Contato reativado.",
    ),
  );
}
