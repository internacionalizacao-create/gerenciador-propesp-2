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
  status: 'PROGRAMADO' | 'PENDENTE' | 'CANCELADO';
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
  nivelImpacto?: 'ALTA' | 'MEDIA' | 'BAIXA';
  resolucao?: string | null;
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

const dadosOriginais = planilhaCapesGlobal as unknown as DadosCapesGlobal;

/**
 * Correcoes confirmadas depois da extracao inicial.
 *
 * A planilha gerada continua preservada como fotografia da primeira fonte. As
 * respostas formais da equipe e o arquivo atualizado de 2027-2030 entram como
 * uma camada explicita, para que uma nova extracao nao apague decisoes de
 * negocio que nao estavam naquele arquivo.
 */
const tematicasAtualizadas: Record<string, Partial<TematicaBruta>> = {
  'UNESP-T3': {
    saldoInformado: '1457.39',
    observacoes:
      'A equipe validou o saldo calculado de R$ 1.457,39 e orientou desconsiderar o valor divergente do anexo.',
  },
  'UNESP-T1': {
    custoBolsasInformado: '261095.80',
    saldoInformado: '268.75',
    observacoes:
      'Composição atualizada confirmada pela equipe: custo de R$ 261.095,80 e saldo de R$ 268,75, conciliados sem divergência.',
  },
  'UFMG-T1': {
    valorManutencao: null,
    valorMissoes: null,
    custoBolsasInformado: '54697.00',
    saldoInformado: '34803.00',
    observacoes:
      'Programação original aprovada. A Capacitação adicional permanece pendente de aprovação; manutenção ainda sem valor informado.',
  },
  'UFMG-T2': {
    valorManutencao: null,
    valorMissoes: null,
    custoBolsasInformado: '58651.00',
    saldoInformado: '30849.00',
    observacoes:
      'Programação original aprovada. A Capacitação adicional permanece pendente de aprovação; manutenção ainda sem valor informado.',
  },
  'UFMG-T3': {
    valorManutencao: null,
    valorMissoes: null,
    custoBolsasInformado: '224982.60',
    saldoInformado: '43517.40',
    observacoes:
      'Programação original aprovada. A Capacitação adicional permanece pendente de aprovação; manutenção ainda sem valor informado.',
  },
  'UFMG-T4': {
    valorManutencao: null,
    valorMissoes: null,
    custoBolsasInformado: '58651.00',
    saldoInformado: '30849.00',
    observacoes:
      'Programação original aprovada. A Capacitação adicional permanece pendente de aprovação; manutenção ainda sem valor informado.',
  },
  'UNICAMP-T1': {
    statusOrcamento: 'DEFINIDO',
    valorBolsas: '538291.22',
    valorManutencao: null,
    valorMissoes: null,
    nome: 'Saúde, Natureza e Sociedade',
    observacoes:
      'Orçamento de bolsas aprovado. PPGs são apenas elegíveis; modalidades, distribuição, beneficiários e manutenção ainda estão a definir.',
  },
  'UNICAMP-T2': {
    statusOrcamento: 'DEFINIDO',
    valorBolsas: '270894.75',
    valorManutencao: null,
    valorMissoes: null,
    nome: 'Educação, Saberes e Culturas',
    observacoes:
      'Orçamento de bolsas aprovado. PPGs são apenas elegíveis; modalidades, distribuição, beneficiários e manutenção ainda estão a definir.',
  },
  'UNICAMP-T3': {
    statusOrcamento: 'DEFINIDO',
    valorBolsas: '96835.65',
    valorManutencao: null,
    valorMissoes: null,
    nome: 'Biodiversidade e Transformação Territorial Sustentável',
    observacoes:
      'Orçamento de bolsas aprovado. PPGs são apenas elegíveis; modalidades, distribuição, beneficiários e manutenção ainda estão a definir.',
  },
  'UNICAMP-T4': {
    statusOrcamento: 'DEFINIDO',
    valorBolsas: '159067.37',
    valorManutencao: null,
    valorMissoes: null,
    nome: 'Direitos Humanos, Justiça Social e Equidade',
    observacoes:
      'Orçamento de bolsas aprovado. PPGs são apenas elegíveis; modalidades, distribuição, beneficiários e manutenção ainda estão a definir.',
  },
};

const planoAtualizado: Record<string, Partial<ItemPlanoBruto>> = {
  'BOL-006': {
    textoFonte: '1 bolsa de Doutorado Sanduíche de 6 meses (REAMEC).',
    validacao: 'Conforme composição atualizada confirmada pela equipe.',
  },
  'BOL-007': {
    status: 'CANCELADO',
    validacao:
      'Linha substituída pela composição atualizada da UNESP-T1; preservada apenas como histórico.',
  },
  'BOL-008': {
    vigenciaMeses: '5.0',
    valorUnitario: '71896.90',
    textoFonte:
      '1 bolsa de Doutorado Sanduíche de 5 meses (PPGEEC), no valor de R$ 71.896,90.',
    validacao:
      'Vigência de 5 meses confirmada pela equipe na composição atualizada.',
  },
  'BOL-009': {
    vigenciaMeses: '0.5',
    valorUnitario: '22669.60',
    textoFonte:
      '1 bolsa de Capacitação de 15 dias (PPGEEC), no valor de R$ 22.669,60.',
    validacao: 'Conforme composição atualizada confirmada pela equipe.',
  },
  'BOL-010': {
    quantidadeAnual: 3,
    vigenciaMeses: '1.0',
    valorUnitario: '27875.70',
    textoFonte:
      '3 bolsas de Capacitação de 1 mês (PPGICH), totalizando R$ 83.627,10.',
    validacao: 'Conforme composição atualizada confirmada pela equipe.',
  },
};

const pendenciasAtualizadas: Record<string, Partial<PendenciaBruta>> = {
  'PEN-011': {
    escopoRede: 'GERAL',
    escopoTema: 'Todas',
    assunto: 'Fluxo financeiro institucional',
    descricao:
      'Confirmar se os recursos do CAPES Global entram no caixa da UEA ou são pagos diretamente pela CAPES.',
    impacto:
      'Define se o Gerenciador precisa acompanhar execução financeira interna.',
    nivelImpacto: 'ALTA',
    responsavel: 'PROPESP / Rede coordenadora',
    prazo: null,
  },
  'PEN-012': {
    escopoRede: 'GERAL',
    escopoTema: 'Todas',
    assunto: 'Critério IN/OUT',
    descricao:
      'Validar institucionalmente IN como entrada no Brasil e OUT como destino no exterior.',
    impacto: 'Define a classificação dos indicadores de mobilidade.',
    nivelImpacto: 'MEDIA',
    responsavel: 'Comissão de Internacionalização',
    prazo: null,
  },
  'PEN-013': {
    escopoRede: 'UNICAMP',
    escopoTema: 'Todas',
    assunto: 'Composição de bolsas da UNICAMP',
    descricao:
      'Os orçamentos anuais por temática estão definidos, mas modalidades, quantidades, vigências, implementação e distribuição das bolsas ainda não foram definidas.',
    impacto:
      'Impede calcular bolsas, beneficiários e custo da composição da UNICAMP.',
    nivelImpacto: 'ALTA',
    responsavel: 'Comitê UNICAMP',
    prazo: 'Após a definição das bolsas',
    status: 'Pendente',
  },
};

const pendenciasResolvidas: Record<string, string> = {
  'PEND-001':
    'A equipe validou o cálculo de R$ 1.457,39 para a UNESP-T3 e orientou desconsiderar o valor divergente do anexo.',
  'PEND-002':
    'A composição atualizada confirma vigência de 5 meses para a BOL-008.',
  'PEND-003':
    'A composição atualizada totaliza R$ 261.095,80 e deixa saldo de R$ 268,75 na UNESP-T1, sem divergência.',
  'PEND-004':
    'A nova planilha definiu o orçamento de bolsas da UNICAMP por temática; a manutenção sem valor permanece tratada separadamente.',
  'PEND-006':
    'A equipe confirmou que o PROFSAÚDE pertence apenas à UNICAMP-T1 — Saúde, Natureza e Sociedade.',
  'PEND-008':
    'O remanejamento ocorre somente dentro da mesma temática e o Gerenciador apenas o registra após ocorrer na CAPES.',
  'PEN-011':
    'Todos os recursos são pagos diretamente pela CAPES; não há entrada em caixa nem execução financeira na UEA.',
  'PEN-012':
    'IN significa entrada no Brasil e OUT significa destino no exterior.',
};

export const dadosCapesGlobal: DadosCapesGlobal = {
  ...dadosOriginais,
  _origem: `${dadosOriginais._origem}; Planejamento_CAPES_Global_2027_2030_Atualizado_UNICAMP_UFMG.xlsx; respostas da equipe técnica`,
  tematicas: dadosOriginais.tematicas.map((tematica) => ({
    ...tematica,
    ...tematicasAtualizadas[tematica.codigo],
  })),
  ppgs: dadosOriginais.ppgs.map((ppg) =>
    ppg.sigla === 'PROFSAÚDE'
      ? {
          ...ppg,
          temaId: 'UNICAMP-T1',
          observacoes:
            'Elegível apenas em Saúde, Natureza e Sociedade; beneficiário será definido pelo resultado final do edital.',
        }
      : ppg.rede === 'UNICAMP'
        ? {
            ...ppg,
            situacao: 'CADASTRO_PRELIMINAR',
            modalidadesPrevistas: 'A definir',
            observacoes:
              'PPG elegível; participação efetiva e beneficiário dependem do resultado final do edital.',
          }
        : ppg,
  ),
  plano: dadosOriginais.plano
    // As dez linhas da UNICAMP eram reservas artificiais. A nova planilha
    // informa elegibilidade, nao uma concessao nem uma composicao aprovada.
    .filter((item) => item.rede !== 'UNICAMP')
    .map((item) => {
      const atualizado = { ...item, ...planoAtualizado[item.codigo] };
      return ['BOL-020', 'BOL-021', 'BOL-022', 'BOL-023'].includes(
        atualizado.codigo,
      )
        ? {
            ...atualizado,
            status: 'PENDENTE' as const,
            mesImplementacao: 'SETEMBRO',
            validacao:
              'Proposta para setembro de 2027; ainda não aprovada formalmente.',
          }
        : atualizado;
    }),
  pendencias: dadosOriginais.pendencias.map((pendenciaOriginal) => {
    const pendencia = {
      ...pendenciaOriginal,
      ...pendenciasAtualizadas[pendenciaOriginal.codigo],
    };
    const resolucao = pendenciasResolvidas[pendencia.codigo];
    if (!resolucao) return pendencia;
    return {
      ...pendencia,
      status: 'Resolvida',
      resolucao,
    };
  }),
  premissas: dadosOriginais.premissas.map((premissa) => {
    if (premissa.item === 'Tratamento da UNICAMP') {
      return {
        ...premissa,
        valor: 'Orçamento de bolsas definido; composição a definir',
        fonte: 'Planejamento CAPES Global 2027-2030 atualizado',
        dataBase: '2026-08-18',
        observacoes:
          'Teto por temática aprovado; PPGs são elegíveis e modalidades, quantidades, vigências, implementação e beneficiários ainda serão definidos.',
      };
    }

    if (premissa.item === 'Tratamento das sobras') {
      return {
        ...premissa,
        valor: 'Saldo potencial e movimentação externa',
        fonte: 'Respostas da equipe técnica',
        dataBase: '2026-08-18',
        observacoes:
          'O saldo é calculado para apoiar a realocação. Movimentações ocorrem na CAPES, somente dentro da mesma temática, e o Gerenciador apenas registra o histórico.',
      };
    }

    return premissa;
  }),
};

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
  {
    nome: 'Guia de Orientações para Remanejamento e Transformação',
    conteudoUtilizado:
      'Regras e fluxo externo de remanejamento e transformação no CAPES Global',
    escopo: 'Movimentações externas e governança do planejamento',
    status: 'INCORPORADO',
    arquivoOrigem:
      'dados/remanejamento/Guia_Orientacoes_Remanejamento_Transformacao_CAPES_Global final (1).pdf',
    dataRecebimento: '2026-08-18',
    referenciaNormativa: 'Guia de Orientações CAPES Global',
    observacoes:
      'No Gerenciador, a movimentação é apenas registrada após ocorrer na CAPES e deve permanecer dentro da mesma temática.',
  },
  {
    nome: 'Planejamento CAPES Global 2027–2030 atualizado',
    conteudoUtilizado:
      'Orçamentos da UNICAMP, PPGs elegíveis e atualizações de UFMG/UNESP',
    escopo: 'Redes UNICAMP, UFMG e UNESP',
    status: 'INCORPORADO',
    arquivoOrigem:
      'dados/levamtamento de bolsas/Planejamento_CAPES_Global_2027_2030_Atualizado_UNICAMP_UFMG.xlsx',
    dataRecebimento: '2026-08-18',
    referenciaNormativa: 'Planilha atualizada encaminhada pela equipe',
    observacoes:
      'Orçamento da UNICAMP aprovado; composição anual, beneficiários e manutenção ainda pendentes.',
  },
];

/**
 * Programas de mobilidade preservados como referencias futuras. Permanecem
 * inativos ate que a equipe decida ampliar o escopo alem do CAPES Global.
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
