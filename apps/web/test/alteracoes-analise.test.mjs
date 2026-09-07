import assert from "node:assert/strict";
import test from "node:test";

import {
  alteracoesDaRodada,
  ultimaDecisaoEm,
} from "../src/lib/formularios/alteracoes-analise.ts";

/**
 * Janela de alterações da rodada em análise (CG-048).
 *
 * São duas bordas e errar qualquer uma passa despercebido na tela: sobra
 * histórico já lido, ou entram mudanças de execução que não são a proposta.
 */

const historico = [
  { id: "antiga", acao: "EDICAO", ocorridoEm: "2026-09-01T10:00:00.000Z" },
  { id: "criacao", acao: "CRIACAO", ocorridoEm: "2026-09-03T10:00:00.000Z" },
  { id: "resposta", acao: "EDICAO", ocorridoEm: "2026-09-04T10:00:00.000Z" },
  { id: "depois", acao: "EDICAO", ocorridoEm: "2026-09-06T10:00:00.000Z" },
];

const ids = (registros) => registros.map((registro) => registro.id);

const janela = {
  ultimaDecisaoEm: "2026-09-02T10:00:00.000Z",
  submetidoEm: "2026-09-05T10:00:00.000Z",
};

test("mostra só o que mudou entre a decisão anterior e o reenvio", () => {
  assert.deepEqual(ids(alteracoesDaRodada(historico, janela)), ["resposta"]);
});

test("sem a borda de baixo, a rodada já lida voltaria à lista", () => {
  // É o que o relator não precisa reler: a proposta anterior já foi analisada.
  assert.deepEqual(
    ids(alteracoesDaRodada(historico, { submetidoEm: janela.submetidoEm })),
    ["antiga", "resposta"],
  );
});

test("sem a borda de cima, entram mudanças de execução", () => {
  // Aprovação e execução são eixos independentes (CG-006): a missão avança de
  // planejada a concluída enquanto a análise corre, e essas transições não são
  // a proposta que o Comitê analisa.
  assert.deepEqual(
    ids(
      alteracoesDaRodada(historico, {
        ultimaDecisaoEm: janela.ultimaDecisaoEm,
      }),
    ),
    ["resposta", "depois"],
  );
});

test("na primeira rodada não há corte de baixo — tudo é novidade", () => {
  assert.deepEqual(
    ids(alteracoesDaRodada(historico, { submetidoEm: janela.submetidoEm })),
    ["antiga", "resposta"],
  );
});

test("só edição entra; criação não é alteração", () => {
  const tudo = alteracoesDaRodada(historico, {});
  assert.equal(
    tudo.some((registro) => registro.acao === "CRIACAO"),
    false,
  );
});

test("o registro no instante exato do envio ainda conta", () => {
  // A borda é inclusiva de propósito: a última edição antes de clicar em enviar
  // pode cair no mesmo segundo, e excluí-la esconderia justamente o ajuste que
  // motivou o reenvio.
  const noLimite = [
    { id: "limite", acao: "EDICAO", ocorridoEm: janela.submetidoEm },
  ];
  assert.deepEqual(ids(alteracoesDaRodada(noLimite, janela)), ["limite"]);
});

test("a última decisão é a mais recente entre as encerradas", () => {
  assert.equal(
    ultimaDecisaoEm([
      { encerradaEm: "2026-09-02T10:00:00.000Z" },
      { encerradaEm: null },
      { encerradaEm: "2026-09-04T10:00:00.000Z" },
    ]),
    "2026-09-04T10:00:00.000Z",
  );

  // Rodada aberta não encerrou nada: primeira análise não tem corte.
  assert.equal(ultimaDecisaoEm([{ encerradaEm: null }]), undefined);
});
