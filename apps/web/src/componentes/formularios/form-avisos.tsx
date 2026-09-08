"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import { Botao } from "@/componentes/ui/botao";
import { marcarAvisoLido } from "@/acoes/avisos";

/**
 * Marca um aviso como lido.
 *
 * `useTransition` mais `router.refresh()` em vez de estado local: a contagem de
 * não lidas vive no servidor, e esconder a linha no cliente faria o número do
 * cabeçalho discordar da lista logo abaixo dele.
 */
export function MarcarLida({ id }: { id: string }) {
  const [enviando, transicionar] = useTransition();
  const router = useRouter();

  return (
    <Botao
      variante="fantasma"
      tamanho="pequeno"
      disabled={enviando}
      onClick={() =>
        transicionar(async () => {
          await marcarAvisoLido(id);
          router.refresh();
        })
      }
    >
      {enviando ? "Marcando…" : "Marcar como lido"}
    </Botao>
  );
}
