import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { RecorteDeMissoes } from '../src/auth/escopo';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { NotificacoesService } from '../src/dominio/notificacoes.service';
import { ExecucaoComiteService } from '../src/dominio/execucao-comite.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  filtroMissoesSchema,
  MissoesComiteService,
} from '../src/dominio/missoes-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-financeiro',
  name: 'Admin Financeiro',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'missao:create',
    'missao:relato',
    'missao:confirm',
    'missao:cancel',
    'missao:close',
    'produto-missao:create',
    'produto-missao:edit',
    'produto-missao:delete',
    'produto-missao:declare',
    'missao:edit',
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
 * Integracao financeira do Comite Gestor (CG-060).
 *
 * A CG-055 ja cobriu o caminho feliz do painel: totais por exercicio e os
 * quatro estados da prestacao movendo (ou nao) o saldo oficial. O que sobrou, e
 * o que este arquivo fecha, sao os dois desvios que ninguem exercitou —
 * **missao cancelada** e **reabertura** — mais dois pontos cegos que so
 * aparecem quando se soma dinheiro de verdade: missao sem prestacao e despesa
 * com especializacao (passagem e diaria).
 *
 * As duas perguntas que esses testes respondem sao de regra, nao de codigo:
 *
 * 1. **Cancelar a missao desfaz o abatimento do que ja foi validado?** Nao. A
 *    CG-006 diz que cancelar "nao apaga despesas ou documentos ja gravados", e
 *    a CG-054 diz que `VALIDADA` congela em definitivo porque e ela que abate o
 *    aporte. Dinheiro executado continua executado; o que o cancelamento conta
 *    e que a viagem nao aconteceu, nao que o gasto foi estornado. Estorno, se
 *    um dia existir, e lancamento proprio — nao um efeito colateral de mudar o
 *    status da missao.
 * 2. **Reabrir a missao reabre a prestacao?** Nao. Sao dimensoes diferentes
 *    (CG-006): a reabertura devolve a *execucao* a PLANEJADA e nao toca no
 *    ciclo da prestacao. Se tocasse, reabrir seria o caminho lateral para
 *    alterar um valor que ja abateu o aporte sem passar por revisao nenhuma.
 */
describe('Integracao financeira do Comite Gestor (CG-060)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let execucao: ExecucaoComiteService;
  let prestacao: PrestacaoService;
  let missoes: MissoesComiteService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    execucao = new ExecucaoComiteService(ctx.db);
    prestacao = new PrestacaoService(ctx.db, semCanal(ctx.db));
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    await ctx.db.insert(s.orcamentoComiteGestor).values({
      cicloId: base.cicloId,
      instituicaoId: base.instituicaoId,
      ano: 2027,
      valorAnual: '10000.00',
    });
  });

  async function criarMissao(codigo: string, status?: 'CONFIRMADA') {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar a integração financeira',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
        ...(status ? { status } : {}),
      })
      .returning({ id: s.missaoComite.id });
    return missao.id;
  }

  const despesaAvulsa = (valor: string) =>
    ({
      tipo: 'OUTRA',
      exercicio: 2027,
      valorTotal: valor,
      descricao: 'Inscrição em evento',
    }) as never;

  /** Missao com prestacao validada — o unico estado que abate o aporte. */
  async function missaoValidada(codigo: string, valor: string) {
    const missaoId = await criarMissao(codigo, 'CONFIRMADA');
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      despesaAvulsa(valor),
      admin,
    );
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);
    return missaoId;
  }

  const exercicio2027 = async () =>
    (await execucao.porExercicio(base.cicloId)).exercicios.find(
      (linha) => linha.ano === 2027,
    )!;

  const cancelar = (missaoId: string) =>
    missoes.transicionar(
      base.cicloId,
      missaoId,
      {
        acao: 'CANCELAR',
        justificativa: 'Viagem desautorizada pela reitoria.',
      },
      admin,
    );

  // ------------------------------------------------------ missao cancelada --

  it('prestacao validada de missao cancelada continua abatendo o aporte', async () => {
    const missaoId = await missaoValidada('MCG-301', '3000.00');
    expect((await exercicio2027()).saldoOficial).toBe('7000.00');

    await cancelar(missaoId);

    // Cancelar nao estorna: o dinheiro saiu, foi validado e continua fora do
    // saldo. Devolve-lo aqui faria o aporte crescer sem lancamento nenhum.
    const linha = await exercicio2027();
    expect(linha.validado).toBe('3000.00');
    expect(linha.saldoOficial).toBe('7000.00');
  });

  it('cancelar nao mexe no estado nem no congelamento da prestacao', async () => {
    const missaoId = await missaoValidada('MCG-302', '3000.00');
    await cancelar(missaoId);

    const detalhe = await prestacao.detalhe(base.cicloId, missaoId);
    expect(detalhe?.status).toBe('VALIDADA');
    // Se o cancelamento reabrisse a edicao, mudar o status da missao viraria o
    // caminho para alterar valor que ja abateu o aporte.
    await expect(
      prestacao.criarDespesa(
        base.cicloId,
        missaoId,
        despesaAvulsa('500.00'),
        admin,
      ),
    ).rejects.toThrow();
  });

  it('missao cancelada com prestacao em aberto continua na coluna de pendencia', async () => {
    const missaoId = await criarMissao('MCG-303', 'CONFIRMADA');
    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      despesaAvulsa('2000.00'),
      admin,
    );
    await cancelar(missaoId);

    const linha = await exercicio2027();
    // Some-la daria a impressao de que nao ha nada a resolver, quando ha: uma
    // prestacao lancada e nunca revisada, de uma viagem que nao aconteceu.
    expect(linha.emPreenchimento).toBe('2000.00');
    expect(linha.naoValidado).toBe('2000.00');
    expect(linha.prestacoesPendentes).toBe(1);
    expect(linha.saldoOficial).toBe('10000.00');
  });

  it('missao cancelada continua contando na linha e aparece na lista do mesmo ano', async () => {
    const missaoId = await missaoValidada('MCG-304', '1000.00');
    await cancelar(missaoId);

    const linha = await exercicio2027();
    expect(linha.missoes).toBe(1);

    // A invariante da CG-055: quem clica na linha do exercicio tem que
    // encontrar na lista o mesmo numero que leu no painel. Excluir cancelada de
    // um lado so quebraria os dois numeros de uma vez.
    const pagina = await missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ ano: 2027 }),
      RecorteDeMissoes.irrestrito(),
    );
    expect(pagina.total).toBe(linha.missoes);
    expect(pagina.itens[0].status).toBe('CANCELADA');
    expect(pagina.itens[0].situacaoPrestacao).toBe('VALIDADA');
  });

  // ----------------------------------------------------------- reabertura --

  it('reabrir missao concluida nao move o dinheiro nem descongela a prestacao', async () => {
    const missaoId = await missaoValidada('MCG-305', '3000.00');
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CONCLUIDA' })
      .where(eq(s.missaoComite.id, missaoId));

    const antes = await exercicio2027();
    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Correcao do roteiro apos auditoria interna.' },
      admin,
    );
    const depois = await exercicio2027();

    expect(depois.validado).toBe(antes.validado);
    expect(depois.saldoOficial).toBe(antes.saldoOficial);
    expect(depois.missoes).toBe(antes.missoes);

    const detalhe = await prestacao.detalhe(base.cicloId, missaoId);
    expect(detalhe?.status).toBe('VALIDADA');
  });

  it('reabrir missao cancelada tambem nao devolve o valor validado', async () => {
    const missaoId = await missaoValidada('MCG-306', '2500.00');
    await cancelar(missaoId);
    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Cancelamento revertido pela pro-reitoria.' },
      admin,
    );

    const detalheMissao = await missoes.detalhe(base.cicloId, missaoId);
    expect(detalheMissao.status).toBe('PLANEJADA');

    const linha = await exercicio2027();
    expect(linha.validado).toBe('2500.00');
    expect(linha.saldoOficial).toBe('7500.00');
  });

  it('a reabertura nao reabre a prestacao para novo lancamento', async () => {
    const missaoId = await missaoValidada('MCG-307', '1000.00');
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CONCLUIDA' })
      .where(eq(s.missaoComite.id, missaoId));
    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Reabertura administrativa para conferencia.' },
      admin,
    );

    // As duas dimensoes sao independentes (CG-006). Se a reabertura da execucao
    // descongelasse a prestacao, ela seria o atalho para mudar o que ja abateu
    // o aporte sem passar pelo revisor.
    await expect(
      prestacao.criarDespesa(
        base.cicloId,
        missaoId,
        despesaAvulsa('400.00'),
        admin,
      ),
    ).rejects.toThrow();
    await expect(
      prestacao.enviar(base.cicloId, missaoId, admin),
    ).rejects.toThrow();
  });

  // ------------------------------------------------- missao sem prestacao --

  it('missao sem prestacao conta como missao e nao gera dinheiro nem pendencia', async () => {
    await criarMissao('MCG-308');

    const linha = await exercicio2027();
    expect(linha.missoes).toBe(1);
    // Nulo, nunca R$ 0,00 — zero seria "lancaram e deu zero", e aqui ninguem
    // lancou nada (CG-050).
    expect(linha.emPreenchimento).toBeNull();
    expect(linha.validado).toBeNull();
    expect(linha.naoValidado).toBeNull();
    // Prestacao inexistente nao e prestacao pendente: nao ha o que revisar.
    expect(linha.prestacoesPendentes).toBe(0);
    expect(linha.saldoOficial).toBe('10000.00');
  });

  // -------------------------------------------------- passagem e diaria --

  it('passagem com cotacoes e diaria somam uma vez cada no exercicio', async () => {
    const missaoId = await criarMissao('MCG-309', 'CONFIRMADA');
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Viajante do Comitê', tipo: 'DOCENTE' })
      .returning({ id: s.pessoa.id });
    const [participante] = await ctx.db
      .insert(s.missaoParticipante)
      .values({
        missaoId,
        pessoaId: pessoa.id,
        papel: 'RESPONSAVEL',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
      })
      .returning({ id: s.missaoParticipante.id });

    await prestacao.criar(base.cicloId, missaoId, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'PASSAGEM',
        participanteId: participante.id,
        exercicio: 2027,
        valorTotal: '4200.00',
        descricao: 'Manaus - Montreal',
        passagem: {
          empresa: 'Air Canada',
          origem: 'Manaus',
          destino: 'Montreal',
          dataVoo: '2027-05-01',
          // Tres cotacoes de proposito: `cotacao_passagem` e filha da despesa,
          // e um `join` com ela no calculo multiplicaria a passagem por tres.
          cotacoes: [
            { empresa: 'Air Canada', valor: '4200.00' },
            { empresa: 'LATAM', valor: '4890.00' },
            { empresa: 'Gol', valor: '5100.00' },
          ],
        },
      } as never,
      admin,
    );
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'DIARIA',
        participanteId: participante.id,
        exercicio: 2027,
        quantidade: '5.00',
        valorUnitario: '600.00',
        valorTotal: '3000.00',
        descricao: 'Diárias em Montreal',
        diaria: {
          dataInicio: '2027-05-02',
          dataFim: '2027-05-06',
          cidade: 'Montreal',
        },
      } as never,
      admin,
    );
    await prestacao.enviar(base.cicloId, missaoId, admin);
    await prestacao.validar(base.cicloId, missaoId, {}, admin);

    const linha = await exercicio2027();
    // 4.200 + 3.000, e nao 4.200 x 3 + 3.000: as especializacoes descrevem a
    // despesa, nao acrescentam valor a ela.
    expect(linha.validado).toBe('7200.00');
    expect(linha.saldoOficial).toBe('2800.00');

    const consolidado = await execucao.porExercicio(base.cicloId);
    expect(consolidado.total.validado).toBe('7200.00');
  });
});
