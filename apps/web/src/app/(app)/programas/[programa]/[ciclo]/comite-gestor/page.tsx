import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  Moeda,
  Pagina,
  Secao,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { ComiteGestor } from "@/lib/dominio";
import { percentual } from "@/lib/formato";

/**
 * P17 · Comitê Gestor.
 *
 * RN-14 · este orçamento é **paralelo** e nunca se soma ao de bolsas. O aviso
 * fica no topo, fixo, porque o painel original da planilha precisou dizer isso
 * por escrito — a confusão é fácil e cara: somar os dois inflaria em cerca de
 * 30% o recurso que a instituição pensa ter para bolsas.
 */
export default async function ComiteGestorPagina({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo } = await params;
  const dados = await apiFetch<ComiteGestor>(
    `/programas/${programa}/${ciclo}/comite-gestor`,
  );

  const totalCiclo = Number(dados.totalCiclo);

  return (
    <Pagina
      titulo="Comitê Gestor"
      descricao="Orçamento para missões e articulação institucional, aportado pelas redes coordenadoras."
    >
      <Aviso tom="aviso" titulo="Este orçamento não integra o de bolsas">
        {dados.aviso}
      </Aviso>

      <Cartoes>
        <Cartao titulo="Total anual" valor={<Moeda valor={dados.totalAnual} />} />
        <Cartao
          titulo="Total do ciclo"
          valor={<Moeda valor={dados.totalCiclo} />}
          nota={`${dados.anos.length} exercícios: ${dados.anos.join(", ")}`}
        />
        <Cartao
          titulo="Maior aporte"
          valor={maiorAporte(dados)}
          nota="Rede com o maior aporte no ciclo"
        />
        <Cartao titulo="Redes aportadoras" valor={String(dados.porRede.length)} />
      </Cartoes>

      <div className="mt-10" />

      <Secao
        titulo="Aporte por rede e exercício"
        descricao="Os valores se repetem nominalmente em todos os anos, como no orçamento de bolsas."
      >
        <Tabela
          colunas={[
            { chave: "rede", texto: "Rede" },
            ...dados.anos.map((ano) => ({
              chave: String(ano),
              texto: String(ano),
              alinhamento: "direita" as const,
            })),
            { chave: "total", texto: "Total do ciclo", alinhamento: "direita" },
            { chave: "part", texto: "Participação", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              {dados.anos.map((ano) => (
                <Celula key={ano} direita>
                  <Moeda valor={dados.totalAnual} forte />
                </Celula>
              ))}
              <Celula direita>
                <Moeda valor={dados.totalCiclo} forte />
              </Celula>
              <Celula direita>100,0%</Celula>
            </tr>
          }
        >
          {dados.porRede.map((rede) => (
            <tr key={rede.rede ?? "sem-rede"}>
              <Celula>
                <span className="font-medium text-foreground">
                  {rede.rede ?? "—"}
                </span>
              </Celula>
              {rede.porAno.map((ano) => (
                <Celula key={ano.ano} direita>
                  <Moeda valor={ano.valor} />
                </Celula>
              ))}
              <Celula direita>
                <Moeda valor={rede.total} forte />
              </Celula>
              <Celula direita>
                {totalCiclo > 0
                  ? percentual(Number(rede.total) / totalCiclo)
                  : "—"}
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </Pagina>
  );
}

function maiorAporte(dados: ComiteGestor): string {
  const maior = [...dados.porRede].sort(
    (a, b) => Number(b.total) - Number(a.total),
  )[0];
  return maior?.rede ?? "—";
}
