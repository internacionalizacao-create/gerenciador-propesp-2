import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Checklist de encerramento da missao (CG-058).
 *
 * **Nada aqui e gravado.** A task proibe persistir booleano que apenas duplica
 * a existencia de outro registro, e a proibicao tem motivo pratico: um
 * `prestacao_ok` guardado divergiria no dia em que a prestacao fosse devolvida,
 * e a missao encerraria com base numa foto velha. Todo item e recalculado na
 * leitura, contra o registro que ele descreve.
 *
 * O checklist tem duas metades, e elas sao diferentes de proposito:
 *
 * - **Documentos** vem de `requisito_submissao` com `momento = 'ENCERRAMENTO'`.
 *   E dado, nao codigo — mesma decisao da CG-037: fechar a lista no fonte
 *   impediria a PROPESP de exigir um documento novo sem deploy.
 * - **Fatos** vem do catalogo abaixo, porque cada um precisa de uma consulta
 *   propria e nenhuma tabela de configuracao substitui isso. O que continua
 *   sendo dado e *se* o requisito aplica: `aplicavel` decide por missao.
 *
 * Item nao aplicavel **nao bloqueia** — e o criterio de aceite da task. Ele
 * aparece na lista assim mesmo, porque some-lo faria a tela parecer incompleta
 * e ninguem saberia dizer se o requisito nao existe ou se foi esquecido.
 */

export const dispensarRequisitoSchema = z
  .object({
    chave: z.string().trim().min(1).max(80),
    justificativa: z
      .string()
      .trim()
      .min(10, 'Justifique a dispensa do requisito.')
      .max(2000),
  })
  .strict();
export type DispensarRequisito = z.infer<typeof dispensarRequisitoSchema>;

export const revogarDispensaSchema = z
  .object({
    chave: z.string().trim().min(1).max(80),
    justificativa: z
      .string()
      .trim()
      .min(10, 'Justifique a revogação da dispensa.')
      .max(2000),
  })
  .strict();
export type RevogarDispensa = z.infer<typeof revogarDispensaSchema>;

export interface DispensaVigente {
  justificativa: string;
  dispensadaEm: string;
  dispensadaPor: string | null;
}

export interface ItemEncerramento {
  chave: string;
  titulo: string;
  descricao: string | null;
  /** `false` some do bloqueio, mas continua na lista. */
  aplicavel: boolean;
  obrigatorio: boolean;
  atendido: boolean;
  dispensa: DispensaVigente | null;
  /** O que a tela precisa dizer para quem vai resolver a pendencia. */
  comoResolver: string | null;
}

export interface ChecklistEncerramento {
  podeEncerrar: boolean;
  /** Motivo de nao poder que **nao** e requisito: estado errado da missao. */
  impedimento: string | null;
  itens: ItemEncerramento[];
  pendencias: string[];
}

/** Fatos consultaveis. A chave e o contrato com a dispensa e com a tela. */
const FATOS = [
  'RELATO_GERAL',
  'ATIVIDADES_RELATADAS',
  'PRODUTO_RESPONDIDO',
  'PRESTACAO_VALIDADA',
  'AVALIACAO_OBJETIVOS',
] as const;
type Fato = (typeof FATOS)[number];

const PREFIXO_DOCUMENTO = 'DOCUMENTO:';

@Injectable()
export class EncerramentoService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async checklist(
    cicloId: string,
    missaoId: string,
  ): Promise<ChecklistEncerramento> {
    const missao = await this.carregar(cicloId, missaoId);
    const dispensas = await this.dispensasVigentes(missaoId);

    const itens = [
      ...(await this.fatos(missao)),
      ...(await this.documentos(missao)),
    ].map((item) => ({
      ...item,
      dispensa: dispensas.get(item.chave) ?? null,
    }));

    const pendencias = itens
      .filter(
        (item) =>
          item.aplicavel &&
          item.obrigatorio &&
          !item.atendido &&
          !item.dispensa,
      )
      .map((item) => item.comoResolver ?? item.titulo);

    // Estado errado e impedimento, nao pendencia: nao ha o que anexar ou
    // preencher para resolver, e misturar os dois faria a tela oferecer uma
    // acao que nao existe.
    const impedimento =
      missao.status === 'CONFIRMADA'
        ? null
        : missao.status === 'CONCLUIDA'
          ? 'Esta missão já foi encerrada.'
          : missao.status === 'CANCELADA'
            ? 'Missão cancelada não encerra.'
            : `Missão ${missao.status.toLowerCase()} precisa ser confirmada antes de encerrar.`;

    return {
      podeEncerrar: impedimento === null && pendencias.length === 0,
      impedimento,
      itens,
      pendencias,
    };
  }

  /**
   * Dispensa um requisito desta missao.
   *
   * Exige `missao:dispensa` no controller — no modelo do Comite, que o `admin`
   * tambem tem. Foi a decisao de 2026-09-06 ("admin e comite").
   *
   * Duas recusas que evitam dispensa inutil: chave que nao esta no checklist
   * daquela missao (dispensaria coisa nenhuma, e ficaria na tabela para sempre)
   * e requisito ja atendido (a dispensa nao mudaria nada e sugeriria, no
   * historico, que algo foi perdoado).
   */
  async dispensar(
    cicloId: string,
    missaoId: string,
    dto: DispensarRequisito,
    usuario: AuthUser,
  ): Promise<ChecklistEncerramento> {
    const checklist = await this.checklist(cicloId, missaoId);
    const item = checklist.itens.find((linha) => linha.chave === dto.chave);

    if (!item) {
      throw new BadRequestException(
        `Requisito ${dto.chave} não faz parte do encerramento desta missão.`,
      );
    }
    if (item.dispensa) {
      throw new ConflictException('Este requisito já está dispensado.');
    }
    if (item.atendido) {
      throw new ConflictException(
        'Requisito já atendido; não há o que dispensar.',
      );
    }

    await this.db.transaction(async (tx) => {
      await tx.insert(s.dispensaRequisitoEncerramento).values({
        missaoId,
        chave: dto.chave,
        justificativa: dto.justificativa,
        dispensadaPor: nomeDoUsuario(usuario),
        dispensadaPorId: usuario.id,
      });
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        acao: 'EDICAO',
        campo: `dispensaEncerramento.${dto.chave}`,
        valorNovo: 'DISPENSADO',
        justificativa: dto.justificativa,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });

    return this.checklist(cicloId, missaoId);
  }

  /**
   * Revoga a dispensa, sem apagar a linha.
   *
   * A dispensa foi o que autorizou encerrar sem o requisito; apagar o registro
   * apagaria a explicacao. Revogada, ela sai do calculo e continua no historico
   * — e por isso o indice de unicidade e parcial, senao dispensar de novo
   * depois de revogar colidiria.
   */
  async revogarDispensa(
    cicloId: string,
    missaoId: string,
    dto: RevogarDispensa,
    usuario: AuthUser,
  ): Promise<ChecklistEncerramento> {
    await this.carregar(cicloId, missaoId);

    const atualizadas = await this.db
      .update(s.dispensaRequisitoEncerramento)
      .set({
        revogadaEm: new Date(),
        revogadaPor: nomeDoUsuario(usuario),
        revogadaJustificativa: dto.justificativa,
        atualizadoEm: new Date(),
      })
      .where(
        and(
          eq(s.dispensaRequisitoEncerramento.missaoId, missaoId),
          eq(s.dispensaRequisitoEncerramento.chave, dto.chave),
          isNull(s.dispensaRequisitoEncerramento.revogadaEm),
        ),
      )
      .returning({ id: s.dispensaRequisitoEncerramento.id });

    if (atualizadas.length === 0) {
      throw new NotFoundException(
        'Não há dispensa vigente para este requisito.',
      );
    }

    await this.db.insert(s.registroAuditoria).values({
      entidadeTipo: 'MISSAO_COMITE',
      entidadeId: missaoId,
      acao: 'EDICAO',
      campo: `dispensaEncerramento.${dto.chave}`,
      valorAnterior: 'DISPENSADO',
      valorNovo: 'REVOGADO',
      justificativa: dto.justificativa,
      usuarioId: usuario.id,
      usuarioNome: nomeDoUsuario(usuario),
    });

    return this.checklist(cicloId, missaoId);
  }

  /**
   * Porta de entrada de quem vai encerrar (`CONCLUIR`).
   *
   * Fica aqui, e nao em `missoes-comite.service.ts`, para o gate e o checklist
   * saírem da mesma conta: se a tela mostrasse uma lista e a transicao usasse
   * outra, a missao seria recusada por um motivo que a tela nao exibia.
   */
  async exigirRequisitos(cicloId: string, missaoId: string): Promise<void> {
    const checklist = await this.checklist(cicloId, missaoId);
    if (checklist.impedimento) {
      throw new ConflictException(checklist.impedimento);
    }
    if (checklist.pendencias.length > 0) {
      // 422, nao 400: o corpo esta correto; o que falta e estado da missao. E o
      // mesmo contrato da submissao (CG-037), entao a tela reaproveita a leitura.
      throw new UnprocessableEntityException({
        message: 'A missão não atende aos requisitos de encerramento.',
        pendencias: checklist.pendencias,
      });
    }
  }

  // -------------------------------------------------------------------------

  private async carregar(cicloId: string, missaoId: string) {
    const [missao] = await this.db
      .select({
        id: s.missaoComite.id,
        cicloId: s.missaoComite.cicloId,
        tipo: s.missaoComite.tipo,
        status: s.missaoComite.status,
        relatoGeral: s.missaoComite.relatoGeral,
        avaliacaoObjetivos: s.missaoComite.avaliacaoObjetivos,
        semProdutoDeclaradoEm: s.missaoComite.semProdutoDeclaradoEm,
      })
      .from(s.missaoComite)
      .where(
        and(
          eq(s.missaoComite.id, missaoId),
          eq(s.missaoComite.cicloId, cicloId),
        ),
      );

    if (!missao) throw new NotFoundException('Missão não encontrada.');
    return missao;
  }

  private async dispensasVigentes(missaoId: string) {
    const linhas = await this.db
      .select({
        chave: s.dispensaRequisitoEncerramento.chave,
        justificativa: s.dispensaRequisitoEncerramento.justificativa,
        dispensadaEm: s.dispensaRequisitoEncerramento.dispensadaEm,
        dispensadaPor: s.dispensaRequisitoEncerramento.dispensadaPor,
      })
      .from(s.dispensaRequisitoEncerramento)
      .where(
        and(
          eq(s.dispensaRequisitoEncerramento.missaoId, missaoId),
          isNull(s.dispensaRequisitoEncerramento.revogadaEm),
        ),
      );

    return new Map<string, DispensaVigente>(
      linhas.map((linha) => [
        linha.chave,
        {
          justificativa: linha.justificativa,
          dispensadaEm: linha.dispensadaEm.toISOString(),
          dispensadaPor: linha.dispensadaPor,
        },
      ]),
    );
  }

  /** Os cinco fatos, cada um conferido contra o registro que o sustenta. */
  private async fatos(
    missao: Awaited<ReturnType<EncerramentoService['carregar']>>,
  ): Promise<Omit<ItemEncerramento, 'dispensa'>[]> {
    const [[atividades], [prestacao], [produtos]] = await Promise.all([
      this.db
        .select({
          total: sql<number>`count(*)::int`,
          pendentes: sql<number>`count(*) filter (where ${s.atividadeMissao.status} = 'PLANEJADA')::int`,
        })
        .from(s.atividadeMissao)
        .where(eq(s.atividadeMissao.missaoId, missao.id)),
      this.db
        .select({ status: s.prestacaoContasMissao.status })
        .from(s.prestacaoContasMissao)
        .where(eq(s.prestacaoContasMissao.missaoId, missao.id)),
      this.db
        .select({ total: sql<number>`count(*)::int` })
        .from(s.produtoMissao)
        .where(eq(s.produtoMissao.missaoId, missao.id)),
    ]);

    const respondeuProduto =
      produtos.total > 0 || missao.semProdutoDeclaradoEm !== null;

    const itens: Record<Fato, Omit<ItemEncerramento, 'dispensa' | 'chave'>> = {
      RELATO_GERAL: {
        titulo: 'Relato da missão',
        descricao: 'O que aconteceu, escrito por quem participou.',
        aplicavel: true,
        obrigatorio: true,
        atendido: Boolean(missao.relatoGeral),
        comoResolver: 'Registre o relato geral da missão.',
      },
      ATIVIDADES_RELATADAS: {
        titulo: 'Roteiro relatado',
        descricao: 'Toda atividade precisa dizer se aconteceu e o que rendeu.',
        // O cadastro exige ao menos uma atividade, entao roteiro vazio so
        // chega por dado criado fora da API — seed ou importacao. Nesse caso a
        // linha nao bloqueia de todo jeito (zero pendentes), mas sem a marca
        // ela apareceria como "tudo relatado": verdade vazia, porque nao ha o
        // que relatar. A distincao e do que a tela diz, nao do que ela trava.
        aplicavel: atividades.total > 0,
        obrigatorio: true,
        atendido: atividades.pendentes === 0,
        comoResolver: 'Informe o que aconteceu em cada atividade do roteiro.',
      },
      PRODUTO_RESPONDIDO: {
        titulo: 'Resposta sobre produtos',
        descricao:
          'Cadastrar um produto responde "sim"; a resposta negativa é declarada.',
        aplicavel: true,
        obrigatorio: true,
        atendido: respondeuProduto,
        comoResolver:
          'Cadastre os produtos da missão ou declare que ela não gerou produto.',
      },
      PRESTACAO_VALIDADA: {
        titulo: 'Prestação de contas validada',
        descricao: 'Somente a prestação validada abate o aporte.',
        aplicavel: true,
        obrigatorio: true,
        atendido: prestacao?.status === 'VALIDADA',
        // Missao que nao gastou nada nunca chega a `VALIDADA`, porque prestacao
        // sem despesa nao e enviada (CG-054). A saida decidida em 2026-09-06 e
        // a dispensa, caso a caso — e por isso a instrucao a menciona.
        comoResolver: prestacao
          ? 'Conclua a revisão da prestação de contas.'
          : 'Inicie e valide a prestação de contas, ou dispense o requisito se a missão não teve despesa.',
      },
      AVALIACAO_OBJETIVOS: {
        titulo: 'Avaliação dos objetivos',
        descricao:
          'Alcançou o previsto? A justificativa é exigida quando não foi plenamente.',
        aplicavel: true,
        obrigatorio: true,
        atendido: missao.avaliacaoObjetivos !== null,
        comoResolver: 'Responda se a missão alcançou os objetivos previstos.',
      },
    };

    return FATOS.map((chave) => ({ chave, ...itens[chave] }));
  }

  /**
   * Documentos exigidos no encerramento, lidos do banco.
   *
   * Mesma consulta da CG-037 com outro `momento`. Requisito sem tipo vale para
   * todos; com tipo, so para o tipo que bate.
   */
  private async documentos(
    missao: Awaited<ReturnType<EncerramentoService['carregar']>>,
  ): Promise<Omit<ItemEncerramento, 'dispensa'>[]> {
    const requisitos = await this.db
      .select({
        categoria: s.requisitoSubmissao.categoria,
        obrigatorio: s.requisitoSubmissao.obrigatorio,
        descricao: s.requisitoSubmissao.descricao,
      })
      .from(s.requisitoSubmissao)
      .where(
        and(
          eq(s.requisitoSubmissao.cicloId, missao.cicloId),
          eq(s.requisitoSubmissao.momento, 'ENCERRAMENTO'),
          eq(s.requisitoSubmissao.ativo, true),
          missao.tipo
            ? or(
                isNull(s.requisitoSubmissao.tipoMissao),
                eq(s.requisitoSubmissao.tipoMissao, missao.tipo),
              )
            : isNull(s.requisitoSubmissao.tipoMissao),
        ),
      );

    if (requisitos.length === 0) return [];

    const anexados = new Set(
      (
        await this.db
          .select({ categoria: s.anexo.categoria })
          .from(s.anexo)
          .where(
            and(
              eq(s.anexo.entidadeTipo, 'MISSAO_COMITE'),
              eq(s.anexo.entidadeId, missao.id),
              eq(s.anexo.ativo, true),
            ),
          )
      ).map((linha) => linha.categoria as string),
    );

    return requisitos.map((requisito) => ({
      chave: `${PREFIXO_DOCUMENTO}${requisito.categoria}`,
      titulo: requisito.descricao ?? `Documento: ${requisito.categoria}`,
      descricao: null,
      aplicavel: true,
      obrigatorio: requisito.obrigatorio,
      atendido: anexados.has(requisito.categoria),
      comoResolver:
        requisito.descricao ?? `Anexe o documento ${requisito.categoria}.`,
    }));
  }
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? null;
}
