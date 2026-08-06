import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Registra os dois guards como globais. A ordem importa: o `JwtAuthGuard`
 * precisa preencher `request.user` antes do `PermissionsGuard` le-lo.
 */
@Global()
@Module({
  providers: [
    TokenVerifierService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenVerifierService],
})
export class AuthModule {}
