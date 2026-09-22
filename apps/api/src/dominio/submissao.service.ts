import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq, isNull, or, sql } from 'drizzle-orm';

import type { AuthUser } from '../auth/auth-user';
import { IdentidadeService } from '../auth/identidade.service';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { membrosDoComite, NotificacoesService } from './notificacoes.service';

/**
 * Submissao da missao para analise do Comite (CG-037).
 *
 * Modelo B, homologado em 2026-09-05: o colegiado delibera fora do sistema e um
 * relator registra a decisao. Aqui cuidamos so do lado de quem envia — abrir a
 * rodada, conferir os requisitos e congelar o que passou a estar sob analise.
 *
 * **Os requisitos sao lidos do banco, nunca de uma constante.** Foi decisao
 * explicita do responsavel: "uma missao pode ser diferente da outra, e se
 * fecharmos o escopo pode ser que nao seja possivel adicionar uma nova missao
 * no futuro". Uma lista fixa aqui atenderia o caso de hoje e exigiria deploy
 * para acomodar o primeiro tipo novo.
 */

/** Um requisito e o estado dele naquela missao. */
export interface RequisitoAvaliado {
  categoria: string;
  obrigatorio: boolean;
  descricao: string | null;
  atendido: boolean;
}

export interface AvaliacaoSubmissao {
  podeSubmeter: boolean;
  requisitos: RequisitoAvaliado[];
  /** So os obrigatorios que faltam; e o que a mensagem de erro usa. */
  pendencias: string[];
}

const ESTADOS_QUE_PERMITEM_ENVIO = ['RASCUNHO', 'AJUSTES_SOLICITADOS'] as const;

@Injectable()
export class SubmissaoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Checklist da missao, para a tela mostrar antes de tentar enviar.
   *
   * Existe separado de `submeter` porque descobrir o que falta so no momento do
   * envio transforma a conferencia em tentativa e erro.
   */
  async avaliar(
    cicloId: string,
    missaoId: string,
  ): Promise<AvaliacaoSubmissao> {
    const missao = await this.carregar(cicloId, missaoId);
    return this.avaliarRequisitos(missao.cicloId, missaoId, missao.tipo);
  }

  /**
   * Envia a missao para analise, abrindo uma rodada.
   *
   * Reenviar depois de ajustes cria rodada **nova**: a anterior e a decisao que
   * a encerrou continuam no historico. Isso e garantido pelo banco, nao aqui.
   */
  async submeter(cicloId: string, missaoId: string, usuario: AuthUser) {
    const missao = await this.carregar(cicloId, missaoId);

    if (
      !ESTADOS_QUE_PERMITEM_ENVIO.includes(
        missao.statusAprovacao as (typeof ESTADOS_QUE_PERMITEM_ENVIO)[number],
      )
    ) {
      throw new ConflictException(
        missao.statusAprovacao === 'EM_ANALISE'
          ? 'Esta missão já está em análise.'
          : `Missão ${rotulo(missao.statusAprovacao)} não pode ser enviada; reabra a análise antes.`,
      );
    }

    await this.exigirResponsavel(missaoId, usuario);

    const avaliacao = await this.avaliarRequisitos(
      missao.cicloId,
      missaoId,
      missao.tipo,
    );
    if (!avaliacao.podeSubmeter) {
      // 422 e nao 400: o corpo da requisicao esta correto; o que falta e estado
      // da missao. A lista vai junto para a tela dizer o que anexar.
      throw new UnprocessableEntityException({
        message: 'A missão não atende aos requisitos de submissão.',
        pendencias: avaliacao.pendencias,
      });
    }

    const identidade = await this.identidade.resolver(usuario);

    return this.db.transaction(async (tx) => {
      const [{ proximo }] = await tx
        .select({
          proximo: sql<number>`coalesce(max(${s.rodadaAnalise.numero}), 0) + 1`,
        })
        .from(s.rodadaAnalise)
        .where(eq(s.rodadaAnalise.missaoId, missaoId));

      const [rodada] = await tx
        .insert(s.rodadaAnalise)
        .values({
          missaoId,
          numero: proximo,
          origem: 'SUBMISSAO',
          submetidoPorId: usuario.id,
          submetidoPor: usuario.name ?? usuario.username ?? null,
          submetidoPorPessoaId: identidade?.pessoaId ?? null,
        })
        .returning({
          id: s.rodadaAnalise.id,
          numero: s.rodadaAnalise.numero,
          submetidoEm: s.rodadaAnalise.submetidoEm,
        });

      await tx
        .update(s.missaoComite)
        .set({ statusAprovacao: 'EM_ANALISE', atualizadoEm: new Date() })
        .where(eq(s.missaoComite.id, missaoId));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        acao: 'EDICAO',
        campo: 'statusAprovacao',
        valorAnterior: missao.statusAprovacao,
        valorNovo: 'EM_ANALISE',
        usuarioId: usuario.id,
        usuarioNome: usuario.name ?? usuario.username ?? null,
      });

      // Quem decide precisa saber que ha coisa na fila (D-11). Sem isso a
      // fila so e vista por quem lembra de abri-la, e a missao espera a
      // proxima reuniao por falta de aviso, nao por falta de decisao.
      await this.notificacoes.registrar(
        tx,
        (await membrosDoComite(tx, missao.cicloId)).map((destinatarioId) => ({
          tipo: 'MISSAO_SUBMETIDA' as const,
          destinatarioId,
          missaoId,
          titulo: `${missao.codigo} aguarda análise do Comitê`,
          corpo:
            `A missão ${missao.codigo} — ${missao.titulo} foi enviada para ` +
            `análise (rodada ${rodada.numero}).`,
          origemPor: usuario.name ?? usuario.username ?? null,
        })),
        identidade?.pessoaId ?? null,
      );

      return {
        rodadaId: rodada.id,
        numero: rodada.numero,
        submetidoEm: rodada.submetidoEm,
        statusAprovacao: 'EM_ANALISE' as const,
      };
    });
  }

  // -------------------------------------------------------------------------

  private async carregar(cicloId: string, missaoId: string) {
    const [missao] = await this.db
      .select({
        id: s.missaoComite.id,
        codigo: s.missaoComite.codigo,
        titulo: s.missaoComite.titulo,
        cicloId: s.missaoComite.cicloId,
        tipo: s.missaoComite.tipo,
        status: s.missaoComite.status,
        statusAprovacao: s.missaoComite.statusAprovacao,
      })
      .from(s.missaoComite)
      .where(
        and(
          eq(s.missaoComite.id, missaoId),
          eq(s.missaoComite.cicloId, cicloId),
        ),
      );

    if (!missao) throw new NotFoundException('Missão não encontrada.');
    if (missao.status === 'CANCELADA') {
      throw new ConflictException('Missão cancelada não vai à análise.');
    }
    return missao;
  }

  /**
   * "Somente o responsavel pela missao envia" (decisao de 2026-09-05).
   *
   * Quem tem `missao:submit` em **alcance global** passa sempre — sem isso, a
   * PROPESP nao conseguiria destravar uma missao cujo responsavel saiu da
   * instituicao. Ate 2026-09-21 a excecao era `roles.includes('admin')`, papel
   * do Keycloak, que desde a V1-012 nao concede nada e em producao nem existe:
   * o administrador real ficava preso a mesma regra do responsavel.
   *
   * A regra so e verificavel porque existe o vinculo `sub` -> `pessoa`. Conta
   * sem vinculo possivel recebe 403 com instrucao — nao da para afirmar que
   * alguem e o responsavel quando nao se sabe quem essa pessoa e.
   */
  private async exigirResponsavel(
    missaoId: string,
    usuario: AuthUser,
  ): Promise<void> {
    const acesso = await this.identidade.acessoDe(usuario);
    if (acesso.alcance('missao:submit').global) return;

    const identidade = await this.identidade.resolver(usuario);
    if (!identidade) {
      throw new ForbiddenException(
        'Sua conta ainda não está vinculada a uma pessoa do cadastro. ' +
          'Peca a um administrador para fazer a associacao.',
      );
    }

    const [responsavel] = await this.db
      .select({ id: s.missaoParticipante.id })
      .from(s.missaoParticipante)
      .where(
        and(
          eq(s.missaoParticipante.missaoId, missaoId),
          eq(s.missaoParticipante.pessoaId, identidade.pessoaId),
          eq(s.missaoParticipante.papel, 'RESPONSAVEL'),
        ),
      );

    if (!responsavel) {
      throw new ForbiddenException(
        'Somente o responsável pela missão pode enviá-la para análise.',
      );
    }
  }

  /**
   * Confronta os requisitos do ciclo com os documentos ativos da missao.
   *
   * Um requisito vale para a missao quando nao tem tipo (`is null`, todos os
   * tipos) ou quando o tipo bate com o dela.
   */
  private async avaliarRequisitos(
    cicloId: string,
    missaoId: string,
    tipoMissao: string | null,
  ): Promise<AvaliacaoSubmissao> {
    const requisitos = await this.db
      .select({
        categoria: s.requisitoSubmissao.categoria,
        obrigatorio: s.requisitoSubmissao.obrigatorio,
        descricao: s.requisitoSubmissao.descricao,
      })
      .from(s.requisitoSubmissao)
      .where(
        and(
          eq(s.requisitoSubmissao.cicloId, cicloId),
          eq(s.requisitoSubmissao.momento, 'SUBMISSAO'),
          eq(s.requisitoSubmissao.ativo, true),
          tipoMissao
            ? or(
                isNull(s.requisitoSubmissao.tipoMissao),
                eq(
                  s.requisitoSubmissao.tipoMissao,
                  tipoMissao as 'VISITA_TECNICA',
                ),
              )
            : isNull(s.requisitoSubmissao.tipoMissao),
        ),
      );

    const anexados = new Set(
      (
        await this.db
          .select({ categoria: s.anexo.categoria })
          .from(s.anexo)
          .where(
            and(
              eq(s.anexo.entidadeTipo, 'MISSAO_COMITE'),
              eq(s.anexo.entidadeId, missaoId),
              eq(s.anexo.ativo, true),
            ),
          )
      ).map((linha) => linha.categoria as string),
    );

    const avaliados: RequisitoAvaliado[] = requisitos.map((requisito) => ({
      categoria: requisito.categoria,
      obrigatorio: requisito.obrigatorio,
      descricao: requisito.descricao,
      atendido: anexados.has(requisito.categoria),
    }));

    const pendencias = avaliados
      .filter((r) => r.obrigatorio && !r.atendido)
      .map((r) => r.descricao ?? `Documento obrigatorio: ${r.categoria}.`);

    return {
      podeSubmeter: pendencias.length === 0,
      requisitos: avaliados,
      pendencias,
    };
  }
}

function rotulo(status: string): string {
  const rotulos: Record<string, string> = {
    EM_ANALISE: 'em analise',
    APROVADA: 'ja aprovada',
    REPROVADA: 'reprovada',
  };
  return rotulos[status] ?? status.toLowerCase();
}
