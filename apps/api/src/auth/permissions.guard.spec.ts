// Em modo ESM o Jest nao injeta o objeto `jest` como global — ele e importado.
import { jest } from '@jest/globals';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthUser } from './auth-user';
import { PermissionsGuard } from './permissions.guard';
import type { Permission } from './permissions';

function contextoCom(user: AuthUser | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

function guardExigindo(...permissions: Permission[]): {
  guard: PermissionsGuard;
} {
  const reflector = new Reflector();
  jest
    .spyOn(reflector, 'getAllAndOverride')
    .mockReturnValue(permissions.length ? permissions : undefined);

  return { guard: new PermissionsGuard(reflector) };
}

const coordenador: AuthUser = {
  id: 'u-1',
  roles: ['coordenador'],
  permissions: ['plano:read', 'plano:create'],
};

describe('PermissionsGuard', () => {
  it('libera rota sem @RequirePermission', () => {
    const { guard } = guardExigindo();

    expect(guard.canActivate(contextoCom(coordenador))).toBe(true);
  });

  it('libera quando o usuario tem a permissao exigida', () => {
    const { guard } = guardExigindo('plano:create');

    expect(guard.canActivate(contextoCom(coordenador))).toBe(true);
  });

  it('exige TODAS as permissoes listadas, nao apenas uma', () => {
    const { guard } = guardExigindo('plano:create', 'orcamento:edit');

    expect(() => guard.canActivate(contextoCom(coordenador))).toThrow(
      ForbiddenException,
    );
  });

  it('nomeia na mensagem apenas o que faltou', () => {
    const { guard } = guardExigindo('plano:create', 'orcamento:edit');

    expect(() => guard.canActivate(contextoCom(coordenador))).toThrow(
      /orcamento:edit/,
    );
    expect(() => guard.canActivate(contextoCom(coordenador))).not.toThrow(
      /plano:create/,
    );
  });

  it('nega quando nao ha usuario na requisicao', () => {
    const { guard } = guardExigindo('plano:read');

    expect(() => guard.canActivate(contextoCom(undefined))).toThrow(
      UnauthorizedException,
    );
  });
});
