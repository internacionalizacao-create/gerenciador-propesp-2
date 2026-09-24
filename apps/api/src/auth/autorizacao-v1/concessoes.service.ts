import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import { DRIZZLE, type Database } from '../../database/database.module';
import * as s from '../../database/schema';
import { violouUnicidade } from '../../comum/postgres';
import type { AuthUser } from '../auth-user';
import { AcessoV1Service, type AcessoResolvido } from './acesso-v1.service';
import { podeAdministrarConcessao } from './administracao';
import { CATALOGO_PERMISSOES_V1, type PermissaoV1 } from './catalogo';
import { concessaoV1Schema, type ConcessaoV1 } from './concessao';
import { descreverAlcance, type NomesDosAlvos } from './descricao';
import { copiarModelo, IDS_MODELOS_V1 } from './modelos';
import { alvoDaLinha, colunasDoAlvo } from './persistencia';

/**
 * Administracao das concessoes pela API (V1-017).
 *
 * E a unica porta HTTP que cria acesso. O comando de bootstrap cria o primeiro
 * administrador e para por ai — capacidades de gestao, nada de negocio; daqui
 * em diante quem concede e uma pessoa autenticada, e cada linha guarda quem
 * concedeu, quando e por que.
 *
 * ## O que a politica impede, e por que
 *
 * - **Autoalteracao.** Ninguem edita as proprias concessoes por esta API, nem
 *   quem pode delegar. Sem isso, `acesso:write` seria acesso a tudo em dois
 *   passos: concede-se o que quiser a si mesmo e usa-se em seguida.
 * - **Escalada por delegacao.** Mexer em qualquer `acesso:*` exige
 *   `acesso:write` **e** `acesso:delegate`. Administrar bolsas de outras contas
 *   nao autoriza nomear administradores.
 * - **Capacidade vinda do cliente.** O ator e resolvido do banco pelo `sub` do
 *   token; nada no corpo influencia o que ele pode.
 * - **Ficar sem administrador.** A revogacao confere, na mesma transacao, que
 *   sobra ao menos uma conta ativa com leitura, escrita e delegacao.
 */

export const alvoDaConcessaoSchema = concessaoV1Schema;

export const lotedeConcessoesSchema = z
  .strictObject({
    concessoes: z.array(concessaoV1Schema).min(1).max(200),
    motivo: z.string().trim().min(5).max(2000),
    /** Preenchido quando o lote saiu de um modelo; explicativo, nunca heranca. */
    origem: z.string().trim().max(40).optional(),
  })
  .refine(
    (v) => new Set(v.concessoes.map(chaveLocal)).size === v.concessoes.length,
    { message: 'O lote repete a mesma ação no mesmo alcance.' },
  );
export type LoteDeConcessoes = z.infer<typeof lotedeConcessoesSchema>;

export const revogacaoSchema = z.strictObject({
  motivo: z.string().trim().min(5).max(2000),
});
export type Revogacao = z.infer<typeof revogacaoSchema>;

export const reassociacaoSchema = z.strictObject({
  pessoaId: z.uuid('Pessoa inválida.'),
  motivo: z.string().trim().min(5).max(2000),
});
export type Reassociacao = z.infer<typeof reassociacaoSchema>;

/** Capacidades que, juntas, permitem retomar a administracao. */
const DE_RECUPERACAO = [
  'acesso:read',
  'acesso:write',
  'acesso:delegate',
] as const satisfies readonly PermissaoV1[];

@Injectable()
export class ConcessoesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly acesso: AcessoV1Service,
  ) {}

  /** Catalogo e modelos, para a tela montar as opcoes sem duplicar a lista. */
  catalogo() {
    return {
      permissoes: Object.entries(CATALOGO_PERMISSOES_V1).map(
        ([chave, definicao]) => ({
          permissao: chave as PermissaoV1,
          rotulo: definicao.rotulo,
          escopos: definicao.escopos,
        }),
      ),
      modelos: IDS_MODELOS_V1.map((id) => ({ id, ...copiarModelo(id) })),
    };
  }

  /**
   * Alvos que a tela oferece no seletor de alcance.
   *
   * Vem daqui, e nao de cada modulo, porque a pergunta e uma so — "sobre o que
   * este acesso vale?" — e porque o alcance mistura dimensoes que nenhuma tela
   * de dominio junta: ciclo, PPG, rede, tematica e participacao lado a lado.
   *
   * Cada alvo carrega o **contexto que o desambigua** (o ciclo da rede, a rede
   * da tematica, os dois na participacao): sem isso, duas redes de ciclos
   * diferentes com o mesmo nome apareceriam como opcoes identicas, e quem
   * concede escolheria no escuro.
   */
  async alvos() {
    const [ciclos, ppgs, redes, tematicas, participacoes] = await Promise.all([
      this.db
        .select({
          id: s.ciclo.id,
          nome: s.ciclo.nome,
          programa: s.programa.nome,
        })
        .from(s.ciclo)
        .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
        .orderBy(asc(s.ciclo.nome)),
      this.db
        .select({ id: s.ppg.id, nome: s.ppg.nome, sigla: s.ppg.sigla })
        .from(s.ppg)
        .orderBy(asc(s.ppg.nome)),
      this.db
        .select({
          id: s.redeCoordenadora.id,
          nome: s.redeCoordenadora.nome,
          cicloId: s.redeCoordenadora.cicloId,
          ciclo: s.ciclo.nome,
        })
        .from(s.redeCoordenadora)
        .innerJoin(s.ciclo, eq(s.ciclo.id, s.redeCoordenadora.cicloId))
        .orderBy(asc(s.redeCoordenadora.nome)),
      this.db
        .select({
          id: s.areaTematica.id,
          codigo: s.areaTematica.codigo,
          nome: s.areaTematica.nome,
          rede: s.redeCoordenadora.nome,
          cicloId: s.redeCoordenadora.cicloId,
        })
        .from(s.areaTematica)
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .orderBy(asc(s.areaTematica.codigo)),
      this.db
        .select({
          id: s.participacaoPpg.id,
          ppg: s.ppg.sigla,
          ppgNome: s.ppg.nome,
          tematica: s.areaTematica.codigo,
          rede: s.redeCoordenadora.nome,
          cicloId: s.redeCoordenadora.cicloId,
        })
        .from(s.participacaoPpg)
        .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
        )
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .orderBy(asc(s.ppg.sigla)),
    ]);

    return { ciclos, ppgs, redes, tematicas, participacoes };
  }

  /**
   * O acesso da **propria** conta, em linguagem institucional (V1-019).
   *
   * Sem permissao nenhuma, de proposito: e a conta lendo a si mesma. Exigir
   * `acesso:read` aqui faria a tela "Sua conta" so funcionar para quem
   * administra acessos — justamente quem menos precisa dela. Nada do que sai
   * daqui amplia acesso: sao os alvos que a conta ja alcanca, nomeados.
   *
   * A consulta de alvos so acontece quando ha concessao. Conta recem-criada e o
   * caso comum na implantacao, e cobrar cinco consultas para devolver lista
   * vazia seria desperdicio em cima de quem ainda nem entrou no sistema.
   */
  async meuAcesso(acesso: AcessoResolvido) {
    const permissoes = acesso.permissoes;
    if (permissoes.length === 0) return { acoes: [] };

    const nomes = await this.nomesDosAlvos();

    return {
      acoes: permissoes.map((permissao) => ({
        permissao,
        rotulo: CATALOGO_PERMISSOES_V1[permissao].rotulo,
        alcance: descreverAlcance(acesso.alcance(permissao), nomes),
      })),
    };
  }

  /**
   * Rotulos dos alvos, ja desambiguados pelo contexto.
   *
   * Reusa `alvos()` em vez de consultar de novo: a tela de administracao e a da
   * propria conta precisam do mesmo nome para o mesmo alvo, e duas montagens
   * divergiriam na primeira rede renomeada.
   */
  private async nomesDosAlvos(): Promise<NomesDosAlvos> {
    const alvos = await this.alvos();

    return {
      ciclos: new Map(alvos.ciclos.map((c) => [c.id, c.nome])),
      ppgs: new Map(alvos.ppgs.map((p) => [p.id, p.sigla ?? p.nome])),
      redes: new Map(alvos.redes.map((r) => [r.id, `${r.nome} (${r.ciclo})`])),
      tematicas: new Map(
        alvos.tematicas.map((t) => [t.id, `${t.codigo} — ${t.nome}`]),
      ),
      participacoes: new Map(
        alvos.participacoes.map((p) => [
          p.id,
          `${p.ppg ?? p.ppgNome} em ${p.tematica}`,
        ]),
      ),
    };
  }

  /** Concessoes de uma conta, com o alvo ja tipado. */
  async listar(usuarioId: string) {
    const conta = await this.conta(usuarioId);

    const linhas = await this.db
      .select({
        id: s.concessaoAcesso.id,
        permissao: s.concessaoAcesso.permissao,
        tipoAlvo: s.concessaoAcesso.tipoAlvo,
        cicloId: s.concessaoAcesso.cicloId,
        ppgId: s.concessaoAcesso.ppgId,
        redeId: s.concessaoAcesso.redeId,
        areaTematicaId: s.concessaoAcesso.areaTematicaId,
        participacaoId: s.concessaoAcesso.participacaoId,
        origem: s.concessaoAcesso.origem,
        justificativa: s.concessaoAcesso.justificativa,
        concedidoPorId: s.concessaoAcesso.concedidoPorId,
        concedidoEm: s.concessaoAcesso.concedidoEm,
        ativo: s.concessaoAcesso.ativo,
        revogadoEm: s.concessaoAcesso.revogadoEm,
      })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId))
      .orderBy(asc(s.concessaoAcesso.permissao));

    return {
      conta,
      concessoes: linhas.map((linha) => ({
        ...linha,
        escopo: alvoDaLinha(linha),
      })),
    };
  }

  /**
   * Previa: o que o lote **faria**, sem gravar.
   *
   * A tela precisa disso porque o resultado nao e obvio — uma acao ja concedida
   * num alvo mais amplo nao muda nada, e uma revogada seria reativada. Mostrar
   * "3 novas, 1 reativada, 2 sem efeito" antes de salvar e o que permite ao
   * administrador conferir a decisao em vez de descobri-la depois.
   */
  async previa(ator: AuthUser, usuarioId: string, lote: LoteDeConcessoes) {
    await this.exigirPodeAdministrar(ator, usuarioId, lote.concessoes);
    const existentes = await this.existentes(usuarioId, lote.concessoes);

    return {
      itens: lote.concessoes.map((concessao) => {
        const atual = existentes.get(chaveLocal(concessao));
        return {
          ...concessao,
          efeito: !atual ? 'CRIAR' : atual.ativo ? 'JA_ATIVA' : 'REATIVAR',
        };
      }),
    };
  }

  /**
   * Aplica o lote inteiro, ou nenhum item dele.
   *
   * Atomico de proposito: metade de uma atribuicao aplicada e um acesso que
   * ninguem desenhou — tipicamente a leitura sem a escrita, ou pior, a escrita
   * sem o recorte que a acompanhava.
   */
  async conceder(ator: AuthUser, usuarioId: string, lote: LoteDeConcessoes) {
    await this.exigirPodeAdministrar(ator, usuarioId, lote.concessoes);

    return this.db.transaction(async (tx) => {
      const existentes = await this.existentes(usuarioId, lote.concessoes, tx);
      const resultado: { permissao: PermissaoV1; efeito: string }[] = [];

      for (const concessao of lote.concessoes) {
        const atual = existentes.get(chaveLocal(concessao));

        if (atual?.ativo) {
          resultado.push({
            permissao: concessao.permissao,
            efeito: 'JA_ATIVA',
          });
          continue;
        }

        if (atual) {
          await tx
            .update(s.concessaoAcesso)
            .set({
              ativo: true,
              revogadoEm: null,
              revogadoPorId: null,
              justificativa: lote.motivo,
              concedidoPorId: ator.id,
              origem: lote.origem ?? null,
              atualizadoEm: sql`now()`,
            })
            .where(eq(s.concessaoAcesso.id, atual.id));
        } else {
          await tx.insert(s.concessaoAcesso).values({
            usuarioId,
            permissao: concessao.permissao,
            justificativa: lote.motivo,
            concedidoPorId: ator.id,
            origem: lote.origem ?? null,
            ...colunasDoAlvo(concessao.escopo),
          });
        }

        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'concessao_acesso',
          entidadeId: usuarioId,
          acao: atual ? 'EDICAO' : 'CRIACAO',
          campo: concessao.permissao,
          valorNovo: concessao.escopo.tipo,
          usuarioId: ator.id,
          usuarioNome: ator.name ?? ator.username,
          justificativa: lote.motivo,
        });

        resultado.push({
          permissao: concessao.permissao,
          efeito: atual ? 'REATIVAR' : 'CRIAR',
        });
      }

      return { itens: resultado };
    });
  }

  /**
   * Revoga uma concessao. Inativa, nunca apaga: quem teve acesso e quando o
   * perdeu e parte da auditoria, e um `delete` levaria isso junto.
   */
  async revogar(ator: AuthUser, concessaoId: string, dto: Revogacao) {
    const [linha] = await this.db
      .select({
        id: s.concessaoAcesso.id,
        usuarioId: s.concessaoAcesso.usuarioId,
        permissao: s.concessaoAcesso.permissao,
        ativo: s.concessaoAcesso.ativo,
      })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.id, concessaoId));

    if (!linha) throw new NotFoundException('Concessão não encontrada.');

    await this.exigirPodeAdministrar(ator, linha.usuarioId, [
      { permissao: linha.permissao as PermissaoV1, escopo: { tipo: 'GLOBAL' } },
    ]);

    if (!linha.ativo) return { revogado: false };

    return this.db.transaction(async (tx) => {
      // O lock serializa as revogacoes: duas simultaneas poderiam, cada uma,
      // ver o outro administrador ainda ativo e deixar o sistema sem nenhum.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended('autorizacao:administradores', 0))`,
      );

      await tx
        .update(s.concessaoAcesso)
        .set({
          ativo: false,
          revogadoEm: sql`now()`,
          revogadoPorId: ator.id,
          atualizadoEm: sql`now()`,
        })
        .where(eq(s.concessaoAcesso.id, concessaoId));

      if (await this.semAdministrador(tx)) {
        throw new BadRequestException(
          'Esta revogação deixaria o sistema sem nenhum administrador ativo ' +
            'com leitura, escrita e delegação de acessos.',
        );
      }

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'concessao_acesso',
        entidadeId: linha.usuarioId,
        acao: 'EXCLUSAO',
        campo: linha.permissao,
        valorAnterior: 'ATIVA',
        usuarioId: ator.id,
        usuarioNome: ator.name ?? ator.username,
        justificativa: dto.motivo,
      });

      return { revogado: true };
    });
  }

  /**
   * Liga a conta a outra pessoa do cadastro local.
   *
   * Trocar a pessoa e trocar **quem a conta e** — as concessoes ficam na conta,
   * mas tudo que se registra em nome da pessoa passa a sair dali. Por isso a
   * mesma politica das concessoes (V1-022; ate aqui a rota so conferia a
   * permissao do decorador):
   *
   * - **sem autoalteracao** — senao quem reassocia se torna a pessoa que
   *   quiser, inclusive a que responde por uma missao;
   * - **conta que administra acesso exige `acesso:delegate`** — senao
   *   `acesso:manage-identidade` contornaria a delegacao, trocando a identidade
   *   por tras de um administrador;
   * - **motivo obrigatorio e auditado** na mesma transacao.
   */
  async reassociarPessoa(ator: AuthUser, usuarioId: string, dto: Reassociacao) {
    const acessoDoAtor = await this.acesso.resolver(ator.id);
    if (!acessoDoAtor.ativo || !acessoDoAtor.usuarioId) {
      throw new ForbiddenException('Conta sem vínculo local ativo.');
    }
    if (acessoDoAtor.usuarioId === usuarioId) {
      throw new ForbiddenException(
        'Ninguém altera a própria identidade por esta API.',
      );
    }

    const conta = await this.conta(usuarioId);

    const [administra] = await this.db
      .select({ id: s.concessaoAcesso.id })
      .from(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, usuarioId),
          eq(s.concessaoAcesso.ativo, true),
          sql`${s.concessaoAcesso.permissao} like 'acesso:%'`,
        ),
      )
      .limit(1);
    if (administra && !acessoDoAtor.alcance('acesso:delegate').global) {
      throw new ForbiddenException(
        'Esta conta administra acessos. Permissão necessária: acesso:delegate',
      );
    }

    const [pessoa] = await this.db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(eq(s.pessoa.id, dto.pessoaId));
    if (!pessoa) throw new NotFoundException('Pessoa não encontrada.');

    if (conta.pessoaId === dto.pessoaId) return { vinculado: true };

    try {
      await this.db.transaction(async (tx) => {
        await tx
          .update(s.usuarioSistema)
          .set({
            pessoaId: dto.pessoaId,
            origem: 'MANUAL',
            vinculadoPorId: ator.id,
          })
          .where(eq(s.usuarioSistema.id, usuarioId));

        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'usuario_sistema',
          entidadeId: usuarioId,
          acao: 'EDICAO',
          campo: 'pessoa_id',
          // Identificadores, nunca nome ou documento: a trilha explica o ato
          // sem copiar dado pessoal.
          valorAnterior: conta.pessoaId,
          valorNovo: dto.pessoaId,
          usuarioId: ator.id,
          usuarioNome: ator.name ?? ator.username,
          justificativa: dto.motivo,
        });
      });
    } catch (erro) {
      // `usuario_sistema_pessoa_uk`: a pessoa ja e de outra conta, inclusive
      // por corrida entre dois administradores.
      if (violouUnicidade(erro)) {
        throw new BadRequestException(
          'Esta pessoa já está vinculada a outra conta.',
        );
      }
      throw erro;
    }

    return { vinculado: true };
  }

  // -------------------------------------------------------------------------

  /**
   * Politica de V1-010 aplicada **a cada item** do lote.
   *
   * Por item, e nao por lote: conceder dez acoes de bolsa e uma de `acesso:*`
   * so pode acontecer com delegacao, e verificar "o lote" deixaria essa unica
   * linha passar escondida entre as outras.
   */
  private async exigirPodeAdministrar(
    ator: AuthUser,
    alvoId: string,
    concessoes: readonly ConcessaoV1[],
  ) {
    const acessoDoAtor = await this.acesso.resolver(ator.id);
    if (!acessoDoAtor.ativo || !acessoDoAtor.usuarioId) {
      throw new ForbiddenException('Conta sem vínculo local ativo.');
    }

    // So a capacidade **global** administra acesso: administrar concessao de
    // outra pessoa nao e ato recortavel por PPG ou rede.
    const globais = acessoDoAtor.permissoes.filter(
      (permissao) => acessoDoAtor.alcance(permissao).global,
    );

    await this.conta(alvoId);

    for (const concessao of concessoes) {
      const permitido = podeAdministrarConcessao({
        atorId: acessoDoAtor.usuarioId,
        alvoId,
        atorAtivo: true,
        capacidadesGlobais: globais,
        permissao: concessao.permissao,
      });

      if (!permitido) {
        throw new ForbiddenException(
          acessoDoAtor.usuarioId === alvoId
            ? 'Ninguém altera as próprias concessões por esta API.'
            : `Acesso negado para administrar ${concessao.permissao}.`,
        );
      }
    }
  }

  private async conta(usuarioId: string) {
    const [conta] = await this.db
      .select({
        id: s.usuarioSistema.id,
        sub: s.usuarioSistema.sub,
        email: s.usuarioSistema.email,
        username: s.usuarioSistema.username,
        ativo: s.usuarioSistema.ativo,
        pessoaId: s.pessoa.id,
        pessoaNome: s.pessoa.nome,
      })
      .from(s.usuarioSistema)
      .innerJoin(s.pessoa, eq(s.pessoa.id, s.usuarioSistema.pessoaId))
      .where(eq(s.usuarioSistema.id, usuarioId));

    if (!conta) throw new NotFoundException('Conta não encontrada.');
    return conta;
  }

  /** Concessoes ja existentes, ativas ou nao, indexadas pela chave do lote. */
  private async existentes(
    usuarioId: string,
    concessoes: readonly ConcessaoV1[],
    tx: Pick<Database, 'select'> = this.db,
  ) {
    const linhas = await tx
      .select({
        id: s.concessaoAcesso.id,
        permissao: s.concessaoAcesso.permissao,
        ativo: s.concessaoAcesso.ativo,
        tipoAlvo: s.concessaoAcesso.tipoAlvo,
        cicloId: s.concessaoAcesso.cicloId,
        ppgId: s.concessaoAcesso.ppgId,
        redeId: s.concessaoAcesso.redeId,
        areaTematicaId: s.concessaoAcesso.areaTematicaId,
        participacaoId: s.concessaoAcesso.participacaoId,
      })
      .from(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, usuarioId),
          inArray(
            s.concessaoAcesso.permissao,
            concessoes.map((c) => c.permissao),
          ),
        ),
      );

    return new Map(
      linhas.map((linha) => [
        chaveLocal({
          permissao: linha.permissao as PermissaoV1,
          escopo: alvoDaLinha(linha),
        }),
        linha,
      ]),
    );
  }

  /** `true` quando nao sobrou conta ativa capaz de retomar a administracao. */
  private async semAdministrador(tx: Pick<Database, 'select'>) {
    const linhas = await tx
      .select({ usuarioId: s.concessaoAcesso.usuarioId })
      .from(s.concessaoAcesso)
      .innerJoin(
        s.usuarioSistema,
        eq(s.usuarioSistema.id, s.concessaoAcesso.usuarioId),
      )
      .where(
        and(
          eq(s.usuarioSistema.ativo, true),
          eq(s.concessaoAcesso.ativo, true),
          eq(s.concessaoAcesso.tipoAlvo, 'GLOBAL'),
          inArray(s.concessaoAcesso.permissao, [...DE_RECUPERACAO]),
        ),
      )
      .groupBy(s.concessaoAcesso.usuarioId)
      .having(
        sql`count(distinct ${s.concessaoAcesso.permissao}) = ${DE_RECUPERACAO.length}`,
      );

    return linhas.length === 0;
  }
}

/** Chave local do par acao+alvo, para casar o lote com o que ja existe. */
function chaveLocal(concessao: ConcessaoV1): string {
  const alvo = colunasDoAlvo(concessao.escopo);
  return [
    concessao.permissao,
    alvo.tipoAlvo,
    alvo.cicloId,
    alvo.ppgId,
    alvo.redeId,
    alvo.areaTematicaId,
    alvo.participacaoId,
  ].join('|');
}
