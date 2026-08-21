import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';

import { RequirePermission } from '../auth/auth.decorators';
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
  listar() {
    return this.bolsistas.listar();
  }

  @Get('opcoes-planejamento')
  @RequirePermission('bolsa:read')
  opcoesPlanejamento() {
    return this.bolsistas.opcoesPlanejamento();
  }

  @Get(':id')
  @RequirePermission('bolsa:read', 'produto:read')
  detalhar(@Param('id') id: string) {
    return this.bolsistas.detalhar(id);
  }

  @Post()
  @RequirePermission('bolsa:write')
  criar(
    @Body(new ZodValidationPipe(criarBolsaConcedidaSchema))
    dto: CriarBolsaConcedida,
  ) {
    return this.bolsistas.criar(dto);
  }

  @Patch(':id')
  @RequirePermission('bolsa:write')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarBolsaConcedidaSchema))
    dto: AtualizarBolsaConcedida,
  ) {
    return this.bolsistas.atualizar(id, dto);
  }

  @Post(':id/produtos')
  @RequirePermission('produto:write')
  criarProduto(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
  ) {
    return this.bolsistas.criarProduto(id, dto);
  }

  @Patch(':id/produtos/:produtoId')
  @RequirePermission('produto:write')
  atualizarProduto(
    @Param('id') id: string,
    @Param('produtoId') produtoId: string,
    @Body(new ZodValidationPipe(produtoBolsaSchema)) dto: ProdutoBolsaDto,
  ) {
    return this.bolsistas.atualizarProduto(id, produtoId, dto);
  }
}
