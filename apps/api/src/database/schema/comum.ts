import { sql } from 'drizzle-orm';
import { numeric, pgEnum, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Peças reutilizadas por todas as tabelas do schema.
 *
 * Ver `system-structl.md` §4 para o modelo completo e a justificativa de cada
 * entidade. Este arquivo cuida só do que se repete.
 */

/** Chave primária padrão: UUID gerado pelo banco. */
export const id = () => uuid('id').primaryKey().defaultRandom();

/**
 * Dinheiro em `numeric(14,2)`.
 *
 * Nunca `double precision`: o teste de aceite da migração exige reproduzir
 * R$ 1.033.513,40 somando as parcelas aprovadas, e ponto flutuante erra centavo em soma
 * dessa ordem. `numeric` soma exato no proprio Postgres.
 *
 * O driver devolve `string` de proposito — converter para `number` no limite do
 * banco reintroduziria o erro que o `numeric` evita.
 */
export const dinheiro = (nome: string) =>
  numeric(nome, { precision: 14, scale: 2 });

/**
 * Vigência em meses. Precisa de uma casa decimal porque bolsa de ate 15 dias
 * vale 0,5 mes (regra do anexo da CAPES — RN-02).
 */
export const meses = (nome: string) =>
  numeric(nome, { precision: 4, scale: 1 });

/** Percentual/fração com precisão suficiente para participação no custo. */
export const fracao = (nome: string) =>
  numeric(nome, { precision: 9, scale: 8 });

/** Colunas de auditoria presentes em toda tabela de domínio. */
export const timestamps = {
  criadoEm: timestamp('criado_em', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
  atualizadoEm: timestamp('atualizado_em', { withTimezone: true })
    .notNull()
    .default(sql`now()`),
};

// ---------------------------------------------------------------------------
// Enums do domínio. Os valores são os termos do glossário (system-structl.md §2)
// em MAIUSCULA_COM_UNDERSCORE; a interface traduz para o texto do usuário.
// ---------------------------------------------------------------------------

export const destinoEnum = pgEnum('destino', ['BRASIL', 'EXTERIOR']);

export const fluxoEnum = pgEnum('fluxo', ['IN', 'OUT']);

export const rubricaEnum = pgEnum('rubrica', [
  'BOLSAS',
  'MANUTENCAO',
  'MISSOES',
]);

export const statusOrcamentoEnum = pgEnum('status_orcamento', [
  'DEFINIDO',
  'A_DEFINIR',
]);

/** Situação informada manualmente para a composição de cada exercício. */
export const statusComposicaoAnualEnum = pgEnum('status_composicao_anual', [
  'A_DEFINIR',
  'EM_ELABORACAO',
  'APROVADA',
]);

export const statusItemPlanejadoEnum = pgEnum('status_item_planejado', [
  'PROGRAMADO',
  'PENDENTE',
  'CANCELADO',
]);

export const situacaoParticipacaoEnum = pgEnum('situacao_participacao', [
  'CONTEMPLADO',
  'CADASTRO_PRELIMINAR',
  'NAO_CONTEMPLADO',
]);

export const statusPendenciaEnum = pgEnum('status_pendencia', [
  'PENDENTE',
  'EM_ANALISE',
  'MONITORAR',
  'RESOLVIDA',
]);

export const nivelImpactoEnum = pgEnum('nivel_impacto', [
  'ALTA',
  'MEDIA',
  'BAIXA',
]);

export const escopoPendenciaEnum = pgEnum('escopo_pendencia', [
  'GERAL',
  'REDE',
  'AREA_TEMATICA',
  'PPG',
]);

export const origemPendenciaEnum = pgEnum('origem_pendencia', [
  'MANUAL',
  'AUTOMATICA',
]);

export const statusCicloEnum = pgEnum('status_ciclo', [
  'PLANEJAMENTO',
  'VIGENTE',
  'ENCERRADO',
]);

export const statusBolsaConcedidaEnum = pgEnum('status_bolsa_concedida', [
  'SELECIONADO',
  'EM_ANDAMENTO',
  'CONCLUIDA',
  'CANCELADA',
  'INTERROMPIDA',
]);

export const nivelBeneficiarioEnum = pgEnum('nivel_beneficiario', [
  'MESTRADO',
  'DOUTORADO',
  'POS_DOC',
  'DOCENTE',
  'MOBILIDADE_BREVE',
]);

export const tipoProdutoBolsaEnum = pgEnum('tipo_produto_bolsa', [
  'ARTIGO',
  'TRABALHO',
  'PROJETO',
  'RELATORIO',
  'PUBLICACAO',
  'LIVRO',
  'CAPITULO_LIVRO',
  'PATENTE',
  'EVENTO',
  /**
   * Cotutela e orientacao conjunta (BOL-050).
   *
   * Acrescentados no fim porque `ALTER TYPE ... ADD VALUE` so sabe inserir.
   * `TESE_COTUTELA` ja existia em `tipo_produto_missao` e faltava aqui — e o
   * lado que faltava e justamente o que importa: a cotutela e acordo sobre a
   * tese **deste** bolsista, cobrada dele, nao um resultado institucional da
   * viagem do Comite.
   */
  'TESE_COTUTELA',
  'ORIENTACAO_CONJUNTA',
  'OUTRO',
]);

export const statusProdutoBolsaEnum = pgEnum('status_produto_bolsa', [
  'PREVISTO',
  'EM_DESENVOLVIMENTO',
  'ENTREGUE',
  'VALIDADO',
  'CANCELADO',
]);

/**
 * Tipos de produto **da missao** (CG-056).
 *
 * Enum proprio, e nao `tipo_produto_bolsa`: sao dois dominios que so parecem o
 * mesmo. O produto de bolsa e do beneficiario, cobrado dele e vinculado a uma
 * concessao; o produto da missao e institucional — convenio, rede de pesquisa,
 * captacao — e nasce de uma viagem do Comite. Reaproveitar o enum obrigaria a
 * lista unica a servir as duas cobrancas e faria o primeiro valor novo de um
 * lado aparecer no formulario do outro.
 *
 * `CONVENIO` esta aqui, e nao so na tabela `convenio`, porque o checklist de
 * encerramento homologado (CG-009) exige "convenio anexado **se houver produto
 * do tipo CONVENIO**": e o produto que declara que a missao rendeu um acordo, e
 * a tabela `convenio` guarda o acordo em si, que sobrevive a missao.
 */
export const tipoProdutoMissaoEnum = pgEnum('tipo_produto_missao', [
  'CONVENIO',
  'PROJETO_PESQUISA',
  'PUBLICACAO',
  'TESE_COTUTELA',
  'PATENTE',
  'EVENTO',
  'REDE_PESQUISA',
  'MOBILIDADE',
  'CAPTACAO_RECURSOS',
  /** Cooperacao cientifica do documento da equipe (BOL-050), lado institucional. */
  'ORIENTACAO_CONJUNTA',
  'OUTRO',
]);

/**
 * Situacao do produto da missao.
 *
 * Separada de `status_produto_bolsa` pelo mesmo motivo do tipo. `VALIDADO` nao
 * existe aqui: validar produto de bolsa e ato de cobranca sobre o beneficiario,
 * e ninguem valida o convenio que a propria instituicao assinou.
 */
export const situacaoProdutoMissaoEnum = pgEnum('situacao_produto_missao', [
  'PREVISTO',
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CANCELADO',
]);

/** Tipos de acordo previstos em system-structl.md §4.8. */
export const tipoAcordoConvenioEnum = pgEnum('tipo_acordo_convenio', [
  'INTERCAMBIO_PESQUISA',
  'DUPLA_TITULACAO',
  'COOPERACAO_TECNICA',
  'INTERCAMBIO_ACADEMICO',
  'MOBILIDADE_DOCENTE',
  'COTUTELA',
  'OUTRO',
]);

/**
 * Situacao do convenio — os tres valores de system-structl.md §4.8.
 *
 * Nao ha `CANCELADO`: acordo denunciado ou nao renovado e `ENCERRADO`, e a data
 * de fim diz quando. Um quarto valor exigiria decidir institucionalmente o que
 * distingue "cancelado" de "encerrado", e essa pergunta nao foi feita.
 */
export const situacaoConvenioEnum = pgEnum('situacao_convenio', [
  'EM_TRAMITACAO',
  'VIGENTE',
  'ENCERRADO',
]);

export const statusExecucaoEnum = pgEnum('status_execucao', [
  'NAO_INICIADO',
  'EMPENHADO',
  'PAGO',
  'CANCELADO',
]);

/**
 * Estados de uma prestacao de contas de missao (CG-013).
 *
 * `NAO_INICIADA` nao esta aqui de proposito: a ausencia de prestacao e a
 * ausencia da linha, nao um estado guardado. Ver `prestacao.ts`.
 */
/**
 * Alcance de um escopo de acesso.
 *
 * `GLOBAL` e o administrador: enxerga tudo. `PPG` e `REDE` recortam. Um mesmo
 * usuario pode acumular varios escopos — coordenar dois PPGs, por exemplo.
 */
export const tipoEscopoAcessoEnum = pgEnum('tipo_escopo_acesso', [
  'GLOBAL',
  'PPG',
  'REDE',
]);

/** Como o `sub` do Keycloak foi ligado a uma pessoa do cadastro local. */
export const origemVinculoUsuarioEnum = pgEnum('origem_vinculo_usuario', [
  /** E-mail do token bateu com o de uma pessoa ja cadastrada. */
  'EMAIL',
  /** Nao havia pessoa correspondente; o primeiro login criou uma. */
  'CRIACAO_AUTOMATICA',
  /** Um administrador associou a mao, corrigindo ou suprindo o automatico. */
  'MANUAL',
]);

/**
 * Dimensao de **aprovacao** da missao (CG-006, CG-008 modelo B).
 *
 * E independente de `status_missao_comite`, que descreve a execucao. Uma missao
 * pode estar APROVADA e ainda RASCUNHO de execucao, ou CONCLUIDA tendo sido
 * REPROVADA — separar as duas dimensoes e o que evita a coluna unica que
 * precisaria de um valor novo a cada cruzamento.
 */
export const statusAprovacaoMissaoEnum = pgEnum('status_aprovacao_missao', [
  'RASCUNHO',
  'EM_ANALISE',
  'AJUSTES_SOLICITADOS',
  'APROVADA',
  'REPROVADA',
]);

/** Decisao do Comite sobre uma rodada de analise (CG-008). */
export const acaoDecisaoComiteEnum = pgEnum('acao_decisao_comite', [
  'APROVAR',
  'SOLICITAR_AJUSTES',
  'REPROVAR',
]);

/**
 * Por que a rodada de analise nasceu.
 *
 * Reabertura nao e uma decisao: e uma nova rodada sobre uma missao ja decidida.
 * Distinguir a origem preserva a leitura do historico sem apagar nada.
 */
export const origemRodadaAnaliseEnum = pgEnum('origem_rodada_analise', [
  'SUBMISSAO',
  'REABERTURA',
]);

/** Momento em que um requisito documental e cobrado. */
/**
 * Alcance dos objetivos previstos, respondido no encerramento (CG-058).
 *
 * Tres valores, e nao booleano: "parcialmente" e a resposta honesta da maior
 * parte das missoes, e forcar sim/nao empurraria todas elas para o "sim".
 */
export const avaliacaoObjetivosEnum = pgEnum('avaliacao_objetivos', [
  'SIM',
  'PARCIALMENTE',
  'NAO',
]);

export const momentoRequisitoEnum = pgEnum('momento_requisito', [
  'SUBMISSAO',
  'ENCERRAMENTO',
]);

export const statusPrestacaoMissaoEnum = pgEnum('status_prestacao_missao', [
  'EM_PREENCHIMENTO',
  'ENVIADA',
  'COM_PENDENCIA',
  'VALIDADA',
]);

/**
 * Tipos de despesa da missao, homologados na CG-009.
 *
 * A lista e a do documento da equipe de orcamento (secao 24): hospedagem,
 * transporte, inscricao em evento, seguro e outros. Passagem e diaria vem antes
 * porque sao as unicas com tabela de especializacao — as demais se descrevem
 * com os campos comuns da despesa.
 *
 * `OUTRA` permanece como escape legitimo do proprio documento ("Outros"), nao
 * como deposito do que faltava decidir.
 */
export const tipoDespesaMissaoEnum = pgEnum('tipo_despesa_missao', [
  'PASSAGEM',
  'DIARIA',
  'HOSPEDAGEM',
  'TRANSPORTE',
  'INSCRICAO_EVENTO',
  'SEGURO',
  'OUTRA',
]);

/**
 * Categorias de documento (CG-014), vindas do documento da equipe de orcamento:
 * secao 15 (documentos da missao), 21-24 (comprovantes da prestacao), 27
 * (fotos) e 28 (evidencias documentais).
 *
 * Uma coluna so, e nao tres. O que distingue foto de evidencia ja e a propria
 * categoria; um segundo campo dizendo "isto e foto" repetiria a informacao e
 * criaria a chance de os dois discordarem.
 */
export const categoriaAnexoEnum = pgEnum('categoria_anexo', [
  // Secao 15 — antes da aprovacao
  'PROJETO',
  'CONVITE',
  'PROGRAMACAO',
  'JUSTIFICATIVA',
  'ORCAMENTO',
  // Secoes 21 a 24 — prestacao de contas
  'PASSAGEM',
  'BILHETE',
  'COMPROVANTE',
  'NOTA_FISCAL',
  'COMPROVANTE_DIARIAS',
  'COTACAO',
  // Secao 27 — galeria
  'FOTO_REUNIAO',
  'FOTO_EVENTO',
  'FOTO_VISITA',
  'FOTO_ASSINATURA',
  'FOTO_INSTITUICAO',
  'FOTO_PARTICIPANTES',
  // Secao 28 — evidencias documentais
  'CERTIFICADO',
  'ATA',
  'NOTICIA',
  'PUBLICACAO',
  'APRESENTACAO',
  'LISTA_PRESENCA',
  'DECLARACAO',
  // Bolsista (BOL-021). Acrescentados no fim porque `ALTER TYPE ... ADD VALUE`
  // so sabe inserir, e reordenar a lista obrigaria a recriar o tipo no banco.
  //
  // As tres ultimas sao **documento pessoal** e nascem com visibilidade
  // `PESSOAL`, decidida pela categoria e nao pelo cliente — ver
  // `CATEGORIAS_PESSOAIS` em `anexos.service.ts`. `DOCUMENTO_IDENTIDADE` cobre
  // RG, CPF e CIN, que desde a Carteira de Identidade Nacional sao o mesmo
  // documento; separa-los criaria tres categorias para uma foto so.
  'CARTA_ACEITE',
  'PLANO_TRABALHO',
  'RELATORIO',
  'DOCUMENTO_IDENTIDADE',
  'PASSAPORTE',
  'COMPROVANTE_RESIDENCIA',
  'OUTRO',
]);

/**
 * Visibilidade do documento (CG-014, proposta pendente de confirmacao).
 *
 * `RESTRITA` existe porque a CG-057 exige que a galeria nao exponha arquivo
 * privado — sem algum eixo de visibilidade essa exigencia nao tem como ser
 * cumprida.
 */
export const visibilidadeAnexoEnum = pgEnum('visibilidade_anexo', [
  'INTERNA',
  'RESTRITA',
  /**
   * Documento pessoal do bolsista: RG/CIN, CPF, passaporte, comprovante de
   * residencia (BOL-021, homologado em 2026-09-09).
   *
   * **`PESSOAL` e `RESTRITA` nao sao niveis, sao publicos diferentes**, e
   * quem le esta lista supondo hierarquia erra: o Comite Gestor abre
   * `RESTRITA` e **nao** abre `PESSOAL` — passaporte de bolsista nao tem
   * relacao com a missao que ele analisa —, enquanto a secretaria, que instrui
   * o processo na CAPES, abre `PESSOAL` e nao abre `RESTRITA`. Cada valor
   * nomeia uma audiencia, e `podeVer` traduz audiencia em permissao.
   */
  'PESSOAL',
]);

/**
 * A que um documento pode se prender.
 *
 * Fechado de proposito: `entidade_id` nao tem chave estrangeira (e o preco do
 * vinculo polimorfico), entao o vocabulario fechado mais a checagem de
 * existencia no servico sao o que impede um `entidade_tipo` escrito errado de
 * esconder o arquivo para sempre.
 *
 * `PRODUTO_MISSAO` e `CONVENIO` entraram na CG-056, junto com suas tabelas.
 * `SUBMISSAO_MISSAO` e `DECISAO_COMITE` continuam de fora: o documento
 * analisado se prende a missao e a decisao apenas o fotografa (CG-019). Aceitar
 * upload apontando para tabela inexistente seria criar orfao no ato.
 */
export const entidadeAnexoEnum = pgEnum('entidade_anexo', [
  'MISSAO_COMITE',
  'ATIVIDADE_MISSAO',
  'PRESTACAO_CONTAS_MISSAO',
  'DESPESA_MISSAO',
  'COTACAO_PASSAGEM',
  'INSTITUICAO',
  'PARCEIRO',
  // Acrescentados no fim de proposito: `ALTER TYPE ... ADD VALUE` so sabe
  // inserir, e reordenar a lista aqui obrigaria a recriar o tipo no banco.
  'PRODUTO_MISSAO',
  'CONVENIO',
  /** Documentos do bolsista (BOL-021): herdam o recorte por PPG da BOL-020. */
  'BOLSA_CONCEDIDA',
  /**
   * Ata da reuniao que fundamentou a decisao (BOL-052, homologado em
   * 2026-09-09).
   *
   * Estava fora de proposito, e o motivo registrado era outro: o **documento
   * analisado** se prende a missao, e a decisao apenas o fotografa (CG-019) —
   * aceitar anexo na decisao faria parecer que ela tem documentos proprios
   * entre os analisados. A ata nao e um documento analisado: e o registro do
   * ato que a decisao descreve, e pertence a ela. `decisao_comite` e tabela
   * real, entao o vinculo polimorfico tem alvo e nao cria orfao.
   *
   * Nao substitui o modelo B: o colegiado continua deliberando fora do
   * sistema, e a ata e o comprovante daquela deliberacao.
   */
  'DECISAO_COMITE',
]);

/**
 * Como a instituicao entrou no radar da UEA (BOL-030).
 *
 * **Fato historico, e por isso imutavel depois de gravado.** Reescrever a
 * origem apagaria exatamente a memoria institucional que o modulo existe para
 * preservar: seis meses depois ninguem lembra se aquele parceiro veio de um
 * evento ou da indicacao de um docente, e essa e a pergunta que o proximo
 * contato precisa responder.
 *
 * Sao as seis opcoes do documento da equipe, sem acrescimo.
 */
export const origemRelacionamentoEnum = pgEnum('origem_relacionamento', [
  'RECEBEU_BOLSISTA',
  'INDICACAO_PESQUISADOR',
  'CONTATO_PPG',
  'EVENTO_INTERNACIONAL',
  'PROSPECCAO_INSTITUCIONAL',
  'OUTRO',
]);

/**
 * Estagio **declarado** do relacionamento (BOL-031).
 *
 * Sao apenas tres dos cinco estados do documento, e a ausencia dos outros dois
 * e a decisao: "mobilidade realizada" e "parceria formalizada" sao **fatos
 * verificaveis** — existe concessao apontando para a instituicao, existe
 * convenio vigente — e ficam derivados na leitura.
 *
 * Grava-los seria repetir no cadastro o que o banco ja sabe, e criar a
 * divergencia do dia seguinte: a ficha afirmando "apenas identificada" sobre
 * uma instituicao que recebeu tres bolsistas. E o mesmo motivo pelo qual o
 * checklist de encerramento nao e persistido (CG-058).
 */
export const estagioRelacionamentoEnum = pgEnum('estagio_relacionamento', [
  'IDENTIFICADA',
  'CONTATO_INICIADO',
  'COOPERACAO_EM_AVALIACAO',
]);

export const statusRemanejamentoEnum = pgEnum('status_remanejamento', [
  'PROPOSTO',
  'AUTORIZADO',
  'EXECUTADO',
  'REJEITADO',
]);
