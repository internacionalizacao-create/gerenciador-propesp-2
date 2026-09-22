import { Inject, Injectable } from '@nestjs/common';
import { sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
import {
  condicaoDaBolsa,
  condicaoDaMissao,
} from '../auth/autorizacao-v1/recorte-bolsa';
import { IdentidadeService } from '../auth/identidade.service';
import { consultar, consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';

/**
 * P02 · Panorama de mobilidade (BOL-040).
 *
 * Visao consolidada das concessoes, atravessando programas e ciclos. E a
 * primeira tela que responde "o que a internacionalizacao produziu?" em vez de
 * "o plano cabe no orcamento?", que e o que a P01 responde.
 *
 * **Um filtro so, montado uma vez.** Cartoes, quebras e serie recebem o mesmo
 * objeto `SQL`, e nao cada um a sua condicao: dois SQL que respondem a mesma
 * pergunta divergem na primeira mudanca, e quem clicasse de um cartao para a
 * quebra encontraria outra contagem do lado de la. E a licao que a CG-066
 * registrou, aplicada aqui de saida.
 *
 * **O recorte por PPG entra no mesmo objeto** (BOL-020), entao nenhuma quebra
 * pode esquece-lo: a garantia e por construcao, nao por disciplina de quem
 * escrever a proxima consulta.
 */

export const filtroMobilidadeSchema = z.object({
  ano: z.coerce.number().int().min(2000).max(2100).optional(),
  fluxo: z.enum(['IN', 'OUT']).optional(),
  modalidadeId: z.uuid().optional(),
  nivel: z
    .enum(['MESTRADO', 'DOUTORADO', 'POS_DOC', 'DOCENTE', 'MOBILIDADE_BREVE'])
    .optional(),
  paisId: z.uuid().optional(),
  instituicaoId: z.uuid().optional(),
  ppgId: z.uuid().optional(),
  redeId: z.uuid().optional(),
  programaId: z.uuid().optional(),
  cicloId: z.uuid().optional(),
  status: z
    .enum([
      'SELECIONADO',
      'EM_ANDAMENTO',
      'CONCLUIDA',
      'CANCELADA',
      'INTERROMPIDA',
    ])
    .optional(),
});
export type FiltroMobilidade = z.infer<typeof filtroMobilidadeSchema>;

export interface LinhaContagem {
  chave: string;
  rotulo: string;
  quantidade: number;
  entrada: number;
  saida: number;
  valor: string;
}

/**
 * Consolidado por rede (BOL-043).
 *
 * Metodo proprio em vez de mais colunas em `quebra`: as outras sete quebras
 * respondem "quantas e quanto", e esta responde tambem "com quantos parceiros
 * e com que resultado". Espremer isso na forma generica obrigaria as sete a
 * carregarem colunas que nao usam.
 */
export interface LinhaRede {
  chave: string;
  rotulo: string;
  quantidade: number;
  entrada: number;
  saida: number;
  valor: string;
  paises: number;
  instituicoes: number;
  ppgs: number;
  produtos: number | null;
}

/**
 * Pais de destino, com o codigo que o mapa entende (BOL-042).
 *
 * `codigoNumerico` e o da ISO 3166-1, e nao a sigla: o topojson identifica pais
 * por numero. Casar por nome em ingles falharia em silencio — o arquivo escreve
 * "W. Sahara" onde o ICU escreve "Western Sahara", e o pais ficaria sem cor sem
 * ninguem notar.
 */
export interface LinhaPais extends LinhaContagem {
  codigoNumerico: string | null;
  codigoIso2: string | null;
}

export interface LinhaAno {
  ano: number;
  entrada: number;
  saida: number;
  total: number;
  valor: string;
}

/**
 * Producao consolidada dos dois dominios (BOL-051).
 *
 * **As tabelas continuam separadas** — a decisao da CG-056 nao muda: produto de
 * bolsa e cobranca sobre o beneficiario, produto de missao e resultado
 * institucional da viagem. O que se junta e a **leitura**, com `origem`
 * marcando de onde cada linha veio, para que "o que o programa produziu"
 * tenha resposta sem que as duas cobrancas virem uma so.
 *
 * Fundir as tabelas deixaria metade das colunas nula em cada linha e faria toda
 * consulta de P03 filtrar por uma origem que ela nunca precisou conhecer.
 */
export interface LinhaProducao {
  id: string;
  origem: 'BOLSA' | 'MISSAO';
  tipo: string;
  titulo: string;
  situacao: string;
  ano: number | null;
  /** Bolsista, no produto de bolsa; codigo da missao, no de missao. */
  contexto: string;
  referencia: string | null;
  /** So o produto de bolsa registra com quem foi feito. */
  instituicaoColaboracao: string | null;
  paisColaboracao: string | null;
}

/** Uma concessao no relatorio exportavel (BOL-044). */
export interface LinhaRelatorioMobilidade {
  bolsista: string;
  cpf: string | null;
  orcid: string;
  ppg: string;
  programa: string;
  ciclo: string;
  rede: string;
  areaTematica: string;
  modalidade: string;
  nivel: string;
  fluxo: string;
  paisDestino: string;
  instituicaoDestino: string;
  dataInicio: string;
  dataFim: string;
  status: string;
  valor: string;
  produtos: number | null;
}

export interface PanoramaMobilidade {
  totais: {
    mobilidades: number;
    entrada: number;
    saida: number;
    paises: number;
    ppgs: number;
    instituicoes: number;
    valor: string;
    /** Concessoes cuja instituicao de destino e texto livre, sem cadastro. */
    semInstituicaoCadastrada: number;
  };
  porAno: LinhaAno[];
  porModalidade: LinhaContagem[];
  porNivel: LinhaContagem[];
  porRede: LinhaRede[];
  porPais: LinhaPais[];
  porInstituicao: LinhaContagem[];
  porPpg: LinhaContagem[];
  /**
   * Avisos que viajam junto com o numero.
   *
   * Pais e instituicao so contam o que esta ligado ao cadastro central desde a
   * BOL-010; concessao anterior a ela, ou com destino digitado a mao, entra em
   * `semInstituicaoCadastrada` e fica fora da quebra. Esconder isso faria a
   * soma das linhas parecer o total.
   */
  avisos: string[];
}

/** Teto das quebras longas. Pais e instituicao podem ter cauda longa. */
const TETO_QUEBRA = 25;

/**
 * Chave de agrupamento do destino: a FK quando a concessao foi reconhecida no
 * cadastro central, o texto normalizado quando foi digitada. Desde 2026-09-11
 * o destino e digitado, e deixar o texto de fora esvaziaria as quebras.
 * Caixa e espacos se unem; grafias diferentes continuam separadas, porque
 * uni-las seria adivinhar.
 */
const CHAVE_PAIS = sql.raw(
  `coalesce(bc.pais_destino_id::text, 'texto:' || lower(trim(bc.pais_destino_nome)))`,
);
const CHAVE_INSTITUICAO = sql.raw(
  `coalesce(bc.instituicao_destino_id::text, 'texto:' || lower(trim(bc.instituicao_destino_nome)))`,
);

/**
 * Teto de linhas do relatorio (BOL-044).
 *
 * Nao e o mesmo teto das quebras: aquele protege a leitura de uma tabela na
 * tela, este protege a planilha e o PDF gerados de uma vez, sincronamente.
 */
export const TETO_RELATORIO = 5_000;

@Injectable()
export class MobilidadeService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
  ) {}

  async panorama(
    usuario: AuthUser,
    filtro: FiltroMobilidade,
    resolvido?: AcessoResolvido,
  ): Promise<PanoramaMobilidade> {
    const acesso = resolvido ?? (await this.identidade.acessoDe(usuario));
    const onde = this.condicao(
      filtro,
      condicaoDaBolsa(acesso.alcance('bolsa:read')),
    );

    const [
      totais,
      porAno,
      porModalidade,
      porNivel,
      porRede,
      porPais,
      porInstituicao,
      porPpg,
    ] = await Promise.all([
      this.totais(onde),
      this.porAno(onde),
      this.quebra(
        onde,
        sql`m.id::text`,
        sql`m.nome`,
        sql`join modalidade m on m.id = bc.modalidade_id`,
      ),
      this.quebra(
        onde,
        sql`bc.nivel_beneficiario::text`,
        sql`bc.nivel_beneficiario::text`,
        sql``,
      ),
      this.porRede(onde, condicaoDaBolsa(acesso.alcance('produto:read'))),
      this.porPais(onde),
      this.quebra(
        onde,
        CHAVE_INSTITUICAO,
        sql`coalesce(ind.nome, trim(bc.instituicao_destino_nome))`,
        sql`left join instituicao ind on ind.id = bc.instituicao_destino_id`,
      ),
      this.quebra(
        onde,
        sql`pg.id::text`,
        sql`pg.sigla`,
        sql`join ppg pg on pg.id = bc.ppg_id`,
      ),
    ]);

    // O destino digitado entra nas quebras desde 2026-09-11, e o aviso que
    // explicava a ausencia dele deixou de ser verdade.
    const avisos: string[] = [];

    return {
      totais,
      porAno,
      porModalidade,
      porNivel,
      porRede,
      porPais,
      porInstituicao,
      porPpg,
      avisos,
    };
  }

  /**
   * Linhas do relatorio de mobilidade (BOL-044).
   *
   * **Mesmo filtro e mesmo recorte do panorama**, pela funcao `condicao` — nao
   * ha uma segunda origem. E a regra que a CG-068 verificou por mutacao: o
   * relatorio que apura por caminho proprio diverge da tela na primeira
   * mudanca, e quem confere os dois nao sabe qual acreditar.
   *
   * O teto protege a planilha e o PDF, nao o banco: acima disso o pedido nao e
   * um relatorio, e a tela avisa em vez de cortar em silencio.
   */
  async relatorio(
    usuario: AuthUser,
    filtro: FiltroMobilidade,
    resolvido?: AcessoResolvido,
  ): Promise<LinhaRelatorioMobilidade[]> {
    const acesso = resolvido ?? (await this.identidade.acessoDe(usuario));
    const onde = this.condicao(
      filtro,
      sql`(${condicaoDaBolsa(acesso.alcance('bolsa:read'))}
      and ${condicaoDaBolsa(acesso.alcance('bolsa:export'))})`,
    );

    return consultar<LinhaRelatorioMobilidade>(
      this.db,
      sql`
      select pe.nome                                as "bolsista",
             case when ${condicaoDaBolsa(acesso.alcance('pessoa:read-cpf'))} then pe.cpf end as "cpf",
             coalesce(pe.orcid, '')                 as "orcid",
             pg.sigla                               as "ppg",
             prog.nome                              as "programa",
             c.nome                                 as "ciclo",
             coalesce(rc.nome, '')                  as "rede",
             coalesce(at.codigo, '')                as "areaTematica",
             m.nome                                 as "modalidade",
             bc.nivel_beneficiario::text            as "nivel",
             bc.fluxo::text                         as "fluxo",
             coalesce(pd.nome, bc.pais_destino_nome, '')          as "paisDestino",
             coalesce(ind.nome, bc.instituicao_destino_nome, '')  as "instituicaoDestino",
             bc.data_inicio                         as "dataInicio",
             bc.data_fim                            as "dataFim",
             bc.status::text                        as "status",
             bc.valor_concedido                     as "valor",
             case when ${condicaoDaBolsa(acesso.alcance('produto:read'))} then coalesce(pr.total, 0)::int end as "produtos"
        from bolsa_concedida bc
        join pessoa pe          on pe.id = bc.pessoa_id
        join ppg pg             on pg.id = bc.ppg_id
        join programa prog      on prog.id = bc.programa_id
        join ciclo c            on c.id = bc.ciclo_id
        join modalidade m       on m.id = bc.modalidade_id
        left join item_planejado ip on ip.id = bc.item_planejado_id
        left join area_tematica at  on at.id = coalesce(bc.area_tematica_id, ip.area_tematica_id)
        left join rede_coordenadora rc on rc.id = at.rede_id
        left join pais pd           on pd.id = bc.pais_destino_id
        left join instituicao ind   on ind.id = bc.instituicao_destino_id
        left join (
          select bolsa_concedida_id, count(*)::int as total
            from produto_bolsa group by bolsa_concedida_id
        ) pr on pr.bolsa_concedida_id = bc.id
       where ${onde}
       order by bc.data_inicio, pe.nome
       limit ${TETO_RELATORIO}
    `,
    );
  }

  /**
   * Producao consolidada (BOL-051).
   *
   * **`union all` entre duas consultas, e nao um `join`**: as duas tabelas nao
   * se relacionam, e nao ha chave que as ligue — o que existe e a pergunta
   * comum. O recorte por PPG vale para o produto de bolsa; o de missao nao tem
   * PPG e responde ao recorte por rede, que este metodo nao aplica, entao ele
   * so aparece para quem tem `missao:read` — a rota exige as duas permissoes.
   */
  async producao(
    usuario: AuthUser,
    resolvido?: AcessoResolvido,
  ): Promise<LinhaProducao[]> {
    const acesso = resolvido ?? (await this.identidade.acessoDe(usuario));
    const recorte = sql`(${condicaoDaBolsa(acesso.alcance('bolsa:read'))}
      and ${condicaoDaBolsa(acesso.alcance('produto:read'))})`;
    const recorteMissao = sql`(${condicaoDaMissao(acesso.alcance('missao:read'))}
      and ${condicaoDaMissao(acesso.alcance('produto-missao:read'))})`;

    return consultar<LinhaProducao>(
      this.db,
      sql`
      select pb.id::text                as "id",
             'BOLSA'                    as "origem",
             pb.tipo::text              as "tipo",
             pb.titulo                  as "titulo",
             pb.status::text            as "situacao",
             extract(year from coalesce(pb.data_entrega, pb.prazo_entrega))::int
                                        as "ano",
             pe.nome                    as "contexto",
             coalesce(pb.doi, pb.link)  as "referencia",
             pb.instituicao_colaboracao as "instituicaoColaboracao",
             pb.pais_colaboracao        as "paisColaboracao"
        from produto_bolsa pb
        join bolsa_concedida bc on bc.id = pb.bolsa_concedida_id
        join pessoa pe          on pe.id = bc.pessoa_id
       where ${recorte}

      union all

      select pm.id::text                as "id",
             'MISSAO'                   as "origem",
             pm.tipo::text              as "tipo",
             pm.titulo                  as "titulo",
             pm.situacao::text          as "situacao",
             pm.ano                     as "ano",
             mc.codigo                  as "contexto",
             pm.referencia              as "referencia",
             null::text                 as "instituicaoColaboracao",
             null::text                 as "paisColaboracao"
        from produto_missao pm
        join missao_comite mc on mc.id = pm.missao_id
       where ${recorteMissao}

       order by "ano" desc nulls last, "titulo"
    `,
    );
  }

  // ------------------------------------------------------------------ //

  /**
   * O `where` inteiro, incluindo o recorte, num objeto so.
   *
   * `item_planejado` entra por `left join` em toda consulta que precisa de
   * rede: `item_planejado_id` e nulo para bolsa vinda de fora do planejamento
   * (GCUB, Erasmus), e um `join` a excluiria de todo agrupamento — que e
   * exatamente o buraco que a BOL-011 fechou.
   */
  private condicao(filtro: FiltroMobilidade, recorte: SQL): SQL {
    const partes: SQL[] = [recorte];

    if (filtro.ano) {
      partes.push(sql`extract(year from bc.data_inicio)::int = ${filtro.ano}`);
    }
    if (filtro.fluxo) partes.push(sql`bc.fluxo = ${filtro.fluxo}`);
    if (filtro.modalidadeId) {
      partes.push(sql`bc.modalidade_id = ${filtro.modalidadeId}::uuid`);
    }
    if (filtro.nivel) {
      partes.push(sql`bc.nivel_beneficiario = ${filtro.nivel}`);
    }
    if (filtro.paisId) {
      partes.push(sql`bc.pais_destino_id = ${filtro.paisId}::uuid`);
    }
    if (filtro.instituicaoId) {
      partes.push(
        sql`bc.instituicao_destino_id = ${filtro.instituicaoId}::uuid`,
      );
    }
    if (filtro.ppgId) partes.push(sql`bc.ppg_id = ${filtro.ppgId}::uuid`);
    if (filtro.programaId) {
      partes.push(sql`bc.programa_id = ${filtro.programaId}::uuid`);
    }
    if (filtro.cicloId) {
      partes.push(sql`bc.ciclo_id = ${filtro.cicloId}::uuid`);
    }
    // Sem filtro explicito, a bolsa cancelada fica de fora (V1-036, contrato
    // §5.3): com desistencias registradas, "35 mobilidades" passaria a contar
    // quem nunca viajou, e a substituicao contaria a mesma vaga duas vezes.
    // `INTERROMPIDA` continua dentro — a viagem aconteceu, so terminou antes.
    // Quem quer ver as canceladas pede `status=CANCELADA`.
    partes.push(
      filtro.status
        ? sql`bc.status = ${filtro.status}`
        : sql`bc.status <> 'CANCELADA'`,
    );
    if (filtro.redeId) {
      // `exists` e nao `join`: rede vem por temática, e um join duplicaria a
      // concessão se a temática pertencesse a mais de uma rede algum dia.
      partes.push(sql`exists (
        select 1
          from area_tematica atf
          join rede_coordenadora rcf on rcf.id = atf.rede_id
         where atf.id = coalesce(bc.area_tematica_id, ip.area_tematica_id)
           and rcf.id = ${filtro.redeId}::uuid
      )`);
    }

    return sql.join(partes, sql` and `);
  }

  private async totais(onde: SQL) {
    return consultarUma<PanoramaMobilidade['totais']>(
      this.db,
      sql`
      select count(*)::int                                        as "mobilidades",
             count(*) filter (where bc.fluxo = 'IN')::int         as "entrada",
             count(*) filter (where bc.fluxo = 'OUT')::int        as "saida",
             count(distinct ${CHAVE_PAIS})::int                   as "paises",
             count(distinct bc.ppg_id)::int                       as "ppgs",
             count(distinct ${CHAVE_INSTITUICAO})::int            as "instituicoes",
             coalesce(sum(bc.valor_concedido), 0)::text           as "valor",
             count(*) filter (
               where bc.instituicao_destino_id is null
             )::int                                               as "semInstituicaoCadastrada"
        from bolsa_concedida bc
        left join item_planejado ip on ip.id = bc.item_planejado_id
       where ${onde}
    `,
    );
  }

  private async porAno(onde: SQL): Promise<LinhaAno[]> {
    return consultar<LinhaAno>(
      this.db,
      sql`
      select extract(year from bc.data_inicio)::int          as "ano",
             count(*) filter (where bc.fluxo = 'IN')::int    as "entrada",
             count(*) filter (where bc.fluxo = 'OUT')::int   as "saida",
             count(*)::int                                   as "total",
             coalesce(sum(bc.valor_concedido), 0)::text      as "valor"
        from bolsa_concedida bc
        left join item_planejado ip on ip.id = bc.item_planejado_id
       where ${onde}
       group by 1
       order by 1
    `,
    );
  }

  /**
   * Rede coordenadora, com alcance e resultado (BOL-043).
   *
   * **Contagem de alcance e `distinct`, e o produto entra por subconsulta e
   * nao por `join`** — a mesma dupla de cuidados da CG-067. Um `join` com
   * `produto_bolsa` faria a bolsa de tres produtos virar tres linhas, inflando
   * a contagem de mobilidades e o valor junto.
   *
   * A rede vem por `left join`, entao a concessao sem tematica — a que veio de
   * fora do planejamento — cai numa linha "sem rede" em vez de sumir. Some-la
   * as outras seria pior: ela existe e nao pertence a nenhuma.
   */
  private async porRede(onde: SQL, lerProdutos: SQL): Promise<LinhaRede[]> {
    return consultar<LinhaRede>(
      this.db,
      sql`
      select coalesce(rc.id::text, 'sem-rede')                as "chave",
             coalesce(rc.nome, 'Sem rede vinculada')          as "rotulo",
             count(*)::int                                     as "quantidade",
             count(*) filter (where bc.fluxo = 'IN')::int      as "entrada",
             count(*) filter (where bc.fluxo = 'OUT')::int     as "saida",
             coalesce(sum(bc.valor_concedido), 0)::text        as "valor",
             count(distinct ${CHAVE_PAIS})::int                as "paises",
             count(distinct ${CHAVE_INSTITUICAO})::int         as "instituicoes",
             count(distinct bc.ppg_id)::int                    as "ppgs",
             case when bool_and(${lerProdutos}) then coalesce(sum(
               (select count(*) from produto_bolsa pb
                 where pb.bolsa_concedida_id = bc.id)
             ), 0)::int end                                     as "produtos"
        from bolsa_concedida bc
        left join item_planejado ip on ip.id = bc.item_planejado_id
        left join area_tematica at  on at.id = coalesce(bc.area_tematica_id, ip.area_tematica_id)
        left join rede_coordenadora rc on rc.id = at.rede_id
       where ${onde}
       group by 1, 2
       order by count(*) desc, 2
    `,
    );
  }

  /** Quebra por pais, com o codigo que o mapa usa (BOL-042). */
  private async porPais(onde: SQL): Promise<LinhaPais[]> {
    return consultar<LinhaPais>(
      this.db,
      sql`
      select ${CHAVE_PAIS}                                   as "chave",
             min(coalesce(pd.nome, trim(bc.pais_destino_nome))) as "rotulo",
             min(pd.codigo_numerico)                          as "codigoNumerico",
             min(pd.codigo_iso2)                              as "codigoIso2",
             count(*)::int                                     as "quantidade",
             count(*) filter (where bc.fluxo = 'IN')::int      as "entrada",
             count(*) filter (where bc.fluxo = 'OUT')::int     as "saida",
             coalesce(sum(bc.valor_concedido), 0)::text        as "valor"
        from bolsa_concedida bc
        left join item_planejado ip on ip.id = bc.item_planejado_id
        left join pais pd on pd.id = bc.pais_destino_id
       where ${onde}
         and ${CHAVE_PAIS} is not null
       group by 1
       order by count(*) desc, 2
       limit ${TETO_QUEBRA}
    `,
    );
  }

  /**
   * Uma quebra qualquer, com a mesma forma para todas.
   *
   * Um metodo por quebra repetiria oito vezes o mesmo `where` e o mesmo
   * `count`, e a nona quebra escrita por outra pessoa esqueceria o recorte.
   * `chave` e `rotulo` entram como fragmento cru, escritos aqui — nunca texto
   * vindo do usuario.
   */
  private async quebra(
    onde: SQL,
    chave: SQL,
    rotulo: SQL,
    juncao: SQL,
  ): Promise<LinhaContagem[]> {
    return consultar<LinhaContagem>(
      this.db,
      sql`
      select ${chave}                                        as "chave",
             min(${rotulo})                                  as "rotulo",
             count(*)::int                                    as "quantidade",
             count(*) filter (where bc.fluxo = 'IN')::int     as "entrada",
             count(*) filter (where bc.fluxo = 'OUT')::int    as "saida",
             coalesce(sum(bc.valor_concedido), 0)::text       as "valor"
        from bolsa_concedida bc
        left join item_planejado ip on ip.id = bc.item_planejado_id
        ${juncao}
       where ${onde}
         and ${chave} is not null
       group by 1
       order by count(*) desc, 2
       limit ${TETO_QUEBRA}
    `,
    );
  }
}
