import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  campoApiParaFormulario,
  formularioMissaoComiteSchema,
  payloadCriacaoMissao,
  payloadEdicaoMissao,
  valoresDaMissao,
} from "../src/lib/formularios/missao-comite.ts";

const pessoaId = "11111111-1111-4111-8111-111111111111";
const paisId = "22222222-2222-4222-8222-222222222222";
const redeId = "33333333-3333-4333-8333-333333333333";

function missaoValida() {
  return {
    titulo: "Missão de articulação em Paris",
    objetivo: "Consolidar uma parceria institucional com a universidade.",
    dataInicio: "01/03/2027",
    dataFim: "10/03/2027",
    status: "PLANEJADA",
    observacoes: "",
    redes: [redeId],
    atividades: [
      {
        id: "",
        tipo: "VISITA_TECNICA",
        titulo: "Visita à universidade parceira",
        paisId,
        cidade: "Paris",
        modoInstituicao: "livre",
        instituicaoId: "",
        instituicaoNome: "Université de Paris",
        eventoNome: "",
        dataInicio: "02/03/2027",
        dataFim: "08/03/2027",
        planejamento: "Reuniões com a coordenação internacional.",
        observacoes: "",
      },
    ],
    participantes: [
      {
        id: "",
        modoPessoa: "existente",
        pessoaId,
        nomePessoa: "",
        emailPessoa: "",
        cpfPessoa: "",
        tipoPessoa: "EXTERNO",
        membroEquipeId: "",
        papel: "RESPONSAVEL",
        observacoes: "",
      },
    ],
  };
}

test("valida missão com roteiro e participante sem dados financeiros", () => {
  const resultado = formularioMissaoComiteSchema.safeParse(missaoValida());

  assert.equal(resultado.success, true);
  const payload = payloadCriacaoMissao(resultado.data);
  assert.equal(payload.dataInicio, "2027-03-01");
  assert.equal(payload.atividades[0].dataFim, "2027-03-08");
  assert.equal(payload.atividades[0].instituicaoNome, "Université de Paris");
  assert.equal(Object.hasOwn(payload, "valor"), false);
  assert.equal(Object.hasOwn(payload, "passagem"), false);
  assert.equal(Object.hasOwn(payload, "diaria"), false);
});

// Rede repetida nao e testada aqui: o campo visual e um grupo de caixas de
// selecao, entao a mesma rede nao tem como ser marcada duas vezes. A
// deduplicacao vive no schema da API, que aceita qualquer payload, e esta
// coberta pelos testes de integracao.
test("exige pelo menos uma rede", () => {
  const semRede = missaoValida();
  semRede.redes = [];
  assert.equal(formularioMissaoComiteSchema.safeParse(semRede).success, false);
});

test("exige exatamente uma pessoa responsável", () => {
  const semResponsavel = missaoValida();
  semResponsavel.participantes[0].papel = "PARTICIPANTE";
  assert.equal(
    formularioMissaoComiteSchema.safeParse(semResponsavel).success,
    false,
  );

  const doisResponsaveis = missaoValida();
  doisResponsaveis.participantes.push({
    ...doisResponsaveis.participantes[0],
    pessoaId: "55555555-5555-4555-8555-555555555555",
  });
  assert.equal(
    formularioMissaoComiteSchema.safeParse(doisResponsaveis).success,
    false,
  );
});

test("exige nome na atividade de evento", () => {
  const dados = missaoValida();
  dados.atividades[0].tipo = "EVENTO";
  assert.equal(formularioMissaoComiteSchema.safeParse(dados).success, false);
});

test("a missão multirrede leva todas as redes para o payload", () => {
  const outra = "44444444-4444-4444-8444-444444444444";
  const dados = missaoValida();
  dados.redes = [redeId, outra];

  const resultado = formularioMissaoComiteSchema.safeParse(dados);
  assert.equal(resultado.success, true);
  assert.deepEqual(payloadCriacaoMissao(resultado.data).redes, [redeId, outra]);
});

test("aceita cadastro persistente de pessoa dentro da missão", () => {
  const dados = missaoValida();
  dados.participantes = [
    {
      ...dados.participantes[0],
      modoPessoa: "nova",
      pessoaId: "",
      nomePessoa: "Pesquisadora Visitante",
      emailPessoa: "visitante@example.org",
      cpfPessoa: "529.982.247-25",
      tipoPessoa: "PESQUISADOR",
    },
  ];

  const resultado = formularioMissaoComiteSchema.safeParse(dados);
  assert.equal(resultado.success, true);
  const payload = payloadCriacaoMissao(resultado.data);
  assert.deepEqual(payload.participantes[0].novaPessoa, {
    nome: "Pesquisadora Visitante",
    email: "visitante@example.org",
    cpf: "529.982.247-25",
    tipo: "PESQUISADOR",
  });
  assert.equal(payload.participantes[0].pessoaId, undefined);
});

test("rejeita atividade fora da viagem e pessoa existente duplicada", () => {
  const dados = missaoValida();
  dados.atividades[0].dataFim = "12/03/2027";
  dados.participantes.push({ ...dados.participantes[0] });

  const resultado = formularioMissaoComiteSchema.safeParse(dados);
  assert.equal(resultado.success, false);
  const campos = resultado.error.issues.map((erro) => erro.path.join("."));
  assert.ok(campos.includes("atividades.0.dataInicio"));
  assert.ok(campos.includes("participantes"));
});

test("mapeia erro da nova pessoa devolvido pela API para o campo visual", () => {
  assert.equal(
    campoApiParaFormulario("participantes.2.novaPessoa.email"),
    "participantes.2.emailPessoa",
  );
  assert.equal(
    campoApiParaFormulario("atividades.1.dataFim"),
    "atividades.1.dataFim",
  );
});

test("usa React Hook Form, Zod e listas repetíveis", async () => {
  const fonte = await readFile(
    new URL(
      "../src/componentes/formularios/form-missao-comite.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(fonte, /useForm<DadosFormularioMissaoComite>/);
  assert.match(fonte, /zodResolver\(formularioMissaoComiteSchema\)/);
  assert.match(fonte, /useFieldArray\(\{ control, name: "atividades" \}\)/);
  assert.match(fonte, /useFieldArray\(\{ control, name: "participantes" \}\)/);
});

// ------------------------------------------------ edição da missão (V1-030) --

const atividadeId = "55555555-5555-4555-8555-555555555555";
const participanteId = "66666666-6666-4666-8666-666666666666";

/** O que `valoresDaMissao` lê, no formato que a API devolve. */
function missaoGravada() {
  return {
    titulo: "Missão de articulação em Paris",
    objetivo: "Consolidar uma parceria institucional com a universidade.",
    dataInicio: "2027-03-01",
    dataFim: "2027-03-10",
    observacoes: null,
    redes: [{ id: redeId }],
    participantes: [
      {
        id: participanteId,
        pessoaId,
        nome: "Fulana de Tal",
        email: null,
        membroEquipeId: null,
        papel: "RESPONSAVEL",
        observacoes: null,
      },
    ],
    atividades: [
      {
        id: atividadeId,
        tipo: "VISITA_TECNICA",
        titulo: "Visita à universidade parceira",
        paisId,
        cidade: "Paris",
        instituicaoId: null,
        instituicao: "Université de Paris",
        instituicaoDoCatalogo: false,
        eventoNome: null,
        dataInicio: "2027-03-02",
        dataFim: "2027-03-08",
        planejamento: "Reuniões com a coordenação internacional.",
        observacoes: null,
      },
    ],
  };
}

test("a edição carrega a missão gravada e o schema aceita o resultado", () => {
  const valores = valoresDaMissao(missaoGravada());

  // Datas voltam no formato dos campos, não em ISO.
  assert.equal(valores.dataInicio, "01/03/2027");
  assert.equal(valores.atividades[0].dataFim, "08/03/2027");
  // Instituição digitada à mão volta como "livre", e não como "nenhuma": a
  // parada tem nome e não tem id, e tratá-la como sem instituição apagaria o
  // nome no primeiro salvamento.
  assert.equal(valores.atividades[0].modoInstituicao, "livre");
  assert.equal(valores.atividades[0].instituicaoNome, "Université de Paris");
  // Participante já gravado entra sempre como "existente" — reabrir em "nova"
  // criaria uma segunda pessoa com o mesmo nome.
  assert.equal(valores.participantes[0].modoPessoa, "existente");
  assert.equal(valores.participantes[0].pessoaId, pessoaId);

  assert.equal(formularioMissaoComiteSchema.safeParse(valores).success, true);
});

test("o payload da edição preserva os ids e não leva situação", () => {
  const valores = formularioMissaoComiteSchema.parse(
    valoresDaMissao(missaoGravada()),
  );
  const payload = payloadEdicaoMissao(valores);

  // Sem o `id`, o endpoint trataria cada linha como nova e o roteiro dobraria
  // a cada salvamento, deixando as originais órfãs.
  assert.equal(payload.atividades[0].id, atividadeId);
  assert.equal(payload.participantes[0].id, participanteId);
  // Situação muda por `/situacao`, com regra de origem própria por ação.
  assert.equal(Object.hasOwn(payload, "status"), false);
  assert.equal(payload.dataInicio, "2027-03-01");
});

test("linha acrescentada na edição vai sem id, que é como a API lê 'nova'", () => {
  const base = valoresDaMissao(missaoGravada());
  const valores = formularioMissaoComiteSchema.parse({
    ...base,
    atividades: [
      ...base.atividades,
      { ...base.atividades[0], id: "", titulo: "Parada acrescentada" },
    ],
  });
  const payload = payloadEdicaoMissao(valores);

  assert.equal(payload.atividades[0].id, atividadeId);
  assert.equal(payload.atividades[1].id, undefined);
});

test("a edição não oferece o campo de situação", async () => {
  const fonte = await readFile(
    new URL(
      "../src/componentes/formularios/form-missao-comite.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  // O campo existe, mas fica atrás de `edicao ?`: oferecê-lo na edição daria
  // dois caminhos para mudar situação, e um deles sem as regras de origem.
  assert.match(fonte, /\{edicao \? null : \(\s*<Selecao/);
});
