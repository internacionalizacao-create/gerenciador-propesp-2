import type { Metadata } from "next";

import {
  NovaPendencia,
  ResolverPendencia,
} from "@/componentes/formularios/form-pendencia";
import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type { Ciclo, Pendencia } from "@/lib/dominio";
import { inteiro, rotulo } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Pendências — Gerenciador PROPESP",
};

interface Resposta {
  ciclo: Ciclo;
  pendencias: Pendencia[];
}

/**
 * P13 · Pendências e decisões.
 *
 * Na planilha eram comentários sem dono e sem prazo — e o próprio painel dela
 * anunciava 10 quando a aba tinha 14. Aqui são itens com status, responsável e
 * resolução obrigatória, e o contador é sempre a contagem real.
 */
export default async function Pendencias() {
  const padrao = await apiFetch<{
    ciclo: { programaSlug: string; cicloNome: string };
  } | null>("/programas/padrao/painel");

  if (!padrao) {
    return (
      <Pagina titulo="Pendências">
        <EstadoVazio
          titulo="Nenhum ciclo cadastrado"
          descricao="As pendências pertencem a um ciclo de planejamento."
        />
      </Pagina>
    );
  }

  const programa = padrao.ciclo.programaSlug;
  const cicloNome = padrao.ciclo.cicloNome;

  const { pendencias } = await apiFetch<Resposta>(
    `/programas/${programa}/${cicloNome}/pendencias`,
  );

  const abertas = pendencias.filter((p) => p.status !== "RESOLVIDA");
  const resolvidas = pendencias.filter((p) => p.status === "RESOLVIDA");
  const automaticas = pendencias.filter((p) => p.origem === "AUTOMATICA");
  const alta = abertas.filter((p) => p.nivelImpacto === "ALTA");

  return (
    <Pagina
      titulo="Pendências e decisões"
      descricao="A lista de trabalho da equipe. Cada item tem escopo, responsável e status."
      acoes={<NovaPendencia programa={programa} ciclo={cicloNome} />}
    >
      <Cartoes>
        <Cartao titulo="Em aberto" valor={inteiro(abertas.length)} />
        <Cartao titulo="Impacto alto" valor={inteiro(alta.length)} destaque />
        <Cartao
          titulo="Detectadas pelo sistema"
          valor={inteiro(automaticas.length)}
          nota="Não podem ser excluídas, só resolvidas"
        />
        <Cartao titulo="Resolvidas" valor={inteiro(resolvidas.length)} />
      </Cartoes>

      <div className="mt-6" />

      <Aviso tom="info" titulo="Por que a contagem importa">
        A planilha de origem trazia 14 itens e o painel dela anunciava 10 — o
        número era digitado à mão e envelheceu. Aqui o contador é a contagem, e
        não há como divergir.
      </Aviso>

      <Secao titulo="Em aberto">
        {abertas.length > 0 ? (
          <TabelaDePendencias linhas={abertas} />
        ) : (
          <EstadoVazio
            titulo="Nada em aberto"
            descricao="Todas as pendências do ciclo foram resolvidas."
          />
        )}
      </Secao>

      {resolvidas.length > 0 ? (
        <Secao
          titulo="Resolvidas"
          descricao="Ficam registradas com o texto da resolução — é o histórico de decisão do ciclo."
        >
          <TabelaDePendencias linhas={resolvidas} />
        </Secao>
      ) : null}
    </Pagina>
  );
}

function TabelaDePendencias({ linhas }: { linhas: Pendencia[] }) {
  return (
    <Tabela
      colunas={[
        { chave: "codigo", texto: "Código" },
        { chave: "escopo", texto: "Escopo" },
        { chave: "assunto", texto: "Assunto" },
        { chave: "descricao", texto: "Pendência ou decisão" },
        { chave: "nivel", texto: "Impacto" },
        { chave: "responsavel", texto: "Responsável" },
        { chave: "prazo", texto: "Prazo" },
        { chave: "status", texto: "Status" },
        { chave: "acoes", texto: "" },
      ]}
    >
      {linhas.map((p) => (
        <tr key={p.id}>
          <Celula>
            <span className="font-mono text-xs">{p.codigo}</span>
            {p.origem === "AUTOMATICA" ? (
              <span className="mt-1 block">
                <Selo tom="info" titulo="Detectada pelo sistema">
                  auto
                </Selo>
              </span>
            ) : null}
          </Celula>
          <Celula className="text-muted">
            {p.escopoDescricao ?? rotulo(p.escopoTipo)}
          </Celula>
          <Celula className="max-w-[14rem]">
            <span className="font-medium text-foreground">{p.assunto}</span>
          </Celula>
          <Celula className="max-w-sm text-muted">
            {p.descricao}
            {p.resolucao ? (
              <span className="mt-1 block text-xs text-on-success-soft">
                Resolução: {p.resolucao}
              </span>
            ) : null}
          </Celula>
          <Celula>
            {p.nivelImpacto ? (
              <Selo
                tom={
                  p.nivelImpacto === "ALTA"
                    ? "perigo"
                    : p.nivelImpacto === "MEDIA"
                      ? "aviso"
                      : "neutro"
                }
              >
                {rotulo(p.nivelImpacto)}
              </Selo>
            ) : (
              <span className="text-subtle">—</span>
            )}
          </Celula>
          <Celula className="text-muted">{p.responsavelSugerido ?? "—"}</Celula>
          <Celula className="text-muted">{p.prazoMomento ?? "—"}</Celula>
          <Celula>
            <Selo tom={p.status === "RESOLVIDA" ? "sucesso" : "aviso"}>
              {rotulo(p.status)}
            </Selo>
          </Celula>
          <Celula>
            <ResolverPendencia pendencia={p} />
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}
