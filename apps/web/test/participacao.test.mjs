import assert from "node:assert/strict";
import test from "node:test";

import {
  formularioEdicaoParticipacaoSchema,
  formularioParticipacaoSchema,
  payloadParticipacao,
  valoresDaParticipacao,
} from "../src/lib/formularios/participacao.ts";

/**
 * Participação PPG–temática (V1-034).
 *
 * O que estes casos fixam é a assimetria entre cadastrar e editar: a edição
 * **não troca o PPG**, porque trocá-lo não é editar — é desfazer um vínculo e
 * criar outro, e a linha de plano que aponta para o par antigo passaria a
 * descrever um programa que ninguém decidiu.
 */

const ppgId = "11111111-1111-4111-8111-111111111111";
const pessoaId = "22222222-2222-4222-8222-222222222222";

test("o cadastro exige PPG e responsável", () => {
  const semPpg = formularioParticipacaoSchema.safeParse({
    ppgId: "",
    coordenadorTematicaId: pessoaId,
    situacao: "CADASTRO_PRELIMINAR",
    modalidadesPrevistas: "",
    observacoes: "",
  });
  assert.equal(semPpg.success, false);
  assert.deepEqual(semPpg.error.issues[0].path, ["ppgId"]);
});

test("a edição não aceita nem exige o PPG", () => {
  // O schema da edição omite o campo: mandá-lo seria oferecer uma troca que a
  // API não faz, e exigi-lo obrigaria o formulário a reenviar algo que não
  // muda.
  const dados = formularioEdicaoParticipacaoSchema.parse({
    coordenadorTematicaId: pessoaId,
    situacao: "CONTEMPLADO",
    modalidadesPrevistas: "",
    observacoes: "",
  });
  assert.equal("ppgId" in dados, false);
  assert.equal("ppgId" in payloadParticipacao(dados), false);
});

test("o payload manda nulo no lugar de texto vazio", () => {
  const dados = formularioParticipacaoSchema.parse({
    ppgId,
    coordenadorTematicaId: pessoaId,
    situacao: "CADASTRO_PRELIMINAR",
    modalidadesPrevistas: "",
    observacoes: "",
  });
  const payload = payloadParticipacao(dados);
  assert.equal(payload.ppgId, ppgId);
  assert.equal(payload.modalidadesPrevistas, null);
  assert.equal(payload.observacoes, null);
});

test("a participação gravada volta para o formulário de edição", () => {
  const valores = valoresDaParticipacao({
    coordenadorTematicaId: pessoaId,
    situacao: "CONTEMPLADO",
    modalidadesPrevistas: "Doutorado sanduíche",
    observacoes: null,
  });
  const dados = formularioEdicaoParticipacaoSchema.parse(valores);
  const payload = payloadParticipacao(dados);

  assert.equal(payload.coordenadorTematicaId, pessoaId);
  assert.equal(payload.situacao, "CONTEMPLADO");
  assert.equal(payload.modalidadesPrevistas, "Doutorado sanduíche");
  // Observação ausente continua ausente — não vira string vazia no caminho.
  assert.equal(payload.observacoes, null);
});
