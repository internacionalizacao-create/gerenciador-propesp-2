export type ItemFiltravelDoCatalogo = {
  destino: "BRASIL" | "EXTERIOR";
  codigo: string;
  modalidade: string;
  fonte: string | null;
  observacao: string | null;
};

/** Recorte local da tabela vigente, sem transformar valor nulo em texto. */
export function filtrarItensCatalogo<T extends ItemFiltravelDoCatalogo>(
  itens: readonly T[],
  busca: string,
  destino: "BRASIL" | "EXTERIOR" | "TODOS",
): T[] {
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  return itens.filter((item) => {
    if (destino !== "TODOS" && item.destino !== destino) return false;
    if (!termo) return true;
    return [item.codigo, item.modalidade, item.fonte, item.observacao]
      .filter((valor): valor is string => Boolean(valor))
      .some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
  });
}
