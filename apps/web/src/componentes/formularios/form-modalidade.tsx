"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { atualizarModalidade, criarModalidade } from "@/acoes/catalogo";
import { Botao } from "@/componentes/ui/botao";
import { Marcador, Selecao, Texto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type { Modalidade } from "@/lib/dominio";
import {
  formularioModalidadeSchema,
  type DadosFormularioModalidade,
} from "@/lib/formularios/catalogo";

const CAMPOS_DA_API = {
  nome: "nome",
  publicoAlvo: "publicoAlvo",
  ativa: "ativa",
} as const;

const PUBLICOS = [
  { valor: "AMBOS", texto: "Docentes e discentes" },
  { valor: "DOCENTE", texto: "Docentes" },
  { valor: "DISCENTE", texto: "Discentes" },
  { valor: "POS_DOC", texto: "Pós-doutorado" },
];

export function NovaModalidade() {
  return (
    <AbrirSidesheet
      rotulo="Nova modalidade"
      titulo="Cadastrar modalidade"
      descricao="A modalidade só passa a valer no plano depois que o catálogo tiver um item com o valor dela — é o item que dá o preço (RN-01)."
    >
      {(fechar) => <FormModalidade aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

export function EditarModalidade({ modalidade }: { modalidade: Modalidade }) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar ${modalidade.nome}`}
      descricao="Os destinos cobertos são derivados do catálogo e não se editam aqui. Não há exclusão: desmarque “ativa” para tirar de circulação."
    >
      {(fechar) => (
        <FormModalidade modalidade={modalidade} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormModalidade({
  modalidade,
  aoConcluir,
}: {
  modalidade?: Modalidade;
  aoConcluir: () => void;
}) {
  const acao = modalidade
    ? atualizarModalidade.bind(null, modalidade.id)
    : criarModalidade;
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioModalidade>({
    resolver: zodResolver(formularioModalidadeSchema),
    defaultValues: {
      nome: modalidade?.nome ?? "",
      publicoAlvo: modalidade?.publicoAlvo ?? "AMBOS",
      ativa: modalidade?.ativa ?? true,
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Texto
          rotulo="Nome"
          nome="nome"
          obrigatorio
          placeholder="Doutorado Sanduíche"
          registro={register("nome")}
          erro={errors.nome?.message}
        />

        <Selecao
          rotulo="Público-alvo"
          nome="publicoAlvo"
          obrigatorio
          opcoes={PUBLICOS}
          registro={register("publicoAlvo")}
          erro={errors.publicoAlvo?.message}
        />

        <Marcador
          rotulo="Modalidade ativa"
          nome="ativa"
          dica="Inativa deixa de aceitar item de catálogo novo; o que já existe continua valendo."
          registro={register("ativa")}
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
          <Botao
            type="button"
            onClick={aoConcluir}
            variante="fantasma"
            tamanho="pequeno"
          >
            Cancelar
          </Botao>
          <Botao
            type="submit"
            disabled={enviando}
            tamanho="pequeno"
          >
            {enviando
              ? "Salvando…"
              : modalidade
                ? "Salvar alterações"
                : "Cadastrar"}
          </Botao>
        </div>
      </div>
    </form>
  );
}
