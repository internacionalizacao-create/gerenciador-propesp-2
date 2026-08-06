import type { Metadata } from "next";

import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { TabelaVigente } from "@/lib/dominio";
import { data, inteiro, meses } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Catálogo de bolsas — Gerenciador PROPESP",
};

/**
 * P15 · Catálogo de bolsas.
 *
 * **É a fonte de verdade de todo cálculo do sistema.** Nenhum custo de bolsa
 * nasce fora daqui: o plano de aplicação busca nesta tabela por
 * (destino, modalidade, vigência) e recusa o que não encontrar (RN-01).
 */
export default async function CatalogoDeBolsas({
  searchParams,
}: {
  searchParams: Promise<{ programa?: string }>;
}) {
  const { programa = "capes-global" } = await searchParams;
  const tabela = await apiFetch<TabelaVigente>(
    `/catalogo/bolsas?programa=${encodeURIComponent(programa)}`,
  );

  const brasil = tabela.itens.filter((i) => i.destino === "BRASIL");
  const exterior = tabela.itens.filter((i) => i.destino === "EXTERIOR");

  return (
    <Pagina
      titulo="Catálogo de bolsas"
      descricao="A tabela oficial de valores. Todo custo de bolsa do sistema sai daqui."
    >
      <Cartoes>
        <Cartao titulo="Versão vigente" valor={tabela.versao} />
        <Cartao titulo="Data-base" valor={data(tabela.dataBase)} />
        <Cartao
          titulo="Cotação do dólar"
          valor={`R$ ${Number(tabela.cotacaoDolar).toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
          })}`}
          nota="Parâmetro do ciclo, nunca constante no código (RN-03)"
        />
        <Cartao titulo="Itens" valor={inteiro(tabela.itens.length)} />
      </Cartoes>

      <div className="mt-6" />

      <Aviso tom="info" titulo="A versão vigente é imutável">
        Um reajuste da CAPES cria uma <strong>versão nova</strong> e fecha a
        anterior — a tabela em uso nunca é sobrescrita. Sem isso, uma bolsa já
        planejada perderia a base de cálculo em que foi aprovada, e o
        planejamento passado deixaria de ser auditável. Publicar versão é ato
        exclusivo da PROPESP.
      </Aviso>

      {tabela.referenciaNormativa ? (
        <p className="mb-8 text-sm text-muted">
          <strong className="text-foreground">Referência normativa:</strong>{" "}
          {tabela.referenciaNormativa}
        </p>
      ) : null}

      <Secao
        titulo="Bolsas com destino Brasil"
        descricao="Trazem alguém para a UEA — fluxo IN. Bolsa de até 15 dias vale 0,5 mês (RN-02)."
      >
        <TabelaDeItens itens={brasil} />
      </Secao>

      <Secao
        titulo="Bolsas com destino exterior"
        descricao="Levam alguém da UEA para fora — fluxo OUT. O valor em reais já inclui o adicional de cidade de alto custo, estimado para 70% das bolsas."
      >
        <TabelaDeItens itens={exterior} mostrarDolar />
      </Secao>
    </Pagina>
  );
}

function TabelaDeItens({
  itens,
  mostrarDolar,
}: {
  itens: TabelaVigente["itens"];
  mostrarDolar?: boolean;
}) {
  return (
    <Tabela
      colunas={[
        { chave: "codigo", texto: "Código" },
        { chave: "modalidade", texto: "Modalidade" },
        { chave: "vigencia", texto: "Vigência" },
        ...(mostrarDolar
          ? [
              {
                chave: "usd",
                texto: "Valor US$",
                alinhamento: "direita" as const,
              },
            ]
          : []),
        { chave: "brl", texto: "Valor R$", alinhamento: "direita" as const },
        { chave: "fonte", texto: "Fonte" },
        { chave: "obs", texto: "Observação" },
      ]}
    >
      {itens.map((item) => (
        <tr key={item.id}>
          <Celula>
            <span className="font-mono text-xs">{item.codigo}</span>
          </Celula>
          <Celula>{item.modalidade}</Celula>
          <Celula>
            {meses(item.vigenciaMeses)}
            {Number(item.vigenciaMeses) === 0.5 ? (
              <span className="ml-2">
                <Selo tom="info" titulo="Regra dos 15 dias (RN-02)">
                  até 15 dias
                </Selo>
              </span>
            ) : null}
          </Celula>
          {mostrarDolar ? (
            <Celula direita>
              {item.valorUsd
                ? `US$ ${Number(item.valorUsd).toLocaleString("pt-BR", {
                    minimumFractionDigits: 2,
                  })}`
                : "—"}
            </Celula>
          ) : null}
          <Celula direita>
            <Moeda valor={item.valorBrl} forte />
          </Celula>
          <Celula className="max-w-[12rem] text-xs text-subtle">
            {item.fonte ?? "—"}
          </Celula>
          <Celula className="max-w-sm text-xs text-muted">
            {item.observacao ?? "—"}
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}
