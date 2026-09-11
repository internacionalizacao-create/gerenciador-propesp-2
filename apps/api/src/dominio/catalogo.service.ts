import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { violouUnicidade } from '../comum/postgres';
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

/** Vigencia em meses com no maximo uma casa decimal — `numeric(4,1)` (RN-02). */
const VIGENCIA = /^\d{1,3}(?:\.\d)?$/;
const VALOR = /^\d{1,12}(?:\.\d{1,2})?$/;

const camposDoItem = {
  destino: z.enum(['BRASIL', 'EXTERIOR']),
  modalidadeId: z.uuid('Selecione a modalidade.'),
  vigenciaMeses: z
    .string()
    .trim()
    .regex(
      VIGENCIA,
      'Informe a vigencia em meses, com no maximo uma casa decimal.',
    )
    .refine((v) => Number(v) > 0, 'A vigencia precisa ser maior que zero.'),
  valorBrl: z
    .string()
    .trim()
    .regex(VALOR, 'Informe o valor em reais.')
    .refine((v) => Number(v) > 0, 'O valor precisa ser maior que zero.'),
  valorUsd: z
    .string()
    .trim()
    .regex(VALOR, 'Informe o valor em dolares.')
    .nullish(),
  fonte: z
    .string()
    .trim()
    .min(3, 'Informe a fonte do valor (portaria, anexo ou oficio).')
    .max(200),
  observacao: z.string().trim().max(4000).nullish(),
};

export const criarItemCatalogoSchema = z.object(camposDoItem);
export type CriarItemCatalogo = z.infer<typeof criarItemCatalogoSchema>;

export const atualizarItemCatalogoSchema = z.object({
  ...camposDoItem,
  justificativa: z
    .string()
    .trim()
    .min(10, 'Informe a justificativa da alteracao (minimo 10 caracteres).')
    .max(4000),
});
export type AtualizarItemCatalogo = z.infer<typeof atualizarItemCatalogoSchema>;

const camposDaModalidade = {
  nome: z.string().trim().min(3, 'Informe o nome da modalidade.').max(120),
  publicoAlvo: z.enum(['DOCENTE', 'DISCENTE', 'POS_DOC', 'AMBOS']),
  ativa: z.coerce.boolean().default(true),
};

export const criarModalidadeSchema = z.object(camposDaModalidade);
export type CriarModalidade = z.infer<typeof criarModalidadeSchema>;

export const atualizarModalidadeSchema = z.object(camposDaModalidade);
export type AtualizarModalidade = z.infer<typeof atualizarModalidadeSchema>;

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

/**
 * Item da listagem, com quantas linhas de plano ja calculam custo por ele.
 *
 * A contagem sobe ate a tela porque e ela que decide o que oferecer: item em
 * uso tem chave e valor trancados (ver `atualizarItem`), e descobrir isso so
 * depois de preencher o formulario seria trabalho jogado fora.
 */
export interface ItemCatalogoListado extends ItemCatalogo {
  usos: number;
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
  itens: ItemCatalogoListado[];
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
        `O programa "${programaSlug}" ainda não tem tabela de valores publicada.`,
      );
    }

    return { ...tabela, itens: await this.itens(tabela.id) };
  }

  async itens(tabelaValoresId: string): Promise<ItemCatalogoListado[]> {
    return this.db
      .select({
        usos: sql<number>`(
          select count(*)::int from item_planejado p
           where p.item_catalogo_id = ${s.itemCatalogoBolsa.id})`,
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
          'Não existe item no catálogo vigente para esta combinação de ' +
          'destino, modalidade e vigência. O valor não pode ser estimado: ' +
          'peça à administração que publique o item na tabela de valores.',
        codigo: 'CATALOGO_SEM_CORRESPONDENCIA',
        destino,
        modalidadeId,
        vigenciaMeses,
      });
    }

    return item;
  }

  /**
   * Acrescenta um item a tabela vigente (P15).
   *
   * **Acrescentar e seguro; alterar nao e.** Se a combinacao
   * (destino, modalidade, vigencia) ainda nao existia, nenhuma linha de plano
   * podia estar usando-a, entao um item novo nao muda custo nenhum ja
   * calculado. E por isso que a criacao e livre enquanto `atualizarItem`
   * tranca o valor de um item em uso.
   *
   * Sem este endpoint a equipe ficava presa: uma modalidade ou vigencia fora
   * das que a planilha trouxe fazia `resolverItem` recusar a linha do plano
   * (RN-01) e nao havia como publicar o item que faltava sem uma migracao.
   */
  async criarItem(
    programaSlug: string,
    dto: CriarItemCatalogo,
    usuario: AuthUser,
  ): Promise<ItemCatalogo> {
    const tabela = await this.tabelaVigente(programaSlug);
    await this.exigirModalidade(dto.modalidadeId);

    const codigo = await this.proximoCodigoItem(tabela.id);

    let criadoId: string;
    try {
      const [criado] = await this.db
        .insert(s.itemCatalogoBolsa)
        .values({
          tabelaValoresId: tabela.id,
          codigo,
          destino: dto.destino,
          modalidadeId: dto.modalidadeId,
          vigenciaMeses: dto.vigenciaMeses,
          valorBrl: dto.valorBrl,
          valorUsd: dto.valorUsd ?? null,
          fonte: dto.fonte,
          observacao: dto.observacao ?? null,
        })
        .returning({ id: s.itemCatalogoBolsa.id });
      criadoId = criado.id;
    } catch (erro) {
      // `item_catalogo_busca_uk`. Duas linhas para a mesma busca fariam o mesmo
      // planejamento render custos diferentes conforme a ordem de leitura.
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          'A tabela vigente já tem um item para esta combinação de destino, ' +
            'modalidade e vigência. Edite o item existente.',
        );
      }
      throw erro;
    }

    // O `permite_brasil`/`permite_exterior` da modalidade e derivado do
    // catalogo (a seed os calcula exatamente assim). Mante-los vivos evita que
    // a modalidade continue dizendo nao cobrir um destino que ela acabou de
    // passar a cobrir.
    await this.db
      .update(s.modalidade)
      .set(
        dto.destino === 'BRASIL'
          ? { permiteBrasil: true, atualizadoEm: new Date() }
          : { permiteExterior: true, atualizadoEm: new Date() },
      )
      .where(eq(s.modalidade.id, dto.modalidadeId));

    await this.registrar(
      'ITEM_CATALOGO_BOLSA',
      criadoId,
      'CRIACAO',
      [{ campo: null, valorAnterior: null, valorNovo: codigo }],
      usuario,
      `Item publicado na tabela ${tabela.versao}.`,
    );

    return this.exigirItem(criadoId);
  }

  /**
   * Edita um item da tabela vigente.
   *
   * **Item ja usado por uma linha de plano tem a chave e o valor trancados.** E
   * a mesma razao pela qual a tabela e versionada: reescrever o preco mudaria,
   * em silencio, o custo de um planejamento ja aprovado — e o numero errado
   * so apareceria na prestacao de contas. Fonte, observacao e o valor em
   * dolar continuam editaveis porque nenhum calculo os le; corrigir a citacao
   * da portaria nao pode exigir publicar tabela nova.
   */
  async atualizarItem(
    id: string,
    dto: AtualizarItemCatalogo,
    usuario: AuthUser,
  ): Promise<ItemCatalogo> {
    const anterior = await this.exigirItem(id);
    await this.exigirModalidade(dto.modalidadeId);

    const mudouCalculo =
      anterior.destino !== dto.destino ||
      anterior.modalidadeId !== dto.modalidadeId ||
      Number(anterior.vigenciaMeses) !== Number(dto.vigenciaMeses) ||
      Number(anterior.valorBrl) !== Number(dto.valorBrl);

    if (mudouCalculo) {
      const usos = await this.usosDoItem(id);
      if (usos > 0) {
        throw new ConflictException(
          `${anterior.codigo} já é usado por ${usos} linha(s) do plano. ` +
            'Alterar destino, modalidade, vigência ou valor mudaria o custo ' +
            'de um planejamento já calculado. Publique um item novo com os ' +
            'valores corretos, ou corrija as linhas antes.',
        );
      }
    }

    const novos = {
      destino: dto.destino,
      modalidadeId: dto.modalidadeId,
      vigenciaMeses: dto.vigenciaMeses,
      valorBrl: dto.valorBrl,
      valorUsd: dto.valorUsd ?? null,
      fonte: dto.fonte,
      observacao: dto.observacao ?? null,
    };

    const alterados = Object.entries(novos)
      .filter(([campo, valor]) => {
        const antes = anterior[campo as keyof typeof novos] ?? null;
        // Numero comparado como numero: "6" e "6.0" sao a mesma vigencia, e
        // gravar auditoria dessa "mudanca" encheria a trilha de nada.
        if (campo === 'vigenciaMeses' || campo === 'valorBrl') {
          return Number(antes) !== Number(valor);
        }
        return (antes ?? null) !== (valor ?? null);
      })
      .map(([campo, valor]) => ({
        campo,
        valorAnterior: anterior[campo as keyof typeof novos] ?? null,
        valorNovo: valor ?? null,
      }));

    if (alterados.length === 0) {
      throw new BadRequestException('Nenhum campo do item foi alterado.');
    }

    try {
      await this.db
        .update(s.itemCatalogoBolsa)
        .set({ ...novos, atualizadoEm: new Date() })
        .where(eq(s.itemCatalogoBolsa.id, id));
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          'A tabela vigente já tem um item para esta combinação de destino, ' +
            'modalidade e vigência.',
        );
      }
      throw erro;
    }

    if (anterior.modalidadeId !== dto.modalidadeId || mudouCalculo) {
      await this.db
        .update(s.modalidade)
        .set(
          dto.destino === 'BRASIL'
            ? { permiteBrasil: true, atualizadoEm: new Date() }
            : { permiteExterior: true, atualizadoEm: new Date() },
        )
        .where(eq(s.modalidade.id, dto.modalidadeId));
    }

    await this.registrar(
      'ITEM_CATALOGO_BOLSA',
      id,
      'EDICAO',
      alterados,
      usuario,
      dto.justificativa,
    );

    return this.exigirItem(id);
  }

  /**
   * Remove um item que nunca foi usado.
   *
   * Existe para o erro de digitacao recem-cometido, e so para ele: item citado
   * por linha de plano nao sai, porque apagar a base de calculo deixaria a
   * linha sem como explicar o proprio custo.
   */
  async removerItem(id: string, usuario: AuthUser): Promise<void> {
    const item = await this.exigirItem(id);
    const usos = await this.usosDoItem(id);

    if (usos > 0) {
      throw new ConflictException(
        `${item.codigo} já é usado por ${usos} linha(s) do plano e não pode ` +
          'ser excluido. Corrija as linhas antes.',
      );
    }

    await this.registrar(
      'ITEM_CATALOGO_BOLSA',
      id,
      'EXCLUSAO',
      [{ campo: null, valorAnterior: item.codigo, valorNovo: null }],
      usuario,
      `Item ${item.codigo} removido antes de qualquer uso.`,
    );

    await this.db
      .delete(s.itemCatalogoBolsa)
      .where(eq(s.itemCatalogoBolsa.id, id));
  }

  /**
   * Cadastra uma modalidade (P23).
   *
   * `permiteBrasil`/`permiteExterior` nao entram no corpo: sao derivados do
   * catalogo e passam a valer quando o primeiro item daquele destino e
   * publicado. Deixar a gestao marcar a mao um destino que a tabela nao cobre
   * ofereceria, na P10, uma combinacao que `resolverItem` recusaria depois.
   */
  async criarModalidade(dto: CriarModalidade, usuario: AuthUser) {
    try {
      const [criada] = await this.db
        .insert(s.modalidade)
        .values({
          nome: dto.nome,
          publicoAlvo: dto.publicoAlvo,
          ativa: dto.ativa,
        })
        .returning({ id: s.modalidade.id, nome: s.modalidade.nome });

      await this.registrar(
        'MODALIDADE',
        criada.id,
        'CRIACAO',
        [{ campo: null, valorAnterior: null, valorNovo: criada.nome }],
        usuario,
        null,
      );

      return criada;
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          `Já existe uma modalidade chamada "${dto.nome}".`,
        );
      }
      throw erro;
    }
  }

  /**
   * Edita uma modalidade. Nao ha exclusao: `ativa = false` a tira de
   * circulacao sem quebrar o item de catalogo e a bolsa que a citam.
   */
  async atualizarModalidade(
    id: string,
    dto: AtualizarModalidade,
    usuario: AuthUser,
  ) {
    const [anterior] = await this.db
      .select({
        id: s.modalidade.id,
        nome: s.modalidade.nome,
        publicoAlvo: s.modalidade.publicoAlvo,
        ativa: s.modalidade.ativa,
      })
      .from(s.modalidade)
      .where(eq(s.modalidade.id, id))
      .limit(1);

    if (!anterior) throw new NotFoundException('Modalidade não encontrada.');

    const novos = {
      nome: dto.nome,
      publicoAlvo: dto.publicoAlvo,
      ativa: dto.ativa,
    };
    const alterados = Object.entries(novos)
      .filter(
        ([campo, valor]) => anterior[campo as keyof typeof novos] !== valor,
      )
      .map(([campo, valor]) => ({
        campo,
        valorAnterior: String(anterior[campo as keyof typeof novos]),
        valorNovo: String(valor),
      }));

    if (alterados.length === 0) {
      throw new BadRequestException('Nenhum campo da modalidade foi alterado.');
    }

    try {
      await this.db
        .update(s.modalidade)
        .set({ ...novos, atualizadoEm: new Date() })
        .where(eq(s.modalidade.id, id));
    } catch (erro) {
      if (violouUnicidade(erro)) {
        throw new ConflictException(
          `Já existe uma modalidade chamada "${dto.nome}".`,
        );
      }
      throw erro;
    }

    await this.registrar('MODALIDADE', id, 'EDICAO', alterados, usuario, null);

    return { id, ...novos };
  }

  private async exigirItem(id: string): Promise<ItemCatalogo> {
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
      .where(eq(s.itemCatalogoBolsa.id, id))
      .limit(1);

    if (!item) throw new NotFoundException('Item do catálogo não encontrado.');
    return item;
  }

  private async exigirModalidade(id: string): Promise<void> {
    const [modalidade] = await this.db
      .select({ id: s.modalidade.id, ativa: s.modalidade.ativa })
      .from(s.modalidade)
      .where(eq(s.modalidade.id, id))
      .limit(1);

    if (!modalidade) throw new NotFoundException('Modalidade não encontrada.');
    if (!modalidade.ativa) {
      throw new UnprocessableEntityException(
        'Modalidade inativa não recebe item de catálogo. Reative-a antes.',
      );
    }
  }

  /** Quantas linhas do plano calculam o proprio custo por este item. */
  private async usosDoItem(id: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(s.itemPlanejado)
      .where(eq(s.itemPlanejado.itemCatalogoId, id));

    return total;
  }

  private async proximoCodigoItem(tabelaValoresId: string): Promise<string> {
    const [{ proximo }] = await this.db
      .select({
        proximo: sql<number>`coalesce(max(substring(${s.itemCatalogoBolsa.codigo} from '[0-9]+$')::int), 0) + 1`,
      })
      .from(s.itemCatalogoBolsa)
      .where(eq(s.itemCatalogoBolsa.tabelaValoresId, tabelaValoresId));

    return `CAT-${String(proximo).padStart(3, '0')}`;
  }

  private async registrar(
    entidadeTipo: string,
    entidadeId: string,
    acao: 'CRIACAO' | 'EDICAO' | 'EXCLUSAO',
    alteracoes: {
      campo: string | null;
      valorAnterior: string | null;
      valorNovo: string | null;
    }[],
    usuario: AuthUser,
    justificativa: string | null,
  ): Promise<void> {
    await this.db.insert(s.registroAuditoria).values(
      alteracoes.map((alteracao) => ({
        entidadeTipo,
        entidadeId,
        acao,
        ...alteracao,
        usuarioId: usuario.id,
        usuarioNome: usuario.name ?? null,
        justificativa,
      })),
    );
  }
}
