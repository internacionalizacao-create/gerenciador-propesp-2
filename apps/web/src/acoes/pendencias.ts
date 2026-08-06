"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";

/** Server Actions das pendências (P13). */

export async function criarPendencia(
  contexto: { programa: string; ciclo: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/programas/${contexto.programa}/${contexto.ciclo}/pendencias`,
    "POST",
    {
      assunto: texto(formulario, "assunto"),
      descricao: texto(formulario, "descricao"),
      impacto: texto(formulario, "impacto"),
      nivelImpacto: texto(formulario, "nivelImpacto"),
      escopoTipo: texto(formulario, "escopoTipo") ?? "GERAL",
      escopoDescricao: texto(formulario, "escopoDescricao"),
      responsavelSugerido: texto(formulario, "responsavelSugerido"),
      prazoMomento: texto(formulario, "prazoMomento"),
    },
    ["/pendencias", "/"],
    "Pendência registrada.",
  );
}

export async function atualizarPendencia(
  id: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `/pendencias/${id}`,
    "PATCH",
    {
      status: texto(formulario, "status"),
      // Resolver sem dizer como é o que transformava a planilha num cemitério
      // de itens "OK". A API recusa; o formulário também marca como obrigatório.
      resolucao: texto(formulario, "resolucao"),
      responsavelSugerido: texto(formulario, "responsavelSugerido"),
      nivelImpacto: texto(formulario, "nivelImpacto"),
      prazoMomento: texto(formulario, "prazoMomento"),
    },
    ["/pendencias", "/"],
    "Pendência atualizada.",
  );
}
