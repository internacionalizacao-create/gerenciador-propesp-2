"use server";

import { enviar } from "@/lib/acao";

/**
 * Marca um aviso como lido.
 *
 * Server Action, e não `fetch` do cliente: o token vive no cookie selado e não
 * chega ao JavaScript da página.
 */
export async function marcarAvisoLido(id: string) {
  return enviar(
    `/notificacoes/${id}/leitura`,
    "POST",
    undefined,
    ["/avisos"],
    "Aviso marcado como lido.",
  );
}
