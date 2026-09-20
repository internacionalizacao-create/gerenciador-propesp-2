"use server";

import { revalidatePath } from "next/cache";
import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadParticipacao,
  type DadosEdicaoParticipacao,
  type DadosFormularioParticipacao,
} from "@/lib/formularios/participacao";

/**
 * Server Actions da participação PPG–temática (V1-034).
 *
 * Três permissões distintas — `participacao:create`, `:edit`, `:delete` —,
 * todas institucionais: associar um PPG a uma temática cria, de lado, um alvo
 * de concessão, e o alcance de quem já foi configurado muda com isso.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  codigo: string;
}

const rota = ({ programa, ciclo, codigo }: Contexto) =>
  `/programas/${programa}/${ciclo}/tematicas/${encodeURIComponent(codigo)}/participacoes`;

/**
 * O vínculo muda o que o plano aceita e o que cada conta alcança, então relê
 * também as telas que dependem disso: a temática, as redes, o plano e o PPG.
 */
const revalidar = () => {
  revalidatePath("/programas/[programa]/[ciclo]/tematicas/[codigo]", "page");
  revalidatePath("/programas/[programa]/[ciclo]/redes", "page");
  revalidatePath("/programas/[programa]/[ciclo]/plano", "page");
  revalidatePath("/ppgs/[id]", "page");
};

export async function criarParticipacao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioParticipacao,
): Promise<EstadoDaAcao> {
  const resultado = await enviar(
    rota(contexto),
    "POST",
    payloadParticipacao(dados),
    [],
    "PPG associado à temática.",
  );
  if (resultado.ok) revalidar();
  return resultado;
}

export async function atualizarParticipacao(
  contexto: Contexto & { id: string },
  _anterior: EstadoDaAcao,
  dados: DadosEdicaoParticipacao,
): Promise<EstadoDaAcao> {
  const resultado = await enviar(
    `${rota(contexto)}/${contexto.id}`,
    "PATCH",
    payloadParticipacao(dados),
    [],
    "Participação atualizada.",
  );
  if (resultado.ok) revalidar();
  return resultado;
}

/**
 * Remove o vínculo.
 *
 * A API recusa em três casos, e a tela **não os antecipa**: participação que
 * sustenta linha de plano ou bolsa, e participação que é (ou já foi) alvo de
 * concessão de acesso. Este último existe porque
 * `concessao_acesso.participacao_id` é `on delete cascade` — sem a recusa, o
 * banco apagaria as concessões junto, sem trilha e sem ninguém ter revogado
 * nada. A recusa vem com o motivo e o que fazer, e a tela a repassa inteira.
 */
export async function removerParticipacao(
  contexto: Contexto & { id: string },
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  const resultado = await enviar(
    `${rota(contexto)}/${contexto.id}`,
    "DELETE",
    undefined,
    [],
    "Participação removida.",
  );
  if (resultado.ok) revalidar();
  return resultado;
}
