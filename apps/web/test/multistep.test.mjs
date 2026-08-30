import assert from "node:assert/strict";
import test from "node:test";

import {
  errosUnicos,
  indiceDaPrimeiraEtapaComErro,
} from "../src/componentes/ui/multistep-logica.ts";

test("localiza a etapa do primeiro campo rejeitado pela API", () => {
  const indice = indiceDaPrimeiraEtapaComErro(
    [
      ["itemPlanejadoId"],
      ["nome", "email", "cpf"],
      ["paisOrigem", "paisDestino"],
      ["dataInicio", "dataFim"],
    ],
    [{ campo: "cpf", mensagem: "Informe um CPF válido." }],
  );

  assert.equal(indice, 1);
});

test("preserva mensagens específicas e remove somente repetições", () => {
  assert.deepEqual(
    errosUnicos([
      { campo: "dataFim", mensagem: "Informe uma data válida." },
      { campo: "dataFim", mensagem: "Informe uma data válida." },
      { campo: "cpf", mensagem: "Informe um CPF válido." },
    ]),
    [
      { campo: "dataFim", mensagem: "Informe uma data válida." },
      { campo: "cpf", mensagem: "Informe um CPF válido." },
    ],
  );
});
