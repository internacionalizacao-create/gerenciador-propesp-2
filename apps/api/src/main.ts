import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';

import { AppModule } from './app.module';
import type { Env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config: ConfigService<Env, true> = app.get(ConfigService);

  app.use(helmet());

  // Ainda nao ha ValidationPipe global: nenhum endpoint recebe corpo hoje. Quando
  // o primeiro DTO aparecer, a validacao entra com zod (ja usado em config/env.ts
  // e auth/auth-user.ts) — e nao com class-validator, para o projeto nao carregar
  // duas bibliotecas de validacao com regras diferentes.

  // Sem CORS de proposito. O browser nunca fala com esta API: quem fala e o BFF
  // do Next (server-side), que injeta o Bearer. Habilitar CORS aqui reabriria a
  // porta que o desenho BFF fechou.

  app.enableShutdownHooks();

  const port = config.get('PORT', { infer: true });
  await app.listen(port);

  Logger.log(`API ouvindo em http://localhost:${port}`, 'Bootstrap');
}

bootstrap().catch((error) => {
  console.error('Failed to bootstrap application:', error);
  process.exit(1);
});
