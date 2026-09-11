"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Botao } from "@/componentes/ui/botao";

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
  aoTerminarFechamento,
  titulo,
  descricao,
  largura = "media",
  children,
  rodape,
}: {
  aberto: boolean;
  aoFechar: () => void;
  aoTerminarFechamento?: () => void;
  titulo: string;
  descricao?: string;
  largura?: "media" | "larga";
  children: ReactNode;
  rodape?: ReactNode;
}) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descricaoId = `${tituloId}-descricao`;

  useEffect(() => {
    const elemento = dialogo.current;
    if (!elemento) return;

    if (aberto) {
      delete elemento.dataset.fechando;
      if (!elemento.open) elemento.showModal();
      return;
    }

    if (!elemento.open) return;

    // `dialog.close()` remove o elemento da top layer imediatamente. A marca
    // mantem o dialogo aberto pelo tempo da animacao; so depois ele fecha de
    // verdade e devolve o foco ao controle que o abriu.
    elemento.dataset.fechando = "true";
    const temporizador = window.setTimeout(() => {
      if (elemento.open) elemento.close();
      delete elemento.dataset.fechando;
    }, 200);

    return () => window.clearTimeout(temporizador);
  }, [aberto]);

  return (
    <dialog
      ref={dialogo}
      data-sidesheet="true"
      aria-labelledby={tituloId}
      // A descricao explica a consequencia da acao ("o cadastro fica inativo",
      // "substitui o principal atual"). Sem o vinculo, ela e texto visual que o
      // leitor de tela so alcanca depois, se procurar.
      aria-describedby={descricao ? descricaoId : undefined}
      // `close` cobre tanto o Esc quanto o `close()` programático, então o
      // estado do pai nunca fica dessincronizado do que está na tela.
      onClose={() => {
        aoFechar();
        aoTerminarFechamento?.();
      }}
      // O comportamento nativo do Esc fecharia antes da animacao. Cancelamos
      // apenas o fechamento imediato e encaminhamos para o mesmo fluxo visual.
      onCancel={(evento) => {
        evento.preventDefault();
        aoFechar();
      }}
      // Clique no backdrop fecha: o alvo do clique é o próprio <dialog> quando
      // ele acontece fora da área de conteúdo.
      onClick={(evento) => {
        if (evento.target === dialogo.current) aoFechar();
      }}
      className={`
        ml-auto mr-0 my-0 h-dvh max-h-dvh w-full rounded-none border-l
        border-border bg-surface p-0 text-left text-foreground shadow-2xl
        backdrop:bg-foreground/30 backdrop:backdrop-blur-sm
        ${largura === "larga" ? "max-w-3xl" : "max-w-xl"}
      `}
    >
      {/* Uma coluna flex só, sem altura de cabeçalho fixada em pixel: o título
          pode quebrar em duas linhas sem descolar o rodapé. */}
      <div className="flex h-dvh flex-col">
        <header className="relative flex items-start justify-between gap-4 border-b border-border px-6 py-5">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-primary"
          />
          <div>
            <h2
              id={tituloId}
              className="text-lg font-semibold tracking-[-0.02em] text-foreground"
            >
              {titulo}
            </h2>
            {descricao ? (
              <p id={descricaoId} className="mt-1 text-sm text-muted">
                {descricao}
              </p>
            ) : null}
          </div>
          {/* `type="button"` e não submit: o conteúdo abaixo tem o próprio
              formulário, e um submit aqui o dispararia por engano. */}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="grid size-9 place-items-center rounded-xl text-sm text-muted hover:bg-surface-muted hover:text-foreground"
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
  const [conteudoMontado, setConteudoMontado] = useState(false);
  const fechar = useCallback(() => setAberto(false), []);

  function abrir() {
    setConteudoMontado(true);
    setAberto(true);
  }

  return (
    <>
      <Botao
        type="button"
        onClick={abrir}
        variante={variante === "primaria" ? "primario" : "contorno"}
        className="shadow-sm"
      >
        {rotulo}
      </Botao>

      <Sidesheet
        aberto={aberto}
        aoFechar={fechar}
        aoTerminarFechamento={() => setConteudoMontado(false)}
        titulo={titulo}
        descricao={descricao}
        largura={largura}
      >
        {/* Remontar a cada abertura zera o formulário: reabrir um cadastro e
            encontrar o que foi digitado antes é como se grava um dado errado
            sem perceber. */}
        {conteudoMontado ? children(fechar) : null}
      </Sidesheet>
    </>
  );
}
