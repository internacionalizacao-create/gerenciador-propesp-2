import { Pool } from 'pg';

// Lista fechada: "test" em senha, query ou nome parecido nao autoriza destruicao.
export function validarUrlTeste(valor: string | undefined): string {
  if (!valor)
    throw new Error(
      'TEST_DATABASE_URL não definida. Consulte apps/api/.env.example.',
    );
  let url: URL;
  try {
    url = new URL(valor);
  } catch {
    throw new Error(
      'TEST_DATABASE_URL inválida; informe uma URL PostgreSQL de teste.',
    );
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.pathname !== '/gerenciador_test' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(
      'Destino de testes recusado: use PostgreSQL em loopback, banco gerenciador_test, sem parâmetros ou fragmento.',
    );
  }
  return valor;
}

export async function conferirBancoTeste(pool: Pool): Promise<void> {
  let banco: string;
  try {
    const resultado = await pool.query<{ banco: string }>(
      'select current_database() as banco',
    );
    banco = resultado.rows[0].banco;
  } catch {
    // A mensagem do driver pode conter credenciais; nao propagar mensagem/cause.
    throw new Error(
      'Banco de testes indisponível. Confira o Postgres, a porta e as credenciais de TEST_DATABASE_URL.',
    );
  }
  if (banco !== 'gerenciador_test') {
    throw new Error(
      'Conexão recusada: o servidor não confirmou o banco gerenciador_test.',
    );
  }
}
