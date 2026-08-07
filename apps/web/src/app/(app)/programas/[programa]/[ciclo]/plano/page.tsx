import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { AcoesLinhaPlano } from "@/componentes/formularios/acoes-linha-plano";
import { NovaLinhaDePlano } from "@/componentes/formularios/nova-linha-plano";
import { apiFetch } from "@/lib/api";
import type {
  Ciclo,
  CoordenadorTematica,
  ItemCatalogo,
  LinhaPlano,
  LinhaPpg,
  LinhaRede,
  LinhaTematica,
  Me,
  TabelaVigente,
} from "@/lib/dominio";
import { inteiro, meses, somarMoeda } from "@/lib/formato";

interface RespostaPlano {
  ciclo: Ciclo;
  linhas: LinhaPlano[];
}

interface RespostaRedes {
  ano: number;
  redes: (LinhaRede & {
    areas: (LinhaTematica & { coordenadores: CoordenadorTematica[] })[];
  })[];
}

interface ContextoDaLinha {
  programa: string;
  ciclo: string;
  cicloStatus: Ciclo["status"];
  ppgs: LinhaPpg[];
  areas: {
    id: string;
    codigo: string;
    nome: string;
    rede: string;
    ppgIds: string[];
  }[];
  catalogo: ItemCatalogo[];
  podeEditar: boolean;
}

const IDENTIDADES_REDE = [
  {
    borda: "border-l-network-1",
    fundo: "bg-network-1-soft",
    marcador: "bg-network-1 text-on-network-1",
    texto: "text-on-network-1-soft",
    atalho:
      "border-network-1/30 bg-network-1-soft text-on-network-1-soft hover:border-network-1",
  },
  {
    borda: "border-l-network-2",
    fundo: "bg-network-2-soft",
    marcador: "bg-network-2 text-on-network-2",
    texto: "text-on-network-2-soft",
    atalho:
      "border-network-2/30 bg-network-2-soft text-on-network-2-soft hover:border-network-2",
  },
  {
    borda: "border-l-network-3",
    fundo: "bg-network-3-soft",
    marcador: "bg-network-3 text-on-network-3",
    texto: "text-on-network-3-soft",
    atalho:
      "border-network-3/30 bg-network-3-soft text-on-network-3-soft hover:border-network-3",
  },
] as const;

type IdentidadeRede = (typeof IDENTIDADES_REDE)[number];

function identidadeDaRede(nome: string, indice: number): IdentidadeRede {
  const posicaoConhecida = ["UNESP", "UFMG", "UNICAMP"].findIndex((sigla) =>
    nome.toLocaleUpperCase("pt-BR").includes(sigla),
  );

  return IDENTIDADES_REDE[
    (posicaoConhecida >= 0 ? posicaoConhecida : indice) % IDENTIDADES_REDE.length
  ];
}

/**
 * P10 · Plano de aplicacao, organizado pela hierarquia operacional real:
 * programa -> rede -> tematica -> PPG. O resumo institucional permanece no
 * topo e cada rede repete os quatro indicadores para quem mantem seus dados.
 */
export default async function PlanoDeAplicacao({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo: cicloNome } = await params;
  const base = `/programas/${programa}/${cicloNome}`;

  const [plano, ppgs, catalogo, redes, me] = await Promise.all([
    apiFetch<RespostaPlano>(`${base}/plano`),
    apiFetch<LinhaPpg[]>("/ppgs"),
    apiFetch<TabelaVigente>(`/catalogo/bolsas?programa=${programa}`),
    apiFetch<RespostaRedes>(`${base}/redes`),
    apiFetch<Me>("/me"),
  ]);

  const areas = redes.redes.flatMap((rede) =>
    rede.areas.map((area) => ({
      id: area.areaTematicaId,
      codigo: area.codigo,
      nome: area.nome,
      rede: rede.rede,
      ppgIds: area.coordenadores.map((coordenador) => coordenador.ppgId),
    })),
  );
  const linhasAtivas = plano.linhas.filter((linha) => linha.status !== "CANCELADO");
  const contexto: ContextoDaLinha = {
    programa,
    ciclo: cicloNome,
    cicloStatus: plano.ciclo.status,
    ppgs,
    areas,
    catalogo: catalogo.itens,
    podeEditar: me.permissions.includes("plano:edit"),
  };
  const podeCriar =
    me.permissions.includes("plano:write") &&
    plano.ciclo.status !== "ENCERRADO";

  return (
    <Pagina
      titulo="Plano de aplicação"
      descricao="Planejamento por rede, temática e PPG. Destino Brasil representa quem vem do exterior para o Brasil (IN); destino Exterior representa quem sai do Brasil (OUT)."
      acoes={podeCriar ? (
        <NovaLinhaDePlano
          programa={programa}
          ciclo={cicloNome}
          cicloStatus={plano.ciclo.status}
          ppgs={ppgs}
          areas={areas}
          catalogo={catalogo.itens}
        />
      ) : undefined}
    >
      <Resumo linhas={linhasAtivas} />

      <nav
        aria-label="Navegação entre redes"
        className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3"
      >
        <span className="mr-1 text-xs font-semibold uppercase tracking-[0.1em] text-subtle">
          Ir para a rede
        </span>
        {redes.redes.map((rede, indice) => {
          const identidade = identidadeDaRede(rede.rede, indice);

          return (
            <a
              key={rede.redeId}
              href={`#rede-${rede.redeId}`}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-[border-color,transform] hover:-translate-y-0.5 ${identidade.atalho}`}
            >
              {String(indice + 1).padStart(2, "0")} · {rede.rede}
            </a>
          );
        })}
      </nav>

      <div className="mt-8 space-y-10">
        {redes.redes.map((rede, indice) => {
          const linhasDaRede = linhasAtivas.filter(
            (linha) => linha.redeId === rede.redeId,
          );
          const identidade = identidadeDaRede(rede.rede, indice);

          return (
            <section
              key={rede.redeId}
              id={`rede-${rede.redeId}`}
              aria-labelledby={`titulo-rede-${rede.redeId}`}
              className={`scroll-mt-24 overflow-hidden rounded-[1.75rem] border border-l-4 border-border bg-surface shadow-[0_20px_45px_-38px_var(--border-strong)] ${identidade.borda}`}
            >
              <header className={`border-b border-border px-5 py-5 sm:px-6 ${identidade.fundo}`}>
                <div className="flex flex-wrap items-center gap-4">
                  <span className={`grid size-11 place-items-center rounded-2xl text-sm font-bold tabular-nums shadow-sm ${identidade.marcador}`}>
                    {String(indice + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${identidade.texto}`}>
                      Rede coordenadora
                    </p>
                    <h2 id={`titulo-rede-${rede.redeId}`} className="mt-0.5 text-2xl font-semibold tracking-[-0.025em] text-foreground">
                      Rede {rede.rede}
                    </h2>
                    <p className={`mt-1 text-sm ${identidade.texto}`}>
                      {inteiro(rede.tematicas)} temáticas · {inteiro(rede.ppgs)} PPGs
                    </p>
                  </div>
                </div>
              </header>

              <div className="p-5 sm:p-6">
                <Resumo linhas={linhasDaRede} compacto />

                <div className="mt-6 space-y-6">
                  {rede.areas.map((area) => (
                    <BlocoTematica
                      key={area.areaTematicaId}
                      area={area}
                      linhas={linhasDaRede.filter(
                        (linha) => linha.areaTematicaId === area.areaTematicaId,
                      )}
                      contexto={contexto}
                      identidade={identidade}
                    />
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <Aviso tom="info" titulo="Rastreabilidade do planejamento">
        Código e rubrica não podem ser alterados. Edições feitas por administradores
        guardam autoria, horário, justificativa e os valores anterior e novo. Em ciclo
        encerrado, nenhum registro pode ser editado.
      </Aviso>
    </Pagina>
  );
}

function Resumo({ linhas, compacto = false }: { linhas: LinhaPlano[]; compacto?: boolean }) {
  const bolsas = linhas.filter(
    (linha) => linha.rubrica === "BOLSAS" && linha.status === "PROGRAMADO",
  );
  const pendentes = linhas.filter((linha) => linha.status === "PENDENTE");
  const apoio = linhas.filter(
    (linha) => linha.rubrica === "MANUTENCAO" || linha.rubrica === "MISSOES",
  );

  return (
    <Cartoes>
      <Cartao
        titulo="Bolsas programadas"
        valor={inteiro(bolsas.reduce((total, linha) => total + linha.quantidadeAnual, 0))}
        nota={`em ${inteiro(bolsas.length)} linhas de planejamento`}
      />
      <Cartao
        titulo="Custo anual das bolsas"
        valor={<Moeda valor={somarMoeda(bolsas.map((linha) => linha.custoAnual))} />}
        nota="Quantidade × valor do catálogo"
        destaque={!compacto}
      />
      <Cartao
        titulo="Linhas pendentes"
        valor={inteiro(pendentes.length)}
        nota="Aguardando definição da rede"
      />
      <Cartao
        titulo="Manutenção e missões"
        valor={inteiro(apoio.length)}
        nota="Linhas planejadas nessas rubricas"
      />
    </Cartoes>
  );
}

function BlocoTematica({
  area,
  linhas,
  contexto,
  identidade,
}: {
  area: LinhaTematica & { coordenadores: CoordenadorTematica[] };
  linhas: LinhaPlano[];
  contexto: ContextoDaLinha;
  identidade: IdentidadeRede;
}) {
  const bolsas = linhas.filter(
    (linha) => linha.rubrica === "BOLSAS" && linha.status === "PROGRAMADO",
  );
  const pendentes = linhas.filter((linha) => linha.status === "PENDENTE");
  const manutencao = linhas.filter((linha) => linha.rubrica === "MANUTENCAO");
  const missoes = linhas.filter((linha) => linha.rubrica === "MISSOES");

  return (
    <article className={`overflow-hidden rounded-2xl border border-l-[3px] border-border bg-surface shadow-[0_14px_35px_-30px_var(--border-strong)] ${identidade.borda}`}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface-muted/55 px-5 py-4">
        <div>
          <p className={`mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${identidade.texto}`}>
            Área temática
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-foreground">{area.codigo} · {area.nome}</h3>
            {area.statusOrcamento === "A_DEFINIR" ? <Selo tom="aviso">Orçamento a definir</Selo> : null}
          </div>
          <p className="mt-1 text-xs text-muted">
            {area.coordenadores.length > 0
              ? area.coordenadores.map((c) => `${c.ppgSigla}: ${c.nome}`).join(" · ")
              : "Nenhum Coordenador de Temática designado"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-subtle">Custo anual de bolsas</p>
          <p className="mt-1 font-semibold text-foreground">
            <Moeda valor={somarMoeda(bolsas.map((linha) => linha.custoAnual))} />
          </p>
        </div>
      </header>

      <div className="space-y-7 p-5">
        {bolsas.length > 0 ? (
          <GrupoTabela titulo="Bolsas">
            <TabelaDeBolsas linhas={bolsas} contexto={contexto} />
          </GrupoTabela>
        ) : null}

        {pendentes.length > 0 ? (
          <GrupoTabela titulo="Linhas pendentes">
            <TabelaDePendentes linhas={pendentes} contexto={contexto} />
          </GrupoTabela>
        ) : null}

        {manutencao.length > 0 ? (
          <GrupoTabela titulo="Manutenção">
            <TabelaDeApoio linhas={manutencao} contexto={contexto} />
          </GrupoTabela>
        ) : null}

        {missoes.length > 0 ? (
          <GrupoTabela titulo="Missões">
            <TabelaDeApoio linhas={missoes} contexto={contexto} />
          </GrupoTabela>
        ) : null}

        {linhas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma linha nesta temática"
            descricao="A participação está cadastrada, mas o plano de aplicação ainda não foi detalhado."
          />
        ) : null}
      </div>
    </article>
  );
}

function GrupoTabela({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h4>
      {children}
    </section>
  );
}

function TabelaDeBolsas({ linhas, contexto }: { linhas: LinhaPlano[]; contexto: ContextoDaLinha }) {
  return (
    <Tabela
      colunas={[
        { chave: "codigo", texto: "Código" },
        { chave: "ppg", texto: "PPG" },
        { chave: "coordenador", texto: "Coordenador de Temática" },
        { chave: "modalidade", texto: "Modalidade" },
        { chave: "destino", texto: "Destino / fluxo" },
        { chave: "vigencia", texto: "Vigência" },
        { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
        { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
        { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
        { chave: "acoes", texto: "Ações" },
      ]}
    >
      {linhas.map((linha) => (
        <tr key={linha.id}>
          <Celula><span className="font-mono text-xs">{linha.codigo}</span></Celula>
          <Celula><span className="font-medium text-foreground">{linha.ppgSigla}</span></Celula>
          <Celula className="max-w-52">{linha.coordenadorTematica ?? <span className="italic text-subtle">Não designado</span>}</Celula>
          <Celula>{linha.modalidade ?? "—"}</Celula>
          <Celula>
            <Selo tom={linha.destino === "BRASIL" ? "info" : "primario"}>
              {linha.destino === "BRASIL" ? "Brasil · IN" : "Exterior · OUT"}
            </Selo>
          </Celula>
          <Celula>{meses(linha.vigenciaMeses)}</Celula>
          <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
          <Celula direita><Moeda valor={linha.valorUnitario} /><span className="mt-1 block"><OrigemDoValor linha={linha} /></span></Celula>
          <Celula direita><Moeda valor={linha.custoAnual} /></Celula>
          <Celula><Acoes linha={linha} contexto={contexto} /></Celula>
        </tr>
      ))}
    </Tabela>
  );
}

function TabelaDePendentes({ linhas, contexto }: { linhas: LinhaPlano[]; contexto: ContextoDaLinha }) {
  return (
    <Tabela colunas={[
      { chave: "codigo", texto: "Código" },
      { chave: "ppg", texto: "PPG" },
      { chave: "coordenador", texto: "Coordenador de Temática" },
      { chave: "situacao", texto: "Situação" },
      { chave: "acoes", texto: "Ações" },
    ]}>
      {linhas.map((linha) => (
        <tr key={linha.id}>
          <Celula><span className="font-mono text-xs">{linha.codigo}</span></Celula>
          <Celula>{linha.ppgSigla}</Celula>
          <Celula>{linha.coordenadorTematica ?? "—"}</Celula>
          <Celula className="max-w-md text-muted">{linha.validacaoPendencia ?? "Aguardando definição de orçamento pela rede."}</Celula>
          <Celula><Acoes linha={linha} contexto={contexto} /></Celula>
        </tr>
      ))}
    </Tabela>
  );
}

function TabelaDeApoio({ linhas, contexto }: { linhas: LinhaPlano[]; contexto: ContextoDaLinha }) {
  return (
    <Tabela colunas={[
      { chave: "codigo", texto: "Código" },
      { chave: "ppg", texto: "PPG" },
      { chave: "coordenador", texto: "Coordenador de Temática" },
      { chave: "descricao", texto: "Descrição" },
      { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
      { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
      { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
      { chave: "acoes", texto: "Ações" },
    ]}>
      {linhas.map((linha) => (
        <tr key={linha.id}>
          <Celula><span className="font-mono text-xs">{linha.codigo}</span></Celula>
          <Celula>{linha.ppgSigla}</Celula>
          <Celula>{linha.coordenadorTematica ?? "—"}</Celula>
          <Celula className="max-w-xs">{linha.descricao ?? "—"}</Celula>
          <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
          <Celula direita><Moeda valor={linha.valorUnitario} /><span className="mt-1 block"><OrigemDoValor linha={linha} /></span></Celula>
          <Celula direita><Moeda valor={linha.custoAnual} /></Celula>
          <Celula><Acoes linha={linha} contexto={contexto} /></Celula>
        </tr>
      ))}
    </Tabela>
  );
}

function Acoes({ linha, contexto }: { linha: LinhaPlano; contexto: ContextoDaLinha }) {
  return (
    <AcoesLinhaPlano
      {...contexto}
      linha={linha}
    />
  );
}

function OrigemDoValor({ linha }: { linha: LinhaPlano }) {
  if (linha.origemValor === "CATALOGO") {
    return <Selo tom="sucesso" titulo={`Item ${linha.itemCatalogoCodigo} do catálogo vigente`}>oficial · {linha.itemCatalogoCodigo}</Selo>;
  }
  if (linha.origemValor === "ESTIMADO") {
    return <Selo tom="aviso" titulo="Valor digitado, não tabelado">estimado</Selo>;
  }
  return <Selo tom="neutro" titulo="Sem valor definido">sem valor</Selo>;
}
