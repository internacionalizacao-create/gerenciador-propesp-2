import { eq } from 'drizzle-orm';

import type { AuthUser } from '../src/auth/auth-user';
import { colunasDoAlvo } from '../src/auth/autorizacao-v1/persistencia';
import { IdentidadeService } from '../src/auth/identidade.service';
import * as s from '../src/database/schema';
import { MobilidadeService } from '../src/dominio/mobilidade.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import {
  bolsaValida,
  criarAcesso,
  criarBase,
  type BaseFixture,
} from './fixtures';

const admin: AuthUser = {
  id: 'admin-mobilidade',
  name: 'Admin da Mobilidade',
  roles: ['admin'],
  permissions: ['bolsa:read'],
};

const coordenador: AuthUser = {
  id: 'coord-mobilidade',
  username: 'coord.mob',
  email: 'coord.mob@propesp.local',
  name: 'Coordenação',
  roles: ['coordenador'],
  permissions: ['bolsa:read'],
};

/**
 * P02 · panorama de mobilidade (BOL-040).
 *
 * O que se trava aqui: o filtro e o recorte sao **um objeto so**, entao nenhuma
 * quebra pode esquece-los; e a concessao com destino digitado a mao entra no
 * total e fica fora das quebras por pais e instituicao, com aviso.
 */
describe('Panorama de mobilidade', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: MobilidadeService;
  let identidade: IdentidadeService;
  let outroPpgId: string;
  let paisId: string;
  let instituicaoId: string;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    identidade = new IdentidadeService(ctx.db);
    service = new MobilidadeService(ctx.db, identidade);
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);

    // O admin enxerga tudo por concessao GLOBAL; a coordenacao nasce **sem
    // alcance**, e cada caso concede o PPG que quer exercitar.
    await criarAcesso(ctx.db, {
      sub: admin.id,
      nome: admin.name,
      permissoes: admin.permissions,
    });
    await criarAcesso(ctx.db, {
      sub: coordenador.id,
      nome: coordenador.name,
      permissoes: [],
    });

    const [pais] = await ctx.db
      .insert(s.pais)
      .values({
        codigoIso2: 'PT',
        codigoIso3: 'PRT',
        codigoNumerico: '620',
        nome: 'Portugal',
      })
      .returning({ id: s.pais.id });
    paisId = pais.id;
    instituicaoId = base.instituicaoId;

    const [outro] = await ctx.db
      .insert(s.ppg)
      .values({ nome: 'PPG Vizinho', sigla: 'PPGVIZ', situacao: 'ATIVO' })
      .returning({ id: s.ppg.id });
    outroPpgId = outro.id;

    const [item] = await ctx.db
      .insert(s.itemPlanejado)
      .values(bolsaValida(base, 'BOL-100'))
      .returning({ id: s.itemPlanejado.id });

    const conceder = async (
      nome: string,
      cpf: string,
      ppgId: string,
      opcoes: {
        fluxo?: 'IN' | 'OUT';
        comCatalogo?: boolean;
        ano?: number;
      } = {},
    ) => {
      const [pessoa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome, cpf, tipo: 'DISCENTE', ppgId })
        .returning({ id: s.pessoa.id });
      const ano = opcoes.ano ?? 2027;
      await ctx.db.insert(s.bolsaConcedida).values({
        itemPlanejadoId: item.id,
        programaId: base.programaId,
        cicloId: base.cicloId,
        ppgId,
        areaTematicaId: base.areaTematicaId,
        pessoaId: pessoa.id,
        modalidadeId: base.modalidadeId,
        destino: 'EXTERIOR',
        nivelBeneficiario: 'DOUTORADO',
        paisDestinoId: opcoes.comCatalogo === false ? null : paisId,
        instituicaoDestinoId:
          opcoes.comCatalogo === false ? null : instituicaoId,
        instituicaoDestinoNome:
          opcoes.comCatalogo === false ? 'Universidade Digitada' : null,
        dataInicio: `${ano}-03-01`,
        dataFim: `${ano}-08-31`,
        vigenciaMeses: '6.0',
        valorConcedido: '1000.00',
        fluxo: opcoes.fluxo ?? 'OUT',
      });
    };

    await conceder('Bolsista OUT', '52998224725', base.ppgId);
    await conceder('Bolsista IN', '11144477735', base.ppgId, { fluxo: 'IN' });
    await conceder('Bolsista Sem Catalogo', '19625224016', base.ppgId, {
      comCatalogo: false,
    });
    await conceder('Bolsista de Outro PPG', '35145987007', outroPpgId, {
      ano: 2028,
    });
  });

  it('consolida totais, fluxo e quebras sobre o mesmo filtro', async () => {
    const panorama = await service.panorama(admin, {});

    expect(panorama.totais.mobilidades).toBe(4);
    expect(panorama.totais.entrada).toBe(1);
    expect(panorama.totais.saida).toBe(3);
    expect(panorama.totais.valor).toBe('4000.00');

    // Dois exercicios, porque a quarta concessao comeca em 2028.
    expect(panorama.porAno.map((linha) => linha.ano)).toEqual([2027, 2028]);
    expect(panorama.porAno[0].total).toBe(3);

    // Todas usam a mesma modalidade da fixture.
    expect(panorama.porModalidade).toHaveLength(1);
    expect(panorama.porModalidade[0].quantidade).toBe(4);
  });

  it('o destino digitado entra na quebra por instituicao', async () => {
    const panorama = await service.panorama(admin, {});

    // Desde 2026-09-11 o destino e digitado: deixar o texto fora das quebras
    // as esvaziaria. A concessao sem pais informado fica fora so da quebra
    // por pais, e nenhum aviso sobre "digitado a mao" sobra na tela.
    expect(panorama.totais.mobilidades).toBe(4);
    expect(panorama.totais.semInstituicaoCadastrada).toBe(1);
    const porPais = panorama.porPais.reduce(
      (total, linha) => total + linha.quantidade,
      0,
    );
    expect(porPais).toBe(3);
    const porInstituicao = panorama.porInstituicao.reduce(
      (total, linha) => total + linha.quantidade,
      0,
    );
    expect(porInstituicao).toBe(4);
    expect(
      panorama.porInstituicao.some(
        (linha) => linha.rotulo === 'Universidade Digitada',
      ),
    ).toBe(true);
    expect(panorama.totais.instituicoes).toBe(2);
    expect(panorama.avisos).toEqual([]);
  });

  it('o filtro vale para todas as quebras, nao so para os cartoes', async () => {
    const panorama = await service.panorama(admin, { fluxo: 'IN' });

    expect(panorama.totais.mobilidades).toBe(1);
    expect(panorama.totais.entrada).toBe(1);
    // Se a quebra tivesse `where` proprio, aqui viriam as quatro.
    expect(panorama.porModalidade.reduce((t, l) => t + l.quantidade, 0)).toBe(
      1,
    );
    expect(panorama.porPpg.reduce((t, l) => t + l.quantidade, 0)).toBe(1);
  });

  /** Concede `bolsa:read` no PPG da fixture — o recorte que estes casos exercitam. */
  async function concederPpg(usuario: AuthUser) {
    const [conta] = await ctx.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, usuario.id));

    await ctx.db.insert(s.concessaoAcesso).values({
      usuarioId: conta.id,
      permissao: 'bolsa:read',
      justificativa: 'Fixture do recorte por PPG.',
      ...colunasDoAlvo({
        tipo: 'PPG',
        ppgId: base.ppgId,
        cicloId: base.cicloId,
      }),
    });
  }

  it('o recorte por PPG vale para todas as quebras', async () => {
    await concederPpg(coordenador);

    const panorama = await service.panorama(coordenador, {});

    // A concessao do PPG vizinho some do total **e** de cada quebra.
    expect(panorama.totais.mobilidades).toBe(3);
    expect(panorama.totais.ppgs).toBe(1);
    expect(panorama.porAno.map((linha) => linha.ano)).toEqual([2027]);
    expect(panorama.porPpg).toHaveLength(1);
    expect(panorama.porPpg[0].quantidade).toBe(3);
  });
  it('o relatorio usa o mesmo filtro e o mesmo recorte do panorama', async () => {
    const todas = await service.relatorio(admin, {});
    expect(todas).toHaveLength(4);

    // Mesma condicao: o filtro que corta os cartoes corta as linhas.
    const somenteIn = await service.relatorio(admin, { fluxo: 'IN' });
    expect(somenteIn).toHaveLength(1);
    expect(somenteIn[0].fluxo).toBe('IN');

    // E o recorte por PPG vale igual — nao ha uma segunda origem.
    await concederPpg(coordenador);
    const recortado = await service.relatorio(coordenador, {});
    expect(recortado).toHaveLength(3);

    // O total do panorama e a contagem das linhas: se divergissem, a tela e o
    // arquivo diriam coisas diferentes sobre o mesmo recorte.
    const panorama = await service.panorama(coordenador, {});
    expect(panorama.totais.mobilidades).toBe(recortado.length);
  });
  it('o consolidado por rede conta alcance sem inflar com produtos', async () => {
    // Tres produtos numa concessao: com `join` em vez de subconsulta, a bolsa
    // viraria tres linhas e inflaria mobilidades e valor junto.
    const [bolsa] = await ctx.db
      .select({ id: s.bolsaConcedida.id })
      .from(s.bolsaConcedida)
      .limit(1);
    for (const titulo of ['Artigo A', 'Artigo B', 'Artigo C']) {
      await ctx.db.insert(s.produtoBolsa).values({
        bolsaConcedidaId: bolsa.id,
        tipo: 'ARTIGO',
        titulo,
        prazoEntrega: '2027-12-01',
      });
    }

    const panorama = await service.panorama(admin, {});
    const total = panorama.porRede.reduce((t, l) => t + l.quantidade, 0);
    expect(total).toBe(4);
    expect(panorama.totais.valor).toBe('4000.00');

    const comProduto = panorama.porRede.find((l) => l.produtos > 0);
    expect(comProduto?.produtos).toBe(3);
    // Alcance e `distinct`: um PPG, um pais, uma instituicao na fixture.
    expect(comProduto?.ppgs).toBeGreaterThanOrEqual(1);
  });
  it('a quebra por pais leva o codigo que o mapa entende (BOL-042)', async () => {
    const panorama = await service.panorama(admin, {});
    const portugal = panorama.porPais.find((p) => p.rotulo === 'Portugal');

    // Sem o numerico, o mapa casaria por nome em ingles e Portugal ficaria sem
    // cor sem ninguem notar — pais sem cor e indistinguivel de pais sem bolsa.
    expect(portugal?.codigoNumerico).toBe('620');
    expect(portugal?.codigoIso2).toBe('PT');
  });

  it('a producao le os dois dominios sem funta-los (BOL-051)', async () => {
    const [bolsa] = await ctx.db
      .select({ id: s.bolsaConcedida.id })
      .from(s.bolsaConcedida)
      .limit(1);
    await ctx.db.insert(s.produtoBolsa).values({
      bolsaConcedidaId: bolsa.id,
      tipo: 'TESE_COTUTELA',
      titulo: 'Tese em cotutela',
      prazoEntrega: '2028-06-30',
    });

    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'MCG-PROD',
        titulo: 'Missão com produto',
        objetivo: 'Testar produção',
        dataInicio: '2027-05-01',
        dataFim: '2027-05-05',
      })
      .returning({ id: s.missaoComite.id });
    await ctx.db.insert(s.produtoMissao).values({
      missaoId: missao.id,
      tipo: 'REDE_PESQUISA',
      titulo: 'Rede de pesquisa criada',
      ano: 2027,
    });

    const producao = await service.producao({
      ...admin,
      permissions: ['bolsa:read', 'produto:read', 'missao:read'],
    });

    // As duas origens aparecem, marcadas — a soma nao apaga a diferenca.
    expect(producao).toHaveLength(2);
    expect(producao.map((l) => l.origem).sort()).toEqual(['BOLSA', 'MISSAO']);
    const daBolsa = producao.find((l) => l.origem === 'BOLSA');
    expect(daBolsa?.contexto).toBe('Bolsista OUT');

    // Sem `missao:read`, o produto de missao nao entra: quem nao alcanca a
    // missao nao deve ler o que ela rendeu.
    const semMissao = await service.producao(admin);
    expect(semMissao.map((l) => l.origem)).toEqual(['BOLSA']);
  });
});
