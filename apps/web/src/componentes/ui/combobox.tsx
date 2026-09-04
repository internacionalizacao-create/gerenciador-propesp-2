"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";

import {
  Comando,
  ComandoEntrada,
  ComandoItem,
  ComandoLista,
  ComandoVazio,
} from "@/componentes/ui/comando";
import { Popover, PopoverContent, PopoverTrigger } from "@/componentes/ui/popover";
import { cn } from "@/lib/utils";

export interface OpcaoCombobox {
  valor: string;
  rotulo: string;
  /** Segunda linha: cidade, pais, sigla — o que desambigua homonimos. */
  detalhe?: string;
  /** Texto extra considerado na busca sem aparecer no rotulo. */
  termos?: string;
  desabilitada?: boolean;
}

/**
 * Selecao unica com busca.
 *
 * Existe porque `<select>` nativo nao filtra: escolher uma instituicao entre as
 * 200 que o servico devolve significaria rolar a lista inteira. Nas listas
 * curtas (rede, exercicio, situacao) o `Selecao` nativo continua sendo o certo —
 * ele ja vem acessivel e nao carrega JavaScript nenhum.
 *
 * O valor sai num `<input type="hidden">` com o `nome` recebido, entao o
 * `FormData` do submit continua trazendo o campo — inclusive dentro do
 * `Multistep`, que depende disso (AGENTS.md §8).
 */
export function Combobox({
  nome,
  opcoes,
  valor,
  aoMudar,
  id,
  descritoPor,
  placeholder = "Selecione",
  placeholderBusca = "Buscar...",
  textoVazio = "Nada encontrado.",
  desabilitado,
  invalido,
  /** Desligue quando a filtragem for feita pelo servidor. */
  filtrarNoCliente = true,
  aoBuscar,
}: {
  nome: string;
  opcoes: readonly OpcaoCombobox[];
  valor?: string;
  aoMudar: (valor: string) => void;
  id?: string;
  descritoPor?: string;
  placeholder?: string;
  placeholderBusca?: string;
  textoVazio?: string;
  desabilitado?: boolean;
  invalido?: boolean;
  filtrarNoCliente?: boolean;
  aoBuscar?: (termo: string) => void;
}) {
  const [aberto, definirAberto] = useState(false);
  const idPainel = useId();
  const selecionada = opcoes.find((opcao) => opcao.valor === valor);

  return (
    <>
      {/* Nao e `disabled`: campo desabilitado nao entra no FormData, e aqui o
          valor precisa ser enviado mesmo quando a escolha esta travada. */}
      <input type="hidden" name={nome} value={valor ?? ""} />

      <Popover open={aberto} onOpenChange={definirAberto}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            // O `role="combobox"` NAO fica aqui, apesar de o shadcn/ui colocar.
            // Quem e o combobox de fato e o campo de busca dentro do painel — e
            // o cmdk ja lhe da `role`, `aria-autocomplete` e `aria-controls`
            // apontando para a lista. Duplicar o papel no gatilho criaria um
            // combobox sem lista associada, que e o que o eslint acusa.
            aria-haspopup="listbox"
            aria-controls={aberto ? idPainel : undefined}
            aria-expanded={aberto}
            // `aria-required`/`aria-invalid` nao valem em `button` e seriam
            // ignorados. Quem anuncia o erro e o `aria-describedby` montado pelo
            // `Campo`, que e o contrato de acessibilidade ja adotado no sistema
            // (CG-064) — a borda vermelha abaixo e so o reforco visual.
            aria-describedby={descritoPor}
            disabled={desabilitado}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-xl border bg-surface px-3 py-2.5 text-left text-sm shadow-sm",
              "hover:border-primary focus:border-primary disabled:bg-surface-muted disabled:text-muted",
              invalido ? "border-danger" : "border-border-strong",
              selecionada ? "text-foreground" : "text-subtle",
            )}
          >
            <span className="truncate">
              {selecionada ? selecionada.rotulo : placeholder}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-subtle" aria-hidden />
          </button>
        </PopoverTrigger>

        <PopoverContent
          id={idPainel}
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Comando shouldFilter={filtrarNoCliente}>
            <ComandoEntrada
              placeholder={placeholderBusca}
              onValueChange={aoBuscar}
            />
            <ComandoLista>
              <ComandoVazio>{textoVazio}</ComandoVazio>
              {opcoes.map((opcao) => (
                <ComandoItem
                  key={opcao.valor}
                  // O cmdk casa a busca contra `value`; sem os termos extras,
                  // procurar pela sigla ou pela cidade nao acharia nada.
                  value={`${opcao.rotulo} ${opcao.detalhe ?? ""} ${opcao.termos ?? ""}`}
                  disabled={opcao.desabilitada}
                  onSelect={() => {
                    aoMudar(opcao.valor === valor ? "" : opcao.valor);
                    definirAberto(false);
                  }}
                >
                  <Check
                    className={cn(
                      "size-4 shrink-0",
                      opcao.valor === valor ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{opcao.rotulo}</span>
                    {opcao.detalhe ? (
                      <span className="block truncate text-xs text-subtle">
                        {opcao.detalhe}
                      </span>
                    ) : null}
                  </span>
                </ComandoItem>
              ))}
            </ComandoLista>
          </Comando>
        </PopoverContent>
      </Popover>
    </>
  );
}
