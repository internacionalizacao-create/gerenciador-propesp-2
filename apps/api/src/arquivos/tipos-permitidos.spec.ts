import {
  EXTENSOES_ACEITAS,
  extensaoDe,
  identificarTipo,
} from './tipos-permitidos';

/** Bytes iniciais reais de cada formato, seguidos de recheio irrelevante. */
const bytes = (hex: string, sobra = 32) =>
  Buffer.concat([Buffer.from(hex, 'hex'), Buffer.alloc(sobra, 0x41)]);

const PDF = bytes('255044462d312e34');
const JPEG = bytes('ffd8ffe000104a464946');
const PNG = bytes('89504e470d0a1a0a');
const ZIP = bytes('504b03040a000000');
const OLE2 = bytes('d0cf11e0a1b11ae1');
const EXECUTAVEL = bytes('4d5a90000300'); // MZ — PE/EXE

describe('Formatos aceitos (CG-051)', () => {
  it('aceita os formatos homologados na CG-009', () => {
    expect(identificarTipo(PDF, 'projeto.pdf')?.nome).toBe('PDF');
    expect(identificarTipo(JPEG, 'foto.jpg')?.nome).toBe('JPEG');
    expect(identificarTipo(JPEG, 'foto.jpeg')?.nome).toBe('JPEG');
    expect(identificarTipo(PNG, 'grafico.png')?.nome).toBe('PNG');
    expect(identificarTipo(ZIP, 'ata.docx')?.nome).toBe('Word');
    expect(identificarTipo(ZIP, 'planilha.xlsx')?.nome).toBe('Excel');
    expect(identificarTipo(OLE2, 'antigo.doc')?.nome).toBe('Word 97-2003');
    expect(identificarTipo(OLE2, 'antiga.xls')?.nome).toBe('Excel 97-2003');
  });

  it('recusa executavel disfarcado de PDF', () => {
    // O caso que a verificacao existe para pegar: extensao e Content-Type sao
    // do cliente e mentem juntos; o conteudo nao.
    expect(identificarTipo(EXECUTAVEL, 'nota.pdf')).toBeNull();
    expect(identificarTipo(EXECUTAVEL, 'nota.exe')).toBeNull();
  });

  it('recusa conteudo valido com extensao de outro formato', () => {
    // ZIP e conteudo legitimo de .docx, mas nao de .pdf. Aceitar so porque a
    // assinatura consta na lista deixaria passar qualquer ZIP renomeado.
    expect(identificarTipo(ZIP, 'contrato.pdf')).toBeNull();
    expect(identificarTipo(PDF, 'contrato.docx')).toBeNull();
    expect(identificarTipo(PNG, 'foto.jpg')).toBeNull();
  });

  it('recusa formato fora da lista mesmo com assinatura coerente', () => {
    // GIF e imagem de verdade, mas nao foi homologado na CG-009.
    const GIF = bytes('474946383961');
    expect(identificarTipo(GIF, 'animacao.gif')).toBeNull();
  });

  it('recusa arquivo sem extensao e arquivo vazio', () => {
    expect(identificarTipo(PDF, 'semextensao')).toBeNull();
    expect(identificarTipo(Buffer.alloc(0), 'vazio.pdf')).toBeNull();
  });

  it('extrai a extensao em minusculas e do ultimo ponto', () => {
    expect(extensaoDe('Relatório.Final.PDF')).toBe('pdf');
    expect(extensaoDe('semponto')).toBe('');
  });

  it('a lista aceita e exatamente a homologada na CG-009', () => {
    expect([...EXTENSOES_ACEITAS].sort()).toEqual([
      'doc',
      'docx',
      'jpeg',
      'jpg',
      'pdf',
      'png',
      'xls',
      'xlsx',
    ]);
  });
});
