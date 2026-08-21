import {
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import * as s from '../src/database/schema';
import { executarSeed } from '../src/database/seed/seed';
import { BolsistasService } from '../src/dominio/bolsistas.service';
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
import { ProgramasController } from '../src/dominio/programas.controller';
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
  let bolsistas: BolsistasService;
  let catalogo: CatalogoService;
  let orcamento: OrcamentoService;
  let painel: PainelService;
  let plano: PlanoService;
  let ciclos: CicloService;
  let ppgs: PpgsService;
  let pendencias: PendenciasService;
  let programas: ProgramasController;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
    await ctx.limpar();
    await executarSeed(ctx.db);

    // Instanciacao manual em vez de `Test.createTestingModule`: estes servicos
    // so dependem do banco, e subir o container do Nest para injetar um unico
    // provider adicionaria uma camada que nao esta sob teste.
    contexto = new ContextoService(ctx.db);
    bolsistas = new BolsistasService(ctx.db);
    catalogo = new CatalogoService(ctx.db);
    orcamento = new OrcamentoService(ctx.db);
    painel = new PainelService(ctx.db, orcamento);
    plano = new PlanoService(ctx.db, catalogo);
    ciclos = new CicloService(ctx.db, orcamento, plano);
    ppgs = new PpgsService(ctx.db);
    pendencias = new PendenciasService(ctx.db);
    programas = new ProgramasController(
      ctx.db,
      contexto,
      ciclos,
      painel,
      orcamento,
      plano,
      pendencias,
    );

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
      // Os cadastros futuros existem, mas ficam inativos ate a ampliacao do
      // escopo. O painel inicial nao pode seleciona-los.
      const padrao = await contexto.padrao();
      expect(padrao?.programaSlug).toBe('capes-global');
    });

    it('lista somente o CAPES Global como programa ativo', async () => {
      expect((await programas.listar()).map((p) => p.slug)).toEqual([
        'capes-global',
      ]);
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

    it('calcula a utilizacao da composicao original aprovada da UFMG-T1', async () => {
      const [t1] = (await orcamento.porTematica(ciclo.cicloId, 2027)).filter(
        (t) => t.codigo === 'UFMG-T1',
      );

      expect(t1.custoBolsas).toBe('54697.00');
      expect(t1.valorBolsas).toBe('89500.00');
      expect(t1.utilizacao).toBeCloseTo(0.6111, 4);
    });

    it('separa orcamento definido de composicao a definir na UNICAMP', async () => {
      const semComposicao = (
        await orcamento.porTematica(ciclo.cicloId, 2027)
      ).filter((t) => t.statusComposicao === 'A_DEFINIR');

      expect(semComposicao).toHaveLength(4);
      for (const t of semComposicao) {
        expect(t.valorBolsas).not.toBeNull();
        expect(t.saldoPotencial).toBeNull();
        expect(t.utilizacao).toBeNull();
        expect(t.codigo.startsWith('UNICAMP-')).toBe(true);
      }
    });

    it('nao aponta divergencia depois da conciliacao da UNESP-T1 (RN-08)', async () => {
      const divergentes = await orcamento.divergencias(ciclo.cicloId, 2027);

      expect(divergentes).toEqual([]);
    });

    it('consolida o custo aprovado e preserva o orçamento da UNICAMP', async () => {
      const redes = await orcamento.porRede(ciclo.cicloId, 2027);
      const mapa = Object.fromEntries(redes.map((r) => [r.rede, r]));

      expect(mapa.UNESP.custoBolsas).toBe('636531.80');
      expect(mapa.UFMG.custoBolsas).toBe('396981.60');
      expect(mapa.UNICAMP.valorBolsas).toBe('1065088.99');
      expect(mapa.UNICAMP.statusComposicao).toBe('A_DEFINIR');
      expect(mapa.UNICAMP.saldoPotencial).toBeNull();
      expect(mapa.UNICAMP.ppgs).toBe(10);
    });

    it('nao multiplica o orcamento pelo numero de PPGs da rede', async () => {
      // Regressao: a primeira versao da consulta juntava participacao_ppg antes
      // de agregar, e a UNESP aparecia com o orcamento multiplicado por 8.
      const redes = await orcamento.porRede(ciclo.cicloId, 2027);
      const total = somarMoeda(redes.map((r) => r.totalPrevisto));

      expect(total).toBe('2315444.58');
    });
  });

  // ------------------------------------------------------------------ //
  describe('PainelService (P01)', () => {
    it('produz os oito indicadores da faixa com os valores da planilha', async () => {
      const p = await painel.montar(ciclo);
      const valor = (chave: string) =>
        p.indicadores.find((i) => i.chave === chave)?.valor;

      expect(valor('aporte-anual')).toBe('2315444.58');
      expect(valor('projecao-ciclo')).toBe('9261778.32');
      expect(valor('bolsas-ano')).toBe(22);
      expect(valor('custo-bolsas-ano')).toBe('1033513.40');
      expect(valor('ppgs')).toBe(24);
      expect(valor('bolsas-ciclo')).toBe(22);
      expect(valor('saldo-ano')).toBe('147091.05');
      expect(valor('pendencias')).toBe(6);
    });

    it('mantem o Comite Gestor fora do aporte de bolsas (RN-14)', async () => {
      const p = await painel.montar(ciclo);
      const aporte = p.indicadores.find(
        (i) => i.chave === 'aporte-anual',
      )?.valor;

      expect(p.comiteGestorAnual).toBe('381333.00');
      expect(aporte).toBe('2315444.58');
      // A soma indevida daria isto, e inflaria em 30% o recurso de bolsas.
      expect(aporte).not.toBe('2696777.58');
    });

    it('classifica 2 IN e 20 OUT na composicao aprovada (RN-10, RN-11)', async () => {
      const p = await painel.montar(ciclo);

      expect(p.fluxo).toEqual({ in: 2, out: 20 });
    });

    it('repete o aporte nominal nos quatro exercicios (RN-09)', async () => {
      const p = await painel.montar(ciclo);

      expect(p.porAno.map((a) => a.ano)).toEqual([2027, 2028, 2029, 2030]);
      for (const ano of p.porAno) {
        expect(ano.aporte).toBe('2315444.58');
      }
      expect(p.porAno[0].custoBolsas).toBe('1033513.40');
      expect(p.porAno[0].bolsas).toBe(22);
      for (const ano of p.porAno.slice(1)) {
        expect(ano.custoBolsas).toBe('0.00');
        expect(ano.bolsas).toBe(0);
        expect(ano.saldoPotencial).toBeNull();
      }
    });

    it('soma o custo por modalidade sem perder nem um centavo', async () => {
      const p = await painel.montar(ciclo);

      expect(somarMoeda(p.porModalidade.map((m) => m.custoAno))).toBe(
        '1033513.40',
      );
      expect(
        p.porModalidade.reduce((total, m) => total + m.quantidadeAno, 0),
      ).toBe(22);
    });

    it('levanta os alertas gerenciais que a planilha nao dava', async () => {
      const p = await painel.montar(ciclo);
      const alerta = (chave: string) =>
        p.alertas.find((a) => a.chave === chave);

      expect(alerta('composicoes-a-definir')?.quantidade).toBe(4);
      expect(alerta('divergencia-saldo')).toBeUndefined();
      expect(alerta('ppgs-sem-bolsa')?.quantidade).toBe(10);
      expect(alerta('pendencias')?.quantidade).toBe(6);
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
    it('lista 18 linhas aprovadas, 4 propostas pendentes e 1 cancelada', async () => {
      const linhas = await plano.listar(ciclo.cicloId);
      const programadas = linhas.filter((l) => l.status === 'PROGRAMADO');

      expect(linhas).toHaveLength(23);
      expect(programadas).toHaveLength(18);
      expect(somarMoeda(programadas.map((l) => l.custoAnual))).toBe(
        '1033513.40',
      );
      // Toda bolsa programada tem preco oficial; nenhuma tem valor digitado.
      for (const l of programadas) {
        expect(l.origemValor).toBe('CATALOGO');
        expect(l.itemCatalogoCodigo).toMatch(/^CAT-\d{3}$/);
      }
    });

    it('marca as 4 Capacitações da UFMG como pendentes e tabeladas', async () => {
      const pendentes = (await plano.listar(ciclo.cicloId)).filter(
        (l) => l.status === 'PENDENTE',
      );

      expect(pendentes).toHaveLength(4);
      for (const l of pendentes) {
        expect(l.origemValor).toBe('CATALOGO');
        expect(l.custoAnual).not.toBeNull();
        expect(l.quantidadeAnual).toBe(1);
        expect(l.rede).toBe('UFMG');
      }
    });

    it('mantem 2028-2030 a definir, sem replicar 2027 (RN-09)', async () => {
      const [linha] = (await plano.listar(ciclo.cicloId)).filter(
        (l) => l.status === 'PROGRAMADO',
      );

      expect(linha.porAno).toHaveLength(4);
      expect(linha.quantidadeCiclo).toBe(linha.quantidadeAnual);
      expect(linha.porAno.filter((ano) => ano.quantidade > 0)).toEqual([
        expect.objectContaining({ ano: 2027 }),
      ]);
    });

    it('nao cria linhas artificiais para os PPGs apenas elegiveis da UNICAMP', async () => {
      const linhas = (await plano.listar(ciclo.cicloId)).filter(
        (linha) => linha.rede === 'UNICAMP',
      );
      expect(linhas).toHaveLength(0);
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
        ano: 2027,
        quantidadeAnual: 2,
      });

      expect(criada.codigo).toBe('BOL-024');
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
          ano: 2027,
          quantidadeAnual: 1,
        }),
      ).rejects.toThrow(UnprocessableEntityException);

      // E nao pode ter deixado linha orfa no banco.
      const linhas = await plano.listar(ciclo.cicloId);
      expect(linhas).toHaveLength(23);
    });

    it('aceita valor estimado em missoes, e ele nao vira valor de catalogo', async () => {
      const [ppg] = await ctx.db.select().from(s.ppg).limit(1);

      const criada = await plano.criar(ciclo, {
        rubrica: 'MISSOES',
        ppgId: ppg.id,
        tipoMissao: 'VISITA_TECNICA',
        ano: 2027,
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

    it('edita como admin e registra cada campo alterado na auditoria', async () => {
      const [linha] = (await plano.listar(ciclo.cicloId)).filter(
        (item) => item.status === 'PROGRAMADO' && item.rubrica === 'BOLSAS',
      );
      const quantidadeOriginal = linha.quantidadeAnual;

      const atualizada = await plano.atualizar(
        ciclo,
        linha.id,
        {
          rubrica: 'BOLSAS',
          ppgId: linha.ppgId,
          areaTematicaId: linha.areaTematicaId,
          destino: linha.destino!,
          modalidadeId: linha.modalidadeId!,
          vigenciaMeses: Number(linha.vigenciaMeses),
          ano: 2027,
          quantidadeAnual: quantidadeOriginal + 1,
          status: 'PROGRAMADO',
          mesImplementacao: linha.mesImplementacao as 'MARCO' | 'SETEMBRO',
          textoFonte: linha.textoFonte,
          justificativaEdicao: 'Correcao de digitacao confirmada pela PROPESP.',
        },
        {
          id: 'sub-admin-teste',
          name: 'Admin Teste',
          roles: ['admin'],
          permissions: ['plano:edit'],
        },
      );

      expect(atualizada.quantidadeAnual).toBe(quantidadeOriginal + 1);
      expect(atualizada.quantidadeCiclo).toBe(quantidadeOriginal + 1);
      const historico = await plano.historico(ciclo.cicloId, linha.id);
      expect(historico).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            campo: 'quantidadeAnual',
            usuarioNome: 'Admin Teste',
            valorAnterior: String(quantidadeOriginal),
            valorNovo: String(quantidadeOriginal + 1),
          }),
        ]),
      );

      await ctx.db
        .update(s.itemPlanejado)
        .set({ quantidadeAnual: quantidadeOriginal })
        .where(eq(s.itemPlanejado.id, linha.id));
      await ctx.db
        .update(s.planejamentoAnual)
        .set({ quantidade: 0 })
        .where(eq(s.planejamentoAnual.itemPlanejadoId, linha.id));
      await ctx.db
        .update(s.planejamentoAnual)
        .set({ quantidade: quantidadeOriginal })
        .where(
          and(
            eq(s.planejamentoAnual.itemPlanejadoId, linha.id),
            eq(s.planejamentoAnual.ano, 2027),
          ),
        );
      await ctx.db
        .delete(s.registroAuditoria)
        .where(eq(s.registroAuditoria.entidadeId, linha.id));
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
  describe('BolsistasService (P03)', () => {
    it('concede uma vaga anual e acompanha produtos individuais', async () => {
      const opcao = (await bolsistas.opcoesPlanejamento()).find(
        (item) => item.codigo === 'BOL-014',
      );
      expect(opcao).toBeDefined();
      expect(opcao?.porAno).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ano: 2027,
            planejadas: 1,
            concedidas: 0,
            vagasDisponiveis: 1,
          }),
        ]),
      );

      const criada = await bolsistas.criar({
        itemPlanejadoId: opcao!.id,
        nome: 'Bolsista de Integração',
        email: 'bolsista.integracao@uea.edu.br',
        cpf: '52998224725',
        nivelBeneficiario: 'DOCENTE',
        paisDestino: 'Portugal',
        instituicaoDestino: 'Universidade de Coimbra',
        dataInicio: '2027-09-01',
        dataFim: '2027-10-31',
        status: 'SELECIONADO',
        processo: 'SEI-TESTE-001',
      });

      expect(criada.codigoPlanejamento).toBe('BOL-014');
      expect(criada.valorConcedido).toBe('54697.00');
      expect(criada.dataFim).toBe('2027-10-31');
      expect(criada.paisDestino).toBe('Portugal');
      expect(criada.instituicaoDestino).toBe('Universidade de Coimbra');
      expect(criada.situacaoTemporal).toBeDefined();

      const outraModalidade = (await bolsistas.opcoesPlanejamento()).find(
        (item) => item.codigo === 'BOL-015',
      );
      await expect(
        bolsistas.criar({
          itemPlanejadoId: outraModalidade!.id,
          nome: 'Bolsista de Integração',
          email: 'bolsista.integracao@uea.edu.br',
          cpf: '52998224725',
          nivelBeneficiario: 'DOCENTE',
          paisDestino: 'Espanha',
          instituicaoDestino: 'Universidade de Barcelona',
          dataInicio: '2027-09-01',
          dataFim: '2027-10-31',
          status: 'SELECIONADO',
        }),
      ).rejects.toThrow('já utilizou outra modalidade de bolsa neste ciclo');

      const produto = await bolsistas.criarProduto(criada.id, {
        tipo: 'ARTIGO',
        titulo: 'Artigo resultante da mobilidade',
        prazoEntrega: '2027-12-15',
        status: 'PREVISTO',
      });
      expect(produto.situacao).toBe('PREVISTO');

      const entregue = await bolsistas.atualizarProduto(criada.id, produto.id, {
        tipo: 'ARTIGO',
        titulo: 'Artigo resultante da mobilidade',
        prazoEntrega: '2027-12-15',
        status: 'ENTREGUE',
        dataEntrega: '2027-12-10',
        doi: '10.0000/teste',
      });
      expect(entregue.situacao).toBe('ENTREGUE');

      const detalhe = await bolsistas.detalhar(criada.id);
      expect(detalhe.produtos).toEqual([
        expect.objectContaining({
          titulo: 'Artigo resultante da mobilidade',
          dataEntrega: '2027-12-10',
        }),
      ]);

      await expect(
        bolsistas.criar({
          itemPlanejadoId: opcao!.id,
          nome: 'Outra pessoa para a mesma vaga',
          cpf: '11144477735',
          nivelBeneficiario: 'DOCENTE',
          paisDestino: 'Portugal',
          instituicaoDestino: 'Universidade do Porto',
          dataInicio: '2027-09-05',
          dataFim: '2027-11-04',
          status: 'SELECIONADO',
        }),
      ).rejects.toThrow('Todas as 1 vagas planejadas para 2027');

      await ctx.db
        .delete(s.bolsaConcedida)
        .where(eq(s.bolsaConcedida.id, criada.id));
      await ctx.db.delete(s.pessoa).where(eq(s.pessoa.id, criada.pessoaId));
    });
  });

  // ------------------------------------------------------------------ //
  describe('CicloService', () => {
    it('monta o indice do ciclo com os numeros vivos de cada atalho (P06)', async () => {
      const resumo = await ciclos.resumo(ciclo);

      expect(resumo.redes).toBe(3);
      expect(resumo.tematicas).toBe(12);
      expect(resumo.ppgs).toBe(24);
      expect(resumo.coordenadores).toBe(13);
      expect(resumo.linhasPlano).toBe(22);
      expect(resumo.pendenciasAbertas).toBe(6);
      expect(resumo.aporteAnual).toBe('2315444.58');
      expect(resumo.divergencias).toBe(0);
      expect(resumo.tematicasSemOrcamento).toBe(0);
    });

    it('agrupa as tematicas com coordenador por PPG participante (P07)', async () => {
      const { redes } = await ciclos.redes(ciclo, 2027);

      expect(redes.map((r) => r.rede)).toEqual(['UFMG', 'UNESP', 'UNICAMP']);
      expect(redes.flatMap((r) => r.areas)).toHaveLength(12);

      const unicampT1 = redes
        .flatMap((r) => r.areas)
        .find((a) => a.codigo === 'UNICAMP-T1');
      expect(unicampT1?.coordenadores).toHaveLength(5);
      expect(new Set(unicampT1?.coordenadores.map((c) => c.nome)).size).toBe(2);
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

    it('lista as premissas e as quatro fontes documentais (P16)', async () => {
      const { premissas, fontes } = await ciclos.premissas(ciclo);

      expect(premissas).toHaveLength(5);
      expect(fontes).toHaveLength(4);
      expect(fontes.map((fonte) => fonte.nome)).toEqual(
        expect.arrayContaining([
          'Guia de Orientações para Remanejamento e Transformação',
          'Planejamento CAPES Global 2027–2030 atualizado',
        ]),
      );
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
      expect(somarMoeda(lista.map((p) => p.custoAno))).toBe('1033513.40');
      expect(lista.reduce((total, p) => total + p.bolsasAno, 0)).toBe(22);
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
          coordenadorTematicaId: participacao.coordenadorTematicaId,
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
