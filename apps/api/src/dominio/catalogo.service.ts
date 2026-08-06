import {
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * O catalogo oficial de bolsas (P15) e a resolucao de preco de RN-01.
 *
 * **E a fonte de verdade de todo custo de bolsa do sistema.** Nenhum outro lugar
 * pode produzir o valor unitario de uma bolsa: quando a combinacao
 * (destino, modalidade, vigencia) nao existe na tabela vigente, o certo e
 * recusar e registrar pendencia — nunca interpolar, nunca aceitar valor
 * digitado. Interpolar produziria um numero plausivel e errado, que e
 * exatamente o tipo de numero que chega a uma prestacao de contas.
 */

export interface ItemCatalogo {
  id: string;
  codigo: string;
  destino: 'BRASIL' | 'EXTERIOR';
  modalidadeId: string;
  modalidade: string;
  vigenciaMeses: string;
  valorUsd: string | null;
  valorBrl: string;
  fonte: string | null;
  observacao: string | null;
}

export interface TabelaVigente {
  id: string;
  versao: string;
  dataBase: string;
  cotacaoDolar: string;
  referenciaNormativa: string | null;
  vigenteDe: string;
  vigenteAte: string | null;
  observacoes: string | null;
  itens: ItemCatalogo[];
}

@Injectable()
export class CatalogoService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Versao vigente da tabela de valores de um programa.
   *
   * "Vigente" e a que ainda nao terminou. Reajuste nao sobrescreve: cria versao
   * nova e fecha a anterior, para que uma bolsa ja planejada continue valendo o
   * preco da tabela em que foi calculada.
   */
  async tabelaVigente(programaSlug: string): Promise<TabelaVigente> {
    const [tabela] = await this.db
      .select({
        id: s.tabelaValores.id,
        versao: s.tabelaValores.versao,
        dataBase: s.tabelaValores.dataBase,
        cotacaoDolar: s.tabelaValores.cotacaoDolar,
        referenciaNormativa: s.tabelaValores.referenciaNormativa,
        vigenteDe: s.tabelaValores.vigenteDe,
        vigenteAte: s.tabelaValores.vigenteAte,
        observacoes: s.tabelaValores.observacoes,
      })
      .from(s.tabelaValores)
      .innerJoin(s.programa, eq(s.programa.id, s.tabelaValores.programaId))
      .where(
        and(
          eq(s.programa.slug, programaSlug),
          or(
            isNull(s.tabelaValores.vigenteAte),
            sql`${s.tabelaValores.vigenteAte} >= current_date`,
          ),
        ),
      )
      .orderBy(sql`${s.tabelaValores.vigenteDe} desc`)
      .limit(1);

    if (!tabela) {
      throw new NotFoundException(
        `O programa "${programaSlug}" ainda nao tem tabela de valores publicada.`,
      );
    }

    return { ...tabela, itens: await this.itens(tabela.id) };
  }

  async itens(tabelaValoresId: string): Promise<ItemCatalogo[]> {
    return this.db
      .select({
        id: s.itemCatalogoBolsa.id,
        codigo: s.itemCatalogoBolsa.codigo,
        destino: s.itemCatalogoBolsa.destino,
        modalidadeId: s.itemCatalogoBolsa.modalidadeId,
        modalidade: s.modalidade.nome,
        vigenciaMeses: s.itemCatalogoBolsa.vigenciaMeses,
        valorUsd: s.itemCatalogoBolsa.valorUsd,
        valorBrl: s.itemCatalogoBolsa.valorBrl,
        fonte: s.itemCatalogoBolsa.fonte,
        observacao: s.itemCatalogoBolsa.observacao,
      })
      .from(s.itemCatalogoBolsa)
      .innerJoin(
        s.modalidade,
        eq(s.modalidade.id, s.itemCatalogoBolsa.modalidadeId),
      )
      .where(eq(s.itemCatalogoBolsa.tabelaValoresId, tabelaValoresId))
      .orderBy(asc(s.itemCatalogoBolsa.codigo));
  }

  async modalidades() {
    return this.db
      .select({
        id: s.modalidade.id,
        nome: s.modalidade.nome,
        publicoAlvo: s.modalidade.publicoAlvo,
        permiteBrasil: s.modalidade.permiteBrasil,
        permiteExterior: s.modalidade.permiteExterior,
        ativa: s.modalidade.ativa,
        itens: sql<number>`(
          select count(*)::int from item_catalogo_bolsa i
           where i.modalidade_id = ${s.modalidade.id})`,
      })
      .from(s.modalidade)
      .orderBy(asc(s.modalidade.nome));
  }

  /**
   * RN-01 · resolve o preco de uma bolsa. Sem correspondencia exata, recusa.
   *
   * O 422 nao e aspereza: aceitar a linha com preco nulo faria o custo do
   * planejamento inteiro ficar silenciosamente menor do que e.
   */
  async resolverItem(
    tabelaValoresId: string,
    destino: 'BRASIL' | 'EXTERIOR',
    modalidadeId: string,
    vigenciaMeses: string,
  ): Promise<ItemCatalogo> {
    const [item] = await this.db
      .select({
        id: s.itemCatalogoBolsa.id,
        codigo: s.itemCatalogoBolsa.codigo,
        destino: s.itemCatalogoBolsa.destino,
        modalidadeId: s.itemCatalogoBolsa.modalidadeId,
        modalidade: s.modalidade.nome,
        vigenciaMeses: s.itemCatalogoBolsa.vigenciaMeses,
        valorUsd: s.itemCatalogoBolsa.valorUsd,
        valorBrl: s.itemCatalogoBolsa.valorBrl,
        fonte: s.itemCatalogoBolsa.fonte,
        observacao: s.itemCatalogoBolsa.observacao,
      })
      .from(s.itemCatalogoBolsa)
      .innerJoin(
        s.modalidade,
        eq(s.modalidade.id, s.itemCatalogoBolsa.modalidadeId),
      )
      .where(
        and(
          eq(s.itemCatalogoBolsa.tabelaValoresId, tabelaValoresId),
          eq(s.itemCatalogoBolsa.destino, destino),
          eq(s.itemCatalogoBolsa.modalidadeId, modalidadeId),
          // Comparacao numerica, nao textual: "6" e "6.0" sao a mesma vigencia.
          sql`${s.itemCatalogoBolsa.vigenciaMeses} = ${vigenciaMeses}::numeric`,
        ),
      )
      .limit(1);

    if (!item) {
      throw new UnprocessableEntityException({
        message:
          'Nao existe item no catalogo vigente para esta combinacao de ' +
          'destino, modalidade e vigencia. O valor nao pode ser estimado: ' +
          'registre uma pendencia para que a PROPESP publique o item (RN-01).',
        codigo: 'CATALOGO_SEM_CORRESPONDENCIA',
        destino,
        modalidadeId,
        vigenciaMeses,
      });
    }

    return item;
  }
}
