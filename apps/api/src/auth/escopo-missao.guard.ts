import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';

import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import {
  REQUIRED_PERMISSIONS_KEY,
  type AuthenticatedRequest,
} from './auth.decorators';
import type { PermissaoV1 } from './autorizacao-v1/catalogo';
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
 * **Fora da leitura, 404.** "Existe, mas nao e sua" ja entrega que a missao
 * existe. Vale inclusive para o id adulterado: quem tenta uuid de outra rede
 * recebe a mesma resposta de quem digitou um uuid inexistente.
 *
 * **Dentro da leitura, a acao da rota tambem precisa alcancar a missao** — e
 * ai a recusa e 403, porque o que se recusa e a acao, nao a existencia, que a
 * conta ja conhece. Ate a V1-022 so a leitura era conferida: quem lia todas as
 * redes e editava uma editava, decidia e prestava contas em todas.
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
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const usuario = request.user;
    if (!usuario) return true;

    const missaoId = this.missaoDaRota(request);
    if (!missaoId) return true;

    const redes = await this.db
      .select({ redeId: s.missaoRede.redeId })
      .from(s.missaoRede)
      .where(eq(s.missaoRede.missaoId, missaoId));

    const alcanca = async (permissoes: PermissaoV1[]) => {
      // GLOBAL nao recorta nada, nem mesmo a missao sem rede cadastrada.
      const recorte = request.acesso
        ? await this.identidade.recorteDoAcesso(request.acesso, permissoes)
        : await this.identidade.recorteDeMissoes(usuario, ...permissoes);
      return (
        recorte.semRecorte ||
        redes.some((linha) => recorte.alcanca(linha.redeId))
      );
    };

    if (!(await alcanca(['missao:read']))) {
      throw new NotFoundException('Missão não encontrada neste ciclo');
    }

    const exigidas =
      this.reflector.getAllAndOverride<PermissaoV1[] | undefined>(
        REQUIRED_PERMISSIONS_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    for (const permissao of exigidas) {
      if (!(await alcanca([permissao]))) {
        throw new ForbiddenException(
          `Sua conta não tem esta ação nas redes desta missão. Permissão necessária: ${permissao}`,
        );
      }
    }
    return true;
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
