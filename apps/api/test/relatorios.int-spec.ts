import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { RecorteDeMissoes } from '../src/auth/escopo';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  filtroMissoesSchema,
  MissoesComiteService,
} from '../src/dominio/missoes-comite.service';
import { ExecucaoComiteService } from '../src/dominio/execucao-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import {
  filtroRelatorioSchema,
  RelatoriosService,
} from '../src/dominio/relatorios.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-relatorios',
  name: 'Admin dos Relatórios',
  roles: ['admin'],
  permissions: [
    'prestacao:read',
    'prestacao:create',
    'prestacao:edit',
    'prestacao:delete',
    'prestacao:submit',
    'prestacao:review',
  ],
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
 * Relatorios estrategicos (CG-068).
 *
 * O criterio de aceite e uma igualdade: **o total do relatorio reproduz a
 * consulta de origem para o mesmo filtro**. Quase todo caso aqui compara os
 * dois lados em vez de fixar um numero — um numero fixo passaria a valer
 * sozinho no dia em que a lista mudasse, e a divergencia e justamente o que
 * este teste existe para pegar.
 */
describe('Relatorios estrategicos (CG-068)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let relatorios: RelatoriosService;
  let missoes: MissoesComiteService;
  let prestacao: PrestacaoService;
  let execucao: ExecucaoComiteService;
  let paisId: string;
  let outroPaisId: string;
  let parceiraId: string;
  let outraRedeId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    relatorios = new RelatoriosService(ctx.db, missoes);
    prestacao = new PrestacaoService(ctx.db, semCanal(ctx.db));
    execucao = new ExecucaoComiteService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const paises = await ctx.db
      .insert(s.pais)
      .values([
        { codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' },
        { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'França' },
      ])
      .returning({ id: s.pais.id });
    paisId = paises[0].id;
    outroPaisId = paises[1].id;

    const [parceira] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidade do Porto',
        nomeNormalizado: normalizarNomeInstituicao('Universidade do Porto'),
        sigla: 'UP',
        tipo: 'PARCEIRA_INTERNACIONAL',
        paisId,
        cidade: 'Porto',
      })
      .returning({ id: s.instituicao.id });
    parceiraId = parceira.id;

    const [segunda] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-DOIS',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.redeCoordenadora.id });
    outraRedeId = segunda.id;
  });

  async function criarMissao(
    codigo: string,
    opcoes: {
      periodo?: [string, string];
      redes?: string[];
      pais?: string;
      instituicaoId?: string | null;
      instituicaoNome?: string;
      evento?: string;
      status?: 'RASCUNHO' | 'PLANEJADA' | 'CONFIRMADA' | 'CANCELADA';
    } = {},
  ) {
    const periodo = opcoes.periodo ?? ['2027-05-01', '2027-05-10'];
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar os relatórios.',
        dataInicio: periodo[0],
        dataFim: periodo[1],
        ...(opcoes.status ? { status: opcoes.status } : {}),
      })
      .returning({ id: s.missaoComite.id });

    for (const redeId of opcoes.redes ?? [base.redeId]) {
      await ctx.db.insert(s.missaoRede).values({ missaoId: missao.id, redeId });
    }
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'ARTICULACAO',
      titulo: 'Reunião institucional',
      paisId: opcoes.pais ?? paisId,
      instituicaoId: opcoes.instituicaoId ?? null,
      instituicaoNome: opcoes.instituicaoNome ?? null,
      eventoNome: opcoes.evento ?? null,
      dataInicio: periodo[0],
      dataFim: periodo[1],
    });
    return missao.id;
  }

  const irrestrito = () => RecorteDeMissoes.irrestrito();

  const relatorioMissoes = (filtro: Record<string, unknown> = {}) =>
    relatorios.missoesDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse(filtro),
      irrestrito(),
    );

  const listar = (filtro: Record<string, unknown> = {}) =>
    missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse(filtro),
      irrestrito(),
    );

  async function despesa(missaoId: string, valor: string, exercicio = 2027) {
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio,
        valorTotal: valor,
        descricao: 'Inscrição',
      } as never,
      admin,
    );
  }

  // --- o criterio de aceite --------------------------------------------------

  it('o total do relatorio e o total da lista, para o mesmo filtro', async () => {
    await criarMissao('MCG-001', { pais: paisId });
    await criarMissao('MCG-002', { pais: outroPaisId });
    await criarMissao('MCG-003', {
      pais: paisId,
      periodo: ['2028-05-01', '2028-05-10'],
    });

    // Comparacao entre os dois lados, e nao um numero fixo: um numero fixo
    // passaria a valer sozinho no dia em que a lista mudasse, e a divergencia e
    // justamente o que este teste existe para pegar.
    for (const filtro of [
      {},
      { paisId },
      { ano: 2027 },
      { ano: 2028 },
      { busca: 'MCG-00' },
      { redeId: base.redeId },
    ]) {
      const relatorio = await relatorioMissoes(filtro);
      const pagina = await listar(filtro);
      expect(relatorio.totais.missoes).toBe(pagina.total);
      expect(relatorio.linhas.map((l) => l.codigo).sort()).toEqual(
        pagina.itens.map((i) => i.codigo).sort(),
      );
    }
  });

  it('filtro de situacao tambem reproduz a lista', async () => {
    await criarMissao('MCG-010', { status: 'CONFIRMADA' });
    await criarMissao('MCG-011', { status: 'CANCELADA' });

    // Status e situacao entram no recorte do relatorio, ao contrario do resumo
    // da lista, que conta **por** eles.
    for (const filtro of [
      { status: 'CONFIRMADA' },
      { status: 'CANCELADA' },
      { situacaoPrestacao: 'NAO_INICIADA' },
    ]) {
      const relatorio = await relatorioMissoes(filtro);
      expect(relatorio.totais.missoes).toBe((await listar(filtro)).total);
    }
  });

  it('os quatro relatorios partem da mesma base de missoes', async () => {
    await criarMissao('MCG-020', { pais: paisId, instituicaoId: parceiraId });
    await criarMissao('MCG-021', { pais: outroPaisId });

    // "Parceiros do relatorio" tem que ser "parceiros das missoes que a lista
    // mostra". Se cada relatorio montasse o proprio recorte, os cabecalhos
    // divergiriam — e essa e a primeira coisa que um leitor compara.
    const filtro = { paisId };
    const total = (await listar(filtro)).total;
    const parse = filtroRelatorioSchema.parse(filtro);

    expect(
      (await relatorios.missoesDoRecorte(base.cicloId, parse, irrestrito()))
        .cabecalho.missoes,
    ).toBe(total);
    expect(
      (await relatorios.parceirosDoRecorte(base.cicloId, parse, irrestrito()))
        .cabecalho.missoes,
    ).toBe(total);
    expect(
      (await relatorios.financasDoRecorte(base.cicloId, parse, irrestrito()))
        .cabecalho.missoes,
    ).toBe(total);
    expect(
      (await relatorios.resultadosDoRecorte(base.cicloId, parse, irrestrito()))
        .cabecalho.missoes,
    ).toBe(total);
  });

  // --- filtros novos ---------------------------------------------------------

  it('filtra por instituicao pelo cadastro, e nao pelo nome digitado', async () => {
    await criarMissao('MCG-030', { instituicaoId: parceiraId });
    await criarMissao('MCG-031', { instituicaoNome: 'Universidade do Porto' });

    // Casar por texto traria tambem a parada do homonimo digitado a mao, que
    // nao aponta para cadastro nenhum.
    const relatorio = await relatorioMissoes({ instituicaoId: parceiraId });
    expect(relatorio.linhas.map((l) => l.codigo)).toEqual(['MCG-030']);
    expect(relatorio.totais.missoes).toBe(
      (await listar({ instituicaoId: parceiraId })).total,
    );
  });

  it('filtra por evento por correspondencia parcial no nome', async () => {
    await criarMissao('MCG-040', {
      evento: 'Congresso de Internacionalização',
    });
    await criarMissao('MCG-041', { evento: 'Feira de Ciências' });

    // Texto, e nao id: evento ainda nao e cadastro (D-10 deixou para a F2).
    const relatorio = await relatorioMissoes({ evento: 'congresso' });
    expect(relatorio.linhas.map((l) => l.codigo)).toEqual(['MCG-040']);
  });

  // --- parceiros -------------------------------------------------------------

  it('parceiro visitado em duas paradas da mesma missao conta uma missao', async () => {
    const missaoId = await criarMissao('MCG-050', {
      instituicaoId: parceiraId,
    });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 2,
      tipo: 'ARTICULACAO',
      titulo: 'Segunda reunião no mesmo parceiro',
      paisId,
      instituicaoId: parceiraId,
      dataInicio: '2027-05-05',
      dataFim: '2027-05-06',
    });

    const relatorio = await relatorios.parceirosDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    expect(relatorio.linhas).toHaveLength(1);
    // Duas paradas, uma missao: sao perguntas diferentes e as duas colunas
    // existem por isso.
    expect(relatorio.linhas[0]).toMatchObject({ missoes: 1, atividades: 2 });
    expect(relatorio.totais.parceiros).toBe(1);
  });

  it('instituicao digitada a mao nao vira parceiro, mas nao some do relatorio', async () => {
    await criarMissao('MCG-060', { instituicaoId: parceiraId });
    await criarMissao('MCG-061', {
      instituicaoNome: 'Instituto que ninguém cadastrou',
    });

    const relatorio = await relatorios.parceirosDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    // Conta-la como parceiro inflaria o indicador com algo que ninguem abre;
    // escondê-la faria o numero parecer completo. Por isso ela sai numa
    // contagem propria.
    expect(relatorio.totais.parceiros).toBe(1);
    expect(relatorio.totais.semCadastro).toBe(1);
    expect(relatorio.linhas.map((l) => l.nome)).toEqual([
      'Universidade do Porto',
    ]);
  });

  // --- financas --------------------------------------------------------------

  it('separa os quatro estados da prestacao, e so a validada abate', async () => {
    const um = await criarMissao('MCG-070');
    const outro = await criarMissao('MCG-071');
    await despesa(um, '1000.00');
    await despesa(outro, '2500.00');
    await prestacao.enviar(base.cicloId, outro, admin);
    await prestacao.validar(base.cicloId, outro, {}, admin);

    const relatorio = await relatorios.financasDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    expect(relatorio.totais.emPreenchimento).toBe('1000.00');
    expect(relatorio.totais.validado).toBe('2500.00');
    expect(relatorio.totais.total).toBe('3500.00');
    // Nao lancado e nulo, nunca R$ 0,00 — a interface escreve "A definir".
    expect(relatorio.totais.comPendencia).toBeNull();
  });

  it('a despesa agrupa pelo exercicio do lancamento, nao pelas datas da missao', async () => {
    // Viagem de dezembro de 2027 imputada ao exercicio de 2028: e o lancamento
    // que diz a que ano o dinheiro pertence (mesmo criterio da CG-055).
    const missaoId = await criarMissao('MCG-080', {
      periodo: ['2027-12-20', '2027-12-27'],
    });
    await despesa(missaoId, '4000.00', 2028);

    const relatorio = await relatorios.financasDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    expect(relatorio.linhas.map((l) => l.exercicio)).toEqual([2028]);
  });

  it('o filtro do relatorio financeiro recorta as missoes, e nao as despesas', async () => {
    const daRede = await criarMissao('MCG-090', { redes: [base.redeId] });
    const daOutra = await criarMissao('MCG-091', { redes: [outraRedeId] });
    await despesa(daRede, '1000.00');
    await despesa(daOutra, '9000.00');

    const so = await relatorios.financasDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({ redeId: base.redeId }),
      irrestrito(),
    );
    expect(so.totais.total).toBe('1000.00');
    expect(so.cabecalho.missoes).toBe(1);
  });

  it('o validado do relatorio e o validado da execucao orcamentaria', async () => {
    // Duas apuracoes independentes sobre o mesmo fato: o relatorio agrupa por
    // exercicio e tipo, a execucao agrupa por exercicio contra o aporte. Se
    // divergirem, uma das duas esta errada — e sem esta comparacao ninguem
    // descobriria, porque cada tela mostra so o proprio numero.
    const um = await criarMissao('MCG-092');
    const outro = await criarMissao('MCG-093');
    await despesa(um, '1200.00');
    await despesa(outro, '800.00');
    for (const missaoId of [um, outro]) {
      await prestacao.enviar(base.cicloId, missaoId, admin);
      await prestacao.validar(base.cicloId, missaoId, {}, admin);
    }

    const relatorio = await relatorios.financasDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    const orcamentaria = await execucao.porExercicio(base.cicloId);

    expect(relatorio.totais.validado).toBe('2000.00');
    expect(orcamentaria.total.validado).toBe(relatorio.totais.validado);
  });

  // --- resultados ------------------------------------------------------------

  it('distingue "nao gerou produto" de "ninguem respondeu"', async () => {
    const comProduto = await criarMissao('MCG-100');
    const declarada = await criarMissao('MCG-101');
    await criarMissao('MCG-102');

    await ctx.db.insert(s.produtoMissao).values({
      missaoId: comProduto,
      tipo: 'PUBLICACAO',
      titulo: 'Artigo conjunto',
    });
    await ctx.db
      .update(s.missaoComite)
      .set({
        semProdutoDeclaradoEm: new Date(),
        semProdutoDeclaradoPor: 'Admin',
        semProdutoJustificativa: 'A missão foi de articulação inicial.',
      })
      .where(eq(s.missaoComite.id, declarada));

    const relatorio = await relatorios.resultadosDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    expect(relatorio.totais.produtos).toBe(1);
    // Zero produto significa tanto "nao gerou" quanto "ninguem respondeu", e so
    // a segunda e pendencia (CG-056).
    expect(relatorio.totais.semProdutoDeclarado).toBe(1);
    expect(relatorio.totais.semResposta).toBe(1);
  });

  it('agrupa produtos por tipo e situacao, contando missoes distintas', async () => {
    const missaoId = await criarMissao('MCG-110');
    for (const titulo of ['Artigo A', 'Artigo B']) {
      await ctx.db.insert(s.produtoMissao).values({
        missaoId,
        tipo: 'PUBLICACAO',
        titulo,
        situacao: 'CONCLUIDO',
      });
    }

    const relatorio = await relatorios.resultadosDoRecorte(
      base.cicloId,
      filtroRelatorioSchema.parse({}),
      irrestrito(),
    );
    // Dois produtos, uma missao: a coluna de missoes responde "quantas viagens
    // renderam isto", que e outra pergunta.
    expect(relatorio.produtos).toEqual([
      { tipo: 'PUBLICACAO', situacao: 'CONCLUIDO', quantidade: 2, missoes: 1 },
    ]);
  });

  it('relatorio de ciclo vazio nao inventa numero', async () => {
    const filtro = filtroRelatorioSchema.parse({});
    const financas = await relatorios.financasDoRecorte(
      base.cicloId,
      filtro,
      irrestrito(),
    );
    expect(financas.linhas).toEqual([]);
    expect(financas.totais.validado).toBeNull();
    expect(financas.totais.total).toBeNull();

    const parceiros = await relatorios.parceirosDoRecorte(
      base.cicloId,
      filtro,
      irrestrito(),
    );
    expect(parceiros.linhas).toEqual([]);
    expect(parceiros.totais).toEqual({
      parceiros: 0,
      semCadastro: 0,
      convenios: 0,
    });
  });
});
