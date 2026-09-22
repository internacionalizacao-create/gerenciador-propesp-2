import { z } from "zod";

// Import relativo, e nao pelo alias `@/`: o `node --test` do repositorio nao
// resolve o alias, e este modulo existe justamente para ser testado.
import { dataBrParaIso, dataIsoParaBr, rotulo } from "../formato.ts";
import { normalizarNumero } from "./catalogo.ts";

/**
 * Formulários dos eventos externos da CAPES (V1-037).
 *
 * **O sistema registra o que já aconteceu na CAPES; não autoriza nada.** Por
 * isso os textos daqui falam em "registrar", "ato" e "informado pela CAPES",
 * nunca em "solicitar" ou "aprovar".
 *
 * A API é a fronteira autoritativa (V1-036): recorte, vaga, tipo aplicável e
 * mesma temática são conferidos lá. O schema daqui existe para o erro aparecer
 * no campo antes da ida, e as funções de elegibilidade para o formulário só
 * oferecer o que a API aceitaria.
 */

type Situacao =
  | "SELECIONADO"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA"
  | "INTERROMPIDA";

interface TipoDeEvento {
  codigo: string;
  rotulo: string;
  descricao: string | null;
  estadosOrigem: Situacao[];
  estadoDestino: Situacao | null;
  aceitaSubstituta: boolean;
  aceitaPrevisaoRetorno: boolean;
}

const opcional = (maximo: number) => z.string().trim().max(maximo);

const dataBr = z
  .string()
  .trim()
  .min(1, "Informe a data no formato DD/MM/AAAA.")
  .refine(
    (valor) => dataBrParaIso(valor) !== null,
    "Informe uma data válida no formato DD/MM/AAAA.",
  );

const dataBrOpcional = z
  .string()
  .trim()
  .refine(
    (valor) => valor === "" || dataBrParaIso(valor) !== null,
    "Informe uma data válida no formato DD/MM/AAAA.",
  );

const justificativa = z
  .string()
  .trim()
  .min(3, "Informe a justificativa do registro.")
  .max(4000);

const motivo = z
  .string()
  .trim()
  .min(3, "Informe o motivo da correção.")
  .max(4000);

/** Só os tipos que partem da situação atual da bolsa. */
export function tiposElegiveis<T extends TipoDeEvento>(
  tipos: readonly T[],
  situacao: Situacao,
): T[] {
  return tipos.filter((tipo) => tipo.estadosOrigem.includes(situacao));
}

/**
 * O que o registro vai fazer, dito antes de salvar.
 *
 * As consequências são as que a V1-036 fixou, e só elas: a vaga segue a regra
 * "cancelada libera, interrompida não", e **nenhum evento mexe no custo do
 * plano nem no teto**. A frase final existe porque a pergunta mais provável de
 * quem registra uma desistência é "o dinheiro volta?", e a resposta aqui é não.
 */
export function consequenciasDoTipo(
  tipo: TipoDeEvento,
  situacao: Situacao,
): string[] {
  const destino = tipo.estadoDestino ?? situacao;
  const linhas: string[] = [];
  if (destino === situacao) {
    linhas.push(`A situação da bolsa continua ${rotulo(situacao)}.`);
  } else {
    linhas.push(
      `A situação da bolsa passa de ${rotulo(situacao)} para ${rotulo(destino)}.`,
    );
  }
  if (destino === "CANCELADA" && situacao !== "CANCELADA") {
    linhas.push("A vaga planejada volta a ficar disponível para outra concessão.");
  } else if (destino === "INTERROMPIDA") {
    linhas.push("A vaga planejada continua ocupada por esta bolsa.");
  }
  if (tipo.aceitaSubstituta) {
    linhas.push(
      "A bolsa que entra pode ser apontada agora, se já estiver cadastrada, ou depois, pela correção do evento.",
    );
  }
  linhas.push(
    "O custo do plano e o teto da temática não mudam: o evento só registra o que a CAPES informou.",
  );
  return linhas;
}

/**
 * Situações que a edição da bolsa ainda oferece.
 *
 * Desde a V1-037 *Cancelada* e *Interrompida* só entram por evento externo, e a
 * API recusa a edição que as escolha. A situação atual continua na lista para
 * o campo não aparecer vazio numa bolsa já cancelada.
 */
export function situacoesEditaveis(atual: Situacao): Situacao[] {
  const base: Situacao[] = ["SELECIONADO", "EM_ANDAMENTO", "CONCLUIDA"];
  return base.includes(atual) ? base : [...base, atual];
}

// ---------------------------------------------------------------------------
// Evento do beneficiário
// ---------------------------------------------------------------------------

const camposDoEvento = {
  tipo: z.string().trim().min(1, "Selecione o evento informado pela CAPES."),
  dataAto: dataBr,
  justificativa,
  referenciaExterna: opcional(200),
  previsaoRetorno: dataBrOpcional,
  bolsaSubstitutaId: z.string(),
};

function previsaoDepoisDoAto(
  valor: { dataAto: string; previsaoRetorno: string },
  contexto: z.RefinementCtx,
) {
  const ato = dataBrParaIso(valor.dataAto);
  const retorno = dataBrParaIso(valor.previsaoRetorno);
  if (ato && retorno && retorno < ato) {
    contexto.addIssue({
      code: "custom",
      path: ["previsaoRetorno"],
      message: "A previsão de retorno não pode ser anterior à data do ato.",
    });
  }
}

export const formularioEventoSchema = z
  .object(camposDoEvento)
  .superRefine(previsaoDepoisDoAto);
export type DadosFormularioEvento = z.infer<typeof formularioEventoSchema>;

export const formularioCorrecaoEventoSchema = z
  .object({ ...camposDoEvento, motivo })
  .superRefine(previsaoDepoisDoAto);
export type DadosCorrecaoEvento = z.infer<
  typeof formularioCorrecaoEventoSchema
>;

export function eventoVazio(): DadosFormularioEvento {
  return {
    tipo: "",
    dataAto: "",
    justificativa: "",
    referenciaExterna: "",
    previsaoRetorno: "",
    bolsaSubstitutaId: "",
  };
}

export function valoresDoEvento(evento: {
  tipo: string;
  dataAto: string;
  justificativa: string;
  referenciaExterna: string | null;
  previsaoRetorno: string | null;
  bolsaSubstitutaId: string | null;
}): DadosCorrecaoEvento {
  return {
    tipo: evento.tipo,
    dataAto: dataIsoParaBr(evento.dataAto),
    justificativa: evento.justificativa,
    referenciaExterna: evento.referenciaExterna ?? "",
    previsaoRetorno: dataIsoParaBr(evento.previsaoRetorno),
    bolsaSubstitutaId: evento.bolsaSubstitutaId ?? "",
    motivo: "",
  };
}

/**
 * Campo que o tipo não aceita não viaja: a previsão de retorno digitada numa
 * interrupção e depois abandonada ao trocar para desistência continuaria no
 * estado do React Hook Form, e a API a recusaria.
 */
function camposAceitos(
  dados: DadosFormularioEvento,
  tipo: TipoDeEvento | undefined,
) {
  return {
    previsaoRetorno: tipo?.aceitaPrevisaoRetorno
      ? (dataBrParaIso(dados.previsaoRetorno) ?? null)
      : null,
    bolsaSubstitutaId: tipo?.aceitaSubstituta
      ? dados.bolsaSubstitutaId || null
      : null,
  };
}

/**
 * `chave` é gerada uma vez por formulário aberto. Reenviar depois de um erro
 * de rede manda a mesma chave, e a API devolve o registro já feito em vez de
 * aplicar o efeito duas vezes.
 */
export function payloadEvento(
  dados: DadosFormularioEvento,
  chave: string,
  tipo: TipoDeEvento | undefined,
) {
  return {
    chave,
    tipo: dados.tipo,
    dataAto: dataBrParaIso(dados.dataAto),
    justificativa: dados.justificativa,
    referenciaExterna: dados.referenciaExterna || null,
    ...camposAceitos(dados, tipo),
  };
}

export function payloadCorrecaoEvento(
  dados: DadosCorrecaoEvento,
  tipo: TipoDeEvento | undefined,
) {
  return {
    motivo: dados.motivo,
    tipo: dados.tipo,
    dataAto: dataBrParaIso(dados.dataAto),
    justificativa: dados.justificativa,
    referenciaExterna: dados.referenciaExterna || null,
    ...camposAceitos(dados, tipo),
  };
}

// ---------------------------------------------------------------------------
// Movimentação de recurso
// ---------------------------------------------------------------------------

const VALOR = /^\d{1,12}([.,]\d{1,2})?$/;

export const RUBRICAS_MOVIMENTACAO = [
  { valor: "BOLSAS", texto: "Bolsas" },
  { valor: "MANUTENCAO", texto: "Manutenção" },
  { valor: "MISSOES", texto: "Missões" },
] as const;

const camposDaMovimentacao = {
  dataAto: dataBr,
  ano: z.string().regex(/^\d{4}$/, "Selecione o exercício."),
  areaTematicaId: z.string().min(1, "Selecione a área temática."),
  ppgOrigemId: z.string().min(1, "Selecione o PPG que cedeu."),
  ppgDestinoId: z.string().min(1, "Selecione o PPG que recebeu."),
  rubrica: z.enum(["BOLSAS", "MANUTENCAO", "MISSOES"]),
  modalidadeId: z.string(),
  quantidade: z
    .string()
    .trim()
    .refine(
      (valor) => valor === "" || /^[1-9]\d{0,3}$/.test(valor),
      "Informe uma quantidade inteira maior que zero.",
    ),
  valor: z
    .string()
    .trim()
    .regex(VALOR, "Informe o valor em reais (ex.: 21650,00).")
    .refine(
      (valor) => Number(normalizarNumero(valor)) > 0,
      "O valor precisa ser maior que zero.",
    ),
  justificativa,
  referenciaExterna: opcional(200),
  observacoes: opcional(4000),
};

function formaDaMovimentacao(
  valor: {
    ppgOrigemId: string;
    ppgDestinoId: string;
    rubrica: string;
    modalidadeId: string;
    quantidade: string;
  },
  contexto: z.RefinementCtx,
) {
  if (valor.ppgOrigemId && valor.ppgOrigemId === valor.ppgDestinoId) {
    contexto.addIssue({
      code: "custom",
      path: ["ppgDestinoId"],
      message: "Origem e destino precisam ser PPGs diferentes.",
    });
  }
  if (valor.rubrica !== "BOLSAS" && (valor.modalidadeId || valor.quantidade)) {
    contexto.addIssue({
      code: "custom",
      path: ["modalidadeId"],
      message: "Modalidade e quantidade valem só para movimentação de bolsas.",
    });
  }
}

export const formularioMovimentacaoSchema = z
  .object(camposDaMovimentacao)
  .superRefine(formaDaMovimentacao);
export type DadosFormularioMovimentacao = z.infer<
  typeof formularioMovimentacaoSchema
>;

export const formularioCorrecaoMovimentacaoSchema = z
  .object({ ...camposDaMovimentacao, motivo })
  .superRefine(formaDaMovimentacao);
export type DadosCorrecaoMovimentacao = z.infer<
  typeof formularioCorrecaoMovimentacaoSchema
>;

export function movimentacaoVazia(ano?: number): DadosFormularioMovimentacao {
  return {
    dataAto: "",
    ano: ano ? String(ano) : "",
    areaTematicaId: "",
    ppgOrigemId: "",
    ppgDestinoId: "",
    rubrica: "BOLSAS",
    modalidadeId: "",
    quantidade: "",
    valor: "",
    justificativa: "",
    referenciaExterna: "",
    observacoes: "",
  };
}

export function valoresDaMovimentacao(movimentacao: {
  dataAto: string;
  ano: number;
  areaTematicaId: string;
  ppgOrigemId: string;
  ppgDestinoId: string;
  rubrica: "BOLSAS" | "MANUTENCAO" | "MISSOES";
  modalidadeId: string | null;
  quantidade: number | null;
  valor: string;
  justificativa: string;
  referenciaExterna: string | null;
  observacoes: string | null;
}): DadosCorrecaoMovimentacao {
  return {
    dataAto: dataIsoParaBr(movimentacao.dataAto),
    ano: String(movimentacao.ano),
    areaTematicaId: movimentacao.areaTematicaId,
    ppgOrigemId: movimentacao.ppgOrigemId,
    ppgDestinoId: movimentacao.ppgDestinoId,
    rubrica: movimentacao.rubrica,
    modalidadeId: movimentacao.modalidadeId ?? "",
    quantidade:
      movimentacao.quantidade === null ? "" : String(movimentacao.quantidade),
    // Vírgula, como se digita: o campo volta para a pessoa como ela o deixou.
    valor: movimentacao.valor.replace(".", ","),
    justificativa: movimentacao.justificativa,
    referenciaExterna: movimentacao.referenciaExterna ?? "",
    observacoes: movimentacao.observacoes ?? "",
    motivo: "",
  };
}

/**
 * Modalidade e quantidade só viajam na rubrica de bolsas: trocadas para
 * manutenção depois de preenchidas, continuariam no estado do formulário e a
 * API recusaria o registro inteiro por um campo que a pessoa já abandonou.
 */
function camposDaRubrica(dados: DadosFormularioMovimentacao) {
  const bolsas = dados.rubrica === "BOLSAS";
  return {
    modalidadeId: bolsas ? dados.modalidadeId || null : null,
    quantidade: bolsas && dados.quantidade ? Number(dados.quantidade) : null,
  };
}

function corpoDaMovimentacao(dados: DadosFormularioMovimentacao) {
  return {
    dataAto: dataBrParaIso(dados.dataAto),
    ano: Number(dados.ano),
    areaTematicaId: dados.areaTematicaId,
    ppgOrigemId: dados.ppgOrigemId,
    ppgDestinoId: dados.ppgDestinoId,
    rubrica: dados.rubrica,
    ...camposDaRubrica(dados),
    valor: normalizarNumero(dados.valor),
    justificativa: dados.justificativa,
    referenciaExterna: dados.referenciaExterna || null,
    observacoes: dados.observacoes || null,
  };
}

/** Só `EXECUTADO`: no CAPES Global não se propõe nem se autoriza (RN-13). */
export function payloadMovimentacao(
  dados: DadosFormularioMovimentacao,
  chave: string,
) {
  return { chave, status: "EXECUTADO" as const, ...corpoDaMovimentacao(dados) };
}

export function payloadCorrecaoMovimentacao(dados: DadosCorrecaoMovimentacao) {
  return { ...corpoDaMovimentacao(dados), motivo: dados.motivo };
}
