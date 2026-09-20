"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useActionState } from "react";

import {
  conciliarParceiro,
  definirContatoPrincipal,
  inativarContato,
  inativarParceiro,
  reativarContato,
} from "@/acoes/parceiros";
import { AreaTexto, Selecao } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { ContatoParceiro, Parceiro } from "@/lib/dominio";

/**
 * Ações de ciclo de vida de parceiro e contato (CG-049).
 *
 * Nenhuma delas apaga registro: a API não expõe exclusão porque a atividade da
 * missão referencia o `id` central. Inativar e reativar exigem justificativa,
 * que vai para a trilha de auditoria — a mesma trilha que, no caso dos
 * contatos, guarda quais campos mudaram e nunca os valores pessoais.
 */

export function InativarParceiroBotao({ parceiro }: { parceiro: Parceiro }) {
  return (
    <AbrirSidesheet
      rotulo="Inativar"
      variante="secundaria"
      titulo={`Inativar ${parceiro.nome}`}
      descricao="O cadastro deixa de aparecer na lista padrão, mas continua no histórico das missões que já o citam."
    >
      {(fechar) => (
        <FormJustificativa
          acao={inativarParceiro.bind(null, parceiro.id)}
          aoConcluir={fechar}
          rotuloEnvio="Inativar parceiro"
          dica="Explique por que o cadastro não deve mais ser usado. Se for duplicidade, prefira a conciliação: ela transfere contatos e missões."
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Conciliação de dois cadastros do mesmo parceiro (CG-025).
 *
 * A escolha é assimétrica de propósito: **este** cadastro é a origem e vira o
 * inativo; o escolhido é o que sobrevive. A tela diz isso com todas as letras
 * porque a operação transfere relacionamentos e não tem desfazer — embora
 * também não apague nada, o que permite auditar depois.
 */
export function ConciliarParceiroBotao({
  parceiro,
  candidatos,
}: {
  parceiro: Parceiro;
  candidatos: Parceiro[];
}) {
  if (candidatos.length === 0) return null;

  return (
    <AbrirSidesheet
      rotulo="Conciliar"
      variante="secundaria"
      titulo={`Conciliar ${parceiro.nome}`}
      descricao="Use quando dois cadastros representam a mesma instituição."
    >
      {(fechar) => (
        <FormConciliacao
          parceiro={parceiro}
          candidatos={candidatos}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormConciliacao({
  parceiro,
  candidatos,
  aoConcluir,
}: {
  parceiro: Parceiro;
  candidatos: Parceiro[];
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    conciliarParceiro.bind(null, parceiro.id),
    ESTADO_INICIAL,
  );
  const consultas = useQueryClient();
  useToastDaAcao(estado, () => {
    void consultas.invalidateQueries({ queryKey: ["parceiros"] });
    aoConcluir();
  });

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mb-5 rounded-xl border border-warning bg-warning-soft px-4 py-3 text-sm text-on-warning-soft">
          <p className="font-medium">
            {parceiro.nome} deixará de ser o cadastro usado.
          </p>
          <p className="mt-1 text-xs">
            Redes, contatos, atividades de missão, pessoas e documentos passam
            para o cadastro escolhido, e este aqui fica inativo apontando para
            ele. Nada é apagado, mas não há desfazer automático.
          </p>
        </div>

        <Selecao
          rotulo="Cadastro que permanece"
          nome="destinoId"
          obrigatorio
          vazio="Selecione o cadastro correto"
          opcoes={candidatos.map((candidato) => ({
            valor: candidato.id,
            texto: `${candidato.nome}${candidato.sigla ? ` (${candidato.sigla})` : ""}`,
          }))}
          dica="Só cadastros ativos aparecem aqui: o destino da conciliação precisa estar ativo."
        />

        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={4}
          dica="Registre por que os dois cadastros são a mesma instituição. A justificativa vai para a auditoria."
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
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {enviando ? "Conciliando…" : "Conciliar cadastros"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function AcoesDoContato({
  contato,
  instituicaoId,
}: {
  contato: ContatoParceiro;
  instituicaoId: string;
}) {
  const contexto = { id: contato.id, instituicaoId };

  if (!contato.ativo) {
    return (
      <AbrirSidesheet
        rotulo="Reativar"
        variante="secundaria"
        titulo={`Reativar ${contato.nome}`}
        descricao="A reativação não devolve a condição de contato principal — se for o caso, defina-a depois."
      >
        {(fechar) => (
          <FormJustificativa
            acao={reativarContato.bind(null, contexto)}
            aoConcluir={fechar}
            rotuloEnvio="Reativar contato"
            dica="Registre por que o contato voltou a valer."
          />
        )}
      </AbrirSidesheet>
    );
  }

  return (
    <>
      {contato.principal ? null : (
        <DefinirPrincipal contato={contato} instituicaoId={instituicaoId} />
      )}
      <AbrirSidesheet
        rotulo="Inativar"
        variante="secundaria"
        titulo={`Inativar ${contato.nome}`}
        descricao="As missões que já citam este contato continuam intactas: inativar não apaga a referência."
      >
        {(fechar) => (
          <FormJustificativa
            acao={inativarContato.bind(null, contexto)}
            aoConcluir={fechar}
            rotuloEnvio="Inativar contato"
            dica="Explique o motivo — saída da instituição, troca de responsável, dado incorreto."
          />
        )}
      </AbrirSidesheet>
    </>
  );
}

/**
 * A troca do principal é atômica na API: promover um despromove o anterior
 * dentro da mesma transação. Por isso aqui não há passo de "desmarcar antes".
 */
function DefinirPrincipal({
  contato,
  instituicaoId,
}: {
  contato: ContatoParceiro;
  instituicaoId: string;
}) {
  const [estado, executar, enviando] = useActionState(
    definirContatoPrincipal.bind(null, { id: contato.id, instituicaoId }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <form onSubmit={(evento) => submeterSemLimpar(evento, executar)}>
      <button
        type="submit"
        disabled={enviando}
        title="Torna este o contato principal da instituição, substituindo o atual"
        className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-muted hover:text-foreground disabled:opacity-60"
      >
        {enviando ? "Definindo…" : "Tornar principal"}
      </button>
    </form>
  );
}

function FormJustificativa({
  acao,
  aoConcluir,
  rotuloEnvio,
  dica,
}: {
  acao: (
    anterior: EstadoDaAcao,
    formulario: FormData,
  ) => Promise<EstadoDaAcao>;
  aoConcluir: () => void;
  rotuloEnvio: string;
  dica: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const consultas = useQueryClient();
  useToastDaAcao(estado, () => {
    void consultas.invalidateQueries({ queryKey: ["parceiros"] });
    aoConcluir();
  });

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={4}
          dica={dica}
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
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={enviando}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
          >
            {enviando ? "Enviando…" : rotuloEnvio}
          </button>
        </div>
      </div>
    </form>
  );
}
