/**
 * Formatos aceitos e a verificacao de assinatura (CG-051).
 *
 * **Somente PDF, JPG e PNG**, por decisao do responsavel em 2026-09-07. A
 * CG-009 tinha homologado tambem DOC/DOCX e XLS/XLSX; perguntado se eram mesmo
 * obrigatorios, o responsavel respondeu que o PDF basta por enquanto.
 *
 * A restricao vale a pena por si: documento do Office e o vetor classico de
 * macro, e este projeto ainda **nao tem antivirus** — o ponto de insercao esta
 * marcado em `validarArquivo`, e ate ele existir cada formato a menos e uma
 * porta a menos. Arquivos ja enviados continuam validos e baixaveis: a
 * validacao acontece no envio, nao na leitura.
 *
 * Voltar a aceitar Office e acrescentar as entradas de volta — as assinaturas
 * OLE2 e ZIP ficam registradas no historico deste arquivo.
 *
 * **A extensao e o `Content-Type` nao valem nada aqui.** Os dois vem do
 * cliente: renomear `virus.exe` para `nota.pdf` muda os dois e nao muda um byte
 * do conteudo. Por isso a decisao vale sobre os primeiros bytes do arquivo, que
 * sao o que o formato realmente exige ter.
 */

export interface TipoPermitido {
  /** Rotulo curto para mensagem de erro. */
  nome: string;
  mimeType: string;
  extensoes: string[];
  /** Assinaturas aceitas, em hexadecimal, a partir do byte 0. */
  assinaturas: string[];
}

/**
 * Imagem entra para a galeria de evidencias (CG-057), nao como documento: e a
 * foto da visita, da assinatura, do evento. PDF cobre o resto.
 */
export const TIPOS_PERMITIDOS: TipoPermitido[] = [
  {
    nome: 'PDF',
    mimeType: 'application/pdf',
    extensoes: ['pdf'],
    assinaturas: ['25504446'], // %PDF
  },
  {
    nome: 'JPEG',
    mimeType: 'image/jpeg',
    extensoes: ['jpg', 'jpeg'],
    assinaturas: ['ffd8ff'],
  },
  {
    nome: 'PNG',
    mimeType: 'image/png',
    extensoes: ['png'],
    assinaturas: ['89504e470d0a1a0a'],
  },
];

export const EXTENSOES_ACEITAS = [
  ...new Set(TIPOS_PERMITIDOS.flatMap((tipo) => tipo.extensoes)),
];

export function extensaoDe(nomeArquivo: string): string {
  const partes = nomeArquivo.toLowerCase().split('.');
  return partes.length > 1 ? (partes.pop() as string) : '';
}

/**
 * Decide o tipo pelo conteudo, exigindo que a extensao declarada combine.
 *
 * Retorna `null` quando o conteudo nao bate com nenhum formato aceito, ou
 * quando bate mas a extensao diz outra coisa — um `.pdf` cujo conteudo e ZIP e
 * recusado mesmo que ZIP esteja na lista por causa do `.docx`.
 */
export function identificarTipo(
  conteudo: Buffer,
  nomeArquivo: string,
): TipoPermitido | null {
  const extensao = extensaoDe(nomeArquivo);
  const inicio = conteudo.subarray(0, 8).toString('hex').toLowerCase();

  return (
    TIPOS_PERMITIDOS.find(
      (tipo) =>
        tipo.extensoes.includes(extensao) &&
        tipo.assinaturas.some((assinatura) => inicio.startsWith(assinatura)),
    ) ?? null
  );
}
