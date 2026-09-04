/**
 * Formatos aceitos e a verificacao de assinatura (CG-051).
 *
 * A lista e a homologada na CG-009, secao 15 do documento da equipe: PDF, JPG,
 * PNG, DOC/DOCX e XLS/XLSX.
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
 * `D0CF11E0A1B11AE1` e o cabecalho OLE2, usado pelo Office antigo (.doc/.xls).
 * `504B0304` e ZIP, e o Office novo (.docx/.xlsx) e um ZIP por dentro — por
 * isso os dois compartilham assinatura e a distincao final fica na extensao
 * declarada, ja restrita a lista abaixo.
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
  {
    nome: 'Word',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensoes: ['docx'],
    assinaturas: ['504b0304'],
  },
  {
    nome: 'Word 97-2003',
    mimeType: 'application/msword',
    extensoes: ['doc'],
    assinaturas: ['d0cf11e0a1b11ae1'],
  },
  {
    nome: 'Excel',
    mimeType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensoes: ['xlsx'],
    assinaturas: ['504b0304'],
  },
  {
    nome: 'Excel 97-2003',
    mimeType: 'application/vnd.ms-excel',
    extensoes: ['xls'],
    assinaturas: ['d0cf11e0a1b11ae1'],
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
