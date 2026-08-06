import 'dotenv/config';

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

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

const url = process.env.TEST_DATABASE_URL;

if (!url) {
  throw new Error(
    'TEST_DATABASE_URL nao definida. Veja apps/api/.env.example.\n' +
      'Crie o banco com: docker exec gerenciador-api-db psql -U gerenciador -d postgres -c "CREATE DATABASE gerenciador_test;"',
  );
}

// Trava de segurança: os testes apagam tudo antes de cada arquivo. Se alguém
// apontar TEST_DATABASE_URL para o banco de desenvolvimento, o dano seria
// silencioso e total.
if (!/\/[a-z0-9_]*test[a-z0-9_]*(\?|$)/i.test(url)) {
  throw new Error(
    `Recusando rodar testes contra "${url}": o nome do banco precisa conter "test".`,
  );
}

export interface ContextoTeste {
  db: TestDatabase;
  pool: Pool;
  encerrar: () => Promise<void>;
  limpar: () => Promise<void>;
}

let migrado = false;

export async function criarContextoTeste(): Promise<ContextoTeste> {
  const pool = new Pool({ connectionString: url, max: 4 });
  const db = drizzle(pool, { schema });

  // As migrations rodam uma vez por processo Jest, não uma vez por arquivo.
  if (!migrado) {
    await migrate(db, { migrationsFolder: './src/database/migrations' });
    migrado = true;
  }

  return {
    db,
    pool,
    encerrar: () => pool.end(),
    limpar: () => limparTabelas(db),
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
export async function limparTabelas(db: TestDatabase): Promise<void> {
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
