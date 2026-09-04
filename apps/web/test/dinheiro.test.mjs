import assert from "node:assert/strict";
import test from "node:test";

import {
  A_DEFINIR,
  faixaDeUtilizacao,
  inteiro,
  moeda,
  percentual,
  somarMoeda,
} from "../src/lib/formato.ts";

/**
 * Regressões dos cálculos monetários (CG-062).
 *
 * Duas regras do sistema moram aqui e não estavam travadas por teste nenhum:
 *
 * 1. dinheiro nunca passa por `number` antes de uma conta;
 * 2. ausência de valor não é zero.
 *
 * As duas já foram violadas na planilha de origem, e a segunda é o que derrubava
 * a média do painel por causa da UNICAMP.
 */

/* O separador do pt-BR é espaço não separável (U+00A0), não espaço comum. */
const NBSP = " ";

test("a soma em centavos e exata, sem depender de arredondamento final", () => {
  // Mil parcelas de sete centavos. Em ponto flutuante o acumulado chega a
  // 69.99999999999966 — um arredondamento no fim ainda salvaria a exibicao,
  // mas o valor intermediario ja esta errado, e e ele que alimenta
  // comparacoes de saldo e divergencia.
  const parcelas = Array(1000).fill("0.07");
  assert.equal(somarMoeda(parcelas), "70.00");

  const emFloat = parcelas.reduce((total, valor) => total + Number(valor), 0);
  assert.notEqual(emFloat, 70);

  assert.equal(somarMoeda(["0.10", "0.20"]), "0.30");
});

test("cada parcela vira centavo antes de somar, e nao depois", () => {
  // Este e o caso que separa de verdade a implementacao atual de uma soma em
  // `number`: mil parcelas de 8,615. Truncando parcela a parcela da 8.610,00;
  // somando em float e arredondando so no fim da 8.615,00 — cinco reais de
  // diferenca. A ordem entre truncar e somar e uma decisao, nao um detalhe.
  assert.equal(somarMoeda(Array(1000).fill("8.615")), "8610.00");
  // Tres meios-centavos nao viram um centavo: cada um trunca para zero.
  assert.equal(somarMoeda(["0.005", "0.005", "0.005"]), "0.00");
});

test("soma valores grandes sem perder precisao", () => {
  // Parcelas de seis dígitos são o tamanho real de uma rubrica de rede.
  assert.equal(
    somarMoeda(["233854.04", "140018.40", "381333.00"]),
    "755205.44",
  );
});

test("ausencia de valor nao vira zero", () => {
  // Se TUDO for nulo, o total é nulo — a rede sem orçamento definido não tem
  // total, e "R$ 0,00" afirmaria um número que ninguém prometeu.
  assert.equal(somarMoeda([]), null);
  assert.equal(somarMoeda([null, undefined]), null);

  // Mas nulo entre valores presentes é ignorado, não contamina a soma.
  assert.equal(somarMoeda(["10.00", null, "5.50", undefined]), "15.50");
});

test("zero de verdade continua sendo zero", () => {
  // A distincao e o ponto: ausente vira "A definir", zero informado vira
  // "R$ 0,00". Colapsar os dois e exatamente o erro da planilha.
  assert.equal(moeda(0), `R$${NBSP}0,00`);
  assert.equal(moeda("0.00"), `R$${NBSP}0,00`);
  assert.equal(somarMoeda(["0.00"]), "0.00");

  assert.equal(moeda(null), A_DEFINIR);
  assert.equal(moeda(undefined), A_DEFINIR);
  // String vazia tambem e ausencia: e o que a API devolve para campo nao
  // preenchido em alguns caminhos.
  assert.equal(moeda(""), A_DEFINIR);
});

test("formata em real brasileiro com milhar e dois decimais", () => {
  assert.equal(moeda("1234.5"), `R$${NBSP}1.234,50`);
  assert.equal(moeda("9261778.32"), `R$${NBSP}9.261.778,32`);
});

test("soma negativa preserva o sinal e os centavos", () => {
  // Devolucao e estorno existem; o sinal nao pode se perder na conversao.
  assert.equal(somarMoeda(["-10.50", "0.50"]), "-10.00");
  assert.equal(somarMoeda(["-0.50"]), "-0.50");
  assert.equal(somarMoeda(["-10.50", "10.50"]), "0.00");
});

test("valor sem casas decimais e tratado como reais inteiros", () => {
  assert.equal(somarMoeda(["10"]), "10.00");
  assert.equal(somarMoeda(["10", "0.5"]), "10.50");
});

test("terceira casa decimal e truncada, nao arredondada", () => {
  // Comportamento defensivo: as colunas do banco sao numeric(_, 2), entao um
  // terceiro decimal nao deveria chegar aqui. Se chegar, trunca — o teste
  // existe para que a escolha seja deliberada e nao uma surpresa.
  assert.equal(somarMoeda(["10.567"]), "10.56");
  assert.equal(somarMoeda(["10.999"]), "10.99");
});

test("inteiro e percentual tambem distinguem ausencia de zero", () => {
  assert.equal(inteiro(null), A_DEFINIR);
  assert.equal(inteiro(undefined), A_DEFINIR);
  assert.equal(inteiro(0), "0");
  assert.equal(percentual(null), A_DEFINIR);
  assert.equal(percentual(0), "0,0%");
  assert.equal(percentual(0.5), "50,0%");
});

test("o semaforo de utilizacao respeita as fronteiras da RN-07", () => {
  // Abaixo de 90% sobra recurso; acima de 100% estoura. As fronteiras exatas
  // sao o que separa "saudavel" de alerta, e trocar < por <= muda o que a
  // equipe ve no painel.
  assert.equal(faixaDeUtilizacao(null), "indefinido");
  assert.equal(faixaDeUtilizacao(0.899), "ocioso");
  assert.equal(faixaDeUtilizacao(0.9), "saudavel");
  assert.equal(faixaDeUtilizacao(1), "saudavel");
  assert.equal(faixaDeUtilizacao(1.0001), "estouro");
});
