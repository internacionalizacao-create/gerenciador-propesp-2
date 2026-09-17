import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
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
  @RequirePermission('bolsa:read', 'produto:read')
  listar(@CurrentUser() usuario: AuthUser) {
    return this.bolsistas.listar(usuario);
  }

  @Get('opcoes-planejamento')
  @RequirePermission('bolsa:read')
  opcoesPlanejamento(@CurrentUser() usuario: AuthUser) {
    return this.bolsistas.opcoesPlanejamento(usuario);
  }

  /** Paises e instituicoes do formulario de concessao (BOL-010). */
  @Get('referencias')
  @RequirePermission('bolsa:read')
  referencias() {
    return this.bolsistas.referencias();
  }

  /**
   * Busca remota do seletor de instituicao.
   *
   * Vem antes de `:id` de proposito: o Nest casa rota na ordem de declaracao, e
   * declarada depois esta seria engolida por `/bolsistas/:id`.
   */
  @Get('instituicoes')
  @RequirePermission('bolsa:read')
  instituicoes(@Query('busca') busca?: string) {
    return this.bolsistas.instituicoes(busca);
  }

  @Get(':id')
  @RequirePermission('bolsa:read', 'produto:read')
  detalhar(@Param('id') id: string, @CurrentUser() usuario: AuthUser) {
    return this.bolsistas.detalhar(id, usuario);
  }

  @Post()
  @RequirePermission('bolsa:create')
  criar(
    @Body(new ZodValidationPipe(criarBolsaConcedidaSchema))
    dto: CriarBolsaConcedida,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.bolsistas.criar(dto, usuario);
  }

  @Patch(':id')
  @RequirePermission('bolsa:edit')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarBolsaConcedidaSchema))
    dto: AtualizarBolsaConcedida,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.bolsistas.atualizar(id, dto, usuario);
  }

  @Post(':id/produtos')
  @RequirePermission('produto:create')
  criarProduto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.bolsistas.criarProduto(id, dto, usuario);
  }

  @Patch(':id/produtos/:produtoId')
  @RequirePermission('produto:edit')
  atualizarProduto(
    @Param('id') id: string,
    @Param('produtoId') produtoId: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.bolsistas.atualizarProduto(id, produtoId, dto, usuario);
  }
}
