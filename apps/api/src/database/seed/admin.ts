import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import { CATALOGO_PERMISSOES_V1 } from '../../auth/autorizacao-v1/catalogo';
import { colunasDoAlvo } from '../../auth/autorizacao-v1/persistencia';
import * as s from '../schema';

/**
 * Administrador semeado, por decisao do responsavel em 2026-09-18.
 *
 * **Isto contraria o desenho anterior, e a contradicao e deliberada.** Ate aqui
 * a base subia sem conta alguma e o primeiro administrador saia de
 * `acesso:bootstrap` — comando local, que exige acesso ao servidor e concede so
 * a gestao de acessos. O argumento contra semear continua valendo e esta escrito
 * em `autorizacao-v1/bootstrap.ts`: instalacao que nasce com conta previsivel de
 * acesso total nao tem como distinguir o administrador legitimo de quem apenas
 * conhece o padrao.
 *
 * O que reduz o risco aqui, e o que **nao** deve ser afrouxado depois:
 *
 * - **Nada acontece sem o `sub` informado.** Nao ha valor padrao, nem busca por
 *   e-mail, nem "primeiro usuario do realm": sem `--admin-sub` a seed avisa e
 *   segue sem criar conta. Um padrao seria exatamente a conta previsivel que o
 *   bootstrap existe para evitar.
 * - **O `sub` vem do Keycloak daquela instalacao**, e muda a cada import do
 *   realm. Nao da para versionar um, e isso e uma propriedade util: a conta
 *   semeada so existe se alguem olhou o realm e digitou o identificador.
 * - **O bootstrap continua existindo** e continua sendo o caminho de producao.
 *   Esta funcao serve a ambiente que se recria do zero com frequencia.
 */

/** Acesso total: o catalogo inteiro em GLOBAL, `acesso:delegate` incluida. */
const TODAS = Object.keys(CATALOGO_PERMISSOES_V1);

export interface AdminSemeado {
  pessoaId: string;
  usuarioId: string;
  permissoes: number;
}

export async function semearAdministrador(
  db: NodePgDatabase<typeof s>,
  sub: string,
  email = 'admin@propesp.local',
  nome = 'Administrador PROPESP',
): Promise<AdminSemeado> {
  // A pessoa pode ja existir: `executarSeed` cria as pessoas da planilha antes,
  // e uma delas pode carregar este e-mail. Reaproveitar evita a segunda pessoa
  // com o mesmo e-mail, que faria `/me` escolher entre duas identidades.
  const [existente] = await db
    .select({ id: s.pessoa.id })
    .from(s.pessoa)
    .where(eq(s.pessoa.email, email))
    .limit(1);

  const pessoaId =
    existente?.id ??
    (
      await db
        .insert(s.pessoa)
        .values({ nome, email, tipo: 'SERVIDOR' })
        .returning({ id: s.pessoa.id })
    )[0].id;

  // `origem: 'MANUAL'` porque o vinculo nao veio de um login: quem o criou foi
  // um operador com acesso ao banco, e a auditoria precisa poder dizer isso.
  const [conta] = await db
    .insert(s.usuarioSistema)
    .values({ sub, pessoaId, origem: 'MANUAL' })
    .returning({ id: s.usuarioSistema.id });

  await db.insert(s.concessaoAcesso).values(
    TODAS.map((permissao) => ({
      usuarioId: conta.id,
      permissao,
      justificativa: 'Administrador semeado na carga inicial.',
      origem: 'seed',
      concedidoPorId: 'seed',
      ...colunasDoAlvo({ tipo: 'GLOBAL' }),
    })),
  );

  return { pessoaId, usuarioId: conta.id, permissoes: TODAS.length };
}
