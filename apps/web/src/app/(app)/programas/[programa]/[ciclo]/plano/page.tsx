import Link from "next/link";

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

type RedeDoPlano = LinhaRede & {
  areas: (LinhaTematica & { coordenadores: CoordenadorTematica[] })[];
};

interface RespostaRedes {
  ano: number;
  redes: RedeDoPlano[];
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
    abaAtiva:
      "border-network-1 bg-network-1-soft text-on-network-1-soft",
    ponto: "bg-network-1",
  },
  {
    borda: "border-l-network-2",
    fundo: "bg-network-2-soft",
    marcador: "bg-network-2 text-on-network-2",
    texto: "text-on-network-2-soft",
    abaAtiva:
      "border-network-2 bg-network-2-soft text-on-network-2-soft",
    ponto: "bg-network-2",
  },
  {
    borda: "border-l-network-3",
    fundo: "bg-network-3-soft",
    marcador: "bg-network-3 text-on-network-3",
    texto: "text-on-network-3-soft",
    abaAtiva:
      "border-network-3 bg-network-3-soft text-on-network-3-soft",
    ponto: "bg-network-3",
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

function chaveDaRede(nome: string) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * P10 · Plano de aplicacao, organizado pela hierarquia operacional real:
 * programa -> rede -> tematica -> PPG. A aba geral consolida o ciclo; cada aba
 * de rede isola o plano operacional sem duplicar rota nem regra de dominio.
 */
export default async function PlanoDeAplicacao({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
  searchParams: Promise<{ rede?: string | string[] }>;
}) {
  const { programa, ciclo: cicloNome } = await params;
  const consulta = await searchParams;
  const base = `/programas/${programa}/${cicloNome}`;
  const rotaPlano = `${base}/plano`;

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
  const chaveSolicitada = Array.isArray(consulta.rede)
    ? consulta.rede[0]
    : consulta.rede;
  const indiceRedeSelecionada = redes.redes.findIndex(
    (rede) => chaveDaRede(rede.rede) === chaveSolicitada,
  );
  const redeSelecionada =
    indiceRedeSelecionada >= 0 ? redes.redes[indiceRedeSelecionada] : null;
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
      descricao={
        redeSelecionada
          ? `Planejamento da Rede ${redeSelecionada.rede}, organizado por temática e PPG.`
          : "Visão institucional consolidada das redes, temáticas, PPGs e recursos planejados."
      }
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
      <AbasDoPlano
        rotaPlano={rotaPlano}
        redes={redes.redes}
        redeSelecionada={redeSelecionada}
      />

      {redeSelecionada ? (
        <PlanoDaRede
          rede={redeSelecionada}
          indice={indiceRedeSelecionada}
          linhas={linhasAtivas.filter(
            (linha) => linha.redeId === redeSelecionada.redeId,
          )}
          contexto={contexto}
        />
      ) : (
        <VisaoGeral
          rotaPlano={rotaPlano}
          redes={redes.redes}
          linhas={linhasAtivas}
        />
      )}

      <Aviso tom="info" titulo="Rastreabilidade do planejamento">
        Código e rubrica não podem ser alterados. Edições feitas por administradores
        guardam autoria, horário, justificativa e os valores anterior e novo. Em ciclo
        encerrado, nenhum registro pode ser editado.
      </Aviso>
    </Pagina>
  );
}

function AbasDoPlano({
  rotaPlano,
  redes,
  redeSelecionada,
}: {
  rotaPlano: string;
  redes: RedeDoPlano[];
  redeSelecionada: RedeDoPlano | null;
}) {
  return (
    <nav
      aria-label="Seções do Plano de Aplicação"
      className="mb-8 overflow-x-auto border-b border-border"
    >
      <div className="flex min-w-max gap-1 pb-px">
        <Link
          href={rotaPlano}
          aria-current={redeSelecionada ? undefined : "page"}
          className={`flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
            redeSelecionada
              ? "border-transparent text-muted hover:border-border-strong hover:bg-surface-muted"
              : "border-primary bg-primary-soft/55 text-on-primary-soft"
          }`}
        >
          <IconeVisaoGeral />
          Visão geral
        </Link>

        {redes.map((rede, indice) => {
          const identidade = identidadeDaRede(rede.rede, indice);
          const ativa = redeSelecionada?.redeId === rede.redeId;

          return (
            <Link
              key={rede.redeId}
              href={`${rotaPlano}?rede=${chaveDaRede(rede.rede)}`}
              aria-current={ativa ? "page" : undefined}
              className={`flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
                ativa
                  ? identidade.abaAtiva
                  : "border-transparent text-muted hover:border-border-strong hover:bg-surface-muted"
              }`}
            >
              <span className={`size-2 rounded-full ${identidade.ponto}`} />
              {rede.rede}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function IconeVisaoGeral() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-none stroke-current" strokeWidth="1.7">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.2" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.2" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.2" />
    </svg>
  );
}

function VisaoGeral({
  rotaPlano,
  redes,
  linhas,
}: {
  rotaPlano: string;
  redes: RedeDoPlano[];
  linhas: LinhaPlano[];
}) {
  const ppgs = new Set(
    redes.flatMap((rede) =>
      rede.areas.flatMap((area) =>
        area.coordenadores.map((coordenador) => coordenador.ppgId),
      ),
    ),
  );
  const coordenadores = new Set(
    redes.flatMap((rede) =>
      rede.areas.flatMap((area) =>
        area.coordenadores.map(
          (coordenador) => coordenador.email ?? coordenador.nome,
        ),
      ),
    ),
  );

  return (
    <div className="space-y-9">
      <section aria-labelledby="resumo-operacional">
        <CabecalhoDeSecao
          id="resumo-operacional"
          titulo="Resumo operacional"
          descricao="Totais consolidados de todas as redes no ciclo."
        />
        <Resumo linhas={linhas} />
      </section>

      <section aria-labelledby="estrutura-programa">
        <CabecalhoDeSecao
          id="estrutura-programa"
          titulo="Estrutura do programa"
          descricao="Dimensão institucional atualmente cadastrada no planejamento."
        />
        <Cartoes>
          <Cartao
            titulo="Redes coordenadoras"
            valor={inteiro(redes.length)}
            nota="UNESP, UFMG e UNICAMP"
          />
          <Cartao
            titulo="Áreas temáticas"
            valor={inteiro(redes.reduce((total, rede) => total + rede.areas.length, 0))}
            nota="Organizam o plano dentro das redes"
          />
          <Cartao
            titulo="PPGs participantes"
            valor={inteiro(ppgs.size)}
            nota="Contagem única entre todas as redes"
          />
          <Cartao
            titulo="Coordenadores de temática"
            valor={inteiro(coordenadores.size)}
            nota="Uma pessoa pode acompanhar vários PPGs"
          />
        </Cartoes>
      </section>

      <section aria-labelledby="comparativo-redes">
        <CabecalhoDeSecao
          id="comparativo-redes"
          titulo="Panorama por rede"
          descricao="Compare a dimensão e o planejamento; selecione uma rede para abrir seu plano completo."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          {redes.map((rede, indice) => (
            <ResumoDaRede
              key={rede.redeId}
              rede={rede}
              indice={indice}
              linhas={linhas.filter((linha) => linha.redeId === rede.redeId)}
              href={`${rotaPlano}?rede=${chaveDaRede(rede.rede)}`}
            />
          ))}
        </div>
      </section>

      <Aviso tom="info" titulo="Como navegar">
        A Visão geral consolida o ciclo inteiro. As abas de rede apresentam o
        detalhamento por temática e PPG, além das ações de inclusão, edição e
        histórico.
      </Aviso>
    </div>
  );
}

function CabecalhoDeSecao({
  id,
  titulo,
  descricao,
}: {
  id: string;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="mb-4">
      <h2 id={id} className="text-lg font-semibold tracking-[-0.015em] text-foreground">
        {titulo}
      </h2>
      <p className="mt-1 text-sm text-muted">{descricao}</p>
    </div>
  );
}

function ResumoDaRede({
  rede,
  indice,
  linhas,
  href,
}: {
  rede: RedeDoPlano;
  indice: number;
  linhas: LinhaPlano[];
  href: string;
}) {
  const identidade = identidadeDaRede(rede.rede, indice);
  const bolsas = linhas.filter(
    (linha) => linha.rubrica === "BOLSAS" && linha.status === "PROGRAMADO",
  );
  const pendentes = linhas.filter((linha) => linha.status === "PENDENTE");

  return (
    <Link
      href={href}
      className={`group overflow-hidden rounded-2xl border border-l-4 border-border bg-surface shadow-[0_14px_35px_-30px_var(--border-strong)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_20px_40px_-28px_var(--border-strong)] ${identidade.borda}`}
    >
      <div className={`flex items-center gap-3 border-b border-border px-4 py-4 ${identidade.fundo}`}>
        <span className={`grid size-9 place-items-center rounded-xl text-xs font-bold tabular-nums ${identidade.marcador}`}>
          {String(indice + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-[0.65rem] font-semibold uppercase tracking-[0.12em] ${identidade.texto}`}>
            Rede coordenadora
          </p>
          <h3 className="truncate font-semibold text-foreground">{rede.rede}</h3>
        </div>
        <span aria-hidden="true" className={`text-lg transition-transform group-hover:translate-x-0.5 ${identidade.texto}`}>
          →
        </span>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 text-sm">
        <MetricaDaRede rotulo="PPGs" valor={inteiro(rede.ppgs)} />
        <MetricaDaRede rotulo="Temáticas" valor={inteiro(rede.tematicas)} />
        <MetricaDaRede
          rotulo="Bolsas/ano"
          valor={inteiro(
            bolsas.reduce((total, linha) => total + linha.quantidadeAnual, 0),
          )}
        />
        <MetricaDaRede rotulo="Pendências" valor={inteiro(pendentes.length)} />
        <div className="col-span-2 border-t border-border pt-3">
          <MetricaDaRede
            rotulo="Custo anual das bolsas"
            valor={<Moeda valor={somarMoeda(bolsas.map((linha) => linha.custoAnual))} />}
          />
        </div>
      </dl>
    </Link>
  );
}

function MetricaDaRede({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-subtle">{rotulo}</dt>
      <dd className="mt-1 font-semibold tabular-nums text-foreground">{valor}</dd>
    </div>
  );
}

function PlanoDaRede({
  rede,
  indice,
  linhas,
  contexto,
}: {
  rede: RedeDoPlano;
  indice: number;
  linhas: LinhaPlano[];
  contexto: ContextoDaLinha;
}) {
  const identidade = identidadeDaRede(rede.rede, indice);

  return (
    <section
      aria-labelledby={`titulo-rede-${rede.redeId}`}
      className={`overflow-hidden rounded-[1.75rem] border border-l-4 border-border bg-surface shadow-[0_20px_45px_-38px_var(--border-strong)] ${identidade.borda}`}
    >
      <header className={`border-b border-border px-5 py-5 sm:px-6 ${identidade.fundo}`}>
        <div className="flex flex-wrap items-center gap-4">
          <span className={`grid size-11 place-items-center rounded-2xl text-sm font-bold tabular-nums shadow-sm ${identidade.marcador}`}>
            {String(indice + 1).padStart(2, "0")}
          </span>
          <div>
            <p className={`text-[0.68rem] font-semibold uppercase tracking-[0.14em] ${identidade.texto}`}>
              Plano da rede
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
        <Resumo linhas={linhas} compacto />

        <div className="mt-7 space-y-6">
          {rede.areas.map((area) => (
            <BlocoTematica
              key={area.areaTematicaId}
              area={area}
              linhas={linhas.filter(
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
