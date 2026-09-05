import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';

import { CurrentUser } from '../auth/auth.decorators';
import type { AuthUser } from '../auth/auth-user';
import { ZodValidationPipe } from '../comum/zod-validation.pipe';
import {
  AnexosService,
  disposicaoDoAnexo,
  enviarAnexoSchema,
  idAnexoSchema,
  justificarAnexoSchema,
  listarAnexosSchema,
  type ArquivoRecebido,
  type EnviarAnexo,
  type JustificarAnexo,
  type ListarAnexos,
} from './anexos.service';

/**
 * Documentos (CG-051).
 *
 * **Não há `@RequirePermission` aqui de propósito.** A permissão depende da
 * entidade de destino — anexar à prestação exige `prestacao:write`, ao parceiro
 * `parceiro:write` — e isso só se sabe depois de ler o corpo da requisição. O
 * serviço aplica a política; um decorador fixo teria de escolher a permissão
 * mais fraca e deixaria passar o que não devia.
 */
@Controller('anexos')
export class AnexosController {
  constructor(private readonly anexos: AnexosService) {}

  @Get()
  listar(
    @Query(new ZodValidationPipe(listarAnexosSchema)) filtros: ListarAnexos,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.anexos.listar(filtros, usuario);
  }

  @Post()
  // Memória, não disco: o arquivo precisa ser inspecionado e ter o hash
  // calculado antes de existir em qualquer lugar permanente.
  @UseInterceptors(FileInterceptor('arquivo'))
  enviar(
    @UploadedFile() arquivo: ArquivoRecebido,
    @Body(new ZodValidationPipe(enviarAnexoSchema)) dto: EnviarAnexo,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.anexos.enviar(dto, arquivo, usuario);
  }

  @Get(':id/historico')
  historico(
    @Param('id', new ZodValidationPipe(idAnexoSchema)) id: string,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.anexos.historico(id, usuario);
  }

  /**
   * Download autenticado. O conteúdo é servido por aqui e nunca por URL
   * estática: caminho público transformaria "conhecer a URL" em permissão de
   * leitura, e há dado pessoal nestes arquivos.
   */
  @Get(':id/conteudo')
  async baixar(
    @Param('id', new ZodValidationPipe(idAnexoSchema)) id: string,
    @CurrentUser() usuario: AuthUser,
    @Res() resposta: Response,
  ) {
    const arquivo = await this.anexos.baixar(id, usuario);
    resposta.setHeader('Content-Type', arquivo.mimeType);
    resposta.setHeader('Content-Disposition', disposicaoDoAnexo(arquivo.nome));
    resposta.send(arquivo.conteudo);
  }

  @Post(':id/substituicao')
  @UseInterceptors(FileInterceptor('arquivo'))
  substituir(
    @Param('id', new ZodValidationPipe(idAnexoSchema)) id: string,
    @UploadedFile() arquivo: ArquivoRecebido,
    @CurrentUser() usuario: AuthUser,
  ) {
    return this.anexos.substituir(id, arquivo, usuario);
  }

  @Post(':id/inativacao')
  inativar(
    @Param('id', new ZodValidationPipe(idAnexoSchema)) id: string,
    @CurrentUser() usuario: AuthUser,
    @Body(new ZodValidationPipe(justificarAnexoSchema)) dto: JustificarAnexo,
  ) {
    return this.anexos.inativar(id, dto, usuario);
  }
}
