"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * Campos de formulário.
 *
 * Não são componentes controlados: o valor mora no DOM e sai no `FormData` do
 * submit. É o que faz o multistep funcionar sem espelhar cada input em estado
 * do React — e o que mantém o formulário utilizável se o JavaScript falhar.
 */

const ENTRADA =
  "w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm " +
  "text-foreground shadow-sm placeholder:text-subtle hover:border-primary focus:border-primary " +
  "disabled:bg-surface-muted disabled:text-muted";

export function Campo({
  rotulo,
  children,
  dica,
  erro,
  obrigatorio,
}: {
  rotulo: string;
  children: (id: string) => ReactNode;
  dica?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
}) {
  const id = useId();

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {rotulo}
        {obrigatorio ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children(id)}
      {dica ? <p className="mt-1.5 text-xs text-subtle">{dica}</p> : null}
      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

export function Texto({
  rotulo,
  nome,
  ...resto
}: {
  rotulo: string;
  nome: string;
  dica?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  padrao?: string;
  placeholder?: string;
  tipo?: "text" | "number" | "date";
  passo?: string;
  minimo?: string;
  maximo?: string;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id) => (
        <input
          id={id}
          name={nome}
          type={resto.tipo ?? "text"}
          step={resto.passo}
          min={resto.minimo}
          max={resto.maximo}
          required={resto.obrigatorio}
          defaultValue={resto.padrao}
          placeholder={resto.placeholder}
          className={ENTRADA}
        />
      )}
    </Campo>
  );
}

export function AreaTexto({
  rotulo,
  nome,
  linhas = 4,
  ...resto
}: {
  rotulo: string;
  nome: string;
  linhas?: number;
  dica?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  padrao?: string;
  placeholder?: string;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id) => (
        <textarea
          id={id}
          name={nome}
          rows={linhas}
          required={resto.obrigatorio}
          defaultValue={resto.padrao}
          placeholder={resto.placeholder}
          className={ENTRADA}
        />
      )}
    </Campo>
  );
}

export function Selecao({
  rotulo,
  nome,
  opcoes,
  ...resto
}: {
  rotulo: string;
  nome: string;
  opcoes: { valor: string; texto: string }[];
  dica?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
  padrao?: string;
  vazio?: string;
  aoMudar?: (valor: string) => void;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id) => (
        <select
          id={id}
          name={nome}
          required={resto.obrigatorio}
          defaultValue={resto.padrao ?? ""}
          onChange={(e) => resto.aoMudar?.(e.target.value)}
          className={ENTRADA}
        >
          {resto.vazio !== undefined ? (
            <option value="">{resto.vazio}</option>
          ) : null}
          {opcoes.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
      )}
    </Campo>
  );
}

export function Marcador({
  rotulo,
  nome,
  padrao,
  dica,
}: {
  rotulo: string;
  nome: string;
  padrao?: boolean;
  dica?: string;
}) {
  const id = useId();

  return (
    <div className="mb-4 flex items-start gap-2.5">
      {/* O hidden garante que o campo apareça no FormData mesmo desmarcado —
          sem ele, "false" viraria "ausente", que o zod lê diferente. */}
      <input type="hidden" name={nome} value="false" />
      <input
        id={id}
        name={nome}
        type="checkbox"
        value="true"
        defaultChecked={padrao}
        className="mt-0.5 size-4 rounded border-border-strong accent-[var(--primary)]"
      />
      <label htmlFor={id} className="text-sm text-foreground">
        {rotulo}
        {dica ? <span className="block text-xs text-subtle">{dica}</span> : null}
      </label>
    </div>
  );
}

/**
 * Lista de valores curtos que o usuário adiciona um a um (linhas de pesquisa,
 * no slide 3 do protótipo).
 *
 * Cada item vira um `<input type="hidden">` com o mesmo `name`, e o `FormData`
 * devolve todos em `getAll(nome)` — sem precisar serializar em JSON no meio do
 * caminho.
 */
export function Chips({
  rotulo,
  nome,
  padrao = [],
  dica,
  placeholder,
}: {
  rotulo: string;
  nome: string;
  padrao?: string[];
  dica?: string;
  placeholder?: string;
}) {
  const id = useId();
  const [itens, setItens] = useState<string[]>(padrao);
  const [rascunho, setRascunho] = useState("");

  function adicionar() {
    const valor = rascunho.trim();
    if (!valor || itens.includes(valor)) return;
    setItens([...itens, valor]);
    setRascunho("");
  }

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-foreground"
      >
        {rotulo}
      </label>

      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          value={rascunho}
          placeholder={placeholder}
          onChange={(e) => setRascunho(e.target.value)}
          // Enter adiciona o chip; sem isto ele submeteria o formulário inteiro,
          // que é o oposto do que a pessoa quis.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              adicionar();
            }
          }}
          className={ENTRADA}
        />
        <button
          type="button"
          onClick={adicionar}
          className="shrink-0 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Adicionar
        </button>
      </div>

      {dica ? <p className="mt-1.5 text-xs text-subtle">{dica}</p> : null}

      {itens.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {itens.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-xs text-on-primary-soft"
            >
              <input type="hidden" name={nome} value={item} />
              {item}
              <button
                type="button"
                aria-label={`Remover ${item}`}
                onClick={() => setItens(itens.filter((i) => i !== item))}
                className="text-on-primary-soft/70 hover:text-on-primary-soft"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Duas colunas em telas médias, uma em telas pequenas. */
export function Grade({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-4 sm:grid-cols-2">{children}</div>;
}
