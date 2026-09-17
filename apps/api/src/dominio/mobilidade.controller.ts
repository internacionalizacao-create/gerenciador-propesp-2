import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import type { AuthUser } from '../auth/auth-user';
import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import { responderArquivo } from '../comum/resposta-arquivo';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  ExportacaoService,
  FORMATOS,
  type Formato,
} from '../exportacao/exportacao.service';
import {
  filtroMobilidadeSchema,
  MobilidadeService,
  type FiltroMobilidade,
} from './mobilidade.service';

/** P02 · panorama consolidado de mobilidade (BOL-040). */
@Controller('mobilidade')
export class MobilidadeController {
  constructor(
    private readonly mobilidade: MobilidadeService,
    private readonly exportacao: ExportacaoService,
  ) {}

  /**
   * `bolsa:read`, a mesma da lista de bolsistas: o panorama e a mesma
   * informacao agregada, e o recorte por PPG e o mesmo (BOL-020). Uma
   * permissao propria permitiria as duas divergirem.
   */
  @Get('panorama')
  @RequirePermission('bolsa:read')
  panorama(
    @CurrentUser() usuario: AuthUser,
    @Query(new ZodValidationPipe(filtroMobilidadeSchema))
    filtro: FiltroMobilidade,
  ) {
    return this.mobilidade.panorama(usuario, filtro);
  }

  /**
   * Producao consolidada dos dois dominios (BOL-051).
   *
   * `bolsa:read` **e** `produto:read`: a lista mistura o que foi cobrado do
   * bolsista com o que a missao rendeu, e quem so tem uma das duas leituras
   * veria metade sem saber que e metade. O produto de missao so entra para
   * quem tem `missao:read`, verificado no servico.
   */
  @Get('producao')
  @RequirePermission('bolsa:read', 'produto:read')
  producao(@CurrentUser() usuario: AuthUser) {
    return this.mobilidade.producao(usuario);
  }

  /**
   * Relatorio de mobilidade nos tres formatos (BOL-044).
   *
   * Exige **ler e exportar**, as duas sobre o mesmo recorte (contrato V1). Os
   * numeros sao os do panorama; o que a permissao separada governa e o arquivo
   * saindo do sistema, nao o calculo.
   */
  @Get('relatorio/exportacao/:formato')
  @RequirePermission('bolsa:read', 'bolsa:export')
  async exportar(
    @CurrentUser() usuario: AuthUser,
    @Param('formato') formato: string,
    @Query(new ZodValidationPipe(filtroMobilidadeSchema))
    filtro: FiltroMobilidade,
    @Res() resposta: Response,
  ) {
    if (!FORMATOS.includes(formato as Formato)) {
      throw new NotFoundException('Formato não suportado.');
    }
    responderArquivo(
      resposta,
      await this.exportacao.relatorioDeMobilidade(
        usuario,
        filtro,
        formato as Formato,
      ),
    );
  }
}
