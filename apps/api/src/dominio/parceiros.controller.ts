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

import {
  AcessoAtual,
  CurrentUser,
  RequirePermission,
} from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
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
   * Exige **ler e exportar**, as duas sobre o mesmo registro (contrato V1).
   * Ate 2026-09-16 bastava `parceiro:read`, pelo argumento de que exportar e
   * ler noutro formato — verdadeiro quanto ao conteudo e falso quanto ao risco:
   * o arquivo sai do sistema e circula por fora dele, e a PROPESP quis poder
   * conceder a leitura sem conceder a saida. `parceiro:read` sozinho nao
   * exporta, e `parceiro:export` sozinho nao alcanca registro nenhum.
   */
  @Get(':id/ficha')
  @RequirePermission('parceiro:read', 'parceiro:export')
  async ficha(
    @Param('id') id: string,
    @AcessoAtual() acesso: AcessoResolvido,
    @Res() resposta: Response,
  ) {
    responderArquivo(
      resposta,
      await this.exportacao.fichaDoParceiro(id, acesso),
    );
  }

  @Get(':id')
  @RequirePermission('parceiro:read')
  detalhar(@Param('id') id: string) {
    return this.parceiros.detalhar(id);
  }

  /** Linha historica consolidada do parceiro (CG-027), recortada por acao. */
  @Get(':id/historico')
  @RequirePermission('parceiro:read')
  historico(@Param('id') id: string, @AcessoAtual() acesso: AcessoResolvido) {
    return this.parceiros.historico(id, acesso);
  }

  @Post()
  @RequirePermission('parceiro:create')
  criar(
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarParceiroSchema)) dto: CriarParceiro,
  ) {
    return this.parceiros.criar(dto, usuario);
  }

  @Patch(':id')
  @RequirePermission('parceiro:edit')
  atualizar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarParceiroSchema))
    dto: AtualizarParceiro,
  ) {
    return this.parceiros.atualizar(id, dto, usuario);
  }

  @Post(':id/inativacao')
  @RequirePermission('parceiro:status')
  inativar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(inativarParceiroSchema))
    dto: InativarParceiro,
  ) {
    return this.parceiros.inativar(id, dto, usuario);
  }

  @Post(':id/conciliacao')
  @RequirePermission('parceiro:merge')
  conciliar(
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(conciliarParceiroSchema))
    dto: ConciliarParceiro,
  ) {
    return this.parceiros.conciliar(id, dto, usuario);
  }
}
