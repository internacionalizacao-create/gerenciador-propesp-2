"use client";

import { CircleHelp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/** Ajuda por mouse, teclado ou toque, fora da area rolavel das tabelas. */
export function Ajuda({ rotulo, children }: { rotulo: string; children: string }) {
  const [aberta, definirAberta] = useState(false);
  const id = useId();
  const gatilho = useRef<HTMLButtonElement>(null);
  const fechamento = useRef<ReturnType<typeof setTimeout> | null>(null);

  function abrir() {
    if (fechamento.current) clearTimeout(fechamento.current);
    definirAberta(true);
  }

  function agendarFechamento() {
    if (document.activeElement === gatilho.current) return;
    if (fechamento.current) clearTimeout(fechamento.current);
    fechamento.current = setTimeout(() => definirAberta(false), 150);
  }

  useEffect(() => () => {
    if (fechamento.current) clearTimeout(fechamento.current);
  }, []);

  return (
    <Popover open={aberta} onOpenChange={definirAberta}>
      <span className="inline-flex items-center gap-1" onMouseEnter={abrir} onMouseLeave={agendarFechamento}>
        {rotulo}
        <PopoverTrigger asChild>
          <button
            ref={gatilho}
            type="button"
            aria-haspopup={undefined}
            aria-expanded={undefined}
            aria-controls={undefined}
            aria-label={`Entenda: ${rotulo}`}
            aria-describedby={aberta ? id : undefined}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-surface-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            onFocus={abrir}
            onBlur={() => definirAberta(false)}
            onClick={(evento) => {
              evento.preventDefault();
              abrir();
            }}
          >
            <CircleHelp className="size-4" aria-hidden="true" />
          </button>
        </PopoverTrigger>
      </span>
      <PopoverContent
        id={id}
        role="tooltip"
        side="top"
        align="center"
        className="max-w-[calc(100vw-2rem)] p-3 text-left text-sm font-normal normal-case leading-5 tracking-normal"
        onOpenAutoFocus={(evento) => evento.preventDefault()}
        onCloseAutoFocus={(evento) => evento.preventDefault()}
        onMouseEnter={abrir}
        onMouseLeave={agendarFechamento}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
