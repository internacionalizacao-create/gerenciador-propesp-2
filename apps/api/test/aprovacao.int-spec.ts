import { eq, sql } from 'drizzle-orm';

import * as s from '../src/database/schema';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * Schema de submissao e decisoes do Comite (CG-019).
 *
 * Estas regressoes cobrem o **banco**, nao um servico: a CG-019 entrega
 * estrutura, e as garantias que importam sao as que sobrevivem a um servico
 * escrito errado depois. Por isso quase todo caso aqui e uma tentativa de
 * gravar algo invalido e a expectativa de que o Postgres recuse — sempre por
 * `esperarViolacao`, que confere o nome da constraint e nao a mensagem.
 */
describe('Schema de aprovacao da missao (CG-019)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let missaoId: string;
  let outraMissaoId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    [missaoId, outraMissaoId] = (
      await ctx.db
        .insert(s.missaoComite)
        .values([
          {
            cicloId: base.cicloId,
            codigo: 'MCG-700',
            titulo: 'Missão em análise',
            objetivo: 'Testar aprovação',
            dataInicio: '2027-04-01',
            dataFim: '2027-04-10',
          },
          {
            cicloId: base.cicloId,
            codigo: 'MCG-701',
            titulo: 'Outra missão',
            objetivo: 'Isolamento',
            dataInicio: '2027-05-01',
            dataFim: '2027-05-10',
          },
        ])
        .returning({ id: s.missaoComite.id })
    ).map(({ id }) => id);
  });

  /**
   * Datas fixas, e nao `new Date()`, ao encerrar uma rodada.
   *
   * `submetido_em` tem `default now()` do **banco**; um `encerradaEm` montado
   * no cliente cai antes disso por diferenca de relogio e dispara
   * `rodada_analise_encerramento_ck` — que e o check funcionando, nao um
   * defeito. Quem encerra informa o par inteiro.
   */
  const T_ENVIO = new Date('2027-04-05T10:00:00Z');
  const T_FECHO = new Date('2027-04-05T11:00:00Z');

  const rodada = (sobrescrever: Record<string, unknown> = {}) => {
    const valores: Record<string, unknown> = {
      missaoId,
      numero: 1,
      submetidoPorId: 'sub-admin',
      submetidoPor: 'Admin',
      ...sobrescrever,
    };
    if (valores.encerradaEm && !valores.submetidoEm) {
      valores.submetidoEm = T_ENVIO;
    }
    return valores as never;
  };

  async function criarRodada(sobrescrever: Record<string, unknown> = {}) {
    const [linha] = await ctx.db
      .insert(s.rodadaAnalise)
      .values(rodada(sobrescrever))
      .returning({ id: s.rodadaAnalise.id });
    return linha.id;
  }

  // -------------------------------------------------------------------------
  // Dimensao de aprovacao

  it('a missao nasce em RASCUNHO de aprovacao, sem tocar o status de execucao', async () => {
    const [missao] = await ctx.db
      .select({
        status: s.missaoComite.status,
        aprovacao: s.missaoComite.statusAprovacao,
      })
      .from(s.missaoComite)
      .where(eq(s.missaoComite.id, missaoId));

    // As duas dimensoes sao independentes (CG-006): a missao pode estar
    // APROVADA e ainda PLANEJADA, ou CONCLUIDA tendo sido REPROVADA.
    expect(missao).toEqual({ status: 'RASCUNHO', aprovacao: 'RASCUNHO' });
  });

  // -------------------------------------------------------------------------
  // Rodadas

  it('numera as rodadas por missao, sem colidir entre missoes diferentes', async () => {
    await criarRodada({ numero: 1, encerradaEm: T_FECHO });
    await criarRodada({ numero: 2 });
    // A numeracao e por missao: a outra missao recomeca em 1.
    await criarRodada({ missaoId: outraMissaoId, numero: 1 });

    await esperarViolacao(
      ctx.db
        .insert(s.rodadaAnalise)
        .values(rodada({ numero: 2, encerradaEm: T_FECHO })),
      'rodada_analise_numero_uk',
    );
  });

  it('recusa duas rodadas abertas na mesma missao', async () => {
    await criarRodada({ numero: 1 });

    // Dois cliques em "enviar para analise" colocariam a missao duas vezes na
    // fila, e nada diria qual delas a decisao encerra.
    await esperarViolacao(
      ctx.db.insert(s.rodadaAnalise).values(rodada({ numero: 2 })),
      'rodada_analise_aberta_uk',
    );
  });

  it('permite nova rodada depois que a anterior foi encerrada', async () => {
    await criarRodada({ numero: 1, encerradaEm: T_FECHO });
    await expect(criarRodada({ numero: 2 })).resolves.toEqual(
      expect.any(String),
    );
  });

  it('exige justificativa na reabertura e a proibe na submissao', async () => {
    await esperarViolacao(
      ctx.db
        .insert(s.rodadaAnalise)
        .values(rodada({ numero: 1, origem: 'REABERTURA' })),
      'rodada_analise_justificativa_ck',
    );

    await esperarViolacao(
      ctx.db.insert(s.rodadaAnalise).values(
        rodada({
          numero: 1,
          origem: 'SUBMISSAO',
          justificativa: 'nao deveria estar aqui',
        }),
      ),
      'rodada_analise_justificativa_ck',
    );

    await expect(
      criarRodada({
        numero: 1,
        origem: 'REABERTURA',
        justificativa: 'Erro material no parecer anterior.',
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('recusa encerramento anterior a submissao', async () => {
    await esperarViolacao(
      ctx.db.insert(s.rodadaAnalise).values(
        rodada({
          submetidoEm: new Date('2027-04-10T12:00:00Z'),
          encerradaEm: new Date('2027-04-09T12:00:00Z'),
        }),
      ),
      'rodada_analise_encerramento_ck',
    );
  });

  // -------------------------------------------------------------------------
  // Decisoes

  it('aceita uma unica decisao por rodada', async () => {
    const rodadaId = await criarRodada();
    await ctx.db.insert(s.decisaoComite).values({
      rodadaId,
      acao: 'APROVAR',
      parecer: 'Missão alinhada ao plano da rede.',
      reuniaoData: '2027-04-07',
      decididoPorId: 'sub-relator',
    });

    // Duas decisoes na mesma rodada seriam dois estados finais para o mesmo
    // exame. A CG-039 cobre isso como concorrencia; aqui e o banco que impede.
    await esperarViolacao(
      ctx.db.insert(s.decisaoComite).values({
        rodadaId,
        acao: 'REPROVAR',
        parecer: 'Decisão concorrente.',
        reuniaoData: '2027-04-07',
      }),
      'decisao_comite_rodada_uk',
    );
  });

  it('exige a data da reuniao ao aprovar e ao reprovar', async () => {
    // Modelo B: a decisao terminal e do colegiado, e o parecer precisa dizer
    // em que reuniao ela aconteceu. A data e informada, nunca derivada — as
    // reunioes sao semanais, mas ha semanas sem reuniao.
    for (const acao of ['APROVAR', 'REPROVAR'] as const) {
      await ctx.limpar();
      base = await criarBase(ctx.db);
      const [missao] = await ctx.db
        .insert(s.missaoComite)
        .values({
          cicloId: base.cicloId,
          codigo: 'MCG-702',
          titulo: 'Missão sem reunião',
          objetivo: 'Testar check',
          dataInicio: '2027-04-01',
          dataFim: '2027-04-10',
        })
        .returning({ id: s.missaoComite.id });
      const [linha] = await ctx.db
        .insert(s.rodadaAnalise)
        .values({ missaoId: missao.id, numero: 1 })
        .returning({ id: s.rodadaAnalise.id });

      await esperarViolacao(
        ctx.db.insert(s.decisaoComite).values({
          rodadaId: linha.id,
          acao,
          parecer: 'Sem reunião informada.',
        }),
        'decisao_comite_reuniao_ck',
      );
    }
  });

  it('proibe data de reuniao ao solicitar ajustes', async () => {
    const rodadaId = await criarRodada();

    // Devolver para ajuste e ato do relator, nao deliberacao do colegiado:
    // registrar uma reuniao aqui afirmaria uma sessao que nao decidiu nada.
    await esperarViolacao(
      ctx.db.insert(s.decisaoComite).values({
        rodadaId,
        acao: 'SOLICITAR_AJUSTES',
        parecer: 'Falta o plano de trabalho.',
        reuniaoData: '2027-04-07',
      }),
      'decisao_comite_reuniao_ck',
    );

    await expect(
      ctx.db.insert(s.decisaoComite).values({
        rodadaId,
        acao: 'SOLICITAR_AJUSTES',
        parecer: 'Falta o plano de trabalho.',
      }),
    ).resolves.toBeDefined();
  });

  it('recusa parecer vazio ou so com espacos, inclusive ao aprovar', async () => {
    const rodadaId = await criarRodada();
    await esperarViolacao(
      ctx.db.insert(s.decisaoComite).values({
        rodadaId,
        acao: 'APROVAR',
        parecer: '   ',
        reuniaoData: '2027-04-07',
      }),
      'decisao_comite_parecer_ck',
    );
  });

  it('preserva todas as rodadas e decisoes de um vaivem completo', async () => {
    // Enviar -> ajustes -> reenviar -> aprovar -> reabrir -> reprovar.
    const primeira = await criarRodada({ numero: 1 });
    await ctx.db.insert(s.decisaoComite).values({
      rodadaId: primeira,
      acao: 'SOLICITAR_AJUSTES',
      parecer: 'Incluir a programação.',
    });
    await ctx.db
      .update(s.rodadaAnalise)
      .set({ encerradaEm: sql`now()` })
      .where(eq(s.rodadaAnalise.id, primeira));

    const segunda = await criarRodada({ numero: 2 });
    await ctx.db.insert(s.decisaoComite).values({
      rodadaId: segunda,
      acao: 'APROVAR',
      parecer: 'Programação anexada.',
      reuniaoData: '2027-04-14',
    });
    await ctx.db
      .update(s.rodadaAnalise)
      .set({ encerradaEm: sql`now()` })
      .where(eq(s.rodadaAnalise.id, segunda));

    const terceira = await criarRodada({
      numero: 3,
      origem: 'REABERTURA',
      justificativa: 'Documento falso identificado depois da aprovação.',
    });
    await ctx.db.insert(s.decisaoComite).values({
      rodadaId: terceira,
      acao: 'REPROVAR',
      parecer: 'Aprovação anterior baseada em documento inválido.',
      reuniaoData: '2027-04-21',
    });

    const decisoes = await ctx.db
      .select({ acao: s.decisaoComite.acao })
      .from(s.decisaoComite)
      .innerJoin(
        s.rodadaAnalise,
        eq(s.decisaoComite.rodadaId, s.rodadaAnalise.id),
      )
      .where(eq(s.rodadaAnalise.missaoId, missaoId))
      .orderBy(s.rodadaAnalise.numero);

    // A aprovacao do meio continua no historico: reprovar depois nao a apaga.
    expect(decisoes.map((d) => d.acao)).toEqual([
      'SOLICITAR_AJUSTES',
      'APROVAR',
      'REPROVAR',
    ]);
  });

  // -------------------------------------------------------------------------
  // Documentos analisados

  it('registra os documentos analisados e impede apagar o anexo citado', async () => {
    const rodadaId = await criarRodada();
    const [decisao] = await ctx.db
      .insert(s.decisaoComite)
      .values({
        rodadaId,
        acao: 'APROVAR',
        parecer: 'Documentação completa.',
        reuniaoData: '2027-04-07',
      })
      .returning({ id: s.decisaoComite.id });

    const [documento] = await ctx.db
      .insert(s.anexo)
      .values({
        nome: 'projeto.pdf',
        mimeType: 'application/pdf',
        tamanho: 1024,
        caminho: 'chave/opaca/projeto',
        categoria: 'PROJETO',
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
      })
      .returning({ id: s.anexo.id });

    await ctx.db
      .insert(s.decisaoDocumento)
      .values({ decisaoId: decisao.id, anexoId: documento.id, versao: 1 });

    // O mesmo documento nao entra duas vezes no mesmo parecer.
    await esperarViolacao(
      ctx.db
        .insert(s.decisaoDocumento)
        .values({ decisaoId: decisao.id, anexoId: documento.id }),
      'decisao_documento_uk',
    );

    // Um parecer nao pode perder a referencia do que examinou.
    await esperarViolacao(
      ctx.db.delete(s.anexo).where(eq(s.anexo.id, documento.id)),
      'decisao_documento_anexo_id_anexo_id_fk',
    );
  });

  // -------------------------------------------------------------------------
  // Requisitos configuraveis

  it('aceita requisitos como dado, obrigatorios e recomendados', async () => {
    // A decisao de 2026-09-05 proibe fechar a lista no codigo: um tipo novo de
    // missao nao pode ficar impedido de ser cadastrado por causa de constante.
    // `criarBase` monta um ciclo proprio, sem passar pela seed de producao, e
    // por isso comeca sem requisito nenhum.
    const antes = await ctx.db
      .select()
      .from(s.requisitoSubmissao)
      .where(eq(s.requisitoSubmissao.cicloId, base.cicloId));
    expect(antes).toEqual([]);

    await ctx.db.insert(s.requisitoSubmissao).values([
      { cicloId: base.cicloId, categoria: 'PROJETO', obrigatorio: true },
      { cicloId: base.cicloId, categoria: 'JUSTIFICATIVA', obrigatorio: true },
      { cicloId: base.cicloId, categoria: 'CONVITE', obrigatorio: false },
    ]);

    const gravados = await ctx.db
      .select({ obrigatorio: s.requisitoSubmissao.obrigatorio })
      .from(s.requisitoSubmissao)
      .where(eq(s.requisitoSubmissao.cicloId, base.cicloId));
    expect(gravados.filter((r) => r.obrigatorio)).toHaveLength(2);
    expect(gravados.filter((r) => !r.obrigatorio)).toHaveLength(1);
  });

  it('nao aceita a mesma exigencia geral duas vezes, mesmo com tipo nulo', async () => {
    await ctx.db
      .insert(s.requisitoSubmissao)
      .values({ cicloId: base.cicloId, categoria: 'PROJETO' });

    // Em Postgres dois NULL nao colidem: sem o indice parcial, "projeto para
    // todos os tipos" entraria quantas vezes quisessem.
    await esperarViolacao(
      ctx.db
        .insert(s.requisitoSubmissao)
        .values({ cicloId: base.cicloId, categoria: 'PROJETO' }),
      'requisito_submissao_geral_uk',
    );

    // A exigencia especifica de um tipo convive com a geral.
    await expect(
      ctx.db.insert(s.requisitoSubmissao).values({
        cicloId: base.cicloId,
        categoria: 'PROJETO',
        tipoMissao: 'EVENTO',
      }),
    ).resolves.toBeDefined();

    await esperarViolacao(
      ctx.db.insert(s.requisitoSubmissao).values({
        cicloId: base.cicloId,
        categoria: 'PROJETO',
        tipoMissao: 'EVENTO',
      }),
      'requisito_submissao_tipo_uk',
    );
  });

  it('separa os requisitos por momento, reservando o encerramento para a CG-058', async () => {
    await ctx.db.insert(s.requisitoSubmissao).values([
      { cicloId: base.cicloId, categoria: 'PROJETO', momento: 'SUBMISSAO' },
      { cicloId: base.cicloId, categoria: 'PROJETO', momento: 'ENCERRAMENTO' },
    ]);

    const submissao = await ctx.db
      .select()
      .from(s.requisitoSubmissao)
      .where(eq(s.requisitoSubmissao.momento, 'SUBMISSAO'));
    expect(submissao).toHaveLength(1);
  });
});
