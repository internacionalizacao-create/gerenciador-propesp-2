import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';

import {
  ALCANCE_GLOBAL,
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';

import { consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import type { CicloResolvido } from './contexto.service';
import {
  OrcamentoService,
  somarMoeda,
  type LinhaTematica,
} from './orcamento.service';
import { PlanoService } from './plano.service';

/**
 * Leituras de um ciclo: indice (P06), redes (P07), tematica (P08), comite
 * gestor (P17) e premissas (P16).
 *
 * Sao consultas de apresentacao — quem calcula continua sendo o
 * `OrcamentoService`. Este servico so escolhe o recorte de cada tela.
 */
@Injectable()
export class CicloService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly orcamento: OrcamentoService,
    private readonly plano: PlanoService,
  ) {}

  /** P06 · pagina-indice, com um numero vivo em cada atalho. */
  async resumo(ciclo: CicloResolvido, alcance: Alcance = ALCANCE_GLOBAL) {
    const [tematicas, contagens] = await Promise.all([
      this.orcamento.porTematica(ciclo.cicloId, ciclo.anoInicio, alcance),
      this.contagens(ciclo.cicloId, alcance),
    ]);

    return {
      ciclo,
      aporteAnual: somarMoeda(tematicas.map((t) => t.totalPrevisto)),
      custoBolsasAnual: somarMoeda(tematicas.map((t) => t.custoBolsas)),
      saldoPotencialAnual: somarMoeda(tematicas.map((t) => t.saldoPotencial)),
      ...contagens,
      divergencias: tematicas.filter(
        (t) => t.divergencia !== null && Number(t.divergencia) !== 0,
      ).length,
      tematicasSemOrcamento: tematicas.filter(
        (t) => t.statusOrcamento === 'A_DEFINIR',
      ).length,
    };
  }

  /** P07 · redes com suas tematicas embaixo. */
  async redes(
    ciclo: CicloResolvido,
    ano: number,
    alcance: Alcance = ALCANCE_GLOBAL,
  ) {
    const [redes, tematicas] = await Promise.all([
      this.orcamento.porRede(ciclo.cicloId, ano, alcance),
      this.orcamento.porTematica(ciclo.cicloId, ano, alcance),
    ]);

    const [coordenadores, participacoes] = await Promise.all([
      this.coordenadoresPorTematica(ciclo.cicloId, alcance),
      this.ppgsPorTematica(ciclo.cicloId, alcance),
    ]);

    return {
      ano,
      redes: redes.map((rede) => ({
        ...rede,
        areas: tematicas
          .filter((t) => t.redeId === rede.redeId)
          .map((t) => ({
            ...t,
            coordenadores: coordenadores.get(t.areaTematicaId) ?? [],
            ppgsContemplados: (participacoes.get(t.areaTematicaId) ?? [])
              .filter((participacao) => participacao.situacao === 'CONTEMPLADO')
              .map(({ ppgId, ppgSigla, ppgNome }) => ({
                ppgId,
                ppgSigla,
                ppgNome,
              })),
          })),
      })),
    };
  }

  /** P08 · tudo sobre uma tematica em uma pagina. */
  async tematica(
    ciclo: CicloResolvido,
    codigo: string,
    alcance: Alcance = ALCANCE_GLOBAL,
  ) {
    const anos = await this.orcamento.porTematica(
      ciclo.cicloId,
      undefined,
      alcance,
    );
    const doCodigo = anos.filter((t) => t.codigo === codigo);

    if (doCodigo.length === 0) {
      throw new NotFoundException(`Área temática "${codigo}" não encontrada.`);
    }

    const base = doCodigo.find((t) => t.ano === ciclo.anoInicio) ?? doCodigo[0];
    const coordenadores = await this.coordenadoresPorTematica(
      ciclo.cicloId,
      alcance,
    );
    const participacaoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.redeCoordenadora.cicloId}`,
      ppg: sql`${s.participacaoPpg.ppgId}`,
      rede: sql`${s.redeCoordenadora.id}`,
      tematica: sql`${s.areaTematica.id}`,
      participacao: sql`${s.participacaoPpg.id}`,
    });

    const [participacoes, plano] = await Promise.all([
      this.db
        .select({
          ppgId: s.ppg.id,
          ppg: s.ppg.nome,
          sigla: s.ppg.sigla,
          notaCapes: s.ppg.notaCapes,
          emRede: s.ppg.emRede,
          situacao: s.participacaoPpg.situacao,
          modalidadesPrevistas: s.participacaoPpg.modalidadesPrevistas,
          coordenadorTematica: s.pessoa.nome,
          coordenadorTematicaEmail: s.pessoa.email,
        })
        .from(s.participacaoPpg)
        .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
        .leftJoin(
          s.pessoa,
          eq(s.pessoa.id, s.participacaoPpg.coordenadorTematicaId),
        )
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
        )
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .where(
          sql`${s.participacaoPpg.areaTematicaId} = ${base.areaTematicaId}::uuid
            and ${participacaoVisivel}`,
        )
        .orderBy(asc(s.ppg.sigla)),

      this.plano.listar(
        ciclo.cicloId,
        {
          areaTematicaId: base.areaTematicaId,
        },
        alcance,
      ),
    ]);

    const custoTotal = somarMoeda(plano.map((l) => l.custoAnual));

    return {
      ...base,
      coordenadores: coordenadores.get(base.areaTematicaId) ?? [],
      porAno: doCodigo,
      participacoes: participacoes.map((p) => ({
        ...p,
        // Participacao no custo: quanto das bolsas da tematica vai para este PPG.
        custoAnual: somarMoeda(
          plano.filter((l) => l.ppgId === p.ppgId).map((l) => l.custoAnual),
        ),
      })),
      custoTotal,
      plano,
    };
  }

  /**
   * P17 · orcamento do Comite Gestor.
   *
   * RN-14 · e paralelo e **nunca** se soma ao orcamento de bolsas. Somar os dois
   * daria R$ 1.631.688,59 e inflaria em 30% o recurso de bolsas — e por isso o
   * aviso vai junto da resposta, nao so na tela.
   */
  async comiteGestor(ciclo: CicloResolvido) {
    const linhas = await this.db
      .select({
        ano: s.orcamentoComiteGestor.ano,
        instituicaoId: s.orcamentoComiteGestor.instituicaoId,
        rede: s.instituicao.sigla,
        redeNome: s.instituicao.nome,
        valorAnual: s.orcamentoComiteGestor.valorAnual,
      })
      .from(s.orcamentoComiteGestor)
      .innerJoin(
        s.instituicao,
        eq(s.instituicao.id, s.orcamentoComiteGestor.instituicaoId),
      )
      .where(eq(s.orcamentoComiteGestor.cicloId, ciclo.cicloId))
      .orderBy(asc(s.orcamentoComiteGestor.ano), asc(s.instituicao.sigla));

    const anos = [...new Set(linhas.map((l) => l.ano))].sort();
    const porRede = [...new Set(linhas.map((l) => l.rede))].map((rede) => ({
      rede,
      total: somarMoeda(
        linhas.filter((l) => l.rede === rede).map((l) => l.valorAnual),
      ),
      porAno: anos.map((ano) => ({
        ano,
        valor:
          linhas.find((l) => l.rede === rede && l.ano === ano)?.valorAnual ??
          null,
      })),
    }));

    const primeiroAno = anos[0];

    return {
      anos,
      porRede,
      totalAnual: somarMoeda(
        linhas.filter((l) => l.ano === primeiroAno).map((l) => l.valorAnual),
      ),
      totalCiclo: somarMoeda(linhas.map((l) => l.valorAnual)),
      aviso:
        'Este orçamento não integra o orçamento de bolsas do CAPES Global. ' +
        'Somar os dois superestima o recurso disponível para bolsas.',
    };
  }

  /** P16 · premissas do modelo e fontes documentais. */
  async premissas(ciclo: CicloResolvido) {
    const [premissas, fontes] = await Promise.all([
      this.db
        .select()
        .from(s.premissa)
        .where(eq(s.premissa.cicloId, ciclo.cicloId))
        .orderBy(asc(s.premissa.item)),
      this.db
        .select()
        .from(s.fonteDocumental)
        .where(eq(s.fonteDocumental.cicloId, ciclo.cicloId))
        .orderBy(asc(s.fonteDocumental.nome)),
    ]);

    return { premissas, fontes };
  }

  // ------------------------------------------------------------------ //

  private async coordenadoresPorTematica(
    cicloId: string,
    alcance: Alcance = ALCANCE_GLOBAL,
  ) {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.redeCoordenadora.cicloId}`,
      ppg: sql`${s.participacaoPpg.ppgId}`,
      rede: sql`${s.redeCoordenadora.id}`,
      tematica: sql`${s.areaTematica.id}`,
      participacao: sql`${s.participacaoPpg.id}`,
    });
    const linhas = await this.db
      .select({
        areaTematicaId: s.participacaoPpg.areaTematicaId,
        ppgId: s.participacaoPpg.ppgId,
        ppgSigla: s.ppg.sigla,
        nome: s.pessoa.nome,
        email: s.pessoa.email,
      })
      .from(s.participacaoPpg)
      .innerJoin(
        s.pessoa,
        eq(s.pessoa.id, s.participacaoPpg.coordenadorTematicaId),
      )
      .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
      .innerJoin(
        s.areaTematica,
        eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
      )
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.areaTematica.redeId),
      )
      .where(
        sql`${s.redeCoordenadora.cicloId} = ${cicloId}::uuid and ${visivel}`,
      )
      .orderBy(asc(s.pessoa.nome), asc(s.ppg.sigla));

    const mapa = new Map<string, typeof linhas>();
    for (const linha of linhas) {
      const atual = mapa.get(linha.areaTematicaId) ?? [];
      atual.push(linha);
      mapa.set(linha.areaTematicaId, atual);
    }
    return mapa;
  }

  private async ppgsPorTematica(
    cicloId: string,
    alcance: Alcance = ALCANCE_GLOBAL,
  ) {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.redeCoordenadora.cicloId}`,
      ppg: sql`${s.participacaoPpg.ppgId}`,
      rede: sql`${s.redeCoordenadora.id}`,
      tematica: sql`${s.areaTematica.id}`,
      participacao: sql`${s.participacaoPpg.id}`,
    });
    const linhas = await this.db
      .select({
        areaTematicaId: s.participacaoPpg.areaTematicaId,
        ppgId: s.participacaoPpg.ppgId,
        ppgSigla: s.ppg.sigla,
        ppgNome: s.ppg.nome,
        situacao: s.participacaoPpg.situacao,
      })
      .from(s.participacaoPpg)
      .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
      .innerJoin(
        s.areaTematica,
        eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
      )
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.areaTematica.redeId),
      )
      .where(
        sql`${s.redeCoordenadora.cicloId} = ${cicloId}::uuid and ${visivel}`,
      )
      .orderBy(asc(s.ppg.nome));

    const mapa = new Map<string, typeof linhas>();
    for (const linha of linhas) {
      const atual = mapa.get(linha.areaTematicaId) ?? [];
      atual.push(linha);
      mapa.set(linha.areaTematicaId, atual);
    }
    return mapa;
  }

  private async contagens(cicloId: string, alcance: Alcance = ALCANCE_GLOBAL) {
    const planoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`ip.ciclo_id`,
      ppg: sql`ip.ppg_id`,
      rede: sql`at.rede_id`,
      tematica: sql`ip.area_tematica_id`,
      participacao: sql`pp.id`,
    });
    const participacaoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      ppg: sql`pp.ppg_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
      participacao: sql`pp.id`,
    });
    return consultarUma<{
      redes: number;
      tematicas: number;
      ppgs: number;
      linhasPlano: number;
      pendenciasAbertas: number;
      premissas: number;
      coordenadores: number;
    }>(
      this.db,
      sql`
      select
        (select count(distinct rc.id)::int from participacao_ppg pp
           join area_tematica at on at.id = pp.area_tematica_id
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId} and ${participacaoVisivel}) as "redes",
        (select count(distinct at.id)::int from area_tematica at
           join rede_coordenadora rc on rc.id = at.rede_id
          join participacao_ppg pp on pp.area_tematica_id = at.id
          where rc.ciclo_id = ${cicloId} and ${participacaoVisivel}) as "tematicas",
        (select count(distinct pp.ppg_id)::int from participacao_ppg pp
           join area_tematica at on at.id = pp.area_tematica_id
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId} and ${participacaoVisivel}) as "ppgs",
        (select count(distinct ip.id)::int from item_planejado ip
          left join area_tematica at on at.id = ip.area_tematica_id
          left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
            and pp.ppg_id = ip.ppg_id
          where ip.ciclo_id = ${cicloId} and ip.status <> 'CANCELADO'
            and ${planoVisivel}) as "linhasPlano",
        (select count(*)::int from pendencia
          where ciclo_id = ${cicloId} and status <> 'RESOLVIDA') as "pendenciasAbertas",
        (select count(*)::int from premissa where ciclo_id = ${cicloId}) as "premissas",
        (select count(distinct pp.coordenador_tematica_id)::int
           from participacao_ppg pp
           join area_tematica at on at.id = pp.area_tematica_id
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId}
            and pp.coordenador_tematica_id is not null
            and ${participacaoVisivel}) as "coordenadores"
    `,
    );
  }
}

export type LinhaTematicaComCoordenadores = LinhaTematica & {
  coordenadores: {
    ppgId: string;
    ppgSigla: string;
    nome: string;
    email: string | null;
  }[];
};
