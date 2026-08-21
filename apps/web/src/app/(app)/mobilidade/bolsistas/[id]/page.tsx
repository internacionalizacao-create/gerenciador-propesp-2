import Link from "next/link";

import {
  SeloSituacaoBolsa,
  SeloSituacaoProduto,
} from "@/componentes/bolsistas/situacoes";
import { EditarBolsaConcedida } from "@/componentes/formularios/form-bolsa-concedida";
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
import type { BolsaConcedidaDetalhe, Me } from "@/lib/dominio";
import { data, inteiro, meses, rotulo } from "@/lib/formato";

export default async function DetalheDoBolsista({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [bolsa, me] = await Promise.all([
    apiFetch<BolsaConcedidaDetalhe>(`/bolsistas/${id}`),
    apiFetch<Me>("/me"),
  ]);
  const podeEditarBolsa = me.permissions.includes("bolsa:write");
  const podeEditarProdutos = me.permissions.includes("produto:write");
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
          <Dado rotulo="Nível" valor={rotulo(bolsa.nivelBeneficiario)} />
          <Dado rotulo="PPG" valor={`${bolsa.ppgSigla} · ${bolsa.ppg}`} />
          <Dado
            rotulo="Programa"
            valor={`${bolsa.programa} · ${bolsa.ciclo}`}
          />
          <Dado rotulo="Modalidade" valor={bolsa.modalidade} />
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
    </Pagina>
  );
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
