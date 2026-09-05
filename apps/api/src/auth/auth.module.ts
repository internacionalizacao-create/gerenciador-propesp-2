import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AcessoController } from './acesso.controller';
import { IdentidadeService } from './identidade.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Registra os dois guards como globais. A ordem importa: o `JwtAuthGuard`
 * precisa preencher `request.user` antes do `PermissionsGuard` le-lo.
 */
@Global()
@Module({
  controllers: [AcessoController],
  providers: [
    TokenVerifierService,
    IdentidadeService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [TokenVerifierService, IdentidadeService],
})
export class AuthModule {}
