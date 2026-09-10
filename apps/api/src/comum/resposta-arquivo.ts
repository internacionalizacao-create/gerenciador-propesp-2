import type { Response } from 'express';

import { disposicaoDoAnexo } from '../dominio/anexos.service';
import type { Exportacao } from '../exportacao/exportacao.service';

/**
 * Envia um arquivo gerado na propria resposta (CG-069).
 *
 * Estava privado em `programas.controller.ts` e saiu de la quando a ficha do
 * parceiro (BOL-034) passou a precisar do mesmo comportamento. Duplicar seria
 * duplicar tambem a armadilha abaixo, que ja custou caro uma vez.
 *
 * **`resposta.send`, nunca `return`.** Com `@Res({ passthrough: true })` o Nest
 * serializa o `Buffer` como JSON e o arquivo baixado fica inutil — com os
 * cabecalhos ainda corretos, que e o que torna a falha dificil de ver.
 */
export function responderArquivo(
  resposta: Response,
  arquivo: Exportacao,
): void {
  resposta.setHeader('Content-Type', arquivo.mimeType);
  resposta.setHeader(
    'Content-Disposition',
    disposicaoDoAnexo(arquivo.nomeArquivo),
  );
  resposta.setHeader('Content-Length', arquivo.conteudo.length);
  if (arquivo.ignorados?.length) {
    resposta.setHeader(
      'X-Anexos-Ignorados',
      encodeURIComponent(arquivo.ignorados.join('|')),
    );
  }
  resposta.send(arquivo.conteudo);
}
