import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../../database/database.module';
import * as s from '../../database/schema';
import type { PermissaoV1 } from './catalogo';
import { colunasDoAlvo } from './persistencia';

/**
 * Bootstrap e recuperacao de administrador (V1-021, subtarefa a).
 *
 * O primeiro administrador e o problema de ovo e galinha da autorizacao: quem
 * concede a primeira concessao, se conceder exige concessao? As saidas erradas
 * sao conhecidas — deixar o papel `admin` do token passar por cima (e entao a
 * autorizacao local nao vale nada), ou semear um administrador na migration (e
 * entao toda instalacao nasce com uma conta previsivel).
 *
 * A saida adotada e **fora do HTTP**: comando local, que exige acesso ao
 * servidor e ao banco. Quem consegue rodar isto ja podia alterar as linhas a
 * mao; a diferenca e que aqui o ato fica registrado, limitado e conferido.
 *
 * ## Limites que este modulo impoe
 *
 * - **So capacidades de gestao de acesso**, nunca GLOBAL de negocio. O
 *   administrador que sai daqui pode conceder acesso a outras pessoas; ele nao
 *   ganha, de brinde, o plano e as bolsas de todos os PPGs.
 * - **Nao cria identidade.** A conta precisa existir em `usuario_sistema`, o
 *   que so acontece depois de um login de verdade. Criar o vinculo aqui seria
 *   fabricar identidade a partir de um `sub` digitado.
 * - **Nao reativa conta inativa.** Desativar uma conta e decisao; contorna-la
 *   pelo comando de recuperacao transformaria a desativacao em sugestao.
 * - **Bootstrap recusa se ja houver administrador recuperavel.** Recuperacao e
 *   modo explicito, justamente para nao ser o caminho acidental.
 */

/** Conexao ou transacao: a consulta de administradores serve aos dois. */
type DbTransacional = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbLeitura = Pick<Database, 'select'> | DbTransacional;

/**
 * O que o administrador de gestao recebe — e nada alem disto.
 *
 * `acesso:delegate` entra porque sem ela o administrador recuperado nao
 * conseguiria nomear outro: o contrato exige `write` + `delegate` para mexer em
 * concessoes `acesso:*`, e um administrador que nao pode criar seu substituto
 * reproduz o mesmo beco daqui a um ano.
 */
export const CAPACIDADES_DE_GESTAO = [
  'acesso:read',
  'acesso:write',
  'acesso:delegate',
  'acesso:manage-identidade',
] as const satisfies readonly PermissaoV1[];

export type ModoBootstrap = 'BOOTSTRAP' | 'RECUPERACAO';

export interface PedidoBootstrap {
  readonly sub: string;
  readonly motivo: string;
  readonly modo: ModoBootstrap;
  /** `false` (padrao) apenas descreve o que faria. */
  readonly aplicar: boolean;
  /** Quem operou: usuario do sistema operacional, nao conta do Keycloak. */
  readonly operador: string;
}

export type EfeitoConcessao = 'CRIAR' | 'REATIVAR' | 'JA_ATIVA';

export interface PreviaBootstrap {
  readonly usuarioId: string;
  readonly identificacao: string;
  readonly pessoaNome: string;
  readonly modo: ModoBootstrap;
  readonly aplicado: boolean;
  readonly itens: readonly {
    permissao: PermissaoV1;
    efeito: EfeitoConcessao;
  }[];
  /** Administradores recuperaveis encontrados antes desta execucao. */
  readonly administradoresExistentes: readonly string[];
}

export class BootstrapRecusado extends Error {}

/**
 * Administradores recuperaveis: conta **ativa** com as tres capacidades que
 * permitem retomar a administracao (`read`, `write`, `delegate`).
 *
 * As tres juntas, e nao qualquer uma: quem so le nao destrava nada, e quem
 * escreve sem delegar nao consegue criar outro administrador — seria "existe
 * administrador" no papel e ninguem capaz de recuperar o sistema na pratica.
 */
export async function administradoresRecuperaveis(
  db: DbLeitura,
): Promise<string[]> {
  const necessarias = ['acesso:read', 'acesso:write', 'acesso:delegate'];

  const linhas = await db
    .select({
      identificacao: sql<string>`coalesce(${s.usuarioSistema.email}, ${s.usuarioSistema.username}, ${s.usuarioSistema.sub})`,
      quantas: sql<number>`count(distinct ${s.concessaoAcesso.permissao})::int`,
    })
    .from(s.usuarioSistema)
    .innerJoin(
      s.concessaoAcesso,
      eq(s.concessaoAcesso.usuarioId, s.usuarioSistema.id),
    )
    .where(
      and(
        eq(s.usuarioSistema.ativo, true),
        eq(s.concessaoAcesso.ativo, true),
        eq(s.concessaoAcesso.tipoAlvo, 'GLOBAL'),
        inArray(s.concessaoAcesso.permissao, necessarias),
      ),
    )
    .groupBy(
      s.usuarioSistema.id,
      s.usuarioSistema.email,
      s.usuarioSistema.username,
      s.usuarioSistema.sub,
    )
    .having(
      sql`count(distinct ${s.concessaoAcesso.permissao}) = ${necessarias.length}`,
    );

  return linhas.map((l) => l.identificacao);
}

/**
 * Concede (ou apenas descreve) as capacidades de gestao para uma conta.
 *
 * Tudo acontece numa transacao com **lock de aplicacao**: sem ele, dois
 * operadores rodando o bootstrap ao mesmo tempo passariam os dois pela
 * checagem de "ja existe administrador?" antes de qualquer insercao, e a
 * instalacao nasceria com dois administradores que ninguem decidiu criar.
 */
export async function executarBootstrap(
  db: Database,
  pedido: PedidoBootstrap,
): Promise<PreviaBootstrap> {
  if (!pedido.motivo.trim()) {
    throw new BootstrapRecusado(
      'Informe o motivo: autoria e motivo sao obrigatorios.',
    );
  }

  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('autorizacao:bootstrap', 0))`,
    );

    const [conta] = await tx
      .select({
        id: s.usuarioSistema.id,
        ativo: s.usuarioSistema.ativo,
        identificacao: sql<string>`coalesce(${s.usuarioSistema.email}, ${s.usuarioSistema.username}, ${s.usuarioSistema.sub})`,
        pessoaNome: s.pessoa.nome,
      })
      .from(s.usuarioSistema)
      .leftJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
      .where(eq(s.usuarioSistema.sub, pedido.sub));

    if (!conta) {
      throw new BootstrapRecusado(
        `Nenhuma conta local com o sub "${pedido.sub}". A pessoa precisa entrar ` +
          'uma vez no sistema para o vinculo existir — este comando nao cria identidade.',
      );
    }
    if (conta.pessoaNome === null) {
      // Conceder gestao a conta sem pessoa daria administracao a ninguem, e
      // o resolver a ignoraria. Decidir de quem ela e vem antes, e nao e este
      // comando que decide identidade.
      throw new BootstrapRecusado(
        `A conta ${conta.identificacao} esta com vinculo pendente: o e-mail dela ` +
          'pertence a pessoa de outra conta. Resolva o vinculo pela tela de Acessos antes.',
      );
    }
    if (!conta.ativo) {
      // Reativar aqui faria da recuperacao um contorno para a desativacao.
      throw new BootstrapRecusado(
        `A conta ${conta.identificacao} esta inativa. Reative-a explicitamente antes.`,
      );
    }

    const existentes = await administradoresRecuperaveis(tx);
    if (pedido.modo === 'BOOTSTRAP' && existentes.length > 0) {
      throw new BootstrapRecusado(
        `Ja existe administrador recuperavel (${existentes.join(', ')}). ` +
          'Use o modo de recuperacao, explicitamente, se for mesmo necessario.',
      );
    }

    const atuais = await tx
      .select({
        id: s.concessaoAcesso.id,
        permissao: s.concessaoAcesso.permissao,
        ativo: s.concessaoAcesso.ativo,
      })
      .from(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, conta.id),
          eq(s.concessaoAcesso.tipoAlvo, 'GLOBAL'),
          inArray(s.concessaoAcesso.permissao, [...CAPACIDADES_DE_GESTAO]),
        ),
      );

    const itens = CAPACIDADES_DE_GESTAO.map((permissao) => {
      const atual = atuais.find((a) => a.permissao === permissao);
      const efeito: EfeitoConcessao = !atual
        ? 'CRIAR'
        : atual.ativo
          ? 'JA_ATIVA'
          : 'REATIVAR';
      return { permissao, efeito };
    });

    if (pedido.aplicar) {
      for (const item of itens) {
        if (item.efeito === 'JA_ATIVA') continue;
        const atual = atuais.find((a) => a.permissao === item.permissao);

        if (atual) {
          await tx
            .update(s.concessaoAcesso)
            .set({
              ativo: true,
              revogadoEm: null,
              revogadoPorId: null,
              justificativa: pedido.motivo,
              concedidoPorId: pedido.operador,
              atualizadoEm: sql`now()`,
            })
            .where(eq(s.concessaoAcesso.id, atual.id));
        } else {
          await tx.insert(s.concessaoAcesso).values({
            usuarioId: conta.id,
            permissao: item.permissao,
            justificativa: pedido.motivo,
            concedidoPorId: pedido.operador,
            origem: pedido.modo === 'BOOTSTRAP' ? 'bootstrap' : 'recuperacao',
            ...colunasDoAlvo({ tipo: 'GLOBAL' }),
          });
        }

        // A trilha guarda o ato, nao so o estado: uma linha ativa nao conta
        // que foi criada por um comando local, por quem e sob que motivo.
        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'concessao_acesso',
          entidadeId: conta.id,
          acao: item.efeito === 'CRIAR' ? 'CRIACAO' : 'EDICAO',
          campo: item.permissao,
          valorNovo: `${pedido.modo}:GLOBAL`,
          usuarioId: pedido.operador.slice(0, 120),
          usuarioNome: 'comando local de bootstrap',
          justificativa: pedido.motivo,
        });
      }
    }

    return {
      usuarioId: conta.id,
      identificacao: conta.identificacao,
      pessoaNome: conta.pessoaNome,
      modo: pedido.modo,
      aplicado: pedido.aplicar,
      itens,
      administradoresExistentes: existentes,
    };
  });
}
