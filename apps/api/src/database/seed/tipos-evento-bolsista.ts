import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { sql } from 'drizzle-orm';

import * as s from '../schema';

/**
 * Tipos iniciais de evento do beneficiario (V1-036, contrato §4).
 *
 * A mesma lista entra pela migration `0042`, e as duas precisam andar juntas:
 * a migration serve a base ja instalada, esta serve `db:seed --reset` e os
 * testes, que truncam tudo antes de cada caso.
 *
 * `FALECIMENTO` leva a `INTERROMPIDA`, e nao a um estado proprio: um
 * `FALECIDA` no enum publicaria a causa em toda listagem de situacao. O estado
 * diz que a bolsa parou; o evento diz por que, para quem pode le-lo.
 */
export const TIPOS_EVENTO_BOLSISTA = [
  {
    codigo: 'DESISTENCIA',
    rotulo: 'Desistência',
    descricao:
      'O bolsista desistiu da bolsa na CAPES. A vaga volta a ficar disponível.',
    estadosOrigem: ['SELECIONADO', 'EM_ANDAMENTO'],
    estadoDestino: 'CANCELADA',
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: false,
    ordem: 10,
  },
  {
    codigo: 'INTERRUPCAO',
    rotulo: 'Interrupção',
    descricao: 'A bolsa foi interrompida na CAPES. A vaga continua ocupada.',
    estadosOrigem: ['EM_ANDAMENTO'],
    estadoDestino: 'INTERROMPIDA',
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: true,
    ordem: 20,
  },
  {
    codigo: 'FALECIMENTO',
    rotulo: 'Falecimento',
    descricao:
      'A bolsa foi encerrada por falecimento. A situação exibida é Interrompida; a causa fica só no evento.',
    estadosOrigem: ['SELECIONADO', 'EM_ANDAMENTO', 'INTERROMPIDA'],
    estadoDestino: 'INTERROMPIDA',
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: false,
    ordem: 30,
  },
  {
    codigo: 'SUBSTITUICAO',
    rotulo: 'Substituição',
    descricao:
      'Outro bolsista assumiu a vaga na CAPES. A bolsa que sai é cancelada e a que entra fica ligada a ela.',
    estadosOrigem: ['SELECIONADO', 'EM_ANDAMENTO'],
    estadoDestino: 'CANCELADA',
    aceitaSubstituta: true,
    aceitaPrevisaoRetorno: false,
    ordem: 40,
  },
  {
    codigo: 'CONCLUSAO_ANTECIPADA',
    rotulo: 'Conclusão antecipada',
    descricao: 'A bolsa foi concluída na CAPES antes da data prevista.',
    estadosOrigem: ['EM_ANDAMENTO'],
    estadoDestino: 'CONCLUIDA',
    aceitaSubstituta: false,
    aceitaPrevisaoRetorno: false,
    ordem: 50,
  },
] as const satisfies readonly (typeof s.tipoEventoBolsista.$inferInsert)[];

/**
 * Upsert pelo codigo. Atualiza rotulo e regra, mas **nao reativa** um tipo que
 * a instituicao desligou: `ativo` fica de fora do `set` de proposito.
 */
export async function carregarTiposEventoBolsista(
  db: NodePgDatabase<typeof s>,
): Promise<number> {
  const linhas = await db
    .insert(s.tipoEventoBolsista)
    .values(
      TIPOS_EVENTO_BOLSISTA.map((tipo) => ({
        ...tipo,
        estadosOrigem: [...tipo.estadosOrigem],
      })),
    )
    .onConflictDoUpdate({
      target: s.tipoEventoBolsista.codigo,
      set: {
        rotulo: sql`excluded.rotulo`,
        descricao: sql`excluded.descricao`,
        estadosOrigem: sql`excluded.estados_origem`,
        estadoDestino: sql`excluded.estado_destino`,
        aceitaSubstituta: sql`excluded.aceita_substituta`,
        aceitaPrevisaoRetorno: sql`excluded.aceita_previsao_retorno`,
        ordem: sql`excluded.ordem`,
        atualizadoEm: sql`now()`,
      },
    })
    .returning({ codigo: s.tipoEventoBolsista.codigo });
  return linhas.length;
}
