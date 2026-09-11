import type { Metadata } from "next";
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
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Painel, PanoramaMobilidade } from "@/lib/dominio";
import { inteiro, moeda, percentual, rotulo } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Painel executivo — Gerenciador PROPESP",
};

/**
 * P01 · Painel executivo.
 *
 * Responde "como está o programa" em dez segundos. Todo número aqui é
 * **calculado** pela API a partir dos dados de entrada — nenhum vem de coluna
 * gravada. É o que permite afirmar que o painel e o plano nunca divergem, o que
 * a planilha não conseguia garantir.
 */
export default async function PainelExecutivo() {
  const painel = await apiFetch<Painel | null>("/programas/padrao/painel");

  /**
   * BOL-041 · os números de internacionalização vêm do **panorama**, não de um
   * cálculo próprio da P01.
   *
   * Duas telas que somam as mesmas concessões por caminhos diferentes divergem
   * na primeira mudança, e quem clicasse daqui para `/mobilidade` encontraria
   * outra contagem do lado de lá — exatamente o que a CG-066 evitou ao fazer
   * cada cartão do painel do Comitê reusar a expressão da lista.
   */
  const panorama = painel
    ? await apiFetch<PanoramaMobilidade>(
        `/mobilidade/panorama?cicloId=${painel.ciclo.cicloId}`,
      )
    : null;

  if (!painel) {
    return (
      <Pagina titulo="Painel executivo">
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

  const { ciclo } = painel;
  const base = `/programas/${ciclo.programaSlug}/${ciclo.cicloNome}`;
  const totalFluxo = painel.fluxo.in + painel.fluxo.out;
  const anosCompostos = new Set(painel.anosCompostos);
  // Enquanto só um exercício tem bolsas, "no ciclo" repete "no ano" coluna a
  // coluna, e o leitor procura uma diferença que não existe. As colunas do
  // ciclo aparecem quando passam a dizer algo novo.
  const cicloDifereDoAno = painel.anosCompostos.length > 1;
  const anosAindaSemBolsa = ciclo.anos.filter((ano) => !anosCompostos.has(ano));

  return (
    <Pagina
      titulo="Painel executivo"
      descricao={
        <>
          {ciclo.programaNome} · ciclo {ciclo.cicloNome} ·{" "}
          {rotulo(ciclo.status).toLowerCase()} · exercício-base {painel.anoBase}
        </>
      }
    >
      <Secao
        titulo="Indicadores do ciclo"
        descricao="Todos calculados a partir do orçamento e do plano de aplicação."
      >
        <Cartoes>
          {painel.indicadores.map((indicador) => (
            <Cartao
              key={indicador.chave}
              titulo={indicador.rotulo}
              valor={
                indicador.formato === "moeda"
                  ? moeda(indicador.valor)
                  : indicador.formato === "texto"
                    ? String(indicador.valor ?? "—")
                    : inteiro(indicador.valor as number)
              }
              nota={indicador.nota}
            />
          ))}
        </Cartoes>
      </Secao>

      {/*
        Ao lado dos indicadores financeiros, e não no lugar deles: a P01 responde
        "o plano cabe no orçamento?" e esta seção responde "o que já aconteceu?".
        São perguntas diferentes, e fundi-las faria compromisso parecer execução.
      */}
      {panorama ? (
        <Secao
          titulo="Internacionalização neste ciclo"
          descricao="Concessões já registradas. Não é planejamento: são as bolsas atribuídas a pessoas."
          acoes={
            <Link
              href="/mobilidade"
              className="text-sm text-primary hover:underline"
            >
              Ver panorama completo →
            </Link>
          }
        >
          {panorama.totais.mobilidades === 0 ? (
            <EstadoVazio
              titulo="Nenhuma concessão registrada neste ciclo"
              descricao={
                <>
                  O plano define quantas bolsas há; aqui aparecem as já
                  atribuídas a pessoas. Registre as concessões em{" "}
                  <Link href="/mobilidade/bolsistas">Bolsistas</Link>.
                </>
              }
            />
          ) : (
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
              <Cartao
                titulo="Países"
                valor={inteiro(panorama.totais.paises)}
              />
              <Cartao
                titulo="Instituições"
                valor={inteiro(panorama.totais.instituicoes)}
                nota="Somente as ligadas ao cadastro central"
              />
              <Cartao
                titulo="Custo das bolsas concedidas"
                valor={moeda(panorama.totais.valor)}
                // D-B07, homologada em 2026-09-09: não se chama "executado". A
                // RN-12 diz que nada passa pelo caixa da UEA — a CAPES paga
                // direto —, e a RN-14 proíbe somar isto ao aporte do Comitê.
                nota="Compromisso assumido; a CAPES paga direto ao beneficiário"
              />
            </Cartoes>
          )}
        </Secao>
      ) : null}

      {painel.alertas.length > 0 ? (
        <Secao
          titulo="Alertas gerenciais"
          descricao="Pontos que pedem ação. Cada alerta abre o registro de onde veio."
        >
          <ul className="grid gap-3 lg:grid-cols-2">
            {painel.alertas.map((alerta) => (
              <li key={alerta.chave}>
                <Link
                  href={alerta.destino}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">
                      {alerta.titulo}
                    </p>
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
        </Secao>
      ) : null}

      <Secao
        titulo="Resumo por rede coordenadora"
        descricao={`Valores do exercício ${painel.anoBase}. Rede sem orçamento definido aparece como pendente, nunca como zero.`}
        acoes={
          <Link
            href={`${base}/redes`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Ver áreas temáticas →
          </Link>
        }
      >
        <Tabela
          colunas={[
            { chave: "rede", texto: "Rede" },
            { chave: "status", texto: "Situação" },
            { chave: "orcamento", texto: "Orçamento", alinhamento: "direita" },
            { chave: "bolsas", texto: "Custo de bolsas", alinhamento: "direita" },
            { chave: "apoio", texto: "Manutenção e missões", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo potencial", alinhamento: "direita" },
            { chave: "qtd", texto: "Bolsas", alinhamento: "direita" },
            { chave: "tematicas", texto: "Temáticas", alinhamento: "direita" },
            { chave: "ppgs", texto: "PPGs", alinhamento: "direita" },
          ]}
        >
          {painel.porRede.map((rede) => (
            <tr key={rede.redeId}>
              <Celula>
                <span className="font-medium text-foreground">{rede.rede}</span>
              </Celula>
              <Celula>
                <div className="flex flex-col items-start gap-1.5">
                  <Selo tom={rede.statusOrcamento === "DEFINIDO" ? "sucesso" : "aviso"}>
                    Orçamento {rede.statusOrcamento === "DEFINIDO" ? "definido" : "pendente"}
                  </Selo>
                  <Selo tom={rede.statusComposicao === "APROVADA" ? "sucesso" : "aviso"}>
                    Composição {rede.statusComposicao === "APROVADA" ? "aprovada" : "a definir"}
                  </Selo>
                </div>
              </Celula>
              <Celula direita>
                <Moeda valor={rede.totalPrevisto} />
              </Celula>
              <Celula direita>
                <Moeda valor={rede.custoBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={rede.apoio} />
              </Celula>
              <Celula direita>
                <Moeda valor={rede.saldoPotencial} />
              </Celula>
              <Celula direita>{inteiro(rede.bolsas)}</Celula>
              <Celula direita>{inteiro(rede.tematicas)}</Celula>
              <Celula direita>{inteiro(rede.ppgs)}</Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>

      {painel.coordenacao.length > 0 ? (
        <Secao
          titulo="Coordenação das temáticas"
          descricao="Coordenadores de temática de cada rede. Uma temática pode ter mais de um coordenador, conforme o PPG."
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {painel.coordenacao.map((rede) => (
              <section
                key={rede.redeId}
                aria-labelledby={`coordenacao-${rede.redeId}`}
                className="rounded-2xl border border-border bg-surface p-4"
              >
                <h3
                  id={`coordenacao-${rede.redeId}`}
                  className="font-semibold text-foreground"
                >
                  {rede.rede}
                </h3>
                <dl className="mt-3 space-y-3 text-sm">
                  {rede.tematicas.map((tematica) => (
                    <div key={tematica.codigo}>
                      <dt className="text-muted">
                        <span className="font-mono text-xs">{tematica.codigo}</span>{" "}
                        · {tematica.nome}
                      </dt>
                      <dd className="mt-0.5 font-medium text-foreground">
                        {tematica.coordenadores.length > 0 ? (
                          tematica.coordenadores.join(" · ")
                        ) : (
                          <span className="font-normal italic text-subtle">
                            A definir
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </Secao>
      ) : null}

      <Secao
        titulo="Bolsas por modalidade"
        descricao={
          cicloDifereDoAno
            ? `Exercício ${painel.anoBase} e soma dos exercícios já compostos do ciclo.`
            : `Exercício ${painel.anoBase}, o único do ciclo com bolsas definidas até agora.`
        }
      >
        <Tabela
          colunas={[
            { chave: "modalidade", texto: "Modalidade" },
            { chave: "destino", texto: "Destino" },
            { chave: "qtdAno", texto: `Bolsas ${painel.anoBase}`, alinhamento: "direita" },
            { chave: "custoAno", texto: `Custo ${painel.anoBase}`, alinhamento: "direita" },
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
      </Secao>

      <Secao
        titulo="Mobilidade IN e OUT"
        descricao="Bolsas programadas por sentido: destino Brasil traz alguém para a UEA; destino exterior leva alguém daqui para fora."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Cartao
            titulo="IN — entram na UEA"
            valor={`${inteiro(painel.fluxo.in)} bolsas`}
            nota={
              totalFluxo > 0
                ? `${percentual(painel.fluxo.in / totalFluxo)} do total`
                : undefined
            }
          />
          <Cartao
            titulo="OUT — saem da UEA"
            valor={`${inteiro(painel.fluxo.out)} bolsas`}
            nota={
              totalFluxo > 0
                ? `${percentual(painel.fluxo.out / totalFluxo)} do total`
                : undefined
            }
          />
        </div>
      </Secao>

      <Secao
        titulo="Impacto por exercício"
        descricao={
          anosAindaSemBolsa.length > 0
            ? `O aporte se repete todo ano, sem reajuste. As bolsas são definidas exercício a exercício; ${anosAindaSemBolsa.join(", ")} ainda não têm composição.`
            : "O aporte se repete todo ano, sem reajuste. As bolsas são definidas exercício a exercício."
        }
      >
        <Tabela
          colunas={[
            { chave: "ano", texto: "Exercício" },
            { chave: "aporte", texto: "Aporte", alinhamento: "direita" },
            { chave: "bolsas", texto: "Custo de bolsas", alinhamento: "direita" },
            { chave: "apoio", texto: "Apoio programado", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo potencial", alinhamento: "direita" },
            { chave: "qtd", texto: "Bolsas", alinhamento: "direita" },
          ]}
        >
          {painel.porAno.map((ano) => (
            <tr key={ano.ano}>
              <Celula>
                <span className="font-medium text-foreground">{ano.ano}</span>
              </Celula>
              <Celula direita>
                <Moeda valor={ano.aporte} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.custoBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.custoApoio} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.saldoPotencial} />
              </Celula>
              <Celula direita>
                {anosCompostos.has(ano.ano) ? (
                  inteiro(ano.bolsas)
                ) : (
                  <span className="italic text-subtle">A definir</span>
                )}
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>

      {painel.comiteGestorAnual ? (
        <Secao titulo="Comitê Gestor">
          <Aviso tom="aviso" titulo="Orçamento paralelo">
            Os <Moeda valor={painel.comiteGestorAnual} /> anuais do Comitê Gestor{" "}
            <strong>não integram</strong> o orçamento de bolsas acima. Somar os
            dois superestimaria em cerca de 30% o recurso disponível para
            bolsas.{" "}
            <Link
              href={`${base}/comite-gestor`}
              className="font-medium underline"
            >
              Ver o detalhamento
            </Link>
            .
          </Aviso>
        </Secao>
      ) : null}
    </Pagina>
  );
}
