"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Executa useActionState sem entregar o submit ao reset automatico do React.
 * Assim uma resposta de validacao preserva todos os campos ja preenchidos.
 */
export function submeterSemLimpar(
  evento: FormEvent<HTMLFormElement>,
  acao: (dados: FormData) => void,
) {
  evento.preventDefault();
  const dados = new FormData(evento.currentTarget);
  startTransition(() => acao(dados));
}
