import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import type { AuthUser } from './auth-user';
import { CurrentUser, RequirePermission } from './auth.decorators';
import {
  ConcessoesService,
  lotedeConcessoesSchema,
  reassociacaoSchema,
  revogacaoSchema,
  type LoteDeConcessoes,
  type Reassociacao,
  type Revogacao,
} from './autorizacao-v1/concessoes.service';

/**
 * Administracao de identidade e concessoes (V1-017).
 *
 * O Keycloak so autentica: quem responde "o que esta conta pode fazer, e sobre
 * o que" sao as concessoes administradas aqui. Cada linha guarda quem concedeu,
 * quando e por que, e a politica de `autorizacao-v1/administracao.ts` governa
 * quem pode administrar o que — inclusive proibindo autoalteracao.
 */

@Controller('acesso')
export class AcessoController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly concessoes: ConcessoesService,
  ) {}

  /** Catalogo de acoes e modelos, para a tela montar as opcoes. */
  @Get('catalogo')
  @RequirePermission('acesso:read')
  catalogo() {
    return this.concessoes.catalogo();
  }

  /** Alvos disponiveis para o seletor de alcance da tela. */
  @Get('alvos')
  @RequirePermission('acesso:read')
  async alvos() {
    return this.concessoes.alvos();
  }

  /** Concessoes de uma conta, ativas e revogadas, com o alvo tipado. */
  @Get('usuarios/:id/concessoes')
  @RequirePermission('acesso:read')
  async listarConcessoes(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
  ) {
    return this.concessoes.listar(usuarioId);
  }

  /**
   * O que o lote faria, sem gravar.
   *
   * Rota propria, e nao um `?previa=true` no POST: um parametro que decide
   * entre gravar e nao gravar e o tipo de coisa que se erra uma vez.
   */
  @Post('usuarios/:id/concessoes/previa')
  @HttpCode(200)
  @RequirePermission('acesso:read', 'acesso:write')
  async previa(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
    @Body(new ZodValidationPipe(lotedeConcessoesSchema)) dto: LoteDeConcessoes,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.concessoes.previa(usuario, usuarioId, dto);
  }

  /** Aplica o lote inteiro, ou nenhum item dele. */
  @Post('usuarios/:id/concessoes')
  @RequirePermission('acesso:write')
  async conceder(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
    @Body(new ZodValidationPipe(lotedeConcessoesSchema)) dto: LoteDeConcessoes,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.concessoes.conceder(usuario, usuarioId, dto);
  }

  /** Revoga uma concessao; inativa, nunca apaga. */
  @Post('concessoes/:id/revogacao')
  @RequirePermission('acesso:write')
  async revogarConcessao(
    @Param('id', new ZodValidationPipe(z.uuid('Concessão inválida.')))
    concessaoId: string,
    @Body(new ZodValidationPipe(revogacaoSchema)) dto: Revogacao,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.concessoes.revogar(usuario, concessaoId, dto);
  }

  /**
   * Contas locais, vinculadas ou pendentes. O alcance vive nas concessoes.
   *
   * As pendentes vem primeiro: sao as que esperam alguem agir, e no fim de uma
   * lista alfabetica ninguem as veria.
   */
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
      .leftJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
      .orderBy(
        desc(
          sql`${s.usuarioSistema.pessoaId} is null and ${s.usuarioSistema.ativo}`,
        ),
        asc(s.pessoa.nome),
        asc(s.usuarioSistema.email),
      );

    return contas;
  }

  /**
   * Reassocia uma conta a outra pessoa.
   *
   * Existe porque o vinculo automatico por e-mail erra em dois casos previsiveis:
   * conta criada sem e-mail, e conta cujo e-mail nao e o mesmo do cadastro.
   */
  @Post('usuarios/:id/pessoa')
  @RequirePermission('acesso:manage-identidade')
  reassociar(
    @Param('id', new ZodValidationPipe(z.uuid('Usuário inválido.')))
    usuarioId: string,
    @Body(new ZodValidationPipe(reassociacaoSchema)) dto: Reassociacao,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.concessoes.reassociarPessoa(usuario, usuarioId, dto);
  }
}
