import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/**
 * Regressões da CG-064.
 *
 * São verificações de fonte, não de DOM renderizado: o que se quer travar aqui
 * é a decisão — o vínculo ARIA existir — e não a aparência. Cada uma delas já
 * esteve ausente e passou despercebida porque a tela continuava "funcionando"
 * para quem enxerga e usa mouse.
 */

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

test("o erro do campo e amarrado ao controle, nao so anunciado", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/campos.tsx"), "utf8");
  // `role="alert"` avisa quando o erro aparece; `aria-describedby` e o que faz
  // quem volta ao campo depois ouvir o motivo de novo.
  assert.match(fonte, /const descritoPor =/);
  assert.match(fonte, /children\(id, descritoPor\)/);
  // Todo controle do sistema expoe a descricao.
  const controles = fonte.match(/aria-describedby=\{descritoPor\}/g) ?? [];
  assert.equal(controles.length, 4);
  assert.match(fonte, /id=\{idErro\}/);
  assert.match(fonte, /id=\{idDica\}/);
});

test("campo com erro fica marcado como invalido", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/campos.tsx"), "utf8");
  assert.match(fonte, /aria-invalid=\{resto\.erro \? true : undefined\}/);
});

test("a descricao do sidesheet e vinculada ao dialogo", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/sidesheet.tsx"), "utf8");
  // A descricao explica a consequencia da acao; sem o vinculo ela vira texto
  // solto que o leitor de tela so alcanca se procurar.
  assert.match(fonte, /aria-labelledby=\{tituloId\}/);
  assert.match(
    fonte,
    /aria-describedby=\{descricao \? descricaoId : undefined\}/,
  );
  assert.match(fonte, /id=\{descricaoId\}/);
  // O botao de fechar e icone: precisa de nome acessivel proprio.
  assert.match(fonte, /aria-label="Fechar"/);
});

test("a rolagem horizontal so vira parada de tabulacao quando ha o que rolar", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/rolagem.tsx"), "utf8");
  // Sempre focavel criaria uma parada morta em cada tabela numa tela larga;
  // nunca focavel deixa as colunas escondidas inalcancaveis pelo teclado.
  assert.match(fonte, /tabIndex=\{rolavel \? 0 : undefined\}/);
  assert.match(fonte, /role=\{rolavel \? "region" : undefined\}/);
  assert.match(fonte, /aria-label=\{rolavel \? rotulo : undefined\}/);
  // Regiao sem nome acessivel e pior do que regiao nenhuma: o papel so entra
  // junto com o rotulo.
  assert.match(fonte, /rotulo = "Conteúdo com rolagem horizontal"/);
  // Reage a redimensionamento, senao girar o celular deixaria o estado errado.
  assert.match(fonte, /new ResizeObserver\(medir\)/);
});

test("a tabela usa a rolagem alcancavel pelo teclado", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/basicos.tsx"), "utf8");
  assert.match(fonte, /<RolagemHorizontal/);
  assert.match(fonte, /<\/RolagemHorizontal>/);
  // O `min-w` e o que faz a tabela realmente rolar no celular.
  assert.match(fonte, /min-w-\[48rem\]/);
});

test("nenhuma coluna fica sem cabecalho legivel", async () => {
  // Cabecalho vazio deixa a coluna anonima para quem navega celula a celula.
  for (const caminho of [
    "src/app/(app)/programas/[programa]/[ciclo]/parceiros/[id]/page.tsx",
    "src/app/(app)/pendencias/page.tsx",
  ]) {
    const fonte = await readFile(raiz(caminho), "utf8");
    assert.equal(
      /texto: ""/.test(fonte),
      false,
      `${caminho} ainda tem cabecalho de coluna vazio`,
    );
    assert.match(fonte, /sr-only">Ações</);
  }
});

test("as tabelas de parceiro nomeiam a propria regiao de rolagem", async () => {
  // A tabela mora no componente de lista desde que a busca passou para o
  // TanStack Query; a pagina so faz a permissao e a busca inicial.
  const lista = await readFile(
    raiz("src/componentes/consultas/lista-parceiros.tsx"),
    "utf8",
  );
  assert.match(lista, /rotulo="Lista de parceiros"/);
  const detalhe = await readFile(
    raiz("src/app/(app)/programas/[programa]/[ciclo]/parceiros/[id]/page.tsx"),
    "utf8",
  );
  for (const nome of [
    "Contatos do parceiro",
    "Eventos do parceiro",
    "Documentos do parceiro",
  ]) {
    assert.match(detalhe, new RegExp(`rotulo="${nome}"`));
  }
});

test("o toast anuncia sucesso e erro com urgencias diferentes", async () => {
  const fonte = await readFile(raiz("src/componentes/ui/toast.tsx"), "utf8");
  // Erro interrompe; confirmacao espera a pausa. Tratar os dois igual ou
  // atrapalha a leitura ou esconde a falha.
  assert.match(fonte, /role=\{tom === "erro" \? "alert" : "status"\}/);
  assert.match(
    fonte,
    /aria-live=\{tom === "erro" \? "assertive" : "polite"\}/,
  );
});
