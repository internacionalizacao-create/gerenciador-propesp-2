import 'dotenv/config';

import { hostname, userInfo } from 'node:os';

import { asc, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import * as s from '../../database/schema';
import {
  administradoresRecuperaveis,
  BootstrapRecusado,
  CAPACIDADES_DE_GESTAO,
  executarBootstrap,
  type ModoBootstrap,
} from './bootstrap';

/**
 * CLI de bootstrap e recuperacao de administrador (V1-021, subtarefa a).
 *
 *   pnpm acesso:bootstrap --sub <sub> --motivo "..."            # so mostra o que faria
 *   pnpm acesso:bootstrap --sub <sub> --motivo "..." --aplicar
 *   pnpm acesso:bootstrap --sub <sub> --motivo "..." --recuperacao --aplicar
 *
 * **Sem `--aplicar` nada e gravado.** O padrao ser a previa e proposital: este
 * e o unico caminho do sistema que concede acesso sem ninguem estar autenticado,
 * e um comando que age por omissao de flag e o tipo de coisa que se roda no
 * terminal errado.
 *
 * Nao ha rota HTTP equivalente, e nao deve haver: a barreira aqui e o acesso ao
 * servidor. Ver `bootstrap.ts` para os limites do que e concedido.
 */

interface Argumentos {
  sub?: string;
  motivo?: string;
  modo: ModoBootstrap;
  aplicar: boolean;
  listar: boolean;
}

function lerArgumentos(argv: readonly string[]): Argumentos {
  const valor = (nome: string) => {
    const i = argv.indexOf(`--${nome}`);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    sub: valor('sub'),
    motivo: valor('motivo'),
    modo: argv.includes('--recuperacao') ? 'RECUPERACAO' : 'BOOTSTRAP',
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
    if (args.listar || !args.sub || !args.motivo) {
      await listarContas(db);
      if (!args.listar) {
        throw new Error(
          'Informe --sub <sub> e --motivo "...". Os subs disponiveis estao acima.',
        );
      }
      return;
    }

    const operador = `cli:${userInfo().username}@${hostname()}`;
    const previa = await executarBootstrap(db, {
      sub: args.sub,
      motivo: args.motivo,
      modo: args.modo,
      aplicar: args.aplicar,
      operador,
    });

    console.log(`\nConta:    ${previa.identificacao} (${previa.pessoaNome})`);
    console.log(`Modo:     ${previa.modo}`);
    console.log(`Operador: ${operador}\n`);
    for (const item of previa.itens) {
      const rotulo = {
        CRIAR: 'conceder',
        REATIVAR: 'reativar',
        JA_ATIVA: 'ja ativa',
      };
      console.log(`  ${rotulo[item.efeito].padEnd(10)} ${item.permissao}`);
    }
    console.log(
      '\nNenhuma permissao de negocio e concedida: so a gestao de acessos.',
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
    .innerJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
    .orderBy(asc(s.pessoa.nome));

  console.log('\nContas locais:\n');
  for (const conta of contas) {
    const estado = conta.ativo ? '' : ' (inativa)';
    console.log(`  ${conta.sub}  ${conta.identificacao}${estado}`);
  }
  if (contas.length === 0) {
    console.log(
      '  (nenhuma — a pessoa precisa entrar uma vez para o vinculo existir)',
    );
  }

  const admins = await administradoresRecuperaveis(db);
  console.log(
    `\nAdministradores recuperaveis: ${admins.length > 0 ? admins.join(', ') : 'nenhum'}`,
  );
  console.log(`Capacidades concedidas: ${CAPACIDADES_DE_GESTAO.join(', ')}\n`);
}

main().catch((erro: unknown) => {
  const recusa = erro instanceof BootstrapRecusado;
  console.error(
    `\n${recusa ? 'Recusado' : 'Falha'}: ${(erro as Error).message}\n`,
  );
  process.exit(1);
});
