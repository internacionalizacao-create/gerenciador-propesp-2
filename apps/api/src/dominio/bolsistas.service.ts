import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
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

export const criarBolsaConcedidaSchema = z
  .object({
    itemPlanejadoId: z.uuid('Selecione a bolsa planejada.'),
    nome: z.string().trim().min(3, 'Informe o nome do bolsista.').max(240),
    email: z.email('Informe um e-mail válido.').max(240).nullish(),
    cpf,
    nivelBeneficiario: z.enum([
      'MESTRADO',
      'DOUTORADO',
      'POS_DOC',
      'DOCENTE',
      'MOBILIDADE_BREVE',
    ]),
    paisOrigem: z.string().trim().min(2, 'Informe o país de origem.').max(120),
    instituicaoOrigem: z
      .string()
      .trim()
      .min(2, 'Informe a universidade ou instituição de origem.')
      .max(240),
    paisDestino: z
      .string()
      .trim()
      .min(2, 'Informe o país de destino.')
      .max(120),
    instituicaoDestino: z
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
  modalidade: string;
  destino: 'BRASIL' | 'EXTERIOR';
  paisOrigem: string | null;
  instituicaoOrigem: string | null;
  paisDestino: string | null;
  instituicaoDestino: string | null;
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
  observacoes: string | null;
}

@Injectable()
export class BolsistasService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async opcoesPlanejamento() {
    return consultar<{
      id: string;
      codigo: string;
      programa: string;
      programaSlug: string;
      ciclo: string;
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
        left join concedidas bc       on bc.item_planejado_id = ip.id
                                      and bc.ano = pa.ano
       where ip.rubrica = 'BOLSAS'
         and ip.status = 'PROGRAMADO'
       group by ip.id, ip.codigo, p.nome, p.slug, c.nome, c.ano_inicio,
                pg.nome, pg.sigla, m.nome, ip.destino,
                ip.vigencia_meses, ic.valor_brl, ip.mes_implementacao
       order by p.nome, c.ano_inicio, pg.sigla, ip.codigo
    `,
    );
  }

  async listar() {
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
             m.nome                        as "modalidade",
             bc.destino                    as "destino",
             bc.pais_origem_nome           as "paisOrigem",
             bc.instituicao_origem_nome    as "instituicaoOrigem",
             bc.pais_destino_nome          as "paisDestino",
             bc.instituicao_destino_nome   as "instituicaoDestino",
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
       order by bc.data_inicio, pe.nome
    `,
    );

    return linhas.map((linha) => ({
      ...linha,
      situacaoTemporal: classificarSituacaoTemporal(linha, hoje),
    }));
  }

  async detalhar(id: string) {
    const bolsa = (await this.listar()).find((item) => item.id === id);
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

  async criar(dto: CriarBolsaConcedida) {
    const ano = Number(dto.dataInicio.slice(0, 4));

    const id = await this.db.transaction(async (tx) => {
      const [item] = await tx
        .select({
          id: s.itemPlanejado.id,
          programaId: s.programa.id,
          cicloId: s.ciclo.id,
          ppgId: s.itemPlanejado.ppgId,
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
          pessoaId,
          modalidadeId: item.modalidadeId,
          destino: item.destino,
          paisOrigemNome: dto.paisOrigem,
          instituicaoOrigemNome: dto.instituicaoOrigem,
          paisDestinoNome: dto.paisDestino,
          instituicaoDestinoNome: dto.instituicaoDestino,
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

    return this.detalhar(id);
  }

  async atualizar(id: string, dto: AtualizarBolsaConcedida) {
    const [atual] = await this.db
      .select({ itemPlanejadoId: s.bolsaConcedida.itemPlanejadoId })
      .from(s.bolsaConcedida)
      .where(eq(s.bolsaConcedida.id, id))
      .limit(1);

    if (!atual) throw new NotFoundException('Bolsa concedida não encontrada.');

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

    return this.detalhar(id);
  }

  async criarProduto(bolsaId: string, dto: ProdutoBolsaDto) {
    await this.exigirBolsa(bolsaId);
    const [produto] = await this.db
      .insert(s.produtoBolsa)
      .values(valoresProduto(bolsaId, dto))
      .returning({ id: s.produtoBolsa.id });
    return this.produto(bolsaId, produto.id);
  }

  async atualizarProduto(
    bolsaId: string,
    produtoId: string,
    dto: ProdutoBolsaDto,
  ) {
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
    return this.produto(bolsaId, produto.id);
  }

  private async produto(bolsaId: string, produtoId: string) {
    const detalhe = await this.detalhar(bolsaId);
    const produto = detalhe.produtos.find((item) => item.id === produtoId);
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return produto;
  }

  private async exigirBolsa(id: string) {
    const [bolsa] = await this.db
      .select({ id: s.bolsaConcedida.id })
      .from(s.bolsaConcedida)
      .where(eq(s.bolsaConcedida.id, id))
      .limit(1);
    if (!bolsa) throw new NotFoundException('Bolsa concedida não encontrada.');
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

function dataHojeEmManaus(data = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Manaus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(data);
  const valor = Object.fromEntries(
    partes.map((parte) => [parte.type, parte.value]),
  );
  return `${valor.year}-${valor.month}-${valor.day}`;
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
