import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, desc, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm';
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

const camposParceiroSchema = z.object({
  sigla: textoOpcional(40),
  paisId: z.uuid().nullish(),
  cidade: textoOpcional(120),
  estadoRegiao: textoOpcional(120),
  tipoOrganizacao: textoOpcional(120),
  faculdadeDepartamento: textoOpcional(240),
  site: z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.url('Informe uma URL valida.').max(240).nullish(),
  ),
  emailInstitucional: z.preprocess(
    (valor) => (valor === '' ? null : valor),
    z.email('Informe um e-mail valido.').max(240).nullish(),
  ),
  telefone: textoOpcional(80),
  endereco: textoOpcional(2000),
  observacoes: textoOpcional(4000),
  cadastroProvisorio: z.boolean(),
  redeIds: z.array(z.uuid()).max(30),
  confirmarPossivelDuplicidade: z.boolean(),
});

export const criarParceiroSchema = camposParceiroSchema.extend({
  nome: z.string().trim().min(3, 'Informe o nome da instituicao.').max(240),
  cadastroProvisorio: z.boolean().default(false),
  redeIds: z.array(z.uuid()).max(30).default([]),
  confirmarPossivelDuplicidade: z.boolean().default(false),
});
export type CriarParceiro = z.infer<typeof criarParceiroSchema>;

export const atualizarParceiroSchema = camposParceiroSchema
  .extend({
    nome: z.string().trim().min(3, 'Informe o nome da instituicao.').max(240),
  })
  .partial();
export type AtualizarParceiro = z.infer<typeof atualizarParceiroSchema>;

export const listarParceirosSchema = z.object({
  busca: z.string().trim().max(200).optional(),
  redeId: z.uuid().optional(),
  incluirInativos: z
    .enum(['true', 'false'])
    .default('false')
    .transform((valor) => valor === 'true'),
});
export type ListarParceiros = z.infer<typeof listarParceirosSchema>;

export const candidatosParceiroSchema = z.object({
  nome: z.string().trim().min(3).max(240),
  sigla: z.string().trim().max(40).optional(),
  site: z.url().max(240).optional(),
  emailInstitucional: z.email().max(240).optional(),
});
export type CandidatosParceiro = z.infer<typeof candidatosParceiroSchema>;

export const inativarParceiroSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(3, 'Informe a justificativa da inativacao.')
    .max(2000),
});
export type InativarParceiro = z.infer<typeof inativarParceiroSchema>;

export const conciliarParceiroSchema = z.object({
  destinoId: z.uuid(),
  justificativa: z
    .string()
    .trim()
    .min(3, 'Informe a justificativa da conciliacao.')
    .max(2000),
});
export type ConciliarParceiro = z.infer<typeof conciliarParceiroSchema>;

interface RedeParceiro {
  id: string;
  nome: string;
}

export interface Parceiro {
  id: string;
  nome: string;
  sigla: string | null;
  paisId: string | null;
  pais: string | null;
  codigoPais: string | null;
  cidade: string | null;
  estadoRegiao: string | null;
  tipoOrganizacao: string | null;
  faculdadeDepartamento: string | null;
  site: string | null;
  emailInstitucional: string | null;
  telefone: string | null;
  endereco: string | null;
  observacoes: string | null;
  cadastroProvisorio: boolean;
  ativo: boolean;
  substituidaPorId: string | null;
  redes: RedeParceiro[];
  quantidadeContatos: number;
  quantidadeMissoes: number;
}

/**
 * Linha historica do parceiro (CG-027). Cada secao e consultada na hora, sem
 * agregado persistido: o historico e a leitura do que os outros modulos ja
 * gravaram, nunca uma copia que possa divergir deles.
 */
export interface HistoricoParceiro {
  parceiro: Parceiro;
  contatos: ContatoHistorico[];
  missoes: MissaoHistorico[];
  eventos: EventoHistorico[];
  documentos: DocumentoHistorico[];
  /**
   * Modulos previstos pelo escopo cujo modelo ainda nao existe. Vao nomeados em
   * vez de zerados: total zero afirmaria que nada aconteceu, e a verdade e que
   * ainda nao ha onde registrar.
   */
  modulosPendentes: ModuloPendente[];
}

export interface ModuloPendente {
  modulo: 'PRODUTOS' | 'CONVENIOS';
  task: string;
}

export interface ContatoHistorico {
  id: string;
  nome: string;
  cargo: string | null;
  departamento: string | null;
  email: string | null;
  telefone: string | null;
  principal: boolean;
  ativo: boolean;
}

export interface MissaoHistorico {
  id: string;
  codigo: string;
  titulo: string;
  tipo: (typeof s.tipoMissaoEnum.enumValues)[number] | null;
  dataInicio: string;
  dataFim: string;
  status: (typeof s.statusMissaoComiteEnum.enumValues)[number];
  cicloId: string;
  ciclo: string;
  programaSlug: string;
  redes: RedeParceiro[];
  atividades: AtividadeHistorico[];
}

export interface AtividadeHistorico {
  id: string;
  ordem: number;
  titulo: string;
  tipo: (typeof s.tipoMissaoEnum.enumValues)[number];
  dataInicio: string;
  dataFim: string;
  cidade: string | null;
  estadoRegiao: string | null;
  local: string | null;
  pais: string | null;
  tipoRelacionamento:
    (typeof s.tipoRelacionamentoMissaoEnum.enumValues)[number] | null;
  objetivoRelacionamento: string | null;
  contatoId: string | null;
  contatoNome: string | null;
  status: (typeof s.statusAtividadeMissaoEnum.enumValues)[number];
}

/** Linha crua da atividade: alimenta a secao de missoes e a de eventos. */
interface LinhaAtividadeHistorico extends AtividadeHistorico {
  missaoId: string;
  eventoNome: string | null;
  eventoTipo: string | null;
  eventoSite: string | null;
  objetivoParticipacao: string | null;
  relacaoInternacionalizacao: string | null;
}

export interface EventoHistorico {
  atividadeId: string;
  missaoId: string;
  missaoCodigo: string;
  nome: string;
  tipo: string | null;
  site: string | null;
  dataInicio: string;
  dataFim: string;
  objetivoParticipacao: string | null;
  relacaoInternacionalizacao: string | null;
}

export interface DocumentoHistorico {
  id: string;
  nome: string;
  mimeType: string;
  tamanho: number;
  enviadoPor: string | null;
  enviadoEm: Date;
}

export interface CandidatoParceiro {
  id: string;
  nome: string;
  sigla: string | null;
  tipo: (typeof s.tipoInstituicaoEnum.enumValues)[number];
  ativo: boolean;
  classificacao: 'INEQUIVOCA' | 'POSSIVEL';
  motivos: string[];
}

interface DadosParaCandidatos {
  nome: string;
  sigla?: string | null;
  site?: string | null;
  emailInstitucional?: string | null;
  confirmarPossivelDuplicidade?: boolean;
}

type DbOperacoes = Pick<
  Database,
  'select' | 'insert' | 'update' | 'delete' | 'execute'
>;

const camposPersistidos = [
  'nome',
  'sigla',
  'paisId',
  'cidade',
  'estadoRegiao',
  'tipoOrganizacao',
  'faculdadeDepartamento',
  'site',
  'emailInstitucional',
  'telefone',
  'endereco',
  'observacoes',
  'cadastroProvisorio',
] as const;

@Injectable()
export class ParceirosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async listar(filtros: ListarParceiros): Promise<Parceiro[]> {
    const termo = filtros.busca?.trim();
    const termoNormalizado = termo
      ? normalizarNomeInstituicao(termo)
      : undefined;
    const linhas = await this.db
      .select({
        id: s.instituicao.id,
        nome: s.instituicao.nome,
        sigla: s.instituicao.sigla,
        paisId: s.instituicao.paisId,
        pais: s.pais.nome,
        codigoPais: s.pais.codigoIso2,
        cidade: s.instituicao.cidade,
        estadoRegiao: s.instituicao.estadoRegiao,
        tipoOrganizacao: s.instituicao.tipoOrganizacao,
        faculdadeDepartamento: s.instituicao.faculdadeDepartamento,
        site: s.instituicao.site,
        emailInstitucional: s.instituicao.emailInstitucional,
        telefone: s.instituicao.telefone,
        endereco: s.instituicao.endereco,
        observacoes: s.instituicao.observacoes,
        cadastroProvisorio: s.instituicao.cadastroProvisorio,
        ativo: s.instituicao.ativo,
        substituidaPorId: s.instituicao.substituidaPorId,
      })
      .from(s.instituicao)
      .leftJoin(s.pais, eq(s.pais.id, s.instituicao.paisId))
      .where(
        and(
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
          filtros.incluirInativos ? undefined : eq(s.instituicao.ativo, true),
          termo
            ? or(
                ilike(s.instituicao.nome, `%${termo}%`),
                ilike(s.instituicao.sigla, `%${termo}%`),
                ilike(s.instituicao.cidade, `%${termo}%`),
                termoNormalizado
                  ? ilike(
                      s.instituicao.nomeNormalizado,
                      `%${termoNormalizado}%`,
                    )
                  : undefined,
              )
            : undefined,
          filtros.redeId
            ? sql`exists (
                select 1
                  from instituicao_rede ir
                 where ir.instituicao_id = ${s.instituicao.id}
                   and ir.rede_id = ${filtros.redeId}
              )`
            : undefined,
        ),
      )
      .orderBy(asc(s.instituicao.nome))
      .limit(200);

    return this.comporParceiros(linhas);
  }

  async detalhar(id: string): Promise<Parceiro> {
    const parceiros = await this.listarPorIds([id]);
    if (!parceiros[0]) throw new NotFoundException('Parceiro nao encontrado.');
    return parceiros[0];
  }

  /**
   * Historico consolidado do parceiro (CG-027).
   *
   * A missao entra pela existencia de atividade com este parceiro, e a lista de
   * missoes e resolvida por `distinct` sobre a propria missao, nunca por join
   * com atividade ou com rede: parceiro visitado em duas paradas do roteiro, ou
   * missao de mais de uma rede, apareceria varias vezes na linha historica. As
   * atividades voltam em consulta propria e sao agrupadas em memoria.
   */
  async historico(id: string): Promise<HistoricoParceiro> {
    const parceiro = await this.detalhar(id);

    const [contatos, missoes, documentos] = await Promise.all([
      this.db
        .select({
          id: s.contatoInstituicao.id,
          nome: s.contatoInstituicao.nome,
          cargo: s.contatoInstituicao.cargo,
          departamento: s.contatoInstituicao.departamento,
          email: s.contatoInstituicao.email,
          telefone: s.contatoInstituicao.telefone,
          principal: s.contatoInstituicao.principal,
          ativo: s.contatoInstituicao.ativo,
        })
        .from(s.contatoInstituicao)
        .where(eq(s.contatoInstituicao.instituicaoId, id))
        .orderBy(
          desc(s.contatoInstituicao.principal),
          desc(s.contatoInstituicao.ativo),
          asc(s.contatoInstituicao.nome),
        ),
      this.db
        .selectDistinct({
          id: s.missaoComite.id,
          codigo: s.missaoComite.codigo,
          titulo: s.missaoComite.titulo,
          tipo: s.missaoComite.tipo,
          dataInicio: s.missaoComite.dataInicio,
          dataFim: s.missaoComite.dataFim,
          status: s.missaoComite.status,
          cicloId: s.ciclo.id,
          ciclo: s.ciclo.nome,
          programaSlug: s.programa.slug,
        })
        .from(s.missaoComite)
        .innerJoin(s.ciclo, eq(s.ciclo.id, s.missaoComite.cicloId))
        .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
        .where(
          sql`exists (
            select 1 from ${s.atividadeMissao}
            where ${s.atividadeMissao.missaoId} = ${s.missaoComite.id}
              and ${s.atividadeMissao.instituicaoId} = ${id}
          )`,
        )
        .orderBy(desc(s.missaoComite.dataInicio), asc(s.missaoComite.codigo)),
      this.db
        .select({
          id: s.anexo.id,
          nome: s.anexo.nome,
          mimeType: s.anexo.mimeType,
          tamanho: s.anexo.tamanho,
          enviadoPor: s.anexo.enviadoPor,
          enviadoEm: s.anexo.enviadoEm,
        })
        .from(s.anexo)
        .where(
          and(
            eq(s.anexo.entidadeId, id),
            inArray(s.anexo.entidadeTipo, ['INSTITUICAO', 'PARCEIRO']),
          ),
        )
        .orderBy(desc(s.anexo.enviadoEm)),
    ]);

    const missaoIds = missoes.map((missao) => missao.id);
    const [redes, atividades] = await Promise.all([
      this.carregarRedesDasMissoes(missaoIds),
      this.carregarAtividadesDoParceiro(missaoIds, id),
    ]);

    const redesPorMissao = new Map<string, RedeParceiro[]>();
    for (const rede of redes) {
      const lista = redesPorMissao.get(rede.missaoId) ?? [];
      lista.push({ id: rede.id, nome: rede.nome });
      redesPorMissao.set(rede.missaoId, lista);
    }
    const atividadesPorMissao = new Map<string, AtividadeHistorico[]>();
    for (const atividade of atividades) {
      const lista = atividadesPorMissao.get(atividade.missaoId) ?? [];
      lista.push({
        id: atividade.id,
        ordem: atividade.ordem,
        titulo: atividade.titulo,
        tipo: atividade.tipo,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        cidade: atividade.cidade,
        estadoRegiao: atividade.estadoRegiao,
        local: atividade.local,
        pais: atividade.pais,
        tipoRelacionamento: atividade.tipoRelacionamento,
        objetivoRelacionamento: atividade.objetivoRelacionamento,
        contatoId: atividade.contatoId,
        contatoNome: atividade.contatoNome,
        status: atividade.status,
      });
      atividadesPorMissao.set(atividade.missaoId, lista);
    }

    const codigoPorMissao = new Map(
      missoes.map((missao) => [missao.id, missao.codigo]),
    );
    // Evento continua sendo atividade (decisao D-10). A secao de eventos e uma
    // projecao das atividades que nomeiam um, nao uma entidade separada.
    const eventos: EventoHistorico[] = atividades
      .filter((atividade) => atividade.eventoNome !== null)
      .map((atividade) => ({
        atividadeId: atividade.id,
        missaoId: atividade.missaoId,
        missaoCodigo: codigoPorMissao.get(atividade.missaoId) ?? '',
        nome: atividade.eventoNome as string,
        tipo: atividade.eventoTipo,
        site: atividade.eventoSite,
        dataInicio: atividade.dataInicio,
        dataFim: atividade.dataFim,
        objetivoParticipacao: atividade.objetivoParticipacao,
        relacaoInternacionalizacao: atividade.relacaoInternacionalizacao,
      }));

    return {
      parceiro,
      contatos,
      missoes: missoes.map((missao) => ({
        ...missao,
        redes: redesPorMissao.get(missao.id) ?? [],
        atividades: atividadesPorMissao.get(missao.id) ?? [],
      })),
      eventos,
      documentos,
      modulosPendentes: [
        { modulo: 'PRODUTOS', task: 'CG-056' },
        { modulo: 'CONVENIOS', task: 'CG-056' },
      ],
    };
  }

  async buscarCandidatos(
    dto: CandidatosParceiro,
  ): Promise<CandidatoParceiro[]> {
    return this.identificarCandidatos(dto, undefined, this.db);
  }

  async criar(dto: CriarParceiro, usuario: AuthUser): Promise<Parceiro> {
    try {
      const id = await this.db.transaction(async (tx) => {
        await this.validarReferencias(dto.paisId, dto.redeIds, tx);
        await this.validarDuplicidade(dto, undefined, tx);

        const [criado] = await tx
          .insert(s.instituicao)
          .values({
            ...dadosPersistidos(dto),
            nomeNormalizado: normalizarNomeInstituicao(dto.nome),
            tipo: 'PARCEIRA_INTERNACIONAL',
          })
          .returning({ id: s.instituicao.id });

        await this.substituirRedes(criado.id, dto.redeIds, tx);
        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'INSTITUICAO',
          entidadeId: criado.id,
          acao: 'CRIACAO',
          valorNovo: JSON.stringify({
            ...dadosPersistidos(dto),
            redeIds: unicos(dto.redeIds),
          }),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        });
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
    dto: AtualizarParceiro,
    usuario: AuthUser,
  ): Promise<Parceiro> {
    try {
      await this.db.transaction(async (tx) => {
        const atual = await this.obterParceiro(id, tx);
        if (!atual.ativo) {
          throw new BadRequestException(
            'Parceiro inativo nao pode ser editado.',
          );
        }
        const redeIdsAtuais = await this.obterRedeIds(id, tx);
        const combinado = {
          nome: dto.nome ?? atual.nome,
          sigla: dto.sigla === undefined ? atual.sigla : dto.sigla,
          paisId: dto.paisId === undefined ? atual.paisId : dto.paisId,
          cidade: dto.cidade === undefined ? atual.cidade : dto.cidade,
          estadoRegiao:
            dto.estadoRegiao === undefined
              ? atual.estadoRegiao
              : dto.estadoRegiao,
          tipoOrganizacao:
            dto.tipoOrganizacao === undefined
              ? atual.tipoOrganizacao
              : dto.tipoOrganizacao,
          faculdadeDepartamento:
            dto.faculdadeDepartamento === undefined
              ? atual.faculdadeDepartamento
              : dto.faculdadeDepartamento,
          site: dto.site === undefined ? atual.site : dto.site,
          emailInstitucional:
            dto.emailInstitucional === undefined
              ? atual.emailInstitucional
              : dto.emailInstitucional,
          telefone: dto.telefone === undefined ? atual.telefone : dto.telefone,
          endereco: dto.endereco === undefined ? atual.endereco : dto.endereco,
          observacoes:
            dto.observacoes === undefined ? atual.observacoes : dto.observacoes,
          cadastroProvisorio:
            dto.cadastroProvisorio === undefined
              ? atual.cadastroProvisorio
              : dto.cadastroProvisorio,
          redeIds: dto.redeIds ?? redeIdsAtuais,
          confirmarPossivelDuplicidade:
            dto.confirmarPossivelDuplicidade ?? false,
        };

        await this.validarReferencias(combinado.paisId, combinado.redeIds, tx);
        await this.validarDuplicidade(combinado, id, tx);

        const alteracoes = camposPersistidos.filter(
          (campo) => atual[campo] !== combinado[campo],
        );
        const redesMudaram =
          JSON.stringify([...redeIdsAtuais].sort()) !==
          JSON.stringify([...unicos(combinado.redeIds)].sort());
        if (!alteracoes.length && !redesMudaram) {
          throw new BadRequestException(
            'Nenhum dado do parceiro foi alterado.',
          );
        }

        if (alteracoes.length) {
          await tx
            .update(s.instituicao)
            .set({
              ...dadosPersistidos(combinado),
              nomeNormalizado: normalizarNomeInstituicao(combinado.nome),
              atualizadoEm: new Date(),
            })
            .where(eq(s.instituicao.id, id));
        }
        if (redesMudaram) {
          await this.substituirRedes(id, combinado.redeIds, tx);
        }

        const auditorias: (typeof s.registroAuditoria.$inferInsert)[] =
          alteracoes.map((campo) => ({
            entidadeTipo: 'INSTITUICAO',
            entidadeId: id,
            acao: 'EDICAO',
            campo,
            valorAnterior: serializar(atual[campo]),
            valorNovo: serializar(combinado[campo]),
            usuarioId: usuario.id,
            usuarioNome: nomeDoUsuario(usuario),
          }));
        if (redesMudaram) {
          auditorias.push({
            entidadeTipo: 'INSTITUICAO',
            entidadeId: id,
            acao: 'EDICAO',
            campo: 'redes',
            valorAnterior: JSON.stringify([...redeIdsAtuais].sort()),
            valorNovo: JSON.stringify([...unicos(combinado.redeIds)].sort()),
            usuarioId: usuario.id,
            usuarioNome: nomeDoUsuario(usuario),
          });
        }
        await tx.insert(s.registroAuditoria).values(auditorias);
      });

      return this.detalhar(id);
    } catch (erro) {
      this.traduzirDuplicidadeConcorrente(erro);
      throw erro;
    }
  }

  async inativar(
    id: string,
    dto: InativarParceiro,
    usuario: AuthUser,
  ): Promise<Parceiro> {
    await this.db.transaction(async (tx) => {
      const atual = await this.obterParceiro(id, tx);
      if (!atual.ativo) {
        throw new BadRequestException('O parceiro ja esta inativo.');
      }
      await tx
        .update(s.instituicao)
        .set({ ativo: false, atualizadoEm: new Date() })
        .where(eq(s.instituicao.id, id));
      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'INSTITUICAO',
        entidadeId: id,
        acao: 'EDICAO',
        campo: 'ativo',
        valorAnterior: 'true',
        valorNovo: 'false',
        justificativa: dto.justificativa,
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });
    });
    return this.detalhar(id);
  }

  async conciliar(
    origemId: string,
    dto: ConciliarParceiro,
    usuario: AuthUser,
  ): Promise<Parceiro> {
    if (origemId === dto.destinoId) {
      throw new BadRequestException(
        'A origem e o destino da conciliacao devem ser diferentes.',
      );
    }

    await this.db.transaction(async (tx) => {
      const instituicoes = await tx
        .select()
        .from(s.instituicao)
        .where(inArray(s.instituicao.id, [origemId, dto.destinoId]))
        .orderBy(asc(s.instituicao.id))
        .for('update');
      const origem = instituicoes.find((item) => item.id === origemId);
      const destino = instituicoes.find((item) => item.id === dto.destinoId);
      if (!origem || origem.tipo !== 'PARCEIRA_INTERNACIONAL') {
        throw new NotFoundException('Parceiro de origem nao encontrado.');
      }
      if (!destino || destino.tipo !== 'PARCEIRA_INTERNACIONAL') {
        throw new NotFoundException('Parceiro de destino nao encontrado.');
      }
      if (!origem.ativo) {
        throw new BadRequestException('O parceiro de origem ja esta inativo.');
      }
      if (!destino.ativo) {
        throw new BadRequestException(
          'O parceiro de destino deve estar ativo.',
        );
      }

      const redesOrigem = await this.obterRedeIds(origemId, tx);
      if (redesOrigem.length) {
        await tx
          .insert(s.instituicaoRede)
          .values(
            redesOrigem.map((redeId) => ({
              instituicaoId: dto.destinoId,
              redeId,
            })),
          )
          .onConflictDoNothing();
      }
      await tx
        .delete(s.instituicaoRede)
        .where(eq(s.instituicaoRede.instituicaoId, origemId));

      const principais = await tx
        .select({
          id: s.contatoInstituicao.id,
          instituicaoId: s.contatoInstituicao.instituicaoId,
        })
        .from(s.contatoInstituicao)
        .where(
          and(
            inArray(s.contatoInstituicao.instituicaoId, [
              origemId,
              dto.destinoId,
            ]),
            eq(s.contatoInstituicao.principal, true),
            eq(s.contatoInstituicao.ativo, true),
          ),
        );
      const destinoTemPrincipal = principais.some(
        (contato) => contato.instituicaoId === dto.destinoId,
      );
      if (destinoTemPrincipal) {
        await tx
          .update(s.contatoInstituicao)
          .set({ principal: false, atualizadoEm: new Date() })
          .where(
            and(
              eq(s.contatoInstituicao.instituicaoId, origemId),
              eq(s.contatoInstituicao.principal, true),
            ),
          );
      }

      await tx
        .update(s.contatoInstituicao)
        .set({ instituicaoId: dto.destinoId, atualizadoEm: new Date() })
        .where(eq(s.contatoInstituicao.instituicaoId, origemId));
      await tx
        .update(s.atividadeMissao)
        .set({ instituicaoId: dto.destinoId, atualizadoEm: new Date() })
        .where(eq(s.atividadeMissao.instituicaoId, origemId));
      await tx
        .update(s.pessoa)
        .set({ instituicaoId: dto.destinoId, atualizadoEm: new Date() })
        .where(eq(s.pessoa.instituicaoId, origemId));
      await tx
        .update(s.anexo)
        .set({ entidadeId: dto.destinoId, atualizadoEm: new Date() })
        .where(
          and(
            eq(s.anexo.entidadeId, origemId),
            inArray(s.anexo.entidadeTipo, ['INSTITUICAO', 'PARCEIRO']),
          ),
        );
      await tx
        .update(s.instituicao)
        .set({ substituidaPorId: dto.destinoId, atualizadoEm: new Date() })
        .where(eq(s.instituicao.substituidaPorId, origemId));
      await tx
        .update(s.instituicao)
        .set({
          ativo: false,
          substituidaPorId: dto.destinoId,
          atualizadoEm: new Date(),
        })
        .where(eq(s.instituicao.id, origemId));

      await tx.insert(s.registroAuditoria).values([
        {
          entidadeTipo: 'INSTITUICAO',
          entidadeId: origemId,
          acao: 'EDICAO',
          campo: 'substituidaPorId',
          valorAnterior: null,
          valorNovo: dto.destinoId,
          justificativa: dto.justificativa,
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        },
        {
          entidadeTipo: 'INSTITUICAO',
          entidadeId: origemId,
          acao: 'EDICAO',
          campo: 'ativo',
          valorAnterior: 'true',
          valorNovo: 'false',
          justificativa: dto.justificativa,
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        },
        {
          entidadeTipo: 'INSTITUICAO',
          entidadeId: dto.destinoId,
          acao: 'EDICAO',
          campo: 'instituicaoConciliada',
          valorAnterior: null,
          valorNovo: origemId,
          justificativa: dto.justificativa,
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
        },
      ]);
    });

    return this.detalhar(dto.destinoId);
  }

  private async carregarRedesDasMissoes(
    missaoIds: string[],
  ): Promise<(RedeParceiro & { missaoId: string })[]> {
    if (!missaoIds.length) return [];
    return this.db
      .select({
        missaoId: s.missaoRede.missaoId,
        id: s.redeCoordenadora.id,
        nome: s.redeCoordenadora.nome,
      })
      .from(s.missaoRede)
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.missaoRede.redeId),
      )
      .where(inArray(s.missaoRede.missaoId, missaoIds))
      .orderBy(asc(s.redeCoordenadora.nome));
  }

  private async carregarAtividadesDoParceiro(
    missaoIds: string[],
    instituicaoId: string,
  ): Promise<LinhaAtividadeHistorico[]> {
    if (!missaoIds.length) return [];
    return this.db
      .select({
        id: s.atividadeMissao.id,
        missaoId: s.atividadeMissao.missaoId,
        ordem: s.atividadeMissao.ordem,
        titulo: s.atividadeMissao.titulo,
        tipo: s.atividadeMissao.tipo,
        dataInicio: s.atividadeMissao.dataInicio,
        dataFim: s.atividadeMissao.dataFim,
        cidade: s.atividadeMissao.cidade,
        estadoRegiao: s.atividadeMissao.estadoRegiao,
        local: s.atividadeMissao.local,
        pais: s.pais.nome,
        tipoRelacionamento: s.atividadeMissao.tipoRelacionamento,
        objetivoRelacionamento: s.atividadeMissao.objetivoRelacionamento,
        contatoId: s.contatoInstituicao.id,
        contatoNome: s.contatoInstituicao.nome,
        status: s.atividadeMissao.status,
        eventoNome: s.atividadeMissao.eventoNome,
        eventoTipo: s.atividadeMissao.eventoTipo,
        eventoSite: s.atividadeMissao.eventoSite,
        objetivoParticipacao: s.atividadeMissao.objetivoParticipacao,
        relacaoInternacionalizacao:
          s.atividadeMissao.relacaoInternacionalizacao,
      })
      .from(s.atividadeMissao)
      .leftJoin(s.pais, eq(s.pais.id, s.atividadeMissao.paisId))
      .leftJoin(
        s.contatoInstituicao,
        eq(s.contatoInstituicao.id, s.atividadeMissao.contatoInstituicaoId),
      )
      .where(
        and(
          inArray(s.atividadeMissao.missaoId, missaoIds),
          eq(s.atividadeMissao.instituicaoId, instituicaoId),
        ),
      )
      .orderBy(asc(s.atividadeMissao.dataInicio), asc(s.atividadeMissao.ordem));
  }

  private async listarPorIds(ids: string[]): Promise<Parceiro[]> {
    if (!ids.length) return [];
    const linhas = await this.db
      .select({
        id: s.instituicao.id,
        nome: s.instituicao.nome,
        sigla: s.instituicao.sigla,
        paisId: s.instituicao.paisId,
        pais: s.pais.nome,
        codigoPais: s.pais.codigoIso2,
        cidade: s.instituicao.cidade,
        estadoRegiao: s.instituicao.estadoRegiao,
        tipoOrganizacao: s.instituicao.tipoOrganizacao,
        faculdadeDepartamento: s.instituicao.faculdadeDepartamento,
        site: s.instituicao.site,
        emailInstitucional: s.instituicao.emailInstitucional,
        telefone: s.instituicao.telefone,
        endereco: s.instituicao.endereco,
        observacoes: s.instituicao.observacoes,
        cadastroProvisorio: s.instituicao.cadastroProvisorio,
        ativo: s.instituicao.ativo,
        substituidaPorId: s.instituicao.substituidaPorId,
      })
      .from(s.instituicao)
      .leftJoin(s.pais, eq(s.pais.id, s.instituicao.paisId))
      .where(
        and(
          inArray(s.instituicao.id, ids),
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
        ),
      );
    return this.comporParceiros(linhas);
  }

  private async comporParceiros(
    linhas: Omit<
      Parceiro,
      'redes' | 'quantidadeContatos' | 'quantidadeMissoes'
    >[],
  ): Promise<Parceiro[]> {
    if (!linhas.length) return [];
    const ids = linhas.map((linha) => linha.id);
    const [redes, contatos, missoes] = await Promise.all([
      this.db
        .select({
          instituicaoId: s.instituicaoRede.instituicaoId,
          id: s.redeCoordenadora.id,
          nome: s.redeCoordenadora.nome,
        })
        .from(s.instituicaoRede)
        .innerJoin(
          s.redeCoordenadora,
          eq(s.redeCoordenadora.id, s.instituicaoRede.redeId),
        )
        .where(inArray(s.instituicaoRede.instituicaoId, ids))
        .orderBy(asc(s.redeCoordenadora.nome)),
      this.db
        .select({
          instituicaoId: s.contatoInstituicao.instituicaoId,
          total: sql<number>`count(*)::int`,
        })
        .from(s.contatoInstituicao)
        .where(
          and(
            inArray(s.contatoInstituicao.instituicaoId, ids),
            eq(s.contatoInstituicao.ativo, true),
          ),
        )
        .groupBy(s.contatoInstituicao.instituicaoId),
      this.db
        .select({
          instituicaoId: s.atividadeMissao.instituicaoId,
          total: sql<number>`count(distinct ${s.atividadeMissao.missaoId})::int`,
        })
        .from(s.atividadeMissao)
        .where(inArray(s.atividadeMissao.instituicaoId, ids))
        .groupBy(s.atividadeMissao.instituicaoId),
    ]);
    const redesPorInstituicao = new Map<string, RedeParceiro[]>();
    for (const rede of redes) {
      const lista = redesPorInstituicao.get(rede.instituicaoId) ?? [];
      lista.push({ id: rede.id, nome: rede.nome });
      redesPorInstituicao.set(rede.instituicaoId, lista);
    }
    const contatosPorInstituicao = new Map(
      contatos.map((item) => [item.instituicaoId, item.total]),
    );
    const missoesPorInstituicao = new Map(
      missoes
        .filter(
          (item): item is { instituicaoId: string; total: number } =>
            item.instituicaoId !== null,
        )
        .map((item) => [item.instituicaoId, item.total]),
    );
    return linhas.map((linha) => ({
      ...linha,
      redes: redesPorInstituicao.get(linha.id) ?? [],
      quantidadeContatos: contatosPorInstituicao.get(linha.id) ?? 0,
      quantidadeMissoes: missoesPorInstituicao.get(linha.id) ?? 0,
    }));
  }

  private async obterParceiro(id: string, db: DbOperacoes) {
    const [parceiro] = await db
      .select()
      .from(s.instituicao)
      .where(
        and(
          eq(s.instituicao.id, id),
          eq(s.instituicao.tipo, 'PARCEIRA_INTERNACIONAL'),
        ),
      )
      .limit(1);
    if (!parceiro) throw new NotFoundException('Parceiro nao encontrado.');
    return parceiro;
  }

  private async obterRedeIds(id: string, db: DbOperacoes): Promise<string[]> {
    const redes = await db
      .select({ id: s.instituicaoRede.redeId })
      .from(s.instituicaoRede)
      .where(eq(s.instituicaoRede.instituicaoId, id));
    return redes.map((rede) => rede.id);
  }

  private async validarReferencias(
    paisId: string | null | undefined,
    redeIds: string[],
    db: DbOperacoes,
  ): Promise<void> {
    if (paisId) {
      const [pais] = await db
        .select({ id: s.pais.id })
        .from(s.pais)
        .where(eq(s.pais.id, paisId))
        .limit(1);
      if (!pais) throw new NotFoundException('Pais nao encontrado.');
    }
    const ids = unicos(redeIds);
    if (!ids.length) return;
    const existentes = await db
      .select({ id: s.redeCoordenadora.id })
      .from(s.redeCoordenadora)
      .where(inArray(s.redeCoordenadora.id, ids));
    if (existentes.length !== ids.length) {
      throw new NotFoundException('Rede coordenadora nao encontrada.');
    }
  }

  private async validarDuplicidade(
    dto: DadosParaCandidatos,
    ignorarId: string | undefined,
    db: DbOperacoes,
  ): Promise<void> {
    const candidatos = await this.identificarCandidatos(dto, ignorarId, db);
    const inequivoco = candidatos.find(
      (item) => item.classificacao === 'INEQUIVOCA',
    );
    if (inequivoco) {
      throw new ConflictException({
        message: 'Ja existe uma instituicao com este nome normalizado.',
        candidatos,
      });
    }
    if (candidatos.length && !dto.confirmarPossivelDuplicidade) {
      throw new ConflictException({
        message:
          'Foram encontrados possiveis cadastros equivalentes. Confirme a duplicidade para prosseguir ou concilie os registros.',
        candidatos,
      });
    }
  }

  private async identificarCandidatos(
    dto: DadosParaCandidatos,
    ignorarId: string | undefined,
    db: DbOperacoes,
  ): Promise<CandidatoParceiro[]> {
    const existentes = await db
      .select({
        id: s.instituicao.id,
        nome: s.instituicao.nome,
        nomeNormalizado: s.instituicao.nomeNormalizado,
        sigla: s.instituicao.sigla,
        site: s.instituicao.site,
        emailInstitucional: s.instituicao.emailInstitucional,
        tipo: s.instituicao.tipo,
        ativo: s.instituicao.ativo,
      })
      .from(s.instituicao)
      .where(ignorarId ? ne(s.instituicao.id, ignorarId) : undefined)
      .limit(1000);
    const nome = normalizarNomeInstituicao(dto.nome);
    const sigla = dto.sigla ? normalizarNomeInstituicao(dto.sigla) : null;
    const dominioSite = dominioDeUrl(dto.site);
    const dominioEmail = dominioDeEmail(dto.emailInstitucional);

    return existentes
      .map((existente): CandidatoParceiro | null => {
        const motivos: string[] = [];
        const exata = existente.nomeNormalizado === nome;
        if (exata) motivos.push('MESMO_NOME_NORMALIZADO');
        if (
          sigla &&
          existente.sigla &&
          normalizarNomeInstituicao(existente.sigla) === sigla
        ) {
          motivos.push('MESMA_SIGLA');
        }
        if (dominioSite && dominioDeUrl(existente.site) === dominioSite) {
          motivos.push('MESMO_DOMINIO_DO_SITE');
        }
        if (
          dominioEmail &&
          dominioDeEmail(existente.emailInstitucional) === dominioEmail
        ) {
          motivos.push('MESMO_DOMINIO_DE_EMAIL');
        }
        const menor =
          nome.length <= existente.nomeNormalizado.length
            ? nome
            : existente.nomeNormalizado;
        const maior =
          nome.length > existente.nomeNormalizado.length
            ? nome
            : existente.nomeNormalizado;
        if (
          !exata &&
          menor.length >= 8 &&
          menor.length / maior.length >= 0.6 &&
          maior.includes(menor)
        ) {
          motivos.push('NOME_SEMELHANTE');
        }
        if (!motivos.length) return null;
        return {
          id: existente.id,
          nome: existente.nome,
          sigla: existente.sigla,
          tipo: existente.tipo,
          ativo: existente.ativo,
          classificacao: exata ? 'INEQUIVOCA' : 'POSSIVEL',
          motivos,
        };
      })
      .filter((item): item is CandidatoParceiro => item !== null)
      .sort((a, b) =>
        a.classificacao === b.classificacao
          ? a.nome.localeCompare(b.nome, 'pt-BR')
          : a.classificacao === 'INEQUIVOCA'
            ? -1
            : 1,
      );
  }

  private async substituirRedes(
    instituicaoId: string,
    redeIds: string[],
    db: DbOperacoes,
  ): Promise<void> {
    await db
      .delete(s.instituicaoRede)
      .where(eq(s.instituicaoRede.instituicaoId, instituicaoId));
    const ids = unicos(redeIds);
    if (ids.length) {
      await db.insert(s.instituicaoRede).values(
        ids.map((redeId) => ({
          instituicaoId,
          redeId,
        })),
      );
    }
  }

  private traduzirDuplicidadeConcorrente(erro: unknown): void {
    if (erro instanceof ConflictException) throw erro;
    let atual: unknown = erro;
    while (atual && typeof atual === 'object') {
      if ((atual as { code?: string }).code === '23505') {
        throw new ConflictException(
          'Outro cadastro equivalente foi gravado ao mesmo tempo. Revise os candidatos e tente novamente.',
        );
      }
      atual = (atual as { cause?: unknown }).cause;
    }
  }
}

function dadosPersistidos(
  dto: Pick<
    CriarParceiro,
    | 'nome'
    | 'sigla'
    | 'paisId'
    | 'cidade'
    | 'estadoRegiao'
    | 'tipoOrganizacao'
    | 'faculdadeDepartamento'
    | 'site'
    | 'emailInstitucional'
    | 'telefone'
    | 'endereco'
    | 'observacoes'
    | 'cadastroProvisorio'
  >,
) {
  return {
    nome: dto.nome,
    sigla: dto.sigla ?? null,
    paisId: dto.paisId ?? null,
    cidade: dto.cidade ?? null,
    estadoRegiao: dto.estadoRegiao ?? null,
    tipoOrganizacao: dto.tipoOrganizacao ?? null,
    faculdadeDepartamento: dto.faculdadeDepartamento ?? null,
    site: dto.site ?? null,
    emailInstitucional: dto.emailInstitucional ?? null,
    telefone: dto.telefone ?? null,
    endereco: dto.endereco ?? null,
    observacoes: dto.observacoes ?? null,
    cadastroProvisorio: dto.cadastroProvisorio,
  };
}

function unicos(ids: string[]): string[] {
  return [...new Set(ids)];
}

function dominioDeUrl(valor: string | null | undefined): string | null {
  if (!valor) return null;
  try {
    return new URL(valor).hostname
      .toLocaleLowerCase('pt-BR')
      .replace(/^www\./, '');
  } catch {
    return null;
  }
}

function dominioDeEmail(valor: string | null | undefined): string | null {
  if (!valor) return null;
  return valor.split('@')[1]?.toLocaleLowerCase('pt-BR') ?? null;
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}

function serializar(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === 'string' ? valor : JSON.stringify(valor);
}
