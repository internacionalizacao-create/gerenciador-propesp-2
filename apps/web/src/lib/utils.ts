import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Junta classes condicionais e resolve conflitos do Tailwind.
 *
 * O `twMerge` existe por causa de um problema real de precedencia: em CSS, a
 * ultima classe declarada na folha vence, nao a ultima escrita no `className`.
 * Sem ele, `cn("px-4", "px-6")` deixaria as duas no atributo e o resultado
 * dependeria da ordem em que o Tailwind gerou as regras — ou seja, quem escreve
 * um componente nao conseguiria sobrescrever o padrao dele pelo `className`.
 *
 * E a unica peca do shadcn/ui que o projeto adota como infraestrutura; o resto
 * entra componente a componente, com os tokens deste sistema (ver AGENTS.md §8).
 */
export function cn(...classes: ClassValue[]): string {
  return twMerge(clsx(classes));
}
