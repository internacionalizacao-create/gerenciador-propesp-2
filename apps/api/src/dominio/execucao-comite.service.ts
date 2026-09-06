import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import { deCentavos, paraCentavos, somarOuNulo } from './orcamento.service';

/**
 * Execucao orcamentaria do Comite Gestor (CG-055).
 *
 * A regra homologada na CG-009 e uma so, e e negativa: **somente a prestacao
 * `VALIDADA` abate o aporte**. Tudo o mais que aparece aqui — lancado, em
 * correcao, enviado — e informativo, e nenhuma dessas linhas entra no
 * `saldoOficial`. Por isso os quatro estados vem em colunas separadas em vez de
 * uma unica soma "executado": uma coluna so obrigaria a escolher entre esconder
 * o que ainda nao vale ou deixar parecer que ja vale.
 *
 * Este orcamento **nao** e o de bolsas do CAPES Global (RN-14). Somar os dois
 * superestima o recurso disponivel, e por isso o aviso viaja junto com o dado.
 */

export interface ExecucaoExercicio {
  ano: number;
  /** Aporte das redes coordenadoras no exercicio; nulo se nao houver. */
  orcamento: string | null;
  emPreenchimento: string | null;
  comPendencia: string | null;
  enviado: string | null;
  validado: string | null;
  /** `orcamento - validado`. Nada mais abate (CG-009). */
  saldoOficial: string | null;
  /** Lancado e ainda sem valor oficial: preenchimento + pendencia + enviado. */
  naoValidado: string | null;
  missoes: number;
  /** Prestacoes existentes que ainda nao foram validadas. */
  prestacoesPendentes: number;
}

export interface ExecucaoComite {
  exercicios: ExecucaoExercicio[];
  /** Consolidado do ciclo. Ver `contagem distinta` no comentario de `total`. */
  total: Omit<ExecucaoExercicio, 'ano'>;
  aviso: string;
}

interface LinhaExecucao {
  ano: number;
  orcamento: string | null;
  em_preenchimento: string | null;
  com_pendencia: string | null;
  enviado: string | null;
  validado: string | null;
  missoes: string;
  prestacoes_pendentes: string;
}

/**
 * Vai para a tela, entao vem acentuado — ao contrario dos comentarios, que o
 * repositorio escreve sem acento. Viaja junto com o dado, e nao fixo na pagina,
 * porque e a mesma ressalva que qualquer consumidor da API precisa repetir.
 */
const AVISO =
  'Somente a prestação validada abate o aporte. Este é o orçamento do ' +
  'Comitê Gestor e não integra o orçamento de bolsas do CAPES Global: ' +
  'somar os dois superestima o recurso disponível.';

@Injectable()
export class ExecucaoComiteService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async porExercicio(cicloId: string): Promise<ExecucaoComite> {
    const linhas = await consultar<LinhaExecucao>(
      this.db,
      sql`
        with anos as (
          -- Uniao, e nao apenas os anos de aporte: despesa imputada a um ano
          -- sem aporte cadastrado e exatamente o caso que precisa aparecer.
          -- Restringir aos anos do orcamento faria esse gasto sumir da tela.
          select ano from orcamento_comite_gestor where ciclo_id = ${cicloId}
          union
          select d.exercicio
            from despesa_missao d
            join prestacao_contas_missao p on p.id = d.prestacao_id
            join missao_comite m on m.id = p.missao_id
           where m.ciclo_id = ${cicloId}
        ),
        orcamento as (
          select ano, sum(valor_anual) as valor
            from orcamento_comite_gestor
           where ciclo_id = ${cicloId}
           group by ano
        ),
        -- O dinheiro agrupa por 'despesa.exercicio' — o ano ao qual a despesa
        -- foi imputada —, nunca pelas datas da missao. Uma viagem de dezembro
        -- paga em janeiro pertence ao exercicio que o lancamento diz.
        despesa as (
          select d.exercicio as ano,
                 sum(d.valor_total) filter (
                   where p.status = 'EM_PREENCHIMENTO') as em_preenchimento,
                 sum(d.valor_total) filter (
                   where p.status = 'COM_PENDENCIA') as com_pendencia,
                 sum(d.valor_total) filter (
                   where p.status = 'ENVIADA') as enviado,
                 sum(d.valor_total) filter (
                   where p.status = 'VALIDADA') as validado
            from despesa_missao d
            join prestacao_contas_missao p on p.id = d.prestacao_id
            join missao_comite m on m.id = p.missao_id
           where m.ciclo_id = ${cicloId}
           group by d.exercicio
        ),
        -- A contagem de missoes usa as datas, e nao 'despesa.exercicio': e o
        -- mesmo criterio do filtro '?ano=' da lista, e quem clica na linha tem
        -- que encontrar la o numero que leu aqui.
        missoes as (
          select a.ano,
                 count(*) as missoes,
                 count(*) filter (
                   where pr.id is not null and pr.status <> 'VALIDADA'
                 ) as prestacoes_pendentes
            from anos a
            join missao_comite m
              on m.ciclo_id = ${cicloId}
             and extract(year from m.data_inicio) <= a.ano
             and extract(year from m.data_fim) >= a.ano
            left join prestacao_contas_missao pr on pr.missao_id = m.id
           group by a.ano
        )
        select a.ano,
               o.valor as orcamento,
               d.em_preenchimento,
               d.com_pendencia,
               d.enviado,
               d.validado,
               coalesce(mi.missoes, 0) as missoes,
               coalesce(mi.prestacoes_pendentes, 0) as prestacoes_pendentes
          from anos a
          left join orcamento o on o.ano = a.ano
          left join despesa d on d.ano = a.ano
          left join missoes mi on mi.ano = a.ano
         order by a.ano
      `,
    );

    const exercicios = linhas.map((linha) => ({
      ano: linha.ano,
      ...montar(linha),
    }));

    return { exercicios, total: await this.consolidado(cicloId), aviso: AVISO };
  }

  /**
   * Consolidado do ciclo.
   *
   * **Nao e a soma das colunas.** Missao que atravessa dois exercicios aparece
   * nas duas linhas, e somar contaria a mesma missao duas vezes; por isso a
   * contagem aqui e distinta, feita sobre o ciclo inteiro. O dinheiro, esse
   * sim, soma — cada despesa pertence a um unico exercicio.
   */
  private async consolidado(
    cicloId: string,
  ): Promise<Omit<ExecucaoExercicio, 'ano'>> {
    const [linha] = await consultar<Omit<LinhaExecucao, 'ano'>>(
      this.db,
      sql`
        select (select sum(valor_anual)
                  from orcamento_comite_gestor
                 where ciclo_id = ${cicloId}) as orcamento,
               d.em_preenchimento,
               d.com_pendencia,
               d.enviado,
               d.validado,
               (select count(*) from missao_comite m
                 where m.ciclo_id = ${cicloId}) as missoes,
               (select count(*)
                  from prestacao_contas_missao p
                  join missao_comite m on m.id = p.missao_id
                 where m.ciclo_id = ${cicloId}
                   and p.status <> 'VALIDADA') as prestacoes_pendentes
          from (
            select sum(d.valor_total) filter (
                     where p.status = 'EM_PREENCHIMENTO') as em_preenchimento,
                   sum(d.valor_total) filter (
                     where p.status = 'COM_PENDENCIA') as com_pendencia,
                   sum(d.valor_total) filter (
                     where p.status = 'ENVIADA') as enviado,
                   sum(d.valor_total) filter (
                     where p.status = 'VALIDADA') as validado
              from despesa_missao d
              join prestacao_contas_missao p on p.id = d.prestacao_id
              join missao_comite m on m.id = p.missao_id
             where m.ciclo_id = ${cicloId}
          ) d
      `,
    );

    return montar(linha);
  }
}

/**
 * Converte a linha crua, preservando a distincao entre nulo e zero.
 *
 * Nulo aqui e "nao ha lancamento", e a interface escreve *A definir*; zero
 * seria "lancaram e deu zero". Somar `coalesce(...,0)` cedo demais apagaria
 * essa diferenca — e no saldo ela e a diferenca entre "sem orcamento" e
 * "orcamento gasto por inteiro".
 */
function montar(
  linha: Omit<LinhaExecucao, 'ano'>,
): Omit<ExecucaoExercicio, 'ano'> {
  const naoValidado = somarOuNulo([
    linha.em_preenchimento,
    linha.com_pendencia,
    linha.enviado,
  ]);

  return {
    orcamento: linha.orcamento,
    emPreenchimento: linha.em_preenchimento,
    comPendencia: linha.com_pendencia,
    enviado: linha.enviado,
    validado: linha.validado,
    naoValidado,
    saldoOficial: saldo(linha.orcamento, linha.validado),
    missoes: Number(linha.missoes),
    prestacoesPendentes: Number(linha.prestacoes_pendentes),
  };
}

/**
 * `orcamento - validado`, em centavos inteiros.
 *
 * Exercicio sem aporte e sem validacao nao tem saldo: `null`, nao zero. Com
 * validacao e sem aporte o saldo fica negativo de proposito — houve gasto
 * oficial contra orcamento inexistente, e esconder isso atras de um nulo
 * transformaria um estouro em ausencia de informacao.
 */
export function saldo(
  orcamento: string | null,
  validado: string | null,
): string | null {
  if (orcamento === null && validado === null) return null;
  return deCentavos(emCentavos(orcamento) - emCentavos(validado));
}

/**
 * Dinheiro nunca passa por `number`.
 *
 * `numeric` do Postgres chega como string justamente para nao perder precisao;
 * converter para float aqui para depois formatar reintroduziria o erro que o
 * tipo do banco evita. A conversao reaproveita a do orcamento (RN-04), para o
 * sistema nao ter duas aritmeticas de dinheiro que possam divergir.
 */
function emCentavos(valor: string | null): bigint {
  return valor === null ? 0n : paraCentavos(valor);
}
