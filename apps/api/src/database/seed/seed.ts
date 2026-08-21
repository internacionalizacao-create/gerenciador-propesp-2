import { sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';

import * as s from '../schema';
import {
  dadosCapesGlobal,
  fontesDocumentais,
  outrosProgramas,
} from './dados-capes-global';

/**
 * Carga inicial: reproduz no banco o estado atual das planilhas.
 *
 * Regra de ouro (system-structl.md §8.3): **semeia só dado de entrada, nunca
 * derivado.** Custo, saldo, utilização e totais têm que sair do código de
 * cálculo. Se um número calculado não bater com o da planilha, é bug de fórmula
 * ou dado sujo — e é justamente isso que a seed precisa expor, não esconder.
 */

const CICLO_ANOS = [2027, 2028, 2029, 2030] as const;

/**
 * Chave de comparação de nomes.
 *
 * A planilha escreve o mesmo PPG e a mesma pessoa com acentuação e espaçamento
 * variados entre abas. Sem normalizar, "Doutorado Sanduíche" e "Doutorado
 * sanduíche" virariam dois registros — e o custo sairia dividido em dois.
 */
function chave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ResultadoSeed {
  instituicoes: number;
  programas: number;
  modalidades: number;
  itensCatalogo: number;
  ppgs: number;
  pessoas: number;
  redes: number;
  areasTematicas: number;
  coordenadoresTematica: number;
  participacoes: number;
  orcamentos: number;
  itensPlanejados: number;
  planejamentoAnual: number;
  pendencias: number;
  premissas: number;
  fontes: number;
  orcamentoComiteGestor: number;
}

export async function executarSeed(
  db: NodePgDatabase<typeof s>,
): Promise<ResultadoSeed> {
  const d = dadosCapesGlobal;

  // --- Instituições -------------------------------------------------------
  const [uea] = await db
    .insert(s.instituicao)
    .values({
      nome: 'Universidade do Estado do Amazonas',
      sigla: 'UEA',
      tipo: 'PROPRIA',
    })
    .returning();

  const nomesRedes = [...new Set(d.tematicas.map((t) => t.rede))];
  const instituicoesRede = await db
    .insert(s.instituicao)
    .values(
      nomesRedes.map((nome) => ({
        nome,
        sigla: nome,
        tipo: 'REDE_COORDENADORA' as const,
      })),
    )
    .returning();
  const instPorNome = new Map(instituicoesRede.map((i) => [i.nome, i.id]));

  // --- Programas ----------------------------------------------------------
  const [capesGlobal] = await db
    .insert(s.programa)
    .values({
      nome: 'CAPES Global',
      sigla: 'CAPES Global',
      slug: 'capes-global',
      orgaoFinanciador: 'CAPES',
      usaRedes: true,
      usaAreasTematicas: true,
    })
    .returning();

  // Entram sem dados: existem no mundo real e o modelo precisa mostrá-los.
  await db.insert(s.programa).values(
    outrosProgramas.map((p) => ({
      ...p,
      usaRedes: false,
      usaAreasTematicas: false,
    })),
  );

  const [ciclo] = await db
    .insert(s.ciclo)
    .values({
      programaId: capesGlobal.id,
      nome: '2027-2030',
      anoInicio: 2027,
      anoFim: 2030,
      status: 'PLANEJAMENTO',
    })
    .returning();

  // --- Modalidades e catálogo ---------------------------------------------
  const nomesModalidades = [...new Set(d.catalogo.map((c) => c.modalidade))];
  const modalidades = await db
    .insert(s.modalidade)
    .values(
      nomesModalidades.map((nome) => ({
        nome,
        permiteBrasil: d.catalogo.some(
          (c) => c.modalidade === nome && c.destino === 'BRASIL',
        ),
        permiteExterior: d.catalogo.some(
          (c) => c.modalidade === nome && c.destino === 'EXTERIOR',
        ),
      })),
    )
    .returning();
  const modalidadePorNome = new Map(modalidades.map((m) => [m.nome, m.id]));

  const [tabela] = await db
    .insert(s.tabelaValores)
    .values({
      programaId: capesGlobal.id,
      versao: '2026-07-29',
      dataBase: '2026-07-29',
      cotacaoDolar: '6.5900',
      referenciaNormativa:
        'Portaria nº 1, de 3 de janeiro de 2020; Portaria nº 33, de 16 de fevereiro de 2023',
      vigenteDe: '2026-07-29',
      observacoes:
        'Valores conforme anexos de bolsas no Brasil e no exterior recebidos em 29/07/2026.',
    })
    .returning();

  const itensCatalogo = await db
    .insert(s.itemCatalogoBolsa)
    .values(
      d.catalogo.map((c) => ({
        tabelaValoresId: tabela.id,
        codigo: c.codigo,
        destino: c.destino,
        modalidadeId: exigir(
          modalidadePorNome.get(c.modalidade),
          `modalidade "${c.modalidade}" do item ${c.codigo}`,
        ),
        vigenciaMeses: c.vigenciaMeses,
        valorUsd: c.valorUsd,
        valorBrl: c.valorBrl,
        fonte: c.fonte,
        observacao: c.observacao,
      })),
    )
    .returning();

  // Índice de busca do catálogo — a mesma chave de RN-01.
  const catalogoPorChave = new Map(
    itensCatalogo.map((i) => [
      `${i.destino}|${i.modalidadeId}|${Number(i.vigenciaMeses)}`,
      i.id,
    ]),
  );

  // --- PPGs ---------------------------------------------------------------
  const ppgsUnicos = [
    ...new Map(d.ppgs.map((p) => [chave(p.nome), p])).values(),
  ];
  const ppgs = await db
    .insert(s.ppg)
    .values(
      ppgsUnicos.map((p) => ({
        nome: p.nome,
        sigla: p.sigla,
        notaCapes: p.notaCapes,
        situacao: 'ATIVO' as const,
        emRede:
          /rede|profmat|profagua|profnit|profsaude|bionorte|reamec|educanorte/i.test(
            `${p.nome} ${p.sigla}`,
          ),
        observacoes: p.observacoes,
      })),
    )
    .returning();
  const ppgPorNome = new Map(ppgs.map((p) => [chave(p.nome), p.id]));

  // --- Pessoas (Coordenadores de Tematica) --------------------------------
  const nomesMembros = [...new Set(d.tematicas.flatMap((t) => t.membros))];
  const pessoas = await db
    .insert(s.pessoa)
    .values(
      nomesMembros.map((nome) => ({
        nome,
        tipo: 'DOCENTE' as const,
        instituicaoId: uea.id,
      })),
    )
    .returning();
  const pessoaPorNome = new Map(pessoas.map((p) => [chave(p.nome), p.id]));

  // --- Redes e áreas temáticas --------------------------------------------
  const redes = await db
    .insert(s.redeCoordenadora)
    .values(
      nomesRedes.map((nome) => ({
        cicloId: ciclo.id,
        instituicaoId: exigir(
          instPorNome.get(nome),
          `instituição da rede ${nome}`,
        ),
        nome,
        // Uma rede está definida quando alguma temática sua tem orçamento.
        statusOrcamento: d.tematicas.some(
          (t) => t.rede === nome && t.statusOrcamento === 'DEFINIDO',
        )
          ? ('DEFINIDO' as const)
          : ('A_DEFINIR' as const),
      })),
    )
    .returning();
  const redePorNome = new Map(redes.map((r) => [r.nome, r.id]));

  const areas = await db
    .insert(s.areaTematica)
    .values(
      d.tematicas.map((t) => ({
        redeId: exigir(redePorNome.get(t.rede), `rede ${t.rede}`),
        codigo: t.codigo,
        nome: t.nome,
        temaNumero: Number(/T(\d+)$/.exec(t.codigo)?.[1] ?? 0) || null,
        statusOrcamento: t.statusOrcamento,
        observacoes: t.observacoes,
      })),
    )
    .returning();
  const areaPorCodigo = new Map(areas.map((a) => [a.codigo, a.id]));

  const participacoes = await db
    .insert(s.participacaoPpg)
    .values(
      d.ppgs.map((p) => ({
        areaTematicaId: exigir(
          areaPorCodigo.get(p.temaId),
          `temática ${p.temaId}`,
        ),
        ppgId: exigir(ppgPorNome.get(chave(p.nome)), `PPG ${p.nome}`),
        coordenadorTematicaId: exigir(
          pessoaPorNome.get(
            chave(exigir(p.membroComite, `coordenador de ${p.nome}`)),
          ),
          `coordenador de temática ${p.membroComite}`,
        ),
        situacao: p.situacao,
        modalidadesPrevistas: p.modalidadesPrevistas,
      })),
    )
    .returning();

  // --- Orçamento por temática e ano ---------------------------------------
  // O teto nominal se repete; a composicao de bolsas nao. A situacao anual e
  // manual, pois registra o que foi aprovado fora do Gerenciador.
  const orcamentos = await db
    .insert(s.orcamentoTematica)
    .values(
      d.tematicas.flatMap((t) =>
        CICLO_ANOS.map((ano) => ({
          areaTematicaId: exigir(
            areaPorCodigo.get(t.codigo),
            `temática ${t.codigo}`,
          ),
          ano,
          valorBolsas: t.valorBolsas,
          valorManutencao: t.valorManutencao,
          valorMissoes: t.valorMissoes,
          // Alegação da fonte, guardada para a conferência de RN-08.
          custoBolsasInformado: ano === 2027 ? t.custoBolsasInformado : null,
          saldoInformado: ano === 2027 ? t.saldoInformado : null,
          status: t.statusOrcamento,
          statusComposicao:
            ano === 2027 && (t.rede === 'UNESP' || t.rede === 'UFMG')
              ? ('APROVADA' as const)
              : ('A_DEFINIR' as const),
          fonte: `Anexo da rede ${t.rede}`,
          observacoes: t.observacoes,
        })),
      ),
    )
    .returning();

  // --- Plano de aplicação (rubrica BOLSAS) --------------------------------
  const itensPlanejados = await db
    .insert(s.itemPlanejado)
    .values(
      d.plano.map((i) => {
        const modalidadeId = i.modalidade
          ? modalidadePorNome.get(i.modalidade)
          : null;

        // Resolver o catálogo aqui é a própria RN-01 em ação: se alguma linha do
        // plano não achar preço oficial, a seed quebra em vez de gravar um custo
        // sem origem.
        const itemCatalogoId =
          i.destino && modalidadeId && i.vigenciaMeses
            ? exigir(
                catalogoPorChave.get(
                  `${i.destino}|${modalidadeId}|${Number(i.vigenciaMeses)}`,
                ),
                `item de catálogo para ${i.codigo} (${i.destino}, ${i.modalidade}, ${i.vigenciaMeses}m)`,
              )
            : null;

        return {
          codigo: i.codigo,
          cicloId: ciclo.id,
          rubrica: 'BOLSAS' as const,
          areaTematicaId: areaPorCodigo.get(i.temaId) ?? null,
          ppgId: exigir(
            ppgPorNome.get(chave(i.ppg)),
            `PPG "${i.ppg}" do ${i.codigo}`,
          ),
          quantidadeAnual: i.quantidadeAnual,
          mesImplementacao: (i.mesImplementacao ?? null) as never,
          status: i.status,
          destino: i.destino,
          modalidadeId: modalidadeId ?? null,
          vigenciaMeses: i.vigenciaMeses,
          itemCatalogoId,
          fluxo: i.fluxo,
          textoFonte: i.textoFonte,
          validacaoPendencia: i.validacao,
        };
      }),
    )
    .returning();

  const planejamentoAnual = await db
    .insert(s.planejamentoAnual)
    .values(
      itensPlanejados.flatMap((item) =>
        CICLO_ANOS.map((ano) => ({
          itemPlanejadoId: item.id,
          ano,
          // As fontes recebidas confirmam apenas a composicao de 2027. O teto
          // orcamentario se repete, mas modalidades e quantidades futuras
          // permanecem a definir e nao podem ser inventadas pela seed.
          quantidade: ano === 2027 ? item.quantidadeAnual : 0,
        })),
      ),
    )
    .returning();

  // --- Governança ---------------------------------------------------------
  const pendencias = await db
    .insert(s.pendencia)
    .values(
      d.pendencias.map((p) => ({
        codigo: p.codigo,
        cicloId: ciclo.id,
        escopoTipo: escopoDe(p.escopoRede, p.escopoTema),
        escopoDescricao:
          [p.escopoRede, p.escopoTema].filter(Boolean).join(' · ') || null,
        assunto: p.assunto ?? '(sem assunto)',
        descricao: p.descricao ?? '(sem descrição)',
        impacto: p.impacto,
        nivelImpacto: nivelDe(p.impacto),
        responsavelSugerido: p.responsavel,
        prazoMomento: p.prazo,
        status: statusPendenciaDe(p.status),
        origem: 'MANUAL' as const,
      })),
    )
    .returning();

  const premissas = await db
    .insert(s.premissa)
    .values(
      d.premissas.map((p) => ({
        cicloId: ciclo.id,
        item: p.item,
        valor: p.valor ?? '(não informado)',
        unidade: p.unidade,
        natureza: p.natureza,
        fonte: p.fonte,
        dataBase: p.dataBase,
        responsavel: p.responsavel,
        observacoes: p.observacoes,
      })),
    )
    .returning();

  const fontes = await db
    .insert(s.fonteDocumental)
    .values(fontesDocumentais.map((f) => ({ ...f, cicloId: ciclo.id })))
    .returning();

  // --- Comitê Gestor (orçamento paralelo, 2026–2029) ----------------------
  const comiteGestor = await db
    .insert(s.orcamentoComiteGestor)
    .values(
      d.comiteGestor.flatMap((c) =>
        c.anos.map((ano) => ({
          cicloId: ciclo.id,
          instituicaoId: exigir(
            instPorNome.get(c.rede),
            `instituição do comitê gestor ${c.rede}`,
          ),
          ano,
          valorAnual: c.valorAnual,
          observacoes:
            'Orçamento do Comitê Gestor — não integra o orçamento de bolsas.',
        })),
      ),
    )
    .returning();

  return {
    instituicoes: 1 + instituicoesRede.length,
    programas: 1 + outrosProgramas.length,
    modalidades: modalidades.length,
    itensCatalogo: itensCatalogo.length,
    ppgs: ppgs.length,
    pessoas: pessoas.length,
    redes: redes.length,
    areasTematicas: areas.length,
    coordenadoresTematica: new Set(
      participacoes
        .map((p) => p.coordenadorTematicaId)
        .filter((id): id is string => id !== null),
    ).size,
    participacoes: participacoes.length,
    orcamentos: orcamentos.length,
    itensPlanejados: itensPlanejados.length,
    planejamentoAnual: planejamentoAnual.length,
    pendencias: pendencias.length,
    premissas: premissas.length,
    fontes: fontes.length,
    orcamentoComiteGestor: comiteGestor.length,
  };
}

/** Falha alto e claro: um vínculo faltando na seed é dado migrado errado. */
function exigir<T>(valor: T | undefined | null, oQue: string): T {
  if (valor === undefined || valor === null) {
    throw new Error(`Seed: nao encontrei ${oQue}.`);
  }
  return valor;
}

function escopoDe(
  rede: string | null,
  tema: string | null,
): 'GERAL' | 'REDE' | 'AREA_TEMATICA' {
  if (tema && tema !== 'Todas' && /-T\d+$/.test(tema)) return 'AREA_TEMATICA';
  if (rede && rede !== 'GERAL') return 'REDE';
  return 'GERAL';
}

function nivelDe(impacto: string | null): 'ALTA' | 'MEDIA' | 'BAIXA' | null {
  if (!impacto) return null;
  const t = impacto.trim().toLowerCase();
  if (t === 'alta') return 'ALTA';
  if (t === 'média' || t === 'media') return 'MEDIA';
  if (t === 'baixa') return 'BAIXA';
  return null;
}

function statusPendenciaDe(
  bruto: string | null,
): 'PENDENTE' | 'EM_ANALISE' | 'MONITORAR' | 'RESOLVIDA' {
  const t = (bruto ?? '').trim().toLowerCase();
  if (t.startsWith('em análise') || t.startsWith('em analise'))
    return 'EM_ANALISE';
  if (t.startsWith('monitorar')) return 'MONITORAR';
  if (t.startsWith('resolvid')) return 'RESOLVIDA';
  return 'PENDENTE';
}

/** Há dado de domínio no banco? Usado para não semear por cima sem querer. */
export async function bancoTemDados(
  db: NodePgDatabase<typeof s>,
): Promise<boolean> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(s.programa);
  return total > 0;
}
