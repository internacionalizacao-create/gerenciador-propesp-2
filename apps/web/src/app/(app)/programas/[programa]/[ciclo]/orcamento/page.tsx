import Link from "next/link";

import {
  Aviso,
  Celula,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
  Utilizacao,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Ciclo, LinhaRede, LinhaTematica } from "@/lib/dominio";
import { inteiro, somarMoeda } from "@/lib/formato";

interface Resposta {
  ciclo: Ciclo;
  tematicas: LinhaTematica[];
  redes: LinhaRede[];
}

/**
 * P09 · Orçamento.
 *
 * Matriz ano × temática. Substitui `Orçamento_2027_2030`, com uma diferença que
 * importa: célula calculada e célula de entrada são visualmente distintas. Na
 * planilha as duas eram iguais, e foi assim que um `PROCV` arrastado errado
 * passou despercebido.
 */
export default async function Orcamento({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo: cicloNome } = await params;
  const base = `/programas/${programa}/${cicloNome}`;

  const { ciclo, tematicas, redes } = await apiFetch<Resposta>(
    `${base}/orcamento`,
  );

  const anos = ciclo.anos;
  const codigos = [
    ...new Map(
      tematicas.map((t) => [
        t.codigo,
        { codigo: t.codigo, nome: t.nome, rede: t.rede },
      ]),
    ).values(),
  ];

  const porChave = new Map(
    tematicas.map((t) => [`${t.codigo}|${t.ano}`, t] as const),
  );

  return (
    <Pagina
      titulo="Orçamento"
      descricao={`Matriz de exercícios × áreas temáticas do ciclo ${ciclo.cicloNome}.`}
    >
      <Aviso tom="aviso" titulo="Manutenção ainda está a definir">
        Todas as redes terão orçamento de manutenção, mas apenas a UNESP
        informou valores. UFMG e UNICAMP aparecem como “A definir”; esses campos
        não são tratados como R$ 0,00 nem entram no total conhecido.
      </Aviso>

      <Secao
        titulo="Consolidado por rede e exercício"
        descricao="Rede sem orçamento definido aparece em branco, e não entra em nenhuma soma."
      >
        <Tabela
          colunas={[
            { chave: "rede", texto: "Rede" },
            ...anos.map((ano) => ({
              chave: String(ano),
              texto: String(ano),
              alinhamento: "direita" as const,
            })),
            { chave: "ciclo", texto: "Total do ciclo", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              {anos.map((ano) => (
                <Celula key={ano} direita>
                  <Moeda
                    valor={somarMoeda(
                      redes
                        .filter((r) => r.ano === ano)
                        .map((r) => r.totalPrevisto),
                    )}
                    forte
                  />
                </Celula>
              ))}
              <Celula direita>
                {/* A projeção do ciclo — o número que o painel executivo
                    anuncia. Sem ele aqui, as duas telas mostrariam recortes
                    diferentes do mesmo orçamento e alguém teria que somar à
                    mão para conferir. */}
                <Moeda
                  valor={somarMoeda(redes.map((r) => r.totalPrevisto))}
                  forte
                />
              </Celula>
            </tr>
          }
        >
          {[...new Set(redes.map((r) => r.rede))].map((nome) => {
            const daRede = redes.filter((r) => r.rede === nome);
            return (
              <tr key={nome}>
                <Celula>
                  <span className="font-medium text-foreground">{nome}</span>
                </Celula>
                {anos.map((ano) => (
                  <Celula key={ano} direita>
                    <Moeda
                      valor={
                        daRede.find((r) => r.ano === ano)?.totalPrevisto ?? null
                      }
                    />
                  </Celula>
                ))}
                <Celula direita>
                  <Moeda valor={somarMoeda(daRede.map((r) => r.totalPrevisto))} forte />
                </Celula>
              </tr>
            );
          })}
        </Tabela>
      </Secao>

      <Secao
        titulo={`Detalhe por área temática — exercício ${anos[0]}`}
        descricao="Os demais exercícios repetem o valor nominal, conforme a premissa vigente."
      >
        <Tabela
          colunas={[
            { chave: "codigo", texto: "Código" },
            { chave: "rede", texto: "Rede" },
            { chave: "bolsas", texto: "Orçamento bolsas", alinhamento: "direita" },
            { chave: "manut", texto: "Manutenção", alinhamento: "direita" },
            { chave: "missoes", texto: "Missões", alinhamento: "direita" },
            { chave: "total", texto: "Total previsto", alinhamento: "direita" },
            { chave: "custo", texto: "Custo programado", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo potencial", alinhamento: "direita" },
            { chave: "util", texto: "Utilização", alinhamento: "direita" },
            { chave: "situacao", texto: "Situação" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              <Celula>—</Celula>
              <Celula direita>
                <Moeda
                  valor={somarMoeda(
                    doAno(tematicas, anos[0]).map((t) => t.valorBolsas),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>
                <Moeda
                  valor={somarConhecido(
                    doAno(tematicas, anos[0]).map((t) => t.valorManutencao),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>
                <Moeda
                  valor={somarConhecido(
                    doAno(tematicas, anos[0]).map((t) => t.valorMissoes),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>
                <Moeda
                  valor={somarMoeda(
                    doAno(tematicas, anos[0]).map((t) => t.totalPrevisto),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>
                <Moeda
                  valor={somarMoeda(
                    doAno(tematicas, anos[0]).map((t) => t.custoBolsas),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>
                <Moeda
                  valor={somarMoeda(
                    doAno(tematicas, anos[0]).map((t) => t.saldoPotencial),
                  )}
                  forte
                />
              </Celula>
              <Celula direita>—</Celula>
              <Celula>—</Celula>
            </tr>
          }
        >
          {codigos.map((t) => {
            const linha = porChave.get(`${t.codigo}|${anos[0]}`);
            if (!linha) return null;

            return (
              <tr key={t.codigo}>
                <Celula>
                  <Link
                    href={`${base}/tematicas/${t.codigo}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {t.codigo}
                  </Link>
                </Celula>
                <Celula>{t.rede}</Celula>
                <Celula direita className="bg-info-soft/30">
                  <Moeda valor={linha.valorBolsas} />
                </Celula>
                <Celula direita className="bg-info-soft/30">
                  <Moeda valor={linha.valorManutencao} />
                </Celula>
                <Celula direita className="bg-info-soft/30">
                  <Moeda valor={linha.valorMissoes} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.totalPrevisto} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.custoBolsas} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.saldoPotencial} />
                </Celula>
                <Celula direita>
                  <Utilizacao fracao={linha.utilizacao} />
                </Celula>
                <Celula>
                  <div className="flex flex-col items-start gap-1.5">
                    <Selo
                      tom={
                        linha.statusOrcamento === "DEFINIDO"
                          ? "sucesso"
                          : "aviso"
                      }
                    >
                      Orçamento {linha.statusOrcamento === "DEFINIDO" ? "definido" : "a definir"}
                    </Selo>
                    <Selo
                      tom={
                        linha.statusComposicao === "APROVADA"
                          ? "sucesso"
                          : linha.statusComposicao === "EM_ELABORACAO"
                            ? "info"
                            : "aviso"
                      }
                    >
                      Composição {linha.statusComposicao === "APROVADA"
                        ? "aprovada"
                        : linha.statusComposicao === "EM_ELABORACAO"
                          ? "em elaboração"
                          : "a definir"}
                    </Selo>
                  </div>
                </Celula>
              </tr>
            );
          })}
        </Tabela>

        <p className="mt-3 text-xs text-subtle">
          As células com fundo azul são entrada de dados; as demais são
          calculadas. {inteiro(codigos.length)} áreas temáticas.
        </p>
      </Secao>
    </Pagina>
  );
}

function doAno(linhas: LinhaTematica[], ano: number) {
  return linhas.filter((l) => l.ano === ano);
}

function somarConhecido(valores: readonly (string | null)[]): string | null {
  return valores.every((valor) => valor === null) ? null : somarMoeda(valores);
}
