import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { responderArquivo } from '../comum/resposta-arquivo';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { ExportacaoService } from '../exportacao/exportacao.service';
import {
  atualizarParceiroSchema,
  candidatosParceiroSchema,
  conciliarParceiroSchema,
  criarParceiroSchema,
  inativarParceiroSchema,
  listarParceirosSchema,
  ParceirosService,
  type AtualizarParceiro,
  type CandidatosParceiro,
  type ConciliarParceiro,
  type CriarParceiro,
  type InativarParceiro,
  type ListarParceiros,
} from './parceiros.service';

/** Parceiros institucionais reutilizaveis por redes e missoes. */
@Controller('parceiros')
export class ParceirosController {
  constructor(
    private readonly parceiros: ParceirosService,
    private readonly exportacao: ExportacaoService,
  ) {}

  @Get()
  @RequirePermission('parceiro:read')
  listar(
    @Query(new ZodValidationPipe(listarParceirosSchema))
    filtros: ListarParceiros,
  ) {
    return this.parceiros.listar(filtros);
  }

  @Get('candidatos')
  @RequirePermission('parceiro:read')
  candidatos(
    @Query(new ZodValidationPipe(candidatosParceiroSchema))
    filtros: CandidatosParceiro,
  ) {
    return this.parceiros.buscarCandidatos(filtros);
  }

  /**
   * Ficha de relacionamento institucional em PDF (BOL-034).
   *
   * `parceiro:read`, a mesma do historico: exportar e ler noutro formato. Uma
   * permissao propria de exportacao permitiria as duas divergirem, e a
   * divergencia so apareceria como vazamento (CG-069).
   */
  @Get(':id/ficha')
  @RequirePermission('parceiro:read')
  async ficha(@Param('id') id: string, @Res() resposta: Response) {
    responderArquivo(resposta, await this.exportacao.fichaDoParceiro(id));
  }

  @Get(':id')
  @RequirePermission('parceiro:read')
  detalhar(@Param('id') id: string) {
    return this.parceiros.detalhar(id);
  }

  /** Linha historica consolidada do parceiro (CG-027). */
  @Get(':id/historico')
  @RequirePermission('parceiro:read')
  historico(@Param('id') id: string) {
    return this.parceiros.historico(id);
  }

  @Post()
  @RequirePermission('parceiro:write')
  criar(
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarParceiroSchema)) dto: CriarParceiro,
  ) {
    return this.parceiros.criar(dto, usuario);
  }

  @Patch(':id')
  @RequirePermission('parceiro:write')
  atualizar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarParceiroSchema))
    dto: AtualizarParceiro,
  ) {
    return this.parceiros.atualizar(id, dto, usuario);
  }

  @Post(':id/inativacao')
  @RequirePermission('parceiro:write')
  inativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(inativarParceiroSchema))
    dto: InativarParceiro,
  ) {
    return this.parceiros.inativar(id, dto, usuario);
  }

  @Post(':id/conciliacao')
  @RequirePermission('parceiro:write')
  conciliar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(conciliarParceiroSchema))
    dto: ConciliarParceiro,
  ) {
    return this.parceiros.conciliar(id, dto, usuario);
  }
}
