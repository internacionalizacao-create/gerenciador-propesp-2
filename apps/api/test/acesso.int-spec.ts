import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import { ConcessoesService } from '../src/auth/autorizacao-v1/concessoes.service';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { MeController } from '../src/auth/me.controller';
import { PpgsController } from '../src/dominio/ppgs.controller';
import { PpgsService } from '../src/dominio/ppgs.service';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { bolsaValida, criarBase, type BaseFixture } from './fixtures';

const usuario = (parcial: Partial<AuthUser> = {}): AuthUser => ({
  id: 'sub-teste',
  username: 'coord.teste',
  email: 'coord.teste@propesp.local',
  name: 'Coordenação de Teste',
  roles: ['coordenador'],
  permissions: ['ppg:read'],
  ...parcial,
});

/**
 * Identidade local e recorte por escopo.
 *
 * O vinculo `sub` -> `pessoa` e o recorte por PPG/rede sao o que transforma
 * "pode listar PPG" em "pode listar **estes** PPGs". Os casos abaixo cobrem o
 * primeiro acesso, a reentrada, a corrida entre duas abas e o recorte de fato
 * aplicado na consulta.
 */
describe('Identidade e escopo de acesso', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let identidade: IdentidadeService;
  let concessoes: ConcessoesService;
  let ppgs: PpgsService;
  let acessos: AcessoV1Service;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    // `/me` passou a servir tambem `/me/acesso` (V1-019); o controller pede o
    // servico, ainda que estes casos so exercitem o vinculo de identidade.
    concessoes = new ConcessoesService(ctx.db, new AcessoV1Service(ctx.db));
    acessos = new AcessoV1Service(ctx.db);
    ppgs = new PpgsService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

  /** Concede uma acao em GLOBAL para a conta ja vinculada. */
  async function concederGlobal(conta: AuthUser, permissao: string) {
    await conceder(conta, permissao, colunasDoAlvo({ tipo: 'GLOBAL' }));
  }

  /** Concede uma acao no PPG da fixture, com o ciclo que o alvo exige. */
  async function concederPpg(conta: AuthUser, permissao: string) {
    await conceder(
      conta,
      permissao,
      colunasDoAlvo({
        tipo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
      }),
    );
  }

  async function conceder(
    conta: AuthUser,
    permissao: string,
    alvo: ReturnType<typeof colunasDoAlvo>,
  ) {
    const [linha] = await ctx.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, conta.id));

    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: linha.id,
      permissao,
      justificativa: 'Concessao de teste.',
      ...alvo,
    });
  }

  // -------------------------------------------------------------------------
  // Vinculo

  it('liga a conta a uma pessoa existente pelo e-mail, no primeiro acesso', async () => {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({
        nome: 'Maria Coordenadora',
        email: 'coord.teste@propesp.local',
        tipo: 'DOCENTE',
      })
      .returning({ id: s.pessoa.id });

    const resolvida = await identidade.resolver(usuario());

    // E o caso que motivou o desenho: as pessoas ja cadastradas em missoes
    // recebem conta no Keycloak depois, e o e-mail e o que as reencontra.
    expect(resolvida.pessoaId).toBe(pessoa.id);

    const [conta] = await ctx.db
      .select({ origem: s.usuarioSistema.origem })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, 'sub-teste'));
    expect(conta.origem).toBe('EMAIL');
  });

  it('cria pessoa quando nao ha correspondencia, sem conceder acesso', async () => {
    const resolvida = await identidade.resolver(
      usuario({ email: 'novo@propesp.local' }),
    );

    const [pessoa] = await ctx.db
      .select({ nome: s.pessoa.nome })
      .from(s.pessoa)
      .where(eq(s.pessoa.id, resolvida.pessoaId));
    expect(pessoa.nome).toBe('Coordenação de Teste');

    // Criar pessoa nao e conceder acesso: concessoes nascem vazias.
    const concessoes = await ctx.db.select().from(s.concessaoAcesso);
    expect(concessoes).toEqual([]);
  });

  it('reentrar nao duplica a conta e atualiza o ultimo acesso', async () => {
    const primeira = await identidade.resolver(usuario());
    const segunda = await identidade.resolver(usuario());

    expect(segunda.usuarioId).toBe(primeira.usuarioId);
    const contas = await ctx.db.select().from(s.usuarioSistema);
    expect(contas).toHaveLength(1);
    expect(contas[0].ultimoAcessoEm).not.toBeNull();
  });

  it('duas abas simultaneas produzem uma unica conta', async () => {
    // A corrida e real: duas requisicoes chegam antes de qualquer uma gravar.
    const [a, b] = await Promise.all([
      identidade.resolver(usuario()),
      identidade.resolver(usuario()),
    ]);

    expect(a.usuarioId).toBe(b.usuarioId);
    expect(await ctx.db.select().from(s.usuarioSistema)).toHaveLength(1);
  });

  it('recusa duas contas para a mesma pessoa', async () => {
    const resolvida = await identidade.resolver(usuario());

    // Duas contas na mesma pessoa tornariam ambiguo qualquer "as missoes em
    // que sou responsavel".
    await esperarViolacao(
      ctx.db.insert(s.usuarioSistema).values({
        sub: 'outro-sub',
        pessoaId: resolvida.pessoaId,
        origem: 'MANUAL',
      }),
      'usuario_sistema_pessoa_uk',
    );
  });

  // -------------------------------------------------------------------------
  // Escopo

  it('o papel admin do Keycloak nao concede alcance nenhum', async () => {
    // Ate V1-012 o papel `admin` recebia escopo global de graca, e com isso a
    // autorizacao dependia de um papel que o resto do codigo jurava nao
    // consultar. Hoje quem enxerga tudo e quem tem concessao GLOBAL.
    const conta = usuario({ roles: ['admin'], email: 'admin@propesp.local' });
    await identidade.resolver(conta);

    expect((await acessos.resolver(conta.id)).alcance('ppg:read').global).toBe(
      false,
    );

    await concederGlobal(conta, 'ppg:read');
    expect((await acessos.resolver(conta.id)).alcance('ppg:read').global).toBe(
      true,
    );
  });

  /** Um PPG vizinho com linha de plano programada, que ninguem concedeu. */
  async function vizinhoComPlano() {
    const [vizinho] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG Vizinho', sigla: 'PPGVIZ', situacao: 'ATIVO' })
      .returning({ id: s.ppg.id });
    for (const [codigo, ppgId] of [
      ['BOL-001', base.ppgId],
      ['BOL-002', vizinho.id],
    ] as const) {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values({ ...bolsaValida(base, codigo), ppgId })
        .returning({ id: s.itemPlanejado.id });
      await ctx.db
        .insert(s.planejamentoAnual)
        .values({ itemPlanejadoId: item.id, ano: 2027, quantidade: 2 });
    }
    return vizinho.id;
  }

  it('o custo por PPG sai pelo alcance de plano:read, e nao pelo do cadastro', async () => {
    // O vazamento que a V1-022 fechou: `ppg:read` so admite GLOBAL, e a lista
    // de PPGs somava bolsas e custo de todos. Quem consulta o plano de um PPG
    // lia, por aqui, o custo de todos os outros.
    const vizinhoId = await vizinhoComPlano();
    await identidade.resolver(usuario());
    await concederGlobal(usuario(), 'ppg:read');
    await concederPpg(usuario(), 'plano:read');
    const acesso = await acessos.resolver(usuario().id);

    const lista = await ppgs.listar(
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );

    // O cadastro continua inteiro: e dado institucional.
    expect(lista.map((p) => p.id).sort()).toEqual(
      [base.ppgId, vizinhoId].sort(),
    );
    const meu = lista.find((p) => p.id === base.ppgId)!;
    const alheio = lista.find((p) => p.id === vizinhoId)!;
    expect(meu.bolsasAno).toBe(2);
    expect(Number(meu.custoAno)).toBeCloseTo(2 * 82902.2, 2);
    // Fora do alcance, nulo — nunca zero, que afirmaria o que a conta nao sabe.
    expect(alheio.bolsasAno).toBeNull();
    expect(alheio.custoAno).toBeNull();
    expect(lista.every((p) => p.planoRecortado)).toBe(true);

    // E o detalhe do vizinho nao traz as linhas do plano dele.
    const detalhe = await ppgs.detalhar(
      vizinhoId,
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
    expect(detalhe.plano).toBeNull();
    expect(detalhe.podeLerPlano).toBe(false);
    expect(detalhe.planoRecortado).toBe(true);
    const proprio = await ppgs.detalhar(
      base.ppgId,
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
    expect(proprio.plano!.map((l) => l.codigo)).toEqual(['BOL-001']);
  });

  it.each(['CICLO', 'REDE', 'TEMATICA', 'PARTICIPACAO'] as const)(
    'recorta plano por %s sem duplicar linhas de concessoes sobrepostas',
    async (tipo) => {
      await vizinhoComPlano();
      const [participacao] = await ctx.db
        .insert(s.participacaoPpg)
        .values({
          areaTematicaId: base.areaTematicaId,
          ppgId: base.ppgId,
          coordenadorTematicaId: base.coordenadorTematicaId,
        })
        .returning();
      await identidade.resolver(usuario());
      await concederGlobal(usuario(), 'ppg:read');
      const alvos = {
        CICLO: { tipo: 'CICLO', cicloId: base.cicloId },
        REDE: { tipo: 'REDE', redeId: base.redeId },
        TEMATICA: { tipo: 'TEMATICA', tematicaId: base.areaTematicaId },
        PARTICIPACAO: { tipo: 'PARTICIPACAO', participacaoId: participacao.id },
      } as const;
      await conceder(usuario(), 'plano:read', colunasDoAlvo(alvos[tipo]));
      await concederPpg(usuario(), 'plano:read');
      const acesso = await acessos.resolver(usuario().id);
      const lista = await ppgs.listar(acesso.alcance('plano:read'));
      expect(lista.find((p) => p.id === base.ppgId)).toMatchObject({
        bolsasAno: 2,
        podeLerPlano: true,
      });
      const detalhe = await ppgs.detalhar(
        base.ppgId,
        acesso.alcance('plano:read'),
      );
      expect(detalhe.plano).toHaveLength(1);
      if (tipo === 'PARTICIPACAO') {
        expect(lista.find((p) => p.id !== base.ppgId)).toMatchObject({
          bolsasAno: null,
          podeLerPlano: false,
        });
      }
    },
  );

  it('PPG concedido em outro ciclo tem plano vazio autorizado, sem os valores deste ciclo', async () => {
    await vizinhoComPlano();
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning();
    await identidade.resolver(usuario());
    await conceder(
      usuario(),
      'plano:read',
      colunasDoAlvo({ tipo: 'PPG', ppgId: base.ppgId, cicloId: outro.id }),
    );
    const acesso = await acessos.resolver(usuario().id);
    expect(
      (await ppgs.listar(acesso.alcance('plano:read'))).find(
        (p) => p.id === base.ppgId,
      ),
    ).toMatchObject({ bolsasAno: 0, podeLerPlano: true });
    expect(
      await ppgs.detalhar(base.ppgId, acesso.alcance('plano:read')),
    ).toMatchObject({ plano: [], podeLerPlano: true });
  });

  it('sem plano:read, bolsas e custo saem nulos em todos os PPGs', async () => {
    await vizinhoComPlano();
    await identidade.resolver(usuario());
    await concederGlobal(usuario(), 'ppg:read');
    const acesso = await acessos.resolver(usuario().id);

    const lista = await ppgs.listar(
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
    expect(lista).toHaveLength(2);
    expect(
      lista.every((p) => p.bolsasAno === null && p.custoAno === null),
    ).toBe(true);
  });

  it('editar cadastro nao devolve planejamento fora do alcance', async () => {
    const vizinhoId = await vizinhoComPlano();
    await identidade.resolver(usuario());
    await concederGlobal(usuario(), 'ppg:edit');
    const controller = new PpgsController(ppgs);
    let acesso = await acessos.resolver(usuario().id);
    const semPlano = await controller.atualizar(
      base.ppgId,
      { nome: 'Nome editado' },
      acesso,
    );
    expect(semPlano.nome).toBe('Nome editado');
    expect(semPlano.plano).toBeNull();
    expect(semPlano.podeLerPlano).toBe(false);
    await concederPpg(usuario(), 'plano:read');
    acesso = await acessos.resolver(usuario().id);
    expect(
      (await controller.atualizar(vizinhoId, {}, acesso)).plano,
    ).toBeNull();
    expect(
      (await controller.atualizar(base.ppgId, {}, acesso)).plano,
    ).toHaveLength(1);
  });

  it('com plano:read global, o zero e zero e nada vem recortado', async () => {
    await identidade.resolver(usuario());
    await concederGlobal(usuario(), 'ppg:read');
    await concederGlobal(usuario(), 'plano:read');
    const acesso = await acessos.resolver(usuario().id);

    const [linha] = await ppgs.listar(
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
    expect(linha.bolsasAno).toBe(0);
    expect(Number(linha.custoAno)).toBe(0);
    expect(linha.planoRecortado).toBe(false);
  });

  it('concessao revogada deixa de compor o alcance', async () => {
    const resolvida = await identidade.resolver(usuario());
    const [concessao] = await ctx.db
      .insert(s.concessaoAcesso)
      .values({
        usuarioId: resolvida!.usuarioId,
        permissao: 'plano:read',
        tipoAlvo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
        justificativa: 'Teste de revogacao.',
      })
      .returning({ id: s.concessaoAcesso.id });

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: new Date() })
      .where(eq(s.concessaoAcesso.id, concessao.id));

    const acesso = await acessos.resolver(usuario().id);
    expect(acesso.alcance('plano:read').ppgs).toEqual([]);
  });

  it('ppg:read fora de GLOBAL nao alcanca PPG nenhum, e o detalhe responde como inexistente', async () => {
    // O catalogo recusa esse alvo; a linha abaixo e o que so um insert direto
    // no banco produziria. Nao vira lista parcial: nao alcanca nada.
    await identidade.resolver(usuario());
    await concederPpg(usuario(), 'ppg:read');
    const acesso = await acessos.resolver(usuario().id);

    expect(
      await ppgs.listar(
        acesso.alcance('plano:read'),
        acesso.alcance('ppg:read'),
      ),
    ).toEqual([]);
    const existente = ppgs.detalhar(
      base.ppgId,
      acesso.alcance('plano:read'),
      acesso.alcance('ppg:read'),
    );
    // Mesma frase do PPG inexistente: o texto nao separa os dois casos.
    await expect(existente).rejects.toThrow('PPG não encontrado.');
    await expect(
      ppgs.detalhar('00000000-0000-4000-8000-000000000000'),
    ).rejects.toThrow('PPG não encontrado.');
  });

  // -------------------------------------------------------------------------
  // GET /me

  it('o /me devolve a pessoa, e e onde o vinculo acontece', async () => {
    // O vinculo mora aqui, e nao no guard: `/me` e a primeira chamada do BFF
    // depois do login, enquanto o guard roda em toda requisicao.
    const me = new MeController(identidade, concessoes);
    const resposta = await me.me(usuario());

    expect(resposta.pessoaId).toEqual(expect.any(String));

    const contas = await ctx.db.select().from(s.usuarioSistema);
    expect(contas).toHaveLength(1);
  });

  it('o /me nao devolve escopo agregado da conta', async () => {
    // Um alcance unico para a conta inteira nao responde a pergunta de acao
    // nenhuma (V1-022). O alcance por acao esta em `/me/acesso`.
    const me = new MeController(identidade, concessoes);
    const conta = usuario({ roles: ['admin'], email: 'admin@propesp.local' });
    await me.me(conta);
    await concederGlobal(conta, 'ppg:read');

    expect(await me.me(conta)).not.toHaveProperty('escopo');
  });

  it('nao derruba o /me quando o e-mail aponta para pessoa ja vinculada', async () => {
    // Caso real de 2026-09-05: o realm foi recriado, todos os `sub` mudaram, e
    // o e-mail passou a achar a pessoa ja ligada a conta antiga. Antes disso o
    // insert violava `usuario_sistema_pessoa_uk` e o `/me` respondia 500 — ou
    // seja, a aplicacao inteira parava para aquele usuario.
    await identidade.resolver(usuario({ id: 'sub-antigo' }));

    const me = new MeController(identidade, concessoes);
    const resposta = await me.me(usuario({ id: 'sub-novo' }));

    expect(resposta.pessoaId).toBeNull();
    expect(resposta.vinculoPendente).toBe(true);
    // A sessao continua valida: o `/me` devolve o que o guard resolveu (aqui,
    // a lista do proprio fixture) e diz que o vinculo ficou pendente, em vez de
    // derrubar a aplicacao. Sem vinculo, o guard de verdade resolveria vazio.
    expect(resposta.permissions).toEqual(['ppg:read']);

    // E nao criou pessoa duplicada para contornar o conflito.
    const pessoas = await ctx.db
      .select()
      .from(s.pessoa)
      .where(eq(s.pessoa.email, 'coord.teste@propesp.local'));
    expect(pessoas).toHaveLength(1);
  });

  it('a conta em conflito fica gravada como pendente, sem pessoa e sem acesso', async () => {
    await identidade.resolver(usuario({ id: 'sub-antigo' }));
    await identidade.resolver(usuario({ id: 'sub-novo' }));

    // Repontar sozinho seria sequestro de identidade: bastaria criar conta com
    // o e-mail certo para herdar a pessoa e os escopos dela. A conta nova
    // existe — e e isso que a faz aparecer para o administrador —, mas sem
    // pessoa.
    const contas = await ctx.db
      .select()
      .from(s.usuarioSistema)
      .orderBy(s.usuarioSistema.sub);
    expect(contas.map((c) => [c.sub, c.origem, c.pessoaId === null])).toEqual([
      ['sub-antigo', 'EMAIL', false],
      ['sub-novo', 'PENDENTE', true],
    ]);

    // Pendente nao resolve acesso, mesmo com concessao gravada por fora.
    await concederGlobal(usuario({ id: 'sub-novo' }), 'ppg:read');
    expect((await acessos.resolver('sub-novo')).permissoes).toEqual([]);

    // E o login seguinte nao a religa sozinho, mesmo com a pessoa livre.
    await ctx.db
      .update(s.usuarioSistema)
      .set({ pessoaId: null, ativo: false })
      .where(eq(s.usuarioSistema.sub, 'sub-antigo'));
    expect(await identidade.resolver(usuario({ id: 'sub-novo' }))).toBeNull();
  });
});
