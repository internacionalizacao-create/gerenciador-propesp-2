import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import {
  ALCANCE_GLOBAL,
  alcancaAlvo,
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';

import type { AuthUser } from '../auth/auth-user';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import type { CicloResolvido } from './contexto.service';

/**
 * Orcamento, custo, saldo, utilizacao e divergencia — RN-04 a RN-09.
 *
 * Tudo aqui e calculado em SQL, por tres motivos:
 *
 * 1. `numeric` soma exato dentro do Postgres. Trazer todas as parcelas para o
 *    Node e somar em JavaScript reintroduziria o erro de centavo que o tipo
 *    evita — e a suite de aceite cobra R$ 1.033.513,40 na virgula.
 * 2. O painel precisa de agregacao por rede, por tematica, por modalidade e por
 *    ano. Fazer isso em memoria seria varrer a mesma tabela quatro vezes.
 * 3. Nenhum derivado e persistido (system-structl.md §8.3). Se estas consultas
 *    sumissem, o banco continuaria integro; se um total fosse gravado, ele
 *    comecaria a divergir na primeira edicao — que e como a planilha entrou em
 *    contradicao consigo mesma (§9.1).
 *
 * **Nulo nao e zero.** Rubrica sem valor informado devolve `null`, e composicao
 * anual nao aprovada nao vira saldo livre. Tratar qualquer um desses casos como
 * zero faria o sistema anunciar uma disponibilidade que ninguem confirmou.
 */

export type StatusOrcamento = 'DEFINIDO' | 'A_DEFINIR';
export type StatusComposicaoAnual = 'A_DEFINIR' | 'EM_ELABORACAO' | 'APROVADA';

const dinheiroOpcional = z
  .string()
  .trim()
  .regex(/^\d{1,12}(?:\.\d{1,2})?$/, 'Informe um valor monetário válido.')
  .nullable();

export const atualizarOrcamentoSchema = z
  .object({
    valorBolsas: dinheiroOpcional,
    valorManutencao: dinheiroOpcional,
    valorMissoes: dinheiroOpcional,
    status: z.enum(['DEFINIDO', 'A_DEFINIR']),
    statusComposicao: z.enum(['A_DEFINIR', 'EM_ELABORACAO', 'APROVADA']),
    fonte: z.string().trim().min(3, 'Informe a fonte do orçamento.').max(200),
    observacoes: z.string().trim().max(4000).nullish(),
    justificativa: z
      .string()
      .trim()
      .min(10, 'Informe a justificativa da alteração (mínimo 10 caracteres).')
      .max(4000),
  })
  .superRefine((valor, contexto) => {
    if (valor.status === 'DEFINIDO' && valor.valorBolsas === null) {
      contexto.addIssue({
        code: 'custom',
        path: ['valorBolsas'],
        message: 'Orçamento definido exige o valor de bolsas.',
      });
    }
  });

export type AtualizarOrcamento = z.infer<typeof atualizarOrcamentoSchema>;

export interface LinhaTematica {
  orcamentoId: string;
  areaTematicaId: string;
  codigo: string;
  nome: string;
  redeId: string;
  rede: string;
  ano: number;
  statusOrcamento: StatusOrcamento;
  statusComposicao: StatusComposicaoAnual;
  valorBolsas: string | null;
  valorManutencao: string | null;
  valorMissoes: string | null;
  fonte: string | null;
  observacoes: string | null;
  /** Manutencao + missoes num numero so, somado no Postgres. */
  apoio: string | null;
  /** RN-05 · bolsas + manutencao + missoes. Nulo quando o orcamento nao esta definido. */
  totalPrevisto: string | null;
  /** RN-04 · quantidade x valor do catalogo. Sempre presente; zero quando nao ha plano. */
  custoBolsas: string;
  /** RN-04 sobre manutencao/missoes, que usam valor estimado em vez de catalogo. */
  custoApoio: string;
  totalProgramado: string;
  bolsas: number;
  /** RN-06 · orcamento de bolsas - custo das bolsas. */
  saldoPotencial: string | null;
  /** O que o anexo da rede alegava, guardado como evidencia. */
  saldoInformado: string | null;
  /** RN-08 · saldo calculado - saldo informado. Diferente de zero vira pendencia. */
  divergencia: string | null;
  /** RN-07 · custo programado / orcamento de bolsas, como fracao. */
  utilizacao: number | null;
  ppgs: number;
}

export interface LinhaRede {
  redeId: string;
  rede: string;
  statusOrcamento: StatusOrcamento;
  statusComposicao: StatusComposicaoAnual;
  ano: number;
  valorBolsas: string | null;
  apoio: string | null;
  totalPrevisto: string | null;
  custoBolsas: string;
  bolsas: number;
  saldoPotencial: string | null;
  /** RN-07 na rede: mesma regra da tematica, nula enquanto a rede nao compos. */
  utilizacao: number | null;
  tematicas: number;
  ppgs: number;
}

@Injectable()
export class OrcamentoService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Uma linha por tematica e ano, com orcamento e calculo lado a lado.
   *
   * O custo sai de `planejamento_anual`, nao de `item_planejado.quantidade_anual`:
   * o teto nominal pode repetir nos quatro exercicios, mas a composicao nao. A
   * consulta sempre usa o ano explicito para que 2028-2030 permanecam vazios ate
   * uma aprovacao propria (RN-09).
   */
  async porTematica(
    cicloId: string,
    ano?: number,
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<LinhaTematica[]> {
    const linhaVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`ip.ciclo_id`,
      ppg: sql`ip.ppg_id`,
      rede: sql`at_custo.rede_id`,
      tematica: sql`ip.area_tematica_id`,
      participacao: sql`pp_custo.id`,
    });
    const tematicaVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
    });
    const participacaoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      ppg: sql`pp_visivel.ppg_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
      participacao: sql`pp_visivel.id`,
    });
    const coberturaIntegral = tematicaVisivel;
    return consultar<LinhaTematica>(
      this.db,
      sql`
      with custo_bolsas as (
        select ip.area_tematica_id as area_id,
               pa.ano              as ano,
               sum(pa.quantidade * ic.valor_brl) as custo,
               sum(pa.quantidade)::int           as bolsas
          from planejamento_anual pa
          join item_planejado     ip on ip.id = pa.item_planejado_id
          join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
          left join area_tematica at_custo on at_custo.id = ip.area_tematica_id
          left join participacao_ppg pp_custo
            on pp_custo.area_tematica_id = ip.area_tematica_id
           and pp_custo.ppg_id = ip.ppg_id
         where ip.ciclo_id = ${cicloId}
           and ip.rubrica  = 'BOLSAS'
           and ip.status   = 'PROGRAMADO'
           and ${linhaVisivel}
         group by ip.area_tematica_id, pa.ano
      ),
      custo_apoio as (
        -- Manutencao e missoes nao tem tabela oficial: o valor e estimado e vem
        -- digitado na propria linha (system-structl.md §4.5).
        select ip.area_tematica_id as area_id,
               pa.ano              as ano,
               sum(pa.quantidade * coalesce(ip.valor_unitario_informado, 0)) as custo
          from planejamento_anual pa
          join item_planejado     ip on ip.id = pa.item_planejado_id
          left join area_tematica at_custo on at_custo.id = ip.area_tematica_id
          left join participacao_ppg pp_custo
            on pp_custo.area_tematica_id = ip.area_tematica_id
           and pp_custo.ppg_id = ip.ppg_id
         where ip.ciclo_id = ${cicloId}
           and ip.rubrica <> 'BOLSAS'
           and ip.status  <> 'CANCELADO'
           and ${linhaVisivel}
         group by ip.area_tematica_id, pa.ano
      ),
      ppgs as (
        select area_tematica_id as area_id, count(*)::int as total
          from participacao_ppg
         group by area_tematica_id
      )
      select at.id                          as "areaTematicaId",
             o.id                           as "orcamentoId",
             at.codigo                      as "codigo",
             at.nome                        as "nome",
             rc.id                          as "redeId",
             rc.nome                        as "rede",
             o.ano                          as "ano",
             o.status                       as "statusOrcamento",
             o.status_composicao            as "statusComposicao",
             case when ${coberturaIntegral} then o.valor_bolsas else null end
                                                as "valorBolsas",
             case when ${coberturaIntegral} then o.valor_manutencao else null end
                                                as "valorManutencao",
             case when ${coberturaIntegral} then o.valor_missoes else null end
                                                as "valorMissoes",
             case when ${coberturaIntegral} then o.fonte else null end as "fonte",
             case when ${coberturaIntegral} then o.observacoes else null end
                                                as "observacoes",
             case when not (${coberturaIntegral}) then null
                  when o.valor_manutencao is null and o.valor_missoes is null
                  then null
                  else coalesce(o.valor_manutencao, 0)
                     + coalesce(o.valor_missoes, 0)
             end                            as "apoio",
             case when not (${coberturaIntegral}) or o.valor_bolsas is null then null
                  else coalesce(o.valor_bolsas, 0)
                     + coalesce(o.valor_manutencao, 0)
                     + coalesce(o.valor_missoes, 0)
             end                            as "totalPrevisto",
             coalesce(cb.custo, 0)          as "custoBolsas",
             coalesce(ca.custo, 0)          as "custoApoio",
             coalesce(cb.custo, 0) + coalesce(ca.custo, 0) as "totalProgramado",
             coalesce(cb.bolsas, 0)         as "bolsas",
             case when not (${coberturaIntegral}) or o.valor_bolsas is null
                         or o.status_composicao <> 'APROVADA' then null
                  else o.valor_bolsas - coalesce(cb.custo, 0)
             end                            as "saldoPotencial",
             case when ${coberturaIntegral} then o.saldo_informado else null end
                                                as "saldoInformado",
             case when not (${coberturaIntegral}) or o.valor_bolsas is null or o.saldo_informado is null then null
                  else (o.valor_bolsas - coalesce(cb.custo, 0)) - o.saldo_informado
             end                            as "divergencia",
             case when not (${coberturaIntegral}) or o.valor_bolsas is null or o.valor_bolsas = 0
                         or o.status_composicao <> 'APROVADA' then null
                  else (coalesce(cb.custo, 0) / o.valor_bolsas)::float8
             end                            as "utilizacao",
             coalesce(p.total, 0)           as "ppgs"
        from orcamento_tematica o
        join area_tematica      at on at.id = o.area_tematica_id
        join rede_coordenadora  rc on rc.id = at.rede_id
        left join custo_bolsas  cb on cb.area_id = o.area_tematica_id and cb.ano = o.ano
        left join custo_apoio   ca on ca.area_id = o.area_tematica_id and ca.ano = o.ano
        left join ppgs          p  on p.area_id  = o.area_tematica_id
       where rc.ciclo_id = ${cicloId}
         and ((${tematicaVisivel}) or exists (
           select 1 from participacao_ppg pp_visivel
            where pp_visivel.area_tematica_id = at.id
              and ${participacaoVisivel}
         ))
         ${ano === undefined ? sql`` : sql`and o.ano = ${ano}`}
       order by rc.nome, at.codigo, o.ano
    `,
    );
  }

  /** Consolidado por rede coordenadora, para os cartoes de P01 e P07. */
  async porRede(
    cicloId: string,
    ano?: number,
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<LinhaRede[]> {
    const [tematicas, ppgsPorRede] = await Promise.all([
      this.porTematica(cicloId, ano, alcance),
      this.contarPpgsPorRede(cicloId, alcance),
    ]);
    const porChave = new Map<
      string,
      LinhaRede & { _linhas: LinhaTematica[] }
    >();
    for (const linha of tematicas) {
      const chave = `${linha.redeId}:${linha.ano}`;
      const atual = porChave.get(chave);
      const valores = atual ? [...atual._linhas, linha] : [linha];
      const visiveis = valores;
      porChave.set(chave, {
        redeId: linha.redeId,
        rede: linha.rede,
        statusOrcamento: visiveis.every((t) => t.statusOrcamento === 'DEFINIDO')
          ? 'DEFINIDO'
          : 'A_DEFINIR',
        statusComposicao: visiveis.every(
          (t) => t.statusComposicao === 'APROVADA',
        )
          ? 'APROVADA'
          : visiveis.every((t) => t.statusComposicao === 'A_DEFINIR')
            ? 'A_DEFINIR'
            : 'EM_ELABORACAO',
        ano: linha.ano,
        valorBolsas: somarOuNulo(visiveis.map((t) => t.valorBolsas)),
        apoio: somarOuNulo(visiveis.map((t) => t.apoio)),
        totalPrevisto: somarOuNulo(visiveis.map((t) => t.totalPrevisto)),
        custoBolsas: somarMoeda(visiveis.map((t) => t.custoBolsas)),
        bolsas: visiveis.reduce((total, t) => total + t.bolsas, 0),
        saldoPotencial: somarOuNulo(visiveis.map((t) => t.saldoPotencial)),
        utilizacao: (() => {
          const tetoVisivel = somarOuNulo(visiveis.map((t) => t.valorBolsas));
          const teto = tetoVisivel === null ? 0n : paraCentavos(tetoVisivel);
          return teto > 0n
            ? Number(
                paraCentavos(somarMoeda(visiveis.map((t) => t.custoBolsas))),
              ) / Number(teto)
            : null;
        })(),
        tematicas: new Set(visiveis.map((t) => t.areaTematicaId)).size,
        ppgs: ppgsPorRede.get(linha.redeId) ?? 0,
        _linhas: visiveis,
      });
    }
    return [...porChave.values()].map((linha) => ({
      redeId: linha.redeId,
      rede: linha.rede,
      statusOrcamento: linha.statusOrcamento,
      statusComposicao: linha.statusComposicao,
      ano: linha.ano,
      valorBolsas: linha.valorBolsas,
      apoio: linha.apoio,
      totalPrevisto: linha.totalPrevisto,
      custoBolsas: linha.custoBolsas,
      bolsas: linha.bolsas,
      saldoPotencial: linha.saldoPotencial,
      utilizacao: linha.utilizacao,
      tematicas: linha.tematicas,
      ppgs: linha.ppgs,
    }));
  }

  private async contarPpgsPorRede(cicloId: string, alcance: Alcance) {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      ppg: sql`pp.ppg_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
      participacao: sql`pp.id`,
    });
    const linhas = await consultar<{ redeId: string; total: number }>(
      this.db,
      sql`
        select rc.id as "redeId", count(distinct pp.ppg_id)::int as total
          from participacao_ppg pp
          join area_tematica at on at.id = pp.area_tematica_id
          join rede_coordenadora rc on rc.id = at.rede_id
         where rc.ciclo_id = ${cicloId}
           and ${visivel}
         group by rc.id
      `,
    );
    return new Map(linhas.map((linha) => [linha.redeId, linha.total]));
  }

  /** Registra o ato orçamentário anual e preserva cada campo alterado. */
  async atualizar(
    ciclo: CicloResolvido,
    id: string,
    dto: AtualizarOrcamento,
    usuario: AuthUser,
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<LinhaTematica> {
    const [anterior] = await this.db
      .select({
        id: s.orcamentoTematica.id,
        areaTematicaId: s.orcamentoTematica.areaTematicaId,
        redeId: s.areaTematica.redeId,
        ano: s.orcamentoTematica.ano,
        valorBolsas: s.orcamentoTematica.valorBolsas,
        valorManutencao: s.orcamentoTematica.valorManutencao,
        valorMissoes: s.orcamentoTematica.valorMissoes,
        status: s.orcamentoTematica.status,
        statusComposicao: s.orcamentoTematica.statusComposicao,
        fonte: s.orcamentoTematica.fonte,
        observacoes: s.orcamentoTematica.observacoes,
      })
      .from(s.orcamentoTematica)
      .innerJoin(
        s.areaTematica,
        eq(s.areaTematica.id, s.orcamentoTematica.areaTematicaId),
      )
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.areaTematica.redeId),
      )
      .where(
        and(
          eq(s.orcamentoTematica.id, id),
          eq(s.redeCoordenadora.cicloId, ciclo.cicloId),
        ),
      )
      .limit(1);

    if (!anterior) {
      throw new NotFoundException('Orçamento da área temática não encontrado.');
    }
    if (
      !alcancaAlvo(alcance, {
        cicloId: ciclo.cicloId,
        redeIds: [anterior.redeId],
        tematicaId: anterior.areaTematicaId,
      })
    ) {
      throw new NotFoundException('Orçamento da área temática não encontrado.');
    }
    if (!ciclo.anos.includes(anterior.ano)) {
      throw new BadRequestException(
        `O exercício ${anterior.ano} não pertence ao ciclo ${ciclo.cicloNome}.`,
      );
    }

    const novos = {
      valorBolsas: dto.valorBolsas,
      valorManutencao: dto.valorManutencao,
      valorMissoes: dto.valorMissoes,
      status: dto.status,
      statusComposicao: dto.statusComposicao,
      fonte: dto.fonte,
      observacoes: dto.observacoes ?? null,
    };
    const alterados = Object.entries(novos)
      .filter(
        ([campo, valor]) =>
          serializar(anterior[campo as keyof typeof anterior]) !==
          serializar(valor),
      )
      .map(([campo, valor]) => ({
        campo,
        valorAnterior: serializar(anterior[campo as keyof typeof anterior]),
        valorNovo: serializar(valor),
      }));

    if (alterados.length === 0) {
      throw new BadRequestException('Nenhum valor do orçamento foi alterado.');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(s.orcamentoTematica)
        .set({ ...novos, atualizadoEm: new Date() })
        .where(eq(s.orcamentoTematica.id, anterior.id));

      await tx.insert(s.registroAuditoria).values(
        alterados.map((alteracao) => ({
          entidadeTipo: 'ORCAMENTO_TEMATICA',
          entidadeId: anterior.id,
          acao: 'EDICAO' as const,
          ...alteracao,
          usuarioId: usuario.id,
          usuarioNome: usuario.name ?? null,
          justificativa: dto.justificativa,
          dataReferencia: `${anterior.ano}-01-01`,
        })),
      );
    });

    const atualizada = (
      await this.porTematica(ciclo.cicloId, anterior.ano, alcance)
    ).find((linha) => linha.orcamentoId === anterior.id);
    if (!atualizada) {
      throw new NotFoundException('Orçamento atualizado não encontrado.');
    }
    return atualizada;
  }

  /**
   * As divergencias de RN-08, prontas para virar pendencia.
   *
   * A comparacao permanece ativa mesmo depois da conciliacao de PEND-001 e
   * PEND-003. Se uma nova composicao nao fechar com o saldo informado, o
   * sistema volta a apontar a diferenca automaticamente.
   */
  async divergencias(cicloId: string, ano: number) {
    const linhas = await this.porTematica(cicloId, ano);
    return linhas.filter(
      (l) => l.divergencia !== null && Number(l.divergencia) !== 0,
    );
  }
}

/** Soma uma coluna monetaria vinda como string, sem passar por ponto flutuante. */
export function somarMoeda(valores: readonly (string | null)[]): string {
  const centavos = valores.reduce<bigint>((total, valor) => {
    if (valor === null) return total;
    return total + paraCentavos(valor);
  }, 0n);

  return deCentavos(centavos);
}

/**
 * Mesma soma, mas preservando a diferenca entre "nao ha valor" e "o valor e
 * zero".
 *
 * `somarMoeda` devolve "0.00" para uma lista toda nula, e isso e o que a maior
 * parte das telas quer — o orcamento de uma tematica sem linha e zero mesmo.
 * Onde a ausencia significa outra coisa, porem — prestacao nunca iniciada,
 * exercicio sem aporte —, esse zero mente: a interface escreveria R$ 0,00 no
 * lugar de *A definir* (secao 9.2 da especificacao). Dai as duas funcoes.
 */
export function somarOuNulo(
  valores: readonly (string | null)[],
): string | null {
  if (valores.every((valor) => valor === null)) return null;
  return somarMoeda(valores);
}

/**
 * Converte "1234.56" em 123456 centavos.
 *
 * Existe porque somar dinheiro em `number` erra: `0.1 + 0.2 !== 0.3`, e o erro
 * se acumula justamente em somas grandes como o custo do ciclo. Onde a soma
 * puder ficar no Postgres ela fica; onde precisar acontecer no Node — juntar
 * resultados de consultas diferentes — passa por aqui.
 */
export function paraCentavos(valor: string): bigint {
  const [inteiro, decimal = ''] = valor.trim().split('.');
  const negativo = inteiro.startsWith('-');
  const digitos = `${inteiro.replace('-', '')}${decimal.padEnd(2, '0').slice(0, 2)}`;
  const total = BigInt(digitos || '0');
  return negativo ? -total : total;
}

export function deCentavos(centavos: bigint): string {
  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;
  const inteiro = absoluto / 100n;
  const resto = absoluto % 100n;
  return `${negativo ? '-' : ''}${inteiro}.${resto.toString().padStart(2, '0')}`;
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
