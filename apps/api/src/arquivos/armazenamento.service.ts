import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';

import { Injectable, Logger } from '@nestjs/common';

/**
 * Armazenamento de arquivos (CG-014/CG-051).
 *
 * Em desenvolvimento grava em disco, sob `ARQUIVOS_DIR`. Em producao o alvo e
 * object storage compativel com S3 — por isso a interface e estreita de
 * proposito (`guardar`, `ler`) e nao vaza `fs` para o resto do sistema: trocar
 * o backend nao deve tocar em servico de dominio.
 *
 * **A chave e opaca e gerada aqui**, nunca derivada do nome enviado. Nome de
 * arquivo do usuario vira caminho previsivel e vaza informacao (nome de
 * bolsista, numero de processo); alem disso `../` no nome viraria escrita fora
 * do diretorio.
 */
@Injectable()
export class ArmazenamentoService {
  private readonly log = new Logger(ArmazenamentoService.name);
  private readonly raiz = resolve(process.env.ARQUIVOS_DIR ?? './arquivos');

  /** Chave opaca: `<ano>/<uuid>`. Sem nome, sem extensao, sem ordem adivinhavel. */
  private novaChave(): string {
    return `${new Date().getUTCFullYear()}/${randomUUID()}`;
  }

  static hashDe(conteudo: Buffer): string {
    return createHash('sha256').update(conteudo).digest('hex');
  }

  async guardar(conteudo: Buffer): Promise<{ chave: string; hash: string }> {
    const chave = this.novaChave();
    const destino = this.caminhoAbsoluto(chave);
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, conteudo);
    return { chave, hash: ArmazenamentoService.hashDe(conteudo) };
  }

  async ler(chave: string): Promise<Buffer> {
    return readFile(this.caminhoAbsoluto(chave));
  }

  /**
   * Resolve a chave dentro da raiz e **recusa qualquer coisa que escape dela**.
   *
   * A chave e sempre gerada pelo sistema, entao na pratica isto nunca dispara.
   * Existe porque "nunca" depende de todo caminho futuro que chegue aqui — e o
   * dia em que alguem aceitar uma chave vinda de fora, a checagem ja esta no
   * lugar certo.
   */
  private caminhoAbsoluto(chave: string): string {
    const alvo = resolve(join(this.raiz, chave));
    if (alvo !== this.raiz && !alvo.startsWith(this.raiz + sep)) {
      this.log.error(`Chave de armazenamento fora da raiz: ${chave}`);
      throw new Error('Chave de armazenamento inválida.');
    }
    return alvo;
  }
}
