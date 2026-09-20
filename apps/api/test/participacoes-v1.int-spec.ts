import { eq, sql } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import * as s from '../src/database/schema';
import { ParticipacoesService } from '../src/dominio/participacoes.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import {
  bolsaValida,
  criarAcesso,
  criarBase,
  type BaseFixture,
} from './fixtures';

/**
 * V1-034 — administrar a participacao PPG-tematica.
 *
 * O vinculo existia so na seed, e um PPG cadastrado depois ficava inutilizavel
 * no ciclo corrente: sem participacao nao ha linha de plano valida, e sem linha
 * de plano nao ha bolsa. Os casos cobram o que a ficha pede, e em especial as
 * quatro armadilhas:
 *
 * - **o mesmo PPG participa de mais de uma tematica** (PROFSAUDE), e o que se
 *   repete e o par, nunca o programa sozinho;
 * - **trocar o responsavel nao transfere acesso** — as concessoes ficam onde
 *   estavam, e o rastro guarda quem saiu e quem entrou;
 * - **nada e apagado em cascata**: participacao que sustenta plano ou bolsa e
 *   recusada;
 * - e a remocao **conta as concessoes afetadas sem revoga-las**, porque mexer
 *   no acesso de lado seria revogar sem registro de quem revogou.
 */

const usuario: AuthUser = {
  id: 'admin-participacao',
  name: 'Administradora',
  roles: [],
  permissions: [
    'participacao:create',
    'participacao:edit',
    'participacao:delete',
  ],
};

describe('V1-034: participacao PPG-tematica', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ParticipacoesService;
  let outroPpgId: string;
  let outraPessoaId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ParticipacoesService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [ppg] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG em Saúde Coletiva', sigla: 'PROFSAUDE' })
      .returning({ id: s.ppg.id });
    outroPpgId = ppg.id;

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Outro Coordenador', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });
    outraPessoaId = pessoa.id;

    // Segunda tematica na mesma rede: e ela que permite o caso do PROFSAUDE,
    // o mesmo PPG participando de duas.
    await ctx.db.insert(s.areaTematica).values({
      redeId: base.redeId,
      codigo: 'TESTE-T2',
      nome: 'Segunda temática',
    });
  });

  const nova = (ppgId = base.ppgId) => ({
    ppgId,
    coordenadorTematicaId: base.coordenadorTematicaId,
    situacao: 'CADASTRO_PRELIMINAR' as const,
    modalidadesPrevistas: null,
    observacoes: null,
  });

  // ------------------------------------------------------- PPG utilizavel --

  it('PPG novo ganha participacao e passa a aparecer na tematica', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );
    expect(criada.ppgSigla).toBe('PROFSAUDE');
    expect(criada.tematicaCodigo).toBe('TESTE-T1');
    expect(criada.coordenadorTematicaId).toBe(base.coordenadorTematicaId);
    // Nasce sem sustentar nada — e o que permite remove-la se foi engano.
    expect(criada.uso).toEqual({
      linhasDePlano: 0,
      bolsas: 0,
      concessoes: 0,
      concessoesRevogadas: 0,
    });

    const [linha] = await ctx.db
      .select({
        ppgId: s.participacaoPpg.ppgId,
        situacao: s.participacaoPpg.situacao,
      })
      .from(s.participacaoPpg)
      .where(eq(s.participacaoPpg.id, criada.id));
    expect(linha.ppgId).toBe(outroPpgId);
    expect(linha.situacao).toBe('CADASTRO_PRELIMINAR');
  });

  it('o mesmo PPG participa de duas tematicas, e nao da mesma duas vezes', async () => {
    await service.criar(base.cicloId, 'TESTE-T1', nova(outroPpgId), usuario);
    // Duas temáticas: é o caso real do PROFSAÚDE, e o índice do banco só
    // proíbe o par repetido.
    await service.criar(base.cicloId, 'TESTE-T2', nova(outroPpgId), usuario);

    await expect(
      service.criar(base.cicloId, 'TESTE-T1', nova(outroPpgId), usuario),
    ).rejects.toThrow(/já participa/i);

    const linhas = await ctx.db
      .select({ id: s.participacaoPpg.id })
      .from(s.participacaoPpg)
      .where(eq(s.participacaoPpg.ppgId, outroPpgId));
    expect(linhas).toHaveLength(2);
  });

  it('tematica de outro ciclo nao e encontrada', async () => {
    const [outroCiclo] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });

    // 404, e nao 403: "existe, mas nao e deste ciclo" ja entregaria que ela
    // existe.
    await expect(
      service.criar(outroCiclo.id, 'TESTE-T1', nova(outroPpgId), usuario),
    ).rejects.toThrow(/não encontrada neste ciclo/i);
  });

  it('referencias marcam quem ja participa, sem duplicar o PPG', async () => {
    await service.criar(base.cicloId, 'TESTE-T1', nova(outroPpgId), usuario);
    await service.criar(base.cicloId, 'TESTE-T2', nova(outroPpgId), usuario);

    const { ppgs } = await service.referencias(base.cicloId, 'TESTE-T1');
    const doProfsaude = ppgs.filter((ppg) => ppg.id === outroPpgId);
    // Uma linha por PPG, mesmo participando de duas tematicas: com `join` no
    // lugar do `exists`, o programa apareceria duas vezes na lista.
    expect(doProfsaude).toHaveLength(1);
    expect(doProfsaude[0].jaParticipa).toBe(true);
    expect(ppgs.find((ppg) => ppg.id === base.ppgId)?.jaParticipa).toBe(false);
  });

  // ------------------------------------------- troca de responsavel --

  it('trocar o responsavel grava auditoria e nao transfere acesso', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );

    const { usuarioId } = await criarAcesso(ctx.db, {
      sub: 'coordenador-antigo',
      permissoes: ['plano:read'],
      alvo: colunasDoAlvo({
        tipo: 'PARTICIPACAO',
        participacaoId: criada.id,
      }),
    });

    await service.atualizar(
      base.cicloId,
      'TESTE-T1',
      criada.id,
      { coordenadorTematicaId: outraPessoaId },
      usuario,
    );

    const trilha = await ctx.db
      .select({
        campo: s.registroAuditoria.campo,
        anterior: s.registroAuditoria.valorAnterior,
        novo: s.registroAuditoria.valorNovo,
      })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, criada.id));

    const edicao = trilha.find(
      (linha) => linha.campo === 'coordenadorTematicaId',
    );
    expect(edicao?.anterior).toBe(base.coordenadorTematicaId);
    expect(edicao?.novo).toBe(outraPessoaId);

    // A concessao do coordenador anterior continua exatamente como estava:
    // designar responsavel e conceder acesso sao duas perguntas separadas
    // desde a V1-012.
    const concessoes = await ctx.db
      .select({ revogadoEm: s.concessaoAcesso.revogadoEm })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));
    expect(concessoes).toHaveLength(1);
    expect(concessoes[0].revogadoEm).toBeNull();
  });

  // ------------------------------------------------------------ remocao --

  it('nao remove participacao que sustenta linha de plano', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );
    await ctx.db
      .insert(s.itemPlanejado)
      .values({ ...bolsaValida(base, 'BOL-034'), ppgId: outroPpgId });

    await expect(
      service.remover(base.cicloId, 'TESTE-T1', criada.id, usuario),
    ).rejects.toThrow(/linha\(s\) de plano/i);

    // A linha continua lá: recusar é recusar, não apagar pela metade.
    const [ainda] = await ctx.db
      .select({ id: s.participacaoPpg.id })
      .from(s.participacaoPpg)
      .where(eq(s.participacaoPpg.id, criada.id));
    expect(ainda).toBeDefined();
  });

  it('recusa remover participacao que e alvo de concessao, e nao a revoga', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );
    const { usuarioId } = await criarAcesso(ctx.db, {
      sub: 'conta-da-participacao',
      permissoes: ['plano:read'],
      alvo: colunasDoAlvo({
        tipo: 'PARTICIPACAO',
        participacaoId: criada.id,
      }),
    });

    await expect(
      service.remover(base.cicloId, 'TESTE-T1', criada.id, usuario),
    ).rejects.toThrow(/Revogue-as em Acessos/i);

    // **Este e o ponto.** `concessao_acesso.participacao_id` e
    // `on delete cascade`: sem a recusa, o `delete` teria apagado a concessao
    // dentro do banco, sem trilha e sem ninguem ter revogado nada.
    const concessoes = await ctx.db
      .select({ revogadoEm: s.concessaoAcesso.revogadoEm })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));
    expect(concessoes).toHaveLength(1);
    expect(concessoes[0].revogadoEm).toBeNull();
  });

  it('recusa remover quando a concessao ja foi revogada, para nao apagar a trilha', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );
    const { usuarioId } = await criarAcesso(ctx.db, {
      sub: 'conta-que-perdeu-acesso',
      permissoes: ['plano:read'],
      alvo: colunasDoAlvo({
        tipo: 'PARTICIPACAO',
        participacaoId: criada.id,
      }),
    });
    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()`, revogadoPorId: usuario.id })
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

    // A linha revogada **e** o registro de que aquela conta teve o acesso e de
    // quem o retirou. O cascade a levaria junto, e nao ha outro lugar onde ela
    // esteja escrita.
    await expect(
      service.remover(base.cicloId, 'TESTE-T1', criada.id, usuario),
    ).rejects.toThrow(/não contemplado/i);
  });

  it('remove participacao sem concessao nenhuma', async () => {
    const criada = await service.criar(
      base.cicloId,
      'TESTE-T1',
      nova(outroPpgId),
      usuario,
    );

    const resultado = await service.remover(
      base.cicloId,
      'TESTE-T1',
      criada.id,
      usuario,
    );
    expect(resultado.concessoesAfetadas).toBe(0);

    const restantes = await ctx.db
      .select({ id: s.participacaoPpg.id })
      .from(s.participacaoPpg)
      .where(eq(s.participacaoPpg.id, criada.id));
    expect(restantes).toHaveLength(0);

    // A remocao deixa rastro, como criar e editar.
    const trilha = await ctx.db
      .select({ acao: s.registroAuditoria.acao })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, criada.id));
    expect(trilha.map((linha) => linha.acao)).toContain('EXCLUSAO');
  });
});
