"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadBolsaConcedida,
  payloadEdicaoBolsa,
  type DadosEdicaoBolsa,
  type DadosFormularioBolsaConcedida,
} from "@/lib/formularios/bolsa-concedida";
import { dataBrParaIso } from "@/lib/formato";

function dataDoFormulario(formulario: FormData, campo: string) {
  const informada = texto(formulario, campo);
  if (!informada) return undefined;
  return dataBrParaIso(informada) ?? informada;
}

/**
 * Cadastro da concessão (BOL-010).
 *
 * Recebe objeto tipado do React Hook Form, não `FormData`. A conversão de data
 * e a escolha entre catálogo e texto livre ficam em `payloadBolsaConcedida`,
 * ao lado do schema que as valida — aqui não há regra de negócio nenhuma.
 */
export async function criarBolsaConcedida(
  _anterior: EstadoDaAcao,
  dados: DadosFormularioBolsaConcedida,
): Promise<EstadoDaAcao> {
  return enviar(
    "/bolsistas",
    "POST",
    payloadBolsaConcedida(dados),
    ["/mobilidade/bolsistas"],
    "Bolsa concedida cadastrada.",
  );
}

/** Edicao validada pela API, incluindo capacidade especifica para corrigir CPF. */
export async function atualizarBolsaConcedida(
  id: string,
  _anterior: EstadoDaAcao,
  dados: DadosEdicaoBolsa,
): Promise<EstadoDaAcao> {
  return enviar(
    `/bolsistas/${id}`,
    "PATCH",
    payloadEdicaoBolsa(dados),
    ["/mobilidade/bolsistas", `/mobilidade/bolsistas/${id}`],
    "Bolsa atualizada.",
  );
}

function corpoDoProduto(formulario: FormData) {
  return {
    tipo: texto(formulario, "tipo"),
    titulo: texto(formulario, "titulo"),
    descricao: texto(formulario, "descricao"),
    prazoEntrega: dataDoFormulario(formulario, "prazoEntrega"),
    status: texto(formulario, "status") ?? "PREVISTO",
    dataEntrega: dataDoFormulario(formulario, "dataEntrega"),
    doi: texto(formulario, "doi"),
    link: texto(formulario, "link"),
    instituicaoColaboracao: texto(formulario, "instituicaoColaboracao"),
    paisColaboracao: texto(formulario, "paisColaboracao"),
    observacoes: texto(formulario, "observacoes"),
  };
}

export async function criarProdutoBolsa(
  bolsaId: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/bolsistas/${bolsaId}/produtos`,
    "POST",
    corpoDoProduto(formulario),
    ["/mobilidade/bolsistas", `/mobilidade/bolsistas/${bolsaId}`],
    "Produto cadastrado para o bolsista.",
  );
}

export async function atualizarProdutoBolsa(
  bolsaId: string,
  produtoId: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/bolsistas/${bolsaId}/produtos/${produtoId}`,
    "PATCH",
    corpoDoProduto(formulario),
    ["/mobilidade/bolsistas", `/mobilidade/bolsistas/${bolsaId}`],
    "Produto atualizado.",
  );
}
