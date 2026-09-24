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
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
import {
  AcessoAtual,
  CurrentUser,
  RequirePermission,
} from '../auth/auth.decorators';
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
  listar(@AcessoAtual() acesso: AcessoResolvido) {
    return this.ppgs.listar(
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
  }

  @Get(':id')
  @RequirePermission('ppg:read')
  detalhar(@Param('id') id: string, @AcessoAtual() acesso: AcessoResolvido) {
    return this.ppgs.detalhar(
      id,
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
  }

  @Post()
  @RequirePermission('ppg:create')
  criar(
    @Body(new ZodValidationPipe(ppgSchema)) dto: PpgDto,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.ppgs.criar(dto, acesso.alcance('plano:read'));
  }

  @Patch(':id')
  @RequirePermission('ppg:edit')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ppgParcialSchema)) dto: PpgParcialDto,
    @AcessoAtual() acesso: AcessoResolvido,
  ) {
    return this.ppgs.atualizar(id, dto, acesso.alcance('plano:read'));
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
  @RequirePermission('catalogo:create')
  criarItem(
    @Body(new ZodValidationPipe(criarItemCatalogoSchema))
    dto: CriarItemCatalogo,
    @CurrentUser() usuario: AuthUser,
    @Query('programa') programa = 'capes-global',
  ) {
    return this.catalogo.criarItem(programa, dto, usuario);
  }

  @Patch('bolsas/:id')
  @RequirePermission('catalogo:edit')
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
  @RequirePermission('catalogo:delete')
  removerItem(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.removerItem(id, usuario);
  }

  @Post('modalidades')
  @RequirePermission('catalogo:create')
  criarModalidade(
    @Body(new ZodValidationPipe(criarModalidadeSchema)) dto: CriarModalidade,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.criarModalidade(dto, usuario);
  }

  @Patch('modalidades/:id')
  @RequirePermission('catalogo:edit')
  atualizarModalidade(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(atualizarModalidadeSchema))
    dto: AtualizarModalidade,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.catalogo.atualizarModalidade(id, dto, usuario);
  }
}
