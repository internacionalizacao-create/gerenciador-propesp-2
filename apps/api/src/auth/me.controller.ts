import { Controller, Get } from '@nestjs/common';

import type { AcessoResolvido } from './autorizacao-v1/acesso-v1.service';
import { ConcessoesService } from './autorizacao-v1/concessoes.service';
import type { AuthUser } from './auth-user';
import { AcessoAtual, CurrentUser, RequirePermission } from './auth.decorators';
import { IdentidadeService } from './identidade.service';

@Controller('me')
export class MeController {
  constructor(
    private readonly identidade: IdentidadeService,
    private readonly concessoes: ConcessoesService,
  ) {}

  /**
   * Identidade do usuario logado, com as acoes que as concessoes dele liberam.
   *
   * O BFF chama este endpoint para montar o menu e esconder acoes — mas quem
   * decide de fato e sempre o guard no endpoint da acao, nao a UI. `permissions`
   * ja vem do `JwtAuthGuard`, resolvida de `concessao_acesso`: o papel do
   * Keycloak aparece aqui so para o suporte reconhecer a conta no console.
   */
  @Get()
  async me(@CurrentUser() user: AuthUser) {
    // O vinculo com o cadastro local acontece aqui, e nao no guard: `/me` e o
    // primeiro endpoint que o BFF chama depois do login, e o guard roda em toda
    // requisicao — pagar uma escrita no banco a cada chamada para resolver algo
    // que muda uma vez na vida da conta seria desperdicio puro.
    const identidade = await this.identidade.resolver(user);

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      roles: user.roles,
      permissions: user.permissions,
      // Nulo quando o vinculo nao pode ser feito — e-mail apontando para uma
      // pessoa ja ligada a outra conta, por exemplo. A sessao continua valida,
      // mas sem vinculo nao ha concessao possivel: a pessoa entra e ve a tela
      // de acesso pendente ate um administrador reassociar.
      pessoaId: identidade?.pessoaId ?? null,
      escopo: identidade?.escopo ?? (await this.identidade.escopoDe(user)),
      vinculoPendente: identidade === null,
    };
  }

  /**
   * O que esta conta pode fazer, e **onde** (V1-019).
   *
   * `/me` devolve a lista de acoes, que basta para montar o menu; esta rota
   * devolve o alcance de cada uma, ja nomeado, e por isso custa mais consultas.
   * Sao duas perguntas com frequencias diferentes: o menu e montado em toda
   * navegacao, o alcance so quando alguem abre a propria conta para entender
   * por que nao enxerga alguma coisa.
   *
   * Sem `@RequirePermission`: ler o proprio acesso nao e administrar acesso.
   */
  @Get('acesso')
  meuAcesso(@AcessoAtual() acesso: AcessoResolvido) {
    return this.concessoes.meuAcesso(acesso);
  }

  /**
   * Sonda de autorizacao usada pelo `pnpm smoke:login`.
   *
   * Existe para conferir na pratica, sem browser, que `coord.teste` recebe 200 e
   * `docente.teste` recebe 403 na mesma rota. Poderia ser feito contra um
   * endpoint de dominio, mas ai o smoke passaria a depender de haver seed
   * carregada — e ele precisa rodar num ambiente recem-subido.
   */
  @Get('exemplo-restrito')
  @RequirePermission('plano:create')
  exemploRestrito(@CurrentUser('username') username: string | undefined) {
    return {
      mensagem: `${username ?? 'usuario'} pode lançar plano de aplicação.`,
    };
  }
}
