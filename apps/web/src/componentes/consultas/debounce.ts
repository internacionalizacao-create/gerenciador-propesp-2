"use client";

import { useEffect, useState } from "react";

/**
 * Adia um valor até ele parar de mudar.
 *
 * Estava privado em `lista-parceiros.tsx` e saiu de lá quando o seletor de
 * instituição da BOL-010 passou a precisar da mesma coisa: sem o adiamento,
 * cada tecla vira uma requisição, e as respostas voltam fora de ordem.
 */
export function useDebounce<T>(valor: T, milissegundos: number): T {
  const [adiado, definirAdiado] = useState(valor);

  useEffect(() => {
    const id = setTimeout(() => definirAdiado(valor), milissegundos);
    return () => clearTimeout(id);
  }, [valor, milissegundos]);

  return adiado;
}
