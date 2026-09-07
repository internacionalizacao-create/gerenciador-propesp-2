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
  SERVIDOR: "Servidor",
  DOCENTE: "Docente",
  DISCENTE: "Discente",
  PESQUISADOR: "Pesquisador",
  EXTERNO: "Externo",
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
  // categorias de documento da missao e da prestacao (CG-051/CG-052). Estavam
  // faltando desde entao e a tabela mostrava a constante crua.
  CONVITE: "Convite",
  PROGRAMACAO: "Programação",
  JUSTIFICATIVA: "Justificativa",
  ORCAMENTO: "Orçamento",
  PASSAGEM: "Passagem",
  BILHETE: "Bilhete",
  COMPROVANTE: "Comprovante",
  NOTA_FISCAL: "Nota fiscal",
  COMPROVANTE_DIARIAS: "Comprovante de diárias",
  COTACAO: "Cotação",
  // categorias de evidencia da galeria (CG-057). As fotos vao sem o prefixo
  // "Foto —" porque o cartao ja e visivelmente uma imagem; repeti-lo gastaria a
  // linha do selo dizendo o que a pessoa esta vendo.
  FOTO_REUNIAO: "Reunião",
  FOTO_EVENTO: "Evento",
  FOTO_VISITA: "Visita",
  FOTO_ASSINATURA: "Assinatura",
  FOTO_INSTITUICAO: "Instituição",
  FOTO_PARTICIPANTES: "Participantes",
  CERTIFICADO: "Certificado",
  ATA: "Ata",
  NOTICIA: "Notícia",
  APRESENTACAO: "Apresentação",
  LISTA_PRESENCA: "Lista de presença",
  DECLARACAO: "Declaração",
  // papeis na missao (CG-018)
  RESPONSAVEL: "Responsável",
  PARTICIPANTE: "Participante",
  APOIO: "Apoio",
  COMITE_GESTOR: "Comitê Gestor",
  ADMINISTRACAO: "Administração",
  // situacao da missao e do roteiro. `CONCLUIDA`, `CANCELADA` e `EM_ANDAMENTO`
  // ja estao acima, vindos da bolsa concedida, e o texto serve para os dois.
  RASCUNHO: "Rascunho",
  PLANEJADA: "Planejada",
  CONFIRMADA: "Confirmada",
  REALIZADA: "Realizada",
  NAO_REALIZADA: "Não realizada",
  FUTURA: "Futura",
  ENCERRADA: "Encerrada",
  // dimensao de aprovacao (CG-019). `EM_ANALISE` ja existe acima, vindo das
  // pendencias, e o texto serve para as duas.
  AJUSTES_SOLICITADOS: "Ajustes solicitados",
  APROVADA: "Aprovada",
  REPROVADA: "Reprovada",
  // relacionamento da atividade (CG-018)
  REUNIAO_INSTITUCIONAL: "Reunião institucional",
  COOPERACAO_ACADEMICA: "Cooperação acadêmica",
  PESQUISA: "Pesquisa",
  MOBILIDADE: "Mobilidade",
  CONVENIO: "Convênio",
  // produtos da missão e convênios (CG-056). `CONVENIO`, `PUBLICACAO`,
  // `PATENTE`, `EVENTO`, `MOBILIDADE`, `PREVISTO`, `EM_ANDAMENTO`, `VIGENTE`,
  // `ENCERRADO` e `CANCELADO` já estão acima e servem aos dois domínios.
  PROJETO_PESQUISA: "Projeto de pesquisa",
  TESE_COTUTELA: "Tese em cotutela",
  REDE_PESQUISA: "Rede de pesquisa",
  CAPTACAO_RECURSOS: "Captação de recursos",
  CONCLUIDO: "Concluído",
  EM_TRAMITACAO: "Em tramitação",
  INTERCAMBIO_PESQUISA: "Intercâmbio de pesquisa",
  DUPLA_TITULACAO: "Dupla titulação",
  COOPERACAO_TECNICA: "Cooperação técnica",
  INTERCAMBIO_ACADEMICO: "Intercâmbio acadêmico",
  MOBILIDADE_DOCENTE: "Mobilidade docente",
  COTUTELA: "Cotutela",
};

export function rotulo(valor: string | null | undefined): string {
  if (!valor) return "—";
  return ROTULOS[valor] ?? valor;
}

/** Data ISO (`2026-07-29`) no formato brasileiro, sem passar por fuso. */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dataIsoParaBr(iso);
}

/**
 * Instante (`timestamptz`) no fuso institucional, para o histórico.
 *
 * `America/Manaus` e não o fuso de quem abre a tela: o registro é da UEA, e um
 * parecer emitido às 17h em Manaus não deve aparecer como 18h para quem lê de
 * Brasília. Difere de `data()`, que trata data pura e por isso **não** passa
 * por fuso nenhum — converter `2027-08-03` deslocaria o dia.
 */
export function dataHora(iso: string | null | undefined): string {
  if (!iso) return "—";
  const instante = new Date(iso);
  if (Number.isNaN(instante.getTime())) return iso;

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    dateStyle: "short",
    timeStyle: "short",
  }).format(instante);
}

/** Converte a data persistida em ISO para a entrada brasileira, sem fuso. */
export function dataIsoParaBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const correspondencia = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!correspondencia) return iso;
  const [, ano, mes, dia] = correspondencia;
  return `${dia}/${mes}/${ano}`;
}

/**
 * Converte DD/MM/AAAA para o contrato ISO da API e rejeita datas impossiveis.
 * A construcao em UTC evita que o fuso de Manaus desloque o dia.
 */
export function dataBrParaIso(br: string | null | undefined): string | null {
  if (!br) return null;
  const correspondencia = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br.trim());
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

/** Mascara progressiva para digitacao e colagem no padrao DD/MM/AAAA. */
export function mascararDataBr(valor: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
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
