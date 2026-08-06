// Em modo ESM o Jest nao injeta o objeto `jest` como global — ele e importado.
import { jest } from '@jest/globals';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { exportJWK, generateKeyPair, SignJWT, type JWK } from 'jose';

import type { Env } from '../config/env';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Estes testes cobrem as recusas que, se falharem em silencio, viram acesso
 * indevido: token de outra audiencia, de outro issuer, vencido, assinado com
 * outra chave, ou um ID token usado como credencial.
 *
 * Um JWKS falso e servido por um `fetch` mockado, entao nada aqui depende de um
 * Keycloak no ar.
 */
const ISSUER = 'https://keycloak.test/realms/gerenciador';
const AUDIENCE = 'gerenciador-api';

describe('TokenVerifierService', () => {
  let privateKey: CryptoKey;
  let outraPrivateKey: CryptoKey;
  let service: TokenVerifierService;

  beforeAll(async () => {
    const par = await generateKeyPair('RS256', { extractable: true });
    const intruso = await generateKeyPair('RS256', { extractable: true });

    privateKey = par.privateKey;
    outraPrivateKey = intruso.privateKey;

    const jwk: JWK = {
      ...(await exportJWK(par.publicKey)),
      alg: 'RS256',
      kid: 'k1',
    };

    // Um `Response` novo a cada chamada: o corpo de um Response so pode ser lido
    // uma vez, e reaproveitar a mesma instancia faria o segundo teste em diante
    // receber um JWKS vazio — os testes de recusa passariam pelo motivo errado.
    jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify({ keys: [jwk] }), {
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
  });

  afterAll(() => jest.restoreAllMocks());

  beforeEach(() => {
    const config = {
      get: (chave: keyof Env) =>
        chave === 'KEYCLOAK_ISSUER_URL' ? ISSUER : AUDIENCE,
    } as unknown as ConfigService<Env, true>;

    service = new TokenVerifierService(config);
  });

  async function emitir(
    claims: Record<string, unknown>,
    opcoes: { chave?: CryptoKey; expiraEm?: string } = {},
  ) {
    return new SignJWT({ typ: 'Bearer', ...claims })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime(opcoes.expiraEm ?? '5m')
      .sign(opcoes.chave ?? privateKey);
  }

  it('aceita um access token valido e resolve papeis em permissoes', async () => {
    const token = await emitir({
      sub: 'u-1',
      preferred_username: 'coord.teste',
      email: 'coord.teste@propesp.local',
      realm_access: { roles: ['coordenador', 'offline_access'] },
    });

    const user = await service.verify(token);

    expect(user.id).toBe('u-1');
    expect(user.username).toBe('coord.teste');
    expect(user.roles).toContain('coordenador');
    expect(user.permissions).toContain('plano:write');
    // Papel interno do Keycloak nao concede nada, e coordenador nao define
    // orcamento — isso e ato da PROPESP (system-structl.md §3.5).
    expect(user.permissions).not.toContain('orcamento:write');
  });

  it('aceita token sem realm_access, sem permissao nenhuma', async () => {
    const user = await service.verify(await emitir({ sub: 'u-2' }));

    expect(user.roles).toEqual([]);
    expect(user.permissions).toEqual([]);
  });

  it('recusa token assinado por outra chave', async () => {
    const token = await emitir({ sub: 'u-1' }, { chave: outraPrivateKey });

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token emitido para outra audiencia', async () => {
    const token = await new SignJWT({ typ: 'Bearer', sub: 'u-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(ISSUER)
      .setAudience('outro-servico')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token de outro realm', async () => {
    const token = await new SignJWT({ typ: 'Bearer', sub: 'u-1' })
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer('https://keycloak.test/realms/outro')
      .setAudience(AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa token vencido', async () => {
    const token = await emitir({ sub: 'u-1' }, { expiraEm: '-1m' });

    await expect(service.verify(token)).rejects.toThrow(UnauthorizedException);
  });

  it('recusa ID token usado como credencial de acesso', async () => {
    // Mesma assinatura, mesmo issuer, mesma audiencia — so o `typ` denuncia.
    const token = await emitir({ sub: 'u-1', typ: 'ID' });

    await expect(service.verify(token)).rejects.toThrow(
      /apenas access tokens/i,
    );
  });

  it('recusa token sem `sub`', async () => {
    await expect(service.verify(await emitir({}))).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
