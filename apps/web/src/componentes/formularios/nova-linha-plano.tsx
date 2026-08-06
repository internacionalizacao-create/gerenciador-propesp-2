"use client";

import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import type { ItemCatalogo, LinhaPpg } from "@/lib/dominio";
import { FormLinhaPlano } from "./form-linha-plano";

/** Botão + sidesheet do cadastro de linha de planejamento (P10). */
export function NovaLinhaDePlano({
  programa,
  ciclo,
  ppgs,
  areas,
  catalogo,
}: {
  programa: string;
  ciclo: string;
  ppgs: LinhaPpg[];
  areas: { id: string; codigo: string; nome: string; rede: string }[];
  catalogo: ItemCatalogo[];
}) {
  return (
    <AbrirSidesheet
      rotulo="Nova linha"
      titulo="Nova linha de planejamento"
      descricao="Três etapas: onde ela entra, o que é, quando e quanto."
      largura="larga"
    >
      {(fechar) => (
        <FormLinhaPlano
          programa={programa}
          ciclo={ciclo}
          ppgs={ppgs}
          areas={areas}
          catalogo={catalogo}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}
