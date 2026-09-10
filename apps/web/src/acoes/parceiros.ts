"use server";

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

const LISTA = "/parceiros";
const detalhe = (id: string) => `/parceiros/${id}`;

export async function criarParceiro(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioParceiro,
): Promise<EstadoDaAcao> {
  return enviar(
    "/parceiros",
    "POST",
    payloadParceiroNovo(dados),
    [LISTA],
    "Parceiro cadastrado.",
  );
}

export async function atualizarParceiro(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioParceiro,
): Promise<EstadoDaAcao> {
  return enviar(
    `/parceiros/${id}`,
    "PATCH",
    payloadParceiro(dados),
    [LISTA, detalhe(id)],
    "Parceiro atualizado.",
  );
}

export async function inativarParceiro(
  id: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/parceiros/${id}/inativacao`,
    "POST",
    { justificativa: String(formulario.get("justificativa") ?? "").trim() },
    [LISTA, detalhe(id)],
    "Parceiro inativado.",
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
  return enviar(
    `/parceiros/${origemId}/conciliacao`,
    "POST",
    {
      destinoId: String(formulario.get("destinoId") ?? ""),
      justificativa: String(formulario.get("justificativa") ?? "").trim(),
    },
    [LISTA, detalhe(origemId)],
    "Cadastros conciliados.",
  );
}

export async function criarContato(
  instituicaoId: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioContato,
): Promise<EstadoDaAcao> {
  return enviar(
    "/contatos-parceiros",
    "POST",
    payloadContato(dados, instituicaoId),
    [detalhe(instituicaoId)],
    "Contato cadastrado.",
  );
}

export async function atualizarContato(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioContato,
): Promise<EstadoDaAcao> {
  return enviar(
    `/contatos-parceiros/${contexto.id}`,
    "PATCH",
    payloadContato(dados, contexto.instituicaoId),
    [detalhe(contexto.instituicaoId)],
    "Contato atualizado.",
  );
}

export async function definirContatoPrincipal(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  _formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/contatos-parceiros/${contexto.id}/principal`,
    "POST",
    {},
    [detalhe(contexto.instituicaoId)],
    "Contato principal atualizado.",
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
  return enviar(
    `/contatos-parceiros/${contexto.id}/inativacao`,
    "POST",
    { justificativa: String(formulario.get("justificativa") ?? "").trim() },
    [detalhe(contexto.instituicaoId)],
    "Contato inativado.",
  );
}

export async function reativarContato(
  contexto: { id: string; instituicaoId: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/contatos-parceiros/${contexto.id}/reativacao`,
    "POST",
    { justificativa: String(formulario.get("justificativa") ?? "").trim() },
    [detalhe(contexto.instituicaoId)],
    "Contato reativado.",
  );
}
