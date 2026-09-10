import {
  createParamDecorator,
  SetMetadata,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AuthUser } from './auth-user';
import type { Permission } from './permissions';

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
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
 * @RequirePermission('defesa:approve')
 * @Post(':id/aprovar')
 * aprovar() {}
 * ```
 */
export const RequirePermission = (...permissions: Permission[]) =>
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
