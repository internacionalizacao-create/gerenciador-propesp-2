import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { Pool } from 'pg';
import { conferirBancoTeste, validarUrlTeste } from './ambiente-teste.ts';

// Falha antes de carregar as suites: indisponibilidade nao vira centenas de erros.
export default async function prepararIntegracao() {
  const connectionString = validarUrlTeste(process.env.TEST_DATABASE_URL);
  for (const [comando, args] of [
    ['pdftotext', ['-v']],
    ['unzip', ['-v']],
    ['soffice', ['--version']],
  ]) {
    try {
      execFileSync(comando, [...args], { stdio: 'pipe', timeout: 15_000 });
    } catch {
      throw new Error(
        `Utilitário de integração indisponível: ${comando}. Instale poppler-utils, unzip e libreoffice-calc.`,
      );
    }
  }
  const pool = new Pool({ connectionString, connectionTimeoutMillis: 5_000 });
  try {
    await conferirBancoTeste(pool);
  } finally {
    await pool.end();
  }
}
