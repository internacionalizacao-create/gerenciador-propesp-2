import { z } from "zod";

/**
 * Participação de um PPG numa área temática (V1-034).
 *
 * É o vínculo que torna um PPG utilizável no planejamento do ciclo: sem ele não
 * há linha de plano válida, e sem linha de plano não há bolsa.
 *
 * **O mesmo PPG participa de mais de uma temática** — é o caso do PROFSAÚDE —,
 * então o que se repete é o par (PPG, temática), nunca o PPG sozinho.
 */

export const SITUACOES_PARTICIPACAO = [
  { valor: "CADASTRO_PRELIMINAR", texto: "Cadastro preliminar" },
  { valor: "CONTEMPLADO", texto: "Contemplado" },
  { valor: "NAO_CONTEMPLADO", texto: "Não contemplado" },
] as const;

export const formularioParticipacaoSchema = z.object({
  ppgId: z.uuid("Selecione o PPG."),
  coordenadorTematicaId: z.uuid("Selecione o responsável."),
  situacao: z.enum([
    "CADASTRO_PRELIMINAR",
    "CONTEMPLADO",
    "NAO_CONTEMPLADO",
  ]),
  modalidadesPrevistas: z.string().trim().max(2000),
  observacoes: z.string().trim().max(4000),
});

export type DadosFormularioParticipacao = z.infer<
  typeof formularioParticipacaoSchema
>;

/**
 * A edição não troca o PPG.
 *
 * Trocar o PPG de uma participação existente não é editar: é desfazer um
 * vínculo e criar outro, e faria a linha de plano que aponta para o par antigo
 * passar a descrever um programa que nunca foi decidido. O campo aparece como
 * texto, e a saída é remover e associar de novo.
 */
export const formularioEdicaoParticipacaoSchema =
  formularioParticipacaoSchema.omit({ ppgId: true });

export type DadosEdicaoParticipacao = z.infer<
  typeof formularioEdicaoParticipacaoSchema
>;

export function participacaoVazia(): DadosFormularioParticipacao {
  return {
    ppgId: "",
    coordenadorTematicaId: "",
    situacao: "CADASTRO_PRELIMINAR",
    modalidadesPrevistas: "",
    observacoes: "",
  } as DadosFormularioParticipacao;
}

export function valoresDaParticipacao(participacao: {
  coordenadorTematicaId: string;
  situacao: string;
  modalidadesPrevistas: string | null;
  observacoes: string | null;
}): DadosEdicaoParticipacao {
  return {
    coordenadorTematicaId: participacao.coordenadorTematicaId,
    situacao: participacao.situacao as DadosEdicaoParticipacao["situacao"],
    modalidadesPrevistas: participacao.modalidadesPrevistas ?? "",
    observacoes: participacao.observacoes ?? "",
  };
}

/** Vazio vira `null`, como no resto dos formulários. */
export function payloadParticipacao(
  dados: DadosFormularioParticipacao | DadosEdicaoParticipacao,
) {
  return {
    ...("ppgId" in dados ? { ppgId: dados.ppgId } : {}),
    coordenadorTematicaId: dados.coordenadorTematicaId,
    situacao: dados.situacao,
    modalidadesPrevistas: dados.modalidadesPrevistas || null,
    observacoes: dados.observacoes || null,
  };
}
