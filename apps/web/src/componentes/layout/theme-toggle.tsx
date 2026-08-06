"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];

const STORAGE_KEY = "theme";

/* O tema mora no localStorage, nao no estado do React. useSyncExternalStore le
   essa fonte externa com suporte a SSR: no servidor e na hidratacao devolve
   "system" (o mesmo que o HTML renderizado), depois passa a ler o valor real. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  // "storage" dispara em OUTRAS abas, mantendo todas em sincronia.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

function getServerSnapshot(): Theme {
  return "system";
}

function setStoredTheme(theme: Theme) {
  localStorage.setItem(STORAGE_KEY, theme);
  // O evento "storage" nao dispara na aba que escreveu; avisamos manualmente.
  listeners.forEach((notify) => notify());
}

/** Resolve "system" para claro/escuro e aplica no <html>. */
function applyTheme(theme: Theme) {
  const isDark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);

  const root = document.documentElement;
  root.setAttribute("data-theme", isDark ? "dark" : "light");
  // Alinha controles nativos (scrollbar, inputs de data) com o tema.
  root.style.colorScheme = isDark ? "dark" : "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    applyTheme(theme);

    // Em "system", acompanha mudancas do SO com a pagina aberta.
    if (theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [theme]);

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="inline-flex rounded-lg border border-border bg-surface-muted p-1"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setStoredTheme(option.value)}
            className={
              selected
                ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                : "rounded-md px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
