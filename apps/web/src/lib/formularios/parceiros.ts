import { z } from "zod";

/**
 * Schemas dos formulários de parceiro e contato (CG-049).
 *
 * A API valida de novo — ela é a fronteira autoritativa. O schema daqui existe
 * para o erro aparecer no campo antes da viagem, e para o objeto que chega na
 * Server Action já ser tipado.
 *
 * Campos opcionais são `""` e não `undefined`: input controlado do React não
 * aceita `undefined` sem reclamar de troca de controlado para não controlado.
 * A conversão para `null` acontece em `payloadParceiro`/`payloadContato`.
 */

const opcional = (maximo: number) => z.string().trim().max(maximo);

export const formularioParceiroSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome da instituição.")
    .max(240, "No máximo 240 caracteres."),
  sigla: opcional(40),
  paisId: z.string(),
  cidade: opcional(120),
  estadoRegiao: opcional(120),
  tipoOrganizacao: opcional(120),
  faculdadeDepartamento: opcional(240),
  areasAtuacao: opcional(2000),
  programaRelacionado: opcional(240),
  grupoPesquisa: opcional(240),
  /**
   * Obrigatória no cadastro; a API a recusa vazia e **não a aceita na edição**,
   * porque a origem é fato histórico e não se reescreve (BOL-030). No
   * formulário de edição o campo aparece como texto, não como seletor.
   */
  origemRelacionamento: z.string(),
  origemObservacao: opcional(2000),
  estagioRelacionamento: z.enum([
    "IDENTIFICADA",
    "CONTATO_INICIADO",
    "COOPERACAO_EM_AVALIACAO",
  ]),
  site: opcional(240).refine(
    (valor) => valor === "" || z.url().safeParse(valor).success,
    "Informe uma URL válida, começando com https://",
  ),
  emailInstitucional: opcional(240).refine(
    (valor) => valor === "" || z.email().safeParse(valor).success,
    "Informe um e-mail válido.",
  ),
  telefone: opcional(80),
  endereco: opcional(2000),
  observacoes: opcional(4000),
  cadastroProvisorio: z.boolean(),
  redeIds: z.array(z.string()).max(30),
  /**
   * Vira `true` quando a pessoa vê os candidatos e decide seguir mesmo assim.
   * Sem isso a API recusa de novo, e é essa recusa que impede o cadastro
   * duplicado criado no automático.
   */
  confirmarPossivelDuplicidade: z.boolean(),
});

export type DadosFormularioParceiro = z.infer<typeof formularioParceiroSchema>;

export const formularioContatoSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(3, "Informe o nome do contato.")
    .max(240, "No máximo 240 caracteres."),
  cargo: opcional(160),
  departamento: opcional(240),
  area: opcional(160),
  email: opcional(240).refine(
    (valor) => valor === "" || z.email().safeParse(valor).success,
    "Informe um e-mail válido.",
  ),
  telefone: opcional(80),
  paisId: z.string(),
  idiomaComunicacao: opcional(80),
  observacoes: opcional(4000),
  principal: z.boolean(),
  confirmarPossivelDuplicidade: z.boolean(),
});

export type DadosFormularioContato = z.infer<typeof formularioContatoSchema>;

/**
 * `""` vira `null`, nunca `undefined`.
 *
 * No PATCH da API, `undefined` significa **manter o valor atual** e `null`
 * significa **limpar**. Mandar `undefined` para um campo que a pessoa apagou
 * faria a edição silenciosamente ignorar o apagamento.
 */
export function textoOuNulo(valor: string): string | null {
  const limpo = valor.trim();
  return limpo === "" ? null : limpo;
}

export function payloadParceiro(dados: DadosFormularioParceiro) {
  return {
    nome: dados.nome.trim(),
    sigla: textoOuNulo(dados.sigla),
    paisId: textoOuNulo(dados.paisId),
    cidade: textoOuNulo(dados.cidade),
    estadoRegiao: textoOuNulo(dados.estadoRegiao),
    tipoOrganizacao: textoOuNulo(dados.tipoOrganizacao),
    faculdadeDepartamento: textoOuNulo(dados.faculdadeDepartamento),
    areasAtuacao: textoOuNulo(dados.areasAtuacao),
    programaRelacionado: textoOuNulo(dados.programaRelacionado),
    grupoPesquisa: textoOuNulo(dados.grupoPesquisa),
    origemObservacao: textoOuNulo(dados.origemObservacao),
    estagioRelacionamento: dados.estagioRelacionamento,
    site: textoOuNulo(dados.site),
    emailInstitucional: textoOuNulo(dados.emailInstitucional),
    telefone: textoOuNulo(dados.telefone),
    endereco: textoOuNulo(dados.endereco),
    observacoes: textoOuNulo(dados.observacoes),
    cadastroProvisorio: dados.cadastroProvisorio,
    redeIds: dados.redeIds,
    confirmarPossivelDuplicidade: dados.confirmarPossivelDuplicidade,
  };
}

export const ORIGENS_RELACIONAMENTO = [
  { valor: "RECEBEU_BOLSISTA", texto: "Recebeu bolsista CAPES Global.Edu" },
  { valor: "INDICACAO_PESQUISADOR", texto: "Indicação de pesquisador/docente UEA" },
  { valor: "CONTATO_PPG", texto: "Contato realizado pelo PPG" },
  { valor: "EVENTO_INTERNACIONAL", texto: "Evento internacional" },
  { valor: "PROSPECCAO_INSTITUCIONAL", texto: "Prospecção institucional" },
  { valor: "OUTRO", texto: "Outro" },
] as const;

export const ESTAGIOS_RELACIONAMENTO = [
  { valor: "IDENTIFICADA", texto: "Instituição identificada" },
  { valor: "CONTATO_INICIADO", texto: "Contato institucional iniciado" },
  { valor: "COOPERACAO_EM_AVALIACAO", texto: "Cooperação em avaliação" },
] as const;

/**
 * Corpo do **cadastro**, que é o único que carrega a origem.
 *
 * A edição usa `payloadParceiro` puro: a API não aceita a origem lá, e mandá-la
 * seria escrever no corpo um campo que o schema do outro lado descarta — o tipo
 * de coisa que funciona por acidente até alguém "corrigir" o schema.
 */
export function payloadParceiroNovo(dados: DadosFormularioParceiro) {
  return {
    ...payloadParceiro(dados),
    origemRelacionamento: dados.origemRelacionamento,
  };
}

export function payloadContato(
  dados: DadosFormularioContato,
  instituicaoId: string,
) {
  return {
    instituicaoId,
    nome: dados.nome.trim(),
    cargo: textoOuNulo(dados.cargo),
    departamento: textoOuNulo(dados.departamento),
    area: textoOuNulo(dados.area),
    email: textoOuNulo(dados.email),
    telefone: textoOuNulo(dados.telefone),
    paisId: textoOuNulo(dados.paisId),
    idiomaComunicacao: textoOuNulo(dados.idiomaComunicacao),
    observacoes: textoOuNulo(dados.observacoes),
    principal: dados.principal,
    confirmarPossivelDuplicidade: dados.confirmarPossivelDuplicidade,
  };
}
