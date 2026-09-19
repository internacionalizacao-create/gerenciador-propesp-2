import { and, eq, inArray, sql } from 'drizzle-orm';

import type { Database } from '../../database/database.module';
import * as s from '../../database/schema';
import { administradoresRecuperaveis } from './bootstrap';

/**
 * Desativacao e reativacao de contas, por comando local (V1-021, subtarefa e).
 *
 * A ficha pede "desativar contas de demonstracao no ambiente institucional por
 * procedimento revisavel". **Nao ha rota HTTP equivalente**, e a ausencia e
 * deliberada, pela mesma razao do bootstrap: quem desliga contas precisa de
 * acesso ao servidor, e o ato fica registrado com o operador do sistema
 * operacional em vez de um `sub` que pode ser o da propria conta.
 *
 * ## A regra que o resto depende
 *
 * **Nao se desativa o ultimo administrador recuperavel.** Desativar a conta
 * fecha tudo de uma vez, `acesso:*` incluido — e uma instalacao sem nenhum
 * administrador ativo nao tem como conceder nada a ninguem: o bootstrap exige
 * que a conta tenha entrado uma vez, e a recuperacao exige uma conta ativa.
 * Sem esta checagem, "desativar a demonstracao" numa sexta-feira e o tipo de
 * ato que so aparece na segunda, quando ninguem mais entra.
 *
 * A saida, quando e mesmo o que se quer, e a ordem inversa: **primeiro** dar
 * acesso ao administrador definitivo, **depois** desativar o provisorio.
 */

export class DesativacaoRecusada extends Error {}

export interface PedidoDesativacao {
  /** `sub` do Keycloak das contas alvo. */
  readonly subs: readonly string[];
  readonly motivo: string;
  /** `true` reativa em vez de desativar; e modo explicito, como a recuperacao. */
  readonly reativar?: boolean;
  readonly aplicar: boolean;
  readonly operador: string;
}

export type EfeitoConta = 'DESATIVAR' | 'REATIVAR' | 'SEM_EFEITO';

export interface ItemDesativacao {
  sub: string;
  identificacao: string;
  pessoaNome: string;
  efeito: EfeitoConta;
}

export interface PreviaDesativacao {
  itens: ItemDesativacao[];
  aplicado: boolean;
  /** Quem continua podendo administrar acesso **depois** deste ato. */
  administradoresRestantes: string[];
}

export async function executarDesativacao(
  db: Database,
  pedido: PedidoDesativacao,
): Promise<PreviaDesativacao> {
  if (!pedido.motivo.trim()) {
    throw new DesativacaoRecusada(
      'Informe o motivo: autoria e motivo sao obrigatorios.',
    );
  }
  if (pedido.subs.length === 0) {
    throw new DesativacaoRecusada('Informe ao menos um --sub.');
  }

  const alvo = pedido.reativar ? true : false;

  return db.transaction(async (tx) => {
    // O mesmo lock do bootstrap: os dois decidem sobre "quantos
    // administradores restam", e decidir isso em paralelo pode zerar a conta.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtextextended('autorizacao:bootstrap', 0))`,
    );

    const contas = await tx
      .select({
        id: s.usuarioSistema.id,
        sub: s.usuarioSistema.sub,
        ativo: s.usuarioSistema.ativo,
        identificacao: sql<string>`coalesce(${s.usuarioSistema.email}, ${s.usuarioSistema.username}, ${s.usuarioSistema.sub})`,
        pessoaNome: s.pessoa.nome,
      })
      .from(s.usuarioSistema)
      .innerJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
      .where(inArray(s.usuarioSistema.sub, [...pedido.subs]));

    const faltando = pedido.subs.filter(
      (sub) => !contas.some((c) => c.sub === sub),
    );
    if (faltando.length > 0) {
      // Recusar o lote inteiro, e nao seguir com o que existe: um `sub`
      // digitado errado significa que o operador mirou noutra conta.
      throw new DesativacaoRecusada(
        `Sem conta local para: ${faltando.join(', ')}. Confira com --listar.`,
      );
    }

    const itens: ItemDesativacao[] = contas.map((conta) => ({
      sub: conta.sub,
      identificacao: conta.identificacao,
      pessoaNome: conta.pessoaNome,
      efeito:
        conta.ativo === alvo
          ? 'SEM_EFEITO'
          : pedido.reativar
            ? 'REATIVAR'
            : 'DESATIVAR',
    }));

    const mudam = itens.filter((i) => i.efeito !== 'SEM_EFEITO');

    // Quem sobra depois do ato, calculado **antes** de gravar: a lista atual
    // menos as contas que estao saindo.
    const antes = await administradoresRecuperaveis(tx);
    const saindo = new Set(
      mudam.filter((i) => i.efeito === 'DESATIVAR').map((i) => i.identificacao),
    );
    const restantes = pedido.reativar
      ? antes
      : antes.filter((a) => !saindo.has(a));

    if (!pedido.reativar && antes.length > 0 && restantes.length === 0) {
      throw new DesativacaoRecusada(
        'Isto desativaria o ultimo administrador recuperavel ' +
          `(${[...saindo].join(', ')}), e ninguem mais poderia conceder acesso. ` +
          'Configure o administrador definitivo primeiro.',
      );
    }

    if (pedido.aplicar && mudam.length > 0) {
      await tx
        .update(s.usuarioSistema)
        .set({ ativo: alvo, atualizadoEm: sql`now()` })
        .where(
          and(
            inArray(
              s.usuarioSistema.sub,
              mudam.map((i) => i.sub),
            ),
            eq(s.usuarioSistema.ativo, !alvo),
          ),
        );

      for (const item of mudam) {
        const conta = contas.find((c) => c.sub === item.sub)!;
        // As concessoes ficam como estao, de proposito: desativar a conta ja
        // fecha tudo, e revoga-las apagaria a configuracao que uma reativacao
        // precisa devolver intacta.
        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'usuario_sistema',
          entidadeId: conta.id,
          acao: 'EDICAO',
          campo: 'ativo',
          valorAnterior: String(!alvo),
          valorNovo: String(alvo),
          usuarioId: pedido.operador.slice(0, 120),
          usuarioNome: 'comando local de desativacao',
          justificativa: pedido.motivo,
        });
      }
    }

    return {
      itens,
      aplicado: pedido.aplicar,
      administradoresRestantes: restantes,
    };
  });
}
