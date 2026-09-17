import { and, eq, sql } from 'drizzle-orm';

import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import {
  ConcessoesService,
  type LoteDeConcessoes,
} from '../src/auth/autorizacao-v1/concessoes.service';
import { CAPACIDADES_DE_GESTAO } from '../src/auth/autorizacao-v1/bootstrap';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarAcesso, criarBase, type BaseFixture } from './fixtures';

/**
 * Administracao das concessoes pela API (V1-017).
 *
 * O foco e a politica, nao o CRUD: autoalteracao, escalada por delegacao,
 * atomicidade do lote e a garantia de nao ficar sem administrador. Sao as
 * quatro formas de esta API virar a porta dos fundos do modelo inteiro.
 */
describe('Concessoes — administracao pela API', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let servico: ConcessoesService;
  let adminId: string;
  let alvoId: string;

  const admin: AuthUser = {
    id: 'sub-admin-acesso',
    name: 'Administradora',
    roles: [],
    permissions: [...CAPACIDADES_DE_GESTAO],
  };

  /** Administra bolsas, mas nao delega: o caso da escalada. */
  const semDelegacao: AuthUser = {
    id: 'sub-sem-delegacao',
    name: 'Apoio administrativo',
    roles: [],
    permissions: ['acesso:read', 'acesso:write'],
  };

  const alvo: AuthUser = {
    id: 'sub-alvo',
    name: 'Coordenação',
    roles: [],
    permissions: [],
  };

  const lote = (parcial: Partial<LoteDeConcessoes> = {}): LoteDeConcessoes => ({
    motivo: 'Atribuição nominal aprovada pela PROPESP.',
    concessoes: [
      {
        permissao: 'plano:read',
        escopo: { tipo: 'PPG', ppgId: base.ppgId, cicloId: base.cicloId },
      },
    ],
    ...parcial,
  });

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    servico = new ConcessoesService(ctx.db, new AcessoV1Service(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    ({ usuarioId: adminId } = await criarAcesso(ctx.db, {
      sub: admin.id,
      nome: admin.name,
      permissoes: admin.permissions,
    }));
    ({ usuarioId: alvoId } = await criarAcesso(ctx.db, {
      sub: alvo.id,
      nome: alvo.name,
      permissoes: [],
    }));
    await criarAcesso(ctx.db, {
      sub: semDelegacao.id,
      nome: semDelegacao.name,
      permissoes: semDelegacao.permissions,
    });
  });

  const ativas = async (usuarioId: string) =>
    ctx.db
      .select({
        permissao: s.concessaoAcesso.permissao,
        tipoAlvo: s.concessaoAcesso.tipoAlvo,
        ativo: s.concessaoAcesso.ativo,
      })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

  // -------------------------------------------------------------------------

  it('concede o lote e registra autor e motivo', async () => {
    await servico.conceder(admin, alvoId, lote());

    const linhas = await ativas(alvoId);
    expect(linhas).toEqual([
      { permissao: 'plano:read', tipoAlvo: 'PPG', ativo: true },
    ]);

    const trilha = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, alvoId));
    expect(trilha).toHaveLength(1);
    expect(trilha[0].usuarioId).toBe(admin.id);
    expect(trilha[0].justificativa).toMatch(/PROPESP/);
  });

  it('a previa nao grava e explica o efeito de cada item', async () => {
    const previa = await servico.previa(admin, alvoId, lote());

    expect(previa.itens[0].efeito).toBe('CRIAR');
    expect(await ativas(alvoId)).toHaveLength(0);
  });

  it('reconceder o mesmo alvo nao duplica: reativa a linha revogada', async () => {
    await servico.conceder(admin, alvoId, lote());
    const [linha] = await ativas(alvoId);
    expect(linha.ativo).toBe(true);

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()` })
      .where(eq(s.concessaoAcesso.usuarioId, alvoId));

    const resultado = await servico.conceder(admin, alvoId, lote());

    expect(resultado.itens[0].efeito).toBe('REATIVAR');
    expect(await ativas(alvoId)).toHaveLength(1);
  });

  it('repetir um lote ja ativo nao muda nada', async () => {
    await servico.conceder(admin, alvoId, lote());
    const resultado = await servico.conceder(admin, alvoId, lote());

    expect(resultado.itens[0].efeito).toBe('JA_ATIVA');
    expect(await ativas(alvoId)).toHaveLength(1);
  });

  // --- politica --------------------------------------------------------------

  it('ninguem altera as proprias concessoes por esta API', async () => {
    // Sem esta regra, `acesso:write` seria acesso a tudo em dois passos.
    await expect(servico.conceder(admin, adminId, lote())).rejects.toThrow(
      /próprias concessões/,
    );
  });

  it('conceder acesso:* exige delegacao, alem de escrita', async () => {
    const administrar = lote({
      concessoes: [{ permissao: 'acesso:write', escopo: { tipo: 'GLOBAL' } }],
    });

    await expect(
      servico.conceder(semDelegacao, alvoId, administrar),
    ).rejects.toThrow(/acesso:write/);

    // Quem delega consegue — e e por isso que a delegacao e escolha separada.
    await expect(
      servico.conceder(admin, alvoId, administrar),
    ).resolves.toBeDefined();
  });

  it('uma linha de acesso:* escondida no lote derruba o lote inteiro', async () => {
    // A politica e por item: verificar "o lote" deixaria essa linha passar
    // entre as outras, que sao inofensivas.
    const misturado = lote({
      concessoes: [
        {
          permissao: 'plano:read',
          escopo: { tipo: 'PPG', ppgId: base.ppgId, cicloId: base.cicloId },
        },
        { permissao: 'acesso:delegate', escopo: { tipo: 'GLOBAL' } },
      ],
    });

    await expect(
      servico.conceder(semDelegacao, alvoId, misturado),
    ).rejects.toThrow();
    expect(await ativas(alvoId)).toHaveLength(0);
  });

  it('capacidade recortada nao administra acesso', async () => {
    // `acesso:write` so vale em GLOBAL — administrar concessao de outra pessoa
    // nao e ato recortavel por PPG.
    const { usuarioId } = await criarAcesso(ctx.db, {
      sub: 'sub-parcial',
      nome: 'Escrita recortada',
      permissoes: ['acesso:write'],
      alvo: colunasDoAlvo({
        tipo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
      }),
    });
    expect(usuarioId).toBeDefined();

    await expect(
      servico.conceder(
        { id: 'sub-parcial', roles: [], permissions: ['acesso:write'] },
        alvoId,
        lote(),
      ),
    ).rejects.toThrow(/Acesso negado/);
  });

  it('conta inativa nao administra nada', async () => {
    await ctx.db
      .update(s.usuarioSistema)
      .set({ ativo: false })
      .where(eq(s.usuarioSistema.id, adminId));

    await expect(servico.conceder(admin, alvoId, lote())).rejects.toThrow(
      /sem vínculo local ativo/,
    );
  });

  it('o lote e atomico: alvo invalido nao deixa metade aplicada', async () => {
    const comAlvoInexistente = lote({
      concessoes: [
        {
          permissao: 'plano:read',
          escopo: { tipo: 'PPG', ppgId: base.ppgId, cicloId: base.cicloId },
        },
        {
          permissao: 'bolsa:read',
          escopo: {
            tipo: 'REDE',
            redeId: '3f9c1f6a-0000-4000-8000-000000000000',
          },
        },
      ],
    });

    await expect(
      servico.conceder(admin, alvoId, comAlvoInexistente),
    ).rejects.toThrow();
    expect(await ativas(alvoId)).toHaveLength(0);
  });

  // --- revogacao -------------------------------------------------------------

  it('revogar inativa a linha e preserva a trilha', async () => {
    await servico.conceder(admin, alvoId, lote());
    const [linha] = await ctx.db
      .select({ id: s.concessaoAcesso.id })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, alvoId));

    await servico.revogar(admin, linha.id, { motivo: 'Saiu da coordenação.' });

    const [depois] = await ativas(alvoId);
    expect(depois.ativo).toBe(false);

    const trilha = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, alvoId));
    expect(trilha.map((t) => t.acao)).toContain('EXCLUSAO');
  });

  it('a revogacao nao pode deixar o sistema sem administrador', async () => {
    // O ator administra (write + delegate) mas **nao** conta como
    // administrador recuperavel, porque nao tem `acesso:read`: sem leitura,
    // ninguem retoma a administracao pela tela. Revogar a escrita do unico
    // administrador completo deixaria o sistema sem saida que nao fosse acesso
    // ao servidor.
    const operador: AuthUser = {
      id: 'sub-operador',
      name: 'Operadora sem leitura',
      roles: [],
      permissions: ['acesso:write', 'acesso:delegate'],
    };
    await criarAcesso(ctx.db, {
      sub: operador.id,
      nome: operador.name,
      permissoes: operador.permissions,
    });

    const [escritaDoAdmin] = await ctx.db
      .select({ id: s.concessaoAcesso.id })
      .from(s.concessaoAcesso)
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, adminId),
          eq(s.concessaoAcesso.permissao, 'acesso:write'),
        ),
      );

    await expect(
      servico.revogar(operador, escritaDoAdmin.id, {
        motivo: 'Tentativa de deixar o sistema sem administrador.',
      }),
    ).rejects.toThrow(/sem nenhum administrador/);

    // E a recusa desfaz a propria revogacao: a transacao inteira volta atras.
    const [linha] = await ctx.db
      .select({ ativo: s.concessaoAcesso.ativo })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.id, escritaDoAdmin.id));
    expect(linha.ativo).toBe(true);
  });

  it('os alvos vem com o contexto que os desambigua', async () => {
    const alvos = await servico.alvos();

    // Duas redes de ciclos diferentes podem ter o mesmo nome: sem o ciclo ao
    // lado, quem concede escolheria no escuro.
    expect(alvos.redes[0]).toMatchObject({
      id: base.redeId,
      ciclo: '2027-2030',
    });
    expect(alvos.ciclos.map((c) => c.id)).toContain(base.cicloId);
    expect(alvos.ppgs.map((p) => p.id)).toContain(base.ppgId);
    expect(alvos.tematicas[0]).toMatchObject({
      id: base.areaTematicaId,
      rede: 'REDE-TESTE',
    });
  });

  it('o catalogo devolve acoes e modelos para a tela montar as opcoes', () => {
    const catalogo = servico.catalogo();

    expect(catalogo.permissoes.length).toBeGreaterThan(70);
    expect(catalogo.modelos.map((m) => m.id)).toContain('responsavel-ppg');
    // Modelo e ponto de partida, nao papel: vem sem alcance nenhum.
    expect(Object.keys(catalogo.modelos[0])).toEqual([
      'id',
      'rotulo',
      'permissoes',
    ]);
  });
  // -------------------------------------------------------------------------
  // O proprio acesso, para a tela "Sua conta" (V1-019)

  it('descreve o proprio acesso pelo nome do alvo, sem id nenhum', async () => {
    await servico.conceder(admin, alvoId, lote());

    const resolvido = await new AcessoV1Service(ctx.db).resolver(alvo.id);
    const meu = await servico.meuAcesso(resolvido);

    expect(meu.acoes).toEqual([
      {
        permissao: 'plano:read',
        rotulo: 'Consultar linhas e histórico',
        alcance: ['PPGT no ciclo 2027-2030'],
      },
    ]);
    // O que a tela mostra nao pode conter identificador interno: e a tela de
    // quem nao administra acesso e nao tem como traduzir um UUID.
    expect(JSON.stringify(meu)).not.toContain(base.ppgId);
  });

  it('conta sem concessao nao recebe frase alguma', async () => {
    const resolvido = await new AcessoV1Service(ctx.db).resolver(alvo.id);

    // Vazio e o que faz a tela dizer "nenhum acesso concedido ainda"; uma
    // frase generica aqui prometeria acesso que nao existe.
    expect(await servico.meuAcesso(resolvido)).toEqual({ acoes: [] });
  });

  it('nao devolve o acesso de outra conta', async () => {
    await servico.conceder(admin, alvoId, lote());

    const resolvido = await new AcessoV1Service(ctx.db).resolver(
      semDelegacao.id,
    );
    const meu = await servico.meuAcesso(resolvido);

    // A rota nao exige permissao: a unica coisa que a impede de virar leitura
    // do acesso alheio e receber o acesso **ja resolvido** da requisicao.
    expect(meu.acoes.map((a) => a.permissao)).toEqual([
      'acesso:read',
      'acesso:write',
    ]);
  });
});
