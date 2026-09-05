import Link from "next/link";

import {
  DecidirMissao,
  EnviarParaAnalise,
  ReabrirAnalise,
} from "@/componentes/formularios/acoes-analise";
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
  AnexoResumo,
  AtividadeMissao,
  AvaliacaoSubmissao,
  DespesaMissao,
  Me,
  MissaoDetalhe,
  ParticipanteMissao,
  PrestacaoMissao,
  RodadaAnalise,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import { data, dataHora, inteiro, rotulo } from "@/lib/formato";

/**
 * CG-045 · Detalhe da missão.
 *
 * A arquitetura da informação aceita em 2026-09-05 coloca prestação,
 * documentos, análise e produtos **dentro** desta página, em abas, em vez das
 * telas globais que o PDF propunha.
 *
 * Quatro abas: **Resumo** (roteiro e participantes), **Análise** (rodadas,
 * pareceres, enviar e decidir), **Documentos** e **Prestação**.
 *
 * As duas últimas são **leitura**. Anexar arquivo é a CG-051 pelo endpoint, e
 * lançar despesa é a CG-053 — trazer os formulários para cá anteciparia uma
 * task que tem critérios próprios.
 *
 * Tudo vem de `GET .../missoes/:id`. A tela não soma nem deriva nada: os dias
 * inclusivos, os totais e a situação temporal já chegam calculados.
 */

type Aba = "resumo" | "analise" | "documentos" | "prestacao";

const ABAS_VALIDAS: Aba[] = ["resumo", "analise", "documentos", "prestacao"];

function normalizarAba(valor: string | string[] | undefined): Aba {
  return ABAS_VALIDAS.includes(valor as Aba) ? (valor as Aba) : "resumo";
}

export default async function MissaoDetalhePagina({
  params,
  searchParams,
}: {
  params: Promise<{ programa: string; ciclo: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { programa, ciclo, id } = await params;
  const aba = normalizarAba((await searchParams).aba);
  const me = await apiFetch<Me>("/me");
  const base = `/programas/${programa}/${ciclo}/comite-gestor`;

  if (!me.permissions.includes("missao:read")) {
    return (
      <Pagina titulo="Missão" descricao="Detalhe da missão institucional.">
        <EstadoVazio
          titulo="Acesso restrito"
          descricao="Nesta etapa, somente o perfil administrador pode consultar as missões do Comitê Gestor."
        />
      </Pagina>
    );
  }

  const rotaMissao = `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;
  const [missao, rodadas, requisitos, documentos, prestacao] =
    await Promise.all([
      apiFetch<MissaoDetalhe>(rotaMissao),
      apiFetch<RodadaAnalise[]>(`${rotaMissao}/analise`),
      apiFetch<AvaliacaoSubmissao>(`${rotaMissao}/requisitos`),
      apiFetch<AnexoResumo[]>(
        `/anexos?entidadeTipo=MISSAO_COMITE&entidadeId=${id}`,
      ),
      // Nulo quando a missão não tem prestação — ausência é ausência de linha,
      // não o estado `NAO_INICIADA` (CG-013).
      apiFetch<PrestacaoMissao | null>(`${rotaMissao}/prestacao`),
    ]);

  const responsaveis = missao.participantes.filter(
    (pessoa) => pessoa.papel === "RESPONSAVEL",
  );
  const contexto = { programa, ciclo, id };
  const podeEnviar =
    me.permissions.includes("missao:submit") &&
    (missao.statusAprovacao === "RASCUNHO" ||
      missao.statusAprovacao === "AJUSTES_SOLICITADOS") &&
    missao.status !== "CANCELADA";
  const podeDecidir =
    me.permissions.includes("missao:decide") &&
    missao.statusAprovacao === "EM_ANALISE";
  const podeReabrir =
    me.permissions.includes("missao:reopen") &&
    (missao.statusAprovacao === "APROVADA" ||
      missao.statusAprovacao === "REPROVADA");

  return (
    <Pagina
      titulo={`${missao.codigo} · ${missao.titulo}`}
      descricao={
        [
          missao.tipo ? rotulo(missao.tipo) : null,
          missao.redes.map((rede) => rede.nome).join(", ") || "Sem rede",
          `${data(missao.dataInicio)} a ${data(missao.dataFim)}`,
        ]
          .filter(Boolean)
          .join(" · ") || "Missão institucional."
      }
    >
      <p className="mb-6">
        <Link
          href={`${base}?aba=missoes`}
          className="text-sm text-primary hover:underline"
        >
          ← Voltar para missões
        </Link>
      </p>

      {/*
        As duas dimensões aparecem juntas e separadas (CG-006). Mostrar só uma
        produziria a leitura errada mais provável: "aprovada" lida como
        "realizada", ou "concluída" lida como "aprovada pelo Comitê".
      */}
      <div className="mb-7 flex flex-wrap items-center gap-2">
        <SeloAprovacao status={missao.statusAprovacao} />
        <SeloExecucao status={missao.status} />
        <Selo tom="neutro">{rotulo(missao.situacaoTemporal)}</Selo>
      </div>

      <Abas base={`${base}/missoes/${id}`} ativa={aba} />

      <Cartoes>
        <Cartao titulo="Dias" valor={inteiro(missao.numeroDias)} />
        <Cartao
          titulo="Participantes"
          valor={inteiro(missao.participantes.length)}
        />
        <Cartao
          titulo="Paradas no roteiro"
          valor={inteiro(missao.atividades.length)}
        />
        <Cartao
          titulo="Países"
          valor={missao.paises.length > 0 ? missao.paises.join(", ") : "—"}
        />
      </Cartoes>

      <div className="mt-10" />

      {aba === "analise" ? (
        <Analise
          missao={missao}
          rodadas={rodadas}
          requisitos={requisitos}
          contexto={contexto}
          podeEnviar={podeEnviar}
          podeDecidir={podeDecidir}
          podeReabrir={podeReabrir}
        />
      ) : aba === "documentos" ? (
        <Documentos documentos={documentos} />
      ) : aba === "prestacao" ? (
        <Prestacao prestacao={prestacao} />
      ) : (
        <>
      <Secao titulo="Resumo">
        <dl className="grid gap-x-8 gap-y-4 rounded-2xl border border-border bg-surface px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Dado rotuloTexto="Código" valor={missao.codigo} />
          <Dado
            rotuloTexto="Tipo"
            valor={missao.tipo ? rotulo(missao.tipo) : null}
          />
          <Dado
            rotuloTexto="Unidade ou departamento"
            valor={missao.unidadeDepartamento}
          />
          <Dado rotuloTexto="Início" valor={data(missao.dataInicio)} />
          <Dado rotuloTexto="Fim" valor={data(missao.dataFim)} />
          <Dado
            rotuloTexto="Responsável"
            valor={
              responsaveis.length > 0
                ? responsaveis.map((pessoa) => pessoa.nome).join(", ")
                : null
            }
          />
          <Dado
            rotuloTexto="Redes coordenadoras"
            valor={
              missao.redes.length > 0
                ? missao.redes.map((rede) => rede.nome).join(", ")
                : null
            }
          />
        </dl>

        <div className="mt-4 rounded-2xl border border-border bg-surface px-5 py-4">
          <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
            Objetivo
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm text-foreground">
            {missao.objetivo}
          </p>
        </div>

        {missao.observacoes ? (
          <p className="mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
            {missao.observacoes}
          </p>
        ) : null}
      </Secao>

      <Secao
        titulo="Roteiro"
        descricao="Cada parada tem período, destino e propósito próprios. A atividade não prevista continua visivelmente diferente do que foi planejado desde o início."
      >
        {missao.atividades.length === 0 ? (
          <EstadoVazio
            titulo="Roteiro ainda não cadastrado"
            descricao="Esta missão foi criada sem paradas. Edite a missão para incluir o roteiro."
          />
        ) : (
          <Tabela
            rotulo="Roteiro da missão"
            colunas={[
              { chave: "ordem", texto: "#" },
              { chave: "atividade", texto: "Atividade" },
              { chave: "destino", texto: "Destino" },
              { chave: "periodo", texto: "Período" },
              { chave: "dias", texto: "Dias", alinhamento: "direita" },
              { chave: "situacao", texto: "Situação" },
            ]}
          >
            {[...missao.atividades]
              .sort((a, b) => a.ordem - b.ordem)
              .map((atividade) => (
                <LinhaAtividade key={atividade.id} atividade={atividade} />
              ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Participantes"
        descricao="Qualquer pessoa pode integrar uma missão; o vínculo com uma das equipes é opcional e aparece quando existe."
      >
        {missao.participantes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum participante"
            descricao="Edite a missão para incluir quem viaja ou apoia."
          />
        ) : (
          <Tabela
            rotulo="Participantes da missão"
            colunas={[
              { chave: "pessoa", texto: "Pessoa" },
              { chave: "papel", texto: "Papel" },
              { chave: "vinculo", texto: "Vínculo" },
              { chave: "periodo", texto: "Período" },
              { chave: "dias", texto: "Dias", alinhamento: "direita" },
            ]}
          >
            {missao.participantes.map((pessoa) => (
              <LinhaParticipante key={pessoa.id} pessoa={pessoa} />
            ))}
          </Tabela>
        )}
      </Secao>
        </>
      )}
    </Pagina>
  );
}

/**
 * Navegação entre as fatias do detalhe.
 *
 * Só nasceu quando houve a segunda aba: uma aba sozinha é decoração, e o
 * "Resumo" fica sem `?aba=` para que a URL do detalhe continue sendo a curta.
 */
function Abas({ base, ativa }: { base: string; ativa: Aba }) {
  const abas: { id: Aba; texto: string }[] = [
    { id: "resumo", texto: "Resumo" },
    { id: "analise", texto: "Análise" },
    { id: "documentos", texto: "Documentos" },
    { id: "prestacao", texto: "Prestação" },
  ];

  return (
    <nav
      aria-label="Áreas da missão"
      className="mb-7 flex flex-wrap gap-2 border-b border-border pb-3"
    >
      {abas.map((item) => (
        <Link
          key={item.id}
          href={item.id === "resumo" ? base : `${base}?aba=${item.id}`}
          aria-current={ativa === item.id ? "page" : undefined}
          className={
            ativa === item.id
              ? "rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary"
              : "rounded-xl px-4 py-2 text-sm font-medium text-muted hover:bg-surface-muted hover:text-foreground"
          }
        >
          {item.texto}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Aba de análise: checklist, ações e o histórico de rodadas.
 *
 * O histórico vem primeiro na leitura mas depois na tela, porque quem abre esta
 * aba num fluxo normal quer agir — enviar, decidir — e não reler o passado.
 */
function Analise({
  missao,
  rodadas,
  requisitos,
  contexto,
  podeEnviar,
  podeDecidir,
  podeReabrir,
}: {
  missao: MissaoDetalhe;
  rodadas: RodadaAnalise[];
  requisitos: AvaliacaoSubmissao;
  contexto: { programa: string; ciclo: string; id: string };
  podeEnviar: boolean;
  podeDecidir: boolean;
  podeReabrir: boolean;
}) {
  const aberta = rodadas.find((rodada) => rodada.encerradaEm === null);

  return (
    <>
      <Secao
        titulo="Situação da análise"
        descricao="A aprovação é um eixo próprio: aprovar habilita a confirmação da realização, mas não marca a missão como realizada."
        acoes={
          <div className="flex flex-wrap gap-2">
            {podeDecidir ? <DecidirMissao contexto={contexto} /> : null}
            {podeReabrir ? <ReabrirAnalise contexto={contexto} /> : null}
          </div>
        }
      >
        <div className="rounded-2xl border border-border bg-surface px-5 py-5">
          <p className="text-sm text-foreground">
            {DESCRICAO_APROVACAO[missao.statusAprovacao]}
          </p>

          {aberta ? (
            <p className="mt-2 text-sm text-muted">
              {aberta.numero}ª rodada, aberta em {dataHora(aberta.submetidoEm)}
              {aberta.submetidoPor ? ` por ${aberta.submetidoPor}` : ""}.
            </p>
          ) : null}

          {podeEnviar ? (
            <div className="mt-4">
              <EnviarParaAnalise contexto={contexto} />
            </div>
          ) : null}
        </div>
      </Secao>

      {requisitos.requisitos.length > 0 ? (
        <Secao
          titulo="Documentos exigidos"
          descricao="A lista vem do cadastro do ciclo, não do código: um tipo novo de missão pode exigir outros documentos sem alteração no sistema."
        >
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {requisitos.requisitos.map((requisito) => (
              <li
                key={`${requisito.categoria}-${requisito.obrigatorio}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <span className="text-sm text-foreground">
                  {requisito.descricao ?? rotulo(requisito.categoria)}
                </span>
                <span className="flex items-center gap-2">
                  {requisito.obrigatorio ? null : (
                    <Selo tom="neutro">Recomendado</Selo>
                  )}
                  <Selo tom={requisito.atendido ? "sucesso" : "aviso"}>
                    {requisito.atendido ? "Anexado" : "Falta"}
                  </Selo>
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao
        titulo="Histórico"
        descricao="Cada envio e cada reabertura é uma rodada numerada. Nenhuma decisão é apagada ou sobrescrita — reenviar cria rodada nova."
      >
        {rodadas.length === 0 ? (
          <EstadoVazio
            titulo="Missão ainda não enviada"
            descricao="O histórico começa no primeiro envio para o Comitê Gestor."
          />
        ) : (
          <ol className="space-y-4">
            {rodadas.map((rodada) => (
              <LinhaRodada key={rodada.id} rodada={rodada} />
            ))}
          </ol>
        )}
      </Secao>
    </>
  );
}

function LinhaRodada({ rodada }: { rodada: RodadaAnalise }) {
  const decisao = rodada.decisao;

  return (
    <li className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-foreground">
          {rodada.numero}ª rodada
        </span>
        {rodada.origem === "REABERTURA" ? (
          <Selo tom="aviso">Reabertura</Selo>
        ) : null}
        {decisao ? (
          <Selo tom={TOM_DECISAO[decisao.acao]}>
            {ROTULO_DECISAO[decisao.acao]}
          </Selo>
        ) : (
          <Selo tom="info">Aguardando decisão</Selo>
        )}
      </div>

      <p className="mt-1.5 text-xs text-muted">
        Enviada em {dataHora(rodada.submetidoEm)}
        {rodada.submetidoPor ? ` por ${rodada.submetidoPor}` : ""}.
      </p>

      {rodada.justificativa ? (
        <p className="mt-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          <span className="font-medium text-foreground">
            Motivo da reabertura:{" "}
          </span>
          {rodada.justificativa}
        </p>
      ) : null}

      {decisao ? (
        <div className="mt-3 border-t border-border pt-3">
          <p className="whitespace-pre-line text-sm text-foreground">
            {decisao.parecer}
          </p>
          <p className="mt-1.5 text-xs text-muted">
            {decisao.decididoPor ?? "Autor não registrado"} ·{" "}
            {dataHora(decisao.decididoEm)}
            {decisao.reuniaoData
              ? ` · reunião de ${data(decisao.reuniaoData)}`
              : " · devolução do relator, sem reunião"}
          </p>

          {decisao.observacoes ? (
            <p className="mt-2 text-sm text-muted">{decisao.observacoes}</p>
          ) : null}

          {/*
            A lista é a fotografia do instante da decisão, com a versão de cada
            arquivo. Não é "os anexos da missão": anexar depois não muda o que o
            Comitê diz ter analisado.
          */}
          {decisao.documentosAnalisados.length > 0 ? (
            <div className="mt-3">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                Documentos analisados
              </p>
              <ul className="mt-1.5 space-y-1">
                {decisao.documentosAnalisados.map((documento) => (
                  <li key={documento.anexoId} className="text-sm text-muted">
                    {documento.nome}{" "}
                    <span className="text-subtle">
                      ({rotulo(documento.categoria)}, versão {documento.versao})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 text-sm text-subtle italic">
              Nenhum documento anexado quando esta decisão foi tomada.
            </p>
          )}
        </div>
      ) : null}
    </li>
  );
}

const ROTULO_DECISAO = {
  APROVAR: "Aprovada",
  SOLICITAR_AJUSTES: "Ajustes solicitados",
  REPROVAR: "Reprovada",
} as const;

const TOM_DECISAO = {
  APROVAR: "sucesso",
  SOLICITAR_AJUSTES: "aviso",
  REPROVAR: "perigo",
} as const;

/** O que cada estado significa para quem está olhando, não o rótulo do enum. */
const DESCRICAO_APROVACAO: Record<StatusAprovacaoMissao, string> = {
  RASCUNHO: "A missão ainda não foi enviada ao Comitê Gestor.",
  EM_ANALISE:
    "Em análise pelo Comitê. A edição da missão fica bloqueada até a decisão, para que o parecer não recaia sobre um texto diferente do que foi lido.",
  AJUSTES_SOLICITADOS:
    "O Comitê devolveu a missão para ajustes. Ela voltou a ser editável e um novo envio abre outra rodada.",
  APROVADA:
    "Aprovada pelo Comitê. Reabrir a análise é ato do administrador e não apaga esta decisão.",
  REPROVADA:
    "Reprovada pelo Comitê. Reabrir a análise é ato do administrador e não apaga esta decisão.",
};

/**
 * Aba de documentos: leitura da lista, com download pelo endpoint autenticado.
 *
 * **Não há link para arquivo estático.** A chave de armazenamento é opaca e
 * nunca sai da API (CG-014); o download passa por `/anexos/:id/conteudo`, que
 * confere a permissão da entidade de destino a cada requisição.
 *
 * Anexar arquivo continua sendo a CG-051 pelo endpoint; a interface de envio
 * entra com a CG-053, junto com o formulário de despesa.
 */
function Documentos({ documentos }: { documentos: AnexoResumo[] }) {
  const ativos = documentos.filter((documento) => documento.ativo);

  return (
    <Secao
      titulo="Documentos da missão"
      descricao="Substituir um arquivo cria versão nova e preserva a anterior — não há exclusão, só inativação."
    >
      {ativos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento anexado"
          descricao="Projeto e justificativa são exigidos antes do envio ao Comitê. A aba Análise mostra o que falta."
        />
      ) : (
        <Tabela
          rotulo="Documentos da missão"
          colunas={[
            { chave: "arquivo", texto: "Arquivo" },
            { chave: "categoria", texto: "Categoria" },
            { chave: "versao", texto: "Versão", alinhamento: "direita" },
            { chave: "envio", texto: "Enviado" },
            { chave: "acoes", texto: "Ações" },
          ]}
        >
          {ativos.map((documento) => (
            <tr key={documento.id}>
              <Celula>
                <span className="font-medium text-foreground">
                  {documento.nome}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {tamanhoLegivel(documento.tamanho)}
                  {documento.legenda ? ` · ${documento.legenda}` : ""}
                </span>
              </Celula>
              <Celula>{rotulo(documento.categoria)}</Celula>
              <Celula direita className="tabular-nums">
                {documento.versao}
              </Celula>
              <Celula>
                {dataHora(documento.enviadoEm)}
                {documento.enviadoPor ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    {documento.enviadoPor}
                  </span>
                ) : null}
              </Celula>
              <Celula>
                <a
                  href={`/api/bff/anexos/${documento.id}/conteudo`}
                  className="text-sm text-primary hover:underline"
                >
                  Baixar
                  <span className="sr-only"> {documento.nome}</span>
                </a>
              </Celula>
            </tr>
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

/**
 * Aba de prestação — **leitura**.
 *
 * `prestacao` nula é o caso normal de missão que ainda não gastou, e é o
 * critério de aceite da CG-045: a página abre e diz "Prestação não iniciada"
 * em vez de quebrar. Lançar despesa, enviar e validar são a CG-053/CG-054.
 *
 * Total nulo continua "A definir", nunca R$ 0,00: prestação sem despesa e
 * prestação de valor zero são coisas diferentes.
 */
function Prestacao({ prestacao }: { prestacao: PrestacaoMissao | null }) {
  if (!prestacao) {
    return (
      <Secao titulo="Prestação de contas">
        <EstadoVazio
          titulo="Prestação não iniciada"
          descricao="A prestação abre automaticamente quando a viagem é marcada como realizada, ou pode ser iniciada manualmente na tela de prestação."
        />
      </Secao>
    );
  }

  return (
    <>
      <Secao
        titulo="Prestação de contas"
        descricao="Todos os valores em reais: a conversão de despesa feita no exterior acontece antes do lançamento (CG-009)."
      >
        <Cartoes>
          <Cartao
            titulo="Total prestado"
            valor={<Moeda valor={prestacao.total} forte />}
            destaque
          />
          <Cartao
            titulo="Situação"
            valor={rotulo(prestacao.status)}
            nota={
              prestacao.status === "VALIDADA"
                ? "Só a validação abate o aporte do Comitê."
                : "Ainda não abate o aporte anual."
            }
          />
          <Cartao
            titulo="Despesas"
            valor={inteiro(prestacao.despesas.length)}
          />
        </Cartoes>

        {prestacao.parecer ? (
          <p className="mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
            <span className="font-medium text-foreground">Parecer: </span>
            {prestacao.parecer}
          </p>
        ) : null}
      </Secao>

      {prestacao.totalPorTipo.length > 0 ? (
        <Secao titulo="Totais por tipo de despesa">
          <Tabela
            rotulo="Totais por tipo"
            colunas={[
              { chave: "tipo", texto: "Tipo" },
              { chave: "total", texto: "Total", alinhamento: "direita" },
            ]}
          >
            {prestacao.totalPorTipo.map((linha) => (
              <tr key={linha.chave}>
                <Celula>{linha.rotulo}</Celula>
                <Celula direita>
                  <Moeda valor={linha.total} />
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      <Secao titulo="Despesas">
        {prestacao.despesas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma despesa lançada"
            descricao="A prestação existe, mas ainda não tem lançamento. Por isso o total aparece como “A definir” e não como R$ 0,00."
          />
        ) : (
          <Tabela
            rotulo="Despesas da prestação"
            colunas={[
              { chave: "despesa", texto: "Despesa" },
              { chave: "pessoa", texto: "Pessoa" },
              { chave: "exercicio", texto: "Exercício" },
              { chave: "valor", texto: "Valor", alinhamento: "direita" },
            ]}
          >
            {prestacao.despesas.map((despesa) => (
              <LinhaDespesa key={despesa.id} despesa={despesa} />
            ))}
          </Tabela>
        )}
      </Secao>
    </>
  );
}

function LinhaDespesa({ despesa }: { despesa: DespesaMissao }) {
  const trecho = despesa.passagem
    ? [despesa.passagem.origem, despesa.passagem.destino]
        .filter(Boolean)
        .join(" → ")
    : despesa.diaria
      ? `${data(despesa.diaria.dataInicio)} a ${data(despesa.diaria.dataFim)}`
      : null;

  return (
    <tr>
      <Celula>
        <span className="font-medium text-foreground">{despesa.descricao}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {rotulo(despesa.tipo)}
          {trecho ? ` · ${trecho}` : ""}
        </span>
        {/*
          A cotação existe para justificar a escolha da passagem; mostrar
          quantas foram obtidas é o que permite ver de relance se a comparação
          aconteceu.
        */}
        {despesa.passagem && despesa.passagem.cotacoes.length > 0 ? (
          <span className="mt-0.5 block text-xs text-subtle">
            {inteiro(despesa.passagem.cotacoes.length)}{" "}
            {despesa.passagem.cotacoes.length === 1 ? "cotação" : "cotações"}
          </span>
        ) : null}
      </Celula>
      <Celula>{despesa.participante ?? "—"}</Celula>
      <Celula className="tabular-nums">{despesa.exercicio}</Celula>
      <Celula direita>
        <Moeda valor={despesa.valorTotal} />
      </Celula>
    </tr>
  );
}

/** Tamanho do arquivo para leitura humana; a API devolve bytes. */
function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LinhaAtividade({ atividade }: { atividade: AtividadeMissao }) {
  const destino = [atividade.cidade, atividade.pais]
    .filter(Boolean)
    .join(", ");

  return (
    <tr>
      <Celula className="tabular-nums text-muted">{atividade.ordem}</Celula>
      <Celula>
        <span className="font-medium text-foreground">{atividade.titulo}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {rotulo(atividade.tipo)}
          {atividade.instituicao ? ` · ${atividade.instituicao}` : ""}
        </span>
        {atividade.eventoNome ? (
          <span className="mt-0.5 block text-xs text-muted">
            Evento: {atividade.eventoNome}
          </span>
        ) : null}
        {atividade.naoPrevista ? (
          <span className="mt-1 inline-block">
            <Selo
              tom="aviso"
              titulo={atividade.justificativaInclusao ?? undefined}
            >
              Não prevista
            </Selo>
          </span>
        ) : null}
      </Celula>
      <Celula>
        {destino || "—"}
        {atividade.local ? (
          <span className="mt-0.5 block text-xs text-muted">
            {atividade.local}
          </span>
        ) : null}
      </Celula>
      <Celula className="whitespace-nowrap">
        {data(atividade.dataInicio)} a {data(atividade.dataFim)}
      </Celula>
      <Celula direita className="tabular-nums">
        {inteiro(atividade.numeroDias)}
      </Celula>
      <Celula>
        <SeloAtividade status={atividade.status} />
      </Celula>
    </tr>
  );
}

function LinhaParticipante({ pessoa }: { pessoa: ParticipanteMissao }) {
  const vinculo = pessoa.tipoEquipe
    ? [rotulo(pessoa.tipoEquipe), pessoa.funcaoEquipe].filter(Boolean).join(" · ")
    : (pessoa.ppg ?? pessoa.instituicao);

  return (
    <tr>
      <Celula>
        <span className="font-medium text-foreground">{pessoa.nome}</span>
        <span className="mt-0.5 block text-xs text-muted">
          {rotulo(pessoa.tipoPessoa)}
          {pessoa.cargo ? ` · ${pessoa.cargo}` : ""}
        </span>
      </Celula>
      <Celula>
        <Selo tom={pessoa.papel === "RESPONSAVEL" ? "primario" : "neutro"}>
          {rotulo(pessoa.papel)}
        </Selo>
      </Celula>
      <Celula>{vinculo || "—"}</Celula>
      <Celula className="whitespace-nowrap">
        {data(pessoa.dataInicio)} a {data(pessoa.dataFim)}
      </Celula>
      <Celula direita className="tabular-nums">
        {inteiro(pessoa.numeroDias)}
      </Celula>
    </tr>
  );
}

/**
 * Selo da dimensão de aprovação (CG-019).
 *
 * `AJUSTES_SOLICITADOS` é aviso e não erro: a missão voltou para quem a
 * escreveu, o que é fluxo normal e não falha.
 */
function SeloAprovacao({ status }: { status: StatusAprovacaoMissao }) {
  const tons = {
    RASCUNHO: "neutro",
    EM_ANALISE: "info",
    AJUSTES_SOLICITADOS: "aviso",
    APROVADA: "sucesso",
    REPROVADA: "perigo",
  } as const;

  return (
    <Selo tom={tons[status]} titulo="Situação perante o Comitê Gestor">
      Aprovação: {rotulo(status)}
    </Selo>
  );
}

function SeloExecucao({ status }: { status: StatusMissao }) {
  const tons = {
    RASCUNHO: "neutro",
    PLANEJADA: "info",
    CONFIRMADA: "primario",
    CONCLUIDA: "sucesso",
    CANCELADA: "perigo",
  } as const;

  return (
    <Selo tom={tons[status]} titulo="Situação de execução da missão">
      Execução: {rotulo(status)}
    </Selo>
  );
}

function SeloAtividade({ status }: { status: string }) {
  const tons: Record<string, "neutro" | "sucesso" | "perigo"> = {
    PLANEJADA: "neutro",
    REALIZADA: "sucesso",
    NAO_REALIZADA: "perigo",
  };
  return <Selo tom={tons[status] ?? "neutro"}>{rotulo(status)}</Selo>;
}

function Dado({
  rotuloTexto,
  valor,
}: {
  rotuloTexto: string;
  valor: string | null;
}) {
  return (
    <div>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
        {rotuloTexto}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{valor || "—"}</dd>
    </div>
  );
}
