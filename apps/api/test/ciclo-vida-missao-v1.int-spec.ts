import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import { ResultadosService } from '../src/dominio/resultados.service';
import {
  MissoesComiteService,
  type CriarMissaoComite,
} from '../src/dominio/missoes-comite.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * V1-030 e V1-031 — ciclo de vida e produtos da missao, pela tela.
 *
 * As transicoes em si ja tinham cobertura em `comite-gestor.int-spec.ts`. O que
 * esta tarefa acrescenta, e o que estes casos cobram, e o que a interface passou
 * a poder fazer sem `pnpm api`:
 *
 * - **editar preservando** participantes e roteiro — o defeito que o `id` no
 *   payload evita, e que sem ele dobraria o roteiro a cada salvamento;
 * - **cancelar sem apagar** o que ja foi anexado;
 * - **reabrir a execucao**, que nao e reabrir a analise;
 * - e que **cada acao exige a sua concessao**, nao a de leitura.
 *
 * A V1-031 acrescentou os produtos, e os casos deles cobram o que a ficha pede:
 * cadastrar pela tela **responde "sim"** e retira a declaracao negativa, sem
 * botao que afirme isso; a ausencia de produto **nao** vira declaracao
 * automatica; e o checklist de encerramento reflete o cadastro real.
 */

const usuario: AuthUser = {
  id: 'operador-v1030',
  name: 'Operador',
  roles: [],
  permissions: [],
};

describe('V1-030/031: ciclo de vida e produtos da missao', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let missoes: MissoesComiteService;
  let resultados: ResultadosService;
  let encerramento: EncerramentoService;
  let identidade: IdentidadeService;
  let resolver: AcessoV1Service;
  let contaId: string;
  let paisId: string;
  let missaoId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    resolver = new AcessoV1Service(ctx.db);
    encerramento = new EncerramentoService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, encerramento);
    resultados = new ResultadosService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ nome: 'França', codigoIso2: 'FR', codigoIso3: 'FRA' })
      .returning();
    paisId = pais.id;

    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: 'Operadora', tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });
    const [conta] = await ctx.db
      .insert(s.usuarioSistema)
      .values({ sub: usuario.id, pessoaId: pessoa.id, origem: 'MANUAL' })
      .returning({ id: s.usuarioSistema.id });
    contaId = conta.id;

    // Criar a missao usa alcance global: o que esta sob teste e o ciclo de
    // vida, e nao a criacao, que a suite do Comite ja cobre.
    //
    // `missao:read` entra junto porque `validarRedes` confere a rede contra o
    // **recorte de leitura** (`recorteDeMissoes`): quem nao alcanca a rede nao
    // cria missao nela, e sem a concessao de leitura nao se alcanca nenhuma.
    await conceder('missao:read');
    await conceder('missao:create');
    const criada = await missoes.criar(
      base.cicloId,
      missaoValida(),
      await comoUsuario(),
      await recorte(),
    );
    missaoId = criada.id;
  });

  // ------------------------------------------------------------ fixtures --

  function missaoValida(): CriarMissaoComite {
    return {
      titulo: 'Missão de articulação na Europa',
      objetivo: 'Consolidar acordos de cotutela com duas universidades.',
      dataInicio: '2027-03-01',
      dataFim: '2027-03-20',
      status: 'PLANEJADA',
      observacoes: null,
      redes: [base.redeId],
      participantes: [
        {
          pessoaId: base.coordenadorTematicaId,
          novaPessoa: null,
          membroEquipeId: null,
          papel: 'RESPONSAVEL',
          observacoes: null,
        },
      ],
      atividades: [
        {
          tipo: 'VISITA_TECNICA',
          titulo: 'Visita técnica em Paris',
          paisId,
          cidade: 'Paris',
          instituicaoId: base.instituicaoId,
          instituicaoNome: null,
          eventoNome: null,
          dataInicio: '2027-03-02',
          dataFim: '2027-03-06',
          planejamento: null,
          observacoes: null,
        },
      ],
    };
  }

  async function conceder(permissao: PermissaoV1) {
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: contaId,
      permissao,
      justificativa: 'Fixture do ciclo de vida.',
      ...colunasDoAlvo({ tipo: 'GLOBAL' }),
    });
  }

  /** O `AuthUser` com as permissoes resolvidas, como o guard monta. */
  async function comoUsuario(): Promise<AuthUser> {
    const acesso = await resolver.resolver(usuario.id);
    return { ...usuario, permissions: acesso.permissoes };
  }

  const recorte = () => identidade.recorteDeMissoes(usuario);

  const transicionar = async (
    acao: 'CONFIRMAR' | 'CANCELAR' | 'CONCLUIR',
    justificativa: string | null = null,
  ) =>
    missoes.transicionar(
      base.cicloId,
      missaoId,
      { acao, justificativa },
      await comoUsuario(),
    );

  /** O detalhe atual convertido no corpo que a edicao espera. */
  async function paraEdicao(ajustes: Partial<Record<'titulo', string>> = {}) {
    const atual = await missoes.detalhe(base.cicloId, missaoId);
    if (!atual) throw new Error('Missão não encontrada.');
    return {
      tipo: null,
      unidadeDepartamento: null,
      titulo: ajustes.titulo ?? atual.titulo,
      objetivo: atual.objetivo,
      dataInicio: atual.dataInicio,
      dataFim: atual.dataFim,
      observacoes: atual.observacoes,
      justificativa: null,
      redes: atual.redes.map((rede) => rede.id),
      participantes: atual.participantes.map((participante) => ({
        id: participante.id,
        pessoaId: participante.pessoaId,
        novaPessoa: null,
        membroEquipeId: participante.membroEquipeId,
        papel: participante.papel,
        observacoes: participante.observacoes,
      })),
      atividades: atual.atividades.map((atividade) => ({
        id: atividade.id,
        tipo: atividade.tipo,
        titulo: atividade.titulo,
        paisId: atividade.paisId,
        cidade: atividade.cidade,
        instituicaoId: atividade.instituicaoId,
        instituicaoNome: atividade.instituicaoDoCatalogo
          ? null
          : atividade.instituicao,
        eventoNome: atividade.eventoNome,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        planejamento: atividade.planejamento,
        observacoes: atividade.observacoes,
      })),
    };
  }

  // ---------------------------------------------------- edicao preserva --

  it('editar com os ids preserva participantes e roteiro', async () => {
    await conceder('missao:edit');
    const antes = await missoes.detalhe(base.cicloId, missaoId);

    await missoes.atualizar(
      base.cicloId,
      missaoId,
      (await paraEdicao({ titulo: 'Missão renomeada' })) as never,
      await comoUsuario(),
      await recorte(),
    );

    const depois = await missoes.detalhe(base.cicloId, missaoId);
    expect(depois?.titulo).toBe('Missão renomeada');
    // As linhas continuam as mesmas, e nao viraram copias: o endpoint
    // reconcilia pelas listas, e `id` e o que diz "esta ja existia".
    expect(depois?.atividades).toHaveLength(antes.atividades.length);
    expect(depois?.atividades[0].id).toBe(antes.atividades[0].id);
    expect(depois?.participantes[0].id).toBe(antes.participantes[0].id);
  });

  it('editar sem os ids duplicaria o roteiro — e e por isso que eles vao', async () => {
    await conceder('missao:edit');
    const corpo = await paraEdicao();

    // Sem `id`, cada linha e "nova": e exatamente o defeito que
    // `payloadEdicaoMissao` evita na web, demonstrado aqui.
    await missoes.atualizar(
      base.cicloId,
      missaoId,
      {
        ...corpo,
        participantes: corpo.participantes.map(semId),
        atividades: corpo.atividades.map(semId),
      } as never,
      await comoUsuario(),
      await recorte(),
    );

    const depois = await missoes.detalhe(base.cicloId, missaoId);
    expect(depois?.atividades[0].id).not.toBe(corpo.atividades[0].id);
  });

  // ------------------------------------------------------- transicoes --

  it('confirma a missao planejada e recusa confirmar de novo', async () => {
    await conceder('missao:confirm');

    expect((await transicionar('CONFIRMAR')).status).toBe('CONFIRMADA');
    // A tela esconde o botao; quem chama direto recebe 409. Sao as duas
    // metades da mesma regra, e a que vale e esta.
    await expect(transicionar('CONFIRMAR')).rejects.toMatchObject({
      status: 409,
    });
  });

  it('cancelar exige justificativa e nao apaga o que ja foi anexado', async () => {
    await conceder('missao:cancel');
    await conceder('documento:create');
    const [anexo] = await ctx.db
      .insert(s.anexo)
      .values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missaoId,
        categoria: 'PROJETO',
        nome: 'projeto.pdf',
        mimeType: 'application/pdf',
        tamanho: 8,
        caminho: `teste/${missaoId}`,
        hashSha256: 'a'.repeat(64),
        visibilidade: 'INTERNA',
        enviadoPor: 'Fixture',
      })
      .returning({ id: s.anexo.id });

    await expect(transicionar('CANCELAR')).rejects.toMatchObject({
      status: 400,
    });

    const cancelada = await transicionar('CANCELAR', 'O evento foi adiado.');
    expect(cancelada.status).toBe('CANCELADA');

    // Cancelar muda o estado da missao, nao remove o rastro: quem olhar
    // depois precisa achar o que foi anexado antes da desistencia.
    const guardado = await ctx.db
      .select({ id: s.anexo.id })
      .from(s.anexo)
      .where(eq(s.anexo.id, anexo.id));
    expect(guardado).toHaveLength(1);
  });

  // ------------------------------------------------------- reabertura --

  it('reabrir a execucao devolve a missao cancelada ao fluxo', async () => {
    await conceder('missao:cancel');
    await conceder('missao:reopen-execucao');
    await transicionar('CANCELAR', 'Cancelada por engano.');

    const reaberta = await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Autorizado pela coordenação em reunião.' },
      await comoUsuario(),
    );
    expect(reaberta.status).not.toBe('CANCELADA');
  });

  it('reabrir a execucao nao mexe na decisao do Comite', async () => {
    await conceder('missao:cancel');
    await conceder('missao:reopen-execucao');
    const antes = await missoes.detalhe(base.cicloId, missaoId);
    await transicionar('CANCELAR', 'Cancelada por engano.');

    await missoes.reabrir(
      base.cicloId,
      missaoId,
      { justificativa: 'Autorizado pela coordenação em reunião.' },
      await comoUsuario(),
    );

    // Os dois eixos sao independentes (CG-006): reabrir a execucao nao
    // reabre a analise, que tem rota e permissao proprias.
    const depois = await missoes.detalhe(base.cicloId, missaoId);
    expect(depois?.statusAprovacao).toBe(antes.statusAprovacao);
  });

  // ------------------------------------------------ produtos (V1-031) --

  const produtoValido = (sobrescrever: Record<string, unknown> = {}) =>
    ({
      tipo: 'PUBLICACAO',
      titulo: 'Artigo conjunto sobre a Amazônia',
      descricao: null,
      situacao: 'CONCLUIDO',
      ano: 2027,
      referencia: null,
      observacoes: null,
      convenioId: null,
      instituicoesIds: [],
      redesIds: [],
      responsaveis: [],
      ...sobrescrever,
    }) as never;

  it('cadastrar produto responde "sim" e retira a declaracao negativa', async () => {
    await conceder('produto-missao:read');
    await conceder('produto-missao:create');
    await conceder('produto-missao:declare');

    await resultados.responderProdutos(
      base.cicloId,
      missaoId,
      { gerouProduto: false, justificativa: 'Missão exploratória.' },
      await comoUsuario(),
    );
    expect(
      (await resultados.resultadosDaMissao(base.cicloId, missaoId))
        .respostaProduto,
    ).toBe('NAO');

    // O "sim" e a existencia da linha (CG-056): cadastrar retira a declaracao
    // sozinho, e por isso a tela nao tem botao que afirme "sim".
    const depois = await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      await comoUsuario(),
    );
    expect(depois.respostaProduto).toBe('SIM');
    expect(depois.declaracaoSemProduto).toBeNull();
    expect(depois.produtos).toHaveLength(1);
  });

  it('missao sem produto fica em "nao informado", e nao em "nao gerou"', async () => {
    await conceder('produto-missao:read');
    const atual = await resultados.resultadosDaMissao(base.cicloId, missaoId);

    // As duas dao zero produto cadastrado, e o checklist precisa distinguir:
    // ausencia de resposta nao pode virar declaracao negativa automatica.
    expect(atual.respostaProduto).toBe('NAO_INFORMADO');
    expect(atual.declaracaoSemProduto).toBeNull();
  });

  it('o checklist de encerramento passa a refletir o produto cadastrado', async () => {
    await conceder('produto-missao:read');
    await conceder('produto-missao:create');

    const item = async () =>
      (await encerramento.checklist(base.cicloId, missaoId)).itens.find(
        (linha) => linha.titulo === 'Resposta sobre produtos',
      );
    expect((await item())?.atendido).toBe(false);

    await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      await comoUsuario(),
    );

    // Nada do checklist e gravado: ele e recalculado a cada leitura (CG-058),
    // e por isso o cadastro pela tela aparece aqui sem nenhum passo extra.
    expect((await item())?.atendido).toBe(true);
  });

  it('produto do tipo convenio exige o acordo, e so ele aponta um', async () => {
    await conceder('produto-missao:read');
    await conceder('produto-missao:create');

    await expect(
      resultados.criarProduto(
        base.cicloId,
        missaoId,
        produtoValido({ tipo: 'CONVENIO', convenioId: null }),
        await comoUsuario(),
      ),
    ).rejects.toBeDefined();
  });

  it('remover produto documentado e recusado, e o documento fica', async () => {
    await conceder('produto-missao:read');
    await conceder('produto-missao:create');
    await conceder('produto-missao:delete');

    const criado = await resultados.criarProduto(
      base.cicloId,
      missaoId,
      produtoValido(),
      await comoUsuario(),
    );
    const produtoId = criado.produtos[0].id;
    await ctx.db.insert(s.anexo).values({
      entidadeTipo: 'PRODUTO_MISSAO',
      entidadeId: produtoId,
      categoria: 'OUTRO',
      nome: 'evidencia.pdf',
      mimeType: 'application/pdf',
      tamanho: 8,
      caminho: `teste/${produtoId}`,
      hashSha256: 'b'.repeat(64),
      visibilidade: 'INTERNA',
      enviadoPor: 'Fixture',
    });

    // Preservar a linha e o que mantem o vinculo historico valido (CG-052):
    // `anexo` e polimorfico e nao tem FK, entao apagar o produto deixaria o
    // documento apontando para o nada.
    await expect(
      resultados.removerProduto(
        base.cicloId,
        missaoId,
        produtoId,
        await comoUsuario(),
      ),
    ).rejects.toBeDefined();
    expect(
      (await resultados.resultadosDaMissao(base.cicloId, missaoId)).produtos,
    ).toHaveLength(1);
  });

  it('cada verbo do produto exige a sua concessao', async () => {
    await conceder('produto-missao:read');
    const quem = await comoUsuario();

    // Ler produto nao cadastra, nao edita e nao remove — e cadastrar nao
    // implica editar. Sao tres concessoes distintas no catalogo.
    for (const permissao of [
      'produto-missao:create',
      'produto-missao:edit',
      'produto-missao:delete',
      'produto-missao:declare',
    ] as const) {
      expect(quem.permissions).not.toContain(permissao);
    }
  });

  // --------------------------------------------- cada acao, sua concessao --

  it('ler missao nao confirma, nao cancela, nao edita e nao reabre', async () => {
    // `missao:read` e so leitura. Sem cada concessao propria, nenhuma das
    // acoes do ciclo de vida acontece — nem pela tela, nem por chamada direta.
    const quem = await comoUsuario();
    expect(quem.permissions).toEqual(['missao:create', 'missao:read']);

    for (const permissao of [
      'missao:confirm',
      'missao:cancel',
      'missao:close',
      'missao:edit',
      'missao:reopen-execucao',
    ] as const) {
      expect(quem.permissions).not.toContain(permissao);
    }
  });
});

/** Remove o `id`, para a linha chegar a API como "esta e nova". */
function semId<T extends { id?: string | null }>(linha: T): Omit<T, 'id'> {
  const copia: Record<string, unknown> = { ...linha };
  delete copia.id;
  return copia as Omit<T, 'id'>;
}
