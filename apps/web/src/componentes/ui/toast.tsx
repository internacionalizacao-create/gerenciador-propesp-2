"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { EstadoDaAcao } from "@/lib/acao-tipos";
import { deveNotificarAcao } from "./toast-logica";

type TomDoToast = "sucesso" | "erro" | "aviso" | "info";

interface ToastDados {
  titulo: string;
  descricao?: string;
  tom?: TomDoToast;
  duracao?: number;
}

interface ToastInterno extends ToastDados {
  id: number;
}

interface ToastContexto {
  mostrarToast: (toast: ToastDados) => number;
  fecharToast: (id: number) => void;
}

const Contexto = createContext<ToastContexto | null>(null);

const ESTILOS: Record<
  TomDoToast,
  { icone: string; faixa: string; titulo: string }
> = {
  sucesso: {
    icone: "bg-success-soft text-on-success-soft",
    faixa: "bg-success",
    titulo: "text-foreground",
  },
  erro: {
    icone: "bg-danger-soft text-on-danger-soft",
    faixa: "bg-danger",
    titulo: "text-foreground",
  },
  aviso: {
    icone: "bg-warning-soft text-on-warning-soft",
    faixa: "bg-warning",
    titulo: "text-foreground",
  },
  info: {
    icone: "bg-info-soft text-on-info-soft",
    faixa: "bg-info",
    titulo: "text-foreground",
  },
};

/**
 * Regiao global de notificacoes breves.
 *
 * O provider fica acima das paginas para o toast sobreviver ao fechamento de
 * um sidesheet e a revalidacao da rota. Cada item tem seu proprio temporizador,
 * mas tambem pode ser dispensado imediatamente pelo usuario.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastInterno[]>([]);
  const proximoId = useRef(0);
  const temporizadores = useRef(
    new Map<number, ReturnType<typeof setTimeout>>(),
  );

  const fecharToast = useCallback((id: number) => {
    const temporizador = temporizadores.current.get(id);
    if (temporizador) clearTimeout(temporizador);
    temporizadores.current.delete(id);
    setToasts((atuais) => atuais.filter((toast) => toast.id !== id));
  }, []);

  const mostrarToast = useCallback(
    (dados: ToastDados) => {
      const id = ++proximoId.current;
      setToasts((atuais) => [...atuais.slice(-3), { ...dados, id }]);

      const duracao = dados.duracao ?? 5000;
      if (duracao > 0) {
        temporizadores.current.set(
          id,
          setTimeout(() => fecharToast(id), duracao),
        );
      }
      return id;
    },
    [fecharToast],
  );

  useEffect(
    () => () => {
      for (const temporizador of temporizadores.current.values()) {
        clearTimeout(temporizador);
      }
    },
    [],
  );

  return (
    <Contexto value={{ mostrarToast, fecharToast }}>
      {children}
      <div
        aria-label="Notificações"
        className="pointer-events-none fixed inset-x-4 top-4 z-50 flex flex-col items-end gap-3 sm:left-auto sm:right-6 sm:top-6 sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} aoFechar={fecharToast} />
        ))}
      </div>
    </Contexto>
  );
}

function Toast({
  toast,
  aoFechar,
}: {
  toast: ToastInterno;
  aoFechar: (id: number) => void;
}) {
  const tom = toast.tom ?? "info";
  const estilos = ESTILOS[tom];

  return (
    <div
      role={tom === "erro" ? "alert" : "status"}
      aria-live={tom === "erro" ? "assertive" : "polite"}
      className="pointer-events-auto relative w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[0_18px_45px_-18px_var(--border-strong)]"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 left-0 w-1 ${estilos.faixa}`}
      />
      <div className="flex items-start gap-3 py-4 pl-5 pr-3">
        <span
          className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full ${estilos.icone}`}
        >
          <Icone tom={tom} />
        </span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className={`text-sm font-semibold ${estilos.titulo}`}>
            {toast.titulo}
          </p>
          {toast.descricao ? (
            <p className="mt-1 text-sm leading-5 text-muted">
              {toast.descricao}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => aoFechar(toast.id)}
          aria-label="Fechar notificação"
          className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-surface-muted hover:text-foreground"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          >
            <path d="m6 6 8 8m0-8-8 8" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Icone({ tom }: { tom: TomDoToast }) {
  if (tom === "sucesso") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m5 10 3 3 7-7" />
      </svg>
    );
  }

  if (tom === "erro") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="m6.5 6.5 7 7m0-7-7 7" />
      </svg>
    );
  }

  if (tom === "aviso") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 3 18 17H2L10 3Z" />
        <path d="M10 8v4m0 2.5v.01" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="7" />
      <path d="M10 9v5m0-8v.01" />
    </svg>
  );
}

/** Acesso imperativo para fluxos que nao usam Server Actions. */
export function useToast() {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error("useToast deve ser usado dentro de ToastProvider.");
  }
  return contexto;
}

/**
 * Conecta o resultado de uma Server Action ao feedback global da interface.
 * Erros continuam no formulario, proximos aos campos; o toast confirma o
 * sucesso depois que o formulario e o sidesheet deixam a tela.
 */
export function useToastDaAcao(estado: EstadoDaAcao, aoConcluir: () => void) {
  const { mostrarToast } = useToast();
  const ultimoNotificado = useRef<EstadoDaAcao | null>(null);

  useEffect(() => {
    if (!deveNotificarAcao(estado, ultimoNotificado.current)) return;
    ultimoNotificado.current = estado;
    mostrarToast({
      tom: "sucesso",
      titulo: "Ação concluída",
      descricao: estado.mensagem,
    });
    aoConcluir();
  }, [estado, aoConcluir, mostrarToast]);
}
