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
  atualizarConvenioSchema,
  criarConvenioSchema,
  justificarConvenioSchema,
  listarConveniosSchema,
  ResultadosService,
  type AtualizarConvenio,
  type CriarConvenio,
  type JustificarConvenio,
  type ListarConvenios,
} from './resultados.service';

/**
 * Convenios e acordos (CG-056).
 *
 * Controlador proprio, e nao uma rota sob a missao, porque o acordo **nao
 * pertence a missao**: ele se ancora na instituicao parceira, sobrevive a
 * viagem que o originou e continua vigente ciclos depois. Por isso tambem nao
 * ha `:programa/:ciclo` no caminho.
 *
 * A permissao e a de parceiro, pelo mesmo motivo: alterar um convenio e mexer
 * no cadastro institucional, nao no registro de uma viagem. Na matriz
 * provisoria isso continua exclusivo do `admin` (CG-028/CG-029).
 */
@Controller('convenios')
export class ConveniosController {
  constructor(private readonly resultados: ResultadosService) {}

  @Get()
  @RequirePermission('convenio:read')
  listar(
    @Query(new ZodValidationPipe(listarConveniosSchema))
    filtros: ListarConvenios,
  ) {
    return this.resultados.listarConvenios(filtros);
  }

  @Get(':id')
  @RequirePermission('convenio:read')
  detalhar(@Param('id') id: string) {
    return this.resultados.detalharConvenio(id);
  }

  @Post()
  @RequirePermission('convenio:create')
  criar(
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarConvenioSchema)) dto: CriarConvenio,
  ) {
    return this.resultados.criarConvenio(dto, usuario);
  }

  @Patch(':id')
  @RequirePermission('convenio:edit')
  atualizar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarConvenioSchema))
    dto: AtualizarConvenio,
  ) {
    return this.resultados.atualizarConvenio(id, dto, usuario);
  }

  /** Nao ha exclusao: o produto que aponta para o acordo perderia o vinculo. */
  @Post(':id/inativacao')
  @RequirePermission('convenio:status')
  inativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(justificarConvenioSchema))
    dto: JustificarConvenio,
  ) {
    return this.resultados.inativarConvenio(id, dto, usuario);
  }

  @Post(':id/reativacao')
  @RequirePermission('convenio:status')
  reativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(justificarConvenioSchema))
    dto: JustificarConvenio,
  ) {
    return this.resultados.reativarConvenio(id, dto, usuario);
  }
}
