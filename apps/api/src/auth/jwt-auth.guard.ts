import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, type AuthenticatedRequest } from './auth.decorators';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Guard global de autenticacao: exige um `Authorization: Bearer <token>` valido
 * em toda rota que nao esteja marcada com `@Public()`.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: TokenVerifierService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Credencial de acesso ausente');
    }

    request.user = await this.tokenVerifier.verify(token);
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');
  // O RFC 6750 define o scheme como case-insensitive.
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;

  return token;
}
