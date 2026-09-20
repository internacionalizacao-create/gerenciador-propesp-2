"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState } from "react";
import { useForm } from "react-hook-form";

import {
  alternarConvenio,
  atualizarConvenio,
  criarConvenio,
} from "@/acoes/convenios";
import {
  AreaTexto,
  Data,
  Grade,
  Selecao,
  Selecoes,
  Texto,
} from "@/componentes/ui/campos";
import { submeterSemLimpar, useErrosDaAcao } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { ConvenioDoHistorico, ReferenciaNomeada } from "@/lib/dominio";
import {
  convenioVazio,
  formularioConvenioSchema,
  SITUACOES_CONVENIO,
  TIPOS_ACORDO,
  valoresDoConvenio,
  type DadosFormularioConvenio,
} from "@/lib/formularios/convenio";

/**
 * Cadastro e edição de acordos (V1-032).
 *
 * O acordo é do **parceiro**, não da missão (CG-056): por isso o formulário
 * mora na página da instituição, e a missão de origem é apenas um campo. Quem
 * abre um acordo a partir de uma missão continua vendo-o aqui, e ele continua
 * valendo depois que a missão encerra.
 */

export interface ReferenciasConvenio {
  redes: ReferenciaNomeada[];
  /** Missões do ciclo, para registrar de onde o acordo nasceu. */
  missoes: { id: string; codigo: string; titulo: string }[];
}

export function NovoConvenio({
  instituicaoId,
  referencias,
}: {
  instituicaoId: string;
  referencias: ReferenciasConvenio;
}) {
  return (
    <AbrirSidesheet
      rotulo="Cadastrar acordo"
      titulo="Cadastrar acordo"
      descricao="O acordo pertence à instituição e sobrevive à missão que o originou."
    >
      {(fechar) => (
        <FormConvenio
          acao={criarConvenio.bind(null, instituicaoId)}
          referencias={referencias}
          aoConcluir={fechar}
          rotulo="Cadastrar"
        />
      )}
    </AbrirSidesheet>
  );
}

export function EditarConvenio({
  convenio,
  referencias,
}: {
  convenio: ConvenioDoHistorico;
  referencias: ReferenciasConvenio;
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Editar ${convenio.titulo}`}
      descricao="Os produtos que apontam para este acordo continuam ligados a ele."
    >
      {(fechar) => (
        <FormConvenio
          acao={atualizarConvenio.bind(null, convenio.id)}
          valores={valoresDoConvenio(convenio)}
          referencias={referencias}
          aoConcluir={fechar}
          rotulo="Salvar"
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Inativar e reativar — não existe excluir.
 *
 * O produto do tipo convênio aponta para o acordo, e a FK é `restrict`: apagar
 * deixaria o produto sem o acordo que o `check` bicondicional exige. A
 * justificativa é obrigatória nos dois sentidos, porque reativar também é ato
 * que alguém precisa explicar depois.
 */
export function AlternarConvenio({
  convenio,
}: {
  convenio: ConvenioDoHistorico;
}) {
  return (
    <AbrirSidesheet
      rotulo={convenio.ativo ? "Inativar" : "Reativar"}
      variante="secundaria"
      titulo={`${convenio.ativo ? "Inativar" : "Reativar"} ${convenio.titulo}`}
      descricao={
        convenio.ativo
          ? "O acordo sai da lista padrão e continua no histórico. Os produtos que o citam permanecem intactos."
          : "O acordo volta a valer. A reativação também fica registrada."
      }
    >
      {(fechar) => (
        <FormJustificativaConvenio
          convenio={convenio}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormJustificativaConvenio({
  convenio,
  aoConcluir,
}: {
  convenio: ConvenioDoHistorico;
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    async (anterior: EstadoDaAcao, formulario: FormData) =>
      alternarConvenio({ id: convenio.id, ativo: convenio.ativo }, anterior, {
        justificativa: String(formulario.get("justificativa") ?? ""),
      }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={4}
          dica={
            convenio.ativo
              ? "Explique por que o acordo não deve mais constar como vigente. O texto vai para a auditoria."
              : "Registre por que o acordo voltou a valer."
          }
        />
      </div>
      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotulo={convenio.ativo ? "Inativar acordo" : "Reativar acordo"}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

function FormConvenio({
  acao,
  valores,
  referencias,
  aoConcluir,
  rotulo,
}: {
  acao: (
    anterior: EstadoDaAcao,
    dados: DadosFormularioConvenio,
  ) => Promise<EstadoDaAcao>;
  valores?: DadosFormularioConvenio;
  referencias: ReferenciasConvenio;
  aoConcluir: () => void;
  rotulo: string;
}) {
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioConvenio>({
    resolver: zodResolver(formularioConvenioSchema),
    defaultValues: valores ?? convenioVazio(),
  });
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, {
    titulo: "titulo",
    tipoAcordo: "tipoAcordo",
    area: "area",
    objetivo: "objetivo",
    situacao: "situacao",
    numeroProcesso: "numeroProcesso",
    dataAssinatura: "dataAssinatura",
    dataInicio: "dataInicio",
    dataFim: "dataFim",
    observacoes: "observacoes",
    missaoOrigemId: "missaoOrigemId",
    redesIds: "redesIds",
  });

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <Texto
          rotulo="Título do acordo"
          nome="titulo"
          obrigatorio
          registro={register("titulo")}
          erro={errors.titulo?.message}
          placeholder="Acordo de cooperação acadêmica com…"
        />
        <Grade>
          <Selecao
            rotulo="Tipo de acordo"
            nome="tipoAcordo"
            obrigatorio
            registro={register("tipoAcordo")}
            erro={errors.tipoAcordo?.message}
            opcoes={TIPOS_ACORDO.map((item) => ({ ...item }))}
          />
          <Selecao
            rotulo="Situação"
            nome="situacao"
            obrigatorio
            registro={register("situacao")}
            erro={errors.situacao?.message}
            opcoes={SITUACOES_CONVENIO.map((item) => ({ ...item }))}
            dica="Vigente exige a data de assinatura."
          />
        </Grade>
        <Grade>
          <Texto
            rotulo="Área"
            nome="area"
            registro={register("area")}
            erro={errors.area?.message}
            placeholder="Engenharia ambiental"
          />
          <Texto
            rotulo="Número do processo"
            nome="numeroProcesso"
            registro={register("numeroProcesso")}
            erro={errors.numeroProcesso?.message}
          />
        </Grade>
        <AreaTexto
          rotulo="Objetivo"
          nome="objetivo"
          linhas={3}
          registro={register("objetivo")}
          erro={errors.objetivo?.message}
        />
        <Grade>
          <Data
            rotulo="Assinatura"
            nome="dataAssinatura"
            registro={register("dataAssinatura")}
            erro={errors.dataAssinatura?.message}
          />
          <Data
            rotulo="Início da vigência"
            nome="dataInicio"
            registro={register("dataInicio")}
            erro={errors.dataInicio?.message}
          />
        </Grade>
        <Data
          rotulo="Fim da vigência"
          nome="dataFim"
          registro={register("dataFim")}
          erro={errors.dataFim?.message}
          dica="Deixe em branco para vigência indeterminada — ela existe, e uma data inventada seria pior."
        />

        {referencias.missoes.length > 0 ? (
          <Selecao
            rotulo="Missão de origem"
            nome="missaoOrigemId"
            registro={register("missaoOrigemId")}
            erro={errors.missaoOrigemId?.message}
            opcoes={[
              { valor: "", texto: "Acordo firmado fora de missão" },
              ...referencias.missoes.map((missao) => ({
                valor: missao.id,
                texto: `${missao.codigo} — ${missao.titulo}`,
              })),
            ]}
            dica="Só registra de onde o acordo nasceu. Ele não passa a pertencer à missão."
          />
        ) : null}

        {referencias.redes.length > 0 ? (
          <Selecoes
            rotulo="Redes"
            nome="redesIds"
            registro={register("redesIds")}
            erro={errors.redesIds?.message}
            opcoes={referencias.redes.map((rede) => ({
              valor: rede.id,
              texto: rede.nome,
            }))}
          />
        ) : null}

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          registro={register("observacoes")}
          erro={errors.observacoes?.message}
        />
      </div>

      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotulo={rotulo}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}
