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
  Utilizacao,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { DetalheTematica } from "@/lib/dominio";
import { inteiro, meses, moeda, rotulo } from "@/lib/formato";

/**
 * P08 · Detalhe da área temática.
 *
 * Tudo sobre uma temática numa página: orçamento, PPGs, plano e a participação
 * de cada PPG no custo — número que na planilha ninguém conseguia produzir sem
 * refazer a conta à mão.
 */
export default async function DetalheDaTematica({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string; codigo: string }>;
}) {
  const { programa, ciclo, codigo } = await params;
  const base = `/programas/${programa}/${ciclo}`;

  const area = await apiFetch<DetalheTematica>(
    `${`/programas/${programa}/${ciclo}`}/tematicas/${encodeURIComponent(codigo)}`,
  );

  const divergente =
    area.divergencia !== null && Number(area.divergencia) !== 0;

  return (
    <Pagina
      titulo={`${area.codigo} · ${area.nome}`}
      descricao={
        <>
          Rede {area.rede} ·{" "}
          <Link href={`${base}/redes`} className="text-primary hover:underline">
            voltar às redes
          </Link>
        </>
      }
    >
      {area.statusOrcamento === "A_DEFINIR" ? (
        <Aviso tom="aviso" titulo="Orçamento a definir">
          Esta área temática tem PPGs e Coordenadores de Temática cadastrados, mas a rede
          ainda não informou o orçamento. Os valores ficam em branco de propósito
          — preenchê-los com zero distorceria os indicadores do painel.
        </Aviso>
      ) : null}

      {divergente ? (
        <Aviso tom="perigo" titulo="Divergência de saldo">
          O sistema calcula <Moeda valor={area.saldoPotencial} /> de saldo. O
          valor de referência registrado é <Moeda valor={area.saldoInformado} />.
          A diferença é <Moeda valor={area.divergencia} /> e precisa de decisão.
        </Aviso>
      ) : null}

      <Secao titulo={`Resumo do exercício ${area.ano}`}>
        <Cartoes>
          <Cartao titulo="Orçamento de bolsas" valor={moeda(area.valorBolsas)} />
          <Cartao
            titulo="Manutenção e missões"
            valor={moeda(area.apoio)}
            nota="Sem plano de aplicação detalhado"
          />
          <Cartao
            titulo="Custo programado"
            valor={moeda(area.custoBolsas)}
            nota={`${inteiro(area.bolsas)} bolsas por ano`}
          />
          <Cartao
            titulo="Saldo potencial"
            valor={moeda(area.saldoPotencial)}
            destaque
          />
        </Cartoes>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Utilização do orçamento:</span>
          <Utilizacao fracao={area.utilizacao} />
        </div>
      </Secao>

      <Secao
        titulo="Coordenadores de Temática"
        descricao="Docentes responsáveis pelos PPGs participantes desta temática."
      >
        {area.coordenadores.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {area.coordenadores.map((coordenador) => (
              <li
                key={coordenador.ppgId}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {coordenador.nome}
                </span>
                <span className="ml-2 text-xs text-subtle">
                  {coordenador.ppgSigla}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVazio
            titulo="Nenhum coordenador designado"
            descricao="A temática existe no planejamento, mas seus PPGs ainda não têm Coordenador de Temática."
          />
        )}
      </Secao>

      <Secao
        titulo="PPGs participantes"
        descricao="A participação no custo mostra quanto das bolsas da temática vai para cada programa."
      >
        <Tabela
          colunas={[
            { chave: "ppg", texto: "PPG" },
            { chave: "nota", texto: "Nota CAPES", alinhamento: "direita" },
            { chave: "situacao", texto: "Situação" },
            { chave: "modalidades", texto: "Modalidades previstas" },
            { chave: "custo", texto: "Custo anual", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              <Celula direita>—</Celula>
              <Celula>—</Celula>
              <Celula>—</Celula>
              <Celula direita>
                <Moeda valor={area.custoTotal} forte />
              </Celula>
            </tr>
          }
        >
          {area.participacoes.map((p) => (
            <tr key={p.ppgId}>
              <Celula>
                <Link
                  href={`/ppgs/${p.ppgId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {p.sigla}
                </Link>
                <span className="block text-xs text-subtle">{p.ppg}</span>
              </Celula>
              <Celula direita>{p.notaCapes ?? "—"}</Celula>
              <Celula>
                <Selo
                  tom={p.situacao === "CONTEMPLADO" ? "sucesso" : "neutro"}
                >
                  {rotulo(p.situacao)}
                </Selo>
              </Celula>
              <Celula className="max-w-sm text-muted">
                {p.modalidadesPrevistas ?? "—"}
              </Celula>
              <Celula direita>
                <Moeda valor={p.custoAnual} />
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>

      <Secao
        titulo="Plano de aplicação da temática"
        descricao="Linhas nas três rubricas, com o valor unitário já resolvido."
        acoes={
          <Link
            href={`${base}/plano`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Abrir o plano completo →
          </Link>
        }
      >
        {area.plano.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "ppg", texto: "PPG" },
              { chave: "modalidade", texto: "Modalidade" },
              { chave: "destino", texto: "Destino" },
              { chave: "vigencia", texto: "Vigência" },
              { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
              { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
              { chave: "custo", texto: "Custo anual", alinhamento: "direita" },
              { chave: "status", texto: "Status" },
            ]}
          >
            {area.plano.map((linha) => (
              <tr key={linha.id}>
                <Celula>
                  <span className="font-mono text-xs">{linha.codigo}</span>
                </Celula>
                <Celula>{linha.ppgSigla}</Celula>
                <Celula>{linha.modalidade ?? "—"}</Celula>
                <Celula>{rotulo(linha.destino)}</Celula>
                <Celula>{meses(linha.vigenciaMeses)}</Celula>
                <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
                <Celula direita>
                  <Moeda valor={linha.valorUnitario} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.custoAnual} />
                </Celula>
                <Celula>
                  <Selo
                    tom={linha.status === "PROGRAMADO" ? "sucesso" : "aviso"}
                  >
                    {rotulo(linha.status)}
                  </Selo>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhuma linha de planejamento"
            descricao="A temática tem orçamento, mas nada foi programado ainda."
          />
        )}
      </Secao>

      <Secao
        titulo="Projeção plurianual"
        descricao="O teto nominal repete-se nos exercícios, mas cada composição anual é independente."
      >
        <Tabela
          colunas={[
            { chave: "ano", texto: "Exercício" },
            { chave: "orcamento", texto: "Orçamento bolsas", alinhamento: "direita" },
            { chave: "custo", texto: "Custo programado", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo", alinhamento: "direita" },
            { chave: "bolsas", texto: "Bolsas", alinhamento: "direita" },
          ]}
        >
          {area.porAno.map((ano) => (
            <tr key={ano.ano}>
              <Celula>{ano.ano}</Celula>
              <Celula direita>
                <Moeda valor={ano.valorBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.custoBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.saldoPotencial} />
              </Celula>
              <Celula direita>{inteiro(ano.bolsas)}</Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </Pagina>
  );
}
