import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  atualizarItemCatalogoSchema,
  atualizarModalidadeSchema,
  CatalogoService,
  criarItemCatalogoSchema,
  criarModalidadeSchema,
  type AtualizarItemCatalogo,
  type AtualizarModalidade,
  type CriarItemCatalogo,
  type CriarModalidade,
} from './catalogo.service';
import {
  ppgParcialSchema,
  ppgSchema,
  PpgsService,
  type PpgDto,
  type PpgParcialDto,
} from './ppgs.service';

/** P14 · PPGs. */
@Controller('ppgs')
export class PpgsController {
  constructor(private readonly ppgs: PpgsService) {}

  @Get()
  @RequirePermission('ppg:read')
  listar(@CurrentUser() usuario: AuthUser) {
    return this.ppgs.listar(usuario);
  }

  @Get(':id')
  @RequirePermission('ppg:read')
  detalhar(@Param('id') id: string, @CurrentUser() usuario: AuthUser) {
    return this.ppgs.detalhar(id, usuario);
  }

  @Post()
  @RequirePermission('ppg:write')
  criar(@Body(new ZodValidationPipe(ppgSchema)) dto: PpgDto) {
    return this.ppgs.criar(dto);
  }

  @Patch(':id')
  @RequirePermission('ppg:write')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ppgParcialSchema)) dto: PpgParcialDto,
  ) {
    return this.ppgs.atualizar(id, dto);
  }
}

/**
 * P15 · catalogo de bolsas e catalogos auxiliares.
 *
 * Leitura e aberta a todo perfil (a tabela e publica dentro da instituicao);
 * publicar versao nova exige `catalogo:write`, que so a PROPESP tem (Q10).
 */
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('bolsas')
  @RequirePermission('catalogo:read')
  bolsas(@Query('programa') programa = 'capes-global') {
    return this.catalogo.tabelaVigente(programa);
  }

  @Get('modalidades')
  @RequirePermission('catalogo:read')
  modalidades() {
    return this.catalogo.modalidades();
  }

  /**
   * Publica um item na tabela vigente.
   *
   * `catalogo:write` e so do `admin`: o valor daqui e o preco de toda bolsa do
   * sistema, e quem planeja nao deveria poder mexer no proprio preco.
   */
  @Post('bolsas')
  @RequirePermission('catalogo:write')
  criarItem(
    @Body(new ZodValidationPipe(criarItemCatalogoSchema))
    dto: CriarItemCatalogo,
    @CurrentUser() usuario: AuthUser,
    @Query('programa') programa = 'capes-global',
  ) {
    return this.catalogo.criarItem(programa, dto, usuario);
  }

  @Patch('bolsas/:id')
  @RequirePermission('catalogo:write')
  atualizarItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(atualizarItemCatalogoSchema))
    dto: AtualizarItemCatalogo,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.atualizarItem(id, dto, usuario);
  }

  @Delete('bolsas/:id')
  @HttpCode(204)
  @RequirePermission('catalogo:write')
  removerItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.removerItem(id, usuario);
  }

  @Post('modalidades')
  @RequirePermission('catalogo:write')
  criarModalidade(
    @Body(new ZodValidationPipe(criarModalidadeSchema)) dto: CriarModalidade,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.criarModalidade(dto, usuario);
  }

  @Patch('modalidades/:id')
  @RequirePermission('catalogo:write')
  atualizarModalidade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(atualizarModalidadeSchema))
    dto: AtualizarModalidade,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.atualizarModalidade(id, dto, usuario);
  }
}
