import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Response } from 'express';

import { CurrentUser, RequirePermission } from '../auth/auth.decorators';
import { IdentidadeService } from '../auth/identidade.service';
import type { AuthUser } from '../auth/auth-user';
import type { Permission } from '../auth/permissions';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  atualizarPrestacaoSchema,
  criarDespesaSchema,
  PrestacaoService,
  type AtualizarPrestacao,
  type CriarDespesa,
  devolverPrestacaoSchema,
  validarPrestacaoSchema,
  type DevolverPrestacao,
  type ValidarPrestacao,
} from './prestacao.service';
import { consultar } from '../comum/consultar';
import { DRIZZLE, type Database } from '../database/database.module';
import * as s from '../database/schema';
import { CicloService } from './ciclo.service';
import {
  atualizarMembroEquipeSchema,
  ComiteGestorService,
  criarMembroEquipeSchema,
  type AtualizarMembroEquipe,
  type CriarMembroEquipe,
} from './comite-gestor.service';
import { ExecucaoComiteService } from './execucao-comite.service';
import {
  filtroPainelSchema,
  PainelComiteService,
  type FiltroPainel,
} from './painel-comite.service';
import {
  filtroRelatorioSchema,
  RelatoriosService,
  type FiltroRelatorio,
} from './relatorios.service';
import {
  ExportacaoService,
  FORMATOS,
  RELATORIOS,
  type Formato,
  type NomeDeRelatorio,
} from '../exportacao/exportacao.service';
import {
  dispensarRequisitoSchema,
  EncerramentoService,
  revogarDispensaSchema,
  type DispensarRequisito,
  type RevogarDispensa,
} from './encerramento.service';
import { responderArquivo } from '../comum/resposta-arquivo';
import { ContextoService } from './contexto.service';
import {
  atualizarMissaoComiteSchema,
  criarMissaoComiteSchema,
  filtroMissoesSchema,
  MissoesComiteService,
  reaberturaMissaoSchema,
  relatarMissaoSchema,
  transicaoMissaoSchema,
  type AtualizarMissaoComite,
  type CriarMissaoComite,
  type FiltroMissoes,
  type ReaberturaMissao,
  type RelatarMissao,
  type TransicaoMissao,
} from './missoes-comite.service';
import {
  atualizarProdutoMissaoSchema,
  criarProdutoMissaoSchema,
  responderProdutosSchema,
  ResultadosService,
  type AtualizarProdutoMissao,
  type CriarProdutoMissao,
  type ResponderProdutos,
} from './resultados.service';
import {
  DecisaoService,
  decidirSchema,
  reabrirSchema,
  type Decidir,
  type Reabrir,
} from './decisao.service';
import { SubmissaoService } from './submissao.service';
import {
  atualizarOrcamentoSchema,
  OrcamentoService,
  type AtualizarOrcamento,
} from './orcamento.service';
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
    private readonly gestaoComite: ComiteGestorService,
    private readonly missoesComite: MissoesComiteService,
    private readonly submissao: SubmissaoService,
    private readonly decisao: DecisaoService,
    private readonly prestacao: PrestacaoService,
    private readonly execucao: ExecucaoComiteService,
    private readonly painelComite: PainelComiteService,
    private readonly relatorios: RelatoriosService,
    private readonly exportacao: ExportacaoService,
    private readonly identidade: IdentidadeService,
    private readonly encerramento: EncerramentoService,
    private readonly resultados: ResultadosService,
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
  async painelPadrao(@Query('ano') ano?: string) {
    const ciclo = await this.contexto.padrao();
    if (!ciclo) {
      // Estado vazio de P01: sem ciclo cadastrado nao ha o que exibir, e a tela
      // oferece "criar ciclo" / "importar planilha" em vez de zeros.
      return null;
    }
    // Ano fora do ciclo cai no primeiro exercicio, como no resto das telas do
    // ciclo — e nao num painel de zeros, indistinguivel de ciclo vazio.
    return this.painel.montar(ciclo, anoValido(ano, ciclo.anos));
  }

  @Get(':programa')
  @RequirePermission('programa:read')
  async detalhar(@Param('programa') slug: string) {
    const [programa] = await this.db
      .select()
      .from(s.programa)
      .where(and(eq(s.programa.slug, slug), eq(s.programa.ativo, true)))
      .limit(1);

    if (!programa) throw new NotFoundException('Programa não encontrado.');

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

  /** Registra alteracao formal do orcamento de uma tematica em um exercicio. */
  @Patch(':programa/:ciclo/orcamento/:id')
  @RequirePermission('orcamento:edit')
  async atualizarOrcamento(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarOrcamentoSchema))
    dto: AtualizarOrcamento,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.orcamento.atualizar(
      await this.contexto.resolver(slug, nome),
      id,
      dto,
      usuario,
    );
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
  @RequirePermission('plano:create')
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
  @RequirePermission('plano:cancel')
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

  /** P17 · leitura da area renovada, provisoriamente exclusiva do admin. */
  @Get(':programa/:ciclo/comite-gestor')
  @RequirePermission('equipe-gestao:read')
  async comiteGestor(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    return this.ciclos.comiteGestor(await this.contexto.resolver(slug, nome));
  }

  /**
   * P17 · execucao orcamentaria do Comite Gestor por exercicio (CG-055).
   *
   * Fica separada de `/comite-gestor`, que devolve a origem do dinheiro
   * (aportes por rede). Sao duas perguntas distintas — de onde veio e quanto
   * ja virou execucao oficial — e a segunda so passou a existir com a
   * prestacao validada.
   */
  @Get(':programa/:ciclo/comite-gestor/execucao')
  @RequirePermission('missao:read', 'prestacao:read')
  async execucaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.execucao.porExercicio(ciclo.cicloId);
  }

  /**
   * P17 · painel do Comite Gestor (CG-066).
   *
   * Separado de `/comite-gestor` e de `/execucao` porque responde outra
   * pergunta: aqueles dizem de onde veio o dinheiro e quanto ja virou execucao
   * oficial; este diz em que estado estao as missoes e o que espera por
   * alguem. Os tres compartilham o recorte por exercicio, e por isso a tela
   * consegue mostra-los juntos sob o mesmo `?ano=`.
   *
   * O filtro vem por `@Query` inteiro, e nao parametro a parametro, para que o
   * zod recuse `redeId` que nao seja UUID antes de a string chegar ao SQL.
   */
  @Get(':programa/:ciclo/comite-gestor/painel')
  @RequirePermission('missao:read', 'prestacao:read')
  async painelDoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroPainelSchema)) filtro: FiltroPainel,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.painelComite.montar(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  /**
   * P17 · relatorios estrategicos do Comite (CG-068).
   *
   * Os quatro homologados em 2026-09-07: missoes, parceiros, financas e
   * resultados. Todos aceitam **o mesmo filtro da lista de missoes**, e nao um
   * proprio — e o que faz o total do relatorio reproduzir a consulta de origem,
   * que e o criterio de aceite da task.
   *
   * `missao:read` porque relatorio e leitura das mesmas missoes; nenhuma
   * permissao nova. O recorte por rede vale aqui como em qualquer outra
   * consulta (CG-028).
   */
  @Get(':programa/:ciclo/comite-gestor/relatorios/missoes')
  @RequirePermission('missao:read')
  async relatorioDeMissoes(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroRelatorioSchema))
    filtro: FiltroRelatorio,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.relatorios.missoesDoRecorte(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  @Get(':programa/:ciclo/comite-gestor/relatorios/parceiros')
  @RequirePermission('missao:read', 'parceiro:read')
  async relatorioDeParceiros(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroRelatorioSchema))
    filtro: FiltroRelatorio,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.relatorios.parceirosDoRecorte(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  /**
   * Financas usa `prestacao:read`, e nao `missao:read`: quem nao pode abrir a
   * prestacao de uma missao nao deve ler o consolidado das despesas dela.
   */
  @Get(':programa/:ciclo/comite-gestor/relatorios/financas')
  @RequirePermission('prestacao:read')
  async relatorioDeFinancas(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroRelatorioSchema))
    filtro: FiltroRelatorio,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.relatorios.financasDoRecorte(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  @Get(':programa/:ciclo/comite-gestor/relatorios/resultados')
  @RequirePermission('missao:read', 'produto-missao:read')
  async relatorioDeResultados(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroRelatorioSchema))
    filtro: FiltroRelatorio,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.relatorios.resultadosDoRecorte(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  /**
   * P17 · exportacao de relatorio (CG-069).
   *
   * **Sincrona e sem gravar arquivo**: o conteudo vai direto na resposta. Nao
   * ha o que expirar nem o que varrer, e nao sobra exportacao no servidor para
   * ser servida depois a quem nao podia ve-la.
   *
   * **A exigencia e dinamica**: a leitura do relatorio pedido mais a exportacao
   * do dominio dele (contrato V1). Ler o consolidado e uma decisao; deixa-lo
   * sair do sistema em arquivo e outra, e a PROPESP quis poder conceder a
   * primeira sem a segunda. Como o relatorio so se conhece em runtime, o
   * decorador carrega o minimo comum e o resto e conferido aqui.
   */
  @Get(':programa/:ciclo/comite-gestor/relatorios/:qual/exportacao/:formato')
  @RequirePermission('missao:read')
  async exportarRelatorio(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('qual') qual: string,
    @Param('formato') formato: string,
    @Query(new ZodValidationPipe(filtroRelatorioSchema))
    filtro: FiltroRelatorio,
    @Res() resposta: Response,
  ) {
    if (!RELATORIOS.includes(qual as NomeDeRelatorio)) {
      throw new NotFoundException('Relatório não encontrado.');
    }
    if (!FORMATOS.includes(formato as Formato)) {
      throw new NotFoundException('Formato não suportado.');
    }
    exigirTodas(usuario, permissoesDoRelatorio(qual as NomeDeRelatorio));

    const ciclo = await this.contexto.resolver(slug, nome);
    const arquivo = await this.exportacao.relatorio(
      ciclo.cicloId,
      qual as NomeDeRelatorio,
      formato as Formato,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
    responderArquivo(resposta, arquivo);
  }

  /**
   * P17 · dossie final da missao em PDF unico (CG-069).
   *
   * Os documentos que entram sao **os que o solicitante ja podia abrir**: a
   * lista sai de `AnexosService` com o proprio usuario, entao visibilidade
   * `RESTRITA` e recorte por rede valem sem uma segunda regra escrita aqui.
   */
  @Get(':programa/:ciclo/comite-gestor/missoes/:id/dossie')
  @RequirePermission('missao:read', 'missao:export')
  async dossieDaMissao(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Res() resposta: Response,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    const arquivo = await this.exportacao.dossie(ciclo.cicloId, id, usuario);
    responderArquivo(resposta, arquivo);
  }

  @Get(':programa/:ciclo/comite-gestor/equipes')
  @RequirePermission('equipe-gestao:read')
  async listarEquipes(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.gestaoComite.listarEquipes(ciclo.cicloId);
  }

  @Post(':programa/:ciclo/comite-gestor/equipes')
  @RequirePermission('equipe-gestao:create')
  async criarMembroEquipe(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarMembroEquipeSchema))
    dto: CriarMembroEquipe,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.gestaoComite.criarMembro(ciclo.cicloId, dto, usuario);
  }

  @Patch(':programa/:ciclo/comite-gestor/equipes/:id')
  @RequirePermission('equipe-gestao:edit')
  async atualizarMembroEquipe(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarMembroEquipeSchema))
    dto: AtualizarMembroEquipe,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.gestaoComite.atualizarMembro(ciclo.cicloId, id, dto, usuario);
  }

  @Get(':programa/:ciclo/comite-gestor/missoes')
  @RequirePermission('missao:read')
  async listarMissoesComite(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Query(new ZodValidationPipe(filtroMissoesSchema)) filtro: FiltroMissoes,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.listar(
      ciclo.cicloId,
      filtro,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  @Get(':programa/:ciclo/comite-gestor/referencias-missao')
  @RequirePermission('missao:read')
  async referenciasMissaoComite(
    @CurrentUser() usuario: AuthUser,
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.referencias(
      ciclo.cicloId,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  @Get(':programa/:ciclo/comite-gestor/missoes/:id')
  @RequirePermission('missao:read')
  async detalharMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.detalhe(ciclo.cicloId, id);
  }

  /* Prestacao de contas da missao (CG-050). Envio e validacao sao a CG-054. */

  @Get(':programa/:ciclo/comite-gestor/missoes/:id/prestacao')
  @RequirePermission('prestacao:read')
  async prestacaoDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.detalhe(ciclo.cicloId, id);
  }

  @Post(':programa/:ciclo/comite-gestor/missoes/:id/prestacao')
  @RequirePermission('prestacao:create')
  async iniciarPrestacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.criar(ciclo.cicloId, id, usuario);
  }

  @Patch(':programa/:ciclo/comite-gestor/missoes/:id/prestacao')
  @RequirePermission('prestacao:edit')
  async atualizarPrestacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarPrestacaoSchema))
    dto: AtualizarPrestacao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.atualizar(ciclo.cicloId, id, dto, usuario);
  }

  /**
   * Envia a prestacao para revisao (CG-054).
   *
   * `prestacao:write` — e ato de quem prepara. Serve tambem para o reenvio
   * depois de uma devolucao: os dois partem de estado editavel.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/prestacao/envio')
  @RequirePermission('prestacao:submit')
  async enviarPrestacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.enviar(ciclo.cicloId, id, usuario);
  }

  /**
   * Valida a prestacao — **unico estado que abate o aporte** (CG-009/CG-055).
   *
   * `prestacao:review`, nao `prestacao:write`: preparar e revisar sao atos
   * distintos, mesmo enquanto so `admin` tem as duas permissoes.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/prestacao/validacao')
  @RequirePermission('prestacao:review')
  async validarPrestacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(validarPrestacaoSchema)) dto: ValidarPrestacao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.validar(ciclo.cicloId, id, dto, usuario);
  }

  /** Devolve com pendencia; a prestacao volta a aceitar alteracao. */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/prestacao/devolucao')
  @RequirePermission('prestacao:review')
  async devolverPrestacao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(devolverPrestacaoSchema))
    dto: DevolverPrestacao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.devolver(ciclo.cicloId, id, dto, usuario);
  }

  @Post(':programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas')
  @RequirePermission('prestacao:create')
  async criarDespesa(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarDespesaSchema)) dto: CriarDespesa,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.criarDespesa(ciclo.cicloId, id, dto, usuario);
  }

  @Patch(
    ':programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId',
  )
  @RequirePermission('prestacao:edit')
  async atualizarDespesa(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Param('despesaId') despesaId: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarDespesaSchema)) dto: CriarDespesa,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.atualizarDespesa(
      ciclo.cicloId,
      id,
      despesaId,
      dto,
      usuario,
    );
  }

  @Delete(
    ':programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId',
  )
  @RequirePermission('prestacao:delete')
  async removerDespesa(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Param('despesaId') despesaId: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.prestacao.removerDespesa(ciclo.cicloId, id, despesaId, usuario);
  }

  @Post(':programa/:ciclo/comite-gestor/missoes')
  @RequirePermission('missao:create')
  async criarMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarMissaoComiteSchema))
    dto: CriarMissaoComite,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.criar(
      ciclo.cicloId,
      dto,
      usuario,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  @Patch(':programa/:ciclo/comite-gestor/missoes/:id')
  @RequirePermission('missao:edit')
  async atualizarMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarMissaoComiteSchema))
    dto: AtualizarMissaoComite,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.atualizar(
      ciclo.cicloId,
      id,
      dto,
      usuario,
      await this.identidade.recorteDeMissoes(usuario),
    );
  }

  /** Relato do que aconteceu; nao alcanca nenhum campo de planejamento. */
  @Patch(':programa/:ciclo/comite-gestor/missoes/:id/relato')
  @RequirePermission('missao:relato')
  async relatarMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(relatarMissaoSchema)) dto: RelatarMissao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.relatar(ciclo.cicloId, id, dto, usuario);
  }

  /**
   * Checklist de submissao (CG-037).
   *
   * Separado do envio de proposito: descobrir o que falta so na hora de enviar
   * transformaria a conferencia em tentativa e erro.
   */
  @Get(':programa/:ciclo/comite-gestor/missoes/:id/requisitos')
  @RequirePermission('missao:read')
  async requisitosDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.submissao.avaliar(ciclo.cicloId, id);
  }

  /**
   * Checklist de encerramento da missao (CG-058).
   *
   * Existe separado de `CONCLUIR` pelo mesmo motivo da CG-037: descobrir o que
   * falta so na hora de encerrar transforma a conferencia em tentativa e erro.
   */
  @Get(':programa/:ciclo/comite-gestor/missoes/:id/encerramento')
  @RequirePermission('missao:read')
  async checklistEncerramento(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.encerramento.checklist(ciclo.cicloId, id);
  }

  /**
   * Dispensa um requisito de encerramento desta missao.
   *
   * `missao:decide` e a permissao do Comite, que o `admin` tambem tem — e
   * exatamente "admin e Comite", decidido em 2026-09-06. Nenhuma permissao nova
   * foi criada: quem delibera sobre a missao e quem pode abrir excecao nela.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/encerramento/dispensa')
  @RequirePermission('missao:decide')
  async dispensarRequisito(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(dispensarRequisitoSchema))
    body: DispensarRequisito,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.encerramento.dispensar(ciclo.cicloId, id, body, usuario);
  }

  /** Revoga a dispensa sem apagar a linha — ela explica por que a missao fechou. */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/encerramento/revogacao')
  @RequirePermission('missao:decide')
  async revogarDispensa(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(revogarDispensaSchema)) body: RevogarDispensa,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.encerramento.revogarDispensa(ciclo.cicloId, id, body, usuario);
  }

  /** Envia a missao para analise do Comite, abrindo uma rodada (CG-037). */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/submissao')
  @RequirePermission('missao:submit')
  async submeterMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.submissao.submeter(ciclo.cicloId, id, usuario);
  }

  /**
   * Decisao do Comite sobre a rodada aberta (CG-038).
   *
   * `missao:decide` nao inclui `missao:write`: quem julga nao altera o que
   * esta julgando.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/decisao')
  @RequirePermission('missao:decide')
  async decidirMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(decidirSchema)) dto: Decidir,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.decisao.decidir(ciclo.cicloId, id, dto, usuario);
  }

  /**
   * Reabre a **analise** ja decidida; exclusivo de `admin`, sempre justificado.
   *
   * Nao confundir com `/reabertura`, logo abaixo, que reabre a **execucao** de
   * uma missao concluida ou cancelada. Sao as duas dimensoes da CG-006: uma
   * desfaz a decisao do Comite, a outra o encerramento administrativo.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/analise/reabertura')
  @RequirePermission('missao:reopen-analise')
  async reabrirAnaliseMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(reabrirSchema)) dto: Reabrir,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.decisao.reabrir(ciclo.cicloId, id, dto, usuario);
  }

  /** Todas as rodadas e decisoes da missao, da mais nova para a mais antiga. */
  @Get(':programa/:ciclo/comite-gestor/missoes/:id/analise')
  @RequirePermission('missao:read')
  async historicoAnaliseMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.decisao.historico(ciclo.cicloId, id);
  }

  /**
   * Confirmar, concluir e cancelar entram pela mesma rota e **exigem
   * permissoes diferentes** (contrato V1).
   *
   * Nao ha decorador fixo aqui, e nao deve haver: um unico
   * `@RequirePermission` teria de escolher entre exigir as tres de quem so quer
   * confirmar e aceitar qualquer uma das tres para as outras duas — a segunda
   * opcao deixaria quem pode cancelar encerrar a missao. A acao so se conhece
   * depois de ler o corpo, entao a checagem mora aqui, uma permissao por
   * destino.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/situacao')
  async transicionarMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(transicaoMissaoSchema)) dto: TransicaoMissao,
  ) {
    exigirTodas(usuario, [PERMISSAO_DA_TRANSICAO[dto.acao]]);

    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.transicionar(ciclo.cicloId, id, dto, usuario);
  }

  /** Reabertura e operacao administrativa, nao parte do fluxo normal. */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/reabertura')
  @RequirePermission('missao:reopen-execucao')
  async reabrirMissaoComite(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(reaberturaMissaoSchema)) dto: ReaberturaMissao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.missoesComite.reabrir(ciclo.cicloId, id, dto, usuario);
  }

  /** P16 · premissas e fontes documentais. */
  /* Resultados da missao: produtos e a resposta "gerou produto?" (CG-056). */

  /**
   * Leitura sob `missao:read`, escrita sob `missao:write`.
   *
   * Nao e `missao:edit`: `edit` guarda o **planejamento**, que congela em
   * analise para o Comite nao aprovar texto diferente do que leu. Produto e
   * resultado, registrado depois da viagem, e cai no mesmo verbo do relato.
   *
   * O convenio, esse, vive em `/convenios` sob `parceiro:write` — quem registra
   * o resultado da viagem nao necessariamente pode alterar o cadastro
   * institucional do parceiro.
   */
  @Get(':programa/:ciclo/comite-gestor/missoes/:id/produtos')
  @RequirePermission('produto-missao:read')
  async produtosDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.resultados.resultadosDaMissao(ciclo.cicloId, id);
  }

  @Post(':programa/:ciclo/comite-gestor/missoes/:id/produtos')
  @RequirePermission('produto-missao:create')
  async criarProdutoDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(criarProdutoMissaoSchema))
    dto: CriarProdutoMissao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.resultados.criarProduto(ciclo.cicloId, id, dto, usuario);
  }

  @Patch(':programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId')
  @RequirePermission('produto-missao:edit')
  async atualizarProdutoDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Param('produtoId') produtoId: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(atualizarProdutoMissaoSchema))
    dto: AtualizarProdutoMissao,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.resultados.atualizarProduto(
      ciclo.cicloId,
      id,
      produtoId,
      dto,
      usuario,
    );
  }

  @Delete(':programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId')
  @RequirePermission('produto-missao:delete')
  async removerProdutoDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @Param('produtoId') produtoId: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.resultados.removerProduto(
      ciclo.cicloId,
      id,
      produtoId,
      usuario,
    );
  }

  /**
   * Resposta explicita "a missao gerou produto?".
   *
   * Existe porque "nenhum produto cadastrado" e ambiguo: significa tanto que
   * nao houve produto quanto que ninguem respondeu ainda, e o checklist de
   * encerramento precisa saber a diferenca.
   */
  @Post(':programa/:ciclo/comite-gestor/missoes/:id/produtos/resposta')
  @RequirePermission('produto-missao:declare')
  async responderProdutosDaMissao(
    @Param('programa') slug: string,
    @Param('ciclo') nome: string,
    @Param('id') id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(responderProdutosSchema))
    dto: ResponderProdutos,
  ) {
    const ciclo = await this.contexto.resolver(slug, nome);
    return this.resultados.responderProdutos(ciclo.cicloId, id, dto, usuario);
  }

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
  @RequirePermission('pendencia:create')
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
  @RequirePermission('pendencia:resolve')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(atualizarPendenciaSchema))
    dto: AtualizarPendencia,
  ) {
    return this.pendencias.atualizar(id, dto);
  }

  @Delete(':id')
  @RequirePermission('pendencia:delete')
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

/**
 * Devolve o arquivo gerado, sem nunca passar por disco.
 *
 * **`resposta.send`, e nao `return`.** Com `@Res({ passthrough: true })` o Nest
 * serializa o valor devolvido como JSON, e um `Buffer` vira
 * `{"type":"Buffer","data":[...]}` — cabecalhos corretos, corpo inutil. Foi o
 * que aconteceu na primeira versao, e so a verificacao com `file` mostrou:
 * `Content-Type` e `Content-Disposition` estavam certos, entao o navegador
 * salvaria um `.pdf` cheio de JSON. E o mesmo caminho do download de anexo.
 *
 * `Content-Disposition` sai de `disposicaoDoAnexo`, o helper da CG-061: ele
 * monta o fallback ASCII mais o `filename*` em UTF-8, e escrever um segundo
 * aqui repetiria — mal — um problema ja resolvido.
 *
 * `X-Anexos-Ignorados` carrega os PDF que nao puderam ser mesclados no dossie.
 * Cabecalho, e nao corpo, porque o corpo e o proprio arquivo; a tela le e
 * avisa, em vez de o usuario descobrir contando paginas.
 */

/**
 * O que cada relatorio exige para ser **exportado**.
 *
 * Financas guarda despesa: ler o consolidado dela exige a mesma permissao que
 * abrir a prestacao de uma missao, e exportar exige a exportacao financeira.
 * Os demais partem da missao. Parceiros e resultados repetem aqui a leitura que
 * seus endpoints ja exigem, senao a exportacao seria a porta lateral deles.
 */
function permissoesDoRelatorio(qual: NomeDeRelatorio): Permission[] {
  switch (qual) {
    case 'financas':
      return ['prestacao:read', 'prestacao:export'];
    case 'parceiros':
      return ['parceiro:read', 'missao:export'];
    case 'resultados':
      return ['produto-missao:read', 'missao:export'];
    default:
      return ['missao:export'];
  }
}

/** Recusa citando o que faltou, no mesmo formato do `PermissionsGuard`. */
function exigirTodas(usuario: AuthUser, permissoes: readonly Permission[]) {
  const faltando = permissoes.filter((p) => !usuario.permissions.includes(p));
  if (faltando.length > 0) {
    throw new ForbiddenException(
      `Acesso negado. Permissão necessária: ${faltando.join(', ')}`,
    );
  }
}

/** Uma permissao por destino da transicao — nunca um OR entre as tres. */
const PERMISSAO_DA_TRANSICAO: Record<TransicaoMissao['acao'], Permission> = {
  CONFIRMAR: 'missao:confirm',
  CANCELAR: 'missao:cancel',
  CONCLUIR: 'missao:close',
};
