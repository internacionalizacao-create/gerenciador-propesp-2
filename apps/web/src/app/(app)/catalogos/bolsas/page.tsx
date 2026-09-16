import type { Metadata } from "next";

import { NovoItemCatalogo } from "@/componentes/formularios/form-item-catalogo";
import { ListaItensCatalogo } from "@/componentes/consultas/lista-itens-catalogo";
import { Cartao, Cartoes, Pagina } from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Me, Modalidade, TabelaVigente } from "@/lib/dominio";
import { data, inteiro } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Catálogo de bolsas — Gerenciador PROPESP",
};

/**
 * P15 · Catálogo de bolsas.
 *
 * **É a fonte de verdade de todo cálculo do sistema.** Nenhum custo de bolsa
 * nasce fora daqui: o plano de aplicação busca nesta tabela por
 * (destino, modalidade, vigência) e recusa o que não encontrar (RN-01).
 *
 * Publicar item é do `admin` (`catalogo:write`) e é o que destrava o cadastro
 * manual das composições: sem item, a linha de plano não tem preço e a API a
 * recusa. Item já usado por alguma linha tem chave e valor travados — a tabela
 * é versionada justamente para que um planejamento aprovado não mude de custo
 * por baixo.
 */
export default async function CatalogoDeBolsas({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string; q?: string; destino?: string }>;
}) {
  const { programa = "capes-global", q = "", destino } = await searchParams;
  const [tabela, modalidades, me] = await Promise.all([
    apiFetch<TabelaVigente>(
      `/catalogo/bolsas?programa=${encodeURIComponent(programa)}`,
    ),
    apiFetch<Modalidade[]>("/catalogo/modalidades"),
    apiFetch<Me>("/me"),
  ]);
  const podeEditar = me.permissions.includes("catalogo:write");

  const destinoInicial =
    destino === "BRASIL" || destino === "EXTERIOR" ? destino : "TODOS";

  return (
    <Pagina
      titulo="Catálogo de bolsas"
      descricao="A tabela oficial de valores. Todo custo de bolsa do sistema sai daqui."
      acoes={
        podeEditar ? <NovoItemCatalogo modalidades={modalidades} /> : undefined
      }
    >
      <Cartoes>
        <Cartao titulo="Itens publicados" valor={inteiro(tabela.itens.length)} />
        <Cartao titulo="Modalidades com valor" valor={inteiro(new Set(tabela.itens.map((item) => item.modalidadeId)).size)} />
        <Cartao titulo="Itens para o Brasil" valor={inteiro(tabela.itens.filter((item) => item.destino === "BRASIL").length)} />
        <Cartao titulo="Itens para o exterior" valor={inteiro(tabela.itens.filter((item) => item.destino === "EXTERIOR").length)} />
      </Cartoes>

      <p className="mb-8 mt-4 text-xs leading-5 text-subtle">
        Versão {tabela.versao} · Data-base: {data(tabela.dataBase)} · Cotação de referência do ciclo: {Number(tabela.cotacaoDolar).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/US$
      </p>

      <ListaItensCatalogo
        key={`${programa}:${q}:${destinoInicial}`}
        itens={tabela.itens}
        modalidades={modalidades}
        podeEditar={podeEditar}
        programa={programa}
        buscaInicial={q}
        destinoInicial={destinoInicial}
      />
    </Pagina>
  );
}
