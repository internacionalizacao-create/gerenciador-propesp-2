import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  ALCANCE_GLOBAL,
  SEM_ALCANCE,
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * PPGs (P14) — o cadastro que o slide 3 do prototipo desenhava.
 *
 * A lista traz bolsas e custo por ano porque a pergunta que a equipe faz olhando
 * um PPG nunca e "quais os dados dele", e sim "quanto ele recebe". Os dois
 * numeros sao calculados, nao guardados.
 *
 * **Duas acoes, dois alcances.** O cadastro (nome, sigla, vinculos) sai sob
 * `ppg:read`, que o catalogo so admite `GLOBAL`: e dado institucional. Bolsas,
 * custo e as linhas do plano sao **planejamento**, e saem sob o alcance de
 * `plano:read` — senao quem consulta o plano de um PPG leria, pela lista de
 * PPGs, o custo de todos os outros.
 */

/** Recorte das colunas de planejamento a partir de `item_planejado ip`. */
function planoVisivel(alcance: Alcance) {
  return condicaoDoAlcance(alcance, {
    ciclo: sql`ip.ciclo_id`,
    ppg: sql`ip.ppg_id`,
    rede: sql`rc.id`,
    tematica: sql`ip.area_tematica_id`,
    participacao: sql`pp.id`,
  });
}

/** A capacidade independe de haver linhas: vazio autorizado nao e sem acesso. */
function podeLerPlano(alcance: Alcance, ppgId: ReturnType<typeof sql>) {
  return sql`(${alcance.global}::boolean
    or exists (
      select 1 from participacao_ppg pp
      join area_tematica at on at.id = pp.area_tematica_id
      join rede_coordenadora rc on rc.id = at.rede_id
      where pp.ppg_id = ${ppgId} and ${condicaoDoAlcance(alcance, {
        ciclo: sql`rc.ciclo_id`,
        ppg: sql`pp.ppg_id`,
        rede: sql`rc.id`,
        tematica: sql`at.id`,
        participacao: sql`pp.id`,
      })}
    ) or exists (
      select 1 from item_planejado ip ${JOINS_DO_RECORTE}
      where ip.ppg_id = ${ppgId} and ${planoVisivel(alcance)}
    ) or ${
      alcance.ppgs.length > 0
        ? sql`${ppgId} in (${sql.join(
            alcance.ppgs.map((p) => sql`${p.ppgId}::uuid`),
            sql`, `,
          )})`
        : sql`false`
    })`;
}

/**
 * Joins que o recorte do plano precisa. `participacao_ppg` e unica por
 * (tematica, PPG), entao o `left join` nao duplica a linha do item.
 */
const JOINS_DO_RECORTE = sql`
  left join area_tematica     at on at.id = ip.area_tematica_id
  left join rede_coordenadora rc on rc.id = at.rede_id
  left join participacao_ppg  pp on pp.area_tematica_id = ip.area_tematica_id
                                and pp.ppg_id = ip.ppg_id`;

export interface LinhaPpg {
  id: string;
  nome: string;
  sigla: string;
  unidade: string | null;
  nivel: string | null;
  modalidade: string | null;
  notaCapes: number | null;
  areaCapes: string | null;
  situacao: string;
  emRede: boolean;
  redeAcademica: string | null;
  coordenador: string | null;
  /**
   * Nulo quando nenhum planejamento deste PPG esta no alcance de `plano:read`
   * — "sem acesso", que a tela escreve diferente de zero.
   */
  bolsasAno: number | null;
  custoAno: string | null;
  /**
   * `true` quando o alcance de `plano:read` nao e global: os dois numeros acima
   * somam so o que a conta alcanca, e a tela precisa dizer isso.
   */
  planoRecortado: boolean;
  podeLerPlano: boolean;
  tematicas: string[];
  redes: string[];
}

export const ppgSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome do PPG.').max(300),
  sigla: z.string().trim().min(2, 'Informe a sigla.').max(40),
  unidade: z.string().trim().max(200).nullish(),
  nivel: z
    .enum([
      'MESTRADO',
      'DOUTORADO',
      'MESTRADO_DOUTORADO',
      'MESTRADO_PROFISSIONAL',
    ])
    .nullish(),
  modalidade: z.enum(['ACADEMICO', 'PROFISSIONAL']).nullish(),
  /**
   * Ate 7, nao ate 5. O prototipo sugeria 5 e o PPG em Medicina Tropical tem 7 —
   * o limite errado teria transformado um dado real em erro de validacao.
   */
  notaCapes: z.coerce.number().int().min(1).max(7).nullish(),
  areaCapes: z.string().trim().max(200).nullish(),
  situacao: z.enum(['ATIVO', 'INATIVO', 'EM_IMPLANTACAO']).default('ATIVO'),
  emRede: z.coerce.boolean().default(false),
  redeAcademica: z.string().trim().max(120).nullish(),
  observacoes: z.string().trim().max(2000).nullish(),
  /** Linhas de pesquisa entram como chips no formulario e viram linhas aqui. */
  linhasPesquisa: z.array(z.string().trim().min(2).max(300)).default([]),
});

export type PpgDto = z.infer<typeof ppgSchema>;
export const ppgParcialSchema = ppgSchema.partial();
export type PpgParcialDto = z.infer<typeof ppgParcialSchema>;

@Injectable()
export class PpgsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Lista os PPGs, com bolsas e custo recortados por `plano:read`.
   *
   * Os recortes entram na consulta, e nao numa filtragem em memoria depois:
   * filtrar fora do banco traria a tabela inteira para a aplicacao e vazaria a
   * contagem real por qualquer soma feita antes do filtro.
   *
   * Os padroes `ALCANCE_GLOBAL` servem as rotinas internas e aos testes de
   * calculo; o controller passa sempre o alcance da requisicao.
   */
  async listar(
    alcancePlano: Alcance = ALCANCE_GLOBAL,
    alcanceCadastro: Alcance = ALCANCE_GLOBAL,
  ): Promise<LinhaPpg[]> {
    // `ppg:read` so admite GLOBAL. Uma concessao de outro tipo gravada direto
    // no banco nao vira lista parcial: nao alcanca nada.
    if (!alcanceCadastro.global) return [];

    const recortado = !alcancePlano.global;
    // Literal SQL, e nao parametro: `$1 as "planoRecortado"` chegaria como texto.
    const recortadoSql = recortado ? sql`true` : sql`false`;

    return consultar<LinhaPpg>(
      this.db,
      sql`
      with custo as (
        select ip.ppg_id,
               sum(pa.quantidade)::int                  as bolsas,
               sum(pa.quantidade * ic.valor_brl)        as custo
          from item_planejado      ip
          join planejamento_anual  pa on pa.item_planejado_id = ip.id
          join ciclo               ci on ci.id = ip.ciclo_id
          join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
          ${JOINS_DO_RECORTE}
         where ip.status = 'PROGRAMADO'
           and pa.ano = ci.ano_inicio
           and ${planoVisivel(alcancePlano)}
         group by ip.ppg_id
      ),
      -- PPGs sobre os quais a conta tem algum alcance de plano: ali o zero e
      -- zero de verdade. Nos demais o numero sai nulo, porque a conta nao tem
      -- como saber se e zero.
      alcancado as (
        select p.id as ppg_id from ppg p
         where ${podeLerPlano(alcancePlano, sql`p.id`)}
      ),
      vinculos as (
        select pp.ppg_id,
               array_agg(distinct at.codigo) as tematicas,
               array_agg(distinct rc.nome)   as redes
          from participacao_ppg    pp
          join area_tematica       at on at.id = pp.area_tematica_id
          join rede_coordenadora   rc on rc.id = at.rede_id
         group by pp.ppg_id
      )
      select p.id                       as "id",
             p.nome                     as "nome",
             p.sigla                    as "sigla",
             p.unidade                  as "unidade",
             p.nivel                    as "nivel",
             p.modalidade               as "modalidade",
             p.nota_capes               as "notaCapes",
             p.area_capes               as "areaCapes",
             p.situacao                 as "situacao",
             p.em_rede                  as "emRede",
             p.rede_academica           as "redeAcademica",
             c.nome                     as "coordenador",
             case when not ${recortadoSql} or al.ppg_id is not null
                  then coalesce(cu.bolsas, 0) end as "bolsasAno",
             case when not ${recortadoSql} or al.ppg_id is not null
                  then coalesce(cu.custo, 0) end  as "custoAno",
             ${recortadoSql}            as "planoRecortado",
             (not ${recortadoSql} or al.ppg_id is not null) as "podeLerPlano",
             coalesce(v.tematicas, '{}') as "tematicas",
             coalesce(v.redes, '{}')     as "redes"
        from ppg p
        left join pessoa   c  on c.id = p.coordenador_id
        left join custo    cu on cu.ppg_id = p.id
        left join vinculos v  on v.ppg_id  = p.id
        left join alcancado al on al.ppg_id = p.id
       order by p.sigla
    `,
    );
  }

  async detalhar(
    id: string,
    alcancePlano: Alcance = ALCANCE_GLOBAL,
    alcanceCadastro: Alcance = ALCANCE_GLOBAL,
  ) {
    if (!alcanceCadastro.global) {
      // Mesma frase do PPG inexistente: o texto nao pode separar os dois casos.
      throw new NotFoundException('PPG não encontrado.');
    }
    return this.carregarDetalhe(id, alcancePlano);
  }

  /**
   * Detalhe do cadastro, com as linhas do plano no alcance de `plano:read`.
   *
   * Escrever cadastro nao concede leitura de planejamento: a resposta da
   * escrita recebe o mesmo alcance de leitura da requisicao.
   */
  private async carregarDetalhe(
    id: string,
    alcancePlano: Alcance = ALCANCE_GLOBAL,
  ) {
    const [ppg] = await this.db
      .select()
      .from(s.ppg)
      .where(eq(s.ppg.id, id))
      .limit(1);

    if (!ppg) throw new NotFoundException('PPG não encontrado.');

    const [linhas, participacoes, plano, [visibilidade]] = await Promise.all([
      this.db
        .select({
          id: s.linhaPesquisa.id,
          nome: s.linhaPesquisa.nome,
          ativa: s.linhaPesquisa.ativa,
        })
        .from(s.linhaPesquisa)
        .where(eq(s.linhaPesquisa.ppgId, id))
        .orderBy(asc(s.linhaPesquisa.nome)),

      this.db
        .select({
          id: s.participacaoPpg.id,
          situacao: s.participacaoPpg.situacao,
          modalidadesPrevistas: s.participacaoPpg.modalidadesPrevistas,
          tematicaCodigo: s.areaTematica.codigo,
          tematicaNome: s.areaTematica.nome,
          rede: s.redeCoordenadora.nome,
          programa: s.programa.nome,
          programaSlug: s.programa.slug,
          ciclo: s.ciclo.nome,
        })
        .from(s.participacaoPpg)
        .innerJoin(
          s.areaTematica,
          eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
        )
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.areaTematica.redeId),
        )
        .innerJoin(s.ciclo, eq(s.ciclo.id, s.redeCoordenadora.cicloId))
        .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
        .where(eq(s.participacaoPpg.ppgId, id)),

      consultar<{
        codigo: string;
        rubrica: string;
        status: string;
        modalidade: string | null;
        destino: string | null;
        vigenciaMeses: string | null;
        quantidadeAnual: number;
        valorUnitario: string | null;
        custoAnual: string | null;
        tematica: string | null;
      }>(
        this.db,
        sql`
        select ip.codigo, ip.rubrica, ip.status, m.nome as modalidade,
               ip.destino, ip.vigencia_meses as "vigenciaMeses",
               ip.quantidade_anual as "quantidadeAnual",
               coalesce(ic.valor_brl, ip.valor_unitario_informado) as "valorUnitario",
               case when coalesce(ic.valor_brl, ip.valor_unitario_informado) is null
                    then null
                    else ip.quantidade_anual
                       * coalesce(ic.valor_brl, ip.valor_unitario_informado)
               end as "custoAnual",
               at.codigo as tematica
          from item_planejado ip
          left join modalidade          m  on m.id  = ip.modalidade_id
          left join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
          ${JOINS_DO_RECORTE}
         where ip.ppg_id = ${id}
           and ${planoVisivel(alcancePlano)}
         order by ip.codigo
      `,
      ),
      consultar<{ podeLerPlano: boolean }>(
        this.db,
        sql`select ${podeLerPlano(alcancePlano, sql`${id}::uuid`)} as "podeLerPlano"`,
      ),
    ]);

    return {
      ...ppg,
      linhasPesquisa: linhas,
      participacoes,
      plano: visibilidade.podeLerPlano ? plano : null,
      podeLerPlano: visibilidade.podeLerPlano,
      /** Ver `LinhaPpg.planoRecortado`: o plano acima e so o que a conta alcanca. */
      planoRecortado: !alcancePlano.global,
      /**
       * PEND-006: um PPG em duas tematicas da MESMA rede provavelmente e erro de
       * cadastro. O banco nao impede (o dado existe de verdade), entao a
       * deteccao mora aqui.
       */
      alertaTematicaDuplicada: temRedeRepetida(participacoes),
    };
  }

  async criar(dto: PpgDto, alcancePlano: Alcance = SEM_ALCANCE) {
    const { linhasPesquisa, ...dados } = dto;

    const [criado] = await this.db
      .insert(s.ppg)
      .values({
        ...dados,
        unidade: dados.unidade ?? null,
        nivel: dados.nivel ?? null,
        modalidade: dados.modalidade ?? null,
        notaCapes: dados.notaCapes ?? null,
        areaCapes: dados.areaCapes ?? null,
        redeAcademica: dados.redeAcademica ?? null,
        observacoes: dados.observacoes ?? null,
      })
      .returning({ id: s.ppg.id })
      .catch(traduzirErroDePpg);

    await this.gravarLinhas(criado.id, linhasPesquisa);
    return this.carregarDetalhe(criado.id, alcancePlano);
  }

  async atualizar(
    id: string,
    dto: PpgParcialDto,
    alcancePlano: Alcance = SEM_ALCANCE,
  ) {
    const { linhasPesquisa, ...dados } = dto;

    if (Object.keys(dados).length > 0) {
      await this.db
        .update(s.ppg)
        .set({ ...dados, atualizadoEm: new Date() })
        .where(eq(s.ppg.id, id))
        .catch(traduzirErroDePpg);
    }

    if (linhasPesquisa) {
      await this.db
        .delete(s.linhaPesquisa)
        .where(eq(s.linhaPesquisa.ppgId, id));
      await this.gravarLinhas(id, linhasPesquisa);
    }

    return this.carregarDetalhe(id, alcancePlano);
  }

  private async gravarLinhas(ppgId: string, nomes: string[]): Promise<void> {
    const unicos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
    if (unicos.length === 0) return;

    await this.db
      .insert(s.linhaPesquisa)
      .values(unicos.map((nome) => ({ ppgId, nome })));
  }
}

/** A restricao do banco tambem cobre cadastros concorrentes com a mesma sigla. */
function traduzirErroDePpg(erro: unknown): never {
  const causa = (erro as { cause?: unknown })?.cause ?? erro;
  const violacao = causa as { code?: string; constraint?: string } | null;
  if (violacao?.code === '23505' && violacao.constraint === 'ppg_sigla_uk') {
    throw new ConflictException({
      message: 'Já existe um PPG cadastrado com esta sigla.',
      erros: [
        {
          campo: 'sigla',
          mensagem:
            'Esta sigla já está cadastrada. Informe outra sigla ou edite o PPG existente.',
        },
      ],
    });
  }
  throw erro;
}

function temRedeRepetida(
  participacoes: readonly { rede: string }[],
): string | null {
  const contagem = new Map<string, number>();
  for (const p of participacoes) {
    contagem.set(p.rede, (contagem.get(p.rede) ?? 0) + 1);
  }

  const repetida = [...contagem.entries()].find(([, total]) => total > 1);
  return repetida
    ? `Este PPG aparece em ${repetida[1]} áreas temáticas da rede ${repetida[0]}. ` +
        'Confirme se é intencional.'
    : null;
}
