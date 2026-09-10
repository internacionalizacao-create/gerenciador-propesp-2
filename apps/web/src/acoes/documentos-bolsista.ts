"use server";

import { revalidatePath } from "next/cache";

import { traduzirErro, type EstadoDaAcao } from "@/lib/acao";
import { apiFetch } from "@/lib/api";

/**
 * Anexo de documento do bolsista (BOL-021).
 *
 * **Um arquivo por envio**, ao contrário da galeria de evidências (CG-057).
 * Lá o upload é múltiplo porque data, local e autoria descrevem a ocasião e
 * valem para a seleção inteira; aqui cada arquivo tem uma categoria própria —
 * carta de aceite e passaporte não compartilham nada —, e um envio múltiplo
 * obrigaria a pedir a categoria arquivo a arquivo, que é o formulário de novo.
 *
 * A visibilidade **não é enviada**: quem a decide é a categoria, na API. Mandar
 * daqui criaria a impressão de que há escolha, e o serviço sobrescreveria.
 */
export async function anexarDocumentoDoBolsista(
  bolsaId: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: "Escolha um arquivo." };
  }

  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("entidadeTipo", "BOLSA_CONCEDIDA");
  corpo.append("entidadeId", bolsaId);
  corpo.append("categoria", String(formulario.get("categoria") ?? "OUTRO"));
  const legenda = String(formulario.get("legenda") ?? "").trim();
  if (legenda) corpo.append("legenda", legenda);

  try {
    await apiFetch("/anexos", { method: "POST", body: corpo });
  } catch (erro) {
    return traduzirErro(erro);
  }

  revalidatePath("/mobilidade/bolsistas");
  revalidatePath(`/mobilidade/bolsistas/${bolsaId}`);
  return { ok: true, mensagem: "Documento anexado." };
}
