import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, ilike, inArray, ne, or } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { DRIZZLE, type Database } from '../database/database.module';
import { normalizarNomeInstituicao } from '../database/normalizacao';
import * as s from '../database/schema';

const textoOpcional = (maximo: number) =>
  z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.string().trim().min(1).max(maximo).nullish(),
  );

const camposContatoSchema = z.object({
  cargo: textoOpcional(160),
  departamento: textoOpcional(240),
  area: textoOpcional(160),
  email: z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.email('Informe um e-mail valido.').max(240).nullish(),
  ),
  telefone: textoOpcional(80),
  paisId: z.uuid().nullish(),
  idiomaComunicacao: textoOpcional(80),
  observacoes: textoOpcional(4000),
  confirmarPossivelDuplicidade: z.boolean(),
});

export const criarContatoParceiroSchema = camposContatoSchema.extend({
  instituicaoId: z.uuid(),
  nome: z.string().trim().min(3, 'Informe o nome do contato.').max(240),
  principal: z.boolean().default(false),
  confirmarPossivelDuplicidade: z.boolean().default(false),
});
export type CriarContatoParceiro = z.infer<typeof criarContatoParceiroSchema>;

export const atualizarContatoParceiroSchema = camposContatoSchema
  .extend({
    nome: z.string().trim().min(3, 'Informe o nome do contato.').max(240),
  })
  .partial();
export type AtualizarContatoParceiro = z.infer<
  typeof atualizarContatoParceiroSchema
>;

export const listarContatosParceirosSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  instituicaoId: z.uuid().optional(),
  incluirInativos: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});
export type ListarContatosParceiros = z.infer<
  typeof listarContatosParceirosSchema
>;

export const justificarContatoSchema = z.object({
  justificativa: z.string().trim().min(3).max(2000),
});
export type JustificarContato = z.infer<typeof justificarContatoSchema>;

export interface ContatoParceiro {
  id: string;
  instituicaoId: string;
  instituicao: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  area: string | null;
  email: string | null;
  telefone: string | null;
  paisId: string | null;
  pais: string | null;
  idiomaComunicacao: string | null;
  principal: boolean;
  observacoes: string | null;
  ativo: boolean;
}

export interface CandidatoContato {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  classificacao: 'INEQUIVOCA' | 'POSSIVEL';
  motivos: string[];
}

type DbOperacoes = Pick<Database, 'select' | 'insert' | 'update'>;

interface DadosParaCandidatos {
  nome: string;
  email?: string | null;
  telefone?: string | null;
  confirmarPossivelDuplicidade?: boolean;
}

const camposPersistidos = [
  'nome',
  'cargo',
  'departamento',
  'area',
  'email',
  'telefone',
  'paisId',
  'idiomaComunicacao',
  'observacoes',
] as const;

const justificativaPrivacidade =
  'Valores pessoais omitidos da auditoria conforme politica de privacidade.';

@Injectable()
export class ContatosParceirosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listar(filtros: ListarContatosParceiros): Promise<ContatoParceiro[]> {
    const termo = filtros.busca?.trim();
    return this.db
      .select({
        id: s.contatoInstituicao.id,
        instituicaoId: s.instituicao.id,
        instituicao: s.instituicao.nome,
        nome: s.contatoInstituicao.nome,
        cargo: s.contatoInstituicao.cargo,
        departamento: s.contatoInstituicao.departamento,
        area: s.contatoInstituicao.area,
        email: s.contatoInstituicao.email,
        telefone: s.contatoInstituicao.telefone,
        paisId: s.contatoInstituicao.paisId,
        pais: s.pais.nome,
        idiomaComunicacao: s.contatoInstituicao.idiomaComunicacao,
        principal: s.contatoInstituicao.principal,
        observacoes: s.contatoInstituicao.observacoes,
        ativo: s.contatoInstituicao.ativo,
      })
      .from(s.contatoInstituicao)
      .innerJoin(
        s.instituicao,
        eq(s.instituicao.id, s.contatoInstituicao.instituicaoId),
      )
      .leftJoin(s.pais, eq(s.pais.id, s.contatoInstituicao.paisId))
      .where(
        and(
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
          filtros.incluirInativos
            ? undefined
            : and(
                eq(s.contatoInstituicao.ativo, true),
                eq(s.instituicao.ativo, true),
              ),
          filtros.instituicaoId
            ? eq(s.contatoInstituicao.instituicaoId, filtros.instituicaoId)
            : undefined,
          termo
            ? or(
                ilike(s.contatoInstituicao.nome, `%${termo}%`),
                ilike(s.contatoInstituicao.email, `%${termo}%`),
                ilike(s.instituicao.nome, `%${termo}%`),
                ilike(s.instituicao.sigla, `%${termo}%`),
              )
            : undefined,
        ),
      )
      .orderBy(asc(s.instituicao.nome), asc(s.contatoInstituicao.nome))
      .limit(200);
  }

  async detalhar(id: string): Promise<ContatoParceiro> {
    const [contato] = await this.listarPorIds([id]);
    if (!contato) throw new NotFoundException('Contato não encontrado.');
    return contato;
  }

  async criar(
    dto: CriarContatoParceiro,
    usuario: AuthUser,
  ): Promise<ContatoParceiro> {
    try {
      const id = await this.db.transaction(async (tx) => {
        await this.validarReferencias(dto.instituicaoId, dto.paisId, tx);
        await this.validarDuplicidade(dto.instituicaoId, dto, undefined, tx);

        const principalAnterior = dto.principal
          ? await this.desmarcarPrincipal(dto.instituicaoId, undefined, tx)
          : null;
        const [criado] = await tx
          .insert(s.contatoInstituicao)
          .values({
            instituicaoId: dto.instituicaoId,
            ...dadosPersistidos(dto),
            nomeNormalizado: normalizarNomeInstituicao(dto.nome),
            emailNormalizado: normalizarEmail(dto.email),
            principal: dto.principal,
          })
          .returning({ id: s.contatoInstituicao.id });

        const auditorias: (typeof s.registroAuditoria.$inferInsert)[] = [
          {
            entidadeTipo: 'CONTATO_INSTITUICAO',
            entidadeId: criado.id,
            acao: 'CRIACAO',
            valorNovo: JSON.stringify({
              instituicaoId: dto.instituicaoId,
              principal: dto.principal,
              camposInformados: camposPersistidos.filter(
                (campo) => dto[campo] !== null && dto[campo] !== undefined,
              ),
            }),
            justificativa: justificativaPrivacidade,
            usuarioId: usuario.id,
            usuarioNome: nomeDoUsuario(usuario),
          },
        ];
        if (principalAnterior) {
          auditorias.push(
            auditoriaNaoSensivel(
              principalAnterior,
              'principal',
              true,
              false,
              usuario,
            ),
          );
        }
        await tx.insert(s.registroAuditoria).values(auditorias);
        return criado.id;
      });
      return this.detalhar(id);
    } catch (erro) {
      this.traduzirDuplicidadeConcorrente(erro);
      throw erro;
    }
  }

  async atualizar(
    id: string,
    dto: AtualizarContatoParceiro,
    usuario: AuthUser,
  ): Promise<ContatoParceiro> {
    try {
      await this.db.transaction(async (tx) => {
        const atual = await this.obterContato(id, tx);
        if (!atual.ativo) {
          throw new BadRequestException(
            'Contato inativo não pode ser editado.',
          );
        }
        const combinado = {
          nome: dto.nome ?? atual.nome,
          cargo: dto.cargo === undefined ? atual.cargo : dto.cargo,
          departamento:
            dto.departamento === undefined
              ? atual.departamento
              : dto.departamento,
          area: dto.area === undefined ? atual.area : dto.area,
          email: dto.email === undefined ? atual.email : dto.email,
          telefone: dto.telefone === undefined ? atual.telefone : dto.telefone,
          paisId: dto.paisId === undefined ? atual.paisId : dto.paisId,
          idiomaComunicacao:
            dto.idiomaComunicacao === undefined
              ? atual.idiomaComunicacao
              : dto.idiomaComunicacao,
          observacoes:
            dto.observacoes === undefined ? atual.observacoes : dto.observacoes,
          confirmarPossivelDuplicidade:
            dto.confirmarPossivelDuplicidade ?? false,
        };
        await this.validarReferencias(
          atual.instituicaoId,
          combinado.paisId,
          tx,
        );
        await this.validarDuplicidade(atual.instituicaoId, combinado, id, tx);

        const alteracoes = camposPersistidos.filter(
          (campo) => atual[campo] !== combinado[campo],
        );
        if (!alteracoes.length) {
          throw new BadRequestException('Nenhum dado do contato foi alterado.');
        }
        await tx
          .update(s.contatoInstituicao)
          .set({
            ...dadosPersistidos(combinado),
            nomeNormalizado: normalizarNomeInstituicao(combinado.nome),
            emailNormalizado: normalizarEmail(combinado.email),
            atualizadoEm: new Date(),
          })
          .where(eq(s.contatoInstituicao.id, id));
        await tx.insert(s.registroAuditoria).values(
          alteracoes.map((campo) => ({
            entidadeTipo: 'CONTATO_INSTITUICAO',
            entidadeId: id,
            acao: 'EDICAO' as const,
            campo,
            valorAnterior: null,
            valorNovo: null,
            justificativa: justificativaPrivacidade,
            usuarioId: usuario.id,
            usuarioNome: nomeDoUsuario(usuario),
          })),
        );
      });
      return this.detalhar(id);
    } catch (erro) {
      this.traduzirDuplicidadeConcorrente(erro);
      throw erro;
    }
  }

  async definirPrincipal(
    id: string,
    usuario: AuthUser,
  ): Promise<ContatoParceiro> {
    await this.db.transaction(async (tx) => {
      const contato = await this.obterContato(id, tx);
      if (!contato.ativo) {
        throw new BadRequestException(
          'Contato inativo não pode ser definido como principal.',
        );
      }
      if (contato.principal) {
        throw new BadRequestException('Este contato já e o principal.');
      }
      const anterior = await this.desmarcarPrincipal(
        contato.instituicaoId,
        id,
        tx,
      );
      await tx
        .update(s.contatoInstituicao)
        .set({ principal: true, atualizadoEm: new Date() })
        .where(eq(s.contatoInstituicao.id, id));
      const auditorias = [
        auditoriaNaoSensivel(id, 'principal', false, true, usuario),
      ];
      if (anterior) {
        auditorias.push(
          auditoriaNaoSensivel(anterior, 'principal', true, false, usuario),
        );
      }
      await tx.insert(s.registroAuditoria).values(auditorias);
    });
    return this.detalhar(id);
  }

  async inativar(
    id: string,
    dto: JustificarContato,
    usuario: AuthUser,
  ): Promise<ContatoParceiro> {
    await this.db.transaction(async (tx) => {
      const contato = await this.obterContato(id, tx);
      if (!contato.ativo) {
        throw new BadRequestException('O contato já está inativo.');
      }
      await tx
        .update(s.contatoInstituicao)
        .set({ ativo: false, principal: false, atualizadoEm: new Date() })
        .where(eq(s.contatoInstituicao.id, id));
      const auditorias = [
        auditoriaNaoSensivel(
          id,
          'ativo',
          true,
          false,
          usuario,
          dto.justificativa,
        ),
      ];
      if (contato.principal) {
        auditorias.push(
          auditoriaNaoSensivel(
            id,
            'principal',
            true,
            false,
            usuario,
            dto.justificativa,
          ),
        );
      }
      await tx.insert(s.registroAuditoria).values(auditorias);
    });
    return this.detalhar(id);
  }

  async reativar(
    id: string,
    dto: JustificarContato,
    usuario: AuthUser,
  ): Promise<ContatoParceiro> {
    await this.db.transaction(async (tx) => {
      const contato = await this.obterContato(id, tx);
      if (contato.ativo) {
        throw new BadRequestException('O contato já está ativo.');
      }
      const [instituicao] = await tx
        .select({ ativo: s.instituicao.ativo })
        .from(s.instituicao)
        .where(eq(s.instituicao.id, contato.instituicaoId))
        .limit(1);
      if (!instituicao?.ativo) {
        throw new BadRequestException(
          'Não e possível reativar contato de parceiro inativo.',
        );
      }
      await tx
        .update(s.contatoInstituicao)
        .set({ ativo: true, principal: false, atualizadoEm: new Date() })
        .where(eq(s.contatoInstituicao.id, id));
      await tx
        .insert(s.registroAuditoria)
        .values(
          auditoriaNaoSensivel(
            id,
            'ativo',
            false,
            true,
            usuario,
            dto.justificativa,
          ),
        );
    });
    return this.detalhar(id);
  }

  private async listarPorIds(ids: string[]): Promise<ContatoParceiro[]> {
    if (!ids.length) return [];
    return this.db
      .select({
        id: s.contatoInstituicao.id,
        instituicaoId: s.instituicao.id,
        instituicao: s.instituicao.nome,
        nome: s.contatoInstituicao.nome,
        cargo: s.contatoInstituicao.cargo,
        departamento: s.contatoInstituicao.departamento,
        area: s.contatoInstituicao.area,
        email: s.contatoInstituicao.email,
        telefone: s.contatoInstituicao.telefone,
        paisId: s.contatoInstituicao.paisId,
        pais: s.pais.nome,
        idiomaComunicacao: s.contatoInstituicao.idiomaComunicacao,
        principal: s.contatoInstituicao.principal,
        observacoes: s.contatoInstituicao.observacoes,
        ativo: s.contatoInstituicao.ativo,
      })
      .from(s.contatoInstituicao)
      .innerJoin(
        s.instituicao,
        eq(s.instituicao.id, s.contatoInstituicao.instituicaoId),
      )
      .leftJoin(s.pais, eq(s.pais.id, s.contatoInstituicao.paisId))
      .where(
        and(
          inArray(s.contatoInstituicao.id, ids),
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
        ),
      );
  }

  private async obterContato(id: string, db: DbOperacoes) {
    const [contato] = await db
      .select()
      .from(s.contatoInstituicao)
      .where(eq(s.contatoInstituicao.id, id))
      .limit(1);
    if (!contato) throw new NotFoundException('Contato não encontrado.');
    return contato;
  }

  private async validarReferencias(
    instituicaoId: string,
    paisId: string | null | undefined,
    db: DbOperacoes,
  ): Promise<void> {
    const [instituicao] = await db
      .select({ id: s.instituicao.id })
      .from(s.instituicao)
      .where(
        and(
          eq(s.instituicao.id, instituicaoId),
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
          eq(s.instituicao.ativo, true),
        ),
      )
      .limit(1);
    if (!instituicao) {
      throw new NotFoundException('Parceiro ativo não encontrado.');
    }
    if (!paisId) return;
    const [pais] = await db
      .select({ id: s.pais.id })
      .from(s.pais)
      .where(eq(s.pais.id, paisId))
      .limit(1);
    if (!pais) throw new NotFoundException('País não encontrado.');
  }

  private async validarDuplicidade(
    instituicaoId: string,
    dto: DadosParaCandidatos,
    ignorarId: string | undefined,
    db: DbOperacoes,
  ): Promise<void> {
    const candidatos = await this.identificarCandidatos(
      instituicaoId,
      dto,
      ignorarId,
      db,
    );
    if (candidatos.some((item) => item.classificacao === 'INEQUIVOCA')) {
      throw new ConflictException({
        message: 'Já existe um contato com a mesma identidade na instituição.',
        candidatos,
      });
    }
    if (candidatos.length && !dto.confirmarPossivelDuplicidade) {
      throw new ConflictException({
        message:
          'Foram encontrados possiveis contatos equivalentes. Confirme para prosseguir ou reutilize o cadastro existente.',
        candidatos,
      });
    }
  }

  private async identificarCandidatos(
    instituicaoId: string,
    dto: DadosParaCandidatos,
    ignorarId: string | undefined,
    db: DbOperacoes,
  ): Promise<CandidatoContato[]> {
    const existentes = await db
      .select()
      .from(s.contatoInstituicao)
      .where(
        and(
          eq(s.contatoInstituicao.instituicaoId, instituicaoId),
          ignorarId ? ne(s.contatoInstituicao.id, ignorarId) : undefined,
        ),
      );
    const nome = normalizarNomeInstituicao(dto.nome);
    const email = normalizarEmail(dto.email);
    const telefone = normalizarTelefone(dto.telefone);
    return existentes
      .map((existente): CandidatoContato | null => {
        const motivos: string[] = [];
        const emailIgual = Boolean(
          email &&
          normalizarEmail(existente.emailNormalizado ?? existente.email) ===
            email,
        );
        const nomeIgual = existente.nomeNormalizado === nome;
        const telefoneIgual = Boolean(
          telefone && normalizarTelefone(existente.telefone) === telefone,
        );
        if (emailIgual) motivos.push('MESMO_EMAIL');
        if (nomeIgual) motivos.push('MESMO_NOME_NORMALIZADO');
        if (telefoneIgual) motivos.push('MESMO_TELEFONE');
        if (!motivos.length) return null;
        return {
          id: existente.id,
          nome: existente.nome,
          email: existente.email,
          telefone: existente.telefone,
          ativo: existente.ativo,
          classificacao:
            emailIgual || (nomeIgual && telefoneIgual)
              ? 'INEQUIVOCA'
              : 'POSSIVEL',
          motivos,
        };
      })
      .filter((item): item is CandidatoContato => item !== null)
      .sort((a, b) =>
        a.classificacao === b.classificacao
          ? a.nome.localeCompare(b.nome, 'pt-BR')
          : a.classificacao === 'INEQUIVOCA'
            ? -1
            : 1,
      );
  }

  private async desmarcarPrincipal(
    instituicaoId: string,
    ignorarId: string | undefined,
    db: DbOperacoes,
  ): Promise<string | null> {
    const [anterior] = await db
      .select({ id: s.contatoInstituicao.id })
      .from(s.contatoInstituicao)
      .where(
        and(
          eq(s.contatoInstituicao.instituicaoId, instituicaoId),
          eq(s.contatoInstituicao.principal, true),
          eq(s.contatoInstituicao.ativo, true),
          ignorarId ? ne(s.contatoInstituicao.id, ignorarId) : undefined,
        ),
      )
      .limit(1);
    if (!anterior) return null;
    await db
      .update(s.contatoInstituicao)
      .set({ principal: false, atualizadoEm: new Date() })
      .where(eq(s.contatoInstituicao.id, anterior.id));
    return anterior.id;
  }

  private traduzirDuplicidadeConcorrente(erro: unknown): void {
    if (erro instanceof ConflictException) throw erro;
    let atual: unknown = erro;
    while (atual && typeof atual === 'object') {
      if ((atual as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Outro contato equivalente foi gravado ao mesmo tempo. Revise o cadastro e tente novamente.',
        );
      }
      atual = (atual as { cause?: unknown }).cause;
    }
  }
}

function dadosPersistidos(
  dto: Pick<
    CriarContatoParceiro,
    | 'nome'
    | 'cargo'
    | 'departamento'
    | 'area'
    | 'email'
    | 'telefone'
    | 'paisId'
    | 'idiomaComunicacao'
    | 'observacoes'
  >,
) {
  return {
    nome: dto.nome,
    cargo: dto.cargo ?? null,
    departamento: dto.departamento ?? null,
    area: dto.area ?? null,
    email: dto.email ?? null,
    telefone: dto.telefone ?? null,
    paisId: dto.paisId ?? null,
    idiomaComunicacao: dto.idiomaComunicacao ?? null,
    observacoes: dto.observacoes ?? null,
  };
}

function normalizarEmail(valor: string | null | undefined): string | null {
  return valor?.trim().toLocaleLowerCase('pt-BR') ?? null;
}

function normalizarTelefone(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const normalizado = valor
    .replace(/[^0-9a-z]+/gi, '')
    .toLocaleLowerCase('pt-BR');
  return normalizado.length >= 6 ? normalizado : null;
}

function auditoriaNaoSensivel(
  entidadeId: string,
  campo: string,
  anterior: boolean,
  novo: boolean,
  usuario: AuthUser,
  justificativa?: string,
): typeof s.registroAuditoria.$inferInsert {
  return {
    entidadeTipo: 'CONTATO_INSTITUICAO',
    entidadeId,
    acao: 'EDICAO',
    campo,
    valorAnterior: String(anterior),
    valorNovo: String(novo),
    justificativa,
    usuarioId: usuario.id,
    usuarioNome: nomeDoUsuario(usuario),
  };
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}
