"use client";

import { useId, useState, type ReactNode } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";

import {
  dataBrParaIso,
  dataIsoParaBr,
  mascararDataBr,
} from "@/lib/formato";

/**
 * Campos de formulário.
 *
 * Em geral o valor mora no DOM e sai no `FormData`, sem espelhar cada input em
 * estado do React. `Data` e a excecao: precisa controlar o texto para garantir
 * DD/MM/AAAA independentemente do idioma configurado no navegador.
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
  /**
   * Recebe o `id` do controle e a lista de `aria-describedby` que ele deve
   * expor — dica e erro, quando existirem.
   */
  children: (id: string, descritoPor?: string) => ReactNode;
  dica?: ReactNode;
  erro?: string;
  obrigatorio?: boolean;
}) {
  const id = useId();
  const idDica = `${id}-dica`;
  const idErro = `${id}-erro`;
  // O `role="alert"` anuncia o erro no instante em que ele aparece, mas quem
  // volta ao campo depois — tabulando ou navegando por formulario — nao ouviria
  // nada. O `aria-describedby` e o que amarra a mensagem ao controle.
  const descritoPor =
    [dica ? idDica : null, erro ? idErro : null].filter(Boolean).join(" ") ||
    undefined;

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-1.5 block text-left text-sm font-medium text-foreground"
      >
        {rotulo}
        {obrigatorio ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children(id, descritoPor)}
      {dica ? (
        <p id={idDica} className="mt-1.5 text-xs text-subtle">
          {dica}
        </p>
      ) : null}
      {erro ? (
        <p id={idErro} role="alert" className="mt-1.5 text-xs text-danger">
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
  registro?: UseFormRegisterReturn;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id, descritoPor) => (
        <input
          id={id}
          aria-describedby={descritoPor}
          name={resto.registro?.name ?? nome}
          ref={resto.registro?.ref}
          onBlur={resto.registro?.onBlur}
          onChange={resto.registro?.onChange}
          type={resto.tipo ?? "text"}
          step={resto.passo}
          min={resto.minimo}
          max={resto.maximo}
          required={resto.obrigatorio}
          defaultValue={resto.padrao}
          placeholder={resto.placeholder}
          aria-invalid={resto.erro ? true : undefined}
          className={ENTRADA}
        />
      )}
    </Campo>
  );
}

/** Data visivel sempre em DD/MM/AAAA; a Server Action converte para ISO. */
export function Data({
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
  registro?: UseFormRegisterReturn;
}) {
  const [valor, setValor] = useState(() => dataIsoParaBr(resto.padrao));

  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id, descritoPor) => (
        <input
          id={id}
          aria-describedby={descritoPor}
          name={resto.registro?.name ?? nome}
          ref={resto.registro?.ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={10}
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
          required={resto.obrigatorio}
          value={valor}
          placeholder="DD/MM/AAAA"
          aria-invalid={resto.erro ? true : undefined}
          onChange={(evento) => {
            const novaData = mascararDataBr(evento.currentTarget.value);
            setValor(novaData);
            // O RHF precisa receber o mesmo texto mascarado que ficou visivel.
            evento.currentTarget.value = novaData;
            void resto.registro?.onChange(evento);
            evento.currentTarget.setCustomValidity(
              novaData.length === 10 && !dataBrParaIso(novaData)
                ? "Informe uma data válida no formato DD/MM/AAAA."
                : "",
            );
          }}
          onBlur={(evento) => {
            void resto.registro?.onBlur(evento);
            evento.currentTarget.setCustomValidity(
              valor && !dataBrParaIso(valor)
                ? "Informe uma data válida no formato DD/MM/AAAA."
                : "",
            );
          }}
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
  registro?: UseFormRegisterReturn;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id, descritoPor) => (
        <textarea
          id={id}
          aria-describedby={descritoPor}
          name={resto.registro?.name ?? nome}
          ref={resto.registro?.ref}
          onBlur={resto.registro?.onBlur}
          onChange={resto.registro?.onChange}
          rows={linhas}
          required={resto.obrigatorio}
          defaultValue={resto.padrao}
          placeholder={resto.placeholder}
          aria-invalid={resto.erro ? true : undefined}
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
  registro?: UseFormRegisterReturn;
}) {
  return (
    <Campo
      rotulo={rotulo}
      dica={resto.dica}
      erro={resto.erro}
      obrigatorio={resto.obrigatorio}
    >
      {(id, descritoPor) => (
        <select
          id={id}
          aria-describedby={descritoPor}
          name={resto.registro?.name ?? nome}
          ref={resto.registro?.ref}
          onBlur={resto.registro?.onBlur}
          required={resto.obrigatorio}
          defaultValue={resto.padrao ?? ""}
          onChange={(evento) => {
            void resto.registro?.onChange(evento);
            resto.aoMudar?.(evento.target.value);
          }}
          aria-invalid={resto.erro ? true : undefined}
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

/**
 * Grupo de caixas de seleção que devolve uma lista.
 *
 * É um `fieldset` com `legend`, e não um `label` único: o rótulo descreve o
 * conjunto, e cada caixa tem o próprio rótulo. Todas compartilham o `name` e
 * têm `value` próprio, então o React Hook Form junta as marcadas em um array e
 * o `FormData` as devolve em `getAll(nome)` — sem serializar JSON no caminho.
 *
 * Diferente do `Marcador`, aqui não existe campo oculto de apoio: lista vazia
 * é ausência mesmo, e é o schema que decide se isso é erro.
 */
export function Selecoes({
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
  padrao?: string[];
  registro?: UseFormRegisterReturn;
}) {
  const nomeDoCampo = resto.registro?.name ?? nome;

  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 text-left text-sm font-medium text-foreground">
        {rotulo}
        {resto.obrigatorio ? (
          <span className="ml-1 text-danger" aria-hidden>
            *
          </span>
        ) : null}
      </legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2.5">
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="flex items-center gap-2 text-sm text-foreground"
          >
            <input
              type="checkbox"
              name={nomeDoCampo}
              value={opcao.valor}
              ref={resto.registro?.ref}
              onBlur={resto.registro?.onBlur}
              onChange={(evento) => void resto.registro?.onChange(evento)}
              defaultChecked={resto.padrao?.includes(opcao.valor)}
              aria-invalid={resto.erro ? true : undefined}
              className="size-4 rounded border-border-strong accent-[var(--primary)]"
            />
            {opcao.texto}
          </label>
        ))}
      </div>
      {resto.dica ? (
        <p className="mt-1.5 text-xs text-subtle">{resto.dica}</p>
      ) : null}
      {resto.erro ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {resto.erro}
        </p>
      ) : null}
    </fieldset>
  );
}

export function Marcador({
  rotulo,
  nome,
  padrao,
  dica,
  registro,
}: {
  rotulo: string;
  nome: string;
  padrao?: boolean;
  dica?: string;
  registro?: UseFormRegisterReturn;
}) {
  const id = useId();

  return (
    <div className="mb-4 flex items-start gap-2.5">
      {/* O hidden garante que o campo apareça no FormData mesmo desmarcado —
          sem ele, "false" viraria "ausente", que o zod lê diferente. Com o
          React Hook Form ele não entra: o RHF lê o checkbox como booleano
          direto, e um segundo campo de mesmo nome viraria array. */}
      {registro ? null : <input type="hidden" name={nome} value="false" />}
      <input
        id={id}
        type="checkbox"
        {...(registro
          ? registro
          : { name: nome, value: "true", defaultChecked: padrao })}
        className="mt-0.5 size-4 rounded border-border-strong accent-[var(--primary)]"
      />
      <label htmlFor={id} className="text-sm text-foreground">
        {rotulo}
        {dica ? (
          <span className="block text-xs text-subtle">{dica}</span>
        ) : null}
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
          aria-describedby={dica ? `${id}-dica` : undefined}
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

      {dica ? (
        <p id={`${id}-dica`} className="mt-1.5 text-xs text-subtle">
          {dica}
        </p>
      ) : null}

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
