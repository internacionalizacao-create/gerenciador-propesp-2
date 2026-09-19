import {
  colunasDoAlvo,
  type ColunasDoAlvo,
} from '../src/auth/autorizacao-v1/persistencia';
import { AcessoResolvido } from '../src/auth/autorizacao-v1/acesso-v1.service';
import { ALCANCE_GLOBAL } from '../src/auth/autorizacao-v1/alcance';
import type { PermissaoV1 } from '../src/auth/autorizacao-v1/catalogo';
import * as s from '../src/database/schema';
import { normalizarNomeInstituicao } from '../src/database/normalizacao';
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
      nomeNormalizado: normalizarNomeInstituicao('Universidade de Teste'),
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

/**
 * Conta local com concessoes, do jeito que o sistema passou a funcionar.
 *
 * Desde V1-012 a autorizacao sai de `concessao_acesso`: um `AuthUser` montado
 * no teste diz **o que** a pessoa pode fazer, e so estas linhas dizem **onde**.
 * Sem elas, servico recortado nega tudo — que e o comportamento certo e o
 * motivo de tantas fixtures precisarem deste helper.
 *
 * `permissoes` aceita a lista do `AuthUser` para as duas metades nao
 * divergirem: conceder aqui o que o token nao carrega seria testar um estado
 * que a aplicacao nunca produz.
 */
export async function criarAcesso(
  db: TestDatabase,
  entrada: {
    sub: string;
    nome?: string;
    permissoes: readonly string[];
    alvo?: ColunasDoAlvo;
  },
): Promise<{ usuarioId: string; pessoaId: string }> {
  const alvo = entrada.alvo ?? colunasDoAlvo({ tipo: 'GLOBAL' });

  const [pessoa] = await db
    .insert(s.pessoa)
    .values({ nome: entrada.nome ?? `Conta ${entrada.sub}`, tipo: 'SERVIDOR' })
    .returning({ id: s.pessoa.id });

  const [conta] = await db
    .insert(s.usuarioSistema)
    .values({ sub: entrada.sub, pessoaId: pessoa.id, origem: 'MANUAL' })
    .returning({ id: s.usuarioSistema.id });

  if (entrada.permissoes.length > 0) {
    await db.insert(s.concessaoAcesso).values(
      entrada.permissoes.map((permissao) => ({
        usuarioId: conta.id,
        permissao,
        justificativa: 'Fixture de teste.',
        ...alvo,
      })),
    );
  }

  return { usuarioId: conta.id, pessoaId: pessoa.id };
}

/**
 * Acesso global montado em memoria, para as suites que testam **calculo** e
 * nao autorizacao.
 *
 * Elas ja declaravam isso ao usar um `AuthUser` de admin; o alcance por acao
 * so tornou a declaracao explicita. As suites de recorte nao usam este helper:
 * la o acesso vem de `concessao_acesso` pelo resolver de verdade, porque o que
 * esta sob teste e justamente a leitura daquela tabela.
 */
export function acessoGlobalDeTeste(
  permissoes: readonly PermissaoV1[],
): AcessoResolvido {
  return new AcessoResolvido(
    'usuario-de-teste',
    'pessoa-de-teste',
    new Map(permissoes.map((permissao) => [permissao, ALCANCE_GLOBAL])),
  );
}
