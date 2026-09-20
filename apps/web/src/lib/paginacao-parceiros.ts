// A URL e editavel: entradas invalidas voltam a primeira pagina antes da API.
export function normalizarPaginaParceiros(valor: string | null | undefined): number {
  const pagina = Number(valor ?? "1");
  return Number.isInteger(pagina) && pagina >= 1 && pagina <= 2147483647
    ? pagina
    : 1;
}
