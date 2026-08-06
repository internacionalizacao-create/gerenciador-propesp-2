import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';

/**
 * Orcamento, custo, saldo, utilizacao e divergencia — RN-04 a RN-09.
 *
 * Tudo aqui e calculado em SQL, por tres motivos:
 *
 * 1. `numeric` soma exato dentro do Postgres. Trazer 132 linhas para o Node e
 *    somar em JavaScript reintroduziria o erro de centavo que o tipo evita — e a
 *    suite de aceite cobra R$ 1.144.357,20 na virgula.
 * 2. O painel precisa de agregacao por rede, por tematica, por modalidade e por
 *    ano. Fazer isso em memoria seria varrer a mesma tabela quatro vezes.
 * 3. Nenhum derivado e persistido (system-structl.md §8.3). Se estas consultas
 *    sumissem, o banco continuaria integro; se um total fosse gravado, ele
 *    comecaria a divergir na primeira edicao — que e como a planilha entrou em
 *    contradicao consigo mesma (§9.1).
 *
 * **Nulo nao e zero.** Tematica com orcamento `A_DEFINIR` (as quatro da UNICAMP)
 * devolve `null` em orcamento, saldo e utilizacao. Tratar como zero e o que
 * derrubaria as medias do painel e faria o sistema anunciar um saldo que ninguem
 * prometeu.
 */

export type StatusOrcamento = 'DEFINIDO' | 'A_DEFINIR';

export interface LinhaTematica {
  areaTematicaId: string;
  codigo: string;
  nome: string;
  redeId: string;
  rede: string;
  ano: number;
  statusOrcamento: StatusOrcamento;
  valorBolsas: string | null;
  valorManutencao: string | null;
  valorMissoes: string | null;
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
  ano: number;
  valorBolsas: string | null;
  apoio: string | null;
  totalPrevisto: string | null;
  custoBolsas: string;
  bolsas: number;
  saldoPotencial: string | null;
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
   * a premissa vigente repete a quantidade nos quatro exercicios (RN-09), mas o
   * modelo nao deve assumir isso — no dia em que um ano tiver quantidade
   * diferente, esta consulta ja esta certa.
   */
  async porTematica(cicloId: string, ano?: number): Promise<LinhaTematica[]> {
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
         where ip.ciclo_id = ${cicloId}
           and ip.rubrica  = 'BOLSAS'
           and ip.status   = 'PROGRAMADO'
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
         where ip.ciclo_id = ${cicloId}
           and ip.rubrica <> 'BOLSAS'
           and ip.status  <> 'CANCELADO'
         group by ip.area_tematica_id, pa.ano
      ),
      ppgs as (
        select area_tematica_id as area_id, count(*)::int as total
          from participacao_ppg
         group by area_tematica_id
      )
      select at.id                          as "areaTematicaId",
             at.codigo                      as "codigo",
             at.nome                        as "nome",
             rc.id                          as "redeId",
             rc.nome                        as "rede",
             o.ano                          as "ano",
             o.status                       as "statusOrcamento",
             o.valor_bolsas                 as "valorBolsas",
             o.valor_manutencao             as "valorManutencao",
             o.valor_missoes                as "valorMissoes",
             case when o.valor_manutencao is null and o.valor_missoes is null
                  then null
                  else coalesce(o.valor_manutencao, 0)
                     + coalesce(o.valor_missoes, 0)
             end                            as "apoio",
             case when o.valor_bolsas is null then null
                  else coalesce(o.valor_bolsas, 0)
                     + coalesce(o.valor_manutencao, 0)
                     + coalesce(o.valor_missoes, 0)
             end                            as "totalPrevisto",
             coalesce(cb.custo, 0)          as "custoBolsas",
             coalesce(ca.custo, 0)          as "custoApoio",
             coalesce(cb.custo, 0) + coalesce(ca.custo, 0) as "totalProgramado",
             coalesce(cb.bolsas, 0)         as "bolsas",
             case when o.valor_bolsas is null then null
                  else o.valor_bolsas - coalesce(cb.custo, 0)
             end                            as "saldoPotencial",
             o.saldo_informado              as "saldoInformado",
             case when o.valor_bolsas is null or o.saldo_informado is null then null
                  else (o.valor_bolsas - coalesce(cb.custo, 0)) - o.saldo_informado
             end                            as "divergencia",
             case when o.valor_bolsas is null or o.valor_bolsas = 0 then null
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
         ${ano === undefined ? sql`` : sql`and o.ano = ${ano}`}
       order by rc.nome, at.codigo, o.ano
    `,
    );
  }

  /** Consolidado por rede coordenadora, para os cartoes de P01 e P07. */
  async porRede(cicloId: string, ano?: number): Promise<LinhaRede[]> {
    return consultar<LinhaRede>(
      this.db,
      sql`
      with custo_bolsas as (
        select at.rede_id, pa.ano,
               sum(pa.quantidade * ic.valor_brl) as custo,
               sum(pa.quantidade)::int           as bolsas
          from planejamento_anual pa
          join item_planejado      ip on ip.id = pa.item_planejado_id
          join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
          join area_tematica       at on at.id = ip.area_tematica_id
         where ip.ciclo_id = ${cicloId}
           and ip.status   = 'PROGRAMADO'
         group by at.rede_id, pa.ano
      ),
      ppgs as (
        select at.rede_id, count(distinct pp.ppg_id)::int as total
          from participacao_ppg pp
          join area_tematica    at on at.id = pp.area_tematica_id
         group by at.rede_id
      )
      select rc.id                       as "redeId",
             rc.nome                     as "rede",
             rc.status_orcamento         as "statusOrcamento",
             o.ano                       as "ano",
             sum(o.valor_bolsas)         as "valorBolsas",
             sum(coalesce(o.valor_manutencao, 0)
               + coalesce(o.valor_missoes, 0))                as "apoio",
             sum(o.valor_bolsas
               + coalesce(o.valor_manutencao, 0)
               + coalesce(o.valor_missoes, 0))                as "totalPrevisto",
             coalesce(cb.custo, 0)       as "custoBolsas",
             coalesce(cb.bolsas, 0)      as "bolsas",
             case when sum(o.valor_bolsas) is null then null
                  else sum(o.valor_bolsas) - coalesce(cb.custo, 0)
             end                         as "saldoPotencial",
             count(distinct at.id)::int  as "tematicas",
             coalesce(p.total, 0)        as "ppgs"
        from orcamento_tematica o
        join area_tematica      at on at.id = o.area_tematica_id
        join rede_coordenadora  rc on rc.id = at.rede_id
        left join custo_bolsas  cb on cb.rede_id = rc.id and cb.ano = o.ano
        left join ppgs          p  on p.rede_id  = rc.id
       where rc.ciclo_id = ${cicloId}
         ${ano === undefined ? sql`` : sql`and o.ano = ${ano}`}
       group by rc.id, rc.nome, rc.status_orcamento, o.ano, cb.custo, cb.bolsas, p.total
       order by rc.nome, o.ano
    `,
    );
  }

  /**
   * As divergencias de RN-08, prontas para virar pendencia.
   *
   * Sao as duas que o sistema tem que achar sozinho — R$ 206,10 na UNESP-T3 e
   * R$ 11.005,49 na UNESP-T1 — e que na planilha so foram notadas porque alguem
   * conferiu a mao.
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
