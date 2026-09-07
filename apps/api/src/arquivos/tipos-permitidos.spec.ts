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
  it('aceita os tres formatos em vigor', () => {
    expect(identificarTipo(PDF, 'projeto.pdf')?.nome).toBe('PDF');
    expect(identificarTipo(JPEG, 'foto.jpg')?.nome).toBe('JPEG');
    expect(identificarTipo(JPEG, 'foto.jpeg')?.nome).toBe('JPEG');
    expect(identificarTipo(PNG, 'grafico.png')?.nome).toBe('PNG');
  });

  it('recusa Office, retirado da lista em 2026-09-07', () => {
    // A CG-009 tinha homologado DOC/DOCX e XLS/XLSX; o responsavel decidiu que
    // o PDF basta por enquanto. Documento do Office e o vetor classico de
    // macro, e este projeto ainda nao tem antivirus — cada formato a menos e
    // uma porta a menos ate ele existir.
    expect(identificarTipo(ZIP, 'ata.docx')).toBeNull();
    expect(identificarTipo(ZIP, 'planilha.xlsx')).toBeNull();
    expect(identificarTipo(OLE2, 'antigo.doc')).toBeNull();
    expect(identificarTipo(OLE2, 'antiga.xls')).toBeNull();
  });

  it('recusa executavel disfarcado de PDF', () => {
    // O caso que a verificacao existe para pegar: extensao e Content-Type sao
    // do cliente e mentem juntos; o conteudo nao.
    expect(identificarTipo(EXECUTAVEL, 'nota.pdf')).toBeNull();
    expect(identificarTipo(EXECUTAVEL, 'nota.exe')).toBeNull();
  });

  it('recusa conteudo valido com extensao de outro formato', () => {
    // A extensao sozinha nunca bastou, e o conteudo tambem nao: os dois
    // precisam concordar. PNG renomeado para .jpg e conteudo real de formato
    // aceito, e ainda assim e recusado.
    expect(identificarTipo(PNG, 'foto.jpg')).toBeNull();
    expect(identificarTipo(JPEG, 'foto.png')).toBeNull();
  });

  it('recusa formato fora da lista mesmo com assinatura coerente', () => {
    // GIF e imagem de verdade e nunca esteve na lista.
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

  it('a lista aceita e exatamente PDF, JPG e PNG', () => {
    // Fixada de proposito: acrescentar formato passa a ser mudanca visivel no
    // teste, e nao um item que entra sem ninguem reparar.
    expect([...EXTENSOES_ACEITAS].sort()).toEqual([
      'jpeg',
      'jpg',
      'pdf',
      'png',
    ]);
  });
});
