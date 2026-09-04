"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { atualizarContato, criarContato } from "@/acoes/parceiros";
import {
  AreaTexto,
  Grade,
  Marcador,
  Selecao,
  Texto,
} from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type CandidatoDuplicidade } from "@/lib/acao-tipos";
import type { ContatoParceiro } from "@/lib/dominio";
import {
  formularioContatoSchema,
  type DadosFormularioContato,
} from "@/lib/formularios/parceiros";

import { motivoLegivel } from "./form-parceiro";

interface Contexto {
  instituicaoId: string;
  paises: { id: string; nome: string }[];
}

const CAMPOS_DA_API = {
  nome: "nome",
  cargo: "cargo",
  departamento: "departamento",
  area: "area",
  email: "email",
  telefone: "telefone",
  paisId: "paisId",
  idiomaComunicacao: "idiomaComunicacao",
  observacoes: "observacoes",
} as const;

export function NovoContato(props: Contexto) {
  return (
    <AbrirSidesheet
      rotulo="Novo contato"
      titulo="Cadastrar contato"
      descricao="O contato pertence à instituição e pode ser usado por várias missões, sem copiar seus dados para cada uma."
    >
      {(fechar) => <FormContato {...props} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

export function EditarContato({
  contato,
  ...contexto
}: Contexto & { contato: ContatoParceiro }) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar ${contato.nome}`}
      descricao="As missões que já citam este contato continuam apontando para ele."
    >
      {(fechar) => (
        <FormContato {...contexto} contato={contato} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormContato({
  instituicaoId,
  paises,
  contato,
  aoConcluir,
}: Contexto & { contato?: ContatoParceiro; aoConcluir: () => void }) {
  const acao = contato
    ? atualizarContato.bind(null, { id: contato.id, instituicaoId })
    : criarContato.bind(null, instituicaoId);
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<DadosFormularioContato>({
    resolver: zodResolver(formularioContatoSchema),
    defaultValues: {
      nome: contato?.nome ?? "",
      cargo: contato?.cargo ?? "",
      departamento: contato?.departamento ?? "",
      area: contato?.area ?? "",
      email: contato?.email ?? "",
      telefone: contato?.telefone ?? "",
      paisId: contato?.paisId ?? "",
      idiomaComunicacao: contato?.idiomaComunicacao ?? "",
      observacoes: contato?.observacoes ?? "",
      principal: contato?.principal ?? false,
      confirmarPossivelDuplicidade: false,
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const erroDe = (campo: keyof DadosFormularioContato) =>
    errors[campo]?.message;

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  const candidatos = estado.candidatos ?? [];
  const bloqueado = candidatos.some(
    (item) => item.classificacao === "INEQUIVOCA",
  );

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {candidatos.length > 0 ? (
          <AlertaContatoDuplicado
            candidatos={candidatos}
            bloqueado={bloqueado}
            aoConfirmar={() => {
              setValue("confirmarPossivelDuplicidade", true);
              void aoEnviar();
            }}
          />
        ) : null}

        <Texto
          rotulo="Nome"
          nome="nome"
          obrigatorio
          registro={register("nome")}
          erro={erroDe("nome")}
        />

        <Grade>
          <Texto
            rotulo="Cargo"
            nome="cargo"
            registro={register("cargo")}
            erro={erroDe("cargo")}
          />
          <Texto
            rotulo="Departamento"
            nome="departamento"
            registro={register("departamento")}
            erro={erroDe("departamento")}
          />
        </Grade>

        <Grade>
          <Texto
            rotulo="E-mail"
            nome="email"
            registro={register("email")}
            erro={erroDe("email")}
          />
          <Texto
            rotulo="Telefone"
            nome="telefone"
            registro={register("telefone")}
            erro={erroDe("telefone")}
          />
        </Grade>

        <Grade>
          <Texto
            rotulo="Área"
            nome="area"
            registro={register("area")}
            erro={erroDe("area")}
          />
          <Texto
            rotulo="Idioma de comunicação"
            nome="idiomaComunicacao"
            placeholder="Inglês, espanhol…"
            registro={register("idiomaComunicacao")}
            erro={erroDe("idiomaComunicacao")}
          />
        </Grade>

        <Selecao
          rotulo="País"
          nome="paisId"
          vazio="Selecione"
          registro={register("paisId")}
          opcoes={paises.map((pais) => ({ valor: pais.id, texto: pais.nome }))}
          erro={erroDe("paisId")}
        />

        <Marcador
          rotulo="Contato principal da instituição"
          nome="principal"
          dica="Só um contato ativo pode ser o principal; marcar aqui substitui o atual."
          registro={register("principal")}
        />

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          registro={register("observacoes")}
          erro={erroDe("observacoes")}
        />
      </div>

      <div className="shrink-0 border-t border-border bg-surface-muted px-6 py-4">
        {!estado.ok && estado.mensagem && candidatos.length === 0 ? (
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
            {enviando
              ? "Salvando…"
              : contato
                ? "Salvar contato"
                : "Cadastrar contato"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Homônimo dentro da mesma instituição é caso real, então nome igual sozinho
 * não bloqueia: a API classifica como `POSSIVEL` e devolve para confirmação.
 * Já e-mail repetido é `INEQUIVOCA` e não tem confirmação que passe.
 */
function AlertaContatoDuplicado({
  candidatos,
  bloqueado,
  aoConfirmar,
}: {
  candidatos: CandidatoDuplicidade[];
  bloqueado: boolean;
  aoConfirmar: () => void;
}) {
  return (
    <div
      role="alert"
      className={`mb-5 rounded-xl border px-4 py-3 ${
        bloqueado
          ? "border-danger bg-danger-soft text-on-danger-soft"
          : "border-warning bg-warning-soft text-on-warning-soft"
      }`}
    >
      <p className="text-sm font-medium">
        {bloqueado
          ? "Este contato já existe nesta instituição."
          : "Encontramos contatos parecidos nesta instituição."}
      </p>
      <p className="mt-1 text-xs">
        {bloqueado
          ? "Edite o contato existente em vez de criar outro."
          : "Se for outra pessoa — homônimos acontecem —, confirme abaixo."}
      </p>
      <ul className="mt-3 space-y-2">
        {candidatos.map((candidato) => (
          <li
            key={candidato.id}
            className="rounded-lg bg-surface px-3 py-2 text-foreground"
          >
            <span className="text-sm font-medium">{candidato.nome}</span>
            <span className="block text-xs text-subtle">
              {candidato.email ?? "sem e-mail"} ·{" "}
              {candidato.motivos.map(motivoLegivel).join(" · ")}
              {candidato.ativo ? "" : " · contato inativo"}
            </span>
          </li>
        ))}
      </ul>
      {bloqueado ? null : (
        <button
          type="button"
          onClick={aoConfirmar}
          className="mt-3 rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          É outra pessoa — cadastrar assim mesmo
        </button>
      )}
    </div>
  );
}
