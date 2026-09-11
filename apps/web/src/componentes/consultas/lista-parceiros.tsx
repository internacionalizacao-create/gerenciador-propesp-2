"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { useDebounce } from "@/componentes/consultas/debounce";
import { buscarNoBff, caminhoBff } from "@/lib/bff";
import type { Parceiro } from "@/lib/dominio";
import { inteiro } from "@/lib/formato";

/** O servico nao pagina; devolve no maximo 200 (CG-049). */
const LIMITE_DO_SERVICO = 200;

export interface FiltrosParceiros {
  busca: string;
  redeId: string;
  incluirInativos: boolean;
}

function chaveDaConsulta(filtros: FiltrosParceiros) {
  return ["parceiros", filtros.busca, filtros.redeId, filtros.incluirInativos] as const;
}

/**
 * CG-049 · Lista de parceiros com busca incremental.
 *
 * Antes era `<form method="get">`: cada ajuste de filtro custava uma navegacao
 * e um round-trip inteiro do servidor. Numa tela cujo proposito e *procurar
 * antes de cadastrar* (a duplicidade que a CG-025 depois tem que desfazer),
 * esse atrito empurra a pessoa a desistir da busca e cadastrar de novo.
 *
 * O que o TanStack Query resolve aqui, e que nao vinha de graca:
 *
 * - `initialData` recebe a lista que o Server Component ja buscou, entao a
 *   primeira pintura continua vindo do servidor, sem estado de carregamento e
 *   sem uma segunda chamada para o mesmo dado.
 * - `keepPreviousData` mantem a tabela anterior visivel enquanto a proxima
 *   chega. Sem isso a lista pisca em branco a cada tecla, e o resultado e
 *   pior do que o formulario que ela substituiu.
 * - o cache por combinacao de filtro faz voltar para uma busca ja feita ser
 *   instantaneo.
 *
 * A URL continua sendo a fonte compartilhavel: `replaceState` a mantem em dia
 * sem disparar navegacao do Next — se ela deixasse de refletir o filtro, quem
 * manda o link da busca para um colega mandaria a lista inteira.
 */
export function ListaParceiros({
  base,
  filtrosIniciais,
  dadosIniciais,
  redes,
}: {
  base: string;
  filtrosIniciais: FiltrosParceiros;
  dadosIniciais: Parceiro[];
  redes: { id: string; nome: string }[];
}) {
  const [filtros, definirFiltros] = useState(filtrosIniciais);
  const buscaAdiada = useDebounce(filtros.busca, 300);

  const consulta = { ...filtros, busca: buscaAdiada };
  const chave = chaveDaConsulta(consulta);
  const ehConsultaInicial =
    JSON.stringify(chave) === JSON.stringify(chaveDaConsulta(filtrosIniciais));

  const { data, isFetching, isError, error } = useQuery({
    queryKey: chave,
    queryFn: () =>
      buscarNoBff<Parceiro[]>(
        caminhoBff("parceiros", {
          busca: consulta.busca || undefined,
          redeId: consulta.redeId || undefined,
          incluirInativos: consulta.incluirInativos ? "true" : undefined,
        }),
      ),
    // So a combinacao que o servidor ja renderizou aproveita o dado inicial.
    initialData: ehConsultaInicial ? dadosIniciais : undefined,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    const parametros = new URLSearchParams();
    if (consulta.busca) parametros.set("busca", consulta.busca);
    if (consulta.redeId) parametros.set("redeId", consulta.redeId);
    if (consulta.incluirInativos) parametros.set("inativos", "true");
    const texto = parametros.toString();
    window.history.replaceState(null, "", texto ? `${base}?${texto}` : base);
  }, [base, consulta.busca, consulta.redeId, consulta.incluirInativos]);

  const parceiros = data ?? [];
  const truncada = parceiros.length === LIMITE_DO_SERVICO;
  const provisorios = parceiros.filter((p) => p.cadastroProvisorio && p.ativo);
  const semRede = parceiros.filter((p) => p.redes.length === 0 && p.ativo);
  const filtrado = Boolean(
    consulta.busca || consulta.redeId || consulta.incluirInativos,
  );

  return (
    <>
      <Cartoes>
        <Cartao titulo="Parceiros listados" valor={inteiro(parceiros.length)} />
        <Cartao
          titulo="Com missão registrada"
          valor={inteiro(parceiros.filter((p) => p.quantidadeMissoes > 0).length)}
        />
        <Cartao
          titulo="Cadastro provisório"
          valor={inteiro(provisorios.length)}
          nota="Vieram de uma missão e ainda não foram conferidos"
        />
        <Cartao
          titulo="Sem rede vinculada"
          valor={inteiro(semRede.length)}
          nota="Não aparecem quando se filtra por rede"
        />
      </Cartoes>

      <div className="mt-8" />

      <Filtros filtros={filtros} definirFiltros={definirFiltros} redes={redes} />

      {isError ? (
        <Aviso tom="perigo" titulo="Não foi possível atualizar a lista">
          {error instanceof Error
            ? error.message
            : "Erro desconhecido ao consultar parceiros."}{" "}
          Os resultados abaixo podem estar desatualizados.
        </Aviso>
      ) : null}

      {truncada ? (
        <Aviso tom="aviso" titulo="Lista possivelmente incompleta">
          A consulta devolve no máximo {LIMITE_DO_SERVICO} parceiros e esse
          limite foi atingido. Refine a busca ou filtre por rede.
        </Aviso>
      ) : null}

      <Secao
        titulo="Lista"
        descricao="Procure pelo nome, sigla, cidade ou domínio antes de cadastrar: o cadastro repetido é o que a conciliação depois precisa desfazer."
      >
        {/* `aria-busy` e `role="status"` avisam quem usa leitor de tela que a
            lista esta sendo trocada. A opacidade sozinha so comunica a quem ve. */}
        <div aria-busy={isFetching}>
          <p role="status" className="sr-only">
            {isFetching
              ? "Atualizando a lista de parceiros"
              : `${parceiros.length} parceiros listados`}
          </p>

          {parceiros.length === 0 ? (
            <EstadoVazio
              titulo={
                filtrado
                  ? "Nenhum parceiro para este filtro"
                  : "Nenhum parceiro cadastrado"
              }
              descricao={
                filtrado
                  ? "Ajuste a busca ou limpe os filtros. Cadastros inativos só aparecem quando você marca a opção."
                  : "Os parceiros aparecem aqui conforme forem cadastrados ou registrados durante uma missão."
              }
            />
          ) : (
            <div
              className={
                isFetching ? "opacity-60 transition-opacity" : "transition-opacity"
              }
            >
              <Tabela
                rotulo="Lista de parceiros"
                colunas={[
                  { chave: "nome", texto: "Instituição" },
                  { chave: "local", texto: "Local" },
                  { chave: "tipo", texto: "Tipo" },
                  { chave: "redes", texto: "Redes" },
                  { chave: "contatos", texto: "Contatos", alinhamento: "direita" },
                  { chave: "missoes", texto: "Missões", alinhamento: "direita" },
                ]}
              >
                {parceiros.map((parceiro) => (
                  <tr key={parceiro.id}>
                    <Celula>
                      <Link
                        href={`${base}/${parceiro.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {parceiro.nome}
                      </Link>
                      <span className="mt-1 block space-x-1">
                        {parceiro.sigla ? (
                          <span className="text-xs text-subtle">
                            {parceiro.sigla}
                          </span>
                        ) : null}
                        {parceiro.cadastroProvisorio ? (
                          <Selo
                            tom="aviso"
                            titulo="Cadastro aberto durante uma missão, ainda sem conferência institucional"
                          >
                            provisório
                          </Selo>
                        ) : null}
                        {parceiro.ativo ? null : (
                          <Selo
                            tom="neutro"
                            titulo={
                              parceiro.substituidaPorId
                                ? "Conciliado em outro cadastro"
                                : "Cadastro inativado"
                            }
                          >
                            {parceiro.substituidaPorId ? "conciliado" : "inativo"}
                          </Selo>
                        )}
                      </span>
                    </Celula>
                    <Celula className="text-muted">
                      {[parceiro.cidade, parceiro.pais]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </Celula>
                    <Celula className="text-muted">
                      {parceiro.tipoOrganizacao ?? "—"}
                    </Celula>
                    <Celula className="text-muted">
                      {parceiro.redes.length > 0
                        ? parceiro.redes.map((rede) => rede.nome).join(", ")
                        : "—"}
                    </Celula>
                    <Celula direita>
                      {inteiro(parceiro.quantidadeContatos)}
                    </Celula>
                    <Celula direita>{inteiro(parceiro.quantidadeMissoes)}</Celula>
                  </tr>
                ))}
              </Tabela>
            </div>
          )}
        </div>
      </Secao>
    </>
  );
}

function Filtros({
  filtros,
  definirFiltros,
  redes,
}: {
  filtros: FiltrosParceiros;
  definirFiltros: React.Dispatch<React.SetStateAction<FiltrosParceiros>>;
  redes: { id: string; nome: string }[];
}) {
  return (
    // Continua sendo `<form>` pelo agrupamento semantico, mas sem submit: o
    // `onSubmit` so evita que Enter recarregue a pagina, ja que o resultado
    // acompanha a digitacao.
    <form
      onSubmit={(evento) => evento.preventDefault()}
      className="mb-8 flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface px-4 py-4"
    >
      <label className="flex min-w-56 flex-1 flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Busca</span>
        <input
          type="search"
          value={filtros.busca}
          onChange={(evento) =>
            definirFiltros((atual) => ({ ...atual, busca: evento.target.value }))
          }
          placeholder="Nome, sigla, cidade ou domínio"
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground"
        />
      </label>

      <label className="flex min-w-48 flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Rede</span>
        <select
          value={filtros.redeId}
          onChange={(evento) =>
            definirFiltros((atual) => ({ ...atual, redeId: evento.target.value }))
          }
          className="rounded-lg border border-border-strong bg-surface px-3 py-2 text-sm text-foreground"
        >
          <option value="">Todas as redes</option>
          {redes.map((rede) => (
            <option key={rede.id} value={rede.id}>
              {rede.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 pb-2.5 text-sm text-foreground">
        <input
          type="checkbox"
          checked={filtros.incluirInativos}
          onChange={(evento) =>
            definirFiltros((atual) => ({
              ...atual,
              incluirInativos: evento.target.checked,
            }))
          }
          className="size-4 rounded border-border-strong accent-[var(--primary)]"
        />
        Incluir inativos e conciliados
      </label>
    </form>
  );
}

/** Adia o valor para nao consultar a cada tecla digitada. */
