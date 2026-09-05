import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
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
  let ppgs: PpgsService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    ppgs = new PpgsService(ctx.db, identidade);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

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

  it('cria pessoa quando nao ha correspondencia, sem conceder escopo', async () => {
    const resolvida = await identidade.resolver(
      usuario({ email: 'novo@propesp.local' }),
    );

    const [pessoa] = await ctx.db
      .select({ nome: s.pessoa.nome })
      .from(s.pessoa)
      .where(eq(s.pessoa.id, resolvida.pessoaId));
    expect(pessoa.nome).toBe('Coordenação de Teste');

    // Criar pessoa nao e conceder acesso: escopo nasce vazio e e ato do admin.
    const escopos = await ctx.db.select().from(s.escopoAcesso);
    expect(escopos).toEqual([]);
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

  it('o papel admin recebe escopo global sem depender de linha cadastrada', async () => {
    // Um administrador sem acesso a nada seria a falha mais dificil de
    // diagnosticar que este modulo poderia ter.
    const escopo = await identidade.escopoDe(
      usuario({ roles: ['admin'], email: 'admin@propesp.local' }),
    );
    expect(escopo.global).toBe(true);
  });

  it('recorta a listagem de PPGs pelo escopo concedido', async () => {
    // A base traz um PPG; o segundo existe para que "ver so o seu" tenha o que
    // deixar de fora — um teste com um PPG so passaria mesmo sem recorte.
    await ctx.db.insert(s.ppg).values({
      nome: 'PPG Vizinho',
      sigla: 'PPGVIZ',
      situacao: 'ATIVO',
    });

    const todos = await ppgs.listar(usuario({ roles: ['admin'] }));
    expect(todos.length).toBeGreaterThan(1);

    const resolvida = await identidade.resolver(usuario());
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: resolvida.usuarioId,
      tipo: 'PPG',
      ppgId: base.ppgId,
    });

    const recortados = await ppgs.listar(usuario());
    expect(recortados.map((p) => p.id)).toEqual([base.ppgId]);
  });

  it('escopo revogado deixa de valer', async () => {
    const resolvida = await identidade.resolver(usuario());
    const [escopo] = await ctx.db
      .insert(s.escopoAcesso)
      .values({
        usuarioId: resolvida.usuarioId,
        tipo: 'PPG',
        ppgId: base.ppgId,
      })
      .returning({ id: s.escopoAcesso.id });

    await ctx.db
      .update(s.escopoAcesso)
      .set({ ativo: false })
      .where(eq(s.escopoAcesso.id, escopo.id));

    const escopoAtual = await identidade.escopoDe(usuario());
    expect(escopoAtual.ppgIds).toEqual([]);
  });

  it('o detalhe de PPG fora do escopo responde como inexistente', async () => {
    const resolvida = await identidade.resolver(usuario());
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: resolvida.usuarioId,
      tipo: 'PPG',
      ppgId: base.ppgId,
    });

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
      /nao encontrado/i,
    );
    await expect(ppgs.detalhar(base.ppgId, usuario())).resolves.toBeDefined();
  });

  it('escopo aceita so o alvo do proprio tipo', async () => {
    const resolvida = await identidade.resolver(usuario());

    // Sem o check, um escopo GLOBAL com ppg_id preenchido passaria e ninguem
    // saberia qual dos dois vale na hora de recortar.
    await esperarViolacao(
      ctx.db.insert(s.escopoAcesso).values({
        usuarioId: resolvida.usuarioId,
        tipo: 'GLOBAL',
        ppgId: base.ppgId,
      }),
      'escopo_acesso_alvo_ck',
    );

    await esperarViolacao(
      ctx.db.insert(s.escopoAcesso).values({
        usuarioId: resolvida.usuarioId,
        tipo: 'PPG',
      }),
      'escopo_acesso_alvo_ck',
    );
  });

  it('nao concede o mesmo escopo duas vezes', async () => {
    const resolvida = await identidade.resolver(usuario());
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: resolvida.usuarioId,
      tipo: 'PPG',
      ppgId: base.ppgId,
    });

    await esperarViolacao(
      ctx.db.insert(s.escopoAcesso).values({
        usuarioId: resolvida.usuarioId,
        tipo: 'PPG',
        ppgId: base.ppgId,
      }),
      'escopo_acesso_ppg_uk',
    );
  });

  // -------------------------------------------------------------------------
  // GET /me

  it('o /me devolve pessoa e escopo, e e onde o vinculo acontece', async () => {
    // O vinculo mora aqui, e nao no guard: `/me` e a primeira chamada do BFF
    // depois do login, enquanto o guard roda em toda requisicao.
    const me = new MeController(identidade);
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

  it('o /me de um admin ja chega com escopo global', async () => {
    const me = new MeController(identidade);
    const resposta = await me.me(
      usuario({ roles: ['admin'], email: 'admin@propesp.local' }),
    );
    expect(resposta.escopo.global).toBe(true);
  });

  it('nao derruba o /me quando o e-mail aponta para pessoa ja vinculada', async () => {
    // Caso real de 2026-09-05: o realm foi recriado, todos os `sub` mudaram, e
    // o e-mail passou a achar a pessoa ja ligada a conta antiga. Antes disso o
    // insert violava `usuario_sistema_pessoa_uk` e o `/me` respondia 500 — ou
    // seja, a aplicacao inteira parava para aquele usuario.
    await identidade.resolver(usuario({ id: 'sub-antigo' }));

    const me = new MeController(identidade);
    const resposta = await me.me(usuario({ id: 'sub-novo' }));

    expect(resposta.pessoaId).toBeNull();
    expect(resposta.vinculoPendente).toBe(true);
    // A sessao continua util: papeis e permissoes vem do token.
    expect(resposta.permissions).toContain('ppg:read');

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
