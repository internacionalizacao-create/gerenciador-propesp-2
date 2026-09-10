import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

/**
 * Valida o payload de entrada com zod.
 *
 * O projeto usa zod em toda fronteira (ambiente, claims de token, cookie) e
 * segue com ele aqui, em vez de `class-validator`. Carregar duas bibliotecas de
 * validacao significaria duas gramaticas de regra e dois lugares onde a mesma
 * restricao pode divergir.
 *
 * @example
 * ```ts
 * @Post()
 * criar(@Body(new ZodValidationPipe(criarPpgSchema)) dto: CriarPpg) {}
 * ```
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(valor: unknown): T {
    const resultado = this.schema.safeParse(valor);

    if (!resultado.success) {
      // As mensagens vao para a interface, entao saem em portugues e apontam o
      // campo — erro de formulario sem o nome do campo obriga o usuario a
      // adivinhar qual dos doze inputs esta errado.
      throw new BadRequestException({
        message: 'Dados inválidos',
        erros: resultado.error.issues.map((issue) => ({
          campo: issue.path.join('.') || '(raiz)',
          mensagem: issue.message,
        })),
      });
    }

    return resultado.data;
  }
}
