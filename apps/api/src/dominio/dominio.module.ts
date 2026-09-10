import { Module } from '@nestjs/common';

import { CatalogoService } from './catalogo.service';
import { BolsistasController } from './bolsistas.controller';
import { MobilidadeController } from './mobilidade.controller';
import { MobilidadeService } from './mobilidade.service';
import { BolsistasService } from './bolsistas.service';
import { CicloService } from './ciclo.service';
import { PessoasController } from './comite-gestor.controller';
import { ComiteGestorService } from './comite-gestor.service';
import { ContatosParceirosController } from './contatos-parceiros.controller';
import { ContatosParceirosService } from './contatos-parceiros.service';
import { ContextoService } from './contexto.service';
import { ConveniosController } from './convenios.controller';
import { ResultadosService } from './resultados.service';
import { MissoesComiteService } from './missoes-comite.service';
import { DecisaoService } from './decisao.service';
import { EncerramentoService } from './encerramento.service';
import { ExecucaoComiteService } from './execucao-comite.service';
import { PainelComiteService } from './painel-comite.service';
import { RelatoriosService } from './relatorios.service';
import { ExportacaoService } from '../exportacao/exportacao.service';
import { NotificacoesController } from './notificacoes.controller';
import { CANAL_DE_ENTREGA, NotificacoesService } from './notificacoes.service';
import { SubmissaoService } from './submissao.service';
import { OrcamentoService } from './orcamento.service';
import { PainelService } from './painel.service';
import { AnexosController } from './anexos.controller';
import { AnexosService } from './anexos.service';
import { ArmazenamentoService } from '../arquivos/armazenamento.service';
import { ParceirosController } from './parceiros.controller';
import { PrestacaoService } from './prestacao.service';
import { ParceirosService } from './parceiros.service';
import { PendenciasService } from './pendencias.service';
import { PlanoService } from './plano.service';
import { PpgsService } from './ppgs.service';
import {
  PendenciasController,
  ProgramasController,
} from './programas.controller';
import { CatalogoController, PpgsController } from './ppgs.controller';

/**
 * Modulo de dominio: planejamento, orcamento e governanca.
 *
 * Fica num modulo so porque as telas atravessam essas fronteiras o tempo todo —
 * o painel precisa de orcamento, plano, pendencia e catalogo na mesma resposta.
 * Quebrar em cinco modulos hoje adicionaria imports circulares sem separar nada
 * que ja nao esteja separado por arquivo.
 */
@Module({
  controllers: [
    ProgramasController,
    NotificacoesController,
    PendenciasController,
    PpgsController,
    CatalogoController,
    BolsistasController,
    MobilidadeController,
    PessoasController,
    ParceirosController,
    AnexosController,
    ContatosParceirosController,
    ConveniosController,
  ],
  providers: [
    ContextoService,
    CatalogoService,
    OrcamentoService,
    PainelService,
    PlanoService,
    CicloService,
    PpgsService,
    PendenciasService,
    BolsistasService,
    MobilidadeService,
    ComiteGestorService,
    MissoesComiteService,
    ExecucaoComiteService,
    PainelComiteService,
    RelatoriosService,
    ExportacaoService,
    NotificacoesService,
    /**
     * Nao ha canal externo hoje (D-11, 2026-09-07): a caixa de entrada no
     * sistema e o unico meio. O provider existe nulo de proposito — e o ponto
     * de insercao do SMTP, e deixa-lo declarado evita que ligar o e-mail um dia
     * exija mexer em cada servico que notifica.
     */
    { provide: CANAL_DE_ENTREGA, useValue: null },
    EncerramentoService,
    SubmissaoService,
    DecisaoService,
    ParceirosService,
    PrestacaoService,
    AnexosService,
    ArmazenamentoService,
    ContatosParceirosService,
    ResultadosService,
  ],
  exports: [ContextoService, OrcamentoService, PainelService, CatalogoService],
})
export class DominioModule {}
