const MILISSEGUNDOS_POR_DIA = 86_400_000;

/**
 * Conta dias civis incluindo saida e retorno.
 *
 * O calculo usa UTC para nunca perder ou ganhar um dia por fuso horario ou
 * horario de verao. As datas ja chegam validadas no formato ISO do Postgres.
 */
export function calcularDiasInclusivos(
  dataInicio: string,
  dataFim: string,
): number {
  const inicio = instanteUtc(dataInicio);
  const fim = instanteUtc(dataFim);
  return Math.floor((fim - inicio) / MILISSEGUNDOS_POR_DIA) + 1;
}

function instanteUtc(data: string): number {
  const [ano, mes, dia] = data.split('-').map(Number);
  return Date.UTC(ano, mes - 1, dia);
}
