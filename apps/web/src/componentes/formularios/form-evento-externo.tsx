"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { startTransition, useActionState, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  anexarComprovante,
  corrigirEventoBolsista,
  corrigirMovimentacao,
  registrarEventoBolsista,
  registrarMovimentacao,
} from "@/acoes/eventos-externos";
import {
  AreaTexto,
  Data,
  Grade,
  Selecao,
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
import type {
  EventoBolsista,
  EventosDaBolsa,
  Movimentacao,
  ReferenciasMovimentacao,
  StatusBolsaConcedida,
  TipoEventoBolsista,
} from "@/lib/dominio";
import {
  consequenciasDoTipo,
  eventoVazio,
  formularioCorrecaoEventoSchema,
  formularioCorrecaoMovimentacaoSchema,
  formularioEventoSchema,
  formularioMovimentacaoSchema,
  movimentacaoVazia,
  RUBRICAS_MOVIMENTACAO,
  tiposElegiveis,
  valoresDaMovimentacao,
  valoresDoEvento,
  type DadosCorrecaoEvento,
  type DadosCorrecaoMovimentacao,
  type DadosFormularioEvento,
  type DadosFormularioMovimentacao,
} from "@/lib/formularios/eventos-externos";
import { rotulo } from "@/lib/formato";

/**
 * Registro dos eventos externos da CAPES (V1-037).
 *
 * **O formulário registra o que a CAPES já fez**, e cada texto daqui evita
 * sugerir outra coisa: não há "solicitar", "aprovar" nem "autorizar". A data do
 * ato é a da CAPES; a do registro o sistema grava sozinho, e por isso não é
 * campo.
 */

const CAMPOS_EVENTO = {
  tipo: "tipo",
  dataAto: "dataAto",
  justificativa: "justificativa",
  referenciaExterna: "referenciaExterna",
  previsaoRetorno: "previsaoRetorno",
  bolsaSubstitutaId: "bolsaSubstitutaId",
  motivo: "motivo",
} as const;

const CAMPOS_MOVIMENTACAO = {
  dataAto: "dataAto",
  ano: "ano",
  areaTematicaId: "areaTematicaId",
  ppgOrigemId: "ppgOrigemId",
  ppgDestinoId: "ppgDestinoId",
  rubrica: "rubrica",
  modalidadeId: "modalidadeId",
  quantidade: "quantidade",
  valor: "valor",
  justificativa: "justificativa",
  referenciaExterna: "referenciaExterna",
  observacoes: "observacoes",
  motivo: "motivo",
} as const;

/** Uma chave por formulário aberto: o painel remonta a cada abertura. */
function useChaveDeEnvio() {
  const [chave] = useState(() => crypto.randomUUID());
  return chave;
}

// ---------------------------------------------------------------------------
// Evento do beneficiário
// ---------------------------------------------------------------------------

export function RegistrarEventoBolsa({
  bolsaId,
  situacao,
  tipos,
  substitutas,
}: {
  bolsaId: string;
  situacao: StatusBolsaConcedida;
  tipos: TipoEventoBolsista[];
  substitutas: EventosDaBolsa["substitutas"];
}) {
  const elegiveis = tiposElegiveis(tipos, situacao);
  if (elegiveis.length === 0) return null;
  return (
    <AbrirSidesheet
      rotulo="Registrar evento"
      variante="secundaria"
      titulo="Registrar evento informado pela CAPES"
      descricao="Desistência, interrupção, substituição e outros atos que já aconteceram na plataforma da CAPES."
    >
      {(fechar) => (
        <FormEventoBolsa
          modo={{ tipo: "registro", bolsaId }}
          situacao={situacao}
          tipos={elegiveis}
          substitutas={substitutas}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

export function CorrigirEventoBolsa({
  evento,
  tipos,
  substitutas,
}: {
  evento: EventoBolsista;
  tipos: TipoEventoBolsista[];
  substitutas: EventosDaBolsa["substitutas"];
}) {
  // Na correcao, o tipo parte do estado que o evento fotografou.
  const elegiveis = tiposElegiveis(tipos, evento.statusAnterior);
  const atual = tipos.find((tipo) => tipo.codigo === evento.tipo);
  const opcoes =
    atual && !elegiveis.includes(atual) ? [atual, ...elegiveis] : elegiveis;
  return (
    <AbrirSidesheet
      rotulo="Corrigir"
      variante="secundaria"
      titulo={`Corrigir ${evento.tipoRotulo.toLowerCase()}`}
      descricao="O valor corrigido substitui o anterior, e a troca fica registrada com o motivo."
    >
      {(fechar) => (
        <FormEventoBolsa
          modo={{ tipo: "correcao", evento }}
          situacao={evento.statusAnterior}
          tipos={opcoes}
          substitutas={
            evento.bolsaSubstitutaId &&
            !substitutas.some((b) => b.id === evento.bolsaSubstitutaId)
              ? [
                  {
                    id: evento.bolsaSubstitutaId,
                    bolsista: evento.substituto ?? "Bolsa já vinculada",
                    status: "SELECIONADO",
                  },
                  ...substitutas,
                ]
              : substitutas
          }
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

type ModoEvento =
  | { tipo: "registro"; bolsaId: string }
  | { tipo: "correcao"; evento: EventoBolsista };

function FormEventoBolsa({
  modo,
  situacao,
  tipos,
  substitutas,
  aoConcluir,
}: {
  modo: ModoEvento;
  situacao: StatusBolsaConcedida;
  tipos: TipoEventoBolsista[];
  substitutas: EventosDaBolsa["substitutas"];
  aoConcluir: () => void;
}) {
  const chave = useChaveDeEnvio();
  const correcao = modo.tipo === "correcao";
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DadosCorrecaoEvento>({
    // O schema de correcao exige `motivo`; no registro ele fica de fora.
    resolver: zodResolver(
      (correcao
        ? formularioCorrecaoEventoSchema
        : formularioEventoSchema) as typeof formularioCorrecaoEventoSchema,
    ),
    defaultValues: correcao
      ? valoresDoEvento(modo.evento)
      : { ...eventoVazio(), motivo: "" },
  });
  const codigo = useWatch({ control, name: "tipo" });
  const tipo = tipos.find((item) => item.codigo === codigo);

  const [estado, executar, enviando] = useActionState(
    (anterior: EstadoDaAcao, dados: DadosCorrecaoEvento) =>
      modo.tipo === "correcao"
        ? corrigirEventoBolsista(
            {
              eventoId: modo.evento.id,
              bolsaId: modo.evento.bolsaConcedidaId,
              tipo,
            },
            anterior,
            dados,
          )
        : registrarEventoBolsista(
            { bolsaId: modo.bolsaId, chave, tipo },
            anterior,
            dados as DadosFormularioEvento,
          ),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, CAMPOS_EVENTO);

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <Selecao
          rotulo="Evento"
          nome="tipo"
          obrigatorio
          vazio="Selecione"
          registro={register("tipo")}
          erro={errors.tipo?.message}
          opcoes={tipos.map((item) => ({
            valor: item.codigo,
            texto: item.rotulo,
          }))}
          dica={`Só aparecem os eventos que se aplicam a bolsa com situação ${rotulo(situacao)}.`}
        />

        {tipo ? (
          <div
            className="mb-4 rounded-xl border-l-4 border-info bg-info-soft px-4 py-3 text-sm text-on-info-soft"
            aria-live="polite"
          >
            {tipo.descricao ? (
              <p className="mb-2 font-medium">{tipo.descricao}</p>
            ) : null}
            <ul className="list-disc space-y-1 pl-5">
              {consequenciasDoTipo(tipo, situacao).map((linha) => (
                <li key={linha}>{linha}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <Grade>
          <Data
            rotulo="Data do ato na CAPES"
            nome="dataAto"
            obrigatorio
            padrao={correcao ? valoresDoEvento(modo.evento).dataAto : undefined}
            registro={register("dataAto")}
            erro={errors.dataAto?.message}
            dica="Quando aconteceu na plataforma. A data deste registro é gravada automaticamente."
          />
          <Texto
            rotulo="Referência externa"
            nome="referenciaExterna"
            registro={register("referenciaExterna")}
            erro={errors.referenciaExterna?.message}
            placeholder="Ofício, processo ou e-mail"
          />
        </Grade>

        {tipo?.aceitaPrevisaoRetorno ? (
          <Data
            rotulo="Previsão de retorno"
            nome="previsaoRetorno"
            padrao={
              correcao ? valoresDoEvento(modo.evento).previsaoRetorno : undefined
            }
            registro={register("previsaoRetorno")}
            erro={errors.previsaoRetorno?.message}
          />
        ) : null}

        {tipo?.aceitaSubstituta ? (
          <Selecao
            rotulo="Bolsa que entra na vaga"
            nome="bolsaSubstitutaId"
            registro={register("bolsaSubstitutaId")}
            erro={errors.bolsaSubstitutaId?.message}
            opcoes={[
              { valor: "", texto: "Ainda não cadastrada" },
              ...substitutas.map((bolsa) => ({
                valor: bolsa.id,
                texto: `${bolsa.bolsista} · ${rotulo(bolsa.status)}`,
              })),
            ]}
            dica="Só aparecem bolsas da mesma linha planejada e exercício. Se o substituto ainda não foi cadastrado, registre agora e aponte depois, pela correção."
          />
        ) : null}

        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={4}
          registro={register("justificativa")}
          erro={errors.justificativa?.message}
          dica="O motivo informado pela CAPES. É o que explica este registro anos depois."
        />

        {correcao ? (
          <AreaTexto
            rotulo="Motivo da correção"
            nome="motivo"
            obrigatorio
            linhas={3}
            registro={register("motivo")}
            erro={errors.motivo?.message}
            dica="Vai para a trilha de auditoria junto com os campos alterados."
          />
        ) : null}
      </div>

      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotulo={correcao ? "Salvar correção" : "Registrar evento"}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Movimentação de recurso
// ---------------------------------------------------------------------------

export function RegistrarMovimentacao({
  programa,
  ciclo,
  referencias,
}: {
  programa: string;
  ciclo: string;
  referencias: ReferenciasMovimentacao;
}) {
  return (
    <AbrirSidesheet
      rotulo="Registrar movimentação"
      largura="larga"
      titulo="Registrar movimentação executada na CAPES"
      descricao="Recurso ou vaga que mudou de PPG dentro da mesma área temática. O teto da temática não muda."
    >
      {(fechar) => (
        <FormMovimentacao
          modo={{ tipo: "registro", programa, ciclo }}
          referencias={referencias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

export function CorrigirMovimentacao({
  movimentacao,
  referencias,
}: {
  movimentacao: Movimentacao;
  referencias: ReferenciasMovimentacao;
}) {
  return (
    <AbrirSidesheet
      rotulo="Corrigir"
      variante="secundaria"
      largura="larga"
      titulo={`Corrigir ${movimentacao.codigo}`}
      descricao="O valor corrigido substitui o anterior, e a troca fica registrada com o motivo."
    >
      {(fechar) => (
        <FormMovimentacao
          modo={{ tipo: "correcao", movimentacao }}
          referencias={referencias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

type ModoMovimentacao =
  | { tipo: "registro"; programa: string; ciclo: string }
  | { tipo: "correcao"; movimentacao: Movimentacao };

function FormMovimentacao({
  modo,
  referencias,
  aoConcluir,
}: {
  modo: ModoMovimentacao;
  referencias: ReferenciasMovimentacao;
  aoConcluir: () => void;
}) {
  const chave = useChaveDeEnvio();
  const correcao = modo.tipo === "correcao";
  const iniciais = correcao
    ? valoresDaMovimentacao(modo.movimentacao)
    : { ...movimentacaoVazia(referencias.anos[0]), motivo: "" };
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm<DadosCorrecaoMovimentacao>({
    resolver: zodResolver(
      (correcao
        ? formularioCorrecaoMovimentacaoSchema
        : formularioMovimentacaoSchema) as typeof formularioCorrecaoMovimentacaoSchema,
    ),
    defaultValues: iniciais,
  });
  const tematicaId = useWatch({ control, name: "areaTematicaId" });
  const rubrica = useWatch({ control, name: "rubrica" });
  const tematica = referencias.tematicas.find((item) => item.id === tematicaId);
  const ppgs = (tematica?.ppgs ?? []).map((ppg) => ({
    valor: ppg.id,
    texto: `${ppg.sigla} · ${ppg.nome}`,
  }));

  const [estado, executar, enviando] = useActionState(
    (anterior: EstadoDaAcao, dados: DadosCorrecaoMovimentacao) =>
      modo.tipo === "correcao"
        ? corrigirMovimentacao(modo.movimentacao.id, anterior, dados)
        : registrarMovimentacao(
            { programa: modo.programa, ciclo: modo.ciclo, chave },
            anterior,
            dados as DadosFormularioMovimentacao,
          ),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);
  useErrosDaAcao(estado, setError, CAMPOS_MOVIMENTACAO);

  return (
    <form
      onSubmit={handleSubmit((dados) =>
        startTransition(() => executar(dados)),
      )}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <Selecao
          rotulo="Área temática"
          nome="areaTematicaId"
          obrigatorio
          vazio="Selecione"
          registro={register("areaTematicaId")}
          erro={errors.areaTematicaId?.message}
          opcoes={referencias.tematicas.map((item) => ({
            valor: item.id,
            texto: `${item.rede} · ${item.codigo} — ${item.nome}`,
          }))}
          dica="Origem e destino saem da mesma temática: movimentação entre temáticas ou redes não é registrada."
        />
        <Grade>
          <Selecao
            rotulo="PPG que cedeu"
            nome="ppgOrigemId"
            obrigatorio
            vazio={tematica ? "Selecione" : "Escolha a temática primeiro"}
            registro={register("ppgOrigemId")}
            erro={errors.ppgOrigemId?.message}
            opcoes={ppgs}
          />
          <Selecao
            rotulo="PPG que recebeu"
            nome="ppgDestinoId"
            obrigatorio
            vazio={tematica ? "Selecione" : "Escolha a temática primeiro"}
            registro={register("ppgDestinoId")}
            erro={errors.ppgDestinoId?.message}
            opcoes={ppgs}
          />
        </Grade>
        <Grade>
          <Data
            rotulo="Data do ato na CAPES"
            nome="dataAto"
            obrigatorio
            padrao={correcao ? iniciais.dataAto : undefined}
            registro={register("dataAto")}
            erro={errors.dataAto?.message}
          />
          <Selecao
            rotulo="Exercício"
            nome="ano"
            obrigatorio
            registro={register("ano")}
            erro={errors.ano?.message}
            opcoes={referencias.anos.map((ano) => ({
              valor: String(ano),
              texto: String(ano),
            }))}
          />
        </Grade>
        <Grade>
          <Selecao
            rotulo="Rubrica"
            nome="rubrica"
            obrigatorio
            registro={register("rubrica")}
            erro={errors.rubrica?.message}
            opcoes={RUBRICAS_MOVIMENTACAO.map((item) => ({ ...item }))}
          />
          <Texto
            rotulo="Valor (R$)"
            nome="valor"
            obrigatorio
            registro={register("valor")}
            erro={errors.valor?.message}
            placeholder="82902,20"
          />
        </Grade>
        {rubrica === "BOLSAS" ? (
          <Grade>
            <Selecao
              rotulo="Modalidade"
              nome="modalidadeId"
              registro={register("modalidadeId")}
              erro={errors.modalidadeId?.message}
              opcoes={[
                { valor: "", texto: "Não informada" },
                ...referencias.modalidades.map((item) => ({
                  valor: item.id,
                  texto: item.nome,
                })),
              ]}
            />
            <Texto
              rotulo="Quantidade de bolsas"
              nome="quantidade"
              registro={register("quantidade")}
              erro={errors.quantidade?.message}
            />
          </Grade>
        ) : null}
        <Texto
          rotulo="Referência externa"
          nome="referenciaExterna"
          registro={register("referenciaExterna")}
          erro={errors.referenciaExterna?.message}
          placeholder="Ofício, processo ou e-mail"
        />
        <AreaTexto
          rotulo="Justificativa"
          nome="justificativa"
          obrigatorio
          linhas={3}
          registro={register("justificativa")}
          erro={errors.justificativa?.message}
          dica="O motivo informado pela CAPES para a movimentação."
        />
        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={2}
          registro={register("observacoes")}
          erro={errors.observacoes?.message}
        />
        <p className="mb-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
          O registro não altera o plano nem o teto da temática. Se a CAPES
          realocou uma vaga, ajuste a linha correspondente no plano de
          aplicação.
        </p>
        {correcao ? (
          <AreaTexto
            rotulo="Motivo da correção"
            nome="motivo"
            obrigatorio
            linhas={3}
            registro={register("motivo")}
            erro={errors.motivo?.message}
          />
        ) : null}
      </div>

      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotulo={correcao ? "Salvar correção" : "Registrar movimentação"}
        aoCancelar={aoConcluir}
      />
    </form>
  );
}

// ---------------------------------------------------------------------------
// Comprovante
// ---------------------------------------------------------------------------

const CATEGORIAS_COMPROVANTE = [
  { valor: "COMPROVANTE", texto: "Comprovante" },
  { valor: "DECLARACAO", texto: "Declaração" },
  { valor: "ATA", texto: "Ata" },
  { valor: "OUTRO", texto: "Outro" },
];

export function AnexarComprovante({
  entidadeTipo,
  entidadeId,
  bolsaId,
}: {
  entidadeTipo: "EVENTO_BOLSISTA" | "REMANEJAMENTO";
  entidadeId: string;
  bolsaId?: string;
}) {
  return (
    <AbrirSidesheet
      rotulo="Anexar comprovante"
      variante="secundaria"
      titulo="Anexar comprovante"
      descricao="O ofício ou e-mail da CAPES que registra o ato. Um arquivo por vez."
    >
      {(fechar) => (
        <FormComprovante
          contexto={{ entidadeTipo, entidadeId, bolsaId }}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormComprovante({
  contexto,
  aoConcluir,
}: {
  contexto: {
    entidadeTipo: "EVENTO_BOLSISTA" | "REMANEJAMENTO";
    entidadeId: string;
    bolsaId?: string;
  };
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    anexarComprovante.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className={CLASSE_CORPO_PAINEL}>
        <div className="mb-4">
          <label
            htmlFor="comprovante-arquivo"
            className="block text-sm font-medium text-foreground"
          >
            Arquivo <span className="text-danger">*</span>
          </label>
          <input
            id="comprovante-arquivo"
            name="arquivo"
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            aria-describedby="comprovante-dica"
            className="mt-1.5 block w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
          <p id="comprovante-dica" className="mt-1.5 text-xs text-muted">
            PDF, JPG ou PNG. O tipo é conferido pelo conteúdo do arquivo.
          </p>
        </div>
        <Selecao
          rotulo="Categoria"
          nome="categoria"
          obrigatorio
          padrao="COMPROVANTE"
          opcoes={CATEGORIAS_COMPROVANTE}
        />
        <Texto rotulo="Legenda" nome="legenda" />
      </div>
      <RodapeDoPainel
        enviando={enviando}
        erro={estado.ok ? null : (estado.mensagem ?? null)}
        rotulo="Anexar"
        rotuloEnviando="Enviando…"
        aoCancelar={aoConcluir}
      />
    </form>
  );
}
