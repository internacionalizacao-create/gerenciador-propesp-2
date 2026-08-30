"use client";

import { useActionState } from "react";

import { atualizarOrcamento } from "@/acoes/orcamento";
import { AreaTexto, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { LinhaTematica } from "@/lib/dominio";

export function EditarOrcamento({
  programa,
  ciclo,
  linha,
}: {
  programa: string;
  ciclo: string;
  linha: LinhaTematica;
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`${linha.codigo} · orçamento de ${linha.ano}`}
      descricao="Registre somente o ato formal recebido. Totais, custos e saldos continuam calculados pelo sistema."
    >
      {(fechar) => (
        <Formulario
          programa={programa}
          ciclo={ciclo}
          linha={linha}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function Formulario({
  programa,
  ciclo,
  linha,
  aoConcluir,
}: {
  programa: string;
  ciclo: string;
  linha: LinhaTematica;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    atualizarOrcamento.bind(null, {
      programa,
      ciclo,
      id: linha.orcamentoId,
    }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  const erroDe = (campo: string) =>
    estado.erros?.find((erro) => erro.campo === campo)?.mensagem;

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <p className="mb-5 rounded-xl bg-info-soft px-4 py-3 text-sm text-on-info-soft">
          {linha.rede} · {linha.nome} · exercício {linha.ano}
        </p>

        <Texto
          rotulo="Orçamento de bolsas"
          nome="valorBolsas"
          tipo="number"
          passo="0.01"
          minimo="0"
          padrao={linha.valorBolsas ?? undefined}
          erro={erroDe("valorBolsas")}
        />
        <Grade>
          <Texto
            rotulo="Orçamento de manutenção"
            nome="valorManutencao"
            tipo="number"
            passo="0.01"
            minimo="0"
            padrao={linha.valorManutencao ?? undefined}
            erro={erroDe("valorManutencao")}
          />
          <Texto
            rotulo="Orçamento de missões"
            nome="valorMissoes"
            tipo="number"
            passo="0.01"
            minimo="0"
            padrao={linha.valorMissoes ?? undefined}
            erro={erroDe("valorMissoes")}
          />
        </Grade>
        <Grade>
          <Selecao
            rotulo="Situação do orçamento"
            nome="status"
            padrao={linha.statusOrcamento}
            opcoes={[
              { valor: "A_DEFINIR", texto: "A definir" },
              { valor: "DEFINIDO", texto: "Definido" },
            ]}
            erro={erroDe("status")}
          />
          <Selecao
            rotulo="Situação da composição anual"
            nome="statusComposicao"
            padrao={linha.statusComposicao}
            opcoes={[
              { valor: "A_DEFINIR", texto: "A definir" },
              { valor: "EM_ELABORACAO", texto: "Em elaboração" },
              { valor: "APROVADA", texto: "Aprovada" },
            ]}
            erro={erroDe("statusComposicao")}
          />
        </Grade>
        <Texto
          rotulo="Fonte ou ato formal"
          nome="fonte"
          obrigatorio
          padrao={linha.fonte ?? undefined}
          placeholder="Ofício, planilha ou decisão recebida"
          erro={erroDe("fonte")}
        />
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          padrao={linha.observacoes ?? undefined}
          erro={erroDe("observacoes")}
        />
        <AreaTexto
          rotulo="Justificativa da alteração"
          nome="justificativa"
          linhas={3}
          obrigatorio
          dica="A justificativa fica registrada junto de cada campo alterado."
          erro={erroDe("justificativa")}
        />
      </div>

      <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
        {!estado.ok && estado.mensagem ? (
          <p
            role="alert"
            className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-on-danger-soft"
          >
            {estado.mensagem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={aoConcluir}
            className="rounded-xl px-3 py-2 text-sm font-medium text-muted hover:bg-surface hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary shadow-sm hover:bg-primary-hover disabled:opacity-60"
          >
            {enviando ? "Salvando…" : "Salvar orçamento"}
          </button>
        </div>
      </div>
    </form>
  );
}
