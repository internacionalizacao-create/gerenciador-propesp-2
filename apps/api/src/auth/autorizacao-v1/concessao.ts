import { z } from 'zod';

import { aceitaEscopo, permissaoV1Schema } from './catalogo';

// strictObject impede descartar um alvo extra e ampliar a concessao em silencio.
export const escopoV1Schema = z.discriminatedUnion('tipo', [
  z.strictObject({ tipo: z.literal('GLOBAL') }),
  z.strictObject({ tipo: z.literal('CICLO'), cicloId: z.uuid() }),
  z.strictObject({
    tipo: z.literal('PPG'),
    ppgId: z.uuid(),
    cicloId: z.uuid(),
  }),
  z.strictObject({ tipo: z.literal('REDE'), redeId: z.uuid() }),
  z.strictObject({ tipo: z.literal('TEMATICA'), tematicaId: z.uuid() }),
  z.strictObject({ tipo: z.literal('PARTICIPACAO'), participacaoId: z.uuid() }),
]);

// Existencia dos alvos e seu ciclo exigem FK/consulta nas tarefas seguintes.
export const concessaoV1Schema = z
  .strictObject({
    permissao: permissaoV1Schema,
    escopo: escopoV1Schema,
  })
  .refine((v) => aceitaEscopo(v.permissao, v.escopo.tipo), {
    path: ['escopo', 'tipo'],
    message: 'Este alcance não é compatível com a ação escolhida.',
  });

export type EscopoV1 = z.infer<typeof escopoV1Schema>;
export type ConcessaoV1 = z.infer<typeof concessaoV1Schema>;
