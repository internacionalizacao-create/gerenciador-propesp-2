"use client";

import { useActionState } from "react";

import {
  devolverPrestacao,
  enviarPrestacao,
  validarPrestacao,
} from "@/acoes/prestacao";
import { AreaTexto } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";

/**
 * Envio e revisão da prestação (CG-054).
 *
 * Preparar e revisar são atos distintos — `prestacao:write` contra
 * `prestacao:review` —, mesmo enquanto só o `admin` tem as duas permissões. A
 * tela reflete a separação: quem envia não vê validar, e vice-versa.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

/**
 * Envio para revisão.
 *
 * O botão não é desabilitado quando falta despesa: quem decide é a API, e
 * desabilitar esconderia o motivo. A recusa chega no toast com a frase dela.
 */
export function EnviarPrestacao({
  contexto,
  reenvio,
}: {
  contexto: Contexto;
  reenvio?: boolean;
}) {
  const [estado, executar, enviando] = useActionState(
    enviarPrestacao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <div>
      <form onSubmit={(evento) => submeterSemLimpar(evento, executar)}>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {enviando
            ? "Enviando…"
            : reenvio
              ? "Reenviar para revisão"
              : "Enviar para revisão"}
        </button>
      </form>
      <NotaDeErro estado={estado} />
    </div>
  );
}

/**
 * Validação — o único ato que abate o aporte anual (CG-009).
 *
 * Fica atrás de um sidesheet, e não de um clique direto, porque é irreversível:
 * a prestação validada não aceita mais alteração nem devolução, e a tela
 * precisa dizer isso antes.
 */
export function ValidarPrestacao({
  contexto,
  total,
}: {
  contexto: Contexto;
  total: string | null;
}) {
  return (
    <AbrirSidesheet
      rotulo="Validar"
      titulo="Validar prestação de contas"
      descricao={
        total
          ? `Validar congela a prestação e faz o valor de R$ ${total} abater o aporte anual do Comitê. Não há desfazer.`
          : "Validar congela a prestação em definitivo. Não há desfazer."
      }
    >
      {(fechar) => <FormParecer contexto={contexto} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormParecer({
  contexto,
  aoConcluir,
}: {
  contexto: Contexto;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    validarPrestacao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <AreaTexto
          rotulo="Parecer"
          nome="parecer"
          linhas={4}
          dica="Opcional, mas fica no histórico. É o registro do que foi conferido."
        />
        <NotaDeErro estado={estado} />
      </div>
      <Rodape aoConcluir={aoConcluir} enviando={enviando} rotulo="Validar" />
    </form>
  );
}

/** Devolução com pendência; a prestação volta a aceitar lançamento. */
export function DevolverPrestacao({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Devolver"
      variante="secundaria"
      titulo="Devolver para correção"
      descricao="A prestação volta a aceitar lançamento e o responsável reenvia depois de corrigir."
    >
      {(fechar) => <FormDevolucao contexto={contexto} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormDevolucao({
  contexto,
  aoConcluir,
}: {
  contexto: Contexto;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    devolverPrestacao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <AreaTexto
          rotulo="Pendência"
          nome="parecer"
          obrigatorio
          linhas={4}
          dica="O que precisa ser corrigido. Devolver sem dizer o quê transforma a revisão em porta giratória."
          erro={estado.erros?.find((e) => e.campo === "parecer")?.mensagem}
        />
        <NotaDeErro estado={estado} />
      </div>
      <Rodape aoConcluir={aoConcluir} enviando={enviando} rotulo="Devolver" />
    </form>
  );
}

function Rodape({
  aoConcluir,
  enviando,
  rotulo,
}: {
  aoConcluir: () => void;
  enviando: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={aoConcluir}
        className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {enviando ? "Registrando…" : rotulo}
      </button>
    </div>
  );
}

function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;

  return (
    <p
      role="alert"
      className="mt-3 rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}
