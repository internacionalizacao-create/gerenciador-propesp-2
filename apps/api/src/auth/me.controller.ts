import { Controller, Get } from '@nestjs/common';

import type { AuthUser } from './auth-user';
import { CurrentUser, RequirePermission } from './auth.decorators';
import { IdentidadeService } from './identidade.service';

@Controller('me')
export class MeController {
  constructor(private readonly identidade: IdentidadeService) {}

  /**
   * Identidade do usuario logado, ja resolvida em permissoes.
   *
   * O BFF chama este endpoint para montar o menu e esconder acoes — mas quem
   * decide de fato e sempre o guard no endpoint da acao, nao a UI.
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
      // pessoa ja ligada a outra conta, por exemplo. A sessao continua valida:
      // papeis e permissoes vem do token, e so o que depende de escopo fica de
      // fora ate um administrador reassociar.
      pessoaId: identidade?.pessoaId ?? null,
      escopo: identidade?.escopo ?? (await this.identidade.escopoDe(user)),
      vinculoPendente: identidade === null,
    };
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
  @RequirePermission('plano:write')
  exemploRestrito(@CurrentUser('username') username: string | undefined) {
    return {
      mensagem: `${username ?? 'usuario'} pode lançar plano de aplicação.`,
    };
  }
}
