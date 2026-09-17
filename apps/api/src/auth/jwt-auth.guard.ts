import {
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { AcessoV1Service } from './autorizacao-v1/acesso-v1.service';
import { IS_PUBLIC_KEY, type AuthenticatedRequest } from './auth.decorators';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Guard global de autenticacao: exige um `Authorization: Bearer <token>` valido
 * em toda rota que nao esteja marcada com `@Public()`.
 *
 * **Tambem resolve o acesso local** (V1-012). O token responde quem e a pessoa;
 * as acoes que ela pode exercer saem de `concessao_acesso`, lidas aqui, uma vez
 * por requisicao. Resolver no guard de autenticacao, e nao no de permissao, e o
 * que faz `request.acesso` existir tambem nas rotas sem `@RequirePermission` —
 * `/me` e as que decidem alcance dentro do servico.
 *
 * O preco e uma consulta indexada por requisicao autenticada. O beneficio e
 * revogacao que vale na requisicao seguinte, sem esperar o token expirar.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokenVerifier: TokenVerifierService,
    private readonly acesso: AcessoV1Service,
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

    const identidade = await this.tokenVerifier.verify(token);
    const acesso = await this.acesso.resolver(identidade.id);

    request.acesso = acesso;
    request.user = { ...identidade, permissions: acesso.permissoes };
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
