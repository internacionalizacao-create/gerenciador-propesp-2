import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import * as s from '../src/database/schema';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  MissoesComiteService,
  relatarMissaoSchema,
} from '../src/dominio/missoes-comite.service';
import { PrestacaoService } from '../src/dominio/prestacao.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-encerramento',
  name: 'Admin do Encerramento',
  roles: ['admin'],
  permissions: [
    'missao:read',
    'missao:write',
    'missao:decide',
    'prestacao:read',
    'prestacao:write',
    'prestacao:review',
  ],
};

/**
 * Checklist de encerramento (CG-058).
 *
 * O criterio de aceite tem duas metades, e as duas sao testadas aqui: missao so
 * encerra quando os requisitos aplicaveis estao satisfeitos **ou dispensados**,
 * e item nao aplicavel **nao bloqueia**.
 */
describe('Encerramento da missao (CG-058)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let encerramento: EncerramentoService;
  let missoes: MissoesComiteService;
  let prestacao: PrestacaoService;
  let resultados: ResultadosService;
  let missaoId: string;
  let paisId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    encerramento = new EncerramentoService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, encerramento);
    prestacao = new PrestacaoService(ctx.db);
    resultados = new ResultadosService(ctx.db);
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
    missaoId = (await criarMissao()).id;
  });

  async function criarMissao() {
    return missoes.criar(
      base.cicloId,
      {
        tipo: 'ARTICULACAO',
        titulo: 'Missao a encerrar',
        objetivo: 'Exercitar o checklist de encerramento.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
        status: 'CONFIRMADA',
        redes: [base.redeId],
        participantes: [
          {
            pessoaId: base.coordenadorTematicaId,
            papel: 'RESPONSAVEL',
          },
        ],
        atividades: [
          {
            tipo: 'ARTICULACAO',
            titulo: 'Visita institucional',
            paisId,
            cidade: 'Paris',
            dataInicio: '2027-05-02',
            dataFim: '2027-05-03',
          },
        ],
      } as never,
      admin,
    );
  }

  const chaves = (checklist: { itens: { chave: string }[] }) =>
    checklist.itens.map((item) => item.chave);

  const pendentes = (checklist: {
    itens: { chave: string; atendido: boolean; dispensa: unknown }[];
  }) =>
    checklist.itens
      .filter((item) => !item.atendido && !item.dispensa)
      .map((item) => item.chave)
      .sort();

  async function relatarTudo(
    id = missaoId,
    avaliacao: 'SIM' | 'PARCIALMENTE' | 'NAO' = 'SIM',
  ) {
    const missao = await missoes.detalhe(base.cicloId, id);
    await missoes.relatar(
      base.cicloId,
      id,
      relatarMissaoSchema.parse({
        relatoGeral: 'A missao ocorreu conforme o roteiro previsto.',
        avaliacaoObjetivos: avaliacao,
        avaliacaoJustificativa:
          avaliacao === 'SIM' ? undefined : 'Uma visita foi cancelada.',
        desdobramentos: 'Convite para uma segunda rodada em 2028.',
        atividades: missao.atividades.map((atividade) => ({
          id: atividade.id,
          status: 'REALIZADA',
          relatoRealizado: 'Atividade realizada.',
        })),
      }),
      admin,
    );
  }

  const responderSemProduto = (id = missaoId) =>
    resultados.responderProdutos(
      base.cicloId,
      id,
      { gerouProduto: false, justificativa: 'Articulacao inicial.' },
      admin,
    );

  async function prestacaoValidada(id = missaoId) {
    await prestacao.criar(base.cicloId, id, admin);
    await prestacao.criarDespesa(
      base.cicloId,
      id,
      {
        tipo: 'OUTRA',
        exercicio: 2027,
        valorTotal: '900.00',
        descricao: 'Inscricao em evento',
      } as never,
      admin,
    );
    await prestacao.enviar(base.cicloId, id, admin);
    await prestacao.validar(base.cicloId, id, {}, admin);
  }

  const concluir = (id = missaoId) =>
    missoes.transicionar(
      base.cicloId,
      id,
      { acao: 'CONCLUIR', justificativa: null },
      admin,
    );

  // -------------------------------------------------------------------------

  it('lista os cinco fatos, todos pendentes numa missao recem-criada', async () => {
    const checklist = await encerramento.checklist(base.cicloId, missaoId);

    expect(chaves(checklist)).toEqual([
      'RELATO_GERAL',
      'ATIVIDADES_RELATADAS',
      'PRODUTO_RESPONDIDO',
      'PRESTACAO_VALIDADA',
      'AVALIACAO_OBJETIVOS',
    ]);
    expect(checklist.podeEncerrar).toBe(false);
    expect(checklist.impedimento).toBeNull();
    expect(checklist.pendencias).toHaveLength(5);
  });

  it('missao sem roteiro marca o item como nao aplicavel, e ele continua na lista', async () => {
    // O cadastro exige ao menos uma atividade, entao o roteiro vazio so chega
    // por dado criado fora da API — seed ou importacao. Sem a marca, a linha
    // apareceria como "tudo relatado", que e verdade vazia: nao ha o que
    // relatar. Ela nao bloqueia nos dois casos; o que muda e o que a tela diz.
    await ctx.db
      .delete(s.atividadeMissao)
      .where(eq(s.atividadeMissao.missaoId, missaoId));

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    const item = checklist.itens.find(
      (linha) => linha.chave === 'ATIVIDADES_RELATADAS',
    )!;

    expect(item.aplicavel).toBe(false);
    expect(checklist.pendencias).not.toContain(item.comoResolver);
    // Some-lo faria a tela parecer incompleta, e ninguem saberia dizer se o
    // requisito nao existe ou se foi esquecido.
    expect(chaves(checklist)).toContain('ATIVIDADES_RELATADAS');
  });

  it('percorre o caminho completo e encerra', async () => {
    await relatarTudo();
    expect(
      pendentes(await encerramento.checklist(base.cicloId, missaoId)),
    ).toEqual(['PRESTACAO_VALIDADA', 'PRODUTO_RESPONDIDO']);

    await responderSemProduto();
    await prestacaoValidada();

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(checklist.podeEncerrar).toBe(true);
    expect(checklist.pendencias).toEqual([]);

    expect((await concluir()).status).toBe('CONCLUIDA');
  });

  it('cadastrar produto responde a pergunta tanto quanto declarar que nao houve', async () => {
    await relatarTudo();
    await prestacaoValidada();

    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      {
        tipo: 'REDE_PESQUISA',
        titulo: 'Rede de pesquisa em clima e ambiente',
        descricao: 'Formada a partir das reunioes da missao.',
      } as never,
      admin,
    );

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(
      checklist.itens.find((i) => i.chave === 'PRODUTO_RESPONDIDO')?.atendido,
    ).toBe(true);
    expect(checklist.podeEncerrar).toBe(true);
  });

  // ------------------------------------------------------------- dispensa --

  it('a dispensa destrava o encerramento e fica no historico', async () => {
    await relatarTudo();
    await responderSemProduto();

    // Missao sem despesa nunca chega a VALIDADA: prestacao sem lancamento nao e
    // enviada (CG-054). A dispensa e a saida decidida para esse caso.
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    const depois = await encerramento.dispensar(
      base.cicloId,
      missaoId,
      {
        chave: 'PRESTACAO_VALIDADA',
        justificativa: 'A missao nao gerou despesa nenhuma.',
      },
      admin,
    );

    const item = depois.itens.find((i) => i.chave === 'PRESTACAO_VALIDADA')!;
    expect(item.atendido).toBe(false);
    // Dispensado nao vira "atendido": o requisito continua nao cumprido, e a
    // tela precisa poder dizer que a missao fechou com uma excecao.
    expect(item.dispensa?.justificativa).toBe(
      'A missao nao gerou despesa nenhuma.',
    );
    expect(depois.podeEncerrar).toBe(true);
    expect((await concluir()).status).toBe('CONCLUIDA');

    const [auditoria] = await ctx.db
      .select({
        campo: s.registroAuditoria.campo,
        justificativa: s.registroAuditoria.justificativa,
      })
      .from(s.registroAuditoria)
      .where(
        eq(
          s.registroAuditoria.campo,
          'dispensaEncerramento.PRESTACAO_VALIDADA',
        ),
      );
    expect(auditoria.justificativa).toBe('A missao nao gerou despesa nenhuma.');
  });

  it('recusa dispensar requisito que nao existe ou que ja foi atendido', async () => {
    await expect(
      encerramento.dispensar(
        base.cicloId,
        missaoId,
        { chave: 'INVENTADO', justificativa: 'Nao deveria funcionar.' },
        admin,
      ),
    ).rejects.toThrow(/não faz parte do encerramento/i);

    await relatarTudo();
    await expect(
      encerramento.dispensar(
        base.cicloId,
        missaoId,
        { chave: 'RELATO_GERAL', justificativa: 'Nao ha o que dispensar.' },
        admin,
      ),
    ).rejects.toThrow(/já atendido/i);
  });

  it('revogar tira a dispensa do calculo e preserva a linha', async () => {
    await relatarTudo();
    await responderSemProduto();
    await encerramento.dispensar(
      base.cicloId,
      missaoId,
      { chave: 'PRESTACAO_VALIDADA', justificativa: 'Missao sem despesa.' },
      admin,
    );

    const depois = await encerramento.revogarDispensa(
      base.cicloId,
      missaoId,
      {
        chave: 'PRESTACAO_VALIDADA',
        justificativa: 'Apareceram notas fiscais a lancar.',
      },
      admin,
    );
    expect(depois.podeEncerrar).toBe(false);
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    // A dispensa foi o que autorizou encerrar sem o requisito; apagar a linha
    // apagaria a explicacao.
    const linhas = await ctx.db
      .select({ revogadaEm: s.dispensaRequisitoEncerramento.revogadaEm })
      .from(s.dispensaRequisitoEncerramento)
      .where(eq(s.dispensaRequisitoEncerramento.missaoId, missaoId));
    expect(linhas).toHaveLength(1);
    expect(linhas[0].revogadaEm).not.toBeNull();

    // E dispensar de novo depois de revogar tem que funcionar: o indice de
    // unicidade e parcial exatamente por isso.
    const redispensada = await encerramento.dispensar(
      base.cicloId,
      missaoId,
      { chave: 'PRESTACAO_VALIDADA', justificativa: 'As notas nao vieram.' },
      admin,
    );
    expect(redispensada.podeEncerrar).toBe(true);
  });

  // ------------------------------------------------------------ avaliacao --

  it('avaliacao diferente de SIM exige justificativa, e SIM nao carrega uma', async () => {
    expect(
      relatarMissaoSchema.safeParse({
        relatoGeral: 'Relato geral suficientemente descritivo.',
        avaliacaoObjetivos: 'NAO',
      }).success,
    ).toBe(false);
    expect(
      relatarMissaoSchema.safeParse({
        relatoGeral: 'Relato geral suficientemente descritivo.',
        avaliacaoJustificativa: 'Justificativa sem resposta.',
      }).success,
    ).toBe(false);

    await relatarTudo(missaoId, 'PARCIALMENTE');
    const parcial = await missoes.detalhe(base.cicloId, missaoId);
    expect(parcial.avaliacaoObjetivos).toBe('PARCIALMENTE');
    expect(parcial.avaliacaoJustificativa).toBe('Uma visita foi cancelada.');

    // Trocar para SIM limpa a justificativa: manter a explicacao de um
    // insucesso que nao existe mais faria a tela contradizer a resposta.
    await relatarTudo(missaoId, 'SIM');
    const plena = await missoes.detalhe(base.cicloId, missaoId);
    expect(plena.avaliacaoObjetivos).toBe('SIM');
    expect(plena.avaliacaoJustificativa).toBeNull();
    expect(plena.desdobramentos).toBe(
      'Convite para uma segunda rodada em 2028.',
    );
  });

  // ------------------------------------------------------------ documentos --

  it('documento exigido no encerramento vem do banco, nunca de constante', async () => {
    await relatarTudo();
    await responderSemProduto();
    await prestacaoValidada();
    expect(
      (await encerramento.checklist(base.cicloId, missaoId)).podeEncerrar,
    ).toBe(true);

    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      momento: 'ENCERRAMENTO',
      categoria: 'ATA',
      obrigatorio: true,
      descricao: 'Ata da reuniao de encerramento.',
    });

    // A exigencia nova passa a valer sem deploy — e a razao de a lista ser
    // dado, decidida na CG-019.
    const comRequisito = await encerramento.checklist(base.cicloId, missaoId);
    expect(chaves(comRequisito)).toContain('DOCUMENTO:ATA');
    expect(comRequisito.podeEncerrar).toBe(false);
    expect(comRequisito.pendencias).toContain(
      'Ata da reuniao de encerramento.',
    );
    await expect(concluir()).rejects.toMatchObject({ status: 422 });

    await ctx.db.insert(s.anexo).values({
      entidadeTipo: 'MISSAO_COMITE',
      entidadeId: missaoId,
      categoria: 'ATA',
      nome: 'ata.pdf',
      mimeType: 'application/pdf',
      tamanho: 1024,
      caminho: 'teste/ata.pdf',
      hashSha256: 'a'.repeat(64),
    });

    expect(
      (await encerramento.checklist(base.cicloId, missaoId)).podeEncerrar,
    ).toBe(true);
    expect((await concluir()).status).toBe('CONCLUIDA');
  });

  it('requisito de outro tipo de missao nao entra no checklist desta', async () => {
    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      momento: 'ENCERRAMENTO',
      tipoMissao: 'VISITA_TECNICA',
      categoria: 'CERTIFICADO',
      obrigatorio: true,
    });

    // A missao e ARTICULACAO: exigir dela o documento de outro tipo seria
    // pendencia sem acao possivel.
    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(chaves(checklist)).not.toContain('DOCUMENTO:CERTIFICADO');
  });

  it('requisito documental opcional aparece, mas nao bloqueia', async () => {
    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      momento: 'ENCERRAMENTO',
      categoria: 'NOTICIA',
      obrigatorio: false,
      descricao: 'Materia publicada sobre a missao.',
    });
    await relatarTudo();
    await responderSemProduto();
    await prestacaoValidada();

    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    const item = checklist.itens.find((i) => i.chave === 'DOCUMENTO:NOTICIA')!;
    expect(item.obrigatorio).toBe(false);
    expect(item.atendido).toBe(false);
    expect(checklist.podeEncerrar).toBe(true);
  });

  // ---------------------------------------------------------- impedimentos --

  it('estado errado e impedimento, nao pendencia', async () => {
    await relatarTudo();
    await responderSemProduto();
    await prestacaoValidada();
    await concluir();

    // Nao ha o que anexar ou preencher para resolver; separar os dois evita a
    // tela oferecer uma acao que nao existe.
    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(checklist.pendencias).toEqual([]);
    expect(checklist.podeEncerrar).toBe(false);
    expect(checklist.impedimento).toMatch(/já foi encerrada/i);
  });

  it('requisito documental so exigido no encerramento nao afeta a submissao', async () => {
    await ctx.db.insert(s.requisitoSubmissao).values({
      cicloId: base.cicloId,
      momento: 'ENCERRAMENTO',
      categoria: 'ATA',
      obrigatorio: true,
    });

    // Os dois momentos leem a mesma tabela, e trocar um pelo outro faria a
    // missao pedir a ata para ser enviada a analise.
    const checklist = await encerramento.checklist(base.cicloId, missaoId);
    expect(chaves(checklist)).toContain('DOCUMENTO:ATA');

    const requisitos = await ctx.db
      .select({ momento: s.requisitoSubmissao.momento })
      .from(s.requisitoSubmissao)
      .where(eq(s.requisitoSubmissao.cicloId, base.cicloId));
    expect(requisitos.every((r) => r.momento === 'ENCERRAMENTO')).toBe(true);
  });
});
