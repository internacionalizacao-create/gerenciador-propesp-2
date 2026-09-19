import {
  Body,
  ForbiddenException,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import {
  AcessoAtual,
  CurrentUser,
  RequirePermission,
} from '../auth/auth.decorators';
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  atualizarBolsaConcedidaSchema,
  BolsistasService,
  criarBolsaConcedidaSchema,
  produtoBolsaSchema,
  type AtualizarBolsaConcedida,
  type CriarBolsaConcedida,
  type ProdutoBolsaDto,
} from './bolsistas.service';

/** P03 · bolsas concedidas a pessoas e suas entregas individuais. */
@Controller('bolsistas')
export class BolsistasController {
  constructor(private readonly bolsistas: BolsistasService) {}

  @Get()
  @RequirePermission('bolsa:read')
  listar(
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.listar(usuario, acesso);
  }

  @Get('opcoes-planejamento')
  @RequirePermission('bolsa:create')
  opcoesPlanejamento(@AcessoAtual() acesso: AcessoResolvido) {
    return this.bolsistas.opcoesPlanejamento(acesso.alcance('bolsa:create'));
  }

  /** Paises e instituicoes do formulario de concessao (BOL-010). */
  @Get('referencias')
  referencias(
    @AcessoAtual() acesso: AcessoResolvido,
    @Query('acao') acao = 'bolsa:create',
  ) {
    if (
      (acao !== 'bolsa:create' && acao !== 'bolsa:edit') ||
      !acesso.permite(acao)
    ) {
      throw new ForbiddenException(
        'Sem permissão para consultar estas referências.',
      );
    }
    return this.bolsistas.referencias(acesso.alcance(acao));
  }

  /**
   * Busca remota do seletor de instituicao.
   *
   * Vem antes de `:id` de proposito: o Nest casa rota na ordem de declaracao, e
   * declarada depois esta seria engolida por `/bolsistas/:id`.
   */
  @Get('instituicoes')
  instituicoes(
    @AcessoAtual() acesso: AcessoResolvido,
    @Query('busca') busca?: string,
  ) {
    if (
      !acesso.permite('bolsa:read') &&
      !acesso.permite('bolsa:create') &&
      !acesso.permite('bolsa:edit')
    ) {
      throw new ForbiddenException(
        'Sem permissão para consultar instituições.',
      );
    }
    return this.bolsistas.instituicoes(busca);
  }

  @Get(':id')
  @RequirePermission('bolsa:read')
  detalhar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.detalhar(id, usuario, acesso);
  }

  @Post()
  @RequirePermission('bolsa:create')
  criar(
    @Body(new ZodValidationPipe(criarBolsaConcedidaSchema))
    dto: CriarBolsaConcedida,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.criar(dto, usuario, acesso);
  }

  @Patch(':id')
  @RequirePermission('bolsa:edit')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarBolsaConcedidaSchema))
    dto: AtualizarBolsaConcedida,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.atualizar(id, dto, usuario, acesso);
  }

  @Post(':id/produtos')
  @RequirePermission('produto:create')
  criarProduto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.criarProduto(id, dto, usuario, acesso);
  }

  @Patch(':id/produtos/:produtoId')
  @RequirePermission('produto:edit')
  atualizarProduto(
    @Param('id') id: string,
    @Param('produtoId') produtoId: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
    @CurrentUser() usuario: AuthUser,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.bolsistas.atualizarProduto(id, produtoId, dto, usuario, acesso);
  }
}
