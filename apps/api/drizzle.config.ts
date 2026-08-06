import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

/**
 * Configuração do drizzle-kit (geração e aplicação de migrations).
 *
 * Roda fora do Nest, então lê `DATABASE_URL` direto do ambiente em vez de passar
 * pelo ConfigService.
 */
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'DATABASE_URL nao definida. Copie apps/api/.env.example para apps/api/.env.',
  );
}

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './src/database/migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
  casing: 'snake_case',
  verbose: true,
  strict: true,
});
