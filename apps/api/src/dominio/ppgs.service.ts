import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { filtroPorPpg, podeVerPpg } from '../auth/escopo';
import { IdentidadeService } from '../auth/identidade.service';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * PPGs (P14) — o cadastro que o slide 3 do prototipo desenhava.
 *
 * A lista traz bolsas e custo por ano porque a pergunta que a equipe faz olhando
 * um PPG nunca e "quais os dados dele", e sim "quanto ele recebe". Os dois
 * numeros sao calculados, nao guardados.
 */

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
  bolsasAno: number;
  custoAno: string;
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
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
  ) {}

  /**
   * Lista os PPGs que o usuario enxerga.
   *
   * O recorte entra na consulta, e nao numa filtragem em memoria depois: filtrar
   * fora do banco traria a tabela inteira para a aplicacao e vazaria a contagem
   * real por qualquer soma feita antes do filtro.
   */
  async listar(usuario: AuthUser): Promise<LinhaPpg[]> {
    const escopo = await this.identidade.escopoDe(usuario);

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
         where ip.status = 'PROGRAMADO'
           and pa.ano = ci.ano_inicio
         group by ip.ppg_id
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
             coalesce(cu.bolsas, 0)     as "bolsasAno",
             coalesce(cu.custo, 0)      as "custoAno",
             coalesce(v.tematicas, '{}') as "tematicas",
             coalesce(v.redes, '{}')     as "redes"
        from ppg p
        left join pessoa   c  on c.id = p.coordenador_id
        left join custo    cu on cu.ppg_id = p.id
        left join vinculos v  on v.ppg_id  = p.id
       where ${filtroPorPpg(escopo, sql`p.id`)}
       order by p.sigla
    `,
    );
  }

  async detalhar(id: string, usuario: AuthUser) {
    const escopo = await this.identidade.escopoDe(usuario);
    if (!podeVerPpg(escopo, id)) {
      // 404 e nao 403: dizer "existe, mas nao e seu" ja entrega que o PPG
      // existe, e a lista nem sequer o mostrou.
      throw new NotFoundException('PPG não encontrado.');
    }
    return this.carregarDetalhe(id);
  }

  /**
   * Leitura sem checagem de escopo, para uso interno depois de uma escrita.
   *
   * `criar` e `atualizar` ja passaram por `ppg:write`; refazer a checagem de
   * leitura aqui faria o cadastro de um PPG fora do escopo terminar em 404
   * depois de ter gravado.
   */
  private async carregarDetalhe(id: string) {
    const [ppg] = await this.db
      .select()
      .from(s.ppg)
      .where(eq(s.ppg.id, id))
      .limit(1);

    if (!ppg) throw new NotFoundException('PPG não encontrado.');

    const [linhas, participacoes, plano] = await Promise.all([
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
          left join area_tematica       at on at.id = ip.area_tematica_id
         where ip.ppg_id = ${id}
         order by ip.codigo
      `,
      ),
    ]);

    return {
      ...ppg,
      linhasPesquisa: linhas,
      participacoes,
      plano,
      /**
       * PEND-006: um PPG em duas tematicas da MESMA rede provavelmente e erro de
       * cadastro. O banco nao impede (o dado existe de verdade), entao a
       * deteccao mora aqui.
       */
      alertaTematicaDuplicada: temRedeRepetida(participacoes),
    };
  }

  async criar(dto: PpgDto) {
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
    return this.carregarDetalhe(criado.id);
  }

  async atualizar(id: string, dto: PpgParcialDto) {
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

    return this.carregarDetalhe(id);
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
