import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import type { Permission } from '../auth/permissions';
import { ArmazenamentoService } from '../arquivos/armazenamento.service';
import {
  EXTENSOES_ACEITAS,
  identificarTipo,
} from '../arquivos/tipos-permitidos';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { categoriaPermitidaParaDespesa } from './documentos-prestacao';

/**
 * Upload e download de documentos (CG-051), sobre o modelo decidido na CG-014.
 *
 * Três invariantes sustentam este serviço:
 *
 * 1. **o tipo é decidido pelo conteúdo**, nunca pela extensão ou pelo
 *    `Content-Type` — os dois vêm do cliente;
 * 2. **o caminho interno nunca sai daqui**. O cliente conhece o `id` do anexo e
 *    mais nada; o download passa por endpoint autenticado;
 * 3. **a permissão é a da entidade de destino**. Anexar à prestação exige
 *    `prestacao:write`; ao parceiro, `parceiro:write`. Um documento não tem
 *    permissão própria porque ele não existe sozinho — ele é sempre documento
 *    *de* alguma coisa, e é essa coisa que define quem pode vê-lo.
 */

/** Limite configurável (CG-051). 25 MB acomoda PDF digitalizado e foto. */
const TAMANHO_MAXIMO = Number(
  process.env.ANEXO_TAMANHO_MAXIMO ?? 25 * 1024 * 1024,
);

/**
 * Política por entidade de destino.
 *
 * A tabela é explícita de propósito: um `default` permissivo faria um
 * `entidade_tipo` novo nascer sem dono, legível por qualquer um que tenha
 * qualquer permissão.
 */
const POLITICA: Record<
  (typeof s.entidadeAnexoEnum.enumValues)[number],
  {
    ler: Permission;
    escrever: Permission;
    tabela:
      | 'missao'
      | 'atividade'
      | 'prestacao'
      | 'despesa'
      | 'cotacao'
      | 'instituicao';
  }
> = {
  MISSAO_COMITE: {
    ler: 'missao:read',
    escrever: 'missao:edit',
    tabela: 'missao',
  },
  ATIVIDADE_MISSAO: {
    ler: 'missao:read',
    escrever: 'missao:edit',
    tabela: 'atividade',
  },
  PRESTACAO_CONTAS_MISSAO: {
    ler: 'prestacao:read',
    escrever: 'prestacao:write',
    tabela: 'prestacao',
  },
  DESPESA_MISSAO: {
    ler: 'prestacao:read',
    escrever: 'prestacao:write',
    tabela: 'despesa',
  },
  COTACAO_PASSAGEM: {
    ler: 'prestacao:read',
    escrever: 'prestacao:write',
    tabela: 'cotacao',
  },
  INSTITUICAO: {
    ler: 'parceiro:read',
    escrever: 'parceiro:write',
    tabela: 'instituicao',
  },
  PARCEIRO: {
    ler: 'parceiro:read',
    escrever: 'parceiro:write',
    tabela: 'instituicao',
  },
};

export const enviarAnexoSchema = z.object({
  entidadeTipo: z.enum(s.entidadeAnexoEnum.enumValues),
  entidadeId: z.uuid(),
  categoria: z.enum(s.categoriaAnexoEnum.enumValues).default('OUTRO'),
  visibilidade: z.enum(s.visibilidadeAnexoEnum.enumValues).default('INTERNA'),
  legenda: z.string().trim().max(300).optional(),
  dataEvidencia: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.')
    .optional(),
  localEvidencia: z.string().trim().max(240).optional(),
});
export type EnviarAnexo = z.infer<typeof enviarAnexoSchema>;

export const listarAnexosSchema = z.object({
  entidadeTipo: z.enum(s.entidadeAnexoEnum.enumValues),
  entidadeId: z.uuid(),
  incluirInativos: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
export type ListarAnexos = z.infer<typeof listarAnexosSchema>;

export const justificarAnexoSchema = z.object({
  justificativa: z.string().trim().min(3).max(2000),
});
export type JustificarAnexo = z.infer<typeof justificarAnexoSchema>;

/** O que sai para o cliente. `caminho` **não** está aqui, e é o ponto. */
export interface AnexoResumo {
  id: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  hashSha256: string | null;
  categoria: (typeof s.categoriaAnexoEnum.enumValues)[number];
  visibilidade: (typeof s.visibilidadeAnexoEnum.enumValues)[number];
  entidadeTipo: (typeof s.entidadeAnexoEnum.enumValues)[number];
  entidadeId: string;
  versao: number;
  substituiId: string | null;
  ativo: boolean;
  enviadoPor: string | null;
  enviadoEm: Date;
  legenda: string | null;
  dataEvidencia: string | null;
  localEvidencia: string | null;
}

export interface ArquivoRecebido {
  originalname: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class AnexosService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly armazenamento: ArmazenamentoService,
  ) {}

  async listar(
    filtros: ListarAnexos,
    usuario: AuthUser,
  ): Promise<AnexoResumo[]> {
    this.exigir(usuario, POLITICA[filtros.entidadeTipo].ler);
    const linhas = await this.db
      .select()
      .from(s.anexo)
      .where(
        and(
          eq(s.anexo.entidadeTipo, filtros.entidadeTipo),
          eq(s.anexo.entidadeId, filtros.entidadeId),
          filtros.incluirInativos ? undefined : eq(s.anexo.ativo, true),
        ),
      )
      .orderBy(desc(s.anexo.enviadoEm));
    return linhas
      .filter((linha) => this.podeVer(linha, usuario))
      .map((linha) => this.resumir(linha));
  }

  async enviar(
    dto: EnviarAnexo,
    arquivo: ArquivoRecebido,
    usuario: AuthUser,
  ): Promise<AnexoResumo> {
    const politica = POLITICA[dto.entidadeTipo];
    this.exigir(usuario, politica.escrever);
    await this.exigirEntidade(dto.entidadeTipo, dto.entidadeId);
    await this.validarAssociacaoPrestacao(dto);

    const tipo = this.validarArquivo(arquivo);
    const { chave, hash } = await this.armazenamento.guardar(arquivo.buffer);

    const [criado] = await this.db
      .insert(s.anexo)
      .values({
        nome: arquivo.originalname,
        mimeType: tipo.mimeType,
        tamanho: arquivo.buffer.length,
        caminho: chave,
        hashSha256: hash,
        categoria: dto.categoria,
        visibilidade: dto.visibilidade,
        entidadeTipo: dto.entidadeTipo,
        entidadeId: dto.entidadeId,
        enviadoPorId: usuario.id,
        enviadoPor: nomeDoUsuario(usuario),
        legenda: dto.legenda ?? null,
        dataEvidencia: dto.dataEvidencia ?? null,
        localEvidencia: dto.localEvidencia ?? null,
      })
      .returning();
    return this.resumir(criado);
  }

  /**
   * Substituição cria versão nova e mantém a anterior (CG-014).
   *
   * A anterior sai da listagem padrão (`ativo = false`) mas continua existindo e
   * legível pelo `id` — um parecer do Comitê que citou aquele arquivo precisa
   * continuar podendo mostrá-lo.
   */
  async substituir(
    id: string,
    arquivo: ArquivoRecebido,
    usuario: AuthUser,
  ): Promise<AnexoResumo> {
    const anterior = await this.obter(id);
    this.exigir(usuario, POLITICA[anterior.entidadeTipo].escrever);
    const tipo = this.validarArquivo(arquivo);
    const { chave, hash } = await this.armazenamento.guardar(arquivo.buffer);

    return this.db.transaction(async (tx) => {
      await tx
        .update(s.anexo)
        .set({ ativo: false, atualizadoEm: new Date() })
        .where(eq(s.anexo.id, anterior.id));
      const [novo] = await tx
        .insert(s.anexo)
        .values({
          nome: arquivo.originalname,
          mimeType: tipo.mimeType,
          tamanho: arquivo.buffer.length,
          caminho: chave,
          hashSha256: hash,
          categoria: anterior.categoria,
          visibilidade: anterior.visibilidade,
          entidadeTipo: anterior.entidadeTipo,
          entidadeId: anterior.entidadeId,
          versao: anterior.versao + 1,
          substituiId: anterior.id,
          enviadoPorId: usuario.id,
          enviadoPor: nomeDoUsuario(usuario),
          legenda: anterior.legenda,
          dataEvidencia: anterior.dataEvidencia,
          localEvidencia: anterior.localEvidencia,
        })
        .returning();
      return this.resumir(novo);
    });
  }

  async inativar(
    id: string,
    dto: JustificarAnexo,
    usuario: AuthUser,
  ): Promise<AnexoResumo> {
    const anexo = await this.obter(id);
    this.exigir(usuario, POLITICA[anexo.entidadeTipo].escrever);
    if (!anexo.ativo) throw new BadRequestException('O anexo ja esta inativo.');
    await this.db.transaction(async (tx) => {
      await tx
        .update(s.anexo)
        .set({ ativo: false, atualizadoEm: new Date() })
        .where(eq(s.anexo.id, id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'ANEXO',
        entidadeId: id,
        acao: 'EXCLUSAO',
        campo: 'ativo',
        valorAnterior: 'true',
        valorNovo: 'false',
        justificativa: dto.justificativa,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });
    return this.resumir(await this.obter(id));
  }

  /** Devolve o conteúdo. Nunca devolve nem revela o caminho interno. */
  async baixar(
    id: string,
    usuario: AuthUser,
  ): Promise<{ nome: string; mimeType: string; conteudo: Buffer }> {
    const anexo = await this.obter(id);
    this.exigir(usuario, POLITICA[anexo.entidadeTipo].ler);
    if (!this.podeVer(anexo, usuario)) {
      throw new ForbiddenException('Documento restrito.');
    }
    const conteudo = await this.armazenamento.ler(anexo.caminho);
    return { nome: anexo.nome, mimeType: anexo.mimeType, conteudo };
  }

  async historico(id: string, usuario: AuthUser): Promise<AnexoResumo[]> {
    const anexo = await this.obter(id);
    this.exigir(usuario, POLITICA[anexo.entidadeTipo].ler);
    // Sobe até a raiz da cadeia e desce por todas as versões.
    const linhas = await this.db.execute<Record<string, unknown>>(sql`
      with recursive cadeia as (
        select * from ${s.anexo} where id = ${anexo.id}
        union all
        select a.* from ${s.anexo} a join cadeia c on a.id = c.substitui_id
      )
      select * from cadeia order by versao desc
    `);
    const registros = Array.isArray(linhas) ? linhas : (linhas.rows ?? []);
    return (registros as never[]).map((linha) => this.resumir(linha));
  }

  // -------------------------------------------------------------------------

  private validarArquivo(arquivo: ArquivoRecebido) {
    if (!arquivo?.buffer?.length) {
      throw new BadRequestException('Arquivo vazio.');
    }
    if (arquivo.buffer.length > TAMANHO_MAXIMO) {
      throw new PayloadTooLargeException(
        `O arquivo excede o limite de ${Math.floor(TAMANHO_MAXIMO / 1024 / 1024)} MB.`,
      );
    }
    const tipo = identificarTipo(arquivo.buffer, arquivo.originalname);
    if (!tipo) {
      // A mensagem nao diz "assinatura invalida": para quem envia, o que
      // importa e a lista aceita, nao o motivo interno da recusa.
      throw new BadRequestException(
        `Formato nao aceito. Envie um destes: ${EXTENSOES_ACEITAS.join(', ')}.`,
      );
    }
    return tipo;
  }

  /**
   * `entidade_id` não tem chave estrangeira (preço do vínculo polimórfico), por
   * isso a existência é conferida aqui — senão o upload cria órfão no ato.
   */
  private async exigirEntidade(
    tipo: (typeof s.entidadeAnexoEnum.enumValues)[number],
    entidadeId: string,
  ): Promise<void> {
    const tabelas = {
      missao: s.missaoComite,
      atividade: s.atividadeMissao,
      prestacao: s.prestacaoContasMissao,
      despesa: s.despesaMissao,
      cotacao: s.cotacaoPassagem,
      instituicao: s.instituicao,
    } as const;
    const tabela = tabelas[POLITICA[tipo].tabela];
    const [existe] = await this.db
      .select({ id: tabela.id })
      .from(tabela)
      .where(eq(tabela.id, entidadeId))
      .limit(1);
    if (!existe) {
      throw new BadRequestException(
        'A entidade de destino do documento nao existe.',
      );
    }
  }

  /**
   * O alvo existir nao basta para documentos financeiros: a categoria precisa
   * corresponder ao tipo da despesa, e cotacao tem documento proprio.
   */
  private async validarAssociacaoPrestacao(dto: EnviarAnexo): Promise<void> {
    if (dto.entidadeTipo === 'COTACAO_PASSAGEM') {
      if (dto.categoria !== 'COTACAO') {
        throw new BadRequestException(
          'Documento de cotacao deve usar a categoria COTACAO.',
        );
      }
      return;
    }
    if (dto.entidadeTipo !== 'DESPESA_MISSAO') return;

    const [despesa] = await this.db
      .select({ tipo: s.despesaMissao.tipo })
      .from(s.despesaMissao)
      .where(eq(s.despesaMissao.id, dto.entidadeId))
      .limit(1);
    if (
      !despesa ||
      !categoriaPermitidaParaDespesa(despesa.tipo, dto.categoria)
    ) {
      throw new BadRequestException(
        `A categoria ${dto.categoria} nao e compativel com despesa ${despesa?.tipo ?? 'desconhecida'}.`,
      );
    }
  }

  private exigir(usuario: AuthUser, permissao: Permission): void {
    if (!usuario.permissions.includes(permissao)) {
      throw new ForbiddenException(
        `Acesso negado. Permissao necessaria: ${permissao}`,
      );
    }
  }

  /** `RESTRITA` fica com o administrador e com quem enviou (CG-014, proposta). */
  private podeVer(
    anexo: { visibilidade: string; enviadoPorId: string | null },
    usuario: AuthUser,
  ): boolean {
    if (anexo.visibilidade !== 'RESTRITA') return true;
    return usuario.roles.includes('admin') || anexo.enviadoPorId === usuario.id;
  }

  private async obter(id: string) {
    const [anexo] = await this.db
      .select()
      .from(s.anexo)
      .where(eq(s.anexo.id, id))
      .limit(1);
    if (!anexo) throw new NotFoundException('Documento nao encontrado.');
    return anexo;
  }

  private resumir(linha: typeof s.anexo.$inferSelect): AnexoResumo {
    return {
      id: linha.id,
      nome: linha.nome,
      mimeType: linha.mimeType,
      tamanho: linha.tamanho,
      hashSha256: linha.hashSha256,
      categoria: linha.categoria,
      visibilidade: linha.visibilidade,
      entidadeTipo: linha.entidadeTipo,
      entidadeId: linha.entidadeId,
      versao: linha.versao,
      substituiId: linha.substituiId,
      ativo: linha.ativo,
      enviadoPor: linha.enviadoPor,
      enviadoEm: linha.enviadoEm,
      legenda: linha.legenda,
      dataEvidencia: linha.dataEvidencia,
      localEvidencia: linha.localEvidencia,
    };
  }
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}
