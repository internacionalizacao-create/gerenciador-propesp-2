/**
 * Espelho dos tipos que a API devolve.
 *
 * Sao escritos a mao de proposito. Gerar a partir do schema do Nest acoplaria o
 * build da web ao da API, e o que existe hoje entre os dois e um contrato HTTP —
 * quando ele quebrar, os testes de integracao da API acusam antes.
 *
 * **Dinheiro chega como string.** Ver `formato.ts` para o porque.
 */

export type Destino = "BRASIL" | "EXTERIOR";
export type Fluxo = "IN" | "OUT";
export type Rubrica = "BOLSAS" | "MANUTENCAO" | "MISSOES";
export type StatusOrcamento = "DEFINIDO" | "A_DEFINIR";
export type OrigemValor = "CATALOGO" | "ESTIMADO" | "INDEFINIDO";

export interface Me {
  id: string;
  username?: string;
  name?: string;
  email?: string;
  roles: string[];
  permissions: string[];
}

export interface Ciclo {
  programaId: string;
  programaNome: string;
  programaSlug: string;
  usaRedes: boolean;
  usaAreasTematicas: boolean;
  cicloId: string;
  cicloNome: string;
  anoInicio: number;
  anoFim: number;
  status: "PLANEJAMENTO" | "VIGENTE" | "ENCERRADO";
  anos: number[];
}

export interface Programa {
  id: string;
  nome: string;
  sigla: string | null;
  slug: string;
  orgaoFinanciador: string | null;
  usaRedes: boolean;
  usaAreasTematicas: boolean;
  ativo: boolean;
  ciclos: number;
  linhasPlano: number;
  ppgs: number;
  aporteAnual: string | null;
  cicloAtual: string | null;
}

export interface CoordenadorTematica {
  ppgId: string;
  ppgSigla: string;
  nome: string;
  email: string | null;
}

export interface LinhaTematica {
  areaTematicaId: string;
  codigo: string;
  nome: string;
  redeId: string;
  rede: string;
  ano: number;
  statusOrcamento: StatusOrcamento;
  valorBolsas: string | null;
  valorManutencao: string | null;
  valorMissoes: string | null;
  apoio: string | null;
  totalPrevisto: string | null;
  custoBolsas: string;
  custoApoio: string;
  totalProgramado: string;
  bolsas: number;
  saldoPotencial: string | null;
  saldoInformado: string | null;
  divergencia: string | null;
  utilizacao: number | null;
  ppgs: number;
}

export interface LinhaRede {
  redeId: string;
  rede: string;
  statusOrcamento: StatusOrcamento;
  ano: number;
  valorBolsas: string | null;
  apoio: string | null;
  totalPrevisto: string | null;
  custoBolsas: string;
  bolsas: number;
  saldoPotencial: string | null;
  tematicas: number;
  ppgs: number;
}

export interface Indicador {
  chave: string;
  rotulo: string;
  valor: string | number | null;
  formato: "moeda" | "inteiro";
  nota?: string;
}

export interface Alerta {
  chave: string;
  nivel: "ALTA" | "MEDIA" | "BAIXA";
  titulo: string;
  detalhe: string;
  quantidade: number;
  destino: string;
}

export interface Painel {
  ciclo: Ciclo;
  anoBase: number;
  indicadores: Indicador[];
  porRede: LinhaRede[];
  porModalidade: {
    modalidade: string;
    destino: Destino;
    quantidadeAno: number;
    custoAno: string;
    quantidadeCiclo: number;
    custoCiclo: string;
  }[];
  porAno: {
    ano: number;
    aporte: string | null;
    custoBolsas: string;
    custoApoio: string;
    saldoPotencial: string | null;
    bolsas: number;
  }[];
  fluxo: { in: number; out: number };
  alertas: Alerta[];
  comiteGestorAnual: string | null;
}

export interface ResumoCiclo {
  ciclo: Ciclo;
  aporteAnual: string;
  custoBolsasAnual: string;
  saldoPotencialAnual: string;
  redes: number;
  tematicas: number;
  ppgs: number;
  linhasPlano: number;
  pendenciasAbertas: number;
  premissas: number;
  coordenadores: number;
  divergencias: number;
  tematicasSemOrcamento: number;
}

export interface LinhaPlano {
  id: string;
  codigo: string;
  rubrica: Rubrica;
  status: "PROGRAMADO" | "PENDENTE" | "CANCELADO";
  areaTematicaId: string | null;
  tematica: string | null;
  tematicaNome: string | null;
  redeId: string | null;
  rede: string | null;
  ppgId: string;
  ppg: string;
  ppgSigla: string;
  coordenadorTematica: string | null;
  descricao: string | null;
  destino: Destino | null;
  modalidadeId: string | null;
  modalidade: string | null;
  vigenciaMeses: string | null;
  quantidadeAnual: number;
  mesImplementacao: string | null;
  fluxo: Fluxo | null;
  tipoDespesa: string | null;
  tipoMissao: string | null;
  numeroParticipantes: number | null;
  numeroDiarias: number | null;
  incluiPassagem: boolean | null;
  itemCatalogoCodigo: string | null;
  valorUnitario: string | null;
  origemValor: OrigemValor;
  justificativaEstimativa: string | null;
  custoAnual: string | null;
  custoCiclo: string | null;
  quantidadeCiclo: number;
  textoFonte: string | null;
  validacaoPendencia: string | null;
  porAno: { ano: number; quantidade: number }[];
}

export interface ItemCatalogo {
  id: string;
  codigo: string;
  destino: Destino;
  modalidadeId: string;
  modalidade: string;
  vigenciaMeses: string;
  valorUsd: string | null;
  valorBrl: string;
  fonte: string | null;
  observacao: string | null;
}

export interface TabelaVigente {
  id: string;
  versao: string;
  dataBase: string;
  cotacaoDolar: string;
  referenciaNormativa: string | null;
  vigenteDe: string;
  vigenteAte: string | null;
  observacoes: string | null;
  itens: ItemCatalogo[];
}

export interface RegistroAuditoriaPlano {
  id: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  usuarioNome: string | null;
  justificativa: string | null;
  ocorridoEm: string;
}

export interface Modalidade {
  id: string;
  nome: string;
  publicoAlvo: string;
  permiteBrasil: boolean;
  permiteExterior: boolean;
  ativa: boolean;
  itens: number;
}

export interface LinhaPpg {
  id: string;
  nome: string;
  sigla: string;
  unidade: string | null;
  nivel: string | null;
  modalidade: string | null;
  notaCapes: number | null;
  areaCapes: string | null;
  situacao: string;
  emRede: boolean;
  redeAcademica: string | null;
  coordenador: string | null;
  bolsasAno: number;
  custoAno: string;
  tematicas: string[];
  redes: string[];
}

export interface PpgDetalhe {
  id: string;
  nome: string;
  sigla: string;
  unidade: string | null;
  nivel: string | null;
  modalidade: string | null;
  notaCapes: number | null;
  areaCapes: string | null;
  situacao: string;
  emRede: boolean;
  redeAcademica: string | null;
  observacoes: string | null;
  linhasPesquisa: { id: string; nome: string; ativa: boolean }[];
  participacoes: {
    id: string;
    situacao: string;
    modalidadesPrevistas: string | null;
    tematicaCodigo: string;
    tematicaNome: string;
    rede: string;
    programa: string;
    programaSlug: string;
    ciclo: string;
  }[];
  plano: {
    codigo: string;
    rubrica: string;
    status: string;
    modalidade: string | null;
    destino: string | null;
    vigenciaMeses: string | null;
    quantidadeAnual: number;
    valorUnitario: string | null;
    custoAnual: string | null;
    tematica: string | null;
  }[];
  alertaTematicaDuplicada: string | null;
}

export interface Pendencia {
  id: string;
  codigo: string;
  escopoTipo: string;
  escopoDescricao: string | null;
  assunto: string;
  descricao: string;
  impacto: string | null;
  nivelImpacto: string | null;
  responsavelSugerido: string | null;
  prazoMomento: string | null;
  status: "PENDENTE" | "EM_ANALISE" | "MONITORAR" | "RESOLVIDA";
  origem: "MANUAL" | "AUTOMATICA";
  resolucao: string | null;
  resolvidaEm: string | null;
}

export interface Premissa {
  id: string;
  item: string;
  valor: string;
  unidade: string | null;
  natureza: string | null;
  fonte: string | null;
  dataBase: string | null;
  responsavel: string | null;
  observacoes: string | null;
}

export interface FonteDocumental {
  id: string;
  nome: string;
  conteudoUtilizado: string | null;
  escopo: string | null;
  status: string;
  arquivoOrigem: string | null;
  dataRecebimento: string | null;
  referenciaNormativa: string | null;
  observacoes: string | null;
}

export interface ComiteGestor {
  anos: number[];
  porRede: {
    rede: string | null;
    total: string;
    porAno: { ano: number; valor: string | null }[];
  }[];
  totalAnual: string;
  totalCiclo: string;
  aviso: string;
}

export interface DetalheTematica extends LinhaTematica {
  coordenadores: CoordenadorTematica[];
  porAno: LinhaTematica[];
  participacoes: {
    ppgId: string;
    ppg: string;
    sigla: string;
    notaCapes: number | null;
    emRede: boolean;
    situacao: string;
    modalidadesPrevistas: string | null;
    custoAnual: string;
  }[];
  custoTotal: string;
  plano: LinhaPlano[];
}
