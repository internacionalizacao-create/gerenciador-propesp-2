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
import { apiFetch } from "@/lib/api";
import type {
  ComiteGestor,
  ExecucaoComite,
  ExecucaoExercicio,
  Me,
  MembroEquipeGestao,
  PaginaMissoes,
  PainelComite,
  PendenciaMissao,
  PessoaDisponivel,
  ReferenciasMissao,
  ResumoMissoes,
  SituacaoPrestacao,
  SituacaoTemporalMissao,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import { data, inteiro, percentual, rotulo, somarMoeda } from "@/lib/formato";

type Aba = "visao-geral" | "missoes" | "analise" | "equipes";

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
      aba === "missoes" || aba === "analise"
        ? apiFetch<ReferenciasMissao>(
            `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
          )
        : Promise.resolve({ paises: [], instituicoes: [], redes: [] }),
      // Só a Visão geral usa a execução; buscá-la nas outras abas pagaria duas
      // agregações sobre a prestação para desenhar uma lista.
      aba === "visao-geral"
        ? apiFetch<ExecucaoComite>(
            `/programas/${programa}/${ciclo}/comite-gestor/execucao`,
          )
        : Promise.resolve(null),
      aba === "visao-geral"
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
          execucao={execucao}
          painel={painel}
          membros={membros}
          base={base}
          exercicio={exercicio}
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
      {aba === "analise" ? (
        <FilaDeAnalise
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
    { id: "analise", texto: "Análise" },
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
 * Link para a lista que produziu o número, **carregando o recorte do painel**.
 *
 * É o que sustenta o critério de aceite: o cartão e a lista do outro lado
 * partem exatamente do mesmo universo. Perder `ano` ou `redeId` aqui faria o
 * clique abrir uma contagem maior do que a exibida.
 */
function linkDaLista(
  base: string,
  recorte: PainelComite["recorte"],
  filtros: Record<string, string>,
  aba: "missoes" | "analise",
): string {
  const query = new URLSearchParams({ aba });
  if (recorte.ano) query.set("ano", String(recorte.ano));
  if (recorte.redeId) query.set("redeId", recorte.redeId);
  for (const [campo, valor] of Object.entries(filtros)) query.set(campo, valor);
  return `${base}?${query}`;
}

function notaDoRecorte(recorte: PainelComite["recorte"]): string {
  const partes = [
    recorte.ano ? `Exercício ${recorte.ano}` : "Ciclo inteiro",
    recorte.redeNome ?? "Todas as redes",
  ];
  return partes.join(" · ");
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
        redes={referencias.redes}
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
  return aba === "missoes" || aba === "analise" || aba === "equipes"
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
