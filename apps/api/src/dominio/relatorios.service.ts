import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import { RecorteDeMissoes } from '../auth/escopo';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  filtroMissoesSchema,
  MissoesComiteService,
  type FiltroMissoes,
} from './missoes-comite.service';
import { somarOuNulo } from './orcamento.service';

/**
 * Relatorios estrategicos do Comite Gestor (CG-068).
 *
 * **O criterio de aceite e uma proibicao:** o total do relatorio tem que
 * reproduzir a consulta de origem para o mesmo filtro. A unica forma de
 * garantir isso e nao ter uma segunda origem — por isso o filtro aqui **e** o
 * filtro da lista de missoes (`filtroMissoesSchema`), sem tradução no meio, e o
 * relatorio de missoes chama `MissoesComiteService.listar` em vez de repetir o
 * SQL dela. Um filtro proprio, ainda que escrito para dar o mesmo resultado,
 * divergiria na primeira mudanca de um dos dois lados, e a divergencia so
 * apareceria quando alguem comparasse os dois numeros.
 *
 * Os outros tres relatorios partem da **mesma base de missoes** — o conjunto de
 * ids que aquele filtro seleciona — e agregam sobre ela. Assim "parceiros do
 * relatorio" e "parceiros visitados pelas missoes que a lista mostra" sao a
 * mesma coisa por construcao.
 *
 * **Nada e agregado persistido.** Tudo sai de consulta, a cada leitura. Um
 * total guardado envelheceria no dia em que uma prestacao fosse devolvida.
 *
 * **Dinheiro continua string decimal** ate a apresentacao, como no resto do
 * sistema: `numeric` do Postgres chega como texto justamente para nao perder
 * precisao, e converter aqui para formatar depois reintroduziria o erro.
 */

/**
 * Filtro dos relatorios: exatamente o da lista, menos o que e de paginacao.
 *
 * `omit` em vez de um objeto novo, para que um filtro acrescentado a lista
 * apareca aqui sozinho. Paginacao e ordenacao saem porque relatorio nao pagina
 * — ele responde sobre o recorte inteiro, e um total de pagina seria mentira.
 */
export const filtroRelatorioSchema = filtroMissoesSchema.omit({
  pagina: true,
  tamanho: true,
  ordenar: true,
  direcao: true,
});
export type FiltroRelatorio = z.infer<typeof filtroRelatorioSchema>;

/** Teto de linhas de qualquer relatorio; ver `AVISO_TETO`. */
export const TETO_DE_LINHAS = 1000;

export interface CabecalhoRelatorio {
  /** O recorte aplicado, devolvido para o consumidor poder reproduzi-lo. */
  filtro: FiltroRelatorio;
  /** Missoes distintas no recorte — a base de tudo o que vem abaixo. */
  missoes: number;
  geradoEm: string;
  aviso: string;
  /** Verdadeiro quando o recorte passou de `TETO_DE_LINHAS`. */
  truncado: boolean;
}

export interface LinhaRelatorioMissao {
  id: string;
  codigo: string;
  titulo: string;
  dataInicio: string;
  dataFim: string;
  status: string;
  statusAprovacao: string;
  situacaoPrestacao: string;
  redes: string[];
  paises: string[];
  participantes: number;
  atividades: number;
  valorPrestado: string | null;
}

export interface RelatorioMissoes {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaRelatorioMissao[];
  totais: {
    missoes: number;
    /** Soma do lancado, em qualquer estado. Nao e o que abate o aporte. */
    valorPrestado: string | null;
    porStatus: Record<string, number>;
    porAprovacao: Record<string, number>;
    porPrestacao: Record<string, number>;
  };
}

export interface LinhaRelatorioParceiro {
  id: string;
  nome: string;
  sigla: string | null;
  pais: string | null;
  cidade: string | null;
  missoes: number;
  atividades: number;
  convenios: number;
  produtos: number;
}

export interface RelatorioParceiros {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaRelatorioParceiro[];
  totais: {
    parceiros: number;
    /** Paradas em instituicao ainda nao cadastrada; ver `AVISO_PARCEIRO`. */
    semCadastro: number;
    convenios: number;
  };
}

export interface LinhaRelatorioFinanceiro {
  exercicio: number;
  tipo: string;
  emPreenchimento: string | null;
  comPendencia: string | null;
  enviado: string | null;
  validado: string | null;
  total: string | null;
}

export interface RelatorioFinancas {
  cabecalho: CabecalhoRelatorio;
  linhas: LinhaRelatorioFinanceiro[];
  totais: {
    emPreenchimento: string | null;
    comPendencia: string | null;
    enviado: string | null;
    /** A unica coluna que abate o aporte (CG-009). */
    validado: string | null;
    total: string | null;
  };
}

export interface LinhaRelatorioResultado {
  tipo: string;
  situacao: string;
  quantidade: number;
  missoes: number;
}

export interface RelatorioResultados {
  cabecalho: CabecalhoRelatorio;
  produtos: LinhaRelatorioResultado[];
  convenios: LinhaRelatorioResultado[];
  totais: {
    produtos: number;
    convenios: number;
    /** Missoes que declararam nao ter gerado produto (CG-056). */
    semProdutoDeclarado: number;
    /** Nem produto nem declaracao: ninguem respondeu ainda. */
    semResposta: number;
  };
}

const AVISO =
  'Todos os números são apurados na consulta, a cada leitura — não há total ' +
  'guardado. O recorte é o mesmo da lista de missões: o mesmo filtro produz ' +
  'as mesmas missões nos dois lugares.';

/**
 * Parada com instituicao digitada a mao nao vira parceiro.
 *
 * A atividade aceita `instituicao_nome` livre para o caso em que o parceiro
 * ainda nao existe no cadastro (CG-018). Contar esse texto como parceiro
 * inflaria o relatorio com algo que ninguem consegue abrir — mas **esconder que
 * ele existe seria pior**, porque o numero pareceria completo. Por isso ele sai
 * como contagem propria, e nao como linha.
 */
const AVISO_PARCEIRO =
  'Parceiros são as instituições cadastradas. Paradas com instituição ' +
  'digitada à mão aparecem em "sem cadastro" e são candidatas a cadastro.';

/**
 * Por que o relatorio tem teto.
 *
 * A exportacao da CG-069 e sincrona, decidida assim para o servidor
 * on-premise: uma consulta sem limite ocupa um worker do Node e o resto da
 * aplicacao sente. O teto avisa em vez de cortar em silencio — mesma decisao da
 * lista de parceiros.
 */
const AVISO_TETO =
  'O recorte passou do limite de linhas e foi cortado. Reduza o período ou ' +
  'escolha uma rede para ver o relatório completo.';

/**
 * Completa o filtro do relatorio com o que so a listagem precisa.
 *
 * Montado por tipo, e nao reparseado pelo schema da lista, por causa do teto:
 * `tamanho` para no maximo 100 la, e esse limite protege a **tabela do
 * browser** — nao tem nada a dizer sobre quantas linhas um relatorio pode
 * apurar. O relatorio tem teto proprio (`TETO_DE_LINHAS`), decidido pelo custo
 * da exportacao sincrona da CG-069.
 *
 * A validacao nao se perde: o filtro ja passou por `filtroRelatorioSchema`, que
 * e o mesmo schema menos os quatro campos de paginacao.
 */
function paraFiltroDeLista(
  filtro: FiltroRelatorio,
  tamanho = 1,
): FiltroMissoes {
  return {
    ...filtro,
    pagina: 1,
    tamanho,
    ordenar: 'PERIODO',
    direcao: 'DESC',
  };
}

@Injectable()
export class RelatoriosService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly missoes: MissoesComiteService,
  ) {}

  /**
   * Relatorio de missoes.
   *
   * Delega a `listar` de proposito. E a unica forma honesta de garantir que o
   * total do relatorio e o total da lista: nao ha dois numeros, ha um so,
   * apurado uma vez.
   */
  async missoesDoRecorte(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<RelatorioMissoes> {
    const pagina = await this.missoes.listar(
      cicloId,
      paraFiltroDeLista(filtro, TETO_DE_LINHAS),
      recorte,
    );

    return {
      cabecalho: this.cabecalho(filtro, pagina.total, pagina.itens.length),
      linhas: pagina.itens.map((item) => ({
        id: item.id,
        codigo: item.codigo,
        titulo: item.titulo,
        dataInicio: item.dataInicio,
        dataFim: item.dataFim,
        status: item.status,
        statusAprovacao: item.statusAprovacao,
        situacaoPrestacao: item.situacaoPrestacao,
        redes: item.redes,
        paises: item.paises,
        participantes: item.participantes,
        atividades: item.atividades,
        valorPrestado: item.valorPrestado,
      })),
      totais: {
        // `pagina.total` e o `count(*) over ()` da consulta filtrada, entao
        // nao muda com o tamanho da pagina nem com o teto. **Nao** e
        // `resumo.total`: o resumo da lista responde so ao escopo, de proposito
        // — ele conta *por* status e por situacao temporal, e filtrar por eles
        // antes de contar zeraria as outras faixas. Num relatorio o status faz
        // parte do recorte, entao a contagem certa e a da consulta filtrada.
        missoes: pagina.total,
        valorPrestado: somarOuNulo(
          pagina.itens.map((item) => item.valorPrestado),
        ),
        // As tres quebras saem do mesmo recorte completo, pela mesma razao.
        porStatus: await this.contarPor(
          cicloId,
          filtro,
          recorte,
          sql`m.status`,
        ),
        porAprovacao: await this.contarPor(
          cicloId,
          filtro,
          recorte,
          sql`m.status_aprovacao`,
        ),
        porPrestacao: await this.contarPor(
          cicloId,
          filtro,
          recorte,
          sql`coalesce(pr.status::text, 'NAO_INICIADA')`,
        ),
      },
    };
  }

  /**
   * Relatorio de parceiros alcancados pelas missoes do recorte.
   *
   * `count(distinct)` em toda coluna: o parceiro visitado em duas paradas da
   * mesma missao foi visitado por **uma** missao, e a missao de duas redes
   * continua sendo uma.
   */
  async parceirosDoRecorte(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<RelatorioParceiros> {
    const base = this.baseDeMissoes(cicloId, filtro, recorte);

    const linhas = await consultar<{
      id: string;
      nome: string;
      sigla: string | null;
      pais: string | null;
      cidade: string | null;
      missoes: string;
      atividades: string;
      convenios: string;
      produtos: string;
    }>(
      this.db,
      sql`
        with recorte as (${base}),
        paradas as (
          select a.instituicao_id, a.missao_id, a.id as atividade_id
            from atividade_missao a
           where a.missao_id in (select id from recorte)
             and a.instituicao_id is not null
        )
        select i.id,
               i.nome,
               i.sigla,
               pa.nome as pais,
               i.cidade,
               count(distinct p.missao_id) as missoes,
               count(distinct p.atividade_id) as atividades,
               (select count(*) from convenio c
                 where c.instituicao_id = i.id
                   and c.ativo
                   and c.missao_origem_id in (select id from recorte))
                 as convenios,
               (select count(*)
                  from produto_missao pm
                  join convenio c2 on c2.id = pm.convenio_id
                 where c2.instituicao_id = i.id
                   and pm.missao_id in (select id from recorte)) as produtos
          from paradas p
          join instituicao i on i.id = p.instituicao_id
          left join pais pa on pa.id = i.pais_id
         group by i.id, i.nome, i.sigla, pa.nome, i.cidade
         order by count(distinct p.missao_id) desc, i.nome
         limit ${TETO_DE_LINHAS}
      `,
    );

    const [resumo] = await consultar<{
      parceiros: string;
      sem_cadastro: string;
      convenios: string;
      missoes: string;
    }>(
      this.db,
      sql`
        with recorte as (${base})
        select (select count(distinct a.instituicao_id)
                  from atividade_missao a
                 where a.missao_id in (select id from recorte)
                   and a.instituicao_id is not null) as parceiros,
               -- Nome livre e candidato a cadastro, nao parceiro. Escondê-lo
               -- faria o numero de parceiros parecer completo.
               (select count(distinct lower(btrim(a.instituicao_nome)))
                  from atividade_missao a
                 where a.missao_id in (select id from recorte)
                   and btrim(coalesce(a.instituicao_nome, '')) <> '')
                 as sem_cadastro,
               (select count(*) from convenio c
                 where c.ativo
                   and c.missao_origem_id in (select id from recorte))
                 as convenios,
               (select count(*) from recorte) as missoes
      `,
    );

    return {
      cabecalho: this.cabecalho(filtro, Number(resumo.missoes), linhas.length),
      linhas: linhas.map((linha) => ({
        id: linha.id,
        nome: linha.nome,
        sigla: linha.sigla,
        pais: linha.pais,
        cidade: linha.cidade,
        missoes: Number(linha.missoes),
        atividades: Number(linha.atividades),
        convenios: Number(linha.convenios),
        produtos: Number(linha.produtos),
      })),
      totais: {
        parceiros: Number(resumo.parceiros),
        semCadastro: Number(resumo.sem_cadastro),
        convenios: Number(resumo.convenios),
      },
    };
  }

  /**
   * Relatorio financeiro: despesa por exercicio e tipo.
   *
   * Os quatro estados da prestacao ocupam colunas separadas pela mesma razao da
   * CG-055: **so a validada abate o aporte**, e uma coluna unica "executado"
   * obrigaria a escolher entre esconder o que ainda nao vale e fazer parecer
   * que ja vale.
   *
   * Agrupa por `despesa.exercicio`, e nao pelas datas da missao — o ano ao qual
   * o lancamento foi imputado. Mesmo criterio da execucao orcamentaria; um
   * criterio diferente aqui faria o mesmo gasto aparecer em dois anos conforme
   * a tela.
   */
  async financasDoRecorte(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<RelatorioFinancas> {
    const base = this.baseDeMissoes(cicloId, filtro, recorte);

    const linhas = await consultar<{
      exercicio: number;
      tipo: string;
      em_preenchimento: string | null;
      com_pendencia: string | null;
      enviado: string | null;
      validado: string | null;
      total: string | null;
    }>(
      this.db,
      sql`
        with recorte as (${base})
        select d.exercicio,
               d.tipo::text as tipo,
               sum(d.valor_total) filter (
                 where p.status = 'EM_PREENCHIMENTO') as em_preenchimento,
               sum(d.valor_total) filter (
                 where p.status = 'COM_PENDENCIA') as com_pendencia,
               sum(d.valor_total) filter (where p.status = 'ENVIADA')
                 as enviado,
               sum(d.valor_total) filter (where p.status = 'VALIDADA')
                 as validado,
               sum(d.valor_total) as total
          from despesa_missao d
          join prestacao_contas_missao p on p.id = d.prestacao_id
         where p.missao_id in (select id from recorte)
         group by d.exercicio, d.tipo
         order by d.exercicio, d.tipo
      `,
    );

    const coluna = (campo: keyof (typeof linhas)[number]) =>
      somarOuNulo(linhas.map((linha) => linha[campo] as string | null));

    const [contagem] = await consultar<{ missoes: string }>(
      this.db,
      sql`with recorte as (${base}) select count(*) as missoes from recorte`,
    );

    return {
      cabecalho: this.cabecalho(
        filtro,
        Number(contagem.missoes),
        linhas.length,
      ),
      linhas: linhas.map((linha) => ({
        exercicio: linha.exercicio,
        tipo: linha.tipo,
        emPreenchimento: linha.em_preenchimento,
        comPendencia: linha.com_pendencia,
        enviado: linha.enviado,
        validado: linha.validado,
        total: linha.total,
      })),
      // A soma das linhas vale aqui, e nao valia na CG-067: cada despesa
      // pertence a um unico par (exercicio, tipo), entao nao ha o que contar
      // duas vezes.
      totais: {
        emPreenchimento: coluna('em_preenchimento'),
        comPendencia: coluna('com_pendencia'),
        enviado: coluna('enviado'),
        validado: coluna('validado'),
        total: coluna('total'),
      },
    };
  }

  /** Relatorio de resultados: produtos e convenios das missoes do recorte. */
  async resultadosDoRecorte(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): Promise<RelatorioResultados> {
    const base = this.baseDeMissoes(cicloId, filtro, recorte);

    const produtos = await consultar<{
      tipo: string;
      situacao: string;
      quantidade: string;
      missoes: string;
    }>(
      this.db,
      sql`
        with recorte as (${base})
        select p.tipo::text as tipo,
               p.situacao::text as situacao,
               count(*) as quantidade,
               count(distinct p.missao_id) as missoes
          from produto_missao p
         where p.missao_id in (select id from recorte)
         group by p.tipo, p.situacao
         order by count(*) desc, p.tipo
      `,
    );

    const convenios = await consultar<{
      tipo: string;
      situacao: string;
      quantidade: string;
      missoes: string;
    }>(
      this.db,
      sql`
        with recorte as (${base})
        select c.tipo_acordo::text as tipo,
               c.situacao::text as situacao,
               count(*) as quantidade,
               count(distinct c.missao_origem_id) as missoes
          from convenio c
         where c.ativo and c.missao_origem_id in (select id from recorte)
         group by c.tipo_acordo, c.situacao
         order by count(*) desc, c.tipo_acordo
      `,
    );

    const [resposta] = await consultar<{
      missoes: string;
      sem_produto: string;
      sem_resposta: string;
    }>(
      this.db,
      sql`
        with recorte as (${base})
        select count(*) as missoes,
               -- Declaracao negativa explicita (CG-056): "nao gerou produto".
               count(*) filter (
                 where m.sem_produto_declarado_em is not null) as sem_produto,
               -- Nem produto nem declaracao. Zero produto significa tanto "nao
               -- gerou" quanto "ninguem respondeu", e so a segunda e pendencia.
               count(*) filter (
                 where m.sem_produto_declarado_em is null
                   and not exists (
                     select 1 from produto_missao p where p.missao_id = m.id
                   )) as sem_resposta
          from missao_comite m
         where m.id in (select id from recorte)
      `,
    );

    const somar = (linhas: { quantidade: string }[]) =>
      linhas.reduce((total, linha) => total + Number(linha.quantidade), 0);

    return {
      cabecalho: this.cabecalho(
        filtro,
        Number(resposta.missoes),
        produtos.length + convenios.length,
      ),
      produtos: produtos.map(linhaDeResultado),
      convenios: convenios.map(linhaDeResultado),
      totais: {
        produtos: somar(produtos),
        convenios: somar(convenios),
        semProdutoDeclarado: Number(resposta.sem_produto),
        semResposta: Number(resposta.sem_resposta),
      },
    };
  }

  // -------------------------------------------------------------------------

  /**
   * Os ids das missoes do recorte, como fragmento reaproveitavel.
   *
   * Vem de `MissoesComiteService.condicaoDoRecorte`, que e a **mesma** funcao
   * que monta o `where` da lista. Reescrever as condicoes aqui daria o mesmo
   * resultado hoje e outro na primeira vez que um filtro mudasse de um dos
   * lados — e o relatorio erraria em silencio, porque ninguem compara os dois
   * numeros por conta propria.
   */
  private baseDeMissoes(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
  ): SQL {
    return this.missoes.condicaoDoRecorte(
      cicloId,
      paraFiltroDeLista(filtro),
      recorte,
    );
  }

  private async contarPor(
    cicloId: string,
    filtro: FiltroRelatorio,
    recorte: RecorteDeMissoes,
    coluna: SQL,
  ): Promise<Record<string, number>> {
    const base = this.baseDeMissoes(cicloId, filtro, recorte);
    const linhas = await consultar<{ chave: string; total: string }>(
      this.db,
      sql`
        with recorte as (${base})
        select ${coluna} as chave, count(*) as total
          from missao_comite m
          left join prestacao_contas_missao pr on pr.missao_id = m.id
         where m.id in (select id from recorte)
         group by ${coluna}
      `,
    );
    return Object.fromEntries(
      linhas.map((linha) => [linha.chave, Number(linha.total)]),
    );
  }

  private cabecalho(
    filtro: FiltroRelatorio,
    missoes: number,
    linhas: number,
  ): CabecalhoRelatorio {
    const truncado = linhas >= TETO_DE_LINHAS;
    return {
      filtro,
      missoes,
      geradoEm: new Date().toISOString(),
      aviso: truncado ? `${AVISO} ${AVISO_TETO}` : `${AVISO} ${AVISO_PARCEIRO}`,
      truncado,
    };
  }
}

/** Funcao de modulo, e nao metodo: ela e passada por referencia ao `map`. */
function linhaDeResultado(linha: {
  tipo: string;
  situacao: string;
  quantidade: string;
  missoes: string;
}): LinhaRelatorioResultado {
  return {
    tipo: linha.tipo,
    situacao: linha.situacao,
    quantidade: Number(linha.quantidade),
    missoes: Number(linha.missoes),
  };
}
