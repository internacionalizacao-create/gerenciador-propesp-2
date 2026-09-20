import { z } from "zod";

const dataCompleta = z
  .string()
  .refine((valor) => Boolean(dataParaIso(valor)), "Informe uma data válida.");

const participanteSchema = z
  .object({
    /**
     * Vazio na criacao, preenchido na edicao (V1-030).
     *
     * O endpoint de edicao **reconcilia a lista inteira**: linha sem `id` e
     * linha nova. Sem guardar o identificador aqui, salvar uma edicao criaria
     * participantes e paradas duplicados e deixaria os originais orfaos.
     */
    id: z.string(),
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
    /** Mesmo papel do `id` do participante: preserva a linha na edicao. */
    id: z.string(),
    tipo: z.enum(["VISITA_TECNICA", "EVENTO", "ARTICULACAO", "BANCA", "OUTRO"]),
    titulo: z.string().trim().min(3, "Informe o título da atividade.").max(300),
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

export const formularioMissaoComiteSchema = z
  .object({
    titulo: z.string().trim().min(3, "Informe o título da missão.").max(300),
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
    redes: z.array(z.uuid()).min(1, "Selecione pelo menos uma rede.").max(10),
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

    if (
      valor.participantes.filter(
        (participante) => participante.papel === "RESPONSAVEL",
      ).length !== 1
    ) {
      contexto.addIssue({
        code: "custom",
        path: ["participantes"],
        message: "A missão deve possuir exatamente uma pessoa responsável.",
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
    id: "",
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

/**
 * Pessoas oferecidas como participante já cadastrado: só quem integra o
 * Comitê Gestor no ciclo, com vínculo não encerrado.
 *
 * Sai dos vínculos, e não de `/pessoas`: aquela lista mistura bolsistas,
 * docentes e contatos, e para em 100 nomes em ordem alfabética — o membro do
 * Comitê podia nem aparecer. Quem viaja sem integrar o Comitê entra como
 * "Cadastrar nova pessoa".
 */
export function pessoasDoComiteGestor(
  membros: {
    pessoaId: string;
    nome: string;
    email: string | null;
    tipoEquipe: string;
    situacao: string;
  }[],
) {
  const unicas = new Map<string, { id: string; nome: string; email: string | null }>();
  for (const membro of membros) {
    if (membro.tipoEquipe !== "COMITE_GESTOR" || membro.situacao === "ENCERRADO") {
      continue;
    }
    unicas.set(membro.pessoaId, {
      id: membro.pessoaId,
      nome: membro.nome,
      email: membro.email,
    });
  }
  return [...unicas.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function novoParticipante(
  responsavel = false,
): DadosFormularioMissaoComite["participantes"][number] {
  return {
    id: "",
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

export function opcional(valor: string): string | undefined {
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

export function dataParaIso(valor: string): string | null {
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(valor.trim());
  if (!correspondencia) return null;

  const [, dia, mes, ano] = correspondencia;
  const instante = new Date(
    Date.UTC(Number(ano), Number(mes) - 1, Number(dia)),
  );
  if (
    instante.getUTCFullYear() !== Number(ano) ||
    instante.getUTCMonth() + 1 !== Number(mes) ||
    instante.getUTCDate() !== Number(dia)
  ) {
    return null;
  }
  return `${ano}-${mes}-${dia}`;
}

/**
 * Payload da edicao (V1-030).
 *
 * Difere da criacao em duas coisas, e as duas importam:
 *
 * - **`id` acompanha cada participante e cada parada.** O endpoint reconcilia
 *   as listas inteiras; linha sem `id` e linha nova, entao omiti-lo duplicaria
 *   o roteiro a cada salvamento. Vazio vira `undefined`, que e como a API le
 *   "esta e nova".
 * - **`status` nao vai.** Mudar situacao e `/situacao`, com regra de origem e
 *   justificativa propria por acao — deixar o campo aqui daria dois caminhos
 *   para a mesma mudanca, e um deles sem as regras.
 */
export function payloadEdicaoMissao(dados: DadosFormularioMissaoComite) {
  const { status: _status, ...base } = payloadCriacaoMissao({
    ...dados,
    status: "RASCUNHO",
  });
  return {
    ...base,
    participantes: base.participantes.map((participante, indice) => ({
      ...participante,
      id: opcional(dados.participantes[indice].id),
    })),
    atividades: base.atividades.map((atividade, indice) => ({
      ...atividade,
      id: opcional(dados.atividades[indice].id),
    })),
  };
}

/**
 * Preenche o formulario com a missao que ja existe.
 *
 * Duas conversoes que a implementacao ingenua erra:
 *
 * - **`modoInstituicao` sai de `instituicaoDoCatalogo`**, e nao da presenca de
 *   `instituicaoId`: a parada com instituicao digitada a mao tem nome e nao
 *   tem id, e tratar isso como "nenhuma" apagaria o nome ao salvar.
 * - **participante existente entra como `existente`**, sempre. O modo "nova"
 *   descreve o ato de cadastrar alguem junto com a missao; depois de gravado,
 *   a pessoa existe — reabrir o formulario em "nova" criaria uma segunda.
 */
export function valoresDaMissao(
  missao: MissaoParaEdicao,
): DadosFormularioMissaoComite {
  return {
    titulo: missao.titulo,
    objetivo: missao.objetivo,
    dataInicio: isoParaData(missao.dataInicio),
    dataFim: isoParaData(missao.dataFim),
    // O formulario exige um dos dois, e a edicao nao muda situacao: o valor
    // so existe aqui para o schema fechar, e `payloadEdicaoMissao` o descarta.
    status: "RASCUNHO",
    observacoes: missao.observacoes ?? "",
    redes: missao.redes.map((rede) => rede.id),
    participantes: missao.participantes.map((participante) => ({
      id: participante.id,
      modoPessoa: "existente" as const,
      pessoaId: participante.pessoaId,
      nomePessoa: "",
      emailPessoa: "",
      cpfPessoa: "",
      tipoPessoa: "EXTERNO" as const,
      membroEquipeId: participante.membroEquipeId ?? "",
      papel: participante.papel,
      observacoes: participante.observacoes ?? "",
    })),
    atividades: missao.atividades.map((atividade) => ({
      id: atividade.id,
      tipo: atividade.tipo as DadosFormularioMissaoComite["atividades"][number]["tipo"],
      titulo: atividade.titulo,
      paisId: atividade.paisId,
      cidade: atividade.cidade ?? "",
      modoInstituicao: atividade.instituicaoDoCatalogo
        ? ("catalogo" as const)
        : atividade.instituicao
          ? ("livre" as const)
          : ("nenhuma" as const),
      instituicaoId: atividade.instituicaoDoCatalogo
        ? (atividade.instituicaoId ?? "")
        : "",
      instituicaoNome: atividade.instituicaoDoCatalogo
        ? ""
        : (atividade.instituicao ?? ""),
      eventoNome: atividade.eventoNome ?? "",
      dataInicio: isoParaData(atividade.dataInicio),
      dataFim: isoParaData(atividade.dataFim),
      planejamento: atividade.planejamento ?? "",
      observacoes: atividade.observacoes ?? "",
    })),
  };
}

/** O que `valoresDaMissao` precisa ler — um recorte de `MissaoDetalhe`. */
export interface MissaoParaEdicao {
  titulo: string;
  objetivo: string;
  dataInicio: string;
  dataFim: string;
  observacoes: string | null;
  redes: { id: string }[];
  participantes: {
    id: string;
    pessoaId: string;
    membroEquipeId: string | null;
    papel: "RESPONSAVEL" | "PARTICIPANTE" | "APOIO";
    observacoes?: string | null;
  }[];
  atividades: {
    id: string;
    tipo: string;
    titulo: string;
    paisId: string;
    cidade: string | null;
    instituicaoId: string | null;
    instituicao: string | null;
    instituicaoDoCatalogo: boolean;
    eventoNome: string | null;
    dataInicio: string;
    dataFim: string;
    planejamento: string | null;
    observacoes?: string | null;
  }[];
}

/** `2027-05-01` -> `01/05/2027`, o formato que os campos de data usam. */
function isoParaData(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return ano && mes && dia ? `${dia}/${mes}/${ano}` : "";
}
