import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import {
  AcessoV1Service,
  type AcessoResolvido,
} from './autorizacao-v1/acesso-v1.service';
import type { PermissaoV1 } from './autorizacao-v1/catalogo';
import type { AuthUser } from './auth-user';
import { RecorteDeMissoes } from './escopo';

/**
 * Liga a identidade do Keycloak ao cadastro local.
 *
 * Responde *quem e* a conta — a pessoa local. *O que ela pode, e onde* e
 * pergunta de `AcessoResolvido.alcance(permissao)`, por acao: este servico nao
 * devolve mais um escopo agregado da conta, porque duas acoes da mesma conta
 * podem alcancar alvos diferentes e uma resposta unica nao representa nenhuma.
 *
 * **O vinculo acontece no primeiro acesso, por e-mail.** O administrador cria a
 * conta no Keycloak com o mesmo e-mail da pessoa ja cadastrada e o vinculo se
 * faz sozinho — que e o caso das pessoas ja registradas em missoes. Sem
 * correspondencia, cria-se uma pessoa nova, porque recusar o login deixaria o
 * usuario preso sem nenhuma tela para pedir ajuda.
 */

export interface Identidade {
  readonly usuarioId: string;
  readonly pessoaId: string;
}

/**
 * Por que uma conta pode ficar sem vinculo local.
 *
 * `CONFLITO_PESSOA` e o caso real que derrubou o `/me` em 2026-09-05: o realm
 * foi recriado, os `sub` mudaram, e o e-mail passou a apontar para uma pessoa
 * ja ligada a conta antiga. Resolver isso sozinho — repontando a pessoa para o
 * `sub` novo — seria porta de sequestro de identidade: quem criasse uma conta
 * com um e-mail conhecido herdaria a pessoa e os escopos dela. A conta fica
 * gravada como pendente, sem pessoa, e quem desempata e um administrador, por
 * `POST /acesso/usuarios/:id/pessoa` — transferindo a pessoa, se for o caso.
 */
export type MotivoSemVinculo = 'CONFLITO_PESSOA';

@Injectable()
export class IdentidadeService {
  private readonly logger = new Logger(IdentidadeService.name);
  /**
   * Resolvido aqui dentro, e nao injetado, para preservar a assinatura do
   * construtor: mais de vinte testes de integracao montam este servico a mao, e
   * a fonte do escopo mudou — a lista de dependencias, nao.
   */
  private readonly acesso: AcessoV1Service;

  constructor(@Inject(DRIZZLE) private readonly db: Database) {
    this.acesso = new AcessoV1Service(db);
  }

  /** Chamadores internos sem guard resolvem as mesmas concessoes da API. */
  acessoDe(usuario: AuthUser) {
    return this.acesso.resolver(usuario.id);
  }

  /**
   * Devolve a identidade local, criando o vinculo no primeiro acesso.
   *
   * E idempotente: chamada de novo, so atualiza `ultimo_acesso_em`.
   *
   * **Devolve `null` em vez de falhar quando o vinculo nao e possivel.** O
   * `/me` e a primeira chamada de toda sessao: um erro aqui derruba a
   * aplicacao inteira para aquele usuario, e ele nem chega a uma tela onde
   * peca ajuda. Sem vinculo a conta simplesmente nao tem concessao nenhuma, e
   * o `/me` diz isso em vez de derrubar a aplicacao.
   */
  async resolver(usuario: AuthUser): Promise<Identidade | null> {
    const conta = await this.contaPorSub(usuario.id);
    if (conta) {
      await this.db
        .update(s.usuarioSistema)
        .set({ ultimoAcessoEm: sql`now()` })
        .where(eq(s.usuarioSistema.id, conta.usuarioId));
      // Conta pendente continua pendente: quem a tira desse estado e um
      // administrador, nunca um login seguinte. Religar sozinho no dia em que a
      // pessoa ficasse livre seria o mesmo repontamento automatico que o
      // conflito existe para impedir.
      return conta.pessoaId ? { ...conta, pessoaId: conta.pessoaId } : null;
    }

    return this.vincular(usuario);
  }

  /**
   * Recorte de missoes, a partir do alcance **de cada acao pedida**.
   *
   * "Ve todas as redes" e uma concessao em `GLOBAL`; concessao por **ciclo**
   * vale para as redes daquele ciclo, que e o que "ciclo" significa no modulo
   * de missoes.
   *
   * Com mais de uma acao, o recorte e a **intersecao**: a rota que exige ler a
   * missao e ler a prestacao so alcanca a rede onde as duas valem. Ate a V1-022
   * este recorte era sempre o de `missao:read`, inclusive nas escritas — e quem
   * lia todas as redes mas so editava uma editava todas.
   */
  async recorteDeMissoes(
    usuario: AuthUser,
    ...permissoes: PermissaoV1[]
  ): Promise<RecorteDeMissoes> {
    const acesso = await this.acesso.resolver(usuario.id);
    return this.recorteDoAcesso(
      acesso,
      permissoes.length > 0 ? permissoes : ['missao:read'],
    );
  }

  /** Mesmo recorte, a partir do acesso que o guard ja resolveu. */
  async recorteDoAcesso(
    acesso: AcessoResolvido,
    permissoes: readonly PermissaoV1[],
  ): Promise<RecorteDeMissoes> {
    // `null` e "todas as redes": o elemento neutro da intersecao.
    let redes: Set<string> | null = null;

    for (const permissao of permissoes) {
      const alcance = acesso.alcance(permissao);
      if (alcance.global) continue;

      const daAcao = new Set(alcance.redes);
      for (const rede of await this.redesDosCiclos(alcance.ciclos)) {
        daAcao.add(rede);
      }
      redes =
        redes === null
          ? daAcao
          : new Set([...redes].filter((rede) => daAcao.has(rede)));
    }

    if (redes === null) return RecorteDeMissoes.irrestrito();
    return new RecorteDeMissoes(
      { global: false, ppgIds: [], redeIds: [...redes] },
      false,
    );
  }

  /**
   * Recusa com 403 a acao que nao alcanca nenhuma rede desta missao.
   *
   * Para as rotas cuja permissao so se conhece em runtime — a transicao de
   * situacao depende do corpo —, e que por isso o `EscopoMissaoGuard` nao tem
   * como conferir. A leitura ja foi conferida pelo guard (404 fora dela); aqui
   * a missao e conhecida, e o que se recusa e a acao.
   */
  async exigirAcaoNaMissao(
    usuario: AuthUser,
    missaoId: string,
    permissao: PermissaoV1,
  ): Promise<void> {
    // Id malformado nao chega ao banco: o servico adiante responde 404.
    if (!UUID.test(missaoId)) return;
    const recorte = await this.recorteDeMissoes(usuario, permissao);
    if (recorte.semRecorte) return;

    const redes = await this.db
      .select({ redeId: s.missaoRede.redeId })
      .from(s.missaoRede)
      .where(eq(s.missaoRede.missaoId, missaoId));
    if (redes.some((linha) => recorte.alcanca(linha.redeId))) return;

    throw new ForbiddenException(
      `Sua conta não tem esta ação nas redes desta missão. Permissão necessária: ${permissao}`,
    );
  }

  /** Redes de um ciclo: a concessao por ciclo alcanca as redes dele. */
  private async redesDosCiclos(ciclos: readonly string[]): Promise<string[]> {
    if (ciclos.length === 0) return [];

    const linhas = await this.db
      .select({ id: s.redeCoordenadora.id })
      .from(s.redeCoordenadora)
      .where(inArray(s.redeCoordenadora.cicloId, [...ciclos]));

    return linhas.map((linha) => linha.id);
  }

  // -------------------------------------------------------------------------

  /** Conta ativa do `sub`, vinculada ou pendente. */
  private async contaPorSub(
    sub: string,
  ): Promise<{ usuarioId: string; pessoaId: string | null } | null> {
    const [linha] = await this.db
      .select({
        usuarioId: s.usuarioSistema.id,
        pessoaId: s.usuarioSistema.pessoaId,
      })
      .from(s.usuarioSistema)
      .where(
        and(eq(s.usuarioSistema.sub, sub), eq(s.usuarioSistema.ativo, true)),
      );

    return linha ?? null;
  }

  /**
   * Cria a conta local no primeiro acesso — vinculada, ou **pendente**.
   *
   * Pendente quando o e-mail aponta para pessoa ja ligada a outra conta: a
   * linha e gravada sem pessoa, e nao deixada de fora, porque e ela que faz o
   * caso aparecer na tela de Acessos. Sem linha, o administrador nao tinha onde
   * agir, e a conta ficava presa num `vinculoPendente` sem saida.
   *
   * A corrida existe de verdade: duas abas abertas ao mesmo tempo disparam duas
   * chamadas. `onConflictDoNothing` no `sub` mais releitura resolve sem
   * transacao explicita — quem perder a corrida le a linha do vencedor.
   */
  private async vincular(usuario: AuthUser): Promise<Identidade | null> {
    const pessoaId = await this.acharOuCriarPessoa(usuario);
    const origem = !pessoaId
      ? 'PENDENTE'
      : usuario.email
        ? 'EMAIL'
        : 'CRIACAO_AUTOMATICA';

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
      if (pessoaId) {
        this.logger.log(
          `Conta ${usuario.username ?? usuario.id} vinculada a pessoa ${pessoaId} (${origem}).`,
        );
      }
      return pessoaId ? { usuarioId: criado.id, pessoaId } : null;
    }

    const [existente] = await this.db
      .select({
        usuarioId: s.usuarioSistema.id,
        pessoaId: s.usuarioSistema.pessoaId,
      })
      .from(s.usuarioSistema)
      .where(eq(s.usuarioSistema.sub, usuario.id));
    return existente.pessoaId
      ? { usuarioId: existente.usuarioId, pessoaId: existente.pessoaId }
      : null;
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
   * concede acesso a nada:** alcance mora em `concessao_acesso`, e nasce vazio.
   */
  private async acharOuCriarPessoa(usuario: AuthUser): Promise<string | null> {
    if (usuario.email) {
      const [encontrada] = await this.db
        .select({ id: s.pessoa.id })
        .from(s.pessoa)
        .where(eq(s.pessoa.email, usuario.email));

      if (encontrada) {
        // A pessoa pode ja pertencer a outra conta — foi o que aconteceu
        // quando o realm foi recriado e todos os `sub` mudaram. Reusar aqui
        // violaria `usuario_sistema_pessoa_uk` e derrubaria o `/me`; repontar
        // sozinho seria pior, porque bastaria criar uma conta com o e-mail
        // certo para herdar a pessoa e os escopos dela.
        const [jaVinculada] = await this.db
          .select({ sub: s.usuarioSistema.sub })
          .from(s.usuarioSistema)
          .where(eq(s.usuarioSistema.pessoaId, encontrada.id));

        // Vinculada a **esta mesma conta** nao e conflito: e a corrida das duas
        // abas, em que a outra chamada acabou de criar pessoa e vinculo. Tratar
        // isso como conflito mandava o proprio usuario para "vinculo pendente"
        // no primeiro acesso, e so um administrador desfazia.
        if (jaVinculada?.sub === usuario.id) return encontrada.id;

        if (jaVinculada) {
          this.logger.warn(
            `Conta ${usuario.username ?? usuario.id} tem o e-mail de uma pessoa já ` +
              `vinculada ao sub ${jaVinculada.sub}. A conta ficou pendente: ` +
              'um administrador resolve pela tela de Acessos.',
          );
          return null;
        }
        return encontrada.id;
      }
    }

    // `onConflictDoNothing` mais releitura, como em `vincular`: duas abas
    // abertas ao mesmo tempo chegam aqui as duas, nenhuma tendo encontrado a
    // pessoa, e a segunda insercao violaria o e-mail unico. Quem perde a
    // corrida le a linha do vencedor.
    const [criada] = await this.db
      .insert(s.pessoa)
      .values({
        nome: usuario.name ?? usuario.username ?? usuario.id,
        email: usuario.email ?? null,
        tipo: 'SERVIDOR',
      })
      .onConflictDoNothing({ target: s.pessoa.email })
      .returning({ id: s.pessoa.id });

    if (criada) return criada.id;

    const [vencedora] = await this.db
      .select({ id: s.pessoa.id })
      .from(s.pessoa)
      .where(eq(s.pessoa.email, usuario.email as string));
    return vencedora.id;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
