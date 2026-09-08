import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import type { AuthUser } from '../auth/auth-user';
import { IdentidadeService } from '../auth/identidade.service';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Notificacoes do Comite (D-11, decidido em 2026-09-07).
 *
 * **A notificacao e gravada na mesma transacao do fato.** E o ponto inteiro do
 * outbox: a decisao nunca depende do canal de aviso. `registrar` recebe a
 * transacao de quem a chama, e nao abre uma propria — se abrisse, um aviso
 * gravado com sucesso poderia sobreviver a uma decisao revertida, e a caixa de
 * entrada afirmaria algo que nao aconteceu.
 *
 * **A entrega externa e outro passo.** Hoje nao ha canal: as notificacoes
 * nascem `NAO_APLICAVEL` e a caixa de entrada no sistema e o unico meio.
 * Quando houver SMTP, `CANAL` deixa de ser nulo e `despachar` passa a ter o que
 * fazer — sem mudar nada do que ja esta gravado.
 */

/**
 * Canal externo de entrega.
 *
 * Interface, e nao classe: e o contrato que o adaptador de e-mail vai
 * preencher, e mante-lo minimo e o que evita que a forma do SMTP vaze para o
 * dominio. `entregar` lanca em caso de falha — quem trata e `despachar`.
 */
export interface CanalDeEntrega {
  entregar(notificacao: {
    destinatarioEmail: string | null;
    titulo: string;
    corpo: string;
  }): Promise<void>;
}

/**
 * O canal ativo. Nulo enquanto nao houver servidor SMTP (decisao de
 * 2026-09-07): o responsavel confirmou que havera um no futuro.
 */
export const CANAL_DE_ENTREGA = Symbol('CANAL_DE_ENTREGA');

export type TipoNotificacao = (typeof s.tipoNotificacaoEnum.enumValues)[number];

export interface NovaNotificacao {
  tipo: TipoNotificacao;
  destinatarioId: string;
  missaoId: string;
  titulo: string;
  corpo: string;
  origemPor?: string | null;
}

export interface NotificacaoResumo {
  id: string;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  origemPor: string | null;
  missaoId: string;
  missaoCodigo: string;
  criadoEm: string;
  lidaEm: string | null;
}

export interface CaixaDeEntrada {
  itens: NotificacaoResumo[];
  naoLidas: number;
  /**
   * Verdadeiro quando quem pediu ainda nao tem pessoa vinculada.
   *
   * Sem vinculo nao ha para quem enderecar nada, e a caixa vem vazia — mas
   * vazia por falta de vinculo e vazia por falta de aviso sao coisas
   * diferentes, e a tela precisa poder dizer qual e.
   */
  vinculoPendente: boolean;
}

/** Transacao ou o proprio banco; `registrar` aceita os dois. */
type Escritor = Pick<Database, 'insert'>;

@Injectable()
export class NotificacoesService {
  private readonly logger = new Logger(NotificacoesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
    @Inject(CANAL_DE_ENTREGA)
    private readonly canal: CanalDeEntrega | null,
  ) {}

  /**
   * Grava a notificacao. **Chame de dentro da transacao do fato.**
   *
   * Destinatario repetido e ignorado em silencio: quem submete a propria missao
   * e frequentemente quem a acompanha, e receber aviso do proprio ato so
   * atrapalha. Filtrar aqui, e nao em cada chamador, evita que o proximo
   * esqueca.
   */
  async registrar(
    escritor: Escritor,
    notificacoes: NovaNotificacao[],
    excetoPessoaId?: string | null,
  ): Promise<void> {
    const alvos = notificacoes.filter(
      (item) => item.destinatarioId !== excetoPessoaId,
    );
    if (alvos.length === 0) return;

    await escritor
      .insert(s.notificacao)
      .values(
        alvos.map((item) => ({
          tipo: item.tipo,
          destinatarioId: item.destinatarioId,
          missaoId: item.missaoId,
          titulo: item.titulo,
          corpo: item.corpo,
          origemPor: item.origemPor ?? null,
          entregaEstado: this.canal
            ? ('PENDENTE' as const)
            : ('NAO_APLICAVEL' as const),
        })),
      )
      // A unicidade parcial de `PRESTACAO_PENDENTE` e o que torna a varredura
      // idempotente; colidir nela e o resultado esperado, nao erro.
      .onConflictDoNothing();
  }

  /**
   * Caixa de entrada de quem esta autenticado.
   *
   * Antes de listar, roda a varredura de pendencias de prestacao. **Nao ha
   * rotina agendada:** o fato "viagem encerrada sem prestacao" decorre do
   * calendario, e a lista de pendencias do painel (CG-066) ja o calcula a cada
   * leitura. Derivar dali evita um segundo lugar onde a regra pode divergir, e
   * evita trazer um processo agendado para a instituicao operar. O que a rotina
   * traria e o empurrao sem alguem abrir a tela — e isso so faz sentido junto
   * com o e-mail, que ainda nao existe.
   */
  async caixaDeEntrada(usuario: AuthUser): Promise<CaixaDeEntrada> {
    const identidade = await this.identidade.resolver(usuario);
    if (!identidade) {
      return { itens: [], naoLidas: 0, vinculoPendente: true };
    }

    await this.varrerPendenciasDePrestacao(identidade.pessoaId);

    const linhas = await this.db
      .select({
        id: s.notificacao.id,
        tipo: s.notificacao.tipo,
        titulo: s.notificacao.titulo,
        corpo: s.notificacao.corpo,
        origemPor: s.notificacao.origemPor,
        missaoId: s.notificacao.missaoId,
        missaoCodigo: s.missaoComite.codigo,
        criadoEm: s.notificacao.criadoEm,
        lidaEm: s.notificacao.lidaEm,
      })
      .from(s.notificacao)
      .innerJoin(s.missaoComite, eq(s.missaoComite.id, s.notificacao.missaoId))
      .where(eq(s.notificacao.destinatarioId, identidade.pessoaId))
      .orderBy(desc(s.notificacao.criadoEm))
      .limit(100);

    return {
      itens: linhas.map((linha) => ({
        ...linha,
        criadoEm: linha.criadoEm.toISOString(),
        lidaEm: linha.lidaEm?.toISOString() ?? null,
      })),
      naoLidas: linhas.filter((linha) => linha.lidaEm === null).length,
      vinculoPendente: false,
    };
  }

  /**
   * Marca como lida. So o proprio destinatario pode.
   *
   * 404, e nao 403: "existe, mas nao e sua" ja entrega que a notificacao
   * existe — e notificacao alheia diz de que missao alguem foi avisado.
   */
  async marcarLida(id: string, usuario: AuthUser): Promise<void> {
    const identidade = await this.identidade.resolver(usuario);
    if (!identidade) throw new NotFoundException('Notificacao nao encontrada.');

    const [linha] = await this.db
      .update(s.notificacao)
      .set({ lidaEm: sql`now()` })
      .where(
        and(
          eq(s.notificacao.id, id),
          eq(s.notificacao.destinatarioId, identidade.pessoaId),
          isNull(s.notificacao.lidaEm),
        ),
      )
      .returning({ id: s.notificacao.id });

    // Ja lida nao e erro: dois cliques na mesma linha sao o caso comum.
    if (!linha) await this.exigirExistencia(id, identidade.pessoaId);
  }

  /**
   * Tenta entregar o que esta pendente pelo canal externo.
   *
   * **Falha nao apaga nada.** A notificacao continua `PENDENTE`, com o erro e a
   * contagem de tentativas ao lado, e o fato que a originou permanece intacto —
   * e o criterio de aceite da CG-039. Sem canal configurado, nao ha o que
   * despachar e o metodo devolve zero sem tocar no banco.
   */
  async despachar(limite = 50): Promise<{ entregues: number; falhas: number }> {
    if (!this.canal) return { entregues: 0, falhas: 0 };

    const pendentes = await this.db
      .select({
        id: s.notificacao.id,
        titulo: s.notificacao.titulo,
        corpo: s.notificacao.corpo,
        email: s.pessoa.email,
      })
      .from(s.notificacao)
      .innerJoin(s.pessoa, eq(s.pessoa.id, s.notificacao.destinatarioId))
      .where(eq(s.notificacao.entregaEstado, 'PENDENTE'))
      .limit(limite);

    let entregues = 0;
    let falhas = 0;

    for (const pendente of pendentes) {
      try {
        await this.canal.entregar({
          destinatarioEmail: pendente.email,
          titulo: pendente.titulo,
          corpo: pendente.corpo,
        });
        await this.db
          .update(s.notificacao)
          .set({ entregaEstado: 'ENTREGUE', entregueEm: sql`now()` })
          .where(eq(s.notificacao.id, pendente.id));
        entregues += 1;
      } catch (erro) {
        // Continua `PENDENTE`: a proxima passada tenta de novo. Marcar
        // `FALHOU` aqui transformaria uma indisponibilidade momentanea do
        // servidor de e-mail em aviso perdido para sempre.
        await this.db
          .update(s.notificacao)
          .set({
            entregaTentativas: sql`${s.notificacao.entregaTentativas} + 1`,
            entregaUltimoErro:
              erro instanceof Error ? erro.message : String(erro),
          })
          .where(eq(s.notificacao.id, pendente.id));
        falhas += 1;
        this.logger.warn(
          `Entrega da notificacao ${pendente.id} falhou; segue pendente.`,
        );
      }
    }

    return { entregues, falhas };
  }

  // -------------------------------------------------------------------------

  /**
   * Cria a pendencia de prestacao das missoes desta pessoa, uma vez cada.
   *
   * O criterio e o mesmo do painel: viagem encerrada, missao confirmada ou
   * concluida, e nenhuma linha de prestacao. A idempotencia vem do indice
   * parcial `notificacao_pendencia_uk`, e nao de uma checagem antes do insert —
   * duas abas abertas ao mesmo tempo passariam pela checagem juntas.
   */
  private async varrerPendenciasDePrestacao(pessoaId: string): Promise<void> {
    await this.db.execute(sql`
      insert into notificacao
        (tipo, destinatario_id, missao_id, titulo, corpo, entrega_estado)
      select 'PRESTACAO_PENDENTE',
             ${pessoaId}::uuid,
             m.id,
             'Prestação de contas pendente',
             'A missão ' || m.codigo || ' — ' || m.titulo ||
               ' terminou em ' || to_char(m.data_fim, 'DD/MM/YYYY') ||
               ' e a prestação de contas não foi iniciada.',
             'NAO_APLICAVEL'
        from missao_comite m
        join missao_participante mp
          on mp.missao_id = m.id and mp.pessoa_id = ${pessoaId}::uuid
       where m.data_fim < current_date
         and m.status in ('CONFIRMADA', 'CONCLUIDA')
         and not exists (
           select 1 from prestacao_contas_missao p where p.missao_id = m.id
         )
      on conflict do nothing
    `);
  }

  private async exigirExistencia(id: string, pessoaId: string): Promise<void> {
    const [existe] = await this.db
      .select({ id: s.notificacao.id })
      .from(s.notificacao)
      .where(
        and(
          eq(s.notificacao.id, id),
          eq(s.notificacao.destinatarioId, pessoaId),
        ),
      );
    if (!existe) throw new NotFoundException('Notificacao nao encontrada.');
  }
}

/**
 * Quem acompanha uma missao: o responsavel e os demais participantes.
 *
 * Exportado porque os tres servicos que notificam precisam da mesma lista, e
 * cada um montando a sua produziria avisos que chegam a pessoas diferentes
 * conforme o evento — o tipo de inconsistencia que ninguem reporta porque
 * parece "so nao ter chegado".
 */
export async function destinatariosDaMissao(
  leitor: Pick<Database, 'selectDistinct'>,
  missaoId: string,
): Promise<string[]> {
  const linhas = await leitor
    .selectDistinct({ pessoaId: s.missaoParticipante.pessoaId })
    .from(s.missaoParticipante)
    .where(eq(s.missaoParticipante.missaoId, missaoId));
  return linhas.map((linha) => linha.pessoaId);
}

/**
 * Quem decide: os membros ativos do Comite Gestor no ciclo.
 *
 * Usado para avisar que ha missao na fila. Vinculo encerrado nao recebe, pela
 * mesma razao pela qual nao concede acesso (CG-028).
 */
export async function membrosDoComite(
  leitor: Pick<Database, 'selectDistinct'>,
  cicloId: string,
): Promise<string[]> {
  const linhas = await leitor
    .selectDistinct({ pessoaId: s.membroEquipeGestao.pessoaId })
    .from(s.membroEquipeGestao)
    .where(
      and(
        eq(s.membroEquipeGestao.cicloId, cicloId),
        eq(s.membroEquipeGestao.tipoEquipe, 'COMITE_GESTOR'),
        isNull(s.membroEquipeGestao.dataFim),
      ),
    );
  return linhas.map((linha) => linha.pessoaId);
}
