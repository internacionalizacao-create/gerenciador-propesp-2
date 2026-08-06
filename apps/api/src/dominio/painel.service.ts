import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import { consultar, consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import type { CicloResolvido } from './contexto.service';
import {
  deCentavos,
  OrcamentoService,
  paraCentavos,
  somarMoeda,
  type LinhaRede,
  type LinhaTematica,
} from './orcamento.service';

/**
 * Painel executivo (P01) — "como esta o programa" em dez segundos.
 *
 * Nenhum numero daqui esta guardado em coluna: todos saem do calculo sobre os
 * dados de entrada. E o que permite afirmar que o painel e o plano nunca
 * divergem, coisa que a planilha nao conseguia garantir (§9.1).
 */

export interface Indicador {
  chave: string;
  rotulo: string;
  valor: string | number | null;
  /** `moeda` formata em BRL na interface; `inteiro` e contagem. */
  formato: 'moeda' | 'inteiro';
  nota?: string;
}

export interface LinhaModalidade {
  modalidade: string;
  destino: 'BRASIL' | 'EXTERIOR';
  quantidadeAno: number;
  custoAno: string;
  quantidadeCiclo: number;
  custoCiclo: string;
}

export interface LinhaAno {
  ano: number;
  aporte: string | null;
  custoBolsas: string;
  custoApoio: string;
  saldoPotencial: string | null;
  bolsas: number;
}

export interface Alerta {
  chave: string;
  nivel: 'ALTA' | 'MEDIA' | 'BAIXA';
  titulo: string;
  detalhe: string;
  quantidade: number;
  /** Para onde o alerta leva. Alerta que nao leva ao registro vira decoracao. */
  destino: string;
}

export interface Painel {
  ciclo: CicloResolvido;
  anoBase: number;
  indicadores: Indicador[];
  porRede: LinhaRede[];
  porModalidade: LinhaModalidade[];
  porAno: LinhaAno[];
  fluxo: { in: number; out: number };
  alertas: Alerta[];
  /**
   * Recado fixo de RN-14: o orcamento do Comite Gestor e paralelo e nunca se
   * soma ao de bolsas. O PNG do painel original precisou dizer isso por escrito.
   */
  comiteGestorAnual: string | null;
}

@Injectable()
export class PainelService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly orcamento: OrcamentoService,
  ) {}

  async montar(ciclo: CicloResolvido): Promise<Painel> {
    const anoBase = ciclo.anoInicio;

    const [tematicasCiclo, porRede, porModalidade, contagens, comiteGestor] =
      await Promise.all([
        this.orcamento.porTematica(ciclo.cicloId),
        this.orcamento.porRede(ciclo.cicloId, anoBase),
        this.porModalidade(ciclo.cicloId),
        this.contagens(ciclo.cicloId),
        this.comiteGestorAnual(ciclo.cicloId),
      ]);

    const doAnoBase = tematicasCiclo.filter((t) => t.ano === anoBase);

    const aporteAnual = somarMoeda(doAnoBase.map((t) => t.totalPrevisto));
    const aporteCiclo = somarMoeda(tematicasCiclo.map((t) => t.totalPrevisto));
    const custoAnual = somarMoeda(doAnoBase.map((t) => t.custoBolsas));
    const saldoAnual = somarMoeda(doAnoBase.map((t) => t.saldoPotencial));
    const bolsasAno = doAnoBase.reduce((total, t) => total + t.bolsas, 0);
    const bolsasCiclo = tematicasCiclo.reduce(
      (total, t) => total + t.bolsas,
      0,
    );

    return {
      ciclo,
      anoBase,
      comiteGestorAnual: comiteGestor,
      porRede,
      porModalidade,
      porAno: this.porAno(tematicasCiclo, ciclo.anos),
      fluxo: contagens.fluxo,
      indicadores: [
        {
          chave: 'aporte-anual',
          rotulo: 'Aporte anual conhecido',
          valor: aporteAnual,
          formato: 'moeda',
          nota: `Exercicio ${anoBase}. Nao inclui redes sem orcamento definido.`,
        },
        {
          chave: 'projecao-ciclo',
          rotulo: 'Projecao do ciclo',
          valor: aporteCiclo,
          formato: 'moeda',
          nota: `${ciclo.anos.length} exercicios, valor nominal repetido (RN-09).`,
        },
        {
          chave: 'bolsas-ano',
          rotulo: 'Bolsas programadas/ano',
          valor: bolsasAno,
          formato: 'inteiro',
          nota: 'Soma de quantidades, nao de linhas de planejamento (RN-11).',
        },
        {
          chave: 'custo-bolsas-ano',
          rotulo: 'Custo anual das bolsas',
          valor: custoAnual,
          formato: 'moeda',
          nota: 'Quantidade x valor do catalogo vigente (RN-01, RN-04).',
        },
        {
          chave: 'ppgs',
          rotulo: 'PPGs mapeados',
          valor: contagens.ppgs,
          formato: 'inteiro',
        },
        {
          chave: 'bolsas-ciclo',
          rotulo: 'Bolsas no ciclo',
          valor: bolsasCiclo,
          formato: 'inteiro',
        },
        {
          chave: 'saldo-ano',
          rotulo: 'Saldo potencial/ano',
          valor: saldoAnual,
          formato: 'moeda',
          nota: 'Orcamento de bolsas menos o custo programado (RN-06).',
        },
        {
          chave: 'pendencias',
          rotulo: 'Pendencias abertas',
          valor: contagens.pendenciasAbertas,
          formato: 'inteiro',
        },
      ],
      alertas: this.alertas(ciclo, doAnoBase, contagens),
    };
  }

  // ------------------------------------------------------------------ //

  private porAno(linhas: LinhaTematica[], anos: number[]): LinhaAno[] {
    return anos.map((ano) => {
      const doAno = linhas.filter((l) => l.ano === ano);
      return {
        ano,
        aporte: somarMoeda(doAno.map((l) => l.totalPrevisto)),
        custoBolsas: somarMoeda(doAno.map((l) => l.custoBolsas)),
        custoApoio: somarMoeda(doAno.map((l) => l.custoApoio)),
        saldoPotencial: somarMoeda(doAno.map((l) => l.saldoPotencial)),
        bolsas: doAno.reduce((total, l) => total + l.bolsas, 0),
      };
    });
  }

  private async porModalidade(cicloId: string): Promise<LinhaModalidade[]> {
    return consultar<LinhaModalidade>(
      this.db,
      sql`
      with no_ciclo as (
        select ip.id,
               sum(pa.quantidade)::int             as quantidade,
               sum(pa.quantidade * ic.valor_brl)   as custo
          from planejamento_anual  pa
          join item_planejado      ip on ip.id = pa.item_planejado_id
          join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
         where ip.ciclo_id = ${cicloId}
           and ip.status   = 'PROGRAMADO'
         group by ip.id
      )
      select m.nome                                     as "modalidade",
             ip.destino                                 as "destino",
             sum(ip.quantidade_anual)::int              as "quantidadeAno",
             sum(ip.quantidade_anual * ic.valor_brl)    as "custoAno",
             sum(c.quantidade)::int                     as "quantidadeCiclo",
             sum(c.custo)                               as "custoCiclo"
        from item_planejado      ip
        join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
        join modalidade          m  on m.id  = ip.modalidade_id
        join no_ciclo            c  on c.id  = ip.id
       where ip.ciclo_id = ${cicloId}
         and ip.status   = 'PROGRAMADO'
       group by m.nome, ip.destino
       order by sum(ip.quantidade_anual * ic.valor_brl) desc
    `,
    );
  }

  private async contagens(cicloId: string) {
    const linha = await consultarUma<{
      ppgs: number;
      ppgsSemBolsa: number;
      pendenciasAbertas: number;
      tematicasSemOrcamento: number;
      bolsasIn: number;
      bolsasOut: number;
    }>(
      this.db,
      sql`
      select
        (select count(*)::int from ppg) as "ppgs",

        -- PPG que participa de tematica mas nao tem nenhuma linha programada.
        -- Sao os 10 da UNICAMP: existem no cadastro e nao existem no plano.
        (select count(*)::int
           from ppg p
          where not exists (
            select 1 from item_planejado ip
             where ip.ppg_id = p.id
               and ip.ciclo_id = ${cicloId}
               and ip.status = 'PROGRAMADO')) as "ppgsSemBolsa",

        (select count(*)::int from pendencia
          where ciclo_id = ${cicloId} and status <> 'RESOLVIDA') as "pendenciasAbertas",

        (select count(*)::int
           from area_tematica at
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId}
            and at.status_orcamento = 'A_DEFINIR') as "tematicasSemOrcamento",

        (select coalesce(sum(ip.quantidade_anual), 0)::int from item_planejado ip
          where ip.ciclo_id = ${cicloId} and ip.status = 'PROGRAMADO'
            and ip.fluxo = 'IN') as "bolsasIn",

        (select coalesce(sum(ip.quantidade_anual), 0)::int from item_planejado ip
          where ip.ciclo_id = ${cicloId} and ip.status = 'PROGRAMADO'
            and ip.fluxo = 'OUT') as "bolsasOut"
    `,
    );

    return {
      ...linha,
      fluxo: { in: linha.bolsasIn, out: linha.bolsasOut },
    };
  }

  private async comiteGestorAnual(cicloId: string): Promise<string | null> {
    const [linha] = await consultar<{ total: string | null }>(
      this.db,
      sql`
      select sum(valor_anual) as total
        from orcamento_comite_gestor
       where ciclo_id = ${cicloId}
         and ano = (select min(ano) from orcamento_comite_gestor
                     where ciclo_id = ${cicloId})
    `,
    );
    return linha?.total ?? null;
  }

  private alertas(
    ciclo: CicloResolvido,
    doAnoBase: LinhaTematica[],
    contagens: {
      ppgsSemBolsa: number;
      tematicasSemOrcamento: number;
      pendenciasAbertas: number;
    },
  ): Alerta[] {
    const base = `/programas/${ciclo.programaSlug}/${ciclo.cicloNome}`;
    const divergentes = doAnoBase.filter(
      (t) => t.divergencia !== null && Number(t.divergencia) !== 0,
    );

    // Manutencao e missoes tem orcamento e (hoje) nenhum item planejado —
    // PEND-009 e PEND-010. A lacuna precisa aparecer como numero, nao como
    // comentario perdido numa celula.
    const apoioNaoProgramado =
      paraCentavos(
        somarMoeda(
          doAnoBase.flatMap((t) => [t.valorManutencao, t.valorMissoes]),
        ),
      ) - paraCentavos(somarMoeda(doAnoBase.map((t) => t.custoApoio)));

    const alertas: Alerta[] = [];

    if (contagens.tematicasSemOrcamento > 0) {
      alertas.push({
        chave: 'tematicas-sem-orcamento',
        nivel: 'ALTA',
        titulo: 'Areas tematicas sem orcamento definido',
        detalhe:
          'Ficam de fora de todo indicador financeiro. Nao entram como zero — ' +
          'entrariam distorcendo medias e percentuais.',
        quantidade: contagens.tematicasSemOrcamento,
        destino: `${base}/redes`,
      });
    }

    if (divergentes.length > 0) {
      alertas.push({
        chave: 'divergencia-saldo',
        nivel: 'ALTA',
        titulo: 'Divergencia entre saldo calculado e saldo informado',
        detalhe:
          `Em ${divergentes.map((d) => d.codigo).join(', ')}. ` +
          'O sistema calculou um saldo diferente do que o anexo da rede alegava (RN-08).',
        quantidade: divergentes.length,
        destino: `${base}/redes`,
      });
    }

    if (contagens.ppgsSemBolsa > 0) {
      alertas.push({
        chave: 'ppgs-sem-bolsa',
        nivel: 'MEDIA',
        titulo: 'PPGs sem nenhuma bolsa programada',
        detalhe:
          'Estao mapeados e participam de uma tematica, mas nao tem linha de ' +
          'planejamento programada neste ciclo.',
        quantidade: contagens.ppgsSemBolsa,
        destino: '/ppgs',
      });
    }

    if (apoioNaoProgramado > 0n) {
      alertas.push({
        chave: 'apoio-nao-programado',
        nivel: 'MEDIA',
        titulo: 'Manutencao e missoes sem plano de aplicacao',
        detalhe:
          `R$ ${deCentavos(apoioNaoProgramado)} por ano com orcamento e sem ` +
          'item planejado. Os anexos informam o valor global das rubricas, mas ' +
          'nao detalham em que sera gasto.',
        quantidade: 1,
        destino: `${base}/plano`,
      });
    }

    if (contagens.pendenciasAbertas > 0) {
      alertas.push({
        chave: 'pendencias',
        nivel: 'BAIXA',
        titulo: 'Pendencias em aberto',
        detalhe: 'Decisoes e confirmacoes que travam parte do planejamento.',
        quantidade: contagens.pendenciasAbertas,
        destino: '/pendencias',
      });
    }

    return alertas;
  }
}
