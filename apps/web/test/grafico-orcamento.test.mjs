import assert from "node:assert/strict";
import test from "node:test";

import { montarSerie } from "../src/componentes/graficos/orcamento-por-rede-serie.ts";

/**
 * A regra que estes testes travam e a mesma do componente `Moeda`: ausencia de
 * valor nao e zero. Num grafico ela e mais facil de violar sem perceber, porque
 * `Number(null)` da 0 em silencio e a barra resultante parece um orcamento
 * zerado legitimo.
 */

function linha(rede, ano, totalPrevisto) {
  return { rede, ano, totalPrevisto, redeId: rede, statusOrcamento: "DEFINIDO" };
}

test("valor ausente permanece null, nunca vira zero", () => {
  const { dados } = montarSerie([linha("UNESP", 2027, null)], [2027]);
  assert.equal(dados[0].UNESP, null);
  assert.notEqual(dados[0].UNESP, 0);
});

test("rede sem linha no exercicio tambem fica null", () => {
  // A UFMG so tem 2027; 2028 nao pode aparecer como barra zerada.
  const { dados } = montarSerie(
    [linha("UFMG", 2027, "1000.00"), linha("UNESP", 2028, "2000.00")],
    [2027, 2028],
  );
  assert.equal(dados[0].UFMG, 1000);
  assert.equal(dados[1].UFMG, null);
  assert.equal(dados[0].UNESP, null);
});

test("zero de verdade continua sendo zero", () => {
  // Distinto de null: aqui alguem informou R$ 0,00, e a barra rente ao eixo e a
  // leitura correta.
  const { dados } = montarSerie([linha("UNESP", 2027, "0.00")], [2027]);
  assert.equal(dados[0].UNESP, 0);
});

test("sem nenhum valor conhecido o grafico nao e desenhado", () => {
  const vazio = montarSerie([linha("UFMG", 2027, null)], [2027]);
  assert.equal(vazio.temAlgumValor, false);

  const comValor = montarSerie([linha("UFMG", 2027, "1.00")], [2027]);
  assert.equal(comValor.temAlgumValor, true);
});

test("cada rede aparece uma unica vez, mesmo com varios exercicios", () => {
  const { nomes } = montarSerie(
    [linha("UFMG", 2027, "1.00"), linha("UFMG", 2028, "2.00")],
    [2027, 2028],
  );
  assert.deepEqual(nomes, ["UFMG"]);
});
