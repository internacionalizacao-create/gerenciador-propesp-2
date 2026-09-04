"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";

import { cn } from "@/lib/utils";

/**
 * Popover do Radix com os tokens deste sistema.
 *
 * O sidesheet continua sendo `<dialog>` nativo por decisao (AGENTS.md §8): la o
 * navegador entrega foco preso, `Esc` e fundo inerte de graca. Aqui e diferente
 * — popover ancorado a um gatilho precisa de posicionamento com deteccao de
 * colisao, que nao existe no `<dialog>` e nao vale reimplementar.
 */
export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-72 rounded-2xl border border-border bg-surface p-1 text-foreground shadow-[0_18px_40px_-24px_var(--border-strong)] outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
