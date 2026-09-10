"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import { atualizarParceiro, criarParceiro } from "@/acoes/parceiros";
import {
  AreaTexto,
  Campo,
  Grade,
  Marcador,
  Selecao,
  Selecoes,
  Texto,
} from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type CandidatoDuplicidade } from "@/lib/acao-tipos";
import type { Parceiro, RedeDoParceiro } from "@/lib/dominio";
import {
  ESTAGIOS_RELACIONAMENTO,
  formularioParceiroSchema,
  ORIGENS_RELACIONAMENTO,
  type DadosFormularioParceiro,
} from "@/lib/formularios/parceiros";
import { rotulo } from "@/lib/formato";

interface Contexto {
  redes: RedeDoParceiro[];
  paises: { id: string; nome: string }[];
}

const CAMPOS_DA_API = {
  nome: "nome",
  sigla: "sigla",
  paisId: "paisId",
  cidade: "cidade",
  estadoRegiao: "estadoRegiao",
  tipoOrganizacao: "tipoOrganizacao",
  faculdadeDepartamento: "faculdadeDepartamento",
  site: "site",
  emailInstitucional: "emailInstitucional",
  telefone: "telefone",
  endereco: "endereco",
  observacoes: "observacoes",
  redeIds: "redeIds",
} as const;

export function NovoParceiro(props: Contexto) {
  return (
    <AbrirSidesheet
      rotulo="Novo parceiro"
      titulo="Cadastrar parceiro"
      descricao="Antes de cadastrar, use a busca da lista: o mesmo parceiro deve ser reutilizado por várias missões e redes."
    >
      {(fechar) => <FormParceiro {...props} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

export function EditarParceiro({
  parceiro,
  ...contexto
}: Contexto & { parceiro: Parceiro }) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar ${parceiro.nome}`}
      descricao="As missões continuam apontando para este mesmo cadastro."
    >
      {(fechar) => (
        <FormParceiro {...contexto} parceiro={parceiro} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormParceiro({
  redes,
  paises,
  parceiro,
  aoConcluir,
}: Contexto & { parceiro?: Parceiro; aoConcluir: () => void }) {
  const acao = parceiro
    ? atualizarParceiro.bind(null, parceiro.id)
    : criarParceiro;
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<DadosFormularioParceiro>({
    resolver: zodResolver(formularioParceiroSchema),
    defaultValues: {
      nome: parceiro?.nome ?? "",
      sigla: parceiro?.sigla ?? "",
      paisId: parceiro?.paisId ?? "",
      cidade: parceiro?.cidade ?? "",
      estadoRegiao: parceiro?.estadoRegiao ?? "",
      tipoOrganizacao: parceiro?.tipoOrganizacao ?? "",
      faculdadeDepartamento: parceiro?.faculdadeDepartamento ?? "",
      areasAtuacao: parceiro?.areasAtuacao ?? "",
      programaRelacionado: parceiro?.programaRelacionado ?? "",
      grupoPesquisa: parceiro?.grupoPesquisa ?? "",
      origemRelacionamento: parceiro?.origemRelacionamento ?? "",
      origemObservacao: parceiro?.origemObservacao ?? "",
      estagioRelacionamento: parceiro?.estagioRelacionamento ?? "IDENTIFICADA",
      site: parceiro?.site ?? "",
      emailInstitucional: parceiro?.emailInstitucional ?? "",
      telefone: parceiro?.telefone ?? "",
      endereco: parceiro?.endereco ?? "",
      observacoes: parceiro?.observacoes ?? "",
      cadastroProvisorio: parceiro?.cadastroProvisorio ?? false,
      redeIds: parceiro?.redes.map((rede) => rede.id) ?? [],
      confirmarPossivelDuplicidade: false,
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const erroDe = (campo: keyof DadosFormularioParceiro) =>
    errors[campo]?.message;

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  // A API só devolve candidatos quando recusa. Reenviar depois de "cadastrar
  // assim mesmo" é o que carrega a confirmação — nada é gravado sem ela.
  const candidatos = estado.candidatos ?? [];
  const bloqueado = candidatos.some(
    (item) => item.classificacao === "INEQUIVOCA",
  );

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {candidatos.length > 0 ? (
          <AlertaDuplicidade
            candidatos={candidatos}
            bloqueado={bloqueado}
            aoConfirmar={() => {
              setValue("confirmarPossivelDuplicidade", true);
              void aoEnviar();
            }}
          />
        ) : null}

        <Texto
          rotulo="Nome da instituição"
          nome="nome"
          obrigatorio
          registro={register("nome")}
          erro={erroDe("nome")}
        />

        <Grade>
          <Texto
            rotulo="Sigla"
            nome="sigla"
            placeholder="UdeM, MIT…"
            registro={register("sigla")}
            erro={erroDe("sigla")}
          />
          <Selecao
            rotulo="País"
            nome="paisId"
            vazio="Selecione"
            registro={register("paisId")}
            opcoes={paises.map((pais) => ({
              valor: pais.id,
              texto: pais.nome,
            }))}
            erro={erroDe("paisId")}
          />
        </Grade>

        <Grade>
          <Texto
            rotulo="Cidade"
            nome="cidade"
            registro={register("cidade")}
            erro={erroDe("cidade")}
          />
          <Texto
            rotulo="Estado ou região"
            nome="estadoRegiao"
            registro={register("estadoRegiao")}
            erro={erroDe("estadoRegiao")}
          />
        </Grade>

        <Grade>
          <Texto
            rotulo="Tipo de organização"
            nome="tipoOrganizacao"
            placeholder="Universidade, instituto, agência…"
            registro={register("tipoOrganizacao")}
            erro={erroDe("tipoOrganizacao")}
          />
          <Texto
            rotulo="Faculdade ou departamento"
            nome="faculdadeDepartamento"
            registro={register("faculdadeDepartamento")}
            erro={erroDe("faculdadeDepartamento")}
          />
        </Grade>

        <Grade>
          <Texto
            rotulo="Programa relacionado"
            nome="programaRelacionado"
            registro={register("programaRelacionado")}
            erro={erroDe("programaRelacionado")}
          />
          <Texto
            rotulo="Grupo de pesquisa"
            nome="grupoPesquisa"
            registro={register("grupoPesquisa")}
            erro={erroDe("grupoPesquisa")}
          />
        </Grade>

        <AreaTexto
          rotulo="Áreas de atuação"
          nome="areasAtuacao"
          linhas={2}
          registro={register("areasAtuacao")}
          erro={erroDe("areasAtuacao")}
          dica="Texto livre. Não há taxonomia de áreas, então este campo descreve — não serve para contar."
        />

        {/*
          A origem só é editável no cadastro. Na edição vira texto: reescrevê-la
          apagaria a memória de como o relacionamento começou, que é justamente
          o que o módulo existe para preservar (BOL-030).
        */}
        {parceiro ? (
          <Campo rotulo="Como foi identificada">
            {() => (
              <p className="text-sm text-foreground">
                {rotulo(parceiro.origemRelacionamento)}
                <span className="mt-1 block text-xs text-muted">
                  Registrada no cadastro e não editável.
                </span>
              </p>
            )}
          </Campo>
        ) : (
          <Selecao
            rotulo="Como esta instituição foi identificada"
            nome="origemRelacionamento"
            vazio="Selecione"
            obrigatorio
            registro={register("origemRelacionamento")}
            opcoes={ORIGENS_RELACIONAMENTO.map((origem) => ({
              valor: origem.valor,
              texto: origem.texto,
            }))}
            erro={erroDe("origemRelacionamento")}
            dica="Fato histórico: não poderá ser alterado depois."
          />
        )}

        <Selecao
          rotulo="Situação do relacionamento"
          nome="estagioRelacionamento"
          registro={register("estagioRelacionamento")}
          opcoes={ESTAGIOS_RELACIONAMENTO.map((estagio) => ({
            valor: estagio.valor,
            texto: estagio.texto,
          }))}
          erro={erroDe("estagioRelacionamento")}
          dica="“Mobilidade realizada” e “parceria formalizada” não estão aqui: são deduzidas das bolsas e dos convênios registrados."
        />

        <AreaTexto
          rotulo="Observação sobre a origem"
          nome="origemObservacao"
          linhas={2}
          registro={register("origemObservacao")}
          erro={erroDe("origemObservacao")}
        />

        <Grade>
          <Texto
            rotulo="Site"
            nome="site"
            placeholder="https://"
            registro={register("site")}
            erro={erroDe("site")}
          />
          <Texto
            rotulo="E-mail institucional"
            nome="emailInstitucional"
            registro={register("emailInstitucional")}
            erro={erroDe("emailInstitucional")}
          />
        </Grade>

        <Texto
          rotulo="Telefone"
          nome="telefone"
          registro={register("telefone")}
          erro={erroDe("telefone")}
        />

        <AreaTexto
          rotulo="Endereço"
          nome="endereco"
          linhas={2}
          registro={register("endereco")}
          erro={erroDe("endereco")}
        />

        <Selecoes
          rotulo="Redes coordenadoras"
          nome="redeIds"
          dica="Um mesmo parceiro pode pertencer a mais de uma rede."
          registro={register("redeIds")}
          opcoes={redes.map((rede) => ({ valor: rede.id, texto: rede.nome }))}
          erro={erroDe("redeIds")}
        />

        <Marcador
          rotulo="Cadastro provisório"
          nome="cadastroProvisorio"
          dica="Marque quando os dados vieram de uma missão e ainda não foram conferidos."
          registro={register("cadastroProvisorio")}
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
        {/* A mensagem do 409 já aparece no alerta acima; repeti-la aqui só
            duplicaria o mesmo texto no mesmo instante. */}
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
              : parceiro
                ? "Salvar parceiro"
                : "Cadastrar parceiro"}
          </button>
        </div>
      </div>
    </form>
  );
}

/**
 * Alerta de possível duplicidade.
 *
 * Fica **dentro** do formulário, acima dos campos, e não em um diálogo por
 * cima: o critério de aceite da CG-049 é que o alerta não apague o que já foi
 * digitado. Como o formulário nunca é desmontado, o React Hook Form preserva
 * todos os valores, e a pessoa escolhe entre abrir o cadastro existente ou
 * confirmar que são diferentes.
 */
function AlertaDuplicidade({
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
          ? "Já existe um parceiro com esta identidade."
          : "Encontramos parceiros parecidos."}
      </p>
      <p className="mt-1 text-xs">
        {bloqueado
          ? "Abra o cadastro existente e use-o na missão em vez de criar outro."
          : "Confira antes de continuar. Se for realmente outra instituição, confirme abaixo."}
      </p>
      <ul className="mt-3 space-y-2">
        {candidatos.map((candidato) => (
          <li
            key={candidato.id}
            className="rounded-lg bg-surface px-3 py-2 text-foreground"
          >
            <Link
              href={`/parceiros/${candidato.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {candidato.nome}
              {candidato.sigla ? ` (${candidato.sigla})` : ""}
            </Link>
            <span className="block text-xs text-subtle">
              {candidato.motivos.map(motivoLegivel).join(" · ")}
              {candidato.ativo ? "" : " · cadastro inativo"}
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
          São instituições diferentes — cadastrar assim mesmo
        </button>
      )}
    </div>
  );
}

const MOTIVOS: Record<string, string> = {
  MESMO_NOME_NORMALIZADO: "mesmo nome",
  MESMA_SIGLA: "mesma sigla",
  MESMO_DOMINIO_DO_SITE: "mesmo domínio de site",
  MESMO_DOMINIO_DE_EMAIL: "mesmo domínio de e-mail",
  NOME_SEMELHANTE: "nome semelhante",
  MESMO_EMAIL: "mesmo e-mail",
  MESMO_TELEFONE: "mesmo telefone",
};

export function motivoLegivel(motivo: string) {
  return MOTIVOS[motivo] ?? motivo.toLowerCase().replaceAll("_", " ");
}
