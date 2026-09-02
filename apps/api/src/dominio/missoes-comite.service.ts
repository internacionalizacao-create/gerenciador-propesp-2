import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { pessoaRapidaSchema, type PessoaRapida } from './comite-gestor.service';

const dataCompleta = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data completa.')
  .refine(dataIsoValida, 'Informe uma data valida.');

const participanteBase = z.object({
  pessoaId: z.uuid().nullish(),
  novaPessoa: pessoaRapidaSchema.nullish(),
  membroEquipeId: z.uuid().nullish(),
  papel: z
    .enum(['RESPONSAVEL', 'PARTICIPANTE', 'APOIO'])
    .default('PARTICIPANTE'),
  observacoes: z.string().trim().max(2000).nullish(),
});

/** Refinamentos comuns ao cadastro e a edicao de participante. */
function refinarParticipante(
  valor: z.infer<typeof participanteBase>,
  contexto: z.RefinementCtx,
) {
  {
    if (Boolean(valor.pessoaId) === Boolean(valor.novaPessoa)) {
      contexto.addIssue({
        code: 'custom',
        path: ['pessoaId'],
        message: 'Selecione uma pessoa existente ou cadastre uma nova.',
      });
    }
    if (valor.novaPessoa && valor.membroEquipeId) {
      contexto.addIssue({
        code: 'custom',
        path: ['membroEquipeId'],
        message: 'Pessoa nova ainda nao possui vinculo de equipe.',
      });
    }
  }
}

const participanteSchema = participanteBase.superRefine(refinarParticipante);

const atividadeBase = z.object({
  tipo: z.enum(['VISITA_TECNICA', 'EVENTO', 'ARTICULACAO', 'BANCA', 'OUTRO']),
  titulo: z.string().trim().min(3, 'Informe o titulo da atividade.').max(300),
  paisId: z.uuid(),
  cidade: z.string().trim().max(120).nullish(),
  instituicaoId: z.uuid().nullish(),
  instituicaoNome: z.string().trim().min(2).max(240).nullish(),
  eventoNome: z.string().trim().min(2).max(300).nullish(),
  dataInicio: dataCompleta,
  dataFim: dataCompleta,
  planejamento: z.string().trim().max(5000).nullish(),
  observacoes: z.string().trim().max(2000).nullish(),
});

/** Refinamentos comuns ao cadastro e a edicao de atividade do roteiro. */
function refinarAtividade(
  valor: z.infer<typeof atividadeBase>,
  contexto: z.RefinementCtx,
) {
  {
    if (valor.dataFim < valor.dataInicio) {
      contexto.addIssue({
        code: 'custom',
        path: ['dataFim'],
        message: 'A data final nao pode ser anterior a data inicial.',
      });
    }
    if (valor.instituicaoId && valor.instituicaoNome) {
      contexto.addIssue({
        code: 'custom',
        path: ['instituicaoNome'],
        message: 'Escolha a instituicao do catalogo ou informe o nome livre.',
      });
    }
  }
}

const atividadeSchema = atividadeBase.superRefine(refinarAtividade);

/**
 * Coerencia entre missao, roteiro e participantes.
 *
 * Vale tanto no cadastro quanto na edicao: uma missao editada nao pode ficar com
 * um roteiro fora do proprio periodo.
 */
function refinarMissao(
  valor: {
    dataInicio: string;
    dataFim: string;
    participantes: { pessoaId?: string | null }[];
    atividades: { dataInicio: string; dataFim: string }[];
  },
  contexto: z.RefinementCtx,
) {
  if (valor.dataFim < valor.dataInicio) {
    contexto.addIssue({
      code: 'custom',
      path: ['dataFim'],
      message: 'A data final nao pode ser anterior a data inicial.',
    });
  }

  const ids = valor.participantes
    .map((participante) => participante.pessoaId)
    .filter((id): id is string => Boolean(id));
  if (new Set(ids).size !== ids.length) {
    contexto.addIssue({
      code: 'custom',
      path: ['participantes'],
      message: 'A mesma pessoa nao pode aparecer duas vezes na missao.',
    });
  }

  valor.atividades.forEach((atividade, indice) => {
    if (
      atividade.dataInicio < valor.dataInicio ||
      atividade.dataFim > valor.dataFim
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['atividades', indice, 'dataInicio'],
        message: 'A atividade precisa estar dentro do periodo da missao.',
      });
    }
  });
}

/**
 * Redes a que a missao pertence (CG-016).
 *
 * Pelo menos uma, porque missao sem rede nao aparece em nenhum recorte por rede
 * e some do painel de quem a cadastrou. A lista e desduplicada aqui em vez de
 * confiar na constraint: o erro precisa chegar ao formulario com o caminho do
 * campo, e nao como violacao de indice unico.
 */
const redesSchema = z
  .array(z.uuid())
  .min(1, 'Selecione pelo menos uma rede.')
  .max(10)
  .refine(
    (redes) => new Set(redes).size === redes.length,
    'A mesma rede foi selecionada mais de uma vez.',
  );

export const criarMissaoComiteSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Informe o titulo da missao.').max(300),
    objetivo: z
      .string()
      .trim()
      .min(10, 'Informe o objetivo da missao.')
      .max(5000),
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    status: z.enum(['RASCUNHO', 'PLANEJADA']).default('RASCUNHO'),
    observacoes: z.string().trim().max(2000).nullish(),
    redes: redesSchema,
    participantes: z
      .array(participanteSchema)
      .min(1, 'Inclua pelo menos um participante.')
      .max(100),
    atividades: z
      .array(atividadeSchema)
      .min(1, 'Inclua pelo menos uma atividade no roteiro.')
      .max(200),
  })
  .superRefine(refinarMissao);

export type CriarMissaoComite = z.infer<typeof criarMissaoComiteSchema>;

/**
 * Edicao da missao.
 *
 * `strict()` e deliberado: e o que impede que um payload com valores, despesas
 * ou qualquer outro campo financeiro seja aceito e silenciosamente ignorado por
 * este endpoint. Alteracao financeira so existe na prestacao.
 *
 * O codigo e o status ficam de fora: codigo e imutavel e o ciclo de vida tem
 * endpoints proprios (CG-034).
 */
export const atualizarMissaoComiteSchema = z
  .object({
    titulo: z.string().trim().min(3, 'Informe o titulo da missao.').max(300),
    objetivo: z
      .string()
      .trim()
      .min(10, 'Informe o objetivo da missao.')
      .max(5000),
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    observacoes: z.string().trim().max(2000).nullish(),
    justificativa: z.string().trim().max(2000).nullish(),
    redes: redesSchema,
    participantes: z
      .array(
        participanteBase
          .extend({ id: z.uuid().nullish() })
          .strict()
          .superRefine(refinarParticipante),
      )
      .min(1, 'Inclua pelo menos um participante.')
      .max(100),
    atividades: z
      .array(
        atividadeBase
          .extend({ id: z.uuid().nullish() })
          .strict()
          .superRefine(refinarAtividade),
      )
      .min(1, 'Inclua pelo menos uma atividade no roteiro.')
      .max(200),
  })
  .strict()
  .superRefine(refinarMissao);

export type AtualizarMissaoComite = z.infer<typeof atualizarMissaoComiteSchema>;

/**
 * Transicoes de situacao administrativa.
 *
 * Ficam fora do endpoint de edicao porque nao sao alteracao de conteudo: mudam
 * o que a missao *e* perante a governanca, e cada uma tem sua propria regra de
 * origem e de justificativa.
 */
export const transicaoMissaoSchema = z
  .object({
    acao: z.enum(['CONFIRMAR', 'CONCLUIR', 'CANCELAR']),
    justificativa: z.string().trim().max(2000).nullish(),
  })
  .strict();
export type TransicaoMissao = z.infer<typeof transicaoMissaoSchema>;

export const reaberturaMissaoSchema = z
  .object({
    justificativa: z
      .string()
      .trim()
      .min(10, 'Informe a justificativa administrativa da reabertura.')
      .max(2000),
  })
  .strict();
export type ReaberturaMissao = z.infer<typeof reaberturaMissaoSchema>;

/**
 * Relato do que aconteceu.
 *
 * Endpoint separado da edicao de proposito: editar a missao muda o que se
 * pretende fazer, relatar registra o que foi feito. Nenhum campo de
 * planejamento e alcancado daqui — e o que mantem previsto e realizado
 * distinguiveis depois.
 */
export const relatarMissaoSchema = z
  .object({
    relatoGeral: z
      .string()
      .trim()
      .min(20, 'Descreva o que aconteceu na missao.')
      .max(10000),
    resultados: z.string().trim().max(10000).nullish(),
    atividades: z
      .array(
        z
          .object({
            id: z.uuid(),
            status: z.enum(['PLANEJADA', 'REALIZADA', 'NAO_REALIZADA']),
            relatoRealizado: z.string().trim().max(5000).nullish(),
            resultados: z.string().trim().max(5000).nullish(),
            observacoes: z.string().trim().max(2000).nullish(),
          })
          .strict()
          .superRefine((valor, contexto) => {
            if (valor.status === 'REALIZADA' && !valor.relatoRealizado) {
              contexto.addIssue({
                code: 'custom',
                path: ['relatoRealizado'],
                message: 'Descreva o que foi realizado nesta atividade.',
              });
            }
          }),
      )
      .max(200)
      .default([]),
    /** Aconteceu, mas nao constava do roteiro. Exige dizer por que entrou. */
    atividadesNaoPrevistas: z
      .array(
        atividadeBase
          .extend({
            justificativa: z
              .string()
              .trim()
              .min(10, 'Justifique a inclusao da atividade nao prevista.')
              .max(2000),
            relatoRealizado: z
              .string()
              .trim()
              .min(1, 'Descreva o que foi realizado nesta atividade.')
              .max(5000),
            resultados: z.string().trim().max(5000).nullish(),
          })
          .strict()
          .superRefine(refinarAtividade),
      )
      .max(200)
      .default([]),
  })
  .strict();
export type RelatarMissao = z.infer<typeof relatarMissaoSchema>;

/** De onde cada transicao pode partir. */
const ORIGENS_PERMITIDAS = {
  CONFIRMAR: ['RASCUNHO', 'PLANEJADA'],
  CONCLUIR: ['CONFIRMADA'],
  CANCELAR: ['RASCUNHO', 'PLANEJADA', 'CONFIRMADA'],
} as const satisfies Record<
  TransicaoMissao['acao'],
  readonly (typeof statusMissao)[number][]
>;

const DESTINOS = {
  CONFIRMAR: 'CONFIRMADA',
  CONCLUIR: 'CONCLUIDA',
  CANCELAR: 'CANCELADA',
} as const satisfies Record<
  TransicaoMissao['acao'],
  (typeof statusMissao)[number]
>;

/**
 * Faixa usada para afastar a ordem das atividades durante a renumeracao. Fica
 * muito acima do maximo aceito pelo schema (200 atividades), entao nunca colide
 * com uma ordem real.
 */
const DESLOCAMENTO_ORDEM = 1000;

const papeisMissao = ['RESPONSAVEL', 'PARTICIPANTE', 'APOIO'] as const;

const statusMissao = [
  'RASCUNHO',
  'PLANEJADA',
  'CONFIRMADA',
  'CONCLUIDA',
  'CANCELADA',
] as const;

const situacoesTemporais = ['FUTURA', 'EM_ANDAMENTO', 'ENCERRADA'] as const;

const situacoesPrestacao = [
  'NAO_INICIADA',
  'EM_PREENCHIMENTO',
  'ENVIADA',
  'COM_PENDENCIA',
  'VALIDADA',
] as const;

const ordenacoes = {
  PERIODO: 'data_inicio',
  CODIGO: 'codigo',
  TITULO: 'titulo',
  STATUS: 'status',
} as const;

/**
 * Filtros da lista de missoes.
 *
 * Todos sao combinaveis e opcionais: a tela monta a query string com o que o
 * usuario escolheu e o servico nunca depende de uma ordem especifica. Os valores
 * chegam da URL como texto, por isso os numericos usam `coerce`.
 */
export const filtroMissoesSchema = z.object({
  busca: z.string().trim().min(1).max(200).optional(),
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  de: dataCompleta.optional(),
  ate: dataCompleta.optional(),
  paisId: z.uuid().optional(),
  redeId: z.uuid().optional(),
  pessoaId: z.uuid().optional(),
  tipoEquipe: z.enum(['COMITE_GESTOR', 'ADMINISTRACAO']).optional(),
  status: z.enum(statusMissao).optional(),
  situacaoTemporal: z.enum(situacoesTemporais).optional(),
  situacaoPrestacao: z.enum(situacoesPrestacao).optional(),
  ordenar: z.enum(['PERIODO', 'CODIGO', 'TITULO', 'STATUS']).default('PERIODO'),
  direcao: z.enum(['ASC', 'DESC']).default('DESC'),
  pagina: z.coerce.number().int().min(1).default(1),
  tamanho: z.coerce.number().int().min(1).max(100).default(20),
});
export type FiltroMissoes = z.infer<typeof filtroMissoesSchema>;

export interface MissaoResumo {
  id: string;
  codigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  status: (typeof statusMissao)[number];
  situacaoTemporal: (typeof situacoesTemporais)[number];
  situacaoPrestacao: (typeof situacoesPrestacao)[number];
  participantes: number;
  atividades: number;
  paises: string[];
  /** Vazio apenas em missao anterior a CG-016; a interface diz "sem rede". */
  redes: string[];
  /** Nulo enquanto a missao nao tiver prestacao; nunca R$ 0,00 por omissao. */
  valorPrestado: string | null;
}

/**
 * Contagens do recorte atual.
 *
 * Responde ao escopo do filtro (busca, exercicio, periodo, pais, equipe,
 * participante), mas nao ao proprio status nem a situacao temporal — sao as
 * dimensoes que ele conta.
 */
export interface ResumoMissoes {
  total: number;
  porStatus: Record<(typeof statusMissao)[number], number>;
  porSituacaoTemporal: Record<(typeof situacoesTemporais)[number], number>;
  /** Somente missoes concluidas; cancelada nunca conta como realizada. */
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

export interface ParticipanteMissao {
  id: string;
  pessoaId: string;
  nome: string;
  email: string | null;
  tipoPessoa: string;
  ppg: string | null;
  instituicao: string | null;
  papel: (typeof papeisMissao)[number];
  /** Preenchido apenas quando a participacao apontou um vinculo de equipe. */
  membroEquipeId: string | null;
  tipoEquipe: 'COMITE_GESTOR' | 'ADMINISTRACAO' | null;
  funcaoEquipe: string | null;
  observacoes: string | null;
}

export interface AtividadeMissaoDetalhe {
  id: string;
  ordem: number;
  tipo: string;
  titulo: string;
  paisId: string;
  pais: string;
  cidade: string | null;
  instituicaoId: string | null;
  /** Nome exibivel, venha do catalogo ou do texto livre da atividade. */
  instituicao: string | null;
  instituicaoDoCatalogo: boolean;
  eventoNome: string | null;
  dataInicio: string;
  dataFim: string;
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

/**
 * Totais financeiros da missao.
 *
 * Todos os valores sao strings decimais ou nulo. Nulo significa "nao ha
 * prestacao", nunca R$ 0,00 — a distincao e a razao de a interface poder
 * escrever "Prestacao nao iniciada" com honestidade.
 */
export interface TotaisMissao {
  passagens: string | null;
  diarias: string | null;
  geral: string | null;
  porExercicio: { ano: number; passagens: string; diarias: string }[];
}

export interface MissaoDetalhe {
  id: string;
  codigo: string;
  titulo: string;
  objetivo: string;
  dataInicio: string;
  dataFim: string;
  status: (typeof statusMissao)[number];
  situacaoTemporal: (typeof situacoesTemporais)[number];
  relatoGeral: string | null;
  resultados: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
  participantes: ParticipanteMissao[];
  atividades: AtividadeMissaoDetalhe[];
  paises: string[];
  redes: { id: string; nome: string }[];
  /** Nulo enquanto a prestacao nao for iniciada (CG-013). */
  prestacao: null;
  situacaoPrestacao: (typeof situacoesPrestacao)[number];
  totais: TotaisMissao;
  documentos: never[];
  historico: RegistroHistoricoMissao[];
}

type DbTransacional = Pick<Database, 'execute' | 'insert' | 'select'>;

@Injectable()
export class MissoesComiteService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Catalogos usados pelo formulario; IDs nunca ficam fixos no cliente.
   *
   * As redes dependem do ciclo — `rede_coordenadora` e por ciclo —, por isso
   * este metodo recebe o ciclo enquanto paises e instituicoes sao globais.
   */
  async referencias(cicloId: string) {
    const [paises, instituicoes, redes] = await Promise.all([
      this.db
        .select({
          id: s.pais.id,
          nome: s.pais.nome,
          codigoIso2: s.pais.codigoIso2,
        })
        .from(s.pais)
        .orderBy(asc(s.pais.nome)),
      this.db
        .select({
          id: s.instituicao.id,
          nome: s.instituicao.nome,
          sigla: s.instituicao.sigla,
          paisId: s.instituicao.paisId,
          cidade: s.instituicao.cidade,
        })
        .from(s.instituicao)
        .where(eq(s.instituicao.ativo, true))
        .orderBy(asc(s.instituicao.nome)),
      this.db
        .select({
          id: s.redeCoordenadora.id,
          nome: s.redeCoordenadora.nome,
        })
        .from(s.redeCoordenadora)
        .where(eq(s.redeCoordenadora.cicloId, cicloId))
        .orderBy(asc(s.redeCoordenadora.nome)),
    ]);

    return { paises, instituicoes, redes };
  }

  async criar(cicloId: string, dto: CriarMissaoComite, usuario: AuthUser) {
    return this.db.transaction(async (tx) => {
      const codigo = await this.proximoCodigo(cicloId, tx);
      const [missao] = await tx
        .insert(s.missaoComite)
        .values({
          cicloId,
          codigo,
          titulo: dto.titulo,
          objetivo: dto.objetivo,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim,
          status: dto.status,
          observacoes: dto.observacoes ?? null,
        })
        .returning({
          id: s.missaoComite.id,
          codigo: s.missaoComite.codigo,
          titulo: s.missaoComite.titulo,
          status: s.missaoComite.status,
          dataInicio: s.missaoComite.dataInicio,
          dataFim: s.missaoComite.dataFim,
        });

      const participantes: (typeof s.missaoParticipante.$inferInsert)[] = [];
      for (const participante of dto.participantes) {
        const pessoaId = participante.novaPessoa
          ? await this.criarPessoa(participante.novaPessoa, usuario, tx)
          : participante.pessoaId!;

        await this.validarPessoa(pessoaId, tx);
        if (participante.membroEquipeId) {
          await this.validarMembroEquipe(
            participante.membroEquipeId,
            cicloId,
            pessoaId,
            tx,
          );
        }

        participantes.push({
          missaoId: missao.id,
          pessoaId,
          membroEquipeId: participante.membroEquipeId ?? null,
          papel: participante.papel,
          observacoes: participante.observacoes ?? null,
        });
      }
      await tx.insert(s.missaoParticipante).values(participantes);

      await this.validarRedes(dto.redes, cicloId, tx);
      await tx
        .insert(s.missaoRede)
        .values(dto.redes.map((redeId) => ({ missaoId: missao.id, redeId })));

      await this.validarReferenciasAtividades(dto.atividades, tx);
      await tx.insert(s.atividadeMissao).values(
        dto.atividades.map((atividade, indice) => ({
          missaoId: missao.id,
          ordem: indice + 1,
          tipo: atividade.tipo,
          titulo: atividade.titulo,
          paisId: atividade.paisId,
          cidade: atividade.cidade ?? null,
          instituicaoId: atividade.instituicaoId ?? null,
          instituicaoNome: atividade.instituicaoNome ?? null,
          eventoNome: atividade.eventoNome ?? null,
          dataInicio: atividade.dataInicio,
          dataFim: atividade.dataFim,
          planejamento: atividade.planejamento ?? null,
          observacoes: atividade.observacoes ?? null,
        })),
      );

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missao.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          codigo,
          titulo: dto.titulo,
          status: dto.status,
          redes: dto.redes.length,
          participantes: participantes.length,
          atividades: dto.atividades.length,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      return {
        ...missao,
        participantes: participantes.length,
        atividades: dto.atividades.length,
      };
    });
  }

  /**
   * Lista as missoes do ciclo com filtros combinaveis e paginacao.
   *
   * A situacao temporal e a situacao da prestacao sao derivadas na consulta, e
   * nao colunas. Enquanto a CG-013 nao existir, toda missao responde
   * `NAO_INICIADA` — o que preserva o filtro funcionando e concentra a mudanca
   * futura em uma unica expressao SQL.
   */
  async listar(cicloId: string, filtro: FiltroMissoes): Promise<PaginaMissoes> {
    // Escopo e situacao ficam separados de proposito: o resumo conta por
    // status e por situacao temporal, entao nao pode ser filtrado por eles.
    const escopo: SQL[] = [sql`m.ciclo_id = ${cicloId}`];
    const situacao: SQL[] = [];

    if (filtro.busca) {
      const termo = `%${filtro.busca}%`;
      escopo.push(sql`(
        m.codigo ilike ${termo}
        or m.titulo ilike ${termo}
        or exists (
          select 1
            from atividade_missao a
            left join instituicao i on i.id = a.instituicao_id
           where a.missao_id = m.id
             and (
               a.titulo ilike ${termo}
               or a.evento_nome ilike ${termo}
               or a.instituicao_nome ilike ${termo}
               or i.nome ilike ${termo}
               or i.sigla ilike ${termo}
             )
        )
      )`);
    }

    // Exercicio: a missao entra se atravessa o ano, e nao apenas se comeca nele.
    if (filtro.ano !== undefined) {
      escopo.push(
        sql`extract(year from m.data_inicio) <= ${filtro.ano}
            and extract(year from m.data_fim) >= ${filtro.ano}`,
      );
    }
    if (filtro.de) escopo.push(sql`m.data_fim >= ${filtro.de}`);
    if (filtro.ate) escopo.push(sql`m.data_inicio <= ${filtro.ate}`);

    if (filtro.paisId) {
      escopo.push(sql`exists (
        select 1 from atividade_missao a
         where a.missao_id = m.id and a.pais_id = ${filtro.paisId}
      )`);
    }
    // `exists`, e nao join: a missao multirrede tem que aparecer uma unica vez
    // em "todas as redes" e contar uma unica vez no resumo (CG-016).
    if (filtro.redeId) {
      escopo.push(sql`exists (
        select 1 from missao_rede mr
         where mr.missao_id = m.id and mr.rede_id = ${filtro.redeId}
      )`);
    }
    if (filtro.pessoaId) {
      escopo.push(sql`exists (
        select 1 from missao_participante p
         where p.missao_id = m.id and p.pessoa_id = ${filtro.pessoaId}
      )`);
    }
    // Casa pela pessoa, e nao pelo membro_equipe_id: a missao continua sendo de
    // uma equipe mesmo quando o vinculo nao foi apontado no cadastro.
    if (filtro.tipoEquipe) {
      escopo.push(sql`exists (
        select 1
          from missao_participante p
          join membro_equipe_gestao me
            on me.pessoa_id = p.pessoa_id and me.ciclo_id = m.ciclo_id
         where p.missao_id = m.id and me.tipo_equipe = ${filtro.tipoEquipe}
      )`);
    }
    if (filtro.status) situacao.push(sql`m.status = ${filtro.status}`);

    const situacaoTemporal = sql`case
      when m.data_fim < current_date then 'ENCERRADA'
      when m.data_inicio > current_date then 'FUTURA'
      else 'EM_ANDAMENTO'
    end`;
    const situacaoPrestacao = sql`'NAO_INICIADA'::text`;

    if (filtro.situacaoTemporal) {
      situacao.push(sql`${situacaoTemporal} = ${filtro.situacaoTemporal}`);
    }
    if (filtro.situacaoPrestacao) {
      situacao.push(sql`${situacaoPrestacao} = ${filtro.situacaoPrestacao}`);
    }

    // Colunas e direcao vem de listas fechadas; `sql.raw` aqui nao toca em
    // nenhum valor vindo do usuario.
    const coluna = sql.raw(ordenacoes[filtro.ordenar]);
    const direcao = sql.raw(filtro.direcao);
    const deslocamento = (filtro.pagina - 1) * filtro.tamanho;

    const linhas = await consultar<{
      id: string;
      codigo: string;
      titulo: string;
      data_inicio: string;
      data_fim: string;
      status: MissaoResumo['status'];
      situacao_temporal: MissaoResumo['situacaoTemporal'];
      situacao_prestacao: MissaoResumo['situacaoPrestacao'];
      participantes: string;
      atividades: string;
      paises: string[];
      redes: string[];
      valor_prestado: string | null;
      total: string;
    }>(
      this.db,
      sql`
        select m.id,
               m.codigo,
               m.titulo,
               m.data_inicio,
               m.data_fim,
               m.status,
               ${situacaoTemporal} as situacao_temporal,
               ${situacaoPrestacao} as situacao_prestacao,
               (select count(*) from missao_participante p
                 where p.missao_id = m.id) as participantes,
               (select count(*) from atividade_missao a
                 where a.missao_id = m.id) as atividades,
               coalesce(
                 (select array_agg(distinct pa.nome)
                    from atividade_missao a
                    join pais pa on pa.id = a.pais_id
                   where a.missao_id = m.id),
                 '{}'
               ) as paises,
               coalesce(
                 (select array_agg(r.nome order by r.nome)
                    from missao_rede mr
                    join rede_coordenadora r on r.id = mr.rede_id
                   where mr.missao_id = m.id),
                 '{}'
               ) as redes,
               null::text as valor_prestado,
               count(*) over () as total
          from missao_comite m
         where ${sql.join([...escopo, ...situacao], sql` and `)}
         order by ${coluna} ${direcao}, m.codigo ${direcao}
         limit ${filtro.tamanho} offset ${deslocamento}
      `,
    );

    const [contagens] = await consultar<{
      total: string;
      rascunho: string;
      planejada: string;
      confirmada: string;
      concluida: string;
      cancelada: string;
      futura: string;
      em_andamento: string;
      encerrada: string;
    }>(
      this.db,
      sql`
        select count(*) as total,
               count(*) filter (where m.status = 'RASCUNHO') as rascunho,
               count(*) filter (where m.status = 'PLANEJADA') as planejada,
               count(*) filter (where m.status = 'CONFIRMADA') as confirmada,
               count(*) filter (where m.status = 'CONCLUIDA') as concluida,
               count(*) filter (where m.status = 'CANCELADA') as cancelada,
               count(*) filter (where ${situacaoTemporal} = 'FUTURA') as futura,
               count(*) filter (where ${situacaoTemporal} = 'EM_ANDAMENTO')
                 as em_andamento,
               count(*) filter (where ${situacaoTemporal} = 'ENCERRADA')
                 as encerrada
          from missao_comite m
         where ${sql.join(escopo, sql` and `)}
      `,
    );

    const total = Number(linhas[0]?.total ?? 0);
    return {
      itens: linhas.map((linha) => ({
        id: linha.id,
        codigo: linha.codigo,
        titulo: linha.titulo,
        dataInicio: linha.data_inicio,
        dataFim: linha.data_fim,
        status: linha.status,
        situacaoTemporal: linha.situacao_temporal,
        situacaoPrestacao: linha.situacao_prestacao,
        participantes: Number(linha.participantes),
        atividades: Number(linha.atividades),
        paises: [...linha.paises].sort((a, b) => a.localeCompare(b, 'pt-BR')),
        redes: linha.redes,
        valorPrestado: linha.valor_prestado,
      })),
      total,
      pagina: filtro.pagina,
      tamanho: filtro.tamanho,
      paginas: Math.max(1, Math.ceil(total / filtro.tamanho)),
      resumo: {
        total: Number(contagens.total),
        porStatus: {
          RASCUNHO: Number(contagens.rascunho),
          PLANEJADA: Number(contagens.planejada),
          CONFIRMADA: Number(contagens.confirmada),
          CONCLUIDA: Number(contagens.concluida),
          CANCELADA: Number(contagens.cancelada),
        },
        porSituacaoTemporal: {
          FUTURA: Number(contagens.futura),
          EM_ANDAMENTO: Number(contagens.em_andamento),
          ENCERRADA: Number(contagens.encerrada),
        },
        // Realizada e a missao concluida. Cancelada nunca entra aqui, ainda que
        // suas datas ja tenham passado.
        realizadas: Number(contagens.concluida),
        canceladas: Number(contagens.cancelada),
      },
    };
  }

  /**
   * Detalhe completo da missao.
   *
   * Prestacao e documentos ainda nao existem no schema (CG-013/CG-014). Em vez
   * de omiti-los, o contrato ja os declara vazios e explicitos: a tela de
   * detalhe pode ser construida agora e nao muda de formato quando a prestacao
   * chegar.
   */
  async detalhe(cicloId: string, id: string): Promise<MissaoDetalhe> {
    const missao = await this.db.query.missaoComite.findFirst({
      where: and(
        eq(s.missaoComite.id, id),
        eq(s.missaoComite.cicloId, cicloId),
      ),
      with: {
        participantes: {
          with: {
            pessoa: { with: { ppg: true, instituicao: true } },
            membroEquipe: true,
          },
        },
        atividades: { with: { pais: true, instituicao: true } },
        redes: { with: { rede: true } },
      },
    });
    if (!missao) throw new NotFoundException('Missao nao encontrada.');

    const historico = await this.db
      .select({
        id: s.registroAuditoria.id,
        acao: s.registroAuditoria.acao,
        campo: s.registroAuditoria.campo,
        valorAnterior: s.registroAuditoria.valorAnterior,
        valorNovo: s.registroAuditoria.valorNovo,
        justificativa: s.registroAuditoria.justificativa,
        usuarioNome: s.registroAuditoria.usuarioNome,
        ocorridoEm: s.registroAuditoria.ocorridoEm,
      })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeTipo, 'MISSAO_COMITE'),
          eq(s.registroAuditoria.entidadeId, id),
        ),
      )
      .orderBy(desc(s.registroAuditoria.ocorridoEm));

    const atividades = [...missao.atividades]
      .sort((a, b) => a.ordem - b.ordem)
      .map((atividade) => ({
        id: atividade.id,
        ordem: atividade.ordem,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        paisId: atividade.paisId,
        pais: atividade.pais.nome,
        cidade: atividade.cidade,
        instituicaoId: atividade.instituicaoId,
        instituicao: atividade.instituicao?.nome ?? atividade.instituicaoNome,
        instituicaoDoCatalogo: atividade.instituicaoId !== null,
        eventoNome: atividade.eventoNome,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        planejamento: atividade.planejamento,
        relatoRealizado: atividade.relatoRealizado,
        resultados: atividade.resultados,
        status: atividade.status,
        naoPrevista: atividade.naoPrevista,
        justificativaInclusao: atividade.justificativaInclusao,
        observacoes: atividade.observacoes,
      }));

    return {
      id: missao.id,
      codigo: missao.codigo,
      titulo: missao.titulo,
      objetivo: missao.objetivo,
      dataInicio: missao.dataInicio,
      dataFim: missao.dataFim,
      status: missao.status,
      situacaoTemporal: situacaoTemporalDe(missao.dataInicio, missao.dataFim),
      relatoGeral: missao.relatoGeral,
      resultados: missao.resultados,
      observacoes: missao.observacoes,
      criadoEm: missao.criadoEm.toISOString(),
      atualizadoEm: missao.atualizadoEm.toISOString(),
      redes: missao.redes
        .map((vinculo) => ({ id: vinculo.rede.id, nome: vinculo.rede.nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
      participantes: missao.participantes
        .map((participante) => ({
          id: participante.id,
          pessoaId: participante.pessoaId,
          nome: participante.pessoa.nome,
          email: participante.pessoa.email,
          tipoPessoa: participante.pessoa.tipo,
          ppg: participante.pessoa.ppg?.sigla ?? null,
          instituicao: participante.pessoa.instituicao?.sigla ?? null,
          papel: participante.papel,
          membroEquipeId: participante.membroEquipeId,
          tipoEquipe: participante.membroEquipe?.tipoEquipe ?? null,
          funcaoEquipe: participante.membroEquipe?.funcao ?? null,
          observacoes: participante.observacoes,
        }))
        // Responsavel primeiro; o resto em ordem alfabetica.
        .sort(
          (a, b) =>
            papeisMissao.indexOf(a.papel) - papeisMissao.indexOf(b.papel) ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
        ),
      atividades,
      paises: [...new Set(atividades.map((atividade) => atividade.pais))].sort(
        (a, b) => a.localeCompare(b, 'pt-BR'),
      ),
      prestacao: null,
      situacaoPrestacao: 'NAO_INICIADA',
      totais: {
        passagens: null,
        diarias: null,
        geral: null,
        porExercicio: [],
      },
      documentos: [],
      historico: historico.map((registro) => ({
        ...registro,
        ocorridoEm: registro.ocorridoEm.toISOString(),
      })),
    };
  }

  /**
   * Edita a missao preservando a identidade do que ja existe.
   *
   * Participantes e atividades sao reconciliados, e nao apagados e recriados: o
   * participante que permanece mantem o mesmo id, porque a despesa da prestacao
   * vai apontar para ele (CG-013). Trocar tudo a cada salvamento levaria a
   * prestacao junto.
   */
  async atualizar(
    cicloId: string,
    id: string,
    dto: AtualizarMissaoComite,
    usuario: AuthUser,
  ): Promise<MissaoDetalhe> {
    const anterior = await this.detalhe(cicloId, id);

    if (anterior.status === 'CONCLUIDA' || anterior.status === 'CANCELADA') {
      throw new ConflictException(
        'Missao concluida ou cancelada nao pode ser editada.',
      );
    }

    await this.db.transaction(async (tx) => {
      const auditoria: (typeof s.registroAuditoria.$inferInsert)[] = [];
      const registrar = (
        campo: string,
        valorAnterior: string | null,
        valorNovo: string | null,
      ) => {
        auditoria.push({
          entidadeTipo: 'MISSAO_COMITE',
          entidadeId: id,
          acao: 'EDICAO',
          campo,
          valorAnterior,
          valorNovo,
          justificativa: dto.justificativa ?? null,
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
      };

      const basicos = {
        titulo: dto.titulo,
        objetivo: dto.objetivo,
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        observacoes: dto.observacoes ?? null,
      };
      const camposAlterados = Object.entries(basicos).filter(
        ([campo, valor]) => anterior[campo as keyof typeof basicos] !== valor,
      );

      const mudancaParticipantes = await this.reconciliarParticipantes(
        cicloId,
        id,
        anterior,
        dto,
        usuario,
        registrar,
        tx,
      );
      const mudancaAtividades = await this.reconciliarAtividades(
        id,
        anterior,
        dto,
        registrar,
        tx,
      );
      const mudancaRedes = await this.reconciliarRedes(
        cicloId,
        id,
        anterior,
        dto,
        registrar,
        tx,
      );

      // Trocar a rede de uma missao confirmada muda de quem e o compromisso e
      // para qual painel ela passa a contar, entao entra junto de datas,
      // participantes e roteiro na exigencia de justificativa.
      const sensivelAlterado =
        camposAlterados.some(([campo]) =>
          ['dataInicio', 'dataFim'].includes(campo),
        ) ||
        mudancaParticipantes ||
        mudancaAtividades ||
        mudancaRedes;

      if (
        !camposAlterados.length &&
        !mudancaParticipantes &&
        !mudancaAtividades &&
        !mudancaRedes
      ) {
        throw new BadRequestException('Nenhum dado da missao foi alterado.');
      }

      // Depois de confirmada a missao ja e compromisso institucional: mexer em
      // datas, participantes ou roteiro precisa dizer por que.
      if (
        anterior.status === 'CONFIRMADA' &&
        sensivelAlterado &&
        !dto.justificativa
      ) {
        throw new BadRequestException(
          'Informe a justificativa para alterar datas, redes, participantes ou roteiro de uma missao confirmada.',
        );
      }

      for (const [campo, valor] of camposAlterados) {
        registrar(
          campo,
          serializarValor(anterior[campo as keyof typeof basicos]),
          serializarValor(valor),
        );
      }

      await tx
        .update(s.missaoComite)
        .set({ ...basicos, atualizadoEm: new Date() })
        .where(eq(s.missaoComite.id, id));

      await tx.insert(s.registroAuditoria).values(auditoria);
    });

    return this.detalhe(cicloId, id);
  }

  /** Insere, atualiza e remove participantes casando pela pessoa. */
  private async reconciliarParticipantes(
    cicloId: string,
    missaoId: string,
    anterior: MissaoDetalhe,
    dto: AtualizarMissaoComite,
    usuario: AuthUser,
    registrar: (
      campo: string,
      valorAnterior: string | null,
      valorNovo: string | null,
    ) => void,
    tx: DbTransacional & Pick<Database, 'update' | 'delete'>,
  ): Promise<boolean> {
    let mudou = false;
    const desejados: {
      pessoaId: string;
      papel: (typeof papeisMissao)[number];
      membroEquipeId: string | null;
      observacoes: string | null;
      nome: string;
    }[] = [];

    for (const participante of dto.participantes) {
      const pessoaId = participante.novaPessoa
        ? await this.criarPessoa(participante.novaPessoa, usuario, tx)
        : participante.pessoaId!;
      await this.validarPessoa(pessoaId, tx);
      if (participante.membroEquipeId) {
        await this.validarMembroEquipe(
          participante.membroEquipeId,
          cicloId,
          pessoaId,
          tx,
        );
      }
      const [pessoa] = await tx
        .select({ nome: s.pessoa.nome })
        .from(s.pessoa)
        .where(eq(s.pessoa.id, pessoaId))
        .limit(1);
      desejados.push({
        pessoaId,
        papel: participante.papel,
        membroEquipeId: participante.membroEquipeId ?? null,
        observacoes: participante.observacoes ?? null,
        nome: pessoa.nome,
      });
    }

    const atuais = new Map(
      anterior.participantes.map((participante) => [
        participante.pessoaId,
        participante,
      ]),
    );

    for (const desejado of desejados) {
      const atual = atuais.get(desejado.pessoaId);
      if (!atual) {
        await tx.insert(s.missaoParticipante).values({
          missaoId,
          pessoaId: desejado.pessoaId,
          membroEquipeId: desejado.membroEquipeId,
          papel: desejado.papel,
          observacoes: desejado.observacoes,
        });
        registrar('participantes', null, desejado.nome);
        mudou = true;
        continue;
      }
      if (
        atual.papel !== desejado.papel ||
        atual.membroEquipeId !== desejado.membroEquipeId ||
        atual.observacoes !== desejado.observacoes
      ) {
        await tx
          .update(s.missaoParticipante)
          .set({
            papel: desejado.papel,
            membroEquipeId: desejado.membroEquipeId,
            observacoes: desejado.observacoes,
            atualizadoEm: new Date(),
          })
          .where(eq(s.missaoParticipante.id, atual.id));
        registrar(
          'participantes',
          `${desejado.nome}: ${atual.papel}`,
          `${desejado.nome}: ${desejado.papel}`,
        );
        mudou = true;
      }
    }

    const mantidos = new Set(desejados.map((desejado) => desejado.pessoaId));
    for (const atual of anterior.participantes) {
      if (mantidos.has(atual.pessoaId)) continue;
      await tx
        .delete(s.missaoParticipante)
        .where(eq(s.missaoParticipante.id, atual.id));
      registrar('participantes', atual.nome, null);
      mudou = true;
    }

    return mudou;
  }

  /** Insere, atualiza e remove atividades casando pelo id enviado. */
  private async reconciliarAtividades(
    missaoId: string,
    anterior: MissaoDetalhe,
    dto: AtualizarMissaoComite,
    registrar: (
      campo: string,
      valorAnterior: string | null,
      valorNovo: string | null,
    ) => void,
    tx: DbTransacional & Pick<Database, 'update' | 'delete'>,
  ): Promise<boolean> {
    await this.validarReferenciasAtividades(dto.atividades, tx);

    let mudou = false;
    const atuais = new Map(
      anterior.atividades.map((atividade) => [atividade.id, atividade]),
    );
    const enviados = new Set(
      dto.atividades
        .map((atividade) => atividade.id)
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of enviados) {
      if (!atuais.has(id)) {
        throw new NotFoundException('Atividade nao pertence a esta missao.');
      }
    }

    // Atividade nao prevista pertence ao relato, nao ao planejamento: o
    // endpoint de edicao a ignora por completo, para nao apaga-la nem
    // reclassifica-la como planejada.
    const doRelato = new Set(
      anterior.atividades
        .filter((atividade) => atividade.naoPrevista)
        .map((atividade) => atividade.id),
    );
    for (const id of enviados) {
      if (doRelato.has(id)) {
        throw new BadRequestException(
          'Atividade nao prevista e alterada pelo relato, nao pela edicao da missao.',
        );
      }
    }

    // Remocoes primeiro, e so entao a renumeracao. A ordem sobrevivente e
    // afastada para uma faixa alta antes de receber o valor final porque
    // `atividade_missao_ordem_uk` e imediata: promover a segunda parada a
    // primeira colidiria com a linha que ainda ocupa a posicao 1.
    for (const atual of anterior.atividades) {
      if (enviados.has(atual.id) || doRelato.has(atual.id)) continue;
      await tx
        .delete(s.atividadeMissao)
        .where(eq(s.atividadeMissao.id, atual.id));
      registrar('atividades', atual.titulo, null);
      mudou = true;
    }

    await tx
      .update(s.atividadeMissao)
      .set({ ordem: sql`${s.atividadeMissao.ordem} + ${DESLOCAMENTO_ORDEM}` })
      .where(eq(s.atividadeMissao.missaoId, missaoId));

    for (const [indice, atividade] of dto.atividades.entries()) {
      const valores = {
        ordem: indice + 1,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        paisId: atividade.paisId,
        cidade: atividade.cidade ?? null,
        instituicaoId: atividade.instituicaoId ?? null,
        instituicaoNome: atividade.instituicaoNome ?? null,
        eventoNome: atividade.eventoNome ?? null,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        planejamento: atividade.planejamento ?? null,
        observacoes: atividade.observacoes ?? null,
      };

      if (!atividade.id) {
        await tx.insert(s.atividadeMissao).values({ missaoId, ...valores });
        registrar('atividades', null, atividade.titulo);
        mudou = true;
        continue;
      }

      const atual = atuais.get(atividade.id)!;
      const diferente =
        atual.ordem !== valores.ordem ||
        atual.tipo !== valores.tipo ||
        atual.titulo !== valores.titulo ||
        atual.paisId !== valores.paisId ||
        atual.cidade !== valores.cidade ||
        atual.instituicaoId !== valores.instituicaoId ||
        atual.eventoNome !== valores.eventoNome ||
        atual.dataInicio !== valores.dataInicio ||
        atual.dataFim !== valores.dataFim ||
        atual.planejamento !== valores.planejamento ||
        atual.observacoes !== valores.observacoes;

      // A escrita e incondicional: mesmo sem mudanca de conteudo, a linha
      // precisa sair da faixa de deslocamento e voltar a ordem final.
      await tx
        .update(s.atividadeMissao)
        .set({
          ...valores,
          ...(diferente ? { atualizadoEm: new Date() } : {}),
        })
        .where(eq(s.atividadeMissao.id, atividade.id));
      if (diferente) {
        registrar('atividades', atual.titulo, valores.titulo);
        mudou = true;
      }
    }

    // As nao previstas nao vem no payload, mas tambem sairam da faixa de
    // deslocamento: voltam logo depois do roteiro planejado, preservando a
    // leitura "primeiro o que foi planejado, depois o que aconteceu a mais".
    const naoPrevistas = anterior.atividades.filter((atividade) =>
      doRelato.has(atividade.id),
    );
    for (const [indice, atividade] of naoPrevistas.entries()) {
      await tx
        .update(s.atividadeMissao)
        .set({ ordem: dto.atividades.length + indice + 1 })
        .where(eq(s.atividadeMissao.id, atividade.id));
    }

    // O pais e o dado do roteiro que a governanca acompanha de perto; por isso
    // ele vira uma entrada propria, alem da entrada da atividade.
    const paisesDepois = await tx
      .select({ nome: s.pais.nome })
      .from(s.atividadeMissao)
      .innerJoin(s.pais, eq(s.pais.id, s.atividadeMissao.paisId))
      .where(eq(s.atividadeMissao.missaoId, missaoId));
    const depois = [...new Set(paisesDepois.map((linha) => linha.nome))].sort();
    const antes = [...anterior.paises].sort();
    if (antes.join(', ') !== depois.join(', ')) {
      registrar('paises', antes.join(', ') || null, depois.join(', ') || null);
      mudou = true;
    }

    return mudou;
  }

  /**
   * Confirma, conclui ou cancela a missao.
   *
   * Cancelar exige justificativa: e a unica saida que encerra a missao sem que
   * ela tenha acontecido, e o motivo precisa ficar no historico.
   */
  async transicionar(
    cicloId: string,
    id: string,
    dto: TransicaoMissao,
    usuario: AuthUser,
  ): Promise<MissaoDetalhe> {
    const missao = await this.detalhe(cicloId, id);
    const origens: readonly string[] = ORIGENS_PERMITIDAS[dto.acao];

    if (!origens.includes(missao.status)) {
      throw new ConflictException(
        `Missao ${rotuloStatus(missao.status)} nao aceita a acao ${dto.acao.toLowerCase()}.`,
      );
    }
    if (dto.acao === 'CONCLUIR') this.exigirRelatoMinimo(missao);
    if (dto.acao === 'CANCELAR' && !dto.justificativa) {
      throw new BadRequestException(
        'Informe a justificativa do cancelamento da missao.',
      );
    }

    return this.gravarStatus(
      cicloId,
      id,
      missao.status,
      DESTINOS[dto.acao],
      dto.justificativa ?? null,
      usuario,
    );
  }

  /**
   * Reabre uma missao concluida ou cancelada, devolvendo-a a PLANEJADA.
   *
   * E operacao administrativa, e nao parte do fluxo normal: exige a permissao
   * `missao:edit` no controller e justificativa obrigatoria aqui.
   */
  async reabrir(
    cicloId: string,
    id: string,
    dto: ReaberturaMissao,
    usuario: AuthUser,
  ): Promise<MissaoDetalhe> {
    const missao = await this.detalhe(cicloId, id);
    if (missao.status !== 'CONCLUIDA' && missao.status !== 'CANCELADA') {
      throw new ConflictException(
        'Apenas missao concluida ou cancelada pode ser reaberta.',
      );
    }

    return this.gravarStatus(
      cicloId,
      id,
      missao.status,
      'PLANEJADA',
      dto.justificativa,
      usuario,
    );
  }

  private async gravarStatus(
    cicloId: string,
    id: string,
    anterior: (typeof statusMissao)[number],
    novo: (typeof statusMissao)[number],
    justificativa: string | null,
    usuario: AuthUser,
  ): Promise<MissaoDetalhe> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(s.missaoComite)
        .set({ status: novo, atualizadoEm: new Date() })
        .where(eq(s.missaoComite.id, id));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: id,
        acao: 'EDICAO',
        campo: 'status',
        valorAnterior: anterior,
        valorNovo: novo,
        justificativa,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });

    return this.detalhe(cicloId, id);
  }

  /**
   * Registra o que aconteceu na missao, sem tocar no planejamento.
   *
   * A atividade nao prevista entra marcada como tal e com justificativa: no
   * relatorio ela precisa continuar visivelmente diferente do que foi planejado
   * desde o inicio.
   */
  async relatar(
    cicloId: string,
    id: string,
    dto: RelatarMissao,
    usuario: AuthUser,
  ): Promise<MissaoDetalhe> {
    const anterior = await this.detalhe(cicloId, id);
    if (anterior.status === 'CANCELADA') {
      throw new ConflictException('Missao cancelada nao recebe relato.');
    }

    const conhecidas = new Map(
      anterior.atividades.map((atividade) => [atividade.id, atividade]),
    );
    for (const atividade of dto.atividades) {
      if (!conhecidas.has(atividade.id)) {
        throw new NotFoundException('Atividade nao pertence a esta missao.');
      }
    }
    await this.validarReferenciasAtividades(
      dto.atividadesNaoPrevistas,
      this.db,
    );

    await this.db.transaction(async (tx) => {
      const auditoria: (typeof s.registroAuditoria.$inferInsert)[] = [];
      const registrar = (
        campo: string,
        valorAnterior: string | null,
        valorNovo: string | null,
        justificativa: string | null = null,
      ) => {
        auditoria.push({
          entidadeTipo: 'MISSAO_COMITE',
          entidadeId: id,
          acao: 'EDICAO',
          campo,
          valorAnterior,
          valorNovo,
          justificativa,
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
      };

      const resultados = dto.resultados ?? null;
      if (anterior.relatoGeral !== dto.relatoGeral) {
        registrar('relatoGeral', anterior.relatoGeral, dto.relatoGeral);
      }
      if (anterior.resultados !== resultados) {
        registrar('resultados', anterior.resultados, resultados);
      }
      await tx
        .update(s.missaoComite)
        .set({
          relatoGeral: dto.relatoGeral,
          resultados,
          atualizadoEm: new Date(),
        })
        .where(eq(s.missaoComite.id, id));

      for (const atividade of dto.atividades) {
        const atual = conhecidas.get(atividade.id)!;
        await tx
          .update(s.atividadeMissao)
          .set({
            status: atividade.status,
            relatoRealizado: atividade.relatoRealizado ?? null,
            resultados: atividade.resultados ?? null,
            observacoes: atividade.observacoes ?? null,
            atualizadoEm: new Date(),
          })
          .where(eq(s.atividadeMissao.id, atividade.id));
        if (atual.status !== atividade.status) {
          registrar(
            'atividades.status',
            `${atual.titulo}: ${atual.status}`,
            `${atual.titulo}: ${atividade.status}`,
          );
        }
      }

      // As nao previstas entram no fim do roteiro, depois do que foi planejado.
      let ordem = anterior.atividades.length;
      for (const atividade of dto.atividadesNaoPrevistas) {
        ordem += 1;
        await tx.insert(s.atividadeMissao).values({
          missaoId: id,
          ordem,
          tipo: atividade.tipo,
          titulo: atividade.titulo,
          paisId: atividade.paisId,
          cidade: atividade.cidade ?? null,
          instituicaoId: atividade.instituicaoId ?? null,
          instituicaoNome: atividade.instituicaoNome ?? null,
          eventoNome: atividade.eventoNome ?? null,
          dataInicio: atividade.dataInicio,
          dataFim: atividade.dataFim,
          // Nao previsto nao tem planejamento: preencher aqui apagaria a
          // distincao que a coluna existe para preservar.
          planejamento: null,
          relatoRealizado: atividade.relatoRealizado,
          resultados: atividade.resultados ?? null,
          status: 'REALIZADA',
          naoPrevista: true,
          justificativaInclusao: atividade.justificativa,
          observacoes: atividade.observacoes ?? null,
        });
        registrar(
          'atividades.naoPrevista',
          null,
          atividade.titulo,
          atividade.justificativa,
        );
      }

      if (auditoria.length > 0) {
        await tx.insert(s.registroAuditoria).values(auditoria);
      }
    });

    return this.detalhe(cicloId, id);
  }

  /**
   * Relato minimo para concluir: o que aconteceu na missao como um todo e o
   * desfecho de cada parada do roteiro. Sem isso, "concluida" nao diria nada
   * alem de a data ter passado.
   */
  private exigirRelatoMinimo(missao: MissaoDetalhe): void {
    if (!missao.relatoGeral) {
      throw new BadRequestException(
        'Registre o relato da missao antes de conclui-la.',
      );
    }
    const pendentes = missao.atividades.filter(
      (atividade) => atividade.status === 'PLANEJADA',
    );
    if (pendentes.length > 0) {
      throw new BadRequestException(
        `Informe o que aconteceu em cada atividade do roteiro antes de concluir. Pendentes: ${pendentes
          .map((atividade) => atividade.titulo)
          .join(', ')}.`,
      );
    }
  }

  private async proximoCodigo(
    cicloId: string,
    db: DbTransacional,
  ): Promise<string> {
    // A trava por ciclo impede duas requisicoes simultaneas de escolherem o
    // mesmo numero antes que o indice unico consiga arbitrar a corrida.
    await db.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${`missao:${cicloId}`}, 0))`,
    );
    const resultado = await db.execute<{ proximo: number }>(sql`
      select coalesce(max(substring(codigo from '[0-9]+$')::integer), 0) + 1
               as proximo
        from missao_comite
       where ciclo_id = ${cicloId}
    `);
    const proximo = Number(resultado.rows[0]?.proximo ?? 1);
    return `MCG-${String(proximo).padStart(3, '0')}`;
  }

  private async criarPessoa(
    dto: PessoaRapida,
    usuario: AuthUser,
    db: DbTransacional,
  ): Promise<string> {
    const filtros = [
      dto.cpf ? eq(s.pessoa.cpf, dto.cpf) : undefined,
      dto.email ? eq(s.pessoa.email, dto.email) : undefined,
    ].filter((filtro): filtro is NonNullable<typeof filtro> => Boolean(filtro));
    if (filtros.length > 0) {
      const [existente] = await db
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(or(...filtros))
        .limit(1);
      if (existente) {
        throw new ConflictException(
          'Ja existe uma pessoa cadastrada com este CPF ou e-mail.',
        );
      }
    }

    const [pessoa] = await db
      .insert(s.pessoa)
      .values({
        nome: dto.nome,
        email: dto.email ?? null,
        cpf: dto.cpf ?? null,
        tipo: dto.tipo,
        ppgId: dto.ppgId ?? null,
        instituicaoId: dto.instituicaoId ?? null,
      })
      .returning({ id: s.pessoa.id, nome: s.pessoa.nome, tipo: s.pessoa.tipo });

    await db.insert(s.registroAuditoria).values({
      entidadeTipo: 'PESSOA',
      entidadeId: pessoa.id,
      acao: 'CRIACAO',
      valorNovo: JSON.stringify({ nome: pessoa.nome, tipo: pessoa.tipo }),
      usuarioId: usuario.id,
      usuarioNome: nomeDoUsuario(usuario),
    });
    return pessoa.id;
  }

  private async validarPessoa(
    pessoaId: string,
    db: DbTransacional,
  ): Promise<void> {
    const [pessoa] = await db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(and(eq(s.pessoa.id, pessoaId), eq(s.pessoa.ativo, true)))
      .limit(1);
    if (!pessoa) throw new NotFoundException('Pessoa nao encontrada.');
  }

  private async validarMembroEquipe(
    membroId: string,
    cicloId: string,
    pessoaId: string,
    db: DbTransacional,
  ): Promise<void> {
    const [membro] = await db
      .select({ id: s.membroEquipeGestao.id })
      .from(s.membroEquipeGestao)
      .where(
        and(
          eq(s.membroEquipeGestao.id, membroId),
          eq(s.membroEquipeGestao.cicloId, cicloId),
          eq(s.membroEquipeGestao.pessoaId, pessoaId),
        ),
      )
      .limit(1);
    if (!membro) {
      throw new BadRequestException(
        'O vinculo de equipe nao pertence a esta pessoa e ciclo.',
      );
    }
  }

  /**
   * Confere que toda rede existe e pertence ao ciclo da missao.
   *
   * `rede_coordenadora` e por ciclo, entao a chave estrangeira sozinha aceitaria
   * a rede UFMG do ciclo 2031-2034 em uma missao de 2027-2030 — dois registros
   * validos que juntos nao fazem sentido.
   */
  private async validarRedes(
    redes: string[],
    cicloId: string,
    db: DbTransacional,
  ): Promise<void> {
    const encontradas = await db
      .select({ id: s.redeCoordenadora.id })
      .from(s.redeCoordenadora)
      .where(
        and(
          inArray(s.redeCoordenadora.id, redes),
          eq(s.redeCoordenadora.cicloId, cicloId),
        ),
      );
    if (encontradas.length !== redes.length) {
      throw new BadRequestException(
        'Alguma rede informada nao existe neste ciclo.',
      );
    }
  }

  /** Insere e remove redes, registrando cada mudanca em auditoria propria. */
  private async reconciliarRedes(
    cicloId: string,
    missaoId: string,
    anterior: MissaoDetalhe,
    dto: AtualizarMissaoComite,
    registrar: (
      campo: string,
      valorAnterior: string | null,
      valorNovo: string | null,
    ) => void,
    tx: DbTransacional & Pick<Database, 'update' | 'delete'>,
  ): Promise<boolean> {
    await this.validarRedes(dto.redes, cicloId, tx);

    const atuais = new Map(anterior.redes.map((rede) => [rede.id, rede.nome]));
    const desejadas = new Set(dto.redes);

    const incluir = dto.redes.filter((redeId) => !atuais.has(redeId));
    const remover = [...atuais.keys()].filter(
      (redeId) => !desejadas.has(redeId),
    );
    if (!incluir.length && !remover.length) return false;

    if (incluir.length) {
      await tx
        .insert(s.missaoRede)
        .values(incluir.map((redeId) => ({ missaoId, redeId })));
    }
    if (remover.length) {
      await tx
        .delete(s.missaoRede)
        .where(
          and(
            eq(s.missaoRede.missaoId, missaoId),
            inArray(s.missaoRede.redeId, remover),
          ),
        );
    }

    // Uma entrada por rede, e nao um diff de lista: o historico precisa
    // responder "quando a UNESP entrou nesta missao" sem reler o JSON inteiro.
    const nomes = await tx
      .select({ id: s.redeCoordenadora.id, nome: s.redeCoordenadora.nome })
      .from(s.redeCoordenadora)
      .where(inArray(s.redeCoordenadora.id, [...incluir, ...remover]));
    const nomeDe = new Map(nomes.map((rede) => [rede.id, rede.nome]));

    for (const redeId of incluir) {
      registrar('redes', null, nomeDe.get(redeId) ?? redeId);
    }
    for (const redeId of remover) {
      registrar('redes', atuais.get(redeId) ?? redeId, null);
    }
    return true;
  }

  private async validarReferenciasAtividades(
    atividades: CriarMissaoComite['atividades'],
    db: DbTransacional,
  ): Promise<void> {
    const paises = [
      ...new Set(atividades.map((atividade) => atividade.paisId)),
    ];
    const paisesExistentes = await db
      .select({ id: s.pais.id })
      .from(s.pais)
      .where(inArray(s.pais.id, paises));
    if (paisesExistentes.length !== paises.length) {
      throw new NotFoundException('Pais do roteiro nao encontrado.');
    }

    const instituicoes = [
      ...new Set(
        atividades
          .map((atividade) => atividade.instituicaoId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (instituicoes.length === 0) return;
    const instituicoesExistentes = await db
      .select({ id: s.instituicao.id })
      .from(s.instituicao)
      .where(inArray(s.instituicao.id, instituicoes));
    if (instituicoesExistentes.length !== instituicoes.length) {
      throw new NotFoundException('Instituicao do roteiro nao encontrada.');
    }
  }
}

function dataIsoValida(valor: string): boolean {
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}

/** Mesma regra do CASE usado na listagem, para o detalhe nao divergir dela. */
function situacaoTemporalDe(
  dataInicio: string,
  dataFim: string,
): (typeof situacoesTemporais)[number] {
  const hoje = new Date().toISOString().slice(0, 10);
  if (dataFim < hoje) return 'ENCERRADA';
  if (dataInicio > hoje) return 'FUTURA';
  return 'EM_ANDAMENTO';
}

function serializarValor(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}

function rotuloStatus(status: (typeof statusMissao)[number]): string {
  return status.toLowerCase();
}
