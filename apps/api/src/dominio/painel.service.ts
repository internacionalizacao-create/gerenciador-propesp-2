import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';

import {
  ALCANCE_GLOBAL,
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';

import { consultar, consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import type { CicloResolvido } from './contexto.service';
import {
  OrcamentoService,
  paraCentavos,
  somarMoeda,
  somarOuNulo,
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
  /**
   * `moeda` formata em BRL na interface; `inteiro` e contagem; `texto` vai
   * como veio (a cobertura "1 de 4" nao e numero nem moeda); `percentual` e
   * fracao entre 0 e 1.
   */
  formato: 'moeda' | 'inteiro' | 'texto' | 'percentual';
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

/**
 * Quem coordena cada tematica, agrupado por rede.
 *
 * Nao existe "coordenador da rede": a coordenacao e por participacao
 * PPG-tematica, e uma tematica pode ter mais de um coordenador conforme o PPG
 * (UNICAMP-T1 tem dois). Por isso a lista e por tematica, e nao um nome so por
 * rede, que obrigaria a escolher um e esconder os outros.
 */
export interface CoordenacaoRede {
  redeId: string;
  rede: string;
  tematicas: { codigo: string; nome: string; coordenadores: string[] }[];
}

/**
 * Uma tematica e o estado da composicao em cada exercicio do ciclo.
 *
 * E a grade 12 tematicas x 4 anos da P01. Ela existe porque a pergunta de
 * gestao mais importante do programa — "o que ainda falta compor?" — ficava
 * espalhada entre um cartao, uma tabela e selos. Sai de `porTematica`, a
 * mesma consulta do resto do painel: nenhum numero novo.
 */
export interface LinhaComposicao {
  redeId: string;
  rede: string;
  codigo: string;
  tematica: string;
  anos: {
    ano: number;
    status: LinhaTematica['statusComposicao'];
    bolsas: number;
  }[];
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
  coordenacao: CoordenacaoRede[];
  /**
   * Exercicios do ciclo que ja tem bolsa programada. So o ano-base vem composto
   * da planilha; os demais nascem vazios e nunca copiam quantidade. Sem este
   * dado a tela mostrava "bolsas no ano" e "bolsas no ciclo" com o mesmo numero
   * e o leitor concluia que um dos rotulos significava outra coisa.
   */
  anosCompostos: number[];
  composicao: LinhaComposicao[];
  /**
   * Recado fixo de RN-14: o orcamento do Comite Gestor e paralelo e nunca se
   * soma ao de bolsas. O PNG do painel original precisou dizer isso por escrito.
   */
  comiteGestorAnual: string | null;
}

/**
 * Dinheiro dentro de frase vai formatado aqui: o alerta chega à tela como texto
 * pronto, e `deCentavos` devolve "69751.14", que a interface nao reformata.
 */
const REAIS = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

@Injectable()
export class PainelService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly orcamento: OrcamentoService,
  ) {}

  /**
   * `ano` e o exercicio escolhido na tela; sem ele, o primeiro do ciclo. Quem
   * chama ja validou que o ano pertence ao ciclo (`anoValido` no controller).
   */
  async montar(
    ciclo: CicloResolvido,
    ano: number = ciclo.anoInicio,
    alcance: Alcance = ALCANCE_GLOBAL,
  ): Promise<Painel> {
    const anoBase = ano;

    const [
      tematicasCiclo,
      porRede,
      porModalidade,
      contagens,
      comiteGestor,
      coordenacao,
    ] = await Promise.all([
      this.orcamento.porTematica(ciclo.cicloId, undefined, alcance),
      this.orcamento.porRede(ciclo.cicloId, anoBase, alcance),
      this.porModalidade(ciclo.cicloId, anoBase, alcance),
      this.contagens(ciclo.cicloId, anoBase, alcance),
      this.comiteGestorAnual(ciclo.cicloId, alcance),
      this.coordenacao(ciclo.cicloId, alcance),
    ]);

    const doAnoBase = tematicasCiclo.filter((t) => t.ano === anoBase);

    const aporteAnual = somarOuNulo(doAnoBase.map((t) => t.totalPrevisto));
    const aporteCiclo = somarOuNulo(tematicasCiclo.map((t) => t.totalPrevisto));
    const custoAnual = somarMoeda(doAnoBase.map((t) => t.custoBolsas));
    const saldoAnual = somarMoeda(doAnoBase.map((t) => t.saldoPotencial));
    const bolsasAno = doAnoBase.reduce((total, t) => total + t.bolsas, 0);
    const bolsasCiclo = tematicasCiclo.reduce(
      (total, t) => total + t.bolsas,
      0,
    );
    const porAno = this.porAno(tematicasCiclo, ciclo.anos);
    const anosCompostos = porAno.filter((a) => a.bolsas > 0).map((a) => a.ano);
    const anosSemBolsa = ciclo.anos.filter((a) => !anosCompostos.includes(a));
    const periodo = faixaDeAnos(ciclo.anos);

    // Uso do teto so sobre tematicas com composicao aprovada: e o mesmo recorte
    // do saldo potencial. Somar o teto de quem ainda nao compos ao denominador
    // faria a rede pendente parecer folga: 2027 leria 46% num plano que esta
    // a 88% onde ja foi decidido.
    const aprovadas = doAnoBase.filter(
      (t) => t.statusComposicao === 'APROVADA' && t.valorBolsas !== null,
    );
    const tetoAprovado = paraCentavos(
      somarMoeda(aprovadas.map((t) => t.valorBolsas)),
    );
    const custoAprovado = paraCentavos(
      somarMoeda(aprovadas.map((t) => t.custoBolsas)),
    );
    const usoDoTeto =
      tetoAprovado > 0n ? Number(custoAprovado) / Number(tetoAprovado) : null;

    return {
      ciclo,
      anoBase,
      comiteGestorAnual: comiteGestor,
      porRede,
      porModalidade,
      porAno,
      anosCompostos,
      composicao: this.composicao(tematicasCiclo, ciclo.anos),
      coordenacao,
      fluxo: contagens.fluxo,
      // Duas faixas de quatro: a primeira fala do exercicio-base, a segunda do
      // ciclo. O ano vai escrito no rotulo porque "por ano" era lido como
      // media, e a media de um ciclo com um so exercicio composto engana.
      indicadores: [
        {
          chave: 'aporte-anual',
          rotulo: `Aporte conhecido em ${anoBase}`,
          valor: aporteAnual,
          formato: 'moeda',
          nota: 'Redes sem orçamento definido ficam de fora.',
        },
        {
          chave: 'bolsas-ano',
          rotulo: `Bolsas programadas em ${anoBase}`,
          valor: bolsasAno,
          formato: 'inteiro',
          nota: 'Soma das quantidades de todas as linhas do plano.',
        },
        {
          chave: 'custo-bolsas-ano',
          rotulo: `Custo das bolsas em ${anoBase}`,
          valor: custoAnual,
          formato: 'moeda',
          nota: 'Quantidade × valor da tabela vigente.',
        },
        {
          chave: 'uso-teto-ano',
          rotulo: `Teto de bolsas comprometido em ${anoBase}`,
          valor: usoDoTeto,
          formato: 'percentual',
          nota: 'Custo programado sobre o teto das redes com composição aprovada.',
        },
        {
          chave: 'saldo-ano',
          rotulo: `Saldo potencial em ${anoBase}`,
          valor: saldoAnual,
          formato: 'moeda',
          nota: 'Orçamento de bolsas menos o custo programado.',
        },
        {
          chave: 'projecao-ciclo',
          rotulo: 'Orçamento projetado do ciclo',
          valor: aporteCiclo,
          formato: 'moeda',
          nota: `Aporte anual repetido em ${ciclo.anos.length} exercícios (${periodo}), sem reajuste.`,
        },
        {
          chave: 'bolsas-ciclo',
          rotulo: 'Bolsas no ciclo',
          valor: bolsasCiclo,
          formato: 'inteiro',
          nota:
            anosSemBolsa.length === 0
              ? 'Soma de todos os exercícios do ciclo.'
              : `Só ${faixaDeAnos(anosCompostos) || 'nenhum exercício'} tem bolsas definidas; ${faixaDeAnos(anosSemBolsa)} ainda não.`,
        },
        {
          chave: 'composicao-ciclo',
          rotulo: 'Exercícios compostos',
          valor: `${anosCompostos.length} de ${ciclo.anos.length}`,
          formato: 'texto',
          nota:
            anosCompostos.length === 0
              ? 'Nenhum exercício com bolsas definidas.'
              : `Com bolsas definidas: ${faixaDeAnos(anosCompostos)}.`,
        },
        {
          chave: 'ppgs',
          rotulo: 'PPGs mapeados',
          valor: contagens.ppgs,
          formato: 'inteiro',
          nota: 'Programas de pós-graduação cadastrados.',
        },
      ],
      alertas: this.alertas(ciclo, doAnoBase, contagens),
    };
  }

  // ------------------------------------------------------------------ //

  private async coordenacao(
    cicloId: string,
    alcance: Alcance,
  ): Promise<CoordenacaoRede[]> {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      ppg: sql`pp.ppg_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
      participacao: sql`pp.id`,
    });
    const linhas = await consultar<{
      redeId: string;
      rede: string;
      codigo: string;
      nome: string;
      coordenadores: string[];
    }>(
      this.db,
      sql`
      select rc.id    as "redeId",
             rc.nome  as "rede",
             at.codigo as "codigo",
             at.nome  as "nome",
             coalesce(
               array_agg(distinct pe.nome order by pe.nome)
                 filter (where pe.nome is not null),
               '{}'
             )        as "coordenadores"
        from area_tematica     at
        join rede_coordenadora rc on rc.id = at.rede_id
        left join participacao_ppg pp on pp.area_tematica_id = at.id
        left join pessoa           pe on pe.id = pp.coordenador_tematica_id
       where rc.ciclo_id = ${cicloId}
         and ${visivel}
       group by rc.id, rc.nome, at.codigo, at.nome
       order by rc.nome, at.codigo
    `,
    );
    const porRede = new Map<string, CoordenacaoRede>();
    for (const linha of linhas) {
      const rede = porRede.get(linha.redeId) ?? {
        redeId: linha.redeId,
        rede: linha.rede,
        tematicas: [],
      };
      rede.tematicas.push({
        codigo: linha.codigo,
        nome: linha.nome,
        coordenadores: linha.coordenadores,
      });
      porRede.set(linha.redeId, rede);
    }
    return [...porRede.values()];
  }

  private composicao(
    linhas: LinhaTematica[],
    anos: number[],
  ): LinhaComposicao[] {
    const porTematica = new Map<string, LinhaTematica[]>();
    for (const linha of linhas) {
      porTematica.set(linha.areaTematicaId, [
        ...(porTematica.get(linha.areaTematicaId) ?? []),
        linha,
      ]);
    }
    return [...porTematica.values()]
      .map((doTema) => {
        const [primeira] = doTema;
        return {
          redeId: primeira.redeId,
          rede: primeira.rede,
          codigo: primeira.codigo,
          tematica: primeira.nome,
          // Ano sem linha de orcamento entra como A_DEFINIR, e nao some: a
          // grade tem de ter as mesmas colunas em toda linha.
          anos: anos.map((ano) => {
            const doAno = doTema.find((l) => l.ano === ano);
            return {
              ano,
              status: doAno?.statusComposicao ?? 'A_DEFINIR',
              bolsas: doAno?.bolsas ?? 0,
            };
          }),
        };
      })
      .sort(
        (a, b) =>
          a.rede.localeCompare(b.rede, 'pt-BR') ||
          a.codigo.localeCompare(b.codigo, 'pt-BR'),
      );
  }

  private porAno(linhas: LinhaTematica[], anos: number[]): LinhaAno[] {
    return anos.map((ano) => {
      const doAno = linhas.filter((l) => l.ano === ano);
      return {
        ano,
        aporte: somarOuNulo(doAno.map((l) => l.totalPrevisto)),
        custoBolsas: somarMoeda(doAno.map((l) => l.custoBolsas)),
        custoApoio: somarMoeda(doAno.map((l) => l.custoApoio)),
        saldoPotencial: doAno.some(
          (linha) => linha.statusComposicao === 'APROVADA',
        )
          ? somarMoeda(doAno.map((l) => l.saldoPotencial))
          : null,
        bolsas: doAno.reduce((total, l) => total + l.bolsas, 0),
      };
    });
  }

  private async porModalidade(
    cicloId: string,
    anoBase: number,
    alcance: Alcance,
  ): Promise<LinhaModalidade[]> {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`ip.ciclo_id`,
      ppg: sql`ip.ppg_id`,
      rede: sql`at.rede_id`,
      tematica: sql`ip.area_tematica_id`,
      participacao: sql`pp.id`,
    });
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
          left join area_tematica at on at.id = ip.area_tematica_id
          left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
            and pp.ppg_id = ip.ppg_id
         where ip.ciclo_id = ${cicloId}
           and ip.status   = 'PROGRAMADO'
           and ${visivel}
         group by ip.id
      )
      select m.nome                                     as "modalidade",
             ip.destino                                 as "destino",
             sum(pa_ano.quantidade)::int                as "quantidadeAno",
             sum(pa_ano.quantidade * ic.valor_brl)      as "custoAno",
             sum(c.quantidade)::int                     as "quantidadeCiclo",
             sum(c.custo)                               as "custoCiclo"
        from item_planejado      ip
        join item_catalogo_bolsa ic on ic.id = ip.item_catalogo_id
        join modalidade          m  on m.id  = ip.modalidade_id
        join no_ciclo            c  on c.id  = ip.id
        join planejamento_anual pa_ano
          on pa_ano.item_planejado_id = ip.id
         and pa_ano.ano = ${anoBase}
        left join area_tematica at on at.id = ip.area_tematica_id
        left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
          and pp.ppg_id = ip.ppg_id
       where ip.ciclo_id = ${cicloId}
         and ip.status   = 'PROGRAMADO'
         and ${visivel}
       group by m.nome, ip.destino
       order by sum(pa_ano.quantidade * ic.valor_brl) desc
    `,
    );
  }

  private async contagens(cicloId: string, anoBase: number, alcance: Alcance) {
    const planoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`ip.ciclo_id`,
      ppg: sql`ip.ppg_id`,
      rede: sql`at.rede_id`,
      tematica: sql`ip.area_tematica_id`,
      participacao: sql`pp.id`,
    });
    const participacaoVisivel = condicaoDoAlcance(alcance, {
      ciclo: sql`rc.ciclo_id`,
      ppg: sql`pp.ppg_id`,
      rede: sql`rc.id`,
      tematica: sql`at.id`,
      participacao: sql`pp.id`,
    });
    const linha = await consultarUma<{
      ppgs: number;
      ppgsSemBolsa: number;
      tematicasSemOrcamento: number;
      composicoesADefinir: number;
      bolsasIn: number;
      bolsasOut: number;
    }>(
      this.db,
      sql`
      select
        (select count(distinct pp.ppg_id)::int
           from participacao_ppg pp
           join area_tematica at on at.id = pp.area_tematica_id
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId} and ${participacaoVisivel}) as "ppgs",

        -- PPG que participa de tematica mas nao tem nenhuma linha programada.
        -- Sao os 10 da UNICAMP: existem no cadastro e nao existem no plano.
        (select count(distinct p.id)::int
           from ppg p
          join participacao_ppg pp on pp.ppg_id = p.id
          join area_tematica at on at.id = pp.area_tematica_id
          join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId}
            and ${participacaoVisivel}
            and not exists (
            select 1 from item_planejado ip
             left join area_tematica at on at.id = ip.area_tematica_id
             left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
               and pp.ppg_id = ip.ppg_id
             where ip.ppg_id = p.id
               and ip.ciclo_id = ${cicloId}
               and ip.status = 'PROGRAMADO'
               and ${planoVisivel})) as "ppgsSemBolsa",

        (select count(*)::int
           from area_tematica at
           join rede_coordenadora rc on rc.id = at.rede_id
         where rc.ciclo_id = ${cicloId}
            and exists (select 1 from participacao_ppg pp
              where pp.area_tematica_id = at.id and ${participacaoVisivel})
            and at.status_orcamento = 'A_DEFINIR') as "tematicasSemOrcamento",

        (select count(*)::int
           from orcamento_tematica o
           join area_tematica at on at.id = o.area_tematica_id
           join rede_coordenadora rc on rc.id = at.rede_id
          where rc.ciclo_id = ${cicloId}
            and exists (select 1 from participacao_ppg pp
              where pp.area_tematica_id = at.id and ${participacaoVisivel})
            and o.ano = (select min(o2.ano) from orcamento_tematica o2
                          join area_tematica at2 on at2.id = o2.area_tematica_id
                          join rede_coordenadora rc2 on rc2.id = at2.rede_id
                         where rc2.ciclo_id = ${cicloId})
            and o.status_composicao <> 'APROVADA') as "composicoesADefinir",

        (select coalesce(sum(pa.quantidade), 0)::int
           from planejamento_anual pa
           join item_planejado ip on ip.id = pa.item_planejado_id
           left join area_tematica at on at.id = ip.area_tematica_id
           left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
             and pp.ppg_id = ip.ppg_id
          where ip.ciclo_id = ${cicloId} and ip.status = 'PROGRAMADO'
            and pa.ano = ${anoBase} and ip.fluxo = 'IN'
            and ${planoVisivel}) as "bolsasIn",

        (select coalesce(sum(pa.quantidade), 0)::int
           from planejamento_anual pa
           join item_planejado ip on ip.id = pa.item_planejado_id
           left join area_tematica at on at.id = ip.area_tematica_id
           left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
             and pp.ppg_id = ip.ppg_id
          where ip.ciclo_id = ${cicloId} and ip.status = 'PROGRAMADO'
            and pa.ano = ${anoBase} and ip.fluxo = 'OUT'
            and ${planoVisivel}) as "bolsasOut"
    `,
    );

    return {
      ...linha,
      fluxo: { in: linha.bolsasIn, out: linha.bolsasOut },
    };
  }

  private async comiteGestorAnual(
    cicloId: string,
    alcance: Alcance,
  ): Promise<string | null> {
    if (!alcance.global && !alcance.ciclos.includes(cicloId)) return null;
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
      composicoesADefinir: number;
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
        titulo: 'Áreas temáticas sem orçamento definido',
        detalhe:
          'Ficam fora dos indicadores financeiros até o orçamento ser informado.',
        quantidade: contagens.tematicasSemOrcamento,
        destino: `${base}/redes`,
      });
    }

    if (contagens.composicoesADefinir > 0) {
      alertas.push({
        chave: 'composicoes-a-definir',
        nivel: 'ALTA',
        titulo: 'Composições anuais ainda não aprovadas',
        detalhe:
          'O teto orçamentário existe, mas modalidades e quantidades ainda não ' +
          'foram definidas. O valor não é apresentado como saldo livre.',
        quantidade: contagens.composicoesADefinir,
        destino: `${base}/plano`,
      });
    }

    if (divergentes.length > 0) {
      alertas.push({
        chave: 'divergencia-saldo',
        nivel: 'ALTA',
        titulo: 'Divergência entre saldo calculado e saldo informado',
        detalhe:
          `Em ${divergentes.map((d) => d.codigo).join(', ')}. ` +
          'O saldo calculado pelo sistema difere do informado no anexo da rede.',
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
          'Estão mapeados e participam de uma temática, mas não têm linha de ' +
          'planejamento programada neste ciclo.',
        quantidade: contagens.ppgsSemBolsa,
        destino: '/ppgs',
      });
    }

    if (apoioNaoProgramado > 0n) {
      alertas.push({
        chave: 'apoio-nao-programado',
        nivel: 'MEDIA',
        titulo: 'Manutenção e missões sem plano de aplicação',
        detalhe:
          `${REAIS.format(Number(apoioNaoProgramado) / 100)} por ano com orçamento e sem ` +
          'item planejado. Os anexos informam o valor global das rubricas, mas ' +
          'não detalham em que será gasto.',
        quantidade: 1,
        destino: `${base}/plano`,
      });
    }

    // Sem alerta nem indicador de pendencias: a P13 perdeu a tela em
    // 2026-09-08, e mostrar uma contagem que nao abre em lugar nenhum era o
    // card que levava a 404. As pendencias seguem na API; se a tela voltar, o
    // alerta volta com ela.

    return alertas;
  }
}

/**
 * "2028–2030" para anos consecutivos, "2027" para um so e "2027, 2029" para
 * salteados. Lista vazia vira texto vazio: quem chama decide o que dizer.
 */
export function faixaDeAnos(anos: number[]): string {
  if (anos.length === 0) return '';
  const ordenados = [...anos].sort((a, b) => a - b);
  const consecutivos = ordenados.every(
    (ano, i) => i === 0 || ano === ordenados[i - 1] + 1,
  );
  if (ordenados.length === 1) return String(ordenados[0]);
  if (consecutivos) return `${ordenados[0]}–${ordenados[ordenados.length - 1]}`;
  return ordenados.join(', ');
}
