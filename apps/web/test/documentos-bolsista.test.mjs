import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  categoriasDisponiveis,
  ehDocumentoPessoal,
  formularioDocumentoBolsistaSchema,
} from "../src/lib/formularios/documentos-bolsista.ts";

/**
 * Regressões da tela de documentos do bolsista (BOL-021).
 *
 * A autorização é da API — estes casos travam o que a **interface** promete:
 * não convidar o coordenador a juntar documento pessoal, e não sugerir que a
 * visibilidade seja uma escolha de quem envia.
 */

const raiz = (caminho) => new URL(`../${caminho}`, import.meta.url);

test("categoria pessoal so aparece para quem pode abri-la", () => {
  const doCoordenador = categoriasDisponiveis([
    "bolsa:read",
    "bolsa:create",
  ]).map((categoria) => categoria.valor);
  assert.ok(doCoordenador.includes("CARTA_ACEITE"));
  assert.ok(!doCoordenador.includes("PASSAPORTE"));

  const daSecretaria = categoriasDisponiveis([
    "bolsa:create",
    "documento:read-pessoal",
  ]).map((categoria) => categoria.valor);
  assert.ok(daSecretaria.includes("PASSAPORTE"));
  assert.ok(daSecretaria.includes("DOCUMENTO_IDENTIDADE"));
  assert.ok(daSecretaria.includes("COMPROVANTE_RESIDENCIA"));
  // As academicas continuam disponiveis para os dois.
  assert.ok(daSecretaria.includes("CARTA_ACEITE"));
});

test("classifica documento pessoal do mesmo jeito que a API", () => {
  for (const pessoal of [
    "DOCUMENTO_IDENTIDADE",
    "PASSAPORTE",
    "COMPROVANTE_RESIDENCIA",
  ]) {
    assert.equal(ehDocumentoPessoal(pessoal), true);
  }
  for (const academico of ["CARTA_ACEITE", "PLANO_TRABALHO", "RELATORIO"]) {
    assert.equal(ehDocumentoPessoal(academico), false);
  }
});

test("o schema exige a categoria", () => {
  assert.equal(
    formularioDocumentoBolsistaSchema.safeParse({
      categoria: "",
      legenda: "",
    }).success,
    false,
  );
  assert.equal(
    formularioDocumentoBolsistaSchema.safeParse({
      categoria: "CARTA_ACEITE",
      legenda: "",
    }).success,
    true,
  );
});

test("a acao nao manda visibilidade: quem decide e a categoria, na API", async () => {
  const fonte = await readFile(raiz("src/acoes/documentos-bolsista.ts"), "utf8");
  assert.ok(!/append\("visibilidade"/.test(fonte));
  assert.match(fonte, /append\("entidadeTipo", "BOLSA_CONCEDIDA"\)/);
});

test("o download passa pelo endpoint autenticado, nunca por arquivo estatico", async () => {
  const fonte = await readFile(
    raiz("src/app/(app)/mobilidade/bolsistas/[id]/page.tsx"),
    "utf8",
  );
  assert.match(fonte, /\/api\/bff\/anexos\/\$\{documento\.id\}\/conteudo/);
  // A tela nao **refiltra** o que a API ja filtrou: dois lugares decidindo a
  // mesma coisa divergem na primeira mudanca. Mencionar a permissao num
  // comentario e outra coisa — o que nao pode existir e a checagem.
  assert.ok(!/permissions\.includes\("documento:read-pessoal"\)/.test(fonte));
  assert.ok(!/visibilidade\s*===\s*"PESSOAL"/.test(fonte));
});

test("o formulario usa React Hook Form, como manda a convencao", async () => {
  const fonte = await readFile(
    raiz("src/componentes/formularios/form-documento-bolsista.tsx"),
    "utf8",
  );
  assert.match(fonte, /zodResolver\(formularioDocumentoBolsistaSchema\)/);
  assert.match(fonte, /useErrosDaAcao\(estado, setError, CAMPOS_DA_API\)/);
  // Nao ha seletor de visibilidade: sugerir escolha onde nao ha faria a pessoa
  // achar que publicou um documento que a API manteve pessoal.
  assert.ok(!/rotulo="Visibilidade"/.test(fonte));
});
