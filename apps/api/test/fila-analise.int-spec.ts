import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import { RecorteDeMissoes } from '../src/auth/escopo';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { DecisaoService } from '../src/dominio/decisao.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  filtroMissoesSchema,
  MissoesComiteService,
} from '../src/dominio/missoes-comite.service';
import { SubmissaoService } from '../src/dominio/submissao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarAcesso, criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-fila',
  name: 'Admin da Fila',
  roles: ['admin'],
  permissions: ['missao:read', 'missao:submit', 'missao:decide'],
};

/**
 * Servico de notificacao sem canal externo — o mesmo estado da aplicacao hoje.
 *
 * Os testes de dominio verificam a regra de negocio, e nao a notificacao, que
 * tem suite propria em `notificacoes.int-spec.ts`. Montar aqui com canal nulo e
 * o que faz esses testes continuarem falando so do que se propoem a testar.
 */
function semCanal(db: TestDatabase): NotificacoesService {
  return new NotificacoesService(db, new IdentidadeService(db), null);
}

/**
 * Fila de analise do Comite (CG-047).
 *
 * A fila e definida por `rodada_analise.encerrada_em is null` — a rodada
 * aberta. Nao por `status_aprovacao` sozinho: os dois andam juntos hoje, mas
 * quem responde "o que aguarda decisao" e a rodada, e e ela que carrega desde
 * quando.
 */
describe('Fila de analise do Comite (CG-047)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let missoes: MissoesComiteService;
  let submissao: SubmissaoService;
  let decisao: DecisaoService;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    const identidade = new IdentidadeService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    submissao = new SubmissaoService(ctx.db, identidade, semCanal(ctx.db));
    decisao = new DecisaoService(ctx.db, semCanal(ctx.db));
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    // A excecao ao "somente o responsavel" e concessao global, nao papel
    // do token (V1-059).
    await criarAcesso(ctx.db, { sub: admin.id, permissoes: admin.permissions });
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' })
      .returning({ id: s.pais.id });
    paisId = pais.id;
  });

  async function criarMissao(codigo: string) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar a fila de análise.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db.insert(s.missaoRede).values({
      missaoId: missao.id,
      redeId: base.redeId,
    });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'ARTICULACAO',
      titulo: 'Reunião institucional',
      paisId,
      dataInicio: '2027-05-02',
      dataFim: '2027-05-03',
    });
    return missao.id;
  }

  /**
   * A reuniao nao pode estar no futuro (CG-019), e uma constante no fonte
   * envelhece: `2027-04-20` era passado quando escrito e vira futuro logo.
   */
  function ontem(): string {
    const data = new Date();
    data.setUTCDate(data.getUTCDate() - 1);
    return data.toISOString().slice(0, 10);
  }

  const listar = (filtro: Record<string, unknown> = {}) =>
    missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse(filtro),
      RecorteDeMissoes.irrestrito(),
    );

  const codigos = async (filtro: Record<string, unknown> = {}) =>
    (await listar(filtro)).itens.map((item) => item.codigo).sort();

  // -------------------------------------------------------------------------

  it('so entra na fila a missao com rodada aberta', async () => {
    const enviada = await criarMissao('MCG-001');
    await criarMissao('MCG-002');
    await submissao.submeter(base.cicloId, enviada, admin);

    expect(await codigos({ statusAprovacao: 'EM_ANALISE' })).toEqual([
      'MCG-001',
    ]);

    const fila = await listar({ statusAprovacao: 'EM_ANALISE' });
    expect(fila.itens[0].rodadaAberta).toMatchObject({
      numero: 1,
      submetidoPor: 'Admin da Fila',
      diasEsperando: 0,
    });

    // A que nunca foi enviada nao tem rodada nenhuma.
    const todas = await listar();
    expect(
      todas.itens.find((i) => i.codigo === 'MCG-002')?.rodadaAberta,
    ).toBeNull();
  });

  it('a decisao tira a missao da fila e zera a rodada aberta', async () => {
    const missaoId = await criarMissao('MCG-003');
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Projeto coerente com o plano da rede.',
        reuniaoData: ontem(),
      } as never,
      admin,
    );

    // `encerrada_em` deixa de ser nulo: a rodada decidida nao aguarda nada, e
    // continuar mostrando a missao faria o Comite decidir duas vezes.
    expect(await codigos({ statusAprovacao: 'EM_ANALISE' })).toEqual([]);
    const todas = await listar();
    expect(todas.itens[0].rodadaAberta).toBeNull();
    expect(todas.itens[0].statusAprovacao).toBe('APROVADA');
  });

  it('reenvio depois de ajustes abre a rodada 2, e o filtro separa as duas', async () => {
    const primeira = await criarMissao('MCG-004');
    const segunda = await criarMissao('MCG-005');
    await submissao.submeter(base.cicloId, primeira, admin);
    await submissao.submeter(base.cicloId, segunda, admin);

    await decisao.decidir(
      base.cicloId,
      segunda,
      {
        acao: 'SOLICITAR_AJUSTES',
        parecer: 'Faltou detalhar o orçamento.',
      } as never,
      admin,
    );
    await submissao.submeter(base.cicloId, segunda, admin);

    // "Analise" e "reanalise" nao sao estados distintos: sao o numero da
    // rodada aberta. Guardar um enum a mais duplicaria o que a rodada ja diz.
    expect(await codigos({ rodada: 1 })).toEqual(['MCG-004']);
    expect(await codigos({ rodada: 2 })).toEqual(['MCG-005']);
    expect(await codigos({ statusAprovacao: 'EM_ANALISE' })).toEqual([
      'MCG-004',
      'MCG-005',
    ]);
  });

  it('o filtro de rodada ignora a rodada ja encerrada', async () => {
    const missaoId = await criarMissao('MCG-006');
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Ajustar o roteiro.' } as never,
      admin,
    );

    // A rodada 1 existe e esta encerrada; a missao aguarda quem a reenvie, nao
    // o Comite. `exists` sobre a encerrada traria a missao de volta a fila.
    expect(await codigos({ rodada: 1 })).toEqual([]);
    expect(await codigos({ statusAprovacao: 'AJUSTES_SOLICITADOS' })).toEqual([
      'MCG-006',
    ]);
  });

  it('conta os dias em dias civis, nao em periodos de 24 horas', async () => {
    const missaoId = await criarMissao('MCG-007');
    await submissao.submeter(base.cicloId, missaoId, admin);

    // Envio de ontem as 23h espera "1 dia", nao "0": quem olha a fila pensa em
    // dias do calendario, e arredondar por hora faria o numero mudar sozinho ao
    // longo do dia.
    const ontem = new Date();
    ontem.setUTCDate(ontem.getUTCDate() - 1);
    await ctx.db.update(s.rodadaAnalise).set({ submetidoEm: ontem });

    const fila = await listar({ statusAprovacao: 'EM_ANALISE' });
    expect(fila.itens[0].rodadaAberta?.diasEsperando).toBeGreaterThanOrEqual(1);
  });

  it('a juncao com a rodada nao duplica linha nem total', async () => {
    // `rodada_analise_aberta_uk` garante uma aberta por missao, mas a missao
    // acumula rodadas encerradas — e o `left join` precisa continuar trazendo
    // uma linha so, senao `count(*) over ()` mente sobre o total da pagina.
    const missaoId = await criarMissao('MCG-008');
    for (const parecer of ['Primeira volta.', 'Segunda volta.']) {
      await submissao.submeter(base.cicloId, missaoId, admin);
      await decisao.decidir(
        base.cicloId,
        missaoId,
        { acao: 'SOLICITAR_AJUSTES', parecer } as never,
        admin,
      );
    }
    await submissao.submeter(base.cicloId, missaoId, admin);

    const pagina = await listar();
    expect(pagina.itens).toHaveLength(1);
    expect(pagina.total).toBe(1);
    expect(pagina.itens[0].rodadaAberta?.numero).toBe(3);
  });

  it('a fila combina com os filtros que ja existiam', async () => {
    const daRede = await criarMissao('MCG-009');
    await submissao.submeter(base.cicloId, daRede, admin);

    // Rede, pais e periodo nao foram reimplementados para a fila: ela e o mesmo
    // servico com mais um recorte, e duplicar a superficie de filtro criaria
    // duas listas que divergem na primeira mudanca.
    expect(
      await codigos({ statusAprovacao: 'EM_ANALISE', redeId: base.redeId }),
    ).toEqual(['MCG-009']);
    expect(await codigos({ statusAprovacao: 'EM_ANALISE', paisId })).toEqual([
      'MCG-009',
    ]);
    expect(await codigos({ statusAprovacao: 'EM_ANALISE', ano: 2028 })).toEqual(
      [],
    );
  });
});
