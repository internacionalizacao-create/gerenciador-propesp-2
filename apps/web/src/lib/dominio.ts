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
export type StatusComposicaoAnual = "A_DEFINIR" | "EM_ELABORACAO" | "APROVADA";
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
  orcamentoId: string;
  areaTematicaId: string;
  codigo: string;
  nome: string;
  redeId: string;
  rede: string;
  ano: number;
  statusOrcamento: StatusOrcamento;
  statusComposicao: StatusComposicaoAnual;
  valorBolsas: string | null;
  valorManutencao: string | null;
  valorMissoes: string | null;
  fonte: string | null;
  observacoes: string | null;
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
  statusComposicao: StatusComposicaoAnual;
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
  anoPlanejamento: number | null;
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

export type StatusBolsaConcedida =
  "SELECIONADO" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA" | "INTERROMPIDA";

export type SituacaoTemporalBolsa =
  | "PROGRAMADA"
  | "PROXIMA"
  | "EM_VIGENCIA"
  | "PRESTES_A_EXPIRAR"
  | "EXPIRADA"
  | "CONCLUIDA"
  | "CANCELADA"
  | "INTERROMPIDA";

export interface OpcaoBolsaPlanejada {
  id: string;
  codigo: string;
  programa: string;
  programaSlug: string;
  ciclo: string;
  ppg: string;
  ppgSigla: string;
  modalidade: string;
  destino: Destino;
  vigenciaMeses: string;
  valorUnitario: string;
  mesImplementacao: string | null;
  porAno: {
    ano: number;
    planejadas: number;
    concedidas: number;
    vagasDisponiveis: number;
  }[];
}

export interface BolsaConcedidaResumo {
  id: string;
  itemPlanejadoId: string | null;
  codigoPlanejamento: string | null;
  programa: string;
  programaSlug: string;
  ciclo: string;
  ppgId: string;
  ppg: string;
  ppgSigla: string;
  pessoaId: string;
  bolsista: string;
  email: string | null;
  cpf: string | null;
  modalidade: string;
  destino: Destino;
  paisOrigem: string | null;
  instituicaoOrigem: string | null;
  paisDestino: string | null;
  instituicaoDestino: string | null;
  nivelBeneficiario:
    "MESTRADO" | "DOUTORADO" | "POS_DOC" | "DOCENTE" | "MOBILIDADE_BREVE";
  dataInicio: string;
  dataFim: string;
  vigenciaMeses: string;
  valorConcedido: string;
  fluxo: Fluxo;
  status: StatusBolsaConcedida;
  situacaoTemporal: SituacaoTemporalBolsa;
  processo: string | null;
  observacoes: string | null;
  produtos: number;
  produtosPendentes: number;
}

export type TipoProdutoBolsa =
  | "ARTIGO"
  | "TRABALHO"
  | "PROJETO"
  | "RELATORIO"
  | "PUBLICACAO"
  | "LIVRO"
  | "CAPITULO_LIVRO"
  | "PATENTE"
  | "EVENTO"
  | "OUTRO";

export type StatusProdutoBolsa =
  "PREVISTO" | "EM_DESENVOLVIMENTO" | "ENTREGUE" | "VALIDADO" | "CANCELADO";

export interface ProdutoBolsa {
  id: string;
  bolsaConcedidaId: string;
  tipo: TipoProdutoBolsa;
  titulo: string;
  descricao: string | null;
  prazoEntrega: string;
  status: StatusProdutoBolsa;
  situacao: StatusProdutoBolsa | "ATRASADO";
  dataEntrega: string | null;
  doi: string | null;
  link: string | null;
  observacoes: string | null;
}

export interface BolsaConcedidaDetalhe extends Omit<
  BolsaConcedidaResumo,
  "produtos"
> {
  produtos: ProdutoBolsa[];
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

export interface PessoaDisponivel {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  tipo: string;
  ppg: string | null;
  instituicao: string | null;
}

export interface MembroEquipeGestao {
  id: string;
  pessoaId: string;
  nome: string;
  email: string | null;
  tipoPessoa: string;
  ppg: string | null;
  instituicao: string | null;
  tipoEquipe: "COMITE_GESTOR" | "ADMINISTRACAO";
  funcao: string;
  dataInicio: string;
  dataFim: string | null;
  situacao: "ATIVO" | "FUTURO" | "ENCERRADO";
  observacoes: string | null;
  redes: string[];
  /** Missões do ciclo de que a pessoa participou, contadas por pessoa. */
  missoes: number;
}

export type StatusMissao =
  | "RASCUNHO"
  | "PLANEJADA"
  | "CONFIRMADA"
  | "CONCLUIDA"
  | "CANCELADA";

export type SituacaoTemporalMissao = "FUTURA" | "EM_ANDAMENTO" | "ENCERRADA";

export type SituacaoPrestacao =
  | "NAO_INICIADA"
  | "EM_PREENCHIMENTO"
  | "ENVIADA"
  | "COM_PENDENCIA"
  | "VALIDADA";

export interface MissaoResumo {
  id: string;
  codigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  status: StatusMissao;
  statusAprovacao: StatusAprovacaoMissao;
  situacaoTemporal: SituacaoTemporalMissao;
  situacaoPrestacao: SituacaoPrestacao;
  participantes: number;
  atividades: number;
  paises: string[];
  /** Vazio só em missão anterior à CG-016; a lista mostra "Sem rede definida". */
  redes: string[];
  /** Nulo quando não há prestação; a interface nunca apresenta R$ 0,00. */
  valorPrestado: string | null;
}

/**
 * Dimensão de aprovação da missão (CG-019), independente do status de execução.
 *
 * São eixos distintos de propósito: a missão aprovada pode estar planejada,
 * confirmada ou concluída. A tela mostra os dois, nunca um só.
 */
export type StatusAprovacaoMissao =
  | "RASCUNHO"
  | "EM_ANALISE"
  | "AJUSTES_SOLICITADOS"
  | "APROVADA"
  | "REPROVADA";

export interface ParticipanteMissao {
  id: string;
  pessoaId: string;
  nome: string;
  email: string | null;
  tipoPessoa: string;
  ppg: string | null;
  instituicao: string | null;
  papel: "RESPONSAVEL" | "PARTICIPANTE" | "APOIO";
  membroEquipeId: string | null;
  tipoEquipe: "COMITE_GESTOR" | "ADMINISTRACAO" | null;
  funcaoEquipe: string | null;
  cargo: string | null;
  area: string | null;
  dataInicio: string;
  dataFim: string;
  numeroDias: number;
  observacoes: string | null;
}

export interface AtividadeMissao {
  id: string;
  ordem: number;
  tipo: string;
  titulo: string;
  paisId: string;
  pais: string;
  cidade: string | null;
  estadoRegiao: string | null;
  local: string | null;
  endereco: string | null;
  instituicaoId: string | null;
  instituicao: string | null;
  instituicaoDoCatalogo: boolean;
  contatoInstituicaoId: string | null;
  contatoInstituicao: string | null;
  tipoRelacionamento: string | null;
  objetivoRelacionamento: string | null;
  eventoNome: string | null;
  eventoTipo: string | null;
  eventoSite: string | null;
  objetivoParticipacao: string | null;
  relacaoInternacionalizacao: string | null;
  dataInicio: string;
  dataFim: string;
  numeroDias: number;
  planejamento: string | null;
  relatoRealizado: string | null;
  resultados: string | null;
  status: string;
  /** Aconteceu sem constar do roteiro planejado. */
  naoPrevista: boolean;
  justificativaInclusao: string | null;
  observacoes: string | null;
}

export interface RegistroHistoricoMissao {
  id: string;
  acao: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  justificativa: string | null;
  usuarioNome: string | null;
  ocorridoEm: string;
}

export interface TotaisMissao {
  passagens: string | null;
  diarias: string | null;
  geral: string | null;
  porExercicio: { ano: number; passagens: string; diarias: string }[];
}

export interface MissaoDetalhe {
  id: string;
  codigo: string;
  tipo: string | null;
  unidadeDepartamento: string | null;
  titulo: string;
  objetivo: string;
  dataInicio: string;
  dataFim: string;
  numeroDias: number;
  status: StatusMissao;
  statusAprovacao: StatusAprovacaoMissao;
  situacaoTemporal: SituacaoTemporalMissao;
  relatoGeral: string | null;
  resultados: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  participantes: ParticipanteMissao[];
  atividades: AtividadeMissao[];
  paises: string[];
  redes: { id: string; nome: string }[];
  prestacao: null;
  situacaoPrestacao: SituacaoPrestacao;
  totais: TotaisMissao;
  documentos: never[];
  historico: RegistroHistoricoMissao[];
}

export interface ResumoMissoes {
  total: number;
  porStatus: Record<StatusMissao, number>;
  porSituacaoTemporal: Record<SituacaoTemporalMissao, number>;
  realizadas: number;
  canceladas: number;
}

export interface PaginaMissoes {
  itens: MissaoResumo[];
  total: number;
  pagina: number;
  tamanho: number;
  paginas: number;
  resumo: ResumoMissoes;
}

export interface ReferenciasMissao {
  paises: {
    id: string;
    nome: string;
    codigoIso2: string;
  }[];
  instituicoes: {
    id: string;
    nome: string;
    sigla: string | null;
    paisId: string | null;
    cidade: string | null;
  }[];
  /** Redes coordenadoras do ciclo; a missão pertence a uma ou mais (CG-016). */
  redes: { id: string; nome: string }[];
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

/* Parceiros institucionais e contatos (CG-025 a CG-027). */

export interface RedeDoParceiro {
  id: string;
  nome: string;
}

export interface Parceiro {
  id: string;
  nome: string;
  sigla: string | null;
  paisId: string | null;
  pais: string | null;
  codigoPais: string | null;
  cidade: string | null;
  estadoRegiao: string | null;
  tipoOrganizacao: string | null;
  faculdadeDepartamento: string | null;
  site: string | null;
  emailInstitucional: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  /** Cadastro aberto durante uma missão, ainda sem conferência institucional. */
  cadastroProvisorio: boolean;
  ativo: boolean;
  /** Preenchido quando o cadastro foi conciliado em outro (CG-025). */
  substituidaPorId: string | null;
  redes: RedeDoParceiro[];
  quantidadeContatos: number;
  quantidadeMissoes: number;
}

export interface ContatoParceiro {
  id: string;
  instituicaoId: string;
  instituicao: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  area: string | null;
  email: string | null;
  telefone: string | null;
  paisId: string | null;
  pais: string | null;
  idiomaComunicacao: string | null;
  principal: boolean;
  observacoes: string | null;
  ativo: boolean;
}

export interface AtividadeDoHistorico {
  id: string;
  ordem: number;
  titulo: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  cidade: string | null;
  estadoRegiao: string | null;
  local: string | null;
  pais: string | null;
  tipoRelacionamento: string | null;
  objetivoRelacionamento: string | null;
  contatoId: string | null;
  contatoNome: string | null;
  status: string;
}

export interface MissaoDoHistorico {
  id: string;
  codigo: string;
  titulo: string;
  tipo: string | null;
  dataInicio: string;
  dataFim: string;
  status: StatusMissao;
  cicloId: string;
  ciclo: string;
  programaSlug: string;
  redes: RedeDoParceiro[];
  atividades: AtividadeDoHistorico[];
}

export interface EventoDoHistorico {
  atividadeId: string;
  missaoId: string;
  missaoCodigo: string;
  nome: string;
  tipo: string | null;
  site: string | null;
  dataInicio: string;
  dataFim: string;
  objetivoParticipacao: string | null;
  relacaoInternacionalizacao: string | null;
}

export interface DocumentoDoHistorico {
  id: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  enviadoPor: string | null;
  enviadoEm: string;
}

/**
 * Módulo previsto pelo escopo cujo modelo ainda não existe. Vem nomeado da API
 * em vez de zerado: total zero afirmaria que nada aconteceu (CG-027).
 */
export interface ModuloPendente {
  modulo: "PRODUTOS" | "CONVENIOS";
  task: string;
}

export interface HistoricoParceiro {
  parceiro: Parceiro;
  contatos: ContatoParceiro[];
  missoes: MissaoDoHistorico[];
  eventos: EventoDoHistorico[];
  documentos: DocumentoDoHistorico[];
  modulosPendentes: ModuloPendente[];
}
