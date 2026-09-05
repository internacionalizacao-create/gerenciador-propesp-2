import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { DecisaoService, decidirSchema } from '../src/dominio/decisao.service';
import { MissoesComiteService } from '../src/dominio/missoes-comite.service';
import { SubmissaoService } from '../src/dominio/submissao.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/** So o schema, para separar validacao de payload de regra de negocio. */
const aceita = (valor: unknown) => decidirSchema.safeParse(valor).success;

/**
 * A reuniao que delibera ja aconteceu, entao a data e sempre passada.
 *
 * Fixar `2027-06-25` porque a missao e de 2027 parece natural e esta errado: o
 * Comite aprova **antes** da viagem, e uma data futura e recusada de proposito.
 */
const REUNIAO = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const admin: AuthUser = {
  id: 'sub-admin',
  name: 'Admin',
  roles: ['admin'],
  permissions: ['missao:submit', 'missao:decide', 'missao:reopen'],
};

const relator: AuthUser = {
  id: 'sub-relator',
  name: 'Carla Relatora',
  email: 'carla@propesp.local',
  roles: ['comite-gestor'],
  permissions: ['missao:decide'],
};

/**
 * Decisoes e rodadas de ajuste (CG-038).
 *
 * O foco e o historico: nenhuma decisao pode ser apagada ou sobrescrita, e os
 * documentos analisados tem de continuar dizendo o que o Comite leu, mesmo
 * depois de a missao ganhar arquivos novos.
 */
describe('DecisaoService (CG-038)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let decisao: DecisaoService;
  let submissao: SubmissaoService;
  let missoes: MissoesComiteService;
  let missaoId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    const identidade = new IdentidadeService(ctx.db);
    decisao = new DecisaoService(ctx.db);
    submissao = new SubmissaoService(ctx.db, identidade);
    missoes = new MissoesComiteService(ctx.db);
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
        codigo: 'MCG-900',
        titulo: 'Missão a decidir',
        objetivo: 'Testar decisão',
        dataInicio: '2027-07-01',
        dataFim: '2027-07-10',
        tipo: 'VISITA_TECNICA',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      categoria: 'PROJETO',
      obrigatorio: true,
      descricao: 'Anexe o projeto.',
    });
  });

  const anexar = (nome: string, categoria: 'PROJETO' | 'CONVITE') =>
    ctx.db
      .insert(s.anexo)
      .values({
        nome,
        mimeType: 'application/pdf',
        tamanho: 512,
        caminho: `chave/${nome}`,
        categoria,
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
      })
      .returning({ id: s.anexo.id });

  /** Payload completo de edicao; `atualizar` reconcilia listas inteiras. */
  const edicaoValida = (titulo: string) =>
    ({
      titulo,
      objetivo: 'Objetivo suficientemente descrito para o schema.',
      dataInicio: '2027-07-01',
      dataFim: '2027-07-10',
      redes: [],
      participantes: [],
      atividades: [],
    }) as never;

  /** Deixa a missao em analise, que e o unico estado que recebe decisao. */
  async function emAnalise() {
    await anexar('projeto.pdf', 'PROJETO');
    return submissao.submeter(base.cicloId, missaoId, admin);
  }

  // -------------------------------------------------------------------------
  // Decisao

  it('aprova, encerra a rodada e move so a dimensao de aprovacao', async () => {
    await emAnalise();

    const resultado = await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Missão alinhada ao plano da rede.',
        reuniaoData: REUNIAO,
      },
      relator,
    );

    expect(resultado.statusAprovacao).toBe('APROVADA');

    const detalhe = await missoes.detalhe(base.cicloId, missaoId);
    expect(detalhe.statusAprovacao).toBe('APROVADA');
    // Aprovar habilita a confirmacao da realizacao; nao a executa.
    expect(detalhe.status).toBe('RASCUNHO');

    const [rodada] = await ctx.db.select().from(s.rodadaAnalise);
    expect(rodada.encerradaEm).not.toBeNull();
  });

  it('solicitar ajustes devolve a edicao ao responsavel', async () => {
    await emAnalise();
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Detalhar o roteiro.' },
      relator,
    );

    const detalhe = await missoes.detalhe(base.cicloId, missaoId);
    expect(detalhe.statusAprovacao).toBe('AJUSTES_SOLICITADOS');

    // Devolver a edicao e justamente o proposito desta decisao.
    const editada = await missoes.atualizar(
      base.cicloId,
      missaoId,
      edicaoValida('Título ajustado'),
      admin,
    );
    expect(editada.titulo).toBe('Título ajustado');
  });

  it('exige data de reuniao para aprovar e reprovar, e a proibe em ajustes', async () => {
    await emAnalise();

    // Modelo B: a decisao terminal e do colegiado e precisa dizer em que
    // reuniao aconteceu. Devolver para ajuste e ato do relator.
    expect(aceita({ acao: 'APROVAR', parecer: 'Ok.' })).toBe(false);
    expect(
      aceita({
        acao: 'SOLICITAR_AJUSTES',
        parecer: 'Faltou anexo.',
        reuniaoData: REUNIAO,
      }),
    ).toBe(false);
    expect(
      aceita({
        acao: 'REPROVAR',
        parecer: 'Fora do escopo.',
        reuniaoData: REUNIAO,
      }),
    ).toBe(true);
  });

  it('recusa reuniao no futuro', async () => {
    await emAnalise();
    const amanha = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    await expect(
      decisao.decidir(
        base.cicloId,
        missaoId,
        { acao: 'APROVAR', parecer: 'Ok.', reuniaoData: amanha },
        relator,
      ),
    ).rejects.toThrow(/futuro/i);
  });

  it('recusa decidir missao que nao esta em analise', async () => {
    await expect(
      decisao.decidir(
        base.cicloId,
        missaoId,
        { acao: 'APROVAR', parecer: 'Ok.', reuniaoData: REUNIAO },
        relator,
      ),
    ).rejects.toThrow(/somente missao em analise/i);
  });

  it('recusa duas decisoes na mesma rodada', async () => {
    await emAnalise();
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'APROVAR', parecer: 'Ok.', reuniaoData: REUNIAO },
      relator,
    );

    // A segunda ja nao encontra missao em analise; o banco tambem impediria.
    await expect(
      decisao.decidir(
        base.cicloId,
        missaoId,
        { acao: 'REPROVAR', parecer: 'Mudei de ideia.', reuniaoData: REUNIAO },
        relator,
      ),
    ).rejects.toThrow(/somente missao em analise/i);

    expect(await ctx.db.select().from(s.decisaoComite)).toHaveLength(1);
  });

  // -------------------------------------------------------------------------
  // Documentos analisados

  it('fotografa os documentos ativos no instante da decisao', async () => {
    await anexar('projeto.pdf', 'PROJETO');
    await anexar('convite.pdf', 'CONVITE');
    await submissao.submeter(base.cicloId, missaoId, admin);

    const resultado = await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Documentação completa.',
        reuniaoData: REUNIAO,
      },
      relator,
    );
    expect(resultado.documentosAnalisados).toBe(2);

    // Anexar depois **nao** muda o que o Comite diz ter analisado. Se a decisao
    // apontasse para "os anexos da missao", este upload reescreveria o parecer.
    await anexar('extra.pdf', 'CONVITE');
    const [historico] = await decisao.historico(base.cicloId, missaoId);
    expect(historico.decisao?.documentosAnalisados).toHaveLength(2);
  });

  it('documento inativo nao entra na fotografia', async () => {
    const [projeto] = await anexar('projeto.pdf', 'PROJETO');
    await anexar('convite.pdf', 'CONVITE');
    await submissao.submeter(base.cicloId, missaoId, admin);
    await ctx.db
      .update(s.anexo)
      .set({ ativo: false })
      .where(eq(s.anexo.id, projeto.id));

    const resultado = await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'APROVAR', parecer: 'Ok.', reuniaoData: REUNIAO },
      relator,
    );
    expect(resultado.documentosAnalisados).toBe(1);
  });

  it('decisao sem nenhum documento nao quebra', async () => {
    // Requisito recomendado apenas: e possivel submeter sem anexo.
    await ctx.db.delete(s.requisitoSubmissao);
    await submissao.submeter(base.cicloId, missaoId, admin);

    const resultado = await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'REPROVAR', parecer: 'Sem documentação.', reuniaoData: REUNIAO },
      relator,
    );
    expect(resultado.documentosAnalisados).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Reabertura

  it('reabre analise aprovada criando rodada nova, sem apagar a decisao', async () => {
    await emAnalise();
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'APROVAR', parecer: 'Aprovada.', reuniaoData: REUNIAO },
      relator,
    );

    const reaberta = await decisao.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Documento inválido descoberto depois.' },
      admin,
    );

    expect(reaberta.numero).toBe(2);
    expect(reaberta.statusAprovacao).toBe('EM_ANALISE');
    // A aprovacao anterior continua no historico.
    expect(await ctx.db.select().from(s.decisaoComite)).toHaveLength(1);
  });

  it('nao reabre missao que nunca foi decidida', async () => {
    await emAnalise();
    await expect(
      decisao.reabrir(
        base.cicloId,
        missaoId,
        { justificativa: 'Tentativa indevida.' },
        admin,
      ),
    ).rejects.toThrow(/ja decidida/i);
  });

  // -------------------------------------------------------------------------
  // Historico

  it('o historico traz todas as rodadas, da mais nova para a mais antiga', async () => {
    await emAnalise();
    await decisao.decidir(
      base.cicloId,
      missaoId,
      { acao: 'SOLICITAR_AJUSTES', parecer: 'Incluir programação.' },
      relator,
    );
    await submissao.submeter(base.cicloId, missaoId, admin);
    await decisao.decidir(
      base.cicloId,
      missaoId,
      {
        acao: 'APROVAR',
        parecer: 'Programação anexada.',
        reuniaoData: REUNIAO,
      },
      relator,
    );
    await decisao.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Revisão administrativa.' },
      admin,
    );

    const historico = await decisao.historico(base.cicloId, missaoId);

    expect(historico.map((r) => r.numero)).toEqual([3, 2, 1]);
    // A rodada aberta ainda nao tem decisao — e por isso e nulavel.
    expect(historico[0].decisao).toBeNull();
    expect(historico[0].origem).toBe('REABERTURA');
    expect(historico[0].justificativa).toBe('Revisão administrativa.');
    expect(historico[1].decisao?.acao).toBe('APROVAR');
    expect(historico[2].decisao?.acao).toBe('SOLICITAR_AJUSTES');
    expect(historico[1].decisao?.decididoPor).toBe('Carla Relatora');
  });

  it('missao de outro ciclo nao e alcancada', async () => {
    await expect(
      decisao.historico('11111111-1111-4111-8111-111111111111', missaoId),
    ).rejects.toThrow(/nao encontrada/i);
  });
});
