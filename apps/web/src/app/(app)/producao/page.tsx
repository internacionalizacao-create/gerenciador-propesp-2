import {
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Pagina,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { LinhaProducao } from "@/lib/dominio";
import { inteiro, rotulo } from "@/lib/formato";

/**
 * P18/P19 · Produção consolidada (BOL-051).
 *
 * **Uma leitura sobre dois domínios que continuam separados.** Produto de bolsa
 * é cobrança sobre o beneficiário; produto de missão é resultado institucional
 * da viagem do Comitê (CG-056). A coluna *Origem* existe justamente para que a
 * soma não apague a diferença — quem precisa de um dos dois filtra por ela.
 */
export default async function Producao() {
  const linhas = await apiFetch<LinhaProducao[]>("/mobilidade/producao");

  const deBolsa = linhas.filter((linha) => linha.origem === "BOLSA");
  const deMissao = linhas.filter((linha) => linha.origem === "MISSAO");

  return (
    <Pagina
      titulo="Produção e resultados"
      descricao="O que a internacionalização rendeu, somando o que foi cobrado dos bolsistas e o que as missões do Comitê produziram."
    >
      <div className="mb-8">
        <Cartoes>
          <Cartao titulo="Total" valor={inteiro(linhas.length)} />
          <Cartao
            titulo="De bolsistas"
            valor={inteiro(deBolsa.length)}
            nota="Cobrados individualmente da pessoa"
          />
          <Cartao
            titulo="De missões"
            valor={inteiro(deMissao.length)}
            nota="Resultados das viagens do Comitê"
          />
        </Cartoes>
      </div>

      {linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum produto registrado"
          descricao="Cadastre produtos em Bolsistas ou no detalhe de uma missão para esta consolidação existir."
        />
      ) : (
        <Tabela
          rotulo="Produção consolidada"
          colunas={[
            { chave: "titulo", texto: "Título" },
            { chave: "origem", texto: "Origem" },
            { chave: "tipo", texto: "Tipo" },
            { chave: "contexto", texto: "Bolsista ou missão" },
            { chave: "instituicao", texto: "Instituição de colaboração" },
            { chave: "pais", texto: "País" },
            { chave: "situacao", texto: "Situação" },
            { chave: "ano", texto: "Ano", alinhamento: "direita" },
          ]}
        >
          {linhas.map((linha) => (
            <tr key={`${linha.origem}-${linha.id}`}>
              <Celula>
                <span className="font-medium text-foreground">
                  {linha.titulo}
                </span>
                {linha.referencia ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    {linha.referencia}
                  </span>
                ) : null}
              </Celula>
              <Celula>
                <Selo tom={linha.origem === "BOLSA" ? "info" : "primario"}>
                  {linha.origem === "BOLSA" ? "Bolsista" : "Missão"}
                </Selo>
              </Celula>
              <Celula>{rotulo(linha.tipo)}</Celula>
              <Celula>{linha.contexto}</Celula>
              <Celula>{linha.instituicaoColaboracao ?? "—"}</Celula>
              <Celula>{linha.paisColaboracao ?? "—"}</Celula>
              <Celula>{rotulo(linha.situacao)}</Celula>
              <Celula direita className="tabular-nums">
                {linha.ano ?? "—"}
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Pagina>
  );
}
