"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadAtividadeExtra,
  payloadRelato,
  type DadosFormularioAtividadeExtra,
  type DadosFormularioRelato,
} from "@/lib/formularios/relato-missao";

/**
 * Relato da missão (CG-046).
 *
 * Endpoint separado da edição de propósito: editar muda o que se pretende
 * fazer, relatar registra o que foi feito. Nenhum campo de planejamento é
 * alcançado daqui.
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

export async function relatarMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioRelato,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/relato`,
    "PATCH",
    payloadRelato(dados),
    revalidar(contexto),
    "Relato registrado.",
  );
}

/**
 * Acrescenta uma atividade que aconteceu fora do roteiro.
 *
 * O relato atual viaja junto porque o endpoint é o mesmo e exige `relatoGeral`
 * — mandar vazio apagaria o texto existente. Por isso o botão só aparece
 * depois que há relato: antes disso não há a que anexar a parada extra.
 */
export async function registrarAtividadeExtra(
  contexto: Contexto & {
    relatoAtual: Parameters<typeof payloadAtividadeExtra>[1];
  },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioAtividadeExtra,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/relato`,
    "PATCH",
    payloadAtividadeExtra(dados, contexto.relatoAtual),
    revalidar(contexto),
    "Atividade não prevista registrada.",
  );
}

/**
 * Responde "a missão gerou produto?" — a resposta **negativa** (CG-056).
 *
 * O "sim" não é gravado: ele já é a existência de linha em `produto_missao`.
 * Só a negativa precisa de registro, porque zero produto significa tanto "não
 * gerou" quanto "ninguém respondeu", e o checklist de encerramento cobra a
 * distinção (CG-058).
 */
export async function declararSemProduto(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const justificativa = String(formulario.get("justificativa") ?? "").trim();
  return enviar(
    `${rota(contexto)}/produtos/resposta`,
    "POST",
    { gerouProduto: false, justificativa: justificativa || undefined },
    revalidar(contexto),
    "Resposta registrada: a missão não gerou produto.",
  );
}

/** Desfaz a declaração negativa; a pergunta volta a ficar sem resposta. */
export async function reabrirRespostaProdutos(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/produtos/resposta`,
    "POST",
    { gerouProduto: true },
    revalidar(contexto),
    "Resposta desfeita.",
  );
}
