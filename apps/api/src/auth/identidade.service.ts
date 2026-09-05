import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import type { AuthUser } from './auth-user';

/**
 * Liga a identidade do Keycloak ao cadastro local e resolve o escopo de acesso.
 *
 * Ate aqui a autorizacao respondia so "o que este papel pode fazer". Regras
 * como "**o seu** PPG" ou "somente o responsavel pela missao" precisam da outra
 * metade: qual pessoa e esta, e sobre o que ela manda.
 *
 * **O vinculo acontece no primeiro acesso, por e-mail.** O administrador cria a
 * conta no Keycloak com o mesmo e-mail da pessoa ja cadastrada e o vinculo se
 * faz sozinho — que e o caso das pessoas ja registradas em missoes. Sem
 * correspondencia, cria-se uma pessoa nova, porque recusar o login deixaria o
 * usuario preso sem nenhuma tela para pedir ajuda.
 */

/** Recorte de dados de um usuario, ja resolvido. */
export interface EscopoAcesso {
  /** Enxerga tudo. Quando verdadeiro, as duas listas sao irrelevantes. */
  readonly global: boolean;
  readonly ppgIds: readonly string[];
  readonly redeIds: readonly string[];
}

export interface Identidade {
  readonly usuarioId: string;
  readonly pessoaId: string;
  readonly escopo: EscopoAcesso;
}

/** Escopo de quem ainda nao tem vinculo: nao ve nada recortado. */
export const ESCOPO_VAZIO: EscopoAcesso = {
  global: false,
  ppgIds: [],
  redeIds: [],
};

@Injectable()
export class IdentidadeService {
  private readonly logger = new Logger(IdentidadeService.name);

  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Devolve a identidade local, criando o vinculo no primeiro acesso.
   *
   * E idempotente: chamada de novo, so atualiza `ultimo_acesso_em`.
   */
  async resolver(usuario: AuthUser): Promise<Identidade> {
    const existente = await this.buscarPorSub(usuario.id);
    if (existente) {
      await this.db
        .update(s.usuarioSistema)
        .set({ ultimoAcessoEm: sql`now()` })
        .where(eq(s.usuarioSistema.id, existente.usuarioId));
      return existente;
    }

    const usuarioId = await this.vincular(usuario);
    return {
      usuarioId,
      pessoaId: await this.pessoaDoUsuario(usuarioId),
      escopo: await this.escoposDe(usuarioId, usuario),
    };
  }

  /**
   * Escopo do usuario autenticado, sem criar vinculo.
   *
   * E o que as consultas de listagem usam. O papel `admin` recebe escopo global
   * mesmo sem linha em `escopo_acesso`: a alternativa seria depender de a seed
   * ter criado a linha certa, e um administrador sem acesso a nada e a falha
   * mais dificil de diagnosticar que este modulo poderia ter.
   */
  async escopoDe(usuario: AuthUser): Promise<EscopoAcesso> {
    if (usuario.roles.includes('admin')) {
      return { global: true, ppgIds: [], redeIds: [] };
    }

    const [linha] = await this.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(
        and(
          eq(s.usuarioSistema.sub, usuario.id),
          eq(s.usuarioSistema.ativo, true),
        ),
      );

    if (!linha) return ESCOPO_VAZIO;
    return this.escoposDe(linha.id, usuario);
  }

  // -------------------------------------------------------------------------

  private async buscarPorSub(sub: string): Promise<Identidade | null> {
    const [linha] = await this.db
      .select({
        usuarioId: s.usuarioSistema.id,
        pessoaId: s.usuarioSistema.pessoaId,
      })
      .from(s.usuarioSistema)
      .where(
        and(eq(s.usuarioSistema.sub, sub), eq(s.usuarioSistema.ativo, true)),
      );

    if (!linha) return null;
    return { ...linha, escopo: await this.escoposDe(linha.usuarioId) };
  }

  private async escoposDe(
    usuarioId: string,
    usuario?: AuthUser,
  ): Promise<EscopoAcesso> {
    if (usuario?.roles.includes('admin')) {
      return { global: true, ppgIds: [], redeIds: [] };
    }

    const linhas = await this.db
      .select({
        tipo: s.escopoAcesso.tipo,
        ppgId: s.escopoAcesso.ppgId,
        redeId: s.escopoAcesso.redeId,
      })
      .from(s.escopoAcesso)
      .where(
        and(
          eq(s.escopoAcesso.usuarioId, usuarioId),
          eq(s.escopoAcesso.ativo, true),
        ),
      );

    return {
      global: linhas.some((l) => l.tipo === 'GLOBAL'),
      ppgIds: linhas
        .filter((l) => l.tipo === 'PPG' && l.ppgId)
        .map((l) => l.ppgId as string),
      redeIds: linhas
        .filter((l) => l.tipo === 'REDE' && l.redeId)
        .map((l) => l.redeId as string),
    };
  }

  private async pessoaDoUsuario(usuarioId: string): Promise<string> {
    const [linha] = await this.db
      .select({ pessoaId: s.usuarioSistema.pessoaId })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.id, usuarioId));
    return linha.pessoaId;
  }

  /**
   * Cria o vinculo no primeiro acesso.
   *
   * A corrida existe de verdade: duas abas abertas ao mesmo tempo disparam duas
   * chamadas. `onConflictDoNothing` no `sub` mais releitura resolve sem
   * transacao explicita — quem perder a corrida le a linha do vencedor.
   */
  private async vincular(usuario: AuthUser): Promise<string> {
    const pessoaId = await this.acharOuCriarPessoa(usuario);
    const origem = usuario.email ? 'EMAIL' : 'CRIACAO_AUTOMATICA';

    const [criado] = await this.db
      .insert(s.usuarioSistema)
      .values({
        sub: usuario.id,
        pessoaId,
        username: usuario.username ?? null,
        email: usuario.email ?? null,
        origem,
        ultimoAcessoEm: sql`now()`,
      })
      .onConflictDoNothing({ target: s.usuarioSistema.sub })
      .returning({ id: s.usuarioSistema.id });

    if (criado) {
      this.logger.log(
        `Conta ${usuario.username ?? usuario.id} vinculada a pessoa ${pessoaId} (${origem}).`,
      );
      return criado.id;
    }

    const [existente] = await this.db
      .select({ id: s.usuarioSistema.id })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, usuario.id));
    return existente.id;
  }

  /**
   * Acha a pessoa pelo e-mail do token; cria uma se nao houver.
   *
   * O e-mail e unico em `pessoa`, entao a correspondencia nao e ambigua. Sem
   * e-mail no token nao ha como casar: cria-se pessoa nova, e o administrador
   * corrige depois — associar a mao e mais barato que descobrir por que alguem
   * nao consegue entrar.
   *
   * A pessoa criada nasce com `tipo = 'SERVIDOR'` e sem PPG. **Isso nao
   * concede acesso a nada:** escopo mora em `escopo_acesso`, e nasce vazio.
   */
  private async acharOuCriarPessoa(usuario: AuthUser): Promise<string> {
    if (usuario.email) {
      const [encontrada] = await this.db
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(eq(s.pessoa.email, usuario.email));
      if (encontrada) return encontrada.id;
    }

    const [criada] = await this.db
      .insert(s.pessoa)
      .values({
        nome: usuario.name ?? usuario.username ?? usuario.id,
        email: usuario.email ?? null,
        tipo: 'SERVIDOR',
      })
      .returning({ id: s.pessoa.id });
    return criada.id;
  }
}
