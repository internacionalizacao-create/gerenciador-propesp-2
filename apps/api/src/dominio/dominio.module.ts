import { Module } from '@nestjs/common';

import { CatalogoService } from './catalogo.service';
import { BolsistasController } from './bolsistas.controller';
import { BolsistasService } from './bolsistas.service';
import { CicloService } from './ciclo.service';
import { PessoasController } from './comite-gestor.controller';
import { ComiteGestorService } from './comite-gestor.service';
import { ContextoService } from './contexto.service';
import { MissoesComiteService } from './missoes-comite.service';
import { OrcamentoService } from './orcamento.service';
import { PainelService } from './painel.service';
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
  ],
  exports: [ContextoService, OrcamentoService, PainelService, CatalogoService],
})
export class DominioModule {}
