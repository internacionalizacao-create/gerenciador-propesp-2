import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { dataHojeEmManaus } from '../comum/datas';

import type { AuthUser } from '../auth/auth-user';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import {
  destinatariosDaMissao,
  NotificacoesService,
} from './notificacoes.service';
import { categoriaPermitidaParaDespesa } from './documentos-prestacao';

/**
 * Prestação de contas da missão — CRUD e cálculos (CG-050).
 *
 * **Nenhum total é persistido.** Todos saem de `sum(...)` em `numeric` no
 * próprio Postgres e chegam à aplicação como `string`. Converter para `number`
 * no limite do banco reintroduziria justamente o erro de centavo que o
 * `numeric` evita, e é o que o critério de aceite proíbe.
 *
 * Fora de escopo aqui, de propósito: **enviar e validar** a prestação é a
 * CG-054. Este serviço mantém a prestação em `EM_PREENCHIMENTO` e recusa
 * alteração depois que ela sai desse estado — quem já enviou não corrige a
 * despesa por baixo do pano.
 */

const dinheiroSchema = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Informe um valor com até duas casas.');

const quantidadeSchema = z
  .string()
  .trim()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'Informe uma quantidade válida.');

const dataSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

const passagemSchema = z.object({
  empresa: z.string().trim().max(200).nullish(),
  origem: z.string().trim().max(200).nullish(),
  destino: z.string().trim().max(200).nullish(),
  numeroVoo: z.string().trim().max(40).nullish(),
  dataVoo: dataSchema.nullish(),
  compradaEm: dataSchema.nullish(),
  formaPagamento: z.string().trim().max(120).nullish(),
  cotacoes: z
    .array(
      z.object({
        empresa: z.string().trim().min(1).max(200),
        valor: dinheiroSchema,
        obtidaEm: dataSchema.nullish(),
        observacoes: z.string().trim().max(2000).nullish(),
      }),
    )
    .max(20)
    .default([]),
});

const diariaSchema = z.object({
  dataInicio: dataSchema,
  dataFim: dataSchema,
  paisId: z.uuid().nullish(),
  cidade: z.string().trim().max(120).nullish(),
});

export const criarDespesaSchema = z
  .object({
    tipo: z.enum(s.tipoDespesaMissaoEnum.enumValues),
    participanteId: z.uuid().nullish(),
    exercicio: z.coerce.number().int().min(2000).max(2100),
    quantidade: quantidadeSchema.nullish(),
    valorUnitario: dinheiroSchema.nullish(),
    valorTotal: dinheiroSchema,
    dataDocumento: dataSchema.nullish(),
    descricao: z.string().trim().min(3, 'Descreva a despesa.').max(300),
    observacoes: z.string().trim().max(2000).nullish(),
    passagem: passagemSchema.nullish(),
    diaria: diariaSchema.nullish(),
  })
  .superRefine((valor, contexto) => {
    // O banco tem o mesmo `check`, mas a mensagem dele nao ajuda quem preenche
    // o formulario: aqui o erro sai no campo certo.
    if (valor.quantidade && valor.valorUnitario) {
      const esperado = centavos(valor.quantidade, valor.valorUnitario);
      if (esperado !== paraCentavos(valor.valorTotal)) {
        contexto.addIssue({
          code: 'custom',
          path: ['valorTotal'],
          message:
            'O total nao corresponde a quantidade multiplicada pelo valor unitario.',
        });
      }
    }
    if (valor.tipo === 'PASSAGEM' && valor.diaria) {
      contexto.addIssue({
        code: 'custom',
        path: ['diaria'],
        message: 'Despesa de passagem nao recebe dados de diaria.',
      });
    }
    if (valor.tipo === 'DIARIA' && valor.passagem) {
      contexto.addIssue({
        code: 'custom',
        path: ['passagem'],
        message: 'Despesa de diaria nao recebe dados de passagem.',
      });
    }
    // Hospedagem, transporte, inscricao, seguro e outros se descrevem com os
    // campos comuns; so passagem e diaria tem tabela propria (CG-009).
    if (
      valor.tipo !== 'PASSAGEM' &&
      valor.tipo !== 'DIARIA' &&
      (valor.passagem || valor.diaria)
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['tipo'],
        message: 'Este tipo de despesa nao tem especializacao propria.',
      });
    }
    if (valor.diaria && valor.diaria.dataFim < valor.diaria.dataInicio) {
      contexto.addIssue({
        code: 'custom',
        path: ['diaria', 'dataFim'],
        message: 'O fim da diaria nao pode ser antes do inicio.',
      });
    }
  });
export type CriarDespesa = z.infer<typeof criarDespesaSchema>;

/**
 * Estados em que a prestacao aceita lancamento (CG-054).
 *
 * `COM_PENDENCIA` esta aqui de proposito: e o estado de "devolvida para
 * correcao", e sem edicao a devolucao nao teria efeito nenhum.
 */
const ESTADOS_EDITAVEIS: readonly StatusPrestacao[] = [
  'EM_PREENCHIMENTO',
  'COM_PENDENCIA',
];

type StatusPrestacao = (typeof s.statusPrestacaoMissaoEnum.enumValues)[number];

export const validarPrestacaoSchema = z.object({
  parecer: z.string().trim().max(4000).nullish(),
});
export type ValidarPrestacao = z.infer<typeof validarPrestacaoSchema>;

export const devolverPrestacaoSchema = z.object({
  /**
   * Obrigatoria. Devolver sem dizer o que corrigir transforma a revisao em
   * porta giratoria: o responsavel reenvia a mesma coisa e o ciclo recomeca.
   */
  parecer: z
    .string()
    .trim()
    .min(3, 'Descreva a pendencia a ser corrigida.')
    .max(4000),
});
export type DevolverPrestacao = z.infer<typeof devolverPrestacaoSchema>;

export const atualizarPrestacaoSchema = z.object({
  observacoes: z.string().trim().max(4000).nullish(),
});
export type AtualizarPrestacao = z.infer<typeof atualizarPrestacaoSchema>;

export interface TotalPorChave {
  chave: string;
  rotulo: string;
  total: string;
}

export interface DespesaDetalhe {
  id: string;
  tipo: (typeof s.tipoDespesaMissaoEnum.enumValues)[number];
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
    cotacoes: {
      id: string;
      empresa: string;
      valor: string;
      obtidaEm: string | null;
      observacoes: string | null;
    }[];
  } | null;
  diaria: {
    dataInicio: string;
    dataFim: string;
    paisId: string | null;
    pais: string | null;
    cidade: string | null;
  } | null;
  /**
   * Documentos ativos da despesa e das cotacoes dela (CG-052).
   *
   * Vem junto, e nao por uma chamada de `/anexos` por despesa: a tela precisa
   * indicar quais despesas estao sem comprovante, e descobrir isso com N+1
   * requisicoes pioraria a cada lancamento novo.
   */
  documentos: DocumentoDaDespesa[];
}

/** Documento anexado a uma despesa ou a uma cotacao dela. */
export interface DocumentoDaDespesa {
  id: string;
  nome: string;
  categoria: string;
  versao: number;
  enviadoEm: Date;
  enviadoPor: string | null;
  /** Preenchido quando o documento pertence a uma cotacao, nao a despesa. */
  cotacaoId: string | null;
}

export interface PrestacaoDetalhe {
  id: string;
  missaoId: string;
  status: (typeof s.statusPrestacaoMissaoEnum.enumValues)[number];
  enviadaEm: string | null;
  enviadaPor: string | null;
  validadaEm: string | null;
  validadaPor: string | null;
  parecer: string | null;
  observacoes: string | null;
  despesas: DespesaDetalhe[];
  /** Somado em `numeric` no banco; nulo quando não há despesa nenhuma. */
  total: string | null;
  totalPorTipo: TotalPorChave[];
  totalPorExercicio: TotalPorChave[];
  totalPorPessoa: TotalPorChave[];
}

type DbOperacoes = Pick<Database, 'select' | 'insert' | 'update' | 'delete'>;

/**
 * Quais transicoes da prestacao avisam, e o que dizem.
 *
 * `EM_PREENCHIMENTO` e `ENVIADA` ficam de fora: quem enviou sabe que enviou, e
 * o revisor descobre pela fila. Avisar de tudo faz a caixa virar ruido, e uma
 * caixa que vira ruido para de ser lida — inclusive nos avisos que importam.
 */
const AVISO_DA_PRESTACAO: Partial<
  Record<
    (typeof s.statusPrestacaoMissaoEnum.enumValues)[number],
    {
      tipo: 'PRESTACAO_DEVOLVIDA' | 'PRESTACAO_VALIDADA';
      titulo: string;
      corpo: string;
    }
  >
> = {
  COM_PENDENCIA: {
    tipo: 'PRESTACAO_DEVOLVIDA',
    titulo: 'Prestação de contas devolvida',
    corpo: 'A prestação foi devolvida e voltou a aceitar alteração.',
  },
  VALIDADA: {
    tipo: 'PRESTACAO_VALIDADA',
    titulo: 'Prestação de contas validada',
    corpo: 'A prestação foi validada e passou a abater o aporte do ciclo.',
  },
};

@Injectable()
export class PrestacaoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /** `null` quando a missão ainda não tem prestação — não é erro (CG-013). */
  async detalhe(
    cicloId: string,
    missaoId: string,
  ): Promise<PrestacaoDetalhe | null> {
    await this.obterMissao(cicloId, missaoId, this.db);
    const [prestacao] = await this.db
      .select()
      .from(s.prestacaoContasMissao)
      .where(eq(s.prestacaoContasMissao.missaoId, missaoId))
      .limit(1);
    if (!prestacao) return null;
    return this.montar(prestacao.id);
  }

  async criar(
    cicloId: string,
    missaoId: string,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const id = await this.db.transaction(async (tx) => {
      await this.obterMissao(cicloId, missaoId, tx);
      const [existente] = await tx
        .select({ id: s.prestacaoContasMissao.id })
        .from(s.prestacaoContasMissao)
        .where(eq(s.prestacaoContasMissao.missaoId, missaoId))
        .limit(1);
      if (existente) {
        throw new BadRequestException('Esta missao ja tem prestacao iniciada.');
      }
      const [criada] = await tx
        .insert(s.prestacaoContasMissao)
        .values({ missaoId })
        .returning({ id: s.prestacaoContasMissao.id });
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PRESTACAO_CONTAS_MISSAO',
        entidadeId: criada.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({ missaoId, status: 'EM_PREENCHIMENTO' }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
      return criada.id;
    });
    return this.montar(id);
  }

  /**
   * Envia a prestacao para revisao (CG-054).
   *
   * Vale para o primeiro envio e para o reenvio depois de uma devolucao: os
   * dois partem de um estado editavel e chegam em `ENVIADA`. Nao ha rodada
   * numerada aqui, ao contrario da analise da missao — a prestacao tem um par
   * de estados e a trilha de auditoria conta o vaivem.
   */
  async enviar(
    cicloId: string,
    missaoId: string,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacao = await this.obterPrestacaoEditavel(
      cicloId,
      missaoId,
      this.db,
    );

    // Prestacao sem despesa tem total **nulo**, nao zero (CG-050). Enviar isso
    // para revisao pediria ao revisor que validasse a ausencia de informacao.
    const [{ quantas }] = await this.db
      .select({ quantas: sql<number>`count(*)::int` })
      .from(s.despesaMissao)
      .where(eq(s.despesaMissao.prestacaoId, prestacao.id));
    if (quantas === 0) {
      throw new BadRequestException(
        'Lance ao menos uma despesa antes de enviar a prestacao.',
      );
    }

    return this.transicionar(prestacao, 'ENVIADA', usuario, {
      enviadaEm: dataHojeEmManaus(),
      enviadaPor: nomeDoUsuario(usuario),
      // O parecer anterior era da devolucao: mante-lo faria a tela mostrar uma
      // pendencia ja corrigida ao lado do novo envio.
      parecer: null,
    });
  }

  /**
   * Valida a prestacao (CG-054).
   *
   * **E o unico estado que produz execucao oficial do orcamento** — a CG-055
   * abate o aporte a partir daqui, e nada abate antes (CG-009). Por isso a
   * transicao so parte de `ENVIADA`: validar direto do preenchimento pularia a
   * revisao inteira.
   */
  async validar(
    cicloId: string,
    missaoId: string,
    dto: ValidarPrestacao,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacao = await this.obterEmRevisao(cicloId, missaoId);
    return this.transicionar(prestacao, 'VALIDADA', usuario, {
      validadaEm: dataHojeEmManaus(),
      validadaPor: nomeDoUsuario(usuario),
      parecer: dto.parecer ?? null,
    });
  }

  /** Devolve com pendencia; a prestacao volta a aceitar alteracao. */
  async devolver(
    cicloId: string,
    missaoId: string,
    dto: DevolverPrestacao,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacao = await this.obterEmRevisao(cicloId, missaoId);
    return this.transicionar(prestacao, 'COM_PENDENCIA', usuario, {
      parecer: dto.parecer,
    });
  }

  /**
   * A prestacao que aguarda decisao do revisor.
   *
   * Separado de `obterPrestacaoEditavel` porque a pergunta e oposta: la o que
   * vale e "aceita lancamento?", aqui e "esta na mesa do revisor?".
   */
  private async obterEmRevisao(cicloId: string, missaoId: string) {
    await this.obterMissao(cicloId, missaoId, this.db);
    const [prestacao] = await this.db
      .select()
      .from(s.prestacaoContasMissao)
      .where(eq(s.prestacaoContasMissao.missaoId, missaoId))
      .limit(1);

    if (!prestacao) {
      throw new NotFoundException('Esta missao ainda nao tem prestacao.');
    }
    if (prestacao.status !== 'ENVIADA') {
      throw new BadRequestException(
        prestacao.status === 'VALIDADA'
          ? 'Esta prestacao ja foi validada.'
          : 'Somente prestacao enviada pode ser revisada.',
      );
    }
    return prestacao;
  }

  /**
   * Grava a mudanca de estado com auditoria, numa transacao.
   *
   * O `check` do banco exige `enviada_em` fora do preenchimento e
   * `validada_em` na validacao; por isso a data vai junto do estado, e nunca
   * num update separado que poderia falhar no meio.
   */
  private async transicionar(
    prestacao: { id: string; status: string; missaoId?: string },
    novo: (typeof s.statusPrestacaoMissaoEnum.enumValues)[number],
    usuario: AuthUser,
    campos: Record<string, unknown>,
  ): Promise<PrestacaoDetalhe> {
    await this.db.transaction(async (tx) => {
      await tx
        .update(s.prestacaoContasMissao)
        .set({ ...campos, status: novo, atualizadoEm: new Date() })
        .where(eq(s.prestacaoContasMissao.id, prestacao.id));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PRESTACAO_CONTAS_MISSAO',
        entidadeId: prestacao.id,
        acao: 'EDICAO',
        campo: 'status',
        valorAnterior: prestacao.status,
        valorNovo: novo,
        justificativa:
          typeof campos.parecer === 'string' ? campos.parecer : null,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      // Devolucao e validacao mudam de quem e a vez, e por isso notificam
      // (D-11). Envio nao: quem enviou sabe que enviou, e o revisor descobre
      // pela fila — avisar todo mundo de tudo faz a caixa virar ruido.
      const aviso = AVISO_DA_PRESTACAO[novo];
      if (aviso && prestacao.missaoId) {
        await this.notificacoes.registrar(
          tx,
          (await destinatariosDaMissao(tx, prestacao.missaoId)).map(
            (destinatarioId) => ({
              tipo: aviso.tipo,
              destinatarioId,
              missaoId: prestacao.missaoId!,
              titulo: aviso.titulo,
              corpo:
                typeof campos.parecer === 'string' && campos.parecer
                  ? campos.parecer
                  : aviso.corpo,
              origemPor: nomeDoUsuario(usuario),
            }),
          ),
        );
      }
    });

    return this.montar(prestacao.id);
  }

  async atualizar(
    cicloId: string,
    missaoId: string,
    dto: AtualizarPrestacao,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const id = await this.db.transaction(async (tx) => {
      const prestacao = await this.obterPrestacaoEditavel(
        cicloId,
        missaoId,
        tx,
      );
      const anterior = prestacao.observacoes;
      const novo = dto.observacoes ?? null;
      if (anterior === novo) return prestacao.id;
      await tx
        .update(s.prestacaoContasMissao)
        .set({ observacoes: novo, atualizadoEm: new Date() })
        .where(eq(s.prestacaoContasMissao.id, prestacao.id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PRESTACAO_CONTAS_MISSAO',
        entidadeId: prestacao.id,
        acao: 'EDICAO',
        campo: 'observacoes',
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
      return prestacao.id;
    });
    return this.montar(id);
  }

  async criarDespesa(
    cicloId: string,
    missaoId: string,
    dto: CriarDespesa,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacaoId = await this.db.transaction(async (tx) => {
      const prestacao = await this.obterPrestacaoEditavel(
        cicloId,
        missaoId,
        tx,
      );
      await this.validarReferencias(missaoId, dto, tx);
      const [despesa] = await tx
        .insert(s.despesaMissao)
        .values({
          prestacaoId: prestacao.id,
          tipo: dto.tipo,
          participanteId: dto.participanteId ?? null,
          exercicio: dto.exercicio,
          quantidade: dto.quantidade ?? null,
          valorUnitario: dto.valorUnitario ?? null,
          valorTotal: dto.valorTotal,
          dataDocumento: dto.dataDocumento ?? null,
          descricao: dto.descricao,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.despesaMissao.id });
      await this.gravarEspecializacao(despesa.id, dto, tx);
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'DESPESA_MISSAO',
        entidadeId: despesa.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          prestacaoId: prestacao.id,
          tipo: dto.tipo,
          exercicio: dto.exercicio,
          valorTotal: dto.valorTotal,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
      return prestacao.id;
    });
    return this.montar(prestacaoId);
  }

  /**
   * Substitui a despesa inteira, inclusive a especialização.
   *
   * Editar campo a campo obrigaria a decidir o que fazer quando o tipo muda —
   * uma passagem que vira diária deixaria a tabela de passagem órfã. Apagar e
   * regravar dentro da transação evita esse estado intermediário.
   */
  async atualizarDespesa(
    cicloId: string,
    missaoId: string,
    despesaId: string,
    dto: CriarDespesa,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacaoId = await this.db.transaction(async (tx) => {
      const prestacao = await this.obterPrestacaoEditavel(
        cicloId,
        missaoId,
        tx,
      );
      const atual = await this.obterDespesa(prestacao.id, despesaId, tx);
      await this.validarReferencias(missaoId, dto, tx);
      await this.validarDocumentosNaEdicao(atual, dto, tx);

      await tx
        .delete(s.despesaPassagem)
        .where(eq(s.despesaPassagem.despesaId, atual.id));
      await tx
        .delete(s.despesaDiaria)
        .where(eq(s.despesaDiaria.despesaId, atual.id));
      await tx
        .update(s.despesaMissao)
        .set({
          tipo: dto.tipo,
          participanteId: dto.participanteId ?? null,
          exercicio: dto.exercicio,
          quantidade: dto.quantidade ?? null,
          valorUnitario: dto.valorUnitario ?? null,
          valorTotal: dto.valorTotal,
          dataDocumento: dto.dataDocumento ?? null,
          descricao: dto.descricao,
          observacoes: dto.observacoes ?? null,
          atualizadoEm: new Date(),
        })
        .where(eq(s.despesaMissao.id, atual.id));
      await this.gravarEspecializacao(atual.id, dto, tx);

      const alteracoes = (
        ['tipo', 'exercicio', 'valorTotal', 'descricao'] as const
      ).filter((campo) => String(atual[campo]) !== String(dto[campo]));
      if (alteracoes.length) {
        await tx.insert(s.registroAuditoria).values(
          alteracoes.map((campo) => ({
            entidadeTipo: 'DESPESA_MISSAO',
            entidadeId: atual.id,
            acao: 'EDICAO' as const,
            campo,
            valorAnterior: String(atual[campo]),
            valorNovo: String(dto[campo]),
            usuarioId: usuario.id,
            usuarioNome: nomeDoUsuario(usuario),
          })),
        );
      }
      return prestacao.id;
    });
    return this.montar(prestacaoId);
  }

  async removerDespesa(
    cicloId: string,
    missaoId: string,
    despesaId: string,
    usuario: AuthUser,
  ): Promise<PrestacaoDetalhe> {
    const prestacaoId = await this.db.transaction(async (tx) => {
      const prestacao = await this.obterPrestacaoEditavel(
        cicloId,
        missaoId,
        tx,
      );
      const atual = await this.obterDespesa(prestacao.id, despesaId, tx);
      await this.exigirDespesaSemDocumentos(atual.id, tx);
      await tx.delete(s.despesaMissao).where(eq(s.despesaMissao.id, atual.id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'DESPESA_MISSAO',
        entidadeId: atual.id,
        acao: 'EXCLUSAO',
        valorAnterior: JSON.stringify({
          tipo: atual.tipo,
          exercicio: atual.exercicio,
          valorTotal: atual.valorTotal,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
      return prestacao.id;
    });
    return this.montar(prestacaoId);
  }

  // -------------------------------------------------------------------------

  private async montar(prestacaoId: string): Promise<PrestacaoDetalhe> {
    const [prestacao] = await this.db
      .select()
      .from(s.prestacaoContasMissao)
      .where(eq(s.prestacaoContasMissao.id, prestacaoId))
      .limit(1);
    if (!prestacao) throw new NotFoundException('Prestacao nao encontrada.');

    const linhas = await this.db
      .select({
        id: s.despesaMissao.id,
        tipo: s.despesaMissao.tipo,
        participanteId: s.despesaMissao.participanteId,
        participante: s.pessoa.nome,
        exercicio: s.despesaMissao.exercicio,
        quantidade: s.despesaMissao.quantidade,
        valorUnitario: s.despesaMissao.valorUnitario,
        valorTotal: s.despesaMissao.valorTotal,
        dataDocumento: s.despesaMissao.dataDocumento,
        descricao: s.despesaMissao.descricao,
        observacoes: s.despesaMissao.observacoes,
        passagemEmpresa: s.despesaPassagem.empresa,
        passagemOrigem: s.despesaPassagem.origem,
        passagemDestino: s.despesaPassagem.destino,
        passagemVoo: s.despesaPassagem.numeroVoo,
        passagemDataVoo: s.despesaPassagem.dataVoo,
        passagemComprada: s.despesaPassagem.compradaEm,
        passagemFormaPagamento: s.despesaPassagem.formaPagamento,
        diariaInicio: s.despesaDiaria.dataInicio,
        diariaFim: s.despesaDiaria.dataFim,
        diariaPaisId: s.despesaDiaria.paisId,
        diariaPais: s.pais.nome,
        diariaCidade: s.despesaDiaria.cidade,
      })
      .from(s.despesaMissao)
      .leftJoin(
        s.missaoParticipante,
        eq(s.missaoParticipante.id, s.despesaMissao.participanteId),
      )
      .leftJoin(s.pessoa, eq(s.pessoa.id, s.missaoParticipante.pessoaId))
      .leftJoin(
        s.despesaPassagem,
        eq(s.despesaPassagem.despesaId, s.despesaMissao.id),
      )
      .leftJoin(
        s.despesaDiaria,
        eq(s.despesaDiaria.despesaId, s.despesaMissao.id),
      )
      .leftJoin(s.pais, eq(s.pais.id, s.despesaDiaria.paisId))
      .where(eq(s.despesaMissao.prestacaoId, prestacaoId))
      .orderBy(asc(s.despesaMissao.exercicio), asc(s.despesaMissao.criadoEm));

    const cotacoes = await this.db
      .select({
        id: s.cotacaoPassagem.id,
        despesaId: s.cotacaoPassagem.despesaId,
        empresa: s.cotacaoPassagem.empresa,
        valor: s.cotacaoPassagem.valor,
        obtidaEm: s.cotacaoPassagem.obtidaEm,
        observacoes: s.cotacaoPassagem.observacoes,
      })
      .from(s.cotacaoPassagem)
      .innerJoin(
        s.despesaMissao,
        eq(s.despesaMissao.id, s.cotacaoPassagem.despesaId),
      )
      .where(eq(s.despesaMissao.prestacaoId, prestacaoId))
      .orderBy(asc(s.cotacaoPassagem.valor));

    /**
     * Documentos da prestacao, numa consulta so.
     *
     * `anexo` e polimorfico e nao tem chave estrangeira, entao o vinculo se
     * refaz aqui por `entidade_id`: ou o id da despesa, ou o id de uma cotacao
     * dela. O `in` sobre os dois conjuntos evita uma chamada por despesa.
     */
    const idsDespesa = linhas.map((linha) => linha.id);
    const idsCotacao = cotacoes.map((cotacao) => cotacao.id);
    const documentos =
      idsDespesa.length === 0
        ? []
        : await this.db
            .select({
              id: s.anexo.id,
              nome: s.anexo.nome,
              categoria: s.anexo.categoria,
              versao: s.anexo.versao,
              enviadoEm: s.anexo.enviadoEm,
              enviadoPor: s.anexo.enviadoPor,
              entidadeTipo: s.anexo.entidadeTipo,
              entidadeId: s.anexo.entidadeId,
            })
            .from(s.anexo)
            .where(
              and(
                eq(s.anexo.ativo, true),
                or(
                  and(
                    eq(s.anexo.entidadeTipo, 'DESPESA_MISSAO'),
                    inArray(s.anexo.entidadeId, idsDespesa),
                  ),
                  idsCotacao.length > 0
                    ? and(
                        eq(s.anexo.entidadeTipo, 'COTACAO_PASSAGEM'),
                        inArray(s.anexo.entidadeId, idsCotacao),
                      )
                    : undefined,
                ),
              ),
            )
            .orderBy(asc(s.anexo.enviadoEm));

    /** De qual despesa e cada cotacao, para reatribuir o documento dela. */
    const despesaDaCotacao = new Map(
      cotacoes.map((cotacao) => [cotacao.id, cotacao.despesaId]),
    );

    const documentosDaDespesa = (despesaId: string): DocumentoDaDespesa[] =>
      documentos
        .filter((documento) =>
          documento.entidadeTipo === 'DESPESA_MISSAO'
            ? documento.entidadeId === despesaId
            : despesaDaCotacao.get(documento.entidadeId) === despesaId,
        )
        .map((documento) => ({
          id: documento.id,
          nome: documento.nome,
          categoria: documento.categoria,
          versao: documento.versao,
          enviadoEm: documento.enviadoEm,
          enviadoPor: documento.enviadoPor,
          cotacaoId:
            documento.entidadeTipo === 'COTACAO_PASSAGEM'
              ? documento.entidadeId
              : null,
        }));

    const despesas: DespesaDetalhe[] = linhas.map((linha) => ({
      id: linha.id,
      tipo: linha.tipo,
      participanteId: linha.participanteId,
      participante: linha.participante,
      exercicio: linha.exercicio,
      quantidade: linha.quantidade,
      valorUnitario: linha.valorUnitario,
      valorTotal: linha.valorTotal,
      dataDocumento: linha.dataDocumento,
      descricao: linha.descricao,
      observacoes: linha.observacoes,
      passagem:
        linha.tipo === 'PASSAGEM'
          ? {
              empresa: linha.passagemEmpresa,
              origem: linha.passagemOrigem,
              destino: linha.passagemDestino,
              numeroVoo: linha.passagemVoo,
              dataVoo: linha.passagemDataVoo,
              compradaEm: linha.passagemComprada,
              formaPagamento: linha.passagemFormaPagamento,
              // `despesaId` fica de fora: a cotacao ja esta dentro da
              // despesa a que pertence, e repeti-lo so daria ao cliente duas
              // fontes para o mesmo vinculo.
              cotacoes: cotacoes
                .filter((cotacao) => cotacao.despesaId === linha.id)
                .map((cotacao) => ({
                  id: cotacao.id,
                  empresa: cotacao.empresa,
                  valor: cotacao.valor,
                  obtidaEm: cotacao.obtidaEm,
                  observacoes: cotacao.observacoes,
                })),
            }
          : null,
      diaria:
        linha.tipo === 'DIARIA' && linha.diariaInicio
          ? {
              dataInicio: linha.diariaInicio,
              dataFim: linha.diariaFim as string,
              paisId: linha.diariaPaisId,
              pais: linha.diariaPais,
              cidade: linha.diariaCidade,
            }
          : null,
      documentos: documentosDaDespesa(linha.id),
    }));

    const [totais, porTipo, porExercicio, porPessoa] = await Promise.all([
      this.somar(prestacaoId),
      this.somarPor(prestacaoId, s.despesaMissao.tipo),
      this.somarPor(prestacaoId, s.despesaMissao.exercicio),
      this.somarPorPessoa(prestacaoId),
    ]);

    return {
      id: prestacao.id,
      missaoId: prestacao.missaoId,
      status: prestacao.status,
      enviadaEm: prestacao.enviadaEm,
      enviadaPor: prestacao.enviadaPor,
      validadaEm: prestacao.validadaEm,
      validadaPor: prestacao.validadaPor,
      parecer: prestacao.parecer,
      observacoes: prestacao.observacoes,
      despesas,
      total: totais,
      totalPorTipo: porTipo,
      totalPorExercicio: porExercicio,
      totalPorPessoa: porPessoa,
    };
  }

  /** Nulo sem despesa: prestação vazia não tem total, e zero afirmaria que teve. */
  private async somar(prestacaoId: string): Promise<string | null> {
    const [linha] = await this.db
      .select({ total: sql<string | null>`sum(${s.despesaMissao.valorTotal})` })
      .from(s.despesaMissao)
      .where(eq(s.despesaMissao.prestacaoId, prestacaoId));
    return linha?.total ?? null;
  }

  private async somarPor(
    prestacaoId: string,
    coluna: typeof s.despesaMissao.tipo | typeof s.despesaMissao.exercicio,
  ): Promise<TotalPorChave[]> {
    const linhas = await this.db
      .select({
        chave: sql<string>`${coluna}::text`,
        total: sql<string>`sum(${s.despesaMissao.valorTotal})`,
      })
      .from(s.despesaMissao)
      .where(eq(s.despesaMissao.prestacaoId, prestacaoId))
      .groupBy(coluna)
      .orderBy(sql`${coluna}::text`);
    return linhas.map((linha) => ({
      chave: linha.chave,
      rotulo: linha.chave,
      total: linha.total,
    }));
  }

  private async somarPorPessoa(prestacaoId: string): Promise<TotalPorChave[]> {
    const linhas = await this.db
      .select({
        chave: sql<string>`coalesce(${s.despesaMissao.participanteId}::text, 'SEM_PARTICIPANTE')`,
        rotulo: sql<string>`coalesce(${s.pessoa.nome}, 'Sem participante')`,
        total: sql<string>`sum(${s.despesaMissao.valorTotal})`,
      })
      .from(s.despesaMissao)
      .leftJoin(
        s.missaoParticipante,
        eq(s.missaoParticipante.id, s.despesaMissao.participanteId),
      )
      .leftJoin(s.pessoa, eq(s.pessoa.id, s.missaoParticipante.pessoaId))
      .where(eq(s.despesaMissao.prestacaoId, prestacaoId))
      .groupBy(s.despesaMissao.participanteId, s.pessoa.nome)
      .orderBy(sql`coalesce(${s.pessoa.nome}, 'Sem participante')`);
    return linhas;
  }

  private async gravarEspecializacao(
    despesaId: string,
    dto: CriarDespesa,
    tx: DbOperacoes,
  ): Promise<void> {
    if (dto.tipo === 'PASSAGEM') {
      const passagem = dto.passagem ?? { cotacoes: [] };
      await tx.insert(s.despesaPassagem).values({
        despesaId,
        empresa: passagem.empresa ?? null,
        origem: passagem.origem ?? null,
        destino: passagem.destino ?? null,
        numeroVoo: passagem.numeroVoo ?? null,
        dataVoo: passagem.dataVoo ?? null,
        compradaEm: passagem.compradaEm ?? null,
        formaPagamento: passagem.formaPagamento ?? null,
      });
      const cotacoes = passagem.cotacoes ?? [];
      if (cotacoes.length) {
        await tx.insert(s.cotacaoPassagem).values(
          cotacoes.map((cotacao) => ({
            despesaId,
            empresa: cotacao.empresa,
            valor: cotacao.valor,
            obtidaEm: cotacao.obtidaEm ?? null,
            observacoes: cotacao.observacoes ?? null,
          })),
        );
      }
      return;
    }
    if (dto.tipo === 'DIARIA') {
      if (!dto.diaria) {
        throw new BadRequestException(
          'Despesa de diaria exige periodo, pais e cidade.',
        );
      }
      await tx.insert(s.despesaDiaria).values({
        despesaId,
        dataInicio: dto.diaria.dataInicio,
        dataFim: dto.diaria.dataFim,
        paisId: dto.diaria.paisId ?? null,
        cidade: dto.diaria.cidade ?? null,
      });
    }
  }

  private async validarReferencias(
    missaoId: string,
    dto: CriarDespesa,
    tx: DbOperacoes,
  ): Promise<void> {
    if (dto.participanteId) {
      const [participante] = await tx
        .select({ id: s.missaoParticipante.id })
        .from(s.missaoParticipante)
        .where(
          and(
            eq(s.missaoParticipante.id, dto.participanteId),
            // O participante tem de ser desta missao: aceitar o de outra
            // deixaria a despesa apontando para alguem que nunca viajou nela.
            eq(s.missaoParticipante.missaoId, missaoId),
          ),
        )
        .limit(1);
      if (!participante) {
        throw new BadRequestException(
          'O participante informado nao pertence a esta missao.',
        );
      }
    }
    if (dto.diaria?.paisId) {
      const [pais] = await tx
        .select({ id: s.pais.id })
        .from(s.pais)
        .where(eq(s.pais.id, dto.diaria.paisId))
        .limit(1);
      if (!pais) throw new BadRequestException('Pais nao encontrado.');
    }
  }

  /**
   * Editar nao pode mudar o significado de um documento ja anexado nem apagar
   * uma cotacao que possui arquivo historico. O anexo e polimorfico e nao tem
   * FK; sem estas travas a alteracao deixaria uma referencia orfa em silencio.
   */
  private async validarDocumentosNaEdicao(
    atual: typeof s.despesaMissao.$inferSelect,
    dto: CriarDespesa,
    db: DbOperacoes,
  ): Promise<void> {
    const documentos = await db
      .select({ categoria: s.anexo.categoria })
      .from(s.anexo)
      .where(
        and(
          eq(s.anexo.entidadeTipo, 'DESPESA_MISSAO'),
          eq(s.anexo.entidadeId, atual.id),
        ),
      );
    if (
      documentos.some(
        ({ categoria }) => !categoriaPermitidaParaDespesa(dto.tipo, categoria),
      )
    ) {
      throw new BadRequestException(
        'O novo tipo da despesa nao e compativel com os documentos anexados.',
      );
    }

    if (atual.tipo !== 'PASSAGEM') return;
    const cotacoes = await db
      .select({ id: s.cotacaoPassagem.id })
      .from(s.cotacaoPassagem)
      .where(eq(s.cotacaoPassagem.despesaId, atual.id));
    if (!cotacoes.length) return;
    const [documento] = await db
      .select({ id: s.anexo.id })
      .from(s.anexo)
      .where(
        and(
          eq(s.anexo.entidadeTipo, 'COTACAO_PASSAGEM'),
          inArray(
            s.anexo.entidadeId,
            cotacoes.map(({ id }) => id),
          ),
        ),
      )
      .limit(1);
    if (documento) {
      throw new BadRequestException(
        'A passagem possui cotacao com documento e nao pode substituir suas cotacoes.',
      );
    }
  }

  private async exigirDespesaSemDocumentos(
    despesaId: string,
    db: DbOperacoes,
  ): Promise<void> {
    const cotacoes = await db
      .select({ id: s.cotacaoPassagem.id })
      .from(s.cotacaoPassagem)
      .where(eq(s.cotacaoPassagem.despesaId, despesaId));
    const cotacoesIds = cotacoes.map(({ id }) => id);
    const alvoCotacao = cotacoesIds.length
      ? and(
          eq(s.anexo.entidadeTipo, 'COTACAO_PASSAGEM'),
          inArray(s.anexo.entidadeId, cotacoesIds),
        )
      : undefined;
    const [documento] = await db
      .select({ id: s.anexo.id })
      .from(s.anexo)
      .where(
        or(
          and(
            eq(s.anexo.entidadeTipo, 'DESPESA_MISSAO'),
            eq(s.anexo.entidadeId, despesaId),
          ),
          alvoCotacao,
        ),
      )
      .limit(1);
    if (documento) {
      throw new BadRequestException(
        'A despesa possui documentos e deve ser preservada no historico.',
      );
    }
  }

  private async obterMissao(
    cicloId: string,
    missaoId: string,
    db: DbOperacoes,
  ) {
    const [missao] = await db
      .select({ id: s.missaoComite.id })
      .from(s.missaoComite)
      .where(
        and(
          eq(s.missaoComite.id, missaoId),
          eq(s.missaoComite.cicloId, cicloId),
        ),
      )
      .limit(1);
    if (!missao) throw new NotFoundException('Missao nao encontrada.');
    return missao;
  }

  private async obterPrestacaoEditavel(
    cicloId: string,
    missaoId: string,
    db: DbOperacoes,
  ) {
    await this.obterMissao(cicloId, missaoId, db);
    const [prestacao] = await db
      .select()
      .from(s.prestacaoContasMissao)
      .where(eq(s.prestacaoContasMissao.missaoId, missaoId))
      .limit(1);
    if (!prestacao) {
      throw new NotFoundException('Esta missao ainda nao tem prestacao.');
    }
    // `COM_PENDENCIA` volta a aceitar alteracao: devolver para correcao sem
    // reabrir a edicao deixaria o responsavel sem como atender a pendencia.
    // `ENVIADA` congela — senao o revisor validaria um valor diferente do que
    // leu. `VALIDADA` congela em definitivo: e ela que abate o aporte (CG-009),
    // e alterar despesa depois mudaria o saldo sem passar por revisao nenhuma.
    if (!ESTADOS_EDITAVEIS.includes(prestacao.status)) {
      throw new BadRequestException(
        prestacao.status === 'VALIDADA'
          ? 'Prestacao validada nao aceita alteracao. Ela ja abateu o aporte.'
          : 'Prestacao em analise nao aceita alteracao. Aguarde a revisao.',
      );
    }
    return prestacao;
  }

  private async obterDespesa(
    prestacaoId: string,
    despesaId: string,
    db: DbOperacoes,
  ) {
    const [despesa] = await db
      .select()
      .from(s.despesaMissao)
      .where(
        and(
          eq(s.despesaMissao.id, despesaId),
          eq(s.despesaMissao.prestacaoId, prestacaoId),
        ),
      )
      .limit(1);
    if (!despesa) throw new NotFoundException('Despesa nao encontrada.');
    return despesa;
  }
}

/** Centavos exatos com `BigInt`: dinheiro nao passa por `number` (RN/§7). */
function paraCentavos(valor: string): bigint {
  const [inteira, decimal = ''] = valor.trim().split('.');
  return BigInt(`${inteira}${decimal.padEnd(2, '0').slice(0, 2)}`);
}

function centavos(quantidade: string, unitario: string): bigint {
  // quantidade tem 2 casas; o produto sai em 10^-4 e volta para centavos com
  // arredondamento meio-para-cima, igual ao `round` do Postgres.
  const produto = paraCentavos(quantidade) * paraCentavos(unitario);
  const inteiro = produto / 100n;
  const resto = produto % 100n;
  return resto >= 50n ? inteiro + 1n : inteiro;
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}
