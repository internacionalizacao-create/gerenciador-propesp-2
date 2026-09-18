"use client";

import { useEffect, useState } from "react";

import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import type {
  ItemCatalogo,
  LinhaPlano,
  ReferenciasPlano,
  RegistroAuditoriaPlano,
} from "@/lib/dominio";
import { FormLinhaPlano } from "./form-linha-plano";

export function AcoesLinhaPlano({
  programa,
  ciclo,
  cicloStatus,
  linha,
  ppgs,
  areas,
  catalogo,
  anos,
  anoInicial,
  podeEditar,
}: {
  programa: string;
  ciclo: string;
  cicloStatus: "PLANEJAMENTO" | "VIGENTE" | "ENCERRADO";
  linha: LinhaPlano;
  ppgs: ReferenciasPlano["ppgs"];
  areas: {
    id: string;
    codigo: string;
    nome: string;
    rede: string;
    ppgIds: string[];
  }[];
  catalogo: ItemCatalogo[];
  anos: number[];
  anoInicial: number;
  podeEditar: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {podeEditar && cicloStatus !== "ENCERRADO" ? (
        <AbrirSidesheet
          rotulo="Editar"
          variante="secundaria"
          titulo={`Editar ${linha.codigo}`}
          descricao="Código e rubrica permanecem imutáveis. Toda alteração fica registrada."
          largura="larga"
        >
          {(fechar) => (
            <FormLinhaPlano
              programa={programa}
              ciclo={ciclo}
              cicloStatus={cicloStatus}
              linha={linha}
              ppgs={ppgs}
              areas={areas}
              catalogo={catalogo}
              anos={anos}
              anoInicial={anoInicial}
              aoConcluir={fechar}
            />
          )}
        </AbrirSidesheet>
      ) : null}

      <AbrirSidesheet
        rotulo="Histórico"
        variante="secundaria"
        titulo={`Histórico de ${linha.codigo}`}
        descricao="Alterações registradas com autoria, data e valores anteriores."
      >
        {() => (
          <HistoricoLinha
            caminho={`/api/bff/programas/${programa}/${ciclo}/plano/${linha.id}/historico`}
          />
        )}
      </AbrirSidesheet>
    </div>
  );
}

function HistoricoLinha({ caminho }: { caminho: string }) {
  const [registros, setRegistros] = useState<RegistroAuditoriaPlano[] | null>(
    null,
  );
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();

    fetch(caminho, { signal: controlador.signal })
      .then(async (resposta) => {
        if (!resposta.ok)
          throw new Error("Não foi possível carregar o histórico.");
        return (await resposta.json()) as RegistroAuditoriaPlano[];
      })
      .then(setRegistros)
      .catch((falha: unknown) => {
        if (falha instanceof DOMException && falha.name === "AbortError")
          return;
        setErro(
          falha instanceof Error
            ? falha.message
            : "Não foi possível carregar o histórico.",
        );
      });

    return () => controlador.abort();
  }, [caminho]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      {erro ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
        >
          {erro}
        </p>
      ) : registros === null ? (
        <p className="text-sm text-muted">Carregando histórico…</p>
      ) : registros.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong p-8 text-center">
          <p className="font-medium text-foreground">
            Nenhuma edição registrada
          </p>
          <p className="mt-2 text-sm text-muted">
            O registro ainda conserva os valores originais.
          </p>
        </div>
      ) : (
        <ol className="space-y-4">
          {registros.map((registro) => (
            <li
              key={registro.id}
              className="rounded-2xl border border-border bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {ROTULOS_CAMPOS[registro.campo ?? ""] ??
                    registro.campo ??
                    "Registro"}
                </p>
                <time
                  className="text-xs text-subtle"
                  dateTime={registro.ocorridoEm}
                >
                  {new Intl.DateTimeFormat("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(registro.ocorridoEm))}
                </time>
              </div>
              <p className="mt-1 text-xs text-muted">
                {registro.usuarioNome ?? "Usuário não identificado"}
              </p>
              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-danger-soft px-3 py-2">
                  <dt className="font-medium text-on-danger-soft">Anterior</dt>
                  <dd className="mt-1 break-words text-on-danger-soft">
                    {registro.valorAnterior ?? "—"}
                  </dd>
                </div>
                <div className="rounded-lg bg-success-soft px-3 py-2">
                  <dt className="font-medium text-on-success-soft">Novo</dt>
                  <dd className="mt-1 break-words text-on-success-soft">
                    {registro.valorNovo ?? "—"}
                  </dd>
                </div>
              </dl>
              {registro.justificativa ? (
                <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted">
                  <strong className="text-foreground">Justificativa:</strong>{" "}
                  {registro.justificativa}
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const ROTULOS_CAMPOS: Record<string, string> = {
  areaTematicaId: "Área temática",
  ppgId: "PPG",
  descricao: "Descrição",
  quantidadeAnual: "Quantidade anual",
  anoPlanejamento: "Exercício",
  mesImplementacao: "Mês de implementação",
  textoFonte: "Texto-fonte",
  destino: "Destino",
  modalidadeId: "Modalidade",
  vigenciaMeses: "Vigência",
  itemCatalogoId: "Item do catálogo",
  fluxo: "Fluxo IN/OUT",
  tipoDespesa: "Tipo de despesa",
  tipoMissao: "Tipo de missão",
  numeroParticipantes: "Número de participantes",
  numeroDiarias: "Número de diárias",
  incluiPassagem: "Inclui passagem",
  valorUnitarioInformado: "Valor unitário estimado",
  justificativaEstimativa: "Justificativa da estimativa",
  status: "Situação da linha",
};
