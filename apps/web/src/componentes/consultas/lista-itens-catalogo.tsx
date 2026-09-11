"use client";

import { useDeferredValue, useMemo, useState } from "react";

import {
  EditarItemCatalogo,
  RemoverItemCatalogo,
} from "@/componentes/formularios/form-item-catalogo";
import {
  Celula,
  EstadoVazio,
  Moeda,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import type { Destino, Modalidade, TabelaVigente } from "@/lib/dominio";
import { meses } from "@/lib/formato";

import { filtrarItensCatalogo } from "./catalogo-logica";

type Item = TabelaVigente["itens"][number];
type FiltroDestino = Destino | "TODOS";

/**
 * Filtro local da tabela vigente.
 *
 * A API devolve uma única tabela, sem contrato de busca ou paginação. Portanto
 * não se cria uma Query artificial: a primeira (e única) leitura permanece no
 * Server Component e este componente só recorta os itens já autorizados. A URL
 * continua registrando o recorte para que ele possa ser compartilhado.
 */
export function ListaItensCatalogo({
  itens,
  modalidades,
  podeEditar,
  programa,
  buscaInicial = "",
  destinoInicial = "TODOS",
}: {
  itens: Item[];
  modalidades: Modalidade[];
  podeEditar: boolean;
  programa: string;
  buscaInicial?: string;
  destinoInicial?: FiltroDestino;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [destino, setDestino] = useState<FiltroDestino>(destinoInicial);
  const buscaAdiada = useDeferredValue(busca);

  const filtrados = useMemo(
    () => filtrarItensCatalogo(itens, buscaAdiada, destino),
    [buscaAdiada, destino, itens],
  );

  function atualizarUrl(proximaBusca: string, proximoDestino: FiltroDestino) {
    const parametros = new URLSearchParams({ programa });
    if (proximaBusca.trim()) parametros.set("q", proximaBusca.trim());
    if (proximoDestino !== "TODOS") parametros.set("destino", proximoDestino);
    window.history.replaceState(
      null,
      "",
      `/catalogos/bolsas?${parametros.toString()}`,
    );
  }

  function alterarBusca(valor: string) {
    setBusca(valor);
    atualizarUrl(valor, destino);
  }

  function alterarDestino(valor: FiltroDestino) {
    setDestino(valor);
    atualizarUrl(busca, valor);
  }

  const brasil = filtrados.filter((item) => item.destino === "BRASIL");
  const exterior = filtrados.filter((item) => item.destino === "EXTERIOR");

  return (
    <>
      <fieldset className="mb-8 grid gap-4 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-[minmax(0,1fr)_14rem]">
        <legend className="px-1 text-sm font-semibold text-foreground">
          Filtrar itens publicados
        </legend>
        <div>
          <label htmlFor="busca-catalogo" className="mb-1.5 block text-sm font-medium text-foreground">
            Buscar
          </label>
          <input
            id="busca-catalogo"
            type="search"
            value={busca}
            onChange={(evento) => alterarBusca(evento.currentTarget.value)}
            placeholder="Código, modalidade, fonte…"
            className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground shadow-sm placeholder:text-subtle hover:border-primary focus:border-primary"
          />
        </div>
        <div>
          <label htmlFor="destino-catalogo" className="mb-1.5 block text-sm font-medium text-foreground">
            Destino
          </label>
          <select
            id="destino-catalogo"
            value={destino}
            onChange={(evento) => alterarDestino(evento.currentTarget.value as FiltroDestino)}
            className="w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground shadow-sm hover:border-primary focus:border-primary"
          >
            <option value="TODOS">Brasil e exterior</option>
            <option value="BRASIL">Brasil</option>
            <option value="EXTERIOR">Exterior</option>
          </select>
        </div>
      </fieldset>

      {filtrados.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum item encontrado"
          descricao="Altere ou limpe os filtros para voltar à tabela oficial de valores."
          acao={
            <button
              type="button"
              onClick={() => {
                setBusca("");
                alterarDestino("TODOS");
              }}
              className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              Limpar filtros
            </button>
          }
        />
      ) : null}

      {brasil.length > 0 ? (
        <SecaoDeItens
          titulo="Bolsas com destino Brasil"
          descricao="Trazem alguém para a UEA — fluxo IN. Bolsa de até 15 dias vale 0,5 mês."
          itens={brasil}
          modalidades={modalidades}
          podeEditar={podeEditar}
        />
      ) : null}
      {exterior.length > 0 ? (
        <SecaoDeItens
          titulo="Bolsas com destino exterior"
          descricao="Levam alguém da UEA para fora — fluxo OUT. O valor em reais já inclui o adicional de cidade de alto custo, estimado para 70% das bolsas."
          itens={exterior}
          modalidades={modalidades}
          podeEditar={podeEditar}
          mostrarDolar
        />
      ) : null}
    </>
  );
}

function SecaoDeItens({
  titulo,
  descricao,
  itens,
  modalidades,
  podeEditar,
  mostrarDolar = false,
}: {
  titulo: string;
  descricao: string;
  itens: Item[];
  modalidades: Modalidade[];
  podeEditar: boolean;
  mostrarDolar?: boolean;
}) {
  return (
    <section className="mb-9">
      <h2 className="text-base font-semibold tracking-[-0.01em] text-foreground">{titulo}</h2>
      <p className="mt-1 max-w-3xl text-sm text-muted">{descricao}</p>

      <div className="mt-4 hidden md:block">
        <Tabela
          rotulo={titulo}
          colunas={colunasDeItens(mostrarDolar, podeEditar)}
        >
          {itens.map((item) => (
            <LinhaDeItem
              key={item.id}
              item={item}
              modalidades={modalidades}
              podeEditar={podeEditar}
              mostrarDolar={mostrarDolar}
            />
          ))}
        </Tabela>
      </div>

      <ul className="mt-4 grid gap-3 md:hidden">
        {itens.map((item) => (
          <li key={item.id} className="rounded-2xl border border-border bg-surface p-4 shadow-[0_12px_30px_-28px_var(--border-strong)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-subtle">{item.codigo}</p>
                <h3 className="mt-1 font-semibold text-foreground">{item.modalidade}</h3>
              </div>
              <Selo tom={item.destino === "BRASIL" ? "info" : "primario"}>
                {item.destino === "BRASIL" ? "Brasil" : "Exterior"}
              </Selo>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <Dado rotulo="Vigência" valor={meses(item.vigenciaMeses)} />
              <Dado rotulo="Valor" valor={<Moeda valor={item.valorBrl} forte />} />
              {mostrarDolar ? (
                <Dado
                  rotulo="Valor US$"
                  valor={item.valorUsd ? `US$ ${Number(item.valorUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                />
              ) : null}
              <Dado rotulo="Fonte" valor={item.fonte ?? "—"} />
            </dl>
            {item.observacao ? <p className="mt-3 text-xs text-muted">{item.observacao}</p> : null}
            {podeEditar ? (
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <span className="text-xs text-muted">{item.usos > 0 ? `${item.usos} linha(s) em uso` : "Ainda sem uso"}</span>
                <div className="flex items-center gap-1">
                  <EditarItemCatalogo item={item} modalidades={modalidades} />
                  <RemoverItemCatalogo item={item} />
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function colunasDeItens(mostrarDolar: boolean, podeEditar: boolean) {
  return [
    { chave: "codigo", texto: "Código" },
    { chave: "modalidade", texto: "Modalidade" },
    { chave: "vigencia", texto: "Vigência" },
    ...(mostrarDolar ? [{ chave: "usd", texto: "Valor US$", alinhamento: "direita" as const }] : []),
    { chave: "brl", texto: "Valor R$", alinhamento: "direita" as const },
    { chave: "fonte", texto: "Fonte" },
    { chave: "obs", texto: "Observação" },
    ...(podeEditar ? [
      { chave: "usos", texto: "Em uso", alinhamento: "direita" as const },
      { chave: "acoes", texto: <span className="sr-only">Ações</span> },
    ] : []),
  ];
}

function LinhaDeItem({ item, modalidades, podeEditar, mostrarDolar }: { item: Item; modalidades: Modalidade[]; podeEditar: boolean; mostrarDolar: boolean }) {
  return (
    <tr>
      <Celula><span className="font-mono text-xs">{item.codigo}</span></Celula>
      <Celula>{item.modalidade}</Celula>
      <Celula>{meses(item.vigenciaMeses)}{Number(item.vigenciaMeses) === 0.5 ? <span className="ml-2"><Selo tom="info" titulo="Regra dos 15 dias">até 15 dias</Selo></span> : null}</Celula>
      {mostrarDolar ? <Celula direita>{item.valorUsd ? `US$ ${Number(item.valorUsd).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</Celula> : null}
      <Celula direita><Moeda valor={item.valorBrl} forte /></Celula>
      <Celula className="max-w-[12rem] text-xs text-subtle">{item.fonte ?? "—"}</Celula>
      <Celula className="max-w-sm text-xs text-muted">{item.observacao ?? "—"}</Celula>
      {podeEditar ? <><Celula direita className="text-xs text-muted">{item.usos > 0 ? `${item.usos} linha(s)` : "—"}</Celula><Celula><div className="flex items-center gap-1"><EditarItemCatalogo item={item} modalidades={modalidades} /><RemoverItemCatalogo item={item} /></div></Celula></> : null}
    </tr>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return <div><dt className="text-xs text-subtle">{rotulo}</dt><dd className="mt-0.5 text-foreground">{valor}</dd></div>;
}
