"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";

function corpoDaBolsa(formulario: FormData) {
  return {
    itemPlanejadoId: texto(formulario, "itemPlanejadoId"),
    nome: texto(formulario, "nome"),
    email: texto(formulario, "email"),
    cpf: texto(formulario, "cpf"),
    nivelBeneficiario: texto(formulario, "nivelBeneficiario"),
    paisDestino: texto(formulario, "paisDestino"),
    instituicaoDestino: texto(formulario, "instituicaoDestino"),
    dataInicio: texto(formulario, "dataInicio"),
    dataFim: texto(formulario, "dataFim"),
    status: texto(formulario, "status") ?? "SELECIONADO",
    processo: texto(formulario, "processo"),
    observacoes: texto(formulario, "observacoes"),
  };
}

export async function criarBolsaConcedida(
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    "/bolsistas",
    "POST",
    corpoDaBolsa(formulario),
    ["/mobilidade/bolsistas"],
    "Bolsa concedida cadastrada.",
  );
}

export async function atualizarBolsaConcedida(
  id: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const corpo = corpoDaBolsa(formulario);
  return enviar(
    `/bolsistas/${id}`,
    "PATCH",
    {
      dataInicio: corpo.dataInicio,
      dataFim: corpo.dataFim,
      status: corpo.status,
      processo: corpo.processo,
      observacoes: corpo.observacoes,
    },
    ["/mobilidade/bolsistas", `/mobilidade/bolsistas/${id}`],
    "Situação da bolsa atualizada.",
  );
}

function corpoDoProduto(formulario: FormData) {
  return {
    tipo: texto(formulario, "tipo"),
    titulo: texto(formulario, "titulo"),
    descricao: texto(formulario, "descricao"),
    prazoEntrega: texto(formulario, "prazoEntrega"),
    status: texto(formulario, "status") ?? "PREVISTO",
    dataEntrega: texto(formulario, "dataEntrega"),
    doi: texto(formulario, "doi"),
    link: texto(formulario, "link"),
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
