"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * Painel lateral de cadastro (o "sidesheet" do protótipo, slide 4).
 *
 * É um `<dialog>` nativo, não uma `<div>` com overlay. A diferença não é
 * estética:
 *
 * - `showModal()` torna o resto da página inerte — nem leitor de tela nem Tab
 *   alcançam o conteúdo de trás.
 * - O foco entra no painel e fica preso nele, sem código de foco manual.
 * - `Esc` fecha, porque o navegador já faz isso.
 * - `::backdrop` é do próprio elemento; não há z-index para brigar.
 *
 * Reimplementar isso à mão seria escrever, com bug, o que o navegador já faz.
 * O que resta aqui é posicionar o diálogo à direita e ocupar a altura toda.
 */
export function Sidesheet({
  aberto,
  aoFechar,
  titulo,
  descricao,
  largura = "media",
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  largura?: "media" | "larga";
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    if (aberto && !elemento.open) elemento.showModal();
    if (!aberto && elemento.open) elemento.close();
  }, [aberto]);

  return (
    <dialog
      ref={dialogo}
      aria-labelledby={tituloId}
      // `close` cobre tanto o Esc quanto o `close()` programático, então o
      // estado do pai nunca fica dessincronizado do que está na tela.
      onClose={aoFechar}
      // Clique no backdrop fecha: o alvo do clique é o próprio <dialog> quando
      // ele acontece fora da área de conteúdo.
      onClick={(evento) => {
        if (evento.target === dialogo.current) aoFechar();
      }}
      className={`
        ml-auto mr-0 my-0 h-dvh max-h-dvh w-full rounded-none border-l
        border-border bg-surface p-0 text-foreground shadow-2xl
        backdrop:bg-black/50
        ${largura === "larga" ? "max-w-3xl" : "max-w-xl"}
      `}
    >
      {/* Uma coluna flex só, sem altura de cabeçalho fixada em pixel: o título
          pode quebrar em duas linhas sem descolar o rodapé. */}
      <div className="flex h-dvh flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2
              id={tituloId}
              className="text-lg font-semibold tracking-tight text-foreground"
            >
              {titulo}
            </h2>
            {descricao ? (
              <p className="mt-1 text-sm text-muted">{descricao}</p>
            ) : null}
          </div>
          {/* `type="button"` e não submit: o conteúdo abaixo tem o próprio
              formulário, e um submit aqui o dispararia por engano. */}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
          >
            ✕
          </button>
        </header>

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>

        {rodape ? (
          <footer className="border-t border-border bg-surface-muted px-6 py-4">
            {rodape}
          </footer>
        ) : null}
      </div>
    </dialog>
  );
}

/**
 * Botão que abre um sidesheet, com o estado de abertura encapsulado.
 *
 * Existe para que a página (um Server Component) não precise virar cliente só
 * para guardar um booleano. O formulário é passado como função e recebe o
 * `fechar` — quem sabe que a gravação terminou é o formulário, não o botão.
 */
export function AbrirSidesheet({
  rotulo,
  titulo,
  descricao,
  largura,
  variante = "primaria",
  children,
}: {
  rotulo: string;
  titulo: string;
  descricao?: string;
  largura?: "media" | "larga";
  variante?: "primaria" | "secundaria";
  children: (fechar: () => void) => ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className={
          variante === "primaria"
            ? "rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover"
            : "rounded-lg border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        }
      >
        {rotulo}
      </button>

      <Sidesheet
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={titulo}
        descricao={descricao}
        largura={largura}
      >
        {/* Remontar a cada abertura zera o formulário: reabrir um cadastro e
            encontrar o que foi digitado antes é como se grava um dado errado
            sem perceber. */}
        {aberto ? children(() => setAberto(false)) : null}
      </Sidesheet>
    </>
  );
}
