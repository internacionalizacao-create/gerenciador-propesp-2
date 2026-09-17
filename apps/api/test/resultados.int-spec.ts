import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import * as s from '../src/database/schema';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

const admin: AuthUser = {
  id: 'admin-resultados',
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
    'parceiro:read',
    'parceiro:create',
    'parceiro:edit',
    'parceiro:status',
    'parceiro:merge',
    'convenio:create',
    'convenio:edit',
    'convenio:status',
  ],
};

/**
 * Produtos da missao e convenios (CG-056).
 *
 * O criterio de aceite tem duas metades, e as duas sao testadas aqui: missao
 * sem produto **registra a resposta negativa** (nao fica ambigua), e o convenio
 * **alimenta o historico do parceiro sem duplicar instituicao**.
 */
describe('Produtos da missao e convenios (CG-056)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ResultadosService;
  let parceiros: ParceirosService;
  let missaoId: string;
  /** Convenio se firma com parceiro internacional, nao com a propria rede. */
  let parceiroId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ResultadosService(ctx.db);
    parceiros = new ParceirosService(ctx.db);
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
        titulo: 'Missão com resultados',
        objetivo: 'Testar produtos e convênios',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
      })
      .returning({ id: s.missaoComite.id });
    missaoId = missao.id;

    const [parceiro] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Université de Toulouse',
        nomeNormalizado: normalizarNomeInstituicao('Université de Toulouse'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });
    parceiroId = parceiro.id;
  });

  const convenioValido = () => ({
    instituicaoId: parceiroId,
    titulo: 'Acordo de cooperação acadêmica',
    tipoAcordo: 'COOPERACAO_TECNICA' as const,
    area: 'Biodiversidade',
    objetivo: 'Intercâmbio de pesquisadores',
    situacao: 'EM_TRAMITACAO' as const,
    numeroProcesso: null,
    dataAssinatura: null,
    dataInicio: '2027-06-01',
    dataFim: null,
    observacoes: null,
    missaoOrigemId: missaoId,
    redesIds: [base.redeId],
  });

  const produtoValido = () => ({
    tipo: 'PUBLICACAO' as const,
    titulo: 'Artigo conjunto sobre a Amazônia',
    descricao: null,
    situacao: 'PREVISTO' as const,
    ano: 2027,
    referencia: null,
    observacoes: null,
    convenioId: null,
    instituicoesIds: [] as string[],
    redesIds: [] as string[],
    responsaveis: [] as { pessoaId: string; papel: string | null }[],
  });

  // ------------------------------------------------------ resposta produto --

  it('missao recem-criada nao afirma nem nega ter gerado produto', async () => {
    const resultados = await service.resultadosDaMissao(base.cicloId, missaoId);
    expect(resultados.respostaProduto).toBe('NAO_INFORMADO');
    expect(resultados.declaracaoSemProduto).toBeNull();
    expect(resultados.produtos).toHaveLength(0);
  });

  it('registra a resposta negativa com autor e justificativa', async () => {
    const resultados = await service.responderProdutos(
      base.cicloId,
      missaoId,
      {
        gerouProduto: false,
        justificativa: 'Missão exploratória, sem produto.',
      },
      admin,
    );
    expect(resultados.respostaProduto).toBe('NAO');
    expect(resultados.declaracaoSemProduto?.declaradoPor).toBe(
      'Admin dos Resultados',
    );
    expect(resultados.declaracaoSemProduto?.justificativa).toBe(
      'Missão exploratória, sem produto.',
    );
  });

  it('nao aceita declarar ausencia de produto com produto cadastrado', async () => {
    await service.criarProduto(base.cicloId, missaoId, produtoValido(), admin);
    await expect(
      service.responderProdutos(
        base.cicloId,
        missaoId,
        { gerouProduto: false, justificativa: null },
        admin,
      ),
    ).rejects.toThrow(/produto cadastrado/i);
  });

  it('cadastrar produto retira a declaracao negativa anterior', async () => {
    await service.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: null },
      admin,
    );
    const resultados = await service.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      admin,
    );
    expect(resultados.respostaProduto).toBe('SIM');
    expect(resultados.declaracaoSemProduto).toBeNull();

    const auditoria = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.campo, 'semProdutoDeclaradoEm'));
    // Uma entrada da declaracao e outra da retirada: o vaivem tem de aparecer.
    expect(auditoria).toHaveLength(2);
  });

  it('responder "sim" apenas retira a declaracao, sem afirmar produto', async () => {
    await service.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: null },
      admin,
    );
    const resultados = await service.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: true, justificativa: null },
      admin,
    );
    expect(resultados.respostaProduto).toBe('NAO_INFORMADO');
  });

  it('o banco recusa declaracao sem autor', async () => {
    await esperarViolacao(
      ctx.db
        .update(s.missaoComite)
        .set({ semProdutoDeclaradoEm: new Date() })
        .where(eq(s.missaoComite.id, missaoId)),
      'missao_comite_sem_produto_ck',
    );
  });

  // --------------------------------------------------------------- produto --

  it('missao cancelada nao recebe resultado', async () => {
    await ctx.db
      .update(s.missaoComite)
      .set({ status: 'CANCELADA' })
      .where(eq(s.missaoComite.id, missaoId));
    await expect(
      service.criarProduto(base.cicloId, missaoId, produtoValido(), admin),
    ).rejects.toThrow(/cancelada/i);
  });

  it('missao de outro ciclo nao e encontrada', async () => {
    const [outro] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2031-2034',
        anoInicio: 2031,
        anoFim: 2034,
      })
      .returning({ id: s.ciclo.id });
    await expect(
      service.resultadosDaMissao(outro.id, missaoId),
    ).rejects.toThrow(/não encontrada/i);
  });

  it('produto do tipo convenio exige o acordo, e o inverso tambem', async () => {
    await expect(
      service.criarProduto(
        base.cicloId,
        missaoId,
        { ...produtoValido(), tipo: 'CONVENIO' },
        admin,
      ),
    ).rejects.toThrow();

    const convenio = await service.criarConvenio(convenioValido(), admin);
    await expect(
      service.criarProduto(
        base.cicloId,
        missaoId,
        { ...produtoValido(), tipo: 'PUBLICACAO', convenioId: convenio.id },
        admin,
      ),
    ).rejects.toThrow();
  });

  it('o banco recusa a mesma combinacao invalida', async () => {
    await esperarViolacao(
      ctx.db.insert(s.produtoMissao).values({
        missaoId,
        tipo: 'CONVENIO',
        titulo: 'Convênio sem acordo',
      }),
      'produto_missao_convenio_ck',
    );
  });

  it('nao duplica o produto que tem varias instituicoes e redes', async () => {
    const [outraInstituicao] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome: 'Universidade Parceira',
        nomeNormalizado: normalizarNomeInstituicao('Universidade Parceira'),
        tipo: 'PARCEIRA_INTERNACIONAL',
      })
      .returning({ id: s.instituicao.id });
    const [outraRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-TESTE-2',
      })
      .returning({ id: s.redeCoordenadora.id });

    const resultados = await service.criarProduto(
      base.cicloId,
      missaoId,
      {
        ...produtoValido(),
        instituicoesIds: [base.instituicaoId, outraInstituicao.id],
        redesIds: [base.redeId, outraRede.id],
        responsaveis: [
          { pessoaId: base.coordenadorTematicaId, papel: 'Coordenação' },
        ],
      },
      admin,
    );

    // Um join com as tres colecoes daria 1 x 2 x 2 x 1 = 4 linhas do mesmo
    // produto. A leitura tem de continuar devolvendo um.
    expect(resultados.produtos).toHaveLength(1);
    expect(resultados.produtos[0].instituicoes).toHaveLength(2);
    expect(resultados.produtos[0].redes).toHaveLength(2);
    expect(resultados.produtos[0].responsaveis[0].papel).toBe('Coordenação');
  });

  it('recusa rede de outro ciclo no produto', async () => {
    const [outroCiclo] = await ctx.db
      .insert(s.ciclo)
      .values({
        programaId: base.programaId,
        nome: '2035-2038',
        anoInicio: 2035,
        anoFim: 2038,
      })
      .returning({ id: s.ciclo.id });
    const [redeDeOutroCiclo] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: outroCiclo.id,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-OUTRO-CICLO',
      })
      .returning({ id: s.redeCoordenadora.id });

    await expect(
      service.criarProduto(
        base.cicloId,
        missaoId,
        { ...produtoValido(), redesIds: [redeDeOutroCiclo.id] },
        admin,
      ),
    ).rejects.toThrow(/outro ciclo/i);
  });

  it('edita o produto gravando uma auditoria por campo alterado', async () => {
    const criado = await service.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      admin,
    );
    const produtoId = criado.produtos[0].id;

    const atualizado = await service.atualizarProduto(
      base.cicloId,
      missaoId,
      produtoId,
      { titulo: 'Artigo revisado', situacao: 'CONCLUIDO' },
      admin,
    );
    expect(atualizado.produtos[0].titulo).toBe('Artigo revisado');
    expect(atualizado.produtos[0].situacao).toBe('CONCLUIDO');

    const auditoria = await ctx.db
      .select()
      .from(s.registroAuditoria)
      .where(eq(s.registroAuditoria.entidadeId, produtoId));
    const campos = auditoria.map((linha) => linha.campo).filter(Boolean);
    expect(campos).toEqual(expect.arrayContaining(['titulo', 'situacao']));
    expect(campos).not.toContain('ano');
  });

  it('recusa remover produto com documento anexado', async () => {
    const criado = await service.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      admin,
    );
    const produtoId = criado.produtos[0].id;
    await ctx.db.insert(s.anexo).values({
      nome: 'certificado.pdf',
      mimeType: 'application/pdf',
      tamanho: 1024,
      caminho: 'teste/certificado.pdf',
      categoria: 'CERTIFICADO',
      entidadeTipo: 'PRODUTO_MISSAO',
      entidadeId: produtoId,
    });

    await expect(
      service.removerProduto(base.cicloId, missaoId, produtoId, admin),
    ).rejects.toThrow(/documento anexado/i);

    const depois = await service.resultadosDaMissao(base.cicloId, missaoId);
    expect(depois.produtos[0].quantidadeDocumentos).toBe(1);
  });

  it('remove produto sem documento e volta a resposta indefinida', async () => {
    const criado = await service.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      admin,
    );
    const resultados = await service.removerProduto(
      base.cicloId,
      missaoId,
      criado.produtos[0].id,
      admin,
    );
    expect(resultados.produtos).toHaveLength(0);
    // Apagar o unico produto nao pode virar "nao gerou produto": ninguem
    // respondeu isso.
    expect(resultados.respostaProduto).toBe('NAO_INFORMADO');
  });

  // -------------------------------------------------------------- convenio --

  it('cria convenio ancorado na instituicao, com a missao como origem', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    expect(convenio.instituicaoId).toBe(parceiroId);
    expect(convenio.missaoOrigemCodigo).toBe('MCG-900');
    expect(convenio.redes).toHaveLength(1);
    expect(convenio.ativo).toBe(true);
  });

  it('convenio vigente exige data de assinatura', async () => {
    await expect(
      service.criarConvenio(
        { ...convenioValido(), situacao: 'VIGENTE' },
        admin,
      ),
    ).rejects.toThrow(/assinatura/i);

    await esperarViolacao(
      ctx.db.insert(s.convenio).values({
        instituicaoId: parceiroId,
        titulo: 'Acordo sem assinatura',
        tipoAcordo: 'COTUTELA',
        situacao: 'VIGENTE',
      }),
      'convenio_assinatura_ck',
    );
  });

  it('convenio sobrevive a missao que o originou', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    await ctx.db.delete(s.missaoComite).where(eq(s.missaoComite.id, missaoId));
    const depois = await service.detalharConvenio(convenio.id);
    expect(depois.missaoOrigemId).toBeNull();
    expect(depois.titulo).toBe('Acordo de cooperação acadêmica');
  });

  it('nao lista o convenio de duas redes duas vezes', async () => {
    const [outraRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-TESTE-3',
      })
      .returning({ id: s.redeCoordenadora.id });
    await service.criarConvenio(
      { ...convenioValido(), redesIds: [base.redeId, outraRede.id] },
      admin,
    );

    const todos = await service.listarConvenios({ incluirInativos: false });
    expect(todos).toHaveLength(1);
    expect(todos[0].redes).toHaveLength(2);

    const porRede = await service.listarConvenios({
      incluirInativos: false,
      redeId: base.redeId,
    });
    expect(porRede).toHaveLength(1);
  });

  it('inativa o convenio em vez de excluir, e recusa aponta-lo depois', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    const inativo = await service.inativarConvenio(
      convenio.id,
      { justificativa: 'Acordo substituído por outro processo.' },
      admin,
    );
    expect(inativo.ativo).toBe(false);

    await expect(
      service.criarProduto(
        base.cicloId,
        missaoId,
        { ...produtoValido(), tipo: 'CONVENIO', convenioId: convenio.id },
        admin,
      ),
    ).rejects.toThrow(/inativo/i);

    const reativado = await service.reativarConvenio(
      convenio.id,
      { justificativa: 'Processo retomado.' },
      admin,
    );
    expect(reativado.ativo).toBe(true);
  });

  it('convenio apontado por produto nao pode ser apagado do banco', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    await service.criarProduto(
      base.cicloId,
      missaoId,
      {
        ...produtoValido(),
        tipo: 'CONVENIO',
        titulo: 'Convênio com a universidade parceira',
        convenioId: convenio.id,
      },
      admin,
    );
    await esperarViolacao(
      ctx.db.delete(s.convenio).where(eq(s.convenio.id, convenio.id)),
      'produto_missao_convenio_id_convenio_id_fk',
    );
  });

  // ------------------------------------------------- historico do parceiro --

  it('convenio e produto alimentam o historico sem duplicar a instituicao', async () => {
    const convenio = await service.criarConvenio(convenioValido(), admin);
    await service.criarProduto(
      base.cicloId,
      missaoId,
      {
        ...produtoValido(),
        tipo: 'CONVENIO',
        titulo: 'Convênio firmado na missão',
        convenioId: convenio.id,
        // O parceiro entra pelas duas portas — instituicao do produto e titular
        // do convenio — e o produto ainda nomeia uma segunda instituicao. Com
        // `join` no lugar de `exists`, essa combinacao devolveria o mesmo
        // produto duas vezes; e a mutacao que este numero fixa.
        instituicoesIds: [parceiroId, base.instituicaoId],
      },
      admin,
    );

    const historico = await parceiros.historico(parceiroId);
    expect(historico.convenios).toHaveLength(1);
    expect(historico.produtos).toHaveLength(1);
    expect(historico.produtos[0].missaoCodigo).toBe('MCG-900');
    // Os dois modulos que a CG-027 nomeava como pendentes agora existem.
    expect(historico.modulosPendentes).toHaveLength(0);
  });
});
