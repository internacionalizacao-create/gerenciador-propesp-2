import { z } from "zod";

// Import relativo, e nao pelo alias `@/`: o `node --test` do repositorio nao
// resolve o alias, e este modulo existe justamente para ser testado.
import { dataBrParaIso } from "../formato.ts";

/**
 * Schema do formulário de concessão de bolsa (BOL-010).
 *
 * A API valida de novo — ela é a fronteira autoritativa, e é lá que moram a
 * regra de vaga (RN-11), a de uma modalidade por CPF no ciclo (RN-18) e a
 * existência das duas pontas no cadastro central. O schema daqui existe para o
 * erro aparecer no campo antes da viagem e para a Server Action receber objeto
 * tipado.
 *
 * Campos opcionais são `""`, nunca `undefined`: input controlado do React
 * reclama da troca de não controlado para controlado. A conversão para `null`
 * acontece em `payloadBolsaConcedida`.
 */

const opcional = (maximo: number) => z.string().trim().max(maximo);

const dataBr = z
  .string()
  .trim()
  .min(1, "Informe a data no formato DD/MM/AAAA.")
  .refine(
    (valor) => dataBrParaIso(valor) !== null,
    "Informe uma data válida no formato DD/MM/AAAA.",
  );

export const NIVEIS_BENEFICIARIO = [
  { valor: "MESTRADO", texto: "Mestrado" },
  { valor: "DOUTORADO", texto: "Doutorado" },
  { valor: "POS_DOC", texto: "Pós-doutorado" },
  { valor: "DOCENTE", texto: "Docente" },
  { valor: "MOBILIDADE_BREVE", texto: "Mobilidade breve" },
] as const;

export const formularioBolsaConcedidaSchema = z
  .object({
    itemPlanejadoId: z.string().min(1, "Selecione a bolsa planejada."),
    nome: z
      .string()
      .trim()
      .min(3, "Informe o nome completo do bolsista.")
      .max(240, "No máximo 240 caracteres."),
    email: opcional(240).refine(
      (valor) => valor === "" || z.email().safeParse(valor).success,
      "Informe um e-mail válido.",
    ),
    /**
     * Só o formato aqui. Os dígitos verificadores são conferidos pela API, e
     * repetir o algoritmo criaria duas versões da mesma regra para divergirem.
     */
    cpf: z
      .string()
      .trim()
      .refine(
        (valor) => valor.replace(/\D/g, "").length === 11,
        "O CPF precisa ter 11 dígitos.",
      ),
    telefone: opcional(80),
    lattes: opcional(240),
    orcid: opcional(19).refine(
      (valor) => valor === "" || /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(valor),
      "Informe o ORCID no formato 0000-0000-0000-0000.",
    ),
    linhaPesquisaId: z.string(),
    orientadorNome: opcional(240),
    nivelBeneficiario: z.enum([
      "MESTRADO",
      "DOUTORADO",
      "POS_DOC",
      "DOCENTE",
      "MOBILIDADE_BREVE",
    ]),
    paisOrigemId: z.string().min(1, "Selecione o país de origem."),
    modoInstituicaoOrigem: z.enum(["catalogo", "livre"]),
    instituicaoOrigemId: z.string(),
    instituicaoOrigemNome: opcional(240),
    paisDestinoId: z.string().min(1, "Selecione o país de destino."),
    modoInstituicaoDestino: z.enum(["catalogo", "livre"]),
    instituicaoDestinoId: z.string(),
    instituicaoDestinoNome: opcional(240),
    dataInicio: dataBr,
    dataFim: dataBr,
    status: z.enum(["SELECIONADO", "EM_ANDAMENTO"]),
    processo: opcional(120),
    observacoes: opcional(4000),
  })
  .superRefine((valor, contexto) => {
    for (const ponta of ["Origem", "Destino"] as const) {
      const lado = ponta === "Origem" ? "de origem" : "de destino";
      if (
        valor[`modoInstituicao${ponta}`] === "catalogo" &&
        !valor[`instituicao${ponta}Id`]
      ) {
        contexto.addIssue({
          code: "custom",
          path: [`instituicao${ponta}Id`],
          message: `Selecione a instituição ${lado} no catálogo.`,
        });
      }
      if (
        valor[`modoInstituicao${ponta}`] === "livre" &&
        valor[`instituicao${ponta}Nome`].length < 2
      ) {
        contexto.addIssue({
          code: "custom",
          path: [`instituicao${ponta}Nome`],
          message: `Informe o nome da instituição ${lado}.`,
        });
      }
    }

    const inicio = dataBrParaIso(valor.dataInicio);
    const fim = dataBrParaIso(valor.dataFim);
    if (inicio && fim && fim < inicio) {
      contexto.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final não pode ser anterior à data inicial.",
      });
    }
  });

export type DadosFormularioBolsaConcedida = z.infer<
  typeof formularioBolsaConcedidaSchema
>;

/**
 * Objeto enviado à API.
 *
 * Manda **uma** das duas colunas por ponta, espelhando o que o serviço grava:
 * a FK quando veio do catálogo, o nome quando foi digitado. Mandar as duas
 * faria a API ter de escolher, e a escolha silenciosa é o que produz o vínculo
 * errado meses depois.
 */
export function payloadBolsaConcedida(dados: DadosFormularioBolsaConcedida) {
  const ponta = (lado: "Origem" | "Destino") =>
    dados[`modoInstituicao${lado}`] === "catalogo"
      ? {
          [`modoInstituicao${lado}`]: "catalogo",
          [`instituicao${lado}Id`]: dados[`instituicao${lado}Id`],
        }
      : {
          [`modoInstituicao${lado}`]: "livre",
          [`instituicao${lado}Nome`]: dados[`instituicao${lado}Nome`],
        };

  return {
    itemPlanejadoId: dados.itemPlanejadoId,
    nome: dados.nome,
    email: dados.email || null,
    cpf: dados.cpf,
    nivelBeneficiario: dados.nivelBeneficiario,
    telefone: dados.telefone || null,
    lattes: dados.lattes || null,
    orcid: dados.orcid || null,
    linhaPesquisaId: dados.linhaPesquisaId || null,
    orientadorNome: dados.orientadorNome || null,
    paisOrigemId: dados.paisOrigemId,
    paisDestinoId: dados.paisDestinoId,
    ...ponta("Origem"),
    ...ponta("Destino"),
    dataInicio: dataBrParaIso(dados.dataInicio),
    dataFim: dataBrParaIso(dados.dataFim),
    status: dados.status,
    processo: dados.processo || null,
    observacoes: dados.observacoes || null,
  };
}
