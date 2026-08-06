import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import type * as schema from '../schema';

/**
 * Esvazia todas as tabelas de domínio.
 *
 * `TRUNCATE ... CASCADE` em vez de DELETE por tabela: não depende de acertar a
 * ordem topológica das FKs, que muda a cada evolução do schema. A tabela de
 * controle de migrations fica de fora — apagá-la faria o drizzle-kit tentar
 * reaplicar tudo.
 */
export async function limparDominio(
  db: NodePgDatabase<typeof schema>,
): Promise<void> {
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
