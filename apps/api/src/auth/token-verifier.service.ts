import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';

import type { Env } from '../config/env';
import {
  accessTokenClaimsSchema,
  toAuthUser,
  type AuthUser,
} from './auth-user';

/**
 * Valida access tokens do Keycloak localmente, contra o JWKS do realm.
 *
 * Validacao local (e nao introspection) e o que mantem a API sem uma chamada de
 * rede por requisicao. O preco e que a revogacao so tem efeito quando o token
 * expira — por isso o realm emite access tokens de 5 minutos.
 */
@Injectable()
export class TokenVerifierService {
  private readonly logger = new Logger(TokenVerifierService.name);
  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: JWTVerifyGetKey;

  constructor(config: ConfigService<Env, true>) {
    this.issuer = config.get('KEYCLOAK_ISSUER_URL', { infer: true });
    this.audience = config.get('KEYCLOAK_AUDIENCE', { infer: true });

    // O jose cacheia as chaves e so vai buscar de novo quando aparece um `kid`
    // desconhecido, respeitando o cooldown. Isso faz a rotacao de chaves do
    // Keycloak funcionar sozinha, sem reiniciar a API.
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/protocol/openid-connect/certs`),
      { cacheMaxAge: 10 * 60 * 1000, cooldownDuration: 30 * 1000 },
    );
  }

  async verify(token: string): Promise<AuthUser> {
    let payload: unknown;

    try {
      ({ payload } = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
        // Fixar o algoritmo fecha a porta para tokens `alg: none` ou assinados
        // com HMAC usando a chave publica como segredo.
        algorithms: ['RS256'],
        clockTolerance: 5,
      }));
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      this.logger.debug(`Token rejeitado: ${motivo}`);
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    const claims = accessTokenClaimsSchema.safeParse(payload);
    if (!claims.success) {
      this.logger.warn('Token assinado, porem sem as claims esperadas');
      throw new UnauthorizedException('Token inválido ou expirado');
    }

    // Um ID token tambem e assinado pelo mesmo realm e passa no jwtVerify; ele
    // so nao e credencial de acesso. Sem esta checagem, o `id_token` do BFF
    // valeria como Bearer aqui.
    if (claims.data.typ !== undefined && claims.data.typ !== 'Bearer') {
      throw new UnauthorizedException(
        'Este endpoint aceita apenas access tokens',
      );
    }

    return toAuthUser(claims.data);
  }
}
