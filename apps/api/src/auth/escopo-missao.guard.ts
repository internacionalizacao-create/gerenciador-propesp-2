import {
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { Inject } from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.decorators';
import { alcancaTodasAsRedes, podeVerMissao } from './escopo';
import { IdentidadeService } from './identidade.service';

/**
 * Recorte por rede nas rotas de missao (CG-028).
 *
 * **Guard, e nao uma chamada em cada servico.** As trinta e poucas rotas de
 * missao tem todas a mesma forma — `.../comite-gestor/missoes/:id/...` —, e
 * uma verificacao espalhada por servico e uma verificacao que a proxima rota
 * esquece. Aqui, uma rota nova nasce protegida sem ninguem lembrar disso; o
 * custo e uma consulta por requisicao, contra o `missao_rede_missao_idx`.
 *
 * **Responde 404, nunca 403.** "Existe, mas nao e sua" ja entrega que a missao
 * existe — e o mesmo criterio que o PPG fora do escopo aplica desde a
 * introducao do recorte. Vale inclusive para o id adulterado: quem tenta uuid
 * de outra rede recebe a mesma resposta de quem digitou um uuid inexistente.
 *
 * **Nao substitui o filtro da listagem.** Listagem se recorta na consulta, e
 * nao aqui: filtrar depois traria a tabela inteira para a aplicacao e vazaria a
 * contagem real em qualquer soma feita antes do filtro. Este guard cobre o
 * acesso a **uma** missao apontada pela URL, que e o outro caminho.
 */
@Injectable()
export class EscopoMissaoGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly identidade: IdentidadeService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const usuario = request.user;
    if (!usuario) return true;

    const missaoId = this.missaoDaRota(request);
    if (!missaoId) return true;

    // Quem alcanca todas as redes nao paga nem a consulta.
    if (alcancaTodasAsRedes(usuario)) return true;

    const redes = await this.db
      .select({ redeId: s.missaoRede.redeId })
      .from(s.missaoRede)
      .where(eq(s.missaoRede.missaoId, missaoId));

    const escopo = await this.identidade.escopoDe(usuario);
    if (
      podeVerMissao(
        escopo,
        redes.map((linha) => linha.redeId),
      )
    )
      return true;

    throw new NotFoundException('Missao nao encontrada neste ciclo');
  }

  /**
   * O `:id` de uma rota de missao, quando ha um.
   *
   * A checagem e sobre o **caminho** e nao sobre o nome do parametro: `:id` e
   * usado por equipes, produtos e outras rotas do mesmo controller, e tratar
   * todo `:id` como missao faria o guard consultar `missao_rede` com um uuid
   * de equipe e negar acesso a quem tem direito.
   *
   * `route.path` e o padrao registrado (`.../missoes/:id/...`), nunca a URL
   * digitada — nao ha como forjar o caminho para escapar do guard.
   */
  private missaoDaRota(request: AuthenticatedRequest): string | null {
    const padrao: string | undefined = (
      request as unknown as { route?: { path?: string } }
    ).route?.path;
    if (!padrao?.includes('comite-gestor/missoes/:id')) return null;

    const id = (request.params as Record<string, string> | undefined)?.id;
    return typeof id === 'string' && UUID.test(id) ? id : null;
  }
}

/**
 * Id que nao e uuid nao chega ao banco.
 *
 * Deixa-lo passar transformaria uma URL malformada em erro de sintaxe do
 * Postgres — 500 em vez do 404 que o caso merece —, e o servico adiante ja
 * recusa pelo mesmo motivo (CG-061).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
