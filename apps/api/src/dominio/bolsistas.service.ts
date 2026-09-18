import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { dataHojeEmManaus } from '../comum/datas';

import type { AuthUser } from '../auth/auth-user';
import {
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';
import { filtroPorPpg, podeVerPpg } from '../auth/escopo';
import { IdentidadeService } from '../auth/identidade.service';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import { normalizarNomeInstituicao } from '../database/normalizacao';
import * as s from '../database/schema';

const dataCompleta = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data completa.')
  .refine(dataIsoValida, 'Informe uma data válida.');

const periodo = z
  .object({
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
  })
  .superRefine((valor, contexto) => {
    if (valor.dataFim < valor.dataInicio) {
      contexto.addIssue({
        code: 'custom',
        path: ['dataFim'],
        message: 'A data final não pode ser anterior à data inicial.',
      });
    }
  });

const cpf = z
  .string()
  .transform((valor) => valor.replace(/\D/g, ''))
  .refine((valor) => cpfValido(valor), 'Informe um CPF válido.');

/**
 * Modo de preenchimento da instituicao em cada ponta da mobilidade (BOL-010).
 *
 * Espelha `missao_atividade`: o catalogo e o caminho preferido — e o unico que
 * liga a bolsa ao historico do parceiro e ao mapa —, mas o texto livre continua
 * aceito. Exigir catalogo travaria hoje um cadastro que funciona: o catalogo
 * nasce com a UEA e as tres redes, sem nenhuma universidade estrangeira, e quem
 * tem `bolsa:write` nao tem `parceiro:write` para cadastra-las.
 */
const modoInstituicao = z.enum(['catalogo', 'livre']);

export const criarBolsaConcedidaSchema = z
  .object({
    itemPlanejadoId: z.uuid('Selecione a bolsa planejada.'),
    nome: z.string().trim().min(3, 'Informe o nome do bolsista.').max(240),
    email: z.email('Informe um e-mail válido.').max(240).nullish(),
    cpf,
    telefone: z.string().trim().max(80).nullish(),
    lattes: z.string().trim().max(240).nullish(),
    /**
     * ORCID canonico. O ultimo caractere pode ser `X` — e o digito verificador
     * do padrao, e recusa-lo rejeitaria um em cada onze ORCIDs validos.
     */
    orcid: z
      .string()
      .trim()
      .regex(
        /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/,
        'Informe o ORCID no formato 0000-0000-0000-0000.',
      )
      .nullish(),
    linhaPesquisaId: z.uuid().nullish(),
    orientadorNome: z.string().trim().min(3).max(240).nullish(),
    nivelBeneficiario: z.enum([
      'MESTRADO',
      'DOUTORADO',
      'POS_DOC',
      'DOCENTE',
      'MOBILIDADE_BREVE',
    ]),
    /**
     * Pais de origem sai do catalogo ISO (BOL-010, decisao de 2026-09-09); o
     * de destino voltou a ser digitado em 2026-09-11, logo abaixo.
     *
     * Era texto livre. Agrupar mobilidade por texto conta "Franca" e "FRANCA"
     * como dois paises — o mesmo defeito que a CG-067 registrou sobre evento
     * contado pelo nome, e que ali obrigou um aviso na tela. Aqui nao ha caso
     * legitimo de pais fora da ISO, entao a lista fechada resolve na origem.
     */
    paisOrigemId: z.uuid('Selecione o país de origem.'),
    modoInstituicaoOrigem: modoInstituicao,
    instituicaoOrigemId: z.uuid().nullish(),
    instituicaoOrigemNome: z.string().trim().min(2).max(240).nullish(),
    /**
     * O destino e digitado, sem catalogo (decisao de 2026-09-11): a equipe
     * informa pais e instituicao como estao no termo. `resolverPontas` liga ao
     * cadastro central quando a grafia coincide, e so assim o pais chega ao
     * mapa e a instituicao ao historico do parceiro.
     */
    paisDestinoNome: z
      .string()
      .trim()
      .min(2, 'Informe o país de destino.')
      .max(120),
    instituicaoDestinoNome: z
      .string()
      .trim()
      .min(2, 'Informe a universidade ou instituição de destino.')
      .max(240),
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    status: z.enum(['SELECIONADO', 'EM_ANDAMENTO']).default('SELECIONADO'),
    processo: z.string().trim().max(120).nullish(),
    observacoes: z.string().trim().max(4000).nullish(),
  })
  .superRefine((valor, contexto) => {
    if (
      valor.modoInstituicaoOrigem === 'catalogo' &&
      !valor.instituicaoOrigemId
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['instituicaoOrigemId'],
        message: 'Selecione a instituição de origem no catálogo.',
      });
    }
    if (
      valor.modoInstituicaoOrigem === 'livre' &&
      !valor.instituicaoOrigemNome
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['instituicaoOrigemNome'],
        message: 'Informe o nome da instituição de origem.',
      });
    }
  })
  .and(periodo);

export type CriarBolsaConcedida = z.infer<typeof criarBolsaConcedidaSchema>;

export const atualizarBolsaConcedidaSchema = z
  .object({
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    status: z.enum([
      'SELECIONADO',
      'EM_ANDAMENTO',
      'CONCLUIDA',
      'CANCELADA',
      'INTERROMPIDA',
    ]),
    processo: z.string().trim().max(120).nullish(),
    observacoes: z.string().trim().max(4000).nullish(),
  })
  .and(periodo);

export type AtualizarBolsaConcedida = z.infer<
  typeof atualizarBolsaConcedidaSchema
>;

const tiposProduto = [
  'ARTIGO',
  'TRABALHO',
  'PROJETO',
  'RELATORIO',
  'PUBLICACAO',
  'LIVRO',
  'CAPITULO_LIVRO',
  'PATENTE',
  'EVENTO',
  // BOL-050: cotutela e orientacao conjunta do documento da equipe.
  'TESE_COTUTELA',
  'ORIENTACAO_CONJUNTA',
  'OUTRO',
] as const;

const statusProduto = [
  'PREVISTO',
  'EM_DESENVOLVIMENTO',
  'ENTREGUE',
  'VALIDADO',
  'CANCELADO',
] as const;

export const produtoBolsaSchema = z
  .object({
    tipo: z.enum(tiposProduto),
    titulo: z.string().trim().min(3, 'Informe o título do produto.').max(400),
    descricao: z.string().trim().max(4000).nullish(),
    prazoEntrega: dataCompleta,
    status: z.enum(statusProduto).default('PREVISTO'),
    dataEntrega: dataCompleta.nullish(),
    doi: z.string().trim().max(240).nullish(),
    link: z.url('Informe um link válido.').max(500).nullish(),
    instituicaoColaboracao: z
      .string()
      .trim()
      .min(2, 'Informe a instituição de colaboração.')
      .max(240),
    paisColaboracao: z
      .string()
      .trim()
      .min(2, 'Informe o país da colaboração.')
      .max(120),
    observacoes: z.string().trim().max(4000).nullish(),
  })
  .superRefine((produto, contexto) => {
    if (
      (produto.status === 'ENTREGUE' || produto.status === 'VALIDADO') &&
      !produto.dataEntrega
    ) {
      contexto.addIssue({
        code: 'custom',
        path: ['dataEntrega'],
        message: 'Informe a data da entrega.',
      });
    }
  });

export type ProdutoBolsaDto = z.infer<typeof produtoBolsaSchema>;

type StatusBolsa =
  'SELECIONADO' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA' | 'INTERROMPIDA';

export type SituacaoTemporalBolsa =
  | 'PROGRAMADA'
  | 'PROXIMA'
  | 'EM_VIGENCIA'
  | 'PRESTES_A_EXPIRAR'
  | 'EXPIRADA'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'INTERROMPIDA';

export type SituacaoProduto = (typeof statusProduto)[number] | 'ATRASADO';

interface BolsaBase {
  id: string;
  itemPlanejadoId: string | null;
  codigoPlanejamento: string | null;
  programa: string;
  programaSlug: string;
  ciclo: string;
  ppgId: string;
  ppg: string;
  ppgSigla: string;
  pessoaId: string;
  bolsista: string;
  email: string | null;
  cpf: string | null;
  telefone: string | null;
  lattes: string | null;
  orcid: string | null;
  /**
   * Rede e temática saem da concessão desde a BOL-011, e não do item planejado:
   * bolsa sem planejamento nesta ferramenta (GCUB, Erasmus) tem `null` no item
   * e ficava fora de todo agrupamento.
   */
  areaTematica: string | null;
  areaTematicaCodigo: string | null;
  rede: string | null;
  linhaPesquisa: string | null;
  orientador: string | null;
  coordenadorPpg: string | null;
  modalidade: string;
  destino: 'BRASIL' | 'EXTERIOR';
  paisOrigem: string | null;
  paisOrigemId: string | null;
  instituicaoOrigem: string | null;
  instituicaoOrigemId: string | null;
  paisDestino: string | null;
  paisDestinoId: string | null;
  instituicaoDestino: string | null;
  instituicaoDestinoId: string | null;
  nivelBeneficiario:
    'MESTRADO' | 'DOUTORADO' | 'POS_DOC' | 'DOCENTE' | 'MOBILIDADE_BREVE';
  dataInicio: string;
  dataFim: string;
  vigenciaMeses: string;
  valorConcedido: string;
  fluxo: 'IN' | 'OUT';
  status: StatusBolsa;
  processo: string | null;
  observacoes: string | null;
  produtos: number;
  produtosPendentes: number;
}

export interface ProdutoBolsa {
  id: string;
  bolsaConcedidaId: string;
  tipo: (typeof tiposProduto)[number];
  titulo: string;
  descricao: string | null;
  prazoEntrega: string;
  status: (typeof statusProduto)[number];
  dataEntrega: string | null;
  doi: string | null;
  link: string | null;
  instituicaoColaboracao: string | null;
  paisColaboracao: string | null;
  observacoes: string | null;
}

/**
 * Teto de linhas do seletor de instituicao.
 *
 * Protege o combobox, nao o banco: passar disso significa que o usuario deve
 * refinar a busca, e a tela diz isso em vez de cortar em silencio — mesma
 * regra que a lista de parceiros adotou no limite dela.
 */
const TETO_INSTITUICOES = 50;

@Injectable()
export class BolsistasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
  ) {}

  /**
   * Linhas de bolsa com vaga, recortadas pelo escopo (BOL-020).
   *
   * Recortar aqui e o que impede o formulario de oferecer uma vaga de outro
   * PPG: sem isso a escolha seria aceita e so morreria na checagem de escrita,
   * depois do cadastro inteiro preenchido.
   */
  async opcoesPlanejamento(alcance: Alcance) {
    const visivel = condicaoDoAlcance(alcance, {
      ciclo: sql`ip.ciclo_id`,
      ppg: sql`ip.ppg_id`,
      rede: sql`at.rede_id`,
      tematica: sql`ip.area_tematica_id`,
      participacao: sql`pp.id`,
    });

    return consultar<{
      id: string;
      codigo: string;
      programa: string;
      programaSlug: string;
      ciclo: string;
      ppgId: string;
      ppg: string;
      ppgSigla: string;
      modalidade: string;
      destino: 'BRASIL' | 'EXTERIOR';
      vigenciaMeses: string;
      valorUnitario: string;
      mesImplementacao: string | null;
      porAno: {
        ano: number;
        planejadas: number;
        concedidas: number;
        vagasDisponiveis: number;
      }[];
    }>(
      this.db,
      sql`
      with concedidas as (
        select item_planejado_id,
               extract(year from data_inicio)::int as ano,
               count(*)::int as total
          from bolsa_concedida
         where item_planejado_id is not null
           and status <> 'CANCELADA'
         group by item_planejado_id, extract(year from data_inicio)::int
      )
      select ip.id                         as "id",
             ip.codigo                     as "codigo",
             p.nome                        as "programa",
             p.slug                        as "programaSlug",
             c.nome                        as "ciclo",
             pg.id                         as "ppgId",
             pg.nome                       as "ppg",
             pg.sigla                      as "ppgSigla",
             m.nome                        as "modalidade",
             ip.destino                    as "destino",
             ip.vigencia_meses             as "vigenciaMeses",
             ic.valor_brl                  as "valorUnitario",
             ip.mes_implementacao          as "mesImplementacao",
             jsonb_agg(
               jsonb_build_object(
                 'ano', pa.ano,
                 'planejadas', pa.quantidade,
                 'concedidas', coalesce(bc.total, 0),
                 'vagasDisponiveis', greatest(pa.quantidade - coalesce(bc.total, 0), 0)
               ) order by pa.ano
             )                             as "porAno"
        from item_planejado ip
        join ciclo c                  on c.id = ip.ciclo_id
        join programa p               on p.id = c.programa_id
        join ppg pg                   on pg.id = ip.ppg_id
        join modalidade m            on m.id = ip.modalidade_id
        join item_catalogo_bolsa ic   on ic.id = ip.item_catalogo_id
        join planejamento_anual pa    on pa.item_planejado_id = ip.id
        left join area_tematica at on at.id = ip.area_tematica_id
        left join participacao_ppg pp on pp.area_tematica_id = ip.area_tematica_id
          and pp.ppg_id = ip.ppg_id
        left join concedidas bc       on bc.item_planejado_id = ip.id
                                      and bc.ano = pa.ano
       where ip.rubrica = 'BOLSAS'
         and ip.status = 'PROGRAMADO'
         and ${visivel}
       group by ip.id, ip.codigo, p.nome, p.slug, c.nome, c.ano_inicio,
                pg.id, pg.nome, pg.sigla, m.nome, ip.destino,
                ip.vigencia_meses, ic.valor_brl, ip.mes_implementacao
       order by p.nome, c.ano_inicio, pg.sigla, ip.codigo
    `,
    );
  }

  /**
   * Listas de apoio do formulario de concessao (BOL-010).
   *
   * Endpoint proprio, com `bolsa:read`, em vez de reusar `/parceiros`: quem
   * cadastra bolsa e `coordenador` ou `secretaria`, e nenhum dos dois tem
   * `parceiro:read` — que hoje governa tambem os contatos, com dados pessoais
   * que essas funcoes nao precisam ver para escolher uma universidade.
   *
   * Paises e instituicoes nao sao recortados: o cadastro institucional e
   * compartilhado, como a matriz aprovada manda e como `referencias-missao` ja
   * fazia.
   */
  async referencias() {
    const [paises, instituicoes, linhasPesquisa] = await Promise.all([
      this.db
        .select({
          id: s.pais.id,
          nome: s.pais.nome,
          codigoIso2: s.pais.codigoIso2,
        })
        .from(s.pais)
        .orderBy(asc(s.pais.nome)),
      this.instituicoes(),
      // Todas de uma vez, com o `ppgId` junto: a tela filtra pelo PPG da linha
      // planejada escolhida. Buscar por PPG exigiria uma segunda ida ao
      // servidor a cada troca de seleção, para um conjunto que cabe inteiro.
      this.db
        .select({
          id: s.linhaPesquisa.id,
          nome: s.linhaPesquisa.nome,
          ppgId: s.linhaPesquisa.ppgId,
        })
        .from(s.linhaPesquisa)
        .where(eq(s.linhaPesquisa.ativa, true))
        .orderBy(asc(s.linhaPesquisa.nome)),
    ]);

    return { paises, instituicoes, linhasPesquisa };
  }

  /**
   * Instituicoes ativas para o seletor, filtradas no servidor.
   *
   * O teto existe para o combobox nao receber a tabela inteira quando o
   * cadastro crescer — e a busca remota existe pelo mesmo motivo. Com o
   * catalogo pequeno de hoje a primeira pagina ja e a lista toda; o contrato e
   * que muda quando ela deixar de ser.
   */
  async instituicoes(busca?: string) {
    const termo = busca?.trim();
    const condicoes = [eq(s.instituicao.ativo, true)];
    if (termo) {
      const padrao = `%${termo}%`;
      condicoes.push(
        or(
          ilike(s.instituicao.nome, padrao),
          ilike(s.instituicao.sigla, padrao),
        )!,
      );
    }

    return this.db
      .select({
        id: s.instituicao.id,
        nome: s.instituicao.nome,
        sigla: s.instituicao.sigla,
        cidade: s.instituicao.cidade,
        pais: s.pais.nome,
      })
      .from(s.instituicao)
      .leftJoin(s.pais, eq(s.pais.id, s.instituicao.paisId))
      .where(and(...condicoes))
      .orderBy(asc(s.instituicao.nome))
      .limit(TETO_INSTITUICOES);
  }

  /**
   * Concessoes que o usuario enxerga (BOL-020).
   *
   * O recorte entra na consulta, e nao numa filtragem em memoria depois:
   * filtrar fora do banco traria a tabela inteira para a aplicacao e vazaria a
   * contagem real em qualquer soma feita antes do filtro — a mesma regra que a
   * listagem de PPGs segue desde que o escopo existe.
   *
   * `bc.ppg_id` e `notNull`, entao nenhuma concessao escapa por falta de PPG.
   */
  async listar(usuario: AuthUser) {
    const escopo = await this.identidade.escopoDe(usuario);
    const hoje = dataHojeEmManaus();
    const linhas = await consultar<BolsaBase>(
      this.db,
      sql`
      with produtos as (
        select bolsa_concedida_id,
               count(*)::int as total,
               count(*) filter (
                 where status not in ('ENTREGUE', 'VALIDADO', 'CANCELADO')
               )::int as pendentes
          from produto_bolsa
         group by bolsa_concedida_id
      )
      select bc.id                         as "id",
             bc.item_planejado_id          as "itemPlanejadoId",
             ip.codigo                     as "codigoPlanejamento",
             prog.nome                     as "programa",
             prog.slug                     as "programaSlug",
             c.nome                        as "ciclo",
             pg.id                         as "ppgId",
             pg.nome                       as "ppg",
             pg.sigla                      as "ppgSigla",
             pe.id                         as "pessoaId",
             pe.nome                       as "bolsista",
             pe.email                      as "email",
             pe.cpf                        as "cpf",
             pe.telefone                   as "telefone",
             pe.lattes                     as "lattes",
             pe.orcid                      as "orcid",
             -- coalesce: a tematica da concessao e a fonte, e o item planejado
             -- so cobre as bolsas anteriores a BOL-011, que nao a tinham.
             at.nome                       as "areaTematica",
             at.codigo                     as "areaTematicaCodigo",
             rc.nome                       as "rede",
             lp.nome                       as "linhaPesquisa",
             ori.nome                      as "orientador",
             coord.nome                    as "coordenadorPpg",
             m.nome                        as "modalidade",
             bc.destino                    as "destino",
             -- coalesce, e nao so o join: as colunas de texto guardam as
             -- pontas de antes da BOL-010 e a instituicao informada a mao, que
             -- por decisao continua aceita. O join vem primeiro para que
             -- renomear ou conciliar um cadastro central se propague aqui.
             coalesce(pai_o.nome, bc.pais_origem_nome)
                                           as "paisOrigem",
             bc.pais_origem_id             as "paisOrigemId",
             coalesce(ins_o.nome, bc.instituicao_origem_nome)
                                           as "instituicaoOrigem",
             bc.instituicao_origem_id      as "instituicaoOrigemId",
             coalesce(pai_d.nome, bc.pais_destino_nome)
                                           as "paisDestino",
             bc.pais_destino_id            as "paisDestinoId",
             coalesce(ins_d.nome, bc.instituicao_destino_nome)
                                           as "instituicaoDestino",
             bc.instituicao_destino_id     as "instituicaoDestinoId",
             bc.nivel_beneficiario         as "nivelBeneficiario",
             bc.data_inicio                as "dataInicio",
             bc.data_fim                   as "dataFim",
             bc.vigencia_meses             as "vigenciaMeses",
             bc.valor_concedido            as "valorConcedido",
             bc.fluxo                      as "fluxo",
             bc.status                     as "status",
             bc.processo                   as "processo",
             bc.observacoes                as "observacoes",
             coalesce(pr.total, 0)          as "produtos",
             coalesce(pr.pendentes, 0)      as "produtosPendentes"
        from bolsa_concedida bc
        join programa prog     on prog.id = bc.programa_id
        join ciclo c           on c.id = bc.ciclo_id
        join ppg pg            on pg.id = bc.ppg_id
        join pessoa pe         on pe.id = bc.pessoa_id
        join modalidade m      on m.id = bc.modalidade_id
        left join item_planejado ip on ip.id = bc.item_planejado_id
        left join produtos pr       on pr.bolsa_concedida_id = bc.id
        left join pais pai_o        on pai_o.id = bc.pais_origem_id
        left join pais pai_d        on pai_d.id = bc.pais_destino_id
        left join instituicao ins_o on ins_o.id = bc.instituicao_origem_id
        left join instituicao ins_d on ins_d.id = bc.instituicao_destino_id
        left join area_tematica at  on at.id = coalesce(bc.area_tematica_id,
                                                       ip.area_tematica_id)
        left join rede_coordenadora rc on rc.id = at.rede_id
        left join linha_pesquisa lp on lp.id = bc.linha_pesquisa_id
        left join pessoa ori        on ori.id = bc.orientador_id
        left join pessoa coord      on coord.id = pg.coordenador_id
       where ${filtroPorPpg(escopo, sql`bc.ppg_id`)}
       order by bc.data_inicio, pe.nome
    `,
    );

    return linhas.map((linha) => ({
      ...linha,
      situacaoTemporal: classificarSituacaoTemporal(linha, hoje),
    }));
  }

  /**
   * Detalhe da concessao.
   *
   * Parte de `listar`, entao herda o recorte: concessao de PPG fora do escopo
   * responde **404, nunca 403** — dizer "existe, mas nao e seu" ja entrega que
   * a pessoa tem bolsa, que e justamente o dado protegido aqui.
   */
  async detalhar(id: string, usuario: AuthUser) {
    const bolsa = (await this.listar(usuario)).find((item) => item.id === id);
    if (!bolsa) throw new NotFoundException('Bolsa concedida não encontrada.');

    const hoje = dataHojeEmManaus();
    const produtos = await consultar<ProdutoBolsa>(
      this.db,
      sql`
      select id,
             bolsa_concedida_id as "bolsaConcedidaId",
             tipo,
             titulo,
             descricao,
             prazo_entrega      as "prazoEntrega",
             status,
             data_entrega       as "dataEntrega",
             doi,
             link,
             instituicao_colaboracao as "instituicaoColaboracao",
             pais_colaboracao   as "paisColaboracao",
             observacoes
        from produto_bolsa
       where bolsa_concedida_id = ${id}
       order by prazo_entrega, titulo
    `,
    );

    return {
      ...bolsa,
      produtos: produtos.map((produto) => ({
        ...produto,
        situacao: classificarSituacaoProduto(produto, hoje),
      })),
    };
  }

  /**
   * Concede a bolsa a uma pessoa.
   *
   * **A escrita usa o mesmo `podeVerPpg` da leitura, com o modo permissivo**,
   * e nao a regra estrita que `RecorteDeMissoes.alcanca` adota. Os dois casos
   * parecem iguais e nao sao: `gestor-rede` nunca foi atribuido a ninguem, e
   * fechar a escrita de missao nao tira nada de ninguem; `bolsa:write` e do
   * `coordenador`, que existe e trabalha hoje sem escopo cadastrado. Fechar a
   * escrita aqui pararia o cadastro de bolsa no mesmo instante, para todo
   * mundo — exatamente o que `RECORTE_OBRIGATORIO = false` existe para evitar.
   * Quando a flag virar `true`, leitura e escrita fecham juntas.
   */
  async criar(dto: CriarBolsaConcedida, usuario: AuthUser) {
    const escopo = await this.identidade.escopoDe(usuario);
    const ano = Number(dto.dataInicio.slice(0, 4));

    const id = await this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: s.itemPlanejado.id,
          programaId: s.programa.id,
          cicloId: s.ciclo.id,
          ppgId: s.itemPlanejado.ppgId,
          areaTematicaId: s.itemPlanejado.areaTematicaId,
          modalidadeId: s.itemPlanejado.modalidadeId,
          destino: s.itemPlanejado.destino,
          vigenciaMeses: s.itemPlanejado.vigenciaMeses,
          valorConcedido: s.itemCatalogoBolsa.valorBrl,
          fluxo: s.itemPlanejado.fluxo,
        })
        .from(s.itemPlanejado)
        .innerJoin(s.ciclo, eq(s.ciclo.id, s.itemPlanejado.cicloId))
        .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
        .innerJoin(
          s.itemCatalogoBolsa,
          eq(s.itemCatalogoBolsa.id, s.itemPlanejado.itemCatalogoId),
        )
        .where(
          and(
            eq(s.itemPlanejado.id, dto.itemPlanejadoId),
            eq(s.itemPlanejado.rubrica, 'BOLSAS'),
            eq(s.itemPlanejado.status, 'PROGRAMADO'),
          ),
        )
        .limit(1);

      if (
        !item ||
        !item.modalidadeId ||
        !item.destino ||
        !item.vigenciaMeses ||
        !item.fluxo
      ) {
        throw new BadRequestException(
          'A linha selecionada não é uma bolsa programada válida.',
        );
      }

      // 404 e nao 403, pela mesma razao de `detalhar`: a linha do plano de
      // outro PPG nem aparece em `opcoesPlanejamento`, entao para quem esta
      // recortado ela simplesmente nao existe.
      if (!podeVerPpg(escopo, item.ppgId)) {
        throw new NotFoundException('Bolsa planejada não encontrada.');
      }

      // Antes de `exigirVaga`, de proposito: aquela funcao trava a linha de
      // `planejamento_anual` com `for update` ate o fim da transacao. Validar
      // as pontas depois manteria o lock preso durante leituras que so podem
      // recusar a requisicao — e recusaria a vaga por um erro de referencia.
      const pontas = await resolverPontas(tx, dto);

      await exigirVaga(tx, item.id, ano);

      const [modalidadeJaUtilizada] = await tx
        .select({ modalidadeId: s.bolsaConcedida.modalidadeId })
        .from(s.bolsaConcedida)
        .innerJoin(s.pessoa, eq(s.pessoa.id, s.bolsaConcedida.pessoaId))
        .where(
          and(
            eq(s.bolsaConcedida.cicloId, item.cicloId),
            eq(s.pessoa.cpf, dto.cpf),
            ne(s.bolsaConcedida.modalidadeId, item.modalidadeId),
          ),
        )
        .limit(1);
      if (modalidadeJaUtilizada) {
        throw new BadRequestException(
          'Este CPF já utilizou outra modalidade de bolsa neste ciclo.',
        );
      }

      const email = dto.email?.toLocaleLowerCase('pt-BR') ?? null;
      const [existente] = await tx
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(
          email
            ? or(eq(s.pessoa.cpf, dto.cpf), eq(s.pessoa.email, email))
            : eq(s.pessoa.cpf, dto.cpf),
        )
        .limit(1);

      const pessoaId = existente
        ? (
            await tx
              .update(s.pessoa)
              .set({
                nome: dto.nome,
                email,
                cpf: dto.cpf,
                ppgId: item.ppgId,
                ...dadosDeContato(dto),
                atualizadoEm: new Date(),
              })
              .where(eq(s.pessoa.id, existente.id))
              .returning({ id: s.pessoa.id })
          )[0].id
        : (
            await tx
              .insert(s.pessoa)
              .values({
                nome: dto.nome,
                email,
                cpf: dto.cpf,
                tipo: tipoPessoa(dto.nivelBeneficiario),
                ppgId: item.ppgId,
                ...dadosDeContato(dto),
              })
              .returning({ id: s.pessoa.id })
          )[0].id;

      const [criada] = await tx
        .insert(s.bolsaConcedida)
        .values({
          itemPlanejadoId: item.id,
          programaId: item.programaId,
          cicloId: item.cicloId,
          ppgId: item.ppgId,
          areaTematicaId: item.areaTematicaId,
          pessoaId,
          linhaPesquisaId: await linhaDoPpg(tx, dto, item.ppgId),
          orientadorId: await orientador(tx, dto, item.ppgId),
          modalidadeId: item.modalidadeId,
          destino: item.destino,
          ...pontas,
          nivelBeneficiario: dto.nivelBeneficiario,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim,
          vigenciaMeses: item.vigenciaMeses,
          valorConcedido: item.valorConcedido,
          fluxo: item.fluxo,
          status: dto.status,
          processo: dto.processo ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.bolsaConcedida.id });

      return criada.id;
    });

    return this.detalhar(id, usuario);
  }

  async atualizar(id: string, dto: AtualizarBolsaConcedida, usuario: AuthUser) {
    const escopo = await this.identidade.escopoDe(usuario);
    const [atual] = await this.db
      .select({
        itemPlanejadoId: s.bolsaConcedida.itemPlanejadoId,
        ppgId: s.bolsaConcedida.ppgId,
      })
      .from(s.bolsaConcedida)
      .where(eq(s.bolsaConcedida.id, id))
      .limit(1);

    if (!atual || !podeVerPpg(escopo, atual.ppgId)) {
      throw new NotFoundException('Bolsa concedida não encontrada.');
    }

    if (atual.itemPlanejadoId && dto.status !== 'CANCELADA') {
      await exigirVaga(
        this.db,
        atual.itemPlanejadoId,
        Number(dto.dataInicio.slice(0, 4)),
        id,
      );
    }

    await this.db
      .update(s.bolsaConcedida)
      .set({
        dataInicio: dto.dataInicio,
        dataFim: dto.dataFim,
        status: dto.status,
        processo: dto.processo ?? null,
        observacoes: dto.observacoes ?? null,
        atualizadoEm: new Date(),
      })
      .where(eq(s.bolsaConcedida.id, id));

    return this.detalhar(id, usuario);
  }

  async criarProduto(bolsaId: string, dto: ProdutoBolsaDto, usuario: AuthUser) {
    await this.exigirBolsa(bolsaId, usuario);
    const [produto] = await this.db
      .insert(s.produtoBolsa)
      .values(valoresProduto(bolsaId, dto))
      .returning({ id: s.produtoBolsa.id });
    return this.produto(bolsaId, produto.id, usuario);
  }

  async atualizarProduto(
    bolsaId: string,
    produtoId: string,
    dto: ProdutoBolsaDto,
    usuario: AuthUser,
  ) {
    await this.exigirBolsa(bolsaId, usuario);
    const [produto] = await this.db
      .update(s.produtoBolsa)
      .set({
        ...valoresProduto(bolsaId, dto),
        atualizadoEm: new Date(),
      })
      .where(
        and(
          eq(s.produtoBolsa.id, produtoId),
          eq(s.produtoBolsa.bolsaConcedidaId, bolsaId),
        ),
      )
      .returning({ id: s.produtoBolsa.id });

    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return this.produto(bolsaId, produto.id, usuario);
  }

  private async produto(bolsaId: string, produtoId: string, usuario: AuthUser) {
    const detalhe = await this.detalhar(bolsaId, usuario);
    const produto = detalhe.produtos.find((item) => item.id === produtoId);
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return produto;
  }

  /**
   * A concessao existe **e** esta no escopo de quem pediu.
   *
   * O produto herda o recorte da bolsa, e nao tem recorte proprio: quem alcanca
   * a concessao alcanca a cobranca feita sobre ela. Sem isto, `produto:write`
   * seria a porta lateral do recorte — conhecer o UUID bastaria para escrever
   * na bolsa de outro PPG, que e a mesma falha que a CG-051 fechou nos anexos.
   */
  private async exigirBolsa(id: string, usuario: AuthUser) {
    const escopo = await this.identidade.escopoDe(usuario);
    const [bolsa] = await this.db
      .select({ ppgId: s.bolsaConcedida.ppgId })
      .from(s.bolsaConcedida)
      .where(eq(s.bolsaConcedida.id, id))
      .limit(1);
    if (!bolsa || !podeVerPpg(escopo, bolsa.ppgId)) {
      throw new NotFoundException('Bolsa concedida não encontrada.');
    }
  }
}

export function classificarSituacaoTemporal(
  bolsa: Pick<BolsaBase, 'status' | 'dataInicio' | 'dataFim'>,
  hoje = dataHojeEmManaus(),
): SituacaoTemporalBolsa {
  if (bolsa.status === 'CONCLUIDA') return 'CONCLUIDA';
  if (bolsa.status === 'CANCELADA') return 'CANCELADA';
  if (bolsa.status === 'INTERROMPIDA') return 'INTERROMPIDA';

  const paraInicio = diferencaDias(hoje, bolsa.dataInicio);
  if (paraInicio > 0) return paraInicio <= 60 ? 'PROXIMA' : 'PROGRAMADA';

  const paraFim = diferencaDias(hoje, bolsa.dataFim);
  if (paraFim < 0) return 'EXPIRADA';
  return paraFim <= 30 ? 'PRESTES_A_EXPIRAR' : 'EM_VIGENCIA';
}

export function classificarSituacaoProduto(
  produto: Pick<ProdutoBolsa, 'status' | 'prazoEntrega'>,
  hoje = dataHojeEmManaus(),
): SituacaoProduto {
  if (
    produto.status !== 'ENTREGUE' &&
    produto.status !== 'VALIDADO' &&
    produto.status !== 'CANCELADO' &&
    produto.prazoEntrega < hoje
  ) {
    return 'ATRASADO';
  }
  return produto.status;
}

/** Campos de contato e identificadores academicos da pessoa (BOL-012). */
function dadosDeContato(dto: CriarBolsaConcedida) {
  return {
    telefone: dto.telefone ?? null,
    lattes: dto.lattes ?? null,
    orcid: dto.orcid ?? null,
  };
}

/**
 * A linha de pesquisa tem de ser **do PPG da concessao** (BOL-013).
 *
 * `linha_pesquisa` e por PPG, e a chave estrangeira sozinha aceitaria a linha
 * de qualquer programa: a bolsa do PPGE apontaria para uma linha do PPGCLIAMB
 * sem nada reclamar, e a ficha do bolsista exibiria a linha errada.
 */
async function linhaDoPpg(
  db: Database,
  dto: CriarBolsaConcedida,
  ppgId: string,
): Promise<string | null> {
  if (!dto.linhaPesquisaId) return null;
  const [linha] = await db
    .select({ id: s.linhaPesquisa.id })
    .from(s.linhaPesquisa)
    .where(
      and(
        eq(s.linhaPesquisa.id, dto.linhaPesquisaId),
        eq(s.linhaPesquisa.ppgId, ppgId),
      ),
    )
    .limit(1);
  if (!linha) {
    throw new BadRequestException(
      'A linha de pesquisa selecionada não pertence a este PPG.',
    );
  }
  return linha.id;
}

/**
 * Orientador informado por nome, resolvido para `pessoa`.
 *
 * Aceita nome em vez de exigir id porque o orientador quase nunca esta
 * cadastrado quando a bolsa e concedida — exigir cadastro previo faria a
 * equipe deixar o campo vazio, que e pior que um vinculo aproximado. O
 * casamento e por nome exato dentro do PPG; nao havendo, cria a pessoa como
 * `DOCENTE`, do mesmo jeito que o bolsista e criado.
 */
async function orientador(
  db: Database,
  dto: CriarBolsaConcedida,
  ppgId: string,
): Promise<string | null> {
  const nome = dto.orientadorNome?.trim();
  if (!nome) return null;

  const [existente] = await db
    .select({ id: s.pessoa.id })
    .from(s.pessoa)
    .where(and(eq(s.pessoa.nome, nome), eq(s.pessoa.ppgId, ppgId)))
    .limit(1);
  if (existente) return existente.id;

  const [criado] = await db
    .insert(s.pessoa)
    .values({ nome, tipo: 'DOCENTE', ppgId })
    .returning({ id: s.pessoa.id });
  return criado.id;
}

/**
 * Liga as duas pontas da mobilidade ao cadastro central (BOL-010).
 *
 * **Exatamente uma das duas colunas e preenchida por ponta**, nunca as duas: a
 * FK quando veio do catalogo, o texto quando foi digitada. Gravar as duas
 * criaria a chance de discordarem no dia em que a instituicao for conciliada
 * (CG-025), e a leitura teria de escolher uma sem conseguir justificar a
 * escolha. O `coalesce` de `listar` depende disso.
 *
 * O destino chega sempre digitado. Quando a grafia coincide com o catalogo —
 * sem caixa, acento nem pontuacao —, grava-se a FK e nao o texto: e o que poe
 * o pais no mapa e a bolsa no historico do parceiro. Sem coincidencia, fica o
 * texto, e nada e presumido.
 */
async function resolverPontas(db: Database, dto: CriarBolsaConcedida) {
  const [paisOrigem] = await db
    .select({ id: s.pais.id })
    .from(s.pais)
    .where(eq(s.pais.id, dto.paisOrigemId))
    .limit(1);
  if (!paisOrigem) {
    throw new BadRequestException('País não encontrado no catálogo ISO.');
  }

  if (dto.modoInstituicaoOrigem === 'catalogo' && dto.instituicaoOrigemId) {
    // Inativa nao serve: o cadastro inativo e o lado perdedor de uma
    // conciliacao, e apontar para ele recriaria a duplicidade que a CG-025
    // desfez.
    const [encontrada] = await db
      .select({ id: s.instituicao.id })
      .from(s.instituicao)
      .where(
        and(
          eq(s.instituicao.id, dto.instituicaoOrigemId),
          eq(s.instituicao.ativo, true),
        ),
      )
      .limit(1);
    if (!encontrada) {
      throw new BadRequestException(
        'Instituição não encontrada ou inativa no cadastro institucional.',
      );
    }
  }

  const origem =
    dto.modoInstituicaoOrigem === 'catalogo'
      ? { id: dto.instituicaoOrigemId ?? null, nome: null }
      : { id: null, nome: dto.instituicaoOrigemNome ?? null };

  const paisDestinoId = await reconhecerPais(db, dto.paisDestinoNome);
  const instituicaoDestinoId = await reconhecerInstituicao(
    db,
    dto.instituicaoDestinoNome,
  );

  return {
    paisOrigemId: dto.paisOrigemId,
    paisDestinoId,
    paisDestinoNome: paisDestinoId ? null : dto.paisDestinoNome,
    instituicaoOrigemId: origem.id,
    instituicaoOrigemNome: origem.nome,
    instituicaoDestinoId,
    instituicaoDestinoNome: instituicaoDestinoId
      ? null
      : dto.instituicaoDestinoNome,
  };
}

/** Pais do catalogo ISO pelo nome digitado, ou pelo codigo de 2 ou 3 letras. */
async function reconhecerPais(db: Database, digitado: string) {
  const chave = normalizarNomeInstituicao(digitado);
  const codigo = digitado.trim().toUpperCase();
  const paises = await db
    .select({
      id: s.pais.id,
      nome: s.pais.nome,
      iso2: s.pais.codigoIso2,
      iso3: s.pais.codigoIso3,
    })
    .from(s.pais);
  const achado = paises.find(
    (pais) =>
      normalizarNomeInstituicao(pais.nome) === chave ||
      pais.iso2 === codigo ||
      pais.iso3 === codigo,
  );
  return achado?.id ?? null;
}

/**
 * Instituicao ativa com o mesmo nome normalizado. Sigla nao entra: siglas
 * colidem entre paises, e unir por elas misturaria instituicoes distintas —
 * a mesma cautela de `normalizarNomeInstituicao`.
 */
async function reconhecerInstituicao(db: Database, digitado: string) {
  const [achada] = await db
    .select({ id: s.instituicao.id })
    .from(s.instituicao)
    .where(
      and(
        eq(s.instituicao.nomeNormalizado, normalizarNomeInstituicao(digitado)),
        eq(s.instituicao.ativo, true),
      ),
    )
    .limit(1);
  return achada?.id ?? null;
}

async function exigirVaga(
  db: Database,
  itemPlanejadoId: string,
  ano: number,
  ignorarBolsaId?: string,
) {
  // A linha anual fica travada ate o fim da transacao para duas concessoes
  // simultaneas nao consumirem a mesma ultima vaga.
  await db.execute(sql`
    select id
      from planejamento_anual
     where item_planejado_id = ${itemPlanejadoId}
       and ano = ${ano}
     for update
  `);

  const [planejamento] = await db
    .select({ quantidade: s.planejamentoAnual.quantidade })
    .from(s.planejamentoAnual)
    .where(
      and(
        eq(s.planejamentoAnual.itemPlanejadoId, itemPlanejadoId),
        eq(s.planejamentoAnual.ano, ano),
      ),
    )
    .limit(1);

  if (!planejamento || planejamento.quantidade <= 0) {
    throw new BadRequestException(
      `Não existe vaga planejada para essa bolsa no exercício ${ano}.`,
    );
  }

  const condicoes = [
    eq(s.bolsaConcedida.itemPlanejadoId, itemPlanejadoId),
    sql`extract(year from ${s.bolsaConcedida.dataInicio})::int = ${ano}`,
    ne(s.bolsaConcedida.status, 'CANCELADA'),
  ];
  if (ignorarBolsaId) condicoes.push(ne(s.bolsaConcedida.id, ignorarBolsaId));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(s.bolsaConcedida)
    .where(and(...condicoes));

  if (total >= planejamento.quantidade) {
    throw new BadRequestException(
      `Todas as ${planejamento.quantidade} vagas planejadas para ${ano} já foram concedidas.`,
    );
  }
}

function valoresProduto(bolsaId: string, dto: ProdutoBolsaDto) {
  return {
    bolsaConcedidaId: bolsaId,
    tipo: dto.tipo,
    titulo: dto.titulo,
    descricao: dto.descricao ?? null,
    prazoEntrega: dto.prazoEntrega,
    status: dto.status,
    dataEntrega: dto.dataEntrega ?? null,
    doi: dto.doi ?? null,
    link: dto.link ?? null,
    instituicaoColaboracao: dto.instituicaoColaboracao,
    paisColaboracao: dto.paisColaboracao,
    observacoes: dto.observacoes ?? null,
  };
}

function tipoPessoa(
  nivel: CriarBolsaConcedida['nivelBeneficiario'],
): 'DOCENTE' | 'DISCENTE' | 'PESQUISADOR' | 'EXTERNO' {
  if (nivel === 'DOCENTE') return 'DOCENTE';
  if (nivel === 'POS_DOC') return 'PESQUISADOR';
  if (nivel === 'MOBILIDADE_BREVE') return 'EXTERNO';
  return 'DISCENTE';
}

function diferencaDias(de: string, ate: string): number {
  return (
    (Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) /
    86_400_000
  );
}

function dataIsoValida(valor: string): boolean {
  const data = new Date(`${valor}T00:00:00Z`);
  return (
    !Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === valor
  );
}

function cpfValido(valor: string): boolean {
  if (!/^\d{11}$/.test(valor) || /^(\d)\1{10}$/.test(valor)) return false;
  const digitos = valor.split('').map(Number);
  const calcular = (tamanho: number) => {
    const soma = digitos
      .slice(0, tamanho)
      .reduce(
        (total, atual, indice) => total + atual * (tamanho + 1 - indice),
        0,
      );
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return calcular(9) === digitos[9] && calcular(10) === digitos[10];
}
