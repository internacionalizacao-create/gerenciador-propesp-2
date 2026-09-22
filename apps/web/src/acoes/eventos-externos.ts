"use server";

import { revalidatePath } from "next/cache";

import { enviar, enviarArquivo, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadCorrecaoEvento,
  payloadCorrecaoMovimentacao,
  payloadEvento,
  payloadMovimentacao,
  type DadosCorrecaoEvento,
  type DadosCorrecaoMovimentacao,
  type DadosFormularioEvento,
  type DadosFormularioMovimentacao,
} from "@/lib/formularios/eventos-externos";
import type { TipoEventoBolsista } from "@/lib/dominio";

/**
 * Server Actions dos eventos externos da CAPES (V1-037).
 *
 * A API é a dona das regras desde a V1-036 — tipo aplicável, vaga, mesma
 * temática, recorte. Aqui só há payload e revalidação.
 *
 * O registro mexe na situação da bolsa, e a situação aparece na lista de
 * bolsistas, no panorama e no painel. Por isso a revalidação vai além da
 * página em que o formulário está.
 */
function revalidarMobilidade(bolsaId?: string) {
  revalidatePath("/mobilidade/bolsistas");
  if (bolsaId) revalidatePath(`/mobilidade/bolsistas/${bolsaId}`);
  revalidatePath("/mobilidade");
  revalidatePath("/");
  revalidatePath("/programas/[programa]/[ciclo]/remanejamentos", "page");
}

async function comRevalidacao(
  estado: Promise<EstadoDaAcao>,
  bolsaId?: string,
) {
  const resultado = await estado;
  if (resultado.ok) revalidarMobilidade(bolsaId);
  return resultado;
}

export async function registrarEventoBolsista(
  contexto: { bolsaId: string; chave: string; tipo?: TipoEventoBolsista },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioEvento,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/bolsistas/${contexto.bolsaId}/eventos`,
      "POST",
      payloadEvento(dados, contexto.chave, contexto.tipo),
      [],
      "Evento registrado.",
    ),
    contexto.bolsaId,
  );
}

export async function corrigirEventoBolsista(
  contexto: { eventoId: string; bolsaId: string; tipo?: TipoEventoBolsista },
  _anterior: EstadoDaAcao,
  dados: DadosCorrecaoEvento,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/eventos-externos/bolsistas/${contexto.eventoId}`,
      "PATCH",
      payloadCorrecaoEvento(dados, contexto.tipo),
      [],
      "Correção registrada.",
    ),
    contexto.bolsaId,
  );
}

export async function registrarMovimentacao(
  contexto: { programa: string; ciclo: string; chave: string },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioMovimentacao,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/programas/${contexto.programa}/${contexto.ciclo}/movimentacoes`,
      "POST",
      payloadMovimentacao(dados, contexto.chave),
      [],
      "Movimentação registrada.",
    ),
  );
}

export async function corrigirMovimentacao(
  movimentacaoId: string,
  _anterior: EstadoDaAcao,
  dados: DadosCorrecaoMovimentacao,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/eventos-externos/movimentacoes/${movimentacaoId}`,
      "PATCH",
      payloadCorrecaoMovimentacao(dados),
      [],
      "Correção registrada.",
    ),
  );
}

/**
 * Comprovante do evento: o ofício, o e-mail da CAPES. Opcional (contrato
 * §7.4) — o evento se registra sem ele, e a lista mostra quais estão sem.
 */
export async function anexarComprovante(
  contexto: {
    entidadeTipo: "EVENTO_BOLSISTA" | "REMANEJAMENTO";
    entidadeId: string;
    bolsaId?: string;
  },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: "Escolha um arquivo." };
  }
  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("entidadeTipo", contexto.entidadeTipo);
  corpo.append("entidadeId", contexto.entidadeId);
  corpo.append("categoria", String(formulario.get("categoria") ?? "COMPROVANTE"));
  const legenda = String(formulario.get("legenda") ?? "").trim();
  if (legenda) corpo.append("legenda", legenda);

  return comRevalidacao(
    enviarArquivo("/anexos", corpo, [], "Comprovante anexado."),
    contexto.bolsaId,
  );
}
