import Link from "next/link";

import {
  SeloSituacaoBolsa,
  SeloSituacaoProduto,
} from "@/componentes/bolsistas/situacoes";
import { EditarBolsaConcedida } from "@/componentes/formularios/form-bolsa-concedida";
import { AnexarDocumentoDoBolsista } from "@/componentes/formularios/form-documento-bolsista";
import {
  EditarProdutoBolsa,
  NovoProdutoBolsa,
} from "@/componentes/formularios/form-produto-bolsa";
import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { AnexoResumo, BolsaConcedidaDetalhe, Me } from "@/lib/dominio";
import {
  categoriasDisponiveis,
  ehDocumentoPessoal,
} from "@/lib/formularios/documentos-bolsista";
import { data, dataHora, inteiro, meses, rotulo } from "@/lib/formato";

export default async function DetalheDoBolsista({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bolsa, me, documentos] = await Promise.all([
    apiFetch<BolsaConcedidaDetalhe>(`/bolsistas/${id}`),
    apiFetch<Me>("/me"),
    // A API ja filtra o que este usuario pode ver: documento pessoal nao chega
    // para quem nao tem `documento:read-pessoal`. A tela nao refiltra — dois
    // lugares decidindo a mesma coisa divergem na primeira mudanca.
    apiFetch<AnexoResumo[]>(
      `/anexos?entidadeTipo=BOLSA_CONCEDIDA&entidadeId=${id}`,
    ),
  ]);
  const podeEditarBolsa = me.permissions.includes("bolsa:write");
  const podeEditarProdutos = me.permissions.includes("produto:write");
  const categoriasDeDocumento = categoriasDisponiveis(me.permissions);
  const atrasados = bolsa.produtos.filter(
    (produto) => produto.situacao === "ATRASADO",
  );

  return (
    <Pagina
      titulo={bolsa.bolsista}
      descricao={
        <>
          {bolsa.modalidade} · {bolsa.ppgSigla} ·{" "}
          <Link
            href="/mobilidade/bolsistas"
            className="text-primary hover:underline"
          >
            voltar aos bolsistas
          </Link>
        </>
      }
      acoes={
        podeEditarBolsa ? <EditarBolsaConcedida bolsa={bolsa} /> : undefined
      }
    >
      {bolsa.situacaoTemporal === "EXPIRADA" ? (
        <Aviso tom="perigo" titulo="Bolsa expirada sem conclusão registrada">
          A data final foi {data(bolsa.dataFim)}, mas a situação administrativa
          ainda é {rotulo(bolsa.status)}. Confirme a conclusão ou registre a
          ocorrência adequada.
        </Aviso>
      ) : bolsa.situacaoTemporal === "PRESTES_A_EXPIRAR" ? (
        <Aviso tom="aviso" titulo="Bolsa próxima da data final">
          A vigência termina em {data(bolsa.dataFim)}. Confira produtos
          pendentes e providências de encerramento.
        </Aviso>
      ) : null}

      {atrasados.length > 0 ? (
        <Aviso tom="perigo" titulo="Produtos com prazo vencido">
          {inteiro(atrasados.length)} entrega(s) continuam abertas depois do
          prazo individual cadastrado.
        </Aviso>
      ) : null}

      <Secao titulo="Resumo da concessão">
        <Cartoes>
          <Cartao
            titulo="Situação temporal"
            valor={<SeloSituacaoBolsa situacao={bolsa.situacaoTemporal} />}
            nota={`Situação registrada: ${rotulo(bolsa.status)}`}
          />
          <Cartao
            titulo="Período real"
            valor={data(bolsa.dataInicio)}
            nota={`até ${data(bolsa.dataFim)} · ${meses(bolsa.vigenciaMeses)}`}
          />
          <Cartao
            titulo="Valor concedido"
            valor={<Moeda valor={bolsa.valorConcedido} />}
            nota={`${rotulo(bolsa.destino)} · ${rotulo(bolsa.fluxo)}`}
          />
          <Cartao
            titulo="Produtos"
            valor={inteiro(bolsa.produtos.length)}
            nota={`${inteiro(atrasados.length)} com prazo vencido`}
            destaque={atrasados.length > 0}
          />
        </Cartoes>
      </Secao>

      <Secao
        titulo="Dados do bolsista e da bolsa"
        descricao="A identidade e o período pertencem à concessão individual; modalidade e valor vêm da linha planejada."
      >
        <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dado rotulo="Bolsista" valor={bolsa.bolsista} />
          <Dado rotulo="E-mail" valor={bolsa.email ?? "Não informado"} />
          <Dado rotulo="CPF" valor={bolsa.cpf ?? "Não informado"} />
          <Dado rotulo="Telefone" valor={bolsa.telefone ?? "Não informado"} />
          <Dado rotulo="Nível" valor={rotulo(bolsa.nivelBeneficiario)} />
          <Dado
            rotulo="Lattes"
            valor={
              bolsa.lattes ? (
                <a
                  href={bolsa.lattes}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Currículo
                </a>
              ) : (
                "Não informado"
              )
            }
          />
          <Dado
            rotulo="ORCID"
            valor={
              bolsa.orcid ? (
                <a
                  href={`https://orcid.org/${bolsa.orcid}`}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-primary hover:underline tabular-nums"
                >
                  {bolsa.orcid}
                </a>
              ) : (
                "Não informado"
              )
            }
          />
          <Dado rotulo="PPG" valor={`${bolsa.ppgSigla} · ${bolsa.ppg}`} />
          <Dado
            rotulo="Coordenação do PPG"
            valor={bolsa.coordenadorPpg ?? "Não informado"}
          />
          <Dado
            rotulo="Linha de pesquisa"
            valor={bolsa.linhaPesquisa ?? "Não informada"}
          />
          <Dado
            rotulo="Orientador"
            valor={bolsa.orientador ?? "Não informado"}
          />
          <Dado
            rotulo="Rede e temática"
            valor={
              bolsa.rede
                ? `${bolsa.rede}${bolsa.areaTematicaCodigo ? ` · ${bolsa.areaTematicaCodigo}` : ""}`
                : "Fora do planejamento desta ferramenta"
            }
          />
          <Dado
            rotulo="Programa"
            valor={`${bolsa.programa} · ${bolsa.ciclo}`}
          />
          <Dado rotulo="Modalidade" valor={bolsa.modalidade} />
          <Dado
            rotulo="Origem"
            valor={
              bolsa.instituicaoOrigem
                ? `${bolsa.instituicaoOrigem}${bolsa.paisOrigem ? ` · ${bolsa.paisOrigem}` : ""}`
                : "Não informado"
            }
          />
          <Dado
            rotulo="Destino"
            valor={
              bolsa.instituicaoDestino
                ? `${bolsa.instituicaoDestino}${bolsa.paisDestino ? ` · ${bolsa.paisDestino}` : ""}`
                : "Não informado"
            }
          />
          <Dado
            rotulo="Linha planejada"
            valor={
              bolsa.codigoPlanejamento ? (
                <Link
                  href={`/programas/${bolsa.programaSlug}/${bolsa.ciclo}/plano`}
                  className="text-primary hover:underline"
                >
                  {bolsa.codigoPlanejamento}
                </Link>
              ) : (
                "Bolsa avulsa"
              )
            }
          />
          <Dado rotulo="Processo" valor={bolsa.processo ?? "Não informado"} />
        </dl>
        {bolsa.observacoes ? (
          <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
            {bolsa.observacoes}
          </p>
        ) : null}
      </Secao>

      <Secao
        titulo="Produtos e entregas do bolsista"
        descricao="Cada compromisso tem prazo próprio. A situação “Atrasado” é calculada quando o prazo passa sem entrega ou validação."
        acoes={
          podeEditarProdutos ? (
            <NovoProdutoBolsa bolsaId={bolsa.id} />
          ) : undefined
        }
      >
        {bolsa.produtos.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "produto", texto: "Produto" },
              { chave: "colaboracao", texto: "Colaboração" },
              { chave: "tipo", texto: "Tipo" },
              { chave: "prazo", texto: "Prazo" },
              { chave: "situacao", texto: "Situação" },
              { chave: "entrega", texto: "Entrega / evidência" },
              { chave: "acoes", texto: "Ações" },
            ]}
          >
            {bolsa.produtos.map((produto) => (
              <tr key={produto.id}>
                <Celula className="max-w-md">
                  <span className="font-medium text-foreground">
                    {produto.titulo}
                  </span>
                  {produto.descricao ? (
                    <span className="mt-1 block text-xs text-muted">
                      {produto.descricao}
                    </span>
                  ) : null}
                </Celula>
                <Celula>
                  {produto.instituicaoColaboracao ?? "—"}
                  {produto.paisColaboracao ? (
                    <span className="block text-xs text-subtle">
                      {produto.paisColaboracao}
                    </span>
                  ) : null}
                </Celula>
                <Celula>{rotulo(produto.tipo)}</Celula>
                <Celula>{data(produto.prazoEntrega)}</Celula>
                <Celula>
                  <SeloSituacaoProduto situacao={produto.situacao} />
                </Celula>
                <Celula>
                  {produto.dataEntrega ? data(produto.dataEntrega) : "—"}
                  {produto.doi ? (
                    <span className="block text-xs text-subtle">
                      DOI: {produto.doi}
                    </span>
                  ) : null}
                  {produto.link ? (
                    <a
                      href={produto.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs text-primary hover:underline"
                    >
                      Abrir evidência ↗
                    </a>
                  ) : null}
                </Celula>
                <Celula>
                  {podeEditarProdutos ? (
                    <EditarProdutoBolsa bolsaId={bolsa.id} produto={produto} />
                  ) : (
                    <Selo tom="neutro">Somente leitura</Selo>
                  )}
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre individualmente os artigos, trabalhos, projetos, relatórios ou outras entregas esperadas desta bolsa."
            acao={
              podeEditarProdutos ? (
                <NovoProdutoBolsa bolsaId={bolsa.id} />
              ) : undefined
            }
          />
        )}
      </Secao>

      <Documentos
        bolsaId={bolsa.id}
        documentos={documentos}
        podeAnexar={podeEditarBolsa}
        categorias={categoriasDeDocumento}
      />
    </Pagina>
  );
}

/**
 * Documentos da concessão (BOL-021).
 *
 * **Não há exclusão**, só substituição — que cria versão nova e preserva a
 * anterior (CG-014). O download sai por `/anexos/:id/conteudo`, nunca por
 * arquivo estático: caminho público transformaria "conhecer a URL" em permissão
 * de leitura, e há documento pessoal nesta lista.
 *
 * A lista já chega filtrada pela API. O selo de documento pessoal existe para
 * quem **pode** ver os dois tipos saber, de relance, qual arquivo não circula.
 */
function Documentos({
  bolsaId,
  documentos,
  podeAnexar,
  categorias,
}: {
  bolsaId: string;
  documentos: AnexoResumo[];
  podeAnexar: boolean;
  categorias: { valor: string; texto: string }[];
}) {
  const ativos = documentos.filter((documento) => documento.ativo);

  return (
    <Secao
      titulo="Documentos do bolsista"
      descricao="Carta de aceite, plano de trabalho, relatórios e documentos pessoais. Substituir cria versão nova e preserva a anterior."
      acoes={
        podeAnexar ? (
          <AnexarDocumentoDoBolsista
            bolsaId={bolsaId}
            categorias={categorias}
          />
        ) : undefined
      }
    >
      {ativos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento anexado"
          descricao="Anexe a carta de aceite e o plano de trabalho quando estiverem disponíveis."
          acao={
            podeAnexar ? (
              <AnexarDocumentoDoBolsista
                bolsaId={bolsaId}
                categorias={categorias}
              />
            ) : undefined
          }
        />
      ) : (
        <Tabela
          rotulo="Documentos do bolsista"
          colunas={[
            { chave: "arquivo", texto: "Arquivo" },
            { chave: "categoria", texto: "Categoria" },
            { chave: "versao", texto: "Versão", alinhamento: "direita" },
            { chave: "envio", texto: "Enviado" },
            { chave: "acoes", texto: "Ações" },
          ]}
        >
          {ativos.map((documento) => (
            <tr key={documento.id}>
              <Celula>
                <span className="font-medium text-foreground">
                  {documento.nome}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {tamanhoLegivel(documento.tamanho)}
                  {documento.legenda ? ` · ${documento.legenda}` : ""}
                </span>
              </Celula>
              <Celula>
                {rotulo(documento.categoria)}
                {ehDocumentoPessoal(documento.categoria) ? (
                  <span className="mt-1 block">
                    <Selo tom="aviso">Pessoal</Selo>
                  </span>
                ) : null}
                {documento.retencaoAte ? (
                  <span className="mt-1 block text-xs text-muted">
                    Guardar até {data(documento.retencaoAte)}
                  </span>
                ) : null}
              </Celula>
              <Celula direita className="tabular-nums">
                {documento.versao}
              </Celula>
              <Celula>
                {dataHora(documento.enviadoEm)}
                {documento.enviadoPor ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    {documento.enviadoPor}
                  </span>
                ) : null}
              </Celula>
              <Celula>
                <a
                  href={`/api/bff/anexos/${documento.id}/conteudo`}
                  className="text-sm text-primary hover:underline"
                >
                  Baixar
                  <span className="sr-only"> {documento.nome}</span>
                </a>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Dado({
  rotulo: nome,
  valor,
}: {
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{nome}</dt>
      <dd className="mt-1 text-foreground">{valor}</dd>
    </div>
  );
}
