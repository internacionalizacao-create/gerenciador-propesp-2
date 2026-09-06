import assert from "node:assert/strict";
import test from "node:test";

import {
  formularioRelatoSchema,
  payloadAtividadeExtra,
  payloadRelato,
} from "../src/lib/formularios/relato-missao.ts";

/**
 * Montagem do corpo do relato (CG-046).
 *
 * O que se verifica aqui é o que falha em silêncio: a API aceitaria tudo isto
 * sem reclamar e gravaria a coisa errada.
 */

const relato = (extra = {}) => ({
  relatoGeral: "A missao ocorreu conforme o roteiro previsto pela equipe.",
  resultados: "",
  avaliacaoObjetivos: "",
  avaliacaoJustificativa: "",
  desdobramentos: "",
  atividades: [],
  ...extra,
});

test('avaliação vazia vira ausência, e não string vazia', () => {
  // `""` é o valor do <select> sem escolha. Mandá-lo faria a API validar um
  // valor que não existe no enum; a ausência é o que significa "não respondeu"
  // e é o que o checklist de encerramento cobra.
  const corpo = payloadRelato(relato());
  assert.equal(corpo.avaliacaoObjetivos, undefined);
  assert.equal(corpo.avaliacaoJustificativa, undefined);
});

test("a justificativa acompanha a resposta e some no SIM", () => {
  // O campo fica escondido quando a resposta é SIM, mas o texto digitado antes
  // continua no estado do formulário. Mandá-lo gravaria a explicação de um
  // insucesso que a tela não mostra mais.
  const corpo = payloadRelato(
    relato({
      avaliacaoObjetivos: "SIM",
      avaliacaoJustificativa: "Sobrou de uma resposta anterior",
    }),
  );
  assert.equal(corpo.avaliacaoObjetivos, "SIM");
  assert.equal(corpo.avaliacaoJustificativa, undefined);

  const parcial = payloadRelato(
    relato({
      avaliacaoObjetivos: "PARCIALMENTE",
      avaliacaoJustificativa: "Uma visita foi cancelada.",
    }),
  );
  assert.equal(parcial.avaliacaoJustificativa, "Uma visita foi cancelada.");
});

test("campo em branco vira undefined, e não string vazia", () => {
  const corpo = payloadRelato(relato({ resultados: "   " }));
  assert.equal(corpo.resultados, undefined);
  assert.equal(corpo.desdobramentos, undefined);
});

test("o relato não mexe nas atividades não previstas já registradas", () => {
  // Elas são inseridas pela API, nunca reconciliadas. Uma lista vazia aqui
  // significa "não acrescente nenhuma" — não "apague as que existem".
  const corpo = payloadRelato(
    relato({
      atividades: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          titulo: "Visita",
          status: "REALIZADA",
          relatoRealizado: "Reuniao realizada.",
          resultados: "",
          observacoes: "",
        },
      ],
    }),
  );
  assert.deepEqual(corpo.atividadesNaoPrevistas, []);
  assert.equal(corpo.atividades.length, 1);
  assert.equal(corpo.atividades[0].resultados, undefined);
});

test("a atividade extra preserva o relato atual em vez de apagá-lo", () => {
  // O endpoint é um só e exige `relatoGeral`. Mandar vazio limparia o texto que
  // já existe — e `atividades: []` garante que nenhuma parada planejada seja
  // tocada ao acrescentar uma extra.
  const corpo = payloadAtividadeExtra(
    {
      tipo: "ARTICULACAO",
      titulo: "Reuniao com a agencia de fomento",
      paisId: "22222222-2222-4222-8222-222222222222",
      cidade: "Lisboa",
      modoInstituicao: "nenhuma",
      instituicaoId: "",
      instituicaoNome: "",
      eventoNome: "",
      dataInicio: "16/05/2027",
      dataFim: "16/05/2027",
      justificativa: "Convite recebido durante o evento.",
      relatoRealizado: "Reuniao realizada.",
      resultados: "",
      observacoes: "",
    },
    {
      relatoGeral: "Texto que ja estava gravado.",
      resultados: null,
      avaliacaoObjetivos: "PARCIALMENTE",
      avaliacaoJustificativa: "Uma visita foi cancelada.",
      desdobramentos: null,
    },
  );

  assert.equal(corpo.relatoGeral, "Texto que ja estava gravado.");
  assert.equal(corpo.avaliacaoObjetivos, "PARCIALMENTE");
  assert.equal(corpo.avaliacaoJustificativa, "Uma visita foi cancelada.");
  assert.deepEqual(corpo.atividades, []);
  assert.equal(corpo.atividadesNaoPrevistas.length, 1);
  assert.equal(corpo.atividadesNaoPrevistas[0].dataInicio, "2027-05-16");
  assert.equal(corpo.atividadesNaoPrevistas[0].instituicaoId, undefined);
  assert.equal(corpo.atividadesNaoPrevistas[0].instituicaoNome, undefined);
});

test("só o modo escolhido leva a instituição", () => {
  const base = {
    tipo: "VISITA_TECNICA",
    titulo: "Visita ao laboratorio",
    paisId: "22222222-2222-4222-8222-222222222222",
    cidade: "",
    instituicaoId: "33333333-3333-4333-8333-333333333333",
    instituicaoNome: "Universidade Livre",
    eventoNome: "",
    dataInicio: "16/05/2027",
    dataFim: "16/05/2027",
    justificativa: "Convite recebido durante o evento.",
    relatoRealizado: "Visita realizada.",
    resultados: "",
    observacoes: "",
  };
  const atual = {
    relatoGeral: "Texto gravado.",
    resultados: null,
    avaliacaoObjetivos: null,
    avaliacaoJustificativa: null,
    desdobramentos: null,
  };

  // Mandar os dois é recusado pela API — escolher no cliente evita um erro que
  // a pessoa não consegue corrigir na tela.
  const doCatalogo = payloadAtividadeExtra(
    { ...base, modoInstituicao: "catalogo" },
    atual,
  ).atividadesNaoPrevistas[0];
  assert.equal(
    doCatalogo.instituicaoId,
    "33333333-3333-4333-8333-333333333333",
  );
  assert.equal(doCatalogo.instituicaoNome, undefined);

  const livre = payloadAtividadeExtra(
    { ...base, modoInstituicao: "livre" },
    atual,
  ).atividadesNaoPrevistas[0];
  assert.equal(livre.instituicaoId, undefined);
  assert.equal(livre.instituicaoNome, "Universidade Livre");
});

test("atividade realizada exige dizer o que foi feito", () => {
  const comPendencia = formularioRelatoSchema.safeParse(
    relato({
      atividades: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          titulo: "Visita",
          status: "REALIZADA",
          relatoRealizado: "",
          resultados: "",
          observacoes: "",
        },
      ],
    }),
  );
  assert.equal(comPendencia.success, false);

  // Não realizada não precisa: pedir o relato de uma parada que não aconteceu
  // inverteria a pergunta.
  const naoRealizada = formularioRelatoSchema.safeParse(
    relato({
      atividades: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          titulo: "Visita",
          status: "NAO_REALIZADA",
          relatoRealizado: "",
          resultados: "",
          observacoes: "",
        },
      ],
    }),
  );
  assert.equal(naoRealizada.success, true);
});

test("avaliação diferente de SIM exige justificativa no cliente", () => {
  for (const resposta of ["PARCIALMENTE", "NAO"]) {
    assert.equal(
      formularioRelatoSchema.safeParse(
        relato({ avaliacaoObjetivos: resposta }),
      ).success,
      false,
      resposta,
    );
  }
  assert.equal(
    formularioRelatoSchema.safeParse(relato({ avaliacaoObjetivos: "SIM" }))
      .success,
    true,
  );
});
