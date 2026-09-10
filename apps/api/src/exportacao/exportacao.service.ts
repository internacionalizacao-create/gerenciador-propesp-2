import { Injectable, NotFoundException } from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { RecorteDeMissoes } from '../auth/escopo';
import { dataHojeEmManaus } from '../comum/datas';
import { AnexosService } from '../dominio/anexos.service';
import { EncerramentoService } from '../dominio/encerramento.service';
import { MissoesComiteService } from '../dominio/missoes-comite.service';
import {
  MobilidadeService,
  type FiltroMobilidade,
} from '../dominio/mobilidade.service';
import { ParceirosService } from '../dominio/parceiros.service';
import { PrestacaoService } from '../dominio/prestacao.service';
import {
  RelatoriosService,
  type FiltroRelatorio,
} from '../dominio/relatorios.service';
import { ResultadosService } from '../dominio/resultados.service';
import { gerarPdf, mesclarPdfs, type SecaoPdf } from './pdf';
import { paraCsv, paraXlsx, type Planilha } from './planilha';

/**
 * Exportacoes e dossie da missao (CG-069).
 *
 * **Nada e gravado em disco.** O conteudo e transmitido direto na resposta.
 * Isso responde de saida as duas perguntas que a task levanta — expiracao e
 * limpeza —, porque nao ha o que expirar nem o que varrer. E elimina a pior
 * falha possivel do modulo: uma exportacao que sobra no servidor e e servida
 * depois a quem nao podia ve-la.
 *
 * **A autorizacao e a da propria consulta**, e nao uma checagem paralela. Cada
 * exportacao chama o mesmo servico que a tela chama, com o mesmo usuario e o
 * mesmo recorte — entao o que sai no arquivo e, por construcao, o que a pessoa
 * ja podia ver. Uma segunda regra de acesso escrita aqui divergiria da
 * primeira, e a divergencia so apareceria como vazamento.
 *
 * **Sincrono**, decidido para o servidor on-premise: uma fila de jobs traria
 * Redis e mais um processo para a instituicao operar. O teto de linhas dos
 * relatorios (CG-068) e o que protege o worker.
 */

export const FORMATOS = ['pdf', 'xlsx', 'csv'] as const;
export type Formato = (typeof FORMATOS)[number];

export const RELATORIOS = [
  'missoes',
  'parceiros',
  'financas',
  'resultados',
] as const;
export type NomeDeRelatorio = (typeof RELATORIOS)[number];

export interface Exportacao {
  nomeArquivo: string;
  mimeType: string;
  conteudo: Buffer;
  /** Anexos que nao puderam entrar no dossie; a tela avisa. */
  ignorados?: string[];
}

const MIME: Record<Formato, string> = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv; charset=utf-8',
};

/** Tipos que a galeria consegue embutir no dossie como imagem. */
const IMAGEM = ['image/jpeg', 'image/png'];

/** Rotulos do relacionamento institucional (BOL-030/BOL-031). */
const ORIGEM: Record<string, string> = {
  RECEBEU_BOLSISTA: 'Recebeu bolsista CAPES Global.Edu',
  INDICACAO_PESQUISADOR: 'Indicação de pesquisador/docente UEA',
  CONTATO_PPG: 'Contato realizado pelo PPG',
  EVENTO_INTERNACIONAL: 'Evento internacional',
  PROSPECCAO_INSTITUCIONAL: 'Prospecção institucional',
  OUTRO: 'Outro',
};

const ESTAGIO: Record<string, string> = {
  IDENTIFICADA: 'Instituição identificada',
  CONTATO_INICIADO: 'Contato institucional iniciado',
  COOPERACAO_EM_AVALIACAO: 'Cooperação em avaliação',
};

/** Os tres estados da resposta sobre produto (CG-056), por extenso. */
const ROTULO_RESPOSTA: Record<string, string> = {
  SIM: 'Sim',
  NAO: 'Não — declarado explicitamente',
  NAO_INFORMADO: 'Ainda não respondido',
};

@Injectable()
export class ExportacaoService {
  constructor(
    private readonly relatorios: RelatoriosService,
    private readonly missoes: MissoesComiteService,
    private readonly prestacao: PrestacaoService,
    private readonly resultados: ResultadosService,
    private readonly encerramento: EncerramentoService,
    private readonly anexos: AnexosService,
    private readonly parceiros: ParceirosService,
    private readonly mobilidade: MobilidadeService,
  ) {}

  /**
   * Exporta um dos quatro relatorios homologados.
   *
   * Monta **uma** planilha e a serve nos tres formatos. Um caminho por formato
   * abriria espaco para o PDF mostrar uma coluna que o CSV nao tem, e ninguem
   * compararia os tres para notar.
   */
  async relatorio(
    cicloId: string,
    qual: NomeDeRelatorio,
    formato: Formato,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<Exportacao> {
    const planilha = await this.planilhaDoRelatorio(
      cicloId,
      qual,
      filtro,
      recorte,
    );
    const nome = `relatorio-${qual}-${dataHojeEmManaus()}`;

    if (formato === 'csv') {
      return {
        nomeArquivo: `${nome}.csv`,
        mimeType: MIME.csv,
        conteudo: paraCsv(planilha),
      };
    }
    if (formato === 'xlsx') {
      return {
        nomeArquivo: `${nome}.xlsx`,
        mimeType: MIME.xlsx,
        conteudo: paraXlsx(planilha),
      };
    }

    return {
      nomeArquivo: `${nome}.pdf`,
      mimeType: MIME.pdf,
      conteudo: await gerarPdf({
        titulo: planilha.titulo,
        subtitulo: descreverFiltro(filtro),
        rodape: 'Gerenciador PROPESP · Comitê Gestor',
        secoes: [
          {
            titulo: 'Resultado',
            tabela: {
              colunas: planilha.colunas,
              linhas: planilha.linhas.map((linha) =>
                linha.map((valor) => (valor === null ? null : String(valor))),
              ),
            },
          },
        ],
      }),
    };
  }

  /**
   * Dossie final da missao, em PDF unico (decisao de 2026-09-07).
   *
   * Os documentos entram de dois jeitos, conforme o que sao: imagem vira
   * pagina renderizada, PDF e **concatenado** ao fim. Sem a concatenacao o
   * "unico" seria so o corpo, e quem recebesse teria de juntar o resto — o
   * pacote que a decisao recusou.
   *
   * **Nenhum arquivo restrito entra sem que o solicitante pudesse abri-lo.** A
   * lista vem de `AnexosService.listar`, com o proprio usuario: ela ja aplica a
   * visibilidade `RESTRITA` (CG-014, homologada em 2026-09-07) e o recorte por
   * rede (CG-028). Reimplementar o filtro aqui criaria uma segunda regra para
   * divergir da primeira.
   */
  async dossie(
    cicloId: string,
    missaoId: string,
    usuario: AuthUser,
  ): Promise<Exportacao> {
    const missao = await this.missoes.detalhe(cicloId, missaoId);
    if (!missao) throw new NotFoundException('Missao nao encontrada.');

    const [prestacao, resultados, checklist, documentos] = await Promise.all([
      this.prestacao.detalhe(cicloId, missaoId).catch(() => null),
      this.resultados.resultadosDaMissao(cicloId, missaoId),
      this.encerramento.checklist(cicloId, missaoId),
      this.anexos.listar(
        { entidadeTipo: 'MISSAO_COMITE', entidadeId: missaoId } as never,
        usuario,
      ),
    ]);

    const imagens: { conteudo: Buffer; legenda: string }[] = [];
    const pdfs: { nome: string; conteudo: Buffer }[] = [];
    for (const documento of documentos) {
      // `baixar` aplica a permissao da entidade de destino, o recorte por rede
      // e a visibilidade `RESTRITA`. Ler o arquivo por outro caminho seria uma
      // segunda porta para a mesma autorizacao — e a segunda e a que erra.
      const arquivo = await this.anexos
        .baixar(documento.id, usuario)
        .catch(() => null);
      if (!arquivo) continue;
      const conteudo = arquivo.conteudo;
      if (IMAGEM.includes(documento.mimeType)) {
        imagens.push({
          conteudo,
          legenda: [documento.nome, documento.autoria, documento.dataEvidencia]
            .filter(Boolean)
            .join(' · '),
        });
      } else if (documento.mimeType === 'application/pdf') {
        pdfs.push({ nome: documento.nome, conteudo });
      }
    }

    const corpo = await gerarPdf({
      titulo: `${missao.codigo} — ${missao.titulo}`,
      subtitulo: `Dossiê da missão · emitido em ${dataHojeEmManaus()}`,
      rodape: `${missao.codigo} · Gerenciador PROPESP`,
      secoes: this.secoesDoDossie(
        missao,
        prestacao,
        resultados,
        checklist,
        documentos,
        imagens,
      ),
    });

    const { conteudo, ignorados } = await mesclarPdfs(corpo, pdfs);
    return {
      nomeArquivo: `dossie-${missao.codigo}.pdf`,
      mimeType: MIME.pdf,
      conteudo,
      ignorados,
    };
  }

  /**
   * Relatorio de mobilidade nos tres formatos (BOL-044).
   *
   * **Chama o mesmo servico da tela, com o mesmo filtro e o mesmo usuario.** A
   * autorizacao e o recorte por PPG vem de la, e nao de uma checagem escrita
   * aqui — duas regras de acesso para a mesma pergunta divergem, e a
   * divergencia so aparece como vazamento (CG-069).
   *
   * Uma planilha para os tres formatos: um caminho por formato abriria espaco
   * para o PDF mostrar coluna que o CSV nao tem, e ninguem compararia os tres
   * para notar.
   */
  async relatorioDeMobilidade(
    usuario: AuthUser,
    filtro: FiltroMobilidade,
    formato: Formato,
  ): Promise<Exportacao> {
    const linhas = await this.mobilidade.relatorio(usuario, filtro);
    const planilha: Planilha = {
      titulo: 'Mobilidade',
      colunas: [
        'Bolsista',
        'CPF',
        'ORCID',
        'PPG',
        'Programa',
        'Ciclo',
        'Rede',
        'Área temática',
        'Modalidade',
        'Nível',
        'Fluxo',
        'País de destino',
        'Instituição de destino',
        'Início',
        'Fim',
        'Situação',
        'Valor (BRL)',
        'Produtos',
      ],
      linhas: linhas.map((linha) => [
        linha.bolsista,
        linha.cpf,
        linha.orcid,
        linha.ppg,
        linha.programa,
        linha.ciclo,
        linha.rede,
        linha.areaTematica,
        linha.modalidade,
        linha.nivel,
        linha.fluxo,
        linha.paisDestino,
        linha.instituicaoDestino,
        linha.dataInicio,
        linha.dataFim,
        linha.status,
        linha.valor,
        String(linha.produtos),
      ]),
    };

    const nome = `relatorio-mobilidade-${dataHojeEmManaus()}`;
    if (formato === 'csv') {
      return {
        nomeArquivo: `${nome}.csv`,
        mimeType: MIME.csv,
        conteudo: paraCsv(planilha),
      };
    }
    if (formato === 'xlsx') {
      return {
        nomeArquivo: `${nome}.xlsx`,
        mimeType: MIME.xlsx,
        conteudo: paraXlsx(planilha),
      };
    }
    return {
      nomeArquivo: `${nome}.pdf`,
      mimeType: MIME.pdf,
      conteudo: await gerarPdf({
        titulo: 'Relatório de mobilidade',
        subtitulo: `Emitido em ${dataHojeEmManaus()} · ${linhas.length} concessão(ões)`,
        rodape: 'Mobilidade · Gerenciador PROPESP',
        secoes: [
          {
            titulo: 'Concessões',
            // O PDF so aceita texto; a planilha permite numero, e aqui todas
            // as celulas ja sao string por construcao.
            tabela: {
              colunas: planilha.colunas,
              linhas: planilha.linhas as (string | null)[][],
            },
          },
        ],
      }),
    };
  }

  /**
   * Ficha consolidada do parceiro (BOL-034).
   *
   * **PDF apenas**, e nao os tres formatos dos relatorios. A ficha e um
   * documento — seis secoes de natureza diferente, para circular fora do
   * sistema —, e nao uma tabela: espremer contatos, mobilidades, missoes e
   * convenios num CSV unico produziria uma planilha que nao responde nenhuma
   * das perguntas inteiras. E a mesma razao pela qual o dossie da missao e so
   * PDF.
   *
   * **A autorizacao e a da propria consulta**: chama `historico`, o mesmo
   * metodo da tela, com nada de checagem paralela.
   */
  async fichaDoParceiro(id: string): Promise<Exportacao> {
    const historico = await this.parceiros.historico(id);
    const { parceiro } = historico;

    const conteudo = await gerarPdf({
      titulo: parceiro.nome,
      subtitulo: `Ficha de relacionamento institucional · emitida em ${dataHojeEmManaus()}`,
      rodape: `${parceiro.sigla ?? parceiro.nome} · Gerenciador PROPESP`,
      secoes: this.secoesDaFicha(historico),
    });

    return {
      nomeArquivo: `ficha-${(parceiro.sigla ?? parceiro.nome)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')}.pdf`,
      mimeType: MIME.pdf,
      conteudo,
    };
  }

  // -------------------------------------------------------------------------

  private secoesDaFicha(
    historico: Awaited<ReturnType<ParceirosService['historico']>>,
  ): SecaoPdf[] {
    const { parceiro, contatos, mobilidades, missoes, convenios, produtos } =
      historico;

    /**
     * Pesquisadores envolvidos, deduzidos das mobilidades.
     *
     * Nao ha cadastro de "pesquisador desta instituicao", e inventar um seria
     * criar um vinculo que ninguem declarou. Quem esteve envolvido e quem
     * aparece nas acoes registradas — e essa e a unica afirmacao que os dados
     * sustentam.
     */
    const pesquisadores = [
      ...new Set(mobilidades.map((mobilidade) => mobilidade.bolsista)),
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    return [
      {
        titulo: 'Dados institucionais',
        campos: [
          { rotulo: 'Nome', valor: parceiro.nome },
          { rotulo: 'Sigla', valor: parceiro.sigla },
          { rotulo: 'Tipo de organização', valor: parceiro.tipoOrganizacao },
          {
            rotulo: 'Local',
            valor:
              [parceiro.cidade, parceiro.estadoRegiao, parceiro.pais]
                .filter(Boolean)
                .join(', ') || null,
          },
          { rotulo: 'Site', valor: parceiro.site },
          { rotulo: 'E-mail', valor: parceiro.emailInstitucional },
          { rotulo: 'Telefone', valor: parceiro.telefone },
          {
            rotulo: 'Faculdade ou departamento',
            valor: parceiro.faculdadeDepartamento,
          },
          {
            rotulo: 'Programa relacionado',
            valor: parceiro.programaRelacionado,
          },
          { rotulo: 'Grupo de pesquisa', valor: parceiro.grupoPesquisa },
          {
            rotulo: 'Redes da UEA',
            valor: parceiro.redes.map((rede) => rede.nome).join(', ') || null,
          },
        ],
      },
      {
        titulo: 'Situação do relacionamento',
        campos: [
          {
            rotulo: 'Como foi identificada',
            valor: parceiro.origemRelacionamento
              ? (ORIGEM[parceiro.origemRelacionamento] ??
                parceiro.origemRelacionamento)
              : null,
          },
          {
            rotulo: 'Estágio declarado',
            valor: ESTAGIO[parceiro.estagioRelacionamento],
          },
          {
            rotulo: 'Mobilidade realizada',
            valor: parceiro.mobilidadeRealizada
              ? 'Sim — há bolsa registrada'
              : 'Não há bolsa registrada',
          },
          {
            rotulo: 'Parceria formalizada',
            valor: parceiro.parceriaFormalizada
              ? 'Sim — há convênio vigente'
              : 'Não há convênio vigente',
          },
        ],
        paragrafos: [
          parceiro.origemObservacao,
          parceiro.areasAtuacao
            ? `Áreas de atuação: ${parceiro.areasAtuacao}`
            : null,
          // Exigencia do documento da equipe (BOL-035). Vai na ficha porque e
          // ela que circula fora do sistema, onde o contexto se perde.
          'O histórico registrado representa ações já realizadas e não implica disponibilidade futura de vagas ou concessão automática de bolsas.',
        ].filter((texto): texto is string => Boolean(texto)),
      },
      {
        titulo: 'Histórico de mobilidades',
        tabela: {
          colunas: ['Ano', 'Bolsista', 'PPG', 'Modalidade', 'Papel', 'Período'],
          linhas: mobilidades.map((mobilidade) => [
            String(mobilidade.ano),
            mobilidade.bolsista,
            mobilidade.ppgSigla,
            mobilidade.modalidade,
            mobilidade.ponta === 'DESTINO' ? 'Recebeu' : 'Enviou',
            `${mobilidade.dataInicio} a ${mobilidade.dataFim}`,
          ]),
        },
      },
      {
        titulo: 'Pesquisadores envolvidos',
        paragrafos: [
          pesquisadores.length > 0
            ? pesquisadores.join(' · ')
            : 'Nenhum pesquisador consta das ações registradas.',
        ],
      },
      {
        titulo: 'Contatos registrados',
        tabela: {
          colunas: ['Nome', 'Cargo', 'Departamento', 'E-mail', 'Situação'],
          linhas: contatos.map((contato) => [
            contato.nome,
            contato.cargo,
            contato.departamento,
            contato.email,
            contato.ativo ? 'Ativo' : 'Inativo',
          ]),
        },
      },
      {
        titulo: 'Missões do Comitê Gestor',
        tabela: {
          colunas: ['Código', 'Título', 'Período', 'Situação'],
          linhas: missoes.map((missao) => [
            missao.codigo,
            missao.titulo,
            `${missao.dataInicio} a ${missao.dataFim}`,
            missao.status,
          ]),
        },
      },
      {
        titulo: 'Convênios',
        tabela: {
          colunas: ['Título', 'Tipo', 'Situação', 'Vigência'],
          linhas: convenios.map((convenio) => [
            convenio.titulo,
            convenio.tipoAcordo,
            convenio.situacao,
            [convenio.dataInicio, convenio.dataFim]
              .filter(Boolean)
              .join(' a ') || 'Indeterminada',
          ]),
        },
      },
      {
        titulo: 'Produtos',
        tabela: {
          colunas: ['Título', 'Tipo', 'Situação', 'Ano'],
          linhas: produtos.map((produto) => [
            produto.titulo,
            produto.tipo,
            produto.situacao,
            produto.ano === null ? null : String(produto.ano),
          ]),
        },
      },
    ];
  }

  private secoesDoDossie(
    missao: Awaited<ReturnType<MissoesComiteService['detalhe']>>,
    prestacao: Awaited<ReturnType<PrestacaoService['detalhe']>> | null,
    resultados: Awaited<ReturnType<ResultadosService['resultadosDaMissao']>>,
    checklist: Awaited<ReturnType<EncerramentoService['checklist']>>,
    documentos: Awaited<ReturnType<AnexosService['listar']>>,
    imagens: { conteudo: Buffer; legenda: string }[],
  ): SecaoPdf[] {
    const secoes: SecaoPdf[] = [
      {
        titulo: 'Identificação',
        campos: [
          { rotulo: 'Código', valor: missao.codigo },
          {
            rotulo: 'Período',
            valor: `${missao.dataInicio} a ${missao.dataFim}`,
          },
          { rotulo: 'Dias', valor: String(missao.numeroDias) },
          {
            rotulo: 'Redes coordenadoras',
            valor: missao.redes.map((r) => r.nome).join(', ') || null,
          },
          { rotulo: 'Países', valor: missao.paises.join(', ') || null },
          // As duas dimensoes sempre juntas e rotuladas (CG-006): so uma faria
          // "aprovada" ser lido como "realizada".
          { rotulo: 'Situação da missão', valor: missao.status },
          { rotulo: 'Situação da aprovação', valor: missao.statusAprovacao },
          { rotulo: 'Situação da prestação', valor: missao.situacaoPrestacao },
        ],
        paragrafos: [missao.objetivo],
      },
      {
        titulo: 'Participantes',
        tabela: {
          colunas: ['Nome', 'Papel', 'Cargo'],
          linhas: missao.participantes.map((p) => [p.nome, p.papel, p.cargo]),
        },
      },
      {
        titulo: 'Roteiro',
        tabela: {
          colunas: ['Título', 'Tipo', 'País', 'Período', 'Situação'],
          linhas: missao.atividades.map((a) => [
            a.titulo,
            a.tipo,
            a.pais,
            `${a.dataInicio} a ${a.dataFim}`,
            a.status,
          ]),
        },
      },
    ];

    if (missao.relatoGeral || missao.avaliacaoObjetivos) {
      secoes.push({
        titulo: 'Relato e avaliação',
        campos: [
          { rotulo: 'Objetivos alcançados', valor: missao.avaliacaoObjetivos },
          {
            rotulo: 'Justificativa',
            valor: missao.avaliacaoJustificativa,
          },
        ],
        paragrafos: [
          missao.relatoGeral,
          missao.resultados,
          missao.desdobramentos,
        ].filter((texto): texto is string => Boolean(texto)),
      });
    }

    secoes.push({
      titulo: 'Prestação de contas',
      campos: [
        { rotulo: 'Situação', valor: missao.situacaoPrestacao },
        { rotulo: 'Total lançado', valor: missao.totais.geral },
      ],
      tabela: prestacao
        ? {
            colunas: ['Tipo', 'Descrição', 'Exercício', 'Valor'],
            linhas: prestacao.despesas.map((d) => [
              d.tipo,
              d.descricao,
              String(d.exercicio),
              d.valorTotal,
            ]),
          }
        : undefined,
      // Ausencia de prestacao e ausencia de linha, nao o estado NAO_INICIADA
      // (CG-013). O dossie diz isso em vez de mostrar tabela vazia.
      paragrafos: prestacao ? [] : ['Prestação de contas não iniciada.'],
    });

    secoes.push({
      titulo: 'Resultados',
      campos: [
        // `NAO_INFORMADO` nao e "nao gerou": zero produto significa tanto uma
        // coisa quanto a outra, e so a ausencia de resposta e pendencia
        // (CG-056). O dossie escreve os tres estados por extenso.
        {
          rotulo: 'Gerou produto?',
          valor: ROTULO_RESPOSTA[resultados.respostaProduto],
        },
        {
          rotulo: 'Justificativa da declaração',
          valor: resultados.declaracaoSemProduto?.justificativa ?? null,
        },
      ],
      tabela: {
        colunas: ['Tipo', 'Título', 'Situação', 'Ano'],
        linhas: resultados.produtos.map((p) => [
          p.tipo,
          p.titulo,
          p.situacao,
          p.ano === null ? null : String(p.ano),
        ]),
      },
    });

    secoes.push({
      titulo: 'Checklist de encerramento',
      tabela: {
        colunas: ['Requisito', 'Situação'],
        linhas: checklist.itens.map((item) => [
          item.titulo,
          // Dispensado nao vira atendido (CG-058): pinta-lo de verde apagaria a
          // excecao onde ela precisa ser vista.
          item.dispensa
            ? `Dispensado — ${item.dispensa.justificativa}`
            : item.atendido
              ? 'Atendido'
              : 'Não atendido',
        ]),
      },
    });

    secoes.push({
      titulo: 'Documentos',
      paragrafos: [
        documentos.length === 0
          ? 'Nenhum documento visível para quem emitiu este dossiê.'
          : 'Os PDF listados abaixo estão anexados na íntegra ao final deste arquivo.',
      ],
      tabela: {
        colunas: ['Nome', 'Categoria', 'Versão', 'Enviado por'],
        linhas: documentos.map((d) => [
          d.nome,
          d.categoria,
          String(d.versao),
          d.enviadoPor,
        ]),
      },
    });

    if (imagens.length > 0) {
      secoes.push({ titulo: 'Evidências', imagens });
    }

    return secoes;
  }

  private async planilhaDoRelatorio(
    cicloId: string,
    qual: NomeDeRelatorio,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<Planilha> {
    if (qual === 'missoes') {
      const dados = await this.relatorios.missoesDoRecorte(
        cicloId,
        filtro,
        recorte,
      );
      return {
        titulo: 'Relatório de missões',
        colunas: [
          'Código',
          'Título',
          'Início',
          'Fim',
          'Redes',
          'Países',
          'Situação',
          'Aprovação',
          'Prestação',
          'Participantes',
          'Atividades',
          'Lançado',
        ],
        linhas: dados.linhas.map((l) => [
          l.codigo,
          l.titulo,
          l.dataInicio,
          l.dataFim,
          l.redes.join(', '),
          l.paises.join(', '),
          l.status,
          l.statusAprovacao,
          l.situacaoPrestacao,
          l.participantes,
          l.atividades,
          l.valorPrestado,
        ]),
      };
    }

    if (qual === 'parceiros') {
      const dados = await this.relatorios.parceirosDoRecorte(
        cicloId,
        filtro,
        recorte,
      );
      return {
        titulo: 'Relatório de parceiros',
        colunas: [
          'Instituição',
          'Sigla',
          'País',
          'Cidade',
          'Missões',
          'Paradas',
          'Convênios',
        ],
        linhas: dados.linhas.map((l) => [
          l.nome,
          l.sigla,
          l.pais,
          l.cidade,
          l.missoes,
          l.atividades,
          l.convenios,
        ]),
      };
    }

    if (qual === 'financas') {
      const dados = await this.relatorios.financasDoRecorte(
        cicloId,
        filtro,
        recorte,
      );
      return {
        titulo: 'Relatório financeiro',
        colunas: [
          'Exercício',
          'Tipo',
          'Em preenchimento',
          'Com pendência',
          'Enviado',
          'Validado',
          'Total',
        ],
        linhas: dados.linhas.map((l) => [
          l.exercicio,
          l.tipo,
          l.emPreenchimento,
          l.comPendencia,
          l.enviado,
          l.validado,
          l.total,
        ]),
      };
    }

    const dados = await this.relatorios.resultadosDoRecorte(
      cicloId,
      filtro,
      recorte,
    );
    return {
      titulo: 'Relatório de resultados',
      colunas: ['Categoria', 'Tipo', 'Situação', 'Quantidade', 'Missões'],
      linhas: [
        ...dados.produtos.map((l) => [
          'Produto',
          l.tipo,
          l.situacao,
          l.quantidade,
          l.missoes,
        ]),
        ...dados.convenios.map((l) => [
          'Convênio',
          l.tipo,
          l.situacao,
          l.quantidade,
          l.missoes,
        ]),
      ],
    };
  }
}

/**
 * Descreve o recorte em uma linha, para o cabecalho do PDF.
 *
 * Um relatorio impresso sem o filtro que o gerou e um numero sem pergunta:
 * quem o receber por e-mail nao tem como saber se fala do ciclo inteiro ou de
 * um mes.
 */
function descreverFiltro(filtro: FiltroRelatorio): string {
  const partes: string[] = [];
  if (filtro.ano) partes.push(`exercício ${filtro.ano}`);
  if (filtro.de || filtro.ate) {
    partes.push(`período ${filtro.de ?? '...'} a ${filtro.ate ?? '...'}`);
  }
  if (filtro.busca) partes.push(`busca "${filtro.busca}"`);
  if (filtro.evento) partes.push(`evento "${filtro.evento}"`);
  if (filtro.status) partes.push(`situação ${filtro.status}`);
  if (filtro.situacaoPrestacao) {
    partes.push(`prestação ${filtro.situacaoPrestacao}`);
  }
  return partes.length > 0
    ? `Recorte: ${partes.join(' · ')}`
    : 'Recorte: ciclo inteiro, sem filtros';
}
