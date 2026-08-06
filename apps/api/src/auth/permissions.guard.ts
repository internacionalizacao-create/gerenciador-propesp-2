import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  REQUIRED_PERMISSIONS_KEY,
  type AuthenticatedRequest,
} from './auth.decorators';
import type { Permission } from './permissions';

/**
 * Guard global de autorizacao: aplica o `@RequirePermission(...)` do handler.
 *
 * Roda depois do `JwtAuthGuard` (a ordem de registro em `app.module.ts` define
 * isso), entao aqui `request.user` ja existe.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Rota sem @RequirePermission exige apenas estar autenticado.
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (!user) {
      // @RequirePermission junto de @Public e sempre um bug de programacao.
      throw new UnauthorizedException('Credencial de acesso ausente');
    }

    const faltando = required.filter(
      (permission) => !user.permissions.includes(permission),
    );

    if (faltando.length > 0) {
      // A mensagem diz o que faltou, nao o que o usuario tem: ajuda o suporte
      // sem expor o desenho de permissoes de quem nao deveria ve-lo.
      throw new ForbiddenException(
        `Acesso negado. Permissao necessaria: ${faltando.join(', ')}`,
      );
    }

    return true;
  }
}
