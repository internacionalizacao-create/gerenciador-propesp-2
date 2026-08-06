import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import * as s from '../src/database/schema';
import { executarSeed } from '../src/database/seed/seed';
import { CatalogoService } from '../src/dominio/catalogo.service';
import { CicloService } from '../src/dominio/ciclo.service';
import {
  ContextoService,
  type CicloResolvido,
} from '../src/dominio/contexto.service';
import {
  deCentavos,
  OrcamentoService,
  paraCentavos,
  somarMoeda,
} from '../src/dominio/orcamento.service';
import { PainelService } from '../src/dominio/painel.service';
import { PendenciasService } from '../src/dominio/pendencias.service';
import { PlanoService } from '../src/dominio/plano.service';
import { PpgsService } from '../src/dominio/ppgs.service';
import { criarContextoTeste, type ContextoTeste } from './db-teste';

/**
 * Servicos de dominio contra o Postgres real.
 *
 * O criterio e o mesmo do aceite da migracao: **os servicos tem que reproduzir
 * os numeros das planilhas**. Se o painel disser 1.144.357,21, e bug — nao
 * arredondamento aceitavel.
 *
 * A diferenca para `seed-aceite.int-spec.ts` e o caminho: la a consulta e
 * escrita no proprio teste; aqui e o codigo de producao que responde. Os dois
 * precisam existir, porque um teste que so exercita a consulta que ele mesmo
 * escreveu nao prova que a tela mostra o numero certo.
 */
describe('Servicos de dominio — CAPES Global 2027–2030', () => {
  let ctx: ContextoTeste;
  let ciclo: CicloResolvido;

  let contexto: ContextoService;
  let catalogo: CatalogoService;
  let orcamento: OrcamentoService;
  let painel: PainelService;
  let plano: PlanoService;
  let ciclos: CicloService;
  let ppgs: PpgsService;
  let pendencias: PendenciasService;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    await ctx.limpar();
    await executarSeed(ctx.db);

    // Instanciacao manual em vez de `Test.createTestingModule`: estes servicos
    // so dependem do banco, e subir o container do Nest para injetar um unico
    // provider adicionaria uma camada que nao esta sob teste.
    contexto = new ContextoService(ctx.db);
    catalogo = new CatalogoService(ctx.db);
    orcamento = new OrcamentoService(ctx.db);
    painel = new PainelService(ctx.db, orcamento);
    plano = new PlanoService(ctx.db, catalogo);
    ciclos = new CicloService(ctx.db, orcamento, plano);
    ppgs = new PpgsService(ctx.db);
    pendencias = new PendenciasService(ctx.db);

    ciclo = await contexto.resolver('capes-global', '2027-2030');
  });

  afterAll(async () => {
    await ctx.encerrar();
  });

  // ------------------------------------------------------------------ //
  describe('ContextoService', () => {
    it('resolve o ciclo pelo slug e pelo nome, com os quatro exercicios', () => {
      expect(ciclo.programaNome).toBe('CAPES Global');
      expect(ciclo.anos).toEqual([2027, 2028, 2029, 2030]);
      expect(ciclo.usaRedes).toBe(true);
    });

    it('recusa ciclo inexistente em vez de devolver vazio', async () => {
      // Devolver lista vazia faria a tela mostrar "R$ 0,00" para um ciclo que
      // nem existe — o erro precisa aparecer como erro.
      await expect(
        contexto.resolver('capes-global', '1999-2000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('escolhe como padrao o programa que tem plano cadastrado', async () => {
      // GCUB e Erasmus existem no cadastro e estao vazios; abrir o painel neles
      // pareceria perda de dados.
      const padrao = await contexto.padrao();
      expect(padrao?.programaSlug).toBe('capes-global');
    });
  });

  // ------------------------------------------------------------------ //
  describe('OrcamentoService', () => {
    it('reproduz o orcamento e o custo da UNESP-T4 (RN-05, RN-06)', async () => {
      const [t4] = (await orcamento.porTematica(ciclo.cicloId, 2027)).filter(
        (t) => t.codigo === 'UNESP-T4',
      );

      expect(t4.valorBolsas).toBe('233854.04');
      expect(t4.totalPrevisto).toBe('266409.24');
      expect(t4.custoBolsas).toBe('231045.40');
      expect(t4.saldoPotencial).toBe('2808.64');
    });

    it('calcula a utilizacao da UFMG-T1 em 92,26% (RN-07)', async () => {
      const [t1] = (await orcamento.porTematica(ciclo.cicloId, 2027)).filter(
        (t) => t.codigo === 'UFMG-T1',
      );

      expect(t1.custoBolsas).toBe('82572.70');
      expect(t1.valorBolsas).toBe('89500.00');
      expect(t1.utilizacao).toBeCloseTo(0.9226, 4);
    });

    it('devolve nulo — nao zero — para tematica sem orcamento definido', async () => {
      // A regra que impede a UNICAMP de derrubar medias e percentuais do painel.
      const semOrcamento = (
        await orcamento.porTematica(ciclo.cicloId, 2027)
      ).filter((t) => t.statusOrcamento === 'A_DEFINIR');

      expect(semOrcamento).toHaveLength(4);
      for (const t of semOrcamento) {
        expect(t.valorBolsas).toBeNull();
        expect(t.totalPrevisto).toBeNull();
        expect(t.saldoPotencial).toBeNull();
        expect(t.utilizacao).toBeNull();
        expect(t.codigo.startsWith('UNICAMP-')).toBe(true);
      }
    });

    it('acha sozinho as duas divergencias de saldo (RN-08)', async () => {
      const divergentes = await orcamento.divergencias(ciclo.cicloId, 2027);

      expect(
        Object.fromEntries(divergentes.map((d) => [d.codigo, d.divergencia])),
      ).toEqual({ 'UNESP-T3': '206.10', 'UNESP-T1': '11005.49' });
    });

    it('consolida por rede: UNESP 624.867,50 e UFMG 519.489,70', async () => {
      const redes = await orcamento.porRede(ciclo.cicloId, 2027);
      const mapa = Object.fromEntries(redes.map((r) => [r.rede, r]));

      expect(mapa.UNESP.custoBolsas).toBe('624867.50');
      expect(mapa.UFMG.custoBolsas).toBe('519489.70');
      // UNICAMP tem tematicas e PPGs, e nao tem orcamento. As duas coisas ao
      // mesmo tempo sao o estado real, e a tela precisa poder mostrar as duas.
      expect(mapa.UNICAMP.valorBolsas).toBeNull();
      expect(mapa.UNICAMP.ppgs).toBe(10);
    });

    it('nao multiplica o orcamento pelo numero de PPGs da rede', async () => {
      // Regressao: a primeira versao da consulta juntava participacao_ppg antes
      // de agregar, e a UNESP aparecia com o orcamento multiplicado por 8.
      const redes = await orcamento.porRede(ciclo.cicloId, 2027);
      const total = somarMoeda(redes.map((r) => r.totalPrevisto));

      expect(total).toBe('1250355.59');
    });
  });

  // ------------------------------------------------------------------ //
  describe('PainelService (P01)', () => {
    it('produz os oito indicadores da faixa com os valores da planilha', async () => {
      const p = await painel.montar(ciclo);
      const valor = (chave: string) =>
        p.indicadores.find((i) => i.chave === chave)?.valor;

      expect(valor('aporte-anual')).toBe('1250355.59');
      expect(valor('projecao-ciclo')).toBe('5001422.36');
      expect(valor('bolsas-ano')).toBe(25);
      expect(valor('custo-bolsas-ano')).toBe('1144357.20');
      expect(valor('ppgs')).toBe(24);
      expect(valor('bolsas-ciclo')).toBe(100);
      expect(valor('saldo-ano')).toBe('36247.25');
      expect(valor('pendencias')).toBe(14);
    });

    it('mantem o Comite Gestor fora do aporte de bolsas (RN-14)', async () => {
      const p = await painel.montar(ciclo);
      const aporte = p.indicadores.find(
        (i) => i.chave === 'aporte-anual',
      )?.valor;

      expect(p.comiteGestorAnual).toBe('381333.00');
      expect(aporte).toBe('1250355.59');
      // A soma indevida daria isto, e inflaria em 30% o recurso de bolsas.
      expect(aporte).not.toBe('1631688.59');
    });

    it('classifica 2 IN e 23 OUT (RN-10, RN-11)', async () => {
      const p = await painel.montar(ciclo);

      expect(p.fluxo).toEqual({ in: 2, out: 23 });
    });

    it('repete o aporte nominal nos quatro exercicios (RN-09)', async () => {
      const p = await painel.montar(ciclo);

      expect(p.porAno.map((a) => a.ano)).toEqual([2027, 2028, 2029, 2030]);
      for (const ano of p.porAno) {
        expect(ano.aporte).toBe('1250355.59');
        expect(ano.custoBolsas).toBe('1144357.20');
        expect(ano.bolsas).toBe(25);
      }
    });

    it('soma o custo por modalidade sem perder nem um centavo', async () => {
      const p = await painel.montar(ciclo);

      expect(somarMoeda(p.porModalidade.map((m) => m.custoAno))).toBe(
        '1144357.20',
      );
      expect(
        p.porModalidade.reduce((total, m) => total + m.quantidadeAno, 0),
      ).toBe(25);
    });

    it('levanta os alertas gerenciais que a planilha nao dava', async () => {
      const p = await painel.montar(ciclo);
      const alerta = (chave: string) =>
        p.alertas.find((a) => a.chave === chave);

      expect(alerta('tematicas-sem-orcamento')?.quantidade).toBe(4);
      expect(alerta('divergencia-saldo')?.quantidade).toBe(2);
      expect(alerta('ppgs-sem-bolsa')?.quantidade).toBe(10);
      expect(alerta('pendencias')?.quantidade).toBe(14);
      // R$ 69.751,14/ano de manutencao e missoes sem nenhum item planejado.
      expect(alerta('apoio-nao-programado')?.detalhe).toContain('69751.14');
      // Alerta que nao leva ao registro e decoracao.
      for (const a of p.alertas) expect(a.destino).toMatch(/^\//);
    });
  });

  // ------------------------------------------------------------------ //
  describe('CatalogoService (RN-01)', () => {
    it('resolve o preco exato de Exterior / Doutorado Sanduiche / 6 meses', async () => {
      const tabela = await catalogo.tabelaVigente('capes-global');
      const modalidade = tabela.itens.find(
        (i) => i.modalidade === 'Doutorado Sanduíche',
      );
      expect(modalidade).toBeDefined();

      const item = await catalogo.resolverItem(
        tabela.id,
        'EXTERIOR',
        modalidade!.modalidadeId,
        '6',
      );

      expect(item.codigo).toBe('CAT-053');
      expect(item.valorBrl).toBe('82902.20');
    });

    it('publica a versao vigente com a cotacao do ciclo (RN-03)', async () => {
      const tabela = await catalogo.tabelaVigente('capes-global');

      expect(tabela.itens).toHaveLength(60);
      expect(Number(tabela.cotacaoDolar)).toBe(6.59);
      expect(tabela.referenciaNormativa).toContain('Portaria');
    });

    it('recusa combinacao sem correspondencia em vez de interpolar', async () => {
      // A garantia central: um valor plausivel e errado e pior que um erro.
      const tabela = await catalogo.tabelaVigente('capes-global');
      const [qualquer] = tabela.itens;

      await expect(
        catalogo.resolverItem(
          tabela.id,
          'EXTERIOR',
          qualquer.modalidadeId,
          '99',
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('nao inventa tabela para programa que ainda nao publicou nenhuma', async () => {
      await expect(catalogo.tabelaVigente('gcub')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ------------------------------------------------------------------ //
  describe('PlanoService (P10)', () => {
    it('lista as 33 linhas com valor de catalogo e custo calculado', async () => {
      const linhas = await plano.listar(ciclo.cicloId);
      const programadas = linhas.filter((l) => l.status === 'PROGRAMADO');

      expect(linhas).toHaveLength(33);
      expect(programadas).toHaveLength(23);
      expect(somarMoeda(programadas.map((l) => l.custoAnual))).toBe(
        '1144357.20',
      );
      // Toda bolsa programada tem preco oficial; nenhuma tem valor digitado.
      for (const l of programadas) {
        expect(l.origemValor).toBe('CATALOGO');
        expect(l.itemCatalogoCodigo).toMatch(/^CAT-\d{3}$/);
      }
    });

    it('marca as 10 linhas da UNICAMP como pendentes e sem valor', async () => {
      const pendentes = (await plano.listar(ciclo.cicloId)).filter(
        (l) => l.status === 'PENDENTE',
      );

      expect(pendentes).toHaveLength(10);
      for (const l of pendentes) {
        expect(l.origemValor).toBe('INDEFINIDO');
        expect(l.custoAnual).toBeNull();
        expect(l.quantidadeAnual).toBe(0);
      }
    });

    it('projeta o ciclo repetindo a quantidade nos quatro anos (RN-09)', async () => {
      const [linha] = (await plano.listar(ciclo.cicloId)).filter(
        (l) => l.status === 'PROGRAMADO',
      );

      expect(linha.porAno).toHaveLength(4);
      expect(linha.quantidadeCiclo).toBe(linha.quantidadeAnual * 4);
    });

    it('cria bolsa resolvendo o preco no catalogo, sem aceitar valor digitado', async () => {
      const tabela = await catalogo.tabelaVigente('capes-global');
      const item = tabela.itens.find((i) => i.codigo === 'CAT-053')!;
      const [ppg] = await ctx.db.select().from(s.ppg).limit(1);

      const criada = await plano.criar(ciclo, {
        rubrica: 'BOLSAS',
        ppgId: ppg.id,
        destino: 'EXTERIOR',
        modalidadeId: item.modalidadeId,
        vigenciaMeses: 6,
        quantidadeAnual: 2,
      });

      expect(criada.codigo).toBe('BOL-034');
      expect(criada.origemValor).toBe('CATALOGO');
      expect(criada.valorUnitario).toBe('82902.20');
      expect(criada.custoAnual).toBe('165804.40');
      // RN-10 · destino EXTERIOR sugere OUT.
      expect(criada.fluxo).toBe('OUT');
      expect(criada.porAno).toHaveLength(4);

      await limparItem(criada.id);
    });

    it('rejeita bolsa cuja combinacao nao existe no catalogo', async () => {
      const tabela = await catalogo.tabelaVigente('capes-global');
      const [ppg] = await ctx.db.select().from(s.ppg).limit(1);

      await expect(
        plano.criar(ciclo, {
          rubrica: 'BOLSAS',
          ppgId: ppg.id,
          destino: 'EXTERIOR',
          modalidadeId: tabela.itens[0].modalidadeId,
          vigenciaMeses: 99,
          quantidadeAnual: 1,
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      // E nao pode ter deixado linha orfa no banco.
      const linhas = await plano.listar(ciclo.cicloId);
      expect(linhas).toHaveLength(33);
    });

    it('aceita valor estimado em missoes, e ele nao vira valor de catalogo', async () => {
      const [ppg] = await ctx.db.select().from(s.ppg).limit(1);

      const criada = await plano.criar(ciclo, {
        rubrica: 'MISSOES',
        ppgId: ppg.id,
        tipoMissao: 'VISITA_TECNICA',
        quantidadeAnual: 3,
        valorUnitarioInformado: 12000,
        justificativaEstimativa: 'Media de tres cotacoes de passagem e diaria.',
      });

      expect(criada.codigo).toBe('MIS-001');
      expect(criada.origemValor).toBe('ESTIMADO');
      expect(criada.custoAnual).toBe('36000.00');
      expect(criada.itemCatalogoCodigo).toBeNull();

      await limparItem(criada.id);
    });

    it('cancela em vez de excluir, e exige justificativa', async () => {
      const [linha] = (await plano.listar(ciclo.cicloId)).filter(
        (l) => l.status === 'PROGRAMADO',
      );

      await expect(
        plano.cancelar(ciclo.cicloId, linha.id, 'curto'),
      ).rejects.toThrow();

      await plano.cancelar(
        ciclo.cicloId,
        linha.id,
        'Rede confirmou a retirada da vaga por oficio.',
      );

      const depois = (await plano.listar(ciclo.cicloId)).find(
        (l) => l.id === linha.id,
      );
      expect(depois?.status).toBe('CANCELADO');

      // Restaura para nao contaminar os testes seguintes.
      await ctx.db
        .update(s.itemPlanejado)
        .set({ status: 'PROGRAMADO', observacoes: null })
        .where(eq(s.itemPlanejado.id, linha.id));
    });
  });

  // ------------------------------------------------------------------ //
  describe('CicloService', () => {
    it('monta o indice do ciclo com os numeros vivos de cada atalho (P06)', async () => {
      const resumo = await ciclos.resumo(ciclo);

      expect(resumo.redes).toBe(3);
      expect(resumo.tematicas).toBe(12);
      expect(resumo.ppgs).toBe(24);
      expect(resumo.membros).toBe(13);
      expect(resumo.linhasPlano).toBe(33);
      expect(resumo.pendenciasAbertas).toBe(14);
      expect(resumo.aporteAnual).toBe('1250355.59');
      expect(resumo.divergencias).toBe(2);
      expect(resumo.tematicasSemOrcamento).toBe(4);
    });

    it('agrupa as 12 tematicas sob as 3 redes, com membros de comite (P07)', async () => {
      const { redes } = await ciclos.redes(ciclo, 2027);

      expect(redes.map((r) => r.rede)).toEqual(['UFMG', 'UNESP', 'UNICAMP']);
      expect(redes.flatMap((r) => r.areas)).toHaveLength(12);

      const unicampT1 = redes
        .flatMap((r) => r.areas)
        .find((a) => a.codigo === 'UNICAMP-T1');
      expect(unicampT1?.membros).toHaveLength(2);
    });

    it('detalha a tematica com PPGs, plano e participacao no custo (P08)', async () => {
      const t4 = await ciclos.tematica(ciclo, 'UNESP-T4');

      expect(t4.valorBolsas).toBe('233854.04');
      expect(t4.custoTotal).toBe('231045.40');
      expect(t4.porAno).toHaveLength(4);
      expect(t4.participacoes.length).toBeGreaterThan(0);
      // A soma da participacao de cada PPG e o custo da tematica.
      expect(somarMoeda(t4.participacoes.map((p) => p.custoAnual))).toBe(
        t4.custoTotal,
      );
    });

    it('recusa codigo de tematica inexistente', async () => {
      await expect(ciclos.tematica(ciclo, 'UNESP-T9')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devolve o Comite Gestor com o aviso de RN-14 junto do numero', async () => {
      const cg = await ciclos.comiteGestor(ciclo);

      expect(cg.totalAnual).toBe('381333.00');
      expect(cg.totalCiclo).toBe('1525332.00');
      expect(cg.anos).toEqual([2026, 2027, 2028, 2029]);
      expect(cg.porRede).toHaveLength(3);
      // O aviso viaja com o dado: quem consumir a API por outro caminho tambem
      // precisa saber que este orcamento nao se soma ao de bolsas.
      expect(cg.aviso).toContain('nao integra');
    });

    it('lista as premissas e as duas fontes documentais (P16)', async () => {
      const { premissas, fontes } = await ciclos.premissas(ciclo);

      expect(premissas).toHaveLength(5);
      expect(fontes).toHaveLength(2);
      expect(
        premissas.find((p) => p.item.toLowerCase().includes('cotação'))?.valor,
      ).toBe('6.59');
    });
  });

  // ------------------------------------------------------------------ //
  describe('PpgsService (P14)', () => {
    it('lista os 24 PPGs com bolsas e custo calculados', async () => {
      const lista = await ppgs.listar();

      expect(lista).toHaveLength(24);
      expect(somarMoeda(lista.map((p) => p.custoAno))).toBe('1144357.20');
      expect(lista.reduce((total, p) => total + p.bolsasAno, 0)).toBe(25);
    });

    it('mostra PPG sem bolsa como zero, e nao o esconde da lista', async () => {
      const semBolsa = (await ppgs.listar()).filter((p) => p.bolsasAno === 0);

      expect(semBolsa).toHaveLength(10);
      for (const p of semBolsa) expect(p.redes).toContain('UNICAMP');
    });

    it('aceita nota CAPES 7 — o limite do prototipo era 5 e havia dado real', async () => {
      const criado = await ppgs.criar({
        nome: 'PPG de Teste em Ciencias',
        sigla: 'PPGTESTE',
        notaCapes: 7,
        situacao: 'ATIVO',
        emRede: false,
        linhasPesquisa: ['Linha A', 'Linha B', 'Linha A'],
      });

      expect(criado.notaCapes).toBe(7);
      // Linha repetida entra uma vez so.
      expect(criado.linhasPesquisa).toHaveLength(2);

      await ctx.db.delete(s.ppg).where(eq(s.ppg.id, criado.id));
    });

    it('substitui as linhas de pesquisa ao atualizar, sem duplicar', async () => {
      const criado = await ppgs.criar({
        nome: 'PPG de Teste em Linhas',
        sigla: 'PPGLIN',
        situacao: 'ATIVO',
        emRede: false,
        linhasPesquisa: ['Antiga'],
      });

      const atualizado = await ppgs.atualizar(criado.id, {
        linhasPesquisa: ['Nova 1', 'Nova 2'],
      });

      expect(atualizado.linhasPesquisa.map((l) => l.nome).sort()).toEqual([
        'Nova 1',
        'Nova 2',
      ]);

      await ctx.db.delete(s.ppg).where(eq(s.ppg.id, criado.id));
    });

    it('nao acusa duplicidade nos dados migrados — nenhum PPG se repete hoje', async () => {
      // Vale registrar: PEND-006 aponta o PROFSAUDE, mas na planilha migrada
      // nenhum PPG aparece em duas tematicas. O alerta abaixo existe para o dia
      // em que aparecer, e este teste garante que ele nao dispara a toa.
      const lista = await ppgs.listar();
      const todos = await Promise.all(lista.map((p) => ppgs.detalhar(p.id)));

      expect(todos.filter((p) => p.alertaTematicaDuplicada)).toHaveLength(0);
    });

    it('avisa quando o mesmo PPG entra em duas tematicas da mesma rede', async () => {
      // O banco permite de proposito (o dado pode existir de verdade), entao a
      // deteccao precisa estar no codigo — PEND-006.
      const [participacao] = await ctx.db
        .select()
        .from(s.participacaoPpg)
        .limit(1);
      const [tematicaOriginal] = await ctx.db
        .select()
        .from(s.areaTematica)
        .where(eq(s.areaTematica.id, participacao.areaTematicaId));

      const [outraDaMesmaRede] = (
        await ctx.db
          .select()
          .from(s.areaTematica)
          .where(eq(s.areaTematica.redeId, tematicaOriginal.redeId))
      ).filter((t) => t.id !== tematicaOriginal.id);

      const [duplicada] = await ctx.db
        .insert(s.participacaoPpg)
        .values({
          areaTematicaId: outraDaMesmaRede.id,
          ppgId: participacao.ppgId,
          situacao: 'CADASTRO_PRELIMINAR',
        })
        .returning();

      const detalhe = await ppgs.detalhar(participacao.ppgId);
      expect(detalhe.alertaTematicaDuplicada).toContain('PEND-006');
      expect(detalhe.alertaTematicaDuplicada).toContain(
        tematicaOriginal.codigo.split('-')[0],
      );

      await ctx.db
        .delete(s.participacaoPpg)
        .where(eq(s.participacaoPpg.id, duplicada.id));

      expect(
        (await ppgs.detalhar(participacao.ppgId)).alertaTematicaDuplicada,
      ).toBeNull();
    });
  });

  // ------------------------------------------------------------------ //
  describe('PendenciasService (P13)', () => {
    it('lista as 14 pendencias migradas', async () => {
      const lista = await pendencias.listar(ciclo.cicloId);
      expect(lista).toHaveLength(14);
    });

    it('numera a proxima sem colidir e exige texto para resolver', async () => {
      const antes = await pendencias.listar(ciclo.cicloId);

      const criada = await pendencias.criar(ciclo.cicloId, {
        assunto: 'Confirmar transferencia do recurso',
        descricao: 'Verificar com a rede se o recurso e transferido a UEA.',
        escopoTipo: 'GERAL',
      });

      // A planilha trouxe dois padroes de codigo (PEN-011 e PEND-001, §9.5), e o
      // maior sufixo numerico e 13. O proximo sai 014 e nao pode repetir nenhum
      // existente — repetir violaria `pendencia_codigo_uk`.
      expect(criada.codigo).toBe('PEND-014');
      expect(antes.map((p) => p.codigo)).not.toContain(criada.codigo);
      expect(criada.origem).toBe('MANUAL');

      const resolvida = await pendencias.atualizar(criada.id, {
        status: 'RESOLVIDA',
        resolucao: 'Oficio 42/2027 confirma a transferencia para a UEA.',
      });
      expect(resolvida.resolvidaEm).not.toBeNull();

      await pendencias.remover(criada.id);
      expect(await pendencias.listar(ciclo.cicloId)).toHaveLength(14);
    });

    it('nao deixa excluir pendencia detectada pelo sistema', async () => {
      // Apagar um alerta que o sistema encontrou apagaria a evidencia junto.
      const [automatica] = await ctx.db
        .insert(s.pendencia)
        .values({
          cicloId: ciclo.cicloId,
          codigo: 'PEND-999',
          assunto: 'Divergencia de saldo em UNESP-T1',
          descricao: 'Detectada por RN-08.',
          origem: 'AUTOMATICA',
        })
        .returning();

      await expect(pendencias.remover(automatica.id)).rejects.toThrow(
        /nao pode ser excluida/,
      );

      await ctx.db.delete(s.pendencia).where(eq(s.pendencia.id, automatica.id));
    });
  });

  // ------------------------------------------------------------------ //
  describe('aritmetica de dinheiro', () => {
    it('soma em centavos, sem passar por ponto flutuante', () => {
      // 0.1 + 0.2 em `number` da 0.30000000000000004. Em 132 parcelas o erro
      // aparece no centavo — que e o que a suite de aceite cobra.
      expect(somarMoeda(['0.10', '0.20'])).toBe('0.30');
      expect(somarMoeda(Array(10).fill('0.10'))).toBe('1.00');
      expect(somarMoeda(['1144357.20', '-1144357.20'])).toBe('0.00');
    });

    it('ignora nulos em vez de trata-los como zero na soma', () => {
      expect(somarMoeda([null, '10.00', null])).toBe('10.00');
      // Soma so de nulos e "0.00" por definicao de soma vazia; quem precisa
      // distinguir "sem dado" de "zero" olha o proprio campo, nao a soma.
      expect(somarMoeda([null, null])).toBe('0.00');
    });

    it('converte ida e volta preservando o valor', () => {
      for (const valor of ['0.00', '1.05', '-3.99', '1144357.20']) {
        expect(deCentavos(paraCentavos(valor))).toBe(valor);
      }
    });
  });

  async function limparItem(id: string): Promise<void> {
    await ctx.db
      .delete(s.planejamentoAnual)
      .where(eq(s.planejamentoAnual.itemPlanejadoId, id));
    await ctx.db.delete(s.itemPlanejado).where(eq(s.itemPlanejado.id, id));
  }
});
