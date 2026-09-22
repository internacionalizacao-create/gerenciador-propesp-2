import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { asc, eq, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import type { AcessoResolvido } from '../auth/autorizacao-v1/acesso-v1.service';
import {
  condicaoDoAlcance,
  type Alcance,
} from '../auth/autorizacao-v1/alcance';
import {
  condicaoDaBolsa,
  condicaoDoLado,
} from '../auth/autorizacao-v1/recorte-bolsa';
import { consultar } from '../comum/consultar';
import { dataHojeEmManaus } from '../comum/datas';
import { violouUnicidade } from '../comum/postgres';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { exigirVaga } from './bolsistas.service';
import type { CicloResolvido } from './contexto.service';

/**
 * Eventos externos da CAPES (V1-036). Contrato: docs/eventos-externos-v1.md.
 *
 * O Gerenciador **registra** o que ja aconteceu na plataforma da CAPES; nao
 * propoe, nao autoriza e nao paga. Dois grupos, em duas tabelas:
 *
 * - **A · movimentacao de recurso** (`remanejamento`): recurso ou vaga que
 *   mudou de PPG dentro da mesma area tematica. **Nao toca no plano nem no
 *   teto** — redistribui dentro de um teto que nao muda, e replanejar a linha
 *   continua sendo ato explicito da P10, com a auditoria dela. Mexer no
 *   `planejamento_anual` daqui seria atualizar derivado financeiro por fora dos
 *   servicos de calculo.
 * - **B · evento do beneficiario** (`evento_bolsista`): a situacao da pessoa
 *   mudou. O efeito na bolsa vem do **tipo**, que e dado (contrato §7.1).
 *
 * Tres regras valem para os dois:
 *
 * 1. **Reenvio nao duplica.** Quem envia gera `chave`; a mesma chave devolve o
 *    registro existente, e chave reaproveitada em outro alvo e 409.
 * 2. **Correcao nao apaga.** O valor corrigido substitui o anterior na linha, e
 *    a trilha guarda a troca campo a campo, com o motivo.
 * 3. **A data do ato e informada; a do registro e automatica** (§7.2).
 */

const dataCompleta = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data completa.')
  .refine(dataIsoValida, 'Informe uma data válida.');

const texto = (maximo: number) => z.string().trim().max(maximo);

const justificativa = z
  .string()
  .trim()
  .min(3, 'Informe a justificativa do registro.')
  .max(4000);

const motivoCorrecao = z
  .string()
  .trim()
  .min(3, 'Informe o motivo da correção.')
  .max(4000);

const valorMonetario = z
  .string()
  .trim()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Informe um valor com até duas casas.')
  .refine((valor) => Number(valor) > 0, 'O valor precisa ser maior que zero.');

export const registrarEventoBolsistaSchema = z.object({
  chave: z.uuid('Chave de envio inválida.'),
  tipo: z.string().trim().min(1, 'Selecione o tipo de evento.').max(40),
  dataAto: dataCompleta,
  justificativa,
  referenciaExterna: texto(200).nullish(),
  previsaoRetorno: dataCompleta.nullish(),
  bolsaSubstitutaId: z.uuid().nullish(),
});
export type RegistrarEventoBolsista = z.infer<
  typeof registrarEventoBolsistaSchema
>;

/**
 * Correcao parcial: campo ausente fica como esta; `null` limpa o que aceita
 * ficar vazio.
 */
export const corrigirEventoBolsistaSchema = z.object({
  motivo: motivoCorrecao,
  tipo: z.string().trim().min(1).max(40).optional(),
  dataAto: dataCompleta.optional(),
  justificativa: justificativa.optional(),
  referenciaExterna: texto(200).nullable().optional(),
  previsaoRetorno: dataCompleta.nullable().optional(),
  bolsaSubstitutaId: z.uuid().nullable().optional(),
});
export type CorrigirEventoBolsista = z.infer<
  typeof corrigirEventoBolsistaSchema
>;

const camposMovimentacao = {
  dataAto: dataCompleta,
  ano: z.coerce.number().int().min(2000).max(2100),
  areaTematicaId: z.uuid('Selecione a área temática.'),
  ppgOrigemId: z.uuid('Selecione o PPG de origem.'),
  ppgDestinoId: z.uuid('Selecione o PPG de destino.'),
  rubrica: z.enum(['BOLSAS', 'MANUTENCAO', 'MISSOES']),
  modalidadeId: z.uuid().nullish(),
  quantidade: z.coerce.number().int().positive().nullish(),
  valor: valorMonetario,
  justificativa,
  referenciaExterna: texto(200).nullish(),
  observacoes: texto(4000).nullish(),
};

/**
 * `status` so aceita `EXECUTADO` (RN-13). O enum da tabela e generico, de
 * outros programas; no CAPES Global nao se propoe nem se rejeita, e a tela nao
 * oferece `PROPOSTO`/`AUTORIZADO`. O campo existe no payload para que quem
 * mande outro valor receba a razao, e nao um campo ignorado em silencio.
 */
const statusMovimentacao = z.literal('EXECUTADO', {
  error:
    'No CAPES Global só se registra movimentação já executada na plataforma da CAPES.',
});

export const registrarMovimentacaoSchema = z
  .object({
    chave: z.uuid('Chave de envio inválida.'),
    status: statusMovimentacao.default('EXECUTADO'),
    ...camposMovimentacao,
  })
  .superRefine(validarFormaMovimentacao);
export type RegistrarMovimentacao = z.infer<typeof registrarMovimentacaoSchema>;

export const corrigirMovimentacaoSchema = z.object({
  motivo: motivoCorrecao,
  status: statusMovimentacao.optional(),
  dataAto: camposMovimentacao.dataAto.optional(),
  ano: camposMovimentacao.ano.optional(),
  areaTematicaId: camposMovimentacao.areaTematicaId.optional(),
  ppgOrigemId: camposMovimentacao.ppgOrigemId.optional(),
  ppgDestinoId: camposMovimentacao.ppgDestinoId.optional(),
  rubrica: camposMovimentacao.rubrica.optional(),
  modalidadeId: z.uuid().nullable().optional(),
  quantidade: z.coerce.number().int().positive().nullable().optional(),
  valor: valorMonetario.optional(),
  justificativa: justificativa.optional(),
  referenciaExterna: texto(200).nullable().optional(),
  observacoes: texto(4000).nullable().optional(),
});
export type CorrigirMovimentacao = z.infer<typeof corrigirMovimentacaoSchema>;

type StatusBolsa = (typeof s.statusBolsaConcedidaEnum.enumValues)[number];

const ROTULO_STATUS: Record<StatusBolsa, string> = {
  SELECIONADO: 'Selecionado',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  INTERROMPIDA: 'Interrompida',
};

export interface TipoEventoBolsistaDto {
  codigo: string;
  rotulo: string;
  descricao: string | null;
  estadosOrigem: StatusBolsa[];
  estadoDestino: StatusBolsa | null;
  aceitaSubstituta: boolean;
  aceitaPrevisaoRetorno: boolean;
}

export interface EventoBolsistaDto {
  id: string;
  bolsaConcedidaId: string;
  bolsista: string;
  ppgSigla: string;
  tipo: string;
  tipoRotulo: string;
  dataAto: string;
  registradoEm: string;
  registradoPorNome: string | null;
  justificativa: string;
  referenciaExterna: string | null;
  previsaoRetorno: string | null;
  bolsaSubstitutaId: string | null;
  /** Nome de quem entrou; nulo sem alcance sobre a bolsa substituta. */
  substituto: string | null;
  statusAnterior: StatusBolsa;
  statusPosterior: StatusBolsa;
  /** Anexos ativos. Zero e o "sem comprovante" que a tela destaca (§7.4). */
  comprovantes: number;
  corrigido: boolean;
}

export interface MovimentacaoDto {
  id: string;
  codigo: string;
  dataAto: string;
  registradoEm: string;
  registradoPorNome: string | null;
  ano: number;
  rubrica: 'BOLSAS' | 'MANUTENCAO' | 'MISSOES';
  areaTematicaId: string;
  areaTematicaCodigo: string;
  areaTematica: string;
  rede: string;
  ppgOrigemId: string;
  ppgOrigemSigla: string;
  ppgDestinoId: string;
  ppgDestinoSigla: string;
  modalidadeId: string | null;
  modalidade: string | null;
  quantidade: number | null;
  valor: string;
  status: 'EXECUTADO';
  justificativa: string;
  referenciaExterna: string | null;
  observacoes: string | null;
  comprovantes: number;
  corrigido: boolean;
}

const MENSAGEM_CHAVE_REUSADA =
  'Esta chave de envio já foi usada em outro registro. Recarregue o formulário e envie novamente.';

@Injectable()
export class EventosExternosService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // -------------------------------------------------------------------------
  // Grupo B · eventos do beneficiario
  // -------------------------------------------------------------------------

  async tipos(): Promise<TipoEventoBolsistaDto[]> {
    return this.db
      .select({
        codigo: s.tipoEventoBolsista.codigo,
        rotulo: s.tipoEventoBolsista.rotulo,
        descricao: s.tipoEventoBolsista.descricao,
        estadosOrigem: s.tipoEventoBolsista.estadosOrigem,
        estadoDestino: s.tipoEventoBolsista.estadoDestino,
        aceitaSubstituta: s.tipoEventoBolsista.aceitaSubstituta,
        aceitaPrevisaoRetorno: s.tipoEventoBolsista.aceitaPrevisaoRetorno,
      })
      .from(s.tipoEventoBolsista)
      .where(eq(s.tipoEventoBolsista.ativo, true))
      .orderBy(
        asc(s.tipoEventoBolsista.ordem),
        asc(s.tipoEventoBolsista.codigo),
      );
  }

  /**
   * Historico de uma bolsa: os eventos dela e aquele em que ela entrou como
   * substituta. A bolsa fora do alcance responde 404, como no resto da P03 —
   * a existencia da concessao ja e o dado protegido.
   */
  async daBolsa(bolsaId: string, acesso: AcessoResolvido) {
    const alcance = acesso.alcance('evento:read');
    const [visivel] = await consultar<{ id: string }>(
      this.db,
      sql`select bc.id from bolsa_concedida bc
           where bc.id = ${bolsaId}::uuid and ${condicaoDaBolsa(alcance)}`,
    );
    if (!visivel)
      throw new NotFoundException('Bolsa concedida não encontrada.');

    const [eventos, substituiu, substitutas] = await Promise.all([
      this.consultarEventos(
        alcance,
        sql`eb.bolsa_concedida_id = ${bolsaId}::uuid`,
      ),
      this.consultarEventos(
        alcance,
        sql`eb.bolsa_substituta_id = ${bolsaId}::uuid`,
      ),
      this.candidatasASubstituta(bolsaId, acesso),
    ]);
    return { eventos, substituiu, substitutas };
  }

  /**
   * Bolsas que podem entrar no lugar desta (V1-037): a mesma vaga — mesma
   * linha planejada e exercicio, ou, na bolsa avulsa, mesmo ciclo, PPG e
   * modalidade —, fora de `CANCELADA` e ainda nao ligadas a outra
   * substituicao. E a mesma regra de `validarSubstituta`, dita antes, para o
   * formulario so oferecer o que a API aceitaria.
   */
  private candidatasASubstituta(bolsaId: string, acesso: AcessoResolvido) {
    const alcance = acesso.alcance('evento:create');
    return consultar<{ id: string; bolsista: string; status: StatusBolsa }>(
      this.db,
      sql`
      select bc.id, pe.nome as "bolsista", bc.status
        from bolsa_concedida bc
        join pessoa pe on pe.id = bc.pessoa_id
        join bolsa_concedida saida on saida.id = ${bolsaId}::uuid
       where bc.id <> saida.id
         and bc.status <> 'CANCELADA'
         and ${condicaoDaBolsa(alcance)}
         and not exists (select 1 from evento_bolsista eb
                          where eb.bolsa_substituta_id = bc.id)
         and case
               when saida.item_planejado_id is not null then
                 bc.item_planejado_id = saida.item_planejado_id
                 and extract(year from bc.data_inicio)
                   = extract(year from saida.data_inicio)
               else bc.item_planejado_id is null
                 and bc.ciclo_id = saida.ciclo_id
                 and bc.ppg_id = saida.ppg_id
                 and bc.modalidade_id = saida.modalidade_id
             end
       order by pe.nome
    `,
    );
  }

  /**
   * Tematicas do ciclo com os PPGs que participam delas, recortadas pelo
   * alcance de registrar (V1-037). O formulario so oferece par que a API
   * aceitaria: origem e destino saem da mesma lista.
   */
  async referenciasDeMovimentacao(
    ciclo: CicloResolvido,
    acesso: AcessoResolvido,
  ) {
    const alcance = acesso.alcance('evento:create');
    const [tematicas, modalidades] = await Promise.all([
      consultar<{
        id: string;
        codigo: string;
        nome: string;
        rede: string;
        ppgs: { id: string; sigla: string; nome: string }[];
      }>(
        this.db,
        sql`
        select at.id, at.codigo, at.nome, rc.nome as "rede",
               jsonb_agg(jsonb_build_object('id', pg.id, 'sigla', pg.sigla,
                 'nome', pg.nome) order by pg.sigla) as "ppgs"
          from area_tematica at
          join rede_coordenadora rc on rc.id = at.rede_id
          join participacao_ppg pp on pp.area_tematica_id = at.id
          join ppg pg on pg.id = pp.ppg_id
         where rc.ciclo_id = ${ciclo.cicloId}::uuid
           and coalesce(${condicaoDoAlcance(alcance, {
             ciclo: sql`rc.ciclo_id`,
             ppg: sql`pp.ppg_id`,
             tematica: sql`at.id`,
             rede: sql`rc.id`,
             participacao: sql`pp.id`,
           })}, false)
         group by at.id, at.codigo, at.nome, rc.nome
        -- Movimentar exige dois PPGs alcancados na mesma tematica.
        having count(*) >= 2
         order by rc.nome, at.codigo
      `,
      ),
      this.db
        .select({ id: s.modalidade.id, nome: s.modalidade.nome })
        .from(s.modalidade)
        .where(eq(s.modalidade.ativa, true))
        .orderBy(asc(s.modalidade.nome)),
    ]);
    return { anos: ciclo.anos, tematicas, modalidades };
  }

  async doCiclo(ciclo: CicloResolvido, acesso: AcessoResolvido) {
    return this.consultarEventos(
      acesso.alcance('evento:read'),
      sql`bc.ciclo_id = ${ciclo.cicloId}::uuid`,
    );
  }

  /**
   * Registra o evento e aplica o efeito do tipo, numa transacao so.
   *
   * Exige `evento:create` **e** `bolsa:edit` sobre a bolsa (contrato §4): o
   * evento muda a situacao da concessao, e quem nao pode edita-la nao pode
   * muda-la por esta porta lateral.
   */
  async registrar(
    bolsaId: string,
    dto: RegistrarEventoBolsista,
    usuario: AuthUser,
    acesso: AcessoResolvido,
  ): Promise<EventoBolsistaDto> {
    const id = await this.db
      .transaction(async (tx) => {
        const bolsa = await travarBolsa(
          tx,
          bolsaId,
          sql`${condicaoDaBolsa(acesso.alcance('evento:create'))}
              and ${condicaoDaBolsa(acesso.alcance('bolsa:edit'))}`,
        );

        // Depois do lock da bolsa: dois reenvios simultaneos para a mesma
        // bolsa se enfileiram ali, e o segundo encontra o primeiro aqui.
        const repetido = await eventoPelaChave(tx, dto.chave);
        if (repetido) {
          if (
            repetido.bolsaConcedidaId === bolsaId &&
            repetido.tipo === dto.tipo
          )
            return repetido.id;
          throw new ConflictException(MENSAGEM_CHAVE_REUSADA);
        }

        const tipo = await tipoAtivo(tx, dto.tipo);
        if (!tipo.estadosOrigem.includes(bolsa.status)) {
          throw new UnprocessableEntityException(
            `${tipo.rotulo} não se aplica a bolsa com situação ${ROTULO_STATUS[bolsa.status]}.`,
          );
        }
        validarDatasDoEvento(dto.dataAto, dto.previsaoRetorno ?? null);
        if (dto.previsaoRetorno && !tipo.aceitaPrevisaoRetorno) {
          throw new BadRequestException(
            `${tipo.rotulo} não tem previsão de retorno.`,
          );
        }
        if (dto.bolsaSubstitutaId) {
          if (!tipo.aceitaSubstituta) {
            throw new BadRequestException(
              `${tipo.rotulo} não aponta bolsa substituta.`,
            );
          }
          await validarSubstituta(
            tx,
            bolsa,
            dto.bolsaSubstitutaId,
            acesso.alcance('evento:create'),
          );
        }

        const statusPosterior = tipo.estadoDestino ?? bolsa.status;
        await aplicarStatus(tx, bolsa, statusPosterior, {
          usuario,
          dataAto: dto.dataAto,
          justificativa: `${tipo.rotulo}: ${dto.justificativa}`,
        });

        const [criado] = await tx
          .insert(s.eventoBolsista)
          .values({
            bolsaConcedidaId: bolsaId,
            tipo: tipo.codigo,
            dataAto: dto.dataAto,
            justificativa: dto.justificativa,
            referenciaExterna: vazioParaNulo(dto.referenciaExterna),
            previsaoRetorno: dto.previsaoRetorno ?? null,
            bolsaSubstitutaId: dto.bolsaSubstitutaId ?? null,
            statusAnterior: bolsa.status,
            statusPosterior,
            chaveIdempotencia: dto.chave,
            registradoPorId: usuario.id,
            registradoPorNome: usuario.name,
          })
          .returning({ id: s.eventoBolsista.id });

        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'EVENTO_BOLSISTA',
          entidadeId: criado.id,
          acao: 'CRIACAO',
          usuarioId: usuario.id,
          usuarioNome: usuario.name,
          justificativa: dto.justificativa,
          dataReferencia: dto.dataAto,
        });
        return criado.id;
      })
      .catch((erro: unknown) =>
        this.resolverColisaoDeEvento(erro, dto.chave, bolsaId, dto.tipo),
      );

    return this.eventoVisivel(id, acesso);
  }

  /**
   * Correcao de um evento ja registrado (contrato §6, exemplo "Correcao").
   *
   * Trocar o **tipo** reaplica o efeito a partir do estado que o evento
   * fotografou, e so e aceito quando nada aconteceu com a bolsa depois dele:
   * ele e o ultimo evento dela e a situacao ainda e a que ele produziu. Fora
   * disso, desfazer o efeito passaria por cima de um fato posterior.
   */
  async corrigir(
    eventoId: string,
    dto: CorrigirEventoBolsista,
    usuario: AuthUser,
    acesso: AcessoResolvido,
  ): Promise<EventoBolsistaDto> {
    await this.db
      .transaction(async (tx) => {
        const [atual] = await consultar<{
          id: string;
          bolsaConcedidaId: string;
          tipo: string;
          dataAto: string;
          justificativa: string;
          referenciaExterna: string | null;
          previsaoRetorno: string | null;
          bolsaSubstitutaId: string | null;
          statusAnterior: StatusBolsa;
          statusPosterior: StatusBolsa;
        }>(
          tx,
          sql`
        select eb.id, eb.bolsa_concedida_id as "bolsaConcedidaId", eb.tipo,
               eb.data_ato as "dataAto", eb.justificativa,
               eb.referencia_externa as "referenciaExterna",
               eb.previsao_retorno as "previsaoRetorno",
               eb.bolsa_substituta_id as "bolsaSubstitutaId",
               eb.status_anterior as "statusAnterior",
               eb.status_posterior as "statusPosterior"
          from evento_bolsista eb
          join bolsa_concedida bc on bc.id = eb.bolsa_concedida_id
         where eb.id = ${eventoId}::uuid
           and ${condicaoDaBolsa(acesso.alcance('evento:edit'))}
           for update of eb
      `,
        );
        if (!atual) throw new NotFoundException('Evento não encontrado.');

        const bolsa = await travarBolsa(tx, atual.bolsaConcedidaId, sql`true`);
        const tipoAtual = await tipoPorCodigo(tx, atual.tipo);
        const novoTipo =
          dto.tipo !== undefined && dto.tipo !== atual.tipo
            ? await tipoAtivo(tx, dto.tipo)
            : null;
        const tipo = novoTipo ?? tipoAtual;

        const proximo = {
          tipo: tipo.codigo,
          dataAto: dto.dataAto ?? atual.dataAto,
          justificativa: dto.justificativa ?? atual.justificativa,
          referenciaExterna:
            dto.referenciaExterna === undefined
              ? atual.referenciaExterna
              : vazioParaNulo(dto.referenciaExterna),
          previsaoRetorno:
            dto.previsaoRetorno === undefined
              ? atual.previsaoRetorno
              : dto.previsaoRetorno,
          bolsaSubstitutaId:
            dto.bolsaSubstitutaId === undefined
              ? atual.bolsaSubstitutaId
              : dto.bolsaSubstitutaId,
          statusPosterior: atual.statusPosterior,
        };

        if (novoTipo) {
          // Mudar o efeito na bolsa e editar a bolsa: o alcance de edicao dela
          // tambem precisa cobrir, como no registro.
          const [podeEditarBolsa] = await consultar<{ id: string }>(
            tx,
            sql`select bc.id from bolsa_concedida bc
               where bc.id = ${bolsa.id}::uuid
                 and ${condicaoDaBolsa(acesso.alcance('bolsa:edit'))}`,
          );
          if (!podeEditarBolsa) {
            throw new ForbiddenException(
              'Sem permissão para alterar a situação desta bolsa.',
            );
          }
          if (tipoAtual.aceitaSubstituta || novoTipo.aceitaSubstituta) {
            throw new UnprocessableEntityException(
              'A substituição liga duas bolsas e não troca de tipo por correção.',
            );
          }
          const [posterior] = await consultar<{ id: string }>(
            tx,
            sql`select id from evento_bolsista
               where bolsa_concedida_id = ${bolsa.id}::uuid
                 and id <> ${atual.id}::uuid
                 and criado_em >= (select criado_em from evento_bolsista
                                    where id = ${atual.id}::uuid)
               limit 1`,
          );
          if (posterior || bolsa.status !== atual.statusPosterior) {
            throw new UnprocessableEntityException(
              'A bolsa mudou depois deste evento; o tipo só pode ser corrigido no último evento registrado.',
            );
          }
          if (!novoTipo.estadosOrigem.includes(atual.statusAnterior)) {
            throw new UnprocessableEntityException(
              `${novoTipo.rotulo} não se aplica a bolsa com situação ${ROTULO_STATUS[atual.statusAnterior]}.`,
            );
          }
          proximo.statusPosterior =
            novoTipo.estadoDestino ?? atual.statusAnterior;
          // Tipo que nao tem previsao de retorno nao herda a do anterior.
          if (
            !novoTipo.aceitaPrevisaoRetorno &&
            dto.previsaoRetorno === undefined
          )
            proximo.previsaoRetorno = null;
        }

        validarDatasDoEvento(proximo.dataAto, proximo.previsaoRetorno);
        if (proximo.previsaoRetorno && !tipo.aceitaPrevisaoRetorno) {
          throw new BadRequestException(
            `${tipo.rotulo} não tem previsão de retorno.`,
          );
        }
        if (
          proximo.bolsaSubstitutaId &&
          proximo.bolsaSubstitutaId !== atual.bolsaSubstitutaId
        ) {
          if (!tipo.aceitaSubstituta) {
            throw new BadRequestException(
              `${tipo.rotulo} não aponta bolsa substituta.`,
            );
          }
          await validarSubstituta(
            tx,
            bolsa,
            proximo.bolsaSubstitutaId,
            acesso.alcance('evento:edit'),
          );
        }

        const mudancas = diferencas(
          {
            tipo: atual.tipo,
            dataAto: atual.dataAto,
            justificativa: atual.justificativa,
            referenciaExterna: atual.referenciaExterna,
            previsaoRetorno: atual.previsaoRetorno,
            bolsaSubstitutaId: atual.bolsaSubstitutaId,
            statusPosterior: atual.statusPosterior,
          },
          proximo,
        );
        if (mudancas.length === 0) return;

        if (proximo.statusPosterior !== bolsa.status) {
          await aplicarStatus(tx, bolsa, proximo.statusPosterior, {
            usuario,
            dataAto: proximo.dataAto,
            justificativa: `Correção de evento: ${dto.motivo}`,
          });
        }

        await tx
          .update(s.eventoBolsista)
          .set({ ...proximo, atualizadoEm: new Date() })
          .where(eq(s.eventoBolsista.id, atual.id));
        await auditarCorrecao(tx, 'EVENTO_BOLSISTA', atual.id, mudancas, {
          usuario,
          motivo: dto.motivo,
          dataReferencia: proximo.dataAto,
        });
      })
      .catch((erro: unknown) => {
        if (violouUnicidade(erro)) throw substitutaRepetida();
        throw erro;
      });

    return this.eventoVisivel(eventoId, acesso);
  }

  private async eventoVisivel(id: string, acesso: AcessoResolvido) {
    const [evento] = await this.consultarEventos(
      acesso.alcance('evento:read'),
      sql`eb.id = ${id}::uuid`,
    );
    if (evento) return evento;
    // Registrou sem poder ler: devolve so a identificacao, nunca o conteudo.
    return { id } as EventoBolsistaDto;
  }

  private consultarEventos(alcance: Alcance, filtro: SQL) {
    return consultar<EventoBolsistaDto>(
      this.db,
      sql`
      select eb.id,
             eb.bolsa_concedida_id                 as "bolsaConcedidaId",
             pe.nome                               as "bolsista",
             pg.sigla                              as "ppgSigla",
             eb.tipo,
             te.rotulo                             as "tipoRotulo",
             eb.data_ato                           as "dataAto",
             eb.criado_em                          as "registradoEm",
             eb.registrado_por_nome                as "registradoPorNome",
             eb.justificativa,
             eb.referencia_externa                 as "referenciaExterna",
             eb.previsao_retorno                   as "previsaoRetorno",
             eb.bolsa_substituta_id                as "bolsaSubstitutaId",
             -- O nome de quem entrou so sai para quem alcanca a outra bolsa;
             -- o bc interno sombreia o externo, e o recorte o usa.
             (select ps.nome
                from bolsa_concedida bc
                join pessoa ps on ps.id = bc.pessoa_id
               where bc.id = eb.bolsa_substituta_id
                 and ${condicaoDaBolsa(alcance)})   as "substituto",
             eb.status_anterior                    as "statusAnterior",
             eb.status_posterior                   as "statusPosterior",
             (select count(*)::int from anexo a
               where a.entidade_tipo = 'EVENTO_BOLSISTA'
                 and a.entidade_id = eb.id and a.ativo) as "comprovantes",
             exists (select 1 from registro_auditoria ra
                      where ra.entidade_tipo = 'EVENTO_BOLSISTA'
                        and ra.entidade_id = eb.id
                        and ra.acao = 'EDICAO')    as "corrigido"
        from evento_bolsista eb
        join tipo_evento_bolsista te on te.codigo = eb.tipo
        join bolsa_concedida bc      on bc.id = eb.bolsa_concedida_id
        join pessoa pe               on pe.id = bc.pessoa_id
        join ppg pg                  on pg.id = bc.ppg_id
       where ${condicaoDaBolsa(alcance)} and ${filtro}
       order by eb.data_ato, eb.criado_em
    `,
    );
  }

  /**
   * A unicidade da chave e o ultimo anteparo: dois reenvios simultaneos para
   * bolsas diferentes nao se enfileiram no lock de nenhuma delas.
   */
  private async resolverColisaoDeEvento(
    erro: unknown,
    chave: string,
    bolsaId: string,
    tipo: string,
  ): Promise<string> {
    if (!violouUnicidade(erro)) throw erro;
    const repetido = await eventoPelaChave(this.db, chave);
    if (!repetido) throw substitutaRepetida();
    if (repetido.bolsaConcedidaId === bolsaId && repetido.tipo === tipo)
      return repetido.id;
    throw new ConflictException(MENSAGEM_CHAVE_REUSADA);
  }

  // -------------------------------------------------------------------------
  // Grupo A · movimentacoes de recurso
  // -------------------------------------------------------------------------

  /**
   * Movimentacoes do ciclo. Aparece a quem alcanca **qualquer um dos lados**:
   * o PPG que recebeu e o que cedeu sao, os dois, parte do fato, e esconder a
   * movimentacao de um deles deixaria o plano dele sem explicacao.
   */
  async movimentacoes(ciclo: CicloResolvido, acesso: AcessoResolvido) {
    return this.consultarMovimentacoes(
      acesso.alcance('evento:read'),
      sql`r.ciclo_id = ${ciclo.cicloId}::uuid`,
    );
  }

  async registrarMovimentacao(
    ciclo: CicloResolvido,
    dto: RegistrarMovimentacao,
    usuario: AuthUser,
    acesso: AcessoResolvido,
  ): Promise<MovimentacaoDto> {
    const id = await this.db
      .transaction(async (tx) => {
        // Serializa os registros do ciclo: e o que torna o codigo sequencial
        // e a checagem da chave livres de corrida.
        await travarCiclo(tx, ciclo.cicloId);

        const repetida = await movimentacaoPelaChave(tx, dto.chave);
        if (repetida) {
          if (repetida.cicloId === ciclo.cicloId) return repetida.id;
          throw new ConflictException(MENSAGEM_CHAVE_REUSADA);
        }

        const lados = await validarMovimentacao(
          tx,
          ciclo,
          dto,
          acesso.alcance('evento:create'),
        );

        const [criada] = await tx
          .insert(s.remanejamento)
          .values({
            codigo: await proximoCodigo(tx, ciclo.cicloId),
            cicloId: ciclo.cicloId,
            data: dto.dataAto,
            ano: dto.ano,
            redeId: lados.redeId,
            temaOrigemId: dto.areaTematicaId,
            temaDestinoId: dto.areaTematicaId,
            ppgOrigemId: dto.ppgOrigemId,
            ppgDestinoId: dto.ppgDestinoId,
            rubrica: dto.rubrica,
            modalidadeId: dto.modalidadeId ?? null,
            quantidade: dto.quantidade ?? null,
            valor: dto.valor,
            justificativa: dto.justificativa,
            documentoAutorizacao: vazioParaNulo(dto.referenciaExterna),
            status: 'EXECUTADO',
            observacoes: vazioParaNulo(dto.observacoes),
            chaveIdempotencia: dto.chave,
            registradoPorId: usuario.id,
            registradoPorNome: usuario.name,
          })
          .returning({ id: s.remanejamento.id });

        await tx.insert(s.registroAuditoria).values({
          entidadeTipo: 'REMANEJAMENTO',
          entidadeId: criada.id,
          acao: 'CRIACAO',
          usuarioId: usuario.id,
          usuarioNome: usuario.name,
          justificativa: dto.justificativa,
          dataReferencia: dto.dataAto,
        });
        return criada.id;
      })
      .catch(async (erro: unknown) => {
        if (!violouUnicidade(erro)) throw erro;
        const repetida = await movimentacaoPelaChave(this.db, dto.chave);
        if (repetida?.cicloId === ciclo.cicloId) return repetida.id;
        throw new ConflictException(MENSAGEM_CHAVE_REUSADA);
      });

    return this.movimentacaoVisivel(id, acesso);
  }

  /**
   * Correcao da movimentacao. Os dois lados **atuais** precisam estar no
   * alcance de `evento:edit`, e os novos passam pela mesma validacao do
   * registro — corrigir nao e caminho para mover recurso entre tematicas.
   */
  async corrigirMovimentacao(
    id: string,
    dto: CorrigirMovimentacao,
    usuario: AuthUser,
    acesso: AcessoResolvido,
  ): Promise<MovimentacaoDto> {
    const alcance = acesso.alcance('evento:edit');
    await this.db.transaction(async (tx) => {
      const [atual] = await consultar<{
        id: string;
        cicloId: string;
        dataAto: string;
        ano: number;
        areaTematicaId: string;
        ppgOrigemId: string;
        ppgDestinoId: string;
        rubrica: 'BOLSAS' | 'MANUTENCAO' | 'MISSOES';
        modalidadeId: string | null;
        quantidade: number | null;
        valor: string;
        justificativa: string;
        referenciaExterna: string | null;
        observacoes: string | null;
      }>(
        tx,
        sql`
        select r.id, r.ciclo_id as "cicloId", r.data as "dataAto", r.ano,
               r.tema_origem_id as "areaTematicaId",
               r.ppg_origem_id as "ppgOrigemId",
               r.ppg_destino_id as "ppgDestinoId",
               r.rubrica, r.modalidade_id as "modalidadeId", r.quantidade,
               r.valor, r.justificativa,
               r.documento_autorizacao as "referenciaExterna", r.observacoes
          from remanejamento r
         where r.id = ${id}::uuid
           and r.chave_idempotencia is not null
           and ${condicaoDoLado(alcance, sql`r.ppg_origem_id`)}
           and ${condicaoDoLado(alcance, sql`r.ppg_destino_id`)}
           for update
      `,
      );
      if (!atual) throw new NotFoundException('Movimentação não encontrada.');

      const proximo = {
        dataAto: dto.dataAto ?? atual.dataAto,
        ano: dto.ano ?? atual.ano,
        areaTematicaId: dto.areaTematicaId ?? atual.areaTematicaId,
        ppgOrigemId: dto.ppgOrigemId ?? atual.ppgOrigemId,
        ppgDestinoId: dto.ppgDestinoId ?? atual.ppgDestinoId,
        rubrica: dto.rubrica ?? atual.rubrica,
        modalidadeId:
          dto.modalidadeId === undefined
            ? atual.modalidadeId
            : dto.modalidadeId,
        quantidade:
          dto.quantidade === undefined ? atual.quantidade : dto.quantidade,
        valor: dto.valor ?? atual.valor,
        justificativa: dto.justificativa ?? atual.justificativa,
        referenciaExterna:
          dto.referenciaExterna === undefined
            ? atual.referenciaExterna
            : vazioParaNulo(dto.referenciaExterna),
        observacoes:
          dto.observacoes === undefined
            ? atual.observacoes
            : vazioParaNulo(dto.observacoes),
      };

      const [problema] = problemasDeForma(proximo);
      if (problema) throw new BadRequestException(problema.mensagem);

      const mudancas = diferencas(
        { ...atual, valor: normalizarValor(atual.valor) },
        { ...proximo, valor: normalizarValor(proximo.valor) },
      );
      if (mudancas.length === 0) return;

      const ciclo = await cicloPorId(tx, atual.cicloId);
      const lados = await validarMovimentacao(tx, ciclo, proximo, alcance);

      await tx
        .update(s.remanejamento)
        .set({
          data: proximo.dataAto,
          ano: proximo.ano,
          redeId: lados.redeId,
          temaOrigemId: proximo.areaTematicaId,
          temaDestinoId: proximo.areaTematicaId,
          ppgOrigemId: proximo.ppgOrigemId,
          ppgDestinoId: proximo.ppgDestinoId,
          rubrica: proximo.rubrica,
          modalidadeId: proximo.modalidadeId,
          quantidade: proximo.quantidade,
          valor: proximo.valor,
          justificativa: proximo.justificativa,
          documentoAutorizacao: proximo.referenciaExterna,
          observacoes: proximo.observacoes,
          atualizadoEm: new Date(),
        })
        .where(eq(s.remanejamento.id, atual.id));
      await auditarCorrecao(tx, 'REMANEJAMENTO', atual.id, mudancas, {
        usuario,
        motivo: dto.motivo,
        dataReferencia: proximo.dataAto,
      });
    });

    return this.movimentacaoVisivel(id, acesso);
  }

  private async movimentacaoVisivel(id: string, acesso: AcessoResolvido) {
    const [linha] = await this.consultarMovimentacoes(
      acesso.alcance('evento:read'),
      sql`r.id = ${id}::uuid`,
    );
    return linha ?? ({ id } as MovimentacaoDto);
  }

  private consultarMovimentacoes(alcance: Alcance, filtro: SQL) {
    return consultar<MovimentacaoDto>(
      this.db,
      sql`
      select r.id, r.codigo,
             r.data                                as "dataAto",
             r.criado_em                           as "registradoEm",
             r.registrado_por_nome                 as "registradoPorNome",
             r.ano, r.rubrica,
             at.id                                 as "areaTematicaId",
             at.codigo                             as "areaTematicaCodigo",
             at.nome                               as "areaTematica",
             rc.nome                               as "rede",
             r.ppg_origem_id                       as "ppgOrigemId",
             po.sigla                              as "ppgOrigemSigla",
             r.ppg_destino_id                      as "ppgDestinoId",
             pd.sigla                              as "ppgDestinoSigla",
             r.modalidade_id                       as "modalidadeId",
             m.nome                                as "modalidade",
             r.quantidade, r.valor, r.status, r.justificativa,
             r.documento_autorizacao               as "referenciaExterna",
             r.observacoes,
             (select count(*)::int from anexo a
               where a.entidade_tipo = 'REMANEJAMENTO'
                 and a.entidade_id = r.id and a.ativo) as "comprovantes",
             exists (select 1 from registro_auditoria ra
                      where ra.entidade_tipo = 'REMANEJAMENTO'
                        and ra.entidade_id = r.id
                        and ra.acao = 'EDICAO')    as "corrigido"
        from remanejamento r
        join area_tematica at      on at.id = r.tema_origem_id
        join rede_coordenadora rc  on rc.id = at.rede_id
        join ppg po                on po.id = r.ppg_origem_id
        join ppg pd                on pd.id = r.ppg_destino_id
        left join modalidade m     on m.id = r.modalidade_id
       where r.chave_idempotencia is not null
         and (${condicaoDoLado(alcance, sql`r.ppg_origem_id`)}
              or ${condicaoDoLado(alcance, sql`r.ppg_destino_id`)})
         and ${filtro}
       order by r.data, r.codigo
    `,
    );
  }
}

interface BolsaTravada {
  id: string;
  status: StatusBolsa;
  itemPlanejadoId: string | null;
  cicloId: string;
  ppgId: string;
  modalidadeId: string;
  ano: number;
}

async function travarBolsa(
  db: Database,
  bolsaId: string,
  condicao: SQL,
): Promise<BolsaTravada> {
  const [bolsa] = await consultar<BolsaTravada>(
    db,
    sql`
    select bc.id, bc.status, bc.item_planejado_id as "itemPlanejadoId",
           bc.ciclo_id as "cicloId", bc.ppg_id as "ppgId",
           bc.modalidade_id as "modalidadeId",
           extract(year from bc.data_inicio)::int as "ano"
      from bolsa_concedida bc
     where bc.id = ${bolsaId}::uuid and ${condicao}
       for update of bc
  `,
  );
  if (!bolsa) throw new NotFoundException('Bolsa concedida não encontrada.');
  return bolsa;
}

/**
 * Muda a situacao da bolsa e deixa rastro.
 *
 * Voltar de `CANCELADA` para qualquer outra situacao volta a ocupar a vaga, e
 * por isso passa por `exigirVaga` — a regra que a V1-035 encontrou no codigo e
 * esta tarefa fixou: **cancelada libera a vaga, interrompida nao**.
 */
async function aplicarStatus(
  db: Database,
  bolsa: BolsaTravada,
  novo: StatusBolsa,
  contexto: { usuario: AuthUser; dataAto: string; justificativa: string },
) {
  if (novo === bolsa.status) return;
  if (bolsa.status === 'CANCELADA' && bolsa.itemPlanejadoId) {
    await exigirVaga(db, bolsa.itemPlanejadoId, bolsa.ano, bolsa.id);
  }
  await db
    .update(s.bolsaConcedida)
    .set({ status: novo, atualizadoEm: new Date() })
    .where(eq(s.bolsaConcedida.id, bolsa.id));
  await db.insert(s.registroAuditoria).values({
    entidadeTipo: 'BOLSA_CONCEDIDA',
    entidadeId: bolsa.id,
    acao: 'EDICAO',
    campo: 'status',
    valorAnterior: bolsa.status,
    valorNovo: novo,
    usuarioId: contexto.usuario.id,
    usuarioNome: contexto.usuario.name,
    justificativa: contexto.justificativa,
    dataReferencia: contexto.dataAto,
  });
}

/**
 * A bolsa que entra ocupa **a mesma vaga**: mesmo item planejado e mesmo
 * exercicio. Bolsa sem planejamento (GCUB, Erasmus) casa por ciclo, PPG e
 * modalidade, que e o que resta para dizer "a mesma vaga".
 */
async function validarSubstituta(
  db: Database,
  saida: BolsaTravada,
  substitutaId: string,
  alcance: Alcance,
) {
  if (substitutaId === saida.id) {
    throw new BadRequestException(
      'A bolsa substituta precisa ser outra concessão.',
    );
  }
  const entra = await travarBolsa(
    db,
    substitutaId,
    condicaoDaBolsa(alcance),
  ).catch((erro: unknown) => {
    if (erro instanceof NotFoundException)
      throw new NotFoundException('Bolsa substituta não encontrada.');
    throw erro;
  });
  const mesmaVaga = saida.itemPlanejadoId
    ? entra.itemPlanejadoId === saida.itemPlanejadoId && entra.ano === saida.ano
    : entra.itemPlanejadoId === null &&
      entra.cicloId === saida.cicloId &&
      entra.ppgId === saida.ppgId &&
      entra.modalidadeId === saida.modalidadeId;
  if (!mesmaVaga) {
    throw new UnprocessableEntityException(
      'A bolsa substituta precisa ocupar a mesma vaga: mesma linha planejada e mesmo exercício.',
    );
  }
  if (entra.status === 'CANCELADA') {
    throw new UnprocessableEntityException(
      'A bolsa substituta está cancelada.',
    );
  }
}

interface LadosValidados {
  redeId: string;
}

/**
 * Origem e destino na **mesma area tematica** do ciclo, e os dois no alcance
 * da acao (RN-13). Outra tematica ou rede e bloqueio, nao aviso: o teto foi
 * aprovado por tematica, e mover entre elas refaria a aprovacao.
 *
 * A mesma tematica e garantida por construcao — a movimentacao so carrega uma
 * —, e o que se confere aqui e que os dois PPGs **participam** dela.
 */
async function validarMovimentacao(
  db: Database,
  ciclo: CicloResolvido,
  dto: {
    dataAto: string;
    ano: number;
    areaTematicaId: string;
    ppgOrigemId: string;
    ppgDestinoId: string;
    modalidadeId?: string | null;
  },
  alcance: Alcance,
): Promise<LadosValidados> {
  if (dto.dataAto > dataHojeEmManaus()) {
    throw new BadRequestException(
      'A data do ato não pode estar no futuro: registra-se o que já aconteceu na CAPES.',
    );
  }
  if (!ciclo.anos.includes(dto.ano)) {
    throw new BadRequestException(
      `O exercício ${dto.ano} não pertence ao ciclo ${ciclo.cicloNome}.`,
    );
  }

  const [tematica] = await consultar<{ redeId: string }>(
    db,
    sql`select at.rede_id as "redeId"
          from area_tematica at
          join rede_coordenadora rc on rc.id = at.rede_id
         where at.id = ${dto.areaTematicaId}::uuid
           and rc.ciclo_id = ${ciclo.cicloId}::uuid`,
  );
  if (!tematica) {
    throw new BadRequestException('Área temática não encontrada neste ciclo.');
  }

  const lados = await consultar<{
    ppgId: string;
    sigla: string;
    alcancado: boolean;
  }>(
    db,
    sql`
    select pp.ppg_id as "ppgId", pg.sigla,
           coalesce(${condicaoDoAlcance(alcance, {
             ciclo: sql`rc.ciclo_id`,
             ppg: sql`pp.ppg_id`,
             tematica: sql`pp.area_tematica_id`,
             rede: sql`at.rede_id`,
             participacao: sql`pp.id`,
           })}, false) as "alcancado"
      from participacao_ppg pp
      join ppg pg on pg.id = pp.ppg_id
      join area_tematica at on at.id = pp.area_tematica_id
      join rede_coordenadora rc on rc.id = at.rede_id
     where pp.area_tematica_id = ${dto.areaTematicaId}::uuid
       and pp.ppg_id in (${dto.ppgOrigemId}::uuid, ${dto.ppgDestinoId}::uuid)
  `,
  );
  if (lados.length < 2) {
    throw new UnprocessableEntityException(
      'Origem e destino precisam ser PPGs da mesma área temática. Movimentação entre temáticas ou redes não é registrada.',
    );
  }
  const fora = lados.find((lado) => !lado.alcancado);
  if (fora) {
    throw new ForbiddenException(
      `Sem permissão para registrar movimentação envolvendo o ${fora.sigla}.`,
    );
  }

  if (dto.modalidadeId) {
    const [modalidade] = await db
      .select({ id: s.modalidade.id })
      .from(s.modalidade)
      .where(eq(s.modalidade.id, dto.modalidadeId))
      .limit(1);
    if (!modalidade)
      throw new BadRequestException('Modalidade não encontrada.');
  }

  return { redeId: tematica.redeId };
}

interface FormaMovimentacao {
  ppgOrigemId: string;
  ppgDestinoId: string;
  rubrica: string;
  modalidadeId?: string | null;
  quantidade?: number | null;
}

/** Regras de forma, usadas pelo schema do registro e pela correcao. */
function problemasDeForma(
  valor: FormaMovimentacao,
): { campo: string; mensagem: string }[] {
  const problemas: { campo: string; mensagem: string }[] = [];
  if (valor.ppgOrigemId === valor.ppgDestinoId) {
    problemas.push({
      campo: 'ppgDestinoId',
      mensagem: 'Origem e destino precisam ser PPGs diferentes.',
    });
  }
  if (valor.rubrica !== 'BOLSAS' && (valor.modalidadeId || valor.quantidade)) {
    problemas.push({
      campo: 'modalidadeId',
      mensagem: 'Modalidade e quantidade valem só para movimentação de bolsas.',
    });
  }
  return problemas;
}

function validarFormaMovimentacao(
  valor: FormaMovimentacao,
  contexto: z.RefinementCtx,
) {
  for (const problema of problemasDeForma(valor)) {
    contexto.addIssue({
      code: 'custom',
      path: [problema.campo],
      message: problema.mensagem,
    });
  }
}

function validarDatasDoEvento(dataAto: string, previsaoRetorno: string | null) {
  if (dataAto > dataHojeEmManaus()) {
    throw new BadRequestException(
      'A data do ato não pode estar no futuro: registra-se o que já aconteceu na CAPES.',
    );
  }
  if (previsaoRetorno && previsaoRetorno < dataAto) {
    throw new BadRequestException(
      'A previsão de retorno não pode ser anterior à data do ato.',
    );
  }
}

async function tipoPorCodigo(db: Database, codigo: string) {
  const [tipo] = await db
    .select()
    .from(s.tipoEventoBolsista)
    .where(eq(s.tipoEventoBolsista.codigo, codigo))
    .limit(1);
  if (!tipo) throw new BadRequestException('Tipo de evento desconhecido.');
  return tipo;
}

async function tipoAtivo(db: Database, codigo: string) {
  const tipo = await tipoPorCodigo(db, codigo);
  if (!tipo.ativo) {
    throw new BadRequestException('Tipo de evento desconhecido ou inativo.');
  }
  return tipo;
}

async function eventoPelaChave(db: Database, chave: string) {
  const [evento] = await db
    .select({
      id: s.eventoBolsista.id,
      bolsaConcedidaId: s.eventoBolsista.bolsaConcedidaId,
      tipo: s.eventoBolsista.tipo,
    })
    .from(s.eventoBolsista)
    .where(eq(s.eventoBolsista.chaveIdempotencia, chave))
    .limit(1);
  return evento ?? null;
}

async function movimentacaoPelaChave(db: Database, chave: string) {
  const [linha] = await db
    .select({ id: s.remanejamento.id, cicloId: s.remanejamento.cicloId })
    .from(s.remanejamento)
    .where(eq(s.remanejamento.chaveIdempotencia, chave))
    .limit(1);
  return linha ?? null;
}

async function travarCiclo(db: Database, cicloId: string) {
  await db.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`remanejamento:${cicloId}`}, 0))`,
  );
}

/** `REM-001`, `REM-002`… por ciclo, como o codigo das outras entidades. */
async function proximoCodigo(db: Database, cicloId: string) {
  const [{ proximo }] = await consultar<{ proximo: number }>(
    db,
    sql`select coalesce(max(substring(codigo from 5)::int), 0) + 1 as "proximo"
          from remanejamento
         where ciclo_id = ${cicloId}::uuid and codigo ~ '^REM-[0-9]+$'`,
  );
  return `REM-${String(proximo).padStart(3, '0')}`;
}

async function cicloPorId(
  db: Database,
  cicloId: string,
): Promise<CicloResolvido> {
  const [linha] = await db
    .select({
      programaId: s.programa.id,
      programaNome: s.programa.nome,
      programaSlug: s.programa.slug,
      usaRedes: s.programa.usaRedes,
      usaAreasTematicas: s.programa.usaAreasTematicas,
      cicloId: s.ciclo.id,
      cicloNome: s.ciclo.nome,
      anoInicio: s.ciclo.anoInicio,
      anoFim: s.ciclo.anoFim,
      status: s.ciclo.status,
    })
    .from(s.ciclo)
    .innerJoin(s.programa, eq(s.programa.id, s.ciclo.programaId))
    .where(eq(s.ciclo.id, cicloId))
    .limit(1);
  const anos: number[] = [];
  for (let ano = linha.anoInicio; ano <= linha.anoFim; ano++) anos.push(ano);
  return { ...linha, anos };
}

interface Mudanca {
  campo: string;
  anterior: string | null;
  novo: string | null;
}

type ValorAuditavel = string | number | null | undefined;

function diferencas(
  antes: Record<string, ValorAuditavel>,
  depois: Record<string, ValorAuditavel>,
): Mudanca[] {
  const mudancas: Mudanca[] = [];
  for (const campo of Object.keys(depois)) {
    const anterior = comoTexto(antes[campo]);
    const novo = comoTexto(depois[campo]);
    if (anterior !== novo) mudancas.push({ campo, anterior, novo });
  }
  return mudancas;
}

function comoTexto(valor: ValorAuditavel): string | null {
  if (valor === null || valor === undefined) return null;
  return String(valor);
}

/** `1500` e `1500.00` sao o mesmo valor; a trilha nao deve dizer que mudou. */
function normalizarValor(valor: string): string {
  return Number(valor).toFixed(2);
}

/**
 * Texto livre pode descrever a doenca, a causa do falecimento, a situacao da
 * familia. A trilha guarda **que** ele mudou, nunca o conteudo — a mesma regra
 * dos contatos de parceiro (docs/retencao-v1.md §3.3). O valor atual continua
 * na linha, para quem tem `evento:read`.
 */
const CAMPOS_DE_TEXTO_LIVRE = new Set(['justificativa', 'observacoes']);

async function auditarCorrecao(
  db: Database,
  entidadeTipo: 'EVENTO_BOLSISTA' | 'REMANEJAMENTO',
  entidadeId: string,
  mudancas: Mudanca[],
  contexto: { usuario: AuthUser; motivo: string; dataReferencia: string },
) {
  await db.insert(s.registroAuditoria).values(
    mudancas.map((mudanca) => {
      const livre = CAMPOS_DE_TEXTO_LIVRE.has(mudanca.campo);
      return {
        entidadeTipo,
        entidadeId,
        acao: 'EDICAO' as const,
        campo: mudanca.campo,
        valorAnterior: livre ? null : mudanca.anterior,
        valorNovo: livre ? null : mudanca.novo,
        usuarioId: contexto.usuario.id,
        usuarioNome: contexto.usuario.name,
        justificativa: contexto.motivo,
        dataReferencia: contexto.dataReferencia,
      };
    }),
  );
}

function vazioParaNulo(valor: string | null | undefined): string | null {
  const limpo = valor?.trim();
  return limpo ? limpo : null;
}

function substitutaRepetida() {
  return new ConflictException(
    'Esta bolsa já foi registrada como substituta em outro evento.',
  );
}

function dataIsoValida(valor: string): boolean {
  const data = new Date(`${valor}T00:00:00Z`);
  return (
    !Number.isNaN(data.valueOf()) && data.toISOString().slice(0, 10) === valor
  );
}
