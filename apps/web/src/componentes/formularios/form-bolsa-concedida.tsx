"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useMemo, useState } from "react";
import { useForm, useWatch, type Path } from "react-hook-form";

import {
  atualizarBolsaConcedida,
  criarBolsaConcedida,
} from "@/acoes/bolsistas";
import { CampoInstituicao } from "@/componentes/consultas/campo-instituicao";
import { CampoCombobox } from "@/componentes/ui/campo-combobox";
import { AreaTexto, Data, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { Multistep, type Passo } from "@/componentes/ui/multistep";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type {
  BolsaConcedidaDetalhe,
  OpcaoBolsaPlanejada,
  ReferenciasBolsa,
} from "@/lib/dominio";
import {
  formularioBolsaConcedidaSchema,
  NIVEIS_BENEFICIARIO,
  type DadosFormularioBolsaConcedida,
} from "@/lib/formularios/bolsa-concedida";
import { meses, moeda, rotulo } from "@/lib/formato";

export function NovaBolsaConcedida({
  opcoes,
  referencias,
}: {
  opcoes: OpcaoBolsaPlanejada[];
  referencias: ReferenciasBolsa;
}) {
  return (
    <AbrirSidesheet
      rotulo="Conceder bolsa"
      titulo="Conceder bolsa a uma pessoa"
      descricao="A linha planejada fornece modalidade, valor e vigência; a equipe informa o bolsista, as pontas da mobilidade e as datas completas."
      largura="larga"
    >
      {(fechar) => (
        <FormNovaBolsa
          opcoes={opcoes}
          referencias={referencias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Os nomes de campo da API coincidem com os do formulário, então o mapa é a
 * identidade. Ele existe mesmo assim porque `useErrosDaAcao` só reaplica o que
 * está no mapa — sem ele, um erro de campo novo voltaria da API e sumiria.
 */
const CAMPOS_DA_API = Object.fromEntries(
  [
    "itemPlanejadoId",
    "nome",
    "email",
    "cpf",
    "telefone",
    "lattes",
    "orcid",
    "linhaPesquisaId",
    "orientadorNome",
    "nivelBeneficiario",
    "paisOrigemId",
    "instituicaoOrigemId",
    "instituicaoOrigemNome",
    "paisDestinoNome",
    "instituicaoDestinoNome",
    "dataInicio",
    "dataFim",
    "status",
    "processo",
    "observacoes",
  ].map((campo) => [campo, campo]),
) as Record<string, Path<DadosFormularioBolsaConcedida>>;

function FormNovaBolsa({
  opcoes,
  referencias,
  aoConcluir,
}: {
  opcoes: OpcaoBolsaPlanejada[];
  referencias: ReferenciasBolsa;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    criarBolsaConcedida,
    ESTADO_INICIAL,
  );
  const {
    register,
    handleSubmit,
    control,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<DadosFormularioBolsaConcedida>({
    resolver: zodResolver(formularioBolsaConcedidaSchema),
    defaultValues: {
      itemPlanejadoId: "",
      nome: "",
      email: "",
      cpf: "",
      telefone: "",
      lattes: "",
      orcid: "",
      linhaPesquisaId: "",
      orientadorNome: "",
      nivelBeneficiario: "DOUTORADO",
      paisOrigemId: "",
      modoInstituicaoOrigem: "catalogo",
      instituicaoOrigemId: "",
      instituicaoOrigemNome: "",
      paisDestinoNome: "",
      instituicaoDestinoNome: "",
      dataInicio: "",
      dataFim: "",
      // A concessão é registrada quando já está em curso; "Selecionado"
      // continua disponível para o caso de exceção.
      status: "EM_ANDAMENTO",
      processo: "",
      observacoes: "",
    },
  });

  const [correcao, setCorrecao] = useState<{
    estado: EstadoDaAcao;
    campos: Set<string>;
  } | null>(null);
  const formularioAlterado = correcao?.estado === estado;

  const itemPlanejadoId = useWatch({ control, name: "itemPlanejadoId" });
  const modoOrigem = useWatch({ control, name: "modoInstituicaoOrigem" });
  const opcao = opcoes.find((item) => item.id === itemPlanejadoId);
  // A linha de pesquisa e do PPG, e a API recusa a de outro. Filtrar aqui e o
  // que impede a tela de oferecer o que sera recusado depois.
  const linhasDoPpg = opcao
    ? referencias.linhasPesquisa.filter((linha) => linha.ppgId === opcao.ppgId)
    : [];

  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const opcoesPais = useMemo(
    () =>
      referencias.paises.map((pais) => ({
        valor: pais.id,
        rotulo: pais.nome,
        termos: pais.codigoIso2,
      })),
    [referencias.paises],
  );

  const opcoesModo = [
    { valor: "catalogo", texto: "Selecionar do catálogo" },
    { valor: "livre", texto: "Informar outro nome" },
  ];

  const passos: Passo[] = [
    {
      id: "planejamento",
      titulo: "Planejamento",
      campos: ["itemPlanejadoId"],
      descricao:
        "Escolha a vaga de origem. O sistema não permite consumir mais vagas do que o planejamento anual.",
      conteudo: (
        <>
          <Selecao
            rotulo="Bolsa planejada"
            nome="itemPlanejadoId"
            vazio="Selecione código, PPG e modalidade"
            obrigatorio
            registro={register("itemPlanejadoId")}
            opcoes={opcoes.map((item) => ({
              valor: item.id,
              texto: `${item.codigo} · ${item.ppgSigla} · ${item.modalidade}`,
            }))}
            erro={errors.itemPlanejadoId?.message}
          />

          {opcao ? <ResumoDaOpcao opcao={opcao} /> : null}
        </>
      ),
    },
    {
      id: "bolsista",
      titulo: "Bolsista",
      campos: [
        "nome",
        "email",
        "cpf",
        "telefone",
        "lattes",
        "orcid",
        "nivelBeneficiario",
      ],
      descricao:
        "O produto será cobrado individualmente desta pessoa, não da linha agregada do plano.",
      conteudo: (
        <>
          <Texto
            rotulo="Nome completo"
            nome="nome"
            obrigatorio
            registro={register("nome")}
            erro={errors.nome?.message}
          />
          <Grade>
            <Texto
              rotulo="E-mail"
              nome="email"
              placeholder="pessoa@instituicao.br"
              registro={register("email")}
              erro={errors.email?.message}
            />
            <Texto
              rotulo="CPF"
              nome="cpf"
              placeholder="000.000.000-00"
              obrigatorio
              registro={register("cpf")}
              erro={errors.cpf?.message}
              dica="O CPF é usado para impedir modalidades diferentes para a mesma pessoa no ciclo 2027–2030."
            />
          </Grade>
          <Grade>
            <Texto
              rotulo="Telefone"
              nome="telefone"
              placeholder="(92) 90000-0000"
              registro={register("telefone")}
              erro={errors.telefone?.message}
            />
            <Selecao
              rotulo="Nível do beneficiário"
              nome="nivelBeneficiario"
              obrigatorio
              registro={register("nivelBeneficiario")}
              erro={errors.nivelBeneficiario?.message}
              opcoes={NIVEIS_BENEFICIARIO.map((nivel) => ({
                valor: nivel.valor,
                texto: nivel.texto,
              }))}
            />
          </Grade>
          <Grade>
            <Texto
              rotulo="Currículo Lattes"
              nome="lattes"
              placeholder="http://lattes.cnpq.br/…"
              registro={register("lattes")}
              erro={errors.lattes?.message}
            />
            <Texto
              rotulo="ORCID"
              nome="orcid"
              placeholder="0000-0000-0000-0000"
              registro={register("orcid")}
              erro={errors.orcid?.message}
              dica="O último caractere pode ser X — é o dígito verificador do padrão."
            />
          </Grade>
        </>
      ),
    },
    {
      id: "academico",
      titulo: "Vínculo acadêmico",
      campos: ["linhaPesquisaId", "orientadorNome"],
      descricao:
        "Opcional. A linha de pesquisa vem do PPG da linha planejada; o orientador é criado como docente se ainda não existir.",
      conteudo: (
        <>
          <Selecao
            rotulo="Linha de pesquisa"
            nome="linhaPesquisaId"
            vazio={
              linhasDoPpg.length > 0
                ? "Não informar"
                : "Este PPG não tem linhas cadastradas"
            }
            registro={register("linhaPesquisaId")}
            opcoes={linhasDoPpg.map((linha) => ({
              valor: linha.id,
              texto: linha.nome,
            }))}
            erro={errors.linhaPesquisaId?.message}
            dica="Cadastre as linhas em PPGs para que apareçam aqui."
          />
          <Texto
            rotulo="Orientador"
            nome="orientadorNome"
            placeholder="Nome completo"
            registro={register("orientadorNome")}
            erro={errors.orientadorNome?.message}
          />
        </>
      ),
    },
    {
      id: "trajeto",
      titulo: "Origem e destino",
      campos: [
        "paisOrigemId",
        "modoInstituicaoOrigem",
        "instituicaoOrigemId",
        "instituicaoOrigemNome",
        "paisDestinoNome",
        "instituicaoDestinoNome",
      ],
      descricao:
        "Registre as duas pontas da mobilidade. Nenhuma instituição é presumida pelo sistema.",
      conteudo: (
        <>
          <CampoCombobox<DadosFormularioBolsaConcedida>
            rotulo="País de origem"
            nome="paisOrigemId"
            control={control}
            obrigatorio
            opcoes={opcoesPais}
            erro={errors.paisOrigemId?.message}
            placeholder="Selecione o país"
            placeholderBusca="Buscar país"
          />
          <Selecao
            rotulo="Como informar a instituição de origem"
            nome="modoInstituicaoOrigem"
            registro={register("modoInstituicaoOrigem")}
            opcoes={opcoesModo}
            dica="Prefira o catálogo: é o que liga a bolsa ao histórico do parceiro e ao mapa."
            erro={errors.modoInstituicaoOrigem?.message}
          />
          {modoOrigem === "catalogo" ? (
            <CampoInstituicao<DadosFormularioBolsaConcedida>
              rotulo="Instituição de origem"
              nome="instituicaoOrigemId"
              control={control}
              obrigatorio
              iniciais={referencias.instituicoes}
              erro={errors.instituicaoOrigemId?.message}
            />
          ) : (
            <Texto
              rotulo="Universidade ou instituição de origem"
              nome="instituicaoOrigemNome"
              obrigatorio
              registro={register("instituicaoOrigemNome")}
              erro={errors.instituicaoOrigemNome?.message}
            />
          )}

          <Grade>
            <Texto
              rotulo="País de destino"
              nome="paisDestinoNome"
              obrigatorio
              placeholder={opcao?.destino === "BRASIL" ? "Brasil" : "Portugal"}
              registro={register("paisDestinoNome")}
              erro={errors.paisDestinoNome?.message}
            />
            <Texto
              rotulo="Universidade ou instituição de destino"
              nome="instituicaoDestinoNome"
              obrigatorio
              placeholder="Universidade de Coimbra"
              registro={register("instituicaoDestinoNome")}
              erro={errors.instituicaoDestinoNome?.message}
            />
          </Grade>
        </>
      ),
    },
    {
      id: "periodo",
      titulo: "Período",
      campos: ["dataInicio", "dataFim", "status", "processo", "observacoes"],
      descricao:
        "Informe as datas exatas do termo. São elas que alimentam os alertas de início e expiração.",
      conteudo: (
        <>
          <Grade>
            <Data
              rotulo="Data inicial"
              nome="dataInicio"
              obrigatorio
              registro={register("dataInicio")}
              erro={errors.dataInicio?.message}
            />
            <Data
              rotulo="Data final"
              nome="dataFim"
              obrigatorio
              registro={register("dataFim")}
              erro={errors.dataFim?.message}
            />
          </Grade>
          <Grade>
            <Selecao
              rotulo="Situação registrada"
              nome="status"
              registro={register("status")}
              erro={errors.status?.message}
              opcoes={[
                { valor: "SELECIONADO", texto: "Selecionado" },
                { valor: "EM_ANDAMENTO", texto: "Em andamento" },
              ]}
            />
            <Texto
              rotulo="Processo"
              nome="processo"
              placeholder="Número SEI ou equivalente"
              registro={register("processo")}
              erro={errors.processo?.message}
            />
          </Grade>
          <AreaTexto
            rotulo="Observações"
            nome="observacoes"
            linhas={3}
            registro={register("observacoes")}
            erro={errors.observacoes?.message}
          />
        </>
      ),
    },
  ];

  /**
   * Achatado a partir de `errors` do React Hook Form, e não do estado da ação:
   * é o que faz o `Multistep` saltar para a etapa errada tanto na recusa da
   * API quanto na validação local, com um caminho só.
   */
  const errosVisiveis = useMemo(
    () =>
      Object.entries(errors).flatMap(([campo, erro]) => {
        const mensagem = (erro as { message?: string } | undefined)?.message;
        return mensagem ? [{ campo, mensagem }] : [];
      }),
    [errors],
  );

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
            atual?.estado === estado
              ? new Set(atual.campos)
              : new Set<string>();
          campos.add(campo);
          return { estado, campos };
        });
        clearErrors(campo as Path<DadosFormularioBolsaConcedida>);
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Multistep
        passos={passos}
        enviando={enviando}
        erro={
          estado.ok || formularioAlterado ? null : (estado.mensagem ?? null)
        }
        erros={errosVisiveis}
        errosParaNavegacao={errosVisiveis}
        rotuloConcluir="Cadastrar concessão"
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

function ResumoDaOpcao({ opcao }: { opcao: OpcaoBolsaPlanejada }) {
  return (
    <div className="mb-5 rounded-2xl border border-border bg-surface-muted p-4 text-sm">
      <p className="font-medium text-foreground">
        {opcao.ppgSigla} · {opcao.modalidade}
      </p>
      <p className="mt-1 text-muted">
        {rotulo(opcao.destino)} · {meses(opcao.vigenciaMeses)} ·{" "}
        {moeda(opcao.valorUnitario)}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {opcao.porAno.map((ano) => (
          <li
            key={ano.ano}
            className="rounded-full bg-info-soft px-2.5 py-1 text-xs text-on-info-soft"
          >
            {ano.ano}: {ano.vagasDisponiveis} de {ano.planejadas} vagas livres
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EditarBolsaConcedida({
  bolsa,
}: {
  bolsa: BolsaConcedidaDetalhe;
}) {
  return (
    <AbrirSidesheet
      rotulo="Atualizar bolsa"
      variante="secundaria"
      titulo={`${bolsa.bolsista} · ${bolsa.modalidade}`}
      descricao="Corrija o período ou registre conclusão, cancelamento e interrupção."
    >
      {(fechar) => <FormEditarBolsa bolsa={bolsa} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormEditarBolsa({
  bolsa,
  aoConcluir,
}: {
  bolsa: BolsaConcedidaDetalhe;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    atualizarBolsaConcedida.bind(null, bolsa.id),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form action={executar} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Grade>
          <Data
            rotulo="Data inicial"
            nome="dataInicio"
            obrigatorio
            padrao={bolsa.dataInicio}
          />
          <Data
            rotulo="Data final"
            nome="dataFim"
            obrigatorio
            padrao={bolsa.dataFim}
          />
        </Grade>
        <Selecao
          rotulo="Situação registrada"
          nome="status"
          padrao={bolsa.status}
          opcoes={[
            { valor: "SELECIONADO", texto: "Selecionado" },
            { valor: "EM_ANDAMENTO", texto: "Em andamento" },
            { valor: "CONCLUIDA", texto: "Concluída" },
            { valor: "CANCELADA", texto: "Cancelada" },
            { valor: "INTERROMPIDA", texto: "Interrompida" },
          ]}
        />
        <Texto
          rotulo="Processo"
          nome="processo"
          padrao={bolsa.processo ?? undefined}
        />
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={4}
          padrao={bolsa.observacoes ?? undefined}
        />
      </div>
      <RodapeForm
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        aoCancelar={aoConcluir}
        rotulo="Salvar situação"
      />
    </form>
  );
}

function RodapeForm({
  enviando,
  erro,
  aoCancelar,
  rotulo: textoBotao,
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
          {enviando ? "Salvando…" : textoBotao}
        </button>
      </div>
    </div>
  );
}
