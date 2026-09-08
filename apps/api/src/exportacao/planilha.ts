import { deflateRawSync } from 'node:zlib';

/**
 * Escrita de CSV e XLSX (CG-069).
 *
 * **A neutralizacao de formula acontece na escrita, e nunca na leitura.** O
 * conteudo destas planilhas vem de campo livre — titulo de missao, nome de
 * evento, justificativa —, e uma celula que comeca com `=`, `+`, `-`, `@`,
 * tabulacao ou retorno de carro e interpretada como formula pelo Excel e pelo
 * LibreOffice ao abrir o arquivo. Um titulo como `=cmd|'/c calc'!A1` vira
 * execucao na maquina de quem baixou o relatorio, sem nenhum aviso.
 *
 * O prefixo e uma aspa simples, que os dois programas entendem como "isto e
 * texto" e nao exibem. Sanitizar so na leitura seria inutil: o arquivo ja saiu.
 *
 * **O XLSX e escrito aqui, sem biblioteca.** Um `.xlsx` e um ZIP com cinco XML
 * previsiveis, e a alternativa (`exceljs`) traz uma arvore de dependencias
 * inteira para escrever celula de texto e numero. Menos dependencia e menos
 * coisa para a instituicao manter no servidor on-premise — a mesma razao que
 * fez a exportacao ser sincrona.
 */

/** Caracteres que iniciam formula em Excel e LibreOffice. */
const INICIO_DE_FORMULA = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Deixa o texto seguro para celula de planilha.
 *
 * Exportado porque e a regra que o teste precisa exercitar diretamente: e a
 * unica linha de codigo entre um titulo malicioso e a maquina de quem abre.
 */
export function neutralizarFormula(valor: string): string {
  return INICIO_DE_FORMULA.some((inicio) => valor.startsWith(inicio))
    ? `'${valor}`
    : valor;
}

export interface Planilha {
  titulo: string;
  colunas: string[];
  linhas: (string | number | null)[][];
}

/** BOM de UTF-8; ver `paraCsv`. */
const BOM = '﻿';

/**
 * CSV com BOM e ponto e virgula.
 *
 * BOM porque sem ele o Excel no Windows le UTF-8 como Latin-1 e "Missao" com
 * til vira mojibake. Ponto e virgula porque o separador de lista no Brasil e
 * ele, e a virgula ja e o separador decimal — com virgula nos dois papeis, toda
 * linha com valor monetario quebra em colunas erradas.
 */
export function paraCsv(planilha: Planilha): Buffer {
  const linhas = [
    planilha.colunas.map(celulaCsv).join(';'),
    ...planilha.linhas.map((linha) => linha.map(celulaCsv).join(';')),
  ];
  return Buffer.from(`${BOM}${linhas.join('\r\n')}\r\n`, 'utf8');
}

function celulaCsv(valor: string | number | null): string {
  if (valor === null) return '';
  if (typeof valor === 'number') return String(valor);
  const seguro = neutralizarFormula(valor);
  // Aspas duplicadas sao o escape do proprio formato; sem isso um titulo com
  // ponto e virgula partiria a linha em duas colunas.
  return `"${seguro.replace(/"/g, '""')}"`;
}

/**
 * XLSX minimo: uma planilha, cabecalho e linhas.
 *
 * Numero vai como numero (sem `t`), texto vai como `inlineStr`. Strings em
 * linha, e nao tabela compartilhada, porque a compartilhada exige um segundo
 * passe para deduplicar e o ganho so aparece em arquivo com muita repeticao —
 * que nao e o caso de um relatorio com teto de mil linhas.
 */
export function paraXlsx(planilha: Planilha): Buffer {
  const linhas = [planilha.colunas, ...planilha.linhas];
  const corpo = linhas
    .map((linha, indice) => {
      const celulas = linha
        .map((valor, coluna) => celulaXlsx(valor, coluna, indice + 1))
        .join('');
      return `<row r="${indice + 1}">${celulas}</row>`;
    })
    .join('');

  const cabecalhoXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const arquivos: [string, string][] = [
    [
      '[Content_Types].xml',
      `${cabecalhoXml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '</Types>',
    ],
    [
      '_rels/.rels',
      `${cabecalhoXml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/workbook.xml',
      `${cabecalhoXml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${escaparXml(nomeDeAba(planilha.titulo))}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    ],
    [
      'xl/_rels/workbook.xml.rels',
      `${cabecalhoXml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '</Relationships>',
    ],
    [
      'xl/worksheets/sheet1.xml',
      `${cabecalhoXml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        `<sheetData>${corpo}</sheetData></worksheet>`,
    ],
  ];

  return zipar(arquivos);
}

function celulaXlsx(
  valor: string | number | null,
  coluna: number,
  linha: number,
): string {
  const referencia = `${letraDaColuna(coluna)}${linha}`;
  if (valor === null) return '';
  if (typeof valor === 'number') {
    return `<c r="${referencia}"><v>${valor}</v></c>`;
  }
  const texto = escaparXml(neutralizarFormula(valor));
  return `<c r="${referencia}" t="inlineStr"><is><t xml:space="preserve">${texto}</t></is></c>`;
}

function letraDaColuna(indice: number): string {
  let n = indice;
  let letra = '';
  do {
    letra = String.fromCharCode(65 + (n % 26)) + letra;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return letra;
}

/**
 * Nome de aba do Excel: no maximo 31 caracteres e sem os proibidos.
 *
 * Passar disso nao da erro de escrita — da erro de **abertura**, e o arquivo
 * parece corrompido para quem baixou.
 */
function nomeDeAba(titulo: string): string {
  return titulo.replace(/[:\\/?*[\]]/g, '-').slice(0, 31) || 'Relatorio';
}

/**
 * Escapa para XML e **remove caractere de controle**.
 *
 * Controle e ilegal em XML 1.0 e faz o Excel recusar o arquivo inteiro — quem
 * baixou ve "arquivo corrompido" e nao tem como saber por que. Nome enviado com
 * caractere de controle ja aconteceu antes (CG-061), entao nao e hipotese.
 *
 * A varredura percorre os pontos de codigo em vez de usar expressao regular
 * pela mesma razao de `temControle` em `anexos.service.ts`: literal de controle
 * dentro de regex e justamente o que o `no-control-regex` proibe, e silenciar a
 * regra esconderia o proximo caso, escrito sem intencao.
 */
function escaparXml(texto: string): string {
  const escapes: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
  };
  let saida = '';
  for (const caractere of texto) {
    const codigo = caractere.codePointAt(0) ?? 0;
    // Tab, LF e CR sao legais em XML e ficam.
    const legivel =
      codigo >= 0x20 || codigo === 0x09 || codigo === 0x0a || codigo === 0x0d;
    if (!legivel || codigo === 0x7f) continue;
    saida += escapes[caractere] ?? caractere;
  }
  return saida;
}

/**
 * ZIP sem diretorio, com DEFLATE do `zlib` do proprio Node.
 *
 * Escrito a mao porque e o unico pedaco de formato que falta para o `.xlsx`, e
 * trazer uma biblioteca de arquivamento para montar cinco entradas seria
 * desproporcional. As datas sao fixas de proposito: o mesmo relatorio gera
 * bytes identicos, o que torna o teste deterministico.
 */
function zipar(arquivos: [string, string][]): Buffer {
  const entradas = arquivos.map(([nome, conteudo]) => {
    const cru = Buffer.from(conteudo, 'utf8');
    const comprimido = deflateRawSync(cru);
    return {
      nome: Buffer.from(nome, 'utf8'),
      cru,
      comprimido,
      crc: crc32(cru),
    };
  });

  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;

  for (const entrada of entradas) {
    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0);
    cabecalho.writeUInt16LE(20, 4); // versao minima
    cabecalho.writeUInt16LE(0x0800, 6); // nome em UTF-8
    cabecalho.writeUInt16LE(8, 8); // deflate
    cabecalho.writeUInt16LE(0, 10); // hora
    cabecalho.writeUInt16LE(0x0021, 12); // data: 1980-01-01
    cabecalho.writeUInt32LE(entrada.crc, 14);
    cabecalho.writeUInt32LE(entrada.comprimido.length, 18);
    cabecalho.writeUInt32LE(entrada.cru.length, 22);
    cabecalho.writeUInt16LE(entrada.nome.length, 26);
    cabecalho.writeUInt16LE(0, 28);
    locais.push(cabecalho, entrada.nome, entrada.comprimido);

    const diretorio = Buffer.alloc(46);
    diretorio.writeUInt32LE(0x02014b50, 0);
    diretorio.writeUInt16LE(20, 4);
    diretorio.writeUInt16LE(20, 6);
    diretorio.writeUInt16LE(0x0800, 8);
    diretorio.writeUInt16LE(8, 10);
    diretorio.writeUInt16LE(0, 12);
    diretorio.writeUInt16LE(0x0021, 14);
    diretorio.writeUInt32LE(entrada.crc, 16);
    diretorio.writeUInt32LE(entrada.comprimido.length, 20);
    diretorio.writeUInt32LE(entrada.cru.length, 24);
    diretorio.writeUInt16LE(entrada.nome.length, 28);
    diretorio.writeUInt32LE(deslocamento, 42);
    central.push(diretorio, entrada.nome);

    deslocamento += 30 + entrada.nome.length + entrada.comprimido.length;
  }

  const corpoCentral = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(entradas.length, 8);
  fim.writeUInt16LE(entradas.length, 10);
  fim.writeUInt32LE(corpoCentral.length, 12);
  fim.writeUInt32LE(deslocamento, 16);

  return Buffer.concat([...locais, corpoCentral, fim]);
}

/** CRC-32 do ZIP; tabela montada uma vez por processo. */
const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let bit = 0; bit < 8; bit += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    tabela[i] = c >>> 0;
  }
  return tabela;
})();

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const byte of dados) {
    c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}
