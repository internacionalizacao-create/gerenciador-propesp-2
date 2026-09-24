import 'dotenv/config';

import { hostname, userInfo } from 'node:os';

import { asc, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as s from '../../database/schema';
import { administradoresRecuperaveis } from './bootstrap';
import { DesativacaoRecusada, executarDesativacao } from './desativacao';

/**
 * CLI de desativacao e reativacao de contas (V1-021, subtarefa e).
 *
 *   pnpm acesso:contas --listar
 *   pnpm acesso:contas --sub <sub> --motivo "..."             # so mostra o que faria
 *   pnpm acesso:contas --sub <a> --sub <b> --motivo "..." --aplicar
 *   pnpm acesso:contas --sub <sub> --motivo "..." --reativar --aplicar
 *
 * **Sem `--aplicar` nada e gravado**, como no bootstrap e pela mesma razao. E
 * `--reativar` e modo explicito: se a reativacao fosse o efeito de repetir o
 * comando, desligar e religar uma conta seria a mesma tecla.
 *
 * O uso previsto e retirar as contas de demonstracao depois que o
 * administrador definitivo estiver configurado — nessa ordem, e o comando
 * recusa a ordem inversa.
 */

interface Argumentos {
  subs: string[];
  motivo?: string;
  reativar: boolean;
  aplicar: boolean;
  listar: boolean;
}

function lerArgumentos(argv: readonly string[]): Argumentos {
  const subs: string[] = [];
  let motivo: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    // `--sub` repetido acumula: desativar as quatro contas de teste de uma vez
    // e um ato so, e parti-lo em quatro comandos multiplica a chance de parar
    // no meio com metade do ambiente desligada.
    if (argv[i] === '--sub' && argv[i + 1]) subs.push(argv[i + 1]);
    if (argv[i] === '--motivo' && argv[i + 1]) motivo = argv[i + 1];
  }
  return {
    subs,
    motivo,
    reativar: argv.includes('--reativar'),
    aplicar: argv.includes('--aplicar'),
    listar: argv.includes('--listar'),
  };
}

async function main(): Promise<void> {
  const args = lerArgumentos(process.argv.slice(2));
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL nao definida.');

  const pool = new Pool({ connectionString: url, max: 2 });
  const db = drizzle(pool, { schema: s });

  try {
    if (args.listar || args.subs.length === 0 || !args.motivo) {
      await listarContas(db);
      if (!args.listar) {
        throw new Error(
          'Informe --sub <sub> e --motivo "...". Os subs disponiveis estao acima.',
        );
      }
      return;
    }

    const operador = `cli:${userInfo().username}@${hostname()}`;
    const previa = await executarDesativacao(db, {
      subs: args.subs,
      motivo: args.motivo,
      reativar: args.reativar,
      aplicar: args.aplicar,
      operador,
    });

    console.log(`\nModo:     ${args.reativar ? 'REATIVACAO' : 'DESATIVACAO'}`);
    console.log(`Operador: ${operador}\n`);
    const rotulo = {
      DESATIVAR: 'desativar',
      REATIVAR: 'reativar',
      SEM_EFEITO: 'ja esta assim',
    };
    for (const item of previa.itens) {
      console.log(
        `  ${rotulo[item.efeito].padEnd(14)} ${item.identificacao} (${item.pessoaNome ?? 'vinculo pendente'})`,
      );
    }

    console.log(
      `\nAdministradores com acesso depois disto: ` +
        `${previa.administradoresRestantes.join(', ') || '(nenhum)'}`,
    );
    console.log(
      'As concessoes ficam como estao: desativar a conta ja fecha tudo, e\n' +
        'apaga-las tiraria o que uma reativacao precisa devolver intacto.',
    );

    if (previa.aplicado) {
      console.log('\nAplicado e registrado na auditoria.\n');
    } else {
      console.log(
        '\nPrevia apenas — nada foi gravado. Repita com --aplicar.\n',
      );
    }
  } finally {
    await pool.end();
  }
}

/** Contas e administradores atuais, para o operador achar o `sub` certo. */
async function listarContas(
  db: ReturnType<typeof drizzle<typeof s>>,
): Promise<void> {
  const contas = await db
    .select({
      sub: s.usuarioSistema.sub,
      identificacao: sql<string>`coalesce(${s.usuarioSistema.email}, ${s.usuarioSistema.username}, ${s.usuarioSistema.sub})`,
      nome: s.pessoa.nome,
      ativo: s.usuarioSistema.ativo,
    })
    .from(s.usuarioSistema)
    // `left join`: a conta pendente, sem pessoa, tambem pode ser desativada.
    .leftJoin(s.pessoa, sql`${s.pessoa.id} = ${s.usuarioSistema.pessoaId}`)
    .orderBy(asc(s.pessoa.nome));

  console.log('\nContas locais:\n');
  for (const conta of contas) {
    const estado = conta.ativo ? 'ativa  ' : 'inativa';
    console.log(
      `  ${estado}  ${conta.sub}  ${conta.identificacao} (${conta.nome ?? 'vinculo pendente'})`,
    );
  }

  const admins = await administradoresRecuperaveis(db);
  console.log(
    `\nAdministradores recuperaveis: ${admins.join(', ') || '(nenhum)'}\n`,
  );
}

main().catch((erro: unknown) => {
  const mensagem =
    erro instanceof DesativacaoRecusada
      ? erro.message
      : `${(erro as Error).message}`;
  console.error(`\n${mensagem}\n`);
  process.exit(1);
});
