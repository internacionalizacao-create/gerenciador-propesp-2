"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import { payloadPpg, type DadosFormularioPpg } from "@/lib/formularios/ppg";

/** Server Actions do cadastro de PPG (P14). */

export async function criarPpg(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioPpg,
): Promise<EstadoDaAcao> {
  return enviar(
    "/ppgs",
    "POST",
    payloadPpg(dados),
    ["/ppgs", "/"],
    "PPG cadastrado.",
  );
}

export async function atualizarPpg(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioPpg,
): Promise<EstadoDaAcao> {
  return enviar(
    `/ppgs/${id}`,
    "PATCH",
    payloadPpg(dados),
    [`/ppgs/${id}`, "/ppgs"],
    "PPG atualizado.",
  );
}
