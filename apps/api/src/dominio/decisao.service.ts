import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { violouUnicidade } from '../comum/postgres';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import {
  destinatariosDaMissao,
  NotificacoesService,
} from './notificacoes.service';

/**
 * Decisoes do Comite e rodadas de ajuste (CG-038).
 *
 * Modelo B: o colegiado delibera em reuniao (semanal, podendo haver semana sem
 * reuniao) e um relator registra o parecer aqui, informando a data daquela
 * deliberacao. **Nao ha designacao previa de relator** — decisao de 2026-09-05:
 * quem tem `missao:decide` decide, e o parecer registra quem foi. Tambem nao ha
 * quorum nem votacao; se um dia houver, `decisao_comite` ja tem rodada e
 * autoria e a votacao entra como tabela filha.
 *
 * A garantia central e negativa e vem do banco: **nenhuma decisao e apagada ou
 * sobrescrita**. Decidir encerra a rodada; reabrir cria outra.
 */

export const decidirSchema = z
  .object({
    acao: z.enum(['APROVAR', 'SOLICITAR_AJUSTES', 'REPROVAR']),
    parecer: z.string().trim().min(3, 'Descreva o parecer.').max(4000),
    /** Data da reuniao que deliberou; so nas decisoes terminais. */
    reuniaoData: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
      .optional(),
    observacoes: z.string().trim().max(2000).optional(),
  })
  .refine((v) => (v.acao === 'SOLICITAR_AJUSTES') === !v.reuniaoData, {
    message:
      'Aprovar e reprovar exigem a data da reuniao; solicitar ajustes nao a aceita.',
    path: ['reuniaoData'],
  });
export type Decidir = z.infer<typeof decidirSchema>;

export const reabrirSchema = z.object({
  justificativa: z.string().trim().min(3, 'Justifique a reabertura.').max(2000),
});
export type Reabrir = z.infer<typeof reabrirSchema>;

/** Para onde cada decisao leva a dimensao de aprovacao. */
/** O que a decisao vira no titulo do aviso. */
const ROTULO_DECISAO = {
  APROVAR: 'missão aprovada pelo Comitê',
  SOLICITAR_AJUSTES: 'ajustes solicitados pelo Comitê',
  REPROVAR: 'missão reprovada pelo Comitê',
} as const;

const DESTINO = {
  APROVAR: 'APROVADA',
  SOLICITAR_AJUSTES: 'AJUSTES_SOLICITADOS',
  REPROVAR: 'REPROVADA',
} as const;

@Injectable()
export class DecisaoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notificacoes: NotificacoesService,
  ) {}

  /**
   * Registra a decisao que encerra a rodada aberta.
   *
   * Os **documentos analisados sao fotografados aqui**, automaticamente
   * (decisao de 2026-09-05). Deixar o relator marcar produziria parecer sem
   * lastro sempre que ele esquecesse; e vincular a decisao a "os anexos da
   * missao" faria um upload posterior mudar retroativamente o que o Comite diz
   * ter analisado. A copia congela a lista e a versao de cada arquivo.
   */
  async decidir(
    cicloId: string,
    missaoId: string,
    dto: Decidir,
    usuario: AuthUser,
  ) {
    const missao = await this.carregar(cicloId, missaoId);

    if (missao.statusAprovacao !== 'EM_ANALISE') {
      throw new ConflictException(
        'Somente missao em analise recebe decisao. Envie-a para analise antes.',
      );
    }
    if (dto.reuniaoData && dto.reuniaoData > hoje()) {
      // A data e informada, nunca derivada — mas nao pode ser de uma reuniao
      // que ainda nao aconteceu.
      throw new BadRequestException(
        'A data da reuniao nao pode estar no futuro.',
      );
    }

    const rodada = await this.rodadaAberta(missaoId);

    // A checagem de `EM_ANALISE` acima e feita fora da transacao, entao duas
    // decisoes simultaneas passam as duas por ela. Quem de fato impede o
    // segundo estado final e `decisao_comite_rodada_uk`, no banco — mas ele
    // reporta violacao de unicidade, que sairia como **500**. Traduzir aqui e
    // o que transforma "erro do servidor" em "alguem decidiu primeiro", que e
    // o que aconteceu.
    try {
      return await this.gravarDecisao(missaoId, missao, rodada, dto, usuario);
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          'Esta rodada ja recebeu decisao. Recarregue a missao para ver qual foi.',
        );
      }
      throw erro;
    }
  }

  /** O corpo transacional de `decidir`, isolado para o tratamento da corrida. */
  private async gravarDecisao(
    missaoId: string,
    missao: { codigo: string; cicloId: string },
    rodada: { id: string; numero: number },
    dto: Decidir,
    usuario: AuthUser,
  ) {
    return this.db.transaction(async (tx) => {
      const [decisao] = await tx
        .insert(s.decisaoComite)
        .values({
          rodadaId: rodada.id,
          acao: dto.acao,
          parecer: dto.parecer,
          reuniaoData: dto.reuniaoData ?? null,
          observacoes: dto.observacoes ?? null,
          decididoPorId: usuario.id,
          decididoPor: usuario.name ?? usuario.username ?? null,
        })
        .returning({
          id: s.decisaoComite.id,
          decididoEm: s.decisaoComite.decididoEm,
        });

      const documentos = await tx
        .select({ id: s.anexo.id, versao: s.anexo.versao })
        .from(s.anexo)
        .where(
          and(
            eq(s.anexo.entidadeTipo, 'MISSAO_COMITE'),
            eq(s.anexo.entidadeId, missaoId),
            eq(s.anexo.ativo, true),
          ),
        );

      if (documentos.length > 0) {
        await tx.insert(s.decisaoDocumento).values(
          documentos.map((documento) => ({
            decisaoId: decisao.id,
            anexoId: documento.id,
            versao: documento.versao,
          })),
        );
      }

      await tx
        .update(s.rodadaAnalise)
        .set({ encerradaEm: sql`now()` })
        .where(eq(s.rodadaAnalise.id, rodada.id));

      const destino = DESTINO[dto.acao];
      await tx
        .update(s.missaoComite)
        .set({ statusAprovacao: destino, atualizadoEm: new Date() })
        .where(eq(s.missaoComite.id, missaoId));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        acao: 'EDICAO',
        campo: 'statusAprovacao',
        valorAnterior: 'EM_ANALISE',
        valorNovo: destino,
        justificativa: dto.parecer,
        usuarioId: usuario.id,
        usuarioNome: usuario.name ?? usuario.username ?? null,
      });

      // Na mesma transacao do fato (D-11). Se o insert da notificacao
      // falhasse, a decisao inteira volta atras — o que e certo: uma decisao
      // que ninguem sera avisado de que existe e pior que uma decisao a
      // repetir. O que **nao** pode e o contrario, e por isso a entrega
      // externa e um passo separado.
      await this.notificacoes.registrar(
        tx,
        (await destinatariosDaMissao(tx, missaoId)).map((destinatarioId) => ({
          tipo: 'DECISAO_COMITE' as const,
          destinatarioId,
          missaoId,
          titulo: `${missao.codigo}: ${ROTULO_DECISAO[dto.acao]}`,
          corpo: dto.parecer,
          origemPor: usuario.name ?? usuario.username ?? null,
        })),
        (await this.pessoaDoUsuario(usuario)) ?? null,
      );

      return {
        decisaoId: decisao.id,
        rodada: rodada.numero,
        acao: dto.acao,
        statusAprovacao: destino,
        documentosAnalisados: documentos.length,
        decididoEm: decisao.decididoEm,
      };
    });
  }

  /**
   * Reabre a analise de uma missao ja decidida.
   *
   * Cria rodada nova em vez de reverter a anterior: a decisao original continua
   * no historico, que e a garantia que a CG-019 fixou no banco. Exige
   * `missao:reopen`, hoje so do `admin`.
   */
  async reabrir(
    cicloId: string,
    missaoId: string,
    dto: Reabrir,
    usuario: AuthUser,
  ) {
    const missao = await this.carregar(cicloId, missaoId);

    if (
      missao.statusAprovacao !== 'APROVADA' &&
      missao.statusAprovacao !== 'REPROVADA'
    ) {
      throw new ConflictException(
        'So se reabre analise ja decidida (aprovada ou reprovada).',
      );
    }

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
          origem: 'REABERTURA',
          justificativa: dto.justificativa,
          submetidoPorId: usuario.id,
          submetidoPor: usuario.name ?? usuario.username ?? null,
        })
        .returning({
          id: s.rodadaAnalise.id,
          numero: s.rodadaAnalise.numero,
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
        justificativa: dto.justificativa,
        usuarioId: usuario.id,
        usuarioNome: usuario.name ?? usuario.username ?? null,
      });

      return {
        rodadaId: rodada.id,
        numero: rodada.numero,
        statusAprovacao: 'EM_ANALISE' as const,
      };
    });
  }

  /**
   * Historico completo da analise: toda rodada, com a decisao que a encerrou.
   *
   * Rodada sem decisao e a que esta aberta — e por isso `decisao` e nulavel
   * aqui em vez de a consulta escondê-la.
   */
  async historico(cicloId: string, missaoId: string) {
    await this.carregar(cicloId, missaoId);

    const rodadas = await this.db
      .select({
        id: s.rodadaAnalise.id,
        numero: s.rodadaAnalise.numero,
        origem: s.rodadaAnalise.origem,
        justificativa: s.rodadaAnalise.justificativa,
        submetidoPor: s.rodadaAnalise.submetidoPor,
        submetidoEm: s.rodadaAnalise.submetidoEm,
        encerradaEm: s.rodadaAnalise.encerradaEm,
      })
      .from(s.rodadaAnalise)
      .where(eq(s.rodadaAnalise.missaoId, missaoId))
      .orderBy(desc(s.rodadaAnalise.numero));

    if (rodadas.length === 0) return [];

    const decisoes = await this.db
      .select({
        rodadaId: s.decisaoComite.rodadaId,
        id: s.decisaoComite.id,
        acao: s.decisaoComite.acao,
        parecer: s.decisaoComite.parecer,
        reuniaoData: s.decisaoComite.reuniaoData,
        observacoes: s.decisaoComite.observacoes,
        decididoPor: s.decisaoComite.decididoPor,
        decididoEm: s.decisaoComite.decididoEm,
      })
      .from(s.decisaoComite)
      .innerJoin(
        s.rodadaAnalise,
        eq(s.decisaoComite.rodadaId, s.rodadaAnalise.id),
      )
      .where(eq(s.rodadaAnalise.missaoId, missaoId));

    const documentos = await this.db
      .select({
        decisaoId: s.decisaoDocumento.decisaoId,
        anexoId: s.decisaoDocumento.anexoId,
        versao: s.decisaoDocumento.versao,
        nome: s.anexo.nome,
        categoria: s.anexo.categoria,
      })
      .from(s.decisaoDocumento)
      .innerJoin(s.anexo, eq(s.anexo.id, s.decisaoDocumento.anexoId))
      .innerJoin(
        s.decisaoComite,
        eq(s.decisaoComite.id, s.decisaoDocumento.decisaoId),
      )
      .innerJoin(
        s.rodadaAnalise,
        eq(s.decisaoComite.rodadaId, s.rodadaAnalise.id),
      )
      .where(eq(s.rodadaAnalise.missaoId, missaoId))
      .orderBy(asc(s.anexo.nome));

    return rodadas.map((rodada) => {
      const decisao = decisoes.find((d) => d.rodadaId === rodada.id) ?? null;
      return {
        ...rodada,
        decisao: decisao
          ? {
              ...decisao,
              documentosAnalisados: documentos
                .filter((d) => d.decisaoId === decisao.id)
                .map(({ anexoId, versao, nome, categoria }) => ({
                  anexoId,
                  versao,
                  nome,
                  categoria,
                })),
            }
          : null,
      };
    });
  }

  // -------------------------------------------------------------------------

  /** A pessoa por tras do `sub`, quando ha vinculo; usada para nao se avisar. */
  private async pessoaDoUsuario(usuario: AuthUser): Promise<string | null> {
    const [linha] = await this.db
      .select({ pessoaId: s.usuarioSistema.pessoaId })
      .from(s.usuarioSistema)
      .where(
        and(
          eq(s.usuarioSistema.sub, usuario.id),
          eq(s.usuarioSistema.ativo, true),
        ),
      );
    return linha?.pessoaId ?? null;
  }

  private async carregar(cicloId: string, missaoId: string) {
    const [missao] = await this.db
      .select({
        id: s.missaoComite.id,
        codigo: s.missaoComite.codigo,
        cicloId: s.missaoComite.cicloId,
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

    if (!missao) throw new NotFoundException('Missao nao encontrada.');
    return missao;
  }

  /**
   * A rodada que aguarda decisao.
   *
   * O banco garante no maximo uma aberta por missao, entao aqui nao ha
   * ambiguidade a resolver — so a ausencia a reportar.
   */
  private async rodadaAberta(missaoId: string) {
    const [rodada] = await this.db
      .select({ id: s.rodadaAnalise.id, numero: s.rodadaAnalise.numero })
      .from(s.rodadaAnalise)
      .where(
        and(
          eq(s.rodadaAnalise.missaoId, missaoId),
          isNull(s.rodadaAnalise.encerradaEm),
        ),
      );

    if (!rodada) {
      throw new ConflictException(
        'Nao ha rodada de analise aberta para esta missao.',
      );
    }
    return rodada;
  }
}

/** Data de hoje em AAAA-MM-DD, para comparar com a data informada. */
function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}
