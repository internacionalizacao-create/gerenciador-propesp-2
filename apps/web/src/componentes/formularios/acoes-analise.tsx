"use client";

import { useActionState, useState } from "react";

import {
  decidirMissao,
  reabrirAnalise,
  submeterMissao,
} from "@/acoes/analise";
import { AreaTexto, Data, Selecao } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";

/**
 * Ações da análise da missão (CG-037 e CG-038).
 *
 * Enviar, decidir e reabrir mexem só na dimensão de **aprovação**. A de
 * execução — planejada, confirmada, concluída — tem ações próprias e continua
 * separada: são eixos independentes (CG-006).
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

/**
 * Envio para análise.
 *
 * O botão fica habilitado mesmo com documento faltando: a API é quem decide, e
 * desabilitar aqui esconderia o motivo. Quando ela recusa (422), a lista de
 * pendências aparece logo abaixo — é o que diz o que anexar.
 */
export function EnviarParaAnalise({ contexto }: { contexto: Contexto }) {
  const [estado, executar, enviando] = useActionState(
    submeterMissao.bind(null, contexto),
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
          {enviando ? "Enviando…" : "Enviar para análise"}
        </button>
      </form>

      {!estado.ok && estado.pendencias && estado.pendencias.length > 0 ? (
        <div
          role="alert"
          className="mt-3 rounded-xl border-l-4 border-warning bg-warning-soft px-4 py-3 text-sm text-on-warning-soft"
        >
          <p className="font-semibold">Faltam documentos obrigatórios</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {estado.pendencias.map((pendencia) => (
              <li key={pendencia}>{pendencia}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Decisão do Comitê sobre a rodada aberta.
 *
 * O campo da reunião aparece só em aprovar e reprovar. Solicitar ajustes é ato
 * do relator, não deliberação do colegiado — registrar uma reunião ali
 * afirmaria uma sessão que não decidiu nada. A API recusa a combinação errada
 * de qualquer forma; esconder o campo evita que a pessoa a construa.
 */
export function DecidirMissao({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Registrar decisão"
      titulo="Decisão do Comitê Gestor"
      descricao="O parecer entra no histórico com autor e data, e os documentos analisados ficam registrados como estão agora. Nenhuma decisão anterior é apagada."
    >
      {(fechar) => <FormDecisao contexto={contexto} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormDecisao({
  contexto,
  aoConcluir,
}: {
  contexto: Contexto;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    decidirMissao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  const [acao, setAcao] = useState("APROVAR");
  useToastDaAcao(estado, aoConcluir);

  const exigeReuniao = acao !== "SOLICITAR_AJUSTES";

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <Selecao
          rotulo="Decisão"
          nome="acao"
          obrigatorio
          padrao="APROVAR"
          aoMudar={setAcao}
          opcoes={[
            { valor: "APROVAR", texto: "Aprovar" },
            { valor: "SOLICITAR_AJUSTES", texto: "Solicitar ajustes" },
            { valor: "REPROVAR", texto: "Reprovar" },
          ]}
          dica={
            acao === "SOLICITAR_AJUSTES"
              ? "A missão volta a ser editável pelo responsável e uma rodada nova nasce quando ele reenviar."
              : "Encerra a análise. Reabrir depois é ato do administrador, e não apaga esta decisão."
          }
        />

        {exigeReuniao ? (
          <Data
            rotulo="Data da reunião"
            nome="reuniaoData"
            obrigatorio
            dica="Reunião em que o Comitê deliberou. Não pode estar no futuro — as reuniões são semanais, mas há semanas sem reunião, então a data é informada e não calculada."
          />
        ) : null}

        <AreaTexto
          rotulo="Parecer"
          nome="parecer"
          obrigatorio
          linhas={5}
          dica="Obrigatório inclusive ao aprovar: um histórico que diz “aprovada” sem dizer por quê é o registro que a auditoria cobra."
        />

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          dica="Opcional. Encaminhamentos internos que não fazem parte do parecer."
        />

        <NotaDeErro estado={estado} />
      </div>

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
          {enviando ? "Registrando…" : "Registrar decisão"}
        </button>
      </div>
    </form>
  );
}

/**
 * Reabertura administrativa da análise.
 *
 * Cria rodada nova em vez de reverter a anterior. A decisão original continua
 * no histórico — é a garantia que o banco fixa desde a CG-019.
 */
export function ReabrirAnalise({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Reabrir análise"
      variante="secundaria"
      titulo="Reabrir análise da missão"
      descricao="A decisão anterior permanece no histórico: reabrir cria uma rodada nova, não desfaz o que foi registrado."
    >
      {(fechar) => <FormReabertura contexto={contexto} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormReabertura({
  contexto,
  aoConcluir,
}: {
  contexto: Contexto;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    reabrirAnalise.bind(null, contexto),
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
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={5}
          dica="Por que a decisão precisa ser reexaminada. Fica na rodada nova e no histórico."
        />
        <NotaDeErro estado={estado} />
      </div>

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
          {enviando ? "Reabrindo…" : "Reabrir análise"}
        </button>
      </div>
    </form>
  );
}

/**
 * Erro que não pertence a campo nenhum — conflito de estado, permissão.
 *
 * Fica dentro do formulário e não no toast: o toast some, e a pessoa precisa
 * ver o motivo enquanto decide o que fazer com o que já digitou.
 */
function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;

  return (
    <p
      role="alert"
      className="rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}
