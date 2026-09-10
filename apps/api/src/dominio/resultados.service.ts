import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Produtos da missao e convenios (CG-056).
 *
 * Duas entidades no mesmo servico porque uma so pergunta as separa — "este
 * acordo sobrevive a viagem?" — e a resposta ("sim") e justamente o que faz o
 * produto apontar para o convenio em vez de conte-lo.
 *
 * **A resposta "gerou produto?" nao e uma coluna booleana.** O "sim" ja e um
 * fato consultavel: existe linha em `produto_missao`. So o "nao" precisa ser
 * gravado, porque zero produto tambem significa "ninguem respondeu". Ver o
 * comentario de `missao_comite.sem_produto_declarado_em`.
 */

const textoOpcional = (maximo: number) =>
  z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.string().trim().min(1).max(maximo).nullish(),
  );

const dataSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

const camposProdutoSchema = z.object({
  descricao: textoOpcional(5000),
  situacao: z.enum(s.situacaoProdutoMissaoEnum.enumValues),
  ano: z.coerce.number().int().min(2000).max(2100).nullish(),
  referencia: textoOpcional(500),
  observacoes: textoOpcional(4000),
  instituicoesIds: z.array(z.uuid()).max(20),
  redesIds: z.array(z.uuid()).max(10),
  responsaveis: z
    .array(
      z.object({
        pessoaId: z.uuid(),
        papel: textoOpcional(160),
      }),
    )
    .max(20),
});

export const criarProdutoMissaoSchema = camposProdutoSchema
  .extend({
    tipo: z.enum(s.tipoProdutoMissaoEnum.enumValues),
    titulo: z.string().trim().min(3, 'Informe o titulo do produto.').max(300),
    convenioId: z.uuid().nullish(),
    situacao: z
      .enum(s.situacaoProdutoMissaoEnum.enumValues)
      .default('PREVISTO'),
    instituicoesIds: z.array(z.uuid()).max(20).default([]),
    redesIds: z.array(z.uuid()).max(10).default([]),
    responsaveis: z
      .array(z.object({ pessoaId: z.uuid(), papel: textoOpcional(160) }))
      .max(20)
      .default([]),
  })
  .superRefine(refinarProduto);
export type CriarProdutoMissao = z.infer<typeof criarProdutoMissaoSchema>;

export const atualizarProdutoMissaoSchema = camposProdutoSchema
  .extend({
    tipo: z.enum(s.tipoProdutoMissaoEnum.enumValues),
    titulo: z.string().trim().min(3, 'Informe o titulo do produto.').max(300),
    convenioId: z.uuid().nullish(),
  })
  .partial()
  .superRefine((valor, contexto) => {
    // So refina quando o tipo veio no corpo: numa edicao parcial que nao
    // menciona o tipo, quem sabe a combinacao valida e o servico, que leu a
    // linha atual.
    if (valor.tipo !== undefined) refinarProduto(valor, contexto);
  });
export type AtualizarProdutoMissao = z.infer<
  typeof atualizarProdutoMissaoSchema
>;

function refinarProduto(
  valor: { tipo?: string; convenioId?: string | null },
  contexto: z.RefinementCtx,
): void {
  if (valor.tipo === 'CONVENIO' && !valor.convenioId) {
    contexto.addIssue({
      code: 'custom',
      path: ['convenioId'],
      message:
        'Produto do tipo convênio exige o acordo cadastrado no parceiro.',
    });
  }
  if (valor.tipo !== 'CONVENIO' && valor.convenioId) {
    contexto.addIssue({
      code: 'custom',
      path: ['convenioId'],
      message: 'Somente produto do tipo convênio aponta para um acordo.',
    });
  }
}

/**
 * A resposta da missao sobre produtos.
 *
 * `gerouProduto: true` nao grava nada — apenas retira uma declaracao negativa
 * anterior. O "sim" so se comprova com produto cadastrado, e afirma-lo sem
 * produto deixaria o checklist de encerramento satisfeito por uma marcacao.
 */
export const responderProdutosSchema = z
  .object({
    gerouProduto: z.boolean(),
    justificativa: textoOpcional(2000),
  })
  .superRefine((valor, contexto) => {
    if (valor.gerouProduto && valor.justificativa) {
      contexto.addIssue({
        code: 'custom',
        path: ['justificativa'],
        message: 'Justificativa pertence a resposta negativa.',
      });
    }
  });
export type ResponderProdutos = z.infer<typeof responderProdutosSchema>;

const camposConvenioSchema = z.object({
  titulo: z.string().trim().min(3, 'Informe o titulo do acordo.').max(300),
  tipoAcordo: z.enum(s.tipoAcordoConvenioEnum.enumValues),
  area: textoOpcional(160),
  objetivo: textoOpcional(5000),
  situacao: z.enum(s.situacaoConvenioEnum.enumValues),
  numeroProcesso: textoOpcional(80),
  dataAssinatura: dataSchema.nullish(),
  dataInicio: dataSchema.nullish(),
  dataFim: dataSchema.nullish(),
  observacoes: textoOpcional(4000),
  redesIds: z.array(z.uuid()).max(10),
});

export const criarConvenioSchema = camposConvenioSchema
  .extend({
    instituicaoId: z.uuid(),
    missaoOrigemId: z.uuid().nullish(),
    situacao: z
      .enum(s.situacaoConvenioEnum.enumValues)
      .default('EM_TRAMITACAO'),
    redesIds: z.array(z.uuid()).max(10).default([]),
  })
  .superRefine(refinarConvenio);
export type CriarConvenio = z.infer<typeof criarConvenioSchema>;

export const atualizarConvenioSchema = camposConvenioSchema
  .extend({ missaoOrigemId: z.uuid().nullish() })
  .partial()
  .superRefine((valor, contexto) => {
    if (valor.situacao !== undefined) refinarConvenio(valor, contexto);
  });
export type AtualizarConvenio = z.infer<typeof atualizarConvenioSchema>;

function refinarConvenio(
  valor: { situacao?: string; dataAssinatura?: string | null },
  contexto: z.RefinementCtx,
): void {
  // O banco tem o mesmo check; aqui o erro sai no campo que a tela destaca.
  if (valor.situacao === 'VIGENTE' && !valor.dataAssinatura) {
    contexto.addIssue({
      code: 'custom',
      path: ['dataAssinatura'],
      message: 'Acordo vigente exige a data de assinatura.',
    });
  }
}

export const justificarConvenioSchema = z.object({
  justificativa: z.string().trim().min(3).max(2000),
});
export type JustificarConvenio = z.infer<typeof justificarConvenioSchema>;

export const listarConveniosSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  instituicaoId: z.uuid().optional(),
  redeId: z.uuid().optional(),
  situacao: z.enum(s.situacaoConvenioEnum.enumValues).optional(),
  incluirInativos: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});
export type ListarConvenios = z.infer<typeof listarConveniosSchema>;

// ---------------------------------------------------------------------------

export interface ReferenciaNomeada {
  id: string;
  nome: string;
}

export interface ResponsavelProduto extends ReferenciaNomeada {
  papel: string | null;
}

export interface ConvenioResumo {
  id: string;
  instituicaoId: string;
  instituicao: string;
  titulo: string;
  tipoAcordo: (typeof s.tipoAcordoConvenioEnum.enumValues)[number];
  area: string | null;
  situacao: (typeof s.situacaoConvenioEnum.enumValues)[number];
  numeroProcesso: string | null;
  dataAssinatura: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  ativo: boolean;
  missaoOrigemId: string | null;
  missaoOrigemCodigo: string | null;
  redes: ReferenciaNomeada[];
}

export interface ConvenioDetalhe extends ConvenioResumo {
  objetivo: string | null;
  observacoes: string | null;
  produtos: { id: string; titulo: string; missaoId: string }[];
  quantidadeDocumentos: number;
}

export interface ProdutoMissao {
  id: string;
  missaoId: string;
  tipo: (typeof s.tipoProdutoMissaoEnum.enumValues)[number];
  titulo: string;
  descricao: string | null;
  situacao: (typeof s.situacaoProdutoMissaoEnum.enumValues)[number];
  ano: number | null;
  referencia: string | null;
  observacoes: string | null;
  convenio: ConvenioResumo | null;
  instituicoes: ReferenciaNomeada[];
  redes: ReferenciaNomeada[];
  responsaveis: ResponsavelProduto[];
  quantidadeDocumentos: number;
}

export interface ResultadosDaMissao {
  missaoId: string;
  codigo: string;
  /**
   * `SIM` e derivado da existencia de produto; `NAO` vem da declaracao
   * explicita; `NAO_INFORMADO` e a ausencia das duas coisas — e o unico estado
   * que o checklist de encerramento deve tratar como pendencia.
   */
  respostaProduto: 'SIM' | 'NAO' | 'NAO_INFORMADO';
  declaracaoSemProduto: {
    declaradoEm: Date;
    declaradoPor: string;
    justificativa: string | null;
  } | null;
  produtos: ProdutoMissao[];
}

type DbTransacional = Parameters<Parameters<Database['transaction']>[0]>[0];
type DbLeitura = Pick<Database, 'select'> | DbTransacional;

const camposProdutoAuditaveis = [
  'tipo',
  'titulo',
  'descricao',
  'situacao',
  'ano',
  'referencia',
  'convenioId',
  'observacoes',
] as const;

const camposConvenioAuditaveis = [
  'titulo',
  'tipoAcordo',
  'area',
  'objetivo',
  'situacao',
  'numeroProcesso',
  'dataAssinatura',
  'dataInicio',
  'dataFim',
  'observacoes',
  'missaoOrigemId',
] as const;

@Injectable()
export class ResultadosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // ------------------------------------------------------------- produtos --

  async resultadosDaMissao(
    cicloId: string,
    missaoId: string,
  ): Promise<ResultadosDaMissao> {
    const missao = await this.exigirMissao(cicloId, missaoId, this.db);
    const produtos = await this.carregarProdutos(
      { missaoId: missao.id },
      this.db,
    );

    return {
      missaoId: missao.id,
      codigo: missao.codigo,
      respostaProduto:
        produtos.length > 0
          ? 'SIM'
          : missao.semProdutoDeclaradoEm
            ? 'NAO'
            : 'NAO_INFORMADO',
      declaracaoSemProduto: missao.semProdutoDeclaradoEm
        ? {
            declaradoEm: missao.semProdutoDeclaradoEm,
            declaradoPor: missao.semProdutoDeclaradoPor ?? '',
            justificativa: missao.semProdutoJustificativa,
          }
        : null,
      produtos,
    };
  }

  async criarProduto(
    cicloId: string,
    missaoId: string,
    dto: CriarProdutoMissao,
    usuario: AuthUser,
  ): Promise<ResultadosDaMissao> {
    await this.db.transaction(async (tx) => {
      const missao = await this.exigirMissaoEditavel(cicloId, missaoId, tx);
      await this.validarReferenciasProduto(missao.cicloId, dto, tx);

      const [produto] = await tx
        .insert(s.produtoMissao)
        .values({
          missaoId: missao.id,
          tipo: dto.tipo,
          titulo: dto.titulo,
          descricao: dto.descricao ?? null,
          situacao: dto.situacao,
          ano: dto.ano ?? null,
          referencia: dto.referencia ?? null,
          convenioId: dto.convenioId ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.produtoMissao.id });

      await this.gravarVinculos(produto.id, dto, tx);

      // Cadastrar produto responde "sim" por si so. A declaracao negativa
      // anterior deixa de ser verdade no mesmo instante, e mante-la faria a
      // missao afirmar as duas coisas ao mesmo tempo.
      await this.limparDeclaracaoSemProduto(missao, usuario, tx);

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PRODUTO_MISSAO',
        entidadeId: produto.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          tipo: dto.tipo,
          titulo: dto.titulo,
          situacao: dto.situacao,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });

    return this.resultadosDaMissao(cicloId, missaoId);
  }

  async atualizarProduto(
    cicloId: string,
    missaoId: string,
    produtoId: string,
    dto: AtualizarProdutoMissao,
    usuario: AuthUser,
  ): Promise<ResultadosDaMissao> {
    await this.db.transaction(async (tx) => {
      const missao = await this.exigirMissaoEditavel(cicloId, missaoId, tx);
      const atual = await this.exigirProduto(missao.id, produtoId, tx);

      const tipo = dto.tipo ?? atual.tipo;
      const convenioId =
        dto.convenioId !== undefined
          ? (dto.convenioId ?? null)
          : atual.convenioId;
      // A combinacao valida depende da linha ja gravada, e nao so do corpo:
      // uma edicao que muda apenas o tipo tem de ser recusada aqui, porque o
      // schema sozinho nao conhece o convenio que ja estava apontado.
      if (tipo === 'CONVENIO' && !convenioId) {
        throw new BadRequestException(
          'Produto do tipo convênio exige o acordo cadastrado no parceiro.',
        );
      }
      if (tipo !== 'CONVENIO' && convenioId) {
        throw new BadRequestException(
          'Somente produto do tipo convênio aponta para um acordo.',
        );
      }
      await this.validarReferenciasProduto(
        missao.cicloId,
        { ...dto, convenioId },
        tx,
      );

      const alteracoes: Record<string, unknown> = {};
      const auditoria: (typeof s.registroAuditoria.$inferInsert)[] = [];
      for (const campo of camposProdutoAuditaveis) {
        const informado =
          campo === 'convenioId' ? convenioId : (dto as never)[campo];
        if (campo !== 'convenioId' && (dto as never)[campo] === undefined) {
          continue;
        }
        const anterior = (atual as never)[campo] ?? null;
        const novo = informado ?? null;
        if (String(anterior ?? '') === String(novo ?? '')) continue;
        alteracoes[campo] = novo;
        auditoria.push({
          entidadeTipo: 'PRODUTO_MISSAO',
          entidadeId: atual.id,
          acao: 'EDICAO',
          campo,
          valorAnterior: anterior === null ? null : String(anterior),
          valorNovo: novo === null ? null : String(novo),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
      }

      if (Object.keys(alteracoes).length > 0) {
        await tx
          .update(s.produtoMissao)
          .set({ ...alteracoes, atualizadoEm: new Date() })
          .where(eq(s.produtoMissao.id, atual.id));
      }
      await this.gravarVinculos(atual.id, dto, tx, auditoria, usuario);
      if (auditoria.length > 0) {
        await tx.insert(s.registroAuditoria).values(auditoria);
      }
    });

    return this.resultadosDaMissao(cicloId, missaoId);
  }

  /**
   * Remove o produto — e recusa quando ha documento apontado para ele.
   *
   * `anexo` e polimorfico e nao tem chave estrangeira (CG-014), entao apagar a
   * linha nao apagaria nem invalidaria o arquivo: deixaria um documento
   * apontando para um id que nunca mais existe. E a mesma regra da despesa
   * documentada na CG-052.
   */
  async removerProduto(
    cicloId: string,
    missaoId: string,
    produtoId: string,
    usuario: AuthUser,
  ): Promise<ResultadosDaMissao> {
    await this.db.transaction(async (tx) => {
      const missao = await this.exigirMissaoEditavel(cicloId, missaoId, tx);
      const atual = await this.exigirProduto(missao.id, produtoId, tx);

      const [documento] = await tx
        .select({ id: s.anexo.id })
        .from(s.anexo)
        .where(
          and(
            eq(s.anexo.entidadeTipo, 'PRODUTO_MISSAO'),
            eq(s.anexo.entidadeId, atual.id),
            eq(s.anexo.ativo, true),
          ),
        )
        .limit(1);
      if (documento) {
        throw new ConflictException(
          'Produto com documento anexado não pode ser removido. Remova o documento antes.',
        );
      }

      await this.exigirRespostaPreservada(missao, atual.id, tx);

      await tx.delete(s.produtoMissao).where(eq(s.produtoMissao.id, atual.id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PRODUTO_MISSAO',
        entidadeId: atual.id,
        acao: 'EXCLUSAO',
        valorAnterior: JSON.stringify({
          tipo: atual.tipo,
          titulo: atual.titulo,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });

    return this.resultadosDaMissao(cicloId, missaoId);
  }

  async responderProdutos(
    cicloId: string,
    missaoId: string,
    dto: ResponderProdutos,
    usuario: AuthUser,
  ): Promise<ResultadosDaMissao> {
    await this.db.transaction(async (tx) => {
      const missao = await this.exigirMissaoEditavel(cicloId, missaoId, tx);

      if (dto.gerouProduto) {
        await this.exigirRespostaPreservada(missao, null, tx);
        await this.limparDeclaracaoSemProduto(missao, usuario, tx);
        return;
      }

      const [produto] = await tx
        .select({ id: s.produtoMissao.id })
        .from(s.produtoMissao)
        .where(eq(s.produtoMissao.missaoId, missao.id))
        .limit(1);
      if (produto) {
        throw new ConflictException(
          'A missão tem produto cadastrado; remova-o antes de declarar que não houve produto.',
        );
      }

      await tx
        .update(s.missaoComite)
        .set({
          semProdutoDeclaradoEm: new Date(),
          semProdutoDeclaradoPor: nomeDoUsuario(usuario) ?? usuario.id,
          semProdutoJustificativa: dto.justificativa ?? null,
          atualizadoEm: new Date(),
        })
        .where(eq(s.missaoComite.id, missao.id));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MISSAO_COMITE',
        entidadeId: missao.id,
        acao: 'EDICAO',
        campo: 'semProdutoDeclaradoEm',
        valorAnterior: missao.semProdutoDeclaradoEm
          ? missao.semProdutoDeclaradoEm.toISOString()
          : null,
        valorNovo: 'declarado',
        justificativa: dto.justificativa ?? null,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });

    return this.resultadosDaMissao(cicloId, missaoId);
  }

  // ------------------------------------------------------------ convenios --

  async listarConvenios(filtros: ListarConvenios): Promise<ConvenioResumo[]> {
    const condicoes: SQL[] = [];
    if (!filtros.incluirInativos) condicoes.push(eq(s.convenio.ativo, true));
    if (filtros.instituicaoId) {
      condicoes.push(eq(s.convenio.instituicaoId, filtros.instituicaoId));
    }
    if (filtros.situacao) {
      condicoes.push(eq(s.convenio.situacao, filtros.situacao));
    }
    if (filtros.busca) {
      const termo = `%${filtros.busca}%`;
      const busca = or(
        ilike(s.convenio.titulo, termo),
        ilike(s.instituicao.nome, termo),
      );
      if (busca) condicoes.push(busca);
    }
    if (filtros.redeId) {
      // `exists`, nunca `join`: o convenio de duas redes apareceria duas vezes
      // na lista de "todas as redes" — o mesmo erro que a CG-027 evitou na
      // missao multirrede.
      condicoes.push(sql`exists (
        select 1
          from ${s.convenioRede}
         where ${s.convenioRede.convenioId} = ${s.convenio.id}
           and ${s.convenioRede.redeId} = ${filtros.redeId}
      )`);
    }

    const linhas = await this.db
      .select(colunasConvenio())
      .from(s.convenio)
      .innerJoin(s.instituicao, eq(s.instituicao.id, s.convenio.instituicaoId))
      .leftJoin(
        s.missaoComite,
        eq(s.missaoComite.id, s.convenio.missaoOrigemId),
      )
      .where(condicoes.length > 0 ? and(...condicoes) : undefined)
      .orderBy(asc(s.instituicao.nome), desc(s.convenio.dataInicio))
      .limit(200);

    const redes = await this.redesPorConvenio(
      linhas.map((linha) => linha.id),
      this.db,
    );
    return linhas.map((linha) => ({
      ...linha,
      redes: redes.get(linha.id) ?? [],
    }));
  }

  async detalharConvenio(id: string): Promise<ConvenioDetalhe> {
    const [linha] = await this.db
      .select({
        ...colunasConvenio(),
        objetivo: s.convenio.objetivo,
        observacoes: s.convenio.observacoes,
      })
      .from(s.convenio)
      .innerJoin(s.instituicao, eq(s.instituicao.id, s.convenio.instituicaoId))
      .leftJoin(
        s.missaoComite,
        eq(s.missaoComite.id, s.convenio.missaoOrigemId),
      )
      .where(eq(s.convenio.id, id))
      .limit(1);
    if (!linha) throw new NotFoundException('Convênio não encontrado.');

    const [redes, produtos, documentos] = await Promise.all([
      this.redesPorConvenio([id], this.db),
      this.db
        .select({
          id: s.produtoMissao.id,
          titulo: s.produtoMissao.titulo,
          missaoId: s.produtoMissao.missaoId,
        })
        .from(s.produtoMissao)
        .where(eq(s.produtoMissao.convenioId, id))
        .orderBy(asc(s.produtoMissao.titulo)),
      this.contarDocumentos('CONVENIO', [id], this.db),
    ]);

    return {
      ...linha,
      redes: redes.get(id) ?? [],
      produtos,
      quantidadeDocumentos: documentos.get(id) ?? 0,
    };
  }

  async criarConvenio(
    dto: CriarConvenio,
    usuario: AuthUser,
  ): Promise<ConvenioDetalhe> {
    const id = await this.db.transaction(async (tx) => {
      await this.exigirInstituicoes([dto.instituicaoId], tx);
      const cicloId = await this.cicloDaOrigem(dto.missaoOrigemId ?? null, tx);
      await this.exigirRedes(dto.redesIds, cicloId, tx);

      const [criado] = await tx
        .insert(s.convenio)
        .values({
          instituicaoId: dto.instituicaoId,
          missaoOrigemId: dto.missaoOrigemId ?? null,
          titulo: dto.titulo,
          tipoAcordo: dto.tipoAcordo,
          area: dto.area ?? null,
          objetivo: dto.objetivo ?? null,
          situacao: dto.situacao,
          numeroProcesso: dto.numeroProcesso ?? null,
          dataAssinatura: dto.dataAssinatura ?? null,
          dataInicio: dto.dataInicio ?? null,
          dataFim: dto.dataFim ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.convenio.id });

      if (dto.redesIds.length > 0) {
        await tx
          .insert(s.convenioRede)
          .values(
            dto.redesIds.map((redeId) => ({ convenioId: criado.id, redeId })),
          );
      }

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'CONVENIO',
        entidadeId: criado.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          titulo: dto.titulo,
          tipoAcordo: dto.tipoAcordo,
          situacao: dto.situacao,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
      return criado.id;
    });

    return this.detalharConvenio(id);
  }

  async atualizarConvenio(
    id: string,
    dto: AtualizarConvenio,
    usuario: AuthUser,
  ): Promise<ConvenioDetalhe> {
    await this.db.transaction(async (tx) => {
      const atual = await this.exigirConvenio(id, tx);
      const situacao = dto.situacao ?? atual.situacao;
      const dataAssinatura =
        dto.dataAssinatura !== undefined
          ? (dto.dataAssinatura ?? null)
          : atual.dataAssinatura;
      if (situacao === 'VIGENTE' && !dataAssinatura) {
        throw new BadRequestException(
          'Acordo vigente exige a data de assinatura.',
        );
      }

      const alteracoes: Record<string, unknown> = {};
      const auditoria: (typeof s.registroAuditoria.$inferInsert)[] = [];
      for (const campo of camposConvenioAuditaveis) {
        if ((dto as never)[campo] === undefined) continue;
        const anterior = (atual as never)[campo] ?? null;
        const novo = (dto as never)[campo] ?? null;
        if (String(anterior ?? '') === String(novo ?? '')) continue;
        alteracoes[campo] = novo;
        auditoria.push({
          entidadeTipo: 'CONVENIO',
          entidadeId: id,
          acao: 'EDICAO',
          campo,
          valorAnterior: anterior === null ? null : String(anterior),
          valorNovo: novo === null ? null : String(novo),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
      }

      if (dto.missaoOrigemId !== undefined || dto.redesIds !== undefined) {
        const cicloId = await this.cicloDaOrigem(
          dto.missaoOrigemId !== undefined
            ? (dto.missaoOrigemId ?? null)
            : atual.missaoOrigemId,
          tx,
        );
        if (dto.redesIds !== undefined) {
          await this.exigirRedes(dto.redesIds, cicloId, tx);
          await this.trocarRedes(id, dto.redesIds, tx, auditoria, usuario);
        }
      }

      if (Object.keys(alteracoes).length > 0) {
        await tx
          .update(s.convenio)
          .set({ ...alteracoes, atualizadoEm: new Date() })
          .where(eq(s.convenio.id, id));
      }
      if (auditoria.length > 0) {
        await tx.insert(s.registroAuditoria).values(auditoria);
      }
    });

    return this.detalharConvenio(id);
  }

  /**
   * Nao ha exclusao de convenio, so inativacao — mesma decisao dos parceiros
   * (CG-026). O produto que aponta para ele guarda o vinculo historico, e a
   * chave estrangeira e `restrict` justamente para que nao exista outro
   * caminho.
   */
  async inativarConvenio(
    id: string,
    dto: JustificarConvenio,
    usuario: AuthUser,
  ): Promise<ConvenioDetalhe> {
    return this.alternarConvenio(id, false, dto, usuario);
  }

  async reativarConvenio(
    id: string,
    dto: JustificarConvenio,
    usuario: AuthUser,
  ): Promise<ConvenioDetalhe> {
    return this.alternarConvenio(id, true, dto, usuario);
  }

  private async alternarConvenio(
    id: string,
    ativo: boolean,
    dto: JustificarConvenio,
    usuario: AuthUser,
  ): Promise<ConvenioDetalhe> {
    await this.db.transaction(async (tx) => {
      const atual = await this.exigirConvenio(id, tx);
      if (atual.ativo === ativo) {
        throw new ConflictException(
          ativo ? 'Convênio já está ativo.' : 'Convênio já está inativo.',
        );
      }
      await tx
        .update(s.convenio)
        .set({ ativo, atualizadoEm: new Date() })
        .where(eq(s.convenio.id, id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'CONVENIO',
        entidadeId: id,
        acao: 'EDICAO',
        campo: 'ativo',
        valorAnterior: String(atual.ativo),
        valorNovo: String(ativo),
        justificativa: dto.justificativa,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });
    return this.detalharConvenio(id);
  }

  // ------------------------------------------------------------- internos --

  /**
   * Carrega produtos com suas colecoes em consultas separadas.
   *
   * Um `join` com instituicoes, redes e responsaveis multiplicaria a linha do
   * produto pelo produto cartesiano das tres — tres instituicoes e dois
   * responsaveis dariam seis linhas do mesmo produto, e qualquer contagem feita
   * sobre isso mentiria.
   */
  private async carregarProdutos(
    filtro: { missaoId?: string; ids?: string[] },
    db: DbLeitura,
  ): Promise<ProdutoMissao[]> {
    const condicao = filtro.missaoId
      ? eq(s.produtoMissao.missaoId, filtro.missaoId)
      : filtro.ids && filtro.ids.length > 0
        ? inArray(s.produtoMissao.id, filtro.ids)
        : undefined;
    if (!condicao) return [];

    const linhas = await db
      .select({
        id: s.produtoMissao.id,
        missaoId: s.produtoMissao.missaoId,
        tipo: s.produtoMissao.tipo,
        titulo: s.produtoMissao.titulo,
        descricao: s.produtoMissao.descricao,
        situacao: s.produtoMissao.situacao,
        ano: s.produtoMissao.ano,
        referencia: s.produtoMissao.referencia,
        observacoes: s.produtoMissao.observacoes,
        convenioId: s.produtoMissao.convenioId,
      })
      .from(s.produtoMissao)
      .where(condicao)
      .orderBy(asc(s.produtoMissao.titulo));
    if (linhas.length === 0) return [];

    const ids = linhas.map((linha) => linha.id);
    const conveniosIds = linhas
      .map((linha) => linha.convenioId)
      .filter((valor): valor is string => valor !== null);

    const [instituicoes, redes, responsaveis, documentos, convenios] =
      await Promise.all([
        db
          .select({
            produtoId: s.produtoMissaoInstituicao.produtoId,
            id: s.instituicao.id,
            nome: s.instituicao.nome,
          })
          .from(s.produtoMissaoInstituicao)
          .innerJoin(
            s.instituicao,
            eq(s.instituicao.id, s.produtoMissaoInstituicao.instituicaoId),
          )
          .where(inArray(s.produtoMissaoInstituicao.produtoId, ids))
          .orderBy(asc(s.instituicao.nome)),
        db
          .select({
            produtoId: s.produtoMissaoRede.produtoId,
            id: s.redeCoordenadora.id,
            nome: s.redeCoordenadora.nome,
          })
          .from(s.produtoMissaoRede)
          .innerJoin(
            s.redeCoordenadora,
            eq(s.redeCoordenadora.id, s.produtoMissaoRede.redeId),
          )
          .where(inArray(s.produtoMissaoRede.produtoId, ids))
          .orderBy(asc(s.redeCoordenadora.nome)),
        db
          .select({
            produtoId: s.produtoMissaoResponsavel.produtoId,
            id: s.pessoa.id,
            nome: s.pessoa.nome,
            papel: s.produtoMissaoResponsavel.papel,
          })
          .from(s.produtoMissaoResponsavel)
          .innerJoin(
            s.pessoa,
            eq(s.pessoa.id, s.produtoMissaoResponsavel.pessoaId),
          )
          .where(inArray(s.produtoMissaoResponsavel.produtoId, ids))
          .orderBy(asc(s.pessoa.nome)),
        this.contarDocumentos('PRODUTO_MISSAO', ids, db),
        this.carregarConvenios(conveniosIds, db),
      ]);

    const convenioPorId = new Map(
      convenios.map((convenio): [string, ConvenioResumo] => [
        convenio.id,
        convenio,
      ]),
    );

    return linhas.map((linha) => ({
      id: linha.id,
      missaoId: linha.missaoId,
      tipo: linha.tipo,
      titulo: linha.titulo,
      descricao: linha.descricao,
      situacao: linha.situacao,
      ano: linha.ano,
      referencia: linha.referencia,
      observacoes: linha.observacoes,
      convenio: linha.convenioId
        ? (convenioPorId.get(linha.convenioId) ?? null)
        : null,
      instituicoes: agrupar(instituicoes, linha.id, (item) => ({
        id: item.id,
        nome: item.nome,
      })),
      redes: agrupar(redes, linha.id, (item) => ({
        id: item.id,
        nome: item.nome,
      })),
      responsaveis: agrupar(responsaveis, linha.id, (item) => ({
        id: item.id,
        nome: item.nome,
        papel: item.papel,
      })),
      quantidadeDocumentos: documentos.get(linha.id) ?? 0,
    }));
  }

  private async carregarConvenios(
    ids: string[],
    db: DbLeitura,
  ): Promise<ConvenioResumo[]> {
    if (ids.length === 0) return [];
    const linhas = await db
      .select(colunasConvenio())
      .from(s.convenio)
      .innerJoin(s.instituicao, eq(s.instituicao.id, s.convenio.instituicaoId))
      .leftJoin(
        s.missaoComite,
        eq(s.missaoComite.id, s.convenio.missaoOrigemId),
      )
      .where(inArray(s.convenio.id, ids));
    const redes = await this.redesPorConvenio(ids, db);
    return linhas.map((linha) => ({
      ...linha,
      redes: redes.get(linha.id) ?? [],
    }));
  }

  private async redesPorConvenio(
    ids: string[],
    db: DbLeitura,
  ): Promise<Map<string, ReferenciaNomeada[]>> {
    const mapa = new Map<string, ReferenciaNomeada[]>();
    if (ids.length === 0) return mapa;
    const linhas = await db
      .select({
        convenioId: s.convenioRede.convenioId,
        id: s.redeCoordenadora.id,
        nome: s.redeCoordenadora.nome,
      })
      .from(s.convenioRede)
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.convenioRede.redeId),
      )
      .where(inArray(s.convenioRede.convenioId, ids))
      .orderBy(asc(s.redeCoordenadora.nome));
    for (const linha of linhas) {
      const atual = mapa.get(linha.convenioId) ?? [];
      atual.push({ id: linha.id, nome: linha.nome });
      mapa.set(linha.convenioId, atual);
    }
    return mapa;
  }

  private async contarDocumentos(
    tipo: 'PRODUTO_MISSAO' | 'CONVENIO',
    ids: string[],
    db: DbLeitura,
  ): Promise<Map<string, number>> {
    const mapa = new Map<string, number>();
    if (ids.length === 0) return mapa;
    const linhas = await db
      .select({ entidadeId: s.anexo.entidadeId, id: s.anexo.id })
      .from(s.anexo)
      .where(
        and(
          eq(s.anexo.entidadeTipo, tipo),
          inArray(s.anexo.entidadeId, ids),
          eq(s.anexo.ativo, true),
        ),
      );
    for (const linha of linhas) {
      mapa.set(linha.entidadeId, (mapa.get(linha.entidadeId) ?? 0) + 1);
    }
    return mapa;
  }

  private async exigirMissao(cicloId: string, missaoId: string, db: DbLeitura) {
    const [missao] = await db
      .select({
        id: s.missaoComite.id,
        cicloId: s.missaoComite.cicloId,
        codigo: s.missaoComite.codigo,
        status: s.missaoComite.status,
        semProdutoDeclaradoEm: s.missaoComite.semProdutoDeclaradoEm,
        semProdutoDeclaradoPor: s.missaoComite.semProdutoDeclaradoPor,
        semProdutoJustificativa: s.missaoComite.semProdutoJustificativa,
      })
      .from(s.missaoComite)
      .where(
        and(
          eq(s.missaoComite.id, missaoId),
          eq(s.missaoComite.cicloId, cicloId),
        ),
      )
      .limit(1);
    if (!missao) throw new NotFoundException('Missão não encontrada.');
    return missao;
  }

  /**
   * Missao cancelada nao recebe resultado, pela mesma razao que nao recebe
   * relato: registrar produto de viagem que nao aconteceu.
   *
   * `EM_ANALISE` **nao** bloqueia. O congelamento da CG-037 protege o que o
   * Comite esta lendo — objetivo, roteiro, orcamento —, e produto e o que a
   * missao rendeu depois de aprovada e realizada.
   */
  /**
   * Missao encerrada nao volta a "resposta indefinida" (CG-059).
   *
   * Encerrar afirma que os requisitos foram atendidos, e a resposta sobre
   * produtos e um deles. Como o checklist e recalculado a cada leitura — e nao
   * gravado, de proposito (CG-058) —, apagar a resposta depois faria a
   * afirmacao virar mentira em silencio: a missao ficaria fechada exibindo
   * pendencia. E o mesmo risco que a CG-038 resolveu fotografando os documentos
   * analisados.
   *
   * **O congelamento e so este.** Cadastrar produto novo, editar e ate remover
   * um entre varios continuam liberados numa missao encerrada: o artigo
   * publicado meses depois da viagem e o caso normal, e travar tudo empurraria
   * o registro para fora do sistema. O que se recusa e exatamente a operacao
   * que zera a resposta — remover o ultimo produto sem declaracao, ou limpar a
   * declaracao sem produto. A saida e reabrir a missao, que deixa rastro de
   * quem autorizou.
   *
   * `ignorarProdutoId` existe porque a checagem roda **antes** do delete: sem
   * ele, o produto prestes a sair ainda contaria e a recusa nunca dispararia.
   */
  private async exigirRespostaPreservada(
    missao: { id: string; status: string; semProdutoDeclaradoEm: Date | null },
    ignorarProdutoId: string | null,
    db: DbLeitura,
  ): Promise<void> {
    if (missao.status !== 'CONCLUIDA') return;

    const [restante] = await db
      .select({ id: s.produtoMissao.id })
      .from(s.produtoMissao)
      .where(
        ignorarProdutoId
          ? and(
              eq(s.produtoMissao.missaoId, missao.id),
              ne(s.produtoMissao.id, ignorarProdutoId),
            )
          : eq(s.produtoMissao.missaoId, missao.id),
      )
      .limit(1);

    if (restante) return;
    if (ignorarProdutoId && missao.semProdutoDeclaradoEm) return;

    throw new ConflictException(
      'Missão encerrada não pode ficar sem resposta sobre produtos. ' +
        'Reabra a missão antes de desfazer a resposta.',
    );
  }

  private async exigirMissaoEditavel(
    cicloId: string,
    missaoId: string,
    db: DbLeitura,
  ) {
    const missao = await this.exigirMissao(cicloId, missaoId, db);
    if (missao.status === 'CANCELADA') {
      throw new ConflictException('Missão cancelada não recebe resultados.');
    }
    return missao;
  }

  private async exigirProduto(
    missaoId: string,
    produtoId: string,
    db: DbLeitura,
  ) {
    const [produto] = await db
      .select()
      .from(s.produtoMissao)
      .where(
        and(
          eq(s.produtoMissao.id, produtoId),
          eq(s.produtoMissao.missaoId, missaoId),
        ),
      )
      .limit(1);
    // 404 e nao 403 quando o produto e de outra missao: "existe, mas nao e
    // desta missao" ja entregaria a existencia do registro.
    if (!produto) throw new NotFoundException('Produto não encontrado.');
    return produto;
  }

  private async exigirConvenio(id: string, db: DbLeitura) {
    const [convenio] = await db
      .select()
      .from(s.convenio)
      .where(eq(s.convenio.id, id))
      .limit(1);
    if (!convenio) throw new NotFoundException('Convênio não encontrado.');
    return convenio;
  }

  private async validarReferenciasProduto(
    cicloId: string,
    dto: {
      convenioId?: string | null;
      instituicoesIds?: string[];
      redesIds?: string[];
      responsaveis?: { pessoaId: string }[];
    },
    db: DbLeitura,
  ): Promise<void> {
    if (dto.convenioId) {
      const convenio = await this.exigirConvenio(dto.convenioId, db);
      if (!convenio.ativo) {
        throw new BadRequestException(
          'Convênio inativo não pode ser apontado por um produto.',
        );
      }
    }
    if (dto.instituicoesIds?.length) {
      await this.exigirInstituicoes(dto.instituicoesIds, db);
    }
    if (dto.redesIds?.length) {
      await this.exigirRedes(dto.redesIds, cicloId, db);
    }
    if (dto.responsaveis?.length) {
      const ids = [...new Set(dto.responsaveis.map((item) => item.pessoaId))];
      const encontradas = await db
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(inArray(s.pessoa.id, ids));
      if (encontradas.length !== ids.length) {
        throw new BadRequestException('Pessoa responsável não encontrada.');
      }
    }
  }

  private async exigirInstituicoes(
    ids: string[],
    db: DbLeitura,
  ): Promise<void> {
    const unicos = [...new Set(ids)];
    const encontradas = await db
      .select({ id: s.instituicao.id })
      .from(s.instituicao)
      .where(inArray(s.instituicao.id, unicos));
    if (encontradas.length !== unicos.length) {
      throw new BadRequestException('Instituição não encontrada.');
    }
  }

  /**
   * Rede pertence a um ciclo, e o banco sozinho nao consegue afirmar que a rede
   * apontada e a do ciclo da missao — a mesma checagem que `missao_rede` faz no
   * servico. Convenio sem missao de origem aceita rede de qualquer ciclo: ele e
   * institucional e sobrevive ao ciclo que o originou.
   */
  private async exigirRedes(
    ids: string[],
    cicloId: string | null,
    db: DbLeitura,
  ): Promise<void> {
    const unicos = [...new Set(ids)];
    if (unicos.length === 0) return;
    const encontradas = await db
      .select({
        id: s.redeCoordenadora.id,
        cicloId: s.redeCoordenadora.cicloId,
      })
      .from(s.redeCoordenadora)
      .where(inArray(s.redeCoordenadora.id, unicos));
    if (encontradas.length !== unicos.length) {
      throw new BadRequestException('Rede coordenadora não encontrada.');
    }
    if (cicloId && encontradas.some((rede) => rede.cicloId !== cicloId)) {
      throw new BadRequestException(
        'Rede coordenadora pertence a outro ciclo.',
      );
    }
  }

  private async cicloDaOrigem(
    missaoOrigemId: string | null,
    db: DbLeitura,
  ): Promise<string | null> {
    if (!missaoOrigemId) return null;
    const [missao] = await db
      .select({ cicloId: s.missaoComite.cicloId })
      .from(s.missaoComite)
      .where(eq(s.missaoComite.id, missaoOrigemId))
      .limit(1);
    if (!missao) {
      throw new BadRequestException('Missão de origem não encontrada.');
    }
    return missao.cicloId;
  }

  private async gravarVinculos(
    produtoId: string,
    dto: {
      instituicoesIds?: string[];
      redesIds?: string[];
      responsaveis?: { pessoaId: string; papel?: string | null }[];
    },
    tx: DbTransacional,
    auditoria?: (typeof s.registroAuditoria.$inferInsert)[],
    usuario?: AuthUser,
  ): Promise<void> {
    const registrar = (campo: string, valor: string) => {
      if (!auditoria || !usuario) return;
      auditoria.push({
        entidadeTipo: 'PRODUTO_MISSAO',
        entidadeId: produtoId,
        acao: 'EDICAO',
        campo,
        valorNovo: valor,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    };

    if (dto.instituicoesIds !== undefined) {
      await tx
        .delete(s.produtoMissaoInstituicao)
        .where(eq(s.produtoMissaoInstituicao.produtoId, produtoId));
      const unicos = [...new Set(dto.instituicoesIds)];
      if (unicos.length > 0) {
        await tx
          .insert(s.produtoMissaoInstituicao)
          .values(
            unicos.map((instituicaoId) => ({ produtoId, instituicaoId })),
          );
      }
      if (auditoria) registrar('instituicoes', String(unicos.length));
    }

    if (dto.redesIds !== undefined) {
      await tx
        .delete(s.produtoMissaoRede)
        .where(eq(s.produtoMissaoRede.produtoId, produtoId));
      const unicos = [...new Set(dto.redesIds)];
      if (unicos.length > 0) {
        await tx
          .insert(s.produtoMissaoRede)
          .values(unicos.map((redeId) => ({ produtoId, redeId })));
      }
      if (auditoria) registrar('redes', String(unicos.length));
    }

    if (dto.responsaveis !== undefined) {
      await tx
        .delete(s.produtoMissaoResponsavel)
        .where(eq(s.produtoMissaoResponsavel.produtoId, produtoId));
      const porPessoa = new Map(
        dto.responsaveis.map((item) => [item.pessoaId, item.papel ?? null]),
      );
      if (porPessoa.size > 0) {
        await tx.insert(s.produtoMissaoResponsavel).values(
          [...porPessoa].map(([pessoaId, papel]) => ({
            produtoId,
            pessoaId,
            papel,
          })),
        );
      }
      if (auditoria) registrar('responsaveis', String(porPessoa.size));
    }
  }

  private async trocarRedes(
    convenioId: string,
    redesIds: string[],
    tx: DbTransacional,
    auditoria: (typeof s.registroAuditoria.$inferInsert)[],
    usuario: AuthUser,
  ): Promise<void> {
    await tx
      .delete(s.convenioRede)
      .where(eq(s.convenioRede.convenioId, convenioId));
    const unicos = [...new Set(redesIds)];
    if (unicos.length > 0) {
      await tx
        .insert(s.convenioRede)
        .values(unicos.map((redeId) => ({ convenioId, redeId })));
    }
    auditoria.push({
      entidadeTipo: 'CONVENIO',
      entidadeId: convenioId,
      acao: 'EDICAO',
      campo: 'redes',
      valorNovo: String(unicos.length),
      usuarioId: usuario.id,
      usuarioNome: nomeDoUsuario(usuario),
    });
  }

  private async limparDeclaracaoSemProduto(
    missao: { id: string; semProdutoDeclaradoEm: Date | null },
    usuario: AuthUser,
    tx: DbTransacional,
  ): Promise<void> {
    if (!missao.semProdutoDeclaradoEm) return;
    await tx
      .update(s.missaoComite)
      .set({
        semProdutoDeclaradoEm: null,
        semProdutoDeclaradoPor: null,
        semProdutoJustificativa: null,
        atualizadoEm: new Date(),
      })
      .where(eq(s.missaoComite.id, missao.id));
    await tx.insert(s.registroAuditoria).values({
      entidadeTipo: 'MISSAO_COMITE',
      entidadeId: missao.id,
      acao: 'EDICAO',
      campo: 'semProdutoDeclaradoEm',
      valorAnterior: missao.semProdutoDeclaradoEm.toISOString(),
      valorNovo: null,
      usuarioId: usuario.id,
      usuarioNome: nomeDoUsuario(usuario),
    });
  }
}

function colunasConvenio() {
  return {
    id: s.convenio.id,
    instituicaoId: s.convenio.instituicaoId,
    instituicao: s.instituicao.nome,
    titulo: s.convenio.titulo,
    tipoAcordo: s.convenio.tipoAcordo,
    area: s.convenio.area,
    situacao: s.convenio.situacao,
    numeroProcesso: s.convenio.numeroProcesso,
    dataAssinatura: s.convenio.dataAssinatura,
    dataInicio: s.convenio.dataInicio,
    dataFim: s.convenio.dataFim,
    ativo: s.convenio.ativo,
    missaoOrigemId: s.convenio.missaoOrigemId,
    missaoOrigemCodigo: s.missaoComite.codigo,
  };
}

function agrupar<T extends { produtoId: string }, R>(
  linhas: T[],
  produtoId: string,
  mapear: (linha: T) => R,
): R[] {
  return linhas.filter((linha) => linha.produtoId === produtoId).map(mapear);
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.email ?? null;
}
