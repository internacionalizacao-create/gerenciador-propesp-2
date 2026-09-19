import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { AcessoV1Service } from '../src/auth/autorizacao-v1/acesso-v1.service';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import type { EscopoV1 } from '../src/auth/autorizacao-v1/concessao';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import { ArmazenamentoService } from '../src/arquivos/armazenamento.service';
import * as s from '../src/database/schema';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import { AnexosService } from '../src/dominio/anexos.service';
import { ParceirosService } from '../src/dominio/parceiros.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarAcesso, criarBase, type BaseFixture } from './fixtures';

/**
 * V1-016 — caminhos indiretos.
 *
 * O parceiro e o catalogo compartilhado, e continua pesquisavel por quem tem
 * `parceiro:read`. O que estes casos cobram e que o **historico** dele nao vire
 * a porta lateral para a bolsa, a missao, o produto e o convenio que a tela do
 * proprio dominio recusa mostrar — nem o anexo, por troca de UUID.
 */
const usuario: AuthUser = {
  id: 'operador-v1016',
  name: 'Operador',
  roles: [],
  permissions: [],
};

const PDF = () => ({
  originalname: 'documento.pdf',
  mimetype: 'application/pdf',
  size: 8,
  buffer: Buffer.from('%PDF-1.4'),
});

describe('V1-016: caminhos indiretos, historico e documentos', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let parceiros: ParceirosService;
  let anexos: AnexosService;
  let resolver: AcessoV1Service;
  let contaId: string;

  let parceiroId: string;
  let redeFora: string;
  let tematicaFora: string;
  let ppgFora: string;
  let paisId: string;
  let bolsaDentro: string;
  let bolsaFora: string;
  let missaoDentro: string;
  let missaoFora: string;
  let produtoDentro: string;
  let produtoFora: string;
  let convenioId: string;
  let anexoDaBolsaFora: string;
  let anexoDaMissaoFora: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    const identidade = new IdentidadeService(ctx.db);
    parceiros = new ParceirosService(ctx.db);
    anexos = new AnexosService(ctx.db, new ArmazenamentoService(), identidade);
    resolver = new AcessoV1Service(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
    contaId = (await criarAcesso(ctx.db, { sub: usuario.id, permissoes: [] }))
      .usuarioId;

    paisId = (
      await ctx.db
        .insert(s.pais)
        .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
        .returning()
    )[0].id;

    parceiroId = (
      await ctx.db
        .insert(s.instituicao)
        .values({
          nome: 'Universidade Parceira',
          nomeNormalizado: normalizarNomeInstituicao('Universidade Parceira'),
          tipo: 'PARCEIRA_INTERNACIONAL',
        })
        .returning()
    )[0].id;

    // A segunda rede e o mundo que esta conta nao alcanca.
    redeFora = (
      await ctx.db
        .insert(s.redeCoordenadora)
        .values({
          cicloId: base.cicloId,
          instituicaoId: parceiroId,
          nome: 'Rede de fora',
        })
        .returning()
    )[0].id;
    tematicaFora = (
      await ctx.db
        .insert(s.areaTematica)
        .values({ redeId: redeFora, codigo: 'TF', nome: 'Temática de fora' })
        .returning()
    )[0].id;
    ppgFora = (
      await ctx.db
        .insert(s.ppg)
        .values({ nome: 'PPG de fora', sigla: 'PPGF', nivel: 'DOUTORADO' })
        .returning()
    )[0].id;

    bolsaDentro = await inserirBolsa(
      'Bolsista de dentro',
      base.areaTematicaId,
      base.ppgId,
    );
    bolsaFora = await inserirBolsa('Bolsista de fora', tematicaFora, ppgFora);

    missaoDentro = await inserirMissao('MCG-001', base.redeId);
    missaoFora = await inserirMissao('MCG-002', redeFora);

    produtoDentro = await inserirProduto(missaoDentro, 'Produto de dentro');
    produtoFora = await inserirProduto(missaoFora, 'Produto de fora');

    convenioId = (
      await ctx.db
        .insert(s.convenio)
        .values({
          instituicaoId: parceiroId,
          titulo: 'Acordo de cooperação',
          tipoAcordo: 'COOPERACAO_TECNICA',
          objetivo: 'Intercâmbio',
          situacao: 'VIGENTE',
          // `convenio_assinatura_ck`: vigente sem assinatura seria vigencia
          // sem o ato que a funda.
          dataAssinatura: '2027-05-20',
          dataInicio: '2027-06-01',
          missaoOrigemId: missaoFora,
        })
        .returning()
    )[0].id;

    anexoDaBolsaFora = await inserirAnexo('BOLSA_CONCEDIDA', bolsaFora);
    anexoDaMissaoFora = await inserirAnexo('MISSAO_COMITE', missaoFora);
  });

  // ------------------------------------------------------------ fixtures --

  async function inserirBolsa(
    nome: string,
    areaTematicaId: string,
    ppgId: string,
  ) {
    const pessoaId = (
      await ctx.db
        .insert(s.pessoa)
        .values({ nome, tipo: 'DISCENTE' })
        .returning()
    )[0].id;
    return (
      await ctx.db
        .insert(s.bolsaConcedida)
        .values({
          programaId: base.programaId,
          cicloId: base.cicloId,
          ppgId,
          pessoaId,
          areaTematicaId,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'DOUTORADO',
          instituicaoDestinoId: parceiroId,
          dataInicio: '2027-03-01',
          dataFim: '2027-08-31',
          status: 'EM_ANDAMENTO',
          vigenciaMeses: '6',
          valorConcedido: '100.00',
          fluxo: 'OUT',
        })
        .returning()
    )[0].id;
  }

  async function inserirMissao(codigo: string, redeId: string) {
    const missaoId = (
      await ctx.db
        .insert(s.missaoComite)
        .values({
          cicloId: base.cicloId,
          codigo,
          titulo: `Missão ${codigo}`,
          objetivo: 'Visitar o parceiro',
          dataInicio: '2027-05-01',
          dataFim: '2027-05-10',
        })
        .returning()
    )[0].id;
    await ctx.db.insert(s.missaoRede).values({ missaoId, redeId });
    // A atividade e o que liga a missao ao parceiro no historico (CG-027).
    await ctx.db.insert(s.atividadeMissao).values({
      missaoId,
      ordem: 1,
      tipo: 'VISITA_TECNICA',
      titulo: `Visita ${codigo}`,
      paisId,
      instituicaoId: parceiroId,
      eventoNome: `Congresso ${codigo}`,
      dataInicio: '2027-05-02',
      dataFim: '2027-05-03',
    });
    return missaoId;
  }

  async function inserirProduto(missaoId: string, titulo: string) {
    const produtoId = (
      await ctx.db
        .insert(s.produtoMissao)
        .values({
          missaoId,
          tipo: 'PUBLICACAO',
          titulo,
          situacao: 'PREVISTO',
          ano: 2027,
        })
        .returning()
    )[0].id;
    await ctx.db
      .insert(s.produtoMissaoInstituicao)
      .values({ produtoId, instituicaoId: parceiroId });
    return produtoId;
  }

  async function inserirAnexo(
    entidadeTipo: 'BOLSA_CONCEDIDA' | 'MISSAO_COMITE',
    entidadeId: string,
  ) {
    return (
      await ctx.db
        .insert(s.anexo)
        .values({
          entidadeTipo,
          entidadeId,
          categoria: entidadeTipo === 'BOLSA_CONCEDIDA' ? 'RELATORIO' : 'ATA',
          nome: 'documento.pdf',
          mimeType: 'application/pdf',
          tamanho: 8,
          caminho: `teste/${entidadeId}/${crypto.randomUUID()}`,
          hashSha256: 'a'.repeat(64),
          visibilidade: 'INTERNA',
          enviadoPor: 'Fixture',
        })
        .returning()
    )[0].id;
  }

  async function conceder(
    permissao: PermissaoV1,
    alvo: EscopoV1 = { tipo: 'GLOBAL' },
  ) {
    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: contaId,
      permissao,
      justificativa: 'Teste de caminho indireto.',
      ...colunasDoAlvo(alvo),
    });
  }

  const acesso = () => resolver.resolver(usuario.id);
  /**
   * O `AuthUser` com as permissoes ja resolvidas, como o `JwtAuthGuard` monta.
   * Chamar o servico com a lista vazia testaria a checagem de permissao, e o
   * que esta sob teste aqui e o **alcance**, que so e alcancado depois dela.
   */
  const comoUsuario = async (): Promise<AuthUser> => ({
    ...usuario,
    permissions: (await acesso()).permissoes,
  });
  const naRede = (): EscopoV1 => ({ tipo: 'REDE', redeId: base.redeId });
  const noPpg = (): EscopoV1 => ({
    tipo: 'PPG',
    ppgId: base.ppgId,
    cicloId: base.cicloId,
  });

  // ------------------------------------------------- catalogo compartilhado --

  it('parceiro continua pesquisavel e detalhavel sem alcance de bolsa ou missao', async () => {
    await conceder('parceiro:read');

    const lista = await parceiros.listar({ busca: 'Parceira' } as never);
    expect(lista.map((p) => p.id)).toContain(parceiroId);
    expect((await parceiros.detalhar(parceiroId)).nome).toBe(
      'Universidade Parceira',
    );

    // O cadastro abre; o historico dele vem vazio, que e a diferenca entre
    // "catalogo compartilhado" e "historico compartilhado".
    const historico = await parceiros.historico(parceiroId, await acesso());
    expect(historico.parceiro.id).toBe(parceiroId);
    expect(historico.mobilidades).toEqual([]);
    expect(historico.missoes).toEqual([]);
    expect(historico.produtos).toEqual([]);
    expect(historico.convenios).toEqual([]);
  });

  // ------------------------------------------------------ historico recortado --

  it('historico traz so a bolsa alcancada, e a contagem de vinculos acompanha', async () => {
    await conceder('parceiro:read');
    await conceder('bolsa:read', noPpg());

    const historico = await parceiros.historico(parceiroId, await acesso());
    expect(historico.mobilidades.map((m) => m.id)).toEqual([bolsaDentro]);

    // `vinculos` e agregado: somar antes de filtrar publicaria o total real.
    const total = historico.vinculos.reduce((s, v) => s + v.mobilidades, 0);
    expect(total).toBe(1);
  });

  it('historico traz so a missao alcancada, com roteiro e evento juntos', async () => {
    await conceder('parceiro:read');
    await conceder('missao:read', naRede());

    const historico = await parceiros.historico(parceiroId, await acesso());
    expect(historico.missoes.map((m) => m.id)).toEqual([missaoDentro]);

    // Roteiro e evento pendem da missao: liberar os dois devolveria a parada
    // de uma viagem que a lista acima ja recusou mostrar.
    expect(historico.missoes[0].atividades).toHaveLength(1);
    expect(historico.eventos.map((e) => e.missaoId)).toEqual([missaoDentro]);
  });

  it('produto do parceiro exige a acao propria e o alcance da missao que o gerou', async () => {
    await conceder('parceiro:read');
    await conceder('produto-missao:read');

    // Sem `missao:read` o produto nao passa: ele e resultado de uma viagem.
    expect(
      (await parceiros.historico(parceiroId, await acesso())).produtos,
    ).toEqual([]);

    await conceder('missao:read', naRede());
    const comMissao = await parceiros.historico(parceiroId, await acesso());
    expect(comMissao.produtos.map((p) => p.id)).toEqual([produtoDentro]);
    expect(comMissao.produtos.map((p) => p.id)).not.toContain(produtoFora);
  });

  it('convenio segue convenio:read e nao a missao de origem', async () => {
    await conceder('parceiro:read');

    expect(
      (await parceiros.historico(parceiroId, await acesso())).convenios,
    ).toEqual([]);

    // O acordo sobrevive a viagem: quem cuida de convenio o enxerga mesmo sem
    // alcancar a missao de outra rede que o originou (CG-056).
    await conceder('convenio:read');
    const comConvenio = await parceiros.historico(parceiroId, await acesso());
    expect(comConvenio.convenios.map((c) => c.id)).toEqual([convenioId]);
  });

  // ------------------------------------------------------------- anexos --

  it('trocar o UUID do anexo nao permite leitura fora do alcance', async () => {
    await conceder('bolsa:read', noPpg());
    await conceder('missao:read', naRede());
    await conceder('documento:read');
    await conceder('documento:download');

    // 404 nas duas pontas: o anexo existe, e dizer isso ja entregaria que
    // aquela pessoa tem bolsa e que aquela missao existe.
    const quem = await comoUsuario();
    await expect(anexos.baixar(anexoDaBolsaFora, quem)).rejects.toThrow(
      /não encontrado/i,
    );
    await expect(anexos.baixar(anexoDaMissaoFora, quem)).rejects.toThrow(
      /não encontrado/i,
    );
  });

  it('trocar o UUID do alvo nao permite pendurar documento fora do alcance', async () => {
    await conceder('bolsa:edit', noPpg());
    await conceder('missao:edit', naRede());
    await conceder('documento:create');

    for (const [tipo, id] of [
      ['BOLSA_CONCEDIDA', bolsaFora],
      ['MISSAO_COMITE', missaoFora],
    ] as const) {
      await expect(
        anexos.enviar(
          {
            entidadeTipo: tipo,
            entidadeId: id,
            categoria: tipo === 'BOLSA_CONCEDIDA' ? 'RELATORIO' : 'ATA',
            visibilidade: 'INTERNA',
          } as never,
          PDF() as never,
          await comoUsuario(),
        ),
      ).rejects.toThrow(/não encontrado/i);
    }

    // Nenhuma linha nova: a recusa acontece antes de gravar.
    const gravados = await ctx.db
      .select({ id: s.anexo.id })
      .from(s.anexo)
      .where(eq(s.anexo.entidadeId, bolsaFora));
    expect(gravados).toHaveLength(1);
  });

  it('o alcance cobrado e o da acao exercida, nao o de missao:read', async () => {
    // Leitura de missao numa rede e de prestacao noutra: ate a V1-016 o
    // documento da prestacao era recortado por `missao:read`, e esta conta
    // baixaria o comprovante da rede errada.
    await conceder('missao:read');
    await conceder('prestacao:read', naRede());
    await conceder('documento:read');
    await conceder('documento:download');

    const prestacaoId = (
      await ctx.db
        .insert(s.prestacaoContasMissao)
        .values({ missaoId: missaoFora, status: 'EM_PREENCHIMENTO' })
        .returning()
    )[0].id;
    const documento = await inserirAnexo('MISSAO_COMITE', missaoFora);
    await ctx.db
      .update(s.anexo)
      .set({
        entidadeTipo: 'PRESTACAO_CONTAS_MISSAO',
        entidadeId: prestacaoId,
        categoria: 'COMPROVANTE',
      })
      .where(eq(s.anexo.id, documento));

    await expect(anexos.baixar(documento, await comoUsuario())).rejects.toThrow(
      /não encontrado/i,
    );
  });
});
