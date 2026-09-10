import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq } from 'drizzle-orm';

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
  ): Promise<CicloResolvido> {
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
  async padrao(): Promise<CicloResolvido | null> {
    const [linha] = await this.db
      .selectDistinct({
        slug: s.programa.slug,
        nome: s.ciclo.nome,
        anoInicio: s.ciclo.anoInicio,
      })
      .from(s.itemPlanejado)
      .innerJoin(s.ciclo, eq(s.ciclo.id, s.itemPlanejado.cicloId))
      .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
      .where(eq(s.programa.ativo, true))
      .orderBy(asc(s.programa.slug), desc(s.ciclo.anoInicio))
      .limit(1);

    if (!linha) return null;
    return this.resolver(linha.slug, linha.nome);
  }
}

export function intervalo(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}
