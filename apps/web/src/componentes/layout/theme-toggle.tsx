"use client";

import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark" | "system";

const OPTIONS: { value: Theme; label: string; icone: React.ReactNode }[] = [
  { value: "light", label: "Claro", icone: <IconeSol /> },
  { value: "dark", label: "Escuro", icone: <IconeLua /> },
  { value: "system", label: "Sistema", icone: <IconeMonitor /> },
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
      className="inline-flex rounded-lg border border-border p-0.5"
    >
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            title={option.label}
            onClick={() => setStoredTheme(option.value)}
            className={
              selected
                ? "rounded-md bg-surface-muted p-1.5 text-foreground"
                : "rounded-md p-1.5 text-subtle hover:text-foreground"
            }
          >
            <span className="sr-only">{option.label}</span>
            {option.icone}
          </button>
        );
      })}
    </div>
  );
}

function IconeSol() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1v1.5M8 13.5V15M15 8h-1.5M2.5 8H1M12.9 3.1l-1.06 1.06M4.16 11.84l-1.06 1.06M12.9 12.9l-1.06-1.06M4.16 4.16 3.1 3.1" />
    </svg>
  );
}

function IconeLua() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 9.7A6 6 0 0 1 6.3 2.5a6 6 0 1 0 7.2 7.2Z" />
    </svg>
  );
}

function IconeMonitor() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
      <path d="M5.5 14h5M8 11.5V14" />
    </svg>
  );
}
