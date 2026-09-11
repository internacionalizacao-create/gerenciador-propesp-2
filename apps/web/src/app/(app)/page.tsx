import type { Metadata } from "next";
import Link from "next/link";

import {
  BolsasPorModalidade,
  LegendaDestino,
} from "@/componentes/graficos/bolsas-por-modalidade";
import { CartoesRede } from "@/componentes/painel/cartoes-rede";
import { BarraDeProporcao, CartaoKpi } from "@/componentes/painel/kpis";
import { MapaComposicao } from "@/componentes/painel/mapa-composicao";
import {
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
import { Botao } from "@/componentes/ui/botao";
import { apiFetch } from "@/lib/api";
import type { Painel, PanoramaMobilidade } from "@/lib/dominio";
import { A_DEFINIR, inteiro, moeda, percentual, rotulo } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Resumo do Orçamento Anual — Gerenciador PROPESP",
};

/**
 * P01 · Resumo do Orçamento Anual.
 *
 * Organizado como painel, e não como relatório: cada bloco responde uma
 * pergunta e leva à tela onde ela se resolve. A primeira faixa responde a
 * principal — o plano cabe no orçamento? — em cinco segundos; as redes, a
 * composição do ciclo e as ações pendentes vêm depois, do geral para o detalhe.
 *
 * Nenhum número daqui é calculado na tela: tudo vem do `GET /painel`, com o
 * exercício escolhido em `?ano=`. A home é a mesma para todos os perfis até
 * existir recorte de plano e orçamento (AGENTS.md §9).
 */
export default async function PainelExecutivo({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string }>;
}) {
  const { ano } = await searchParams;
  const painel = await apiFetch<Painel | null>(
    `/programas/padrao/painel${ano ? `?ano=${encodeURIComponent(ano)}` : ""}`,
  );

  if (!painel) {
    return (
      <Pagina titulo="Resumo do Orçamento Anual">
        <EstadoVazio
          titulo="Nenhum ciclo cadastrado"
          descricao={
            <>
              O sistema ainda não tem um programa com plano de aplicação.
              Cadastre um programa em <Link href="/programas">Programas</Link>.
            </>
          }
        />
      </Pagina>
    );
  }

  /**
   * BOL-041 · os números de internacionalização vêm do **panorama**, não de um
   * cálculo próprio da P01 — quem clicar para `/mobilidade` encontra a mesma
   * contagem do lado de lá.
   */
  const panorama = await apiFetch<PanoramaMobilidade>(
    `/mobilidade/panorama?cicloId=${painel.ciclo.cicloId}`,
  );

  const { ciclo, anoBase } = painel;
  const base = `/programas/${ciclo.programaSlug}/${ciclo.cicloNome}`;
  const valor = (chave: string) =>
    painel.indicadores.find((indicador) => indicador.chave === chave)?.valor ?? null;

  const exercicioComposto = painel.anosCompostos.includes(anoBase);
  const usoDoTeto = valor("uso-teto-ano") as number | null;
  const celulas = painel.composicao.flatMap((linha) => linha.anos);
  const aprovadas = celulas.filter((c) => c.status === "APROVADA").length;
  const redesSemComposicao = [...new Set(painel.composicao.map((l) => l.rede))].filter(
    (rede) =>
      !painel.composicao.some(
        (linha) =>
          linha.rede === rede && linha.anos.some((c) => c.status === "APROVADA"),
      ),
  );
  // Enquanto só um exercício tem bolsas, "no ciclo" repete "no ano" coluna a
  // coluna, e o leitor procura uma diferença que não existe.
  const cicloDifereDoAno = painel.anosCompostos.length > 1;

  return (
    <Pagina
      titulo="Resumo do Orçamento Anual"
      descricao={
        <>
          {ciclo.programaNome} · ciclo {ciclo.cicloNome} ·{" "}
          {rotulo(ciclo.status).toLowerCase()}
        </>
      }
      acoes={<SeletorDeExercicio anos={ciclo.anos} selecionado={anoBase} />}
    >
      {/* 1 · A pergunta principal */}
      <section aria-label={`Indicadores de ${anoBase}`} className="mb-9">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CartaoKpi
            rotulo={`Aporte ${anoBase}`}
            valor={moeda(valor("aporte-anual") as string | null)}
            contexto={
              <>
                Ciclo: {moeda(valor("projecao-ciclo") as string | null)} em{" "}
                {ciclo.anos.length} exercícios, sem reajuste.
              </>
            }
            href={`${base}/orcamento?ano=${anoBase}`}
          />
          <CartaoKpi
            rotulo="Teto de bolsas comprometido"
            valor={
              usoDoTeto === null ? (
                <span className="italic text-subtle">{A_DEFINIR}</span>
              ) : (
                percentual(usoDoTeto)
              )
            }
            barra={<BarraDeProporcao fracao={usoDoTeto ?? 0} semaforo={usoDoTeto !== null} />}
            contexto={
              usoDoTeto === null
                ? `Nenhuma rede compôs ${anoBase} ainda.`
                : `Custo de ${moeda(valor("custo-bolsas-ano") as string | null)} e saldo de ${moeda(valor("saldo-ano") as string | null)} nas redes com composição aprovada.`
            }
            href={`${base}/orcamento?ano=${anoBase}`}
          />
          <CartaoKpi
            rotulo={`Bolsas ${anoBase}`}
            valor={
              exercicioComposto ? (
                inteiro(valor("bolsas-ano") as number)
              ) : (
                <span className="italic text-subtle">{A_DEFINIR}</span>
              )
            }
            contexto={
              exercicioComposto
                ? `${inteiro(painel.fluxo.in)} para a UEA · ${inteiro(painel.fluxo.out)} para o exterior`
                : `A composição de ${anoBase} ainda não foi definida.`
            }
            href={`${base}/plano?ano=${anoBase}`}
          />
          <CartaoKpi
            rotulo="Composições aprovadas no ciclo"
            valor={`${inteiro(aprovadas)} de ${inteiro(celulas.length)}`}
            barra={
              celulas.length > 0 ? (
                <BarraDeProporcao fracao={aprovadas / celulas.length} />
              ) : undefined
            }
            contexto={
              redesSemComposicao.length > 0
                ? `${redesSemComposicao.join(", ")} ainda sem nenhuma composição aprovada.`
                : `Exercícios com bolsas: ${painel.anosCompostos.join(", ")}.`
            }
            href={`${base}/plano`}
          />
        </div>
      </section>

      {/* 2 · Onde está o dinheiro */}
      <Secao
        titulo="Redes coordenadoras"
        descricao={`Exercício ${anoBase}. Rede sem orçamento definido aparece como pendente, nunca como zero.`}
        acoes={
          <Link
            href={`${base}/redes`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver áreas temáticas →
          </Link>
        }
      >
        <CartoesRede
          redes={painel.porRede}
          coordenacao={painel.coordenacao}
          base={base}
          ano={anoBase}
        />
      </Secao>

      {/* 3 · O que falta decidir */}
      <div className="grid gap-x-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Secao
            titulo="Composição do ciclo"
            descricao="Estado de cada área temática em cada exercício. Cada célula abre o plano daquela rede e ano."
          >
            <MapaComposicao
              linhas={painel.composicao}
              anos={ciclo.anos}
              anoSelecionado={anoBase}
              base={base}
            />
          </Secao>
        </div>
        <div>
          <Secao titulo="Alertas do sistema">
            {painel.alertas.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface p-4 text-sm text-muted">
                Nada pendente em {anoBase}.
              </p>
            ) : (
              <ul className="space-y-3">
                {painel.alertas.map((alerta) => (
                  <li key={alerta.chave}>
                    <Link
                      href={alerta.destino}
                      className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-foreground">{alerta.titulo}</p>
                        <Selo
                          tom={
                            alerta.nivel === "ALTA"
                              ? "perigo"
                              : alerta.nivel === "MEDIA"
                                ? "aviso"
                                : "neutro"
                          }
                        >
                          {alerta.quantidade}
                        </Selo>
                      </div>
                      <p className="mt-1.5 text-sm text-muted">{alerta.detalhe}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Secao>
        </div>
      </div>

      {/* 4 · Como o exercício se compõe */}
      <Secao
        titulo="Bolsas por modalidade"
        descricao={
          cicloDifereDoAno
            ? `Exercício ${anoBase}; a tabela traz também a soma dos exercícios já compostos.`
            : `Exercício ${anoBase}.`
        }
      >
        {painel.porModalidade.length === 0 ? (
          <EstadoVazio
            titulo={`Nenhuma bolsa programada em ${anoBase}`}
            descricao="A composição deste exercício ainda não foi definida."
          />
        ) : (
          <>
            <BolsasPorModalidade
              titulo={`Bolsas Programadas para ${anoBase}`}
              linhas={painel.porModalidade.map((linha) => ({
                modalidade: linha.modalidade,
                destino: linha.destino,
                quantidade: linha.quantidadeAno,
                custo: linha.custoAno,
              }))}
            />
            <LegendaDestino />
            <details open className="mt-4">
              <summary className="cursor-pointer select-none text-sm font-medium text-primary">
                Ver dados
              </summary>
              <div className="mt-3">
                <Tabela
                  rotulo="Bolsas por modalidade"
                  colunas={[
                    { chave: "modalidade", texto: "Modalidade" },
                    { chave: "destino", texto: "Destino" },
                    { chave: "qtdAno", texto: `Bolsas ${anoBase}`, alinhamento: "direita" },
                    { chave: "custoAno", texto: `Custo ${anoBase}`, alinhamento: "direita" },
                    ...(cicloDifereDoAno
                      ? [
                          { chave: "qtdCiclo", texto: "Bolsas no ciclo", alinhamento: "direita" as const },
                          { chave: "custoCiclo", texto: "Custo no ciclo", alinhamento: "direita" as const },
                        ]
                      : []),
                  ]}
                >
                  {painel.porModalidade.map((linha) => (
                    <tr key={`${linha.modalidade}-${linha.destino}`}>
                      <Celula>{linha.modalidade}</Celula>
                      <Celula>
                        <Selo tom={linha.destino === "BRASIL" ? "info" : "primario"}>
                          {rotulo(linha.destino)}
                        </Selo>
                      </Celula>
                      <Celula direita>{inteiro(linha.quantidadeAno)}</Celula>
                      <Celula direita>
                        <Moeda valor={linha.custoAno} />
                      </Celula>
                      {cicloDifereDoAno ? (
                        <>
                          <Celula direita>{inteiro(linha.quantidadeCiclo)}</Celula>
                          <Celula direita>
                            <Moeda valor={linha.custoCiclo} />
                          </Celula>
                        </>
                      ) : null}
                    </tr>
                  ))}
                </Tabela>
              </div>
            </details>
          </>
        )}
      </Secao>

      {/*
        5 · O que já aconteceu. Ao lado do planejamento, e não no lugar dele:
        fundi-los faria compromisso parecer execução. Sem concessões, vira uma
        faixa discreta — um bloco de gráficos zerados leria como sistema sem uso.
      */}
      {panorama.totais.mobilidades === 0 ? (
        <section
          aria-label="Mobilidade realizada"
          className="mb-9 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border-strong px-5 py-4 text-sm"
        >
          <p className="text-muted">
            <span className="font-medium text-foreground">Mobilidade realizada · </span>
            Nenhuma concessão registrada neste ciclo. O plano define quantas
            bolsas há; aqui aparecem as já atribuídas a pessoas.
          </p>
          <Link
            href="/mobilidade/bolsistas"
            className="font-medium text-primary hover:underline"
          >
            Registrar concessões →
          </Link>
        </section>
      ) : (
        <Secao
          titulo="Mobilidade realizada neste ciclo"
          descricao="Bolsas já atribuídas a pessoas. Não é planejamento."
          acoes={
            <Link href="/mobilidade" className="text-sm text-primary hover:underline">
              Ver panorama completo →
            </Link>
          }
        >
          <Cartoes>
            <Cartao
              titulo="Mobilidades"
              valor={inteiro(panorama.totais.mobilidades)}
              nota="Concessões atribuídas a pessoas"
            />
            <Cartao
              titulo="IN × OUT"
              valor={`${inteiro(panorama.totais.entrada)} / ${inteiro(panorama.totais.saida)}`}
            />
            <Cartao titulo="Países" valor={inteiro(panorama.totais.paises)} />
            <Cartao
              titulo="Custo das bolsas concedidas"
              valor={moeda(panorama.totais.valor)}
              // D-B07: não se chama "executado" — a CAPES paga direto ao
              // beneficiário, e nada passa pelo caixa da UEA.
              nota="Compromisso assumido; a CAPES paga direto ao beneficiário"
            />
          </Cartoes>
        </Secao>
      )}
    </Pagina>
  );
}

/**
 * Troca de exercício pela URL, como na P10: o link de uma visão manda a mesma
 * visão. O primeiro exercício é a home sem parâmetro.
 */
function SeletorDeExercicio({
  anos,
  selecionado,
}: {
  anos: number[];
  selecionado: number;
}) {
  return (
    <nav aria-label="Exercício" className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted">Exercício</span>
      {anos.map((ano, indice) => {
        const ativo = ano === selecionado;
        return (
          <Botao
            key={ano}
            comoFilho
            variante={ativo ? "primario" : "contorno"}
            tamanho="pequeno"
            className="rounded-full px-4"
          >
            <Link
              href={indice === 0 ? "/" : `/?ano=${ano}`}
              aria-current={ativo ? "page" : undefined}
            >
              {ano}
            </Link>
          </Botao>
        );
      })}
    </nav>
  );
}
