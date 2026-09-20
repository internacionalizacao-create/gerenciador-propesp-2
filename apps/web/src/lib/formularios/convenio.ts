import { z } from "zod";

/**
 * Acordo com a instituição parceira (V1-032).
 *
 * **O convênio não pertence à missão** (CG-056): ancora-se na instituição,
 * guarda a missão apenas como origem e sobrevive à viagem e ao ciclo. Por isso
 * o formulário mora na página do parceiro, e a missão de origem é um campo
 * opcional como qualquer outro — não o dono do registro.
 *
 * Espelha `criarConvenioSchema` da API, que continua sendo a fronteira
 * autoritativa; este existe para o erro aparecer no campo antes da ida.
 */

export const TIPOS_ACORDO = [
  { valor: "INTERCAMBIO_PESQUISA", texto: "Intercâmbio de pesquisa" },
  { valor: "DUPLA_TITULACAO", texto: "Dupla titulação" },
  { valor: "COOPERACAO_TECNICA", texto: "Cooperação técnica" },
  { valor: "INTERCAMBIO_ACADEMICO", texto: "Intercâmbio acadêmico" },
  { valor: "MOBILIDADE_DOCENTE", texto: "Mobilidade docente" },
  { valor: "COTUTELA", texto: "Cotutela" },
  { valor: "OUTRO", texto: "Outro" },
] as const;

export const SITUACOES_CONVENIO = [
  { valor: "EM_TRAMITACAO", texto: "Em tramitação" },
  { valor: "VIGENTE", texto: "Vigente" },
  { valor: "ENCERRADO", texto: "Encerrado" },
] as const;

const opcionalCom = (maximo: number) => z.string().trim().max(maximo);
const dataOpcional = z
  .string()
  .trim()
  .refine(
    (valor) => valor === "" || /^\d{4}-\d{2}-\d{2}$/.test(valor),
    "Informe uma data válida.",
  );

export const formularioConvenioSchema = z
  .object({
    titulo: z.string().trim().min(3, "Informe o título do acordo.").max(300),
    tipoAcordo: z.enum([
      "INTERCAMBIO_PESQUISA",
      "DUPLA_TITULACAO",
      "COOPERACAO_TECNICA",
      "INTERCAMBIO_ACADEMICO",
      "MOBILIDADE_DOCENTE",
      "COTUTELA",
      "OUTRO",
    ]),
    area: opcionalCom(160),
    objetivo: opcionalCom(5000),
    situacao: z.enum(["EM_TRAMITACAO", "VIGENTE", "ENCERRADO"]),
    numeroProcesso: opcionalCom(80),
    dataAssinatura: dataOpcional,
    dataInicio: dataOpcional,
    dataFim: dataOpcional,
    observacoes: opcionalCom(4000),
    missaoOrigemId: z.string(),
    redesIds: z.array(z.uuid()).max(10),
  })
  .superRefine((valor, contexto) => {
    /*
      A mesma regra do `check` do banco, repetida aqui só para o erro cair no
      campo que a tela destaca: acordo vigente sem data de assinatura é acordo
      que ninguém consegue provar que começou.
    */
    if (valor.situacao === "VIGENTE" && !valor.dataAssinatura) {
      contexto.addIssue({
        code: "custom",
        path: ["dataAssinatura"],
        message: "Acordo vigente exige a data de assinatura.",
      });
    }
    /*
      O fim antes do início não é recusado pela API — lá a vigência indeterminada
      é nula e a comparação não existe. Recusar aqui evita gravar um período
      impossível que só apareceria na leitura, meses depois.
    */
    if (
      valor.dataInicio &&
      valor.dataFim &&
      valor.dataFim < valor.dataInicio
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "O fim da vigência não pode ser anterior ao início.",
      });
    }
  });

export type DadosFormularioConvenio = z.infer<typeof formularioConvenioSchema>;

export function convenioVazio(): DadosFormularioConvenio {
  return {
    titulo: "",
    tipoAcordo: "INTERCAMBIO_PESQUISA",
    area: "",
    objetivo: "",
    situacao: "EM_TRAMITACAO",
    numeroProcesso: "",
    dataAssinatura: "",
    dataInicio: "",
    dataFim: "",
    observacoes: "",
    missaoOrigemId: "",
    redesIds: [],
  };
}

/** Preenche o formulário com o acordo já gravado. */
export function valoresDoConvenio(convenio: {
  titulo: string;
  tipoAcordo: string;
  area: string | null;
  objetivo: string | null;
  situacao: string;
  numeroProcesso: string | null;
  dataAssinatura: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  observacoes: string | null;
  missaoOrigemId: string | null;
  redes: { id: string }[];
}): DadosFormularioConvenio {
  return {
    titulo: convenio.titulo,
    tipoAcordo: convenio.tipoAcordo as DadosFormularioConvenio["tipoAcordo"],
    area: convenio.area ?? "",
    objetivo: convenio.objetivo ?? "",
    situacao: convenio.situacao as DadosFormularioConvenio["situacao"],
    numeroProcesso: convenio.numeroProcesso ?? "",
    dataAssinatura: convenio.dataAssinatura ?? "",
    dataInicio: convenio.dataInicio ?? "",
    dataFim: convenio.dataFim ?? "",
    observacoes: convenio.observacoes ?? "",
    missaoOrigemId: convenio.missaoOrigemId ?? "",
    redesIds: convenio.redes.map((rede) => rede.id),
  };
}

/**
 * Converte o modelo visual no contrato da API.
 *
 * Vazio vira `null`, e não string vazia: na edição o `null` explícito é o que
 * diz "limpei este campo", enquanto o campo ausente manda a API preservar o que
 * estava lá — são intenções diferentes e o formulário sempre envia a primeira.
 *
 * `redesIds` viaja **sempre**, mesmo vazio: `atualizarConvenio` reconcilia a
 * lista inteira, e omiti-la preservaria redes que a pessoa acabou de desmarcar.
 */
export function payloadConvenio(dados: DadosFormularioConvenio) {
  return {
    titulo: dados.titulo,
    tipoAcordo: dados.tipoAcordo,
    area: dados.area || null,
    objetivo: dados.objetivo || null,
    situacao: dados.situacao,
    numeroProcesso: dados.numeroProcesso || null,
    dataAssinatura: dados.dataAssinatura || null,
    dataInicio: dados.dataInicio || null,
    dataFim: dados.dataFim || null,
    observacoes: dados.observacoes || null,
    missaoOrigemId: dados.missaoOrigemId || null,
    redesIds: dados.redesIds,
  };
}
