import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { consultar, consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { CatalogoService } from './catalogo.service';
import type { CicloResolvido } from './contexto.service';

/**
 * Plano de aplicacao (P10) — a tela mais importante do sistema.
 *
 * As tres rubricas vivem na mesma tabela com um discriminador (Q3), e diferem no
 * unico ponto que importa: de onde sai o valor unitario.
 *
 *   BOLSAS      -> obrigatoriamente do catalogo (RN-01). Digitar valor e proibido.
 *   MANUTENCAO  -> valor estimado, com justificativa obrigatoria.
 *   MISSOES     -> idem.
 *
 * A assimetria e real e a interface tem que mostra-la. Misturar valor oficial
 * com estimativa sem aviso e como um numero sem lastro entra num relatorio de
 * prestacao de contas.
 */

export type Rubrica = 'BOLSAS' | 'MANUTENCAO' | 'MISSOES';

export interface LinhaPlano {
  id: string;
  codigo: string;
  rubrica: Rubrica;
  status: 'PROGRAMADO' | 'PENDENTE' | 'CANCELADO';
  areaTematicaId: string | null;
  tematica: string | null;
  tematicaNome: string | null;
  redeId: string | null;
  rede: string | null;
  ppgId: string;
  ppg: string;
  ppgSigla: string;
  coordenadorTematica: string | null;
  descricao: string | null;
  destino: 'BRASIL' | 'EXTERIOR' | null;
  modalidadeId: string | null;
  modalidade: string | null;
  vigenciaMeses: string | null;
  anoPlanejamento: number | null;
  quantidadeAnual: number;
  mesImplementacao: string | null;
  fluxo: 'IN' | 'OUT' | null;
  /** Codigo do item do catalogo (`CAT-053`) quando o valor e oficial. */
  itemCatalogoCodigo: string | null;
  valorUnitario: string | null;
  /** `CATALOGO` = valor oficial; `ESTIMADO` = digitado com justificativa. */
  origemValor: 'CATALOGO' | 'ESTIMADO' | 'INDEFINIDO';
  justificativaEstimativa: string | null;
  tipoDespesa: string | null;
  tipoMissao: string | null;
  numeroParticipantes: number | null;
  numeroDiarias: number | null;
  incluiPassagem: boolean | null;
  custoAnual: string | null;
  custoCiclo: string | null;
  quantidadeCiclo: number;
  textoFonte: string | null;
  validacaoPendencia: string | null;
  porAno: { ano: number; quantidade: number }[];
}

const mesEnum = z.enum([
  'JANEIRO',
  'FEVEREIRO',
  'MARCO',
  'ABRIL',
  'MAIO',
  'JUNHO',
  'JULHO',
  'AGOSTO',
  'SETEMBRO',
  'OUTUBRO',
  'NOVEMBRO',
  'DEZEMBRO',
]);

const comum = {
  ppgId: z.uuid('Selecione o PPG.'),
  areaTematicaId: z.uuid().nullish(),
  ano: z.coerce.number().int().min(2000).max(2200),
  descricao: z.string().trim().max(2000).nullish(),
  quantidadeAnual: z.coerce.number().int().min(0).max(999),
  mesImplementacao: mesEnum.nullish(),
  observacoes: z.string().trim().max(2000).nullish(),
  textoFonte: z.string().trim().max(4000).nullish(),
};

/**
 * O discriminador vira `z.discriminatedUnion` de proposito: e o schema que
 * impede, no limite da API, que uma bolsa chegue com valor digitado — a mesma
 * regra que o CHECK `item_planejado_valor_por_rubrica_ck` guarda no banco.
 * Duas barreiras porque a consequencia de furar essa e um custo inventado.
 */
export const criarItemSchema = z.discriminatedUnion('rubrica', [
  z.object({
    ...comum,
    rubrica: z.literal('BOLSAS'),
    destino: z.enum(['BRASIL', 'EXTERIOR']),
    modalidadeId: z.uuid('Selecione a modalidade.'),
    vigenciaMeses: z.coerce.number().positive().max(999),
    /** Sugerido por RN-10, sobrescrivivel para os casos de borda. */
    fluxo: z.enum(['IN', 'OUT']).nullish(),
  }),
  z.object({
    ...comum,
    rubrica: z.literal('MANUTENCAO'),
    tipoDespesa: z.enum([
      'MATERIAL_CONSUMO',
      'SERVICO',
      'EQUIPAMENTO',
      'PUBLICACAO',
      'OUTRO',
    ]),
    valorUnitarioInformado: z.coerce.number().nonnegative(),
    justificativaEstimativa: z
      .string()
      .trim()
      .min(10, 'Explique de onde veio a estimativa (minimo 10 caracteres).'),
  }),
  z.object({
    ...comum,
    rubrica: z.literal('MISSOES'),
    tipoMissao: z.enum([
      'VISITA_TECNICA',
      'EVENTO',
      'ARTICULACAO',
      'BANCA',
      'OUTRO',
    ]),
    numeroParticipantes: z.coerce.number().int().positive().nullish(),
    numeroDiarias: z.coerce.number().int().positive().nullish(),
    incluiPassagem: z.coerce.boolean().nullish(),
    valorUnitarioInformado: z.coerce.number().nonnegative(),
    justificativaEstimativa: z
      .string()
      .trim()
      .min(10, 'Explique de onde veio a estimativa (minimo 10 caracteres).'),
  }),
]);

export type CriarItem = z.infer<typeof criarItemSchema>;

export const atualizarItemSchema = criarItemSchema.and(
  z.object({
    justificativaEdicao: z.string().trim().max(2000).nullish(),
    status: z.enum(['PROGRAMADO', 'PENDENTE']),
  }),
);

export type AtualizarItem = z.infer<typeof atualizarItemSchema>;

export interface RegistroAuditoriaPlano {
  id: string;
  campo: string | null;
  valorAnterior: string | null;
  valorNovo: string | null;
  usuarioNome: string | null;
  justificativa: string | null;
  ocorridoEm: Date;
}

@Injectable()
export class PlanoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly catalogo: CatalogoService,
  ) {}

  /**
   * As linhas do plano, com o valor unitario ja resolvido e o custo calculado.
   *
   * `custoAnual` e `custoCiclo` sao derivados (RN-04) e nao existem em coluna
   * nenhuma — vem daqui ou nao vem.
   */
  async listar(
    cicloId: string,
    filtro: {
      rubrica?: Rubrica;
      ppgId?: string;
      areaTematicaId?: string;
      ano?: number;
    } = {},
  ): Promise<LinhaPlano[]> {
    return consultar<LinhaPlano>(
      this.db,
      sql`
      with anos as (
        select item_planejado_id as item_id,
               sum(quantidade)::int as quantidade_ciclo,
               min(ano) filter (where quantidade > 0) as ano_planejamento,
               jsonb_agg(jsonb_build_object('ano', ano, 'quantidade', quantidade)
                         order by ano) as por_ano
          from planejamento_anual
         group by item_planejado_id
      )
      select ip.id                              as "id",
             ip.codigo                          as "codigo",
             ip.rubrica                         as "rubrica",
             ip.status                          as "status",
             ip.area_tematica_id                as "areaTematicaId",
             at.codigo                          as "tematica",
             at.nome                            as "tematicaNome",
             rc.id                              as "redeId",
             rc.nome                            as "rede",
             ip.ppg_id                          as "ppgId",
             p.nome                             as "ppg",
             p.sigla                            as "ppgSigla",
             coord.nome                         as "coordenadorTematica",
             ip.descricao                       as "descricao",
             ip.destino                         as "destino",
             ip.modalidade_id                   as "modalidadeId",
             m.nome                             as "modalidade",
             ip.vigencia_meses                  as "vigenciaMeses",
             a.ano_planejamento                 as "anoPlanejamento",
             ip.quantidade_anual                as "quantidadeAnual",
             ip.mes_implementacao               as "mesImplementacao",
             ip.fluxo                           as "fluxo",
             ic.codigo                          as "itemCatalogoCodigo",
             coalesce(ic.valor_brl, ip.valor_unitario_informado)
                                                as "valorUnitario",
             case when ic.id is not null           then 'CATALOGO'
                  when ip.valor_unitario_informado is not null then 'ESTIMADO'
                  else 'INDEFINIDO'
             end                                as "origemValor",
             ip.justificativa_estimativa        as "justificativaEstimativa",
             ip.tipo_despesa                    as "tipoDespesa",
             ip.tipo_missao                     as "tipoMissao",
             ip.numero_participantes            as "numeroParticipantes",
             ip.numero_diarias                  as "numeroDiarias",
             ip.inclui_passagem                 as "incluiPassagem",
             case when coalesce(ic.valor_brl, ip.valor_unitario_informado) is null
                  then null
                  else ip.quantidade_anual
                     * coalesce(ic.valor_brl, ip.valor_unitario_informado)
             end                                as "custoAnual",
             case when coalesce(ic.valor_brl, ip.valor_unitario_informado) is null
                  then null
                  else coalesce(a.quantidade_ciclo, 0)
                     * coalesce(ic.valor_brl, ip.valor_unitario_informado)
             end                                as "custoCiclo",
             coalesce(a.quantidade_ciclo, 0)    as "quantidadeCiclo",
             ip.texto_fonte                     as "textoFonte",
             ip.validacao_pendencia             as "validacaoPendencia",
             coalesce(a.por_ano, '[]'::jsonb)   as "porAno"
        from item_planejado ip
        join ppg p  on p.id = ip.ppg_id
        left join area_tematica       at on at.id = ip.area_tematica_id
        left join rede_coordenadora   rc on rc.id = at.rede_id
        left join modalidade          m  on m.id  = ip.modalidade_id
        left join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
        left join participacao_ppg    pp on pp.area_tematica_id = ip.area_tematica_id
                                        and pp.ppg_id = ip.ppg_id
        left join pessoa           coord on coord.id = pp.coordenador_tematica_id
        left join anos                a  on a.item_id = ip.id
       where ip.ciclo_id = ${cicloId}
         ${filtro.rubrica ? sql`and ip.rubrica = ${filtro.rubrica}` : sql``}
         ${filtro.ppgId ? sql`and ip.ppg_id = ${filtro.ppgId}` : sql``}
         ${
           filtro.ano === undefined
             ? sql``
             : sql`and exists (
                 select 1 from planejamento_anual pa_filtro
                  where pa_filtro.item_planejado_id = ip.id
                    and pa_filtro.ano = ${filtro.ano}
                    and pa_filtro.quantidade > 0
               )`
         }
         ${
           filtro.areaTematicaId
             ? sql`and ip.area_tematica_id = ${filtro.areaTematicaId}`
             : sql``
         }
       order by ip.rubrica, ip.codigo
    `,
    );
  }

  /**
   * Cria uma linha de planejamento.
   *
   * Em BOLSAS o preco e resolvido antes de gravar: sem item de catalogo, a
   * criacao falha com 422 em vez de gravar uma linha sem custo. E a mesma regra
   * que a seed aplica ao migrar (RN-01).
   */
  async criar(ciclo: CicloResolvido, dto: CriarItem): Promise<LinhaPlano> {
    const anoPlanejamento = dto.ano ?? ciclo.anoInicio;
    this.exigirAnoDoCiclo(ciclo, anoPlanejamento);
    await this.exigirPpg(dto.ppgId);
    await this.exigirParticipacao(dto.ppgId, dto.areaTematicaId ?? null);

    const codigo = await this.proximoCodigo(ciclo.cicloId, dto.rubrica);

    const base = {
      codigo,
      cicloId: ciclo.cicloId,
      rubrica: dto.rubrica,
      areaTematicaId: dto.areaTematicaId ?? null,
      ppgId: dto.ppgId,
      descricao: dto.descricao ?? null,
      quantidadeAnual: dto.quantidadeAnual,
      mesImplementacao: dto.mesImplementacao ?? null,
      observacoes: dto.observacoes ?? null,
      textoFonte: dto.textoFonte ?? null,
      status: 'PROGRAMADO' as const,
    };

    let valores: typeof s.itemPlanejado.$inferInsert;

    if (dto.rubrica === 'BOLSAS') {
      const tabela = await this.catalogo.tabelaVigente(ciclo.programaSlug);
      const item = await this.catalogo.resolverItem(
        tabela.id,
        dto.destino,
        dto.modalidadeId,
        String(dto.vigenciaMeses),
      );

      valores = {
        ...base,
        destino: dto.destino,
        modalidadeId: dto.modalidadeId,
        vigenciaMeses: item.vigenciaMeses,
        itemCatalogoId: item.id,
        // RN-10 · Brasil = alguem entra na UEA; Exterior = alguem sai.
        fluxo: dto.fluxo ?? (dto.destino === 'BRASIL' ? 'IN' : 'OUT'),
      };
    } else if (dto.rubrica === 'MANUTENCAO') {
      valores = {
        ...base,
        tipoDespesa: dto.tipoDespesa,
        valorUnitarioInformado: dto.valorUnitarioInformado.toFixed(2),
        justificativaEstimativa: dto.justificativaEstimativa,
      };
    } else {
      valores = {
        ...base,
        tipoMissao: dto.tipoMissao,
        numeroParticipantes: dto.numeroParticipantes ?? null,
        numeroDiarias: dto.numeroDiarias ?? null,
        incluiPassagem: dto.incluiPassagem ?? null,
        valorUnitarioInformado: dto.valorUnitarioInformado.toFixed(2),
        justificativaEstimativa: dto.justificativaEstimativa,
      };
    }

    const [criado] = await this.db
      .insert(s.itemPlanejado)
      .values(valores)
      .returning({ id: s.itemPlanejado.id });

    // A modalidade pertence a um exercicio. O teto anual pode se repetir, mas
    // copiar automaticamente a composicao inventaria decisoes para anos futuros.
    await this.db.insert(s.planejamentoAnual).values(
      ciclo.anos.map((ano) => ({
        itemPlanejadoId: criado.id,
        ano,
        quantidade: ano === anoPlanejamento ? dto.quantidadeAnual : 0,
      })),
    );

    // Reler pela mesma consulta da listagem garante que o cliente receba a linha
    // com custo e origem do valor ja resolvidos, do jeito que a tabela mostra.
    const linha = (await this.listar(ciclo.cicloId, {})).find(
      (l) => l.id === criado.id,
    );
    if (!linha) {
      throw new NotFoundException('Linha criada, mas nao pode ser relida.');
    }
    return linha;
  }

  /**
   * Edita sem permitir troca de codigo ou rubrica e grava uma linha de
   * auditoria para cada campo alterado. Em ciclo vigente, a justificativa e
   * parte obrigatoria do fato auditavel; ciclo encerrado e imutavel.
   */
  async atualizar(
    ciclo: CicloResolvido,
    id: string,
    dto: AtualizarItem,
    usuario: AuthUser,
  ): Promise<LinhaPlano> {
    const anoPlanejamento = dto.ano ?? ciclo.anoInicio;
    this.exigirAnoDoCiclo(ciclo, anoPlanejamento);
    if (ciclo.status === 'ENCERRADO') {
      throw new BadRequestException('Ciclo encerrado nao pode ser editado.');
    }
    if (
      ciclo.status === 'VIGENTE' &&
      (dto.justificativaEdicao?.trim().length ?? 0) < 10
    ) {
      throw new BadRequestException(
        'Em ciclo vigente, informe uma justificativa com pelo menos 10 caracteres.',
      );
    }

    const [anterior] = await this.db
      .select()
      .from(s.itemPlanejado)
      .where(
        and(
          eq(s.itemPlanejado.id, id),
          eq(s.itemPlanejado.cicloId, ciclo.cicloId),
        ),
      )
      .limit(1);

    if (!anterior) {
      throw new NotFoundException('Linha de planejamento nao encontrada.');
    }
    if (anterior.rubrica !== dto.rubrica) {
      throw new BadRequestException(
        'A rubrica de uma linha nao pode ser alterada.',
      );
    }

    await this.exigirPpg(dto.ppgId);
    await this.exigirParticipacao(dto.ppgId, dto.areaTematicaId ?? null);

    const base = {
      areaTematicaId: dto.areaTematicaId ?? null,
      ppgId: dto.ppgId,
      descricao: dto.descricao ?? null,
      quantidadeAnual: dto.quantidadeAnual,
      mesImplementacao: dto.mesImplementacao ?? null,
      observacoes: dto.observacoes ?? null,
      textoFonte: dto.textoFonte ?? null,
      status: dto.status,
      atualizadoEm: new Date(),
    };

    let novos: Partial<typeof s.itemPlanejado.$inferInsert>;
    if (dto.rubrica === 'BOLSAS') {
      const tabela = await this.catalogo.tabelaVigente(ciclo.programaSlug);
      const item = await this.catalogo.resolverItem(
        tabela.id,
        dto.destino,
        dto.modalidadeId,
        String(dto.vigenciaMeses),
      );
      novos = {
        ...base,
        destino: dto.destino,
        modalidadeId: dto.modalidadeId,
        vigenciaMeses: item.vigenciaMeses,
        itemCatalogoId: item.id,
        fluxo: dto.fluxo ?? (dto.destino === 'BRASIL' ? 'IN' : 'OUT'),
      };
    } else if (dto.rubrica === 'MANUTENCAO') {
      novos = {
        ...base,
        tipoDespesa: dto.tipoDespesa,
        valorUnitarioInformado: dto.valorUnitarioInformado.toFixed(2),
        justificativaEstimativa: dto.justificativaEstimativa,
      };
    } else {
      novos = {
        ...base,
        tipoMissao: dto.tipoMissao,
        numeroParticipantes: dto.numeroParticipantes ?? null,
        numeroDiarias: dto.numeroDiarias ?? null,
        incluiPassagem: dto.incluiPassagem ?? null,
        valorUnitarioInformado: dto.valorUnitarioInformado.toFixed(2),
        justificativaEstimativa: dto.justificativaEstimativa,
      };
    }

    const alteracoes = camposAlterados(anterior, novos);
    const planejamentoAnterior = await this.db
      .select({
        ano: s.planejamentoAnual.ano,
        quantidade: s.planejamentoAnual.quantidade,
      })
      .from(s.planejamentoAnual)
      .where(eq(s.planejamentoAnual.itemPlanejadoId, id));
    const anoAnterior =
      planejamentoAnterior.find((item) => item.quantidade > 0)?.ano ?? null;
    if (anoAnterior !== anoPlanejamento) {
      alteracoes.push({
        campo: 'anoPlanejamento',
        anterior: serializar(anoAnterior),
        novo: serializar(anoPlanejamento),
      });
    }
    if (alteracoes.length === 0)
      return (await this.listar(ciclo.cicloId)).find((l) => l.id === id)!;

    await this.db.transaction(async (tx) => {
      await tx
        .update(s.itemPlanejado)
        .set(novos)
        .where(eq(s.itemPlanejado.id, id));

      await tx
        .update(s.planejamentoAnual)
        .set({ quantidade: 0, atualizadoEm: new Date() })
        .where(eq(s.planejamentoAnual.itemPlanejadoId, id));
      await tx
        .update(s.planejamentoAnual)
        .set({ quantidade: dto.quantidadeAnual, atualizadoEm: new Date() })
        .where(
          and(
            eq(s.planejamentoAnual.itemPlanejadoId, id),
            eq(s.planejamentoAnual.ano, anoPlanejamento),
          ),
        );

      await tx.insert(s.registroAuditoria).values(
        alteracoes.map((alteracao) => ({
          entidadeTipo: 'ITEM_PLANEJADO',
          entidadeId: id,
          acao: 'EDICAO' as const,
          campo: alteracao.campo,
          valorAnterior: alteracao.anterior,
          valorNovo: alteracao.novo,
          usuarioId: usuario.id,
          usuarioNome: usuario.name ?? usuario.username ?? usuario.email,
          justificativa: dto.justificativaEdicao ?? null,
        })),
      );
    });

    return (await this.listar(ciclo.cicloId)).find((l) => l.id === id)!;
  }

  async historico(
    cicloId: string,
    id: string,
  ): Promise<RegistroAuditoriaPlano[]> {
    const [item] = await this.db
      .select({ id: s.itemPlanejado.id })
      .from(s.itemPlanejado)
      .where(
        and(eq(s.itemPlanejado.id, id), eq(s.itemPlanejado.cicloId, cicloId)),
      )
      .limit(1);
    if (!item)
      throw new NotFoundException('Linha de planejamento nao encontrada.');

    return this.db
      .select({
        id: s.registroAuditoria.id,
        campo: s.registroAuditoria.campo,
        valorAnterior: s.registroAuditoria.valorAnterior,
        valorNovo: s.registroAuditoria.valorNovo,
        usuarioNome: s.registroAuditoria.usuarioNome,
        justificativa: s.registroAuditoria.justificativa,
        ocorridoEm: s.registroAuditoria.ocorridoEm,
      })
      .from(s.registroAuditoria)
      .where(
        and(
          eq(s.registroAuditoria.entidadeTipo, 'ITEM_PLANEJADO'),
          eq(s.registroAuditoria.entidadeId, id),
        ),
      )
      .orderBy(sql`${s.registroAuditoria.ocorridoEm} desc`);
  }

  /**
   * Cancela uma linha. Em ciclo nao encerrado nunca se exclui: o historico do
   * que foi planejado e parte do que o sistema existe para preservar.
   */
  async cancelar(
    cicloId: string,
    id: string,
    justificativa: string,
  ): Promise<void> {
    const [item] = await this.db
      .select({
        id: s.itemPlanejado.id,
        observacoes: s.itemPlanejado.observacoes,
      })
      .from(s.itemPlanejado)
      .where(
        and(eq(s.itemPlanejado.id, id), eq(s.itemPlanejado.cicloId, cicloId)),
      )
      .limit(1);

    if (!item)
      throw new NotFoundException('Linha de planejamento nao encontrada.');
    if (justificativa.trim().length < 10) {
      throw new BadRequestException(
        'Cancelar exige justificativa (minimo 10 caracteres).',
      );
    }

    await this.db
      .update(s.itemPlanejado)
      .set({
        status: 'CANCELADO',
        observacoes: [item.observacoes, `Cancelado: ${justificativa}`]
          .filter(Boolean)
          .join('\n'),
        atualizadoEm: new Date(),
      })
      .where(eq(s.itemPlanejado.id, id));
  }

  private async exigirPpg(ppgId: string): Promise<void> {
    const [existe] = await this.db
      .select({ id: s.ppg.id })
      .from(s.ppg)
      .where(eq(s.ppg.id, ppgId))
      .limit(1);

    if (!existe) throw new NotFoundException('PPG nao encontrado.');
  }

  private exigirAnoDoCiclo(ciclo: CicloResolvido, ano: number): void {
    if (!ciclo.anos.includes(ano)) {
      throw new BadRequestException(
        `O exercício ${ano} não pertence ao ciclo ${ciclo.cicloNome}.`,
      );
    }
  }

  private async exigirParticipacao(
    ppgId: string,
    areaTematicaId: string | null,
  ): Promise<void> {
    if (!areaTematicaId) return;
    const [participacao] = await this.db
      .select({ id: s.participacaoPpg.id })
      .from(s.participacaoPpg)
      .where(
        and(
          eq(s.participacaoPpg.ppgId, ppgId),
          eq(s.participacaoPpg.areaTematicaId, areaTematicaId),
        ),
      )
      .limit(1);
    if (!participacao) {
      throw new BadRequestException(
        'O PPG selecionado nao participa desta area tematica.',
      );
    }
  }

  /** `BOL-024`, `MAN-001`, `MIS-001` — sequencia por rubrica, sem lacuna. */
  private async proximoCodigo(
    cicloId: string,
    rubrica: Rubrica,
  ): Promise<string> {
    const prefixo = { BOLSAS: 'BOL', MANUTENCAO: 'MAN', MISSOES: 'MIS' }[
      rubrica
    ];

    const { proximo } = await consultarUma<{ proximo: number }>(
      this.db,
      sql`
      select coalesce(max(substring(codigo from '[0-9]+$')::int), 0) + 1 as proximo
        from item_planejado
       where ciclo_id = ${cicloId}
         and codigo like ${`${prefixo}-%`}
    `,
    );

    return `${prefixo}-${String(proximo).padStart(3, '0')}`;
  }
}

function camposAlterados(
  anterior: typeof s.itemPlanejado.$inferSelect,
  novos: Partial<typeof s.itemPlanejado.$inferInsert>,
) {
  const ignorados = new Set(['atualizadoEm']);
  return Object.entries(novos)
    .filter(([campo, valor]) => {
      if (ignorados.has(campo)) return false;
      return (
        serializar(anterior[campo as keyof typeof anterior]) !==
        serializar(valor)
      );
    })
    .map(([campo, valor]) => ({
      campo,
      anterior: serializar(anterior[campo as keyof typeof anterior]),
      novo: serializar(valor),
    }));
}

function serializar(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  if (valor instanceof Date) return valor.toISOString();
  if (
    typeof valor === 'string' ||
    typeof valor === 'number' ||
    typeof valor === 'boolean' ||
    typeof valor === 'bigint'
  ) {
    return String(valor);
  }
  return JSON.stringify(valor);
}
