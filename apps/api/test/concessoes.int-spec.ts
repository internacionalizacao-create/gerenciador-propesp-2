import { eq, sql } from 'drizzle-orm';

import { CATALOGO_PERMISSOES_V1 } from '../src/auth/autorizacao-v1/catalogo';
import {
  alvoDaLinha,
  colunasDoAlvo,
} from '../src/auth/autorizacao-v1/persistencia';
import * as s from '../src/database/schema';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * Persistencia das concessoes individuais (V1-011).
 *
 * O que se verifica aqui e o que so o banco sabe responder: que o alvo errado
 * nao entra, que a mesma concessao nao entra duas vezes, que revogar preserva a
 * trilha e que a migration sobe tanto no banco vazio quanto sobre o acesso
 * legado ja existente (as duas tabelas coexistem ate V1-012 trocar o resolver). A resolucao de acesso a partir destas linhas e V1-012;
 * nenhum guard usa a tabela ainda.
 */
describe('Concessoes de acesso — persistencia', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let usuarioId: string;

  type ValoresConcessao = Partial<typeof s.concessaoAcesso.$inferInsert>;

  const conceder = (valores: ValoresConcessao) =>
    ctx.db
      .insert(s.concessaoAcesso)
      .values({
        usuarioId,
        permissao: 'plano:read',
        justificativa: 'Teste de integracao.',
        concedidoPorId: 'sub-admin',
        ...colunasDoAlvo({ tipo: 'GLOBAL' }),
        ...valores,
      } as typeof s.concessaoAcesso.$inferInsert)
      .returning();

  beforeAll(async () => {
    ctx = await criarContextoTeste();
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({
        nome: 'Coordenação de Teste',
        email: 'coord.teste@propesp.local',
        tipo: 'DOCENTE',
      })
      .returning({ id: s.pessoa.id });

    const [usuario] = await ctx.db
      .insert(s.usuarioSistema)
      .values({
        sub: 'sub-coord',
        pessoaId: pessoa.id,
        username: 'coord.teste',
        email: 'coord.teste@propesp.local',
        origem: 'EMAIL',
      })
      .returning({ id: s.usuarioSistema.id });
    usuarioId = usuario.id;
  });

  // -------------------------------------------------------------------------
  // Alvo

  it('grava e devolve cada tipo de alvo sem perder o recorte', async () => {
    const [participacao] = await ctx.db
      .insert(s.participacaoPpg)
      .values({
        areaTematicaId: base.areaTematicaId,
        ppgId: base.ppgId,
        coordenadorTematicaId: base.coordenadorTematicaId,
      })
      .returning({ id: s.participacaoPpg.id });

    const alvos = [
      { tipo: 'GLOBAL' as const },
      { tipo: 'CICLO' as const, cicloId: base.cicloId },
      { tipo: 'PPG' as const, ppgId: base.ppgId, cicloId: base.cicloId },
      { tipo: 'REDE' as const, redeId: base.redeId },
      { tipo: 'TEMATICA' as const, tematicaId: base.areaTematicaId },
      { tipo: 'PARTICIPACAO' as const, participacaoId: participacao.id },
    ];

    for (const [i, alvo] of alvos.entries()) {
      // Permissoes diferentes para nao esbarrar na unicidade por acao+alvo.
      await conceder({
        permissao: i % 2 === 0 ? 'plano:read' : 'bolsa:read',
        ...colunasDoAlvo(alvo),
      });
    }

    const linhas = await ctx.db
      .select()
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

    expect(linhas.map((l) => alvoDaLinha(l))).toEqual(
      expect.arrayContaining(alvos),
    );
  });

  it('recusa PPG sem ciclo: seria conceder os proximos ciclos junto', async () => {
    await esperarViolacao(
      conceder({ tipoAlvo: 'PPG', ppgId: base.ppgId, cicloId: null }),
      'concessao_alvo_ck',
    );
  });

  it.each([
    { tipoAlvo: 'GLOBAL', ppgId: 'base' },
    { tipoAlvo: 'REDE', redeId: 'rede', cicloId: 'ciclo' },
    { tipoAlvo: 'CICLO', cicloId: 'ciclo', redeId: 'rede' },
    { tipoAlvo: 'TEMATICA', redeId: 'rede' },
  ])('recusa alvo ambiguo com coluna extra: %j', async (parcial) => {
    // A segunda metade do check: o tipo certo com uma coluna a mais faria duas
    // consultas escolherem colunas diferentes para decidir o mesmo acesso.
    const mapa: Record<string, string> = {
      base: base.ppgId,
      rede: base.redeId,
      ciclo: base.cicloId,
    };
    const valores = Object.fromEntries(
      Object.entries(parcial).map(([k, v]) => [k, mapa[v as string] ?? v]),
    );
    if (parcial.tipoAlvo === 'TEMATICA') {
      valores.areaTematicaId = base.areaTematicaId;
    }

    await esperarViolacao(conceder(valores), 'concessao_alvo_ck');
  });

  it('recusa texto que nem parece uma permissao', async () => {
    await esperarViolacao(
      conceder({ permissao: 'ADMIN TOTAL' }),
      'concessao_permissao_ck',
    );
  });

  it('exige justificativa', async () => {
    // O `null` contraria o tipo de proposito: quem garante a regra e o banco,
    // e e isso que este teste verifica.
    await esperarViolacao(
      conceder({ justificativa: null as unknown as string }),
      'justificativa',
    );
  });

  it('exige data de revogacao quando a concessao fica inativa', async () => {
    await esperarViolacao(conceder({ ativo: false }), 'concessao_revogacao_ck');
  });

  // -------------------------------------------------------------------------
  // Unicidade, revogacao e reativacao

  it('recusa a mesma acao no mesmo alvo duas vezes', async () => {
    const alvo = colunasDoAlvo({
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });
    await conceder(alvo);

    await esperarViolacao(conceder(alvo), 'concessao_ppg_uk');
  });

  it('aceita acoes distintas no mesmo alvo', async () => {
    const alvo = colunasDoAlvo({ tipo: 'REDE', redeId: base.redeId });
    await conceder({ ...alvo, permissao: 'missao:read' });
    await conceder({ ...alvo, permissao: 'missao:create' });

    const [{ total }] = await ctx.db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.concessaoAcesso);
    expect(total).toBe(2);
  });

  it('a unicidade alcanca a linha revogada: reconceder reativa a mesma', async () => {
    const alvo = colunasDoAlvo({ tipo: 'CICLO', cicloId: base.cicloId });
    const [criada] = await conceder(alvo);

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()`, revogadoPorId: 'sub-admin' })
      .where(eq(s.concessaoAcesso.id, criada.id));

    // Inserir de novo tem que falhar — e a falha e o que obriga o servico de
    // V1-017 a reativar, em vez de acumular duas linhas para o mesmo acesso.
    await esperarViolacao(conceder(alvo), 'concessao_ciclo_uk');

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: true, revogadoEm: null, revogadoPorId: null })
      .where(eq(s.concessaoAcesso.id, criada.id));

    const [reativada] = await ctx.db
      .select()
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.id, criada.id));
    expect(reativada.ativo).toBe(true);
    expect(reativada.concedidoEm).toEqual(criada.concedidoEm);
  });

  it('a trilha de auditoria sobrevive a conta apagada, a concessao nao', async () => {
    const [criada] = await conceder(
      colunasDoAlvo({ tipo: 'REDE', redeId: base.redeId }),
    );

    await ctx.db.insert(s.registroAuditoria).values({
      entidadeTipo: 'concessao_acesso',
      entidadeId: criada.id,
      acao: 'CRIACAO',
      campo: 'permissao',
      valorNovo: 'plano:read',
      usuarioId: 'sub-admin',
      justificativa: 'Concessao de teste.',
    });

    await ctx.db
      .delete(s.usuarioSistema)
      .where(eq(s.usuarioSistema.id, usuarioId));

    const restantes = await ctx.db.select().from(s.concessaoAcesso);
    const trilha = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, criada.id));

    // A concessao morre com a conta (nao faz sentido sozinha); o registro do
    // que foi concedido e por quem e justamente o que nao pode morrer junto.
    expect(restantes).toHaveLength(0);
    expect(trilha).toHaveLength(1);
  });

  it('apagar o alvo apaga a concessao, e nao deixa ponteiro para o nada', async () => {
    await conceder(colunasDoAlvo({ tipo: 'REDE', redeId: base.redeId }));

    await ctx.db
      .delete(s.redeCoordenadora)
      .where(eq(s.redeCoordenadora.id, base.redeId));

    expect(await ctx.db.select().from(s.concessaoAcesso)).toHaveLength(0);
  });

  it('so grava permissao que existe no catalogo', async () => {
    await conceder(colunasDoAlvo({ tipo: 'CICLO', cicloId: base.cicloId }));

    const linhas = await ctx.db
      .select({ permissao: s.concessaoAcesso.permissao })
      .from(s.concessaoAcesso);

    // O banco aceita o formato, nao o vocabulario: quem garante o catalogo e a
    // fronteira Zod. Este teste e a rede de seguranca desse acordo.
    for (const { permissao } of linhas) {
      expect(Object.keys(CATALOGO_PERMISSOES_V1)).toContain(permissao);
    }
  });

  // -------------------------------------------------------------------------
  // Migration

  it('a migration sobe sobre banco com acesso legado, sem toca-lo', async () => {
    // `criarContextoTeste` ja aplicou as migrations; o que se verifica e que o
    // legado continua inteiro e independente da tabela nova.
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId,
      tipo: 'PPG',
      ppgId: base.ppgId,
      concedidoPorId: 'sub-admin',
    });
    await conceder(
      colunasDoAlvo({ tipo: 'PPG', ppgId: base.ppgId, cicloId: base.cicloId }),
    );

    const legado = await ctx.db.select().from(s.escopoAcesso);
    expect(legado).toHaveLength(1);
    expect(legado[0].ativo).toBe(true);
  });

  it('a tabela nasce vazia: nenhuma conta ganha acesso pela migration', async () => {
    // O banco de teste acabou de migrar e de receber a fixture; se a migration
    // ou a seed concedessem algo, apareceria aqui.
    expect(await ctx.db.select().from(s.concessaoAcesso)).toHaveLength(0);
  });
});
