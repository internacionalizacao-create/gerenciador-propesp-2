import { eq, sql } from 'drizzle-orm';

import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import { condicaoDoAlcance } from '../src/auth/autorizacao-v1/alcance';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import type { EscopoV1 } from '../src/auth/autorizacao-v1/concessao';
import * as s from '../src/database/schema';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * Resolucao de acesso por acao (V1-012).
 *
 * O que se prova aqui e o que a tarefa exige e nenhum teste de unidade alcanca:
 * que o alcance sai do banco por acao, que revogar vale na requisicao seguinte,
 * que conta inativa nao resolve nada e que o predicado recorta a consulta de
 * verdade — inclusive o caso que a implementacao ingenua erra, do mesmo PPG em
 * dois ciclos.
 */
describe('Resolver de acesso — concessoes por acao', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let acesso: AcessoV1Service;
  let usuarioId: string;

  /** Segundo ciclo e segundo PPG, para provar que o par nao se mistura. */
  let outroCicloId: string;
  let outroPpgId: string;

  const conceder = async (permissao: string, escopo: EscopoV1) => {
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId,
      permissao,
      justificativa: 'Teste de resolucao.',
      ...colunasDoAlvo(escopo),
    });
  };

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    acesso = new AcessoV1Service(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Pessoa de Teste', tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [conta] = await ctx.db
      .insert(s.usuarioSistema)
      .values({ sub: 'sub-teste', pessoaId: pessoa.id, origem: 'MANUAL' })
      .returning({ id: s.usuarioSistema.id });
    usuarioId = conta.id;

    const [ciclo] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });
    outroCicloId = ciclo.id;

    const [ppg] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'Outro PPG', sigla: 'PPGO', notaCapes: 4 })
      .returning({ id: s.ppg.id });
    outroPpgId = ppg.id;
  });

  // -------------------------------------------------------------------------

  it('conta sem concessao nenhuma nao recebe acao alguma', async () => {
    const resolvido = await acesso.resolver('sub-teste');

    // A diferenca de fundo para o modelo antigo: sem concessao, nada — e nao
    // "tudo", como fazia o modo permissivo do recorte por escopo.
    expect(resolvido.ativo).toBe(true);
    expect(resolvido.permissoes).toEqual([]);
    expect(resolvido.permite('plano:read')).toBe(false);
  });

  it('sub sem conta local resolve vazio, sem lancar', async () => {
    const resolvido = await acesso.resolver('sub-que-nunca-entrou');

    expect(resolvido.ativo).toBe(false);
    expect(resolvido.permissoes).toEqual([]);
  });

  it('separa o alcance de cada acao', async () => {
    await conceder('plano:read', { tipo: 'REDE', redeId: base.redeId });
    await conceder('bolsa:create', {
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });

    const resolvido = await acesso.resolver('sub-teste');

    expect(resolvido.permissoes).toEqual(['bolsa:create', 'plano:read']);
    // Ler na rede inteira nao autoriza criar na rede inteira: sao dois
    // alcances, e nenhum vaza para o outro.
    expect(resolvido.alcance('plano:read').redes).toEqual([base.redeId]);
    expect(resolvido.alcance('bolsa:create').redes).toEqual([]);
    expect(resolvido.alcance('bolsa:create').ppgs).toEqual([
      { ppgId: base.ppgId, cicloId: base.cicloId },
    ]);
  });

  it('soma concessoes da mesma acao', async () => {
    await conceder('plano:read', {
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });
    await conceder('plano:read', {
      tipo: 'PPG',
      ppgId: outroPpgId,
      cicloId: base.cicloId,
    });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    expect(alcance.ppgs).toHaveLength(2);
  });

  it('revogar vale na requisicao seguinte, sem trocar o token', async () => {
    await conceder('plano:read', { tipo: 'GLOBAL' });
    expect((await acesso.resolver('sub-teste')).permite('plano:read')).toBe(
      true,
    );

    await ctx.db
      .update(s.concessaoAcesso)
      .set({ ativo: false, revogadoEm: sql`now()` })
      .where(eq(s.concessaoAcesso.usuarioId, usuarioId));

    // Mesma conta, mesmo `sub`, nenhuma renovacao de sessao: a proxima
    // resolucao ja nega. E por isso que nao ha cache aqui.
    expect((await acesso.resolver('sub-teste')).permite('plano:read')).toBe(
      false,
    );
  });

  it('conta inativa nao resolve nada, nem com concessao ativa', async () => {
    await conceder('acesso:write', { tipo: 'GLOBAL' });
    await ctx.db
      .update(s.usuarioSistema)
      .set({ ativo: false })
      .where(eq(s.usuarioSistema.id, usuarioId));

    const resolvido = await acesso.resolver('sub-teste');

    expect(resolvido.ativo).toBe(false);
    expect(resolvido.permite('acesso:write')).toBe(false);
  });

  it('ignora permissao que nao existe mais no catalogo', async () => {
    await conceder('plano:read', { tipo: 'GLOBAL' });
    // Formato valido, nome desconhecido: o `check` do banco aceita, o catalogo
    // nao. A linha continua la para quem for revisar, mas nao concede nada.
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId,
      permissao: 'permissao:inventada',
      justificativa: 'Nome fora do catalogo.',
      ...colunasDoAlvo({ tipo: 'GLOBAL' }),
    });

    expect((await acesso.resolver('sub-teste')).permissoes).toEqual([
      'plano:read',
    ]);
  });

  // -------------------------------------------------------------------------
  // Predicado aplicado a uma consulta real

  const contarParticipacoes = async (condicao: ReturnType<typeof sql>) => {
    const { rows } = await ctx.db.execute<{ total: number }>(sql`
      select count(*)::int as total
        from participacao_ppg pp
        join area_tematica at on at.id = pp.area_tematica_id
        join rede_coordenadora r on r.id = at.rede_id
       where ${condicao}
    `);
    return rows[0].total;
  };

  const criarParticipacao = async (ppgId: string, cicloId: string) => {
    const [rede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId,
        instituicaoId: base.instituicaoId,
        nome: `REDE-${cicloId.slice(0, 8)}`,
      })
      .returning({ id: s.redeCoordenadora.id });
    const [tematica] = await ctx.db
      .insert(s.areaTematica)
      .values({
        redeId: rede.id,
        codigo: `T-${ppgId.slice(0, 6)}-${cicloId.slice(0, 6)}`,
        nome: 'Temática de teste',
      })
      .returning({ id: s.areaTematica.id });
    const [participacao] = await ctx.db
      .insert(s.participacaoPpg)
      .values({
        areaTematicaId: tematica.id,
        ppgId,
        coordenadorTematicaId: base.coordenadorTematicaId,
      })
      .returning({ id: s.participacaoPpg.id });
    return { redeId: rede.id, tematicaId: tematica.id, id: participacao.id };
  };

  const COLUNAS = {
    ciclo: sql`r.ciclo_id`,
    ppg: sql`pp.ppg_id`,
    rede: sql`r.id`,
    tematica: sql`at.id`,
    participacao: sql`pp.id`,
  };

  it('o mesmo PPG em outro ciclo fica de fora', async () => {
    await criarParticipacao(base.ppgId, base.cicloId);
    await criarParticipacao(base.ppgId, outroCicloId);
    await conceder('plano:read', {
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    // O par PPG+ciclo e testado junto (AND). Guardar duas listas soltas faria
    // esta consulta devolver 2.
    expect(await contarParticipacoes(condicaoDoAlcance(alcance, COLUNAS))).toBe(
      1,
    );
  });

  it('duas concessoes da mesma acao somam na consulta (OR)', async () => {
    await criarParticipacao(base.ppgId, base.cicloId);
    const outra = await criarParticipacao(outroPpgId, outroCicloId);
    await conceder('plano:read', {
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });
    await conceder('plano:read', { tipo: 'REDE', redeId: outra.redeId });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    expect(await contarParticipacoes(condicaoDoAlcance(alcance, COLUNAS))).toBe(
      2,
    );
  });

  it('sem concessao, a consulta nao devolve linha alguma', async () => {
    await criarParticipacao(base.ppgId, base.cicloId);

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    expect(await contarParticipacoes(condicaoDoAlcance(alcance, COLUNAS))).toBe(
      0,
    );
  });

  it('GLOBAL nao recorta nada', async () => {
    await criarParticipacao(base.ppgId, base.cicloId);
    await criarParticipacao(outroPpgId, outroCicloId);
    await conceder('plano:read', { tipo: 'GLOBAL' });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    expect(await contarParticipacoes(condicaoDoAlcance(alcance, COLUNAS))).toBe(
      2,
    );
  });

  it('dimensao que a consulta nao expoe nao autoriza', async () => {
    const participacao = await criarParticipacao(base.ppgId, base.cicloId);
    await conceder('plano:read', {
      tipo: 'TEMATICA',
      tematicaId: participacao.tematicaId,
    });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    // Consulta sem coluna de temática: a concessao e ignorada, nunca
    // aproximada pelo PPG. Nega a mais, e a falta aparece como tela vazia.
    expect(
      await contarParticipacoes(
        condicaoDoAlcance(alcance, { ppg: sql`pp.ppg_id` }),
      ),
    ).toBe(0);
    expect(await contarParticipacoes(condicaoDoAlcance(alcance, COLUNAS))).toBe(
      1,
    );
  });

  it('concessao de PPG exige que a consulta exponha o ciclo', async () => {
    await criarParticipacao(base.ppgId, base.cicloId);
    await criarParticipacao(base.ppgId, outroCicloId);
    await conceder('plano:read', {
      tipo: 'PPG',
      ppgId: base.ppgId,
      cicloId: base.cicloId,
    });

    const alcance = (await acesso.resolver('sub-teste')).alcance('plano:read');

    // Sem a coluna de ciclo, aceitar so o PPG entregaria os dois ciclos. O
    // predicado prefere negar e obrigar a consulta a expor o ciclo.
    expect(
      await contarParticipacoes(
        condicaoDoAlcance(alcance, { ppg: sql`pp.ppg_id` }),
      ),
    ).toBe(0);
  });
});
