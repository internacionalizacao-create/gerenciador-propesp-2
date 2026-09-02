import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  ComiteGestorService,
  pessoaRapidaSchema,
  type PessoaRapida,
} from './comite-gestor.service';

/** Cadastro institucional reutilizado pelas equipes e pelas futuras missoes. */
@Controller('pessoas')
export class PessoasController {
  constructor(private readonly comite: ComiteGestorService) {}

  @Get()
  @RequirePermission('equipe-gestao:read')
  listar(@Query('busca') busca?: string) {
    return this.comite.listarPessoas(busca);
  }

  @Post()
  @RequirePermission('equipe-gestao:write')
  criar(
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(pessoaRapidaSchema)) dto: PessoaRapida,
  ) {
    return this.comite.criarPessoa(dto, usuario);
  }
}
