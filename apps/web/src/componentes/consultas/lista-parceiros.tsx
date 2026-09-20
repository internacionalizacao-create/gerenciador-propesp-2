"use client";

import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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
import type { PaginaParceiros } from "@/lib/dominio";
import { normalizarPaginaParceiros } from "@/lib/paginacao-parceiros";
import { inteiro } from "@/lib/formato";

export interface FiltrosParceiros {
  busca: string;
  redeId: string;
  incluirInativos: boolean;
  /** Faz parte do filtro: quem manda o link manda a página que estava vendo. */
  pagina: number;
}

function chaveDaConsulta(filtros: FiltrosParceiros) {
  return [
    "parceiros",
    filtros.busca,
    filtros.redeId,
    filtros.incluirInativos,
    filtros.pagina,
  ] as const;
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
 *   primeira pintura continua vindo do servidor, sem estado de carregamento.
 * - `keepPreviousData` mantem a tabela anterior visivel enquanto a proxima
 *   chega. Sem isso a lista pisca em branco a cada tecla, e o resultado e
 *   pior do que o formulario que ela substituiu.
 * - o cache por combinacao de filtro faz voltar para uma busca ja feita ser
 *   instantaneo.
 *
 * A URL continua sendo a fonte compartilhavel: `pushState` a mantem em dia
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
  dadosIniciais: PaginaParceiros;
  redes: { id: string; nome: string }[];
}) {
  const [filtros, definirFiltros] = useState(filtrosIniciais);
  const buscaAdiada = useDebounce(filtros.busca, 300);

  // Voltar/avancar restaura os controles junto da URL, inclusive a pagina.
  useEffect(() => {
    const restaurar = () => {
      const parametros = new URLSearchParams(window.location.search);
      definirFiltros({
        busca: parametros.get("busca") ?? "",
        redeId: parametros.get("redeId") ?? "",
        incluirInativos: parametros.get("inativos") === "true",
        pagina: normalizarPaginaParceiros(parametros.get("pagina")),
      });
    };
    window.addEventListener("popstate", restaurar);
    return () => window.removeEventListener("popstate", restaurar);
  }, []);

  const consulta = { ...filtros, busca: buscaAdiada };
  const chave = chaveDaConsulta(consulta);
  const ehConsultaInicial =
    JSON.stringify(chave) === JSON.stringify(chaveDaConsulta(filtrosIniciais));

  /**
   * `initialData` só vale na criação da consulta: quando um cadastro revalida
   * a página, o servidor manda a lista nova e o cache continuaria mostrando a
   * velha. Sem isto o parceiro gravava e não aparecia — lia-se "não salvou".
   */
  const clienteDeConsultas = useQueryClient();
  const primeiraPintura = useRef(true);
  useEffect(() => {
    if (primeiraPintura.current) {
      primeiraPintura.current = false;
      return;
    }
    clienteDeConsultas.setQueryData(
      chaveDaConsulta(filtrosIniciais),
      dadosIniciais,
    );
    void clienteDeConsultas.invalidateQueries({ queryKey: ["parceiros"] });
  }, [clienteDeConsultas, dadosIniciais, filtrosIniciais]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: chave,
    queryFn: () =>
      buscarNoBff<PaginaParceiros>(
        caminhoBff("parceiros", {
          busca: consulta.busca || undefined,
          redeId: consulta.redeId || undefined,
          incluirInativos: consulta.incluirInativos ? "true" : undefined,
          pagina: String(consulta.pagina),
        }),
      ),
    // So a combinacao que o servidor ja renderizou aproveita o dado inicial.
    initialData: ehConsultaInicial ? dadosIniciais : undefined,
    placeholderData: keepPreviousData,
    // O historico do navegador pode restaurar o snapshot anterior da pagina
    // depois de uma Server Action. Conferir ao remontar evita servir esse
    // snapshot durante os 30 segundos de staleTime do provedor.
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (buscaAdiada !== filtros.busca) return;
    const parametros = new URLSearchParams();
    if (consulta.busca) parametros.set("busca", consulta.busca);
    if (consulta.redeId) parametros.set("redeId", consulta.redeId);
    if (consulta.incluirInativos) parametros.set("inativos", "true");
    if (consulta.pagina > 1) parametros.set("pagina", String(consulta.pagina));
    const texto = parametros.toString();
    const destino = texto ? `${base}?${texto}` : base;
    if (`${window.location.pathname}${window.location.search}` !== destino) {
      window.history.pushState(null, "", destino);
    }
  }, [
    base,
    buscaAdiada,
    filtros.busca,
    consulta.busca,
    consulta.redeId,
    consulta.incluirInativos,
    consulta.pagina,
  ]);

  const pagina = data ?? dadosIniciais;
  const parceiros = pagina.itens;
  const filtrado = Boolean(
    consulta.busca || consulta.redeId || consulta.incluirInativos,
  );

  return (
    <>
      {/*
        Os cartões vêm do `resumo` da API, apurado sobre o filtro inteiro — e
        não sobre as linhas desta página. Contar a página e rotular "cadastro
        provisório" daria um número que muda ao virar de página, e a pergunta
        que o cartão responde é sobre o conjunto.
      */}
      <Cartoes>
        <Cartao
          titulo="Parceiros encontrados"
          valor={inteiro(pagina.resumo.total)}
        />
        <Cartao
          titulo="Com missão registrada"
          valor={inteiro(pagina.resumo.comMissao)}
        />
        <Cartao
          titulo="Cadastro provisório"
          valor={inteiro(pagina.resumo.provisorios)}
          nota="Vieram de uma missão e ainda não foram conferidos"
        />
        <Cartao
          titulo="Sem rede vinculada"
          valor={inteiro(pagina.resumo.semRede)}
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
              : `${pagina.resumo.total} parceiros encontrados, página ${pagina.pagina} de ${pagina.paginas}`}
          </p>

          {parceiros.length === 0 && pagina.total > 0 ? (
            <Aviso tom="aviso" titulo="Esta página não tem mais parceiros">
              <p>Há {inteiro(pagina.total)} parceiros para este filtro.</p>
              <button type="button" className="mt-2 underline" disabled={isFetching}
                onClick={() => definirFiltros((atual) => ({ ...atual, pagina: pagina.paginas }))}>
                Ir para a última página disponível
              </button>
            </Aviso>
          ) : parceiros.length === 0 ? (
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

              <Paginacao
                pagina={pagina}
                ocupada={isFetching}
                irPara={(numero) =>
                  definirFiltros((atual) => ({ ...atual, pagina: numero }))
                }
              />
            </div>
          )}
        </div>
      </Secao>
    </>
  );
}

/**
 * Navegação entre páginas.
 *
 * **Não some quando há uma página só** — some o controle, não o texto: dizer
 * "1–12 de 12" é o que confirma que a lista está inteira. Sem essa linha, uma
 * lista cortada e uma lista completa têm a mesma aparência, que era exatamente
 * o problema do limite silencioso de 200.
 */
function Paginacao({
  pagina,
  ocupada,
  irPara,
}: {
  pagina: PaginaParceiros;
  ocupada: boolean;
  irPara: (numero: number) => void;
}) {
  const primeiro = pagina.total === 0 ? 0 : (pagina.pagina - 1) * pagina.tamanho + 1;
  const ultimo = Math.min(pagina.pagina * pagina.tamanho, pagina.total);

  return (
    <nav
      aria-label="Paginação dos parceiros"
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm"
    >
      <p className="text-muted">
        {inteiro(primeiro)}–{inteiro(ultimo)} de {inteiro(pagina.total)}
      </p>
      {pagina.paginas > 1 ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={ocupada || pagina.pagina <= 1}
            onClick={() => irPara(pagina.pagina - 1)}
            className="rounded-lg border border-border-strong px-3 py-1.5 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            Anterior
          </button>
          <span className="text-muted">
            Página {inteiro(pagina.pagina)} de {inteiro(pagina.paginas)}
          </span>
          <button
            type="button"
            disabled={ocupada || pagina.pagina >= pagina.paginas}
            onClick={() => irPara(pagina.pagina + 1)}
            className="rounded-lg border border-border-strong px-3 py-1.5 font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      ) : null}
    </nav>
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
            definirFiltros((atual) => ({ ...atual, pagina: 1, busca: evento.target.value }))
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
            definirFiltros((atual) => ({ ...atual, pagina: 1, redeId: evento.target.value }))
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
              pagina: 1,
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
