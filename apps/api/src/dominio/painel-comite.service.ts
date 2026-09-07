import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { RecorteDeMissoes } from '../auth/escopo';
import { consultar } from '../comum/consultar';
import { diasDesde } from '../comum/datas';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Painel do Comite Gestor (CG-066).
 *
 * Nao ha numero novo aqui: cada indicador conta a mesma coisa que a lista de
 * missoes ja conta, com o mesmo criterio. E por isso que o painel **reusa as
 * expressoes da lista** (situacao temporal derivada de `current_date`, situacao
 * da prestacao vinda de `coalesce` sobre o `left join`) em vez de escrever
 * variantes proprias — dois SQL que respondem a mesma pergunta divergem na
 * primeira mudanca, e quem clica no cartao encontraria outra contagem do lado
 * de la.
 *
 * **O recorte e um so.** Cartoes, quebras e pendencias recebem exatamente as
 * mesmas condicoes de escopo (exercicio e rede), porque o painel serve para
 * decidir e nao pode oferecer um numero apurado num universo e uma lista
 * apurada em outro.
 *
 * **Rede entra por `exists`, nunca por `join`** (CG-016): a missao de duas
 * redes coordenadoras e uma missao, e um `join` com `missao_rede` a contaria
 * duas vezes em todo consolidado desta tela.
 */

export const filtroPainelSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  redeId: z.uuid().optional(),
});
export type FiltroPainel = z.infer<typeof filtroPainelSchema>;

type StatusAprovacao = (typeof s.statusAprovacaoMissaoEnum.enumValues)[number];
type StatusMissao = (typeof s.statusMissaoComiteEnum.enumValues)[number];
type SituacaoTemporal = 'FUTURA' | 'EM_ANDAMENTO' | 'ENCERRADA';
type SituacaoPrestacao =
  | 'NAO_INICIADA'
  | 'EM_PREENCHIMENTO'
  | 'ENVIADA'
  | 'COM_PENDENCIA'
  | 'VALIDADA';

/**
 * Motivos pelos quais uma missao aparece na lista de pendencias.
 *
 * Todos tem a mesma forma: **alguem precisa agir e ainda nao agiu**. Missao em
 * preenchimento normal nao entra — estaria em pendencia o tempo inteiro, e uma
 * lista onde tudo aparece nao ajuda ninguem a escolher o que fazer primeiro.
 */
export const MOTIVOS_PENDENCIA = [
  'ANALISE_PARADA',
  'AJUSTES_SOLICITADOS',
  'PRESTACAO_NAO_INICIADA',
  'PRESTACAO_COM_PENDENCIA',
  'PRESTACAO_ENVIADA',
  'ENCERRAMENTO_PENDENTE',
] as const;
export type MotivoPendencia = (typeof MOTIVOS_PENDENCIA)[number];

/** Dias de espera a partir dos quais a analise vira pendencia (CG-047). */
export const DIAS_PARA_ANALISE_PARADA = 7;

/**
 * "Aguarda decisao ha `DIAS_PARA_ANALISE_PARADA` dias ou mais", em SQL.
 *
 * E a traducao exata de `diasDesde` (CG-047): conta **dias civis em
 * `America/Manaus`**, e nao periodos de 24 horas nem o fuso do servidor. Sem o
 * `at time zone`, uma submissao das 22h de Manaus contaria como do dia
 * seguinte, e o cartao divergiria da coluna "Espera" da fila de analise — dois
 * numeros para o mesmo fato, na mesma tela.
 *
 * Os dias entram por `sql.raw` porque `current_date - $1` deixaria o Postgres
 * sem tipo para o operando; e constante do modulo, nunca valor do usuario.
 */
const ANALISE_PARADA = sql`
  ra.id is not null
  and (ra.submetido_em at time zone 'America/Manaus')::date
      <= (current_timestamp at time zone 'America/Manaus')::date
        - ${sql.raw(String(DIAS_PARA_ANALISE_PARADA))}
`;

/**
 * Uma rede coordenadora com tudo o que o ciclo produziu nela (CG-067).
 *
 * **A soma destas linhas nao e o consolidado**, e isso nao e defeito: a missao
 * de duas redes pertence as duas, e o pais visitado por duas redes foi
 * alcancado pelas duas. Somar a coluna contaria o mesmo fato duas vezes. O
 * consolidado sai dos campos de topo do painel, apurados sobre o recorte
 * inteiro — computo diferente, e nao a mesma conta agregada de outro jeito. E
 * a mesma regra do total da CG-055.
 */
export interface ConsolidadoDaRede {
  id: string;
  nome: string;
  missoes: number;
  paises: number;
  instituicoes: number;
  eventos: number;
  convenios: number;
  produtos: number;
  despesaValidada: string | null;
  despesaLancada: string | null;
}

export interface MotivoDaPendencia {
  chave: MotivoPendencia;
  texto: string;
  /** De quem a tela cobra a acao. */
  responsavel: string;
  /** Dias civis desde o fato que criou a pendencia; nulo quando nao ha data. */
  dias: number | null;
}

export interface PendenciaMissao {
  missaoId: string;
  codigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  status: StatusMissao;
  statusAprovacao: StatusAprovacao;
  situacaoPrestacao: SituacaoPrestacao;
  redes: string[];
  motivos: MotivoDaPendencia[];
}

export interface PainelComite {
  recorte: {
    ano: number | null;
    redeId: string | null;
    redeNome: string | null;
  };
  /** Missoes distintas no recorte. Multirrede conta uma vez (CG-016). */
  missoes: number;
  analise: {
    aguardando: number;
    /** Aguardando ha mais de uma reuniao semanal do colegiado. */
    paradas: number;
    ajustesSolicitados: number;
    naoSubmetidas: number;
  };
  aprovacao: Record<StatusAprovacao, number>;
  realizacao: Record<SituacaoTemporal, number>;
  prestacao: Record<SituacaoPrestacao, number>;
  conclusao: {
    concluidas: number;
    canceladas: number;
    /** Periodo terminou, missao confirmada e ainda nao encerrada (CG-058). */
    aEncerrar: number;
  };
  alcance: {
    paises: number;
    parceiros: number;
    /** Eventos distintos pelo nome; ver `AVISO_EVENTO`. */
    eventos: number;
    convenios: number;
    produtos: number;
  };
  /** Despesa das missoes do recorte (CG-067); nao e o orcamento, que e a CG-055. */
  financeiro: {
    /** Unica que abate o aporte (CG-009). */
    validada: string | null;
    /** Tudo o que foi lancado, em qualquer estado da prestacao. */
    lancada: string | null;
  };
  porPais: { id: string; nome: string; codigoIso2: string; missoes: number }[];
  porRede: ConsolidadoDaRede[];
  /** Uma linha por missao, com todos os motivos — nunca uma linha por motivo. */
  pendencias: PendenciaMissao[];
  aviso: string;
}

/**
 * Texto e responsavel de cada motivo.
 *
 * Acentuado porque vira rotulo de tela, como o resto do modulo do Comite. O
 * responsavel viaja junto com o motivo, e nao fixo na pagina, porque e a
 * informacao que transforma a lista em fila de trabalho: sem ela, quem abre o
 * painel ve seis pendencias e nao sabe quais sao suas.
 */
const TEXTO_MOTIVO: Record<
  MotivoPendencia,
  { texto: string; responsavel: string }
> = {
  ANALISE_PARADA: {
    texto: 'Aguarda decisão do Comitê há mais de uma semana',
    responsavel: 'Comitê Gestor',
  },
  AJUSTES_SOLICITADOS: {
    texto: 'Devolvida para ajustes e ainda não reenviada',
    responsavel: 'Responsável pela missão',
  },
  PRESTACAO_NAO_INICIADA: {
    texto: 'Missão realizada e prestação de contas não iniciada',
    responsavel: 'Responsável pela missão',
  },
  PRESTACAO_COM_PENDENCIA: {
    texto: 'Prestação devolvida com pendência',
    responsavel: 'Responsável pela missão',
  },
  PRESTACAO_ENVIADA: {
    texto: 'Prestação enviada, aguardando validação',
    responsavel: 'Administração',
  },
  ENCERRAMENTO_PENDENTE: {
    texto: 'Prestação validada e missão ainda não encerrada',
    responsavel: 'Comitê Gestor',
  },
};

/**
 * Vai junto com o dado porque descreve o recorte, e nao a pagina. Qualquer
 * consumidor da API precisaria repetir a mesma ressalva.
 */
const AVISO =
  'Os indicadores contam missões do ciclo, sem duplicar a missão de mais de ' +
  'uma rede coordenadora. Aprovação e execução são dimensões independentes: ' +
  'missão aprovada não é missão realizada.';

/**
 * Evento ainda nao e entidade, e a contagem carrega essa limitacao.
 *
 * D-10 deixou o evento reutilizavel para a F2: hoje ele e **campo de texto da
 * atividade**, entao "eventos distintos" e a contagem de nomes distintos, com
 * espacos e caixa normalizados. O mesmo congresso escrito de duas formas conta
 * duas vezes, e nao ha como o sistema saber. O aviso viaja com o dado porque
 * quem le o numero precisa saber o que ele mede — silenciar isso faria a
 * contagem parecer exata.
 */
export const AVISO_EVENTO =
  'Eventos são contados pelo nome informado em cada atividade, porque evento ' +
  'ainda não é cadastro próprio: o mesmo congresso escrito de duas formas ' +
  'conta duas vezes.';

@Injectable()
export class PainelComiteService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async montar(
    cicloId: string,
    filtro: FiltroPainel,
    recorte: RecorteDeMissoes,
  ): Promise<PainelComite> {
    // A rede e resolvida **antes** do escopo, e um id que nao pertence a este
    // ciclo faz o recorte cair em "todas" em vez de zerar tudo. Um painel
    // inteiro de zeros e indistinguivel de um ciclo sem missao nenhuma, e quem
    // chegou por link antigo nao teria como saber a diferenca. E a mesma
    // defesa que a tela ja aplica ao exercicio pedido na URL.
    const rede = await this.nomeDaRede(cicloId, filtro.redeId, recorte);
    const redeId = rede ? (filtro.redeId ?? null) : null;
    const escopo = this.escopo(cicloId, { ano: filtro.ano, redeId }, recorte);

    const [contagens, alcance, porPais, porRede, pendencias] =
      await Promise.all([
        this.contagens(escopo),
        this.alcance(escopo),
        this.porPais(escopo),
        this.porRede(cicloId, escopo, recorte),
        this.pendencias(escopo),
      ]);

    return {
      recorte: { ano: filtro.ano ?? null, redeId, redeNome: rede },
      ...contagens,
      ...alcance,
      porPais,
      porRede,
      pendencias,
      aviso: AVISO,
    };
  }

  /**
   * Condicoes de escopo, montadas uma unica vez e reusadas por toda consulta.
   *
   * E o que sustenta o criterio de aceite da CG-066: cartoes e pendencias
   * respondem ao mesmo universo porque literalmente recebem o mesmo `SQL`.
   */
  private escopo(
    cicloId: string,
    filtro: { ano?: number; redeId: string | null },
    recorte: RecorteDeMissoes,
  ): SQL {
    // O recorte por rede do **usuario** entra junto do ciclo, e nao depois: e
    // ele que faz cartoes, quebras e pendencias contarem so o que a pessoa
    // alcanca. O `?redeId=` da URL e outra coisa — filtro que o usuario
    // escolhe, dentro do que ja lhe cabe (CG-028).
    const condicoes: SQL[] = [
      sql`m.ciclo_id = ${cicloId}`,
      recorte.sobre(sql`m.id`),
    ];

    // Mesma regra do filtro `?ano=` da lista: a missao entra se **atravessa** o
    // exercicio, e nao apenas se comeca nele. Um criterio diferente aqui faria
    // o numero mudar ao clicar no cartao.
    if (filtro.ano !== undefined) {
      condicoes.push(
        sql`extract(year from m.data_inicio) <= ${filtro.ano}
            and extract(year from m.data_fim) >= ${filtro.ano}`,
      );
    }

    if (filtro.redeId) {
      condicoes.push(sql`exists (
        select 1 from missao_rede mr
         where mr.missao_id = m.id and mr.rede_id = ${filtro.redeId}
      )`);
    }

    return sql.join(condicoes, sql` and `);
  }

  /**
   * Todos os contadores numa unica varredura.
   *
   * Uma consulta por cartao pagaria a mesma leitura de `missao_comite` oito
   * vezes e, pior, abriria a possibilidade de dois cartoes lerem estados
   * diferentes do banco. `filter (where ...)` mantem tudo no mesmo instante.
   */
  private async contagens(escopo: SQL) {
    const [linha] = await consultar<Record<string, string>>(
      this.db,
      sql`
        select count(*) as missoes,
               count(*) filter (where ra.id is not null) as aguardando,
               count(*) filter (where ${ANALISE_PARADA}) as paradas,
               count(*) filter (
                 where m.status_aprovacao = 'AJUSTES_SOLICITADOS'
               ) as ajustes_solicitados,
               count(*) filter (
                 where m.status_aprovacao = 'RASCUNHO'
               ) as nao_submetidas,
               count(*) filter (where m.status_aprovacao = 'RASCUNHO')
                 as ap_rascunho,
               count(*) filter (where m.status_aprovacao = 'EM_ANALISE')
                 as ap_em_analise,
               count(*) filter (where m.status_aprovacao = 'AJUSTES_SOLICITADOS')
                 as ap_ajustes,
               count(*) filter (where m.status_aprovacao = 'APROVADA')
                 as ap_aprovada,
               count(*) filter (where m.status_aprovacao = 'REPROVADA')
                 as ap_reprovada,
               count(*) filter (where m.data_inicio > current_date) as futura,
               count(*) filter (
                 where m.data_inicio <= current_date
                   and m.data_fim >= current_date
               ) as em_andamento,
               count(*) filter (where m.data_fim < current_date) as encerrada,
               count(*) filter (where pr.id is null) as pr_nao_iniciada,
               count(*) filter (where pr.status = 'EM_PREENCHIMENTO')
                 as pr_em_preenchimento,
               count(*) filter (where pr.status = 'ENVIADA') as pr_enviada,
               count(*) filter (where pr.status = 'COM_PENDENCIA')
                 as pr_com_pendencia,
               count(*) filter (where pr.status = 'VALIDADA') as pr_validada,
               count(*) filter (where m.status = 'CONCLUIDA') as concluidas,
               count(*) filter (where m.status = 'CANCELADA') as canceladas,
               count(*) filter (
                 where m.status = 'CONFIRMADA' and m.data_fim < current_date
               ) as a_encerrar
          from missao_comite m
          -- prestacao_missao_uk garante no maximo uma prestacao por missao,
          -- entao a juncao nao multiplica linha; rodada_analise_aberta_uk faz
          -- o mesmo pela rodada em aberto. Sem essas duas garantias, o count
          -- aqui contaria a mesma missao mais de uma vez.
          left join prestacao_contas_missao pr on pr.missao_id = m.id
          left join rodada_analise ra
            on ra.missao_id = m.id and ra.encerrada_em is null
         where ${escopo}
      `,
    );

    const n = (chave: string) => Number(linha[chave] ?? 0);

    return {
      missoes: n('missoes'),
      analise: {
        aguardando: n('aguardando'),
        paradas: n('paradas'),
        ajustesSolicitados: n('ajustes_solicitados'),
        naoSubmetidas: n('nao_submetidas'),
      },
      aprovacao: {
        RASCUNHO: n('ap_rascunho'),
        EM_ANALISE: n('ap_em_analise'),
        AJUSTES_SOLICITADOS: n('ap_ajustes'),
        APROVADA: n('ap_aprovada'),
        REPROVADA: n('ap_reprovada'),
      },
      realizacao: {
        FUTURA: n('futura'),
        EM_ANDAMENTO: n('em_andamento'),
        ENCERRADA: n('encerrada'),
      },
      prestacao: {
        NAO_INICIADA: n('pr_nao_iniciada'),
        EM_PREENCHIMENTO: n('pr_em_preenchimento'),
        ENVIADA: n('pr_enviada'),
        COM_PENDENCIA: n('pr_com_pendencia'),
        VALIDADA: n('pr_validada'),
      },
      conclusao: {
        concluidas: n('concluidas'),
        canceladas: n('canceladas'),
        aEncerrar: n('a_encerrar'),
      },
    };
  }

  /**
   * Paises, parceiros, convenios e produtos alcancados pelo recorte.
   *
   * Tudo em subconsulta `distinct`, e nunca por juncao: o mesmo pais visitado
   * em tres paradas da mesma missao e um pais.
   *
   * **Parceiro e a instituicao cadastrada**, nao o nome digitado a mao. A
   * atividade aceita `instituicao_nome` livre justamente para o caso em que o
   * parceiro ainda nao existe no cadastro (CG-018); conta-lo aqui inflaria o
   * indicador com texto que ninguem consegue abrir.
   *
   * **Convenio conta pela missao de origem.** O acordo se ancora na
   * instituicao e sobrevive ao ciclo (CG-056); o unico convenio que pertence a
   * este recorte e o que nasceu de uma missao dele.
   */
  private async alcance(escopo: SQL) {
    const [linha] = await consultar<Record<string, string>>(
      this.db,
      sql`
        with recorte as (
          select m.id from missao_comite m where ${escopo}
        )
        select (select count(distinct a.pais_id)
                  from atividade_missao a
                 where a.missao_id in (select id from recorte)
                   and a.pais_id is not null) as paises,
               (select count(distinct a.instituicao_id)
                  from atividade_missao a
                 where a.missao_id in (select id from recorte)
                   and a.instituicao_id is not null) as parceiros,
               (select count(distinct lower(btrim(a.evento_nome)))
                  from atividade_missao a
                 where a.missao_id in (select id from recorte)
                   and btrim(coalesce(a.evento_nome, '')) <> '') as eventos,
               (select count(*)
                  from convenio c
                 where c.missao_origem_id in (select id from recorte)
                   and c.ativo) as convenios,
               (select count(*)
                  from produto_missao p
                 where p.missao_id in (select id from recorte)) as produtos,
               (select sum(d.valor_total)
                  from despesa_missao d
                  join prestacao_contas_missao pc on pc.id = d.prestacao_id
                 where pc.missao_id in (select id from recorte)
                   and pc.status = 'VALIDADA') as despesa_validada,
               (select sum(d.valor_total)
                  from despesa_missao d
                  join prestacao_contas_missao pc on pc.id = d.prestacao_id
                 where pc.missao_id in (select id from recorte)) as despesa_lancada
      `,
    );

    return {
      alcance: {
        paises: Number(linha.paises),
        parceiros: Number(linha.parceiros),
        eventos: Number(linha.eventos),
        convenios: Number(linha.convenios),
        produtos: Number(linha.produtos),
      },
      // Nulo e "nao ha lancamento", e a interface escreve *A definir*; zero
      // seria "lancaram e deu zero". `coalesce(...,0)` cedo demais apagaria a
      // diferenca — a mesma regra da CG-055.
      financeiro: {
        validada: linha.despesa_validada ?? null,
        lancada: linha.despesa_lancada ?? null,
      },
    };
  }

  /**
   * Quebra por pais, ordenada pelo que mais aparece.
   *
   * `count(distinct a.missao_id)`, e nao `count(*)`: a missao com tres paradas
   * no mesmo pais e uma missao naquele pais, e o numero precisa bater com o que
   * a lista mostra ao filtrar por ele.
   */
  private async porPais(escopo: SQL) {
    return (
      await consultar<{
        id: string;
        nome: string;
        codigo_iso2: string;
        missoes: string;
      }>(
        this.db,
        sql`
          select pa.id,
                 pa.nome,
                 pa.codigo_iso2,
                 count(distinct a.missao_id) as missoes
            from atividade_missao a
            join pais pa on pa.id = a.pais_id
           where a.missao_id in (
             select m.id from missao_comite m where ${escopo}
           )
           group by pa.id, pa.nome, pa.codigo_iso2
           order by count(distinct a.missao_id) desc, pa.nome
        `,
      )
    ).map((linha) => ({
      id: linha.id,
      nome: linha.nome,
      codigoIso2: linha.codigo_iso2,
      missoes: Number(linha.missoes),
    }));
  }

  /**
   * Quebra por rede coordenadora.
   *
   * Aqui a soma das linhas **passa** do total de missoes, e isso esta correto:
   * a missao de duas redes pertence as duas. E a mesma razao pela qual o
   * consolidado nao pode ser a soma desta coluna (CG-055).
   *
   * Toda rede do ciclo aparece, inclusive a que nao tem missao: rede ausente da
   * lista seria lida como rede sem dado carregado, e nao como rede sem missao.
   */
  private async porRede(
    cicloId: string,
    escopo: SQL,
    recorte: RecorteDeMissoes,
  ): Promise<ConsolidadoDaRede[]> {
    const linhas = await consultar<Record<string, string | null>>(
      this.db,
      sql`
        with recorte as (
          select m.id from missao_comite m where ${escopo}
        ),
        -- Uma linha por (rede, missao). A missao de duas redes aparece nas
        -- duas de proposito: ela pertence as duas, e e isso que faz a soma da
        -- coluna passar do consolidado. Ver ConsolidadoDaRede, no contrato.
        da_rede as (
          select mr.rede_id, mr.missao_id
            from missao_rede mr
           where mr.missao_id in (select id from recorte)
        )
        select r.id,
               r.nome,
               (select count(*) from da_rede d where d.rede_id = r.id)
                 as missoes,
               -- distinct em toda contagem de alcance: o mesmo pais visitado
               -- em tres paradas e um pais.
               (select count(distinct a.pais_id)
                  from atividade_missao a
                  join da_rede d
                    on d.missao_id = a.missao_id and d.rede_id = r.id
                 where a.pais_id is not null) as paises,
               (select count(distinct a.instituicao_id)
                  from atividade_missao a
                  join da_rede d
                    on d.missao_id = a.missao_id and d.rede_id = r.id
                 where a.instituicao_id is not null) as instituicoes,
               (select count(distinct lower(btrim(a.evento_nome)))
                  from atividade_missao a
                  join da_rede d
                    on d.missao_id = a.missao_id and d.rede_id = r.id
                 where btrim(coalesce(a.evento_nome, '')) <> '') as eventos,
               (select count(*)
                  from convenio c
                  join da_rede d
                    on d.missao_id = c.missao_origem_id and d.rede_id = r.id
                 where c.ativo) as convenios,
               (select count(*)
                  from produto_missao p
                  join da_rede d
                    on d.missao_id = p.missao_id and d.rede_id = r.id)
                 as produtos,
               (select sum(de.valor_total)
                  from despesa_missao de
                  join prestacao_contas_missao pc on pc.id = de.prestacao_id
                  join da_rede d
                    on d.missao_id = pc.missao_id and d.rede_id = r.id
                 where pc.status = 'VALIDADA') as despesa_validada,
               (select sum(de.valor_total)
                  from despesa_missao de
                  join prestacao_contas_missao pc on pc.id = de.prestacao_id
                  join da_rede d
                    on d.missao_id = pc.missao_id and d.rede_id = r.id)
                 as despesa_lancada
          from rede_coordenadora r
         where r.ciclo_id = ${cicloId}
           and ${recorte.sobreRede(sql`r.id`)}
         order by r.nome
      `,
    );

    return linhas.map((linha) => ({
      id: linha.id as string,
      nome: linha.nome as string,
      missoes: Number(linha.missoes),
      paises: Number(linha.paises),
      instituicoes: Number(linha.instituicoes),
      eventos: Number(linha.eventos),
      convenios: Number(linha.convenios),
      produtos: Number(linha.produtos),
      despesaValidada: linha.despesa_validada,
      despesaLancada: linha.despesa_lancada,
    }));
  }

  /**
   * Missoes que esperam por alguem.
   *
   * Uma linha por **missao**, com todos os motivos juntos — e nao uma linha por
   * motivo. Missao devolvida para ajustes com prestacao pendente e um unico
   * trabalho a fazer, e lista-la duas vezes faria o painel prometer mais
   * pendencias do que existem, contradizendo o proprio cartao.
   *
   * Missao cancelada nunca entra: nao ha o que cobrar de uma viagem que a
   * instituicao decidiu nao fazer.
   */
  private async pendencias(escopo: SQL): Promise<PendenciaMissao[]> {
    const linhas = await consultar<{
      id: string;
      codigo: string;
      titulo: string;
      data_inicio: string;
      data_fim: string;
      status: StatusMissao;
      status_aprovacao: StatusAprovacao;
      situacao_prestacao: SituacaoPrestacao;
      redes: string[];
      /** Chega como string: `consultar` executa SQL cru (sem o mapeamento do
          query builder do Drizzle para `timestamptz`). */
      submetido_em: string | null;
      analise_parada: boolean;
      ajustes_solicitados: boolean;
      prestacao_nao_iniciada: boolean;
      prestacao_com_pendencia: boolean;
      prestacao_enviada: boolean;
      encerramento_pendente: boolean;
    }>(
      this.db,
      sql`
        with base as (
          select m.id,
                 m.codigo,
                 m.titulo,
                 m.data_inicio,
                 m.data_fim,
                 m.status,
                 m.status_aprovacao,
                 coalesce(pr.status::text, 'NAO_INICIADA') as situacao_prestacao,
                 ra.submetido_em,
                 coalesce(
                   (select array_agg(r.nome order by r.nome)
                      from missao_rede mr
                      join rede_coordenadora r on r.id = mr.rede_id
                     where mr.missao_id = m.id),
                   '{}'
                 ) as redes,
                 ${ANALISE_PARADA} as analise_parada,
                 m.status_aprovacao = 'AJUSTES_SOLICITADOS'
                   as ajustes_solicitados,
                 -- "Realizada" aqui e a data, nao o status: a viagem que
                 -- terminou ontem ja deve ter prestacao, mesmo que ninguem
                 -- tenha mexido no status da missao desde entao.
                 pr.id is null and m.data_fim < current_date
                   and m.status in ('CONFIRMADA', 'CONCLUIDA')
                   as prestacao_nao_iniciada,
                 pr.status = 'COM_PENDENCIA' as prestacao_com_pendencia,
                 pr.status = 'ENVIADA' as prestacao_enviada,
                 pr.status = 'VALIDADA' and m.status = 'CONFIRMADA'
                   as encerramento_pendente
            from missao_comite m
            left join prestacao_contas_missao pr on pr.missao_id = m.id
            left join rodada_analise ra
              on ra.missao_id = m.id and ra.encerrada_em is null
           where ${escopo}
             and m.status <> 'CANCELADA'
        )
        select * from base
         where analise_parada
            or ajustes_solicitados
            or prestacao_nao_iniciada
            or prestacao_com_pendencia
            or prestacao_enviada
            or encerramento_pendente
         order by data_fim, codigo
      `,
    );

    return linhas.map((linha) => {
      const motivos: MotivoDaPendencia[] = [];
      const incluir = (chave: MotivoPendencia, dias: number | null) =>
        motivos.push({ chave, ...TEXTO_MOTIVO[chave], dias });

      // Dias desde o fim da viagem: e o que o usuario conta de cabeca quando
      // pergunta ha quanto tempo a prestacao esta atrasada.
      const desdeOFim = diasDesde(new Date(`${linha.data_fim}T12:00:00Z`));

      if (linha.analise_parada) {
        incluir(
          'ANALISE_PARADA',
          linha.submetido_em ? diasDesde(new Date(linha.submetido_em)) : null,
        );
      }
      if (linha.ajustes_solicitados) incluir('AJUSTES_SOLICITADOS', null);
      if (linha.prestacao_nao_iniciada) {
        incluir('PRESTACAO_NAO_INICIADA', desdeOFim);
      }
      if (linha.prestacao_com_pendencia) {
        incluir('PRESTACAO_COM_PENDENCIA', null);
      }
      if (linha.prestacao_enviada) incluir('PRESTACAO_ENVIADA', null);
      if (linha.encerramento_pendente) {
        incluir('ENCERRAMENTO_PENDENTE', desdeOFim);
      }

      return {
        missaoId: linha.id,
        codigo: linha.codigo,
        titulo: linha.titulo,
        dataInicio: linha.data_inicio,
        dataFim: linha.data_fim,
        status: linha.status,
        statusAprovacao: linha.status_aprovacao,
        situacaoPrestacao: linha.situacao_prestacao,
        redes: linha.redes,
        motivos,
      };
    });
  }

  /**
   * Nome da rede do recorte, para a tela dizer de que universo esta falando.
   *
   * Rede fora do alcance do usuario e tratada como rede inexistente — cai em
   * "todas", como a de outro ciclo. Devolver o nome confirmaria a existencia
   * de uma rede que a pessoa nao pode enxergar, e o painel passaria a exibir
   * um recorte rotulado com ela e vazio por dentro.
   */
  private async nomeDaRede(
    cicloId: string,
    redeId: string | undefined,
    recorte: RecorteDeMissoes,
  ): Promise<string | null> {
    if (!redeId || !recorte.alcanca(redeId)) return null;
    const [linha] = await consultar<{ nome: string }>(
      this.db,
      sql`
        select nome from rede_coordenadora
         where id = ${redeId} and ciclo_id = ${cicloId}
      `,
    );
    return linha?.nome ?? null;
  }
}
