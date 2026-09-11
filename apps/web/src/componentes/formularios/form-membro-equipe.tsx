"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import {
  useForm,
  useWatch,
  type UseFormRegister,
} from "react-hook-form";

import {
  atualizarMembroEquipe,
  criarMembroEquipe,
} from "@/acoes/comite-gestor";
import {
  AreaTexto,
  Data,
  Grade,
  Selecao,
  Texto,
} from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { RodapeDoPainel } from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL } from "@/lib/acao-tipos";
import type {
  MembroEquipeGestao,
  PessoaDisponivel,
} from "@/lib/dominio";
import { dataIsoParaBr } from "@/lib/formato";
import {
  formularioMembroEquipeSchema,
  type DadosFormularioMembroEquipe,
} from "@/lib/formularios/comite-gestor";

interface Contexto {
  programa: string;
  ciclo: string;
  pessoas: PessoaDisponivel[];
  dataInicioPadrao: string;
}

const CAMPOS_DA_API = {
  pessoaId: "pessoaId",
  "novaPessoa.nome": "nomePessoa",
  "novaPessoa.email": "emailPessoa",
  "novaPessoa.cpf": "cpfPessoa",
  "novaPessoa.tipo": "tipoPessoa",
  tipoEquipe: "tipoEquipe",
  funcao: "funcao",
  dataInicio: "dataInicio",
  dataFim: "dataFim",
  observacoes: "observacoes",
} as const;

export function NovoMembroEquipe(props: Contexto) {
  return (
    <AbrirSidesheet
      rotulo="Adicionar membro"
      titulo="Adicionar membro à equipe"
      descricao="Use uma pessoa já cadastrada ou crie um cadastro reutilizável."
    >
      {(fechar) => <FormMembroEquipe {...props} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

export function EditarMembroEquipe({
  membro,
  ...contexto
}: Contexto & { membro: MembroEquipeGestao }) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar vínculo de ${membro.nome}`}
      descricao="A pessoa permanece cadastrada mesmo depois do encerramento do vínculo."
    >
      {(fechar) => (
        <FormMembroEquipe
          {...contexto}
          membro={membro}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormMembroEquipe({
  programa,
  ciclo,
  pessoas,
  dataInicioPadrao,
  membro,
  aoConcluir,
}: Contexto & {
  membro?: MembroEquipeGestao;
  aoConcluir: () => void;
}) {
  const acao = membro
    ? atualizarMembroEquipe.bind(null, { programa, ciclo, id: membro.id })
    : criarMembroEquipe.bind(null, { programa, ciclo });
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors },
  } = useForm<DadosFormularioMembroEquipe>({
    resolver: zodResolver(formularioMembroEquipeSchema),
    defaultValues: {
      modoPessoa: membro ? "edicao" : "existente",
      pessoaId: "",
      nomePessoa: "",
      emailPessoa: "",
      cpfPessoa: "",
      tipoPessoa: "EXTERNO",
      tipoEquipe: membro?.tipoEquipe ?? "COMITE_GESTOR",
      funcao: membro?.funcao ?? "",
      dataInicio: dataIsoParaBr(membro?.dataInicio ?? dataInicioPadrao),
      dataFim: dataIsoParaBr(membro?.dataFim),
      observacoes: membro?.observacoes ?? "",
    },
  });
  const modoPessoa = useWatch({ control, name: "modoPessoa" });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const erroDe = (campo: keyof DadosFormularioMembroEquipe) =>
    errors[campo]?.message;

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form onSubmit={aoEnviar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {membro ? (
          <>
            <input type="hidden" {...register("modoPessoa")} />
            <div className="mb-5 rounded-xl border border-border bg-surface-muted px-4 py-3">
              <p className="font-medium text-foreground">{membro.nome}</p>
              <p className="mt-1 text-xs text-subtle">
                {membro.email ?? "Sem e-mail"}
              </p>
            </div>
          </>
        ) : (
          <>
            <Selecao
              rotulo="Cadastro da pessoa"
              nome="modoPessoa"
              padrao="existente"
              registro={register("modoPessoa")}
              opcoes={[
                { valor: "existente", texto: "Selecionar pessoa existente" },
                { valor: "nova", texto: "Cadastrar nova pessoa" },
              ]}
            />

            {modoPessoa === "existente" ? (
              <Selecao
                rotulo="Pessoa"
                nome="pessoaId"
                obrigatorio
                vazio="Selecione"
                registro={register("pessoaId")}
                opcoes={pessoas.map((pessoa) => ({
                  valor: pessoa.id,
                  texto: `${pessoa.nome}${pessoa.email ? ` · ${pessoa.email}` : ""}`,
                }))}
                erro={erroDe("pessoaId")}
              />
            ) : (
              <NovaPessoa register={register} erroDe={erroDe} />
            )}
          </>
        )}

        <Grade>
          <Selecao
            rotulo="Equipe"
            nome="tipoEquipe"
            obrigatorio
            padrao={membro?.tipoEquipe ?? "COMITE_GESTOR"}
            registro={register("tipoEquipe")}
            opcoes={[
              { valor: "COMITE_GESTOR", texto: "Comitê Gestor" },
              { valor: "ADMINISTRACAO", texto: "Administração" },
            ]}
            erro={erroDe("tipoEquipe")}
          />
          <Texto
            rotulo="Função"
            nome="funcao"
            obrigatorio
            padrao={membro?.funcao}
            placeholder="Coordenador, apoio administrativo…"
            registro={register("funcao")}
            erro={erroDe("funcao")}
          />
        </Grade>

        <Grade>
          <Data
            rotulo="Início do vínculo"
            nome="dataInicio"
            obrigatorio
            padrao={membro?.dataInicio ?? dataInicioPadrao}
            registro={register("dataInicio")}
            erro={erroDe("dataInicio")}
          />
          <Data
            rotulo="Fim do vínculo"
            nome="dataFim"
            padrao={membro?.dataFim ?? undefined}
            registro={register("dataFim")}
            dica="Deixe vazio enquanto o vínculo estiver ativo."
            erro={erroDe("dataFim")}
          />
        </Grade>

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          padrao={membro?.observacoes ?? undefined}
          registro={register("observacoes")}
          erro={erroDe("observacoes")}
        />
      </div>

      <Rodape
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo={membro ? "Salvar vínculo" : "Adicionar membro"}
      />
    </form>
  );
}

function NovaPessoa({
  register,
  erroDe,
}: {
  register: UseFormRegister<DadosFormularioMembroEquipe>;
  erroDe: (campo: keyof DadosFormularioMembroEquipe) => string | undefined;
}) {
  return (
    <div className="mb-5 rounded-xl border border-border bg-surface-muted p-4">
      <p className="mb-4 text-sm font-medium text-foreground">Nova pessoa</p>
      <Texto
        rotulo="Nome completo"
        nome="nomePessoa"
        obrigatorio
        registro={register("nomePessoa")}
        erro={erroDe("nomePessoa")}
      />
      <Grade>
        <Texto
          rotulo="E-mail"
          nome="emailPessoa"
          registro={register("emailPessoa")}
          erro={erroDe("emailPessoa")}
        />
        <Texto
          rotulo="CPF"
          nome="cpfPessoa"
          placeholder="Somente números"
          registro={register("cpfPessoa")}
          erro={erroDe("cpfPessoa")}
        />
      </Grade>
      <Selecao
        rotulo="Tipo de pessoa"
        nome="tipoPessoa"
        padrao="EXTERNO"
        registro={register("tipoPessoa")}
        opcoes={[
          { valor: "SERVIDOR", texto: "Servidor" },
          { valor: "DOCENTE", texto: "Docente" },
          { valor: "DISCENTE", texto: "Discente" },
          { valor: "PESQUISADOR", texto: "Pesquisador" },
          { valor: "EXTERNO", texto: "Externo" },
        ]}
      />
    </div>
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
    <RodapeDoPainel
      aoCancelar={aoCancelar}
      enviando={enviando}
      rotulo={rotulo}
      erro={erro}
    />
  );
}
