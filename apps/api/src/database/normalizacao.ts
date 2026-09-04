/**
 * Produz a chave persistida usada para comparar nomes de instituicoes.
 *
 * A chave so elimina diferencas inequivocas: caixa, acentos, pontuacao e
 * espacos. Siglas e traducoes continuam como candidatos para conciliacao
 * humana, pois uni-las automaticamente pode misturar instituicoes distintas.
 */
export function normalizarNomeInstituicao(nome: string): string {
  return nome
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}
