"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadItemCatalogo,
  type DadosFormularioItemCatalogo,
  type DadosFormularioModalidade,
} from "@/lib/formularios/catalogo";

/**
 * Server Actions do catálogo de bolsas e das modalidades (P15/P23).
 *
 * Toda regra é da API: item novo é livre, item já usado por linha de plano tem
 * chave e valor trancados, e não há exclusão de item em uso. Aqui só monta o
 * payload e diz o que revalidar.
 */

const BOLSAS = "/catalogos/bolsas";
const MODALIDADES = "/catalogos/modalidades";

export async function criarItemCatalogo(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioItemCatalogo,
): Promise<EstadoDaAcao> {
  return enviar(
    "/catalogo/bolsas",
    "POST",
    payloadItemCatalogo(dados),
    [BOLSAS, MODALIDADES],
    "Item publicado no catálogo.",
  );
}

export async function atualizarItemCatalogo(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioItemCatalogo,
): Promise<EstadoDaAcao> {
  return enviar(
    `/catalogo/bolsas/${id}`,
    "PATCH",
    { ...payloadItemCatalogo(dados), justificativa: dados.justificativa },
    [BOLSAS, MODALIDADES],
    "Item atualizado.",
  );
}

export async function removerItemCatalogo(
  id: string,
  _anterior: EstadoDaAcao,
  _formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/catalogo/bolsas/${id}`,
    "DELETE",
    undefined,
    [BOLSAS, MODALIDADES],
    "Item removido.",
  );
}

export async function criarModalidade(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioModalidade,
): Promise<EstadoDaAcao> {
  return enviar(
    "/catalogo/modalidades",
    "POST",
    dados,
    [MODALIDADES, BOLSAS],
    "Modalidade cadastrada.",
  );
}

export async function atualizarModalidade(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioModalidade,
): Promise<EstadoDaAcao> {
  return enviar(
    `/catalogo/modalidades/${id}`,
    "PATCH",
    dados,
    [MODALIDADES, BOLSAS],
    "Modalidade atualizada.",
  );
}
