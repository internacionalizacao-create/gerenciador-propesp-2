"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";

import {
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import type { LinhaPpg } from "@/lib/dominio";
import { inteiro, rotulo, somarMoeda } from "@/lib/formato";

type FiltrosPpg = { busca: string; nivel: string; situacao: string };

/**
 * Filtros locais dos PPGs.
 *
 * `/ppgs` ainda não aceita parâmetros de consulta; repetir a mesma lista via
 * BFF para cada tecla seria desperdício. A página entrega a lista autorizada
 * no servidor e este componente apenas a recorta, mantendo a URL compartilhável.
 */
export function ListaPpgs({
  ppgs,
  filtrosIniciais,
}: {
  ppgs: LinhaPpg[];
  filtrosIniciais: FiltrosPpg;
}) {
  const [filtros, definirFiltros] = useState(filtrosIniciais);
  const buscaAdiada = useDeferredValue(filtros.busca);
  const filtrados = useMemo(() => {
    const termo = buscaAdiada.trim().toLocaleLowerCase("pt-BR");
    return ppgs.filter((ppg) => {
      if (filtros.nivel && ppg.nivel !== filtros.nivel) return false;
      if (filtros.situacao && ppg.situacao !== filtros.situacao) return false;
      if (!termo) return true;
      return [ppg.nome, ppg.sigla, ppg.unidade, ppg.areaCapes, ppg.redeAcademica]
        .filter((valor): valor is string => Boolean(valor))
        .some((valor) => valor.toLocaleLowerCase("pt-BR").includes(termo));
    });
  }, [buscaAdiada, filtros.nivel, filtros.situacao, ppgs]);

  function atualizar(proximos: FiltrosPpg) {
    definirFiltros(proximos);
    const parametros = new URLSearchParams();
    if (proximos.busca.trim()) parametros.set("q", proximos.busca.trim());
    if (proximos.nivel) parametros.set("nivel", proximos.nivel);
    if (proximos.situacao) parametros.set("situacao", proximos.situacao);
    const texto = parametros.toString();
    window.history.replaceState(null, "", texto ? `/ppgs?${texto}` : "/ppgs");
  }

  const semBolsa = filtrados.filter((ppg) => ppg.bolsasAno === 0);
  // Todas as linhas trazem o mesmo valor: e o alcance de `plano:read` da conta.
  const recortado = ppgs.some((ppg) => ppg.planoRecortado);
  const notaDoAlcance = recortado ? "Só o planejamento no seu alcance" : undefined;
  const emRede = filtrados.filter((ppg) => ppg.emRede);
  const filtrado = Boolean(filtros.busca || filtros.nivel || filtros.situacao);

  return (
    <>
      <Cartoes>
        <Cartao titulo="PPGs listados" valor={inteiro(filtrados.length)} />
        <Cartao titulo="Bolsas por ano" valor={<TotalBolsas ppgs={filtrados} />} nota={notaDoAlcance} />
        <Cartao titulo="Custo anual" valor={<TotalCusto ppgs={filtrados} />} nota={notaDoAlcance} />
        <Cartao titulo="Sem bolsa programada" valor={inteiro(semBolsa.length)} nota="No recorte atual" />
      </Cartoes>

      <div className="mt-8" />
      <Filtros filtros={filtros} atualizar={atualizar} />

      <Secao
        titulo="Lista"
        descricao={`${inteiro(emRede.length)} programas no recorte participam de rede nacional. A busca não consulta novamente a API: filtra apenas os PPGs já autorizados e entregues pelo servidor.${recortado ? " Bolsas e custo somam só o planejamento que você pode consultar; onde não há nenhum, aparece “Sem acesso”." : ""}`}
      >
        <div aria-busy={buscaAdiada !== filtros.busca}>
          <p role="status" className="sr-only">
            {buscaAdiada !== filtros.busca ? "Atualizando a lista de PPGs" : `${filtrados.length} PPGs listados`}
          </p>
          {filtrados.length === 0 ? (
            <EstadoVazio
              titulo={filtrado ? "Nenhum PPG para este filtro" : "Nenhum PPG cadastrado"}
              descricao={filtrado ? "Ajuste ou limpe os filtros para ver os programas disponíveis." : "Os PPGs cadastrados aparecerão aqui."}
              acao={
                filtrado ? (
                  <button type="button" onClick={() => atualizar({ busca: "", nivel: "", situacao: "" })} className="rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted">Limpar filtros</button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="hidden md:block">
                <Tabela
                  rotulo="Lista de Programas de Pós-Graduação"
                  colunas={[
                    { chave: "sigla", texto: "PPG" }, { chave: "nivel", texto: "Nível" }, { chave: "nota", texto: "Nota", alinhamento: "direita" }, { chave: "situacao", texto: "Situação" }, { chave: "redes", texto: "Redes" }, { chave: "tematicas", texto: "Áreas temáticas" }, { chave: "bolsas", texto: "Bolsas/ano", alinhamento: "direita" }, { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
                  ]}
                  rodape={<Rodape ppgs={filtrados} />}
                >
                  {filtrados.map((ppg) => <Linha key={ppg.id} ppg={ppg} />)}
                </Tabela>
              </div>
              <ul className="grid gap-3 md:hidden">
                {filtrados.map((ppg) => <CartaoPpg key={ppg.id} ppg={ppg} />)}
              </ul>
            </>
          )}
        </div>
      </Secao>
    </>
  );
}

function Filtros({ filtros, atualizar }: { filtros: FiltrosPpg; atualizar: (filtros: FiltrosPpg) => void }) {
  return <form onSubmit={(evento) => evento.preventDefault()} className="mb-8 grid gap-3 rounded-2xl border border-border bg-surface p-4 sm:grid-cols-3"><label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-foreground">Buscar</span><input type="search" value={filtros.busca} onChange={(evento) => atualizar({ ...filtros, busca: evento.currentTarget.value })} placeholder="Nome, sigla, unidade…" className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground placeholder:text-subtle" /></label><label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-foreground">Nível</span><select value={filtros.nivel} onChange={(evento) => atualizar({ ...filtros, nivel: evento.currentTarget.value })} className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground"><option value="">Todos</option><option value="MESTRADO">Mestrado</option><option value="DOUTORADO">Doutorado</option><option value="MESTRADO_DOUTORADO">Mestrado e doutorado</option><option value="MESTRADO_PROFISSIONAL">Mestrado profissional</option></select></label><label className="flex flex-col gap-1.5"><span className="text-sm font-medium text-foreground">Situação</span><select value={filtros.situacao} onChange={(evento) => atualizar({ ...filtros, situacao: evento.currentTarget.value })} className="rounded-xl border border-border-strong bg-surface px-3 py-2.5 text-sm text-foreground"><option value="">Todas</option><option value="ATIVO">Ativo</option><option value="EM_IMPLANTACAO">Em implantação</option><option value="INATIVO">Inativo</option></select></label></form>;
}

function Linha({ ppg }: { ppg: LinhaPpg }) { return <tr><Celula><Link href={`/ppgs/${ppg.id}`} className="font-medium text-primary hover:underline">{ppg.sigla}</Link><span className="block max-w-xs text-xs text-subtle">{ppg.nome}</span></Celula><Celula className="text-muted">{rotulo(ppg.nivel)}</Celula><Celula direita>{ppg.notaCapes ?? "—"}</Celula><Celula><Selo tom={ppg.situacao === "ATIVO" ? "sucesso" : "neutro"}>{rotulo(ppg.situacao)}</Selo></Celula><Celula className="text-muted">{ppg.redes.length > 0 ? ppg.redes.join(", ") : "—"}{ppg.emRede ? <span className="mt-1 block"><Selo tom="info">{ppg.redeAcademica ?? "rede nacional"}</Selo></span> : null}</Celula><Celula className="text-muted">{ppg.tematicas.length > 0 ? ppg.tematicas.join(", ") : "—"}</Celula><Celula direita><Bolsas valor={ppg.bolsasAno} /></Celula><Celula direita><Custo valor={ppg.custoAno} /></Celula></tr>; }
function Rodape({ ppgs }: { ppgs: LinhaPpg[] }) { return <tr><Celula>Total</Celula><Celula>—</Celula><Celula direita>—</Celula><Celula>—</Celula><Celula>—</Celula><Celula>—</Celula><Celula direita><TotalBolsas ppgs={ppgs} /></Celula><Celula direita><TotalCusto ppgs={ppgs} forte /></Celula></tr>; }
function CartaoPpg({ ppg }: { ppg: LinhaPpg }) { return <li className="rounded-2xl border border-border bg-surface p-4"><div className="flex items-start justify-between gap-3"><div><Link href={`/ppgs/${ppg.id}`} className="font-semibold text-primary hover:underline">{ppg.sigla}</Link><p className="mt-1 text-sm text-muted">{ppg.nome}</p></div><Selo tom={ppg.situacao === "ATIVO" ? "sucesso" : "neutro"}>{rotulo(ppg.situacao)}</Selo></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><Dado rotulo="Nível" valor={rotulo(ppg.nivel)} /><Dado rotulo="Nota CAPES" valor={ppg.notaCapes ?? "—"} /><Dado rotulo="Bolsas/ano" valor={<Bolsas valor={ppg.bolsasAno} />} /><Dado rotulo="Custo/ano" valor={<Custo valor={ppg.custoAno} />} /></dl>{ppg.redes.length > 0 ? <p className="mt-3 text-xs text-muted">Redes: {ppg.redes.join(", ")}</p> : null}</li>; }
function Dado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) { return <div><dt className="text-xs text-subtle">{rotulo}</dt><dd className="mt-0.5 text-foreground">{valor}</dd></div>; }

/**
 * Nulo aqui é falta de alcance, não valor a definir: a API devolve nulo quando
 * nenhum planejamento do PPG está no alcance da conta. Por isso não passa por
 * `Moeda`, que escreveria “A definir”.
 */
function SemAcesso() { return <span className="italic text-subtle" title="Fora do seu alcance de planejamento">Sem acesso</span>; }
function Bolsas({ valor }: { valor: number | null }) { return valor === null ? <SemAcesso /> : <>{inteiro(valor)}</>; }
function Custo({ valor, forte }: { valor: string | null; forte?: boolean }) { return valor === null ? <SemAcesso /> : <Moeda valor={valor} forte={forte} />; }
/** Soma só as linhas alcançadas; se nenhuma for, o total também é “Sem acesso”. */
function TotalBolsas({ ppgs }: { ppgs: LinhaPpg[] }) { const alcancados = ppgs.filter((ppg) => ppg.bolsasAno !== null); return alcancados.length === 0 ? <SemAcesso /> : <>{inteiro(alcancados.reduce((total, ppg) => total + (ppg.bolsasAno ?? 0), 0))}</>; }
function TotalCusto({ ppgs, forte }: { ppgs: LinhaPpg[]; forte?: boolean }) { const alcancados = ppgs.filter((ppg) => ppg.custoAno !== null); return alcancados.length === 0 ? <SemAcesso /> : <Moeda valor={somarMoeda(alcancados.map((ppg) => ppg.custoAno))} forte={forte} />; }
