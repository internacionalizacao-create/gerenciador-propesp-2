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
import type {
  CoordenadorTematica,
  LinhaRede,
  LinhaTematica,
} from "@/lib/dominio";
import { inteiro } from "@/lib/formato";

interface Resposta {
  ano: number;
  redes: (LinhaRede & {
    areas: (LinhaTematica & { coordenadores: CoordenadorTematica[] })[];
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
        <Aviso tom="perigo" titulo="Divergência entre saldo calculado e informado">
          {divergentes.map((a) => a.codigo).join(", ")} — o saldo calculado a
          partir do plano não bate com o valor de referência registrado. As
          linhas estão marcadas abaixo; abra a temática pelo código para conferir
          os valores.{" "}
          <Link href="/pendencias" className="font-medium underline">
            Registrar pendência
          </Link>
          .
        </Aviso>
      ) : null}

      {dados.redes.map((rede) => (
        <Secao
          key={rede.redeId}
          titulo={`Rede ${rede.rede}`}
          descricao={
            rede.statusOrcamento === "DEFINIDO" ? (
              <>
                {inteiro(rede.tematicas)} áreas temáticas ·{" "}
                {inteiro(rede.ppgs)} PPGs · {inteiro(rede.bolsas)} bolsas/ano
              </>
            ) : (
              <>
                {inteiro(rede.tematicas)} áreas temáticas e{" "}
                {inteiro(rede.ppgs)} PPGs cadastrados. O orçamento ainda não foi
                informado pela rede — os campos ficam em branco, e não em zero.
              </>
            )
          }
        >
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "area", texto: "Área temática" },
              { chave: "coordenacao", texto: "Coordenação temática" },
              { chave: "ppgs", texto: "PPGs", alinhamento: "direita" },
              { chave: "bolsas", texto: "Orçamento bolsas", alinhamento: "direita" },
              { chave: "apoio", texto: "Manut. + missões", alinhamento: "direita" },
              { chave: "total", texto: "Total previsto", alinhamento: "direita" },
              { chave: "custo", texto: "Custo calculado", alinhamento: "direita" },
              { chave: "saldo", texto: "Saldo", alinhamento: "direita" },
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
