import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Pendencias e decisoes (P13) — a lista de trabalho da equipe.
 *
 * Na planilha eram comentarios sem dono e sem prazo, e o proprio painel anunciava
 * 10 quando a aba tinha 14 (§9.8). Aqui viram itens com status e resolucao
 * obrigatoria, e as que o sistema detecta sozinho (divergencia de saldo, PPG
 * duplicado, catalogo sem correspondencia) nascem com origem `AUTOMATICA` e nao
 * podem ser apagadas — so resolvidas. Apagar um alerta que o sistema encontrou
 * seria apagar a evidencia junto.
 */

export const criarPendenciaSchema = z.object({
  assunto: z.string().trim().min(3, 'Informe o assunto.').max(240),
  descricao: z.string().trim().min(10, 'Descreva a pendencia.').max(4000),
  impacto: z.string().trim().max(2000).nullish(),
  nivelImpacto: z.enum(['ALTA', 'MEDIA', 'BAIXA']).nullish(),
  escopoTipo: z
    .enum(['GERAL', 'REDE', 'AREA_TEMATICA', 'PPG'])
    .default('GERAL'),
  escopoId: z.uuid().nullish(),
  escopoDescricao: z.string().trim().max(200).nullish(),
  responsavelSugerido: z.string().trim().max(200).nullish(),
  prazoMomento: z.string().trim().max(200).nullish(),
});
export type CriarPendencia = z.infer<typeof criarPendenciaSchema>;

export const atualizarPendenciaSchema = z
  .object({
    status: z.enum(['PENDENTE', 'EM_ANALISE', 'MONITORAR', 'RESOLVIDA']),
    resolucao: z.string().trim().max(4000).nullish(),
    responsavelSugerido: z.string().trim().max(200).nullish(),
    nivelImpacto: z.enum(['ALTA', 'MEDIA', 'BAIXA']).nullish(),
    prazoMomento: z.string().trim().max(200).nullish(),
  })
  .refine(
    (v) => v.status !== 'RESOLVIDA' || (v.resolucao?.trim().length ?? 0) >= 10,
    {
      // Resolver sem dizer como e o que transformava a planilha num cemiterio de
      // itens "OK" que ninguem sabia explicar meses depois.
      message: 'Resolver exige o texto da resolução (mínimo 10 caracteres).',
      path: ['resolucao'],
    },
  );
export type AtualizarPendencia = z.infer<typeof atualizarPendenciaSchema>;

@Injectable()
export class PendenciasService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listar(cicloId: string) {
    return this.db
      .select({
        id: s.pendencia.id,
        codigo: s.pendencia.codigo,
        escopoTipo: s.pendencia.escopoTipo,
        escopoDescricao: s.pendencia.escopoDescricao,
        assunto: s.pendencia.assunto,
        descricao: s.pendencia.descricao,
        impacto: s.pendencia.impacto,
        nivelImpacto: s.pendencia.nivelImpacto,
        responsavelSugerido: s.pendencia.responsavelSugerido,
        prazoMomento: s.pendencia.prazoMomento,
        status: s.pendencia.status,
        origem: s.pendencia.origem,
        resolucao: s.pendencia.resolucao,
        resolvidaEm: s.pendencia.resolvidaEm,
      })
      .from(s.pendencia)
      .where(eq(s.pendencia.cicloId, cicloId))
      .orderBy(asc(s.pendencia.codigo));
  }

  async criar(cicloId: string, dto: CriarPendencia) {
    const codigo = await this.proximoCodigo(cicloId);

    const [criada] = await this.db
      .insert(s.pendencia)
      .values({
        cicloId,
        codigo,
        assunto: dto.assunto,
        descricao: dto.descricao,
        impacto: dto.impacto ?? null,
        nivelImpacto: dto.nivelImpacto ?? null,
        escopoTipo: dto.escopoTipo,
        escopoId: dto.escopoId ?? null,
        escopoDescricao: dto.escopoDescricao ?? null,
        responsavelSugerido: dto.responsavelSugerido ?? null,
        prazoMomento: dto.prazoMomento ?? null,
        origem: 'MANUAL',
      })
      .returning();

    return criada;
  }

  async atualizar(id: string, dto: AtualizarPendencia) {
    const [existente] = await this.db
      .select({ id: s.pendencia.id })
      .from(s.pendencia)
      .where(eq(s.pendencia.id, id))
      .limit(1);

    if (!existente) throw new NotFoundException('Pendência não encontrada.');

    const [atualizada] = await this.db
      .update(s.pendencia)
      .set({
        status: dto.status,
        resolucao: dto.resolucao ?? null,
        resolvidaEm: dto.status === 'RESOLVIDA' ? new Date() : null,
        responsavelSugerido: dto.responsavelSugerido ?? null,
        nivelImpacto: dto.nivelImpacto ?? null,
        prazoMomento: dto.prazoMomento ?? null,
        atualizadoEm: new Date(),
      })
      .where(eq(s.pendencia.id, id))
      .returning();

    return atualizada;
  }

  async remover(id: string): Promise<void> {
    const [pendencia] = await this.db
      .select({ origem: s.pendencia.origem, codigo: s.pendencia.codigo })
      .from(s.pendencia)
      .where(eq(s.pendencia.id, id))
      .limit(1);

    if (!pendencia) throw new NotFoundException('Pendência não encontrada.');

    if (pendencia.origem === 'AUTOMATICA') {
      throw new ForbiddenException(
        `${pendencia.codigo} foi detectada pelo sistema e não pode ser excluída. ` +
          'Resolva-a, informando o que foi feito.',
      );
    }

    await this.db.delete(s.pendencia).where(eq(s.pendencia.id, id));
  }

  private async proximoCodigo(cicloId: string): Promise<string> {
    const { proximo } = await consultarUma<{ proximo: number }>(
      this.db,
      sql`
      select coalesce(max(substring(codigo from '[0-9]+$')::int), 0) + 1 as proximo
        from pendencia
       where ciclo_id = ${cicloId}
    `,
    );

    return `PEND-${String(proximo).padStart(3, '0')}`;
  }
}
