/**
 * Categorias de documento aceitas por tipo de despesa (CG-052).
 *
 * Vive num módulo neutro, e não junto do formulário, porque **os dois lados
 * precisam dela**: o Server Component monta as opções de cada despesa e o
 * formulário é `"use client"`. Chamar uma função exportada de um módulo cliente
 * a partir do servidor é erro de runtime — o build não pega, e a página
 * responde 500.
 *
 * Espelha a matriz da API. A duplicação é deliberada: aqui ela evita oferecer
 * uma opção que seria recusada; lá ela é a barreira que vale. Se divergirem, a
 * API é quem está certa.
 */

export interface OpcaoCategoria {
  valor: string;
  texto: string;
}

const POR_TIPO: Record<string, OpcaoCategoria[]> = {
  PASSAGEM: [
    { valor: "BILHETE", texto: "Bilhete" },
    { valor: "PASSAGEM", texto: "Passagem" },
    { valor: "COMPROVANTE", texto: "Comprovante" },
    { valor: "NOTA_FISCAL", texto: "Nota fiscal" },
    { valor: "OUTRO", texto: "Outro" },
  ],
  DIARIA: [
    { valor: "COMPROVANTE_DIARIAS", texto: "Comprovante de diárias" },
    { valor: "COMPROVANTE", texto: "Comprovante" },
    { valor: "OUTRO", texto: "Outro" },
  ],
};

/** Hospedagem, transporte, inscrição, seguro e outras usam o conjunto comum. */
const PADRAO: OpcaoCategoria[] = [
  { valor: "COMPROVANTE", texto: "Comprovante" },
  { valor: "NOTA_FISCAL", texto: "Nota fiscal" },
  { valor: "OUTRO", texto: "Outro" },
];

export function categoriasDoTipo(tipo: string): OpcaoCategoria[] {
  return POR_TIPO[tipo] ?? PADRAO;
}

/** Categorias da missão, exigidas ou recomendadas antes da submissão. */
export const CATEGORIAS_DA_MISSAO: OpcaoCategoria[] = [
  { valor: "PROJETO", texto: "Projeto" },
  { valor: "JUSTIFICATIVA", texto: "Justificativa" },
  { valor: "CONVITE", texto: "Convite" },
  { valor: "PROGRAMACAO", texto: "Programação" },
  { valor: "ORCAMENTO", texto: "Orçamento" },
  { valor: "OUTRO", texto: "Outro" },
];

/** A cotação tem PDF próprio; é ele que justifica a escolha da passagem. */
export const CATEGORIAS_DA_COTACAO: OpcaoCategoria[] = [
  { valor: "COTACAO", texto: "Cotação" },
  { valor: "OUTRO", texto: "Outro" },
];

/**
 * Categorias da galeria de evidências (CG-057).
 *
 * Separadas das da missão de propósito: aquelas instruem a análise do Comitê e
 * são cobradas no checklist; estas registram o que aconteceu. Misturá-las faria
 * a foto do jantar aparecer na lista de documentos exigidos para aprovação.
 */
export const CATEGORIAS_FOTO: OpcaoCategoria[] = [
  { valor: "FOTO_REUNIAO", texto: "Foto — reunião" },
  { valor: "FOTO_EVENTO", texto: "Foto — evento" },
  { valor: "FOTO_VISITA", texto: "Foto — visita" },
  { valor: "FOTO_ASSINATURA", texto: "Foto — assinatura" },
  { valor: "FOTO_INSTITUICAO", texto: "Foto — instituição" },
  { valor: "FOTO_PARTICIPANTES", texto: "Foto — participantes" },
];

/** Evidência documental: comprova que a missão aconteceu, sem ser foto. */
export const CATEGORIAS_EVIDENCIA: OpcaoCategoria[] = [
  { valor: "CERTIFICADO", texto: "Certificado" },
  { valor: "ATA", texto: "Ata" },
  { valor: "LISTA_PRESENCA", texto: "Lista de presença" },
  { valor: "DECLARACAO", texto: "Declaração" },
  { valor: "NOTICIA", texto: "Notícia" },
  { valor: "PUBLICACAO", texto: "Publicação" },
  { valor: "APRESENTACAO", texto: "Apresentação" },
  { valor: "OUTRO", texto: "Outro" },
];

export const CATEGORIAS_DA_GALERIA: OpcaoCategoria[] = [
  ...CATEGORIAS_FOTO,
  ...CATEGORIAS_EVIDENCIA,
];

const CHAVES_FOTO = new Set(CATEGORIAS_FOTO.map((opcao) => opcao.valor));
const CHAVES_GALERIA = new Set(
  CATEGORIAS_DA_GALERIA.map((opcao) => opcao.valor),
);

/** `OUTRO` não entra: ele é o destino de tudo que não se classificou. */
export function ehEvidencia(categoria: string): boolean {
  return categoria !== "OUTRO" && CHAVES_GALERIA.has(categoria);
}

export function ehFoto(categoria: string): boolean {
  return CHAVES_FOTO.has(categoria);
}
