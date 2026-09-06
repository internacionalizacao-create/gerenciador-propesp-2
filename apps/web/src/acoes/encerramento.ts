"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";

/**
 * Encerramento da missão (CG-058).
 *
 * Encerrar é `CONCLUIR`, e a partir daqui a transição passa pelo checklist
 * inteiro — não só pelo relato. A API recusa com 422 e a lista de pendências,
 * que `traduzirErro` já repassa: a tela mostra o que falta em vez de um "não
 * foi possível".
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const rota = ({ programa, ciclo, id }: Contexto) =>
  `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;

const revalidar = (contexto: Contexto) => [
  rota(contexto),
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`,
];

/**
 * Dispensa um requisito desta missão.
 *
 * Exige `missao:decide` na API — a permissão do Comitê, que o `admin` também
 * tem. Foi a decisão de 2026-09-06 ("admin e Comitê"), e por isso nenhuma
 * permissão nova precisou existir.
 */
export async function dispensarRequisito(
  contexto: Contexto & { chave: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/encerramento/dispensa`,
    "POST",
    {
      chave: contexto.chave,
      justificativa: texto(formulario, "justificativa"),
    },
    revalidar(contexto),
    "Requisito dispensado.",
  );
}

/** Revoga a dispensa. A linha continua no histórico — ela explica o fechamento. */
export async function revogarDispensa(
  contexto: Contexto & { chave: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/encerramento/revogacao`,
    "POST",
    {
      chave: contexto.chave,
      justificativa: texto(formulario, "justificativa"),
    },
    revalidar(contexto),
    "Dispensa revogada.",
  );
}

/** Encerra a missão. A API confere o checklist antes de gravar. */
export async function encerrarMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/situacao`,
    "POST",
    { acao: "CONCLUIR", justificativa: null },
    revalidar(contexto),
    "Missão encerrada.",
  );
}
