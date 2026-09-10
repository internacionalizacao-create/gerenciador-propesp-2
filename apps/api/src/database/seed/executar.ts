import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema';
import { limparDominio } from './limpar';
import { bancoTemDados, executarSeed } from './seed';

/**
 * CLI da seed.
 *
 * Uso (a partir de apps/api):
 *   pnpm db:seed           # semeia; recusa se já houver dados
 *   pnpm db:seed --reset   # APAGA todo o domínio e semeia de novo
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida.');

  const reset = process.argv.includes('--reset');
  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema });

  try {
    if (await bancoTemDados(db)) {
      if (!reset) {
        throw new Error(
          'O banco já tem dados. Use --reset para APAGAR tudo e semear de novo.',
        );
      }
      console.log('Apagando dados de dominio...');
      await limparDominio(db);
    }

    const resultado = await executarSeed(db);

    console.log('\nSeed concluida:\n');
    for (const [entidade, total] of Object.entries(resultado)) {
      console.log(`  ${entidade.padEnd(24)} ${String(total).padStart(4)}`);
    }
    console.log(
      '\nConfira os indicadores com: pnpm test:int (teste de aceite da migracao)\n',
    );
  } finally {
    await pool.end();
  }
}

main().catch((erro: unknown) => {
  console.error(`\nFalha na seed: ${(erro as Error).message}\n`);
  process.exit(1);
});
