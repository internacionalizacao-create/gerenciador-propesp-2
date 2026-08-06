"use client";

import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import type { PpgDetalhe } from "@/lib/dominio";
import { FormPpg } from "./form-ppg";

/** Botão + sidesheet do cadastro de PPG (P14). */
export function CadastroPpg({ ppg }: { ppg?: PpgDetalhe }) {
  return (
    <AbrirSidesheet
      rotulo={ppg ? "Editar" : "Novo PPG"}
      variante={ppg ? "secundaria" : "primaria"}
      titulo={ppg ? `Editar ${ppg.sigla}` : "Cadastrar PPG"}
      descricao="Três etapas: identificação, avaliação CAPES e linhas de pesquisa."
    >
      {(fechar) => <FormPpg ppg={ppg} aoConcluir={fechar} />}
    </AbrirSidesheet>
  );
}
