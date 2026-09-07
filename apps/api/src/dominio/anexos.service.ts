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
import { alcancaTodasAsRedes, podeVerMissao } from '../auth/escopo';
import { IdentidadeService } from '../auth/identidade.service';
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
      | 'instituicao'
      | 'produto'
      | 'convenio';
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
  /**
   * O produto e resultado da missao; o convenio e cadastro do parceiro. Por
   * isso as permissoes divergem apesar de os dois nascerem da mesma viagem
   * (CG-056).
   */
  PRODUTO_MISSAO: {
    ler: 'missao:read',
    escrever: 'missao:write',
    tabela: 'produto',
  },
  CONVENIO: {
    ler: 'parceiro:read',
    escrever: 'parceiro:write',
    tabela: 'convenio',
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
      throw new BadRequestException('Nome de arquivo invalido.');
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
      produto: s.produtoMissao,
      convenio: s.convenio,
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
    this.exigir(usuario, POLITICA[tipo][acao]);

    if (alcancaTodasAsRedes(usuario)) return;
    const missaoId = await this.missaoDaEntidade(tipo, entidadeId);
    if (!missaoId) return;

    const redes = await this.db
      .select({ redeId: s.missaoRede.redeId })
      .from(s.missaoRede)
      .where(eq(s.missaoRede.missaoId, missaoId));

    const escopo = await this.identidade.escopoDe(usuario);
    if (
      !podeVerMissao(
        escopo,
        redes.map((linha) => linha.redeId),
      )
    ) {
      // 404, e não 403: "existe, mas não é seu" já entrega que o documento
      // existe — mesmo critério do PPG e da missão fora do escopo.
      throw new NotFoundException('Documento nao encontrado.');
    }
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

  private exigir(usuario: AuthUser, permissao: Permission): void {
    if (!usuario.permissions.includes(permissao)) {
      throw new ForbiddenException(
        `Acesso negado. Permissao necessaria: ${permissao}`,
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
    if (anexo.visibilidade !== 'RESTRITA') return true;
    return (
      usuario.permissions.includes('documento:read-restrito') ||
      anexo.enviadoPorId === usuario.id
    );
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
