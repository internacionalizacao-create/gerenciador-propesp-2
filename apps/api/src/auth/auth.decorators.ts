import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AcessoResolvido } from './autorizacao-v1/acesso-v1.service';
import type { AuthUser } from './auth-user';
import type { PermissaoV1 } from './autorizacao-v1/catalogo';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  /**
   * Acesso local ja resolvido pelo `JwtAuthGuard` (V1-012).
   *
   * Carrega o **alcance** de cada acao, que `user.permissions` nao tem: aquela
   * lista responde "pode criar bolsa?", esta responde "em quais PPGs".
   */
  acesso?: AcessoResolvido;
}

export const IS_PUBLIC_KEY = 'auth:isPublic';
export const REQUIRED_PERMISSIONS_KEY = 'auth:requiredPermissions';

/**
 * Dispensa a autenticacao na rota ou no controller inteiro.
 *
 * O `JwtAuthGuard` e global, entao o padrao de todo endpoint e "exige login".
 * Abrir um endpoint e um ato explicito e visivel no diff — o inverso (esquecer
 * de proteger) nao seria.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Exige que o usuario tenha TODAS as permissoes listadas.
 *
 * @example
 * ```ts
 * @RequirePermission('missao:decide')
 * @Post(':id/decisao')
 * decidir() {}
 * ```
 */
export const RequirePermission = (...permissions: PermissaoV1[]) =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

/**
 * Injeta o usuario autenticado (ou um campo dele) no handler.
 *
 * @example `@CurrentUser() user: AuthUser` / `@CurrentUser('id') id: string`
 */
export const CurrentUser = createParamDecorator(
  <K extends keyof AuthUser>(field: K | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      // So acontece se alguem usar @CurrentUser em rota marcada como @Public.
      throw new UnauthorizedException(
        'Nenhum usuário autenticado na requisição',
      );
    }

    return field ? request.user[field] : request.user;
  },
);

/**
 * Injeta o acesso ja resolvido da requisicao (V1-019).
 *
 * Diferente de `@CurrentUser('permissions')`, que responde **o que** a conta
 * pode: este responde tambem **onde**. Quem precisa do alcance pega daqui, em
 * vez de consultar `concessao_acesso` de novo — a consulta do guard ja foi
 * paga, e uma segunda poderia ate discordar da primeira.
 */
export const AcessoAtual = createParamDecorator(
  (_dado: unknown, ctx: ExecutionContext): AcessoResolvido => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.acesso) {
      // Mesma condicao de `@CurrentUser`: rota `@Public` nao passa pelo guard
      // que resolve acesso, e adivinhar um acesso vazio ali esconderia o erro.
      throw new UnauthorizedException(
        'Nenhum acesso resolvido para a requisição',
      );
    }

    return request.acesso;
  },
);
