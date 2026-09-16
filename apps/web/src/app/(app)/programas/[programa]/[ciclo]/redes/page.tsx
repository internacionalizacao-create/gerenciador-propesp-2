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
import { Ajuda } from "@/componentes/ui/ajuda";
import { AJUDA_ORCAMENTO } from "@/lib/ajuda-orcamento";
import type {
  CoordenadorTematica,
  LinhaRede,
  LinhaTematica,
} from "@/lib/dominio";
import { inteiro } from "@/lib/formato";

interface Resposta {
  ano: number;
  redes: (LinhaRede & {
    areas: (LinhaTematica & {
      coordenadores: CoordenadorTematica[];
      ppgsContemplados: {
        ppgId: string;
        ppgSigla: string;
        ppgNome: string;
      }[];
    })[];
  })[];
}

/**
 * P07 · Redes e areas tematicas.
 *
 * Substitui `Redes_Tematicas` e as tres abas `Comite *`. A divergencia continua
 * calculada, mas so ocupa espaco quando existir: vira alerta e destaca a linha,
 * enquanto os valores da conferencia ficam no detalhe da tematica (RN-08).
 */
export default async function RedesETematicas({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
  searchParams: Promise<{ ano?: string }>;
}) {
  const { programa, ciclo } = await params;
  const { ano } = await searchParams;
  const base = `/programas/${programa}/${ciclo}`;

  const dados = await apiFetch<Resposta>(
    `/programas/${programa}/${ciclo}/redes${ano ? `?ano=${ano}` : ""}`,
  );

  const divergentes = dados.redes
    .flatMap((r) => r.areas)
    .filter((a) => a.divergencia !== null && Number(a.divergencia) !== 0);

  return (
    <Pagina
      titulo="Redes e áreas temáticas"
      descricao={`Exercício ${dados.ano}. Cada PPG participante tem seu Coordenador de Temática.`}
    >
      {divergentes.length > 0 ? (
        <Aviso
          tom="perigo"
          titulo="Divergência entre saldo calculado e informado"
        >
          {divergentes.map((a) => a.codigo).join(", ")} — o saldo calculado a
          partir do plano não bate com o valor de referência registrado. As
          linhas estão marcadas abaixo; abra a temática pelo código para
          conferir os valores.
        </Aviso>
      ) : null}

      {dados.redes.map((rede) => (
        <Secao
          key={rede.redeId}
          titulo={`Rede ${rede.rede}`}
          descricao={
            rede.statusOrcamento === "DEFINIDO" ? (
              <>
                {inteiro(rede.tematicas)} áreas temáticas · {inteiro(rede.ppgs)}{" "}
                PPGs · {inteiro(rede.bolsas)} bolsas/ano
              </>
            ) : (
              <>
                {inteiro(rede.tematicas)} áreas temáticas e {inteiro(rede.ppgs)}{" "}
                PPGs cadastrados. O orçamento ainda não foi informado pela rede
                — os campos ficam em branco, e não em zero.
              </>
            )
          }
        >
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "area", texto: "Área temática" },
              { chave: "contemplados", texto: "PPGs contemplados" },
              { chave: "coordenacao", texto: "Coordenação temática" },
              { chave: "ppgs", texto: "PPGs no tema", alinhamento: "direita" },
              {
                chave: "bolsas",
                texto: <Ajuda rotulo="Orçamento bolsas">{AJUDA_ORCAMENTO.bolsas}</Ajuda>,
                alinhamento: "direita",
              },
              {
                chave: "apoio",
                texto: <Ajuda rotulo="Manut. + missões">{AJUDA_ORCAMENTO.apoio}</Ajuda>,
                alinhamento: "direita",
              },
              {
                chave: "total",
                texto: <Ajuda rotulo="Total recurso">{AJUDA_ORCAMENTO.total}</Ajuda>,
                alinhamento: "direita",
              },
              {
                chave: "custo",
                texto: <Ajuda rotulo="Custo calculado">{AJUDA_ORCAMENTO.custo}</Ajuda>,
                alinhamento: "direita",
              },
              { chave: "saldo", texto: <Ajuda rotulo="Saldo">{AJUDA_ORCAMENTO.saldo}</Ajuda>, alinhamento: "direita" },
              { chave: "util", texto: "Utilização", alinhamento: "direita" },
            ]}
          >
            {rede.areas.map((area) => {
              const divergente =
                area.divergencia !== null && Number(area.divergencia) !== 0;

              return (
                <tr
                  key={area.areaTematicaId}
                  className={divergente ? "bg-danger-soft/40" : undefined}
                >
                  <Celula>
                    <Link
                      href={`${base}/tematicas/${area.codigo}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {area.codigo}
                    </Link>
                  </Celula>
                  <Celula className="max-w-xs">
                    <span className="text-foreground">{area.nome}</span>
                    {area.statusOrcamento === "A_DEFINIR" ? (
                      <span className="ml-2">
                        <Selo tom="aviso">A definir</Selo>
                      </span>
                    ) : null}
                  </Celula>
                  <Celula className="max-w-xs">
                    {area.ppgsContemplados.length > 0 ? (
                      <ul className="space-y-1 text-muted">
                        {area.ppgsContemplados.map((ppg) => (
                          <li key={ppg.ppgId}>
                            <span className="font-medium text-foreground">
                              {ppg.ppgNome}
                            </span>
                            <span className="block text-xs text-subtle">
                              {ppg.ppgSigla}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="italic text-subtle">
                        Nenhum PPG contemplado
                      </span>
                    )}
                  </Celula>
                  <Celula className="max-w-[14rem]">
                    {area.coordenadores.length > 0 ? (
                      <span className="text-muted">
                        {area.coordenadores
                          .map((c) => `${c.ppgSigla}: ${c.nome}`)
                          .join(" · ")}
                      </span>
                    ) : (
                      <span className="italic text-subtle">Sem designação</span>
                    )}
                  </Celula>
                  <Celula direita>{inteiro(area.ppgs)}</Celula>
                  <Celula direita>
                    <Moeda valor={area.valorBolsas} />
                  </Celula>
                  <Celula direita>
                    <Moeda valor={area.apoio} />
                  </Celula>
                  <Celula direita>
                    <Moeda valor={area.totalPrevisto} />
                  </Celula>
                  <Celula direita>
                    <Moeda valor={area.custoBolsas} />
                  </Celula>
                  <Celula direita>
                    <Moeda valor={area.saldoPotencial} />
                  </Celula>
                  <Celula direita>
                    <Utilizacao fracao={area.utilizacao} />
                  </Celula>
                </tr>
              );
            })}
          </Tabela>
        </Secao>
      ))}
    </Pagina>
  );
}
