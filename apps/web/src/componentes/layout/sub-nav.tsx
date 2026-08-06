"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { rotulo: "Visão do ciclo", sufixo: "" },
  { rotulo: "Redes e temáticas", sufixo: "/redes" },
  { rotulo: "Orçamento", sufixo: "/orcamento" },
  { rotulo: "Plano de aplicação", sufixo: "/plano" },
  { rotulo: "Comitê Gestor", sufixo: "/comite-gestor" },
  { rotulo: "Premissas", sufixo: "/premissas" },
];

/** Abas do ciclo. Cliente só por causa de `usePathname`. */
export function SubNav({ base }: { base: string }) {
  const caminho = usePathname();

  return (
    <nav
      aria-label="Seções do ciclo"
      className="border-b border-border bg-surface"
    >
      <ul className="mx-auto flex w-full max-w-7xl gap-1 overflow-x-auto px-6">
        {ABAS.map((aba) => {
          const href = `${base}${aba.sufixo}`;
          const atual = aba.sufixo
            ? caminho.startsWith(href)
            : caminho === base;

          return (
            <li key={aba.sufixo}>
              <Link
                href={href}
                aria-current={atual ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm ${
                  atual
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
