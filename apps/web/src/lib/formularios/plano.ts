import { z } from "zod";

const texto = z.string().trim();
const opcional = texto.max(4000);

/**
 * Valores monetários permanecem texto: a API recebe `numeric`, e converter
 * para `number` no browser perderia centavos antes da fronteira autoritativa.
 */
export const formularioLinhaPlanoSchema = z.object({
  rubrica: z.enum(["BOLSAS", "MANUTENCAO", "MISSOES"]),
  ppgId: texto.min(1, "Selecione o PPG."),
  areaTematicaId: texto,
  ano: texto.regex(/^\d{4}$/, "Selecione o exercício."),
  quantidadeAnual: texto.regex(/^\d+$/, "Informe uma quantidade inteira."),
  mesImplementacao: texto,
  descricao: opcional,
  textoFonte: opcional,
  destino: texto,
  modalidadeId: texto,
  vigenciaMeses: texto,
  fluxo: texto,
  tipoDespesa: texto,
  tipoMissao: texto,
  numeroParticipantes: texto,
  numeroDiarias: texto,
  incluiPassagem: z.boolean(),
  valorUnitarioInformado: texto,
  justificativaEstimativa: opcional,
  status: texto,
  justificativaEdicao: opcional,
}).superRefine((dados, contexto) => {
  if (Number(dados.quantidadeAnual) <= 0) contexto.addIssue({ code: "custom", path: ["quantidadeAnual"], message: "Informe uma quantidade maior que zero." });
  if (dados.rubrica === "BOLSAS") {
    if (!dados.modalidadeId) contexto.addIssue({ code: "custom", path: ["modalidadeId"], message: "Escolha a modalidade." });
    if (!dados.vigenciaMeses) contexto.addIssue({ code: "custom", path: ["vigenciaMeses"], message: "Escolha a vigência." });
  } else {
    if (!/^\d+(?:[.,]\d{1,2})?$/.test(dados.valorUnitarioInformado)) contexto.addIssue({ code: "custom", path: ["valorUnitarioInformado"], message: "Informe o valor estimado sem arredondamento." });
    if (dados.justificativaEstimativa.length < 10) contexto.addIssue({ code: "custom", path: ["justificativaEstimativa"], message: "Explique a estimativa (mínimo 10 caracteres)." });
  }
});

export type DadosFormularioLinhaPlano = z.infer<typeof formularioLinhaPlanoSchema>;

const vazio = (valor: string) => valor.trim() || undefined;
const inteiro = (valor: string) => valor === "" ? undefined : Number(valor);

export function payloadLinhaPlano(dados: DadosFormularioLinhaPlano) {
  const comum = { rubrica: dados.rubrica, ppgId: dados.ppgId, areaTematicaId: vazio(dados.areaTematicaId), ano: inteiro(dados.ano), quantidadeAnual: inteiro(dados.quantidadeAnual) ?? 0, mesImplementacao: vazio(dados.mesImplementacao), descricao: vazio(dados.descricao), textoFonte: vazio(dados.textoFonte) };
  if (dados.rubrica === "BOLSAS") return { ...comum, destino: vazio(dados.destino), modalidadeId: vazio(dados.modalidadeId), vigenciaMeses: vazio(dados.vigenciaMeses), fluxo: vazio(dados.fluxo) };
  if (dados.rubrica === "MANUTENCAO") return { ...comum, tipoDespesa: vazio(dados.tipoDespesa), valorUnitarioInformado: vazio(dados.valorUnitarioInformado), justificativaEstimativa: vazio(dados.justificativaEstimativa) };
  return { ...comum, tipoMissao: vazio(dados.tipoMissao), numeroParticipantes: inteiro(dados.numeroParticipantes), numeroDiarias: inteiro(dados.numeroDiarias), incluiPassagem: dados.incluiPassagem, valorUnitarioInformado: vazio(dados.valorUnitarioInformado), justificativaEstimativa: vazio(dados.justificativaEstimativa) };
}
