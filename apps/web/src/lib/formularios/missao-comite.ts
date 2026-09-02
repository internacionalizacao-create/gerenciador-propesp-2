import { z } from "zod";

const dataCompleta = z
  .string()
  .refine((valor) => Boolean(dataParaIso(valor)), "Informe uma data válida.");

const participanteSchema = z
  .object({
    modoPessoa: z.enum(["existente", "nova"]),
    pessoaId: z.string(),
    nomePessoa: z.string().trim().max(240),
    emailPessoa: z.string().trim().max(240),
    cpfPessoa: z.string().trim(),
    tipoPessoa: z.enum([
      "SERVIDOR",
      "DOCENTE",
      "DISCENTE",
      "PESQUISADOR",
      "EXTERNO",
    ]),
    membroEquipeId: z.string(),
    papel: z.enum(["RESPONSAVEL", "PARTICIPANTE", "APOIO"]),
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

    if (
      valor.membroEquipeId !== "" &&
      !z.uuid().safeParse(valor.membroEquipeId).success
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["membroEquipeId"],
        message: "Selecione um vínculo válido.",
      });
    }

    if (valor.modoPessoa === "nova" && valor.membroEquipeId !== "") {
      contexto.addIssue({
        code: "custom",
        path: ["membroEquipeId"],
        message: "A pessoa nova ainda não possui vínculo de equipe.",
      });
    }
  });

const atividadeSchema = z
  .object({
    tipo: z.enum(["VISITA_TECNICA", "EVENTO", "ARTICULACAO", "BANCA", "OUTRO"]),
    titulo: z
      .string()
      .trim()
      .min(3, "Informe o título da atividade.")
      .max(300),
    paisId: z.uuid("Selecione o país."),
    cidade: z.string().trim().max(120),
    modoInstituicao: z.enum(["nenhuma", "catalogo", "livre"]),
    instituicaoId: z.string(),
    instituicaoNome: z.string().trim().max(240),
    eventoNome: z.string().trim().max(300),
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    planejamento: z.string().trim().max(5000),
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

    if (
      valor.modoInstituicao === "livre" &&
      valor.instituicaoNome.length < 2
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["instituicaoNome"],
        message: "Informe o nome da instituição.",
      });
    }
  });

export const formularioMissaoComiteSchema = z
  .object({
    titulo: z
      .string()
      .trim()
      .min(3, "Informe o título da missão.")
      .max(300),
    objetivo: z
      .string()
      .trim()
      .min(10, "Informe o objetivo da missão.")
      .max(5000),
    dataInicio: dataCompleta,
    dataFim: dataCompleta,
    status: z.enum(["RASCUNHO", "PLANEJADA"]),
    observacoes: z.string().trim().max(2000),
    // Caixas de seleção, então o modelo visual já é a lista de ids marcados.
    redes: z
      .array(z.uuid())
      .min(1, "Selecione pelo menos uma rede.")
      .max(10),
    atividades: z
      .array(atividadeSchema)
      .min(1, "Inclua pelo menos uma atividade no roteiro.")
      .max(200),
    participantes: z
      .array(participanteSchema)
      .min(1, "Inclua pelo menos um participante.")
      .max(100),
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

    const pessoas = valor.participantes
      .filter((participante) => participante.modoPessoa === "existente")
      .map((participante) => participante.pessoaId)
      .filter(Boolean);
    if (new Set(pessoas).size !== pessoas.length) {
      contexto.addIssue({
        code: "custom",
        path: ["participantes"],
        message: "A mesma pessoa não pode aparecer duas vezes na missão.",
      });
    }

    if (!inicio || !fim) return;
    valor.atividades.forEach((atividade, indice) => {
      const inicioAtividade = dataParaIso(atividade.dataInicio);
      const fimAtividade = dataParaIso(atividade.dataFim);
      if (
        inicioAtividade &&
        fimAtividade &&
        (inicioAtividade < inicio || fimAtividade > fim)
      ) {
        contexto.addIssue({
          code: "custom",
          path: ["atividades", indice, "dataInicio"],
          message: "A atividade precisa estar dentro do período da missão.",
        });
      }
    });
  });

export type DadosFormularioMissaoComite = z.infer<
  typeof formularioMissaoComiteSchema
>;

export function novaAtividade(
  dataInicio = "",
  dataFim = "",
): DadosFormularioMissaoComite["atividades"][number] {
  return {
    tipo: "VISITA_TECNICA",
    titulo: "",
    paisId: "",
    cidade: "",
    modoInstituicao: "nenhuma",
    instituicaoId: "",
    instituicaoNome: "",
    eventoNome: "",
    dataInicio,
    dataFim,
    planejamento: "",
    observacoes: "",
  };
}

export function novoParticipante(
  responsavel = false,
): DadosFormularioMissaoComite["participantes"][number] {
  return {
    modoPessoa: "existente",
    pessoaId: "",
    nomePessoa: "",
    emailPessoa: "",
    cpfPessoa: "",
    tipoPessoa: "EXTERNO",
    membroEquipeId: "",
    papel: responsavel ? "RESPONSAVEL" : "PARTICIPANTE",
    observacoes: "",
  };
}

/** Converte o modelo visual para o contrato autoritativo da API. */
export function payloadCriacaoMissao(dados: DadosFormularioMissaoComite) {
  return {
    titulo: dados.titulo,
    objetivo: dados.objetivo,
    dataInicio: dataParaIso(dados.dataInicio),
    dataFim: dataParaIso(dados.dataFim),
    status: dados.status,
    observacoes: opcional(dados.observacoes),
    redes: dados.redes,
    participantes: dados.participantes.map((participante) => ({
      pessoaId:
        participante.modoPessoa === "existente"
          ? participante.pessoaId
          : undefined,
      novaPessoa:
        participante.modoPessoa === "nova"
          ? {
              nome: participante.nomePessoa,
              email: opcional(participante.emailPessoa),
              cpf: opcional(participante.cpfPessoa),
              tipo: participante.tipoPessoa,
            }
          : undefined,
      membroEquipeId: opcional(participante.membroEquipeId),
      papel: participante.papel,
      observacoes: opcional(participante.observacoes),
    })),
    atividades: dados.atividades.map((atividade) => ({
      tipo: atividade.tipo,
      titulo: atividade.titulo,
      paisId: atividade.paisId,
      cidade: opcional(atividade.cidade),
      instituicaoId:
        atividade.modoInstituicao === "catalogo"
          ? atividade.instituicaoId
          : undefined,
      instituicaoNome:
        atividade.modoInstituicao === "livre"
          ? atividade.instituicaoNome
          : undefined,
      eventoNome: opcional(atividade.eventoNome),
      dataInicio: dataParaIso(atividade.dataInicio),
      dataFim: dataParaIso(atividade.dataFim),
      planejamento: opcional(atividade.planejamento),
      observacoes: opcional(atividade.observacoes),
    })),
  };
}

/** Traduz caminhos aninhados da API para os nomes usados pelo formulario. */
export function campoApiParaFormulario(campo: string): string {
  return campo.replace(
    /^participantes\.(\d+)\.novaPessoa\.(nome|email|cpf|tipo)$/,
    (_completo, indice: string, nome: string) => {
      const visual = {
        nome: "nomePessoa",
        email: "emailPessoa",
        cpf: "cpfPessoa",
        tipo: "tipoPessoa",
      }[nome];
      return `participantes.${indice}.${visual}`;
    },
  );
}

function opcional(valor: string): string | undefined {
  const normalizado = valor.trim();
  return normalizado === "" ? undefined : normalizado;
}

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
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
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
