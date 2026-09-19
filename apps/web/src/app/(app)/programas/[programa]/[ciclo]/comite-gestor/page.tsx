import Link from "next/link";

import {
  EditarMembroEquipe,
  NovoMembroEquipe,
} from "@/componentes/formularios/form-membro-equipe";
import { NovaMissaoComite } from "@/componentes/formularios/form-missao-comite";
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
} from "@/componentes/ui/basicos";
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { apiFetch } from "@/lib/api";
import { carregarMe } from "@/lib/me";
import type {
  ComiteGestor,
  ExecucaoComite,
  ExecucaoExercicio,
  MembroEquipeGestao,
  CabecalhoRelatorio,
  LinhaResultado,
  PaginaMissoes,
  PainelComite,
  PendenciaMissao,
  RelatorioFinancas,
  RelatorioMissoes,
  RelatorioParceiros,
  RelatorioResultados,
  PessoaDisponivel,
  ReferenciasMissao,
  ResumoMissoes,
  SituacaoPrestacao,
  SituacaoTemporalMissao,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import { data, inteiro, percentual, rotulo, somarMoeda } from "@/lib/formato";
import {
  linkDaLista,
  notaDoRecorte,
  relatorioDaConsulta,
  type Relatorio,
} from "@/lib/formularios/links-painel";

type Aba =
  | "visao-geral"
  | "missoes"
  | "analise"
  | "relatorios"
  | "equipes";

/** Os quatro relatórios homologados em 2026-09-07 (CG-068). */


const ROTULO_RELATORIO: Record<Relatorio, string> = {
  missoes: "missões",
  parceiros: "parceiros",
  financas: "finanças",
  resultados: "resultados",
};

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
  "instituicaoId",
  "evento",
  "redeId",
  "pessoaId",
  "tipoEquipe",
  "status",
  "statusAprovacao",
  "situacaoTemporal",
  "situacaoPrestacao",
  "rodada",
  "pagina",
] as const;

/** Filtros que reduzem o universo, e não apenas a situação exibida. */
const CAMPOS_ESCOPO = [
  "busca",
  "ano",
  "de",
  "ate",
  "paisId",
  "instituicaoId",
  "evento",
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
  const me = await carregarMe();

  const falta = faltando(me.permissions, ["equipe-gestao:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Comitê Gestor e Administração"
        descricao="Equipes, missões institucionais e acompanhamento do orçamento do Comitê Gestor."
        me={me}
        faltando={falta}
      />
    );
  }

  /*
   * As equipes são uma permissão; as missões, outra. Quem cadastra vínculo de
   * equipe não acompanha necessariamente as viagens, e o contrário também
   * vale — então as abas de missão só existem para quem tem `missao:read`, e
   * a Visão geral mostra os aportes sem o panorama quando falta o par
   * `missao:read` + `prestacao:read` que o painel e a execução exigem (V1-019).
   */
  const podeVerMissoes = me.permissions.includes("missao:read");
  const podeVerPanorama =
    podeVerMissoes && me.permissions.includes("prestacao:read");

  // Os aportes vêm antes do resto porque é deles que sai a lista de exercícios
  // do ciclo, e o painel só pode ser apurado depois que o exercício pedido na
  // URL foi conferido contra ela. Pedir os dois em paralelo economizaria uma
  // ida e traria de volta um painel apurado num ano que a tela descarta —
  // cartões de um universo, tabelas de outro.
  const dados = await apiFetch<ComiteGestor>(
    `/programas/${programa}/${ciclo}/comite-gestor`,
  );
  const exercicio = exercicioDaConsulta(consulta, dados.anos);

  const [membros, pessoas, referenciasMissao, execucao, painel] =
    await Promise.all([
      apiFetch<MembroEquipeGestao[]>(
        `/programas/${programa}/${ciclo}/comite-gestor/equipes`,
      ),
      apiFetch<PessoaDisponivel[]>("/pessoas"),
      podeVerMissoes &&
      (aba === "missoes" || aba === "analise" || aba === "relatorios")
        ? apiFetch<ReferenciasMissao>(
            `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
          )
        : Promise.resolve({ paises: [], instituicoes: [], redes: [] }),
      // Só a Visão geral usa a execução; buscá-la nas outras abas pagaria duas
      // agregações sobre a prestação para desenhar uma lista.
      aba === "visao-geral" && podeVerPanorama
        ? apiFetch<ExecucaoComite>(
            `/programas/${programa}/${ciclo}/comite-gestor/execucao`,
          )
        : Promise.resolve(null),
      aba === "visao-geral" && podeVerPanorama
        ? apiFetch<PainelComite>(
            `/programas/${programa}/${ciclo}/comite-gestor/painel?${recorteDaConsulta(consulta, exercicio)}`,
          )
        : Promise.resolve(null),
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
        aba === "missoes" && podeVerMissoes ? (
          <NovaMissaoComite
            programa={programa}
            ciclo={ciclo}
            membros={membros}
            referencias={referenciasMissao}
          />
        ) : aba === "equipes" ? (
          <NovoMembroEquipe {...contextoFormulario} />
        ) : undefined
      }
    >
      <Abas base={base} ativa={aba} comMissoes={podeVerMissoes} />

      {aba === "visao-geral" ? (
        <VisaoGeral
          dados={dados}
          execucao={execucao}
          painel={painel}
          membros={membros}
          base={base}
          exercicio={exercicio}
        />
      ) : null}
      {aba === "missoes" && !podeVerMissoes ? <SemMissoes /> : null}
      {aba === "missoes" && podeVerMissoes ? (
        <Missoes
          programa={programa}
          ciclo={ciclo}
          base={base}
          consulta={consulta}
          membros={membros}
          referencias={referenciasMissao}
        />
      ) : null}
      {aba === "analise" && !podeVerMissoes ? <SemMissoes /> : null}
      {aba === "analise" && podeVerMissoes ? (
        <FilaDeAnalise
          programa={programa}
          ciclo={ciclo}
          base={base}
          consulta={consulta}
          membros={membros}
          referencias={referenciasMissao}
        />
      ) : null}
      {aba === "relatorios" && !podeVerMissoes ? <SemMissoes /> : null}
      {aba === "relatorios" && podeVerMissoes ? (
        <Relatorios
          programa={programa}
          ciclo={ciclo}
          base={base}
          consulta={consulta}
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

/**
 * Aba de missão pedida por quem não tem `missao:read`.
 *
 * Acontece com link antigo ou URL digitada: a barra já não oferece a aba. A
 * tela explica, em vez de mostrar a Visão geral com `?aba=missoes` na URL —
 * silenciosamente trocar o conteúdo faria parecer que a aba sumiu do sistema.
 */
function SemMissoes() {
  return (
    <EstadoVazio
      titulo="Fora do seu acesso"
      descricao="Seu acesso cobre as equipes de gestão, mas não as missões do Comitê. Quem administra acessos na PROPESP pode conceder a consulta de missões."
    />
  );
}

function Abas({
  base,
  ativa,
  comMissoes,
}: {
  base: string;
  ativa: Aba;
  comMissoes: boolean;
}) {
  const abas: { id: Aba; texto: string }[] = [
    { id: "visao-geral", texto: "Visão geral" },
    // As três abas de missão saem juntas: todas leem a mesma listagem, e
    // deixar uma delas na barra levaria a uma tela que a API recusa.
    ...(comMissoes
      ? ([
          { id: "missoes", texto: "Missões" },
          { id: "analise", texto: "Análise" },
          { id: "relatorios", texto: "Relatórios" },
        ] as { id: Aba; texto: string }[])
      : []),
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
  execucao,
  painel,
  membros,
  base,
  exercicio,
}: {
  dados: ComiteGestor;
  execucao: ExecucaoComite | null;
  painel: PainelComite | null;
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

      {/* O exercício recorta a tela inteira — dinheiro e missões —, por isso
          fica acima de tudo. O recorte por rede vale só para as missões e mora
          dentro do painel: os aportes por rede já são a própria tabela de
          baixo, e um filtro global que mudasse metade da tela mentiria sobre a
          outra metade. */}
      <FiltroExercicio
        base={base}
        anos={dados.anos}
        ativo={exercicio}
        redeId={painel?.recorte.redeId ?? null}
      />
      {painel ? (
        <Painel dados={painel} base={base} exercicio={exercicio} />
      ) : null}

      {execucao ? (
        <Execucao dados={execucao} exercicio={exercicio} />
      ) : null}

      <Secao
        titulo="Origem do orçamento"
        descricao="Aportes das redes coordenadoras por exercício, sem relação com o orçamento de bolsas do CAPES Global."
      >
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
 * Painel do Comitê Gestor (CG-066).
 *
 * **Todo número aqui abre a lista que o produziu**, com o filtro na URL. Um
 * cartão que só informa obriga quem o lê a reconstruir o filtro à mão na aba
 * ao lado, e é aí que os dois números passam a divergir sem ninguém notar.
 *
 * Os cartões seguem as duas dimensões da CG-006 lado a lado e rotuladas:
 * aprovação e execução são independentes, e uma linha única faria "aprovada"
 * ser lido como "realizada".
 */
function Painel({
  dados,
  base,
  exercicio,
}: {
  dados: PainelComite;
  base: string;
  exercicio: number | null;
}) {
  const { recorte } = dados;
  const lista = (filtros: Record<string, string>, aba: "missoes" | "analise" = "missoes") =>
    linkDaLista(base, recorte, filtros, aba);

  return (
    <Secao
      titulo="Panorama das missões"
      descricao={dados.aviso}
      acoes={
        <FiltroRede
          base={base}
          redes={dados.porRede}
          ativa={recorte.redeId}
          exercicio={exercicio}
        />
      }
    >
      <Cartoes>
        <Cartao
          titulo="Missões no recorte"
          valor={inteiro(dados.missoes)}
          nota={notaDoRecorte(recorte)}
          href={lista({})}
          destaque
        />
        <Cartao
          titulo="Aguardando decisão"
          valor={inteiro(dados.analise.aguardando)}
          nota={
            dados.analise.paradas > 0
              ? `${inteiro(dados.analise.paradas)} há mais de 7 dias`
              : "Nenhuma parada há mais de 7 dias"
          }
          href={lista({}, "analise")}
        />
        <Cartao
          titulo="Aprovadas"
          valor={inteiro(dados.aprovacao.APROVADA)}
          nota={`${inteiro(dados.analise.ajustesSolicitados)} devolvidas para ajustes · ${inteiro(dados.analise.naoSubmetidas)} não submetidas`}
          href={lista({ statusAprovacao: "APROVADA" })}
        />
        <Cartao
          titulo="Realizadas"
          valor={inteiro(dados.realizacao.ENCERRADA)}
          nota={`${inteiro(dados.realizacao.EM_ANDAMENTO)} em andamento · ${inteiro(dados.realizacao.FUTURA)} futuras`}
          href={lista({ situacaoTemporal: "ENCERRADA" })}
        />
        <Cartao
          titulo="Prestação validada"
          valor={inteiro(dados.prestacao.VALIDADA)}
          nota={`${inteiro(dados.prestacao.ENVIADA)} aguardando validação · ${inteiro(dados.prestacao.COM_PENDENCIA)} com pendência`}
          href={lista({ situacaoPrestacao: "VALIDADA" })}
        />
        <Cartao
          titulo="Encerradas"
          valor={inteiro(dados.conclusao.concluidas)}
          nota={`${inteiro(dados.conclusao.aEncerrar)} a encerrar · ${inteiro(dados.conclusao.canceladas)} canceladas`}
          href={lista({ status: "CONCLUIDA" })}
        />
        <Cartao
          titulo="Países alcançados"
          valor={inteiro(dados.alcance.paises)}
          nota={
            dados.porPais.length > 0
              ? dados.porPais
                  .slice(0, 3)
                  .map((pais) => pais.nome)
                  .join(", ")
              : "Nenhuma parada com país informado"
          }
        />
        <Cartao
          titulo="Resultados"
          valor={inteiro(dados.alcance.produtos)}
          nota={`${inteiro(dados.alcance.parceiros)} parceiros · ${inteiro(dados.alcance.eventos)} eventos · ${inteiro(dados.alcance.convenios)} convênios`}
        />
      </Cartoes>

      {dados.porPais.length > 0 ? (
        <div className="mt-8">
          <Tabela
            rotulo="Missões por país"
            colunas={[
              { chave: "pais", texto: "País" },
              { chave: "missoes", texto: "Missões", alinhamento: "direita" },
            ]}
          >
            {dados.porPais.map((pais) => (
              <tr key={pais.id}>
                <Celula>
                  <Link
                    href={lista({ paisId: pais.id })}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {pais.nome}
                  </Link>
                  <span className="ml-2 text-xs text-subtle">
                    {pais.codigoIso2}
                  </span>
                </Celula>
                <Celula direita>{inteiro(pais.missoes)}</Celula>
              </tr>
            ))}
          </Tabela>
        </div>
      ) : null}

      <div className="mt-10">
        <ConsolidadoPorRede dados={dados} base={base} />
      </div>

      <div className="mt-10">
        <Pendencias dados={dados} base={base} />
      </div>
    </Secao>
  );
}

/**
 * Consolidado por rede coordenadora (CG-067).
 *
 * **A linha "Total do ciclo" não é a soma da coluna, e a tela diz isso.** A
 * missão de duas redes pertence às duas, e o país visitado por duas redes foi
 * alcançado pelas duas — somar contaria o mesmo fato duas vezes. O total vem de
 * um cômputo próprio sobre o recorte inteiro, o mesmo que alimenta os cartões
 * acima; é a mesma regra do consolidado da CG-055.
 *
 * Sem o aviso, quem confere a soma na calculadora conclui que a tela está
 * errada — e é a conferência que está.
 *
 * Some com o recorte por rede ativo: com uma rede escolhida não há o que
 * consolidar, e a tabela repetiria os cartões.
 */
function ConsolidadoPorRede({
  dados,
  base,
}: {
  dados: PainelComite;
  base: string;
}) {
  if (dados.recorte.redeId || dados.porRede.length < 2) return null;

  const linkDaRede = (redeId: string) =>
    linkDaLista(base, dados.recorte, { redeId }, "missoes");

  return (
    <>
      <h3 className="mb-1 text-sm font-semibold text-foreground">
        Consolidado por rede
      </h3>
      <p className="mb-4 text-xs leading-5 text-subtle">
        A missão de mais de uma rede pertence às duas e aparece nas duas linhas.
        Por isso <strong className="font-medium">o total não é a soma da
        coluna</strong>: ele conta cada missão, país e despesa uma única vez.
      </p>
      <Tabela
        rotulo="Consolidado por rede coordenadora"
        colunas={[
          { chave: "rede", texto: "Rede" },
          { chave: "missoes", texto: "Missões", alinhamento: "direita" },
          { chave: "paises", texto: "Países", alinhamento: "direita" },
          { chave: "inst", texto: "Parceiros", alinhamento: "direita" },
          { chave: "eventos", texto: "Eventos", alinhamento: "direita" },
          { chave: "conv", texto: "Convênios", alinhamento: "direita" },
          { chave: "prod", texto: "Produtos", alinhamento: "direita" },
          { chave: "validada", texto: "Despesa validada", alinhamento: "direita" },
          { chave: "lancada", texto: "Lançado", alinhamento: "direita" },
        ]}
        rodape={
          <tr>
            <Celula>
              <span className="font-medium text-foreground">Total do ciclo</span>
              <p className="mt-0.5 text-xs font-normal text-subtle">
                não é a soma acima
              </p>
            </Celula>
            <Celula direita>{inteiro(dados.missoes)}</Celula>
            <Celula direita>{inteiro(dados.alcance.paises)}</Celula>
            <Celula direita>{inteiro(dados.alcance.parceiros)}</Celula>
            <Celula direita>{inteiro(dados.alcance.eventos)}</Celula>
            <Celula direita>{inteiro(dados.alcance.convenios)}</Celula>
            <Celula direita>{inteiro(dados.alcance.produtos)}</Celula>
            <Celula direita>
              <Moeda valor={dados.financeiro.validada} forte />
            </Celula>
            <Celula direita>
              <Moeda valor={dados.financeiro.lancada} />
            </Celula>
          </tr>
        }
      >
        {dados.porRede.map((rede) => (
          <tr key={rede.id}>
            <Celula>
              <Link
                href={linkDaRede(rede.id)}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {rede.nome}
              </Link>
            </Celula>
            <Celula direita>{inteiro(rede.missoes)}</Celula>
            <Celula direita>{inteiro(rede.paises)}</Celula>
            <Celula direita>{inteiro(rede.instituicoes)}</Celula>
            <Celula direita>{inteiro(rede.eventos)}</Celula>
            <Celula direita>{inteiro(rede.convenios)}</Celula>
            <Celula direita>{inteiro(rede.produtos)}</Celula>
            <Celula direita>
              {/* Só a validada abate o aporte (CG-009); as duas colunas existem
                  para que a diferença fique visível. */}
              <Moeda valor={rede.despesaValidada} />
            </Celula>
            <Celula direita>
              <Moeda valor={rede.despesaLancada} />
            </Celula>
          </tr>
        ))}
      </Tabela>
      <p className="mt-3 text-xs leading-5 text-subtle">
        Eventos são contados pelo nome informado em cada atividade, porque
        evento ainda não é cadastro próprio: o mesmo congresso escrito de duas
        formas conta duas vezes.
      </p>
    </>
  );
}

/**
 * O que espera por alguém.
 *
 * **Uma linha por missão, com todos os motivos juntos.** Uma linha por motivo
 * faria a mesma missão aparecer duas vezes e a lista prometer mais trabalho do
 * que existe — o mesmo erro que o consolidado evita ao não somar as colunas
 * por rede.
 *
 * Cada linha diz de **quem** é a vez. Sem isso a lista é um inventário de
 * problemas; com isso, é uma fila de trabalho.
 */
function Pendencias({ dados, base }: { dados: PainelComite; base: string }) {
  if (dados.pendencias.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma pendência neste recorte"
        descricao="Nenhuma missão aguarda decisão, prestação ou encerramento com os filtros atuais."
      />
    );
  }

  return (
    <>
      <h3 className="mb-1 text-sm font-semibold text-foreground">
        Pendências · {inteiro(dados.pendencias.length)}
      </h3>
      <p className="mb-4 text-xs leading-5 text-subtle">
        Mesmo recorte dos cartões acima. Missão cancelada não aparece: não há o
        que cobrar de uma viagem que a instituição decidiu não fazer.
      </p>
      <Tabela
        rotulo="Missões com pendência"
        colunas={[
          { chave: "missao", texto: "Missão" },
          { chave: "periodo", texto: "Período" },
          { chave: "motivos", texto: "O que falta" },
          { chave: "espera", texto: "Espera", alinhamento: "direita" },
        ]}
      >
        {dados.pendencias.map((pendencia) => (
          <LinhaPendencia
            key={pendencia.missaoId}
            pendencia={pendencia}
            base={base}
          />
        ))}
      </Tabela>
    </>
  );
}

function LinhaPendencia({
  pendencia,
  base,
}: {
  pendencia: PendenciaMissao;
  base: string;
}) {
  // A maior espera entre os motivos: é ela que decide a urgência da linha, e
  // somar ou tirar média de prazos de naturezas diferentes não significa nada.
  const espera = pendencia.motivos.reduce<number | null>(
    (maior, motivo) =>
      motivo.dias === null ? maior : Math.max(maior ?? 0, motivo.dias),
    null,
  );

  return (
    <tr>
      <Celula>
        <Link
          href={`${base}/missoes/${pendencia.missaoId}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {pendencia.codigo}
        </Link>
        <p className="mt-0.5 text-xs text-muted">{pendencia.titulo}</p>
        {pendencia.redes.length > 0 ? (
          <p className="mt-0.5 text-xs text-subtle">
            {pendencia.redes.join(" · ")}
          </p>
        ) : null}
      </Celula>
      <Celula>
        <span className="whitespace-nowrap text-xs text-muted">
          {data(pendencia.dataInicio)} — {data(pendencia.dataFim)}
        </span>
      </Celula>
      <Celula>
        <ul className="space-y-1.5">
          {pendencia.motivos.map((motivo) => (
            <li key={motivo.chave}>
              <span className="text-sm text-foreground">{motivo.texto}</span>
              <span className="ml-2 text-xs text-subtle">
                {motivo.responsavel}
              </span>
            </li>
          ))}
        </ul>
      </Celula>
      <Celula direita>
        <Espera dias={espera} />
      </Celula>
    </tr>
  );
}

/**
 * Recorte por rede coordenadora.
 *
 * A missão de duas redes aparece nas duas e o total das linhas passa do total
 * de missões — está correto, e por isso a soma não é oferecida em lugar
 * nenhum. Toda rede do ciclo aparece, inclusive a sem missão: rede ausente da
 * lista seria lida como rede sem dado carregado.
 */
function FiltroRede({
  base,
  redes,
  ativa,
  exercicio,
}: {
  base: string;
  redes: PainelComite["porRede"];
  ativa: string | null;
  exercicio: number | null;
}) {
  if (redes.length === 0) return null;

  const href = (redeId: string | null) => {
    const query = new URLSearchParams();
    if (exercicio) query.set("ano", String(exercicio));
    if (redeId) query.set("redeId", redeId);
    const texto = query.toString();
    return texto ? `${base}?${texto}` : base;
  };

  const item = (destino: string, texto: string, selecionado: boolean) => (
    <Link
      key={texto}
      href={destino}
      aria-current={selecionado ? "true" : undefined}
      className={
        selecionado
          ? "rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-on-primary"
          : "rounded-xl border border-border-strong px-3 py-1.5 text-xs font-medium text-muted hover:border-primary hover:text-primary"
      }
    >
      {texto}
    </Link>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted">Rede</span>
      {item(href(null), "Todas", ativa === null)}
      {redes.map((rede) =>
        item(href(rede.id), `${rede.nome} (${rede.missoes})`, ativa === rede.id),
      )}
    </div>
  );
}



/**
 * Parâmetros do painel a partir da query string.
 *
 * O exercício já chega conferido contra os anos do ciclo; a rede vai crua e é
 * a API que a descarta se não for deste ciclo, porque só ela conhece as redes
 * antes de a página ter qualquer dado.
 */
function recorteDaConsulta(
  consulta: ConsultaMissoes,
  exercicio: number | null,
): string {
  const query = new URLSearchParams();
  if (exercicio) query.set("ano", String(exercicio));
  const rede = Array.isArray(consulta.redeId)
    ? consulta.redeId[0]
    : consulta.redeId;
  if (rede && UUID.test(rede)) query.set("redeId", rede);
  return query.toString();
}

/** Recusa antes do envio o que a API recusaria com 400 e derrubaria a página. */
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Execução orçamentária do Comitê Gestor (CG-055).
 *
 * A regra homologada é uma só e é negativa: **somente a prestação validada
 * abate o aporte** (CG-009). Por isso "Validado" e "Não validado" são colunas
 * distintas, e só a primeira entra no saldo — uma única coluna "executado"
 * obrigaria a escolher entre esconder o que ainda não vale e fazer parecer que
 * já vale.
 */
function Execucao({
  dados,
  exercicio,
}: {
  dados: ExecucaoComite;
  exercicio: number | null;
}) {
  // Com um exercício escolhido, os cartões passam a falar dele; sem recorte,
  // falam do ciclo — que **não** é a soma das linhas quando o assunto é
  // contagem de missões (a que atravessa dois anos aparece nas duas).
  const recorte: Omit<ExecucaoExercicio, "ano"> =
    (exercicio
      ? dados.exercicios.find((linha) => linha.ano === exercicio)
      : dados.total) ?? dados.total;

  const linhas = exercicio
    ? dados.exercicios.filter((linha) => linha.ano === exercicio)
    : dados.exercicios;

  return (
    <Secao
      titulo="Execução orçamentária"
      descricao="Somente a prestação validada abate o aporte. O que está em preenchimento ou aguardando revisão aparece aqui, mas não reduz o saldo oficial."
    >
      <Cartoes>
        <Cartao
          titulo="Validado"
          valor={<Moeda valor={recorte.validado} />}
          nota="Único valor que abate o aporte"
        />
        <Cartao
          titulo="Saldo oficial"
          destaque
          valor={<Moeda valor={recorte.saldoOficial} />}
          nota="Aporte menos prestação validada"
        />
        <Cartao
          titulo="Não validado"
          valor={<Moeda valor={recorte.naoValidado} />}
          nota="Lançado, sem efeito no saldo"
        />
        <Cartao
          titulo="Prestações pendentes"
          valor={inteiro(recorte.prestacoesPendentes)}
          nota={`${inteiro(recorte.missoes)} ${recorte.missoes === 1 ? "missão" : "missões"} no recorte`}
        />
      </Cartoes>

      <div className="mt-6" />

      {linhas.length === 0 ? (
        <EstadoVazio
          titulo="Sem exercícios para mostrar"
          descricao="Nenhum aporte cadastrado e nenhuma despesa lançada neste ciclo."
        />
      ) : (
        <Tabela
          rotulo="Execução por exercício"
          colunas={[
            { chave: "ano", texto: "Exercício" },
            { chave: "orcamento", texto: "Orçamento", alinhamento: "direita" },
            {
              chave: "preenchimento",
              texto: "Em preenchimento",
              alinhamento: "direita",
            },
            { chave: "enviado", texto: "Enviado", alinhamento: "direita" },
            { chave: "validado", texto: "Validado", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo oficial", alinhamento: "direita" },
            { chave: "missoes", texto: "Missões", alinhamento: "direita" },
            {
              chave: "pendentes",
              texto: "Pendentes",
              alinhamento: "direita",
            },
          ]}
          rodape={
            exercicio ? undefined : (
              <tr>
                <Celula>Ciclo</Celula>
                <Celula direita>
                  <Moeda valor={dados.total.orcamento} forte />
                </Celula>
                <Celula direita>
                  <Moeda valor={emPreenchimento(dados.total)} />
                </Celula>
                <Celula direita>
                  <Moeda valor={dados.total.enviado} />
                </Celula>
                <Celula direita>
                  <Moeda valor={dados.total.validado} forte />
                </Celula>
                <Celula direita>
                  <Moeda valor={dados.total.saldoOficial} forte />
                </Celula>
                {/* Contagem distinta do ciclo, e não a soma da coluna: a missão
                    que atravessa dois exercícios está nas duas linhas. */}
                <Celula direita>{inteiro(dados.total.missoes)}</Celula>
                <Celula direita>
                  {inteiro(dados.total.prestacoesPendentes)}
                </Celula>
              </tr>
            )
          }
        >
          {linhas.map((linha) => (
            <tr key={linha.ano}>
              <Celula>
                <span className="font-medium text-foreground">{linha.ano}</span>
              </Celula>
              <Celula direita>
                <Moeda valor={linha.orcamento} />
              </Celula>
              <Celula direita>
                <Moeda valor={emPreenchimento(linha)} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.enviado} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.validado} forte />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.saldoOficial} forte />
              </Celula>
              <Celula direita>{inteiro(linha.missoes)}</Celula>
              <Celula direita>
                {linha.prestacoesPendentes > 0 ? (
                  <Selo tom="aviso">{inteiro(linha.prestacoesPendentes)}</Selo>
                ) : (
                  inteiro(linha.prestacoesPendentes)
                )}
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}

      <p className="mt-3 text-xs text-subtle">{dados.aviso}</p>
    </Secao>
  );
}

/**
 * Editável hoje: em preenchimento mais devolvido com pendência.
 *
 * Os dois somam porque `COM_PENDENCIA` volta a aceitar lançamento (CG-054) —
 * são o mesmo estado do ponto de vista de quem prepara. Quantas prestações
 * voltaram por pendência é a coluna "Pendentes".
 */
function emPreenchimento(linha: Omit<ExecucaoExercicio, "ano">) {
  return somarMoeda([linha.emPreenchimento, linha.comPendencia]);
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
  redeId,
}: {
  base: string;
  anos: number[];
  ativo: number | null;
  /** Preservado ao trocar de exercício: os dois recortes são combináveis. */
  redeId: string | null;
}) {
  if (anos.length <= 1) return null;

  const href = (ano: number | null) => {
    const query = new URLSearchParams();
    if (ano) query.set("ano", String(ano));
    if (redeId) query.set("redeId", redeId);
    const texto = query.toString();
    return texto ? `${base}?${texto}` : base;
  };

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
      {item(href(null), "Todos", ativo === null)}
      {anos.map((ano) => item(href(ano), String(ano), ativo === ano))}
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
        referencias={referencias}
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

/**
 * Fila de análise do Comitê (CG-047).
 *
 * **O que define a fila é a rodada aberta**, não o status sozinho: os dois
 * andam juntos hoje, mas quem responde "o que aguarda decisão" é
 * `rodada_analise.encerrada_em is null` — e é ela que carrega desde quando.
 *
 * A lista é a mesma da aba Missões, com mais um recorte. Um serviço próprio
 * duplicaria a superfície de filtro (rede, país, período, responsável) e as
 * duas divergiriam na primeira mudança.
 */
async function FilaDeAnalise({
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
  parametros.set("statusAprovacao", "EM_ANALISE");
  // A fila do Comitê é curta por natureza; os indicadores contam a fila
  // inteira, não a página. Se um dia passar do teto, a tela avisa em vez de
  // mentir no número — mesma decisão da lista de parceiros.
  parametros.set("tamanho", "100");
  parametros.set("ordenar", "PERIODO");
  parametros.set("direcao", "ASC");

  const pagina = await apiFetch<PaginaMissoes>(
    `/programas/${programa}/${ciclo}/comite-gestor/missoes?${parametros}`,
  );

  const naFila = pagina.itens;
  const rodadas = [
    ...new Set(
      naFila.map((item) => item.rodadaAberta?.numero).filter(Boolean),
    ),
  ].sort((a, b) => (a ?? 0) - (b ?? 0)) as number[];
  const reanalises = naFila.filter(
    (item) => (item.rodadaAberta?.numero ?? 1) > 1,
  ).length;
  const paradas = naFila.filter(
    (item) => (item.rodadaAberta?.diasEsperando ?? 0) >= 7,
  ).length;

  const comFiltro = (campo: string, valor: string | null) => {
    const proximos = new URLSearchParams(filtros);
    proximos.set("aba", "analise");
    if (valor === null) proximos.delete(campo);
    else proximos.set(campo, valor);
    proximos.delete("pagina");
    return `${base}?${proximos}`;
  };

  return (
    <>
      <Cartoes>
        <Cartao
          titulo="Aguardando decisão"
          valor={inteiro(pagina.total)}
          nota="Missões com rodada de análise aberta"
          href={comFiltro("rodada", null)}
        />
        <Cartao
          titulo="Reanálise"
          valor={inteiro(reanalises)}
          nota="Já voltaram ao responsável ao menos uma vez"
        />
        <Cartao
          titulo="Há 7 dias ou mais"
          valor={inteiro(paradas)}
          nota="Contado em dias de calendário"
          destaque={paradas > 0}
        />
        <Cartao
          titulo="Equipe do Comitê"
          valor={inteiro(
            membros.filter(
              (membro) =>
                membro.situacao === "ATIVO" &&
                membro.tipoEquipe === "COMITE_GESTOR",
            ).length,
          )}
          nota="Quem delibera"
        />
      </Cartoes>

      <div className="mt-8" />

      {/* Os chips só oferecem as rodadas que existem na fila: um "rodada 3"
          fixo que nunca casa com nada é ruído, e some com a fila mudando. */}
      {rodadas.length > 1 ? (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-medium text-muted">Rodada</span>
          <Link
            href={comFiltro("rodada", null)}
            aria-current={filtros.rodada ? undefined : "true"}
            className={
              filtros.rodada
                ? "rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-primary"
                : "rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
            }
          >
            Todas
          </Link>
          {rodadas.map((numero) => (
            <Link
              key={numero}
              href={comFiltro("rodada", String(numero))}
              aria-current={
                filtros.rodada === String(numero) ? "true" : undefined
              }
              className={
                filtros.rodada === String(numero)
                  ? "rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-on-primary"
                  : "rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium text-muted hover:border-primary hover:text-primary"
              }
            >
              {numero === 1 ? "1ª (inicial)" : `${numero}ª`}
            </Link>
          ))}
        </div>
      ) : null}

      <FiltroMissoes
        base={base}
        filtros={{ ...filtros, aba: "analise" }}
        membros={membros}
        referencias={referencias}
      />

      <Secao
        titulo={`Aguardando decisão · ${pagina.total}`}
        descricao="A decisão é registrada na tela da missão, com o parecer e a data da reunião em que o colegiado deliberou."
      >
        {pagina.total > naFila.length ? (
          <Aviso tom="aviso">
            A fila tem {inteiro(pagina.total)} missões e a tela mostra as{" "}
            {inteiro(naFila.length)} mais antigas. Use os filtros para reduzir o
            recorte.
          </Aviso>
        ) : null}

        {naFila.length === 0 ? (
          <EstadoVazio
            titulo="Nada aguardando decisão"
            descricao="Missão entra aqui quando o responsável a envia para análise, e sai quando o Comitê decide."
          />
        ) : (
          <Tabela
            rotulo="Fila de análise"
            colunas={[
              { chave: "missao", texto: "Missão" },
              { chave: "rede", texto: "Rede" },
              { chave: "periodo", texto: "Período" },
              { chave: "rodada", texto: "Rodada", alinhamento: "direita" },
              { chave: "espera", texto: "Aguardando", alinhamento: "direita" },
              { chave: "acao", texto: <span className="sr-only">Ações</span> },
            ]}
          >
            {naFila.map((missao) => (
              <tr key={missao.id}>
                <Celula>
                  <Link
                    href={`${base}/missoes/${missao.id}?aba=analise`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {missao.titulo}
                  </Link>
                  <span className="mt-0.5 block text-xs text-muted">
                    {missao.codigo}
                    {missao.rodadaAberta?.submetidoPor
                      ? ` · enviada por ${missao.rodadaAberta.submetidoPor}`
                      : ""}
                  </span>
                </Celula>
                <Celula>
                  {missao.redes.length > 0 ? missao.redes.join(", ") : "—"}
                </Celula>
                <Celula>
                  {data(missao.dataInicio)} — {data(missao.dataFim)}
                </Celula>
                <Celula direita>
                  {missao.rodadaAberta ? (
                    missao.rodadaAberta.numero > 1 ? (
                      <Selo tom="aviso">{missao.rodadaAberta.numero}ª</Selo>
                    ) : (
                      <span className="tabular-nums">1ª</span>
                    )
                  ) : (
                    "—"
                  )}
                </Celula>
                <Celula direita>
                  <Espera dias={missao.rodadaAberta?.diasEsperando ?? null} />
                </Celula>
                <Celula direita>
                  <Link
                    href={`${base}/missoes/${missao.id}?aba=analise`}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    Analisar
                    <span className="sr-only"> {missao.codigo}</span>
                  </Link>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </>
  );
}

/**
 * Tempo de espera.
 *
 * Sete dias é o corte porque a reunião do Comitê é semanal: passar disso
 * significa que a missão atravessou uma reunião sem ser decidida, e é essa a
 * informação — não o número em si.
 */
function Espera({ dias }: { dias: number | null }) {
  if (dias === null) return <>—</>;
  const texto = dias === 0 ? "hoje" : dias === 1 ? "1 dia" : `${dias} dias`;
  return dias >= 7 ? (
    <Selo tom="perigo" titulo="Atravessou ao menos uma reunião semanal">
      {texto}
    </Selo>
  ) : (
    <span className="tabular-nums">{texto}</span>
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
  referencias,
}: {
  base: string;
  filtros: Record<string, string>;
  membros: MembroEquipeGestao[];
  referencias: ReferenciasMissao;
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
            {referencias.redes.map((rede) => (
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
        {/* País, parceiro e evento entraram com a CG-068: os relatórios os
            aceitam, e um filtro que só existe no relatório faria a lista
            deixar de reproduzir o recorte que ele exibe. */}
        <label className="block">
          <span className={ROTULO_FILTRO}>País</span>
          <select
            name="paisId"
            defaultValue={filtros.paisId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todos</option>
            {referencias.paises.map((pais) => (
              <option key={pais.id} value={pais.id}>
                {pais.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Parceiro</span>
          <select
            name="instituicaoId"
            defaultValue={filtros.instituicaoId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todos</option>
            {referencias.instituicoes.map((instituicao) => (
              <option key={instituicao.id} value={instituicao.id}>
                {instituicao.sigla
                  ? `${instituicao.sigla} — ${instituicao.nome}`
                  : instituicao.nome}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={ROTULO_FILTRO}>Evento</span>
          <input
            name="evento"
            defaultValue={filtros.evento ?? ""}
            placeholder="Nome do evento"
            className={ENTRADA_FILTRO}
          />
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

/** Campos que os relatórios aceitam — os mesmos da lista, sem paginação. */
const CAMPOS_RELATORIO = [
  "busca",
  "ano",
  "de",
  "ate",
  "paisId",
  "instituicaoId",
  "evento",
  "redeId",
  "status",
  "statusAprovacao",
  "situacaoPrestacao",
] as const;

/**
 * Aba Relatórios (CG-068).
 *
 * **Um filtro só, quatro relatórios.** Trocar de relatório preserva o recorte,
 * porque a pergunta que se faz é "e os parceiros deste mesmo conjunto?" — não
 * "e os parceiros de outro conjunto qualquer". O filtro fica na URL, como no
 * resto do módulo, então um recorte pode ser mandado por link.
 *
 * O cabeçalho de cada relatório repete quantas missões formam a base. É a
 * primeira coisa que um leitor compara entre dois relatórios, e ver o mesmo
 * número nos quatro é o que dá confiança de que eles falam do mesmo universo.
 */
async function Relatorios({
  programa,
  ciclo,
  base,
  consulta,
  referencias,
}: {
  programa: string;
  ciclo: string;
  base: string;
  consulta: ConsultaMissoes;
  referencias: ReferenciasMissao;
}) {
  const qual = relatorioDaConsulta(consulta.relatorio);
  const filtros: Record<string, string> = {};
  for (const campo of CAMPOS_RELATORIO) {
    const bruto = consulta[campo];
    const valor = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim();
    if (valor) filtros[campo] = valor;
  }
  const parametros = new URLSearchParams(filtros);
  const rota = `/programas/${programa}/${ciclo}/comite-gestor/relatorios`;

  const link = (proximo: Relatorio) => {
    const query = new URLSearchParams(filtros);
    query.set("aba", "relatorios");
    query.set("relatorio", proximo);
    return `${base}?${query}`;
  };

  return (
    <>
      <nav
        aria-label="Relatórios disponíveis"
        className="mb-5 flex flex-wrap items-center gap-2"
      >
        {(
          [
            ["missoes", "Missões"],
            ["parceiros", "Parceiros"],
            ["financas", "Finanças"],
            ["resultados", "Resultados"],
          ] as const
        ).map(([id, texto]) => (
          <Link
            key={id}
            href={link(id)}
            aria-current={qual === id ? "page" : undefined}
            className={
              qual === id
                ? "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
                : "rounded-xl border border-border-strong px-4 py-2 text-sm font-medium text-muted hover:border-primary hover:text-primary"
            }
          >
            {texto}
          </Link>
        ))}
      </nav>

      <FiltroRelatorio
        base={base}
        relatorio={qual}
        filtros={filtros}
        referencias={referencias}
      />

      <BaixarRelatorio
        programa={programa}
        ciclo={ciclo}
        relatorio={qual}
        parametros={parametros.toString()}
      />

      {qual === "missoes" ? (
        <RelatorioDeMissoes
          dados={await apiFetch<RelatorioMissoes>(
            `${rota}/missoes?${parametros}`,
          )}
          base={base}
        />
      ) : null}
      {qual === "parceiros" ? (
        <RelatorioDeParceiros
          dados={await apiFetch<RelatorioParceiros>(
            `${rota}/parceiros?${parametros}`,
          )}
        />
      ) : null}
      {qual === "financas" ? (
        <RelatorioDeFinancas
          dados={await apiFetch<RelatorioFinancas>(
            `${rota}/financas?${parametros}`,
          )}
        />
      ) : null}
      {qual === "resultados" ? (
        <RelatorioDeResultados
          dados={await apiFetch<RelatorioResultados>(
            `${rota}/resultados?${parametros}`,
          )}
        />
      ) : null}
    </>
  );
}

/**
 * Cabeçalho comum aos quatro.
 *
 * Diz de quantas missões o relatório fala **antes** de qualquer número: sem
 * isso, dois relatórios do mesmo recorte parecem falar de universos diferentes
 * só porque suas linhas contam coisas diferentes.
 */
function CabecalhoDoRelatorio({
  cabecalho,
  titulo,
  descricao,
}: {
  cabecalho: CabecalhoRelatorio;
  titulo: string;
  descricao: string;
}) {
  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
      <p className="mt-1 text-xs leading-5 text-muted">
        {descricao} Base: <strong className="font-medium">
          {inteiro(cabecalho.missoes)} {cabecalho.missoes === 1 ? "missão" : "missões"}
        </strong>{" "}
        no recorte atual.
      </p>
      {cabecalho.truncado ? (
        <div className="mt-3">
          <Aviso tom="aviso" titulo="Recorte grande demais">
            {cabecalho.aviso}
          </Aviso>
        </div>
      ) : null}
    </div>
  );
}

function RelatorioDeMissoes({
  dados,
  base,
}: {
  dados: RelatorioMissoes;
  base: string;
}) {
  // O estado vazio entra **no lugar da tabela**, e não no lugar do relatório.
  // Trocar a seção inteira tirava da tela o título e a contagem do recorte, e
  // quem chegasse por um filtro sem resultado não via o que estava filtrando —
  // os outros três relatórios desta aba sempre mantiveram as duas coisas.
  if (dados.linhas.length === 0) {
    return (
      <Secao titulo="Relatório de missões" descricao={dados.cabecalho.aviso}>
        <CabecalhoDoRelatorio
          cabecalho={dados.cabecalho}
          titulo="Missões do recorte"
          descricao="Uma linha por missão, com as duas dimensões da aprovação e da execução lado a lado."
        />
        <EstadoVazio
          titulo="Nenhuma missão neste recorte"
          descricao="Ajuste os filtros acima para montar o relatório."
        />
      </Secao>
    );
  }

  return (
    <Secao titulo="Relatório de missões" descricao={dados.cabecalho.aviso}>
      <CabecalhoDoRelatorio
        cabecalho={dados.cabecalho}
        titulo="Missões do recorte"
        descricao="Uma linha por missão, com as duas dimensões da aprovação e da execução lado a lado."
      />
      <Tabela
        rotulo="Relatório de missões"
        colunas={[
          { chave: "codigo", texto: "Missão" },
          { chave: "periodo", texto: "Período" },
          { chave: "redes", texto: "Redes" },
          { chave: "paises", texto: "Países" },
          { chave: "situacao", texto: "Situação" },
          { chave: "valor", texto: "Lançado", alinhamento: "direita" },
        ]}
        rodape={
          <tr>
            <Celula>
              <span className="font-medium text-foreground">
                {inteiro(dados.totais.missoes)} missões
              </span>
            </Celula>
            <Celula>—</Celula>
            <Celula>—</Celula>
            <Celula>—</Celula>
            <Celula>—</Celula>
            <Celula direita>
              <Moeda valor={dados.totais.valorPrestado} forte />
            </Celula>
          </tr>
        }
      >
        {dados.linhas.map((linha) => (
          <tr key={linha.id}>
            <Celula>
              <Link
                href={`${base}/missoes/${linha.id}`}
                className="font-medium text-foreground hover:text-primary hover:underline"
              >
                {linha.codigo}
              </Link>
              <p className="mt-0.5 text-xs text-muted">{linha.titulo}</p>
            </Celula>
            <Celula>
              <span className="whitespace-nowrap text-xs text-muted">
                {data(linha.dataInicio)} — {data(linha.dataFim)}
              </span>
            </Celula>
            <Celula>
              <span className="text-xs text-muted">
                {linha.redes.join(" · ") || "—"}
              </span>
            </Celula>
            <Celula>
              <span className="text-xs text-muted">
                {linha.paises.join(", ") || "—"}
              </span>
            </Celula>
            <Celula>
              {/* As duas dimensões sempre juntas e rotuladas (CG-006): mostrar
                  só uma faria "aprovada" ser lido como "realizada". */}
              <div className="flex flex-wrap gap-1">
                <Selo tom={TOM_STATUS[linha.status]}>
                  {ROTULO_STATUS[linha.status]}
                </Selo>
                <Selo tom={TOM_APROVACAO[linha.statusAprovacao]}>
                  {rotulo(linha.statusAprovacao)}
                </Selo>
                <Selo tom={TOM_PRESTACAO[linha.situacaoPrestacao]}>
                  {ROTULO_PRESTACAO[linha.situacaoPrestacao]}
                </Selo>
              </div>
            </Celula>
            <Celula direita>
              <Moeda valor={linha.valorPrestado} />
            </Celula>
          </tr>
        ))}
      </Tabela>
    </Secao>
  );
}

function RelatorioDeParceiros({ dados }: { dados: RelatorioParceiros }) {
  return (
    <Secao
      titulo="Relatório de parceiros"
      descricao="Instituições alcançadas pelas missões do recorte."
    >
      <CabecalhoDoRelatorio
        cabecalho={dados.cabecalho}
        titulo={`${inteiro(dados.totais.parceiros)} parceiros cadastrados`}
        descricao={`${inteiro(dados.totais.semCadastro)} paradas foram registradas com instituição digitada à mão e ainda não têm cadastro — são candidatas. ${inteiro(dados.totais.convenios)} convênios nasceram destas missões.`}
      />
      {dados.linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum parceiro cadastrado neste recorte"
          descricao="As missões deste recorte não registraram parada em instituição cadastrada."
        />
      ) : (
        <Tabela
          rotulo="Relatório de parceiros"
          colunas={[
            { chave: "nome", texto: "Instituição" },
            { chave: "local", texto: "Local" },
            { chave: "missoes", texto: "Missões", alinhamento: "direita" },
            { chave: "atividades", texto: "Paradas", alinhamento: "direita" },
            { chave: "convenios", texto: "Convênios", alinhamento: "direita" },
          ]}
        >
          {dados.linhas.map((linha) => (
            <tr key={linha.id}>
              <Celula>
                <span className="font-medium text-foreground">
                  {linha.nome}
                </span>
                {linha.sigla ? (
                  <span className="ml-2 text-xs text-subtle">
                    {linha.sigla}
                  </span>
                ) : null}
              </Celula>
              <Celula>
                <span className="text-xs text-muted">
                  {[linha.cidade, linha.pais].filter(Boolean).join(", ") || "—"}
                </span>
              </Celula>
              {/* Missões e paradas são perguntas diferentes: o parceiro visitado
                  duas vezes na mesma viagem recebeu uma missão. */}
              <Celula direita>{inteiro(linha.missoes)}</Celula>
              <Celula direita>{inteiro(linha.atividades)}</Celula>
              <Celula direita>{inteiro(linha.convenios)}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function RelatorioDeFinancas({ dados }: { dados: RelatorioFinancas }) {
  return (
    <Secao
      titulo="Relatório financeiro"
      descricao="Despesa das missões do recorte, por exercício e tipo. Somente a prestação validada abate o aporte."
    >
      <CabecalhoDoRelatorio
        cabecalho={dados.cabecalho}
        titulo="Despesa por exercício e tipo"
        descricao="O exercício é o do lançamento, não o das datas da missão: uma viagem de dezembro paga em janeiro pertence ao ano que o lançamento diz."
      />
      {dados.linhas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma despesa lançada neste recorte"
          descricao="As missões deste recorte ainda não têm despesa registrada."
        />
      ) : (
        <Tabela
          rotulo="Relatório financeiro"
          colunas={[
            { chave: "ano", texto: "Exercício" },
            { chave: "tipo", texto: "Tipo de despesa" },
            { chave: "preench", texto: "Em preenchimento", alinhamento: "direita" },
            { chave: "pend", texto: "Com pendência", alinhamento: "direita" },
            { chave: "env", texto: "Enviado", alinhamento: "direita" },
            { chave: "val", texto: "Validado", alinhamento: "direita" },
            { chave: "total", texto: "Total", alinhamento: "direita" },
          ]}
          rodape={
            <tr>
              <Celula>Total</Celula>
              <Celula>—</Celula>
              <Celula direita>
                <Moeda valor={dados.totais.emPreenchimento} />
              </Celula>
              <Celula direita>
                <Moeda valor={dados.totais.comPendencia} />
              </Celula>
              <Celula direita>
                <Moeda valor={dados.totais.enviado} />
              </Celula>
              <Celula direita>
                <Moeda valor={dados.totais.validado} forte />
              </Celula>
              <Celula direita>
                <Moeda valor={dados.totais.total} forte />
              </Celula>
            </tr>
          }
        >
          {dados.linhas.map((linha) => (
            <tr key={`${linha.exercicio}-${linha.tipo}`}>
              <Celula>{linha.exercicio}</Celula>
              <Celula>{rotulo(linha.tipo)}</Celula>
              <Celula direita>
                <Moeda valor={linha.emPreenchimento} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.comPendencia} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.enviado} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.validado} />
              </Celula>
              <Celula direita>
                <Moeda valor={linha.total} />
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function RelatorioDeResultados({ dados }: { dados: RelatorioResultados }) {
  const tabela = (
    titulo: string,
    linhas: LinhaResultado[],
    vazio: string,
  ) => (
    <div className="mt-6">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{titulo}</h4>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted">{vazio}</p>
      ) : (
        <Tabela
          rotulo={titulo}
          colunas={[
            { chave: "tipo", texto: "Tipo" },
            { chave: "situacao", texto: "Situação" },
            { chave: "qtd", texto: "Quantidade", alinhamento: "direita" },
            { chave: "missoes", texto: "Missões", alinhamento: "direita" },
          ]}
        >
          {linhas.map((linha) => (
            <tr key={`${linha.tipo}-${linha.situacao}`}>
              <Celula>{rotulo(linha.tipo)}</Celula>
              <Celula>
                <Selo>{rotulo(linha.situacao)}</Selo>
              </Celula>
              <Celula direita>{inteiro(linha.quantidade)}</Celula>
              {/* Dois produtos de uma viagem são dois produtos e uma missão. */}
              <Celula direita>{inteiro(linha.missoes)}</Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </div>
  );

  return (
    <Secao
      titulo="Relatório de resultados"
      descricao="Produtos e convênios gerados pelas missões do recorte."
    >
      <CabecalhoDoRelatorio
        cabecalho={dados.cabecalho}
        titulo={`${inteiro(dados.totais.produtos)} produtos e ${inteiro(dados.totais.convenios)} convênios`}
        descricao={`${inteiro(dados.totais.semProdutoDeclarado)} missões declararam não ter gerado produto; ${inteiro(dados.totais.semResposta)} ainda não responderam. São coisas diferentes: só a segunda é pendência.`}
      />
      {tabela(
        "Produtos",
        dados.produtos,
        "Nenhum produto cadastrado nas missões deste recorte.",
      )}
      {tabela(
        "Convênios",
        dados.convenios,
        "Nenhum convênio nasceu das missões deste recorte.",
      )}
    </Secao>
  );
}

/**
 * Barra de filtros dos relatórios.
 *
 * `<form method="get">` de verdade, como na aba Missões: o recorte fica na URL,
 * pode ser compartilhado e recarregado, e funciona sem JavaScript. O relatório
 * escolhido viaja num campo oculto para não se perder ao filtrar.
 */
function FiltroRelatorio({
  base,
  relatorio,
  filtros,
  referencias,
}: {
  base: string;
  relatorio: Relatorio;
  filtros: Record<string, string>;
  referencias: ReferenciasMissao;
}) {
  return (
    <form
      method="get"
      action={base}
      className="mb-7 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="aba" value="relatorios" />
      <input type="hidden" name="relatorio" value={relatorio} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-busca">
            Busca
          </label>
          <input
            id="rel-busca"
            name="busca"
            defaultValue={filtros.busca ?? ""}
            placeholder="Código, título, evento ou parceiro"
            className={ENTRADA_FILTRO}
          />
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-de">
            De
          </label>
          <input
            id="rel-de"
            name="de"
            type="date"
            defaultValue={filtros.de ?? ""}
            className={ENTRADA_FILTRO}
          />
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-ate">
            Até
          </label>
          <input
            id="rel-ate"
            name="ate"
            type="date"
            defaultValue={filtros.ate ?? ""}
            className={ENTRADA_FILTRO}
          />
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-rede">
            Rede
          </label>
          <select
            id="rel-rede"
            name="redeId"
            defaultValue={filtros.redeId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {referencias.redes.map((rede) => (
              <option key={rede.id} value={rede.id}>
                {rede.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-pais">
            País
          </label>
          <select
            id="rel-pais"
            name="paisId"
            defaultValue={filtros.paisId ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todos</option>
            {referencias.paises.map((pais) => (
              <option key={pais.id} value={pais.id}>
                {pais.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-evento">
            Evento
          </label>
          <input
            id="rel-evento"
            name="evento"
            defaultValue={filtros.evento ?? ""}
            placeholder="Nome do evento"
            className={ENTRADA_FILTRO}
          />
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-status">
            Situação da missão
          </label>
          <select
            id="rel-status"
            name="status"
            defaultValue={filtros.status ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {Object.entries(ROTULO_STATUS).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={ROTULO_FILTRO} htmlFor="rel-prestacao">
            Prestação
          </label>
          <select
            id="rel-prestacao"
            name="situacaoPrestacao"
            defaultValue={filtros.situacaoPrestacao ?? ""}
            className={ENTRADA_FILTRO}
          >
            <option value="">Todas</option>
            {Object.entries(ROTULO_PRESTACAO).map(([valor, texto]) => (
              <option key={valor} value={valor}>
                {texto}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="submit"
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
        >
          Aplicar filtros
        </button>
        <Link href={`${base}?aba=relatorios&relatorio=${relatorio}`} className={BOTAO_PAGINA}>
          Limpar
        </Link>
      </div>
    </form>
  );
}

/**
 * Baixar o relatório nos três formatos (CG-069).
 *
 * Links, e não botões com JavaScript: o download é uma requisição GET com o
 * mesmo filtro que já está na URL, e o navegador sabe salvar arquivo sozinho.
 * Um botão exigiria buscar o conteúdo no cliente e recriar o salvamento à mão —
 * mais código para fazer pior o que o `Content-Disposition` já faz.
 *
 * Aponta para `/api/bff/...`, e não para a API: o token nunca chega ao
 * JavaScript da página, e o BFF injeta o `Bearer` no servidor.
 */
function BaixarRelatorio({
  programa,
  ciclo,
  relatorio,
  parametros,
}: {
  programa: string;
  ciclo: string;
  relatorio: Relatorio;
  parametros: string;
}) {
  const rota = `/api/bff/programas/${programa}/${ciclo}/comite-gestor/relatorios/${relatorio}/exportacao`;
  const sufixo = parametros ? `?${parametros}` : "";

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-xs font-medium text-muted">Baixar</span>
      {(
        [
          ["pdf", "PDF"],
          ["xlsx", "Excel"],
          ["csv", "CSV"],
        ] as const
      ).map(([formato, texto]) => (
        <a
          key={formato}
          href={`${rota}/${formato}${sufixo}`}
          className={BOTAO_PAGINA}
          // O rótulo visível é só "PDF"; quem usa leitor de tela ouviria três
          // links sem saber do que são. O `aria-label` diz o relatório inteiro
          // (CG-064). O recorte da tela vai na URL: exportar sem ele devolveria
          // um arquivo maior do que o que a pessoa está vendo.
          aria-label={`Baixar relatório de ${ROTULO_RELATORIO[relatorio]} em ${texto}`}
        >
          {texto}
        </a>
      ))}
    </div>
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
  return aba === "missoes" ||
    aba === "analise" ||
    aba === "relatorios" ||
    aba === "equipes"
    ? aba
    : "visao-geral";
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
