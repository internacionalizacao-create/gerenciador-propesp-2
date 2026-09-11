"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  declararSemProduto,
  reabrirRespostaProdutos,
  registrarAtividadeExtra,
  relatarMissao,
} from "@/acoes/relato";
import { CampoCombobox } from "@/componentes/ui/campo-combobox";
import { AreaTexto, Data, Grade, Selecao, Texto } from "@/componentes/ui/campos";
import { useErrosDaAcao } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { MissaoDetalhe, ReferenciasMissao } from "@/lib/dominio";
import {
  formularioAtividadeExtraSchema,
  formularioRelatoSchema,
  type DadosFormularioAtividadeExtra,
  type DadosFormularioRelato,
} from "@/lib/formularios/relato-missao";

/**
 * Relato da missão (CG-046).
 *
 * São **dois** formulários, e a separação foi decisão de 2026-09-06: o relato
 * edita o que estava planejado, e um botão à parte acrescenta a parada extra.
 * Juntá-los faria quem só quer corrigir uma frase percorrer um cadastro
 * inteiro de atividade.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const TIPOS = [
  { valor: "VISITA_TECNICA", texto: "Visita técnica" },
  { valor: "EVENTO", texto: "Evento" },
  { valor: "ARTICULACAO", texto: "Articulação" },
  { valor: "BANCA", texto: "Banca" },
  { valor: "OUTRO", texto: "Outro" },
];

const SITUACOES = [
  { valor: "PLANEJADA", texto: "Ainda sem desfecho" },
  { valor: "REALIZADA", texto: "Realizada" },
  { valor: "NAO_REALIZADA", texto: "Não realizada" },
];

const AVALIACOES = [
  { valor: "SIM", texto: "Sim, integralmente" },
  { valor: "PARCIALMENTE", texto: "Parcialmente" },
  { valor: "NAO", texto: "Não" },
];

// A API devolve o caminho aninhado; a tela usa o mesmo nome, então o mapa só
// precisa dos campos de primeiro nível.
const CAMPOS_DA_API = {
  relatoGeral: "relatoGeral",
  resultados: "resultados",
  avaliacaoObjetivos: "avaliacaoObjetivos",
  avaliacaoJustificativa: "avaliacaoJustificativa",
  desdobramentos: "desdobramentos",
} as const;

export function RegistrarRelato({
  contexto,
  missao,
}: {
  contexto: Contexto;
  missao: MissaoDetalhe;
}) {
  const inedito = !missao.relatoGeral;

  return (
    <AbrirSidesheet
      rotulo={inedito ? "Registrar relato" : "Editar relato"}
      variante={inedito ? undefined : "secundaria"}
      titulo="Relato da missão"
      descricao="O que aconteceu, atividade por atividade. Nada aqui altera o planejamento: previsto e realizado ficam distinguíveis depois."
    >
      {(fechar) => (
        <FormRelato contexto={contexto} missao={missao} aoConcluir={fechar} />
      )}
    </AbrirSidesheet>
  );
}

function FormRelato({
  contexto,
  missao,
  aoConcluir,
}: {
  contexto: Contexto;
  missao: MissaoDetalhe;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    relatarMissao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioRelato>({
    resolver: zodResolver(formularioRelatoSchema),
    defaultValues: {
      relatoGeral: missao.relatoGeral ?? "",
      resultados: missao.resultados ?? "",
      avaliacaoObjetivos: missao.avaliacaoObjetivos ?? "",
      avaliacaoJustificativa: missao.avaliacaoJustificativa ?? "",
      desdobramentos: missao.desdobramentos ?? "",
      atividades: missao.atividades.map((atividade) => ({
        id: atividade.id,
        titulo: atividade.titulo,
        status: atividade.status,
        relatoRealizado: atividade.relatoRealizado ?? "",
        resultados: atividade.resultados ?? "",
        observacoes: atividade.observacoes ?? "",
      })),
    },
  });

  useErrosDaAcao(estado, setError, CAMPOS_DA_API);

  const avaliacao = useWatch({ control, name: "avaliacaoObjetivos" });
  const atividades = useWatch({ control, name: "atividades" });

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form onSubmit={aoEnviar} className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto px-1 pb-4">
        <AreaTexto
          rotulo="Relato geral"
          nome="relatoGeral"
          obrigatorio
          linhas={5}
          registro={register("relatoGeral")}
          erro={errors.relatoGeral?.message}
          dica="O que aconteceu na missão, em texto corrido."
        />
        <AreaTexto
          rotulo="Resultados e encaminhamentos"
          nome="resultados"
          linhas={4}
          registro={register("resultados")}
          erro={errors.resultados?.message}
        />

        <fieldset className="space-y-4 rounded-2xl border border-border p-4">
          <legend className="px-1 text-sm font-semibold text-foreground">
            Alcance dos objetivos
          </legend>
          <Selecao
            rotulo="A missão alcançou o que se propunha?"
            nome="avaliacaoObjetivos"
            vazio="Ainda não respondido"
            opcoes={AVALIACOES}
            registro={register("avaliacaoObjetivos")}
            erro={errors.avaliacaoObjetivos?.message}
            dica="O encerramento exige esta resposta."
          />
          {/* Justificativa só quando não foi plenamente alcançado: "atingiu"
              não precisa de explicação, "não atingiu" precisa. */}
          {avaliacao === "PARCIALMENTE" || avaliacao === "NAO" ? (
            <AreaTexto
              rotulo="Por quê?"
              nome="avaliacaoJustificativa"
              obrigatorio
              linhas={3}
              registro={register("avaliacaoJustificativa")}
              erro={errors.avaliacaoJustificativa?.message}
            />
          ) : null}
          <AreaTexto
            rotulo="Desdobramentos"
            nome="desdobramentos"
            linhas={3}
            registro={register("desdobramentos")}
            erro={errors.desdobramentos?.message}
            dica="O que a missão desdobra depois de encerrada: acordos, visitas, projetos."
          />
        </fieldset>

        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">
            Roteiro
            <span className="ml-2 font-normal text-muted">
              {missao.atividades.length}{" "}
              {missao.atividades.length === 1 ? "parada" : "paradas"}
            </span>
          </h3>
          {missao.atividades.map((atividade, indice) => (
            <fieldset
              key={atividade.id}
              className="space-y-3 rounded-2xl border border-border p-4"
            >
              <legend className="px-1 text-sm font-medium text-foreground">
                {atividade.titulo}
                {atividade.naoPrevista ? (
                  <span className="ml-2 text-xs font-normal text-muted">
                    não prevista
                  </span>
                ) : null}
              </legend>
              <input
                type="hidden"
                {...register(`atividades.${indice}.id` as const)}
              />
              <input
                type="hidden"
                {...register(`atividades.${indice}.titulo` as const)}
              />
              <Selecao
                rotulo="Situação"
                nome={`atividades.${indice}.status`}
                opcoes={SITUACOES}
                registro={register(`atividades.${indice}.status` as const)}
                erro={errors.atividades?.[indice]?.status?.message}
              />
              {/* Só quem foi realizada precisa dizer o quê. Pedir o relato de
                  uma parada que não aconteceu inverteria a pergunta. */}
              {atividades?.[indice]?.status === "REALIZADA" ? (
                <>
                  <AreaTexto
                    rotulo="O que foi realizado"
                    nome={`atividades.${indice}.relatoRealizado`}
                    obrigatorio
                    linhas={3}
                    registro={register(
                      `atividades.${indice}.relatoRealizado` as const,
                    )}
                    erro={
                      errors.atividades?.[indice]?.relatoRealizado?.message
                    }
                  />
                  <AreaTexto
                    rotulo="Resultados"
                    nome={`atividades.${indice}.resultados`}
                    linhas={2}
                    registro={register(
                      `atividades.${indice}.resultados` as const,
                    )}
                  />
                </>
              ) : null}
              <AreaTexto
                rotulo="Observações"
                nome={`atividades.${indice}.observacoes`}
                linhas={2}
                registro={register(
                  `atividades.${indice}.observacoes` as const,
                )}
              />
            </fieldset>
          ))}
        </div>

        <NotaDeErro estado={estado} />
      </div>
      <Rodape
        aoConcluir={aoConcluir}
        enviando={enviando}
        rotulo="Salvar relato"
      />
    </form>
  );
}

/**
 * Parada que aconteceu sem constar do roteiro.
 *
 * Só aparece quando já existe relato: o endpoint é o mesmo e exige o texto
 * geral, então antes disso não há a que anexar a atividade extra.
 */
export function NovaAtividadeExtra({
  contexto,
  missao,
  referencias,
}: {
  contexto: Contexto;
  missao: MissaoDetalhe;
  referencias: ReferenciasMissao;
}) {
  if (!missao.relatoGeral) return null;

  return (
    <AbrirSidesheet
      rotulo="Atividade não prevista"
      variante="secundaria"
      titulo="Registrar atividade não prevista"
      descricao="Uma parada que aconteceu fora do roteiro. Ela entra como realizada e exige justificativa da inclusão — o roteiro planejado não é alterado."
    >
      {(fechar) => (
        <FormAtividadeExtra
          contexto={contexto}
          missao={missao}
          referencias={referencias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormAtividadeExtra({
  contexto,
  missao,
  referencias,
  aoConcluir,
}: {
  contexto: Contexto;
  missao: MissaoDetalhe;
  referencias: ReferenciasMissao;
  aoConcluir: () => void;
}) {
  const acao = registrarAtividadeExtra.bind(null, {
    ...contexto,
    relatoAtual: {
      relatoGeral: missao.relatoGeral ?? "",
      resultados: missao.resultados,
      avaliacaoObjetivos: missao.avaliacaoObjetivos,
      avaliacaoJustificativa: missao.avaliacaoJustificativa,
      desdobramentos: missao.desdobramentos,
    },
  });
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  useToastDaAcao(estado, aoConcluir);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<DadosFormularioAtividadeExtra>({
    resolver: zodResolver(formularioAtividadeExtraSchema),
    defaultValues: {
      tipo: "ARTICULACAO",
      titulo: "",
      paisId: "",
      cidade: "",
      modoInstituicao: "nenhuma",
      instituicaoId: "",
      instituicaoNome: "",
      eventoNome: "",
      dataInicio: "",
      dataFim: "",
      justificativa: "",
      relatoRealizado: "",
      resultados: "",
      observacoes: "",
    },
  });

  const tipo = useWatch({ control, name: "tipo" });
  const modoInstituicao = useWatch({ control, name: "modoInstituicao" });

  const aoEnviar = handleSubmit((dados) => {
    startTransition(() => executar(dados));
  });

  return (
    <form onSubmit={aoEnviar} className="flex h-full flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <Grade>
          <Selecao
            rotulo="Tipo"
            nome="tipo"
            opcoes={TIPOS}
            registro={register("tipo")}
            erro={errors.tipo?.message}
          />
          <Texto
            rotulo="Título"
            nome="titulo"
            obrigatorio
            registro={register("titulo")}
            erro={errors.titulo?.message}
          />
        </Grade>

        {tipo === "EVENTO" ? (
          <Texto
            rotulo="Nome do evento"
            nome="eventoNome"
            obrigatorio
            registro={register("eventoNome")}
            erro={errors.eventoNome?.message}
          />
        ) : null}

        <Grade>
          <CampoCombobox
            rotulo="País"
            nome="paisId"
            control={control}
            obrigatorio
            opcoes={referencias.paises.map((pais) => ({
              valor: pais.id,
              rotulo: pais.nome,
              termos: pais.codigoIso2,
            }))}
            erro={errors.paisId?.message}
            placeholder="Selecione o país"
            placeholderBusca="Buscar país"
          />
          <Texto
            rotulo="Cidade"
            nome="cidade"
            registro={register("cidade")}
            erro={errors.cidade?.message}
          />
        </Grade>

        <Selecao
          rotulo="Instituição"
          nome="modoInstituicao"
          opcoes={[
            { valor: "nenhuma", texto: "Não se aplica" },
            { valor: "catalogo", texto: "Do catálogo de parceiros" },
            { valor: "livre", texto: "Informar o nome" },
          ]}
          registro={register("modoInstituicao")}
          dica="Prefira o catálogo: é o que liga a parada ao histórico do parceiro."
        />
        {modoInstituicao === "catalogo" ? (
          <CampoCombobox
            rotulo="Parceiro"
            nome="instituicaoId"
            control={control}
            opcoes={referencias.instituicoes.map((instituicao) => ({
              valor: instituicao.id,
              rotulo: instituicao.nome,
              detalhe: [instituicao.sigla, instituicao.cidade]
                .filter(Boolean)
                .join(" · "),
            }))}
            erro={errors.instituicaoId?.message}
            placeholder="Selecione o parceiro"
            placeholderBusca="Buscar parceiro"
          />
        ) : null}
        {modoInstituicao === "livre" ? (
          <Texto
            rotulo="Nome da instituição"
            nome="instituicaoNome"
            obrigatorio
            registro={register("instituicaoNome")}
            erro={errors.instituicaoNome?.message}
          />
        ) : null}

        <Grade>
          <Data
            rotulo="Início"
            nome="dataInicio"
            obrigatorio
            registro={register("dataInicio")}
            erro={errors.dataInicio?.message}
          />
          <Data
            rotulo="Fim"
            nome="dataFim"
            obrigatorio
            registro={register("dataFim")}
            erro={errors.dataFim?.message}
          />
        </Grade>

        <AreaTexto
          rotulo="Justificativa da inclusão"
          nome="justificativa"
          obrigatorio
          linhas={3}
          registro={register("justificativa")}
          erro={errors.justificativa?.message}
          dica="Por que esta parada entrou sem constar do roteiro aprovado."
        />
        <AreaTexto
          rotulo="O que foi realizado"
          nome="relatoRealizado"
          obrigatorio
          linhas={3}
          registro={register("relatoRealizado")}
          erro={errors.relatoRealizado?.message}
        />
        <AreaTexto
          rotulo="Resultados"
          nome="resultados"
          linhas={2}
          registro={register("resultados")}
          erro={errors.resultados?.message}
        />
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={2}
          registro={register("observacoes")}
          erro={errors.observacoes?.message}
        />

        <NotaDeErro estado={estado} />
      </div>
      <Rodape
        aoConcluir={aoConcluir}
        enviando={enviando}
        rotulo="Registrar atividade"
      />
    </form>
  );
}

function Rodape({
  aoConcluir,
  enviando,
  rotulo,
}: {
  aoConcluir: () => void;
  enviando: boolean;
  rotulo: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-border pt-4">
      <button
        type="button"
        onClick={aoConcluir}
        className="rounded-lg px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted"
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
  );
}

function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;

  return (
    <p
      role="alert"
      className="mt-3 rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}

/**
 * Resposta "a missão gerou produto?" (CG-056), pela tela.
 *
 * Só a negativa tem formulário. O "sim" se responde cadastrando o produto — e
 * é por isso que não há um botão "Sim" aqui: ele gravaria uma afirmação sem
 * nada que a sustente, e a tela passaria a mostrar "gerou produto" com a lista
 * vazia.
 */
export function DeclararSemProduto({ contexto }: { contexto: Contexto }) {
  return (
    <AbrirSidesheet
      rotulo="Declarar sem produto"
      variante="secundaria"
      titulo="A missão não gerou produto"
      descricao="A resposta negativa fica registrada com autor e data. Não é o mesmo que a lista estar vazia — o encerramento exige a resposta."
    >
      {(fechar) => <FormSemProduto contexto={contexto} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}

function FormSemProduto({
  contexto,
  aoConcluir,
}: {
  contexto: Contexto;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    declararSemProduto.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        startTransition(() => executar(dados));
      }}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          linhas={3}
          dica="Opcional, mas fica no histórico ao lado da resposta."
          erro={
            estado.erros?.find((erro) => erro.campo === "justificativa")
              ?.mensagem
          }
        />
        <NotaDeErro estado={estado} />
      </div>
      <Rodape
        aoConcluir={aoConcluir}
        enviando={enviando}
        rotulo="Registrar resposta"
      />
    </form>
  );
}

/** Desfaz a declaração negativa — a pergunta volta a ficar sem resposta. */
export function ReabrirRespostaProdutos({ contexto }: { contexto: Contexto }) {
  const [estado, executar, enviando] = useActionState(
    reabrirRespostaProdutos.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <div>
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          startTransition(() => executar());
        }}
      >
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-primary disabled:opacity-60"
        >
          {enviando ? "Desfazendo…" : "Desfazer resposta"}
        </button>
      </form>
      <NotaDeErro estado={estado} />
    </div>
  );
}
