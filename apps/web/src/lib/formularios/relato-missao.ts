import { z } from "zod";

import { dataParaIso, opcional } from "./missao-comite.ts";

/**
 * Relato do que aconteceu na missão (CG-046).
 *
 * **Relatar não é editar.** A edição muda o que se pretende fazer; o relato
 * registra o que foi feito, e nenhum campo de planejamento é alcançado daqui —
 * é o que mantém previsto e realizado distinguíveis depois. Por isso o schema
 * não repete título, objetivo, redes nem participantes.
 *
 * O formulário e a API divergem de propósito num ponto: aqui a avaliação
 * começa vazia (`""`), porque o `<select>` precisa de um valor; na API ela é
 * `null`, que significa "ninguém respondeu ainda" e é o que o checklist de
 * encerramento cobra (CG-058). `payloadRelato` faz a tradução.
 */

const atividadeRelatadaSchema = z
  .object({
    id: z.uuid(),
    titulo: z.string(),
    status: z.enum(["PLANEJADA", "REALIZADA", "NAO_REALIZADA"]),
    relatoRealizado: z.string().trim().max(5000),
    resultados: z.string().trim().max(5000),
    observacoes: z.string().trim().max(2000),
  })
  .superRefine((valor, contexto) => {
    // Mesma regra da API. Duplicá-la aqui não é redundância: sem ela o erro só
    // apareceria depois do envio, longe do campo que precisa ser corrigido.
    if (valor.status === "REALIZADA" && valor.relatoRealizado.length === 0) {
      contexto.addIssue({
        code: "custom",
        path: ["relatoRealizado"],
        message: "Descreva o que foi realizado nesta atividade.",
      });
    }
  });

export const formularioRelatoSchema = z
  .object({
    relatoGeral: z
      .string()
      .trim()
      .min(20, "Descreva o que aconteceu na missão.")
      .max(10000),
    resultados: z.string().trim().max(10000),
    avaliacaoObjetivos: z.enum(["", "SIM", "PARCIALMENTE", "NAO"]),
    avaliacaoJustificativa: z.string().trim().max(5000),
    desdobramentos: z.string().trim().max(10000),
    atividades: z.array(atividadeRelatadaSchema).max(200),
  })
  .superRefine((valor, contexto) => {
    // A assimetria é a regra homologada: "atingiu" não precisa de explicação,
    // "não atingiu" precisa — senão o relatório final registra um insucesso
    // sem dizer por quê.
    if (
      (valor.avaliacaoObjetivos === "PARCIALMENTE" ||
        valor.avaliacaoObjetivos === "NAO") &&
      valor.avaliacaoJustificativa.length === 0
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["avaliacaoJustificativa"],
        message: "Explique por que os objetivos não foram plenamente alcançados.",
      });
    }
  });

export type DadosFormularioRelato = z.infer<typeof formularioRelatoSchema>;

/**
 * Atividade que aconteceu sem constar do roteiro (CG-035).
 *
 * Formulário separado por decisão de 2026-09-06: o relato edita o planejado e
 * um botão à parte acrescenta a parada extra. Misturar as duas coisas num
 * formulário só faria quem quer corrigir uma frase percorrer um cadastro
 * inteiro de atividade.
 *
 * Não há campo de planejamento, e não é esquecimento: atividade não prevista
 * não tem o que planejar, e preencher a coluna apagaria justamente a distinção
 * que ela existe para preservar.
 */
export const formularioAtividadeExtraSchema = z
  .object({
    tipo: z.enum(["VISITA_TECNICA", "EVENTO", "ARTICULACAO", "BANCA", "OUTRO"]),
    titulo: z.string().trim().min(3, "Informe o título da atividade.").max(300),
    paisId: z.uuid("Selecione o país."),
    cidade: z.string().trim().max(120),
    modoInstituicao: z.enum(["nenhuma", "catalogo", "livre"]),
    instituicaoId: z.string(),
    instituicaoNome: z.string().trim().max(240),
    eventoNome: z.string().trim().max(300),
    dataInicio: z
      .string()
      .refine((valor) => Boolean(dataParaIso(valor)), "Informe uma data válida."),
    dataFim: z
      .string()
      .refine((valor) => Boolean(dataParaIso(valor)), "Informe uma data válida."),
    justificativa: z
      .string()
      .trim()
      .min(10, "Justifique a inclusão da atividade não prevista.")
      .max(2000),
    relatoRealizado: z
      .string()
      .trim()
      .min(1, "Descreva o que foi realizado nesta atividade.")
      .max(5000),
    resultados: z.string().trim().max(5000),
    observacoes: z.string().trim().max(2000),
  })
  .superRefine((valor, contexto) => {
    const inicio = dataParaIso(valor.dataInicio);
    const fim = dataParaIso(valor.dataFim);
    if (inicio && fim && fim < inicio) {
      contexto.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final não pode ser anterior à data inicial.",
      });
    }
    if (
      valor.modoInstituicao === "catalogo" &&
      !z.uuid().safeParse(valor.instituicaoId).success
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["instituicaoId"],
        message: "Selecione uma instituição.",
      });
    }
    if (valor.modoInstituicao === "livre" && valor.instituicaoNome.length < 2) {
      contexto.addIssue({
        code: "custom",
        path: ["instituicaoNome"],
        message: "Informe o nome da instituição.",
      });
    }
    if (valor.tipo === "EVENTO" && valor.eventoNome.trim().length < 2) {
      contexto.addIssue({
        code: "custom",
        path: ["eventoNome"],
        message: "Informe o nome do evento.",
      });
    }
  });

export type DadosFormularioAtividadeExtra = z.infer<
  typeof formularioAtividadeExtraSchema
>;

/** Corpo do `PATCH .../relato` a partir do modelo visual. */
export function payloadRelato(dados: DadosFormularioRelato) {
  return {
    relatoGeral: dados.relatoGeral,
    resultados: opcional(dados.resultados),
    // `""` do `<select>` vira ausência, não string vazia: a API distingue "não
    // respondeu" de qualquer resposta, e `""` não é um valor do enum.
    avaliacaoObjetivos: dados.avaliacaoObjetivos || undefined,
    // A justificativa segue a resposta. O formulário esconde o campo quando a
    // resposta é `SIM`, mas o valor digitado antes continua no estado do React
    // Hook Form — mandá-lo faria a tela mostrar uma coisa e gravar outra.
    avaliacaoJustificativa:
      dados.avaliacaoObjetivos === "PARCIALMENTE" ||
      dados.avaliacaoObjetivos === "NAO"
        ? opcional(dados.avaliacaoJustificativa)
        : undefined,
    desdobramentos: opcional(dados.desdobramentos),
    atividades: dados.atividades.map((atividade) => ({
      id: atividade.id,
      status: atividade.status,
      relatoRealizado: opcional(atividade.relatoRealizado),
      resultados: opcional(atividade.resultados),
      observacoes: opcional(atividade.observacoes),
    })),
    atividadesNaoPrevistas: [],
  };
}

/**
 * Corpo do mesmo `PATCH` para acrescentar **uma** atividade extra.
 *
 * O endpoint é um só, e exige `relatoGeral`. Por isso o relato atual viaja
 * junto, inalterado: mandar vazio apagaria o texto que já existe. `atividades`
 * vai vazio de propósito — a API só atualiza o que recebe, então nenhuma
 * atividade planejada é tocada aqui.
 *
 * Isso é seguro porque atividade não prevista é **inserida**, nunca
 * reconciliada: o relato principal manda `atividadesNaoPrevistas: []` e não
 * remove as que já existem.
 */
export function payloadAtividadeExtra(
  dados: DadosFormularioAtividadeExtra,
  relatoAtual: {
    relatoGeral: string;
    resultados: string | null;
    avaliacaoObjetivos: "SIM" | "PARCIALMENTE" | "NAO" | null;
    avaliacaoJustificativa: string | null;
    desdobramentos: string | null;
  },
) {
  return {
    relatoGeral: relatoAtual.relatoGeral,
    resultados: relatoAtual.resultados ?? undefined,
    avaliacaoObjetivos: relatoAtual.avaliacaoObjetivos ?? undefined,
    avaliacaoJustificativa: relatoAtual.avaliacaoJustificativa ?? undefined,
    desdobramentos: relatoAtual.desdobramentos ?? undefined,
    atividades: [],
    atividadesNaoPrevistas: [
      {
        tipo: dados.tipo,
        titulo: dados.titulo,
        paisId: dados.paisId,
        cidade: opcional(dados.cidade),
        instituicaoId:
          dados.modoInstituicao === "catalogo"
            ? dados.instituicaoId
            : undefined,
        instituicaoNome:
          dados.modoInstituicao === "livre"
            ? dados.instituicaoNome
            : undefined,
        eventoNome: opcional(dados.eventoNome),
        dataInicio: dataParaIso(dados.dataInicio),
        dataFim: dataParaIso(dados.dataFim),
        justificativa: dados.justificativa,
        relatoRealizado: dados.relatoRealizado,
        resultados: opcional(dados.resultados),
        observacoes: opcional(dados.observacoes),
      },
    ],
  };
}
