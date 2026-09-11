import Link from "next/link";

import { MapaMundi } from "@/componentes/graficos/mapa-mundi";
import {
  Aviso,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Secao,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { PanoramaMobilidade } from "@/lib/dominio";
import { inteiro } from "@/lib/formato";

/**
 * P04 · Mapa e destinos (BOL-042).
 *
 * **Os números são os do panorama**, buscados do mesmo endpoint com o mesmo
 * filtro. O mapa é outra apresentação do mesmo recorte, não uma segunda
 * apuração — duas telas que somam as mesmas concessões por caminhos diferentes
 * divergem, e aqui a divergência apareceria como país colorido no mapa e
 * ausente na tabela.
 */

export default async function MapaDeDestinos({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parametros = await searchParams;
  const consulta = new URLSearchParams();
  for (const chave of ["ano", "fluxo", "nivel", "redeId", "ppgId", "cicloId"]) {
    const valor = parametros[chave];
    if (typeof valor === "string" && valor) consulta.set(chave, valor);
  }

  const panorama = await apiFetch<PanoramaMobilidade>(
    `/mobilidade/panorama${consulta.size ? `?${consulta}` : ""}`,
  );

  const semCodigo = panorama.porPais.filter((pais) => !pais.codigoNumerico);

  return (
    <Pagina
      titulo="Mapa e destinos"
      descricao="Para onde a mobilidade da UEA foi e de onde ela veio. O mapa mostra a forma; as tabelas mostram os números."
      acoes={
        <Link
          href={`/mobilidade${consulta.size ? `?${consulta}` : ""}`}
          className="text-sm text-primary hover:underline"
        >
          ← Voltar ao panorama
        </Link>
      }
    >
      {panorama.avisos.map((aviso) => (
        <Aviso key={aviso} tom="aviso" titulo="Leia antes de somar as colunas">
          {aviso}
        </Aviso>
      ))}
      {semCodigo.length > 0 ? (
        <Aviso tom="aviso" titulo="Países fora do mapa">
          {inteiro(semCodigo.length)} destino(s) não foram reconhecidos como país
          no mapa e aparecem só nas tabelas. Confira a grafia do país na
          concessão.
        </Aviso>
      ) : null}

      <Secao titulo="Intensidade por país">
        {panorama.porPais.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum destino registrado"
            descricao="Nenhuma concessão do recorte atual tem país de destino informado."
          />
        ) : (
          <MapaMundi
            paises={panorama.porPais}
            legenda="Países de destino das mobilidades registradas. A ausência de cor significa nenhuma mobilidade registrada — não significa ausência de relacionamento."
          />
        )}
      </Secao>

      <Secao titulo="Países">
        {panorama.porPais.length === 0 ? (
          <EstadoVazio
            titulo="Sem países no recorte"
            descricao="Ajuste os filtros ou registre concessões em Bolsistas."
          />
        ) : (
          <Tabela
            rotulo="Países de destino"
            colunas={[
              { chave: "pais", texto: "País" },
              { chave: "in", texto: "IN", alinhamento: "direita" },
              { chave: "out", texto: "OUT", alinhamento: "direita" },
              { chave: "total", texto: "Mobilidades", alinhamento: "direita" },
              { chave: "valor", texto: "Custo", alinhamento: "direita" },
            ]}
          >
            {panorama.porPais.map((pais) => (
              <tr key={pais.chave}>
                <Celula>{pais.rotulo}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(pais.entrada)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(pais.saida)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(pais.quantidade)}
                </Celula>
                <Celula direita>
                  <Moeda valor={pais.valor} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao titulo="Universidades de destino">
        {panorama.porInstituicao.length === 0 ? (
          <EstadoVazio
            titulo="Sem instituições no recorte"
            descricao="Ajuste os filtros ou registre concessões em Bolsistas."
          />
        ) : (
          <Tabela
            rotulo="Universidades de destino"
            colunas={[
              { chave: "inst", texto: "Instituição" },
              { chave: "in", texto: "IN", alinhamento: "direita" },
              { chave: "out", texto: "OUT", alinhamento: "direita" },
              { chave: "total", texto: "Mobilidades", alinhamento: "direita" },
              { chave: "valor", texto: "Custo", alinhamento: "direita" },
            ]}
          >
            {panorama.porInstituicao.map((instituicao) => (
              <tr key={instituicao.chave}>
                <Celula>{instituicao.rotulo}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(instituicao.entrada)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(instituicao.saida)}
                </Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(instituicao.quantidade)}
                </Celula>
                <Celula direita>
                  <Moeda valor={instituicao.valor} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </Pagina>
  );
}
