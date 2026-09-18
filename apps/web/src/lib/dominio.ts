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
  /** Ações concedidas a esta conta. Vazio é o normal de quem acabou de entrar. */
  permissions: string[];
  /** Cadastro local ligado ao `sub`; nulo quando o vínculo não pôde ser feito. */
  pessoaId: string | null;
  /**
   * `true` quando o login funcionou mas a conta não pôde ser ligada a uma
   * pessoa. É diferente de "sem acesso": aqui nem há a quem conceder.
   */
  vinculoPendente: boolean;
}

/** Uma ação concedida, com o alcance já descrito pela API. */
export interface AcaoDoMeuAcesso {
  permissao: string;
  rotulo: string;
  /** Onde a ação vale, em linguagem institucional. Vazio não acontece. */
  alcance: string[];
}

export interface MeuAcesso {
  acoes: AcaoDoMeuAcesso[];
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
  podeEditar?: boolean;
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
  /** RN-07 na rede; nula enquanto a rede não compôs o exercício. */
  utilizacao: number | null;
  tematicas: number;
  ppgs: number;
}

export interface Indicador {
  chave: string;
  rotulo: string;
  valor: string | number | null;
  formato: "moeda" | "inteiro" | "texto" | "percentual";
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
  /** Exercícios do ciclo que já têm bolsa programada. */
  anosCompostos: number[];
  composicao: LinhaComposicao[];
  coordenacao: CoordenacaoRede[];
  comiteGestorAnual: string | null;
}

export interface LinhaComposicao {
  redeId: string;
  rede: string;
  codigo: string;
  tematica: string;
  anos: { ano: number; status: StatusComposicaoAnual; bolsas: number }[];
}

export interface CoordenacaoRede {
  redeId: string;
  rede: string;
  tematicas: { codigo: string; nome: string; coordenadores: string[] }[];
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
  ppgId: string;
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

/** Instituição no seletor da concessão (BOL-010). */
/** P02 · panorama de mobilidade (BOL-040). */
export interface LinhaContagemMobilidade {
  chave: string;
  rotulo: string;
  quantidade: number;
  entrada: number;
  saida: number;
  valor: string;
}

export interface LinhaAnoMobilidade {
  ano: number;
  entrada: number;
  saida: number;
  total: number;
  valor: string;
}

/** Consolidado por rede, com alcance e resultado (BOL-043). */
export interface LinhaRedeMobilidade extends LinhaContagemMobilidade {
  paises: number;
  instituicoes: number;
  ppgs: number;
  produtos: number;
}

/** País de destino, com o código ISO numérico que o mapa usa (BOL-042). */
export interface LinhaPaisMobilidade extends LinhaContagemMobilidade {
  codigoNumerico: string | null;
  codigoIso2: string | null;
}

/** Produção consolidada dos dois domínios, que seguem separados (BOL-051). */
export interface LinhaProducao {
  id: string;
  origem: "BOLSA" | "MISSAO";
  tipo: string;
  titulo: string;
  situacao: string;
  ano: number | null;
  contexto: string;
  referencia: string | null;
  /** Só o produto de bolsa registra com quem foi feito. */
  instituicaoColaboracao: string | null;
  paisColaboracao: string | null;
}

export interface PanoramaMobilidade {
  totais: {
    mobilidades: number;
    entrada: number;
    saida: number;
    paises: number;
    ppgs: number;
    instituicoes: number;
    valor: string;
    semInstituicaoCadastrada: number;
  };
  porAno: LinhaAnoMobilidade[];
  porModalidade: LinhaContagemMobilidade[];
  porNivel: LinhaContagemMobilidade[];
  porRede: LinhaRedeMobilidade[];
  porPais: LinhaPaisMobilidade[];
  porInstituicao: LinhaContagemMobilidade[];
  porPpg: LinhaContagemMobilidade[];
  /** Avisos que viajam junto com o número — nunca ficam só na API. */
  avisos: string[];
}

export interface InstituicaoOpcao {
  id: string;
  nome: string;
  sigla: string | null;
  cidade: string | null;
  pais: string | null;
}

/** Listas de apoio do formulário de concessão (BOL-010). */
export interface ReferenciasBolsa {
  paises: { id: string; nome: string; codigoIso2: string }[];
  instituicoes: InstituicaoOpcao[];
  /** Linhas ativas de todos os PPGs; a tela filtra pelo PPG selecionado. */
  linhasPesquisa: { id: string; nome: string; ppgId: string }[];
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
  telefone: string | null;
  lattes: string | null;
  orcid: string | null;
  areaTematica: string | null;
  areaTematicaCodigo: string | null;
  rede: string | null;
  linhaPesquisa: string | null;
  orientador: string | null;
  coordenadorPpg: string | null;
  modalidade: string;
  destino: Destino;
  paisOrigem: string | null;
  paisOrigemId: string | null;
  instituicaoOrigem: string | null;
  instituicaoOrigemId: string | null;
  paisDestino: string | null;
  paisDestinoId: string | null;
  instituicaoDestino: string | null;
  instituicaoDestinoId: string | null;
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
  instituicaoColaboracao: string | null;
  paisColaboracao: string | null;
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

/** Item da listagem: `usos` diz quantas linhas de plano custeiam por ele. */
export interface ItemCatalogoListado extends ItemCatalogo {
  usos: number;
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
  itens: ItemCatalogoListado[];
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
  publicoAlvo: "DOCENTE" | "DISCENTE" | "POS_DOC" | "AMBOS";
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

export interface ReferenciasPlano {
  ppgs: { id: string; nome: string; sigla: string }[];
  areas: {
    id: string;
    codigo: string;
    nome: string;
    rede: string;
    ppgIds: string[];
  }[];
  itens: string[];
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

/**
 * Execução orçamentária do Comitê Gestor por exercício (CG-055).
 *
 * Os quatro estados vêm separados de propósito. Somente `validado` abate o
 * aporte (CG-009); juntá-los numa coluna "executado" obrigaria a escolher entre
 * esconder o que ainda não vale e fazer parecer que já vale.
 */
/**
 * Checklist de encerramento da missão (CG-058).
 *
 * Nada disso é gravado: cada item é recalculado contra o registro que descreve.
 * Um booleano guardado divergiria no dia em que a prestação fosse devolvida, e
 * a missão encerraria com base numa foto velha.
 */
export interface ItemEncerramento {
  chave: string;
  titulo: string;
  descricao: string | null;
  /** Item não aplicável continua na lista, mas não bloqueia. */
  aplicavel: boolean;
  obrigatorio: boolean;
  atendido: boolean;
  dispensa: {
    justificativa: string;
    dispensadaEm: string;
    dispensadaPor: string | null;
  } | null;
  comoResolver: string | null;
}

export interface ChecklistEncerramento {
  podeEncerrar: boolean;
  /** Estado errado da missão — não há o que preencher para resolver. */
  impedimento: string | null;
  itens: ItemEncerramento[];
  pendencias: string[];
}

export interface ExecucaoExercicio {
  ano: number;
  orcamento: string | null;
  emPreenchimento: string | null;
  comPendencia: string | null;
  enviado: string | null;
  validado: string | null;
  /** `orcamento - validado`. Nada mais abate. */
  saldoOficial: string | null;
  naoValidado: string | null;
  missoes: number;
  prestacoesPendentes: number;
}

export interface ExecucaoComite {
  exercicios: ExecucaoExercicio[];
  /**
   * Consolidado do ciclo — **não** é a soma das colunas: missão que atravessa
   * dois exercícios aparece nas duas linhas e seria contada duas vezes.
   */
  total: Omit<ExecucaoExercicio, "ano">;
  aviso: string;
}

/**
 * Painel do Comitê Gestor (CG-066).
 *
 * Espelha `PainelComiteService`. Os indicadores não trazem link: a API não
 * conhece as rotas da interface, e é a página que sabe qual filtro de URL abre
 * a lista por trás de cada número.
 */
export interface PainelComite {
  recorte: {
    ano: number | null;
    redeId: string | null;
    redeNome: string | null;
  };
  /** Missões distintas no recorte; a multirrede conta uma vez (CG-016). */
  missoes: number;
  analise: {
    aguardando: number;
    /** Aguardando decisão há mais de uma reunião semanal do colegiado. */
    paradas: number;
    ajustesSolicitados: number;
    naoSubmetidas: number;
  };
  aprovacao: Record<StatusAprovacaoMissao, number>;
  realizacao: Record<SituacaoTemporalMissao, number>;
  prestacao: Record<SituacaoPrestacao, number>;
  conclusao: { concluidas: number; canceladas: number; aEncerrar: number };
  alcance: {
    paises: number;
    parceiros: number;
    /** Contados pelo nome informado na atividade; evento ainda não é cadastro. */
    eventos: number;
    convenios: number;
    produtos: number;
  };
  /** Despesa das missões do recorte (CG-067). Não é o orçamento — esse é a CG-055. */
  financeiro: {
    /** Única que abate o aporte (CG-009). */
    validada: string | null;
    lancada: string | null;
  };
  porPais: { id: string; nome: string; codigoIso2: string; missoes: number }[];
  porRede: ConsolidadoDaRede[];
  pendencias: PendenciaMissao[];
  aviso: string;
}

/**
 * Uma rede coordenadora com tudo o que o ciclo produziu nela (CG-067).
 *
 * **A soma destas linhas não é o consolidado**, e isso não é defeito: a missão
 * de duas redes pertence às duas. O total sai dos campos de topo do painel,
 * apurados sobre o recorte inteiro — cômputo diferente, não a mesma conta
 * agregada de outro jeito.
 */
export interface ConsolidadoDaRede {
  id: string;
  nome: string;
  missoes: number;
  paises: number;
  instituicoes: number;
  eventos: number;
  convenios: number;
  produtos: number;
  despesaValidada: string | null;
  despesaLancada: string | null;
}

/**
 * Relatórios estratégicos (CG-068).
 *
 * Os quatro homologados em 2026-09-07. Todos aceitam **o mesmo filtro da lista
 * de missões** e partem da mesma base — é o que faz o total do relatório
 * reproduzir a consulta de origem.
 */
export interface CabecalhoRelatorio {
  filtro: Record<string, unknown>;
  /** Missões distintas no recorte; a base de tudo o que vem abaixo. */
  missoes: number;
  geradoEm: string;
  aviso: string;
  truncado: boolean;
}

export interface RelatorioMissoes {
  cabecalho: CabecalhoRelatorio;
  linhas: {
    id: string;
    codigo: string;
    titulo: string;
    dataInicio: string;
    dataFim: string;
    status: StatusMissao;
    statusAprovacao: StatusAprovacaoMissao;
    situacaoPrestacao: SituacaoPrestacao;
    redes: string[];
    paises: string[];
    participantes: number;
    atividades: number;
    valorPrestado: string | null;
  }[];
  totais: {
    missoes: number;
    valorPrestado: string | null;
    porStatus: Record<string, number>;
    porAprovacao: Record<string, number>;
    porPrestacao: Record<string, number>;
  };
}

export interface RelatorioParceiros {
  cabecalho: CabecalhoRelatorio;
  linhas: {
    id: string;
    nome: string;
    sigla: string | null;
    pais: string | null;
    cidade: string | null;
    missoes: number;
    atividades: number;
    convenios: number;
    produtos: number;
  }[];
  totais: {
    parceiros: number;
    /** Paradas em instituição ainda não cadastrada — candidatas a cadastro. */
    semCadastro: number;
    convenios: number;
  };
}

export interface RelatorioFinancas {
  cabecalho: CabecalhoRelatorio;
  linhas: {
    exercicio: number;
    tipo: string;
    emPreenchimento: string | null;
    comPendencia: string | null;
    enviado: string | null;
    validado: string | null;
    total: string | null;
  }[];
  totais: {
    emPreenchimento: string | null;
    comPendencia: string | null;
    enviado: string | null;
    /** A única coluna que abate o aporte (CG-009). */
    validado: string | null;
    total: string | null;
  };
}

export interface RelatorioResultados {
  cabecalho: CabecalhoRelatorio;
  produtos: LinhaResultado[];
  convenios: LinhaResultado[];
  totais: {
    produtos: number;
    convenios: number;
    /** Declararam não ter gerado produto (CG-056). */
    semProdutoDeclarado: number;
    /** Nem produto nem declaração: ninguém respondeu ainda. */
    semResposta: number;
  };
}

export interface LinhaResultado {
  tipo: string;
  situacao: string;
  quantidade: number;
  missoes: number;
}

/**
 * Caixa de entrada (D-11).
 *
 * Não há entrega por e-mail enquanto não houver servidor institucional; esta é
 * a única via, e a tela diz isso.
 */
export type TipoNotificacao =
  | "MISSAO_SUBMETIDA"
  | "DECISAO_COMITE"
  | "ANALISE_REABERTA"
  | "PRESTACAO_DEVOLVIDA"
  | "PRESTACAO_VALIDADA"
  | "PRESTACAO_PENDENTE";

export interface NotificacaoResumo {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  /** Nulo quando o fato decorre do calendário, e não de uma ação. */
  origemPor: string | null;
  missaoId: string;
  missaoCodigo: string;
  criadoEm: string;
  lidaEm: string | null;
}

export interface CaixaDeEntrada {
  itens: NotificacaoResumo[];
  naoLidas: number;
  /** Caixa vazia por falta de vínculo é diferente de caixa vazia por falta de aviso. */
  vinculoPendente: boolean;
}

export type MotivoPendencia =
  | "ANALISE_PARADA"
  | "AJUSTES_SOLICITADOS"
  | "PRESTACAO_NAO_INICIADA"
  | "PRESTACAO_COM_PENDENCIA"
  | "PRESTACAO_ENVIADA"
  | "ENCERRAMENTO_PENDENTE";

/** Uma linha por missão, com todos os motivos juntos — nunca uma por motivo. */
export interface PendenciaMissao {
  missaoId: string;
  codigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  status: StatusMissao;
  statusAprovacao: StatusAprovacaoMissao;
  situacaoPrestacao: SituacaoPrestacao;
  redes: string[];
  motivos: {
    chave: MotivoPendencia;
    texto: string;
    responsavel: string;
    dias: number | null;
  }[];
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
  "RASCUNHO" | "PLANEJADA" | "CONFIRMADA" | "CONCLUIDA" | "CANCELADA";

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
  /**
   * Rodada de análise **em aberto** (CG-047). Nula fora da fila.
   *
   * É ela que define a fila, não o `statusAprovacao` sozinho: os dois andam
   * juntos hoje, mas quem responde "aguarda decisão desde quando" é a rodada.
   */
  rodadaAberta: {
    numero: number;
    submetidoEm: string;
    submetidoPor: string | null;
    diasEsperando: number;
  } | null;
}

/**
 * Dimensão de aprovação da missão (CG-019), independente do status de execução.
 *
 * São eixos distintos de propósito: a missão aprovada pode estar planejada,
 * confirmada ou concluída. A tela mostra os dois, nunca um só.
 */
export type StatusAprovacaoMissao =
  "RASCUNHO" | "EM_ANALISE" | "AJUSTES_SOLICITADOS" | "APROVADA" | "REPROVADA";

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

export type StatusAtividadeMissao = "PLANEJADA" | "REALIZADA" | "NAO_REALIZADA";

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
  /** Espelha `status_atividade_missao`; o relato é quem sai de PLANEJADA. */
  status: StatusAtividadeMissao;
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
  /** Alcance dos objetivos (CG-058). Nulo = ninguém respondeu ainda. */
  avaliacaoObjetivos: "SIM" | "PARCIALMENTE" | "NAO" | null;
  avaliacaoJustificativa: string | null;
  desdobramentos: string | null;
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

/** Uma decisão do Comitê sobre uma rodada (CG-038). */
export interface DecisaoComite {
  id: string;
  acao: "APROVAR" | "SOLICITAR_AJUSTES" | "REPROVAR";
  parecer: string;
  /** Data da reunião que deliberou; nula em `SOLICITAR_AJUSTES`. */
  reuniaoData: string | null;
  observacoes: string | null;
  decididoPor: string | null;
  decididoEm: string;
  /** Fotografia do que existia no instante da decisão, com nome e versão. */
  documentosAnalisados: {
    anexoId: string;
    versao: number;
    nome: string;
    categoria: string;
  }[];
}

/**
 * Uma passagem da missão pela análise (CG-019).
 *
 * `decisao` é nula enquanto a rodada está aberta — é o que distingue "aguarda
 * o Comitê" de "já decidida", sem precisar de um campo de estado à parte.
 */
export interface RodadaAnalise {
  id: string;
  numero: number;
  origem: "SUBMISSAO" | "REABERTURA";
  /** Preenchida só na reabertura, onde é obrigatória. */
  justificativa: string | null;
  submetidoPor: string | null;
  submetidoEm: string;
  encerradaEm: string | null;
  decisao: DecisaoComite | null;
}

/** Checklist de submissão (CG-037), lido de `requisito_submissao`. */
export interface AvaliacaoSubmissao {
  podeSubmeter: boolean;
  requisitos: {
    categoria: string;
    obrigatorio: boolean;
    descricao: string | null;
    atendido: boolean;
  }[];
  pendencias: string[];
}

/** Documento anexado, como a API o devolve (CG-051). Sem `caminho`, e é o ponto. */
export interface AnexoResumo {
  id: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  hashSha256: string | null;
  categoria: string;
  /**
   * `PUBLICA` nunca existiu na API — o enum sempre foi `INTERNA | RESTRITA`, e
   * `PESSOAL` entrou na BOL-021. O valor errado estava aqui desde a CG-051 e
   * não quebrou nada porque nada comparava contra ele; comparar teria dado
   * sempre falso, em silêncio.
   */
  visibilidade: "INTERNA" | "RESTRITA" | "PESSOAL";
  entidadeTipo: string;
  entidadeId: string;
  versao: number;
  substituiId: string | null;
  ativo: boolean;
  enviadoPor: string | null;
  enviadoEm: string;
  legenda: string | null;
  dataEvidencia: string | null;
  localEvidencia: string | null;
  /** Crédito da evidência — quem produziu, não quem fez o upload (CG-057). */
  autoria: string | null;
  /**
   * Até quando guardar, em documento pessoal de bolsista (BOL-021).
   * Derivado do fim da concessão + 5 anos; ausente nos demais.
   */
  retencaoAte?: string | null;
}

export interface CotacaoPassagem {
  id: string;
  empresa: string;
  valor: string;
  obtidaEm: string | null;
  observacoes: string | null;
}

export interface DocumentoDaDespesa {
  id: string;
  nome: string;
  categoria: string;
  versao: number;
  enviadoEm: string;
  enviadoPor: string | null;
  /** Preenchido quando o documento pertence a uma cotação, não à despesa. */
  cotacaoId: string | null;
}

export interface DespesaMissao {
  id: string;
  tipo: string;
  participanteId: string | null;
  participante: string | null;
  exercicio: number;
  quantidade: string | null;
  valorUnitario: string | null;
  valorTotal: string;
  dataDocumento: string | null;
  descricao: string;
  observacoes: string | null;
  passagem: {
    empresa: string | null;
    origem: string | null;
    destino: string | null;
    numeroVoo: string | null;
    dataVoo: string | null;
    compradaEm: string | null;
    formaPagamento: string | null;
    cotacoes: CotacaoPassagem[];
  } | null;
  diaria: {
    dataInicio: string;
    dataFim: string;
    paisId: string | null;
    pais: string | null;
    cidade: string | null;
  } | null;
  /**
   * Documentos ativos da despesa e das cotações dela.
   *
   * Vem junto do detalhe, e não por uma chamada de `/anexos` por despesa: a
   * indicação de pendência precisa disso para toda linha de uma vez.
   */
  documentos: DocumentoDaDespesa[];
}

/** Total por chave — tipo, exercício ou pessoa. Sempre string decimal. */
export interface TotalPorChave {
  chave: string;
  rotulo: string;
  total: string;
}

/**
 * Prestação de contas da missão (CG-013/CG-050).
 *
 * A API devolve **`null`** quando a missão não tem prestação: ausência é
 * ausência de linha, não o estado `NAO_INICIADA`. `total` também é nulo quando
 * não há despesa — nunca R$ 0,00, que significaria outra coisa.
 */
export interface PrestacaoMissao {
  id: string;
  missaoId: string;
  status: SituacaoPrestacao;
  enviadaEm: string | null;
  enviadaPor: string | null;
  validadaEm: string | null;
  validadaPor: string | null;
  parecer: string | null;
  observacoes: string | null;
  despesas: DespesaMissao[];
  total: string | null;
  totalPorTipo: TotalPorChave[];
  totalPorExercicio: TotalPorChave[];
  totalPorPessoa: TotalPorChave[];
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
  areasAtuacao: string | null;
  programaRelacionado: string | null;
  grupoPesquisa: string | null;
  /** Como a instituição foi identificada. Imutável depois do cadastro. */
  origemRelacionamento: string | null;
  origemObservacao: string | null;
  /** Estágio declarado — julgamento humano, gravado. */
  estagioRelacionamento:
    "IDENTIFICADA" | "CONTATO_INICIADO" | "COOPERACAO_EM_AVALIACAO";
  /** Derivados na leitura, nunca gravados: são fatos verificáveis no banco. */
  mobilidadeRealizada: boolean;
  parceriaFormalizada: boolean;
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
 *
 * Vazio desde a CG-056; o campo permanece para o próximo módulo entrar sem
 * quebrar o contrato.
 */
export interface ModuloPendente {
  modulo: "PRODUTOS" | "CONVENIOS";
  task: string;
}

/** Acordo formal do parceiro (CG-056). */
export interface ConvenioDoHistorico {
  id: string;
  titulo: string;
  tipoAcordo: string;
  situacao: string;
  area: string | null;
  dataAssinatura: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  ativo: boolean;
  missaoOrigemId: string | null;
  missaoOrigemCodigo: string | null;
}

/** Produto de missão que envolve o parceiro (CG-056). */
export interface ProdutoDoHistorico {
  id: string;
  titulo: string;
  tipo: string;
  situacao: string;
  ano: number | null;
  missaoId: string;
  missaoCodigo: string;
}

export interface MobilidadeHistorico {
  id: string;
  bolsista: string;
  ppg: string;
  ppgSigla: string;
  modalidade: string;
  nivelBeneficiario: string;
  tematicaCodigo: string | null;
  tematica: string | null;
  rede: string | null;
  ponta: "DESTINO" | "ORIGEM";
  dataInicio: string;
  dataFim: string;
  status: string;
  ano: number;
}

export interface VinculoParceiro {
  rede: string | null;
  tematicaCodigo: string | null;
  tematica: string | null;
  ppgs: string[];
  mobilidades: number;
}

export interface HistoricoParceiro {
  mobilidades: MobilidadeHistorico[];
  vinculos: VinculoParceiro[];
  parceiro: Parceiro;
  contatos: ContatoParceiro[];
  missoes: MissaoDoHistorico[];
  eventos: EventoDoHistorico[];
  documentos: DocumentoDoHistorico[];
  convenios: ConvenioDoHistorico[];
  produtos: ProdutoDoHistorico[];
  modulosPendentes: ModuloPendente[];
}

/** Referência nomeada devolvida junto dos produtos (CG-056). */
export interface ReferenciaNomeada {
  id: string;
  nome: string;
}

export interface ConvenioResumo {
  id: string;
  instituicaoId: string;
  instituicao: string;
  titulo: string;
  tipoAcordo: string;
  area: string | null;
  situacao: string;
  numeroProcesso: string | null;
  dataAssinatura: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  ativo: boolean;
  missaoOrigemId: string | null;
  missaoOrigemCodigo: string | null;
  redes: ReferenciaNomeada[];
}

export interface ProdutoMissao {
  id: string;
  missaoId: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  situacao: string;
  ano: number | null;
  referencia: string | null;
  observacoes: string | null;
  convenio: ConvenioResumo | null;
  instituicoes: ReferenciaNomeada[];
  redes: ReferenciaNomeada[];
  responsaveis: (ReferenciaNomeada & { papel: string | null })[];
  quantidadeDocumentos: number;
}

/**
 * Resultados da missão (CG-056).
 *
 * `respostaProduto` distingue "não gerou produto" de "ninguém respondeu": as
 * duas coisas dão zero produto cadastrado, e o checklist de encerramento
 * precisa saber qual é qual.
 */
export interface ResultadosDaMissao {
  missaoId: string;
  codigo: string;
  respostaProduto: "SIM" | "NAO" | "NAO_INFORMADO";
  declaracaoSemProduto: {
    declaradoEm: string;
    declaradoPor: string;
    justificativa: string | null;
  } | null;
  produtos: ProdutoMissao[];
}

// ---------------------------------------------------------------------------
// Administração de acessos (V1-017/018)

export type TipoAlvoAcesso =
  "GLOBAL" | "CICLO" | "PPG" | "REDE" | "TEMATICA" | "PARTICIPACAO";

/**
 * Alcance de uma concessão, na forma em que a API o grava e devolve.
 *
 * É união discriminada pelo `tipo`, e não um objeto com todos os campos
 * opcionais: `PPG` exige o ciclo junto, e um tipo frouxo deixaria a tela montar
 * um alvo que a API recusa — ou, pior, um alvo que ela aceita com o ciclo
 * faltando.
 */
export type AlcanceConcessao =
  | { tipo: "GLOBAL" }
  | { tipo: "CICLO"; cicloId: string }
  | { tipo: "PPG"; ppgId: string; cicloId: string }
  | { tipo: "REDE"; redeId: string }
  | { tipo: "TEMATICA"; tematicaId: string }
  | { tipo: "PARTICIPACAO"; participacaoId: string };

export interface AcaoDoCatalogo {
  permissao: string;
  rotulo: string;
  escopos: TipoAlvoAcesso[];
}

export interface ModeloDeAcesso {
  id: string;
  rotulo: string;
  permissoes: string[];
}

export interface CatalogoDeAcesso {
  permissoes: AcaoDoCatalogo[];
  modelos: ModeloDeAcesso[];
}

export interface AlvosDeAcesso {
  ciclos: { id: string; nome: string; programa: string }[];
  ppgs: { id: string; nome: string; sigla: string | null }[];
  redes: { id: string; nome: string; cicloId: string; ciclo: string }[];
  tematicas: {
    id: string;
    codigo: string;
    nome: string;
    rede: string;
    cicloId: string;
  }[];
  participacoes: {
    id: string;
    ppg: string | null;
    ppgNome: string;
    tematica: string;
    rede: string;
    cicloId: string;
  }[];
}

export interface ContaDeAcesso {
  id: string;
  sub: string;
  username: string | null;
  email: string | null;
  origem: string;
  vinculadoEm: string;
  ultimoAcessoEm: string | null;
  ativo: boolean;
  pessoaId: string;
  pessoaNome: string;
}

export interface ConcessaoListada {
  id: string;
  permissao: string;
  escopo: AlcanceConcessao;
  origem: string | null;
  justificativa: string;
  concedidoPorId: string | null;
  concedidoEm: string;
  ativo: boolean;
  revogadoEm: string | null;
}

export interface ConcessoesDaConta {
  conta: {
    id: string;
    sub: string;
    email: string | null;
    username: string | null;
    ativo: boolean;
    pessoaId: string;
    pessoaNome: string;
  };
  concessoes: ConcessaoListada[];
}

/** O que um lote faria, item a item, antes de gravar. */
export interface PreviaDeConcessao {
  itens: {
    permissao: string;
    escopo: AlcanceConcessao;
    efeito: "CRIAR" | "REATIVAR" | "JA_ATIVA";
  }[];
}
