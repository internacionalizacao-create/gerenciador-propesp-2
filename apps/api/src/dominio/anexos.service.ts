import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import {
  condicaoDaBolsa,
  condicaoDaMissao,
  condicaoDoLado,
} from '../auth/autorizacao-v1/recorte-bolsa';
import { IdentidadeService } from '../auth/identidade.service';
import type { PermissaoV1 } from '../auth/autorizacao-v1/catalogo';
import { consultar } from '../comum/consultar';
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
    ler: PermissaoV1;
    escrever: PermissaoV1;
    tabela:
      | 'missao'
      | 'atividade'
      | 'prestacao'
      | 'despesa'
      | 'cotacao'
      | 'instituicao'
      | 'produto'
      | 'convenio'
      | 'bolsa'
      | 'decisao'
      | 'eventoBolsista'
      | 'remanejamento';
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
    escrever: 'prestacao:edit',
    tabela: 'prestacao',
  },
  DESPESA_MISSAO: {
    ler: 'prestacao:read',
    escrever: 'prestacao:edit',
    tabela: 'despesa',
  },
  COTACAO_PASSAGEM: {
    ler: 'prestacao:read',
    escrever: 'prestacao:edit',
    tabela: 'cotacao',
  },
  INSTITUICAO: {
    ler: 'parceiro:read',
    escrever: 'parceiro:edit',
    tabela: 'instituicao',
  },
  PARCEIRO: {
    ler: 'parceiro:read',
    escrever: 'parceiro:edit',
    tabela: 'instituicao',
  },
  /**
   * O produto e resultado da missao; o convenio e cadastro do parceiro. Por
   * isso as permissoes divergem apesar de os dois nascerem da mesma viagem
   * (CG-056) — e desde o catalogo V1 cada um tem o seu proprio dominio de
   * permissao, em vez de pegar emprestado o da missao e o do parceiro.
   */
  PRODUTO_MISSAO: {
    ler: 'produto-missao:read',
    escrever: 'produto-missao:edit',
    tabela: 'produto',
  },
  CONVENIO: {
    ler: 'convenio:read',
    escrever: 'convenio:edit',
    tabela: 'convenio',
  },
  /**
   * Documento do bolsista (BOL-021).
   *
   * As permissoes sao as da concessao, e nao uma permissao documental propria:
   * o anexo herda quem pode, exatamente como os outros. O que ele herda **alem**
   * disso e o recorte por PPG da BOL-020 — ver `exigirAcesso`.
   */
  BOLSA_CONCEDIDA: {
    ler: 'bolsa:read',
    escrever: 'bolsa:edit',
    tabela: 'bolsa',
  },
  /**
   * Ata da reuniao que fundamentou a decisao (BOL-052).
   *
   * Escrever exige `missao:decide` — quem registra a decisao e quem anexa a ata
   * dela —, e nao `missao:edit`: a ata nao e parte da proposta, e quem pode
   * alterar a missao nao e quem delibera sobre ela. Ler e `missao:read`, como
   * todo o resto do historico de analise.
   */
  DECISAO_COMITE: {
    ler: 'missao:read',
    escrever: 'missao:decide',
    tabela: 'decisao',
  },
  /**
   * Comprovante de evento externo (V1-036): o oficio da desistencia, o
   * registro da movimentacao na CAPES. Quem registra o evento anexa a prova
   * dele — e a mesma pessoa, no mesmo ato —, e quem consulta o historico
   * consulta o comprovante.
   */
  EVENTO_BOLSISTA: {
    ler: 'evento:read',
    escrever: 'evento:create',
    tabela: 'eventoBolsista',
  },
  REMANEJAMENTO: {
    ler: 'evento:read',
    escrever: 'evento:create',
    tabela: 'remanejamento',
  },
};

/**
 * Categorias aceitas no comprovante de evento externo. Lista fechada pelo
 * mesmo motivo da de bolsa: sem ela, uma foto de evento ou um passaporte
 * pendurados num registro de desistencia sujariam o historico.
 */
const CATEGORIAS_DE_EVENTO = [
  'COMPROVANTE',
  'DECLARACAO',
  'ATA',
  'OUTRO',
] as const satisfies readonly (typeof s.categoriaAnexoEnum.enumValues)[number][];

/**
 * Categorias aceitas num documento de bolsista.
 *
 * Lista fechada pela mesma razao de `categoriaPermitidaParaDespesa`: o enum de
 * categoria serve o sistema inteiro, e sem esta checagem daria para pendurar
 * `FOTO_EVENTO` ou `NOTA_FISCAL` numa concessao e sujar a lista que a equipe
 * usa para conferir o processo.
 */
const CATEGORIAS_DE_BOLSA = [
  'CARTA_ACEITE',
  'PLANO_TRABALHO',
  'RELATORIO',
  'DECLARACAO',
  'PUBLICACAO',
  'DOCUMENTO_IDENTIDADE',
  'PASSAPORTE',
  'COMPROVANTE_RESIDENCIA',
  'OUTRO',
] as const satisfies readonly (typeof s.categoriaAnexoEnum.enumValues)[number][];

/**
 * Documento pessoal: a categoria decide a visibilidade, nunca o cliente.
 *
 * Se `visibilidade` viesse do corpo da requisicao, bastaria enviar `INTERNA`
 * junto de um passaporte para publica-lo a todo mundo que alcanca a bolsa —
 * e a decisao de 2026-09-09 seria contornavel por quem faz o upload. O servico
 * sobrescreve, e por isso a regra vale mesmo para um cliente escrito errado.
 */
const CATEGORIAS_PESSOAIS = [
  'DOCUMENTO_IDENTIDADE',
  'PASSAPORTE',
  'COMPROVANTE_RESIDENCIA',
] as const satisfies readonly (typeof s.categoriaAnexoEnum.enumValues)[number][];

export function ehDocumentoPessoal(categoria: string): boolean {
  return (CATEGORIAS_PESSOAIS as readonly string[]).includes(categoria);
}

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
  /** Credito da evidencia; nao e quem faz o upload (CG-057). */
  autoria: z.string().trim().max(200).optional(),
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

export const idAnexoSchema = z.uuid('Identificador de documento invalido.');

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
  autoria: string | null;
  /**
   * Ate quando o documento pessoal deve ser guardado (BOL-021).
   *
   * **Derivado, nunca gravado**, e so preenchido em documento pessoal de
   * bolsista. A politica homologada em 2026-09-09 conta a partir do **fim da
   * concessao**, e nao do upload: o relogio da retencao comeca quando a
   * finalidade se encerra. `data_fim` da bolsa e editavel, entao uma coluna
   * gravada divergiria da politica no dia em que a equipe corrigisse o periodo
   * — a mesma razao pela qual o checklist de encerramento nao e persistido
   * (CG-058).
   *
   * **Nao existe expurgo automatico**, aqui nem em lugar nenhum do sistema.
   * Este campo torna a politica conferivel; executa-la continua sendo ato
   * humano, e isso esta registrado como pendencia.
   */
  retencaoAte?: string | null;
}

/** Anos de guarda do documento pessoal, contados do fim da concessao. */
const RETENCAO_ANOS = 5;

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
    private readonly identidade: IdentidadeService,
  ) {}

  async listar(
    filtros: ListarAnexos,
    usuario: AuthUser,
  ): Promise<AnexoResumo[]> {
    await this.exigirAcesso(
      usuario,
      filtros.entidadeTipo,
      filtros.entidadeId,
      'ler',
    );
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
    const visiveis = linhas
      .filter((linha) => this.podeVer(linha, usuario))
      .map((linha) => this.resumir(linha));

    if (filtros.entidadeTipo !== 'BOLSA_CONCEDIDA') return visiveis;
    return this.comRetencao(visiveis, filtros.entidadeId);
  }

  /**
   * Acrescenta a data de guarda aos documentos pessoais da concessao.
   *
   * Uma consulta so para a lista inteira: a bolsa e a mesma para todos os
   * anexos dela, e buscar por linha seria N+1 para responder sempre o mesmo.
   */
  private async comRetencao(
    anexos: AnexoResumo[],
    bolsaId: string,
  ): Promise<AnexoResumo[]> {
    if (!anexos.some((anexo) => ehDocumentoPessoal(anexo.categoria))) {
      return anexos;
    }

    const [bolsa] = await this.db
      .select({ dataFim: s.bolsaConcedida.dataFim })
      .from(s.bolsaConcedida)
      .where(eq(s.bolsaConcedida.id, bolsaId))
      .limit(1);
    if (!bolsa) return anexos;

    const fim = new Date(`${bolsa.dataFim}T00:00:00Z`);
    fim.setUTCFullYear(fim.getUTCFullYear() + RETENCAO_ANOS);
    const retencaoAte = fim.toISOString().slice(0, 10);

    return anexos.map((anexo) =>
      ehDocumentoPessoal(anexo.categoria) ? { ...anexo, retencaoAte } : anexo,
    );
  }

  async enviar(
    dto: EnviarAnexo,
    arquivo: ArquivoRecebido,
    usuario: AuthUser,
  ): Promise<AnexoResumo> {
    // `exigirAcesso`, e nao apenas `exigir`: a permissao diz *o que* se pode
    // fazer, e o recorte diz *sobre quais linhas*. Ate a BOL-021 o envio
    // checava so a permissao — todas as outras operacoes ja passavam por aqui
    // —, e com isso quem nao alcanca uma missao de outra rede, ou a bolsa de
    // outro PPG, ainda conseguia **pendurar** um documento nela conhecendo o
    // UUID. Nao dava para ler de volta, mas dava para injetar.
    await this.exigirAcesso(
      usuario,
      dto.entidadeTipo,
      dto.entidadeId,
      'escrever',
    );
    await this.exigirEntidade(dto.entidadeTipo, dto.entidadeId);
    await this.validarAssociacaoPrestacao(dto);
    const visibilidade = this.visibilidadeDe(dto);
    this.exigirEnvioDeDocumentoPessoal(usuario, visibilidade);

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
        visibilidade,
        entidadeTipo: dto.entidadeTipo,
        entidadeId: dto.entidadeId,
        enviadoPorId: usuario.id,
        enviadoPor: nomeDoUsuario(usuario),
        legenda: dto.legenda ?? null,
        dataEvidencia: dto.dataEvidencia ?? null,
        localEvidencia: dto.localEvidencia ?? null,
        autoria: dto.autoria ?? null,
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
    await this.exigirAcesso(
      usuario,
      anterior.entidadeTipo,
      anterior.entidadeId,
      'escrever',
    );
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
          // Metadados de evidencia acompanham a versao nova: substituir a foto
          // por uma de melhor resolucao nao muda quem a tirou nem onde.
          legenda: anterior.legenda,
          dataEvidencia: anterior.dataEvidencia,
          localEvidencia: anterior.localEvidencia,
          autoria: anterior.autoria,
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
    await this.exigirAcesso(
      usuario,
      anexo.entidadeTipo,
      anexo.entidadeId,
      'escrever',
    );
    if (!anexo.ativo) throw new BadRequestException('O anexo já está inativo.');
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
    await this.exigirAcesso(
      usuario,
      anexo.entidadeTipo,
      anexo.entidadeId,
      'ler',
    );
    if (!this.podeVer(anexo, usuario)) {
      throw new ForbiddenException('Documento restrito.');
    }
    const conteudo = await this.armazenamento.ler(anexo.caminho);
    return { nome: anexo.nome, mimeType: anexo.mimeType, conteudo };
  }

  async historico(id: string, usuario: AuthUser): Promise<AnexoResumo[]> {
    const anexo = await this.obter(id);
    await this.exigirAcesso(
      usuario,
      anexo.entidadeTipo,
      anexo.entidadeId,
      'ler',
    );
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
    if (
      !arquivo.originalname ||
      arquivo.originalname.length > 300 ||
      temControle(arquivo.originalname)
    ) {
      // CR/LF no nome pode virar injecao de cabecalho no download. O nome nao
      // participa da chave do storage, mas ainda chega ao Content-Disposition.
      throw new BadRequestException('Nome de arquivo inválido.');
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
        `Formato não aceito. Envie um destes: ${EXTENSOES_ACEITAS.join(', ')}.`,
      );
    }
    return tipo;
  }

  /**
   * `entidade_id` não tem chave estrangeira (preço do vínculo polimórfico), por
   * isso a existência é conferida aqui — senão o upload cria órfão no ato.
   */
  /**
   * Visibilidade efetiva do documento (BOL-021).
   *
   * Documento pessoal de bolsista nasce `PESSOAL` **por decisao da categoria**,
   * e o que o cliente enviou e descartado: aceitar `INTERNA` junto de um
   * passaporte publicaria o arquivo para todo mundo que alcanca a bolsa, e a
   * decisao de 2026-09-09 seria contornavel por quem faz o upload.
   *
   * Tambem e aqui que a categoria de bolsa e conferida — o enum serve o sistema
   * inteiro, e sem a lista fechada daria para pendurar `NOTA_FISCAL` numa
   * concessao.
   */
  private visibilidadeDe(
    dto: EnviarAnexo,
  ): (typeof s.visibilidadeAnexoEnum.enumValues)[number] {
    // A decisao aceita **somente** ata (BOL-052). Qualquer outra categoria ali
    // confundiria o comprovante da deliberacao com os documentos analisados —
    // que se prendem a missao, nao a decisao (CG-019).
    if (dto.entidadeTipo === 'DECISAO_COMITE' && dto.categoria !== 'ATA') {
      throw new BadRequestException(
        'A decisão do Comitê aceita apenas documento da categoria ATA.',
      );
    }

    if (
      (dto.entidadeTipo === 'EVENTO_BOLSISTA' ||
        dto.entidadeTipo === 'REMANEJAMENTO') &&
      !(CATEGORIAS_DE_EVENTO as readonly string[]).includes(dto.categoria)
    ) {
      throw new BadRequestException(
        `A categoria ${dto.categoria} não é aceita em comprovante de evento externo.`,
      );
    }

    if (dto.entidadeTipo !== 'BOLSA_CONCEDIDA') {
      // `PESSOAL` so existe para bolsista: marcar assim um comprovante de
      // missao o esconderia de quem precisa conferir a prestacao.
      if (dto.visibilidade === 'PESSOAL') {
        throw new BadRequestException(
          'Visibilidade PESSOAL vale apenas para documento de bolsista.',
        );
      }
      return dto.visibilidade;
    }

    if (!(CATEGORIAS_DE_BOLSA as readonly string[]).includes(dto.categoria)) {
      throw new BadRequestException(
        `A categoria ${dto.categoria} não é aceita em documento de bolsista.`,
      );
    }

    return ehDocumentoPessoal(dto.categoria) ? 'PESSOAL' : dto.visibilidade;
  }

  /**
   * Enviar documento pessoal exige a mesma permissao de abri-lo.
   *
   * Homologado em 2026-09-09, fechando a assimetria que a BOL-021 deixou: a
   * API aceitava o envio de qualquer um com `bolsa:write`, e o coordenador
   * acabava podendo **coletar** passaporte de aluno que so ele proprio
   * conseguiria reabrir depois — coleta de dado pessoal sem ninguem que a
   * consuma, que e o pior dos dois mundos.
   *
   * A tela ja deixava de oferecer a categoria; e isto que a torna autorizacao
   * em vez de sugestao. **403 e nao 404**: a concessao e visivel para quem
   * chegou ate aqui, e o que se recusa e a acao, nao a existencia.
   */
  private exigirEnvioDeDocumentoPessoal(
    usuario: AuthUser,
    visibilidade: (typeof s.visibilidadeAnexoEnum.enumValues)[number],
  ): void {
    if (visibilidade !== 'PESSOAL') return;
    this.exigir(usuario, 'documento:read-pessoal');
  }

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
      produto: s.produtoMissao,
      convenio: s.convenio,
      bolsa: s.bolsaConcedida,
      decisao: s.decisaoComite,
      eventoBolsista: s.eventoBolsista,
      remanejamento: s.remanejamento,
    } as const;
    const tabela = tabelas[POLITICA[tipo].tabela];
    const [existe] = await this.db
      .select({ id: tabela.id })
      .from(tabela)
      .where(eq(tabela.id, entidadeId))
      .limit(1);
    if (!existe) {
      throw new BadRequestException(
        'A entidade de destino do documento não existe.',
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
          'Documento de cotação deve usar a categoria Cotação.',
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
        `A categoria ${dto.categoria} não é compatível com despesa ${despesa?.tipo ?? 'desconhecida'}.`,
      );
    }
  }

  /**
   * Permissão da entidade de destino **mais** o recorte por rede (CG-028).
   *
   * Sem a segunda metade, o documento seria a porta lateral do recorte: quem
   * não pode abrir a missão da rede vizinha continuaria baixando o comprovante
   * da prestação dela, bastando conhecer o UUID. A permissão diz *o que*; o
   * escopo diz *sobre quais linhas*, e documento nenhum tem escopo próprio —
   * ele herda o da entidade a que se prende, exatamente como herda a permissão.
   *
   * Instituição e convênio ficam de fora porque não pertencem a rede nenhuma:
   * o cadastro institucional é compartilhado, e a matriz aprovada dá leitura
   * ampla de parceiros a todos os perfis.
   */
  private async exigirAcesso(
    usuario: AuthUser,
    tipo: (typeof s.entidadeAnexoEnum.enumValues)[number],
    entidadeId: string,
    acao: 'ler' | 'escrever',
  ): Promise<void> {
    const permissao = POLITICA[tipo][acao];
    this.exigir(usuario, permissao);

    // **O alcance e o da mesma permissao que acabou de ser exigida**, e nao um
    // recorte generico de missao (V1-016). Ate 2026-09-18 o documento da
    // prestacao era recortado pelo alcance de `missao:read`, embora a permissao
    // cobrada fosse `prestacao:read`: quem tivesse leitura de missao numa rede
    // e de prestacao noutra baixava o comprovante da rede errada. Uma pergunta
    // so, feita da acao exercida, nao tem como divergir dela.
    const alcance = (await this.identidade.acessoDe(usuario)).alcance(
      permissao,
    );

    // Bolsista e recortado pela propria bolsa (BOL-020/BOL-021, V1-015). Sem
    // isto o documento seria a porta lateral do recorte: conhecer o UUID
    // bastaria para baixar o passaporte de um bolsista fora do alcance.
    if (tipo === 'BOLSA_CONCEDIDA') {
      await this.exigirAlvo(
        sql`select 1 as existe from bolsa_concedida bc where bc.id = ${entidadeId}::uuid
              and ${condicaoDaBolsa(alcance)}`,
      );
      return;
    }

    // Evento externo herda o recorte da bolsa a que pertence; a movimentacao,
    // o de qualquer um dos dois PPGs — a mesma regra da listagem dela.
    if (tipo === 'EVENTO_BOLSISTA') {
      await this.exigirAlvo(
        sql`select 1 as existe from evento_bolsista eb
              join bolsa_concedida bc on bc.id = eb.bolsa_concedida_id
             where eb.id = ${entidadeId}::uuid and ${condicaoDaBolsa(alcance)}`,
      );
      return;
    }
    if (tipo === 'REMANEJAMENTO') {
      await this.exigirAlvo(
        sql`select 1 as existe from remanejamento r
             where r.id = ${entidadeId}::uuid
               and (${condicaoDoLado(alcance, sql`r.ppg_origem_id`)}
                    or ${condicaoDoLado(alcance, sql`r.ppg_destino_id`)})`,
      );
      return;
    }

    const missaoId = await this.missaoDaEntidade(tipo, entidadeId);
    // Instituicao e convenio nao pendem de missao nenhuma: o cadastro
    // institucional e compartilhado, como `historico` tambem trata.
    if (!missaoId) return;

    await this.exigirAlvo(
      sql`select 1 as existe from missao_comite mc where mc.id = ${missaoId}::uuid
            and ${condicaoDaMissao(alcance)}`,
    );
  }

  /**
   * O alvo existe **e** esta no alcance: uma consulta so, feita no banco.
   *
   * 404 e nao 403, pelo mesmo criterio do resto: "existe, mas nao e seu" ja
   * entrega que o documento existe — e, num anexo pessoal, que aquela pessoa e
   * bolsista. Por isso as duas metades respondem igual: quem troca o UUID nao
   * distingue "nao existe" de "nao alcanco".
   */
  private async exigirAlvo(consulta: SQL): Promise<void> {
    const [linha] = await consultar<{ existe: number }>(this.db, consulta);
    if (!linha) throw new NotFoundException('Documento não encontrado.');
  }

  /**
   * A missão a que o alvo do documento pertence, quando pertence a alguma.
   *
   * `null` para instituição e convênio: eles sobrevivem à viagem e não são
   * recortados por rede.
   */
  private async missaoDaEntidade(
    tipo: (typeof s.entidadeAnexoEnum.enumValues)[number],
    entidadeId: string,
  ): Promise<string | null> {
    switch (POLITICA[tipo].tabela) {
      case 'missao':
        return entidadeId;
      case 'decisao':
        // Duas junções até a missão: a decisão pertence à rodada, e a rodada à
        // missão. Sem isto o recorte por rede não alcançaria a ata (CG-028).
        return this.umValor(sql`
          select ra.missao_id
            from decisao_comite dc
            join rodada_analise ra on ra.id = dc.rodada_id
           where dc.id = ${entidadeId}
        `);
      case 'atividade':
        return this.umValor(sql`
          select missao_id from atividade_missao where id = ${entidadeId}
        `);
      case 'prestacao':
        return this.umValor(sql`
          select missao_id from prestacao_contas_missao where id = ${entidadeId}
        `);
      case 'despesa':
        return this.umValor(sql`
          select p.missao_id
            from despesa_missao d
            join prestacao_contas_missao p on p.id = d.prestacao_id
           where d.id = ${entidadeId}
        `);
      case 'cotacao':
        return this.umValor(sql`
          select p.missao_id
            from cotacao_passagem c
            join despesa_missao d on d.id = c.despesa_id
            join prestacao_contas_missao p on p.id = d.prestacao_id
           where c.id = ${entidadeId}
        `);
      case 'produto':
        return this.umValor(sql`
          select missao_id from produto_missao where id = ${entidadeId}
        `);
      default:
        return null;
    }
  }

  private async umValor(consulta: SQL): Promise<string | null> {
    const linhas = await this.db.execute<{ missao_id: string }>(consulta);
    return linhas.rows[0]?.missao_id ?? null;
  }

  private exigir(usuario: AuthUser, permissao: PermissaoV1): void {
    if (!usuario.permissions.includes(permissao)) {
      throw new ForbiddenException(
        `Acesso negado. Permissão necessária: ${permissao}`,
      );
    }
  }

  /**
   * `RESTRITA` fica com quem tem `documento:read-restrito` e com quem enviou.
   *
   * Homologado em 2026-09-07: **o Comite Gestor passou a entrar**, porque a
   * matriz aprovada na CG-003 lhe da leitura de todos os documentos e a regra
   * anterior o deixava de fora — a tela dizia uma coisa e a matriz, outra.
   *
   * Quem enviou continua vendo o proprio arquivo sem a permissao: e o unico
   * jeito de a pessoa conferir o que acabou de subir, e ela ja conhece o
   * conteudo.
   *
   * O recorte por rede e verificado antes disto, em `exigirAcesso`: esta funcao
   * responde so a visibilidade, e nao "de que rede e o documento".
   */
  private podeVer(
    anexo: { visibilidade: string; enviadoPorId: string | null },
    usuario: AuthUser,
  ): boolean {
    if (anexo.visibilidade === 'INTERNA') return true;

    /**
     * `RESTRITA` e `PESSOAL` **nao sao niveis**, sao publicos diferentes, e
     * por isso o mapa e explicito em vez de uma cadeia de fallback. O Comite
     * Gestor abre `RESTRITA` e nao abre `PESSOAL` — passaporte de bolsista nao
     * tem relacao com a missao que ele analisa. A `secretaria` abre `PESSOAL`
     * e nao abre `RESTRITA`. Um `||` entre as duas permissoes daria a cada uma
     * o alcance da outra, que e exatamente a decisao de 2026-09-09 ao avesso.
     */
    const permissaoNecessaria =
      anexo.visibilidade === 'PESSOAL'
        ? 'documento:read-pessoal'
        : 'documento:read-restrito';

    return (
      usuario.permissions.includes(permissaoNecessaria) ||
      anexo.enviadoPorId === usuario.id
    );
  }

  private async obter(id: string) {
    const [anexo] = await this.db
      .select()
      .from(s.anexo)
      .where(eq(s.anexo.id, id))
      .limit(1);
    if (!anexo) throw new NotFoundException('Documento não encontrado.');
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
      autoria: linha.autoria,
    };
  }
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}

/**
 * Content-Disposition seguro e compativel com nomes Unicode (RFC 5987).
 * `filename` e um fallback ASCII; `filename*` preserva o nome para navegadores
 * atuais sem permitir que aspas, barras ou controles alterem o cabecalho.
 */
export function disposicaoDoAnexo(nome: string): string {
  const base = nome.split(/[\\/]/).at(-1) || 'documento';
  const ascii = base
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\;]/g, '_');
  const utf8 = encodeURIComponent(base).replace(
    /[!'()*]/g,
    (caractere) => `%${caractere.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${utf8}`;
}

/**
 * Nome de arquivo com caractere de controle e recusado na fronteira. A checagem
 * percorre os pontos de codigo em vez de usar expressao regular porque um
 * literal de controle dentro de regex e justamente o que o `no-control-regex`
 * proibe — e silenciar a regra esconderia o proximo caso, escrito sem intencao.
 */
export function temControle(nome: string): boolean {
  for (const caractere of nome) {
    const codigo = caractere.codePointAt(0) ?? 0;
    if (codigo < 0x20 || codigo === 0x7f) return true;
  }
  return false;
}
