import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Variantes de botao com CVA.
 *
 * As classes sao as deste sistema, nao as do shadcn/ui: `text-muted` aqui e cor
 * de TEXTO (ver globals.css), enquanto no shadcn `muted` e fundo e o texto e
 * `muted-foreground`. Copiar um componente de la sem traduzir os tokens produz
 * texto cinza sobre fundo cinza. Ver a tabela de equivalencia em AGENTS.md §8.
 */
export const variantesBotao = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:size-4",
  {
    variants: {
      variante: {
        primario: "bg-primary text-on-primary hover:bg-primary-hover",
        contorno:
          "border border-border-strong bg-surface text-foreground hover:bg-surface-muted",
        suave: "bg-primary-soft text-on-primary-soft hover:brightness-95",
        fantasma: "text-foreground hover:bg-surface-muted",
        perigo: "bg-danger text-on-danger hover:brightness-110",
      },
      tamanho: {
        padrao: "h-10 px-4 py-2",
        pequeno: "h-8 px-3 text-xs",
        grande: "h-11 px-6",
        icone: "size-10",
      },
    },
    defaultVariants: { variante: "primario", tamanho: "padrao" },
  },
);

export function Botao({
  className,
  variante,
  tamanho,
  comoFilho = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof variantesBotao> & {
    /** Renderiza no elemento filho (um `<Link>`, por exemplo) em vez de `<button>`. */
    comoFilho?: boolean;
  }) {
  const Componente = comoFilho ? Slot : "button";
  return (
    <Componente
      className={cn(variantesBotao({ variante, tamanho }), className)}
      {...props}
    />
  );
}
