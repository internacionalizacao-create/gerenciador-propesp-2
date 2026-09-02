import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { formularioMembroEquipeSchema } from "../src/lib/formularios/comite-gestor.ts";

const vinculo = {
  tipoEquipe: "COMITE_GESTOR",
  funcao: "Coordenadora",
  dataInicio: "01/01/2027",
  dataFim: "",
  observacoes: "",
};

test("valida uma nova pessoa e o vínculo antes de chamar a API", () => {
  const resultado = formularioMembroEquipeSchema.safeParse({
    ...vinculo,
    modoPessoa: "nova",
    pessoaId: "",
    nomePessoa: "Pessoa de Teste",
    emailPessoa: "pessoa@example.org",
    cpfPessoa: "529.982.247-25",
    tipoPessoa: "EXTERNO",
  });

  assert.equal(resultado.success, true);
});

test("aponta os campos inválidos sem apagar os demais valores", () => {
  const resultado = formularioMembroEquipeSchema.safeParse({
    ...vinculo,
    modoPessoa: "nova",
    pessoaId: "",
    nomePessoa: "Pessoa de Teste",
    emailPessoa: "email-invalido",
    cpfPessoa: "111.111.111-11",
    tipoPessoa: "EXTERNO",
    dataFim: "31/12/2026",
  });

  assert.equal(resultado.success, false);
  const campos = resultado.error.issues.map((erro) => erro.path.join("."));
  assert.deepEqual(campos.sort(), ["cpfPessoa", "dataFim", "emailPessoa"]);
});

test("usa React Hook Form com o resolver Zod", async () => {
  const fonte = await readFile(
    new URL(
      "../src/componentes/formularios/form-membro-equipe.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(fonte, /useForm<DadosFormularioMembroEquipe>/);
  assert.match(fonte, /zodResolver\(formularioMembroEquipeSchema\)/);
  assert.doesNotMatch(fonte, /<form action=\{executar\}/);
});
