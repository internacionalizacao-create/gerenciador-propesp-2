import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import { ConcessoesService } from '../src/auth/autorizacao-v1/concessoes.service';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { MeController } from '../src/auth/me.controller';
import { PpgsService } from '../src/dominio/ppgs.service';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

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

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    // `/me` passou a servir tambem `/me/acesso` (V1-019); o controller pede o
    // servico, ainda que estes casos so exercitem o vinculo de identidade.
    concessoes = new ConcessoesService(ctx.db, new AcessoV1Service(ctx.db));
    ppgs = new PpgsService(ctx.db, identidade);
  });

  afterAll(async () => {
    await ctx.encerrar();
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

  it('o papel admin do Keycloak nao concede mais escopo nenhum', async () => {
    // Ate V1-012 o papel `admin` recebia escopo global de graca, e com isso a
    // autorizacao dependia de um papel que o resto do codigo jurava nao
    // consultar. Hoje quem enxerga tudo e quem tem concessao GLOBAL.
    const conta = usuario({ roles: ['admin'], email: 'admin@propesp.local' });
    await identidade.resolver(conta);

    expect((await identidade.escopoDe(conta)).global).toBe(false);

    await concederGlobal(conta, 'ppg:read');
    expect((await identidade.escopoDe(conta)).global).toBe(true);
  });

  it('recorta a listagem de PPGs pelo escopo concedido', async () => {
    // A base traz um PPG; o segundo existe para que "ver so o seu" tenha o que
    // deixar de fora — um teste com um PPG so passaria mesmo sem recorte.
    await ctx.db.insert(s.ppg).values({
      nome: 'PPG Vizinho',
      sigla: 'PPGVIZ',
      situacao: 'ATIVO',
    });

    const global = usuario({ id: 'sub-global', email: 'global@propesp.local' });
    await identidade.resolver(global);
    await concederGlobal(global, 'ppg:read');
    const todos = await ppgs.listar(global);
    expect(todos.length).toBeGreaterThan(1);

    await identidade.resolver(usuario());
    await concederPpg(usuario(), 'ppg:read');

    const recortados = await ppgs.listar(usuario());
    expect(recortados.map((p) => p.id)).toEqual([base.ppgId]);
  });

  it('concessao revogada deixa de compor o alcance', async () => {
    const resolvida = await identidade.resolver(usuario());
    const [concessao] = await ctx.db
      .insert(s.concessaoAcesso)
      .values({
        usuarioId: resolvida.usuarioId,
        permissao: 'ppg:read',
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

    const escopoAtual = await identidade.escopoDe(usuario());
    expect(escopoAtual.ppgIds).toEqual([]);
  });

  it('o detalhe de PPG fora do escopo responde como inexistente', async () => {
    await identidade.resolver(usuario());
    await concederPpg(usuario(), 'ppg:read');

    const [outro] = await ctx.db
      .insert(s.ppg)
      .values({
        nome: 'PPG Fora do Escopo',
        sigla: 'PPGFORA',
        situacao: 'ATIVO',
      })
      .returning({ id: s.ppg.id });

    // 404 e nao 403: "existe, mas nao e seu" ja entrega que o PPG existe.
    await expect(ppgs.detalhar(outro.id, usuario())).rejects.toThrow(
      /não encontrado/i,
    );
    await expect(ppgs.detalhar(base.ppgId, usuario())).resolves.toBeDefined();
  });

  // -------------------------------------------------------------------------
  // GET /me

  it('o /me devolve pessoa e escopo, e e onde o vinculo acontece', async () => {
    // O vinculo mora aqui, e nao no guard: `/me` e a primeira chamada do BFF
    // depois do login, enquanto o guard roda em toda requisicao.
    const me = new MeController(identidade, concessoes);
    const resposta = await me.me(usuario());

    expect(resposta.pessoaId).toEqual(expect.any(String));
    expect(resposta.escopo).toEqual({
      global: false,
      ppgIds: [],
      redeIds: [],
    });

    const contas = await ctx.db.select().from(s.usuarioSistema);
    expect(contas).toHaveLength(1);
  });

  it('o /me traz o escopo das concessoes, nao do papel', async () => {
    const me = new MeController(identidade, concessoes);
    const conta = usuario({ roles: ['admin'], email: 'admin@propesp.local' });

    // Primeiro acesso: a conta e criada e ainda nao tem concessao nenhuma.
    expect((await me.me(conta)).escopo.global).toBe(false);

    await concederGlobal(conta, 'ppg:read');
    expect((await me.me(conta)).escopo.global).toBe(true);
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
    expect(resposta.escopo.global).toBe(false);

    // E nao criou pessoa duplicada para contornar o conflito.
    const pessoas = await ctx.db
      .select()
      .from(s.pessoa)
      .where(eq(s.pessoa.email, 'coord.teste@propesp.local'));
    expect(pessoas).toHaveLength(1);
  });

  it('o administrador reassocia a conta em conflito', async () => {
    await identidade.resolver(usuario({ id: 'sub-antigo' }));
    await identidade.resolver(usuario({ id: 'sub-novo' }));

    // Repontar sozinho seria sequestro de identidade: bastaria criar conta com
    // o e-mail certo para herdar a pessoa e os escopos dela. Quem desempata e
    // um administrador.
    const contas = await ctx.db.select().from(s.usuarioSistema);
    expect(contas).toHaveLength(1);
    expect(contas[0].sub).toBe('sub-antigo');
  });
});
