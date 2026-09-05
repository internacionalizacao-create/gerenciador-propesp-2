import { Module } from '@nestjs/common';

import { CatalogoService } from './catalogo.service';
import { BolsistasController } from './bolsistas.controller';
import { BolsistasService } from './bolsistas.service';
import { CicloService } from './ciclo.service';
import { PessoasController } from './comite-gestor.controller';
import { ComiteGestorService } from './comite-gestor.service';
import { ContatosParceirosController } from './contatos-parceiros.controller';
import { ContatosParceirosService } from './contatos-parceiros.service';
import { ContextoService } from './contexto.service';
import { MissoesComiteService } from './missoes-comite.service';
import { DecisaoService } from './decisao.service';
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
    PendenciasController,
    PpgsController,
    CatalogoController,
    BolsistasController,
    PessoasController,
    ParceirosController,
    AnexosController,
    ContatosParceirosController,
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
    ComiteGestorService,
    MissoesComiteService,
    SubmissaoService,
    DecisaoService,
    ParceirosService,
    PrestacaoService,
    AnexosService,
    ArmazenamentoService,
    ContatosParceirosService,
  ],
  exports: [ContextoService, OrcamentoService, PainelService, CatalogoService],
})
export class DominioModule {}
