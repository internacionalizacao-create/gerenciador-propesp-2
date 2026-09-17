import { and, eq, sql } from 'drizzle-orm';

import {
  administradoresRecuperaveis,
  BootstrapRecusado,
  CAPACIDADES_DE_GESTAO,
  executarBootstrap,
} from '../src/auth/autorizacao-v1/bootstrap';
import * as s from '../src/database/schema';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

/**
 * Bootstrap e recuperacao de administrador (V1-021, subtarefa a).
 *
 * O comando concede acesso sem ninguem estar autenticado — e o unico caminho do
 * sistema com essa propriedade. Os testes abaixo cobrem o que o torna aceitavel:
 * previa que nao grava, alcance limitado a gestao, recusa quando ja existe
 * administrador, recusa de conta inativa e trilha do ato.
 */
describe('Bootstrap de administrador', () => {
  let ctx: ContextoTeste;

  const pedido = (
    parcial: Partial<Parameters<typeof executarBootstrap>[1]> = {},
  ) => ({
    sub: 'sub-primeiro',
    motivo: 'Implantacao inicial, chamado 123.',
    modo: 'BOOTSTRAP' as const,
    aplicar: false,
    operador: 'cli:operadora@servidor',
    ...parcial,
  });

  const criarConta = async (sub: string, email: string, ativo = true) => {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: `Pessoa ${sub}`, email, tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [conta] = await ctx.db
      .insert(s.usuarioSistema)
      .values({ sub, pessoaId: pessoa.id, email, origem: 'EMAIL', ativo })
      .returning({ id: s.usuarioSistema.id });
    return conta.id;
  };

  const concessoesDe = (usuarioId: string) =>
    ctx.db
      .select({
        permissao: s.concessaoAcesso.permissao,
        tipoAlvo: s.concessaoAcesso.tipoAlvo,
        ativo: s.concessaoAcesso.ativo,
        justificativa: s.concessaoAcesso.justificativa,
        concedidoPorId: s.concessaoAcesso.concedidoPorId,
      })
      .from(s.concessaoAcesso)
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

  beforeAll(async () => {
    ctx = await criarContextoTeste();
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
  });

  it('a previa nao grava nada', async () => {
    const usuarioId = await criarConta('sub-primeiro', 'primeira@uea.edu.br');

    const previa = await executarBootstrap(ctx.db, pedido());

    expect(previa.aplicado).toBe(false);
    expect(previa.itens.map((i) => i.efeito)).toEqual([
      'CRIAR',
      'CRIAR',
      'CRIAR',
      'CRIAR',
    ]);
    expect(await concessoesDe(usuarioId)).toHaveLength(0);
  });

  it('concede apenas as capacidades de gestao, todas GLOBAL', async () => {
    const usuarioId = await criarConta('sub-primeiro', 'primeira@uea.edu.br');

    await executarBootstrap(ctx.db, pedido({ aplicar: true }));

    const linhas = await concessoesDe(usuarioId);
    expect(linhas.map((l) => l.permissao).sort()).toEqual(
      [...CAPACIDADES_DE_GESTAO].sort(),
    );
    // Nenhuma permissao de negocio: quem administra acesso nao ganha o plano e
    // as bolsas de todos os PPGs junto.
    expect(linhas.every((l) => l.tipoAlvo === 'GLOBAL')).toBe(true);
    expect(linhas.every((l) => l.ativo)).toBe(true);
    expect(linhas.every((l) => l.justificativa.includes('chamado 123'))).toBe(
      true,
    );
    expect(
      linhas.every((l) => l.concedidoPorId === 'cli:operadora@servidor'),
    ).toBe(true);
  });

  it('registra o ato na auditoria, com motivo e operador', async () => {
    const usuarioId = await criarConta('sub-primeiro', 'primeira@uea.edu.br');

    await executarBootstrap(ctx.db, pedido({ aplicar: true }));

    const trilha = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, usuarioId));

    expect(trilha).toHaveLength(CAPACIDADES_DE_GESTAO.length);
    expect(trilha.every((t) => t.justificativa?.includes('chamado 123'))).toBe(
      true,
    );
    expect(trilha.every((t) => t.usuarioId === 'cli:operadora@servidor')).toBe(
      true,
    );
    expect(trilha.map((t) => t.campo).sort()).toEqual(
      [...CAPACIDADES_DE_GESTAO].sort(),
    );
  });

  it('recusa quando ja existe administrador recuperavel', async () => {
    await criarConta('sub-primeiro', 'primeira@uea.edu.br');
    await executarBootstrap(ctx.db, pedido({ aplicar: true }));
    await criarConta('sub-segundo', 'segunda@uea.edu.br');

    await expect(
      executarBootstrap(ctx.db, pedido({ sub: 'sub-segundo', aplicar: true })),
    ).rejects.toThrow(/Ja existe administrador recuperavel/);
  });

  it('o modo de recuperacao passa por cima dessa recusa, explicitamente', async () => {
    await criarConta('sub-primeiro', 'primeira@uea.edu.br');
    await executarBootstrap(ctx.db, pedido({ aplicar: true }));
    const segundoId = await criarConta('sub-segundo', 'segunda@uea.edu.br');

    await executarBootstrap(
      ctx.db,
      pedido({ sub: 'sub-segundo', modo: 'RECUPERACAO', aplicar: true }),
    );

    expect(await concessoesDe(segundoId)).toHaveLength(
      CAPACIDADES_DE_GESTAO.length,
    );
    expect(await administradoresRecuperaveis(ctx.db)).toHaveLength(2);
  });

  it('repetir o bootstrap tem resultado definido: recusa nomeando quem ja e admin', async () => {
    await criarConta('sub-primeiro', 'primeira@uea.edu.br');
    await executarBootstrap(ctx.db, pedido({ aplicar: true }));

    await expect(
      executarBootstrap(ctx.db, pedido({ aplicar: true })),
    ).rejects.toThrow(/primeira@uea\.edu\.br/);
  });

  it('reativa a concessao revogada sem duplicar linha', async () => {
    const usuarioId = await criarConta('sub-primeiro', 'primeira@uea.edu.br');
    await executarBootstrap(ctx.db, pedido({ aplicar: true }));

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()`, revogadoPorId: 'sub-outro' })
      .where(
        and(
          eq(s.concessaoAcesso.usuarioId, usuarioId),
          eq(s.concessaoAcesso.permissao, 'acesso:delegate'),
        ),
      );

    const previa = await executarBootstrap(
      ctx.db,
      pedido({ modo: 'RECUPERACAO', aplicar: true }),
    );

    expect(previa.itens.filter((i) => i.efeito === 'REATIVAR')).toEqual([
      { permissao: 'acesso:delegate', efeito: 'REATIVAR' },
    ]);
    const linhas = await concessoesDe(usuarioId);
    expect(linhas).toHaveLength(CAPACIDADES_DE_GESTAO.length);
    expect(linhas.every((l) => l.ativo)).toBe(true);
  });

  it('recusa conta inativa, sem reativa-la', async () => {
    const usuarioId = await criarConta(
      'sub-inativa',
      'inativa@uea.edu.br',
      false,
    );

    await expect(
      executarBootstrap(ctx.db, pedido({ sub: 'sub-inativa', aplicar: true })),
    ).rejects.toThrow(/inativa/);

    const [conta] = await ctx.db
      .select({ ativo: s.usuarioSistema.ativo })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.id, usuarioId));
    expect(conta.ativo).toBe(false);
    expect(await concessoesDe(usuarioId)).toHaveLength(0);
  });

  it('recusa sub sem conta local: o comando nao cria identidade', async () => {
    await expect(
      executarBootstrap(ctx.db, pedido({ sub: 'sub-que-nunca-entrou' })),
    ).rejects.toThrow(/nao cria identidade/);
  });

  it('exige motivo', async () => {
    await criarConta('sub-primeiro', 'primeira@uea.edu.br');

    await expect(
      executarBootstrap(ctx.db, pedido({ motivo: '   ' })),
    ).rejects.toBeInstanceOf(BootstrapRecusado);
  });

  it('dois bootstraps simultaneos produzem um administrador, nao dois', async () => {
    await criarConta('sub-primeiro', 'primeira@uea.edu.br');
    await criarConta('sub-segundo', 'segunda@uea.edu.br');

    // Sem o lock de aplicacao, as duas transacoes leriam "nenhum administrador"
    // antes de qualquer insercao e as duas passariam.
    const resultados = await Promise.allSettled([
      executarBootstrap(ctx.db, pedido({ aplicar: true })),
      executarBootstrap(ctx.db, pedido({ sub: 'sub-segundo', aplicar: true })),
    ]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await administradoresRecuperaveis(ctx.db)).toHaveLength(1);
  });

  it('conta sem as tres capacidades nao conta como administrador recuperavel', async () => {
    const usuarioId = await criarConta('sub-parcial', 'parcial@uea.edu.br');
    // Ler e escrever, sem delegar: nao consegue nomear substituto, entao o
    // sistema continua sem caminho de recuperacao.
    for (const permissao of ['acesso:read', 'acesso:write']) {
      await ctx.db.insert(s.concessaoAcesso).values({
        usuarioId,
        permissao,
        tipoAlvo: 'GLOBAL',
        justificativa: 'Parcial, de proposito.',
      });
    }

    expect(await administradoresRecuperaveis(ctx.db)).toHaveLength(0);
    await expect(
      executarBootstrap(ctx.db, pedido({ sub: 'sub-parcial', aplicar: true })),
    ).resolves.toMatchObject({ aplicado: true });
  });
});
