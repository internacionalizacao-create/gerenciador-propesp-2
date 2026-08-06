import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { MeController } from './auth/me.controller';
import { validateEnv } from './config/env';
import { DatabaseModule } from './database/database.module';
import { DominioModule } from './dominio/dominio.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // `.env` nao e versionado; o template esta em `.env.example`.
      envFilePath: ['.env'],
    }),
    DatabaseModule,
    AuthModule,
    DominioModule,
  ],
  controllers: [HealthController, MeController],
})
export class AppModule {}
