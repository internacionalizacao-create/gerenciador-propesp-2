import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { AcessoV1Service } from './autorizacao-v1/acesso-v1.service';
import type { AuthUser } from './auth-user';
import { RecorteDeMissoes } from './escopo';

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

/**
 * Por que uma conta pode ficar sem vinculo local.
 *
 * `CONFLITO_PESSOA` e o caso real que derrubou o `/me` em 2026-09-05: o realm
 * foi recriado, os `sub` mudaram, e o e-mail passou a apontar para uma pessoa
 * ja ligada a conta antiga. Resolver isso sozinho — repontando a pessoa para o
 * `sub` novo — seria porta de sequestro de identidade: quem criasse uma conta
 * com um e-mail conhecido herdaria a pessoa e os escopos dela. Quem desempata
 * e um administrador, por `POST /acesso/usuarios/:id/pessoa`.
 */
export type MotivoSemVinculo = 'CONFLITO_PESSOA';

/** Escopo de quem ainda nao tem vinculo: nao ve nada recortado. */
export const ESCOPO_VAZIO: EscopoAcesso = {
  global: false,
  ppgIds: [],
  redeIds: [],
};

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
    const existente = await this.buscarPorSub(usuario.id);
    if (existente) {
      await this.db
        .update(s.usuarioSistema)
        .set({ ultimoAcessoEm: sql`now()` })
        .where(eq(s.usuarioSistema.id, existente.usuarioId));
      return existente;
    }

    const usuarioId = await this.vincular(usuario);
    if (!usuarioId) return null;

    return {
      usuarioId,
      pessoaId: await this.pessoaDoUsuario(usuarioId),
      escopo: await this.escopoPorSub(usuario.id),
    };
  }

  /**
   * Escopo do usuario, **derivado das concessoes** (V1-012).
   *
   * Nao ha mais atalho por papel: o `admin` do Keycloak deixou de receber escopo
   * global de graca, e quem enxerga tudo e quem tem concessao `GLOBAL`. Enquanto
   * existia, esse atalho fazia a autorizacao depender de um papel que este
   * codigo jurava nao consultar.
   *
   * **E uma ponte, e uma ponte grossa**: uniao dos alvos de *todas* as acoes
   * concedidas, sem dizer de qual acao veio cada PPG. Serve as consultas que
   * ainda nao receberam o recorte por acao (V1-015 e V1-016); quem ja o tiver
   * deve usar `AcessoResolvido.alcance(permissao)`, que distingue ler de
   * escrever. O ciclo da concessao de PPG se perde aqui, pelo mesmo motivo.
   */
  async escopoDe(usuario: AuthUser): Promise<EscopoAcesso> {
    return this.escopoPorSub(usuario.id);
  }

  /**
   * Recorte de missoes, a partir do alcance de `missao:read`.
   *
   * A permissao `missao:all-redes` sumiu com o modelo antigo, e nao faz falta:
   * "ve todas as redes" virou o que sempre deveria ter sido — uma concessao de
   * `missao:read` em `GLOBAL`. Concessao por **ciclo** vale para as redes
   * daquele ciclo, que e o que "ciclo" significa no modulo de missoes.
   *
   * O recorte continua sendo o de **leitura**, inclusive nas escritas que o
   * consultam; separar por acao e V1-014. Isso nao afrouxa o que o guard ja
   * negou: sem `missao:create`, a requisicao nem chega ao servico.
   */
  async recorteDeMissoes(usuario: AuthUser): Promise<RecorteDeMissoes> {
    const acesso = await this.acesso.resolver(usuario.id);
    const alcance = acesso.alcance('missao:read');

    if (alcance.global) return RecorteDeMissoes.irrestrito();

    const redeIds = new Set(alcance.redes);
    for (const rede of await this.redesDosCiclos(alcance.ciclos)) {
      redeIds.add(rede);
    }

    return new RecorteDeMissoes(
      { global: false, ppgIds: [], redeIds: [...redeIds] },
      false,
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
    return { ...linha, escopo: await this.escopoPorSub(sub) };
  }

  /** Deriva o escopo-ponte do acesso ja resolvido. Ver `escopoDe`. */
  private async escopoPorSub(sub: string): Promise<EscopoAcesso> {
    const acesso = await this.acesso.resolver(sub);
    if (!acesso.ativo) return ESCOPO_VAZIO;

    const global = acesso.permissoes.some((p) => acesso.alcance(p).global);
    const ppgIds = new Set<string>();
    const redeIds = new Set<string>();

    for (const permissao of acesso.permissoes) {
      const alcance = acesso.alcance(permissao);
      for (const alvo of alcance.ppgs) ppgIds.add(alvo.ppgId);
      for (const rede of alcance.redes) redeIds.add(rede);
    }

    return {
      global,
      ppgIds: [...ppgIds],
      redeIds: global ? [] : [...redeIds],
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
  private async vincular(usuario: AuthUser): Promise<string | null> {
    const pessoaId = await this.acharOuCriarPessoa(usuario);
    if (!pessoaId) return null;

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
              `vinculada ao sub ${jaVinculada.sub}. O vínculo ficou pendente: ` +
              'um administrador precisa reassociar por POST /acesso/usuarios/:id/pessoa.',
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
