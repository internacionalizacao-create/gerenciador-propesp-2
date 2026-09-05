import assert from "node:assert/strict";
import test from "node:test";

import { montarCorpoDaDespesa } from "../src/lib/formularios/despesa-payload.ts";

/**
 * Montagem do corpo da despesa (CG-053).
 *
 * O que se verifica aqui é o que quebra em silêncio: o pareamento das cotações
 * por índice e a conversão de data. Nenhum dos dois falha de forma visível — a
 * API aceitaria empresa de uma linha com valor de outra sem reclamar.
 */

function formulario(pares) {
  const dados = new FormData();
  for (const [campo, valor] of pares) dados.append(campo, valor);
  return dados;
}

test("pareia cada cotação com o próprio valor, pelo índice", () => {
  const corpo = montarCorpoDaDespesa(
    formulario([
      ["tipo", "PASSAGEM"],
      ["descricao", "Passagem internacional"],
      ["valorTotal", "4200.00"],
      ["cotacaoEmpresa", "TAP"],
      ["cotacaoValor", "4200.00"],
      ["cotacaoEmpresa", "LATAM"],
      ["cotacaoValor", "4700.00"],
    ]),
  );

  assert.deepEqual(corpo.passagem.cotacoes, [
    { empresa: "TAP", valor: "4200.00" },
    { empresa: "LATAM", valor: "4700.00" },
  ]);
});

test("descarta a linha em branco sem desalinhar as demais", () => {
  // Este é o caso que motiva o teste: filtrar cada lista **antes** do
  // pareamento casaria "LATAM" com "4200.00" e ninguém perceberia.
  const corpo = montarCorpoDaDespesa(
    formulario([
      ["tipo", "PASSAGEM"],
      ["cotacaoEmpresa", ""],
      ["cotacaoValor", ""],
      ["cotacaoEmpresa", "TAP"],
      ["cotacaoValor", "4200.00"],
      ["cotacaoEmpresa", "LATAM"],
      ["cotacaoValor", "4700.00"],
    ]),
  );

  assert.deepEqual(corpo.passagem.cotacoes, [
    { empresa: "TAP", valor: "4200.00" },
    { empresa: "LATAM", valor: "4700.00" },
  ]);
});

test("linha com empresa e sem valor não vira cotação", () => {
  const corpo = montarCorpoDaDespesa(
    formulario([
      ["tipo", "PASSAGEM"],
      ["cotacaoEmpresa", "TAP"],
      ["cotacaoValor", ""],
    ]),
  );

  assert.deepEqual(corpo.passagem.cotacoes, []);
});

test("converte data brasileira para ISO", () => {
  const corpo = montarCorpoDaDespesa(
    formulario([
      ["tipo", "DIARIA"],
      ["dataDocumento", "03/08/2027"],
      ["diariaDataInicio", "03/08/2027"],
      ["diariaDataFim", "07/08/2027"],
    ]),
  );

  assert.equal(corpo.dataDocumento, "2027-08-03");
  assert.equal(corpo.diaria.dataInicio, "2027-08-03");
  assert.equal(corpo.diaria.dataFim, "2027-08-07");
});

test("só passagem e diária levam especialização", () => {
  // Mandar `passagem` numa hospedagem é recusado pela API (CG-009); montar o
  // campo aqui produziria um erro que a pessoa não consegue corrigir na tela.
  for (const tipo of ["HOSPEDAGEM", "TRANSPORTE", "SEGURO", "OUTRA"]) {
    const corpo = montarCorpoDaDespesa(
      formulario([
        ["tipo", tipo],
        ["cotacaoEmpresa", "TAP"],
        ["cotacaoValor", "4200.00"],
        ["diariaDataInicio", "03/08/2027"],
      ]),
    );
    assert.equal(corpo.passagem, undefined, tipo);
    assert.equal(corpo.diaria, undefined, tipo);
  }
});

test("campo vazio vira undefined, e não string vazia", () => {
  // String vazia num campo opcional faria a API validar um valor que ninguém
  // digitou — e `participanteId: ""` não é um UUID.
  const corpo = montarCorpoDaDespesa(
    formulario([
      ["tipo", "OUTRA"],
      ["descricao", "Inscrição"],
      ["participanteId", ""],
      ["observacoes", "   "],
    ]),
  );

  assert.equal(corpo.participanteId, undefined);
  assert.equal(corpo.observacoes, undefined);
  assert.equal(corpo.descricao, "Inscrição");
});

test("exercício vira número, e ausência continua ausência", () => {
  const comAno = montarCorpoDaDespesa(
    formulario([
      ["tipo", "OUTRA"],
      ["exercicio", "2027"],
    ]),
  );
  assert.equal(comAno.exercicio, 2027);

  const semAno = montarCorpoDaDespesa(formulario([["tipo", "OUTRA"]]));
  assert.equal(semAno.exercicio, undefined);
});
