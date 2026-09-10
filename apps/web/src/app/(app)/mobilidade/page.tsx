import Link from "next/link";

import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Secao,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { PanoramaMobilidade } from "@/lib/dominio";
import { inteiro, rotulo } from "@/lib/formato";

/**
 * P02 · Panorama de mobilidade (BOL-040).
 *
 * A primeira tela que responde “o que a internacionalização produziu?”. A P01
 * responde outra pergunta — “o plano cabe no orçamento?” — e por isso as duas
 * coexistem em vez de uma substituir a outra.
 *
 * **Os filtros são navegação, não estado de cliente.** Cada um muda a página
 * inteira, e a URL precisa ser compartilhável: mandar o link de um recorte tem
 * de mandar o recorte, não a visão completa. É o mesmo padrão de `?ano=` e
 * `?rede=` no Plano; o TanStack Query serve a busca incremental, que aqui não
 * existe.
 */

const FLUXOS = [
  { valor: "", texto: "IN e OUT" },
  { valor: "IN", texto: "Somente IN" },
  { valor: "OUT", texto: "Somente OUT" },
];

export default async function PanoramaDeMobilidade({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const texto = (chave: string) => {
    const valor = parametros[chave];
    return typeof valor === "string" && valor ? valor : "";
  };

  const consulta = new URLSearchParams();
  for (const chave of ["ano", "fluxo", "nivel", "redeId", "ppgId"]) {
    if (texto(chave)) consulta.set(chave, texto(chave));
  }

  const panorama = await apiFetch<PanoramaMobilidade>(
    `/mobilidade/panorama${consulta.size ? `?${consulta}` : ""}`,
  );
  const { totais } = panorama;

  const comFiltro = (chave: string, valor: string) => {
    const proxima = new URLSearchParams(consulta);
    if (valor) proxima.set(chave, valor);
    else proxima.delete(chave);
    return `/mobilidade${proxima.size ? `?${proxima}` : ""}`;
  };

  return (
    <Pagina
      titulo="Panorama de mobilidade"
      descricao="Visão consolidada das bolsas concedidas, atravessando programas e ciclos. Os números vêm das concessões registradas, não do planejamento."
      acoes={
        // A exportação leva o mesmo recorte da tela: o filtro da URL é o filtro
        // da consulta, e não há uma segunda origem (CG-068/BOL-044).
        <div className="flex gap-2">
          {(["csv", "xlsx", "pdf"] as const).map((formato) => (
            <a
              key={formato}
              href={`/api/bff/mobilidade/relatorio/exportacao/${formato}${consulta.size ? `?${consulta}` : ""}`}
              className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
            >
              {formato.toUpperCase()}
            </a>
          ))}
        </div>
      }
    >
      {/*
        O aviso viaja junto com o número, e não fica só na API: sem ele, quem
        somasse as linhas da quebra por país acharia que a tela erra — é a
        mesma regra do consolidado por rede (CG-067).
      */}
      {panorama.avisos.map((aviso) => (
        <Aviso key={aviso} tom="aviso" titulo="Leia antes de somar as colunas">
          {aviso}
        </Aviso>
      ))}

      <div className="mb-6 flex flex-wrap gap-2">
        {FLUXOS.map((fluxo) => (
          <Link
            key={fluxo.valor || "todos"}
            href={comFiltro("fluxo", fluxo.valor)}
            aria-current={texto("fluxo") === fluxo.valor ? "page" : undefined}
            className={
              texto("fluxo") === fluxo.valor
                ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                : "rounded-full border border-border-strong px-3 py-1.5 text-sm text-muted hover:text-foreground"
            }
          >
            {fluxo.texto}
          </Link>
        ))}
        {panorama.porAno.map((linha) => (
          <Link
            key={linha.ano}
            href={comFiltro("ano", String(linha.ano))}
            aria-current={
              texto("ano") === String(linha.ano) ? "page" : undefined
            }
            className={
              texto("ano") === String(linha.ano)
                ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-on-primary tabular-nums"
                : "rounded-full border border-border-strong px-3 py-1.5 text-sm text-muted tabular-nums hover:text-foreground"
            }
          >
            {linha.ano}
          </Link>
        ))}
        {texto("ano") || texto("fluxo") ? (
          <Link
            href="/mobilidade"
            className="rounded-full px-3 py-1.5 text-sm text-muted underline hover:text-foreground"
          >
            Limpar filtros
          </Link>
        ) : null}
      </div>

      <div className="mb-8">
        <Cartoes>
          <Cartao
            titulo="Mobilidades"
            valor={inteiro(totais.mobilidades)}
            nota="Concessões registradas no recorte atual"
          />
          <Cartao
            titulo="IN × OUT"
            valor={`${inteiro(totais.entrada)} / ${inteiro(totais.saida)}`}
            nota="Quem a UEA recebeu e quem ela enviou"
          />
          <Cartao titulo="Países" valor={inteiro(totais.paises)} />
          <Cartao titulo="PPGs envolvidos" valor={inteiro(totais.ppgs)} />
          <Cartao
            titulo="Instituições"
            valor={inteiro(totais.instituicoes)}
            nota="Somente as ligadas ao cadastro central"
          />
          <Cartao
            titulo="Custo das bolsas concedidas"
            valor={<Moeda valor={totais.valor} />}
            nota="Compromisso assumido; a CAPES paga direto ao beneficiário"
          />
        </Cartoes>
      </div>

      <Secao
        titulo="IN × OUT por exercício"
        descricao="Comparativo ano a ano. O valor é o custo das concessões que começam naquele exercício."
      >
        {panorama.porAno.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma mobilidade no recorte"
            descricao="Ajuste os filtros ou registre concessões em Bolsistas."
          />
        ) : (
          <Tabela
            rotulo="IN e OUT por exercício"
            colunas={[
              { chave: "ano", texto: "Exercício" },
              { chave: "in", texto: "IN", alinhamento: "direita" },
              { chave: "out", texto: "OUT", alinhamento: "direita" },
              { chave: "total", texto: "Total", alinhamento: "direita" },
              { chave: "valor", texto: "Custo", alinhamento: "direita" },
            ]}
          >
            {panorama.porAno.map((linha) => (
              <tr key={linha.ano}>
                <Celula className="tabular-nums">{linha.ano}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.entrada)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.saida)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.total)}
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.valor} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Quebra
        titulo="Por modalidade"
        descricao="Quantidade e custo por modalidade de bolsa."
        linhas={panorama.porModalidade}
      />
      <Quebra
        titulo="Por nível do beneficiário"
        linhas={panorama.porNivel}
        traduzirRotulo
      />
      {/* BOL-043 · consolidado por rede: alcance e resultado, não só contagem. */}
      <Secao
        titulo="Consolidado por rede"
        descricao="Alcance e resultado de cada rede. A rede vem da área temática da concessão; bolsa sem planejamento nesta ferramenta aparece em “Sem rede vinculada” em vez de sumir."
      >
        {panorama.porRede.length === 0 ? (
          <EstadoVazio
            titulo="Sem dados neste recorte"
            descricao="Nenhuma concessão do recorte atual entra nesta quebra."
          />
        ) : (
          <Tabela
            rotulo="Consolidado por rede"
            colunas={[
              { chave: "rede", texto: "Rede" },
              { chave: "mob", texto: "Mobilidades", alinhamento: "direita" },
              { chave: "in", texto: "IN", alinhamento: "direita" },
              { chave: "out", texto: "OUT", alinhamento: "direita" },
              { chave: "ppgs", texto: "PPGs", alinhamento: "direita" },
              { chave: "paises", texto: "Países", alinhamento: "direita" },
              {
                chave: "instituicoes",
                texto: "Parceiros",
                alinhamento: "direita",
              },
              { chave: "produtos", texto: "Produtos", alinhamento: "direita" },
              { chave: "valor", texto: "Custo", alinhamento: "direita" },
            ]}
          >
            {panorama.porRede.map((linha) => (
              <tr key={linha.chave}>
                <Celula>{linha.rotulo}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.quantidade)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.entrada)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.saida)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.ppgs)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.paises)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.instituicoes)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.produtos)}
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.valor} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
        {/*
          O aviso da CG-067 vale igual aqui: contagem de alcance é `distinct`, e
          duas redes podem alcançar o mesmo país ou o mesmo parceiro. Somar as
          colunas não dá o total da tela.
        */}
        <p className="mt-3 text-xs text-muted">
          Países, parceiros e PPGs são contagens distintas por rede — duas redes
          podem alcançar o mesmo. Somar as colunas não reproduz os totais do
          topo da página.
        </p>
      </Secao>
      <Secao
        titulo="Por país de destino"
        descricao="Somente as concessões ligadas ao catálogo ISO. Destino digitado à mão fica fora."
        acoes={
          <Link
            href={`/mobilidade/mapa${consulta.size ? `?${consulta}` : ""}`}
            className="text-sm text-primary hover:underline"
          >
            Ver no mapa →
          </Link>
        }
      >
        {panorama.porPais.length === 0 ? (
          <EstadoVazio
            titulo="Sem países neste recorte"
            descricao="Nenhuma concessão do recorte atual está ligada ao catálogo de países."
          />
        ) : (
          <Tabela
            rotulo="Por país de destino"
            colunas={[
              { chave: "rotulo", texto: "País" },
              { chave: "in", texto: "IN", alinhamento: "direita" },
              { chave: "out", texto: "OUT", alinhamento: "direita" },
              { chave: "quantidade", texto: "Total", alinhamento: "direita" },
              { chave: "valor", texto: "Custo", alinhamento: "direita" },
            ]}
          >
            {panorama.porPais.map((linha) => (
              <tr key={linha.chave}>
                <Celula>{linha.rotulo}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.entrada)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.saida)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(linha.quantidade)}
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.valor} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
      <Quebra
        titulo="Por instituição de destino"
        descricao="Somente as ligadas ao cadastro institucional."
        linhas={panorama.porInstituicao}
      />
      <Quebra
        titulo="Por PPG"
        descricao="Programa de pós-graduação do beneficiário."
        linhas={panorama.porPpg}
      />
    </Pagina>
  );
}

function Quebra({
  titulo,
  descricao,
  linhas,
  traduzirRotulo = false,
}: {
  titulo: string;
  descricao?: string;
  linhas: {
    chave: string;
    rotulo: string;
    quantidade: number;
    entrada: number;
    saida: number;
    valor: string;
  }[];
  traduzirRotulo?: boolean;
}) {
  return (
    <Secao titulo={titulo} descricao={descricao}>
      {linhas.length === 0 ? (
        <EstadoVazio
          titulo="Sem dados neste recorte"
          descricao="Nenhuma concessão do recorte atual entra nesta quebra."
        />
      ) : (
        <Tabela
          rotulo={titulo}
          colunas={[
            { chave: "rotulo", texto: "Item" },
            { chave: "in", texto: "IN", alinhamento: "direita" },
            { chave: "out", texto: "OUT", alinhamento: "direita" },
            { chave: "quantidade", texto: "Total", alinhamento: "direita" },
            { chave: "valor", texto: "Custo", alinhamento: "direita" },
          ]}
        >
          {linhas.map((linha) => (
            <tr key={linha.chave}>
              <Celula>
                {traduzirRotulo ? rotulo(linha.rotulo) : linha.rotulo}
              </Celula>
              <Celula direita className="tabular-nums">
                {inteiro(linha.entrada)}
              </Celula>
              <Celula direita className="tabular-nums">
                {inteiro(linha.saida)}
              </Celula>
              <Celula direita className="tabular-nums">
                {inteiro(linha.quantidade)}
              </Celula>
              <Celula direita>
                <Moeda valor={linha.valor} />
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}
