import 'dotenv/config';

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as schema from '../schema';
import { semearAdministrador } from './admin';
import { limparDominio } from './limpar';
import { bancoTemDados, executarSeed } from './seed';

/**
 * CLI da seed.
 *
 * Uso (a partir de apps/api):
 *   pnpm db:seed                          # base estrutural; recusa se ja houver dados
 *   pnpm db:seed --reset                  # APAGA todo o dominio e semeia de novo
 *   pnpm db:seed --reset --admin-sub <id> # e ja deixa o administrador pronto
 *   pnpm db:seed --reset --com-dados      # inclui plano, equipes e pendencias
 *
 * **A CLI sobe a base estrutural, nao a planilha inteira** (decisao de
 * 2026-09-18): programa, ciclo, redes, tematicas, participacoes, PPGs,
 * modalidades, catalogo, teto anual e aporte do Comite. O que a interface
 * cadastra — plano de aplicacao, equipes e pendencias — fica de fora, e uma
 * instalacao nova comeca do zero.
 *
 * `--com-dados` traz a planilha de volta, e e o que o **teste de aceite da
 * migracao** exige: sem plano nao ha custo, saldo nem utilizacao para conferir
 * contra `system-structl.md` §8.3.
 */
function valorDe(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  const valor = process.argv[i + 1];
  // Sem isto, `--admin-sub --reset` leria "--reset" como identificador e
  // criaria uma conta que nunca casa com ninguem.
  if (!valor || valor.startsWith('--')) {
    throw new Error(`${flag} exige um valor.`);
  }
  return valor;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definida.');

  const reset = process.argv.includes('--reset');
  const operacional = process.argv.includes('--com-dados');
  const adminSub = valorDe('--admin-sub') ?? process.env.SEED_ADMIN_SUB;

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

    const resultado = await executarSeed(db, { operacional });

    console.log(
      `\nSeed concluida (${operacional ? 'base + dados da planilha' : 'base estrutural'}):\n`,
    );
    for (const [entidade, total] of Object.entries(resultado)) {
      console.log(`  ${entidade.padEnd(24)} ${String(total).padStart(4)}`);
    }

    if (adminSub) {
      const admin = await semearAdministrador(db, adminSub);
      console.log(
        `\nAdministrador semeado: sub ${adminSub}` +
          `\n  ${admin.permissoes} acoes concedidas em GLOBAL.`,
      );
    } else {
      // Avisa em vez de escolher um padrao: `sub` adivinhado e conta previsivel.
      console.log(
        '\nNenhum administrador foi criado — informe --admin-sub <id do usuario no Keycloak>' +
          '\n(ou SEED_ADMIN_SUB) para ja deixar a conta pronta. Sem isso, use:' +
          '\n  pnpm --filter api acesso:bootstrap --sub <id> --motivo "..." --aplicar',
      );
    }

    if (operacional) {
      console.log(
        '\nConfira os indicadores com: pnpm test:int (teste de aceite da migracao)\n',
      );
    } else {
      console.log(
        '\nBase estrutural no ar. O plano de aplicacao se cadastra pela interface;' +
          '\nuse --com-dados para carregar a planilha e rodar o teste de aceite.\n',
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((erro: unknown) => {
  console.error(`\nFalha na seed: ${(erro as Error).message}\n`);
  process.exit(1);
});
