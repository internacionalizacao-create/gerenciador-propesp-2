"use client";

import { AbrirSidesheet } from "@/componentes/ui/sidesheet";
import type { ItemCatalogo, ReferenciasPlano } from "@/lib/dominio";
import { FormLinhaPlano } from "./form-linha-plano";

/** Botão + sidesheet do cadastro de linha de planejamento (P10). */
export function NovaLinhaDePlano({
  programa,
  ciclo,
  cicloStatus,
  ppgs,
  areas,
  catalogo,
  anos,
  anoInicial,
}: {
  programa: string;
  ciclo: string;
  cicloStatus: "PLANEJAMENTO" | "VIGENTE" | "ENCERRADO";
  ppgs: ReferenciasPlano["ppgs"];
  areas: {
    id: string;
    codigo: string;
    nome: string;
    rede: string;
    ppgIds: string[];
  }[];
  catalogo: ItemCatalogo[];
  anos: number[];
  anoInicial: number;
}) {
  return (
    <AbrirSidesheet
      rotulo="Cadastrar"
      titulo="Nova linha de planejamento"
      descricao="Três etapas: onde ela entra, o que é, quando e quanto."
      largura="larga"
    >
      {(fechar) => (
        <FormLinhaPlano
          programa={programa}
          ciclo={ciclo}
          cicloStatus={cicloStatus}
          ppgs={ppgs}
          areas={areas}
          catalogo={catalogo}
          anos={anos}
          anoInicial={anoInicial}
          aoConcluir={fechar}
        />
      )}
    </AbrirSidesheet>
  );
}
