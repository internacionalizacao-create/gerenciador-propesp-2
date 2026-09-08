import { Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { z } from 'zod';
import { NotificacoesService } from './notificacoes.service';

/**
 * Caixa de entrada do usuario (D-11).
 *
 * **Sem `:programa/:ciclo` no caminho, e sem `@RequirePermission`.** A
 * notificacao e da pessoa, nao de um ciclo: ela pode ter sido avisada de uma
 * missao de um ciclo que ja fechou, e o aviso continua sendo dela. E a
 * autorizacao e a identidade — cada um le a propria caixa, o que nao e uma
 * permissao a conceder.
 */
@Controller('notificacoes')
export class NotificacoesController {
  constructor(private readonly notificacoes: NotificacoesService) {}

  @Get()
  caixaDeEntrada(@CurrentUser() usuario: AuthUser) {
    return this.notificacoes.caixaDeEntrada(usuario);
  }

  @Post(':id/leitura')
  async marcarLida(
    @Param('id', new ZodValidationPipe(z.uuid())) id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    await this.notificacoes.marcarLida(id, usuario);
    return { lida: true };
  }
}
