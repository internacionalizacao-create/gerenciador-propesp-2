"use client";

import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Lista filtravel com navegacao por teclado (cmdk), vestida com os tokens deste
 * sistema.
 *
 * O cmdk e quem entrega os papeis ARIA de `combobox`/`listbox`/`option` e o
 * vinculo `aria-activedescendant` — o que uma lista montada a mao com `<div>` e
 * `onClick` nao tem, e e justamente o que faz a selecao funcionar por teclado e
 * em leitor de tela.
 */
export const Comando = CommandPrimitive;

export function ComandoEntrada({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3">
      <Search className="size-4 shrink-0 text-subtle" aria-hidden />
      <CommandPrimitive.Input
        className={cn(
          "h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-subtle disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function ComandoLista({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      className={cn("max-h-64 overflow-y-auto overflow-x-hidden p-1", className)}
      {...props}
    />
  );
}

export function ComandoVazio(
  props: React.ComponentProps<typeof CommandPrimitive.Empty>,
) {
  return (
    <CommandPrimitive.Empty
      className="px-3 py-6 text-center text-sm text-muted"
      {...props}
    />
  );
}

export function ComandoGrupo({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      className={cn(
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function ComandoItem({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      className={cn(
        "relative flex cursor-pointer select-none items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground outline-none",
        // O cmdk marca o item sob o cursor do teclado com data-selected.
        "data-[selected=true]:bg-primary-soft data-[selected=true]:text-on-primary-soft",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
