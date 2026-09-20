import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import * as s from '../src/database/schema';
import {
  listarParceirosSchema,
  ParceirosService,
} from '../src/dominio/parceiros.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';
import { criarBase, type BaseFixture } from './fixtures';

describe('V1-042: paginacao de parceiros', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;
  let service: ParceirosService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    service = new ParceirosService(ctx.db);
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

  async function cadastrar(nome: string, extras: Record<string, unknown> = {}) {
    const [linha] = await ctx.db
      .insert(s.instituicao)
      .values({
        nome,
        nomeNormalizado: normalizarNomeInstituicao(nome),
        tipo: 'PARCEIRA_INTERNACIONAL',
        ...extras,
      })
      .returning({ id: s.instituicao.id });
    return linha.id;
  }

  const listar = (filtros: Record<string, unknown> = {}) =>
    service.listar({
      incluirInativos: false,
      pagina: 1,
      tamanho: 50,
      ...filtros,
    });

  it('pagina em ordem sem repetir nem perder linha', async () => {
    // Nomes e nomes normalizados sao unicos no schema atual.
    for (let i = 5; i >= 0; i -= 1) await cadastrar(`Universidade ${i}`);

    const primeira = await listar({ tamanho: 2, pagina: 1 });
    const segunda = await listar({ tamanho: 2, pagina: 2 });
    const terceira = await listar({ tamanho: 2, pagina: 3 });

    expect(primeira.total).toBe(6);
    expect(primeira.paginas).toBe(3);
    expect(primeira.itens).toHaveLength(2);

    const vistos = [...primeira.itens, ...segunda.itens, ...terceira.itens].map(
      (item) => item.id,
    );
    expect(new Set(vistos).size).toBe(6);
    expect(
      [...primeira.itens, ...segunda.itens, ...terceira.itens].map(
        (item) => item.nome,
      ),
    ).toEqual(Array.from({ length: 6 }, (_, i) => `Universidade ${i}`));
  });

  it('a mesma pagina devolve a mesma ordem em consultas repetidas', async () => {
    for (let i = 0; i < 6; i += 1) await cadastrar(`Universidade ${i}`);

    const uma = await listar({ tamanho: 3, pagina: 1 });
    const outra = await listar({ tamanho: 3, pagina: 1 });
    expect(uma.itens.map((item) => item.id)).toEqual(
      outra.itens.map((item) => item.id),
    );
  });

  it('o total e o resumo sao do filtro inteiro, nao da pagina', async () => {
    await cadastrar('Alfa', { cadastroProvisorio: true });
    await cadastrar('Beta', { cadastroProvisorio: true });
    await cadastrar('Gama');
    await cadastrar('Delta');

    const pagina = await listar({ tamanho: 1, pagina: 1 });
    expect(pagina.itens).toHaveLength(1);
    // Contar a pagina e rotular "cadastro provisorio" daria 1 — um numero que
    // muda ao virar de pagina, respondendo a outra pergunta.
    expect(pagina.total).toBe(4);
    expect(pagina.resumo.total).toBe(4);
    expect(pagina.resumo.provisorios).toBe(2);
    // Nenhum tem rede vinculada, e todos estao ativos.
    expect(pagina.resumo.semRede).toBe(4);
    expect(pagina.resumo.comMissao).toBe(0);
  });

  it('o filtro entra antes da paginacao', async () => {
    await cadastrar('Universidade de Montreal');
    await cadastrar('Universidade de Toulouse');
    await cadastrar('Universidade de Coimbra');

    const pagina = await listar({ busca: 'montreal', tamanho: 50 });
    expect(pagina.total).toBe(1);
    expect(pagina.paginas).toBe(1);
    expect(pagina.itens[0].nome).toBe('Universidade de Montreal');
  });

  it('inativo so entra quando pedido, e o total acompanha', async () => {
    await cadastrar('Ativa');
    await cadastrar('Inativa', { ativo: false });

    expect((await listar()).total).toBe(1);
    expect((await listar({ incluirInativos: true })).total).toBe(2);
  });

  it('pagina alem do fim vem vazia sem mentir sobre o total', async () => {
    await cadastrar('Única');

    const pagina = await listar({ tamanho: 10, pagina: 5 });
    expect(pagina.itens).toHaveLength(0);
    // O total continua verdadeiro: e ele que permite a tela oferecer a volta,
    // em vez de mostrar "nenhum parceiro" com resultados existindo.
    expect(pagina.total).toBe(1);
    expect(pagina.paginas).toBe(1);
  });

  it('lista vazia nao inventa pagina zero', async () => {
    const pagina = await listar();
    expect(pagina.total).toBe(0);
    // Uma pagina, vazia — `ceil(0/50)` daria zero, e "página 1 de 0" e um
    // rotulo que nao quer dizer nada.
    expect(pagina.paginas).toBe(1);
  });

  it('a contagem por rede nao duplica a instituicao de duas redes', async () => {
    const id = await cadastrar('Universidade Multirrede');
    const [outraRede] = await ctx.db
      .insert(s.redeCoordenadora)
      .values({
        cicloId: base.cicloId,
        instituicaoId: base.instituicaoId,
        nome: 'REDE-DOIS',
      })
      .returning({ id: s.redeCoordenadora.id });
    await ctx.db.insert(s.instituicaoRede).values([
      { instituicaoId: id, redeId: base.redeId },
      { instituicaoId: id, redeId: outraRede.id },
    ]);

    const pagina = await listar();
    // `exists`, nunca `join`: com join a instituicao de duas redes contaria
    // duas vezes no total e ocuparia duas linhas da pagina.
    expect(pagina.total).toBe(1);
    expect(pagina.itens).toHaveLength(1);
    expect(pagina.itens[0].redes).toHaveLength(2);
    expect(pagina.resumo.semRede).toBe(0);
  });
  it.each([
    { pagina: '0' },
    { pagina: '-1' },
    { pagina: '1.5' },
    { pagina: 'abc' },
    { pagina: 'Infinity' },
    { pagina: '2147483648' },
    { tamanho: '0' },
    { tamanho: '-1' },
    { tamanho: '201' },
    { tamanho: '1.5' },
    { tamanho: 'abc' },
  ])('recusa entrada invalida %j', (filtros) => {
    expect(listarParceirosSchema.safeParse(filtros).success).toBe(false);
  });

  it('aplica padroes e aceita o tamanho maximo', () => {
    expect(listarParceirosSchema.parse({})).toMatchObject({
      pagina: 1,
      tamanho: 50,
    });
    expect(
      listarParceirosSchema.parse({ pagina: '2', tamanho: '200' }),
    ).toMatchObject({ pagina: 2, tamanho: 200 });
  });

  it('filtra por rede antes de contar e paginar', async () => {
    const id = await cadastrar('Vinculada');
    await cadastrar('Sem vinculo');
    await ctx.db
      .insert(s.instituicaoRede)
      .values({ instituicaoId: id, redeId: base.redeId });
    const pagina = await listar({ redeId: base.redeId, tamanho: 1 });
    expect(pagina.total).toBe(1);
    expect(pagina.itens.map((item) => item.id)).toEqual([id]);
    expect(pagina.resumo.semRede).toBe(0);
  });

  it('conta parceiros com missao uma vez e somente dentro do filtro', async () => {
    const id = await cadastrar('Visitada');
    await cadastrar('Sem visita');
    const [pais] = await ctx.db
      .insert(s.pais)
      .values({ nome: 'Brasil', codigoIso2: 'BR', codigoIso3: 'BRA' })
      .returning();
    const [missao] = await ctx.db
      .insert(s.missaoComite)
      .values({
        cicloId: base.cicloId,
        codigo: 'PAG-001',
        titulo: 'Visita',
        objetivo: 'Teste de resumo',
        dataInicio: '2027-03-01',
        dataFim: '2027-03-10',
      })
      .returning();
    await ctx.db.insert(s.atividadeMissao).values(
      [1, 2].map((ordem) => ({
        missaoId: missao.id,
        ordem,
        tipo: 'VISITA_TECNICA' as const,
        titulo: 'Visita',
        paisId: pais.id,
        instituicaoId: id,
        dataInicio: '2027-03-02',
        dataFim: '2027-03-03',
      })),
    );
    expect((await listar({ tamanho: 1 })).resumo.comMissao).toBe(1);
    expect((await listar({ busca: 'Sem visita' })).resumo.comMissao).toBe(0);
  });

  it('mede 10 mil parceiros e mantem resposta limitada', async () => {
    for (let lote = 0; lote < 10; lote++) {
      await ctx.db.insert(s.instituicao).values(
        Array.from({ length: 1000 }, (_, i) => ({
          nome: `Sintetica ${String(lote * 1000 + i).padStart(5, '0')}`,
          nomeNormalizado: `sintetica ${String(lote * 1000 + i).padStart(5, '0')}`,
          tipo: 'PARCEIRA_INTERNACIONAL' as const,
        })),
      );
    }
    const medidas: unknown[] = [];
    for (const filtros of [
      { pagina: 1 },
      { pagina: 200 },
      { busca: '099', pagina: 1 },
    ]) {
      const inicio = performance.now();
      const resultado = await listar(filtros);
      medidas.push({
        filtros,
        ms: Math.round((performance.now() - inicio) * 100) / 100,
        bytes: Buffer.byteLength(JSON.stringify(resultado)),
        total: resultado.total,
      });
      expect(resultado.itens.length).toBeLessThanOrEqual(50);
      expect(resultado.total).toBe(filtros.busca ? 120 : 10000);
    }
    const inicio = performance.now();
    const candidatos = await service.buscarCandidatos({
      nome: 'Sintetica 09900',
    });
    medidas.push({
      lista: 'candidatos',
      ms: Math.round((performance.now() - inicio) * 100) / 100,
      bytes: Buffer.byteLength(JSON.stringify(candidatos)),
      linhas: candidatos.length,
    });
    console.info('V1-042 volume sintetico:', JSON.stringify(medidas));
  });
});
