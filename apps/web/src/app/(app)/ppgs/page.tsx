import type { Metadata } from "next";

import { CadastroPpg } from "@/componentes/formularios/cadastro-ppg";
import { ListaPpgs } from "@/componentes/consultas/lista-ppgs";
import { Pagina } from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { LinhaPpg, Me } from "@/lib/dominio";

export const metadata: Metadata = {
  title: "PPGs — Gerenciador PROPESP",
};

/**
 * P14 · Programas de Pós-Graduação.
 *
 * As colunas de bolsas e custo são calculadas: a pergunta que a equipe faz
 * olhando um PPG nunca é "quais os dados dele", e sim "quanto ele recebe".
 *
 * Cadastro e edição são do `admin` (`ppg:write`): renomear ou reenquadrar um
 * PPG muda o recorte de quem enxerga o quê e o plano de todos que apontam
 * para ele.
 */
export default async function Ppgs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; nivel?: string; situacao?: string }>;
}) {
  const filtros = await searchParams;
  const [ppgs, me] = await Promise.all([
    apiFetch<LinhaPpg[]>("/ppgs"),
    apiFetch<Me>("/me"),
  ]);
  const podeEditar = me.permissions.includes("ppg:write");

  return (
    <Pagina
      titulo="Programas de Pós-Graduação"
      descricao="Todos os PPGs da UEA mapeados no sistema, com o que cada um recebe por ano."
      acoes={podeEditar ? <CadastroPpg /> : undefined}
    >
      <ListaPpgs
        key={`${filtros.q ?? ""}:${filtros.nivel ?? ""}:${filtros.situacao ?? ""}`}
        ppgs={ppgs}
        filtrosIniciais={{
          busca: filtros.q ?? "",
          nivel: filtros.nivel ?? "",
          situacao: filtros.situacao ?? "",
        }}
      />
    </Pagina>
  );
}
