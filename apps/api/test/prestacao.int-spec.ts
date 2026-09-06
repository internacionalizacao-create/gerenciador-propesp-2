import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import {
  criarDespesaSchema,
  PrestacaoService,
  type CriarDespesa,
} from '../src/dominio/prestacao.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-prestacao',
  name: 'Admin da Prestação',
  roles: ['admin'],
  permissions: ['prestacao:read', 'prestacao:write'],
};

describe('PrestacaoService (CG-050)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: PrestacaoService;
  let missaoId: string;
  let participanteId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new PrestacaoService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-700',
        titulo: 'Missão com prestação',
        objetivo: 'Testar despesas',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-10',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Viajante de Teste', tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [participante] = await ctx.db
      .insert(s.missaoParticipante)
      .values({
        missaoId,
        pessoaId: pessoa.id,
        papel: 'RESPONSAVEL',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-10',
      })
      .returning({ id: s.missaoParticipante.id });
    participanteId = participante.id;
  });

  function despesa(sobrescrever: Partial<CriarDespesa> = {}): CriarDespesa {
    return criarDespesaSchema.parse({
      tipo: 'OUTRA',
      exercicio: 2027,
      valorTotal: '100.00',
      descricao: 'Despesa de teste',
      ...sobrescrever,
    });
  }

  it('missao sem prestacao devolve nulo, e nao erro', async () => {
    // A ausencia de prestacao e um estado legitimo (CG-013), nao um 404.
    expect(await service.detalhe(base.cicloId, missaoId)).toBeNull();
  });

  it('inicia a prestacao uma unica vez', async () => {
    const criada = await service.criar(base.cicloId, missaoId, admin);
    expect(criada).toMatchObject({
      missaoId,
      status: 'EM_PREENCHIMENTO',
      total: null,
      despesas: [],
    });
    // Prestacao vazia nao tem total: zero afirmaria que a missao nao gastou.
    expect(criada.total).toBeNull();

    await expect(service.criar(base.cicloId, missaoId, admin)).rejects.toThrow(
      /ja tem prestacao/i,
    );
  });

  it('recusa despesa cujo total nao bate com quantidade x unitario', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    expect(() =>
      despesa({
        tipo: 'DIARIA',
        quantidade: '3.00',
        valorUnitario: '400.00',
        valorTotal: '1000.00',
        diaria: { dataInicio: '2027-03-02', dataFim: '2027-03-04' },
      }),
    ).toThrow(/nao corresponde/i);
  });

  it('aceita despesa avulsa que informa so o total', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const depois = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ valorTotal: '137.45', descricao: 'Taxa com encargo' }),
      admin,
    );
    expect(depois.total).toBe('137.45');
  });

  it('grava passagem com cotacoes e diaria com periodo', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'PASSAGEM',
        participanteId,
        valorTotal: '4200.00',
        descricao: 'Manaus - Montreal',
        passagem: {
          empresa: 'Air Canada',
          origem: 'Manaus',
          destino: 'Montreal',
          numeroVoo: 'AC1234',
          dataVoo: '2027-03-01',
          formaPagamento: 'Cartão corporativo',
          cotacoes: [
            { empresa: 'Air Canada', valor: '4200.00' },
            { empresa: 'LATAM', valor: '4890.00' },
          ],
        },
      }),
      admin,
    );
    const detalhe = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'DIARIA',
        participanteId,
        quantidade: '5.00',
        valorUnitario: '600.00',
        valorTotal: '3000.00',
        descricao: 'Diárias em Montreal',
        diaria: {
          dataInicio: '2027-03-02',
          dataFim: '2027-03-06',
          cidade: 'Montreal',
        },
      }),
      admin,
    );

    const passagem = detalhe.despesas.find((d) => d.tipo === 'PASSAGEM');
    expect(passagem?.passagem).toMatchObject({
      origem: 'Manaus',
      destino: 'Montreal',
      numeroVoo: 'AC1234',
      formaPagamento: 'Cartão corporativo',
    });
    expect(passagem?.passagem?.cotacoes).toHaveLength(2);
    // Diaria nao repete beneficiario nem quantidade: eles vivem na despesa.
    const diaria = detalhe.despesas.find((d) => d.tipo === 'DIARIA');
    expect(diaria?.diaria).toMatchObject({
      dataInicio: '2027-03-02',
      cidade: 'Montreal',
    });
    expect(diaria?.participante).toBe('Viajante de Teste');
    expect(diaria?.quantidade).toBe('5.00');
  });

  it('deriva os totais por tipo, exercicio e pessoa sem persistir agregado', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'PASSAGEM',
        participanteId,
        valorTotal: '4200.00',
        descricao: 'Passagem',
        passagem: { empresa: 'Air Canada', cotacoes: [] },
      }),
      admin,
    );
    await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'DIARIA',
        participanteId,
        valorTotal: '3000.00',
        descricao: 'Diárias',
        diaria: { dataInicio: '2027-03-02', dataFim: '2027-03-06' },
      }),
      admin,
    );
    const detalhe = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ exercicio: 2028, valorTotal: '0.07', descricao: 'Centavos' }),
      admin,
    );

    // Soma exata em numeric: o centavo solto nao se perde no total.
    expect(detalhe.total).toBe('7200.07');
    expect(detalhe.totalPorTipo).toEqual([
      { chave: 'DIARIA', rotulo: 'DIARIA', total: '3000.00' },
      { chave: 'OUTRA', rotulo: 'OUTRA', total: '0.07' },
      { chave: 'PASSAGEM', rotulo: 'PASSAGEM', total: '4200.00' },
    ]);
    expect(detalhe.totalPorExercicio).toEqual([
      { chave: '2027', rotulo: '2027', total: '7200.00' },
      { chave: '2028', rotulo: '2028', total: '0.07' },
    ]);
    expect(detalhe.totalPorPessoa).toEqual([
      { chave: 'SEM_PARTICIPANTE', rotulo: 'Sem participante', total: '0.07' },
      { chave: participanteId, rotulo: 'Viajante de Teste', total: '7200.00' },
    ]);

    // Nenhum agregado foi gravado: so as despesas existem.
    const linhas = await ctx.db
      .select()
      .from(s.despesaMissao)
      .where(eq(s.despesaMissao.prestacaoId, detalhe.id));
    expect(linhas).toHaveLength(3);
  });

  it('aceita os tipos homologados sem exigir especializacao', async () => {
    // Secao 24 do documento: hospedagem, transporte, inscricao, seguro e
    // outros se descrevem com os campos comuns da despesa.
    await service.criar(base.cicloId, missaoId, admin);
    for (const tipo of [
      'HOSPEDAGEM',
      'TRANSPORTE',
      'INSCRICAO_EVENTO',
      'SEGURO',
      'OUTRA',
    ] as const) {
      await service.criarDespesa(
        base.cicloId,
        missaoId,
        despesa({ tipo, valorTotal: '100.00', descricao: `Despesa ${tipo}` }),
        admin,
      );
    }
    const detalhe = await service.detalhe(base.cicloId, missaoId);
    expect(detalhe?.total).toBe('500.00');
    expect(detalhe?.totalPorTipo.map((t) => t.chave).sort()).toEqual([
      'HOSPEDAGEM',
      'INSCRICAO_EVENTO',
      'OUTRA',
      'SEGURO',
      'TRANSPORTE',
    ]);
    // Nenhum deles aceita dados de passagem ou diaria.
    expect(() =>
      despesa({
        tipo: 'SEGURO',
        passagem: { empresa: 'X', cotacoes: [] },
      }),
    ).toThrow(/nao tem especializacao/i);
  });

  it('recusa participante de outra missao', async () => {
    // Aceitar apontaria a despesa para alguem que nunca viajou nesta missao.
    await service.criar(base.cicloId, missaoId, admin);
    const [outraMissao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-701',
        titulo: 'Outra missão',
        objetivo: 'Outra',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-05',
      })
      .returning({ id: s.missaoComite.id });
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Alheio', tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [alheio] = await ctx.db
      .insert(s.missaoParticipante)
      .values({
        missaoId: outraMissao.id,
        pessoaId: pessoa.id,
        papel: 'PARTICIPANTE',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-05',
      })
      .returning({ id: s.missaoParticipante.id });

    await expect(
      service.criarDespesa(
        base.cicloId,
        missaoId,
        despesa({ participanteId: alheio.id }),
        admin,
      ),
    ).rejects.toThrow(/nao pertence a esta missao/i);
  });

  it('trocar o tipo na edicao nao deixa especializacao orfa', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const comPassagem = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'PASSAGEM',
        valorTotal: '1000.00',
        descricao: 'Vai virar diária',
        passagem: { empresa: 'LATAM', cotacoes: [] },
      }),
      admin,
    );
    const despesaId = comPassagem.despesas[0].id;

    const depois = await service.atualizarDespesa(
      base.cicloId,
      missaoId,
      despesaId,
      despesa({
        tipo: 'DIARIA',
        valorTotal: '1000.00',
        descricao: 'Agora é diária',
        diaria: { dataInicio: '2027-03-02', dataFim: '2027-03-03' },
      }),
      admin,
    );

    expect(depois.despesas[0].tipo).toBe('DIARIA');
    expect(depois.despesas[0].passagem).toBeNull();
    expect(depois.despesas[0].diaria?.dataInicio).toBe('2027-03-02');
    // A linha de passagem foi embora junto com o tipo antigo.
    const orfas = await ctx.db
      .select()
      .from(s.despesaPassagem)
      .where(eq(s.despesaPassagem.despesaId, despesaId));
    expect(orfas).toEqual([]);
  });

  it('remove despesa e audita criacao, edicao e exclusao', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ valorTotal: '500.00', descricao: 'Some depois' }),
      admin,
    );
    const despesaId = criada.despesas[0].id;
    await service.atualizarDespesa(
      base.cicloId,
      missaoId,
      despesaId,
      despesa({ valorTotal: '600.00', descricao: 'Some depois' }),
      admin,
    );
    const vazia = await service.removerDespesa(
      base.cicloId,
      missaoId,
      despesaId,
      admin,
    );
    expect(vazia.despesas).toEqual([]);
    expect(vazia.total).toBeNull();

    const trilha = await ctx.db
      .select({
        acao: s.registroAuditoria.acao,
        campo: s.registroAuditoria.campo,
      })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, despesaId));
    expect(trilha.map((linha) => linha.acao).sort()).toEqual([
      'CRIACAO',
      'EDICAO',
      'EXCLUSAO',
    ]);
    expect(trilha.find((linha) => linha.acao === 'EDICAO')?.campo).toBe(
      'valorTotal',
    );
  });

  it('nao remove despesa que possui documento historico', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ valorTotal: '500.00', descricao: 'Despesa documentada' }),
      admin,
    );
    const despesaId = criada.despesas[0].id;
    await ctx.db.insert(s.anexo).values({
      nome: 'comprovante.pdf',
      mimeType: 'application/pdf',
      tamanho: 100,
      caminho: '2027/documento-despesa',
      categoria: 'COMPROVANTE',
      entidadeTipo: 'DESPESA_MISSAO',
      entidadeId: despesaId,
    });

    await expect(
      service.removerDespesa(base.cicloId, missaoId, despesaId, admin),
    ).rejects.toThrow(/preservada no historico/i);
    expect(
      await ctx.db
        .select()
        .from(s.despesaMissao)
        .where(eq(s.despesaMissao.id, despesaId)),
    ).toHaveLength(1);
  });

  it('nao apaga cotacao que possui documento ao editar passagem', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'PASSAGEM',
        valorTotal: '1000.00',
        descricao: 'Passagem documentada',
        passagem: {
          cotacoes: [{ empresa: 'Agencia A', valor: '1100.00' }],
        },
      }),
      admin,
    );
    const despesaId = criada.despesas[0].id;
    const cotacaoId = criada.despesas[0].passagem?.cotacoes[0].id as string;
    await ctx.db.insert(s.anexo).values({
      nome: 'cotacao.pdf',
      mimeType: 'application/pdf',
      tamanho: 100,
      caminho: '2027/documento-cotacao',
      categoria: 'COTACAO',
      entidadeTipo: 'COTACAO_PASSAGEM',
      entidadeId: cotacaoId,
    });

    await expect(
      service.atualizarDespesa(
        base.cicloId,
        missaoId,
        despesaId,
        despesa({
          tipo: 'PASSAGEM',
          valorTotal: '1000.00',
          descricao: 'Passagem documentada',
          passagem: {
            cotacoes: [{ empresa: 'Agencia A', valor: '1100.00' }],
          },
        }),
        admin,
      ),
    ).rejects.toThrow(/cotacao com documento/i);
    expect(
      await ctx.db
        .select()
        .from(s.cotacaoPassagem)
        .where(eq(s.cotacaoPassagem.id, cotacaoId)),
    ).toHaveLength(1);
  });

  it('prestacao enviada nao aceita alteracao', async () => {
    // Quem enviou nao corrige por baixo: o revisor validaria um valor
    // diferente do que leu. O ciclo completo de estados e a CG-054, coberto em
    // `prestacao-ciclo.int-spec.ts`; aqui so o efeito sobre o lancamento.
    const prestacao = await service.criar(base.cicloId, missaoId, admin);
    await ctx.db
      .update(s.prestacaoContasMissao)
      .set({ status: 'ENVIADA', enviadaEm: '2027-04-01' })
      .where(eq(s.prestacaoContasMissao.id, prestacao.id));

    await expect(
      service.criarDespesa(base.cicloId, missaoId, despesa(), admin),
    ).rejects.toThrow(/em analise nao aceita alteracao/i);
  });

  it('nao enxerga missao de outro ciclo', async () => {
    const [outroCiclo] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });
    await expect(service.detalhe(outroCiclo.id, missaoId)).rejects.toThrow(
      /Missao nao encontrada/i,
    );
  });

  it('devolve os documentos de cada despesa, inclusive os das cotacoes', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({
        tipo: 'PASSAGEM',
        valorTotal: '4200.00',
        descricao: 'Passagem com cotacoes',
        passagem: {
          cotacoes: [
            { empresa: 'Empresa A', valor: '4200.00' },
            { empresa: 'Empresa B', valor: '4700.00' },
          ],
        },
      }),
      admin,
    );
    const despesaId = criada.despesas[0].id;
    const cotacaoId = criada.despesas[0].passagem!.cotacoes[0].id;

    await ctx.db.insert(s.anexo).values([
      {
        nome: 'bilhete.pdf',
        mimeType: 'application/pdf',
        tamanho: 100,
        caminho: '2027/bilhete',
        categoria: 'BILHETE',
        entidadeTipo: 'DESPESA_MISSAO',
        entidadeId: despesaId,
      },
      {
        nome: 'cotacao-a.pdf',
        mimeType: 'application/pdf',
        tamanho: 100,
        caminho: '2027/cotacao-a',
        categoria: 'COTACAO',
        entidadeTipo: 'COTACAO_PASSAGEM',
        entidadeId: cotacaoId,
      },
    ]);

    const detalhe = await service.detalhe(base.cicloId, missaoId);
    const [linha] = detalhe!.despesas;

    // O documento da cotacao conta para a despesa que a contem: a tela indica
    // pendencia por despesa, e a cotacao nao aparece sozinha em lugar nenhum.
    expect(linha.documentos.map((d) => d.nome).sort()).toEqual([
      'bilhete.pdf',
      'cotacao-a.pdf',
    ]);
    expect(
      linha.documentos.find((d) => d.nome === 'cotacao-a.pdf')?.cotacaoId,
    ).toBe(cotacaoId);
    expect(
      linha.documentos.find((d) => d.nome === 'bilhete.pdf')?.cotacaoId,
    ).toBeNull();
  });

  it('documento inativo nao conta como comprovante', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ valorTotal: '300.00', descricao: 'Despesa sem comprovante' }),
      admin,
    );
    const despesaId = criada.despesas[0].id;
    await ctx.db.insert(s.anexo).values({
      nome: 'antigo.pdf',
      mimeType: 'application/pdf',
      tamanho: 100,
      caminho: '2027/antigo',
      categoria: 'COMPROVANTE',
      entidadeTipo: 'DESPESA_MISSAO',
      entidadeId: despesaId,
      ativo: false,
    });

    // Se contasse, a tela diria que a despesa esta comprovada quando o unico
    // arquivo foi substituido ou inativado.
    const detalhe = await service.detalhe(base.cicloId, missaoId);
    expect(detalhe!.despesas[0].documentos).toEqual([]);
  });

  it('despesa sem documento chega com a lista vazia, nao indefinida', async () => {
    await service.criar(base.cicloId, missaoId, admin);
    const criada = await service.criarDespesa(
      base.cicloId,
      missaoId,
      despesa({ valorTotal: '120.00', descricao: 'Transporte local' }),
      admin,
    );
    expect(criada.despesas[0].documentos).toEqual([]);
  });
});
