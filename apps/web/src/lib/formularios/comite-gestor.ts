import { z } from "zod";

const dataCompleta = z
  .string()
  .refine((valor) => Boolean(dataParaIso(valor)), "Informe uma data válida.");

export const formularioMembroEquipeSchema = z
  .object({
    modoPessoa: z.enum(["existente", "nova", "edicao"]),
    pessoaId: z.string(),
    nomePessoa: z.string().trim().max(240),
    emailPessoa: z
      .string()
      .trim()
      .max(240),
    cpfPessoa: z.string().trim(),
    tipoPessoa: z.enum([
      "SERVIDOR",
      "DOCENTE",
      "DISCENTE",
      "PESQUISADOR",
      "EXTERNO",
    ]),
    tipoEquipe: z.enum(["COMITE_GESTOR", "ADMINISTRACAO"]),
    funcao: z
      .string()
      .trim()
      .min(2, "Informe a função na equipe.")
      .max(160),
    dataInicio: dataCompleta,
    dataFim: z
      .string()
      .refine(
        (valor) => valor === "" || Boolean(dataParaIso(valor)),
        "Informe uma data válida.",
      ),
    observacoes: z.string().trim().max(2000),
  })
  .superRefine((valor, contexto) => {
    if (
      valor.modoPessoa === "existente" &&
      !z.uuid().safeParse(valor.pessoaId).success
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["pessoaId"],
        message: "Selecione uma pessoa.",
      });
    }

    if (valor.modoPessoa === "nova" && valor.nomePessoa.length < 3) {
      contexto.addIssue({
        code: "custom",
        path: ["nomePessoa"],
        message: "Informe o nome da pessoa.",
      });
    }

    if (
      valor.modoPessoa === "nova" &&
      valor.emailPessoa !== "" &&
      !z.email().safeParse(valor.emailPessoa).success
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["emailPessoa"],
        message: "Informe um e-mail válido.",
      });
    }

    if (
      valor.modoPessoa === "nova" &&
      valor.cpfPessoa !== "" &&
      !cpfValido(valor.cpfPessoa)
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["cpfPessoa"],
        message: "Informe um CPF válido.",
      });
    }

    const inicio = dataParaIso(valor.dataInicio);
    const fim = dataParaIso(valor.dataFim);
    if (inicio && fim && fim < inicio) {
      contexto.addIssue({
        code: "custom",
        path: ["dataFim"],
        message: "A data final não pode ser anterior à data inicial.",
      });
    }
  });

export type DadosFormularioMembroEquipe = z.infer<
  typeof formularioMembroEquipeSchema
>;

function cpfValido(valor: string): boolean {
  const normalizado = valor.replace(/\D/g, "");
  if (!/^\d{11}$/.test(normalizado) || /^(\d)\1{10}$/.test(normalizado)) {
    return false;
  }

  const digitos = normalizado.split("").map(Number);
  for (let posicao = 9; posicao <= 10; posicao += 1) {
    const soma = digitos.slice(0, posicao).reduce((total, digito, indice) => {
      return total + digito * (posicao + 1 - indice);
    }, 0);
    const resto = (soma * 10) % 11;
    if ((resto === 10 ? 0 : resto) !== digitos[posicao]) return false;
  }
  return true;
}

function dataParaIso(valor: string): string | null {
  if (valor === "") return null;
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor);
  if (!correspondencia) return null;

  const [, dia, mes, ano] = correspondencia;
  const instante = new Date(Date.UTC(Number(ano), Number(mes) - 1, Number(dia)));
  if (
    instante.getUTCFullYear() !== Number(ano) ||
    instante.getUTCMonth() + 1 !== Number(mes) ||
    instante.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}
