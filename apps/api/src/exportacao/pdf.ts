import PDFDocument from 'pdfkit';
import { PDFDocument as PdfLib } from 'pdf-lib';

/**
 * Geracao de PDF (CG-069).
 *
 * Duas bibliotecas, com papeis distintos e sem sobreposicao: **pdfkit desenha**
 * (texto, tabela, imagem) e **pdf-lib monta** (concatena o corpo gerado com os
 * PDF que ja existiam como anexo). Escrever qualquer uma das duas a mao seria
 * caro pelo motivo errado: a primeira exige metricas de fonte para quebrar
 * linha, e a segunda exige reescrever a arvore de objetos de um PDF alheio.
 *
 * O dossie e **um arquivo so** por decisao de 2026-09-07, e e a mesclagem que
 * torna isso verdade: sem ela o dossie seria um indice apontando para arquivos
 * que quem recebeu teria de baixar um a um — exatamente o pacote que a decisao
 * recusou.
 *
 * Nada e gravado em disco. O buffer sai na resposta e morre com ela; nao ha o
 * que expirar nem o que varrer, e nao sobra exportacao no servidor para ser
 * servida depois a quem nao podia ve-la.
 */

const MARGEM = 48;
const LARGURA_UTIL = 595.28 - MARGEM * 2; // A4 retrato

export interface SecaoPdf {
  titulo: string;
  /** Pares rotulo/valor; valor nulo vira travessao, nunca some. */
  campos?: { rotulo: string; valor: string | null }[];
  /** Paragrafos livres, na ordem. */
  paragrafos?: string[];
  tabela?: { colunas: string[]; linhas: (string | null)[][] };
  /** Imagens ja carregadas, com a legenda que vai abaixo. */
  imagens?: { conteudo: Buffer; legenda: string }[];
}

export interface DocumentoPdf {
  titulo: string;
  subtitulo?: string;
  /** Aparece no rodape de toda pagina, junto da numeracao. */
  rodape: string;
  secoes: SecaoPdf[];
}

/** Desenha o documento e devolve os bytes. */
export function gerarPdf(documento: DocumentoPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: MARGEM, bottom: MARGEM, left: MARGEM, right: MARGEM },
    info: { Title: documento.titulo },
    // Sem `bufferPages` a numeracao "pagina X de Y" e impossivel: o total so se
    // conhece no fim, e as paginas ja teriam sido enviadas.
    bufferPages: true,
  });

  const pedacos: Buffer[] = [];
  doc.on('data', (pedaco: Buffer) => pedacos.push(pedaco));
  const pronto = new Promise<Buffer>((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(pedacos)));
  });

  doc.font('Helvetica-Bold').fontSize(16).text(documento.titulo);
  if (documento.subtitulo) {
    doc
      .moveDown(0.3)
      .font('Helvetica')
      .fontSize(10)
      .fillColor('#555')
      .text(documento.subtitulo);
  }
  doc.fillColor('#000').moveDown(1);

  for (const secao of documento.secoes) {
    desenharSecao(doc, secao);
  }

  numerarPaginas(doc, documento.rodape);
  doc.end();
  return pronto;
}

function desenharSecao(doc: PDFKit.PDFDocument, secao: SecaoPdf): void {
  // Um titulo sozinho no rodape da pagina e orfao: o leitor vira a folha e nao
  // sabe do que a secao fala. 90pt e o espaco de titulo mais duas linhas.
  if (doc.y > doc.page.height - MARGEM - 90) doc.addPage();

  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(12).text(secao.titulo);
  doc.moveDown(0.4).font('Helvetica').fontSize(9.5);

  for (const campo of secao.campos ?? []) {
    doc
      .fillColor('#555')
      .text(`${campo.rotulo}: `, { continued: true })
      .fillColor('#000')
      // Travessao, e nao omissao: campo ausente na tela e campo ausente aqui, e
      // some-lo faria o dossie parecer mais completo do que o registro esta.
      .text(campo.valor ?? '—');
  }

  for (const paragrafo of secao.paragrafos ?? []) {
    doc.moveDown(0.4).fillColor('#000').text(paragrafo, { align: 'justify' });
  }

  if (secao.tabela) desenharTabela(doc, secao.tabela);

  for (const imagem of secao.imagens ?? []) {
    if (doc.y > doc.page.height - MARGEM - 200) doc.addPage();
    doc.moveDown(0.5);
    try {
      doc.image(imagem.conteudo, { fit: [LARGURA_UTIL, 260], align: 'center' });
    } catch {
      // Imagem que a biblioteca nao decodifica nao pode derrubar o dossie
      // inteiro. O registro dela continua na lista de documentos.
      doc.fillColor('#a00').text('[imagem não pôde ser renderizada]');
    }
    doc.moveDown(0.3).fillColor('#555').fontSize(8).text(imagem.legenda, {
      align: 'center',
    });
    doc.fillColor('#000').fontSize(9.5);
  }
}

/**
 * Tabela de largura fixa, com texto truncado.
 *
 * Colunas de largura igual e truncamento sao decisao consciente: medir o
 * conteudo para distribuir largura exigiria dois passes sobre todas as linhas,
 * e uma coluna que estoura empurra as outras para fora da folha. Truncar mantem
 * a folha legivel; o valor inteiro esta no CSV e na tela.
 */
function desenharTabela(
  doc: PDFKit.PDFDocument,
  tabela: { colunas: string[]; linhas: (string | null)[][] },
): void {
  const largura = LARGURA_UTIL / tabela.colunas.length;
  const alturaLinha = 16;

  const cabecalho = () => {
    doc.font('Helvetica-Bold').fontSize(8);
    const y = doc.y;
    tabela.colunas.forEach((texto, i) => {
      doc.text(texto, MARGEM + i * largura, y, {
        width: largura - 4,
        lineBreak: false,
      });
    });
    doc.y = y + alturaLinha;
    doc.font('Helvetica').fontSize(8);
  };

  doc.moveDown(0.3);
  cabecalho();

  for (const linha of tabela.linhas) {
    if (doc.y > doc.page.height - MARGEM - alturaLinha * 2) {
      doc.addPage();
      cabecalho();
    }
    const y = doc.y;
    linha.forEach((valor, i) => {
      doc.text(valor ?? '—', MARGEM + i * largura, y, {
        width: largura - 4,
        lineBreak: false,
        ellipsis: true,
      });
    });
    doc.y = y + alturaLinha;
  }
  doc.x = MARGEM;
  doc.moveDown(0.5).fontSize(9.5);
}

/** "Pagina X de Y" e o rodape, escritos depois de todas as paginas existirem. */
function numerarPaginas(doc: PDFKit.PDFDocument, rodape: string): void {
  const faixa = doc.bufferedPageRange();
  for (let i = 0; i < faixa.count; i += 1) {
    doc.switchToPage(faixa.start + i);
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor('#777')
      .text(
        `${rodape}  ·  página ${i + 1} de ${faixa.count}`,
        MARGEM,
        doc.page.height - MARGEM + 12,
        { width: LARGURA_UTIL, align: 'center', lineBreak: false },
      );
  }
}

/**
 * Concatena o corpo do dossie com os PDF anexados.
 *
 * Anexo que nao e PDF valido — ou que esta cifrado — e **pulado, nao fatal**:
 * um arquivo corrompido nao pode impedir a emissao do dossie inteiro, e a lista
 * de documentos ja registra que ele existe. Quem gera recebe de volta quais
 * ficaram de fora, para a tela poder dizer.
 */
export async function mesclarPdfs(
  corpo: Buffer,
  anexos: { nome: string; conteudo: Buffer }[],
): Promise<{ conteudo: Buffer; ignorados: string[] }> {
  if (anexos.length === 0) return { conteudo: corpo, ignorados: [] };

  const destino = await PdfLib.load(corpo);
  const ignorados: string[] = [];

  for (const anexo of anexos) {
    try {
      const origem = await PdfLib.load(anexo.conteudo, {
        ignoreEncryption: true,
      });
      const paginas = await destino.copyPages(origem, origem.getPageIndices());
      for (const pagina of paginas) destino.addPage(pagina);
    } catch {
      ignorados.push(anexo.nome);
    }
  }

  return { conteudo: Buffer.from(await destino.save()), ignorados };
}
