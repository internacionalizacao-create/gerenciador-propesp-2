import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import { ExecucaoComiteService } from '../src/dominio/execucao-comite.service';
import {
  filtroMissoesSchema,
  MissoesComiteService,
} from '../src/dominio/missoes-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-execucao',
  name: 'Admin da Execução',
  roles: ['admin'],
  permissions: ['prestacao:read', 'prestacao:write', 'prestacao:review'],
};

/**
 * Execucao orcamentaria do Comite Gestor (CG-055).
 *
 * O criterio de aceite e negativo — **valores nao validados nunca reduzem o
 * saldo oficial** —, entao o que se testa aqui e sobretudo o que *nao* deve
 * acontecer: o saldo tem que ficar parado enquanto a prestacao passa por
 * preenchimento, envio e devolucao, e so se mover na validacao.
 */
describe('Execucao orcamentaria do Comite Gestor (CG-055)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let execucao: ExecucaoComiteService;
  let prestacao: PrestacaoService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    execucao = new ExecucaoComiteService(ctx.db);
    prestacao = new PrestacaoService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    await ctx.db.insert(s.orcamentoComiteGestor).values([
      {
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        ano: 2027,
        valorAnual: '10000.00',
      },
      {
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        ano: 2028,
        valorAnual: '20000.00',
      },
    ]);
  });

  /** Missao com prestacao aberta e uma despesa no exercicio indicado. */
  async function missaoComDespesa(
    codigo: string,
    exercicio: number,
    valor: string,
    periodo: [string, string] = [`${exercicio}-05-01`, `${exercicio}-05-10`],
  ) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar a execução orçamentária',
        dataInicio: periodo[0],
        dataFim: periodo[1],
      })
      .returning({ id: s.missaoComite.id });

    await prestacao.criar(base.cicloId, missao.id, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missao.id,
      {
        tipo: 'OUTRA',
        exercicio,
        valorTotal: valor,
        descricao: 'Inscrição em evento',
      } as never,
      admin,
    );
    return missao.id;
  }

  const de = (dados: Awaited<ReturnType<typeof anos>>, ano: number) =>
    dados.find((linha) => linha.ano === ano)!;

  const anos = async () =>
    (await execucao.porExercicio(base.cicloId)).exercicios;

  // -------------------------------------------------------------------------

  it('lista todo exercicio com aporte, mesmo sem missao nenhuma', async () => {
    const linhas = await anos();

    expect(linhas.map((l) => l.ano)).toEqual([2027, 2028]);
    // Sem lancamento os valores sao **nulos**, nao R$ 0,00: a interface escreve
    // "A definir", e nao um gasto zerado que ninguem apurou.
    expect(de(linhas, 2027).validado).toBeNull();
    expect(de(linhas, 2027).naoValidado).toBeNull();
    // O saldo, esse sim, existe: o aporte inteiro esta disponivel.
    expect(de(linhas, 2027).saldoOficial).toBe('10000.00');
  });

  it('valor em preenchimento nao reduz o saldo oficial', async () => {
    await missaoComDespesa('MCG-101', 2027, '3000.00');
    const linha = de(await anos(), 2027);

    expect(linha.emPreenchimento).toBe('3000.00');
    expect(linha.validado).toBeNull();
    expect(linha.saldoOficial).toBe('10000.00');
  });

  it('valor enviado continua sem reduzir o saldo oficial', async () => {
    const missaoId = await missaoComDespesa('MCG-102', 2027, '3000.00');
    await prestacao.enviar(base.cicloId, missaoId, admin);
    const linha = de(await anos(), 2027);

    // O revisor ja tem o que analisar, mas nada foi executado ainda.
    expect(linha.enviado).toBe('3000.00');
    expect(linha.emPreenchimento).toBeNull();
    expect(linha.saldoOficial).toBe('10000.00');
  });

  it('devolucao devolve o valor a coluna de pendencia, e o saldo nao se move', async () => {
    const missaoId = await missaoComDespesa('MCG-103', 2027, '3000.00');
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante.' },
      admin,
    );
    const linha = de(await anos(), 2027);

    expect(linha.comPendencia).toBe('3000.00');
    expect(linha.enviado).toBeNull();
    expect(linha.saldoOficial).toBe('10000.00');
    expect(linha.prestacoesPendentes).toBe(1);
  });

  it('somente a validacao abate o aporte', async () => {
    const missaoId = await missaoComDespesa('MCG-104', 2027, '3000.00');
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);
    const linha = de(await anos(), 2027);

    expect(linha.validado).toBe('3000.00');
    expect(linha.naoValidado).toBeNull();
    expect(linha.saldoOficial).toBe('7000.00');
    expect(linha.prestacoesPendentes).toBe(0);
  });

  it('cada exercicio abate o proprio aporte, e nao o do vizinho', async () => {
    const um = await missaoComDespesa('MCG-105', 2027, '3000.00');
    const outro = await missaoComDespesa('MCG-106', 2028, '5000.00');
    await prestacao.enviar(base.cicloId, um, admin);
    await prestacao.validar(base.cicloId, um, {}, admin);
    await prestacao.enviar(base.cicloId, outro, admin);
    await prestacao.validar(base.cicloId, outro, {}, admin);

    const linhas = await anos();
    expect(de(linhas, 2027).saldoOficial).toBe('7000.00');
    expect(de(linhas, 2028).saldoOficial).toBe('15000.00');
  });

  it('a imputacao segue o exercicio da despesa, nao as datas da missao', async () => {
    // Viagem de dezembro de 2027 lancada no exercicio de 2028: e o lancamento
    // que diz a que ano o dinheiro pertence.
    const missaoId = await missaoComDespesa('MCG-107', 2028, '4000.00', [
      '2027-12-20',
      '2027-12-27',
    ]);
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const linhas = await anos();
    expect(de(linhas, 2027).validado).toBeNull();
    expect(de(linhas, 2028).validado).toBe('4000.00');
    // A contagem de missoes, ao contrario, segue as datas — e o mesmo criterio
    // do filtro `?ano=` da lista.
    expect(de(linhas, 2027).missoes).toBe(1);
    expect(de(linhas, 2028).missoes).toBe(0);
  });

  it('exercicio sem aporte aparece quando ha despesa nele', async () => {
    // Restringir a tabela aos anos do orcamento faria esse gasto sumir da tela.
    const missaoId = await missaoComDespesa('MCG-108', 2029, '1500.00');
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const linha = de(await anos(), 2029);
    expect(linha.orcamento).toBeNull();
    // Negativo de proposito: houve execucao oficial contra orcamento
    // inexistente, e um nulo aqui transformaria estouro em falta de informacao.
    expect(linha.saldoOficial).toBe('-1500.00');
  });

  it('missao que atravessa dois exercicios conta uma vez no total', async () => {
    await missaoComDespesa('MCG-109', 2027, '1000.00', [
      '2027-12-28',
      '2028-01-05',
    ]);

    const dados = await execucao.porExercicio(base.cicloId);
    expect(de(dados.exercicios, 2027).missoes).toBe(1);
    expect(de(dados.exercicios, 2028).missoes).toBe(1);
    // Somar as colunas daria 2. O consolidado conta a missao, nao a linha.
    expect(dados.total.missoes).toBe(1);
    expect(dados.total.prestacoesPendentes).toBe(1);
  });

  it('o consolidado soma o dinheiro e o orcamento do ciclo inteiro', async () => {
    const um = await missaoComDespesa('MCG-110', 2027, '3000.00');
    await missaoComDespesa('MCG-111', 2028, '5000.00');
    await prestacao.enviar(base.cicloId, um, admin);
    await prestacao.validar(base.cicloId, um, {}, admin);

    const dados = await execucao.porExercicio(base.cicloId);
    expect(dados.total.orcamento).toBe('30000.00');
    expect(dados.total.validado).toBe('3000.00');
    expect(dados.total.emPreenchimento).toBe('5000.00');
    expect(dados.total.saldoOficial).toBe('27000.00');
  });

  it('nao enxerga a execucao de outro ciclo', async () => {
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });

    const missaoId = await missaoComDespesa('MCG-112', 2027, '3000.00');
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const dados = await execucao.porExercicio(outro.id);
    expect(dados.exercicios).toEqual([]);
    expect(dados.total.validado).toBeNull();
    expect(dados.total.missoes).toBe(0);
  });
});

/**
 * Situacao e valor da prestacao na lista de missoes (CG-055).
 *
 * Ate aqui a lista devolvia `'NAO_INICIADA'::text` fixo e `valor_prestado`
 * nulo, o que fazia toda missao parecer sem prestacao — inclusive as validadas.
 * O filtro por situacao ja existia e "funcionava" contra a constante: nenhum
 * teste podia pega-lo porque nunca havia prestacao para contradizer.
 */
describe('Prestacao na lista de missoes (CG-055)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let missoes: MissoesComiteService;
  let prestacao: PrestacaoService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    missoes = new MissoesComiteService(ctx.db);
    prestacao = new PrestacaoService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

  async function criarMissao(codigo: string) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar a lista',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
      })
      .returning({ id: s.missaoComite.id });
    return missao.id;
  }

  const listar = (filtro: Record<string, unknown> = {}) =>
    missoes.listar(base.cicloId, filtroMissoesSchema.parse(filtro));

  it('mostra o estado real da prestacao, e nao NAO_INICIADA fixo', async () => {
    const comPrestacao = await criarMissao('MCG-201');
    await criarMissao('MCG-202');
    await prestacao.criar(base.cicloId, comPrestacao, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      comPrestacao,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '2500.00',
        descricao: 'Inscrição',
      } as never,
      admin,
    );
    await prestacao.enviar(base.cicloId, comPrestacao, admin);

    const pagina = await listar();
    const iniciada = pagina.itens.find((i) => i.codigo === 'MCG-201')!;
    const vazia = pagina.itens.find((i) => i.codigo === 'MCG-202')!;

    expect(iniciada.situacaoPrestacao).toBe('ENVIADA');
    expect(iniciada.valorPrestado).toBe('2500.00');
    // Ausencia da linha continua sendo `NAO_INICIADA` e valor nulo — nunca
    // R$ 0,00, que seria "lancaram e deu zero".
    expect(vazia.situacaoPrestacao).toBe('NAO_INICIADA');
    expect(vazia.valorPrestado).toBeNull();
  });

  it('o filtro por situacao da prestacao separa de verdade', async () => {
    const comPrestacao = await criarMissao('MCG-203');
    await criarMissao('MCG-204');
    await prestacao.criar(base.cicloId, comPrestacao, admin);

    expect(
      (await listar({ situacaoPrestacao: 'EM_PREENCHIMENTO' })).itens.map(
        (i) => i.codigo,
      ),
    ).toEqual(['MCG-203']);
    expect(
      (await listar({ situacaoPrestacao: 'NAO_INICIADA' })).itens.map(
        (i) => i.codigo,
      ),
    ).toEqual(['MCG-204']);
  });

  it('a juncao com a prestacao nao duplica linha nem total', async () => {
    // `prestacao_missao_uk` garante uma prestacao por missao; se algum dia o
    // `left join` virar juncao com despesa, `count(*) over ()` mente aqui.
    const missaoId = await criarMissao('MCG-205');
    await prestacao.criar(base.cicloId, missaoId, admin);
    for (const valor of ['100.00', '200.00', '300.00']) {
      await prestacao.criarDespesa(
        base.cicloId,
        missaoId,
        {
          tipo: 'OUTRA',
          exercicio: 2027,
          valorTotal: valor,
          descricao: `Despesa de ${valor}`,
        } as never,
        admin,
      );
    }

    const pagina = await listar();
    expect(pagina.itens).toHaveLength(1);
    expect(pagina.total).toBe(1);
    expect(pagina.itens[0].valorPrestado).toBe('600.00');
  });

  it('a ordenacao por status continua resolvendo a coluna da missao', async () => {
    // `prestacao_contas_missao` tambem tem `status`. O `order by status` nao
    // ficou ambiguo porque casa com o alias de saida, que e o da missao — mas o
    // dia em que alguem selecionar `pr.status` com esse nome, isto quebra em
    // silencio, ordenando a lista pelo estado errado.
    const comPrestacao = await criarMissao('MCG-207');
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CANCELADA' })
      .where(eq(s.missaoComite.id, comPrestacao));
    await prestacao.criar(base.cicloId, comPrestacao, admin);
    await criarMissao('MCG-208');

    // Enum do Postgres ordena pela ordem de declaracao, nao alfabeticamente:
    // `RASCUNHO` vem antes de `CANCELADA` em `status_missao_comite`.
    const pagina = await listar({ ordenar: 'STATUS', direcao: 'ASC' });
    expect(pagina.itens.map((i) => i.status)).toEqual([
      'RASCUNHO',
      'CANCELADA',
    ]);
  });

  it('o detalhe carrega estado e totais da prestacao', async () => {
    const missaoId = await criarMissao('MCG-206');
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'PASSAGEM',
        exercicio: 2027,
        valorTotal: '4200.00',
        descricao: 'Passagem internacional',
      } as never,
      admin,
    );
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '800.00',
        descricao: 'Inscrição',
      } as never,
      admin,
    );

    const detalhe = await missoes.detalhe(base.cicloId, missaoId);
    expect(detalhe.situacaoPrestacao).toBe('EM_PREENCHIMENTO');
    expect(detalhe.totais.passagens).toBe('4200.00');
    // Sete tipos de despesa existem (CG-009): `geral` e o total de todos, e nao
    // a soma de passagens com diarias.
    expect(detalhe.totais.diarias).toBeNull();
    expect(detalhe.totais.geral).toBe('5000.00');
    expect(detalhe.totais.porExercicio).toEqual([
      { ano: 2027, passagens: '4200.00', diarias: '0.00' },
    ]);
  });
});
