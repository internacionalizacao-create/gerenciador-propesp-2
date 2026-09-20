import 'dotenv/config';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

import { conferirBancoTeste, validarUrlTeste } from './ambiente-teste';

import * as schema from '../src/database/schema';

/**
 * Banco real para os testes de integração.
 *
 * Rodar contra Postgres de verdade, e não contra mock, é o que faz sentido aqui:
 * metade das garantias do schema são do banco — CHECK, unicidade, cascata,
 * aritmética exata de `numeric`. Um mock aprovaria justamente o que precisa ser
 * verificado.
 */
export type TestDatabase = NodePgDatabase<typeof schema>;

export interface ContextoTeste {
  db: TestDatabase;
  pool: Pool;
  encerrar: () => Promise<void>;
  limpar: () => Promise<void>;
}

export async function criarContextoTeste(): Promise<ContextoTeste> {
  const pool = new Pool({
    connectionString: validarUrlTeste(process.env.TEST_DATABASE_URL),
    max: 4,
    connectionTimeoutMillis: 5_000,
  });
  const db = drizzle(pool, { schema });
  try {
    await conferirBancoTeste(pool);
    // O migrator consulta seu journal; o Jest isola modulos entre suites.
    await migrate(db, { migrationsFolder: './src/database/migrations' });
  } catch (erro) {
    await pool.end();
    throw erro;
  }
  return {
    db,
    pool,
    encerrar: () => pool.end(),
    limpar: async () => {
      await conferirBancoTeste(pool);
      await limparTabelas(db);
    },
  };
}

/**
 * Afirma que a operação foi recusada por uma regra específica do banco.
 *
 * O Drizzle embrulha o erro do driver e a mensagem de topo vira só
 * "Failed query: …". Casar regex nela aprovaria o teste por qualquer falha —
 * inclusive por erro de digitação no próprio teste. O identificador real vem no
 * erro do Postgres: `constraint` para CHECK/UNIQUE/FK, e `column` para NOT NULL,
 * que não tem constraint nomeada.
 */
export async function esperarViolacao(
  operacao: Promise<unknown>,
  regra: string,
): Promise<void> {
  try {
    await operacao;
  } catch (erro) {
    const causa: unknown = (erro as { cause?: unknown }).cause ?? erro;
    const { constraint, column } = causa as {
      constraint?: string;
      column?: string;
    };
    const disparada = constraint ?? column;

    if (disparada === undefined) {
      throw new Error(
        `Esperava violacao de "${regra}", mas o erro nao veio do Postgres: ` +
          `${(causa as Error).message}`,
      );
    }
    if (disparada !== regra) {
      throw new Error(
        `Esperava violacao de "${regra}", mas quem disparou foi "${disparada}".`,
      );
    }
    return;
  }

  throw new Error(
    `Esperava violacao de "${regra}", mas a operacao foi aceita.`,
  );
}

/**
 * Esvazia todas as tabelas de domínio numa tacada.
 *
 * `TRUNCATE ... CASCADE` em vez de DELETE por tabela: não depende de acertar a
 * ordem topológica das FKs, que muda toda vez que o schema evolui.
 */
async function limparTabelas(db: TestDatabase): Promise<void> {
  const { rows } = await db.execute<{ nome: string }>(sql`
    select tablename as nome
      from pg_tables
     where schemaname = 'public'
       and tablename <> '__drizzle_migrations'
  `);

  if (rows.length === 0) return;

  const alvos = rows.map((r) => `"${r.nome}"`).join(', ');
  await db.execute(sql.raw(`truncate table ${alvos} restart identity cascade`));
}
