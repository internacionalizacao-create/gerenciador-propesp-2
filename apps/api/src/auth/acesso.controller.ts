import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import type { AuthUser } from './auth-user';
import { CurrentUser, RequirePermission } from './auth.decorators';

/**
 * Administracao de identidade e escopo (CG-003, recorte provisorio).
 *
 * O papel continua vindo do Keycloak — quem cria conta e concede papel e o
 * administrador, no console. O que mora aqui e a outra metade, que o Keycloak
 * nao sabe: **sobre quais PPGs e redes** aquela conta manda.
 *
 * Tudo exige `acesso:write`, hoje so do `admin`. Conceder acesso e ato
 * administrativo, e cada linha guarda quem concedeu.
 */

export const concederEscopoSchema = z
  .object({
    tipo: z.enum(['GLOBAL', 'PPG', 'REDE']),
    ppgId: z.uuid().optional(),
    redeId: z.uuid().optional(),
  })
  .refine(
    (v) =>
      (v.tipo === 'GLOBAL' && !v.ppgId && !v.redeId) ||
      (v.tipo === 'PPG' && !!v.ppgId && !v.redeId) ||
      (v.tipo === 'REDE' && !!v.redeId && !v.ppgId),
    { message: 'Informe exatamente o alvo correspondente ao tipo de escopo.' },
  );
export type ConcederEscopo = z.infer<typeof concederEscopoSchema>;

@Controller('acesso')
export class AcessoController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Contas ligadas ao cadastro local, com os escopos de cada uma. */
  @Get('usuarios')
  @RequirePermission('acesso:read')
  async listar() {
    const contas = await this.db
      .select({
        id: s.usuarioSistema.id,
        sub: s.usuarioSistema.sub,
        username: s.usuarioSistema.username,
        email: s.usuarioSistema.email,
        origem: s.usuarioSistema.origem,
        vinculadoEm: s.usuarioSistema.vinculadoEm,
        ultimoAcessoEm: s.usuarioSistema.ultimoAcessoEm,
        ativo: s.usuarioSistema.ativo,
        pessoaId: s.pessoa.id,
        pessoaNome: s.pessoa.nome,
      })
      .from(s.usuarioSistema)
      .innerJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
      .orderBy(asc(s.pessoa.nome));

    const escopos = await this.db
      .select({
        usuarioId: s.escopoAcesso.usuarioId,
        id: s.escopoAcesso.id,
        tipo: s.escopoAcesso.tipo,
        ppgId: s.escopoAcesso.ppgId,
        redeId: s.escopoAcesso.redeId,
      })
      .from(s.escopoAcesso)
      .where(eq(s.escopoAcesso.ativo, true));

    return contas.map((conta) => ({
      ...conta,
      escopos: escopos.filter((e) => e.usuarioId === conta.id),
    }));
  }

  @Post('usuarios/:id/escopos')
  @RequirePermission('acesso:write')
  async conceder(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
    @Body(new ZodValidationPipe(concederEscopoSchema)) dto: ConcederEscopo,
    @CurrentUser() usuario: AuthUser,
  ) {
    const [conta] = await this.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.id, usuarioId));
    if (!conta) throw new NotFoundException('Usuário não encontrado.');

    // Reconceder um escopo ja existente reativa em vez de duplicar: o indice
    // parcial recusaria a segunda linha, e o erro de unicidade nao explica ao
    // administrador que o acesso apenas estava inativo.
    const [existente] = await this.db
      .select({ id: s.escopoAcesso.id })
      .from(s.escopoAcesso)
      .where(
        and(
          eq(s.escopoAcesso.usuarioId, usuarioId),
          eq(s.escopoAcesso.tipo, dto.tipo),
          dto.ppgId
            ? eq(s.escopoAcesso.ppgId, dto.ppgId)
            : dto.redeId
              ? eq(s.escopoAcesso.redeId, dto.redeId)
              : eq(s.escopoAcesso.tipo, 'GLOBAL'),
        ),
      );

    if (existente) {
      await this.db
        .update(s.escopoAcesso)
        .set({ ativo: true, concedidoPorId: usuario.id })
        .where(eq(s.escopoAcesso.id, existente.id));
      return { id: existente.id, reativado: true };
    }

    const [criado] = await this.db
      .insert(s.escopoAcesso)
      .values({
        usuarioId,
        tipo: dto.tipo,
        ppgId: dto.ppgId ?? null,
        redeId: dto.redeId ?? null,
        concedidoPorId: usuario.id,
      })
      .returning({ id: s.escopoAcesso.id });

    return { id: criado.id, reativado: false };
  }

  /**
   * Revoga um escopo.
   *
   * Inativa, nao apaga: saber que alguem teve acesso a uma rede e quando o
   * perdeu e parte da auditoria, e um `delete` levaria isso junto.
   */
  @Delete('escopos/:id')
  @RequirePermission('acesso:write')
  async revogar(
    @Param('id', new ZodValidationPipe(z.uuid('Escopo inválido.')))
    escopoId: string,
  ) {
    const atualizados = await this.db
      .update(s.escopoAcesso)
      .set({ ativo: false })
      .where(eq(s.escopoAcesso.id, escopoId))
      .returning({ id: s.escopoAcesso.id });

    if (atualizados.length === 0) {
      throw new NotFoundException('Escopo não encontrado.');
    }
    return { revogado: true };
  }

  /**
   * Reassocia uma conta a outra pessoa.
   *
   * Existe porque o vinculo automatico por e-mail erra em dois casos previsiveis:
   * conta criada sem e-mail, e conta cujo e-mail nao e o mesmo do cadastro.
   */
  @Post('usuarios/:id/pessoa')
  @RequirePermission('acesso:write')
  async reassociar(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
    @Body(new ZodValidationPipe(z.object({ pessoaId: z.uuid() })))
    dto: { pessoaId: string },
    @CurrentUser() usuario: AuthUser,
  ) {
    const [pessoa] = await this.db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(eq(s.pessoa.id, dto.pessoaId));
    if (!pessoa) throw new NotFoundException('Pessoa não encontrada.');

    const [jaVinculada] = await this.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.pessoaId, dto.pessoaId));
    if (jaVinculada && jaVinculada.id !== usuarioId) {
      throw new BadRequestException(
        'Esta pessoa já está vinculada a outra conta.',
      );
    }

    const atualizados = await this.db
      .update(s.usuarioSistema)
      .set({
        pessoaId: dto.pessoaId,
        origem: 'MANUAL',
        vinculadoPorId: usuario.id,
      })
      .where(eq(s.usuarioSistema.id, usuarioId))
      .returning({ id: s.usuarioSistema.id });

    if (atualizados.length === 0) {
      throw new NotFoundException('Usuário não encontrado.');
    }
    return { vinculado: true };
  }
}
