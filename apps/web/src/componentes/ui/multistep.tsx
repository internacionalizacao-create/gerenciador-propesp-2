"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  errosUnicos,
  indiceDaPrimeiraEtapaComErro,
  type ErroDeCampo,
} from "./multistep-logica";

export interface Passo {
  id: string;
  titulo: string;
  descricao?: string;
  conteudo: ReactNode;
  /** Campos enviados por esta etapa, usados para localizar erros da API. */
  campos?: string[];
  /**
   * Impedimento para avançar, em texto. `null` libera.
   * Roda sobre o DOM do formulário, então enxerga o que o usuário digitou sem
   * que os campos precisem virar estado controlado.
   */
  validar?: (formulario: HTMLFormElement) => string | null;
}

/**
 * Formulário em etapas, para os cadastros longos.
 *
 * **Todos os passos ficam montados o tempo todo**, e o inativo é escondido com
 * o atributo `hidden`. Poderia renderizar só o passo atual, mas aí o `FormData`
 * do submit conteria apenas os campos visíveis — e um cadastro de três etapas
 * gravaria só a última. Manter tudo montado também preserva o que foi digitado
 * ao voltar uma etapa, e mantém a validação nativa do HTML valendo para o
 * formulário inteiro.
 *
 * `hidden` (e não `display:none` via classe) porque o navegador exclui campos
 * dentro de um elemento `hidden` da validação de obrigatoriedade — sem isso, um
 * `required` do passo 3 bloquearia o submit com uma mensagem apontando para um
 * campo que ninguém está vendo.
 */
export function Multistep({
  passos,
  rotuloConcluir = "Salvar",
  enviando = false,
  erro,
  erros = [],
  errosParaNavegacao = erros,
  aoCancelar,
}: {
  passos: Passo[];
  rotuloConcluir?: string;
  enviando?: boolean;
  erro?: string | null;
  erros?: ErroDeCampo[];
  errosParaNavegacao?: ErroDeCampo[];
  aoCancelar?: () => void;
}) {
  const [atual, setAtual] = useState(0);
  const [impedimento, setImpedimento] = useState<string | null>(null);
  const errosDetalhados = errosUnicos(erros);
  const primeiraEtapaComErro = indiceDaPrimeiraEtapaComErro(
    passos.map((passo) => passo.campos ?? []),
    errosParaNavegacao,
  );

  useEffect(() => {
    if (primeiraEtapaComErro < 0) return;
    const quadro = window.requestAnimationFrame(() => {
      setAtual(primeiraEtapaComErro);
    });
    return () => window.cancelAnimationFrame(quadro);
  }, [errosParaNavegacao, primeiraEtapaComErro]);

  const ultimo = atual === passos.length - 1;

  function avancar(evento: React.MouseEvent<HTMLButtonElement>) {
    // Ao avançar para a ÚLTIMA etapa, este é o mesmo <button> do DOM que vira
    // type="submit" no re-render que este clique dispara — e o navegador
    // decide a ação padrão do clique (submeter ou não) só depois que os
    // handlers rodam, usando o type que o botão tem NAQUELE momento. Sem o
    // preventDefault, um clique em type="button" acaba submetendo o
    // formulário com os valores padrão da última etapa, sem o usuário ver.
    evento.preventDefault();

    const formulario = evento.currentTarget.form;
    const problema = formulario
      ? (passos[atual].validar?.(formulario) ?? null)
      : null;

    setImpedimento(problema);
    if (!problema) setAtual((i) => Math.min(i + 1, passos.length - 1));
  }

  function concluir(evento: React.MouseEvent<HTMLButtonElement>) {
    const formulario = evento.currentTarget.form;
    const problema = formulario
      ? (passos[atual].validar?.(formulario) ?? null)
      : null;

    setImpedimento(problema);
    if (problema) evento.preventDefault();
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      onChange={() => setImpedimento(null)}
    >
      <ol className="flex shrink-0 gap-2 border-b border-border bg-surface-muted/50 px-6 py-4">
        {passos.map((passo, indice) => {
          const errosDoPasso = errosDetalhados.filter((erro) =>
            passo.campos?.includes(erro.campo),
          );
          const temErro = errosDoPasso.length > 0;
          const estado =
            indice === atual
              ? "atual"
              : indice < atual
                ? "concluido"
                : "futuro";

          return (
            <li key={passo.id} className="flex-1">
              <button
                type="button"
                // Voltar é livre; pular adiante não, senão a validação por
                // etapa deixa de significar alguma coisa.
                disabled={indice > atual}
                onClick={() => setAtual(indice)}
                aria-current={estado === "atual" ? "step" : undefined}
                className="w-full text-left"
              >
                <span
                  className={`block h-1 rounded-full ${
                    temErro
                      ? "bg-danger"
                      : estado === "futuro"
                        ? "bg-border"
                        : "bg-primary"
                  }`}
                />
                <span
                  className={`mt-2 block text-xs font-medium ${
                    temErro
                      ? "text-danger"
                      : estado === "atual"
                        ? "text-foreground"
                        : "text-subtle"
                  }`}
                >
                  {indice + 1}. {passo.titulo}
                  {temErro ? ` (${errosDoPasso.length})` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {passos[atual].descricao ? (
          <p className="mb-5 text-sm text-muted">{passos[atual].descricao}</p>
        ) : null}

        {passos.map((passo, indice) => (
          <div key={passo.id} hidden={indice !== atual}>
            {passo.conteudo}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-border bg-surface-muted/70 px-6 py-4">
        {impedimento ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-warning-soft px-3 py-2 text-sm text-on-warning-soft"
          >
            {impedimento}
          </p>
        ) : null}
        {errosDetalhados.length > 0 ? (
          <div
            role="alert"
            className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
          >
            <p className="font-medium">Revise os campos indicados:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {errosDetalhados.map((item) => (
                <li key={`${item.campo}:${item.mensagem}`}>{item.mensagem}</li>
              ))}
            </ul>
          </div>
        ) : erro ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
          >
            {erro}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-subtle">
            Etapa {atual + 1} de {passos.length}
          </span>

          <div className="flex gap-2">
            {aoCancelar ? (
              <button
                type="button"
                onClick={aoCancelar}
                className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
              >
                Cancelar
              </button>
            ) : null}

            {atual > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setImpedimento(null);
                  setAtual((i) => i - 1);
                }}
                className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-surface-muted"
              >
                Voltar
              </button>
            ) : null}

            {ultimo ? (
              <button
                type="submit"
                onClick={concluir}
                disabled={enviando}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover disabled:opacity-60"
              >
                {enviando ? "Salvando…" : rotuloConcluir}
              </button>
            ) : (
              <button
                type="button"
                onClick={avancar}
                className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover"
              >
                Avançar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
