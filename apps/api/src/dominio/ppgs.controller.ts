import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { RequirePermission } from '../auth/auth.decorators';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import { CatalogoService } from './catalogo.service';
import {
  ppgParcialSchema,
  ppgSchema,
  PpgsService,
  type PpgDto,
  type PpgParcialDto,
} from './ppgs.service';

/** P14 · PPGs. */
@Controller('ppgs')
export class PpgsController {
  constructor(private readonly ppgs: PpgsService) {}

  @Get()
  @RequirePermission('ppg:read')
  listar() {
    return this.ppgs.listar();
  }

  @Get(':id')
  @RequirePermission('ppg:read')
  detalhar(@Param('id') id: string) {
    return this.ppgs.detalhar(id);
  }

  @Post()
  @RequirePermission('ppg:write')
  criar(@Body(new ZodValidationPipe(ppgSchema)) dto: PpgDto) {
    return this.ppgs.criar(dto);
  }

  @Patch(':id')
  @RequirePermission('ppg:write')
  atualizar(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ppgParcialSchema)) dto: PpgParcialDto,
  ) {
    return this.ppgs.atualizar(id, dto);
  }
}

/**
 * P15 · catalogo de bolsas e catalogos auxiliares.
 *
 * Leitura e aberta a todo perfil (a tabela e publica dentro da instituicao);
 * publicar versao nova exige `catalogo:write`, que so a PROPESP tem (Q10).
 */
@Controller('catalogo')
export class CatalogoController {
  constructor(private readonly catalogo: CatalogoService) {}

  @Get('bolsas')
  @RequirePermission('catalogo:read')
  bolsas(@Query('programa') programa = 'capes-global') {
    return this.catalogo.tabelaVigente(programa);
  }

  @Get('modalidades')
  @RequirePermission('catalogo:read')
  modalidades() {
    return this.catalogo.modalidades();
  }
}
