"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";

export async function atualizarOrcamento(
  contexto: { programa: string; ciclo: string; id: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const rota = `/programas/${contexto.programa}/${contexto.ciclo}/orcamento`;

  return enviar(
    `${rota}/${contexto.id}`,
    "PATCH",
    {
      valorBolsas: texto(formulario, "valorBolsas") ?? null,
      valorManutencao: texto(formulario, "valorManutencao") ?? null,
      valorMissoes: texto(formulario, "valorMissoes") ?? null,
      status: texto(formulario, "status"),
      statusComposicao: texto(formulario, "statusComposicao"),
      fonte: texto(formulario, "fonte"),
      observacoes: texto(formulario, "observacoes"),
      justificativa: texto(formulario, "justificativa"),
    },
    [rota, "/", `/programas/${contexto.programa}/${contexto.ciclo}`],
    "Orçamento atualizado e registrado na auditoria.",
  );
}
