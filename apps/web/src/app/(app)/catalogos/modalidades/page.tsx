import type { Metadata } from "next";

import { NovaModalidade } from "@/componentes/formularios/form-modalidade";
import { ListaModalidades } from "@/componentes/consultas/lista-modalidades";
import { Pagina, Secao } from "@/componentes/ui/basicos";
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { apiFetch } from "@/lib/api";
import type { Modalidade } from "@/lib/dominio";
import { carregarMe } from "@/lib/me";

export const metadata: Metadata = {
  title: "Modalidades — Gerenciador PROPESP",
};

/**
 * P23 · Catálogos auxiliares — modalidades.
 *
 * Os destinos permitidos vêm do que o catálogo de fato cobre, e não de uma
 * marcação manual. É o que impede o formulário de oferecer uma combinação que a
 * tabela oficial não tem — e que resultaria num 422 evitável.
 *
 * Cadastro e edição são do `admin` (`catalogo:write`): a modalidade atravessa
 * todos os PPGs, e quem planeja não decide o que existe para planejar.
 */
export default async function Modalidades() {
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["catalogo:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Modalidades"
        descricao="Modalidades de bolsa aceitas no planejamento."
        me={me}
        faltando={falta}
      />
    );
  }

  const modalidades = await apiFetch<Modalidade[]>("/catalogo/modalidades");
  const podeEditar = me.permissions.includes("catalogo:create");

  return (
    <Pagina
      titulo="Modalidades de bolsa"
      acoes={podeEditar ? <NovaModalidade /> : undefined}
    >
      <Secao titulo="Modalidades">
        <ListaModalidades
          modalidades={modalidades}
          podeEditar={podeEditar}
          acaoVazia={podeEditar ? <NovaModalidade /> : undefined}
        />
      </Secao>
    </Pagina>
  );
}
