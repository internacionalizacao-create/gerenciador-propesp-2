import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { RecorteDeMissoes } from '../src/auth/escopo';
import * as s from '../src/database/schema';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  MissoesComiteService,
  relatarMissaoSchema,
} from '../src/dominio/missoes-comite.service';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-cg059',
  name: 'Admin dos Resultados',
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
    'missao:decide',
    'parceiro:read',
    'parceiro:create',
    'parceiro:edit',
    'parceiro:status',
    'parceiro:merge',
    'convenio:create',
    'convenio:edit',
    'convenio:status',
    'prestacao:read',
    'prestacao:create',
    'prestacao:edit',
    'prestacao:delete',
    'prestacao:submit',
    'prestacao:review',
  ],
};

/**
 * Resultados e encerramento, ponta a ponta (CG-059).
 *
 * Auditei o que a CG-056 e a CG-058 ja cobriam antes de escrever: resposta
 * negativa, checklist condicional, dispensa e encerramento incompleto ja tinham
 * regressao. O que faltava atravessa os dois modulos — varios produtos na mesma
 * missao, missao que nao aconteceu, convenio multilateral chegando ao historico
 * do parceiro e, sobretudo, **o que acontece com o checklist depois que a
 * missao fecha**.
 *
 * Fora de alcance: evidencia privada depende da galeria da CG-057, que nao
 * existe. O eixo de visibilidade ja esta no schema (`visibilidade_anexo`), mas
 * testa-lo sem a tela que o consome fixaria uma promessa, nao um comportamento.
 */
describe('Resultados e encerramento (CG-059)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let missoes: MissoesComiteService;
  let encerramento: EncerramentoService;
  let resultados: ResultadosService;
  let parceiros: ParceirosService;
  let missaoId: string;
  let paisId: string;
  let parceiroId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    encerramento = new EncerramentoService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, encerramento);
    resultados = new ResultadosService(ctx.db);
    parceiros = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' })
      .returning({ id: s.pais.id });
    paisId = pais.id;

    const [parceiro] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Université de Toulouse',
        nomeNormalizado: normalizarNomeInstituicao('Université de Toulouse'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });
    parceiroId = parceiro.id;

    missaoId = (await criarMissao()).id;
  });

  async function criarMissao() {
    return missoes.criar(
      base.cicloId,
      {
        tipo: 'ARTICULACAO',
        titulo: 'Missao com resultados',
        objetivo: 'Exercitar resultados e encerramento juntos.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
        status: 'CONFIRMADA',
        redes: [base.redeId],
        participantes: [
          { pessoaId: base.coordenadorTematicaId, papel: 'RESPONSAVEL' },
        ],
        atividades: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Visita institucional',
            paisId,
            cidade: 'Toulouse',
            dataInicio: '2027-05-02',
            dataFim: '2027-05-03',
          },
        ],
      } as never,
      admin,
      RecorteDeMissoes.irrestrito(),
    );
  }

  const produto = (titulo: string, tipo = 'PUBLICACAO') =>
    ({
      tipo,
      titulo,
      situacao: 'PREVISTO',
      ano: 2027,
      instituicoesIds: [],
      redesIds: [],
      responsaveis: [],
    }) as never;

  async function relatar(
    avaliacao: 'SIM' | 'PARCIALMENTE' | 'NAO' = 'SIM',
    statusAtividade: 'REALIZADA' | 'NAO_REALIZADA' = 'REALIZADA',
  ) {
    const missao = await missoes.detalhe(base.cicloId, missaoId);
    await missoes.relatar(
      base.cicloId,
      missaoId,
      relatarMissaoSchema.parse({
        relatoGeral: 'Registro do que aconteceu na missao institucional.',
        avaliacaoObjetivos: avaliacao,
        avaliacaoJustificativa:
          avaliacao === 'SIM' ? undefined : 'A contraparte cancelou a agenda.',
        atividades: missao.atividades.map((atividade) => ({
          id: atividade.id,
          status: statusAtividade,
          relatoRealizado:
            statusAtividade === 'REALIZADA' ? 'Reuniao realizada.' : undefined,
        })),
      }),
      admin,
    );
  }

  const dispensarPrestacao = () =>
    encerramento.dispensar(
      base.cicloId,
      missaoId,
      {
        chave: 'PRESTACAO_VALIDADA',
        justificativa: 'Missao sem despesa a prestar.',
      },
      admin,
    );

  const concluir = () =>
    missoes.transicionar(
      base.cicloId,
      missaoId,
      { acao: 'CONCLUIR', justificativa: null },
      admin,
    );

  // --------------------------------------------------------- varios produtos

  it('a missao carrega varios produtos, e remover um nao reabre a pergunta', async () => {
    for (const [titulo, tipo] of [
      ['Artigo conjunto sobre a Amazonia', 'PUBLICACAO'],
      ['Rede de pesquisa em clima', 'REDE_PESQUISA'],
      ['Tese em cotutela', 'TESE_COTUTELA'],
    ] as const) {
      await resultados.criarProduto(
        base.cicloId,
        missaoId,
        produto(titulo, tipo),
        admin,
      );
    }

    const tres = await resultados.resultadosDaMissao(base.cicloId, missaoId);
    expect(tres.produtos).toHaveLength(3);
    expect(tres.respostaProduto).toBe('SIM');

    await resultados.removerProduto(
      base.cicloId,
      missaoId,
      tres.produtos[0].id,
      admin,
    );
    const dois = await resultados.resultadosDaMissao(base.cicloId, missaoId);
    // Ainda ha produto: a resposta continua "sim". So o **ultimo** produto
    // removido devolveria a pergunta ao indefinido.
    expect(dois.produtos).toHaveLength(2);
    expect(dois.respostaProduto).toBe('SIM');

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(
      checklist.itens.find((i) => i.chave === 'PRODUTO_RESPONDIDO')?.atendido,
    ).toBe(true);
  });

  it('nao aceita declarar ausencia com varios produtos cadastrados', async () => {
    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produto('Artigo conjunto'),
      admin,
    );
    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produto('Rede de pesquisa', 'REDE_PESQUISA'),
      admin,
    );

    await expect(
      resultados.responderProdutos(
        base.cicloId,
        missaoId,
        { gerouProduto: false, justificativa: 'Nao gerou nada.' },
        admin,
      ),
    ).rejects.toThrow(/remova-o antes/i);
  });

  // ---------------------------------------------------- missao nao realizada

  it('missao que nao aconteceu encerra, com a avaliacao dizendo isso', async () => {
    // Roteiro inteiro NAO_REALIZADA continua sendo roteiro relatado: o
    // requisito e dizer o que houve, nao ter dado certo. Bloquear aqui
    // deixaria a missao frustrada aberta para sempre.
    await relatar('NAO', 'NAO_REALIZADA');
    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'A missao nao se realizou.' },
      admin,
    );
    await dispensarPrestacao();

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(checklist.podeEncerrar).toBe(true);

    const concluida = await concluir();
    expect(concluida.status).toBe('CONCLUIDA');
    expect(concluida.avaliacaoObjetivos).toBe('NAO');
    expect(concluida.avaliacaoJustificativa).toBe(
      'A contraparte cancelou a agenda.',
    );
  });

  it('missao cancelada nao encerra, e o motivo e impedimento', async () => {
    await relatar();
    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'Sem produto.' },
      admin,
    );
    await dispensarPrestacao();
    await missoes.transicionar(
      base.cicloId,
      missaoId,
      { acao: 'CANCELAR', justificativa: 'Recurso contingenciado.' },
      admin,
    );

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    // Todos os requisitos estao satisfeitos e ainda assim nao encerra: o que
    // impede nao e pendencia, e nao ha o que preencher para resolver.
    expect(checklist.pendencias).toEqual([]);
    expect(checklist.podeEncerrar).toBe(false);
    expect(checklist.impedimento).toMatch(/cancelada não encerra/i);
    await expect(concluir()).rejects.toMatchObject({ status: 409 });
  });

  // --------------------------------------------- missao encerrada e depois --

  it('missao encerrada nao volta a "resposta indefinida"', async () => {
    await relatar();
    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produto('Artigo conjunto'),
      admin,
    );
    await dispensarPrestacao();
    await concluir();

    // Encerrar afirma que os requisitos foram atendidos. Remover o unico
    // produto depois faria essa afirmacao virar mentira em silencio — e o
    // checklist, que e recalculado, passaria a acusar pendencia numa missao
    // fechada. E o mesmo risco da CG-038, onde a fotografia dos documentos
    // impede que um upload posterior reescreva o que o Comite leu.
    const [unico] = (
      await resultados.resultadosDaMissao(base.cicloId, missaoId)
    ).produtos;
    await expect(
      resultados.removerProduto(base.cicloId, missaoId, unico.id, admin),
    ).rejects.toThrow(/encerrada/i);

    const depois = await encerramento.checklist(base.cicloId, missaoId);
    expect(depois.pendencias).toEqual([]);
  });

  it('missao encerrada continua aceitando produto novo e edicao', async () => {
    await relatar();
    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'Nada ainda.' },
      admin,
    );
    await dispensarPrestacao();
    await concluir();

    // Produto que aparece depois — o artigo publicado meses apos a viagem — e
    // o caso normal, nao a excecao. Congelar tudo empurraria o registro para
    // fora do sistema.
    const criado = await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produto('Artigo publicado apos a missao'),
      admin,
    );
    expect(criado.produtos).toHaveLength(1);
    expect(criado.respostaProduto).toBe('SIM');

    const editado = await resultados.atualizarProduto(
      base.cicloId,
      missaoId,
      criado.produtos[0].id,
      { situacao: 'CONCLUIDO' } as never,
      admin,
    );
    expect(editado.produtos[0].situacao).toBe('CONCLUIDO');
  });

  it('reabrir devolve a missao ao fluxo e preserva a dispensa', async () => {
    await relatar();
    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'Sem produto.' },
      admin,
    );
    await dispensarPrestacao();
    await concluir();

    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Reabertura autorizada pela pro-reitoria.' },
      admin,
    );

    // A dispensa e da missao, nao do encerramento: perde-la na reabertura
    // obrigaria a justificar de novo o que ja foi justificado.
    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(
      checklist.itens.find((i) => i.chave === 'PRESTACAO_VALIDADA')?.dispensa
        ?.justificativa,
    ).toBe('Missao sem despesa a prestar.');
    // Mas a missao voltou para PLANEJADA, e dai nao se encerra direto.
    expect(checklist.impedimento).toMatch(/precisa ser confirmada/i);

    await missoes.transicionar(
      base.cicloId,
      missaoId,
      { acao: 'CONFIRMAR', justificativa: null },
      admin,
    );
    expect((await concluir()).status).toBe('CONCLUIDA');
  });

  it('reabrir libera de novo a remocao do ultimo produto', async () => {
    await relatar();
    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produto('Artigo lancado por engano'),
      admin,
    );
    await dispensarPrestacao();
    await concluir();

    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Produto cadastrado por engano.' },
      admin,
    );

    // A reabertura e a saida administrativa: existe justamente para corrigir o
    // que o encerramento congelou, e deixa rastro de quem autorizou.
    const [unico] = (
      await resultados.resultadosDaMissao(base.cicloId, missaoId)
    ).produtos;
    const depois = await resultados.removerProduto(
      base.cicloId,
      missaoId,
      unico.id,
      admin,
    );
    expect(depois.respostaProduto).toBe('NAO_INFORMADO');
  });

  // ------------------------------------------------- convenio multilateral --

  it('convenio de tres redes chega ao historico do parceiro uma unica vez', async () => {
    const outras = await ctx.db
      .insert(s.redeCoordenadora)
      .values([
        {
          cicloId: base.cicloId,
          instituicaoId: base.instituicaoId,
          nome: 'REDE-DOIS',
          statusOrcamento: 'DEFINIDO' as const,
        },
        {
          cicloId: base.cicloId,
          instituicaoId: base.instituicaoId,
          nome: 'REDE-TRES',
          statusOrcamento: 'DEFINIDO' as const,
        },
      ])
      .returning({ id: s.redeCoordenadora.id });

    const convenio = await resultados.criarConvenio(
      {
        instituicaoId: parceiroId,
        titulo: 'Acordo trilateral de cooperacao',
        tipoAcordo: 'COOPERACAO_TECNICA',
        situacao: 'EM_TRAMITACAO',
        dataInicio: '2027-06-01',
        missaoOrigemId: missaoId,
        redesIds: [base.redeId, outras[0].id, outras[1].id],
      } as never,
      admin,
    );

    // Produto do tipo CONVENIO exige o acordo apontado, e e por ele que o
    // convenio aparece como resultado da missao.
    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      {
        tipo: 'CONVENIO',
        titulo: 'Acordo trilateral de cooperacao',
        situacao: 'PREVISTO',
        convenioId: convenio.id,
        instituicoesIds: [parceiroId],
        redesIds: [],
        responsaveis: [],
      } as never,
      admin,
    );

    const historico = await parceiros.historico(parceiroId);
    // Tres redes num convenio nao sao tres convenios. `join` com
    // `convenio_rede` devolveria a mesma linha tres vezes — e o produto que
    // aponta o acordo daria a quarta.
    expect(historico.convenios).toHaveLength(1);
    expect(historico.convenios[0].id).toBe(convenio.id);
    expect(historico.produtos).toHaveLength(1);

    // As tres redes estao mesmo la; a leitura e que nao as multiplica.
    const vinculos = await ctx.db
      .select({ redeId: s.convenioRede.redeId })
      .from(s.convenioRede)
      .where(eq(s.convenioRede.convenioId, convenio.id));
    expect(vinculos).toHaveLength(3);
  });

  // ------------------------------------------------------------- auditoria --

  it('o encerramento deixa rastro do que foi dispensado e de quem encerrou', async () => {
    await relatar('PARCIALMENTE');
    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'Sem produto formal.' },
      admin,
    );
    await dispensarPrestacao();
    await concluir();

    const trilha = await ctx.db
      .select({
        campo: s.registroAuditoria.campo,
        valorNovo: s.registroAuditoria.valorNovo,
        justificativa: s.registroAuditoria.justificativa,
      })
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, missaoId))
      .orderBy(s.registroAuditoria.ocorridoEm);

    const campos = trilha.map((linha) => linha.campo);
    expect(campos).toContain('avaliacaoObjetivos');
    expect(campos).toContain('dispensaEncerramento.PRESTACAO_VALIDADA');
    expect(campos).toContain('status');
    // Sem a justificativa da dispensa no historico, ninguem consegue explicar
    // meses depois por que a missao fechou sem prestacao validada.
    expect(
      trilha.find((l) => l.campo === 'dispensaEncerramento.PRESTACAO_VALIDADA')
        ?.justificativa,
    ).toBe('Missao sem despesa a prestar.');
    expect(
      trilha.filter((l) => l.campo === 'status').map((l) => l.valorNovo),
    ).toContain('CONCLUIDA');
  });
});
