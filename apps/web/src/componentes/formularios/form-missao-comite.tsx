"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  startTransition,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  useFieldArray,
  useForm,
  useWatch,
  type Control,
  type FieldErrors,
  type Path,
  type UseFormRegister,
  type UseFormSetValue,
} from "react-hook-form";

import { criarMissaoComite } from "@/acoes/comite-gestor";
import { atualizarMissaoComite } from "@/acoes/missao";
import {
  AreaTexto,
  Data,
  Grade,
  Selecao,
  Selecoes,
  Texto,
} from "@/componentes/ui/campos";
import { Multistep, type Passo } from "@/componentes/ui/multistep";
import type { ErroDeCampo } from "@/componentes/ui/multistep-logica";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type {
  MembroEquipeGestao,
  MissaoDetalhe,
  PessoaDisponivel,
  ReferenciasMissao,
} from "@/lib/dominio";
import { dataBrParaIso } from "@/lib/formato";
import {
  campoApiParaFormulario,
  formularioMissaoComiteSchema,
  novaAtividade,
  novoParticipante,
  pessoasDoComiteGestor,
  valoresDaMissao,
  type DadosFormularioMissaoComite,
} from "@/lib/formularios/missao-comite";

interface ContextoMissao {
  programa: string;
  ciclo: string;
  membros: MembroEquipeGestao[];
  referencias: ReferenciasMissao;
}

const TIPOS_ATIVIDADE = [
  { valor: "VISITA_TECNICA", texto: "Visita técnica" },
  { valor: "EVENTO", texto: "Evento" },
  { valor: "ARTICULACAO", texto: "Articulação institucional" },
  { valor: "BANCA", texto: "Banca ou atividade acadêmica" },
  { valor: "OUTRO", texto: "Outra atividade" },
];

export function NovaMissaoComite(props: ContextoMissao) {
  return (
    <AbrirSidesheet
      rotulo="Nova missão"
      titulo="Cadastrar missão"
      descricao="Registre planejamento, roteiro e participantes. Passagens e diárias serão informadas depois."
      largura="larga"
    >
      {(fechar) => <FormMissaoComite {...props} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

/**
 * Edição da missão (V1-030), no mesmo formulário do cadastro.
 *
 * **Não é um segundo formulário**, e essa é a decisão: as regras de período,
 * responsável único e parada dentro da viagem são as mesmas, e mantê-las em
 * dois lugares é garantir que divirjam. O que muda é o que entra
 * (`valoresDaMissao`), para onde vai (`PATCH`) e o campo de situação, que some
 * — mudar situação é `/situacao`, com regra de origem própria por ação.
 */
export function EditarMissaoComite({
  missao,
  ...props
}: ContextoMissao & { missao: MissaoDetalhe }) {
  return (
    <AbrirSidesheet
      rotulo="Editar missão"
      variante="secundaria"
      titulo={`Editar ${missao.codigo}`}
      descricao="Altera o planejamento: período, roteiro e participantes. A situação da missão muda pelas ações próprias, não por aqui."
      largura="larga"
    >
      {(fechar) => (
        <FormMissaoComite {...props} missao={missao} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormMissaoComite({
  programa,
  ciclo,
  membros,
  referencias,
  missao,
  aoConcluir,
}: ContextoMissao & { missao?: MissaoDetalhe; aoConcluir: () => void }) {
  const edicao = missao !== undefined;
  const acao = edicao
    ? atualizarMissaoComite.bind(null, { programa, ciclo, id: missao.id })
    : criarMissaoComite.bind(null, { programa, ciclo });
  /**
   * Quem o seletor de participante oferece.
   *
   * Na edição, os participantes **da própria missão entram na lista**, mesmo
   * que tenham deixado o Comitê: `pessoasDoComiteGestor` descarta vínculo
   * encerrado, e sem esta união o participante de uma missão antiga chegaria
   * pré-selecionado com um id que não existe entre as opções — o campo
   * renderizaria vazio e o salvamento o perderia em silêncio.
   */
  const pessoasDoComite = useMemo(() => {
    const doComite = pessoasDoComiteGestor(membros);
    if (!missao) return doComite;
    const porId = new Map(doComite.map((pessoa) => [pessoa.id, pessoa]));
    for (const participante of missao.participantes) {
      if (porId.has(participante.pessoaId)) continue;
      porId.set(participante.pessoaId, {
        id: participante.pessoaId,
        nome: participante.nome,
        email: participante.email,
      });
    }
    return [...porId.values()].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt-BR"),
    );
  }, [membros, missao]);
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const {
    register,
    handleSubmit,
    control,
    getValues,
    setError,
    setValue,
    clearErrors,
    formState: { errors },
  } = useForm<DadosFormularioMissaoComite>({
    resolver: zodResolver(formularioMissaoComiteSchema),
    defaultValues: missao
      ? valoresDaMissao(missao)
      : {
          titulo: "",
          objetivo: "",
          // Nada de data presumida: o primeiro dia do ciclo parecia informado e
          // passava sem revisão para a missão gravada.
          dataInicio: "",
          dataFim: "",
          status: "RASCUNHO",
          observacoes: "",
          redes: [],
          atividades: [novaAtividade()],
          participantes: [novoParticipante(true)],
        },
  });
  const roteiro = useFieldArray({ control, name: "atividades" });
  const equipe = useFieldArray({ control, name: "participantes" });
  const dadosAtuais = useWatch({ control });
  const errosVisiveis = useMemo(() => achatarErros(errors), [errors]);
  const [correcao, setCorrecao] = useState<{
    estado: EstadoDaAcao;
    campos: Set<string>;
  } | null>(null);
  const formularioAlterado = correcao?.estado === estado;

  useToastDaAcao(estado, aoConcluir);

  useEffect(() => {
    if (estado.ok || !estado.erros) return;
    for (const erro of estado.erros) {
      const campo = campoApiParaFormulario(erro.campo);
      setError(campo as Path<DadosFormularioMissaoComite>, {
        type: "server",
        message: erro.mensagem,
      });
    }
  }, [estado, setError]);

  const camposRoteiro = roteiro.fields.flatMap((_, indice) =>
    [
      "tipo",
      "titulo",
      "paisId",
      "cidade",
      "modoInstituicao",
      "instituicaoId",
      "instituicaoNome",
      "eventoNome",
      "dataInicio",
      "dataFim",
      "planejamento",
      "observacoes",
    ].map((campo) => `atividades.${indice}.${campo}`),
  );
  const camposParticipantes = equipe.fields.flatMap((_, indice) =>
    [
      "modoPessoa",
      "pessoaId",
      "nomePessoa",
      "emailPessoa",
      "cpfPessoa",
      "tipoPessoa",
      "membroEquipeId",
      "papel",
      "observacoes",
    ].map((campo) => `participantes.${indice}.${campo}`),
  );

  const passos: Passo[] = [
    {
      id: "identificacao",
      titulo: "Identificação",
      campos: [
        "titulo",
        "objetivo",
        "dataInicio",
        "dataFim",
        "status",
        "redes",
        "observacoes",
      ],
      descricao:
        "Defina o propósito e o período geral. Nenhum valor financeiro é informado nesta etapa.",
      validar: validarIdentificacao,
      conteudo: (
        <>
          <Texto
            rotulo="Título da missão"
            nome="titulo"
            obrigatorio
            registro={register("titulo")}
            erro={mensagem(errors.titulo)}
            placeholder="Missão de articulação institucional em…"
          />
          <AreaTexto
            rotulo="Objetivo"
            nome="objetivo"
            obrigatorio
            linhas={4}
            registro={register("objetivo")}
            erro={mensagem(errors.objetivo)}
            placeholder="Descreva o resultado que a missão pretende alcançar."
          />
          <Grade>
            <Data
              rotulo="Início da viagem"
              nome="dataInicio"
              obrigatorio
              registro={register("dataInicio")}
              erro={mensagem(errors.dataInicio)}
            />
            <Data
              rotulo="Fim da viagem"
              nome="dataFim"
              obrigatorio
              registro={register("dataFim")}
              erro={mensagem(errors.dataFim)}
            />
          </Grade>
          {/*
            A situação só aparece no cadastro. Na edição ela some porque mudar
            situação é `/situacao`, com regra de origem e justificativa por
            ação — oferecê-la aqui daria dois caminhos para a mesma mudança, e
            um deles sem as regras.
          */}
          {edicao ? null : (
            <Selecao
              rotulo="Situação inicial"
              nome="status"
              padrao="RASCUNHO"
              registro={register("status")}
              opcoes={[
                { valor: "RASCUNHO", texto: "Rascunho" },
                { valor: "PLANEJADA", texto: "Planejada" },
              ]}
              dica="Use rascunho enquanto o roteiro ainda estiver em construção."
              erro={mensagem(errors.status)}
            />
          )}
          {referencias.redes.length === 0 ? (
            <p role="alert" className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-on-warning-soft">
              Este ciclo não possui redes coordenadoras cadastradas. A missão precisa pertencer a pelo menos uma.
            </p>
          ) : (
            <Selecoes
              rotulo="Redes"
              nome="redes"
              obrigatorio
              opcoes={referencias.redes.map((rede) => ({
                valor: rede.id,
                texto: rede.nome,
              }))}
              registro={register("redes")}
              dica="Uma missão conjunta pertence a mais de uma rede; marque todas as envolvidas."
              erro={mensagem(errors.redes)}
            />
          )}
          <AreaTexto
            rotulo="Observações"
            nome="observacoes"
            linhas={3}
            registro={register("observacoes")}
            erro={mensagem(errors.observacoes)}
          />
        </>
      ),
    },
    {
      id: "roteiro",
      titulo: "Roteiro",
      campos: ["atividades", ...camposRoteiro],
      descricao:
        "Inclua cada universidade, visita, evento ou articulação como uma atividade separada.",
      validar: (formulario) => validarRoteiro(formulario, roteiro.fields.length),
      conteudo: (
        <>
          {referencias.paises.length === 0 ? (
            <p role="alert" className="mb-4 rounded-xl bg-warning-soft p-3 text-sm text-on-warning-soft">
              O catálogo de países está vazio. Cadastre as referências institucionais antes de criar a missão.
            </p>
          ) : null}
          <div className="space-y-4">
            {roteiro.fields.map((campo, indice) => (
              <Atividade
                key={campo.id}
                indice={indice}
                total={roteiro.fields.length}
                control={control}
                register={register}
                setValue={setValue}
                errors={errors}
                referencias={referencias}
                aoRemover={() => roteiro.remove(indice)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              roteiro.append(
                novaAtividade(getValues("dataInicio"), getValues("dataFim")),
              )
            }
            className="mt-4 rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Adicionar atividade
          </button>
        </>
      ),
    },
    {
      id: "participantes",
      titulo: "Participantes",
      campos: ["participantes", ...camposParticipantes],
      descricao:
        "Selecione pessoas já cadastradas ou crie um cadastro persistente para reutilização futura.",
      validar: (formulario) =>
        validarParticipantes(formulario, equipe.fields.length),
      conteudo: (
        <>
          <div className="space-y-4">
            {equipe.fields.map((campo, indice) => (
              <Participante
                key={campo.id}
                indice={indice}
                total={equipe.fields.length}
                control={control}
                register={register}
                setValue={setValue}
                errors={errors}
                pessoas={pessoasDoComite}
                membros={membros}
                aoRemover={() => equipe.remove(indice)}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={() => equipe.append(novoParticipante())}
            className="mt-4 rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Adicionar participante
          </button>
        </>
      ),
    },
    {
      id: "revisao",
      titulo: "Revisão",
      descricao:
        "Confira o planejamento. Valores, passagens e diárias não fazem parte deste cadastro.",
      conteudo: (
        <Revisao
          dados={dadosAtuais}
          pessoas={pessoasDoComite}
          referencias={referencias}
        />
      ),
    },
  ];

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form
      onSubmit={aoEnviar}
      onChange={(evento) => {
        const alvo = evento.nativeEvent.target;
        if (!(alvo instanceof HTMLElement)) return;
        const campo = alvo.getAttribute("name");
        if (!campo) return;
        setCorrecao((atual) => {
          const campos =
            atual?.estado === estado ? new Set(atual.campos) : new Set<string>();
          campos.add(campo);
          return { estado, campos };
        });
        clearErrors(campo as Path<DadosFormularioMissaoComite>);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Multistep
        passos={passos}
        enviando={enviando}
        erro={
          estado.ok || formularioAlterado
            ? null
            : (estado.mensagem ?? null)
        }
        erros={errosVisiveis}
        errosParaNavegacao={errosVisiveis}
        rotuloConcluir="Cadastrar missão"
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

function Atividade({
  indice,
  total,
  control,
  register,
  setValue,
  errors,
  referencias,
  aoRemover,
}: {
  indice: number;
  total: number;
  control: Control<DadosFormularioMissaoComite>;
  register: UseFormRegister<DadosFormularioMissaoComite>;
  setValue: UseFormSetValue<DadosFormularioMissaoComite>;
  errors: FieldErrors<DadosFormularioMissaoComite>;
  referencias: ReferenciasMissao;
  aoRemover: () => void;
}) {
  const modo = useWatch({
    control,
    name: `atividades.${indice}.modoInstituicao`,
  });
  const paisId = useWatch({ control, name: `atividades.${indice}.paisId` });
  const dataInicio = useWatch({
    control,
    name: `atividades.${indice}.dataInicio`,
  });
  const dataFim = useWatch({ control, name: `atividades.${indice}.dataFim` });
  const instituicaoId = useWatch({
    control,
    name: `atividades.${indice}.instituicaoId`,
  });
  const erro = errors.atividades?.[indice];
  const instituicoes = referencias.instituicoes.filter(
    (instituicao) => !instituicao.paisId || instituicao.paisId === paisId,
  );

  useEffect(() => {
    if (
      instituicaoId &&
      !instituicoes.some((instituicao) => instituicao.id === instituicaoId)
    ) {
      setValue(`atividades.${indice}.instituicaoId`, "");
    }
  }, [indice, instituicaoId, instituicoes, setValue]);

  return (
    <fieldset className="rounded-2xl border border-border bg-surface-muted/40 p-4">
      <legend className="px-2 text-sm font-semibold text-foreground">
        Atividade {indice + 1}
      </legend>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={aoRemover}
          disabled={total === 1}
          className="text-xs font-medium text-danger hover:underline disabled:text-subtle disabled:no-underline"
        >
          Remover atividade
        </button>
      </div>
      <Grade>
        <Selecao
          rotulo="Tipo"
          nome={`atividades.${indice}.tipo`}
          registro={register(`atividades.${indice}.tipo`)}
          opcoes={TIPOS_ATIVIDADE}
          erro={mensagem(erro?.tipo)}
        />
        <Texto
          rotulo="Título da atividade"
          nome={`atividades.${indice}.titulo`}
          obrigatorio
          registro={register(`atividades.${indice}.titulo`)}
          erro={mensagem(erro?.titulo)}
          placeholder="Visita à universidade parceira"
        />
      </Grade>
      <Grade>
        <Selecao
          rotulo="País"
          nome={`atividades.${indice}.paisId`}
          vazio="Selecione"
          obrigatorio
          registro={register(`atividades.${indice}.paisId`)}
          opcoes={referencias.paises.map((pais) => ({
            valor: pais.id,
            texto: pais.nome,
          }))}
          erro={mensagem(erro?.paisId)}
        />
        <Texto
          rotulo="Cidade"
          nome={`atividades.${indice}.cidade`}
          registro={register(`atividades.${indice}.cidade`)}
          erro={mensagem(erro?.cidade)}
        />
      </Grade>
      <Selecao
        rotulo="Instituição"
        nome={`atividades.${indice}.modoInstituicao`}
        registro={register(`atividades.${indice}.modoInstituicao`)}
        opcoes={[
          { valor: "nenhuma", texto: "Não informar" },
          { valor: "catalogo", texto: "Selecionar do catálogo" },
          { valor: "livre", texto: "Informar outro nome" },
        ]}
        erro={mensagem(erro?.modoInstituicao)}
      />
      {modo === "catalogo" ? (
        <Selecao
          rotulo="Instituição do catálogo"
          nome={`atividades.${indice}.instituicaoId`}
          vazio="Selecione"
          obrigatorio
          registro={register(`atividades.${indice}.instituicaoId`)}
          opcoes={instituicoes.map((instituicao) => ({
            valor: instituicao.id,
            texto: `${instituicao.nome}${instituicao.sigla ? ` (${instituicao.sigla})` : ""}`,
          }))}
          erro={mensagem(erro?.instituicaoId)}
        />
      ) : null}
      {modo === "livre" ? (
        <Texto
          rotulo="Nome da instituição"
          nome={`atividades.${indice}.instituicaoNome`}
          obrigatorio
          registro={register(`atividades.${indice}.instituicaoNome`)}
          erro={mensagem(erro?.instituicaoNome)}
        />
      ) : null}
      <Texto
        rotulo="Nome do evento"
        nome={`atividades.${indice}.eventoNome`}
        registro={register(`atividades.${indice}.eventoNome`)}
        erro={mensagem(erro?.eventoNome)}
        dica="Preencha quando a atividade fizer parte de congresso, seminário ou encontro."
      />
      <Grade>
        <Data
          rotulo="Início da atividade"
          nome={`atividades.${indice}.dataInicio`}
          obrigatorio
          padrao={dataInicio}
          registro={register(`atividades.${indice}.dataInicio`)}
          erro={mensagem(erro?.dataInicio)}
        />
        <Data
          rotulo="Fim da atividade"
          nome={`atividades.${indice}.dataFim`}
          obrigatorio
          padrao={dataFim}
          registro={register(`atividades.${indice}.dataFim`)}
          erro={mensagem(erro?.dataFim)}
        />
      </Grade>
      <AreaTexto
        rotulo="Planejamento da atividade"
        nome={`atividades.${indice}.planejamento`}
        linhas={3}
        registro={register(`atividades.${indice}.planejamento`)}
        erro={mensagem(erro?.planejamento)}
        placeholder="Agenda prevista, pessoas a visitar e finalidade."
      />
      <AreaTexto
        rotulo="Observações"
        nome={`atividades.${indice}.observacoes`}
        linhas={2}
        registro={register(`atividades.${indice}.observacoes`)}
        erro={mensagem(erro?.observacoes)}
      />
    </fieldset>
  );
}

function Participante({
  indice,
  total,
  control,
  register,
  setValue,
  errors,
  pessoas,
  membros,
  aoRemover,
}: {
  indice: number;
  total: number;
  control: Control<DadosFormularioMissaoComite>;
  register: UseFormRegister<DadosFormularioMissaoComite>;
  setValue: UseFormSetValue<DadosFormularioMissaoComite>;
  errors: FieldErrors<DadosFormularioMissaoComite>;
  pessoas: Pick<PessoaDisponivel, "id" | "nome" | "email">[];
  membros: MembroEquipeGestao[];
  aoRemover: () => void;
}) {
  const modo = useWatch({
    control,
    name: `participantes.${indice}.modoPessoa`,
  });
  const pessoaId = useWatch({
    control,
    name: `participantes.${indice}.pessoaId`,
  });
  const membroEquipeId = useWatch({
    control,
    name: `participantes.${indice}.membroEquipeId`,
  });
  const erro = errors.participantes?.[indice];
  const vinculos = membros.filter((membro) => membro.pessoaId === pessoaId);

  useEffect(() => {
    if (
      membroEquipeId &&
      (modo === "nova" ||
        !vinculos.some((membro) => membro.id === membroEquipeId))
    ) {
      setValue(`participantes.${indice}.membroEquipeId`, "");
    }
  }, [indice, membroEquipeId, modo, setValue, vinculos]);

  return (
    <fieldset className="rounded-2xl border border-border bg-surface-muted/40 p-4">
      <legend className="px-2 text-sm font-semibold text-foreground">
        Participante {indice + 1}
      </legend>
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={aoRemover}
          disabled={total === 1}
          className="text-xs font-medium text-danger hover:underline disabled:text-subtle disabled:no-underline"
        >
          Remover participante
        </button>
      </div>
      <Selecao
        rotulo="Cadastro da pessoa"
        nome={`participantes.${indice}.modoPessoa`}
        registro={register(`participantes.${indice}.modoPessoa`)}
        opcoes={[
          { valor: "existente", texto: "Selecionar pessoa existente" },
          { valor: "nova", texto: "Cadastrar nova pessoa" },
        ]}
        erro={mensagem(erro?.modoPessoa)}
      />
      {modo === "existente" ? (
        <>
          <Selecao
            rotulo="Pessoa"
            nome={`participantes.${indice}.pessoaId`}
            vazio="Selecione"
            obrigatorio
            registro={register(`participantes.${indice}.pessoaId`)}
            opcoes={pessoas.map((pessoa) => ({
              valor: pessoa.id,
              texto: `${pessoa.nome}${pessoa.email ? ` · ${pessoa.email}` : ""}`,
            }))}
            erro={mensagem(erro?.pessoaId)}
          />
          {vinculos.length > 0 ? (
            <Selecao
              rotulo="Vínculo de equipe nesta missão"
              nome={`participantes.${indice}.membroEquipeId`}
              vazio="Participação externa ao vínculo"
              registro={register(`participantes.${indice}.membroEquipeId`)}
              opcoes={vinculos.map((membro) => ({
                valor: membro.id,
                texto: `${membro.tipoEquipe === "COMITE_GESTOR" ? "Comitê Gestor" : "Administração"} · ${membro.funcao}`,
              }))}
              erro={mensagem(erro?.membroEquipeId)}
            />
          ) : null}
        </>
      ) : (
        <div className="mb-4 rounded-xl border border-border bg-surface p-4">
          <p className="mb-4 text-sm font-medium text-foreground">Nova pessoa</p>
          <Texto
            rotulo="Nome completo"
            nome={`participantes.${indice}.nomePessoa`}
            obrigatorio
            registro={register(`participantes.${indice}.nomePessoa`)}
            erro={mensagem(erro?.nomePessoa)}
          />
          <Grade>
            <Texto
              rotulo="E-mail"
              nome={`participantes.${indice}.emailPessoa`}
              registro={register(`participantes.${indice}.emailPessoa`)}
              erro={mensagem(erro?.emailPessoa)}
            />
            <Texto
              rotulo="CPF"
              nome={`participantes.${indice}.cpfPessoa`}
              registro={register(`participantes.${indice}.cpfPessoa`)}
              erro={mensagem(erro?.cpfPessoa)}
              placeholder="Somente números"
            />
          </Grade>
          <Selecao
            rotulo="Tipo de pessoa"
            nome={`participantes.${indice}.tipoPessoa`}
            registro={register(`participantes.${indice}.tipoPessoa`)}
            opcoes={[
              { valor: "SERVIDOR", texto: "Servidor" },
              { valor: "DOCENTE", texto: "Docente" },
              { valor: "DISCENTE", texto: "Discente" },
              { valor: "PESQUISADOR", texto: "Pesquisador" },
              { valor: "EXTERNO", texto: "Externo" },
            ]}
            erro={mensagem(erro?.tipoPessoa)}
          />
        </div>
      )}
      <Grade>
        <Selecao
          rotulo="Papel na missão"
          nome={`participantes.${indice}.papel`}
          registro={register(`participantes.${indice}.papel`)}
          opcoes={[
            { valor: "RESPONSAVEL", texto: "Responsável" },
            { valor: "PARTICIPANTE", texto: "Participante" },
            { valor: "APOIO", texto: "Apoio" },
          ]}
          erro={mensagem(erro?.papel)}
        />
        <AreaTexto
          rotulo="Observações"
          nome={`participantes.${indice}.observacoes`}
          linhas={2}
          registro={register(`participantes.${indice}.observacoes`)}
          erro={mensagem(erro?.observacoes)}
        />
      </Grade>
    </fieldset>
  );
}

function Revisao({
  dados,
  pessoas,
  referencias,
}: {
  dados: {
    titulo?: string;
    objetivo?: string;
    dataInicio?: string;
    dataFim?: string;
    redes?: (string | undefined)[];
    atividades?: Partial<
      DadosFormularioMissaoComite["atividades"][number]
    >[];
    participantes?: Partial<
      DadosFormularioMissaoComite["participantes"][number]
    >[];
  };
  pessoas: Pick<PessoaDisponivel, "id" | "nome" | "email">[];
  referencias: ReferenciasMissao;
}) {
  const atividades = dados.atividades ?? [];
  const participantes = dados.participantes ?? [];
  const nomePessoa = (id?: string) =>
    pessoas.find((pessoa) => pessoa.id === id)?.nome ?? "Pessoa não selecionada";
  const nomePais = (id?: string) =>
    referencias.paises.find((pais) => pais.id === id)?.nome ?? "País não selecionado";
  const redesEscolhidas = (dados.redes ?? [])
    .map(
      (id) => referencias.redes.find((rede) => rede.id === id)?.nome,
    )
    .filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-surface-muted p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-subtle">Missão</p>
        <p className="mt-1 font-semibold text-foreground">
          {dados.titulo || "Título não informado"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {dados.dataInicio || "—"} — {dados.dataFim || "—"}
        </p>
        <p className="mt-1 text-sm text-muted">
          {redesEscolhidas.length > 0
            ? redesEscolhidas.join(" · ")
            : "Nenhuma rede selecionada"}
        </p>
        <p className="mt-3 text-sm text-foreground">
          {dados.objetivo || "Objetivo não informado"}
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="font-medium text-foreground">
          Roteiro · {atividades.length} {atividades.length === 1 ? "atividade" : "atividades"}
        </h3>
        <ol className="mt-3 space-y-2 text-sm text-muted">
          {atividades.map((atividade, indice) => (
            <li key={indice}>
              <span className="font-medium text-foreground">{indice + 1}. {atividade?.titulo || "Sem título"}</span>
              <span className="block">{nomePais(atividade?.paisId)}{atividade?.cidade ? ` · ${atividade.cidade}` : ""}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h3 className="font-medium text-foreground">
          Participantes · {participantes.length}
        </h3>
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {participantes.map((participante, indice) => (
            <li key={indice}>
              <span className="font-medium text-foreground">
                {participante?.modoPessoa === "nova"
                  ? participante.nomePessoa || "Nova pessoa sem nome"
                  : nomePessoa(participante?.pessoaId)}
              </span>
              <span className="block">{rotuloPapel(participante?.papel)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="rounded-xl bg-info-soft p-3 text-sm text-on-info-soft">
        Esta missão será criada sem orçamento. Passagens, diárias e PDFs entram somente na prestação de contas.
      </p>
    </div>
  );
}

function validarIdentificacao(formulario: HTMLFormElement): string | null {
  if (valor(formulario, "titulo").length < 3) {
    return "Informe o título da missão.";
  }
  if (valor(formulario, "objetivo").length < 10) {
    return "Informe o objetivo da missão.";
  }
  const inicio = dataBrParaIso(valor(formulario, "dataInicio"));
  const fim = dataBrParaIso(valor(formulario, "dataFim"));
  if (!inicio || !fim) return "Informe o período completo da viagem.";
  if (fim < inicio) return "A data final não pode ser anterior à inicial.";
  if (marcados(formulario, "redes") === 0) {
    return "Selecione pelo menos uma rede.";
  }
  return null;
}

function validarRoteiro(
  formulario: HTMLFormElement,
  quantidade: number,
): string | null {
  if (quantidade === 0) return "Inclua pelo menos uma atividade no roteiro.";
  for (let indice = 0; indice < quantidade; indice += 1) {
    if (valor(formulario, `atividades.${indice}.titulo`).length < 3) {
      return `Informe o título da atividade ${indice + 1}.`;
    }
    if (!valor(formulario, `atividades.${indice}.paisId`)) {
      return `Selecione o país da atividade ${indice + 1}.`;
    }
    if (
      !dataBrParaIso(valor(formulario, `atividades.${indice}.dataInicio`)) ||
      !dataBrParaIso(valor(formulario, `atividades.${indice}.dataFim`))
    ) {
      return `Informe o período da atividade ${indice + 1}.`;
    }
  }
  return null;
}

function validarParticipantes(
  formulario: HTMLFormElement,
  quantidade: number,
): string | null {
  if (quantidade === 0) return "Inclua pelo menos um participante.";
  for (let indice = 0; indice < quantidade; indice += 1) {
    const modo = valor(formulario, `participantes.${indice}.modoPessoa`);
    if (modo === "existente" && !valor(formulario, `participantes.${indice}.pessoaId`)) {
      return `Selecione a pessoa do participante ${indice + 1}.`;
    }
    if (modo === "nova" && valor(formulario, `participantes.${indice}.nomePessoa`).length < 3) {
      return `Informe o nome do participante ${indice + 1}.`;
    }
  }
  return null;
}

function achatarErros(
  erros: FieldErrors<DadosFormularioMissaoComite>,
): ErroDeCampo[] {
  const resultado: ErroDeCampo[] = [];

  function percorrer(valorAtual: unknown, caminho: string) {
    if (!valorAtual || typeof valorAtual !== "object") return;
    const objeto = valorAtual as Record<string, unknown>;
    if (typeof objeto.message === "string") {
      resultado.push({ campo: caminho || "(raiz)", mensagem: objeto.message });
    }
    for (const [chave, valorFilho] of Object.entries(objeto)) {
      if (["message", "type", "types", "ref"].includes(chave)) continue;
      const proximo = caminho ? `${caminho}.${chave}` : chave;
      percorrer(valorFilho, proximo);
    }
  }

  percorrer(erros, "");
  return resultado;
}

function mensagem(erro: unknown): string | undefined {
  if (!erro || typeof erro !== "object") return undefined;
  const valor = (erro as { message?: unknown }).message;
  return typeof valor === "string" ? valor : undefined;
}

/**
 * Quantas caixas de um grupo estao marcadas.
 *
 * `elements.namedItem` devolve uma `RadioNodeList` quando varios controles
 * compartilham o nome, e o `.value` dela e o da primeira marcada — o que faria
 * "nenhuma marcada" e "a primeira marcada" parecerem o mesmo caso.
 */
function marcados(formulario: HTMLFormElement, campo: string): number {
  return formulario.querySelectorAll(`input[name="${campo}"]:checked`).length;
}

function valor(formulario: HTMLFormElement, campo: string): string {
  const elemento = formulario.elements.namedItem(campo);
  if (elemento && "value" in elemento) return String(elemento.value).trim();
  return "";
}


function rotuloPapel(papel: string | undefined): string {
  if (papel === "RESPONSAVEL") return "Responsável";
  if (papel === "APOIO") return "Apoio";
  return "Participante";
}
