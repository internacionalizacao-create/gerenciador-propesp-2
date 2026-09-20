import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import type { AuthUser } from '../auth/auth-user';
import { consultarUma } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';

/**
 * Participacao PPG-tematica (V1-034).
 *
 * A linha de `participacao_ppg` responde "este PPG participa desta tematica, e
 * quem responde por ele ali". Ate aqui ela so nascia pela seed, e um PPG novo
 * ficava inutilizavel no ciclo corrente: sem participacao nao ha linha de plano
 * valida, e sem linha de plano nao ha bolsa.
 *
 * **Tres cuidados que a ficha cobra, e que a implementacao ingenua erra:**
 *
 * 1. **A participacao e alvo de concessao** (`PARTICIPACAO`, e tambem alcancada
 *    pelo alvo `PPG`), e `concessao_acesso.participacao_id` e
 *    `on delete cascade`. Editar cadastro de dominio **nao concede nem revoga**
 *    nada: a remocao e *recusada* enquanto houver concessao apontando para o
 *    vinculo, em vez de deixar o banco apaga-las em silencio. Mexer no acesso
 *    por tabela indireta seria revogar sem registro de quem revogou.
 * 2. **Trocar o responsavel nao transfere acesso.** O coordenador anterior
 *    continua com o que lhe foi concedido, e o novo continua sem nada: sao duas
 *    perguntas separadas desde a V1-012.
 * 3. **Nao ha remocao em cascata.** Participacao citada por linha de plano ou
 *    por bolsa concedida nao e apagada — apagar deixaria o plano orfao de um
 *    vinculo que a consulta ainda procura.
 */

export const criarParticipacaoSchema = z.object({
  ppgId: z.uuid(),
  coordenadorTematicaId: z.uuid(),
  situacao: z
    .enum(s.situacaoParticipacaoEnum.enumValues)
    .default('CADASTRO_PRELIMINAR'),
  modalidadesPrevistas: z.string().trim().max(2000).nullish(),
  observacoes: z.string().trim().max(4000).nullish(),
});
export type CriarParticipacao = z.infer<typeof criarParticipacaoSchema>;

export const atualizarParticipacaoSchema = z
  .object({
    coordenadorTematicaId: z.uuid(),
    situacao: z.enum(s.situacaoParticipacaoEnum.enumValues),
    modalidadesPrevistas: z.string().trim().max(2000).nullish(),
    observacoes: z.string().trim().max(4000).nullish(),
    justificativa: z.string().trim().max(2000).nullish(),
  })
  .partial();
export type AtualizarParticipacao = z.infer<typeof atualizarParticipacaoSchema>;

/** O que uma participacao sustenta hoje — e o que impede apaga-la. */
export interface UsoDaParticipacao {
  /** Linhas de plano do PPG naquela tematica. */
  linhasDePlano: number;
  /** Bolsas concedidas com o mesmo par PPG/tematica. */
  bolsas: number;
  /**
   * Concessoes **ativas** que apontam para esta participacao, ou para o PPG
   * dentro deste ciclo.
   */
  concessoes: number;
  /**
   * Concessoes ja revogadas com esta participacao como alvo. Contadas a parte
   * porque impedem a remocao por outro motivo: elas sao a trilha, e o
   * `on delete cascade` as levaria junto.
   */
  concessoesRevogadas: number;
}

export interface ParticipacaoDetalhe {
  id: string;
  areaTematicaId: string;
  tematicaCodigo: string;
  ppgId: string;
  ppgSigla: string;
  ppgNome: string;
  coordenadorTematicaId: string;
  coordenadorTematica: string | null;
  situacao: string;
  modalidadesPrevistas: string | null;
  observacoes: string | null;
  uso: UsoDaParticipacao;
}

/** PPGs e pessoas que o formulario oferece. */
export interface ReferenciasParticipacao {
  ppgs: { id: string; sigla: string; nome: string; jaParticipa: boolean }[];
  pessoas: { id: string; nome: string; email: string | null }[];
}

@Injectable()
export class ParticipacoesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async referencias(
    cicloId: string,
    codigo: string,
  ): Promise<ReferenciasParticipacao> {
    const areaTematicaId = await this.exigirTematica(cicloId, codigo);

    const [ppgs, pessoas] = await Promise.all([
      this.db
        .select({
          id: s.ppg.id,
          sigla: s.ppg.sigla,
          nome: s.ppg.nome,
          /**
           * `exists`, e nao `join`: com `join` o PPG que ja participa sairia
           * duplicado quando participasse de mais de uma tematica.
           *
           * A coluna externa e escrita **qualificada a mao** (`ppg.id`), e nao
           * interpolada: dentro de um `sql` cru o Drizzle emite a coluna sem o
           * nome da tabela, e `pp.ppg_id = "id"` casaria com o `id` de
           * `participacao_ppg` — a subconsulta responderia sempre `false`, em
           * silencio, porque continua sendo SQL valido.
           */
          jaParticipa: sql<boolean>`exists (
            select 1 from participacao_ppg pp
             where pp.ppg_id = ppg.id
               and pp.area_tematica_id = ${areaTematicaId}::uuid
          )`,
        })
        .from(s.ppg)
        .orderBy(asc(s.ppg.sigla)),
      this.db
        .select({
          id: s.pessoa.id,
          nome: s.pessoa.nome,
          email: s.pessoa.email,
        })
        .from(s.pessoa)
        .orderBy(asc(s.pessoa.nome))
        .limit(500),
    ]);

    return { ppgs, pessoas };
  }

  async criar(
    cicloId: string,
    codigo: string,
    dto: CriarParticipacao,
    usuario: AuthUser,
  ): Promise<ParticipacaoDetalhe> {
    const id = await this.db.transaction(async (tx) => {
      const areaTematicaId = await this.exigirTematica(cicloId, codigo, tx);
      await this.exigirPpg(dto.ppgId, tx);
      await this.exigirPessoa(dto.coordenadorTematicaId, tx);

      // A unicidade tem indice no banco; conferir antes existe para a recusa
      // chegar com o texto que diz o que fazer, em vez do erro de constraint.
      const [repetida] = await tx
        .select({ id: s.participacaoPpg.id })
        .from(s.participacaoPpg)
        .where(
          and(
            eq(s.participacaoPpg.areaTematicaId, areaTematicaId),
            eq(s.participacaoPpg.ppgId, dto.ppgId),
          ),
        )
        .limit(1);
      if (repetida) {
        throw new ConflictException(
          'Este PPG já participa desta área temática. Para mudar o responsável, edite a participação existente.',
        );
      }

      const [criada] = await tx
        .insert(s.participacaoPpg)
        .values({
          areaTematicaId,
          ppgId: dto.ppgId,
          coordenadorTematicaId: dto.coordenadorTematicaId,
          situacao: dto.situacao,
          modalidadesPrevistas: dto.modalidadesPrevistas ?? null,
          observacoes: dto.observacoes ?? null,
        })
        .returning({ id: s.participacaoPpg.id });

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PARTICIPACAO_PPG',
        entidadeId: criada.id,
        acao: 'CRIACAO',
        valorNovo: JSON.stringify({
          ppgId: dto.ppgId,
          areaTematicaId,
          coordenadorTematicaId: dto.coordenadorTematicaId,
          situacao: dto.situacao,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      return criada.id;
    });

    return this.detalhar(id);
  }

  /**
   * Edita a participacao, com **uma linha de auditoria por campo alterado**.
   *
   * A troca de responsavel e o caso que a ficha nomeia, e o rastro precisa
   * guardar quem saiu e quem entrou: sem isso, meses depois, "quem respondia
   * por este PPG em 2027" nao tem resposta.
   */
  async atualizar(
    cicloId: string,
    codigo: string,
    id: string,
    dto: AtualizarParticipacao,
    usuario: AuthUser,
  ): Promise<ParticipacaoDetalhe> {
    await this.db.transaction(async (tx) => {
      const areaTematicaId = await this.exigirTematica(cicloId, codigo, tx);
      const atual = await this.exigirParticipacao(areaTematicaId, id, tx);
      if (dto.coordenadorTematicaId !== undefined) {
        await this.exigirPessoa(dto.coordenadorTematicaId, tx);
      }

      const campos = [
        'coordenadorTematicaId',
        'situacao',
        'modalidadesPrevistas',
        'observacoes',
      ] as const;

      const alteracoes: Record<string, unknown> = {};
      const auditoria: (typeof s.registroAuditoria.$inferInsert)[] = [];
      for (const campo of campos) {
        const enviado = dto[campo];
        if (enviado === undefined) continue;
        const anterior = atual[campo] ?? null;
        const novo = enviado ?? null;
        if (String(anterior ?? '') === String(novo ?? '')) continue;
        alteracoes[campo] = novo;
        auditoria.push({
          entidadeTipo: 'PARTICIPACAO_PPG',
          entidadeId: id,
          acao: 'EDICAO',
          campo,
          valorAnterior: anterior === null ? null : String(anterior),
          valorNovo: novo === null ? null : String(novo),
          usuarioId: usuario.id,
          usuarioNome: nomeDoUsuario(usuario),
          justificativa: dto.justificativa ?? null,
        });
      }

      if (Object.keys(alteracoes).length > 0) {
        await tx
          .update(s.participacaoPpg)
          .set({ ...alteracoes, atualizadoEm: new Date() })
          .where(eq(s.participacaoPpg.id, id));
      }
      if (auditoria.length > 0) {
        await tx.insert(s.registroAuditoria).values(auditoria);
      }
    });

    return this.detalhar(id);
  }

  /**
   * Remove a participacao — e recusa em dois casos.
   *
   * **Plano e bolsa** referenciam o par PPG/tematica e ficariam sem lastro.
   *
   * **Concessao de acesso tambem impede, e por um motivo mais forte:**
   * `concessao_acesso.participacao_id` e `on delete cascade`. Apagar a
   * participacao apagaria, dentro do banco e sem trilha nenhuma, cada concessao
   * que a tinha como alvo — inclusive as **ja revogadas**, que sao o registro
   * de que alguem teve aquele acesso e de quem o retirou. Seria a revogacao
   * silenciosa que a V1-012 existe para impedir, agravada por destruir a
   * propria prova de que houve concessao.
   *
   * Por isso a recusa vem **antes** do `delete`, e o caminho e revogar em
   * Acessos, explicitamente. Quando a participacao ja teve concessao revogada,
   * ela nao se apaga mais: a saida e marca-la `NAO_CONTEMPLADO` pela edicao,
   * que preserva os dois historicos. Guardar demais e o erro barato; apagar a
   * trilha de acesso nao tem volta.
   */
  async remover(
    cicloId: string,
    codigo: string,
    id: string,
    usuario: AuthUser,
  ): Promise<{ concessoesAfetadas: number }> {
    return this.db.transaction(async (tx) => {
      const areaTematicaId = await this.exigirTematica(cicloId, codigo, tx);
      const atual = await this.exigirParticipacao(areaTematicaId, id, tx);
      const uso = await this.usoDe(atual.ppgId, areaTematicaId, id);

      if (uso.linhasDePlano > 0 || uso.bolsas > 0) {
        throw new ConflictException(
          `Esta participação sustenta ${uso.linhasDePlano} linha(s) de plano e ${uso.bolsas} bolsa(s) concedida(s). ` +
            'Cancele ou realoque esses registros antes de remover o vínculo.',
        );
      }

      if (uso.concessoes > 0) {
        throw new ConflictException(
          `${uso.concessoes} concessão(ões) de acesso têm esta participação como alvo. ` +
            'Revogue-as em Acessos antes de remover o vínculo: apagá-lo aqui ' +
            'apagaria também o registro de quem teve esse acesso.',
        );
      }

      if (uso.concessoesRevogadas > 0) {
        throw new ConflictException(
          'Esta participação já foi alvo de concessões de acesso, e removê-la ' +
            'apagaria o registro de quem as teve e de quem as revogou. ' +
            'Marque-a como “não contemplado” na edição — o vínculo deixa de valer ' +
            'e os dois históricos permanecem.',
        );
      }

      await tx.delete(s.participacaoPpg).where(eq(s.participacaoPpg.id, id));

      await tx.insert(s.registroAuditoria).values({
        entidadeTipo: 'PARTICIPACAO_PPG',
        entidadeId: id,
        acao: 'EXCLUSAO',
        valorAnterior: JSON.stringify({
          ppgId: atual.ppgId,
          areaTematicaId,
          coordenadorTematicaId: atual.coordenadorTematicaId,
        }),
        usuarioId: usuario.id,
        usuarioNome: nomeDoUsuario(usuario),
      });

      // Chegar aqui significa que nenhuma concessao apontava para o vinculo —
      // as que apontavam por PPG continuam valendo e nao sao tocadas.
      return { concessoesAfetadas: 0 };
    });
  }

  async detalhar(id: string): Promise<ParticipacaoDetalhe> {
    const [linha] = await this.db
      .select({
        id: s.participacaoPpg.id,
        areaTematicaId: s.participacaoPpg.areaTematicaId,
        tematicaCodigo: s.areaTematica.codigo,
        ppgId: s.ppg.id,
        ppgSigla: s.ppg.sigla,
        ppgNome: s.ppg.nome,
        coordenadorTematicaId: s.participacaoPpg.coordenadorTematicaId,
        coordenadorTematica: s.pessoa.nome,
        situacao: s.participacaoPpg.situacao,
        modalidadesPrevistas: s.participacaoPpg.modalidadesPrevistas,
        observacoes: s.participacaoPpg.observacoes,
      })
      .from(s.participacaoPpg)
      .innerJoin(s.ppg, eq(s.ppg.id, s.participacaoPpg.ppgId))
      .innerJoin(
        s.areaTematica,
        eq(s.areaTematica.id, s.participacaoPpg.areaTematicaId),
      )
      .leftJoin(
        s.pessoa,
        eq(s.pessoa.id, s.participacaoPpg.coordenadorTematicaId),
      )
      .where(eq(s.participacaoPpg.id, id))
      .limit(1);

    if (!linha) throw new NotFoundException('Participação não encontrada.');

    return {
      ...linha,
      uso: await this.usoDe(linha.ppgId, linha.areaTematicaId, linha.id),
    };
  }

  /**
   * O que a participacao sustenta.
   *
   * Tres contagens numa consulta so: sao perguntas do mesmo instante, e
   * responde-las em tres idas ao banco deixaria a tela mostrar um retrato
   * misturado.
   */
  private async usoDe(
    ppgId: string,
    areaTematicaId: string,
    participacaoId: string,
  ): Promise<UsoDaParticipacao> {
    return consultarUma<UsoDaParticipacao>(
      this.db,
      sql`
      select
        (select count(*)::int from item_planejado ip
          where ip.ppg_id = ${ppgId}::uuid
            and ip.area_tematica_id = ${areaTematicaId}::uuid) as "linhasDePlano",
        (select count(*)::int from bolsa_concedida bc
          where bc.ppg_id = ${ppgId}::uuid
            and bc.area_tematica_id = ${areaTematicaId}::uuid) as "bolsas",
        -- Alcancam esta participacao tanto o alvo PARTICIPACAO quanto o alvo
        -- PPG do mesmo ciclo. Contar so o primeiro subestimaria o impacto, que
        -- e justamente o que a tela precisa mostrar.
        (select count(*)::int from concessao_acesso ca
          where ca.revogado_em is null
            and (ca.participacao_id = ${participacaoId}::uuid
                 or (ca.tipo_alvo = 'PPG'
                     and ca.ppg_id = ${ppgId}::uuid
                     and ca.ciclo_id = (
                       select rc.ciclo_id
                         from area_tematica at
                         join rede_coordenadora rc on rc.id = at.rede_id
                        where at.id = ${areaTematicaId}::uuid)))) as "concessoes",
        -- So o alvo PARTICIPACAO entra aqui: e ele que o on delete cascade
        -- levaria junto. A concessao por PPG sobrevive a remocao do vinculo.
        (select count(*)::int from concessao_acesso ca
          where ca.participacao_id = ${participacaoId}::uuid
            and ca.revogado_em is not null) as "concessoesRevogadas"
    `,
    );
  }

  /**
   * Resolve o codigo da tematica (`UNESP-T4`) e confere que ela e **deste**
   * ciclo. Devolve o id porque todo o resto trabalha com ele.
   */
  private async exigirTematica(
    cicloId: string,
    codigo: string,
    db: Pick<Database, 'select'> = this.db,
  ): Promise<string> {
    const [linha] = await db
      .select({
        id: s.areaTematica.id,
        cicloId: s.redeCoordenadora.cicloId,
      })
      .from(s.areaTematica)
      .innerJoin(
        s.redeCoordenadora,
        eq(s.redeCoordenadora.id, s.areaTematica.redeId),
      )
      .where(eq(s.areaTematica.codigo, codigo))
      .limit(1);

    // Tematica de outro ciclo responde 404, e nao 403: "existe, mas nao e
    // deste ciclo" ja entregaria que ela existe (§6).
    if (!linha || linha.cicloId !== cicloId) {
      throw new NotFoundException('Área temática não encontrada neste ciclo.');
    }
    return linha.id;
  }

  private async exigirPpg(
    ppgId: string,
    db: Pick<Database, 'select'>,
  ): Promise<void> {
    const [linha] = await db
      .select({ id: s.ppg.id })
      .from(s.ppg)
      .where(eq(s.ppg.id, ppgId))
      .limit(1);
    if (!linha) throw new BadRequestException('PPG não encontrado.');
  }

  private async exigirPessoa(
    pessoaId: string,
    db: Pick<Database, 'select'>,
  ): Promise<void> {
    const [linha] = await db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(eq(s.pessoa.id, pessoaId))
      .limit(1);
    if (!linha) {
      throw new BadRequestException('Pessoa responsável não encontrada.');
    }
  }

  private async exigirParticipacao(
    areaTematicaId: string,
    id: string,
    db: Pick<Database, 'select'>,
  ) {
    const [linha] = await db
      .select({
        id: s.participacaoPpg.id,
        ppgId: s.participacaoPpg.ppgId,
        coordenadorTematicaId: s.participacaoPpg.coordenadorTematicaId,
        situacao: s.participacaoPpg.situacao,
        modalidadesPrevistas: s.participacaoPpg.modalidadesPrevistas,
        observacoes: s.participacaoPpg.observacoes,
      })
      .from(s.participacaoPpg)
      .where(
        and(
          eq(s.participacaoPpg.id, id),
          eq(s.participacaoPpg.areaTematicaId, areaTematicaId),
        ),
      )
      .limit(1);

    if (!linha) throw new NotFoundException('Participação não encontrada.');
    return linha;
  }
}

function nomeDoUsuario(usuario: AuthUser): string | null {
  return usuario.name ?? usuario.username ?? usuario.email ?? null;
}
