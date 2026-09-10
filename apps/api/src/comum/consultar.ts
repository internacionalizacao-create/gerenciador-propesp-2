import type { SQL } from 'drizzle-orm';

import type { Database } from '../database/database.module';

/**
 * Executa SQL cru e devolve as linhas ja tipadas.
 *
 * `db.execute<T>` do Drizzle exige `T extends Record<string, unknown>`, o que
 * obrigaria toda interface de resultado a carregar um index signature — e com
 * ele qualquer nome de campo errado passaria despercebido. O envelope fica aqui,
 * numa conversao unica e comentada, para que as interfaces de dominio continuem
 * fechadas.
 *
 * A responsabilidade de casar os aliases da consulta com o tipo e de quem
 * escreve a query; os testes de integracao existem justamente para conferir isso
 * contra um banco de verdade.
 */
export async function consultar<T>(db: Database, query: SQL): Promise<T[]> {
  const { rows } = await db.execute<Record<string, unknown>>(query);
  return rows as T[];
}

/** Mesma coisa para consulta que sempre devolve exatamente uma linha. */
export async function consultarUma<T>(db: Database, query: SQL): Promise<T> {
  const [linha] = await consultar<T>(db, query);
  if (!linha) {
    throw new Error('A consulta não devolveu nenhuma linha.');
  }
  return linha;
}
