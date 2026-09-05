import Link from "next/link";

import {
  EditarMembroEquipe,
  NovoMembroEquipe,
} from "@/componentes/formularios/form-membro-equipe";
import { NovaMissaoComite } from "@/componentes/formularios/form-missao-comite";
import {
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type {
  ComiteGestor,
  Me,
  MembroEquipeGestao,
  PaginaMissoes,
  PessoaDisponivel,
  ReferenciasMissao,
  ResumoMissoes,
  SituacaoPrestacao,
  SituacaoTemporalMissao,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import { data, inteiro, percentual, rotulo, somarMoeda } from "@/lib/formato";

type Aba = "visao-geral" | "missoes" | "equipes";

/** Filtros da aba Missões, exatamente como chegam da query string. */
type ConsultaMissoes = Record<string, string | string[] | undefined>;

const TAMANHO_PAGINA = 20;

/**
 * Campos aceitos no filtro da lista.
 *
 * A lista é fechada de propósito: a query string vira parâmetro da API sem
 * repasse cego do que o usuário digitou na URL.
 */
const CAMPOS_FILTRO = [
  "busca",
  "ano",
  "de",
  "ate",
  "paisId",
  "redeId",
  "pessoaId",
  "tipoEquipe",
  "status",
  "situacaoTemporal",
  "situacaoPrestacao",
  "pagina",
] as const;

/** Filtros que reduzem o universo, e não apenas a situação exibida. */
const CAMPOS_ESCOPO = [
  "busca",
  "ano",
  "de",
  "ate",
  "paisId",
  "redeId",
  "pessoaId",
  "tipoEquipe",
] as const;

const ROTULO_STATUS: Record<StatusMissao, string> = {
  RASCUNHO: "Rascunho",
  PLANEJADA: "Planejada",
  CONFIRMADA: "Confirmada",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const TOM_STATUS: Record<
  StatusMissao,
  "neutro" | "primario" | "sucesso" | "aviso" | "perigo" | "info"
> = {
  RASCUNHO: "neutro",
  PLANEJADA: "info",
  CONFIRMADA: "primario",
  CONCLUIDA: "sucesso",
  CANCELADA: "perigo",
};

const TOM_APROVACAO: Record<
  StatusAprovacaoMissao,
  "neutro" | "primario" | "sucesso" | "aviso" | "perigo" | "info"
> = {
  RASCUNHO: "neutro",
  EM_ANALISE: "info",
  // Ajustes solicitados e aviso, nao erro: a missao voltou para quem a
  // escreveu, o que e fluxo normal.
  AJUSTES_SOLICITADOS: "aviso",
  APROVADA: "sucesso",
  REPROVADA: "perigo",
};

const ROTULO_TEMPORAL: Record<SituacaoTemporalMissao, string> = {
  FUTURA: "Futura",
  EM_ANDAMENTO: "Em andamento",
  ENCERRADA: "Encerrada",
};

const ROTULO_PRESTACAO: Record<SituacaoPrestacao, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_PREENCHIMENTO: "Em preenchimento",
  ENVIADA: "Enviada",
  COM_PENDENCIA: "Com pendência",
  VALIDADA: "Validada",
};

const TOM_PRESTACAO: Record<
  SituacaoPrestacao,
  "neutro" | "primario" | "sucesso" | "aviso" | "perigo" | "info"
> = {
  NAO_INICIADA: "neutro",
  EM_PREENCHIMENTO: "info",
  ENVIADA: "primario",
  COM_PENDENCIA: "aviso",
  VALIDADA: "sucesso",
};

const ROTULO_FILTRO = "mb-1.5 block text-xs font-medium text-muted";

const ENTRADA_FILTRO =
  "w-full rounded-xl border border-border-strong bg-surface px-3 py-2.5 " +
  "text-sm text-foreground shadow-sm placeholder:text-subtle " +
  "hover:border-primary focus:border-primary";

const BOTAO_PAGINA =
  "rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium " +
  "text-foreground hover:border-primary hover:text-primary";

/** P17 · area operacional do Comite Gestor e da Administracao. */
export default async function ComiteGestorPagina({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
  searchParams: Promise<ConsultaMissoes>;
}) {
  const { programa, ciclo } = await params;
  const consulta = await searchParams;
  const base = `/programas/${programa}/${ciclo}/comite-gestor`;
  const aba = normalizarAba(consulta.aba);
  const me = await apiFetch<Me>("/me");

  if (!me.permissions.includes("equipe-gestao:read")) {
    return (
      <Pagina
        titulo="Comitê Gestor e Administração"
        descricao="Equipes, missões institucionais e acompanhamento do orçamento do Comitê Gestor."
      >
        <EstadoVazio
          titulo="Acesso restrito"
          descricao="Nesta etapa, somente o perfil administrador pode consultar e alterar esta área."
        />
      </Pagina>
    );
  }

  const [dados, membros, pessoas, referenciasMissao] = await Promise.all([
    apiFetch<ComiteGestor>(`/programas/${programa}/${ciclo}/comite-gestor`),
    apiFetch<MembroEquipeGestao[]>(
      `/programas/${programa}/${ciclo}/comite-gestor/equipes`,
    ),
    apiFetch<PessoaDisponivel[]>("/pessoas"),
    aba === "missoes"
      ? apiFetch<ReferenciasMissao>(
          `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
        )
      : Promise.resolve({ paises: [], instituicoes: [], redes: [] }),
  ]);

  const inicioPadrao = `${dados.anos[0] ?? new Date().getFullYear()}-01-01`;
  const contextoFormulario = {
    programa,
    ciclo,
    pessoas,
    dataInicioPadrao: inicioPadrao,
  };

  return (
    <Pagina
      titulo="Comitê Gestor e Administração"
      descricao="Equipes, missões institucionais e acompanhamento do orçamento do Comitê Gestor."
      acoes={
        aba === "missoes" ? (
          <NovaMissaoComite
            programa={programa}
            ciclo={ciclo}
            pessoas={pessoas}
            membros={membros}
            referencias={referenciasMissao}
            dataInicioPadrao={inicioPadrao}
          />
        ) : aba === "equipes" ? (
          <NovoMembroEquipe {...contextoFormulario} />
        ) : undefined
      }
    >
      <Abas base={base} ativa={aba} />

      {aba === "visao-geral" ? (
        <VisaoGeral
          dados={dados}
          membros={membros}
          base={base}
          exercicio={exercicioDaConsulta(consulta, dados.anos)}
        />
      ) : null}
      {aba === "missoes" ? (
        <Missoes
          programa={programa}
          ciclo={ciclo}
          base={base}
          consulta={consulta}
          membros={membros}
          referencias={referenciasMissao}
        />
      ) : null}
      {aba === "equipes" ? (
        <Equipes
          membros={membros}
          contextoFormulario={contextoFormulario}
        />
      ) : null}
    </Pagina>
  );
}

function Abas({ base, ativa }: { base: string; ativa: Aba }) {
  const abas: { id: Aba; texto: string }[] = [
    { id: "visao-geral", texto: "Visão geral" },
    { id: "missoes", texto: "Missões" },
    { id: "equipes", texto: "Equipes" },
  ];

  return (
    <nav
      aria-label="Áreas do Comitê Gestor"
      className="mb-7 flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {abas.map((aba) => (
        <Link
          key={aba.id}
          href={aba.id === "visao-geral" ? base : `${base}?aba=${aba.id}`}
          aria-current={ativa === aba.id ? "page" : undefined}
          className={
            ativa === aba.id
              ? "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
              : "rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          }
        >
          {aba.texto}
        </Link>
      ))}
    </nav>
  );
}

function VisaoGeral({
  dados,
  membros,
  base,
  exercicio,
}: {
  dados: ComiteGestor;
  membros: MembroEquipeGestao[];
  base: string;
  exercicio: number | null;
}) {
  const ativos = membros.filter((membro) => membro.situacao === "ATIVO");

  // Com um exercício escolhido a tabela mostra só aquela coluna, e tudo o que é
  // proporcional passa a ser proporcional ao recorte visível.
  const anos = exercicio ? [exercicio] : dados.anos;
  const totalDoRecorte = exercicio
    ? totalDoExercicio(dados, exercicio)
    : dados.totalCiclo;
  const divisor = Number(totalDoRecorte ?? "0");

  const parteDaRede = (rede: ComiteGestor["porRede"][number]) =>
    exercicio
      ? (rede.porAno.find((ano) => ano.ano === exercicio)?.valor ?? null)
      : rede.total;

  return (
    <>
      <Cartoes>
        <Cartao
          titulo={exercicio ? `Aporte de ${exercicio}` : "Total anual"}
          valor={
            <Moeda
              valor={exercicio ? totalDoRecorte : dados.totalAnual}
            />
          }
          nota={
            exercicio
              ? "Soma das redes neste exercício"
              : `Exercício ${dados.anos[0] ?? "—"}`
          }
        />
        <Cartao
          titulo="Total do ciclo"
          valor={<Moeda valor={dados.totalCiclo} />}
          nota={`${dados.anos.length} exercícios: ${dados.anos.join(", ")}`}
        />
        <Cartao
          titulo="Equipe ativa"
          valor={String(ativos.length)}
          nota={`${ativos.filter((m) => m.tipoEquipe === "COMITE_GESTOR").length} no Comitê Gestor · ${ativos.filter((m) => m.tipoEquipe === "ADMINISTRACAO").length} na Administração`}
        />
        <Cartao
          titulo="Maior aporte"
          valor={maiorAporte(dados)}
          nota="Rede com o maior aporte no ciclo"
        />
      </Cartoes>

      <div className="mt-10" />

      <Secao
        titulo="Origem do orçamento"
        descricao="Aportes das redes coordenadoras por exercício. Os valores de missões e prestações serão apresentados separadamente."
      >
        <FiltroExercicio base={base} anos={dados.anos} ativo={exercicio} />

        <Tabela
          colunas={[
            { chave: "rede", texto: "Rede" },
            ...anos.map((ano) => ({
              chave: String(ano),
              texto: String(ano),
              alinhamento: "direita" as const,
            })),
            ...(exercicio
              ? []
              : [
                  {
                    chave: "total",
                    texto: "Total do ciclo",
                    alinhamento: "direita" as const,
                  },
                ]),
            { chave: "part", texto: "Participação", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              {anos.map((ano) => (
                <Celula key={ano} direita>
                  <Moeda valor={totalDoExercicio(dados, ano)} forte />
                </Celula>
              ))}
              {exercicio ? null : (
                <Celula direita>
                  <Moeda valor={dados.totalCiclo} forte />
                </Celula>
              )}
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
              {anos.map((ano) => (
                <Celula key={ano} direita>
                  <Moeda
                    valor={
                      rede.porAno.find((linha) => linha.ano === ano)?.valor ??
                      null
                    }
                  />
                </Celula>
              ))}
              {exercicio ? null : (
                <Celula direita>
                  <Moeda valor={rede.total} forte />
                </Celula>
              )}
              <Celula direita>
                {divisor > 0
                  ? percentual(Number(parteDaRede(rede) ?? "0") / divisor)
                  : "—"}
              </Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </>
  );
}

/**
 * Recorte por exercício da tabela de aportes.
 *
 * São links, e não um `<select>`: o recorte fica na URL, pode ser compartilhado
 * e recarregado, e a aba continua funcionando sem JavaScript — a mesma decisão
 * já tomada nos filtros da aba Missões.
 */
function FiltroExercicio({
  base,
  anos,
  ativo,
}: {
  base: string;
  anos: number[];
  ativo: number | null;
}) {
  if (anos.length <= 1) return null;

  const item = (href: string, texto: string, selecionado: boolean) => (
    <Link
      key={texto}
      href={href}
      aria-current={selecionado ? "true" : undefined}
      className={
        selecionado
          ? "rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
          : "rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-primary"
      }
    >
      {texto}
    </Link>
  );

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted">Exercício</span>
      {item(base, "Todos", ativo === null)}
      {anos.map((ano) => item(`${base}?ano=${ano}`, String(ano), ativo === ano))}
    </div>
  );
}

/** Soma dos aportes das redes em um exercício. */
function totalDoExercicio(dados: ComiteGestor, ano: number): string | null {
  return somarMoeda(
    dados.porRede.map(
      (rede) => rede.porAno.find((linha) => linha.ano === ano)?.valor ?? null,
    ),
  );
}

/** Exercício pedido na URL, aceito apenas se existir no ciclo. */
function exercicioDaConsulta(
  consulta: ConsultaMissoes,
  anos: number[],
): number | null {
  const bruto = Array.isArray(consulta.ano) ? consulta.ano[0] : consulta.ano;
  const ano = Number(bruto);
  return anos.includes(ano) ? ano : null;
}

/** Aba Missões: filtros, resumo do recorte e a lista propriamente dita. */
async function Missoes({
  programa,
  ciclo,
  base,
  consulta,
  membros,
  referencias,
}: {
  programa: string;
  ciclo: string;
  base: string;
  consulta: ConsultaMissoes;
  membros: MembroEquipeGestao[];
  referencias: ReferenciasMissao;
}) {
  const filtros = filtrosDaConsulta(consulta);
  const parametros = new URLSearchParams(filtros);
  parametros.set("tamanho", String(TAMANHO_PAGINA));

  const pagina = await apiFetch<PaginaMissoes>(
    `/programas/${programa}/${ciclo}/comite-gestor/missoes?${parametros}`,
  );

  // Sem nenhuma missão cadastrada o que falta é o cadastro, não o filtro: o
  // estado vazio precisa dizer coisas diferentes nos dois casos.
  const semCadastro = pagina.resumo.total === 0 && !temFiltroDeEscopo(filtros);

  return (
    <>
      <ResumoDasMissoes resumo={pagina.resumo} />
      <FiltroMissoes
        base={base}
        filtros={filtros}
        membros={membros}
        redes={referencias.redes}
      />

      <Secao
        titulo={`Missões · ${pagina.total}`}
        descricao="Cada missão é cadastrada sem valores. Passagens e diárias entram depois, pela prestação de contas."
      >
        {pagina.itens.length === 0 ? (
          <EstadoVazio
            titulo={
              semCadastro
                ? "Nenhuma missão cadastrada"
                : "Nenhuma missão para este filtro"
            }
            descricao={
              semCadastro
                ? "As missões institucionais do Comitê Gestor e da Administração aparecerão aqui assim que forem cadastradas."
                : "Ajuste o período, o país, a equipe ou a situação para ampliar o recorte."
            }
          />
        ) : (
          <>
            <Tabela
              colunas={[
                { chave: "missao", texto: "Missão" },
                { chave: "redes", texto: "Redes" },
                { chave: "periodo", texto: "Período" },
                { chave: "roteiro", texto: "Roteiro" },
                { chave: "equipe", texto: "Participantes", alinhamento: "direita" },
                { chave: "situacao", texto: "Situação" },
                { chave: "prestacao", texto: "Prestação" },
                { chave: "valor", texto: "Valor prestado", alinhamento: "direita" },
              ]}
            >
              {pagina.itens.map((missao) => (
                <tr key={missao.id}>
                  <Celula>
                    <Link
                      href={`${base}/missoes/${missao.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      {missao.titulo}
                    </Link>
                    <span className="mt-0.5 block text-xs text-subtle">
                      {missao.codigo}
                    </span>
                  </Celula>
                  {/* Missão anterior à CG-016 não tem rede; a coluna diz isso
                      em vez de fingir um travessão neutro. */}
                  <Celula>
                    {missao.redes.length > 0 ? (
                      missao.redes.join(" · ")
                    ) : (
                      <span className="text-subtle italic">
                        Sem rede definida
                      </span>
                    )}
                  </Celula>
                  <Celula>
                    {data(missao.dataInicio)} — {data(missao.dataFim)}
                    <span className="mt-0.5 block text-xs text-subtle">
                      {ROTULO_TEMPORAL[missao.situacaoTemporal]}
                    </span>
                  </Celula>
                  <Celula>
                    {missao.paises.join(", ") || "—"}
                    <span className="mt-0.5 block text-xs text-subtle">
                      {`${inteiro(missao.atividades)} ${
                        missao.atividades === 1 ? "atividade" : "atividades"
                      }`}
                    </span>
                  </Celula>
                  <Celula direita>{inteiro(missao.participantes)}</Celula>
                  <Celula>
                    <Selo tom={TOM_STATUS[missao.status]}>
                      {ROTULO_STATUS[missao.status]}
                    </Selo>
                    {/* A aprovação é dimensão própria (CG-006/CG-019). Sem ela
                        aqui, a lista não diria o que aguarda o Comitê — e
                        "concluída" seria lido como "aprovada". Rascunho de
                        aprovação é o estado inicial e não vira ruído visual. */}
                    {missao.statusAprovacao === "RASCUNHO" ? null : (
                      <span className="mt-1 block">
                        <Selo tom={TOM_APROVACAO[missao.statusAprovacao]}>
                          {rotulo(missao.statusAprovacao)}
                        </Selo>
                      </span>
                    )}
                  </Celula>
                  <Celula>
                    {/* Selo próprio: a situação da prestação é independente da
                        situação administrativa da missão. */}
                    <Selo tom={TOM_PRESTACAO[missao.situacaoPrestacao]}>
                      {ROTULO_PRESTACAO[missao.situacaoPrestacao]}
                    </Selo>
                  </Celula>
                  <Celula direita>
                    <Moeda valor={missao.valorPrestado} />
                  </Celula>
                </tr>
              ))}
            </Tabela>
            <Paginacao base={base} filtros={filtros} pagina={pagina} />
          </>
        )}
      </Secao>
    </>
  );
}

function ResumoDasMissoes({ resumo }: { resumo: ResumoMissoes }) {
  return (
    <Cartoes>
      <Cartao titulo="Missões no recorte" valor={inteiro(resumo.total)} />
      <Cartao
        titulo="Em andamento"
        valor={inteiro(resumo.porSituacaoTemporal.EM_ANDAMENTO)}
        nota={`${inteiro(resumo.porSituacaoTemporal.FUTURA)} futuras`}
      />
      <Cartao
        titulo="Realizadas"
        valor={inteiro(resumo.realizadas)}
        nota="Somente missões concluídas"
      />
      <Cartao
        titulo="Canceladas"
        valor={inteiro(resumo.canceladas)}
        nota="Não contam como realizadas"
      />
    </Cartoes>
  );
}

/**
 * Barra de filtros.
 *
 * É um `<form method="get">` de verdade: o recorte fica na URL, pode ser
 * compartilhado e recarregado, e a página continua funcionando sem JavaScript.
 */
function FiltroMissoes({
  base,
  filtros,
  membros,
  redes,
}: {
  base: string;
  filtros: Record<string, string>;
  membros: MembroEquipeGestao[];
  redes: ReferenciasMissao["redes"];
}) {
  const pessoas = [
    ...new Map(membros.map((m) => [m.pessoaId, m.nome])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));

  return (
    <form
      method="get"
      action={base}
      className="mb-8 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="aba" value="missoes" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          <span className={ROTULO_FILTRO}>Buscar</span>
          <input
            type="search"
            name="busca"
            defaultValue={filtros.busca ?? ""}
            placeholder="Código, título, instituição ou evento"
            className={ENTRADA_FILTRO}
          />
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Exercício</span>
          <input
            type="number"
            name="ano"
            min={2000}
            max={2100}
            defaultValue={filtros.ano ?? ""}
            placeholder="Todos"
            className={ENTRADA_FILTRO}
          />
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Rede</span>
          <select
            name="redeId"
            defaultValue={filtros.redeId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas as redes</option>
            {redes.map((rede) => (
              <option key={rede.id} value={rede.id}>
                {rede.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Equipe</span>
          <select
            name="tipoEquipe"
            defaultValue={filtros.tipoEquipe ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            <option value="COMITE_GESTOR">Comitê Gestor</option>
            <option value="ADMINISTRACAO">Administração</option>
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Participante</span>
          <select
            name="pessoaId"
            defaultValue={filtros.pessoaId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todos</option>
            {pessoas.map(([id, nome]) => (
              <option key={id} value={id}>
                {nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Situação da missão</span>
          <select
            name="status"
            defaultValue={filtros.status ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {(Object.keys(ROTULO_STATUS) as StatusMissao[]).map((status) => (
              <option key={status} value={status}>
                {ROTULO_STATUS[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Situação no tempo</span>
          <select
            name="situacaoTemporal"
            defaultValue={filtros.situacaoTemporal ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {(
              Object.keys(ROTULO_TEMPORAL) as SituacaoTemporalMissao[]
            ).map((situacao) => (
              <option key={situacao} value={situacao}>
                {ROTULO_TEMPORAL[situacao]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Situação da prestação</span>
          <select
            name="situacaoPrestacao"
            defaultValue={filtros.situacaoPrestacao ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {(Object.keys(ROTULO_PRESTACAO) as SituacaoPrestacao[]).map(
              (situacao) => (
                <option key={situacao} value={situacao}>
                  {ROTULO_PRESTACAO[situacao]}
                </option>
              ),
            )}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-on-primary hover:opacity-90"
          >
            Filtrar
          </button>
          <Link
            href={`${base}?aba=missoes`}
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          >
            Limpar
          </Link>
        </div>
      </div>
    </form>
  );
}

function Paginacao({
  base,
  filtros,
  pagina,
}: {
  base: string;
  filtros: Record<string, string>;
  pagina: PaginaMissoes;
}) {
  if (pagina.paginas <= 1) return null;

  const href = (numero: number) => {
    const parametros = new URLSearchParams({ ...filtros, aba: "missoes" });
    parametros.set("pagina", String(numero));
    return `${base}?${parametros}`;
  };

  return (
    <nav
      aria-label="Paginação das missões"
      className="mt-4 flex items-center justify-between text-sm"
    >
      <p className="text-muted">
        Página {pagina.pagina} de {pagina.paginas} · {inteiro(pagina.total)}{" "}
        {pagina.total === 1 ? "missão" : "missões"}
      </p>
      <div className="flex gap-2">
        {pagina.pagina > 1 ? (
          <Link href={href(pagina.pagina - 1)} className={BOTAO_PAGINA}>
            Anterior
          </Link>
        ) : null}
        {pagina.pagina < pagina.paginas ? (
          <Link href={href(pagina.pagina + 1)} className={BOTAO_PAGINA}>
            Próxima
          </Link>
        ) : null}
      </div>
    </nav>
  );
}

function Equipes({
  membros,
  contextoFormulario,
}: {
  membros: MembroEquipeGestao[];
  contextoFormulario: {
    programa: string;
    ciclo: string;
    pessoas: PessoaDisponivel[];
    dataInicioPadrao: string;
  };
}) {
  return (
    <>
      <Equipe
        titulo="Comitê Gestor"
        descricao="Pessoas responsáveis pela articulação institucional e participantes das missões."
        membros={membros.filter(
          (membro) => membro.tipoEquipe === "COMITE_GESTOR",
        )}
        contextoFormulario={contextoFormulario}
      />
      <Equipe
        titulo="Administração"
        descricao="Equipe de apoio administrativo que também pode participar das missões."
        membros={membros.filter(
          (membro) => membro.tipoEquipe === "ADMINISTRACAO",
        )}
        contextoFormulario={contextoFormulario}
      />
    </>
  );
}

function Equipe({
  titulo,
  descricao,
  membros,
  contextoFormulario,
}: {
  titulo: string;
  descricao: string;
  membros: MembroEquipeGestao[];
  contextoFormulario: {
    programa: string;
    ciclo: string;
    pessoas: PessoaDisponivel[];
    dataInicioPadrao: string;
  };
}) {
  return (
    <Secao titulo={`${titulo} · ${membros.length}`} descricao={descricao}>
      {membros.length === 0 ? (
        <EstadoVazio
          titulo={`Nenhum membro em ${titulo}`}
          descricao="Use “Adicionar membro” no topo para selecionar uma pessoa existente ou criar um novo cadastro."
        />
      ) : (
        <Tabela
          colunas={[
            { chave: "pessoa", texto: "Pessoa" },
            { chave: "funcao", texto: "Função" },
            { chave: "vinculo", texto: "Instituição / PPG" },
            { chave: "redes", texto: "Redes" },
            { chave: "vigencia", texto: "Vigência" },
            { chave: "missoes", texto: "Missões", alinhamento: "direita" },
            { chave: "situacao", texto: "Situação" },
            { chave: "acoes", texto: "Ações" },
          ]}
        >
          {membros.map((membro) => (
            <tr key={membro.id}>
              <Celula>
                <span className="font-medium text-foreground">
                  {membro.nome}
                </span>
                <span className="mt-0.5 block text-xs text-subtle">
                  {membro.email ?? rotulo(membro.tipoPessoa)}
                </span>
              </Celula>
              <Celula>{membro.funcao}</Celula>
              <Celula>
                {[membro.instituicao, membro.ppg]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </Celula>
              <Celula>
                {membro.redes.length > 0
                  ? membro.redes.join(", ")
                  : "Sem rede específica"}
              </Celula>
              <Celula>
                {data(membro.dataInicio)} — {membro.dataFim ? data(membro.dataFim) : "atual"}
              </Celula>
              {/* Zero missões é um fato, não ausência de dado: sai como 0, e
                  não como travessão. */}
              <Celula direita>{inteiro(membro.missoes)}</Celula>
              <Celula>
                <Selo
                  tom={
                    membro.situacao === "ATIVO"
                      ? "sucesso"
                      : membro.situacao === "FUTURO"
                        ? "info"
                        : "neutro"
                  }
                >
                  {membro.situacao === "FUTURO"
                    ? "Vínculo futuro"
                    : rotulo(membro.situacao)}
                </Selo>
              </Celula>
              <Celula>
                <EditarMembroEquipe
                  {...contextoFormulario}
                  membro={membro}
                />
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function maiorAporte(dados: ComiteGestor): string {
  const maior = [...dados.porRede].sort(
    (a, b) => Number(b.total) - Number(a.total),
  )[0];
  return maior?.rede ?? "—";
}

function normalizarAba(valor: string | string[] | undefined): Aba {
  const aba = Array.isArray(valor) ? valor[0] : valor;
  return aba === "missoes" || aba === "equipes" ? aba : "visao-geral";
}

/** Só os campos conhecidos, e só os que vieram preenchidos. */
function filtrosDaConsulta(consulta: ConsultaMissoes): Record<string, string> {
  const filtros: Record<string, string> = {};
  for (const campo of CAMPOS_FILTRO) {
    const bruto = consulta[campo];
    const valor = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim();
    if (valor) filtros[campo] = valor;
  }
  return filtros;
}

function temFiltroDeEscopo(filtros: Record<string, string>): boolean {
  return CAMPOS_ESCOPO.some((campo) => filtros[campo] !== undefined);
}
