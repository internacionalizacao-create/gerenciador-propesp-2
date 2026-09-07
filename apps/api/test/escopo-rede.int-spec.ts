import type { ExecutionContext } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { EscopoMissaoGuard } from '../src/auth/escopo-missao.guard';
import { IdentidadeService } from '../src/auth/identidade.service';
import { permissionsForRoles } from '../src/auth/permissions';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import { AnexosService } from '../src/dominio/anexos.service';
import { EncerramentoService } from '../src/dominio/encerramento.service';
import {
  filtroMissoesSchema,
  MissoesComiteService,
} from '../src/dominio/missoes-comite.service';
import {
  filtroPainelSchema,
  PainelComiteService,
} from '../src/dominio/painel-comite.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

/**
 * Recorte por rede no modulo de missoes (CG-028).
 *
 * O criterio de aceite e negativo: **nao pode haver leitura nem escrita entre
 * redes, nem por id adulterado**. Quase todo caso aqui verifica ausencia — o
 * que a rede vizinha *nao* ve, e o que ela *nao* consegue alterar.
 *
 * A matriz aprovada na CG-003 separa tres alcances: `admin` global, Gestor da
 * Rede limitado ao vinculo ativo, Comite Gestor sem recorte por causa de
 * `missao:all-redes`. Os tres aparecem aqui, e o Gestor e sempre o que tenta.
 */
describe('Recorte por rede das missoes (CG-028)', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let identidade: IdentidadeService;
  let missoes: MissoesComiteService;
  let painel: PainelComiteService;
  let anexos: AnexosService;
  let guard: EscopoMissaoGuard;
  let outraRedeId: string;
  let paisId: string;
  let participanteId: string;

  /** Gestor da rede da fixture; o escopo dele vem do vinculo, nao do token. */
  const gestor: AuthUser = {
    id: 'sub-gestor-rede',
    name: 'Gestora da Rede',
    roles: ['gestor-rede'],
    permissions: permissionsForRoles(['gestor-rede']),
  };

  /** Comite Gestor: le e decide sobre as tres redes, por `missao:all-redes`. */
  const comite: AuthUser = {
    id: 'sub-comite',
    name: 'Membro do Comite',
    roles: ['comite-gestor'],
    permissions: permissionsForRoles(['comite-gestor']),
  };

  const admin: AuthUser = {
    id: 'sub-admin-escopo',
    name: 'Admin',
    roles: ['admin'],
    permissions: permissionsForRoles(['admin']),
  };

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    missoes = new MissoesComiteService(ctx.db, new EncerramentoService(ctx.db));
    painel = new PainelComiteService(ctx.db);
    anexos = new AnexosService(ctx.db, new ArmazenamentoService(), identidade);
    guard = new EscopoMissaoGuard(ctx.db, identidade);
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

    const [segunda] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-VIZINHA',
        statusOrcamento: 'DEFINIDO',
      })
      .returning({ id: s.redeCoordenadora.id });
    outraRedeId = segunda.id;

    participanteId = await vincularNaRede(gestor, base.redeId);
  });

  /**
   * Liga o `sub` a uma pessoa e a poe na equipe daquela rede.
   *
   * E o caminho real: "minha rede" nao e um campo do token, e sim o vinculo
   * ativo em `membro_equipe_gestao_rede` (CG-003).
   */
  async function vincularNaRede(
    usuario: AuthUser,
    redeId: string,
    opcoes: { encerrado?: boolean } = {},
  ) {
    const [pessoa] = await ctx.db
      .insert(s.pessoa)
      .values({ nome: usuario.name!, tipo: 'SERVIDOR' })
      .returning({ id: s.pessoa.id });

    await ctx.db.insert(s.usuarioSistema).values({
      sub: usuario.id,
      pessoaId: pessoa.id,
      origem: 'MANUAL',
    });

    const [membro] = await ctx.db
      .insert(s.membroEquipeGestao)
      .values({
        cicloId: base.cicloId,
        pessoaId: pessoa.id,
        tipoEquipe: 'ADMINISTRACAO',
        funcao: 'Gestora',
        dataInicio: '2027-01-01',
        dataFim: opcoes.encerrado ? '2027-06-30' : null,
      })
      .returning({ id: s.membroEquipeGestao.id });

    await ctx.db
      .insert(s.membroEquipeGestaoRede)
      .values({ membroEquipeId: membro.id, redeId });

    return pessoa.id;
  }

  async function criarMissao(codigo: string, redes: string[]) {
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo,
        titulo: `Missão ${codigo}`,
        objetivo: 'Exercitar o recorte por rede.',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-10',
        status: 'CONFIRMADA',
      })
      .returning({ id: s.missaoComite.id });

    for (const redeId of redes) {
      await ctx.db.insert(s.missaoRede).values({ missaoId: missao.id, redeId });
    }
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId: missao.id,
      ordem: 1,
      tipo: 'ARTICULACAO',
      titulo: 'Reunião institucional',
      paisId,
      dataInicio: '2027-05-02',
      dataFim: '2027-05-03',
    });
    return missao.id;
  }

  const recorteDe = (usuario: AuthUser) => identidade.recorteDeMissoes(usuario);

  const listarComo = async (usuario: AuthUser) =>
    (
      await missoes.listar(
        base.cicloId,
        filtroMissoesSchema.parse({}),
        await recorteDe(usuario),
      )
    ).itens.map((item) => item.codigo);

  /**
   * Contexto minimo de requisicao para o guard.
   *
   * `route.path` e o padrao registrado pelo Nest, nunca a URL digitada: e o
   * que impede alguem de forjar um caminho que escape do guard.
   */
  function requisicao(usuario: AuthUser, id: string): ExecutionContext {
    const request = {
      user: usuario,
      params: { id },
      route: { path: '/programas/:programa/:ciclo/comite-gestor/missoes/:id' },
    };
    return {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  // --- resolucao do escopo ---------------------------------------------------

  it('a rede vem do vinculo ativo, e o vinculo encerrado nao da acesso', async () => {
    const daRede = await identidade.escopoDe(gestor);
    expect(daRede.redeIds).toEqual([base.redeId]);

    // Quem saiu da equipe saiu do recorte. Historico que ainda autoriza e a
    // falha mais silenciosa possivel aqui.
    await ctx.db
      .update(s.membroEquipeGestao)
      .set({ dataFim: '2027-06-30' })
      .where(eq(s.membroEquipeGestao.cicloId, base.cicloId));

    expect((await identidade.escopoDe(gestor)).redeIds).toEqual([]);
  });

  it('escopo_acesso soma ao vinculo, em vez de substitui-lo', async () => {
    const [usuario] = await ctx.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, gestor.id));

    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: usuario.id,
      tipo: 'REDE',
      redeId: outraRedeId,
      concedidoPorId: admin.id,
    });

    // A concessao explicita do administrador existe para quem precisa
    // enxergar uma rede sem estar na equipe dela; trocar uma fonte pela outra
    // deixaria uma das duas necessidades sem resposta.
    expect([...(await identidade.escopoDe(gestor)).redeIds].sort()).toEqual(
      [base.redeId, outraRedeId].sort(),
    );
  });

  it('gestor sem vinculo nenhum ve lista vazia, e nao o ciclo inteiro', async () => {
    await criarMissao('MCG-002', [base.redeId]);

    const semVinculo: AuthUser = {
      id: 'sub-sem-vinculo',
      name: 'Gestor recem-nomeado',
      roles: ['gestor-rede'],
      permissions: permissionsForRoles(['gestor-rede']),
    };

    // O modo permissivo de `RECORTE_OBRIGATORIO` nao vale aqui, e nao pode
    // valer: `gestor-rede` nunca foi atribuido a ninguem, entao nao existe a
    // pessoa que ele protegeria — e conceder o papel a alguem sem vinculo de
    // equipe passaria a mostrar as tres redes, que e exatamente o que a CG-028
    // impede. Lista vazia faz a PROPESP descobrir que falta cadastrar o
    // vinculo; ver tudo nao faria ninguem descobrir nada.
    expect(await listarComo(semVinculo)).toEqual([]);
    expect(
      (await missoes.referencias(base.cicloId, await recorteDe(semVinculo)))
        .redes,
    ).toEqual([]);
  });

  // --- leitura ---------------------------------------------------------------

  it('a lista mostra so as missoes da rede do gestor', async () => {
    await criarMissao('MCG-001', [base.redeId]);
    await criarMissao('MCG-002', [outraRedeId]);

    expect(await listarComo(gestor)).toEqual(['MCG-001']);
    // O Comite e o admin nao sao recortados.
    expect((await listarComo(comite)).sort()).toEqual(['MCG-001', 'MCG-002']);
    expect((await listarComo(admin)).sort()).toEqual(['MCG-001', 'MCG-002']);
  });

  it('missao de duas redes aparece uma unica vez para quem alcanca as duas', async () => {
    await criarMissao('MCG-010', [base.redeId, outraRedeId]);
    const [usuario] = await ctx.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, gestor.id));
    await ctx.db.insert(s.escopoAcesso).values({
      usuarioId: usuario.id,
      tipo: 'REDE',
      redeId: outraRedeId,
      concedidoPorId: admin.id,
    });

    // `exists`, e nao `join` (CG-016): um `join` traria a missao duas vezes e
    // faria o total da pagina mentir.
    const pagina = await missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse({}),
      await recorteDe(gestor),
    );
    expect(pagina.itens.map((i) => i.codigo)).toEqual(['MCG-010']);
    expect(pagina.total).toBe(1);
    expect(pagina.resumo.total).toBe(1);
  });

  it('o resumo da lista conta o recorte, e nao o ciclo inteiro', async () => {
    await criarMissao('MCG-020', [base.redeId]);
    await criarMissao('MCG-021', [outraRedeId]);
    await criarMissao('MCG-022', [outraRedeId]);

    // O resumo e apurado no banco, junto do recorte. Se fosse contado antes de
    // um corte em memoria, ele entregaria o total real do ciclo.
    const pagina = await missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse({}),
      await recorteDe(gestor),
    );
    expect(pagina.resumo.total).toBe(1);
    expect(pagina.resumo.porStatus.CONFIRMADA).toBe(1);
  });

  it('filtrar pela rede vizinha nao a torna visivel', async () => {
    await criarMissao('MCG-030', [outraRedeId]);

    // O `?redeId=` e escolha do usuario dentro do que ja lhe cabe, nunca uma
    // forma de ampliar o alcance.
    const pagina = await missoes.listar(
      base.cicloId,
      filtroMissoesSchema.parse({ redeId: outraRedeId }),
      await recorteDe(gestor),
    );
    expect(pagina.itens).toEqual([]);
    expect(pagina.total).toBe(0);
  });

  it('o painel conta, quebra e cobra pendencia so dentro do recorte', async () => {
    await criarMissao('MCG-040', [base.redeId]);
    await criarMissao('MCG-041', [outraRedeId]);
    await criarMissao('MCG-042', [outraRedeId]);

    const dele = await painel.montar(
      base.cicloId,
      filtroPainelSchema.parse({}),
      await recorteDe(gestor),
    );
    expect(dele.missoes).toBe(1);
    expect(dele.alcance.paises).toBe(1);
    expect(dele.porPais[0].missoes).toBe(1);
    // Rede que a pessoa nao alcanca nao aparece com zero: nao aparece. "Rede
    // vizinha: 0 missoes" e uma afirmacao que ela nao tem como saber.
    expect(dele.porRede.map((r) => r.nome)).toEqual(['REDE-TESTE']);

    const doComite = await painel.montar(
      base.cicloId,
      filtroPainelSchema.parse({}),
      await recorteDe(comite),
    );
    expect(doComite.missoes).toBe(3);
  });

  it('rede vizinha pedida no painel cai em "todas", sem rotular o recorte', async () => {
    await criarMissao('MCG-050', [base.redeId]);

    const dados = await painel.montar(
      base.cicloId,
      filtroPainelSchema.parse({ redeId: outraRedeId }),
      await recorteDe(gestor),
    );
    // Devolver o nome confirmaria a existencia de uma rede que ele nao pode
    // ver, e o painel exibiria um recorte rotulado com ela e vazio por dentro.
    expect(dados.recorte.redeId).toBeNull();
    expect(dados.recorte.redeNome).toBeNull();
    expect(dados.missoes).toBe(1);
  });

  it('o formulario so oferece as redes que o gestor alcanca', async () => {
    const referencias = await missoes.referencias(
      base.cicloId,
      await recorteDe(gestor),
    );
    expect(referencias.redes.map((r) => r.nome)).toEqual(['REDE-TESTE']);
    // Parceiros nao sao recortados: o cadastro institucional e compartilhado,
    // e a matriz aprovada da leitura ampla a todos os perfis.
    expect(referencias.instituicoes.length).toBeGreaterThan(0);
  });

  // --- id adulterado ---------------------------------------------------------

  it('id de missao da rede vizinha responde 404, e nao 403', async () => {
    const alheia = await criarMissao('MCG-060', [outraRedeId]);

    // 403 responderia "existe, mas nao e sua" — que e exatamente o que quem
    // adultera o id esta tentando descobrir.
    await expect(
      guard.canActivate(requisicao(gestor, alheia)),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('o guard libera a missao da propria rede, o Comite e o admin', async () => {
    const propria = await criarMissao('MCG-061', [base.redeId]);
    const alheia = await criarMissao('MCG-062', [outraRedeId]);

    expect(await guard.canActivate(requisicao(gestor, propria))).toBe(true);
    expect(await guard.canActivate(requisicao(comite, alheia))).toBe(true);
    expect(await guard.canActivate(requisicao(admin, alheia))).toBe(true);
  });

  it('id que nao e uuid nao chega ao banco', async () => {
    // Deixa-lo passar transformaria uma URL malformada em erro de sintaxe do
    // Postgres — 500 em vez do 404 que o caso merece.
    expect(await guard.canActivate(requisicao(gestor, 'nao-e-uuid'))).toBe(
      true,
    );
  });

  it('missao sem rede nenhuma fica invisivel para quem e recortado', async () => {
    const semRede = await criarMissao('MCG-063', []);

    // Sao missoes anteriores a CG-016. Liberar as sem rede daria a cada gestor
    // acesso a um conjunto que nao e de rede nenhuma.
    await expect(
      guard.canActivate(requisicao(gestor, semRede)),
    ).rejects.toMatchObject({ status: 404 });
    expect(await guard.canActivate(requisicao(comite, semRede))).toBe(true);
    expect(await listarComo(gestor)).toEqual([]);
  });

  // --- escrita ---------------------------------------------------------------

  it('nao cria missao dentro da rede vizinha', async () => {
    // O guard protege a missao que ja existe; sem esta checagem o recorte
    // seria so de leitura, e um gestor injetaria registro no universo do outro.
    await expect(
      missoes.criar(
        base.cicloId,
        missaoValida([outraRedeId]),
        gestor,
        await recorteDe(gestor),
      ),
    ).rejects.toMatchObject({ status: 400 });

    // A mesma missao, na propria rede, passa.
    const criada = await missoes.criar(
      base.cicloId,
      missaoValida([base.redeId]),
      gestor,
      await recorteDe(gestor),
    );
    expect(criada.codigo).toBeDefined();
  });

  it('nao move a propria missao para a rede vizinha', async () => {
    const criada = await missoes.criar(
      base.cicloId,
      missaoValida([base.redeId]),
      gestor,
      await recorteDe(gestor),
    );
    const detalhe = await missoes.detalhe(base.cicloId, criada.id);

    await expect(
      missoes.atualizar(
        base.cicloId,
        criada.id,
        {
          ...paraAtualizacao(detalhe),
          redes: [outraRedeId],
        } as never,
        gestor,
        await recorteDe(gestor),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('nao retira da missao a rede que nao alcanca', async () => {
    const compartilhada = await criarMissao('MCG-070', [
      base.redeId,
      outraRedeId,
    ]);
    const detalhe = await missoes.detalhe(base.cicloId, compartilhada);

    // A missao multirrede pertence as duas: retirar a outra faria a missao
    // sumir da tela de quem a acompanhava, sem que ninguem de la participasse.
    await expect(
      missoes.atualizar(
        base.cicloId,
        compartilhada,
        { ...paraAtualizacao(detalhe), redes: [base.redeId] } as never,
        gestor,
        await recorteDe(gestor),
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  // --- documentos ------------------------------------------------------------

  it('documento da missao vizinha nao lista nem baixa, mesmo com o UUID em maos', async () => {
    const alheia = await criarMissao('MCG-080', [outraRedeId]);
    const documento = await anexos.enviar(
      {
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: alheia,
        categoria: 'OUTRO',
        visibilidade: 'INTERNA',
      } as never,
      pdf(),
      admin,
    );

    // Sem esta checagem o documento seria a porta lateral do recorte: bastaria
    // conhecer o UUID para ler o que a missao da rede vizinha guarda.
    await expect(anexos.baixar(documento.id, gestor)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      anexos.listar(
        { entidadeTipo: 'MISSAO_COMITE', entidadeId: alheia } as never,
        gestor,
      ),
    ).rejects.toMatchObject({ status: 404 });

    // O Comite alcanca todas as redes e continua lendo.
    expect((await anexos.baixar(documento.id, comite)).nome).toBe('doc.pdf');
  });

  // --- matriz de permissoes --------------------------------------------------

  it('o Comite Gestor nao valida prestacao; o Administrador valida', () => {
    // A matriz aprovada na CG-003 poe "le" na coluna de prestacao do Comite.
    // Validar abate o aporte (CG-009), e quem decide sobre a missao nao e quem
    // confere a despesa dela.
    expect(comite.permissions).not.toContain('prestacao:review');
    expect(admin.permissions).toContain('prestacao:review');

    // O Gestor da Rede preenche e envia, mas nao valida a propria prestacao.
    expect(gestor.permissions).toContain('prestacao:write');
    expect(gestor.permissions).not.toContain('prestacao:review');
  });

  it('somente quem decide alcanca todas as redes', () => {
    expect(comite.permissions).toContain('missao:all-redes');
    expect(admin.permissions).toContain('missao:all-redes');
    expect(gestor.permissions).not.toContain('missao:all-redes');
    // E alcancar todas as redes nao concede escrita.
    expect(comite.permissions).not.toContain('missao:write');
    expect(comite.permissions).not.toContain('missao:edit');
  });

  // ---------------------------------------------------------------------------

  function missaoValida(redes: string[]) {
    return {
      titulo: 'Missão de teste do recorte',
      objetivo: 'Verificar o recorte por rede.',
      dataInicio: '2027-05-01',
      dataFim: '2027-05-10',
      status: 'PLANEJADA',
      redes,
      participantes: [{ pessoaId: participanteId, papel: 'RESPONSAVEL' }],
      atividades: [
        {
          tipo: 'ARTICULACAO',
          titulo: 'Reunião institucional',
          paisId,
          dataInicio: '2027-05-02',
          dataFim: '2027-05-03',
        },
      ],
    } as never;
  }

  /** O `PATCH` exige o desenho inteiro; so as redes mudam nestes casos. */
  function paraAtualizacao(detalhe: {
    titulo: string;
    objetivo: string;
    dataInicio: string;
    dataFim: string;
    redes: { id: string }[];
    participantes: { pessoaId: string; papel: string }[];
    atividades: {
      id: string;
      tipo: string;
      titulo: string;
      paisId: string | null;
      dataInicio: string;
      dataFim: string;
    }[];
  }) {
    return {
      titulo: detalhe.titulo,
      objetivo: detalhe.objetivo,
      dataInicio: detalhe.dataInicio,
      dataFim: detalhe.dataFim,
      redes: detalhe.redes.map((rede) => rede.id),
      participantes: detalhe.participantes.map((p) => ({
        pessoaId: p.pessoaId,
        papel: p.papel,
      })),
      atividades: detalhe.atividades.map((a) => ({
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        paisId: a.paisId,
        dataInicio: a.dataInicio,
        dataFim: a.dataFim,
      })),
    };
  }

  function pdf() {
    return {
      originalname: 'doc.pdf',
      buffer: Buffer.from('%PDF-1.4\n%teste do recorte\n%%EOF\n'),
      size: 32,
    };
  }
});
