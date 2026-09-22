import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import {
  AcessoAtual,
  CurrentUser,
  RequirePermission,
} from '../auth/auth.decorators';
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { ContextoService } from './contexto.service';
import {
  corrigirEventoBolsistaSchema,
  corrigirMovimentacaoSchema,
  EventosExternosService,
  registrarEventoBolsistaSchema,
  registrarMovimentacaoSchema,
  type CorrigirEventoBolsista,
  type CorrigirMovimentacao,
  type RegistrarEventoBolsista,
  type RegistrarMovimentacao,
} from './eventos-externos.service';

/**
 * Eventos externos da CAPES (V1-036) — registro do que ja aconteceu la.
 *
 * Tres controllers pelo mesmo motivo da pendencia: o evento nasce a partir da
 * bolsa ou do ciclo, e depois o `id` basta para corrigi-lo.
 */
@Controller('eventos-externos')
export class EventosExternosController {
  constructor(private readonly eventos: EventosExternosService) {}

  @Get('tipos')
  @RequirePermission('evento:read')
  tipos() {
    return this.eventos.tipos();
  }

  @Patch('bolsistas/:id')
  @RequirePermission('evento:edit')
  corrigirEvento(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(corrigirEventoBolsistaSchema))
    dto: CorrigirEventoBolsista,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.eventos.corrigir(id, dto, usuario, acesso);
  }

  @Patch('movimentacoes/:id')
  @RequirePermission('evento:edit')
  corrigirMovimentacao(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(corrigirMovimentacaoSchema))
    dto: CorrigirMovimentacao,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.eventos.corrigirMovimentacao(id, dto, usuario, acesso);
  }
}

/** Historico e registro a partir da bolsa. */
@Controller('bolsistas')
export class EventosDaBolsaController {
  constructor(private readonly eventos: EventosExternosService) {}

  @Get(':id/eventos')
  @RequirePermission('evento:read')
  listar(@Param('id') id: string, @AcessoAtual() acesso: AcessoResolvido) {
    return this.eventos.daBolsa(id, acesso);
  }

  /** Alem de `evento:create`, o servico exige `bolsa:edit` sobre a bolsa. */
  @Post(':id/eventos')
  @RequirePermission('evento:create')
  registrar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(registrarEventoBolsistaSchema))
    dto: RegistrarEventoBolsista,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.eventos.registrar(id, dto, usuario, acesso);
  }
}

/** P12 · historico do ciclo. */
@Controller('programas')
export class EventosDoCicloController {
  constructor(
    private readonly eventos: EventosExternosService,
    private readonly contexto: ContextoService,
  ) {}

  @Get(':programa/:ciclo/eventos-bolsista')
  @RequirePermission('evento:read')
  async eventosDoCiclo(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    const ciclo = await this.contexto.resolver(
      slug,
      nome,
      acesso.alcance('evento:read'),
    );
    return { ciclo, eventos: await this.eventos.doCiclo(ciclo, acesso) };
  }

  @Get(':programa/:ciclo/movimentacoes')
  @RequirePermission('evento:read')
  async movimentacoes(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    const ciclo = await this.contexto.resolver(
      slug,
      nome,
      acesso.alcance('evento:read'),
    );
    return {
      ciclo,
      movimentacoes: await this.eventos.movimentacoes(ciclo, acesso),
    };
  }

  @Get(':programa/:ciclo/movimentacoes/referencias')
  @RequirePermission('evento:create')
  async referenciasDeMovimentacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    const ciclo = await this.contexto.resolver(
      slug,
      nome,
      acesso.alcance('evento:create'),
    );
    return this.eventos.referenciasDeMovimentacao(ciclo, acesso);
  }

  @Post(':programa/:ciclo/movimentacoes')
  @RequirePermission('evento:create')
  async registrarMovimentacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Body(new ZodValidationPipe(registrarMovimentacaoSchema))
    dto: RegistrarMovimentacao,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    const ciclo = await this.contexto.resolver(
      slug,
      nome,
      acesso.alcance('evento:create'),
    );
    return this.eventos.registrarMovimentacao(ciclo, dto, usuario, acesso);
  }
}
