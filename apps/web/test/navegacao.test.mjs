import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { descreverPermissao, faltando, pode } from "../src/lib/acesso.ts";
import { menu } from "../src/lib/navegacao.ts";

const TUDO = [
  "painel:read",
  "bolsa:read",
  "produto:read",
  "programa:read",
  "orcamento:read",
  "plano:read",
  "equipe-gestao:read",
  "parceiro:read",
  "ppg:read",
  "catalogo:read",
  "acesso:read",
];

/** O que o menu lateral mostraria: ele filtra o que ainda não existe. */
function visiveis(permissoes) {
  return menu("capes-global", "2027-2030", permissoes)
    .map((grupo) => ({
      ...grupo,
      itens: grupo.itens.filter((item) => item.disponivel),
    }))
    .filter((grupo) => grupo.itens.length > 0);
}

function itens(permissoes) {
  return visiveis(permissoes).flatMap((grupo) =>
    grupo.itens.map((item) => item.rotulo),
  );
}

test("conta sem concessão só enxerga o que não depende de concessão", () => {
  // É o estado da conta recém-criada, e o menu curto é a resposta certa: item
  // que só responde "sem acesso" faria o sistema parecer quebrado.
  assert.deepEqual(itens([]), ["Avisos"]);
});

test("cada item aparece com a permissão da tela dele", () => {
  assert.deepEqual(itens(["plano:read"]), ["Plano de aplicação", "Avisos"]);
  assert.deepEqual(itens(["acesso:read"]), ["Avisos", "Acessos"]);
});

test("item de duas permissões exige as duas, nunca uma", () => {
  // A produção junta produto de bolsa e de missão numa consulta só; com meia
  // permissão a tela mostraria metade da tabela sem dizer o que faltou.
  assert.equal(itens(["bolsa:read"]).includes("Produção"), false);
  assert.equal(
    itens(["bolsa:read", "produto:read"]).includes("Produção"),
    true,
  );
});

test("grupo que fica sem item sai do menu", () => {
  const grupos = visiveis(["plano:read"]).map((grupo) => grupo.titulo);

  assert.deepEqual(grupos, ["Planejamento", "Cadastros"]);
  assert.equal(grupos.includes("Visão geral"), false);
});

test("o que ainda não existe continua na régua do escopo", () => {
  // `disponivel: false` é escopo futuro, não falta de permissão: quem filtra
  // esses itens é o MenuLateral, e misturar as duas coisas faria o módulo por
  // vir sumir do código no dia em que alguém rodasse o sistema sem concessões.
  const porVir = menu("capes-global", "2027-2030", [])
    .flatMap((grupo) => grupo.itens)
    .filter((item) => !item.disponivel);

  assert.equal(porVir.length > 0, true);
  for (const item of porVir) assert.equal(typeof item.motivo, "string");
});

test("com tudo concedido, o menu é o de antes da V1-019", () => {
  const rotulos = itens(TUDO);

  for (const esperado of [
    "Resumo do orçamento anual",
    "Mobilidade",
    "Bolsistas",
    "Orçamento",
    "Comitê Gestor e Administração",
    "Parceiros",
    "PPGs",
    "Acessos",
  ]) {
    assert.equal(rotulos.includes(esperado), true, esperado);
  }
});

test("faltando devolve o que falta, na ordem pedida", () => {
  // Booleano não serve: a tela precisa dizer o que pedir a quem administra.
  assert.deepEqual(faltando(["bolsa:read"], ["bolsa:read", "produto:read"]), [
    "produto:read",
  ]);
  assert.deepEqual(faltando([], []), []);
  assert.equal(pode(["bolsa:read"], "bolsa:read"), true);
  assert.equal(pode(["bolsa:read"], "bolsa:read", "produto:read"), false);
});

test("a ação é descrita em português, sem deixar de mostrar o nome técnico", () => {
  assert.equal(descreverPermissao("plano:create"), "Plano de aplicação · cadastrar");
  assert.equal(descreverPermissao("acesso:delegate"), "Administração de acessos · delegar administração");

  // Ação nova, ainda sem verbo mapeado: mostra o que existe em vez de inventar.
  assert.equal(descreverPermissao("plano:inventada"), "Plano de aplicação · inventada");
});

test("a tela sem acesso separa os três casos", async () => {
  const fonte = await readFile(
    new URL("../src/componentes/ui/sem-acesso.tsx", import.meta.url),
    "utf8",
  );

  // Vínculo pendente, conta sem nenhuma concessão e acesso que não cobre
  // aquela tela pedem três textos diferentes: dizer o mesmo nos três manda a
  // pessoa pedir a coisa errada.
  assert.match(fonte, /me\.vinculoPendente/);
  assert.match(fonte, /me\.permissions\.length === 0/);
  assert.match(fonte, /faltando\.map/);
});
