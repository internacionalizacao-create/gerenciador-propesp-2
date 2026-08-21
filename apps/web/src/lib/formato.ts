/**
 * Formatacao de numeros e rotulos.
 *
 * A API devolve dinheiro como **string** (`"1144357.20"`), nao como number, e
 * isso e proposital: `numeric` do Postgres soma exato e converter para `number`
 * no caminho reintroduziria o erro de centavo. Aqui o valor so vira `number` no
 * ultimo passo, para ser desenhado — nunca antes de uma conta.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const INTEIRO = new Intl.NumberFormat("pt-BR");

const DECIMAL = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

const PERCENTUAL = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

/**
 * Texto usado onde o dado nao existe.
 *
 * Vale a pena o cuidado: "A definir" e "R$ 0,00" sao coisas diferentes, e a
 * UNICAMP e o caso concreto. Escrever zero onde falta orcamento e o erro que a
 * planilha cometia e que derrubava toda media do painel.
 */
export const A_DEFINIR = "A definir";

export function moeda(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return A_DEFINIR;
  return MOEDA.format(Number(valor));
}

export function inteiro(valor: number | string | null | undefined): string {
  if (valor === null || valor === undefined) return A_DEFINIR;
  return INTEIRO.format(Number(valor));
}

/** Vigencia em meses aceita meia unidade: 0,5 mes = ate 15 dias (RN-02). */
export function meses(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const numero = Number(valor);
  return `${DECIMAL.format(numero)} ${numero === 1 ? "mês" : "meses"}`;
}

export function percentual(fracao: number | null | undefined): string {
  if (fracao === null || fracao === undefined) return A_DEFINIR;
  return PERCENTUAL.format(fracao);
}

/** Semaforo de RN-07: abaixo de 90% sobra recurso; acima de 100% estoura. */
export function faixaDeUtilizacao(
  fracao: number | null | undefined,
): "ocioso" | "saudavel" | "estouro" | "indefinido" {
  if (fracao === null || fracao === undefined) return "indefinido";
  if (fracao > 1) return "estouro";
  if (fracao < 0.9) return "ocioso";
  return "saudavel";
}

/**
 * Enums do banco chegam em MAIUSCULA_COM_UNDERSCORE (glossario, §2). A traducao
 * para o texto do usuario mora aqui, num lugar so, para nao divergir entre telas.
 */
const ROTULOS: Record<string, string> = {
  // destino e fluxo
  BRASIL: "Brasil",
  EXTERIOR: "Exterior",
  IN: "IN — entra na UEA",
  OUT: "OUT — sai da UEA",
  // rubrica
  BOLSAS: "Bolsas",
  MANUTENCAO: "Manutenção",
  MISSOES: "Missões",
  // status de item planejado
  PROGRAMADO: "Programado",
  PENDENTE: "Pendente",
  CANCELADO: "Cancelado",
  // bolsa concedida e situacao temporal derivada
  SELECIONADO: "Selecionado",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
  INTERROMPIDA: "Interrompida",
  PROGRAMADA: "Programada",
  PROXIMA: "Próxima",
  EM_VIGENCIA: "Em vigência",
  PRESTES_A_EXPIRAR: "Prestes a expirar",
  EXPIRADA: "Expirada",
  // status de orcamento
  DEFINIDO: "Definido",
  A_DEFINIR: "A definir",
  // status de ciclo
  PLANEJAMENTO: "Em planejamento",
  VIGENTE: "Vigente",
  ENCERRADO: "Encerrado",
  // situacao de participacao
  CONTEMPLADO: "Contemplado",
  CADASTRO_PRELIMINAR: "Cadastro preliminar",
  NAO_CONTEMPLADO: "Não contemplado",
  // nivel e modalidade de PPG
  MESTRADO: "Mestrado",
  DOUTORADO: "Doutorado",
  MESTRADO_DOUTORADO: "Mestrado e doutorado",
  MESTRADO_PROFISSIONAL: "Mestrado profissional",
  ACADEMICO: "Acadêmico",
  PROFISSIONAL: "Profissional",
  ATIVO: "Ativo",
  INATIVO: "Inativo",
  EM_IMPLANTACAO: "Em implantação",
  // pendencia
  EM_ANALISE: "Em análise",
  MONITORAR: "Monitorar",
  RESOLVIDA: "Resolvida",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
  MANUAL: "Manual",
  AUTOMATICA: "Detectada pelo sistema",
  GERAL: "Geral",
  REDE: "Rede",
  AREA_TEMATICA: "Área temática",
  PPG: "PPG",
  // origem do valor unitario
  CATALOGO: "Catálogo",
  ESTIMADO: "Estimado",
  INDEFINIDO: "Sem valor",
  // meses
  JANEIRO: "Janeiro",
  FEVEREIRO: "Fevereiro",
  MARCO: "Março",
  ABRIL: "Abril",
  MAIO: "Maio",
  JUNHO: "Junho",
  JULHO: "Julho",
  AGOSTO: "Agosto",
  SETEMBRO: "Setembro",
  OUTUBRO: "Outubro",
  NOVEMBRO: "Novembro",
  DEZEMBRO: "Dezembro",
  // tipos de missao e despesa
  VISITA_TECNICA: "Visita técnica",
  EVENTO: "Evento",
  ARTICULACAO: "Articulação",
  BANCA: "Banca",
  OUTRO: "Outro",
  MATERIAL_CONSUMO: "Material de consumo",
  SERVICO: "Serviço",
  EQUIPAMENTO: "Equipamento",
  PUBLICACAO: "Publicação",
  // nivel do beneficiario e produtos da bolsa
  POS_DOC: "Pós-doutorado",
  DOCENTE: "Docente",
  MOBILIDADE_BREVE: "Mobilidade breve",
  ARTIGO: "Artigo",
  TRABALHO: "Trabalho",
  PROJETO: "Projeto",
  RELATORIO: "Relatório",
  LIVRO: "Livro",
  CAPITULO_LIVRO: "Capítulo de livro",
  PATENTE: "Patente",
  PREVISTO: "Previsto",
  EM_DESENVOLVIMENTO: "Em desenvolvimento",
  ENTREGUE: "Entregue",
  VALIDADO: "Validado",
  ATRASADO: "Atrasado",
};

export function rotulo(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULOS[valor] ?? valor;
}

/** Data ISO (`2026-07-29`) no formato brasileiro, sem passar por fuso. */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Soma dinheiro que veio como string, em centavos inteiros.
 *
 * `0.1 + 0.2 !== 0.3` em ponto flutuante, e o desvio aparece justamente em somas
 * de muitas parcelas de seis dígitos — que é o que uma coluna de total é.
 * `BigInt` de centavos não tem esse problema.
 *
 * Nulo é ignorado; se **tudo** for nulo o resultado é nulo, não zero. Uma rede
 * sem orçamento definido não tem total, e escrever "R$ 0,00" ali afirmaria algo
 * que ninguém prometeu.
 */
export function somarMoeda(
  valores: readonly (string | null | undefined)[],
): string | null {
  const presentes = valores.filter(
    (v): v is string => v !== null && v !== undefined,
  );
  if (presentes.length === 0) return null;

  const centavos = presentes.reduce((total, valor) => {
    const [inteira, decimal = ""] = valor.trim().split(".");
    return total + BigInt(`${inteira}${decimal.padEnd(2, "0").slice(0, 2)}`);
  }, 0n);

  const negativo = centavos < 0n;
  const absoluto = negativo ? -centavos : centavos;
  return `${negativo ? "-" : ""}${absoluto / 100n}.${String(absoluto % 100n).padStart(2, "0")}`;
}
