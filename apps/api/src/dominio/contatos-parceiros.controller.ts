import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  atualizarContatoParceiroSchema,
  ContatosParceirosService,
  criarContatoParceiroSchema,
  justificarContatoSchema,
  listarContatosParceirosSchema,
  type AtualizarContatoParceiro,
  type CriarContatoParceiro,
  type JustificarContato,
  type ListarContatosParceiros,
} from './contatos-parceiros.service';

/** Dados pessoais de contatos, restritos ao admin na matriz provisoria. */
@Controller('contatos-parceiros')
export class ContatosParceirosController {
  constructor(private readonly contatos: ContatosParceirosService) {}

  @Get()
  @RequirePermission('parceiro:read')
  listar(
    @Query(new ZodValidationPipe(listarContatosParceirosSchema))
    filtros: ListarContatosParceiros,
  ) {
    return this.contatos.listar(filtros);
  }

  @Get(':id')
  @RequirePermission('parceiro:read')
  detalhar(@Param('id') id: string) {
    return this.contatos.detalhar(id);
  }

  @Post()
  @RequirePermission('parceiro:create')
  criar(
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarContatoParceiroSchema))
    dto: CriarContatoParceiro,
  ) {
    return this.contatos.criar(dto, usuario);
  }

  @Patch(':id')
  @RequirePermission('parceiro:edit')
  atualizar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarContatoParceiroSchema))
    dto: AtualizarContatoParceiro,
  ) {
    return this.contatos.atualizar(id, dto, usuario);
  }

  @Post(':id/principal')
  @RequirePermission('parceiro:edit')
  definirPrincipal(@Param('id') id: string, @CurrentUser() usuario: AuthUser) {
    return this.contatos.definirPrincipal(id, usuario);
  }

  @Post(':id/inativacao')
  @RequirePermission('parceiro:status')
  inativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(justificarContatoSchema))
    dto: JustificarContato,
  ) {
    return this.contatos.inativar(id, dto, usuario);
  }

  @Post(':id/reativacao')
  @RequirePermission('parceiro:status')
  reativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(justificarContatoSchema))
    dto: JustificarContato,
  ) {
    return this.contatos.reativar(id, dto, usuario);
  }
}
