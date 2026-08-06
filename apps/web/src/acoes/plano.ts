"use server";

import {
  enviar,
  lista,
  numero,
  texto,
  type EstadoDaAcao,
} from "@/lib/acao";

/** Server Actions do plano de aplicação (P10). */

export async function criarLinhaDePlano(
  contexto: { programa: string; ciclo: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const rubrica = texto(formulario, "rubrica");

  const comum = {
    rubrica,
    ppgId: texto(formulario, "ppgId"),
    areaTematicaId: texto(formulario, "areaTematicaId"),
    quantidadeAnual: numero(formulario, "quantidadeAnual") ?? 0,
    mesImplementacao: texto(formulario, "mesImplementacao"),
    descricao: texto(formulario, "descricao"),
    textoFonte: texto(formulario, "textoFonte"),
  };

  const especifico =
    rubrica === "BOLSAS"
      ? {
          destino: texto(formulario, "destino"),
          modalidadeId: texto(formulario, "modalidadeId"),
          vigenciaMeses: numero(formulario, "vigenciaMeses"),
          // Vazio deixa a API aplicar RN-10 (Brasil = IN, Exterior = OUT).
          fluxo: texto(formulario, "fluxo"),
        }
      : rubrica === "MANUTENCAO"
        ? {
            tipoDespesa: texto(formulario, "tipoDespesa"),
            valorUnitarioInformado: numero(
              formulario,
              "valorUnitarioInformado",
            ),
            justificativaEstimativa: texto(
              formulario,
              "justificativaEstimativa",
            ),
          }
        : {
            tipoMissao: texto(formulario, "tipoMissao"),
            numeroParticipantes: numero(formulario, "numeroParticipantes"),
            numeroDiarias: numero(formulario, "numeroDiarias"),
            incluiPassagem: lista(formulario, "incluiPassagem").includes("true"),
            valorUnitarioInformado: numero(
              formulario,
              "valorUnitarioInformado",
            ),
            justificativaEstimativa: texto(
              formulario,
              "justificativaEstimativa",
            ),
          };

  const rota = `/programas/${contexto.programa}/${contexto.ciclo}/plano`;

  return enviar(
    rota,
    "POST",
    { ...comum, ...especifico },
    [rota, "/", `/programas/${contexto.programa}/${contexto.ciclo}`],
    "Linha de planejamento criada.",
  );
}

export async function cancelarLinhaDePlano(
  contexto: { programa: string; ciclo: string; id: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const rota = `/programas/${contexto.programa}/${contexto.ciclo}/plano`;

  return enviar(
    `${rota}/${contexto.id}/cancelar`,
    "POST",
    { justificativa: texto(formulario, "justificativa") },
    [rota, "/"],
    "Linha cancelada. O histórico foi preservado.",
  );
}
