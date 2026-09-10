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
  eq,
  gte,
  ilike,
  isNull,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

const dataCompleta = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data completa.')
  .refine(dataIsoValida, 'Informe uma data valida.');

const cpf = z
  .string()
  .transform((valor) => valor.replace(/\D/g, ''))
  .refine(cpfValido, 'Informe um CPF valido.');

export const pessoaRapidaSchema = z.object({
  nome: z.string().trim().min(3, 'Informe o nome da pessoa.').max(240),
  email: z.email('Informe um e-mail valido.').max(240).nullish(),
  cpf: cpf.nullish(),
  tipo: z
    .enum(['SERVIDOR', 'DOCENTE', 'DISCENTE', 'PESQUISADOR', 'EXTERNO'])
    .default('EXTERNO'),
  ppgId: z.uuid().nullish(),
  instituicaoId: z.uuid().nullish(),
});
export type PessoaRapida = z.infer<typeof pessoaRapidaSchema>;

const dadosVinculoSchema = z
  .object({
    tipoEquipe: z.enum(['COMITE_GESTOR', 'ADMINISTRACAO']),
    funcao: z.string().trim().min(2, 'Informe a funcao na equipe.').max(160),
    dataInicio: dataCompleta,
    dataFim: dataCompleta.nullish(),
    observacoes: z.string().trim().max(2000).nullish(),
  })
  .superRefine((valor, contexto) => {
    if (valor.dataFim && valor.dataFim < valor.dataInicio) {
      contexto.addIssue({
        code: 'custom',
        path: ['dataFim'],
        message: 'A data final não pode ser anterior à data inicial.',
      });
    }
  });

export const criarMembroEquipeSchema = z
  .object({
    pessoaId: z.uuid().nullish(),
    novaPessoa: pessoaRapidaSchema.nullish(),
  })
  .and(dadosVinculoSchema)
  .superRefine((valor, contexto) => {
    if (Boolean(valor.pessoaId) === Boolean(valor.novaPessoa)) {
      contexto.addIssue({
        code: 'custom',
        path: ['pessoaId'],
        message: 'Selecione uma pessoa existente ou cadastre uma nova.',
      });
    }
  });
export type CriarMembroEquipe = z.infer<typeof criarMembroEquipeSchema>;

export const atualizarMembroEquipeSchema = dadosVinculoSchema;
export type AtualizarMembroEquipe = z.infer<typeof atualizarMembroEquipeSchema>;

export interface PessoaDisponivel {
  id: string;
  nome: string;
  email: string | null;
  cpf: string | null;
  tipo: string;
  ppg: string | null;
  instituicao: string | null;
}

export interface MembroEquipe {
  id: string;
  pessoaId: string;
  nome: string;
  email: string | null;
  tipoPessoa: string;
  ppg: string | null;
  instituicao: string | null;
  tipoEquipe: 'COMITE_GESTOR' | 'ADMINISTRACAO';
  funcao: string;
  dataInicio: string;
  dataFim: string | null;
  situacao: 'ATIVO' | 'FUTURO' | 'ENCERRADO';
  observacoes: string | null;
  redes: string[];
  /**
   * Missoes do ciclo de que a pessoa participou.
   *
   * A contagem e por pessoa, e nao por vinculo: `missao_participante` aceita
   * participante sem `membro_equipe_id` (quem viaja sem integrar equipe), e
   * contar pelo vinculo perderia justamente essas participacoes. Quem esta nas
   * duas equipes ve o mesmo numero nas duas linhas, que e a resposta correta
   * para "de quantas missoes esta pessoa participou".
   */
  missoes: number;
}

@Injectable()
export class ComiteGestorService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listarPessoas(busca?: string): Promise<PessoaDisponivel[]> {
    const termo = busca?.trim();
    const cpfBusca = termo?.replace(/\D/g, '');
    const filtro = termo
      ? or(
          ilike(s.pessoa.nome, `%${termo}%`),
          ilike(s.pessoa.email, `%${termo}%`),
          cpfBusca ? eq(s.pessoa.cpf, cpfBusca) : undefined,
        )
      : undefined;

    return this.db
      .select({
        id: s.pessoa.id,
        nome: s.pessoa.nome,
        email: s.pessoa.email,
        cpf: s.pessoa.cpf,
        tipo: s.pessoa.tipo,
        ppg: s.ppg.sigla,
        instituicao: s.instituicao.sigla,
      })
      .from(s.pessoa)
      .leftJoin(s.ppg, eq(s.ppg.id, s.pessoa.ppgId))
      .leftJoin(s.instituicao, eq(s.instituicao.id, s.pessoa.instituicaoId))
      .where(and(eq(s.pessoa.ativo, true), filtro))
      .orderBy(asc(s.pessoa.nome))
      .limit(100);
  }

  async criarPessoa(dto: PessoaRapida, usuario: AuthUser) {
    return this.db.transaction(async (tx) => {
      await this.validarPessoaUnica(dto, tx);
      const [pessoa] = await tx
        .insert(s.pessoa)
        .values({
          nome: dto.nome,
          email: dto.email ?? null,
          cpf: dto.cpf ?? null,
          tipo: dto.tipo,
          ppgId: dto.ppgId ?? null,
          instituicaoId: dto.instituicaoId ?? null,
        })
        .returning();

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PESSOA',
        entidadeId: pessoa.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({ nome: pessoa.nome, tipo: pessoa.tipo }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      return pessoa;
    });
  }

  async listarEquipes(cicloId: string): Promise<MembroEquipe[]> {
    const linhas = await this.db
      .select({
        id: s.membroEquipeGestao.id,
        pessoaId: s.pessoa.id,
        nome: s.pessoa.nome,
        email: s.pessoa.email,
        tipoPessoa: s.pessoa.tipo,
        ppg: s.ppg.sigla,
        instituicao: s.instituicao.sigla,
        tipoEquipe: s.membroEquipeGestao.tipoEquipe,
        funcao: s.membroEquipeGestao.funcao,
        dataInicio: s.membroEquipeGestao.dataInicio,
        dataFim: s.membroEquipeGestao.dataFim,
        observacoes: s.membroEquipeGestao.observacoes,
        redes: sql<string[]>`coalesce(
          (select array_agg(r.nome order by r.nome)
             from membro_equipe_gestao_rede mer
             join rede_coordenadora r on r.id = mer.rede_id
            where mer.membro_equipe_id = ${s.membroEquipeGestao.id}),
          array[]::text[]
        )`,
        missoes: sql<number>`(
          select count(*)::int
            from missao_participante mp
            join missao_comite mc on mc.id = mp.missao_id
           where mp.pessoa_id = ${s.pessoa.id}
             and mc.ciclo_id = ${s.membroEquipeGestao.cicloId}
        )`,
      })
      .from(s.membroEquipeGestao)
      .innerJoin(s.pessoa, eq(s.pessoa.id, s.membroEquipeGestao.pessoaId))
      .leftJoin(s.ppg, eq(s.ppg.id, s.pessoa.ppgId))
      .leftJoin(s.instituicao, eq(s.instituicao.id, s.pessoa.instituicaoId))
      .where(eq(s.membroEquipeGestao.cicloId, cicloId))
      .orderBy(asc(s.membroEquipeGestao.tipoEquipe), asc(s.pessoa.nome));

    const hoje = new Date().toISOString().slice(0, 10);
    return linhas.map((linha) => ({
      ...linha,
      situacao:
        linha.dataInicio > hoje
          ? 'FUTURO'
          : linha.dataFim && linha.dataFim < hoje
            ? 'ENCERRADO'
            : 'ATIVO',
    }));
  }

  async criarMembro(
    cicloId: string,
    dto: CriarMembroEquipe,
    usuario: AuthUser,
  ) {
    const id = await this.db.transaction(async (tx) => {
      let pessoaId = dto.pessoaId ?? null;

      if (dto.novaPessoa) {
        await this.validarPessoaUnica(dto.novaPessoa, tx);
        const [nova] = await tx
          .insert(s.pessoa)
          .values({
            nome: dto.novaPessoa.nome,
            email: dto.novaPessoa.email ?? null,
            cpf: dto.novaPessoa.cpf ?? null,
            tipo: dto.novaPessoa.tipo,
            ppgId: dto.novaPessoa.ppgId ?? null,
            instituicaoId: dto.novaPessoa.instituicaoId ?? null,
          })
          .returning({ id: s.pessoa.id, nome: s.pessoa.nome });
        pessoaId = nova.id;

        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'PESSOA',
          entidadeId: nova.id,
          acao: 'CRIACAO',
          valorNovo: JSON.stringify({ nome: nova.nome }),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
      }

      if (!pessoaId) {
        throw new BadRequestException('Informe a pessoa da equipe.');
      }

      const [pessoaExiste] = await tx
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(and(eq(s.pessoa.id, pessoaId), eq(s.pessoa.ativo, true)))
        .limit(1);
      if (!pessoaExiste) throw new NotFoundException('Pessoa não encontrada.');

      await this.validarSobreposicao(
        cicloId,
        pessoaId,
        dto.tipoEquipe,
        dto.dataInicio,
        dto.dataFim ?? null,
        undefined,
        tx,
      );

      const [membro] = await tx
        .insert(s.membroEquipeGestao)
        .values({
          cicloId,
          pessoaId,
          tipoEquipe: dto.tipoEquipe,
          funcao: dto.funcao,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.membroEquipeGestao.id });

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'MEMBRO_EQUIPE_GESTAO',
        entidadeId: membro.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          pessoaId,
          tipoEquipe: dto.tipoEquipe,
          funcao: dto.funcao,
          dataInicio: dto.dataInicio,
          dataFim: dto.dataFim ?? null,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      return membro.id;
    });

    return (await this.listarEquipes(cicloId)).find((m) => m.id === id)!;
  }

  async atualizarMembro(
    cicloId: string,
    id: string,
    dto: AtualizarMembroEquipe,
    usuario: AuthUser,
  ) {
    const [anterior] = await this.db
      .select()
      .from(s.membroEquipeGestao)
      .where(
        and(
          eq(s.membroEquipeGestao.id, id),
          eq(s.membroEquipeGestao.cicloId, cicloId),
        ),
      )
      .limit(1);
    if (!anterior) throw new NotFoundException('Membro não encontrado.');

    await this.validarSobreposicao(
      cicloId,
      anterior.pessoaId,
      dto.tipoEquipe,
      dto.dataInicio,
      dto.dataFim ?? null,
      id,
      this.db,
    );

    const novos = {
      tipoEquipe: dto.tipoEquipe,
      funcao: dto.funcao,
      dataInicio: dto.dataInicio,
      dataFim: dto.dataFim ?? null,
      observacoes: dto.observacoes ?? null,
    };
    const alteracoes = Object.entries(novos).filter(
      ([campo, valor]) => anterior[campo as keyof typeof novos] !== valor,
    );
    if (alteracoes.length === 0) {
      throw new BadRequestException('Nenhum dado da equipe foi alterado.');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .update(s.membroEquipeGestao)
        .set({ ...novos, atualizadoEm: new Date() })
        .where(eq(s.membroEquipeGestao.id, id));

      await tx.insert(s.registroAuditoria).values(
        alteracoes.map(([campo, valor]) => ({
          entidadeTipo: 'MEMBRO_EQUIPE_GESTAO',
          entidadeId: id,
          acao: 'EDICAO' as const,
          campo,
          valorAnterior: serializar(
            anterior[campo as keyof typeof novos] as unknown,
          ),
          valorNovo: serializar(valor),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        })),
      );
    });

    return (await this.listarEquipes(cicloId)).find((m) => m.id === id)!;
  }

  private async validarPessoaUnica(
    dto: PessoaRapida,
    db: Pick<Database, 'select'>,
  ): Promise<void> {
    const filtros = [
      dto.cpf ? eq(s.pessoa.cpf, dto.cpf) : undefined,
      dto.email ? eq(s.pessoa.email, dto.email) : undefined,
    ].filter((f): f is NonNullable<typeof f> => Boolean(f));
    if (filtros.length === 0) return;

    const [existente] = await db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(or(...filtros))
      .limit(1);
    if (existente) {
      throw new ConflictException(
        'Já existe uma pessoa cadastrada com este CPF ou e-mail.',
      );
    }
  }

  private async validarSobreposicao(
    cicloId: string,
    pessoaId: string,
    tipoEquipe: 'COMITE_GESTOR' | 'ADMINISTRACAO',
    dataInicio: string,
    dataFim: string | null,
    ignorarId: string | undefined,
    db: Pick<Database, 'select'>,
  ): Promise<void> {
    const [sobreposto] = await db
      .select({ id: s.membroEquipeGestao.id })
      .from(s.membroEquipeGestao)
      .where(
        and(
          eq(s.membroEquipeGestao.cicloId, cicloId),
          eq(s.membroEquipeGestao.pessoaId, pessoaId),
          eq(s.membroEquipeGestao.tipoEquipe, tipoEquipe),
          lte(s.membroEquipeGestao.dataInicio, dataFim ?? '9999-12-31'),
          or(
            isNull(s.membroEquipeGestao.dataFim),
            gte(s.membroEquipeGestao.dataFim, dataInicio),
          ),
          ignorarId ? ne(s.membroEquipeGestao.id, ignorarId) : undefined,
        ),
      )
      .limit(1);

    if (sobreposto) {
      throw new ConflictException(
        'Esta pessoa já possui um vínculo sobreposto na mesma equipe.',
      );
    }
  }
}

function dataIsoValida(valor: string): boolean {
  const [ano, mes, dia] = valor.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function cpfValido(valor: string): boolean {
  if (!/^\d{11}$/.test(valor) || /^(\d)\1{10}$/.test(valor)) return false;
  const digitos = valor.split('').map(Number);
  for (let posicao = 9; posicao <= 10; posicao += 1) {
    const soma = digitos.slice(0, posicao).reduce((total, digito, indice) => {
      return total + digito * (posicao + 1 - indice);
    }, 0);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== digitos[posicao]) return false;
  }
  return true;
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}

function serializar(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}
