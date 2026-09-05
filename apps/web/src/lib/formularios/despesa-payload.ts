// Import relativo, e nao pelo alias `@/`: o `node --test` do repositorio nao
// resolve o alias, e este modulo existe justamente para ser testado.
import { dataBrParaIso } from "../formato.ts";

/**
 * Monta o corpo da despesa a partir do `FormData` (CG-053).
 *
 * Fica fora da Server Action porque é a parte testável: o pareamento das
 * cotações por índice e a conversão de data são o que quebra em silêncio. O
 * módulo é neutro — `acoes/prestacao.ts` é `"use server"` e importa `acao.ts`,
 * que é `server-only`, então um teste não conseguiria carregá-lo.
 *
 * **Só passagem e diária têm especialização** (CG-009); mandar `passagem` ou
 * `diaria` nos outros tipos é recusado pela API de propósito.
 */

export interface CorpoDaDespesa {
  tipo?: string;
  participanteId?: string;
  exercicio?: number;
  valorTotal?: string;
  dataDocumento?: string;
  descricao?: string;
  observacoes?: string;
  passagem?: {
    empresa?: string;
    origem?: string;
    destino?: string;
    numeroVoo?: string;
    dataVoo?: string;
    cotacoes: { empresa: string; valor: string }[];
  };
  diaria?: { dataInicio: string; dataFim: string; cidade?: string };
}

/** Campo de texto; vazio vira `undefined`, nunca string vazia. */
function texto(formulario: FormData, campo: string): string | undefined {
  const valor = formulario.get(campo);
  if (typeof valor !== "string" || valor.trim() === "") return undefined;
  return valor.trim();
}

/**
 * As cotações vêm como duas listas paralelas (`cotacaoEmpresa`,
 * `cotacaoValor`), porque cada linha do formulário repete os mesmos `name`.
 * O índice é o que as une — e por isso a linha só é descartada **depois** do
 * pareamento: filtrar cada lista antes desalinharia empresa e valor.
 */
export function montarCorpoDaDespesa(formulario: FormData): CorpoDaDespesa {
  const tipo = texto(formulario, "tipo");
  const empresas = formulario.getAll("cotacaoEmpresa");
  const valores = formulario.getAll("cotacaoValor");

  const cotacoes = empresas
    .map((empresa, indice) => ({
      empresa: String(empresa).trim(),
      valor: String(valores[indice] ?? "").trim(),
    }))
    // Linha em branco é linha que a pessoa abriu e não usou.
    .filter((cotacao) => cotacao.empresa !== "" && cotacao.valor !== "");

  const exercicio = texto(formulario, "exercicio");

  return {
    tipo,
    participanteId: texto(formulario, "participanteId"),
    exercicio: exercicio === undefined ? undefined : Number(exercicio),
    valorTotal: texto(formulario, "valorTotal"),
    dataDocumento:
      dataBrParaIso(texto(formulario, "dataDocumento")) ?? undefined,
    descricao: texto(formulario, "descricao"),
    observacoes: texto(formulario, "observacoes"),
    passagem:
      tipo === "PASSAGEM"
        ? {
            empresa: texto(formulario, "passagemEmpresa"),
            origem: texto(formulario, "passagemOrigem"),
            destino: texto(formulario, "passagemDestino"),
            numeroVoo: texto(formulario, "passagemNumeroVoo"),
            dataVoo:
              dataBrParaIso(texto(formulario, "passagemDataVoo")) ?? undefined,
            cotacoes,
          }
        : undefined,
    diaria:
      tipo === "DIARIA"
        ? {
            dataInicio:
              dataBrParaIso(texto(formulario, "diariaDataInicio")) ?? "",
            dataFim: dataBrParaIso(texto(formulario, "diariaDataFim")) ?? "",
            cidade: texto(formulario, "diariaCidade"),
          }
        : undefined,
  };
}
