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
import type { Painel } from "@/lib/dominio";
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

  if (!painel) {
    return (
      <Pagina titulo="Painel executivo">
        <EstadoVazio
          titulo="Nenhum ciclo cadastrado"
          descricao={
            <>
              O sistema ainda não tem um programa com plano de aplicação. Carregue
              a seed com <code>pnpm --filter api db:seed --reset</code> ou cadastre
              um programa em <Link href="/programas">Programas</Link>.
            </>
          }
        />
      </Pagina>
    );
  }

  const { ciclo } = painel;
  const base = `/programas/${ciclo.programaSlug}/${ciclo.cicloNome}`;
  const totalFluxo = painel.fluxo.in + painel.fluxo.out;

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
      <Aviso tom="info" titulo="Como ler estes números">
        Valores pendentes nunca entram como zero. As quatro áreas temáticas da
        UNICAMP aparecem como <em>A definir</em> e ficam fora de médias e
        percentuais — tratá-las como zero é o que distorcia os indicadores na
        planilha.
      </Aviso>

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
                  : inteiro(indicador.valor as number)
              }
              nota={indicador.nota}
            />
          ))}
        </Cartoes>
      </Secao>

      {painel.alertas.length > 0 ? (
        <Secao
          titulo="Alertas gerenciais"
          descricao="Cada alerta leva ao registro que o originou — alerta que não leva a lugar nenhum é decoração."
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
        descricao="Rede sem orçamento definido aparece como pendente, nunca como zero."
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
            { chave: "orcamento", texto: "Orçamento anual", alinhamento: "direita" },
            { chave: "bolsas", texto: "Custo de bolsas", alinhamento: "direita" },
            { chave: "apoio", texto: "Manutenção e missões", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo potencial", alinhamento: "direita" },
            { chave: "qtd", texto: "Bolsas/ano", alinhamento: "direita" },
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
                {rede.statusOrcamento === "DEFINIDO" ? (
                  <Selo tom="sucesso">Definido</Selo>
                ) : (
                  <Selo tom="aviso" titulo="A rede ainda não informou o orçamento">
                    Pendente
                  </Selo>
                )}
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

      <Secao
        titulo="Bolsas por modalidade"
        descricao="Quantidade é soma de unidades, não contagem de linhas de planejamento (RN-11)."
      >
        <Tabela
          colunas={[
            { chave: "modalidade", texto: "Modalidade" },
            { chave: "destino", texto: "Destino" },
            { chave: "qtdAno", texto: "Qtd./ano", alinhamento: "direita" },
            { chave: "custoAno", texto: "Custo/ano", alinhamento: "direita" },
            { chave: "qtdCiclo", texto: "Qtd. no ciclo", alinhamento: "direita" },
            { chave: "custoCiclo", texto: "Custo no ciclo", alinhamento: "direita" },
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
              <Celula direita>{inteiro(linha.quantidadeCiclo)}</Celula>
              <Celula direita>
                <Moeda valor={linha.custoCiclo} />
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>

      <Secao
        titulo="Mobilidade IN e OUT"
        descricao="Destino Brasil traz alguém para a UEA; destino exterior leva alguém daqui para fora (RN-10)."
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
                ? `${percentual(painel.fluxo.out / totalFluxo)} do total — o desequilíbrio é informação estratégica, não defeito`
                : undefined
            }
          />
        </div>
      </Secao>

      <Secao
        titulo="Impacto por exercício"
        descricao="A premissa vigente repete o valor nominal, sem reajuste, em todos os anos do ciclo (RN-09). É revisável — está registrada em Premissas."
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
              <Celula direita>{inteiro(ano.bolsas)}</Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>

      {painel.comiteGestorAnual ? (
        <Secao titulo="Comitê Gestor">
          <Aviso tom="aviso" titulo="Orçamento paralelo">
            Os <Moeda valor={painel.comiteGestorAnual} /> anuais do Comitê Gestor{" "}
            <strong>não integram</strong> o orçamento de bolsas acima. Somar os
            dois superestimaria em cerca de 30% o recurso disponível para bolsas
            (RN-14).{" "}
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
