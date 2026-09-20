import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formularioProdutoMissaoSchema,
  payloadProdutoMissao,
  produtoVazio,
  valoresDoProduto,
} from "../src/lib/formularios/produto-missao.ts";

const convenioId = "11111111-1111-4111-8111-111111111111";
const instituicaoId = "22222222-2222-4222-8222-222222222222";
const pessoaId = "33333333-3333-4333-8333-333333333333";

function produtoValido(sobrescrever = {}) {
  return {
    ...produtoVazio(),
    titulo: "Artigo conjunto sobre a Amazônia",
    ano: "2027",
    instituicoesIds: [instituicaoId],
    responsaveisIds: [pessoaId],
    ...sobrescrever,
  };
}

test("o produto válido vira payload com nulos no lugar de strings vazias", () => {
  const dados = formularioProdutoMissaoSchema.parse(produtoValido());
  const payload = payloadProdutoMissao(dados);

  assert.equal(payload.titulo, "Artigo conjunto sobre a Amazônia");
  assert.equal(payload.ano, 2027);
  // Campo vazio vira `null`, e não `""`: é o que faz "limpei este campo"
  // chegar igual na criação e na edição.
  assert.equal(payload.descricao, null);
  assert.equal(payload.referencia, null);
  assert.equal(payload.observacoes, null);
  // O papel dentro do produto não é o papel na missão; inventar um a partir do
  // outro afirmaria algo que ninguém declarou.
  assert.deepEqual(payload.responsaveis, [{ pessoaId, papel: null }]);
});

test("ano vazio some do payload como nulo, e não como NaN", () => {
  const dados = formularioProdutoMissaoSchema.parse(
    produtoValido({ ano: "" }),
  );
  assert.equal(payloadProdutoMissao(dados).ano, null);
});

test("ano fora da faixa e com formato errado são recusados no campo", () => {
  for (const ano of ["27", "1999", "2101", "abc"]) {
    const resultado = formularioProdutoMissaoSchema.safeParse(
      produtoValido({ ano }),
    );
    assert.equal(resultado.success, false, `aceitou o ano ${ano}`);
    assert.equal(resultado.error.issues[0].path[0], "ano");
  }
});

// A regra é bicondicional no banco, e as duas metades escondem coisas
// diferentes: convênio sem acordo não diz qual acordo; acordo em produto que
// não é convênio cria vínculo que ninguém vai procurar ali.
test("produto do tipo convênio exige o acordo apontado", () => {
  const resultado = formularioProdutoMissaoSchema.safeParse(
    produtoValido({ tipo: "CONVENIO", convenioId: "" }),
  );
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path[0], "convenioId");
});

test("só o produto do tipo convênio aponta para um acordo", () => {
  const resultado = formularioProdutoMissaoSchema.safeParse(
    produtoValido({ tipo: "PUBLICACAO", convenioId }),
  );
  assert.equal(resultado.success, false);
  assert.equal(resultado.error.issues[0].path[0], "convenioId");
});

test("o acordo só viaja no payload quando o tipo é convênio", () => {
  const comConvenio = formularioProdutoMissaoSchema.parse(
    produtoValido({ tipo: "CONVENIO", convenioId }),
  );
  assert.equal(payloadProdutoMissao(comConvenio).convenioId, convenioId);

  const semConvenio = formularioProdutoMissaoSchema.parse(produtoValido());
  assert.equal(payloadProdutoMissao(semConvenio).convenioId, null);
});

test("a edição carrega o produto gravado e o schema aceita o resultado", () => {
  const valores = valoresDoProduto({
    tipo: "CONVENIO",
    titulo: "Acordo de cooperação",
    descricao: null,
    situacao: "CONCLUIDO",
    ano: 2027,
    referencia: null,
    observacoes: null,
    convenio: { id: convenioId },
    instituicoes: [{ id: instituicaoId }],
    redes: [],
    responsaveis: [{ id: pessoaId }],
  });

  assert.equal(valores.convenioId, convenioId);
  assert.equal(valores.ano, "2027");
  // Nulo da API vira string vazia no formulário, nunca a palavra "null".
  assert.equal(valores.descricao, "");
  assert.deepEqual(valores.responsaveisIds, [pessoaId]);
  assert.equal(formularioProdutoMissaoSchema.safeParse(valores).success, true);
});

test("não existe botão que responda “sim” sobre produtos", async () => {
  const fonte = await readFile(
    new URL(
      "../src/componentes/formularios/form-produto-missao.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  // O "sim" é a existência da linha (CG-056). Um botão gravaria afirmação sem
  // nada que a sustente — cadastrar o produto é que responde.
  assert.equal(fonte.includes("gerouProduto"), false);
  assert.match(fonte, /Cadastrar já responde/);
});
