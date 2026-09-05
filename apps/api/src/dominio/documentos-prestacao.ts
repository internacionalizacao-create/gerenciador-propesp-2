import * as s from '../database/schema';

type CategoriaAnexo = (typeof s.categoriaAnexoEnum.enumValues)[number];
type TipoDespesa = (typeof s.tipoDespesaMissaoEnum.enumValues)[number];

const CATEGORIAS_POR_TIPO: Record<TipoDespesa, readonly CategoriaAnexo[]> = {
  PASSAGEM: ['PASSAGEM', 'BILHETE', 'COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
  DIARIA: ['COMPROVANTE_DIARIAS', 'COMPROVANTE', 'OUTRO'],
  HOSPEDAGEM: ['COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
  TRANSPORTE: ['COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
  INSCRICAO_EVENTO: ['COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
  SEGURO: ['COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
  OUTRA: ['COMPROVANTE', 'NOTA_FISCAL', 'OUTRO'],
};

/**
 * Categorias que fazem sentido para o tipo da despesa (CG-052).
 *
 * O vinculo polimorfico de `anexo` garante apenas que o alvo existe. Esta
 * matriz fecha a semantica: uma cotacao nao pode virar comprovante de diaria e
 * um bilhete nao pode ser associado a uma hospedagem por engano.
 */
export function categoriaPermitidaParaDespesa(
  tipo: TipoDespesa,
  categoria: CategoriaAnexo,
): boolean {
  return CATEGORIAS_POR_TIPO[tipo].includes(categoria);
}
