import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

import {
  ALCANCE_GLOBAL,
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

export interface CicloResolvido {
  programaId: string;
  programaNome: string;
  programaSlug: string;
  usaRedes: boolean;
  usaAreasTematicas: boolean;
  cicloId: string;
  cicloNome: string;
  anoInicio: number;
  anoFim: number;
  status: 'PLANEJAMENTO' | 'VIGENTE' | 'ENCERRADO';
  /** Todos os exercicios do ciclo, em ordem. */
  anos: number[];
}

/**
 * Resolve "de qual programa e de qual ciclo estamos falando".
 *
 * Toda tela de planejamento existe dentro de um ciclo, e a URL carrega o slug do
 * programa e o nome do ciclo (`/programas/capes-global/2027-2030/...`) em vez de
 * UUIDs — o endereco fica legivel e a equipe consegue conferir num relatorio se
 * esta olhando o ciclo certo.
 */
@Injectable()
export class ContextoService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async resolver(
    programaSlug: string,
    cicloNome: string,
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<CicloResolvido> {
    const cicloVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.ciclo.id}`,
    });
    const participacaoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.ciclo.id}`,
      ppg: sql`pp_escopo.ppg_id`,
      rede: sql`rc_escopo.id`,
      tematica: sql`at_escopo.id`,
      participacao: sql`pp_escopo.id`,
    });
    const [linha] = await this.db
      .select({
        programaId: s.programa.id,
        programaNome: s.programa.nome,
        programaSlug: s.programa.slug,
        usaRedes: s.programa.usaRedes,
        usaAreasTematicas: s.programa.usaAreasTematicas,
        cicloId: s.ciclo.id,
        cicloNome: s.ciclo.nome,
        anoInicio: s.ciclo.anoInicio,
        anoFim: s.ciclo.anoFim,
        status: s.ciclo.status,
      })
      .from(s.ciclo)
      .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
      .where(
        and(
          eq(s.programa.slug, programaSlug),
          eq(s.programa.ativo, true),
          eq(s.ciclo.nome, cicloNome),
          sql`((${cicloVisivel}) or exists (
            select 1 from rede_coordenadora rc_escopo
            join area_tematica at_escopo on at_escopo.rede_id = rc_escopo.id
            join participacao_ppg pp_escopo on pp_escopo.area_tematica_id = at_escopo.id
            where rc_escopo.ciclo_id = ${s.ciclo.id}
              and ${participacaoVisivel}
          ))`,
        ),
      )
      .limit(1);

    if (!linha) {
      throw new NotFoundException(
        `Ciclo "${cicloNome}" do programa "${programaSlug}" não encontrado.`,
      );
    }

    return { ...linha, anos: intervalo(linha.anoInicio, linha.anoFim) };
  }

  /**
   * Ciclo aberto por quem entra em `/` sem escolher nada.
   *
   * Escolhe o programa que de fato tem plano cadastrado — abrir o painel num
   * programa vazio (GCUB, Erasmus) daria a impressao de que o sistema perdeu os
   * dados. Empate se resolve pelo ciclo mais recente.
   */
  async padrao(
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<CicloResolvido | null> {
    const itemVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`${s.itemPlanejado.cicloId}`,
      ppg: sql`${s.itemPlanejado.ppgId}`,
      rede: sql`${s.areaTematica.redeId}`,
      tematica: sql`${s.itemPlanejado.areaTematicaId}`,
      participacao: sql`${s.participacaoPpg.id}`,
    });
    const [linha] = await this.db
      .selectDistinct({
        slug: s.programa.slug,
        nome: s.ciclo.nome,
        anoInicio: s.ciclo.anoInicio,
      })
      .from(s.itemPlanejado)
      .innerJoin(s.ciclo, eq(s.ciclo.id, s.itemPlanejado.cicloId))
      .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
      .leftJoin(
        s.areaTematica,
        eq(s.areaTematica.id, s.itemPlanejado.areaTematicaId),
      )
      .leftJoin(
        s.participacaoPpg,
        and(
          eq(s.participacaoPpg.areaTematicaId, s.itemPlanejado.areaTematicaId),
          eq(s.participacaoPpg.ppgId, s.itemPlanejado.ppgId),
        ),
      )
      .where(and(eq(s.programa.ativo, true), itemVisivel))
      .orderBy(asc(s.programa.slug), desc(s.ciclo.anoInicio))
      .limit(1);

    if (!linha) return null;
    return this.resolver(linha.slug, linha.nome, alcance);
  }
}

export function intervalo(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}
