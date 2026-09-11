import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioContatoSchema,
  formularioParceiroSchema,
  payloadContato,
  payloadParceiro,
  payloadParceiroNovo,
  textoOuNulo,
} from "../src/lib/formularios/parceiros.ts";

const redeId = "33333333-3333-4333-8333-333333333333";
const paisId = "22222222-2222-4222-8222-222222222222";
const instituicaoId = "44444444-4444-4444-8444-444444444444";

function parceiroValido(sobrescrever = {}) {
  return {
    nome: "Université de Montréal",
    sigla: "UdeM",
    paisId,
    cidade: "Montreal",
    estadoRegiao: "",
    tipoOrganizacao: "Universidade",
    faculdadeDepartamento: "",
    areasAtuacao: "",
    programaRelacionado: "",
    grupoPesquisa: "",
    origemRelacionamento: "EVENTO_INTERNACIONAL",
    origemObservacao: "",
    estagioRelacionamento: "IDENTIFICADA",
    site: "https://www.umontreal.ca",
    emailInstitucional: "international@umontreal.ca",
    telefone: "",
    endereco: "",
    observacoes: "",
    cadastroProvisorio: false,
    redeIds: [redeId],
    confirmarPossivelDuplicidade: false,
    ...sobrescrever,
  };
}

function contatoValido(sobrescrever = {}) {
  return {
    nome: "Marie Tremblay",
    cargo: "Diretora de Relações Internacionais",
    departamento: "",
    area: "",
    email: "marie@umontreal.ca",
    telefone: "",
    paisId: "",
    idiomaComunicacao: "Francês",
    observacoes: "",
    principal: true,
    confirmarPossivelDuplicidade: false,
    ...sobrescrever,
  };
}

test("parceiro valido passa no schema", () => {
  assert.equal(formularioParceiroSchema.safeParse(parceiroValido()).success, true);
});

test("nome curto e recusado com mensagem propria", () => {
  const resultado = formularioParceiroSchema.safeParse(
    parceiroValido({ nome: "UD" }),
  );
  assert.equal(resultado.success, false);
  assert.equal(
    resultado.error.issues.find((item) => item.path[0] === "nome").message,
    "Informe o nome da instituição.",
  );
});

test("site e e-mail so sao validados quando preenchidos", () => {
  // Campo opcional vazio nao pode virar erro de formato.
  assert.equal(
    formularioParceiroSchema.safeParse(
      parceiroValido({ site: "", emailInstitucional: "" }),
    ).success,
    true,
  );
  assert.equal(
    formularioParceiroSchema.safeParse(parceiroValido({ site: "umontreal" }))
      .success,
    false,
  );
  assert.equal(
    formularioParceiroSchema.safeParse(
      parceiroValido({ emailInstitucional: "sem-arroba" }),
    ).success,
    false,
  );
});

test("campo vazio vira null, nunca undefined", () => {
  // No PATCH da API, `undefined` significa manter o valor atual. Se o vazio
  // virasse `undefined`, apagar um campo na edicao nao teria efeito nenhum.
  assert.equal(textoOuNulo("  "), null);
  assert.equal(textoOuNulo(" MIT "), "MIT");

  const payload = payloadParceiro(
    parceiroValido({ sigla: "", cidade: "   ", telefone: "" }),
  );
  assert.equal(payload.sigla, null);
  assert.equal(payload.cidade, null);
  assert.equal(payload.telefone, null);
  assert.ok(!Object.values(payload).includes(undefined));
});

test("payload preserva a confirmacao de duplicidade", () => {
  // Sem esse campo a API recusa de novo, e e essa recusa que impede o
  // cadastro duplicado criado no automatico.
  assert.equal(
    payloadParceiro(parceiroValido()).confirmarPossivelDuplicidade,
    false,
  );
  assert.equal(
    payloadParceiro(parceiroValido({ confirmarPossivelDuplicidade: true }))
      .confirmarPossivelDuplicidade,
    true,
  );
});

test("payload do contato carrega a instituicao e nao copia dados dela", () => {
  const payload = payloadContato(contatoValido(), instituicaoId);
  assert.equal(payload.instituicaoId, instituicaoId);
  assert.equal(payload.nome, "Marie Tremblay");
  assert.equal(payload.principal, true);
  // O contato referencia a instituicao pelo id; nada do cadastro dela e
  // duplicado no corpo (criterio de aceite da CG-026).
  assert.equal("instituicao" in payload, false);
});

test("contato aceita e-mail vazio e recusa e-mail invalido", () => {
  assert.equal(
    formularioContatoSchema.safeParse(contatoValido({ email: "" })).success,
    true,
  );
  assert.equal(
    formularioContatoSchema.safeParse(contatoValido({ email: "arroba-nenhum" }))
      .success,
    false,
  );
  assert.equal(payloadContato(contatoValido({ email: "" }), instituicaoId).email, null);
});

test("o alerta de duplicidade fica dentro do formulario, nao em dialogo separado", async () => {
  // Criterio de aceite da CG-049: o alerta nao pode apagar o formulario. Como
  // o formulario nunca e desmontado, o React Hook Form preserva os valores.
  const fonte = await readFile(
    new URL("../src/componentes/formularios/form-parceiro.tsx", import.meta.url),
    "utf8",
  );
  const inicioDoForm = fonte.indexOf("<form onSubmit={aoEnviar}");
  const alerta = fonte.indexOf("<AlertaDuplicidade");
  assert.ok(inicioDoForm > 0 && alerta > inicioDoForm);
  // Confirmar reenvia o mesmo formulario com a confirmacao marcada.
  assert.match(fonte, /setValue\("confirmarPossivelDuplicidade", true\)/);
  assert.match(fonte, /void aoEnviar\(\)/);
});

test("duplicidade inequivoca nao oferece o botao de confirmar", async () => {
  const fonte = await readFile(
    new URL("../src/componentes/formularios/form-parceiro.tsx", import.meta.url),
    "utf8",
  );
  // `bloqueado` some com o botao: a API recusa INEQUIVOCA mesmo confirmada, e
  // oferecer o botao prometeria algo que nao acontece.
  assert.match(fonte, /const bloqueado = candidatos\.some\(/);
  assert.match(fonte, /\{bloqueado \? null : \(/);
});

test("nao existe acao de excluir parceiro ou contato", async () => {
  // A API nao expoe exclusao: a atividade da missao referencia o id central.
  const fonte = await readFile(
    new URL("../src/acoes/parceiros.ts", import.meta.url),
    "utf8",
  );
  assert.equal(/"DELETE"/.test(fonte), false);
  assert.match(fonte, /inativarContato/);
  assert.match(fonte, /reativarContato/);
});

test("o estado da acao repassa os candidatos do 409", async () => {
  const fonte = await readFile(
    new URL("../src/lib/acao.ts", import.meta.url),
    "utf8",
  );
  // Sem esse repasse a tela mostraria "nao foi possivel salvar" sem dizer
  // QUAIS cadastros a API considerou equivalentes.
  assert.match(fonte, /candidatos: corpo\?\.candidatos/);
});

test("a conciliacao exige destino e justificativa e nao apaga a origem", async () => {
  const fonte = await readFile(
    new URL("../src/acoes/parceiros.ts", import.meta.url),
    "utf8",
  );
  // A origem e o proprio parceiro da URL; o destino vem do formulario.
  assert.match(fonte, /\/parceiros\/\$\{origemId\}\/conciliacao/);
  assert.match(fonte, /destinoId: String\(formulario\.get\("destinoId"\)/);
  assert.match(fonte, /justificativa: String\(formulario\.get\("justificativa"\)/);
  // Revalida a lista e o detalhe da origem, que continua acessivel depois.
  assert.match(fonte, /conciliarParceiro[\s\S]*?return comRevalidacao\(/);
});

test("conciliacao nao se oferece sem candidato ativo", async () => {
  const fonte = await readFile(
    new URL("../src/componentes/formularios/acoes-parceiro.tsx", import.meta.url),
    "utf8",
  );
  // A API exige destino ativo; oferecer o botao sem candidato abriria um
  // painel com um select vazio.
  assert.match(fonte, /if \(candidatos\.length === 0\) return null;/);
});

test("o smoke cobre as telas de parceiro nos dois perfis", async () => {
  const fonte = await readFile(
    new URL("../../../scripts/smoke-telas.sh", import.meta.url),
    "utf8",
  );
  assert.match(fonte, /parceiros" "Novo parceiro"/);
  assert.match(fonte, /parceiros\?busca=inexistente" "Nenhum parceiro para este filtro"/);
  // O perfil sem permissao tem que bater em "Acesso restrito", nao em 200 com
  // dado exposto.
  assert.match(fonte, /parceiros" "Acesso restrito"/);
});

test("a origem so vai no corpo do cadastro, nunca no da edicao", () => {
  const dados = parceiroValido();

  // BOL-030: a origem e fato historico. A API nao a aceita na edicao, e mandar
  // um campo que o outro lado descarta e o tipo de coisa que funciona por
  // acidente ate alguem "corrigir" o schema.
  assert.equal(
    payloadParceiroNovo(dados).origemRelacionamento,
    "EVENTO_INTERNACIONAL",
  );
  assert.equal("origemRelacionamento" in payloadParceiro(dados), false);
});

test("o estagio declarado vai nos dois corpos", () => {
  // O estagio muda com o tempo — e o unico dos cinco estados do documento que
  // e julgamento humano e, por isso, editavel.
  const dados = parceiroValido({ estagioRelacionamento: "CONTATO_INICIADO" });
  assert.equal(payloadParceiro(dados).estagioRelacionamento, "CONTATO_INICIADO");
  assert.equal(
    payloadParceiroNovo(dados).estagioRelacionamento,
    "CONTATO_INICIADO",
  );
});

test("a tela nao oferece os dois estados derivados", async () => {
  const fonte = await readFile(
    new URL("../src/lib/formularios/parceiros.ts", import.meta.url),
    "utf8",
  );
  // "Mobilidade realizada" e "parceria formalizada" sao deduzidos das bolsas e
  // dos convenios. Oferece-los no seletor permitiria declarar o que o banco
  // contradiz — o problema que a CG-058 nomeou ao proibir gravar o checklist.
  assert.ok(!/MOBILIDADE_REALIZADA/.test(fonte));
  assert.ok(!/PARCERIA_FORMALIZADA/.test(fonte));
});
