import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';

import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { CicloService } from './ciclo.service';
import { ContextoService } from './contexto.service';
import { OrcamentoService } from './orcamento.service';
import { PainelService } from './painel.service';
import {
  atualizarPendenciaSchema,
  criarPendenciaSchema,
  PendenciasService,
  type AtualizarPendencia,
  type CriarPendencia,
} from './pendencias.service';
import {
  criarItemSchema,
  atualizarItemSchema,
  PlanoService,
  type AtualizarItem,
  type CriarItem,
  type Rubrica,
} from './plano.service';

/**
 * Rotas de programa e ciclo.
 *
 * O endereco carrega slug e nome de ciclo (`/programas/capes-global/2027-2030`)
 * em vez de UUID: a equipe consegue ler a URL e saber de que ciclo se trata, o
 * que importa quando um numero e conferido contra um relatorio impresso.
 *
 * Toda rota exige permissao explicita. O `JwtAuthGuard` global ja fecha o
 * acesso; `@RequirePermission` diz **o que** o usuario precisa poder fazer.
 */
@Controller('programas')
export class ProgramasController {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly contexto: ContextoService,
    private readonly ciclos: CicloService,
    private readonly painel: PainelService,
    private readonly orcamento: OrcamentoService,
    private readonly plano: PlanoService,
    private readonly pendencias: PendenciasService,
  ) {}

  /** P05 · lista somente os programas ativos para operacao. */
  @Get()
  @RequirePermission('programa:read')
  async listar() {
    return consultar<{
      id: string;
      nome: string;
      sigla: string | null;
      slug: string;
      orgaoFinanciador: string | null;
      usaRedes: boolean;
      usaAreasTematicas: boolean;
      ativo: boolean;
      ciclos: number;
      linhasPlano: number;
      ppgs: number;
      // Nulo (nao zero) quando o programa ainda nao tem orcamento cadastrado.
      aporteAnual: string | null;
      /** Ciclo mais recente — e para onde o cartao do programa aponta. */
      cicloAtual: string | null;
    }>(
      this.db,
      sql`
      select p.id, p.nome, p.sigla, p.slug,
             p.orgao_financiador as "orgaoFinanciador",
             p.usa_redes         as "usaRedes",
             p.usa_areas_tematicas as "usaAreasTematicas",
             p.ativo,
             (select count(*)::int from ciclo c where c.programa_id = p.id) as "ciclos",
             (select c.nome from ciclo c where c.programa_id = p.id
               order by c.ano_inicio desc limit 1) as "cicloAtual",
             (select count(*)::int from item_planejado ip
                join ciclo c on c.id = ip.ciclo_id
               where c.programa_id = p.id and ip.status <> 'CANCELADO') as "linhasPlano",
             (select count(distinct pp.ppg_id)::int
                from participacao_ppg pp
                join area_tematica at on at.id = pp.area_tematica_id
                join rede_coordenadora rc on rc.id = at.rede_id
                join ciclo c on c.id = rc.ciclo_id
               where c.programa_id = p.id) as "ppgs",
             (select sum(o.valor_bolsas
                       + coalesce(o.valor_manutencao, 0)
                       + coalesce(o.valor_missoes, 0))
                from orcamento_tematica o
                join area_tematica at on at.id = o.area_tematica_id
                join rede_coordenadora rc on rc.id = at.rede_id
                join ciclo c on c.id = rc.ciclo_id
               where c.programa_id = p.id
                 and o.ano = (select min(ano) from orcamento_tematica o2
                                join area_tematica at2 on at2.id = o2.area_tematica_id
                                join rede_coordenadora rc2 on rc2.id = at2.rede_id
                                join ciclo c2 on c2.id = rc2.ciclo_id
                               where c2.programa_id = p.id)) as "aporteAnual"
        from programa p
       where p.ativo = true
       order by p.nome
    `,
    );
  }

  /** Painel do ciclo aberto por quem entra sem escolher programa. */
  @Get('padrao/painel')
  @RequirePermission('painel:read')
  async painelPadrao() {
    const ciclo = await this.contexto.padrao();
    if (!ciclo) {
      // Estado vazio de P01: sem ciclo cadastrado nao ha o que exibir, e a tela
      // oferece "criar ciclo" / "importar planilha" em vez de zeros.
      return null;
    }
    return this.painel.montar(ciclo);
  }

  @Get(':programa')
  @RequirePermission('programa:read')
  async detalhar(@Param('programa') slug: string) {
    const [programa] = await this.db
      .select()
      .from(s.programa)
      .where(and(eq(s.programa.slug, slug), eq(s.programa.ativo, true)))
      .limit(1);

    if (!programa) throw new NotFoundException('Programa nao encontrado.');

    const ciclos = await this.db
      .select({
        id: s.ciclo.id,
        nome: s.ciclo.nome,
        anoInicio: s.ciclo.anoInicio,
        anoFim: s.ciclo.anoFim,
        status: s.ciclo.status,
      })
      .from(s.ciclo)
      .where(eq(s.ciclo.programaId, programa.id))
      .orderBy(asc(s.ciclo.anoInicio));

    return { ...programa, ciclos };
  }

  // --------------------------- dentro do ciclo --------------------------- //

  /** P06 · pagina-indice do ciclo. */
  @Get(':programa/:ciclo')
  @RequirePermission('programa:read')
  async resumoDoCiclo(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    return this.ciclos.resumo(await this.contexto.resolver(slug, nome));
  }

  /** P01 · painel executivo do ciclo. */
  @Get(':programa/:ciclo/painel')
  @RequirePermission('painel:read')
  async painelDoCiclo(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    return this.painel.montar(await this.contexto.resolver(slug, nome));
  }

  /** P07 · redes e areas tematicas. */
  @Get(':programa/:ciclo/redes')
  @RequirePermission('orcamento:read')
  async redes(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query('ano') ano?: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.ciclos.redes(ciclo, anoValido(ano, ciclo.anos));
  }

  /** P08 · detalhe de uma area tematica. */
  @Get(':programa/:ciclo/tematicas/:codigo')
  @RequirePermission('orcamento:read')
  async tematica(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('codigo') codigo: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.ciclos.tematica(ciclo, codigo);
  }

  /** P09 · matriz de orcamento ano x tematica. */
  @Get(':programa/:ciclo/orcamento')
  @RequirePermission('orcamento:read')
  async orcamentoDoCiclo(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    const [tematicas, redes] = await Promise.all([
      this.orcamento.porTematica(ciclo.cicloId),
      this.orcamento.porRede(ciclo.cicloId),
    ]);

    return { ciclo, tematicas, redes };
  }

  /** P10 · plano de aplicacao nas tres rubricas. */
  @Get(':programa/:ciclo/plano')
  @RequirePermission('plano:read')
  async planoDoCiclo(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query('rubrica') rubrica?: string,
    @Query('ppgId') ppgId?: string,
    @Query('ano') ano?: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    const linhas = await this.plano.listar(ciclo.cicloId, {
      rubrica: rubricaValida(rubrica),
      ppgId,
      ano: anoValido(ano, ciclo.anos),
    });

    return { ciclo, linhas };
  }

  @Post(':programa/:ciclo/plano')
  @RequirePermission('plano:write')
  async criarLinhaDePlano(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Body(new ZodValidationPipe(criarItemSchema)) dto: CriarItem,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.plano.criar(ciclo, dto);
  }

  @Patch(':programa/:ciclo/plano/:id')
  @RequirePermission('plano:edit')
  async atualizarLinhaDePlano(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarItemSchema)) dto: AtualizarItem,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.plano.atualizar(ciclo, id, dto, usuario);
  }

  @Get(':programa/:ciclo/plano/:id/historico')
  @RequirePermission('plano:read')
  async historicoDaLinha(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.plano.historico(ciclo.cicloId, id);
  }

  @Post(':programa/:ciclo/plano/:id/cancelar')
  @RequirePermission('plano:write')
  async cancelarLinhaDePlano(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Body() body: { justificativa?: string },
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    await this.plano.cancelar(ciclo.cicloId, id, body.justificativa ?? '');
    return { ok: true };
  }

  /** P17 · Comite Gestor (orcamento paralelo, RN-14). */
  @Get(':programa/:ciclo/comite-gestor')
  @RequirePermission('orcamento:read')
  async comiteGestor(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    return this.ciclos.comiteGestor(await this.contexto.resolver(slug, nome));
  }

  /** P16 · premissas e fontes documentais. */
  @Get(':programa/:ciclo/premissas')
  @RequirePermission('premissa:read')
  async premissas(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    return this.ciclos.premissas(await this.contexto.resolver(slug, nome));
  }

  /** P13 · pendencias do ciclo. */
  @Get(':programa/:ciclo/pendencias')
  @RequirePermission('pendencia:read')
  async listarPendencias(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return { ciclo, pendencias: await this.pendencias.listar(ciclo.cicloId) };
  }

  @Post(':programa/:ciclo/pendencias')
  @RequirePermission('pendencia:write')
  async criarPendencia(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Body(new ZodValidationPipe(criarPendenciaSchema)) dto: CriarPendencia,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.pendencias.criar(ciclo.cicloId, dto);
  }
}

/**
 * Pendencia so precisa do ciclo para nascer; depois disso o id basta.
 * Fica em controller proprio para que a rota de edicao nao carregue o caminho
 * inteiro do programa.
 */
@Controller('pendencias')
export class PendenciasController {
  constructor(private readonly pendencias: PendenciasService) {}

  @Patch(':id')
  @RequirePermission('pendencia:write')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarPendenciaSchema))
    dto: AtualizarPendencia,
  ) {
    return this.pendencias.atualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('pendencia:write')
  async remover(@Param('id') id: string) {
    await this.pendencias.remover(id);
    return { ok: true };
  }
}

function anoValido(ano: string | undefined, anos: number[]): number {
  const numero = Number(ano);
  return anos.includes(numero) ? numero : anos[0];
}

function rubricaValida(rubrica: string | undefined): Rubrica | undefined {
  return rubrica === 'BOLSAS' ||
    rubrica === 'MANUTENCAO' ||
    rubrica === 'MISSOES'
    ? rubrica
    : undefined;
}
