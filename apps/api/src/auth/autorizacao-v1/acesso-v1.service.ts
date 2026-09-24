import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../../database/database.module';
import * as s from '../../database/schema';
import {
  agruparAlcances,
  SEM_ALCANCE,
  type Alcance,
  type LinhaDeConcessao,
} from './alcance';
import { CATALOGO_PERMISSOES_V1, type PermissaoV1 } from './catalogo';

/**
 * Resolucao central de acesso por acao (V1-012).
 *
 * Responde, para a requisicao em curso, **o que esta conta pode fazer e onde**,
 * lendo `concessao_acesso`. Nao consulta papel do token para nada: papel virou
 * assunto de autenticacao, e o Keycloak so responde quem e a pessoa.
 *
 * ## Uma consulta por requisicao, sem cache
 *
 * Cache aqui seria cache de autorizacao, e o preco dele e revogacao que demora
 * a valer. A tarefa exige o contrario: **revogar vale na requisicao seguinte**,
 * sem esperar o JWT expirar. Uma consulta indexada por `usuario_id` e barata
 * perto de responder com acesso que ja foi retirado.
 *
 * ## Conta inativa nao resolve nada
 *
 * A checagem e `usuario_sistema.ativo`, no mesmo `where` das concessoes — e nao
 * uma segunda consulta —, porque desativar a conta precisa fechar tudo de uma
 * vez, inclusive para quem tem `acesso:*`. Conta sem vinculo local tambem cai
 * aqui: sem linha em `usuario_sistema`, nao ha concessao possivel.
 *
 * **Conta sem pessoa tambem nao resolve nada.** E a conta pendente, que entrou
 * com o e-mail de uma pessoa ja ligada a outra conta: existe para aparecer na
 * tela de Acessos, nao para exercer acao. A API recusa conceder a ela, e este
 * filtro garante o mesmo mesmo que alguma linha tenha sido gravada por fora.
 */

/** Acesso ja resolvido de uma conta. Imutavel dentro da requisicao. */
export class AcessoResolvido {
  constructor(
    /** Nulo quando o `sub` nao tem conta local ativa. */
    readonly usuarioId: string | null,
    readonly pessoaId: string | null,
    private readonly alcances: ReadonlyMap<PermissaoV1, Alcance>,
  ) {}

  /** Conta ativa e vinculada; `false` derruba qualquer autorizacao. */
  get ativo(): boolean {
    return this.usuarioId !== null;
  }

  /** Acoes com pelo menos uma concessao ativa. Serve ao guard e ao `/me`. */
  get permissoes(): PermissaoV1[] {
    return [...this.alcances.keys()].sort();
  }

  /** `true` se a acao foi concedida em algum alvo. Nao diz **onde**. */
  permite(permissao: PermissaoV1): boolean {
    return this.alcances.has(permissao);
  }

  /**
   * Onde a acao vale. Sem concessao, devolve `SEM_ALCANCE` — nunca `undefined`.
   *
   * O nulo obrigaria cada chamador a decidir o que fazer com ele, e o chamador
   * distraido decidiria "sem restricao". `SEM_ALCANCE` nega por construcao.
   */
  alcance(permissao: PermissaoV1): Alcance {
    return this.alcances.get(permissao) ?? SEM_ALCANCE;
  }
}

/** Conta sem vinculo, inativa ou sem concessao alguma. */
export const ACESSO_VAZIO = new AcessoResolvido(null, null, new Map());

@Injectable()
export class AcessoV1Service {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /** Resolve o acesso de um `sub` do Keycloak. Nunca lanca por falta de conta. */
  async resolver(sub: string): Promise<AcessoResolvido> {
    const linhas = await this.db
      .select({
        usuarioId: s.usuarioSistema.id,
        pessoaId: s.usuarioSistema.pessoaId,
        permissao: s.concessaoAcesso.permissao,
        tipoAlvo: s.concessaoAcesso.tipoAlvo,
        cicloId: s.concessaoAcesso.cicloId,
        ppgId: s.concessaoAcesso.ppgId,
        redeId: s.concessaoAcesso.redeId,
        areaTematicaId: s.concessaoAcesso.areaTematicaId,
        participacaoId: s.concessaoAcesso.participacaoId,
      })
      .from(s.usuarioSistema)
      // `left join`: a conta existe mesmo sem concessao nenhuma, e precisamos
      // distinguir "conta ativa sem acesso" de "conta que nao existe" — a
      // primeira e a conta recem-criada, a segunda nao deve nem chegar aqui.
      .leftJoin(
        s.concessaoAcesso,
        and(
          eq(s.concessaoAcesso.usuarioId, s.usuarioSistema.id),
          eq(s.concessaoAcesso.ativo, true),
        ),
      )
      .where(
        and(eq(s.usuarioSistema.sub, sub), eq(s.usuarioSistema.ativo, true)),
      );

    if (linhas.length === 0 || linhas[0].pessoaId === null) {
      return ACESSO_VAZIO;
    }

    const concessoes = linhas.filter(
      (l): l is typeof l & LinhaDeConcessao => l.permissao !== null,
    );

    return new AcessoResolvido(
      linhas[0].usuarioId,
      linhas[0].pessoaId,
      agruparAlcances(concessoes, ehPermissaoDoCatalogo),
    );
  }
}

/**
 * O banco guarda texto; o catalogo e codigo. Esta e a fronteira entre os dois.
 *
 * Nome desconhecido nao vira acesso: uma permissao retirada do catalogo perde
 * efeito no ato, sem precisar de migration para apagar as linhas — que
 * continuam la, visiveis para quem for revisar.
 */
function ehPermissaoDoCatalogo(valor: string): valor is PermissaoV1 {
  // `Object.hasOwn`, e nao `in`: com `in`, um nome como `toString` cairia no
  // prototipo e viraria permissao valida.
  return Object.hasOwn(CATALOGO_PERMISSOES_V1, valor);
}
