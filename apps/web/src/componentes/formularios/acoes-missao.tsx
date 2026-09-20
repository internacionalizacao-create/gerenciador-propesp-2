"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, startTransition } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import {
  cancelarMissao,
  confirmarMissao,
  reabrirExecucaoDaMissao,
} from "@/acoes/missao";
import { AreaTexto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";

/**
 * Ciclo de vida da execução da missão (V1-030).
 *
 * Todas aqui mexem no eixo de **execução** — o que aconteceu com a viagem. O
 * eixo da aprovação (enviar, decidir, reabrir análise) vive em
 * `acoes-analise.tsx`, e os dois são independentes desde a CG-006.
 *
 * Nenhuma destas telas reimplementa a regra de quando a ação é possível: a
 * página esconde o botão no estado errado, e quem chamar a rota direto recebe
 * 409 da API. Duas cópias da mesma regra divergem na primeira mudança.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

/**
 * Confirmação: a missão deixa de ser plano e passa a viagem contratada.
 *
 * Sem justificativa, de propósito — confirmar é seguir o que já foi planejado,
 * e pedir motivo para o caminho normal treina todo mundo a escrever "ok".
 */
export function ConfirmarMissao({ contexto }: { contexto: Contexto }) {
  const [estado, executar, enviando] = useActionState(
    confirmarMissao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <form onSubmit={(evento) => submeterSemLimpar(evento, executar)}>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {enviando ? "Confirmando…" : "Confirmar missão"}
      </button>
      {!estado.ok && estado.mensagem ? (
        <p role="alert" className="mt-2 text-sm text-danger">
          {estado.mensagem}
        </p>
      ) : null}
    </form>
  );
}

const cancelamentoSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(10, "Explique por que a missão não vai acontecer.")
    .max(2000),
});

/**
 * Cancelamento.
 *
 * **A justificativa é obrigatória**, e a API a exige também: é a única saída
 * que encerra a missão sem que ela tenha acontecido, e o motivo é o que explica
 * o buraco no histórico anos depois.
 *
 * O texto avisa que **nada é apagado** — documentos, despesas e relato
 * continuam onde estão. Sem esse aviso, "cancelar" lê como "excluir", e quem
 * hesita em perder o que já anexou acaba deixando a missão aberta para sempre.
 */
export function CancelarMissao({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Cancelar missão"
      variante="secundaria"
      titulo="Cancelar missão"
      descricao="A missão passa a constar como cancelada. Documentos, despesas e o que já foi relatado continuam registrados — o cancelamento não apaga nada."
    >
      {(fechar) => (
        <FormJustificativa
          acao={cancelarMissao.bind(null, contexto)}
          esquema={cancelamentoSchema}
          aoConcluir={fechar}
          rotulo="Cancelar missão"
          rotuloCampo="Motivo do cancelamento"
          dica="Por que a missão não vai acontecer."
        />
      )}
    </AbrirSidesheet>
  );
}

const reaberturaSchema = z.object({
  justificativa: z
    .string()
    .trim()
    .min(10, "Informe a justificativa administrativa da reabertura.")
    .max(2000),
});

/**
 * Reabertura da **execução** — não da análise.
 *
 * O vizinho `.../analise/reabertura` reabre a decisão do Comitê (CG-038), e os
 * dois caminhos diferem por uma palavra no meio da URL. Por isso o rótulo aqui
 * diz "execução" por extenso: numa tela que tem os dois, "reabrir" sozinho não
 * distingue qual dos dois eixos volta atrás.
 *
 * É operação administrativa, fora do fluxo normal: desfazer um encerramento
 * precisa dizer quem autorizou e por quê.
 */
export function ReabrirExecucao({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Reabrir execução"
      variante="secundaria"
      titulo="Reabrir a execução da missão"
      descricao="Volta a missão para confirmada, permitindo relato e prestação de novo. Não altera a decisão do Comitê — para isso, use a reabertura da análise."
    >
      {(fechar) => (
        <FormJustificativa
          acao={reabrirExecucaoDaMissao.bind(null, contexto)}
          esquema={reaberturaSchema}
          aoConcluir={fechar}
          rotulo="Reabrir execução"
          rotuloCampo="Justificativa administrativa"
          dica="Quem autorizou a reabertura e por quê."
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Os dois esquemas tem a mesma forma e mensagens diferentes: o tipo concreto
 * serve aos dois, e `z.ZodType<...>` nao serviria — ele perde o tipo de
 * entrada, que o `zodResolver` precisa.
 */
type EsquemaJustificativa = typeof cancelamentoSchema;
type DadosJustificativa = z.infer<EsquemaJustificativa>;

/**
 * Formulário de uma justificativa só, em React Hook Form (§7 do AGENTS).
 *
 * Existe uma versão em `FormData` nos arquivos do encerramento e do parceiro.
 * Esta não a substitui: a convenção manda migrar o legado **quando ele for
 * alterado**, e nenhum deles está sendo. O que ela evita é nascer legado.
 */
function FormJustificativa({
  acao,
  esquema,
  aoConcluir,
  rotulo,
  rotuloCampo,
  dica,
}: {
  acao: (
    anterior: EstadoDaAcao,
    dados: DadosJustificativa,
  ) => Promise<EstadoDaAcao>;
  esquema: EsquemaJustificativa;
  aoConcluir: () => void;
  rotulo: string;
  rotuloCampo: string;
  dica: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosJustificativa>({
    resolver: zodResolver(esquema),
    defaultValues: { justificativa: "" },
  });
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, { justificativa: "justificativa" });

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <AreaTexto
          rotulo={rotuloCampo}
          nome="justificativa"
          obrigatorio
          linhas={5}
          registro={register("justificativa")}
          erro={errors.justificativa?.message}
          dica={dica}
        />
      </div>
      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo={rotulo}
      />
    </form>
  );
}
