import { eq, sql } from 'drizzle-orm';

import { normalizarNomeInstituicao } from '../src/database/normalizacao';
import * as s from '../src/database/schema';
import {
  criarContextoTeste,
  esperarViolacao,
  type ContextoTeste,
} from './db-teste';
import { bolsaValida, criarBase, type BaseFixture } from './fixtures';

/**
 * QA do schema.
 *
 * Cada teste aqui corresponde a uma garantia que o sistema depende para não
 * repetir um erro que a planilha já cometeu. Não são testes de "o ORM funciona":
 * são testes de que o banco recusa o dado errado mesmo se o código deixar passar.
 */
describe('Schema — integridade', () => {
  let ctx: ContextoTeste;
  let base: BaseFixture;

  beforeAll(async () => {
    ctx = await criarContextoTeste();
  });

  afterAll(async () => {
    await ctx?.encerrar();
  });

  beforeEach(async () => {
    await ctx.limpar();
    base = await criarBase(ctx.db);
  });

  // -------------------------------------------------------------------------
  describe('aritmética de dinheiro', () => {
    it('soma 23 parcelas sem perder centavo', async () => {
      // O ponto exato onde `double precision` falharia. Estes são os 23 valores
      // reais do plano CAPES Global 2027; a soma tem que dar R$ 1.144.357,20
      // (system-structl.md §8.3).
      const parcelas = [
        '82902.20',
        '71896.90',
        '76246.30',
        '27875.70',
        '27875.70',
        '22669.60',
        '82902.20',
        '27875.70',
        '71896.90',
        '27875.70',
        '38881.00',
        '22669.60',
        '21650.00',
        '21650.00',
        '54697.00',
        '58651.00',
        '54697.00',
        '54697.00',
        '60891.60',
        '54697.00',
        '58651.00',
        '27875.70',
        '27875.70',
        '38881.00',
        '27875.70',
      ];

      await ctx.db.insert(s.lancamentoExecucao).values(
        parcelas.map((valor, i) => ({
          codigo: `EXEC-${String(i + 1).padStart(3, '0')}`,
          cicloId: base.cicloId,
          ano: 2027,
          rubrica: 'BOLSAS' as const,
          valorPago: valor,
        })),
      );

      const [{ total }] = await ctx.db
        .select({ total: sql<string>`sum(${s.lancamentoExecucao.valorPago})` })
        .from(s.lancamentoExecucao);

      expect(total).toBe('1144357.20');
    });

    it('guarda vigência de meia mensalidade (regra dos 15 dias)', async () => {
      const [item] = await ctx.db
        .insert(s.itemCatalogoBolsa)
        .values({
          tabelaValoresId: base.tabelaValoresId,
          codigo: 'CAT-057',
          destino: 'EXTERIOR',
          modalidadeId: base.modalidadeId,
          vigenciaMeses: '0.5',
          valorBrl: '22669.60',
        })
        .returning();

      expect(item.vigenciaMeses).toBe('0.5');
    });
  });

  // -------------------------------------------------------------------------
  describe('catálogo de bolsas', () => {
    it('recusa duas linhas com a mesma chave de busca', async () => {
      // Se isto passasse, o mesmo planejamento renderia custos diferentes
      // conforme a ordem de leitura da tabela.
      await esperarViolacao(
        ctx.db.insert(s.itemCatalogoBolsa).values({
          tabelaValoresId: base.tabelaValoresId,
          codigo: 'CAT-999',
          destino: 'EXTERIOR',
          modalidadeId: base.modalidadeId,
          vigenciaMeses: '6.0',
          valorBrl: '99999.99',
        }),
        'item_catalogo_busca_uk',
      );
    });

    it('aceita a mesma combinação em outra versão da tabela', async () => {
      // Reajuste da CAPES cria versão nova; a antiga continua válida para o que
      // já foi planejado com ela (P15).
      const [nova] = await ctx.db
        .insert(s.tabelaValores)
        .values({
          programaId: base.programaId,
          versao: '2027-01-01',
          dataBase: '2027-01-01',
          cotacaoDolar: '7.1000',
          vigenteDe: '2027-01-01',
        })
        .returning();

      const [item] = await ctx.db
        .insert(s.itemCatalogoBolsa)
        .values({
          tabelaValoresId: nova.id,
          codigo: 'CAT-053',
          destino: 'EXTERIOR',
          modalidadeId: base.modalidadeId,
          vigenciaMeses: '6.0',
          valorBrl: '89300.00',
        })
        .returning();

      expect(item.valorBrl).toBe('89300.00');
    });

    it('recusa valor zero ou negativo', async () => {
      await esperarViolacao(
        ctx.db.insert(s.itemCatalogoBolsa).values({
          tabelaValoresId: base.tabelaValoresId,
          codigo: 'CAT-000',
          destino: 'BRASIL',
          modalidadeId: base.modalidadeId,
          vigenciaMeses: '1.0',
          valorBrl: '0',
        }),
        'item_catalogo_valor_brl_ck',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('item planejado', () => {
    it('aceita bolsa programada resolvida no catálogo', async () => {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values(bolsaValida(base))
        .returning();

      expect(item.itemCatalogoId).toBe(base.itemCatalogoId);
    });

    it('recusa bolsa PROGRAMADA sem item de catálogo', async () => {
      // É a garantia de RN-01: nenhum custo de bolsa pode vir de valor digitado.
      await esperarViolacao(
        ctx.db
          .insert(s.itemPlanejado)
          .values({ ...bolsaValida(base), itemCatalogoId: null }),
        'item_planejado_bolsa_catalogo_ck',
      );
    });

    it('aceita proposta PENDENTE ainda sem combinação definida', async () => {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values({
          codigo: 'BOL-024',
          cicloId: base.cicloId,
          rubrica: 'BOLSAS',
          areaTematicaId: base.areaTematicaId,
          ppgId: base.ppgId,
          quantidadeAnual: 0,
          status: 'PENDENTE',
        })
        .returning();

      expect(item.status).toBe('PENDENTE');
      expect(item.itemCatalogoId).toBeNull();
    });

    it('recusa bolsa com valor unitário digitado', async () => {
      await esperarViolacao(
        ctx.db.insert(s.itemPlanejado).values({
          ...bolsaValida(base),
          valorUnitarioInformado: '50000.00',
        }),
        'item_planejado_valor_por_rubrica_ck',
      );
    });

    it('aceita missão com valor estimado', async () => {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values({
          codigo: 'MIS-001',
          cicloId: base.cicloId,
          rubrica: 'MISSOES',
          areaTematicaId: base.areaTematicaId,
          ppgId: base.ppgId,
          descricao: 'Missão de articulação institucional',
          quantidadeAnual: 2,
          valorUnitarioInformado: '10999.80',
          justificativaEstimativa: 'Média das missões de 2026.',
          tipoMissao: 'ARTICULACAO',
          numeroParticipantes: 2,
          numeroDiarias: 5,
          incluiPassagem: true,
        })
        .returning();

      expect(item.valorUnitarioInformado).toBe('10999.80');
      expect(item.itemCatalogoId).toBeNull();
    });

    it('recusa missão vinculada ao catálogo de bolsas', async () => {
      await esperarViolacao(
        ctx.db.insert(s.itemPlanejado).values({
          codigo: 'MIS-002',
          cicloId: base.cicloId,
          rubrica: 'MISSOES',
          ppgId: base.ppgId,
          quantidadeAnual: 1,
          itemCatalogoId: base.itemCatalogoId,
        }),
        'item_planejado_valor_por_rubrica_ck',
      );
    });

    it('recusa código repetido dentro do mesmo ciclo', async () => {
      await ctx.db.insert(s.itemPlanejado).values(bolsaValida(base));

      await esperarViolacao(
        ctx.db.insert(s.itemPlanejado).values(bolsaValida(base)),
        'item_planejado_codigo_uk',
      );
    });

    it('exige PPG mesmo quando não há temática (programas sem rede)', async () => {
      await esperarViolacao(
        ctx.db.insert(s.itemPlanejado).values({
          codigo: 'BOL-999',
          cicloId: base.cicloId,
          rubrica: 'BOLSAS',
          quantidadeAnual: 1,
          status: 'PENDENTE',
        } as never),
        'ppg_id',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('orçamento', () => {
    it('recusa temática DEFINIDO sem valor de bolsas', async () => {
      // Impede que "definido" conviva com valor nulo — a porta pela qual
      // pendente vira zero nos indicadores.
      await esperarViolacao(
        ctx.db.insert(s.orcamentoTematica).values({
          areaTematicaId: base.areaTematicaId,
          ano: 2027,
          status: 'DEFINIDO',
        }),
        'orcamento_tematica_definido_ck',
      );
    });

    it('aceita temática A_DEFINIR com valores nulos (caso UNICAMP)', async () => {
      const [orc] = await ctx.db
        .insert(s.orcamentoTematica)
        .values({
          areaTematicaId: base.areaTematicaId,
          ano: 2027,
          status: 'A_DEFINIR',
        })
        .returning();

      // Nulo, não zero: a diferença que preserva a leitura correta do painel.
      expect(orc.valorBolsas).toBeNull();
    });

    it('recusa dois orçamentos para a mesma temática e ano', async () => {
      const valores = {
        areaTematicaId: base.areaTematicaId,
        ano: 2027,
        status: 'DEFINIDO' as const,
        valorBolsas: '233854.04',
      };
      await ctx.db.insert(s.orcamentoTematica).values(valores);

      await esperarViolacao(
        ctx.db.insert(s.orcamentoTematica).values(valores),
        'orcamento_tematica_ano_uk',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('remanejamento', () => {
    // `remanejamento_autorizacao_ck` saiu na V1-036: no CAPES Global a
    // referencia externa e opcional, e exigi-la travaria o registro enquanto o
    // oficio nao chega (contrato de eventos externos, §7.4).
    it('aceita EXECUTADO sem número de ofício', async () => {
      const [rem] = await ctx.db
        .insert(s.remanejamento)
        .values({
          codigo: 'REM-001',
          cicloId: base.cicloId,
          ano: 2027,
          rubrica: 'BOLSAS',
          valor: '10000.00',
          status: 'EXECUTADO',
        })
        .returning();

      expect(rem.documentoAutorizacao).toBeNull();
    });

    it('recusa quantidade zerada', async () => {
      await esperarViolacao(
        ctx.db.insert(s.remanejamento).values({
          codigo: 'REM-009',
          cicloId: base.cicloId,
          ano: 2027,
          rubrica: 'BOLSAS',
          valor: '10000.00',
          quantidade: 0,
          status: 'EXECUTADO',
        }),
        'remanejamento_quantidade_ck',
      );
    });

    it('aceita PROPOSTO sem documento', async () => {
      const [rem] = await ctx.db
        .insert(s.remanejamento)
        .values({
          codigo: 'REM-001',
          cicloId: base.cicloId,
          ano: 2027,
          rubrica: 'BOLSAS',
          valor: '10000.00',
          status: 'PROPOSTO',
        })
        .returning();

      expect(rem.status).toBe('PROPOSTO');
    });

    it('mantém estrutura genérica para políticas de outros programas', async () => {
      const [rem] = await ctx.db
        .insert(s.remanejamento)
        .values({
          codigo: 'REM-002',
          cicloId: base.cicloId,
          ano: 2027,
          anoOrigem: 2027,
          anoDestino: 2028,
          rubrica: 'BOLSAS',
          valor: '5000.00',
          status: 'AUTORIZADO',
          documentoAutorizacao: 'Ofício 12/2027',
        })
        .returning();

      expect([rem.anoOrigem, rem.anoDestino]).toEqual([2027, 2028]);
    });
  });

  // -------------------------------------------------------------------------
  describe('PPG e participações', () => {
    it('aceita nota CAPES 7', async () => {
      const [p] = await ctx.db
        .insert(s.ppg)
        .values({
          nome: 'PPG em Medicina Tropical',
          sigla: 'PPGMT',
          notaCapes: 7,
        })
        .returning();

      expect(p.notaCapes).toBe(7);
    });

    it('recusa nota CAPES fora de 1..7', async () => {
      await esperarViolacao(
        ctx.db
          .insert(s.ppg)
          .values({ nome: 'PPG Inválido', sigla: 'PPGX', notaCapes: 8 }),
        'ppg_nota_capes_ck',
      );
    });

    it('permite o mesmo PPG em duas temáticas para programas que adotem essa regra', async () => {
      // No CAPES Global o PROFSAÚDE foi confirmado apenas na UNICAMP-T1. A
      // tabela continua genérica porque outros programas podem admitir mais de
      // uma participação; a política específica fica na camada de domínio.
      const [outraArea] = await ctx.db
        .insert(s.areaTematica)
        .values({
          redeId: base.redeId,
          codigo: 'TESTE-T2',
          nome: 'Outra Temática',
        })
        .returning();

      await ctx.db.insert(s.participacaoPpg).values([
        {
          areaTematicaId: base.areaTematicaId,
          ppgId: base.ppgId,
          coordenadorTematicaId: base.coordenadorTematicaId,
        },
        {
          areaTematicaId: outraArea.id,
          ppgId: base.ppgId,
          coordenadorTematicaId: base.coordenadorTematicaId,
        },
      ]);

      const encontradas = await ctx.db
        .select()
        .from(s.participacaoPpg)
        .where(eq(s.participacaoPpg.ppgId, base.ppgId));

      expect(encontradas).toHaveLength(2);
    });

    it('recusa o mesmo PPG duas vezes na MESMA temática', async () => {
      const valores = {
        areaTematicaId: base.areaTematicaId,
        ppgId: base.ppgId,
        coordenadorTematicaId: base.coordenadorTematicaId,
      };
      await ctx.db.insert(s.participacaoPpg).values(valores);

      await esperarViolacao(
        ctx.db.insert(s.participacaoPpg).values(valores),
        'participacao_ppg_uk',
      );
    });

    it('resolve o vínculo circular entre pessoa e PPG', async () => {
      const [coord] = await ctx.db
        .insert(s.pessoa)
        .values({
          nome: 'Coordenadora de Teste',
          tipo: 'DOCENTE',
          ppgId: base.ppgId,
        })
        .returning();

      await ctx.db
        .update(s.ppg)
        .set({ coordenadorId: coord.id })
        .where(eq(s.ppg.id, base.ppgId));

      const encontrado = await ctx.db.query.ppg.findFirst({
        where: eq(s.ppg.id, base.ppgId),
        with: { coordenador: true },
      });

      expect(encontrado?.coordenador?.nome).toBe('Coordenadora de Teste');
    });
  });

  // -------------------------------------------------------------------------
  describe('equipes do Comite Gestor', () => {
    it('permite a mesma pessoa nas duas equipes', async () => {
      await ctx.db.insert(s.membroEquipeGestao).values([
        {
          cicloId: base.cicloId,
          pessoaId: base.coordenadorTematicaId,
          tipoEquipe: 'COMITE_GESTOR',
          funcao: 'Coordenadora',
          dataInicio: '2027-01-01',
        },
        {
          cicloId: base.cicloId,
          pessoaId: base.coordenadorTematicaId,
          tipoEquipe: 'ADMINISTRACAO',
          funcao: 'Apoio',
          dataInicio: '2027-01-01',
        },
      ]);

      const encontrados = await ctx.db
        .select()
        .from(s.membroEquipeGestao)
        .where(eq(s.membroEquipeGestao.pessoaId, base.coordenadorTematicaId));
      expect(encontrados).toHaveLength(2);
    });

    it('recusa dois vinculos abertos na mesma equipe', async () => {
      await ctx.db.insert(s.membroEquipeGestao).values({
        cicloId: base.cicloId,
        pessoaId: base.coordenadorTematicaId,
        tipoEquipe: 'COMITE_GESTOR',
        funcao: 'Titular',
        dataInicio: '2027-01-01',
      });

      await esperarViolacao(
        ctx.db.insert(s.membroEquipeGestao).values({
          cicloId: base.cicloId,
          pessoaId: base.coordenadorTematicaId,
          tipoEquipe: 'COMITE_GESTOR',
          funcao: 'Outra funcao',
          dataInicio: '2028-01-01',
        }),
        'membro_equipe_gestao_ativo_uk',
      );
    });

    it('recusa encerramento anterior ao inicio', async () => {
      await esperarViolacao(
        ctx.db.insert(s.membroEquipeGestao).values({
          cicloId: base.cicloId,
          pessoaId: base.coordenadorTematicaId,
          tipoEquipe: 'COMITE_GESTOR',
          funcao: 'Titular',
          dataInicio: '2027-02-01',
          dataFim: '2027-01-31',
        }),
        'membro_equipe_gestao_periodo_ck',
      );
    });

    it('recusa a mesma rede duas vezes no vinculo da equipe', async () => {
      const [membro] = await ctx.db
        .insert(s.membroEquipeGestao)
        .values({
          cicloId: base.cicloId,
          pessoaId: base.coordenadorTematicaId,
          tipoEquipe: 'COMITE_GESTOR',
          funcao: 'Titular',
          dataInicio: '2027-01-01',
        })
        .returning({ id: s.membroEquipeGestao.id });

      await ctx.db.insert(s.membroEquipeGestaoRede).values({
        membroEquipeId: membro.id,
        redeId: base.redeId,
      });

      await esperarViolacao(
        ctx.db.insert(s.membroEquipeGestaoRede).values({
          membroEquipeId: membro.id,
          redeId: base.redeId,
        }),
        'membro_equipe_gestao_rede_uk',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('parceiros internacionais', () => {
    async function criarParceira(nome = 'Universite Paris-Saclay') {
      const [franca] = await ctx.db
        .insert(s.pais)
        .values({ codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' })
        .onConflictDoNothing()
        .returning();
      const paisFranca =
        franca ??
        (
          await ctx.db.select().from(s.pais).where(eq(s.pais.codigoIso2, 'FR'))
        )[0];

      const [parceira] = await ctx.db
        .insert(s.instituicao)
        .values({
          nome,
          nomeNormalizado: normalizarNomeInstituicao(nome),
          sigla: 'UPS',
          tipo: 'PARCEIRA_INTERNACIONAL',
          paisId: paisFranca.id,
          cidade: 'Paris',
          estadoRegiao: 'Ile-de-France',
          tipoOrganizacao: 'Universidade',
          faculdadeDepartamento: 'Relacoes Internacionais',
          site: 'https://www.universite-paris-saclay.fr',
          emailInstitucional: 'international@example.fr',
          telefone: '+33 1 00 00 00 00',
          endereco: '3 rue de Teste, Paris',
          observacoes: 'Parceira academica para mobilidade.',
        })
        .returning();

      return { parceira, paisFranca };
    }

    it('reutiliza uma instituicao em varias redes e preserva seus contatos', async () => {
      const { parceira, paisFranca } = await criarParceira();
      const [outraRede] = await ctx.db
        .insert(s.redeCoordenadora)
        .values({
          cicloId: base.cicloId,
          instituicaoId: base.instituicaoId,
          nome: 'OUTRA-REDE',
        })
        .returning();

      await ctx.db.insert(s.instituicaoRede).values([
        { instituicaoId: parceira.id, redeId: base.redeId },
        { instituicaoId: parceira.id, redeId: outraRede.id },
      ]);
      await ctx.db.insert(s.contatoInstituicao).values([
        {
          instituicaoId: parceira.id,
          nome: 'Marie Dupont',
          nomeNormalizado: 'marie dupont',
          cargo: 'Diretora',
          departamento: 'Relacoes Internacionais',
          area: 'Cooperacao academica',
          email: 'marie.dupont@example.fr',
          emailNormalizado: 'marie.dupont@example.fr',
          telefone: '+33 1 00 00 00 01',
          paisId: paisFranca.id,
          idiomaComunicacao: 'Frances',
          principal: true,
        },
        {
          instituicaoId: parceira.id,
          nome: 'Jean Martin',
          nomeNormalizado: 'jean martin',
          cargo: 'Professor',
        },
      ]);

      const redes = await ctx.db
        .select()
        .from(s.instituicaoRede)
        .where(eq(s.instituicaoRede.instituicaoId, parceira.id));
      const contatos = await ctx.db
        .select()
        .from(s.contatoInstituicao)
        .where(eq(s.contatoInstituicao.instituicaoId, parceira.id));

      expect(redes).toHaveLength(2);
      expect(contatos).toHaveLength(2);
      expect(contatos.filter((contato) => contato.principal)).toHaveLength(1);
      expect(parceira.cadastroProvisorio).toBe(false);
    });

    it('recusa a mesma instituicao escrita com caixa, acento e pontuacao diferentes', async () => {
      await criarParceira('Université Paris-Saclay');

      await esperarViolacao(
        ctx.db.insert(s.instituicao).values({
          nome: 'UNIVERSITE  PARIS SACLAY',
          nomeNormalizado: normalizarNomeInstituicao(
            'UNIVERSITE  PARIS SACLAY',
          ),
          tipo: 'PARCEIRA_INTERNACIONAL',
        }),
        'instituicao_nome_normalizado_uk',
      );
    });

    it('recusa associacao repetida entre instituicao e rede', async () => {
      const { parceira } = await criarParceira();
      const associacao = {
        instituicaoId: parceira.id,
        redeId: base.redeId,
      };
      await ctx.db.insert(s.instituicaoRede).values(associacao);

      await esperarViolacao(
        ctx.db.insert(s.instituicaoRede).values(associacao),
        'instituicao_rede_uk',
      );
    });

    it('mantem no maximo um contato principal ativo por instituicao', async () => {
      const { parceira } = await criarParceira();
      await ctx.db.insert(s.contatoInstituicao).values({
        instituicaoId: parceira.id,
        nome: 'Contato Principal',
        nomeNormalizado: 'contato principal',
        principal: true,
      });

      await esperarViolacao(
        ctx.db.insert(s.contatoInstituicao).values({
          instituicaoId: parceira.id,
          nome: 'Outro Contato Principal',
          nomeNormalizado: 'outro contato principal',
          principal: true,
        }),
        'contato_instituicao_principal_ativo_uk',
      );

      await esperarViolacao(
        ctx.db.insert(s.contatoInstituicao).values({
          instituicaoId: parceira.id,
          nome: 'Contato Inativo',
          nomeNormalizado: 'contato inativo',
          principal: true,
          ativo: false,
        }),
        'contato_instituicao_principal_ativo_ck',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('missoes do Comite Gestor', () => {
    async function criarMissao(codigo = 'MCG-001') {
      const [missao] = await ctx.db
        .insert(s.missaoComite)
        .values({
          cicloId: base.cicloId,
          codigo,
          titulo: 'Missao institucional internacional',
          objetivo: 'Articular cooperacao academica e visitar parceiros.',
          dataInicio: '2027-05-10',
          dataFim: '2027-05-20',
          status: 'PLANEJADA',
        })
        .returning();
      return missao;
    }

    it('persiste participantes externos e roteiro em varios paises sem dados financeiros', async () => {
      const [externa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Participante Externa', tipo: 'EXTERNO' })
        .returning();
      const paises = await ctx.db
        .insert(s.pais)
        .values([
          { codigoIso2: 'FR', codigoIso3: 'FRA', nome: 'Franca' },
          { codigoIso2: 'DE', codigoIso3: 'DEU', nome: 'Alemanha' },
        ])
        .returning();
      const missao = await criarMissao();

      await ctx.db.insert(s.missaoParticipante).values({
        missaoId: missao.id,
        pessoaId: externa.id,
        papel: 'RESPONSAVEL',
        dataInicio: missao.dataInicio,
        dataFim: missao.dataFim,
      });
      await ctx.db.insert(s.atividadeMissao).values([
        {
          missaoId: missao.id,
          ordem: 1,
          tipo: 'VISITA_TECNICA',
          titulo: 'Visita a universidade parceira',
          paisId: paises[0].id,
          cidade: 'Paris',
          instituicaoNome: 'Universite de Teste',
          dataInicio: '2027-05-11',
          dataFim: '2027-05-12',
          planejamento: 'Reuniao com a equipe de internacionalizacao.',
        },
        {
          missaoId: missao.id,
          ordem: 2,
          tipo: 'EVENTO',
          titulo: 'Congresso internacional',
          paisId: paises[1].id,
          cidade: 'Berlim',
          eventoNome: 'International Cooperation Forum',
          dataInicio: '2027-05-15',
          dataFim: '2027-05-17',
        },
      ]);

      const encontrada = await ctx.db.query.missaoComite.findFirst({
        where: eq(s.missaoComite.id, missao.id),
        with: { participantes: true, atividades: true },
      });

      expect(encontrada?.participantes).toHaveLength(1);
      expect(encontrada?.participantes[0].membroEquipeId).toBeNull();
      expect(
        new Set(encontrada?.atividades.map((atividade) => atividade.paisId)),
      ).toEqual(new Set(paises.map((pais) => pais.id)));
      expect(encontrada).not.toHaveProperty('valor');
      expect(encontrada).not.toHaveProperty('orcamento');
    });

    it('recusa codigo repetido no mesmo ciclo', async () => {
      await criarMissao('MCG-010');

      await esperarViolacao(
        ctx.db.insert(s.missaoComite).values({
          cicloId: base.cicloId,
          codigo: 'MCG-010',
          titulo: 'Outra missao',
          objetivo: 'Objetivo de teste.',
          dataInicio: '2027-08-01',
          dataFim: '2027-08-05',
        }),
        'missao_comite_codigo_uk',
      );
    });

    it('recusa periodo invertido e participante repetido', async () => {
      await esperarViolacao(
        ctx.db.insert(s.missaoComite).values({
          cicloId: base.cicloId,
          codigo: 'MCG-020',
          titulo: 'Missao com periodo invalido',
          objetivo: 'Objetivo de teste.',
          dataInicio: '2027-09-10',
          dataFim: '2027-09-01',
        }),
        'missao_comite_periodo_ck',
      );

      const missao = await criarMissao('MCG-021');
      const participante = {
        missaoId: missao.id,
        pessoaId: base.coordenadorTematicaId,
        papel: 'PARTICIPANTE' as const,
        dataInicio: missao.dataInicio,
        dataFim: missao.dataFim,
      };
      await ctx.db.insert(s.missaoParticipante).values(participante);
      await esperarViolacao(
        ctx.db.insert(s.missaoParticipante).values(participante),
        'missao_participante_pessoa_uk',
      );
    });

    it('garante um unico responsavel e periodo valido por participante', async () => {
      const missao = await criarMissao('MCG-022');
      const pessoas = await ctx.db
        .insert(s.pessoa)
        .values([
          { nome: 'Primeira Responsavel', tipo: 'DOCENTE' },
          { nome: 'Segunda Responsavel', tipo: 'DOCENTE' },
        ])
        .returning({ id: s.pessoa.id });

      await ctx.db.insert(s.missaoParticipante).values({
        missaoId: missao.id,
        pessoaId: pessoas[0].id,
        papel: 'RESPONSAVEL',
        dataInicio: '2027-05-10',
        dataFim: '2027-05-20',
      });
      await esperarViolacao(
        ctx.db.insert(s.missaoParticipante).values({
          missaoId: missao.id,
          pessoaId: pessoas[1].id,
          papel: 'RESPONSAVEL',
          dataInicio: '2027-05-10',
          dataFim: '2027-05-20',
        }),
        'missao_participante_responsavel_uk',
      );

      await esperarViolacao(
        ctx.db.insert(s.missaoParticipante).values({
          missaoId: missao.id,
          pessoaId: pessoas[1].id,
          papel: 'PARTICIPANTE',
          dataInicio: '2027-05-20',
          dataFim: '2027-05-10',
        }),
        'missao_participante_periodo_ck',
      );
    });

    it('aceita instituicao catalogada ou nome livre, mas nao os dois', async () => {
      const [pais] = await ctx.db
        .insert(s.pais)
        .values({ codigoIso2: 'PT', codigoIso3: 'PRT', nome: 'Portugal' })
        .returning();
      const missao = await criarMissao('MCG-030');

      await ctx.db.insert(s.atividadeMissao).values({
        missaoId: missao.id,
        ordem: 1,
        tipo: 'ARTICULACAO',
        titulo: 'Reuniao institucional',
        paisId: pais.id,
        instituicaoId: base.instituicaoId,
        dataInicio: '2027-05-12',
        dataFim: '2027-05-12',
      });

      await esperarViolacao(
        ctx.db.insert(s.atividadeMissao).values({
          missaoId: missao.id,
          ordem: 2,
          tipo: 'VISITA_TECNICA',
          titulo: 'Visita ambigua',
          paisId: pais.id,
          instituicaoId: base.instituicaoId,
          instituicaoNome: 'Outra universidade',
          dataInicio: '2027-05-13',
          dataFim: '2027-05-13',
        }),
        'atividade_missao_instituicao_ck',
      );
    });

    it('nao aceita contato central sem a instituicao central correspondente', async () => {
      const [pais] = await ctx.db
        .insert(s.pais)
        .values({ codigoIso2: 'ES', codigoIso3: 'ESP', nome: 'Espanha' })
        .returning();
      const [contato] = await ctx.db
        .insert(s.contatoInstituicao)
        .values({
          instituicaoId: base.instituicaoId,
          nome: 'Contato de Teste',
          nomeNormalizado: 'contato de teste',
        })
        .returning();
      const missao = await criarMissao('MCG-031');

      await esperarViolacao(
        ctx.db.insert(s.atividadeMissao).values({
          missaoId: missao.id,
          ordem: 1,
          tipo: 'VISITA_TECNICA',
          titulo: 'Visita com contato sem instituicao',
          paisId: pais.id,
          contatoInstituicaoId: contato.id,
          dataInicio: '2027-05-13',
          dataFim: '2027-05-13',
        }),
        'atividade_missao_contato_instituicao_ck',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('cascatas e vínculos', () => {
    it('apagar o ciclo leva junto o planejamento', async () => {
      await ctx.db.insert(s.itemPlanejado).values(bolsaValida(base));

      await ctx.db.delete(s.ciclo).where(eq(s.ciclo.id, base.cicloId));

      const restantes = await ctx.db.select().from(s.itemPlanejado);
      expect(restantes).toHaveLength(0);
    });

    it('apagar item planejado leva junto a projeção anual', async () => {
      const [item] = await ctx.db
        .insert(s.itemPlanejado)
        .values(bolsaValida(base))
        .returning();

      await ctx.db.insert(s.planejamentoAnual).values(
        [2027, 2028, 2029, 2030].map((ano) => ({
          itemPlanejadoId: item.id,
          ano,
          quantidade: 1,
        })),
      );

      await ctx.db
        .delete(s.itemPlanejado)
        .where(eq(s.itemPlanejado.id, item.id));

      const restantes = await ctx.db.select().from(s.planejamentoAnual);
      expect(restantes).toHaveLength(0);
    });

    it('não apaga PPG que ainda tem planejamento vinculado', async () => {
      // O PPG é referência compartilhada entre programas; apagá-lo em cascata
      // destruiria histórico de outros ciclos.
      await ctx.db.insert(s.itemPlanejado).values(bolsaValida(base));

      await esperarViolacao(
        ctx.db.delete(s.ppg).where(eq(s.ppg.id, base.ppgId)),
        'item_planejado_ppg_id_ppg_id_fk',
      );
    });
  });

  // -------------------------------------------------------------------------
  describe('bolsa concedida', () => {
    it('recusa período invertido', async () => {
      const [pessoa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Bolsista de Teste', tipo: 'DISCENTE' })
        .returning();

      await esperarViolacao(
        ctx.db.insert(s.bolsaConcedida).values({
          programaId: base.programaId,
          cicloId: base.cicloId,
          ppgId: base.ppgId,
          pessoaId: pessoa.id,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'DOUTORADO',
          dataInicio: '2027-08-01',
          dataFim: '2027-03-01',
          vigenciaMeses: '6.0',
          valorConcedido: '82902.20',
          fluxo: 'OUT',
        }),
        'bolsa_concedida_periodo_ck',
      );
    });

    it('aceita bolsa sem planejamento (GCUB, Erasmus)', async () => {
      const [pessoa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Bolsista GCUB', tipo: 'DISCENTE' })
        .returning();

      const [bolsa] = await ctx.db
        .insert(s.bolsaConcedida)
        .values({
          programaId: base.programaId,
          cicloId: base.cicloId,
          ppgId: base.ppgId,
          pessoaId: pessoa.id,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'MOBILIDADE_BREVE',
          dataInicio: '2027-03-01',
          dataFim: '2027-04-15',
          vigenciaMeses: '1.5',
          valorConcedido: '30000.00',
          fluxo: 'OUT',
        })
        .returning();

      expect(bolsa.itemPlanejadoId).toBeNull();
    });

    it('exige data quando um produto e marcado como entregue', async () => {
      const [pessoa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Bolsista com Produto', tipo: 'DISCENTE' })
        .returning();
      const [bolsa] = await ctx.db
        .insert(s.bolsaConcedida)
        .values({
          programaId: base.programaId,
          cicloId: base.cicloId,
          ppgId: base.ppgId,
          pessoaId: pessoa.id,
          modalidadeId: base.modalidadeId,
          destino: 'EXTERIOR',
          nivelBeneficiario: 'DOUTORADO',
          dataInicio: '2027-03-01',
          dataFim: '2027-08-31',
          vigenciaMeses: '6.0',
          valorConcedido: '82902.20',
          fluxo: 'OUT',
        })
        .returning();

      await esperarViolacao(
        ctx.db.insert(s.produtoBolsa).values({
          bolsaConcedidaId: bolsa.id,
          tipo: 'ARTIGO',
          titulo: 'Artigo de teste',
          prazoEntrega: '2027-12-01',
          status: 'ENTREGUE',
        }),
        'produto_bolsa_entrega_ck',
      );
    });
  });
  describe('Prestação de contas da missão (CG-013)', () => {
    async function criarMissao(codigo = 'MCG-800') {
      const [missao] = await ctx.db
        .insert(s.missaoComite)
        .values({
          cicloId: base.cicloId,
          codigo,
          titulo: 'Missão para prestação',
          objetivo: 'Testar a prestação de contas',
          dataInicio: '2027-03-01',
          dataFim: '2027-03-10',
        })
        .returning({ id: s.missaoComite.id });
      return missao.id;
    }

    async function criarPrestacao(missaoId: string) {
      const [prestacao] = await ctx.db
        .insert(s.prestacaoContasMissao)
        .values({ missaoId })
        .returning({ id: s.prestacaoContasMissao.id });
      return prestacao.id;
    }

    it('aceita missao sem prestacao nenhuma', async () => {
      // "Nao iniciada" e a ausencia da linha, nao um estado guardado. Se fosse
      // estado, toda missao precisaria de uma prestacao vazia so para dizer que
      // ninguem comecou.
      const missaoId = await criarMissao();
      const prestacoes = await ctx.db
        .select()
        .from(s.prestacaoContasMissao)
        .where(eq(s.prestacaoContasMissao.missaoId, missaoId));
      expect(prestacoes).toEqual([]);
    });

    it('permite no maximo uma prestacao por missao', async () => {
      const missaoId = await criarMissao();
      await criarPrestacao(missaoId);
      await esperarViolacao(
        ctx.db.insert(s.prestacaoContasMissao).values({ missaoId }),
        'prestacao_missao_uk',
      );
    });

    it('nao deixa a prestacao sair de preenchimento sem data de envio', async () => {
      // Estado e evidencia andam juntos: "enviada" sem data de envio deixaria o
      // historico contando uma coisa e o estado outra.
      const missaoId = await criarMissao();
      await esperarViolacao(
        ctx.db
          .insert(s.prestacaoContasMissao)
          .values({ missaoId, status: 'ENVIADA' }),
        'prestacao_envio_ck',
      );
    });

    it('nao valida prestacao sem data de validacao', async () => {
      const missaoId = await criarMissao();
      await esperarViolacao(
        ctx.db.insert(s.prestacaoContasMissao).values({
          missaoId,
          status: 'VALIDADA',
          enviadaEm: '2027-04-01',
        }),
        'prestacao_validacao_ck',
      );
    });

    it('exige exercicio em toda despesa', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      await esperarViolacao(
        ctx.db.insert(s.despesaMissao).values({
          prestacaoId,
          tipo: 'OUTRA',
          valorTotal: '100.00',
          descricao: 'Despesa sem exercicio',
        } as never),
        'exercicio',
      );
    });

    it('recusa valor negativo', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      await esperarViolacao(
        ctx.db.insert(s.despesaMissao).values({
          prestacaoId,
          tipo: 'OUTRA',
          exercicio: 2027,
          valorTotal: '-1.00',
          descricao: 'Estorno indevido',
        }),
        'despesa_valor_total_ck',
      );
    });

    it('exige coerencia entre quantidade, unitario e total', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      await esperarViolacao(
        ctx.db.insert(s.despesaMissao).values({
          prestacaoId,
          tipo: 'DIARIA',
          exercicio: 2027,
          quantidade: '3.00',
          valorUnitario: '400.00',
          valorTotal: '1000.00',
          descricao: 'Tres diarias que nao somam',
        }),
        'despesa_produto_ck',
      );

      // Coerente passa.
      const [ok] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'DIARIA',
          exercicio: 2027,
          quantidade: '3.00',
          valorUnitario: '400.00',
          valorTotal: '1200.00',
          descricao: 'Tres diarias',
        })
        .returning({ valorTotal: s.despesaMissao.valorTotal });
      expect(ok.valorTotal).toBe('1200.00');
    });

    it('aceita despesa avulsa que informa so o total', async () => {
      // Nota fiscal com taxa nao cabe numa multiplicacao; exigir quantidade e
      // unitario obrigaria a inventar numeros para fechar a conta.
      const prestacaoId = await criarPrestacao(await criarMissao());
      const [avulsa] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'OUTRA',
          exercicio: 2027,
          valorTotal: '137.45',
          descricao: 'Taxa de inscricao com encargo',
        })
        .returning({ id: s.despesaMissao.id });
      expect(avulsa.id).toBeTruthy();
    });

    it('guarda passagem, cotacoes e diaria em tabelas proprias', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      const [passagem] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'PASSAGEM',
          exercicio: 2027,
          valorTotal: '4200.00',
          descricao: 'Manaus - Montreal',
        })
        .returning({ id: s.despesaMissao.id });
      await ctx.db.insert(s.despesaPassagem).values({
        despesaId: passagem.id,
        empresa: 'Air Canada',
        origem: 'Manaus',
        destino: 'Montreal',
        numeroVoo: 'AC1234',
        dataVoo: '2027-03-02',
        compradaEm: '2027-01-15',
        formaPagamento: 'Cartão corporativo',
      });
      await ctx.db.insert(s.cotacaoPassagem).values([
        { despesaId: passagem.id, empresa: 'Air Canada', valor: '4200.00' },
        { despesaId: passagem.id, empresa: 'LATAM', valor: '4890.00' },
      ]);

      const [diaria] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'DIARIA',
          exercicio: 2027,
          quantidade: '5.00',
          valorUnitario: '600.00',
          valorTotal: '3000.00',
          descricao: 'Diarias em Montreal',
        })
        .returning({ id: s.despesaMissao.id });
      await ctx.db.insert(s.despesaDiaria).values({
        despesaId: diaria.id,
        dataInicio: '2027-03-02',
        dataFim: '2027-03-06',
        cidade: 'Montreal',
      });

      const cotacoes = await ctx.db
        .select()
        .from(s.cotacaoPassagem)
        .where(eq(s.cotacaoPassagem.despesaId, passagem.id));
      expect(cotacoes).toHaveLength(2);

      // O total da prestacao e derivado, nunca guardado: some no proprio
      // Postgres, em numeric, sem passar por ponto flutuante.
      const [{ total }] = await ctx.db
        .select({ total: sql<string>`sum(${s.despesaMissao.valorTotal})` })
        .from(s.despesaMissao)
        .where(eq(s.despesaMissao.prestacaoId, prestacaoId));
      expect(total).toBe('7200.00');
    });

    it('recusa periodo invertido na diaria', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      const [despesa] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'DIARIA',
          exercicio: 2027,
          valorTotal: '600.00',
          descricao: 'Diaria invertida',
        })
        .returning({ id: s.despesaMissao.id });
      await esperarViolacao(
        ctx.db.insert(s.despesaDiaria).values({
          despesaId: despesa.id,
          dataInicio: '2027-03-06',
          dataFim: '2027-03-02',
        }),
        'diaria_periodo_ck',
      );
    });

    it('apagar a prestacao leva junto despesas e especializacoes', async () => {
      const prestacaoId = await criarPrestacao(await criarMissao());
      const [despesa] = await ctx.db
        .insert(s.despesaMissao)
        .values({
          prestacaoId,
          tipo: 'PASSAGEM',
          exercicio: 2027,
          valorTotal: '1000.00',
          descricao: 'Passagem',
        })
        .returning({ id: s.despesaMissao.id });
      await ctx.db
        .insert(s.despesaPassagem)
        .values({ despesaId: despesa.id, empresa: 'LATAM' });
      await ctx.db
        .insert(s.cotacaoPassagem)
        .values({ despesaId: despesa.id, empresa: 'LATAM', valor: '1000.00' });

      await ctx.db
        .delete(s.prestacaoContasMissao)
        .where(eq(s.prestacaoContasMissao.id, prestacaoId));

      expect(
        await ctx.db
          .select()
          .from(s.despesaMissao)
          .where(eq(s.despesaMissao.id, despesa.id)),
      ).toEqual([]);
      expect(
        await ctx.db
          .select()
          .from(s.cotacaoPassagem)
          .where(eq(s.cotacaoPassagem.despesaId, despesa.id)),
      ).toEqual([]);
    });

    it('nao apaga participante que ja tem despesa lancada', async () => {
      // Remover o participante apagaria dinheiro ja prestado; a remocao tem de
      // passar pela despesa primeiro.
      const missaoId = await criarMissao();
      const prestacaoId = await criarPrestacao(missaoId);
      const [pessoa] = await ctx.db
        .insert(s.pessoa)
        .values({ nome: 'Participante com despesa', tipo: 'SERVIDOR' })
        .returning({ id: s.pessoa.id });
      const [participante] = await ctx.db
        .insert(s.missaoParticipante)
        .values({
          missaoId,
          pessoaId: pessoa.id,
          papel: 'RESPONSAVEL',
          dataInicio: '2027-03-01',
          dataFim: '2027-03-10',
        })
        .returning({ id: s.missaoParticipante.id });
      await ctx.db.insert(s.despesaMissao).values({
        prestacaoId,
        tipo: 'DIARIA',
        participanteId: participante.id,
        exercicio: 2027,
        valorTotal: '600.00',
        descricao: 'Diaria do responsavel',
      });

      await esperarViolacao(
        ctx.db
          .delete(s.missaoParticipante)
          .where(eq(s.missaoParticipante.id, participante.id)),
        'despesa_missao_participante_id_missao_participante_id_fk',
      );
    });
  });
});
