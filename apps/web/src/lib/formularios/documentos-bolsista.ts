import { z } from "zod";

/**
 * Documentos do bolsista (BOL-021).
 *
 * O módulo é neutro — sem `"use client"` — porque o Server Component da página
 * também lê estas listas para montar os rótulos. Helper exportado de módulo
 * `"use client"` não pode ser chamado do servidor: o build passa e a página
 * responde 500, que foi o que aconteceu com as categorias de despesa.
 */

/**
 * Documento acadêmico/administrativo: nasce `INTERNA` e segue o recorte por
 * PPG, porque o coordenador acompanha o próprio orientando.
 */
export const CATEGORIAS_ACADEMICAS = [
  { valor: "CARTA_ACEITE", texto: "Carta de aceite" },
  { valor: "PLANO_TRABALHO", texto: "Plano de trabalho" },
  { valor: "RELATORIO", texto: "Relatório" },
  { valor: "DECLARACAO", texto: "Declaração" },
  { valor: "PUBLICACAO", texto: "Produto ou publicação" },
  { valor: "OUTRO", texto: "Outro" },
] as const;

/**
 * Documento pessoal: nasce `PESSOAL` **por decisão da API**, não por escolha
 * de quem envia. A tela não oferece um seletor de visibilidade justamente para
 * não sugerir que exista escolha — se sugerisse, a primeira pessoa a marcar
 * "interna" acharia que publicou, e não publicou.
 */
export const CATEGORIAS_PESSOAIS = [
  { valor: "DOCUMENTO_IDENTIDADE", texto: "Documento de identidade (RG/CIN/CPF)" },
  { valor: "PASSAPORTE", texto: "Passaporte" },
  { valor: "COMPROVANTE_RESIDENCIA", texto: "Comprovante de residência" },
] as const;

const PESSOAIS = new Set<string>(
  CATEGORIAS_PESSOAIS.map((categoria) => categoria.valor),
);

export function ehDocumentoPessoal(categoria: string): boolean {
  return PESSOAIS.has(categoria);
}

/**
 * Categorias que a tela oferece a este usuário.
 *
 * As pessoais só aparecem para quem tem `documento:read-pessoal` — hoje `admin`
 * e `secretaria`. **A API recusa o envio de quem não tem essa permissão**
 * (homologado em 2026-09-09), então aqui não há decisão de acesso sendo
 * tomada: a tela apenas deixa de oferecer o que seria recusado depois do
 * arquivo escolhido. A autorização continua sendo a da API.
 */
export function categoriasDisponiveis(
  permissoes: readonly string[],
): { valor: string; texto: string }[] {
  const academicas = CATEGORIAS_ACADEMICAS.map((categoria) => ({ ...categoria }));
  if (!permissoes.includes("documento:read-pessoal")) return academicas;
  return [
    ...academicas,
    ...CATEGORIAS_PESSOAIS.map((categoria) => ({ ...categoria })),
  ];
}

export const formularioDocumentoBolsistaSchema = z.object({
  categoria: z.string().min(1, "Escolha a categoria do documento."),
  legenda: z.string().trim().max(300, "No máximo 300 caracteres."),
});

export type DadosFormularioDocumentoBolsista = z.infer<
  typeof formularioDocumentoBolsistaSchema
>;
