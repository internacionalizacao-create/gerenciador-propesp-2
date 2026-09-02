"use client";

import { startTransition, useEffect, type FormEvent } from "react";
import type {
  FieldValues,
  Path,
  UseFormSetError,
} from "react-hook-form";

import type { EstadoDaAcao } from "@/lib/acao-tipos";

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

/** Le os erros da API e os coloca nos campos registrados pelo React Hook Form. */
export function useErrosDaAcao<T extends FieldValues>(
  estado: EstadoDaAcao,
  setError: UseFormSetError<T>,
  campos: Readonly<Partial<Record<string, Path<T>>>>,
) {
  useEffect(() => {
    if (estado.ok || !estado.erros) return;
    for (const erro of estado.erros) {
      const campo = campos[erro.campo];
      if (campo) setError(campo, { type: "server", message: erro.mensagem });
    }
  }, [campos, estado, setError]);
}
