import { planilhaCapesGlobal } from './planilha/capes-global';

/**
 * Dados extraídos das planilhas originais.
 *
 * O arquivo em `planilha/` é **gerado** por `extrair-planilhas.py` e versionado:
 * ele é o dado migrado, e precisa ser auditável sem depender dos `.xlsx`, que
 * não estão no repositório. Este módulo só lhe dá tipos e acrescenta o que é
 * texto normativo estável.
 */

export interface ItemCatalogoBruto {
  codigo: string;
  destino: 'BRASIL' | 'EXTERIOR';
  modalidade: string;
  vigenciaMeses: string;
  valorUsd: string | null;
  valorBrl: string;
  fonte: string | null;
  observacao: string | null;
}

export interface PpgBruto {
  rede: string;
  temaId: string;
  nome: string;
  sigla: string;
  notaCapes: number | null;
  membroComite: string | null;
  situacao: 'CONTEMPLADO' | 'CADASTRO_PRELIMINAR';
  modalidadesPrevistas: string | null;
  observacoes: string | null;
}

export interface TematicaBruta {
  rede: string;
  codigo: string;
  nome: string;
  membros: string[];
  qtdPpgs: number;
  statusOrcamento: 'DEFINIDO' | 'A_DEFINIR';
  valorBolsas: string | null;
  valorManutencao: string | null;
  valorMissoes: string | null;
  custoBolsasInformado: string | null;
  saldoInformado: string | null;
  observacoes: string | null;
}

export interface ItemPlanoBruto {
  codigo: string;
  rede: string;
  temaId: string;
  ppg: string;
  destino: 'BRASIL' | 'EXTERIOR' | null;
  modalidade: string | null;
  quantidadeAnual: number;
  vigenciaMeses: string | null;
  mesImplementacao: string | null;
  status: 'PROGRAMADO' | 'PENDENTE';
  valorUnitario: string | null;
  fluxo: 'IN' | 'OUT' | null;
  textoFonte: string | null;
  validacao: string | null;
}

export interface PendenciaBruta {
  codigo: string;
  escopoRede: string | null;
  escopoTema: string | null;
  assunto: string | null;
  descricao: string | null;
  impacto: string | null;
  responsavel: string | null;
  prazo: string | null;
  status: string | null;
}

export interface PremissaBruta {
  item: string;
  valor: string | null;
  unidade: string | null;
  natureza: string | null;
  fonte: string | null;
  dataBase: string;
  responsavel: string | null;
  observacoes: string | null;
}

export interface ComiteGestorBruto {
  rede: string;
  valorAnual: string;
  anos: number[];
}

export interface DadosCapesGlobal {
  _origem: string;
  _extraidoEm: string;
  catalogo: ItemCatalogoBruto[];
  ppgs: PpgBruto[];
  tematicas: TematicaBruta[];
  plano: ItemPlanoBruto[];
  pendencias: PendenciaBruta[];
  premissas: PremissaBruta[];
  comiteGestor: ComiteGestorBruto[];
}

export const dadosCapesGlobal =
  planilhaCapesGlobal as unknown as DadosCapesGlobal;

/**
 * Fontes documentais da aba `Premissas`. Ficam aqui e não no JSON porque são
 * texto normativo estável, não dado tabular extraído.
 */
export const fontesDocumentais = [
  {
    nome: 'Anexo de bolsas no Brasil',
    conteudoUtilizado: 'Modalidades, vigências e valores totais em BRL',
    escopo: 'Bolsas no Brasil',
    status: 'INCORPORADO',
    arquivoOrigem: 'Texto colado(3).txt',
    dataRecebimento: '2026-07-29',
    referenciaNormativa: 'Portaria nº 1/2020 e Portaria nº 33/2023',
    observacoes: 'Inclui mensalidade, deslocamento, instalação e seguro-saúde.',
  },
  {
    nome: 'Anexo de bolsas no exterior',
    conteudoUtilizado:
      'Modalidades, vigências, valores USD e BRL; cotação de R$ 6,59/US$',
    escopo: 'Bolsas no exterior',
    status: 'INCORPORADO',
    arquivoOrigem: 'Texto colado (2)(1).txt',
    dataRecebimento: '2026-07-29',
    referenciaNormativa: 'Conforme anexo encaminhado',
    observacoes: 'Inclui adicional de alto custo estimado para 70% das bolsas.',
  },
];

/**
 * Programas de mobilidade que ainda não têm dados, mas existem no mundo real
 * (anotação do slide 6 do protótipo). Entram vazios para que a estrutura
 * multiprograma seja visível desde o primeiro dia.
 */
export const outrosProgramas = [
  { nome: 'GCUB Mobilidade', slug: 'gcub', orgaoFinanciador: 'GCUB' },
  { nome: 'Erasmus+', slug: 'erasmus', orgaoFinanciador: 'União Europeia' },
  {
    nome: 'PDSE — Doutorado Sanduíche no Exterior',
    slug: 'pdse',
    orgaoFinanciador: 'CAPES',
  },
  {
    nome: 'Move La América',
    slug: 'move-la-america',
    orgaoFinanciador: 'CAPES',
  },
  { nome: 'PROAFRI', slug: 'proafri', orgaoFinanciador: 'CAPES' },
];
