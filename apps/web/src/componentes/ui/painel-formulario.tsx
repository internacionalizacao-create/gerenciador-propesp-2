import type { ReactNode } from "react";

import { Botao } from "@/componentes/ui/botao";

/**
 * Corpo e rodapé de um formulário dentro do `Sidesheet`.
 *
 * O corpo rola e o rodapé fica preso embaixo, com o mesmo recuo lateral do
 * cabeçalho do painel. Os formulários que escreviam isso à mão divergiram:
 * alguns colavam os campos na borda (`px-1`) e deixavam o rodapé sem fundo nem
 * recuo, e somavam `space-y` à margem que cada campo já traz. Uma peça só é o
 * que impede o próximo formulário de repetir o desvio.
 */
export const CLASSE_CORPO_PAINEL = "min-h-0 flex-1 overflow-y-auto px-6 py-5";

export function RodapeDoPainel({
  aoCancelar,
  enviando,
  rotulo,
  rotuloEnviando = "Salvando…",
  erro,
  desabilitado = false,
}: {
  aoCancelar: () => void;
  enviando: boolean;
  rotulo: string;
  rotuloEnviando?: string;
  /** Erro sem campo — conflito de estado, permissão. */
  erro?: ReactNode;
  desabilitado?: boolean;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
      {erro ? (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
        >
          {erro}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Botao type="button" variante="fantasma" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={enviando || desabilitado}>
          {enviando ? rotuloEnviando : rotulo}
        </Botao>
      </div>
    </div>
  );
}
