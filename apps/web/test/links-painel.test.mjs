import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  linkDaLista,
  notaDoRecorte,
  relatorioDaConsulta,
} from "../src/lib/formularios/links-painel.ts";

const BASE = "/programas/capes-global/2027-2030/comite-gestor";

describe("links do painel e dos relatórios (CG-066/CG-068)", () => {
  it("carrega o recorte do painel para a lista", () => {
    const url = linkDaLista(
      BASE,
      { ano: 2027, redeId: "rede-1" },
      { status: "CONCLUIDA" },
    );

    // Perder `ano` ou `redeId` faz o clique abrir uma contagem maior do que a
    // exibida no cartão — e nada na tela denuncia isso.
    assert.match(url, /[?&]ano=2027(&|$)/);
    assert.match(url, /[?&]redeId=rede-1(&|$)/);
    assert.match(url, /[?&]status=CONCLUIDA(&|$)/);
    assert.match(url, /^\/programas\/capes-global\/2027-2030\/comite-gestor\?aba=missoes/);
  });

  it("sem recorte, o link não inventa filtro", () => {
    const url = linkDaLista(BASE, { ano: null, redeId: null });
    assert.equal(url, `${BASE}?aba=missoes`);
  });

  it("o cartão de análise aponta para a fila, e não para a lista", () => {
    const url = linkDaLista(BASE, { ano: 2027, redeId: null }, {}, "analise");
    assert.match(url, /aba=analise/);
    assert.match(url, /ano=2027/);
  });

  it("o filtro do cartão não sobrescreve o recorte por engano", () => {
    // `redeId` do recorte e `paisId` do cartão convivem: são dimensões
    // diferentes, e o cartão de país não pode apagar a rede escolhida.
    const url = linkDaLista(
      BASE,
      { ano: null, redeId: "rede-1" },
      { paisId: "pais-1" },
    );
    assert.match(url, /redeId=rede-1/);
    assert.match(url, /paisId=pais-1/);
  });

  it("a URL é estável: o mesmo clique gera sempre a mesma string", () => {
    // URL instável quebra o histórico do navegador e o cache da rota.
    const uma = linkDaLista(BASE, { ano: 2027, redeId: "r" }, { status: "X" });
    const outra = linkDaLista(BASE, { ano: 2027, redeId: "r" }, { status: "X" });
    assert.equal(uma, outra);
  });

  it("relatório desconhecido cai no padrão em vez de quebrar", () => {
    // A aba é alcançável por link colado; um 500 por `?relatorio=xpto` seria
    // pior do que mostrar o primeiro relatório.
    assert.equal(relatorioDaConsulta(undefined), "missoes");
    assert.equal(relatorioDaConsulta("xpto"), "missoes");
    assert.equal(relatorioDaConsulta(""), "missoes");
    assert.equal(relatorioDaConsulta("financas"), "financas");
    // Repetido na query string: vale o primeiro, como no resto do módulo.
    assert.equal(relatorioDaConsulta(["parceiros", "financas"]), "parceiros");
  });

  it("a nota do recorte diz o universo, mesmo quando não há filtro", () => {
    assert.equal(
      notaDoRecorte({ ano: null, redeId: null }),
      "Ciclo inteiro · Todas as redes",
    );
    assert.equal(
      notaDoRecorte({ ano: 2027, redeId: "r", redeNome: "UFMG" }),
      "Exercício 2027 · UFMG",
    );
    // Rede pedida mas fora do alcance: a API devolve nome nulo, e a nota volta
    // a dizer "todas" em vez de rotular um recorte vazio (CG-028).
    assert.equal(
      notaDoRecorte({ ano: null, redeId: null, redeNome: null }),
      "Ciclo inteiro · Todas as redes",
    );
  });
});
