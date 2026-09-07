"use client";

import { useActionState, useState } from "react";

import {
  anexarDocumento,
  atualizarDespesa,
  criarDespesa,
  iniciarPrestacao,
  removerDespesa,
} from "@/acoes/prestacao";
import { AreaTexto, Data, Selecao, Texto } from "@/componentes/ui/campos";
import { submeterSemLimpar } from "@/componentes/ui/formulario";
import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import { useToastDaAcao } from "@/componentes/ui/toast";
import { ESTADO_INICIAL, type EstadoDaAcao } from "@/lib/acao-tipos";
import type { DespesaMissao, ParticipanteMissao } from "@/lib/dominio";
import { dataIsoParaBr } from "@/lib/formato";

/**
 * Lançamento de despesa e anexo de documentos (CG-053).
 *
 * **Só passagem e diária têm campos próprios.** Hospedagem, transporte,
 * inscrição, seguro e outros se descrevem com os campos comuns — foi a decisão
 * da CG-009, e a API recusa especialização nos demais tipos.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

/** Os sete tipos homologados na CG-009. */
const TIPOS = [
  { valor: "PASSAGEM", texto: "Passagem" },
  { valor: "DIARIA", texto: "Diária" },
  { valor: "HOSPEDAGEM", texto: "Hospedagem" },
  { valor: "TRANSPORTE", texto: "Transporte" },
  { valor: "INSCRICAO_EVENTO", texto: "Inscrição em evento" },
  { valor: "SEGURO", texto: "Seguro" },
  { valor: "OUTRA", texto: "Outra" },
];


/** Abre a prestação quando a missão ainda não tem uma. */
export function IniciarPrestacao({ contexto }: { contexto: Contexto }) {
  const [estado, executar, enviando] = useActionState(
    iniciarPrestacao.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  return (
    <form onSubmit={(evento) => submeterSemLimpar(evento, executar)}>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary-hover disabled:opacity-60"
      >
        {enviando ? "Iniciando…" : "Iniciar prestação"}
      </button>
    </form>
  );
}

export function NovaDespesa({
  contexto,
  participantes,
  exercicioPadrao,
}: {
  contexto: Contexto;
  participantes: ParticipanteMissao[];
  exercicioPadrao: number;
}) {
  return (
    <AbrirSidesheet
      rotulo="Nova despesa"
      titulo="Lançar despesa"
      descricao="Valores em reais. A conversão de despesa feita no exterior acontece antes do lançamento."
    >
      {(fechar) => (
        <FormDespesa
          contexto={contexto}
          participantes={participantes}
          exercicioPadrao={exercicioPadrao}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

export function EditarDespesa({
  contexto,
  despesa,
  participantes,
}: {
  contexto: Contexto;
  despesa: DespesaMissao;
  participantes: ParticipanteMissao[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Editar"
      variante="secundaria"
      titulo="Editar despesa"
      descricao="Cotação que já tem documento não é apagada na edição: o vínculo histórico precisa da linha."
    >
      {(fechar) => (
        <FormDespesa
          contexto={contexto}
          despesa={despesa}
          participantes={participantes}
          exercicioPadrao={despesa.exercicio}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormDespesa({
  contexto,
  despesa,
  participantes,
  exercicioPadrao,
  aoConcluir,
}: {
  contexto: Contexto;
  despesa?: DespesaMissao;
  participantes: ParticipanteMissao[];
  exercicioPadrao: number;
  aoConcluir: () => void;
}) {
  const acao = despesa
    ? atualizarDespesa.bind(null, { ...contexto, despesaId: despesa.id })
    : criarDespesa.bind(null, contexto);
  const [estado, executar, enviando] = useActionState(acao, ESTADO_INICIAL);
  const [tipo, setTipo] = useState(despesa?.tipo ?? "PASSAGEM");
  const [cotacoes, setCotacoes] = useState(
    despesa?.passagem?.cotacoes.map((cotacao) => ({
      empresa: cotacao.empresa,
      valor: cotacao.valor,
    })) ?? [{ empresa: "", valor: "" }],
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <Selecao
          rotulo="Tipo de despesa"
          nome="tipo"
          obrigatorio
          padrao={tipo}
          aoMudar={setTipo}
          opcoes={TIPOS}
          erro={erroDoCampo(estado, "tipo")}
        />

        <Texto
          rotulo="Descrição"
          nome="descricao"
          obrigatorio
          padrao={despesa?.descricao}
          erro={erroDoCampo(estado, "descricao")}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <Texto
            rotulo="Valor total (R$)"
            nome="valorTotal"
            obrigatorio
            placeholder="1234.56"
            padrao={despesa?.valorTotal}
            dica="Use ponto como separador decimal."
            erro={erroDoCampo(estado, "valorTotal")}
          />
          <Texto
            rotulo="Exercício"
            nome="exercicio"
            tipo="number"
            obrigatorio
            padrao={String(exercicioPadrao)}
            erro={erroDoCampo(estado, "exercicio")}
          />
        </div>

        <Selecao
          rotulo="Participante"
          nome="participanteId"
          vazio="Sem pessoa específica"
          padrao={despesa?.participanteId ?? ""}
          opcoes={participantes.map((pessoa) => ({
            valor: pessoa.id,
            texto: pessoa.nome,
          }))}
          dica="Deixe em branco quando a despesa for da missão e não de alguém."
          erro={erroDoCampo(estado, "participanteId")}
        />

        <Data
          rotulo="Data do documento"
          nome="dataDocumento"
          padrao={dataIsoParaBr(despesa?.dataDocumento)}
          erro={erroDoCampo(estado, "dataDocumento")}
        />

        {tipo === "PASSAGEM" ? (
          <fieldset className="space-y-5 rounded-2xl border border-border px-4 py-4">
            <legend className="px-2 text-sm font-medium text-foreground">
              Passagem
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Texto
                rotulo="Companhia"
                nome="passagemEmpresa"
                padrao={despesa?.passagem?.empresa ?? undefined}
              />
              <Texto
                rotulo="Número do voo"
                nome="passagemNumeroVoo"
                padrao={despesa?.passagem?.numeroVoo ?? undefined}
              />
              <Texto
                rotulo="Origem"
                nome="passagemOrigem"
                padrao={despesa?.passagem?.origem ?? undefined}
              />
              <Texto
                rotulo="Destino"
                nome="passagemDestino"
                padrao={despesa?.passagem?.destino ?? undefined}
              />
            </div>
            <Data
              rotulo="Data do voo"
              nome="passagemDataVoo"
              padrao={dataIsoParaBr(despesa?.passagem?.dataVoo)}
            />

            {/*
              As cotações justificam a escolha da passagem. Linha em branco é
              descartada na ação, então abrir uma a mais não atrapalha.
            */}
            <div>
              <p className="text-sm font-medium text-foreground">Cotações</p>
              <p className="mt-0.5 text-xs text-muted">
                Registre as consultadas para comparar. Cada uma pode receber o
                PDF próprio depois de salvar.
              </p>
              <div className="mt-3 space-y-3">
                {cotacoes.map((cotacao, indice) => (
                  <div key={indice} className="flex items-end gap-2">
                    <div className="flex-1">
                      <Texto
                        rotulo="Companhia"
                        nome="cotacaoEmpresa"
                        padrao={cotacao.empresa}
                      />
                    </div>
                    <div className="w-36">
                      <Texto
                        rotulo="Valor (R$)"
                        nome="cotacaoValor"
                        padrao={cotacao.valor}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setCotacoes(cotacoes.filter((_, i) => i !== indice))
                      }
                      className="mb-1 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-muted"
                    >
                      Remover
                      <span className="sr-only"> cotação {indice + 1}</span>
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCotacoes([...cotacoes, { empresa: "", valor: "" }])
                }
                className="mt-3 rounded-lg border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Adicionar cotação
              </button>
            </div>
          </fieldset>
        ) : null}

        {tipo === "DIARIA" ? (
          <fieldset className="space-y-5 rounded-2xl border border-border px-4 py-4">
            <legend className="px-2 text-sm font-medium text-foreground">
              Diária
            </legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Data
                rotulo="Início"
                nome="diariaDataInicio"
                obrigatorio
                padrao={dataIsoParaBr(despesa?.diaria?.dataInicio)}
                erro={erroDoCampo(estado, "diaria.dataInicio")}
              />
              <Data
                rotulo="Fim"
                nome="diariaDataFim"
                obrigatorio
                padrao={dataIsoParaBr(despesa?.diaria?.dataFim)}
                erro={erroDoCampo(estado, "diaria.dataFim")}
              />
            </div>
            <Texto
              rotulo="Cidade"
              nome="diariaCidade"
              padrao={despesa?.diaria?.cidade ?? undefined}
            />
          </fieldset>
        ) : null}

        <AreaTexto
          rotulo="Observações"
          nome="observacoes"
          linhas={3}
          padrao={despesa?.observacoes ?? undefined}
        />

        <NotaDeErro estado={estado} />
      </div>

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
          {enviando ? "Salvando…" : despesa ? "Salvar despesa" : "Lançar"}
        </button>
      </div>
    </form>
  );
}

/**
 * Remoção da despesa.
 *
 * Não é oferecida quando ela já tem documento: a API recusa, e mostrar um botão
 * que sempre falha é pior que não mostrá-lo. A regra que vale continua sendo a
 * da API — esta checagem só evita o clique inútil.
 */
export function RemoverDespesa({
  contexto,
  despesa,
}: {
  contexto: Contexto;
  despesa: DespesaMissao;
}) {
  const [estado, executar, enviando] = useActionState(
    removerDespesa.bind(null, { ...contexto, despesaId: despesa.id }),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, () => {});

  if (despesa.documentos.length > 0) return null;

  return (
    <form onSubmit={(evento) => submeterSemLimpar(evento, executar)}>
      <button
        type="submit"
        disabled={enviando}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-60"
      >
        {enviando ? "Removendo…" : "Remover"}
        <span className="sr-only"> {despesa.descricao}</span>
      </button>
    </form>
  );
}

/** Anexa documento a uma despesa, a uma cotação ou à missão. */
export function AnexarDocumento({
  contexto,
  entidadeTipo,
  entidadeId,
  categorias,
  rotuloBotao = "Anexar documento",
  titulo,
  descricao,
}: {
  contexto: Contexto;
  entidadeTipo: "MISSAO_COMITE" | "DESPESA_MISSAO" | "COTACAO_PASSAGEM";
  entidadeId: string;
  categorias: { valor: string; texto: string }[];
  rotuloBotao?: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <AbrirSidesheet
      rotulo={rotuloBotao}
      variante="secundaria"
      titulo={titulo}
      descricao={descricao}
    >
      {(fechar) => (
        <FormAnexo
          contexto={contexto}
          entidadeTipo={entidadeTipo}
          entidadeId={entidadeId}
          categorias={categorias}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}

function FormAnexo({
  contexto,
  entidadeTipo,
  entidadeId,
  categorias,
  aoConcluir,
}: {
  contexto: Contexto;
  entidadeTipo: string;
  entidadeId: string;
  categorias: { valor: string; texto: string }[];
  aoConcluir: () => void;
}) {
  const [estado, executar, enviando] = useActionState(
    anexarDocumento.bind(null, contexto),
    ESTADO_INICIAL,
  );
  useToastDaAcao(estado, aoConcluir);

  return (
    <form
      onSubmit={(evento) => submeterSemLimpar(evento, executar)}
      className="flex h-full flex-col"
    >
      <input type="hidden" name="entidadeTipo" value={entidadeTipo} />
      <input type="hidden" name="entidadeId" value={entidadeId} />

      <div className="flex-1 space-y-5 overflow-y-auto px-1 pb-4">
        <div>
          <label
            htmlFor="arquivo"
            className="block text-sm font-medium text-foreground"
          >
            Arquivo <span className="text-danger">*</span>
          </label>
          <input
            id="arquivo"
            name="arquivo"
            type="file"
            required
            accept=".pdf,.jpg,.jpeg,.png"
            aria-describedby="arquivo-dica"
            className="mt-1.5 block w-full rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-surface-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground"
          />
          <p id="arquivo-dica" className="mt-1.5 text-xs text-muted">
            PDF, JPG ou PNG, até 20 MB. O tipo é conferido pelo conteúdo do
            arquivo, não pela extensão.
          </p>
        </div>

        <Selecao
          rotulo="Categoria"
          nome="categoria"
          obrigatorio
          opcoes={categorias}
          erro={erroDoCampo(estado, "categoria")}
        />

        <Texto rotulo="Legenda" nome="legenda" />

        <NotaDeErro estado={estado} />
      </div>

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
          {enviando ? "Enviando…" : "Anexar"}
        </button>
      </div>
    </form>
  );
}

function erroDoCampo(estado: EstadoDaAcao, campo: string) {
  return estado.erros?.find((erro) => erro.campo === campo)?.mensagem;
}

function NotaDeErro({ estado }: { estado: EstadoDaAcao }) {
  if (estado.ok || !estado.mensagem) return null;

  return (
    <p
      role="alert"
      className="rounded-xl border-l-4 border-danger bg-danger-soft px-4 py-3 text-sm text-on-danger-soft"
    >
      {estado.mensagem}
    </p>
  );
}
