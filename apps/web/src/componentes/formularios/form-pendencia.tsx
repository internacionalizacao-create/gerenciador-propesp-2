"use client";

import { useActionState, useEffect, useState } from "react";

import { atualizarPendencia, criarPendencia } from "@/acoes/pendencias";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import {
  AreaTexto,
  Grade,
  Selecao,
  Texto,
} from "@/componentes/ui/campos";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { Pendencia } from "@/lib/dominio";

/**
 * Pendências (P13).
 *
 * Este formulário **não** é multistep: são poucos campos e todos da mesma
 * natureza. Fatiar um formulário curto em etapas troca rolagem por cliques, o
 * que é pior — o multistep existe para o cadastro longo, não como padrão.
 */

const NIVEIS = [
  { valor: "ALTA", texto: "Alta" },
  { valor: "MEDIA", texto: "Média" },
  { valor: "BAIXA", texto: "Baixa" },
];

export function NovaPendencia({
  programa,
  ciclo,
}: {
  programa: string;
  ciclo: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Nova pendência"
      titulo="Registrar pendência"
      descricao="Uma decisão ou confirmação que trava parte do planejamento."
    >
      {(fechar) => (
        <FormNovaPendencia
          programa={programa}
          ciclo={ciclo}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormNovaPendencia({
  programa,
  ciclo,
  aoConcluir,
}: {
  programa: string;
  ciclo: string;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    criarPendencia.bind(null, { programa, ciclo }),
    ESTADO_INICIAL,
  );

  useEffect(() => {
    if (estado.ok) aoConcluir();
  }, [estado.ok, aoConcluir]);

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Texto
          rotulo="Assunto"
          nome="assunto"
          obrigatorio
          placeholder="Confirmar transferência do recurso à UEA"
        />
        <AreaTexto
          rotulo="Pendência ou decisão"
          nome="descricao"
          obrigatorio
          linhas={4}
          placeholder="Descreva o que precisa ser confirmado ou decidido, e com quem."
        />
        <AreaTexto
          rotulo="Impacto"
          nome="impacto"
          linhas={2}
          placeholder="O que fica travado enquanto isso não se resolve."
        />
        <Grade>
          <Selecao
            rotulo="Nível de impacto"
            nome="nivelImpacto"
            vazio="Não classificado"
            opcoes={NIVEIS}
          />
          <Selecao
            rotulo="Escopo"
            nome="escopoTipo"
            padrao="GERAL"
            opcoes={[
              { valor: "GERAL", texto: "Geral" },
              { valor: "REDE", texto: "Rede" },
              { valor: "AREA_TEMATICA", texto: "Área temática" },
              { valor: "PPG", texto: "PPG" },
            ]}
          />
        </Grade>
        <Texto
          rotulo="A que se refere"
          nome="escopoDescricao"
          placeholder="UNESP · UNESP-T1"
          dica="Rede, temática ou PPG a que a pendência se aplica."
        />
        <Grade>
          <Texto
            rotulo="Responsável sugerido"
            nome="responsavelSugerido"
            placeholder="PROPESP"
          />
          <Texto
            rotulo="Prazo ou momento"
            nome="prazoMomento"
            placeholder="Antes da assinatura do termo"
          />
        </Grade>
      </div>

      <Rodape
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo="Registrar"
      />
    </form>
  );
}

/** Mudança de status e resolução de uma pendência já existente. */
export function ResolverPendencia({ pendencia }: { pendencia: Pendencia }) {
  return (
    <AbrirSidesheet
      rotulo="Tratar"
      variante="secundaria"
      titulo={`${pendencia.codigo} · ${pendencia.assunto}`}
      descricao={pendencia.descricao}
    >
      {(fechar) => (
        <FormResolver pendencia={pendencia} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormResolver({
  pendencia,
  aoConcluir,
}: {
  pendencia: Pendencia;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    atualizarPendencia.bind(null, pendencia.id),
    ESTADO_INICIAL,
  );
  const [status, setStatus] = useState(pendencia.status);

  useEffect(() => {
    if (estado.ok) aoConcluir();
  }, [estado.ok, aoConcluir]);

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {pendencia.origem === "AUTOMATICA" ? (
          <p className="mb-5 rounded-lg bg-info-soft px-3 py-2 text-sm text-on-info-soft">
            Esta pendência foi detectada pelo sistema. Ela não pode ser excluída
            — só resolvida, dizendo o que foi feito. Apagar o alerta apagaria a
            evidência junto.
          </p>
        ) : null}

        <Selecao
          rotulo="Status"
          nome="status"
          padrao={pendencia.status}
          aoMudar={(valor) => setStatus(valor as Pendencia["status"])}
          opcoes={[
            { valor: "PENDENTE", texto: "Pendente" },
            { valor: "EM_ANALISE", texto: "Em análise" },
            { valor: "MONITORAR", texto: "Monitorar" },
            { valor: "RESOLVIDA", texto: "Resolvida" },
          ]}
        />

        <AreaTexto
          rotulo="Resolução"
          nome="resolucao"
          linhas={4}
          padrao={pendencia.resolucao ?? undefined}
          obrigatorio={status === "RESOLVIDA"}
          placeholder="O que foi decidido, por quem, com base em qual documento."
          dica={
            status === "RESOLVIDA"
              ? "Obrigatória. Resolver sem dizer como transformaria a lista num cemitério de itens “OK” que ninguém sabe explicar meses depois."
              : "Opcional enquanto a pendência não está resolvida."
          }
        />

        <Grade>
          <Selecao
            rotulo="Nível de impacto"
            nome="nivelImpacto"
            vazio="Não classificado"
            padrao={pendencia.nivelImpacto ?? ""}
            opcoes={NIVEIS}
          />
          <Texto
            rotulo="Responsável"
            nome="responsavelSugerido"
            padrao={pendencia.responsavelSugerido ?? undefined}
          />
        </Grade>
        <Texto
          rotulo="Prazo ou momento"
          nome="prazoMomento"
          padrao={pendencia.prazoMomento ?? undefined}
        />
      </div>

      <Rodape
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo="Salvar"
      />
    </form>
  );
}

function Rodape({
  enviando,
  erro,
  aoCancelar,
  rotulo,
}: {
  enviando: boolean;
  erro: string | null;
  aoCancelar: () => void;
  rotulo: string;
}) {
  return (
    <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
      {erro ? (
        <p
          role="alert"
          className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
        >
          {erro}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={aoCancelar}
          className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
        >
          {enviando ? "Salvando…" : rotulo}
        </button>
      </div>
    </div>
  );
}
