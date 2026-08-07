import * as s from '../src/database/schema';
import type { TestDatabase } from './db-teste';

/**
 * Estrutura mínima para os testes: um programa com ciclo, rede, temática, PPG e
 * uma tabela de valores com um item de catálogo.
 *
 * Deliberadamente pequena. Os dados reais das planilhas vivem na seed; aqui só
 * precisa existir o suficiente para exercitar constraint.
 */
export interface BaseFixture {
  programaId: string;
  cicloId: string;
  redeId: string;
  areaTematicaId: string;
  ppgId: string;
  coordenadorTematicaId: string;
  modalidadeId: string;
  tabelaValoresId: string;
  itemCatalogoId: string;
  instituicaoId: string;
}

export async function criarBase(db: TestDatabase): Promise<BaseFixture> {
  const [instituicao] = await db
    .insert(s.instituicao)
    .values({
      nome: 'Universidade de Teste',
      sigla: 'UTESTE',
      tipo: 'REDE_COORDENADORA',
    })
    .returning();

  const [programa] = await db
    .insert(s.programa)
    .values({
      nome: 'Programa de Teste',
      slug: 'programa-teste',
      usaRedes: true,
      usaAreasTematicas: true,
    })
    .returning();

  const [ciclo] = await db
    .insert(s.ciclo)
    .values({
      programaId: programa.id,
      nome: '2027-2030',
      anoInicio: 2027,
      anoFim: 2030,
    })
    .returning();

  const [rede] = await db
    .insert(s.redeCoordenadora)
    .values({
      cicloId: ciclo.id,
      instituicaoId: instituicao.id,
      nome: 'REDE-TESTE',
      statusOrcamento: 'DEFINIDO',
    })
    .returning();

  const [area] = await db
    .insert(s.areaTematica)
    .values({
      redeId: rede.id,
      codigo: 'TESTE-T1',
      nome: 'Área Temática de Teste',
      statusOrcamento: 'DEFINIDO',
    })
    .returning();

  const [ppg] = await db
    .insert(s.ppg)
    .values({ nome: 'PPG de Teste', sigla: 'PPGT', notaCapes: 5 })
    .returning();

  const [coordenadorTematica] = await db
    .insert(s.pessoa)
    .values({
      nome: 'Coordenadora de Temática de Teste',
      tipo: 'DOCENTE',
    })
    .returning();

  const [modalidade] = await db
    .insert(s.modalidade)
    .values({ nome: 'Doutorado Sanduíche', permiteExterior: true })
    .returning();

  const [tabela] = await db
    .insert(s.tabelaValores)
    .values({
      programaId: programa.id,
      versao: '2026-07-29',
      dataBase: '2026-07-29',
      cotacaoDolar: '6.5900',
      vigenteDe: '2026-07-29',
    })
    .returning();

  const [item] = await db
    .insert(s.itemCatalogoBolsa)
    .values({
      tabelaValoresId: tabela.id,
      codigo: 'CAT-053',
      destino: 'EXTERIOR',
      modalidadeId: modalidade.id,
      vigenciaMeses: '6.0',
      valorUsd: '12580.00',
      valorBrl: '82902.20',
    })
    .returning();

  return {
    instituicaoId: instituicao.id,
    programaId: programa.id,
    cicloId: ciclo.id,
    redeId: rede.id,
    areaTematicaId: area.id,
    ppgId: ppg.id,
    coordenadorTematicaId: coordenadorTematica.id,
    modalidadeId: modalidade.id,
    tabelaValoresId: tabela.id,
    itemCatalogoId: item.id,
  };
}

/** Item de planejamento de bolsa válido, pronto para inserir. */
export function bolsaValida(base: BaseFixture, codigo = 'BOL-001') {
  return {
    codigo,
    cicloId: base.cicloId,
    rubrica: 'BOLSAS' as const,
    areaTematicaId: base.areaTematicaId,
    ppgId: base.ppgId,
    quantidadeAnual: 1,
    mesImplementacao: 'MARCO' as const,
    status: 'PROGRAMADO' as const,
    destino: 'EXTERIOR' as const,
    modalidadeId: base.modalidadeId,
    vigenciaMeses: '6.0',
    itemCatalogoId: base.itemCatalogoId,
    fluxo: 'OUT' as const,
  };
}
