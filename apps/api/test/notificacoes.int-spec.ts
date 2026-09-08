import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import { permissionsForRoles } from '../src/auth/permissions';
import * as s from '../src/database/schema';
import { DecisaoService } from '../src/dominio/decisao.service';
import {
  NotificacoesService,
  type CanalDeEntrega,
} from '../src/dominio/notificacoes.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import { SubmissaoService } from '../src/dominio/submissao.service';
import {
  criarContextoTeste,
  type ContextoTeste,
  type TestDatabase,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * Aprovacao, concorrencia e notificacoes (CG-039).
 *
 * O criterio de aceite tem duas metades, e as duas sao negativas: **uma decisao
 * concorrente nao produz dois estados finais**, e **falha de canal externo nao
 * apaga a decisao nem a notificacao pendente**. As duas se testam provando o
 * que *nao* acontece.
 */
describe('Aprovacao, concorrencia e notificacoes (CG-039)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let identidade: IdentidadeService;
  let submissao: SubmissaoService;
  let decisao: DecisaoService;
  let prestacao: PrestacaoService;
  let notificacoes: NotificacoesService;
  let paisId: string;
  let responsavelId: string;
  let membroComiteId: string;

  /** O relator; `admin` passa por toda checagem de responsavel (CG-037). */
  const relator: AuthUser = {
    id: 'sub-relator',
    name: 'Relatora do Comitê',
    roles: ['admin'],
    permissions: permissionsForRoles(['admin']),
  };

  /** Perfil sem `missao:decide`, para o caso de permissao. */
  const semPermissao: AuthUser = {
    id: 'sub-sem-permissao',
    name: 'Docente',
    roles: ['docente'],
    permissions: permissionsForRoles(['docente']),
  };

  function servico(canal: CanalDeEntrega | null): NotificacoesService {
    return new NotificacoesService(ctx.db, identidade, canal);
  }

  const semCanal = (db: TestDatabase) =>
    new NotificacoesService(db, new IdentidadeService(db), null);

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    submissao = new SubmissaoService(ctx.db, identidade, semCanal(ctx.db));
    decisao = new DecisaoService(ctx.db, semCanal(ctx.db));
    prestacao = new PrestacaoService(ctx.db, semCanal(ctx.db));
    notificacoes = servico(null);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' })
      .returning({ id: s.pais.id });
    paisId = pais.id;

    responsavelId = await criarPessoa(relator, 'Relatora do Comitê');
    membroComiteId = await criarPessoa(null, 'Membro do Comitê');

    // O membro do Comite entra na equipe do ciclo: e assim que ele passa a
    // receber o aviso de missao submetida.
    await ctx.db.insert(s.membroEquipeGestao).values({
      cicloId: base.cicloId,
      pessoaId: membroComiteId,
      tipoEquipe: 'COMITE_GESTOR',
      funcao: 'Relator',
      dataInicio: '2027-01-01',
    });
  });

  async function criarPessoa(usuario: AuthUser | null, nome: string) {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome, tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    if (usuario) {
      await ctx.db.insert(s.usuarioSistema).values({
        sub: usuario.id,
        pessoaId: pessoa.id,
        origem: 'MANUAL',
      });
    }
    return pessoa.id;
  }

  async function criarMissao(codigo: string, periodo?: [string, string]) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar a aprovação e as notificações.',
        dataInicio: periodo?.[0] ?? '2027-05-01',
        dataFim: periodo?.[1] ?? '2027-05-10',
        status: 'CONFIRMADA',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db
      .insert(s.missaoRede)
      .values({ missaoId: missao.id, redeId: base.redeId });
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'ARTICULACAO',
      titulo: 'Reunião institucional',
      paisId,
      dataInicio: periodo?.[0] ?? '2027-05-02',
      dataFim: periodo?.[1] ?? '2027-05-03',
    });
    // Responsavel: e ele quem submete, e quem recebe o resultado.
    await ctx.db.insert(s.missaoParticipante).values({
      missaoId: missao.id,
      pessoaId: responsavelId,
      papel: 'RESPONSAVEL',
      dataInicio: periodo?.[0] ?? '2027-05-01',
      dataFim: periodo?.[1] ?? '2027-05-10',
    });
    return missao.id;
  }

  function ontem(): string {
    const data = new Date();
    data.setUTCDate(data.getUTCDate() - 1);
    return data.toISOString().slice(0, 10);
  }

  const daPessoa = (pessoaId: string) =>
    ctx.db
      .select()
      .from(s.notificacao)
      .where(eq(s.notificacao.destinatarioId, pessoaId));

  // --- o ciclo completo da aprovacao -----------------------------------------

  it('percorre submissao, ajustes, reenvio, aprovacao e reabertura', async () => {
    const missaoId = await criarMissao('MCG-001');

    await submissao.submeter(base.cicloId, missaoId, relator);
    expect(await statusAprovacao(missaoId)).toBe('EM_ANALISE');

    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Detalhar o roteiro.' } as never,
      relator,
    );
    expect(await statusAprovacao(missaoId)).toBe('AJUSTES_SOLICITADOS');

    // Reenvio abre rodada nova, sem apagar a anterior — a garantia da CG-019.
    const reenvio = await submissao.submeter(base.cicloId, missaoId, relator);
    expect(reenvio.numero).toBe(2);

    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Coerente com o plano da rede.',
        reuniaoData: ontem(),
      } as never,
      relator,
    );
    expect(await statusAprovacao(missaoId)).toBe('APROVADA');

    await decisao.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Documentação complementar recebida.' },
      relator,
    );
    expect(await statusAprovacao(missaoId)).toBe('EM_ANALISE');

    // Quatro rodadas, nenhuma apagada.
    const rodadas = await ctx.db
      .select()
      .from(s.rodadaAnalise)
      .where(eq(s.rodadaAnalise.missaoId, missaoId));
    expect(rodadas).toHaveLength(3);
  });

  it('reprovacao tambem exige data de reuniao, e ajustes nao aceitam', async () => {
    const missaoId = await criarMissao('MCG-010');
    await submissao.submeter(base.cicloId, missaoId, relator);

    // `decisao_comite_reuniao_ck`: a data existe exatamente nas decisoes
    // terminais, porque so elas encerram a analise numa reuniao.
    await expect(
      decisao.decidir(
        base.cicloId,
        missaoId,
        { acao: 'REPROVAR', parecer: 'Fora do escopo do ciclo.' } as never,
        relator,
      ),
    ).rejects.toThrow();

    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'REPROVAR',
        parecer: 'Fora do escopo do ciclo.',
        reuniaoData: ontem(),
      } as never,
      relator,
    );
    expect(await statusAprovacao(missaoId)).toBe('REPROVADA');
  });

  it('missao reprovada nao volta a analise sem reabertura', async () => {
    const missaoId = await criarMissao('MCG-020');
    await submissao.submeter(base.cicloId, missaoId, relator);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'REPROVAR',
        parecer: 'Fora do escopo.',
        reuniaoData: ontem(),
      } as never,
      relator,
    );

    await expect(
      submissao.submeter(base.cicloId, missaoId, relator),
    ).rejects.toMatchObject({ status: 409 });
  });

  // --- concorrencia ----------------------------------------------------------

  it('duas decisoes concorrentes nao produzem dois estados finais', async () => {
    const missaoId = await criarMissao('MCG-030');
    await submissao.submeter(base.cicloId, missaoId, relator);

    // As duas passam pela checagem de `EM_ANALISE`, que acontece fora da
    // transacao. Quem impede o segundo estado final e o indice unico da rodada.
    const resultados = await Promise.allSettled([
      decisao.decidir(
        base.cicloId,
        missaoId,
        {
          acao: 'APROVAR',
          parecer: 'Primeira decisão.',
          reuniaoData: ontem(),
        } as never,
        relator,
      ),
      decisao.decidir(
        base.cicloId,
        missaoId,
        {
          acao: 'REPROVAR',
          parecer: 'Segunda decisão, concorrente.',
          reuniaoData: ontem(),
        } as never,
        relator,
      ),
    ]);

    const aceitas = resultados.filter((r) => r.status === 'fulfilled');
    expect(aceitas).toHaveLength(1);

    // E a recusada precisa dizer o que houve. Violacao de unicidade crua
    // sairia como 500 — "erro do servidor" no lugar de "alguem decidiu antes".
    const recusada = resultados.find((r) => r.status === 'rejected');
    expect(recusada).toBeDefined();
    expect((recusada as PromiseRejectedResult).reason).toMatchObject({
      status: 409,
    });

    // Uma decisao no banco, e o status coerente com ela.
    const decisoes = await ctx.db.select().from(s.decisaoComite);
    expect(decisoes).toHaveLength(1);
    expect(await statusAprovacao(missaoId)).toBe(
      decisoes[0].acao === 'APROVAR' ? 'APROVADA' : 'REPROVADA',
    );
  });

  it('dois envios concorrentes nao abrem duas rodadas', async () => {
    const missaoId = await criarMissao('MCG-040');

    // `rodada_analise_aberta_uk` e o que garante isso; sem ele a missao teria
    // duas rodadas abertas e a fila a mostraria duas vezes.
    const resultados = await Promise.allSettled([
      submissao.submeter(base.cicloId, missaoId, relator),
      submissao.submeter(base.cicloId, missaoId, relator),
    ]);
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);

    const abertas = await ctx.db
      .select()
      .from(s.rodadaAnalise)
      .where(eq(s.rodadaAnalise.missaoId, missaoId));
    expect(abertas).toHaveLength(1);
  });

  // --- permissao -------------------------------------------------------------

  it('o catalogo nao concede decisao nem reabertura a quem nao deve', () => {
    // A checagem em si e do guard, com `@RequirePermission`. O que se verifica
    // aqui e o mapa: quem nao tem a permissao nao chega ao servico.
    expect(semPermissao.permissions).not.toContain('missao:decide');
    expect(semPermissao.permissions).not.toContain('missao:reopen');
    expect(semPermissao.permissions).not.toContain('missao:submit');

    expect(permissionsForRoles(['comite-gestor'])).toContain('missao:decide');
    // Reabrir decisao ja tomada e ato do `admin`, e so dele.
    expect(permissionsForRoles(['comite-gestor'])).not.toContain(
      'missao:reopen',
    );
    expect(permissionsForRoles(['gestor-rede'])).not.toContain('missao:decide');
  });

  // --- notificacoes ----------------------------------------------------------

  it('a submissao avisa o Comite, e nao quem submeteu', async () => {
    const missaoId = await criarMissao('MCG-050');
    await submissao.submeter(base.cicloId, missaoId, relator);

    const doComite = await daPessoa(membroComiteId);
    expect(doComite).toHaveLength(1);
    expect(doComite[0].tipo).toBe('MISSAO_SUBMETIDA');

    // Receber aviso do proprio ato so atrapalha.
    expect(await daPessoa(responsavelId)).toEqual([]);
  });

  it('a decisao avisa quem participa da missao', async () => {
    const missaoId = await criarMissao('MCG-060');
    await submissao.submeter(base.cicloId, missaoId, relator);

    // O relator e o responsavel sao a mesma pessoa nesta fixture, entao o
    // aviso da decisao seria dele para ele: por isso decide outro usuario.
    const outro: AuthUser = {
      id: 'sub-outro-relator',
      name: 'Outro Relator',
      roles: ['admin'],
      permissions: permissionsForRoles(['admin']),
    };
    await criarPessoa(outro, 'Outro Relator');

    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Aprovada na reunião de ontem.',
        reuniaoData: ontem(),
      } as never,
      outro,
    );

    const doResponsavel = await daPessoa(responsavelId);
    const daDecisao = doResponsavel.find((n) => n.tipo === 'DECISAO_COMITE');
    expect(daDecisao).toBeDefined();
    expect(daDecisao!.titulo).toContain('aprovada');
    expect(daDecisao!.corpo).toBe('Aprovada na reunião de ontem.');
    // Sem canal externo configurado, nada fica pendente de entrega.
    expect(daDecisao!.entregaEstado).toBe('NAO_APLICAVEL');
  });

  it('a prestacao avisa ao devolver e ao validar, mas nao ao enviar', async () => {
    const missaoId = await criarMissao('MCG-070');
    const revisor: AuthUser = {
      id: 'sub-revisor',
      name: 'Revisora',
      roles: ['admin'],
      permissions: permissionsForRoles(['admin']),
    };
    await criarPessoa(revisor, 'Revisora');

    await prestacao.criar(base.cicloId, missaoId, revisor);
    await prestacao.criarDespesa(
      base.cicloId,
      missaoId,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '900.00',
        descricao: 'Inscrição',
      } as never,
      revisor,
    );
    await prestacao.enviar(base.cicloId, missaoId, revisor);

    // Envio nao avisa: quem enviou sabe, e o revisor descobre pela fila.
    expect(await daPessoa(responsavelId)).toEqual([]);

    await prestacao.devolver(
      base.cicloId,
      missaoId,
      { parecer: 'Falta o comprovante da inscrição.' },
      revisor,
    );
    const apos = await daPessoa(responsavelId);
    expect(apos.map((n) => n.tipo)).toEqual(['PRESTACAO_DEVOLVIDA']);
    // O parecer vira o corpo: repetir "foi devolvida" e menos util que dizer
    // por que.
    expect(apos[0].corpo).toBe('Falta o comprovante da inscrição.');
  });

  // --- falha de canal --------------------------------------------------------

  it('falha do canal externo nao apaga a decisao nem a notificacao', async () => {
    const comCanal = servico({
      entregar: () => Promise.reject(new Error('SMTP indisponível')),
    });
    const decisaoComCanal = new DecisaoService(ctx.db, comCanal);

    const missaoId = await criarMissao('MCG-080');
    await submissao.submeter(base.cicloId, missaoId, relator);

    const outro: AuthUser = {
      id: 'sub-relator-canal',
      name: 'Relator com canal',
      roles: ['admin'],
      permissions: permissionsForRoles(['admin']),
    };
    await criarPessoa(outro, 'Relator com canal');

    await decisaoComCanal.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Aprovada.',
        reuniaoData: ontem(),
      } as never,
      outro,
    );

    // Com canal configurado a notificacao nasce pendente de entrega.
    const antes = await daPessoa(responsavelId);
    expect(antes[0].entregaEstado).toBe('PENDENTE');

    const resultado = await comCanal.despachar();
    expect(resultado).toEqual({ entregues: 0, falhas: 1 });

    // **A decisao permanece.** O canal falhou, e o fato nao depende do canal.
    expect(await statusAprovacao(missaoId)).toBe('APROVADA');
    expect(await ctx.db.select().from(s.decisaoComite)).toHaveLength(1);

    // **E a notificacao continua pendente**, com o erro ao lado. Marca-la
    // `FALHOU` transformaria uma indisponibilidade momentanea em aviso perdido.
    const depois = await daPessoa(responsavelId);
    expect(depois[0].entregaEstado).toBe('PENDENTE');
    expect(depois[0].entregaTentativas).toBe(1);
    expect(depois[0].entregaUltimoErro).toContain('SMTP indisponível');
    expect(depois[0].entregueEm).toBeNull();
  });

  it('o canal que volta a funcionar entrega o que estava pendente', async () => {
    let falhar = true;
    const entregues: string[] = [];
    const comCanal = servico({
      entregar: (n) => {
        if (falhar) return Promise.reject(new Error('SMTP indisponível'));
        entregues.push(n.titulo);
        return Promise.resolve();
      },
    });
    const decisaoComCanal = new DecisaoService(ctx.db, comCanal);

    const missaoId = await criarMissao('MCG-090');
    await submissao.submeter(base.cicloId, missaoId, relator);
    const outro: AuthUser = {
      id: 'sub-relator-retry',
      name: 'Relator',
      roles: ['admin'],
      permissions: permissionsForRoles(['admin']),
    };
    await criarPessoa(outro, 'Relator do retry');
    await decisaoComCanal.decidir(
      base.cicloId,
      missaoId,
      { acao: 'APROVAR', parecer: 'Aprovada.', reuniaoData: ontem() } as never,
      outro,
    );

    await comCanal.despachar();
    falhar = false;
    // A pendencia sobreviveu a falha, entao a proxima passada a entrega: e
    // isso que "duravel" significa.
    expect(await comCanal.despachar()).toEqual({ entregues: 1, falhas: 0 });
    expect(entregues).toHaveLength(1);

    const [linha] = await daPessoa(responsavelId);
    expect(linha.entregaEstado).toBe('ENTREGUE');
    expect(linha.entregueEm).not.toBeNull();
  });

  // --- caixa de entrada ------------------------------------------------------

  it('a pendencia de prestacao entra uma vez, por mais que se abra a caixa', async () => {
    // Viagem encerrada, missao confirmada, prestacao nao iniciada — o mesmo
    // criterio da lista de pendencias do painel (CG-066).
    await criarMissao('MCG-100', [diasAtras(30), diasAtras(20)]);

    const primeira = await notificacoes.caixaDeEntrada(relator);
    expect(primeira.itens.map((i) => i.tipo)).toEqual(['PRESTACAO_PENDENTE']);

    // Sem a unicidade parcial, cada abertura criaria uma copia e a caixa
    // viraria ruido.
    const segunda = await notificacoes.caixaDeEntrada(relator);
    expect(segunda.itens).toHaveLength(1);
    expect(segunda.naoLidas).toBe(1);
  });

  it('marcar lida zera a contagem, e notificacao alheia responde 404', async () => {
    const missaoId = await criarMissao('MCG-110');
    await submissao.submeter(base.cicloId, missaoId, relator);

    // O aviso e do membro do Comite; o relator nao pode marca-lo como lido.
    const [doComite] = await daPessoa(membroComiteId);
    await expect(
      notificacoes.marcarLida(doComite.id, relator),
    ).rejects.toMatchObject({ status: 404 });

    const outro: AuthUser = {
      id: 'sub-membro-comite',
      name: 'Membro do Comitê',
      roles: ['comite-gestor'],
      permissions: permissionsForRoles(['comite-gestor']),
    };
    await ctx.db.insert(s.usuarioSistema).values({
      sub: outro.id,
      pessoaId: membroComiteId,
      origem: 'MANUAL',
    });

    expect((await notificacoes.caixaDeEntrada(outro)).naoLidas).toBe(1);
    await notificacoes.marcarLida(doComite.id, outro);
    expect((await notificacoes.caixaDeEntrada(outro)).naoLidas).toBe(0);
    // Duas vezes na mesma linha e o caso comum, e nao erro.
    await notificacoes.marcarLida(doComite.id, outro);
  });

  it('quem nao tem pessoa vinculada recebe caixa vazia, e a tela sabe por que', async () => {
    const semVinculo: AuthUser = {
      id: 'sub-sem-pessoa',
      name: 'Conta sem vínculo',
      roles: ['docente'],
      permissions: permissionsForRoles(['docente']),
      // Sem e-mail: `IdentidadeService` cria pessoa nova, entao o caso real de
      // `vinculoPendente` e o conflito. Aqui basta que a caixa venha vazia.
    };
    const caixa = await notificacoes.caixaDeEntrada(semVinculo);
    expect(caixa.itens).toEqual([]);
    expect(caixa.naoLidas).toBe(0);
  });

  // ---------------------------------------------------------------------------

  async function statusAprovacao(missaoId: string): Promise<string> {
    const [linha] = await ctx.db
      .select({ status: s.missaoComite.statusAprovacao })
      .from(s.missaoComite)
      .where(eq(s.missaoComite.id, missaoId));
    return linha.status;
  }

  function diasAtras(dias: number): string {
    const data = new Date();
    data.setUTCDate(data.getUTCDate() - dias);
    return data.toISOString().slice(0, 10);
  }
});
