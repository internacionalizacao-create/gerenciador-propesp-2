import { z } from "zod";

/**
 * Produto da missão (V1-031).
 *
 * Domínio próprio, separado de `produto_bolsa` desde a CG-056: são duas
 * cobranças sobre coisas diferentes, e reaproveitar a tabela deixaria
 * `bolsa_concedida_id` nulo em metade das linhas. O formulário segue a mesma
 * separação — não reusa o de produto de bolsa.
 *
 * O schema daqui espelha `criarProdutoMissaoSchema` da API, que continua sendo
 * a fronteira autoritativa: este existe para o erro aparecer no campo certo
 * antes da viagem de ida.
 */

export const TIPOS_PRODUTO_MISSAO = [
  { valor: "CONVENIO", texto: "Convênio" },
  { valor: "PROJETO_PESQUISA", texto: "Projeto de pesquisa" },
  { valor: "PUBLICACAO", texto: "Publicação" },
  { valor: "TESE_COTUTELA", texto: "Tese em cotutela" },
  { valor: "PATENTE", texto: "Patente" },
  { valor: "EVENTO", texto: "Evento" },
  { valor: "REDE_PESQUISA", texto: "Rede de pesquisa" },
  { valor: "MOBILIDADE", texto: "Mobilidade" },
  { valor: "CAPTACAO_RECURSOS", texto: "Captação de recursos" },
  { valor: "ORIENTACAO_CONJUNTA", texto: "Orientação conjunta" },
  { valor: "OUTRO", texto: "Outro" },
] as const;

export const SITUACOES_PRODUTO_MISSAO = [
  { valor: "PREVISTO", texto: "Previsto" },
  { valor: "EM_ANDAMENTO", texto: "Em andamento" },
  { valor: "CONCLUIDO", texto: "Concluído" },
  { valor: "CANCELADO", texto: "Cancelado" },
] as const;

const opcionalCom = (maximo: number) => z.string().trim().max(maximo);

export const formularioProdutoMissaoSchema = z
  .object({
    tipo: z.enum([
      "CONVENIO",
      "PROJETO_PESQUISA",
      "PUBLICACAO",
      "TESE_COTUTELA",
      "PATENTE",
      "EVENTO",
      "REDE_PESQUISA",
      "MOBILIDADE",
      "CAPTACAO_RECURSOS",
      "ORIENTACAO_CONJUNTA",
      "OUTRO",
    ]),
    titulo: z.string().trim().min(3, "Informe o título do produto.").max(300),
    descricao: opcionalCom(5000),
    situacao: z.enum(["PREVISTO", "EM_ANDAMENTO", "CONCLUIDO", "CANCELADO"]),
    /**
     * Texto, e não `number`: o campo vazio vira `NaN` num input numérico, e
     * `NaN` some do payload em vez de virar erro visível. A conversão acontece
     * no payload, depois da validação.
     */
    ano: z
      .string()
      .trim()
      .refine(
        (valor) => valor === "" || /^\d{4}$/.test(valor),
        "Informe o ano com quatro dígitos.",
      )
      .refine(
        (valor) =>
          valor === "" || (Number(valor) >= 2000 && Number(valor) <= 2100),
        "O ano precisa estar entre 2000 e 2100.",
      ),
    referencia: opcionalCom(500),
    observacoes: opcionalCom(4000),
    convenioId: z.string(),
    instituicoesIds: z.array(z.uuid()).max(20),
    redesIds: z.array(z.uuid()).max(10),
    responsaveisIds: z.array(z.uuid()).max(20),
  })
  .superRefine((valor, contexto) => {
    /*
      O `check` do banco é bicondicional, e o formulário repete as duas metades
      porque elas escondem coisas diferentes: convênio sem acordo apontado é
      produto que não diz qual acordo; acordo apontado em produto que não é
      convênio é vínculo que ninguém vai procurar ali.
    */
    if (valor.tipo === "CONVENIO" && !valor.convenioId) {
      contexto.addIssue({
        code: "custom",
        path: ["convenioId"],
        message: "Produto do tipo convênio exige o acordo já cadastrado.",
      });
    }
    if (valor.tipo !== "CONVENIO" && valor.convenioId) {
      contexto.addIssue({
        code: "custom",
        path: ["convenioId"],
        message: "Somente produto do tipo convênio aponta para um acordo.",
      });
    }
  });

export type DadosFormularioProdutoMissao = z.infer<
  typeof formularioProdutoMissaoSchema
>;

export function produtoVazio(): DadosFormularioProdutoMissao {
  return {
    tipo: "PUBLICACAO",
    titulo: "",
    descricao: "",
    situacao: "PREVISTO",
    ano: "",
    referencia: "",
    observacoes: "",
    convenioId: "",
    instituicoesIds: [],
    redesIds: [],
    responsaveisIds: [],
  };
}

/** Preenche o formulário com o produto já gravado. */
export function valoresDoProduto(produto: {
  tipo: string;
  titulo: string;
  descricao: string | null;
  situacao: string;
  ano: number | null;
  referencia: string | null;
  observacoes: string | null;
  convenio: { id: string } | null;
  instituicoes: { id: string }[];
  redes: { id: string }[];
  responsaveis: { id: string }[];
}): DadosFormularioProdutoMissao {
  return {
    tipo: produto.tipo as DadosFormularioProdutoMissao["tipo"],
    titulo: produto.titulo,
    descricao: produto.descricao ?? "",
    situacao: produto.situacao as DadosFormularioProdutoMissao["situacao"],
    ano: produto.ano === null ? "" : String(produto.ano),
    referencia: produto.referencia ?? "",
    observacoes: produto.observacoes ?? "",
    convenioId: produto.convenio?.id ?? "",
    instituicoesIds: produto.instituicoes.map((item) => item.id),
    redesIds: produto.redes.map((item) => item.id),
    responsaveisIds: produto.responsaveis.map((item) => item.id),
  };
}

/**
 * Converte o modelo visual no contrato da API.
 *
 * **Vazio vira `null`, nunca string vazia**: a API trata `''` como ausência via
 * `preprocess`, mas mandar `null` explícito é o que faz a intenção "limpei este
 * campo" chegar igual na criação e na edição.
 *
 * `responsaveis` sai como objeto com `papel: null` — o papel dentro do produto
 * não é o papel na missão, e inventar um a partir do outro afirmaria algo que
 * ninguém declarou.
 */
export function payloadProdutoMissao(dados: DadosFormularioProdutoMissao) {
  return {
    tipo: dados.tipo,
    titulo: dados.titulo,
    descricao: dados.descricao || null,
    situacao: dados.situacao,
    ano: dados.ano === "" ? null : Number(dados.ano),
    referencia: dados.referencia || null,
    observacoes: dados.observacoes || null,
    convenioId: dados.tipo === "CONVENIO" ? dados.convenioId : null,
    instituicoesIds: dados.instituicoesIds,
    redesIds: dados.redesIds,
    responsaveis: dados.responsaveisIds.map((pessoaId) => ({
      pessoaId,
      papel: null,
    })),
  };
}
