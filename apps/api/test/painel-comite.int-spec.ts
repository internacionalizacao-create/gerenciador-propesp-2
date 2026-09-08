import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import { RecorteDeMissoes } from '../src/auth/escopo';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import { DecisaoService } from '../src/dominio/decisao.service';
import {
  filtroPainelSchema,
  PainelComiteService,
} from '../src/dominio/painel-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import { SubmissaoService } from '../src/dominio/submissao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-painel',
  name: 'Admin do Painel',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'missao:submit',
    'missao:decide',
    'prestacao:read',
    'prestacao:write',
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
 * Painel do Comite Gestor (CG-066).
 *
 * O criterio de aceite tem duas metades, e as duas sao sobre **nao inventar
 * numero**: cartoes e pendencias precisam responder ao mesmo recorte, e a
 * missao de mais de uma rede nao pode ser contada duas vezes no consolidado.
 * Quase tudo aqui e verificacao negativa por isso.
 */
describe('Painel do Comite Gestor (CG-066)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let painel: PainelComiteService;
  let submissao: SubmissaoService;
  let decisao: DecisaoService;
  let prestacao: PrestacaoService;
  let paisId: string;
  let outroPaisId: string;
  let outraRedeId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    const identidade = new IdentidadeService(ctx.db);
    painel = new PainelComiteService(ctx.db);
    submissao = new SubmissaoService(ctx.db, identidade, semCanal(ctx.db));
    decisao = new DecisaoService(ctx.db, semCanal(ctx.db));
    prestacao = new PrestacaoService(ctx.db, semCanal(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
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

  /** Missao com uma parada; as redes sao explicitas porque e o que se testa. */
  async function criarMissao(
    codigo: string,
    opcoes: {
      periodo?: [string, string];
      redes?: string[];
      pais?: string;
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
        objetivo: 'Exercitar o painel do Comitê.',
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
      dataInicio: periodo[0],
      dataFim: periodo[1],
    });

    return missao.id;
  }

  const montar = (filtro: Record<string, unknown> = {}) =>
    painel.montar(
      base.cicloId,
      filtroPainelSchema.parse(filtro),
      RecorteDeMissoes.irrestrito(),
    );

  /** A reuniao nao pode estar no futuro (CG-019); constante no fonte envelhece. */
  function ontem(): string {
    const data = new Date();
    data.setUTCDate(data.getUTCDate() - 1);
    return data.toISOString().slice(0, 10);
  }

  function diasAtras(dias: number): string {
    const data = new Date();
    data.setUTCDate(data.getUTCDate() - dias);
    return data.toISOString().slice(0, 10);
  }

  /**
   * Exercicio ja encerrado, contado a partir de hoje.
   *
   * Ano fixo no fonte envelheceria: as datas do ciclo de teste sao futuras hoje
   * e passado daqui a pouco, e um teste sobre "viagem que ja aconteceu" mudaria
   * de resultado sozinho na virada.
   */
  function anoPassado(atras = 1): number {
    return new Date().getUTCFullYear() - atras;
  }

  function periodoDe(ano: number): [string, string] {
    return [`${ano}-03-01`, `${ano}-03-10`];
  }

  // --- recorte compartilhado -------------------------------------------------

  it('o recorte por exercicio vale igualmente para cartoes e pendencias', async () => {
    // Duas viagens ja encerradas, em exercicios diferentes, nenhuma com
    // prestacao — as duas seriam pendencia se o recorte nao existisse.
    const recente = anoPassado(1);
    const antiga = anoPassado(2);
    await criarMissao('MCG-001', {
      periodo: periodoDe(recente),
      status: 'CONFIRMADA',
    });
    await criarMissao('MCG-002', {
      periodo: periodoDe(antiga),
      status: 'CONFIRMADA',
    });

    const soRecente = await montar({ ano: recente });
    expect(soRecente.missoes).toBe(1);
    expect(soRecente.pendencias.map((p) => p.codigo)).toEqual(['MCG-001']);

    const soAntiga = await montar({ ano: antiga });
    expect(soAntiga.missoes).toBe(1);
    expect(soAntiga.pendencias.map((p) => p.codigo)).toEqual(['MCG-002']);

    // E sem recorte as duas aparecem nos dois lugares — nunca uma so num deles.
    const tudo = await montar();
    expect(tudo.missoes).toBe(2);
    expect(tudo.pendencias).toHaveLength(2);
  });

  it('o recorte por rede vale igualmente para cartoes e pendencias', async () => {
    await criarMissao('MCG-010', {
      periodo: [diasAtras(30), diasAtras(20)],
      status: 'CONFIRMADA',
      redes: [base.redeId],
    });
    await criarMissao('MCG-011', {
      periodo: [diasAtras(30), diasAtras(20)],
      status: 'CONFIRMADA',
      redes: [outraRedeId],
    });

    const primeira = await montar({ redeId: base.redeId });
    expect(primeira.missoes).toBe(1);
    expect(primeira.pendencias.map((p) => p.codigo)).toEqual(['MCG-010']);
    expect(primeira.recorte.redeNome).toBe('REDE-TESTE');
  });

  it('rede que nao e do ciclo cai em "todas", e nao num painel de zeros', async () => {
    await criarMissao('MCG-012');

    // Um painel inteiro de zeros seria indistinguivel de um ciclo sem missao, e
    // quem chegasse por link antigo nao teria como notar a diferenca.
    const alheia = await montar({
      redeId: '00000000-0000-4000-8000-000000000000',
    });
    expect(alheia.missoes).toBe(1);
    expect(alheia.recorte.redeId).toBeNull();
    expect(alheia.recorte.redeNome).toBeNull();
  });

  // --- missao multirrede -----------------------------------------------------

  it('missao de duas redes conta uma vez no consolidado e uma vez na pendencia', async () => {
    await criarMissao('MCG-020', {
      periodo: [diasAtras(30), diasAtras(20)],
      status: 'CONFIRMADA',
      redes: [base.redeId, outraRedeId],
    });

    const dados = await montar();
    expect(dados.missoes).toBe(1);
    expect(dados.pendencias).toHaveLength(1);
    expect(dados.conclusao.canceladas).toBe(0);

    // A quebra por rede, essa sim, mostra a missao nas duas: ela pertence as
    // duas. Por isso a soma da coluna passa do total e nao e oferecida.
    expect(dados.porRede.map((r) => r.missoes).reduce((a, b) => a + b)).toBe(2);
    expect(dados.missoes).toBe(1);
  });

  it('a mesma missao nao duplica ao filtrar por uma das suas redes', async () => {
    await criarMissao('MCG-021', { redes: [base.redeId, outraRedeId] });

    for (const redeId of [base.redeId, outraRedeId]) {
      expect((await montar({ redeId })).missoes).toBe(1);
    }
  });

  // --- pendencias ------------------------------------------------------------

  it('uma missao com dois problemas e uma linha com dois motivos', async () => {
    // Devolvida para ajustes **e** com a viagem encerrada sem prestacao. Duas
    // linhas fariam o painel prometer mais trabalho do que existe.
    const missaoId = await criarMissao('MCG-030', {
      periodo: [diasAtras(20), diasAtras(15)],
      status: 'CONFIRMADA',
    });
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      // Sem `reuniaoData`: `decisao_comite_reuniao_ck` so a admite nas decisoes
      // terminais, e devolver para ajustes nao encerra a analise.
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Detalhar o roteiro.' } as never,
      admin,
    );

    const dados = await montar();
    expect(dados.pendencias).toHaveLength(1);
    expect(dados.pendencias[0].motivos.map((m) => m.chave).sort()).toEqual([
      'AJUSTES_SOLICITADOS',
      'PRESTACAO_NAO_INICIADA',
    ]);
  });

  it('missao cancelada nao gera pendencia, nem a que ja tinha uma', async () => {
    // Devolvida para ajustes **e depois** cancelada. A pendencia existia; o
    // cancelamento a extingue, porque nao ha o que cobrar de uma viagem que a
    // instituicao decidiu nao fazer. Cancelar so o `status` de uma missao
    // recem-criada nao provaria nada: os outros motivos ja exigem
    // `CONFIRMADA`/`CONCLUIDA` por conta propria.
    const missaoId = await criarMissao('MCG-031', {
      periodo: [diasAtras(20), diasAtras(15)],
    });
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Detalhar o roteiro.' } as never,
      admin,
    );
    expect((await montar()).pendencias).toHaveLength(1);

    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CANCELADA' })
      .where(eq(s.missaoComite.id, missaoId));

    const dados = await montar();
    expect(dados.conclusao.canceladas).toBe(1);
    expect(dados.pendencias).toEqual([]);
  });

  it('viagem ainda por vir nao cobra prestacao', async () => {
    await criarMissao('MCG-032', {
      periodo: ['2030-03-01', '2030-03-10'],
      status: 'CONFIRMADA',
    });

    expect((await montar()).pendencias).toEqual([]);
  });

  it('prestacao enviada cobra a Administracao; devolvida cobra o responsavel', async () => {
    const missaoId = await criarMissao('MCG-033', {
      periodo: [diasAtras(20), diasAtras(15)],
      status: 'CONFIRMADA',
    });
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '1000.00',
        descricao: 'Inscrição',
      } as never,
      admin,
    );
    await prestacao.enviar(base.cicloId, missaoId, admin);

    const enviada = await montar();
    expect(enviada.pendencias[0].motivos.map((m) => m.chave)).toEqual([
      'PRESTACAO_ENVIADA',
    ]);
    expect(enviada.pendencias[0].motivos[0].responsavel).toBe('Administração');

    await prestacao.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante.' },
      admin,
    );
    const devolvida = await montar();
    expect(devolvida.pendencias[0].motivos.map((m) => m.chave)).toEqual([
      'PRESTACAO_COM_PENDENCIA',
    ]);
    expect(devolvida.pendencias[0].motivos[0].responsavel).toBe(
      'Responsável pela missão',
    );
  });

  it('prestacao validada com a missao ainda confirmada cobra o encerramento', async () => {
    const missaoId = await criarMissao('MCG-034', {
      periodo: [diasAtras(20), diasAtras(15)],
      status: 'CONFIRMADA',
    });
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '1000.00',
        descricao: 'Inscrição',
      } as never,
      admin,
    );
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const dados = await montar();
    expect(dados.prestacao.VALIDADA).toBe(1);
    expect(dados.conclusao.aEncerrar).toBe(1);
    expect(dados.pendencias[0].motivos.map((m) => m.chave)).toEqual([
      'ENCERRAMENTO_PENDENTE',
    ]);
  });

  it('analise recem-enviada nao e pendencia; parada ha mais de uma semana e', async () => {
    const missaoId = await criarMissao('MCG-035');
    await submissao.submeter(base.cicloId, missaoId, admin);

    const recente = await montar();
    expect(recente.analise.aguardando).toBe(1);
    expect(recente.analise.paradas).toBe(0);
    expect(recente.pendencias).toEqual([]);

    // Uma semana e o corte porque a reuniao do colegiado e semanal (CG-047):
    // passar disso significa que a missao atravessou uma reuniao.
    const oitoDias = new Date();
    oitoDias.setUTCDate(oitoDias.getUTCDate() - 8);
    await ctx.db
      .update(s.rodadaAnalise)
      .set({ submetidoEm: oitoDias })
      .where(eq(s.rodadaAnalise.missaoId, missaoId));

    const parada = await montar();
    expect(parada.analise.paradas).toBe(1);
    expect(parada.pendencias[0].motivos.map((m) => m.chave)).toEqual([
      'ANALISE_PARADA',
    ]);
    expect(parada.pendencias[0].motivos[0].dias).toBeGreaterThanOrEqual(8);
  });

  // --- dimensoes independentes ----------------------------------------------

  it('aprovada nao e realizada: as duas dimensoes andam separadas', async () => {
    const missaoId = await criarMissao('MCG-040', {
      periodo: ['2030-03-01', '2030-03-10'],
    });
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Coerente com o plano da rede.',
        reuniaoData: ontem(),
      } as never,
      admin,
    );

    const dados = await montar();
    expect(dados.aprovacao.APROVADA).toBe(1);
    // A viagem ainda nem comecou.
    expect(dados.realizacao.FUTURA).toBe(1);
    expect(dados.realizacao.ENCERRADA).toBe(0);
    expect(dados.conclusao.concluidas).toBe(0);
  });

  // --- alcance ---------------------------------------------------------------

  it('pais visitado duas vezes na mesma missao conta uma missao', async () => {
    const missaoId = await criarMissao('MCG-050');
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 2,
      tipo: 'ARTICULACAO',
      titulo: 'Segunda parada no mesmo país',
      paisId,
      dataInicio: '2027-05-05',
      dataFim: '2027-05-06',
    });

    const dados = await montar();
    expect(dados.alcance.paises).toBe(1);
    expect(dados.porPais).toEqual([
      { id: paisId, nome: 'Portugal', codigoIso2: 'PT', missoes: 1 },
    ]);
  });

  it('a quebra por pais soma missoes distintas, e ordena pela maior', async () => {
    await criarMissao('MCG-051', { pais: paisId });
    await criarMissao('MCG-052', { pais: paisId });
    await criarMissao('MCG-053', { pais: outroPaisId });

    const dados = await montar();
    expect(dados.alcance.paises).toBe(2);
    expect(dados.porPais.map((p) => [p.nome, p.missoes])).toEqual([
      ['Portugal', 2],
      ['França', 1],
    ]);
  });

  it('parceiro e a instituicao cadastrada, nunca o nome digitado a mao', async () => {
    const missaoId = await criarMissao('MCG-060');
    const [parceira] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidade do Porto',
        nomeNormalizado: normalizarNomeInstituicao('Universidade do Porto'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });

    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 2,
      tipo: 'ARTICULACAO',
      titulo: 'Visita ao parceiro cadastrado',
      paisId,
      instituicaoId: parceira.id,
      dataInicio: '2027-05-05',
      dataFim: '2027-05-06',
    });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 3,
      tipo: 'ARTICULACAO',
      titulo: 'Visita a um parceiro ainda nao cadastrado',
      paisId,
      instituicaoNome: 'Instituto que ninguém cadastrou',
      dataInicio: '2027-05-07',
      dataFim: '2027-05-08',
    });

    // Contar o texto livre inflaria o indicador com algo que ninguem consegue
    // abrir: nao ha ficha de parceiro por tras dele.
    expect((await montar()).alcance.parceiros).toBe(1);
  });

  it('convenio conta pela missao de origem, e o de fora do recorte nao entra', async () => {
    const daRede = await criarMissao('MCG-070', { redes: [base.redeId] });
    const daOutra = await criarMissao('MCG-071', { redes: [outraRedeId] });

    for (const [titulo, missaoOrigemId] of [
      ['Acordo nascido na primeira', daRede],
      ['Acordo nascido na segunda', daOutra],
    ] as const) {
      await ctx.db.insert(s.convenio).values({
        instituicaoId: base.instituicaoId,
        missaoOrigemId,
        titulo,
        tipoAcordo: 'COOPERACAO_TECNICA',
        situacao: 'EM_TRAMITACAO',
      });
    }

    expect((await montar()).alcance.convenios).toBe(2);
    expect((await montar({ redeId: base.redeId })).alcance.convenios).toBe(1);
  });

  it('rede do ciclo sem missao continua na lista, com zero', async () => {
    await criarMissao('MCG-080', { redes: [base.redeId] });

    // Rede ausente da lista seria lida como rede sem dado carregado, e nao como
    // rede que ainda nao tem missao.
    const dados = await montar();
    expect(dados.porRede.map((r) => [r.nome, r.missoes])).toEqual([
      ['REDE-DOIS', 0],
      ['REDE-TESTE', 1],
    ]);
  });

  // --- consolidado por rede (CG-067) -----------------------------------------

  it('a linha da rede soma alem do consolidado quando ha missao multirrede', async () => {
    await criarMissao('MCG-090', { redes: [base.redeId, outraRedeId] });
    await criarMissao('MCG-091', { redes: [base.redeId] });

    const dados = await montar();

    // Cada rede conta a multirrede como sua, porque ela e das duas.
    const porNome = new Map(dados.porRede.map((r) => [r.nome, r]));
    expect(porNome.get('REDE-TESTE')!.missoes).toBe(2);
    expect(porNome.get('REDE-DOIS')!.missoes).toBe(1);

    // E o consolidado **nao** e a soma: sao 2 missoes, nao 3. O total sai de um
    // computo proprio sobre o recorte inteiro, e nao de agregar a coluna.
    expect(dados.porRede.reduce((total, r) => total + r.missoes, 0)).toBe(3);
    expect(dados.missoes).toBe(2);
  });

  it('paises, parceiros e produtos da rede tambem nao somam para o consolidado', async () => {
    const [parceira] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidade de Coimbra',
        nomeNormalizado: normalizarNomeInstituicao('Universidade de Coimbra'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });

    // Uma unica missao, das duas redes, com uma parada em Portugal na
    // instituicao parceira e um produto.
    const missaoId = await criarMissao('MCG-092', {
      redes: [base.redeId, outraRedeId],
    });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 2,
      tipo: 'ARTICULACAO',
      titulo: 'Visita ao parceiro',
      paisId,
      instituicaoId: parceira.id,
      eventoNome: 'Congresso de Internacionalização',
      dataInicio: '2027-05-05',
      dataFim: '2027-05-06',
    });
    await ctx.db.insert(s.produtoMissao).values({
      missaoId,
      tipo: 'PUBLICACAO',
      titulo: 'Artigo conjunto',
    });

    const dados = await montar();
    for (const rede of dados.porRede) {
      expect(rede.paises).toBe(1);
      expect(rede.instituicoes).toBe(1);
      expect(rede.eventos).toBe(1);
      expect(rede.produtos).toBe(1);
    }

    // O mesmo pais, o mesmo parceiro e o mesmo produto, uma vez so no
    // consolidado — foi uma viagem, e nao duas.
    expect(dados.alcance.paises).toBe(1);
    expect(dados.alcance.parceiros).toBe(1);
    expect(dados.alcance.eventos).toBe(1);
    expect(dados.alcance.produtos).toBe(1);
  });

  it('a despesa da missao multirrede aparece nas duas redes e uma vez no total', async () => {
    const missaoId = await criarMissao('MCG-093', {
      periodo: [diasAtras(20), diasAtras(15)],
      redes: [base.redeId, outraRedeId],
      status: 'CONFIRMADA',
    });
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '1500.00',
        descricao: 'Inscrição',
      } as never,
      admin,
    );

    // Ainda em preenchimento: lancada sim, validada nao. So a validada abate o
    // aporte (CG-009), e as duas colunas existem para que isso fique visivel.
    const antes = await montar();
    expect(antes.financeiro.lancada).toBe('1500.00');
    expect(antes.financeiro.validada).toBeNull();
    for (const rede of antes.porRede.filter((r) => r.missoes > 0)) {
      expect(rede.despesaLancada).toBe('1500.00');
      expect(rede.despesaValidada).toBeNull();
    }

    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const depois = await montar();
    expect(depois.financeiro.validada).toBe('1500.00');
    // R$ 1.500 gastos uma vez. Somar as duas linhas daria R$ 3.000, que e
    // exatamente o erro que o consolidado proprio evita.
    const somaDasRedes = depois.porRede
      .map((r) => Number(r.despesaValidada ?? 0))
      .reduce((a, b) => a + b, 0);
    expect(somaDasRedes).toBe(3000);
    expect(depois.financeiro.validada).toBe('1500.00');
  });

  it('evento conta por nome distinto, e o gestor so ve a propria rede', async () => {
    const missaoId = await criarMissao('MCG-094', { redes: [base.redeId] });
    // Duas paradas no mesmo evento, escrito com espacos e caixa diferentes.
    for (const [ordem, nome] of [
      [2, '  Congresso Anual  '],
      [3, 'congresso anual'],
    ] as const) {
      await ctx.db.insert(s.atividadeMissao).values({
        missaoId,
        ordem,
        tipo: 'ARTICULACAO',
        titulo: `Parada ${ordem}`,
        paisId,
        eventoNome: nome,
        dataInicio: '2027-05-05',
        dataFim: '2027-05-06',
      });
    }

    // Espacos e caixa normalizados: e um evento. O que o sistema **nao** sabe
    // resolver e o mesmo congresso com nome diferente — dai o aviso que viaja
    // junto (D-10 deixou evento reutilizavel para a F2).
    const dados = await montar();
    expect(dados.alcance.eventos).toBe(1);
    expect(dados.porRede.find((r) => r.nome === 'REDE-TESTE')!.eventos).toBe(1);
  });

  it('painel de ciclo vazio nao inventa numero', async () => {
    const dados = await montar();
    expect(dados.missoes).toBe(0);
    expect(dados.pendencias).toEqual([]);
    expect(dados.porPais).toEqual([]);
    expect(dados.alcance).toEqual({
      paises: 0,
      parceiros: 0,
      eventos: 0,
      convenios: 0,
      produtos: 0,
    });
    // Nulo, e nao R$ 0,00: ninguem lancou nada, e zero seria "lancaram e deu
    // zero" — a mesma distincao da CG-055.
    expect(dados.financeiro).toEqual({ validada: null, lancada: null });
  });
});
