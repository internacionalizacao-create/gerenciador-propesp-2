"use client";

import { useActionState } from "react";

import {
  dispensarRequisito,
  encerrarMissao,
  revogarDispensa,
} from "@/acoes/encerramento";
import { AreaTexto } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";

/**
 * Ações do encerramento da missão (CG-058).
 *
 * Encerrar mexe na dimensão de **execução**; enviar e decidir mexem na de
 * aprovação (CG-006). Os dois eixos continuam separados — uma missão aprovada
 * pode não estar encerrada, e uma encerrada pode ter sido reprovada.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

/**
 * Encerramento.
 *
 * O botão não é desabilitado quando falta requisito: quem decide é a API, e
 * desabilitar esconderia o motivo. A recusa vem com a lista de pendências, que
 * aparece logo abaixo — é ela que diz o que resolver.
 */
export function EncerrarMissao({ contexto }: { contexto: Contexto }) {
  const [estado, executar, enviando] = useActionState(
    encerrarMissao.bind(null, contexto),
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
          {enviando ? "Encerrando…" : "Encerrar missão"}
        </button>
      </form>

      {!estado.ok && estado.pendencias && estado.pendencias.length > 0 ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border-l-4 border-warning bg-warning-soft px-4 py-3 text-sm text-on-warning-soft"
        >
          <p className="font-semibold">Falta resolver antes de encerrar</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {estado.pendencias.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <NotaDeErro estado={estado} />
    </div>
  );
}

/**
 * Dispensa de um requisito.
 *
 * Vale só para esta missão, por decisão de 2026-09-06: dispensa por tipo seria
 * mudança de política disfarçada de exceção — passaria a valer para toda missão
 * futura sem passar por onde a política mora.
 */
export function DispensarRequisito({
  contexto,
  chave,
  titulo,
}: {
  contexto: Contexto;
  chave: string;
  titulo: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Dispensar"
      variante="secundaria"
      titulo={`Dispensar: ${titulo}`}
      descricao="A dispensa vale só para esta missão e fica no histórico com autor e justificativa. O requisito continua constando como não cumprido."
    >
      {(fechar) => (
        <FormJustificativa
          acao={dispensarRequisito.bind(null, { ...contexto, chave })}
          aoConcluir={fechar}
          rotulo="Dispensar"
          rotuloCampo="Motivo da dispensa"
          dica="Por que esta missão pode encerrar sem cumprir este requisito."
        />
      )}
    </AbrirSidesheet>
  );
}

/** Revogação. A linha não é apagada: ela explica por que a missão pôde fechar. */
export function RevogarDispensa({
  contexto,
  chave,
  titulo,
}: {
  contexto: Contexto;
  chave: string;
  titulo: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Revogar dispensa"
      variante="secundaria"
      titulo={`Revogar dispensa: ${titulo}`}
      descricao="O requisito volta a bloquear o encerramento. A dispensa anterior permanece no histórico."
    >
      {(fechar) => (
        <FormJustificativa
          acao={revogarDispensa.bind(null, { ...contexto, chave })}
          aoConcluir={fechar}
          rotulo="Revogar"
          rotuloCampo="Motivo da revogação"
          dica="O que mudou desde a dispensa."
        />
      )}
    </AbrirSidesheet>
  );
}

function FormJustificativa({
  acao,
  aoConcluir,
  rotulo,
  rotuloCampo,
  dica,
}: {
  acao: (
    anterior: EstadoDaAcao,
    formulario: FormData,
  ) => Promise<EstadoDaAcao>;
  aoConcluir: () => void;
  rotulo: string;
  rotuloCampo: string;
  dica: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <AreaTexto
          rotulo={rotuloCampo}
          nome="justificativa"
          obrigatorio
          linhas={4}
          dica={dica}
          erro={
            estado.erros?.find((erro) => erro.campo === "justificativa")
              ?.mensagem
          }
        />
        <NotaDeErro estado={estado} />
      </div>
      <RodapeDoPainel
        aoCancelar={aoConcluir}
        enviando={enviando}
        rotulo={rotulo}
        rotuloEnviando="Registrando…"
      />
    </form>
  );
}

function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;
  // Quando há pendências, elas já explicam melhor do que a frase genérica.
  if (estado.pendencias && estado.pendencias.length > 0) return null;

  return (
    <p
      role="alert"
      className="mt-3 rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}
