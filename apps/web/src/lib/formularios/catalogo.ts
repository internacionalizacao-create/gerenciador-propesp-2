import { z } from "zod";

/**
 * Schemas dos formulários do catálogo de bolsas e das modalidades (P15/P23).
 *
 * A API valida de novo — ela é a fronteira autoritativa e é lá que mora a
 * regra de RN-01. O schema daqui existe para o erro aparecer no campo antes
 * da viagem, e para a Server Action receber objeto tipado.
 *
 * **Valor e vigência viajam como texto**, não como `number`: dinheiro que
 * passa por ponto flutuante volta com centavo a menos, e a coluna do banco é
 * `numeric`. A validação é por formato, do mesmo jeito que a da API.
 */

const VIGENCIA = /^\d{1,3}([.,]\d)?$/;
const VALOR = /^\d{1,12}([.,]\d{1,2})?$/;

/** Aceita o que o teclado brasileiro digita e devolve o que o Postgres lê. */
export function normalizarNumero(valor: string): string {
  return valor.trim().replace(",", ".");
}

export const formularioItemCatalogoSchema = z.object({
  destino: z.enum(["BRASIL", "EXTERIOR"]),
  modalidadeId: z.string().min(1, "Selecione a modalidade."),
  vigenciaMeses: z
    .string()
    .trim()
    .regex(VIGENCIA, "Informe a vigência em meses (ex.: 6 ou 0,5).")
    .refine(
      (valor) => Number(normalizarNumero(valor)) > 0,
      "A vigência precisa ser maior que zero.",
    ),
  valorBrl: z
    .string()
    .trim()
    .regex(VALOR, "Informe o valor em reais (ex.: 21650,00).")
    .refine(
      (valor) => Number(normalizarNumero(valor)) > 0,
      "O valor precisa ser maior que zero.",
    ),
  valorUsd: z
    .string()
    .trim()
    .refine(
      (valor) => valor === "" || VALOR.test(valor),
      "Informe o valor em dólares ou deixe em branco.",
    ),
  fonte: z
    .string()
    .trim()
    .min(3, "Informe a fonte do valor (portaria, anexo ou ofício).")
    .max(200),
  observacao: z.string().trim().max(4000),
  /** Exigida só na edição; o formulário de criação não a mostra. */
  justificativa: z.string().trim().max(4000),
});

/**
 * Na edicao a justificativa e obrigatoria, como no orcamento (P09): a
 * auditoria por campo so vale alguma coisa se disser por que mudou.
 */
export const formularioItemCatalogoEdicaoSchema =
  formularioItemCatalogoSchema.extend({
    justificativa: z
      .string()
      .trim()
      .min(10, "Explique a alteração (mínimo 10 caracteres).")
      .max(4000),
  });

export type DadosFormularioItemCatalogo = z.infer<
  typeof formularioItemCatalogoSchema
>;

export const formularioModalidadeSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome da modalidade.").max(120),
  publicoAlvo: z.enum(["DOCENTE", "DISCENTE", "POS_DOC", "AMBOS"]),
  ativa: z.boolean(),
});

export type DadosFormularioModalidade = z.infer<
  typeof formularioModalidadeSchema
>;

export function payloadItemCatalogo(dados: DadosFormularioItemCatalogo) {
  return {
    destino: dados.destino,
    modalidadeId: dados.modalidadeId,
    vigenciaMeses: normalizarNumero(dados.vigenciaMeses),
    valorBrl: normalizarNumero(dados.valorBrl),
    valorUsd: dados.valorUsd === "" ? null : normalizarNumero(dados.valorUsd),
    fonte: dados.fonte.trim(),
    observacao: dados.observacao.trim() === "" ? null : dados.observacao.trim(),
  };
}
