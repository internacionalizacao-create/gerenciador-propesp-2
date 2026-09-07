import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { AcessoController } from './acesso.controller';
import { EscopoMissaoGuard } from './escopo-missao.guard';
import { IdentidadeService } from './identidade.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PermissionsGuard } from './permissions.guard';
import { TokenVerifierService } from './token-verifier.service';

/**
 * Registra os tres guards como globais. A ordem importa: o `JwtAuthGuard`
 * precisa preencher `request.user` antes de o `PermissionsGuard` le-lo, e o
 * `EscopoMissaoGuard` roda por ultimo — nao faz sentido gastar consulta ao
 * banco decidindo *quais linhas* para quem nem tem a permissao da acao.
 */
@Global()
@Module({
  controllers: [AcessoController],
  providers: [
    TokenVerifierService,
    IdentidadeService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: EscopoMissaoGuard },
  ],
  exports: [TokenVerifierService, IdentidadeService],
})
export class AuthModule {}
