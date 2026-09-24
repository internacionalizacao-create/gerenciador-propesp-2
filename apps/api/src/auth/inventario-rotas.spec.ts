import { describe, expect, it } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { IS_PUBLIC_KEY, REQUIRED_PERMISSIONS_KEY } from './auth.decorators';

/**
 * O inventario de rotas do contrato confere com os decoradores (V1-022).
 *
 * O inventario de `docs/contrato-autorizacao-v1.md` e o que se le para decidir
 * quem pode o que — e ja chegou a citar permissoes que nem existiam mais, e a
 * omitir as rotas da propria administracao de acesso. Documento que so a
 * revisao humana confere diverge na primeira pressa. Aqui a divergencia
 * reprova o CI: rota sem linha, linha sem rota, decorador diferente.
 *
 * So a coluna *Decorador* e conferida. A regra que mora no servico (alcance do
 * alvo, permissao escolhida pelo corpo) nao tem metadado para ler.
 */

/** O Jest roda a partir de `apps/api`, tanto local quanto no CI. */
const RAIZ_API = process.cwd();
const CONTRATO = join(RAIZ_API, '../../docs/contrato-autorizacao-v1.md');

const PUBLICO = 'Público';
const SEM_DECORADOR = '—';

type Inventario = Map<string, string>;

function controllers(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return controllers(caminho);
    return nome.endsWith('.controller.ts') ? [caminho] : [];
  });
}

function juntar(...partes: (string | undefined)[]): string {
  const caminho = partes
    .filter((parte) => parte && parte !== '/')
    .join('/')
    .replace(/\/+/g, '/');
  return `/${caminho.replace(/^\//, '')}`;
}

function descrever(
  permissoes: readonly string[] | undefined,
  publico: unknown,
) {
  if (publico) return PUBLICO;
  if (!permissoes || permissoes.length === 0) return SEM_DECORADOR;
  return [...permissoes].sort().join(' + ');
}

async function doCodigo(): Promise<Inventario> {
  const rotas: Inventario = new Map();

  for (const arquivo of controllers(join(RAIZ_API, 'src'))) {
    const modulo = (await import(arquivo)) as Record<string, unknown>;

    for (const exportado of Object.values(modulo)) {
      if (typeof exportado !== 'function') continue;
      const base = Reflect.getMetadata(PATH_METADATA, exportado) as
        string | undefined;
      if (base === undefined) continue;

      const prototipo = (exportado as { prototype: object }).prototype;
      for (const nome of Object.getOwnPropertyNames(prototipo)) {
        const handler = (prototipo as Record<string, unknown>)[nome];
        if (nome === 'constructor' || typeof handler !== 'function') continue;

        const metodo = Reflect.getMetadata(METHOD_METADATA, handler) as
          RequestMethod | undefined;
        if (metodo === undefined) continue;

        const caminho = Reflect.getMetadata(PATH_METADATA, handler) as string;
        const chave = `${RequestMethod[metodo]} ${juntar(base, caminho)}`;
        const permissoes = (Reflect.getMetadata(
          REQUIRED_PERMISSIONS_KEY,
          handler,
        ) ?? Reflect.getMetadata(REQUIRED_PERMISSIONS_KEY, exportado)) as
          string[] | undefined;
        const publico: unknown =
          Reflect.getMetadata(IS_PUBLIC_KEY, handler) ??
          Reflect.getMetadata(IS_PUBLIC_KEY, exportado);

        expect(rotas.has(chave)).toBe(false);
        rotas.set(chave, descrever(permissoes, publico));
      }
    }
  }

  return rotas;
}

function doContrato(): Inventario {
  const rotas: Inventario = new Map();
  const linha = /^\| `(GET|POST|PUT|PATCH|DELETE) ([^`]+)` \| ([^|]+) \|/;

  for (const texto of readFileSync(CONTRATO, 'utf8').split('\n')) {
    const achado = linha.exec(texto);
    if (!achado) continue;

    const [, metodo, caminho, coluna] = achado;
    const decorador = coluna.trim();
    const chave = `${metodo} ${caminho}`;
    expect(rotas.has(chave)).toBe(false);

    if (decorador === PUBLICO || decorador === SEM_DECORADOR) {
      rotas.set(chave, decorador);
    } else {
      const permissoes = [...decorador.matchAll(/`([a-z-]+:[a-z-]+)`/g)].map(
        (m) => m[1],
      );
      rotas.set(chave, descrever(permissoes, false));
    }
  }

  return rotas;
}

describe('inventario de rotas do contrato de autorizacao', () => {
  it('lista toda rota do codigo, e so elas, com o decorador que ela tem', async () => {
    const codigo = await doCodigo();
    const contrato = doContrato();

    // Chaves primeiro: a mensagem de falha diz qual rota sobrou ou faltou.
    const semLinha = [...codigo.keys()].filter((rota) => !contrato.has(rota));
    const semRota = [...contrato.keys()].filter((rota) => !codigo.has(rota));
    expect({ semLinha, semRota }).toEqual({ semLinha: [], semRota: [] });

    const divergentes = [...codigo].filter(
      ([rota, decorador]) => contrato.get(rota) !== decorador,
    );
    expect(
      divergentes.map(([rota, decorador]) => ({
        rota,
        codigo: decorador,
        contrato: contrato.get(rota),
      })),
    ).toEqual([]);
  });
});
