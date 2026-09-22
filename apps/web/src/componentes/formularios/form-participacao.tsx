"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState } from "react";
import { useForm } from "react-hook-form";

import {
  atualizarParticipacao,
  criarParticipacao,
  removerParticipacao,
} from "@/acoes/participacoes";
import { AreaTexto, Selecao } from "@/componentes/ui/campos";
import { submeterSemLimpar, useErrosDaAcao } from "@/componentes/ui/formulario";
import {
  CLASSE_CORPO_PAINEL,
  RodapeDoPainel,
} from "@/componentes/ui/painel-formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { ParticipacaoDaTematica } from "@/lib/dominio";
import {
  formularioEdicaoParticipacaoSchema,
  formularioParticipacaoSchema,
  participacaoVazia,
  SITUACOES_PARTICIPACAO,
  valoresDaParticipacao,
  type DadosEdicaoParticipacao,
  type DadosFormularioParticipacao,
} from "@/lib/formularios/participacao";

/**
 * Participação PPG–temática (V1-034).
 *
 * É o cadastro que torna um PPG novo utilizável no ciclo corrente. Antes disso
 * a linha de plano não tem par válido, e a equipe ficava travada esperando
 * migração.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  codigo: string;
}

export interface ReferenciasParticipacao {
  ppgs: { id: string; sigla: string; nome: string; jaParticipa: boolean }[];
  pessoas: { id: string; nome: string; email: string | null }[];
}

export function NovaParticipacao({
  contexto,
  referencias,
}: {
  contexto: Contexto;
  referencias: ReferenciasParticipacao;
}) {
  // Os que já participam saem da lista: a API recusaria, e oferecer a opção
  // para depois recusá-la faz a pessoa descobrir a regra pelo erro.
  const disponiveis = referencias.ppgs.filter((ppg) => !ppg.jaParticipa);

  return (
    <AbrirSidesheet
      rotulo="Associar PPG"
      titulo="Associar PPG a esta temática"
      descricao="O vínculo é o que torna o PPG utilizável no plano deste ciclo."
    >
      {(fechar) => (
        <ConteudoNovaParticipacao
          contexto={contexto}
          disponiveis={disponiveis}
          pessoas={referencias.pessoas}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * A lista é congelada quando o painel abre.
 *
 * Associar o último PPG disponível revalida a página, e a lista nova chega
 * vazia **antes** de o painel fechar: sem o congelamento, o formulário era
 * trocado pela mensagem "todos já participam" e o painel ficava aberto sobre
 * um cadastro que já tinha dado certo (achado da V1-059).
 */
function ConteudoNovaParticipacao({
  contexto,
  disponiveis,
  pessoas,
  aoConcluir,
}: {
  contexto: Contexto;
  disponiveis: ReferenciasParticipacao["ppgs"];
  pessoas: ReferenciasParticipacao["pessoas"];
  aoConcluir: () => void;
}) {
  const [ppgs] = useState(disponiveis);
  if (ppgs.length === 0) {
    return (
      <div className={CLASSE_CORPO_PAINEL}>
        <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
          Todos os PPGs cadastrados já participam desta temática. Cadastre o
          programa em <strong>PPGs</strong> antes de associá-lo aqui.
        </p>
      </div>
    );
  }
  return (
    <FormParticipacao
      acao={criarParticipacao.bind(null, contexto)}
      ppgs={ppgs}
      pessoas={pessoas}
      aoConcluir={aoConcluir}
      rotulo="Associar"
    />
  );
}

export function EditarParticipacao({
  contexto,
  participacao,
  referencias,
}: {
  contexto: Contexto;
  participacao: ParticipacaoDaTematica;
  referencias: ReferenciasParticipacao;
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo={`Participação de ${participacao.sigla}`}
      descricao="Trocar o responsável não transfere acesso nenhum: quem sai continua com o que lhe foi concedido, e quem entra continua sem."
    >
      {(fechar) => (
        <FormParticipacao
          acao={atualizarParticipacao.bind(null, {
            ...contexto,
            id: participacao.id,
          })}
          ppgFixo={`${participacao.sigla} — ${participacao.ppg}`}
          pessoas={referencias.pessoas}
          valores={valoresDaParticipacao(participacao)}
          aoConcluir={fechar}
          rotulo="Salvar"
        />
      )}
    </AbrirSidesheet>
  );
}

/**
 * Remoção.
 *
 * O botão **não é desabilitado** quando a API vai recusar: participação que
 * sustenta linha de plano ou bolsa é recusada com a contagem e o que fazer, e
 * desabilitar esconderia o motivo. É a mesma escolha da remoção de produto.
 */
export function RemoverParticipacao({
  contexto,
  participacao,
}: {
  contexto: Contexto;
  participacao: ParticipacaoDaTematica;
}) {
  const [estado, executar, enviando] = useActionState(
    removerParticipacao.bind(null, { ...contexto, id: participacao.id }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="inline"
    >
      <button
        type="submit"
        disabled={enviando}
        className="text-sm font-medium text-danger hover:underline disabled:opacity-60"
      >
        {enviando ? "Removendo…" : "Remover"}
      </button>
      {!estado.ok && estado.mensagem ? (
        <p role="alert" className="mt-1 text-xs text-danger">
          {estado.mensagem}
        </p>
      ) : null}
    </form>
  );
}

function FormParticipacao({
  acao,
  ppgs,
  ppgFixo,
  pessoas,
  valores,
  aoConcluir,
  rotulo,
}: {
  acao: (
    anterior: EstadoDaAcao,
    dados: never,
  ) => Promise<EstadoDaAcao>;
  ppgs?: { id: string; sigla: string; nome: string }[];
  ppgFixo?: string;
  pessoas: { id: string; nome: string; email: string | null }[];
  valores?: DadosEdicaoParticipacao;
  aoConcluir: () => void;
  rotulo: string;
}) {
  const edicao = ppgFixo !== undefined;
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DadosFormularioParticipacao>({
    resolver: zodResolver(
      (edicao
        ? formularioEdicaoParticipacaoSchema
        : formularioParticipacaoSchema) as never,
    ),
    defaultValues: (valores ?? participacaoVazia()) as never,
  });
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, {
    ppgId: "ppgId",
    coordenadorTematicaId: "coordenadorTematicaId",
    situacao: "situacao",
    modalidadesPrevistas: "modalidadesPrevistas",
    observacoes: "observacoes",
  });

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados as never)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        {/*
          Na edição o PPG vira texto, e não campo desabilitado: trocar o PPG de
          uma participação existente não é editar, é desfazer um vínculo e criar
          outro — a linha de plano que aponta para o par antigo passaria a
          descrever um programa que ninguém decidiu. A saída é remover e
          associar de novo.
        */}
        {edicao ? (
          <dl className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm">
            <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
              PPG
            </dt>
            <dd className="mt-1 font-medium text-foreground">{ppgFixo}</dd>
            <dd className="mt-1 text-xs text-muted">
              Para mudar o PPG, remova esta participação e associe o programa
              correto.
            </dd>
          </dl>
        ) : (
          <Selecao
            rotulo="PPG"
            nome="ppgId"
            obrigatorio
            registro={register("ppgId")}
            erro={errors.ppgId?.message}
            vazio="Selecione o programa"
            opcoes={(ppgs ?? []).map((ppg) => ({
              valor: ppg.id,
              texto: `${ppg.sigla} — ${ppg.nome}`,
            }))}
          />
        )}

        <Selecao
          rotulo="Coordenador de Temática"
          nome="coordenadorTematicaId"
          obrigatorio
          registro={register("coordenadorTematicaId")}
          erro={errors.coordenadorTematicaId?.message}
          vazio="Selecione o responsável"
          opcoes={pessoas.map((pessoa) => ({
            valor: pessoa.id,
            texto: pessoa.email
              ? `${pessoa.nome} (${pessoa.email})`
              : pessoa.nome,
          }))}
          dica="Responde por este PPG dentro da temática. A designação não concede acesso — isso continua sendo feito em Acessos."
        />

        <Selecao
          rotulo="Situação"
          nome="situacao"
          obrigatorio
          registro={register("situacao")}
          erro={errors.situacao?.message}
          opcoes={SITUACOES_PARTICIPACAO.map((item) => ({ ...item }))}
        />

        <AreaTexto
          rotulo="Modalidades previstas"
          nome="modalidadesPrevistas"
          linhas={2}
          registro={register("modalidadesPrevistas")}
          erro={errors.modalidadesPrevistas?.message}
          dica="Texto livre: descreve a intenção, não alimenta cálculo nenhum."
        />

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
