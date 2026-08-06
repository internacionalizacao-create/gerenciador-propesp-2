import { Controller, Get } from '@nestjs/common';

import type { AuthUser } from './auth-user';
import { CurrentUser, RequirePermission } from './auth.decorators';

@Controller('me')
export class MeController {
  /**
   * Identidade do usuario logado, ja resolvida em permissoes.
   *
   * O BFF chama este endpoint para montar o menu e esconder acoes — mas quem
   * decide de fato e sempre o guard no endpoint da acao, nao a UI.
   */
  @Get()
  me(@CurrentUser() user: AuthUser) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
    };
  }

  /**
   * Sonda de autorizacao usada pelo `pnpm smoke:login`.
   *
   * Existe para conferir na pratica, sem browser, que `coord.teste` recebe 200 e
   * `docente.teste` recebe 403 na mesma rota. Poderia ser feito contra um
   * endpoint de dominio, mas ai o smoke passaria a depender de haver seed
   * carregada — e ele precisa rodar num ambiente recem-subido.
   */
  @Get('exemplo-restrito')
  @RequirePermission('plano:write')
  exemploRestrito(@CurrentUser('username') username: string | undefined) {
    return {
      mensagem: `${username ?? 'usuario'} pode lancar plano de aplicacao.`,
    };
  }
}
