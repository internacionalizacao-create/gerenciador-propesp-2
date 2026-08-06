"use server";

import { enviar, lista, numero, texto, type EstadoDaAcao } from "@/lib/acao";

/** Server Actions do cadastro de PPG (P14). */

function corpoDoFormulario(formulario: FormData) {
  return {
    nome: texto(formulario, "nome"),
    sigla: texto(formulario, "sigla"),
    unidade: texto(formulario, "unidade"),
    nivel: texto(formulario, "nivel"),
    modalidade: texto(formulario, "modalidade"),
    notaCapes: numero(formulario, "notaCapes"),
    areaCapes: texto(formulario, "areaCapes"),
    situacao: texto(formulario, "situacao") ?? "ATIVO",
    // O checkbox manda "false" pelo hidden e "true" quando marcado; o último
    // valor é o que vale.
    emRede: lista(formulario, "emRede").at(-1) === "true",
    redeAcademica: texto(formulario, "redeAcademica"),
    observacoes: texto(formulario, "observacoes"),
    linhasPesquisa: lista(formulario, "linhasPesquisa"),
  };
}

export async function criarPpg(
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    "/ppgs",
    "POST",
    corpoDoFormulario(formulario),
    ["/ppgs", "/"],
    "PPG cadastrado.",
  );
}

export async function atualizarPpg(
  id: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/ppgs/${id}`,
    "PATCH",
    corpoDoFormulario(formulario),
    [`/ppgs/${id}`, "/ppgs"],
    "PPG atualizado.",
  );
}
