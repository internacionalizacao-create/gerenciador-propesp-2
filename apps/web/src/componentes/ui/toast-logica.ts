import type { EstadoDaAcao } from "@/lib/acao-tipos";

/** O mesmo resultado pode renderizar mais de uma vez durante o fechamento. */
export function deveNotificarAcao(
  estado: EstadoDaAcao,
  ultimoNotificado: EstadoDaAcao | null,
): boolean {
  return estado.ok && estado !== ultimoNotificado;
}
