import type { Metadata } from "next";
import Link from "next/link";

import { CadastroPpg } from "@/componentes/formularios/cadastro-ppg";
import {
  Cartao,
  Cartoes,
  Celula,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { LinhaPpg } from "@/lib/dominio";
import { inteiro, rotulo, somarMoeda } from "@/lib/formato";

export const metadata: Metadata = {
  title: "PPGs — Gerenciador PROPESP",
};

/**
 * P14 · Programas de Pós-Graduação.
 *
 * As colunas de bolsas e custo são calculadas: a pergunta que a equipe faz
 * olhando um PPG nunca é "quais os dados dele", e sim "quanto ele recebe".
 */
export default async function Ppgs() {
  const ppgs = await apiFetch<LinhaPpg[]>("/ppgs");

  const semBolsa = ppgs.filter((p) => p.bolsasAno === 0);
  const emRede = ppgs.filter((p) => p.emRede);

  return (
    <Pagina
      titulo="Programas de Pós-Graduação"
      descricao="Todos os PPGs da UEA mapeados no sistema, com o que cada um recebe por ano."
      acoes={<CadastroPpg />}
    >
      <Cartoes>
        <Cartao titulo="PPGs mapeados" valor={inteiro(ppgs.length)} />
        <Cartao
          titulo="Bolsas por ano"
          valor={inteiro(ppgs.reduce((t, p) => t + p.bolsasAno, 0))}
        />
        <Cartao
          titulo="Custo anual"
          valor={<Moeda valor={somarMoeda(ppgs.map((p) => p.custoAno))} />}
        />
        <Cartao
          titulo="Sem bolsa programada"
          valor={inteiro(semBolsa.length)}
          nota="Mapeados, mas ainda fora do plano"
        />
      </Cartoes>

      <div className="mt-10" />

      <Secao
        titulo="Lista"
        descricao={
          <>
            {inteiro(emRede.length)} programas participam de rede nacional
            (BIONORTE, REAMEC, PROFMAT…), o que significa que o recurso pode ser
            compartilhado com outras instituições.
          </>
        }
      >
        <Tabela
          colunas={[
            { chave: "sigla", texto: "PPG" },
            { chave: "nivel", texto: "Nível" },
            { chave: "nota", texto: "Nota", alinhamento: "direita" },
            { chave: "situacao", texto: "Situação" },
            { chave: "redes", texto: "Redes" },
            { chave: "tematicas", texto: "Áreas temáticas" },
            { chave: "bolsas", texto: "Bolsas/ano", alinhamento: "direita" },
            { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              <Celula>—</Celula>
              <Celula direita>—</Celula>
              <Celula>—</Celula>
              <Celula>—</Celula>
              <Celula>—</Celula>
              <Celula direita>
                {inteiro(ppgs.reduce((t, p) => t + p.bolsasAno, 0))}
              </Celula>
              <Celula direita>
                <Moeda valor={somarMoeda(ppgs.map((p) => p.custoAno))} forte />
              </Celula>
            </tr>
          }
        >
          {ppgs.map((ppg) => (
            <tr key={ppg.id}>
              <Celula>
                <Link
                  href={`/ppgs/${ppg.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ppg.sigla}
                </Link>
                <span className="block max-w-xs text-xs text-subtle">
                  {ppg.nome}
                </span>
              </Celula>
              <Celula className="text-muted">{rotulo(ppg.nivel)}</Celula>
              <Celula direita>{ppg.notaCapes ?? "—"}</Celula>
              <Celula>
                <Selo tom={ppg.situacao === "ATIVO" ? "sucesso" : "neutro"}>
                  {rotulo(ppg.situacao)}
                </Selo>
              </Celula>
              <Celula className="text-muted">
                {ppg.redes.length > 0 ? ppg.redes.join(", ") : "—"}
                {ppg.emRede ? (
                  <span className="mt-1 block">
                    <Selo
                      tom="info"
                      titulo="Programa de rede nacional — o recurso pode ser compartilhado"
                    >
                      {ppg.redeAcademica ?? "rede nacional"}
                    </Selo>
                  </span>
                ) : null}
              </Celula>
              <Celula className="text-muted">
                {ppg.tematicas.length > 0 ? ppg.tematicas.join(", ") : "—"}
              </Celula>
              <Celula direita>
                {ppg.bolsasAno > 0 ? (
                  inteiro(ppg.bolsasAno)
                ) : (
                  <span
                    className="text-subtle"
                    title="Nenhuma linha de planejamento programada para este PPG"
                  >
                    0
                  </span>
                )}
              </Celula>
              <Celula direita>
                <Moeda valor={ppg.custoAno} />
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </Pagina>
  );
}
