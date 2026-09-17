import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DecidirMissao,
  EnviarParaAnalise,
  ReabrirAnalise,
} from "@/componentes/formularios/acoes-analise";
import { AnexarEvidencias } from "@/componentes/formularios/form-evidencias";
import {
  DeclararSemProduto,
  NovaAtividadeExtra,
  ReabrirRespostaProdutos,
  RegistrarRelato,
} from "@/componentes/formularios/form-relato";
import {
  DispensarRequisito,
  EncerrarMissao,
  RevogarDispensa,
} from "@/componentes/formularios/acoes-encerramento";
import {
  DevolverPrestacao,
  EnviarPrestacao,
  ValidarPrestacao,
} from "@/componentes/formularios/acoes-prestacao";
import {
  AnexarDocumento,
  EditarDespesa,
  IniciarPrestacao,
  NovaDespesa,
  RemoverDespesa,
} from "@/componentes/formularios/form-despesa";
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
import { ApiError, apiFetch, apiFetchOuNada } from "@/lib/api";
import { carregarMe } from "@/lib/me";
import type {
  AnexoResumo,
  AtividadeMissao,
  AvaliacaoSubmissao,
  DespesaMissao,
  MissaoDetalhe,
  ParticipanteMissao,
  PrestacaoMissao,
  ChecklistEncerramento,
  ItemEncerramento,
  ReferenciasMissao,
  ResultadosDaMissao,
  RodadaAnalise,
  SituacaoPrestacao,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import {
  alteracoesDaRodada,
  ultimaDecisaoEm,
} from "@/lib/formularios/alteracoes-analise";
import {
  CATEGORIAS_DA_COTACAO,
  CATEGORIAS_DA_MISSAO,
  categoriasDoTipo,
  ehEvidencia,
  ehFoto,
} from "@/lib/formularios/documentos-despesa";
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
  const me = await carregarMe();
  const base = `/programas/${programa}/${ciclo}/comite-gestor`;

  const falta = faltando(me.permissions, ["missao:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Missão"
        descricao="Detalhe da missão institucional."
        me={me}
        faltando={falta}
      />
    );
  }

  const podeVerPrestacao = me.permissions.includes("prestacao:read");
  const rotaMissao = `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;
  const [
    missao,
    rodadas,
    requisitos,
    documentos,
    prestacaoBruta,
    resultados,
    encerramento,
    referencias,
  ] =
    // A missão que não existe **e a que existe em outra rede** respondem 404
    // (CG-028), e as duas precisam virar a página "não encontrada" em vez de
    // erro do servidor. Deixar o 404 subir derrubava a rota inteira em 500 —
    // que era um caso de URL digitada errada até o recorte por rede existir, e
    // passou a ser o de quem segue um link antigo para a missão da rede
    // vizinha. O `catch` cobre as oito chamadas de uma vez porque todas falham
    // juntas: elas apontam para a mesma missão.
    await naoEncontradaVira404(Promise.all([
      apiFetch<MissaoDetalhe>(rotaMissao),
      apiFetch<RodadaAnalise[]>(`${rotaMissao}/analise`),
      apiFetch<AvaliacaoSubmissao>(`${rotaMissao}/requisitos`),
      apiFetch<AnexoResumo[]>(
        `/anexos?entidadeTipo=MISSAO_COMITE&entidadeId=${id}`,
      ),
      // Nulo quando a missão não tem prestação — ausência é ausência de linha,
      // não o estado `NAO_INICIADA` (CG-013).
      // `prestacao:read` é outra permissão, e não vem junto de `missao:read`.
      // A consulta é condicional, e não tolerante a 403, porque nula aqui já
      // significa "prestação não iniciada": as duas ausências precisam
      // continuar distinguíveis na aba (V1-019).
      podeVerPrestacao
        ? apiFetch<PrestacaoMissao | null>(`${rotaMissao}/prestacao`)
        : Promise.resolve(null),
      // Produtos e a resposta "gerou produto?" (CG-056). Leitura aqui; o
      // cadastro entra com a edição do relato (CG-046).
      apiFetchOuNada<ResultadosDaMissao>(`${rotaMissao}/produtos`),
      // Checklist de encerramento (CG-058), recalculado a cada leitura.
      apiFetch<ChecklistEncerramento>(`${rotaMissao}/encerramento`),
      // País e parceiros do formulário de atividade não prevista (CG-046). Só
      // o Resumo o abre; buscar nas outras abas pagaria duas listas por nada.
      aba === "resumo"
        ? apiFetch<ReferenciasMissao>(
            `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
          )
        : Promise.resolve({ paises: [], instituicoes: [], redes: [] }),
    ]));

  /**
   * Missão sem prestação chega como corpo vazio, não como `null` JSON.
   *
   * A API devolve `null` e o Nest serializa isso como 200 sem corpo, então
   * `apiFetch` entrega `undefined` — e a checagem `=== null` abaixo passaria
   * batido, derrubando a página inteira em 500. Só acontece em missão que ainda
   * não abriu prestação, que é justamente o caso que a tela promete tratar.
   */
  const prestacao = prestacaoBruta ?? null;

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
    me.permissions.includes("missao:reopen-analise") &&
    (missao.statusAprovacao === "APROVADA" ||
      missao.statusAprovacao === "REPROVADA");
  // Encerrar mexe na dimensão de execução, e por isso olha `status`, nunca
  // `statusAprovacao` (CG-006). `missao:decide` é a permissão do Comitê — e,
  // com o `admin`, exatamente quem pode dispensar requisito (CG-058).
  // Relatar é ato de execução, não de aprovação: `missao:write`, e a missão
  // cancelada não recebe relato (a API recusa; a tela nem oferece).
  const podeRelatar =
    me.permissions.includes("missao:relato") && missao.status !== "CANCELADA";
  const podeEncerrar =
    me.permissions.includes("missao:close") && missao.status === "CONFIRMADA";
  const podeDispensar = me.permissions.includes("missao:decide");
  /*
    A prestação congela quando sai de um estado editável (CG-054).
    `COM_PENDENCIA` volta a aceitar lançamento: sem isso a devolução não teria
    efeito nenhum. `VALIDADA` congela em definitivo — é ela que abate o aporte.
  */
  const editavel =
    prestacao === null ||
    prestacao.status === "EM_PREENCHIMENTO" ||
    prestacao.status === "COM_PENDENCIA";
  const podeLancar = me.permissions.includes("prestacao:create") && editavel;
  const podeEnviarPrestacao =
    me.permissions.includes("prestacao:submit") &&
    prestacao !== null &&
    editavel;
  // Revisar é ato distinto de preparar, e a permissão é outra.
  const podeRevisar =
    me.permissions.includes("prestacao:review") &&
    prestacao?.status === "ENVIADA";

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
          documentos={documentos}
        />
      ) : aba === "documentos" ? (
        <>
          {/* CG-069: o dossiê é um PDF único, com os anexos concatenados. Fica
              na aba Documentos porque é daqui que sai o que entra nele — e o
              que entra é só o que quem clica já podia abrir. */}
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <a
              href={`/api/bff/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}/dossie`}
              className="rounded-xl border border-border-strong px-3 py-1.5 text-sm font-medium text-foreground hover:border-primary hover:text-primary"
            >
              Baixar dossiê da missão (PDF)
            </a>
            <span className="text-xs text-subtle">
              Inclui apenas os documentos que você pode abrir.
            </span>
          </div>
          <Documentos
            documentos={documentos}
            contexto={contexto}
            podeAnexar={me.permissions.includes("missao:edit")}
          />
          <Galeria
            documentos={documentos}
            contexto={contexto}
            podeAnexar={me.permissions.includes("missao:edit")}
          />
        </>
      ) : aba === "prestacao" ? (
        <Prestacao
          prestacao={prestacao}
          podeVer={podeVerPrestacao}
          missao={missao}
          contexto={contexto}
          podeEscrever={podeLancar}
          podeEnviar={podeEnviarPrestacao}
          podeRevisar={podeRevisar}
        />
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
        acoes={
          podeRelatar ? (
            <div className="flex flex-wrap gap-2">
              <RegistrarRelato contexto={contexto} missao={missao} />
              <NovaAtividadeExtra
                contexto={contexto}
                missao={missao}
                referencias={referencias}
              />
            </div>
          ) : undefined
        }
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

      <Resultados
            resultados={resultados}
            contexto={contexto}
            podeResponder={podeRelatar}
          />

          <Encerramento
            checklist={encerramento}
            contexto={contexto}
            podeEncerrar={podeEncerrar}
            podeDispensar={podeDispensar}
            missao={missao}
          />
        </>
      )}
    </Pagina>
  );
}

/**
 * Checklist de encerramento (CG-058).
 *
 * A lista inteira aparece, inclusive o que já está atendido: mostrar só o que
 * falta responderia "o que fazer agora" e não "o que foi conferido" — e é a
 * segunda pergunta que alguém faz ao olhar uma missão encerrada meses depois.
 *
 * **Dispensado não vira atendido.** O requisito continua constando como não
 * cumprido, com a justificativa ao lado. Pintá-lo de verde apagaria a exceção
 * exatamente onde ela precisa ficar visível.
 */
function Encerramento({
  checklist,
  contexto,
  podeEncerrar,
  podeDispensar,
  missao,
}: {
  checklist: ChecklistEncerramento;
  contexto: { programa: string; ciclo: string; id: string };
  podeEncerrar: boolean;
  podeDispensar: boolean;
  missao: MissaoDetalhe;
}) {
  return (
    <Secao
      titulo="Encerramento"
      descricao="A missão só encerra quando os requisitos aplicáveis estiverem atendidos ou dispensados."
    >
      {missao.avaliacaoObjetivos ? (
        <Aviso
          tom={missao.avaliacaoObjetivos === "SIM" ? "info" : "aviso"}
          titulo={`Objetivos alcançados: ${ROTULO_AVALIACAO[missao.avaliacaoObjetivos]}`}
        >
          {missao.avaliacaoJustificativa ?? "Sem ressalvas registradas."}
          {missao.desdobramentos ? (
            <p className="mt-2">
              <span className="font-medium">Desdobramentos:</span>{" "}
              {missao.desdobramentos}
            </p>
          ) : null}
        </Aviso>
      ) : null}

      {checklist.impedimento ? (
        <Aviso tom="info">{checklist.impedimento}</Aviso>
      ) : null}

      <Tabela
        rotulo="Requisitos de encerramento"
        colunas={[
          { chave: "requisito", texto: "Requisito" },
          { chave: "situacao", texto: "Situação" },
          { chave: "acao", texto: <span className="sr-only">Ações</span> },
        ]}
      >
        {checklist.itens.map((item) => (
          <tr key={item.chave}>
            <Celula>
              <span className="font-medium text-foreground">{item.titulo}</span>
              {item.descricao ? (
                <p className="mt-0.5 text-xs text-muted">{item.descricao}</p>
              ) : null}
              {item.dispensa ? (
                <p className="mt-1 text-xs text-on-warning-soft">
                  Dispensado por {item.dispensa.dispensadaPor ?? "—"} em{" "}
                  {dataHora(item.dispensa.dispensadaEm)}:{" "}
                  {item.dispensa.justificativa}
                </p>
              ) : !item.atendido && item.comoResolver ? (
                <p className="mt-0.5 text-xs text-muted">{item.comoResolver}</p>
              ) : null}
            </Celula>
            <Celula>
              <SeloRequisito item={item} />
            </Celula>
            <Celula direita>
              {podeDispensar && !item.atendido && item.aplicavel ? (
                item.dispensa ? (
                  <RevogarDispensa
                    contexto={contexto}
                    chave={item.chave}
                    titulo={item.titulo}
                  />
                ) : item.obrigatorio ? (
                  <DispensarRequisito
                    contexto={contexto}
                    chave={item.chave}
                    titulo={item.titulo}
                  />
                ) : null
              ) : null}
            </Celula>
          </tr>
        ))}
      </Tabela>

      {podeEncerrar ? (
        <div className="mt-5">
          <EncerrarMissao contexto={contexto} />
        </div>
      ) : null}
    </Secao>
  );
}

/**
 * Quatro estados, e nenhum deles se confunde com outro.
 *
 * "Dispensado" fica em aviso, e não em sucesso: a missão fechou sem o
 * requisito, e a cor precisa dizer isso.
 */
function SeloRequisito({ item }: { item: ItemEncerramento }) {
  if (item.atendido) return <Selo tom="sucesso">Atendido</Selo>;
  if (item.dispensa) return <Selo tom="aviso">Dispensado</Selo>;
  if (!item.aplicavel) return <Selo tom="neutro">Não se aplica</Selo>;
  if (!item.obrigatorio) return <Selo tom="neutro">Opcional</Selo>;
  return <Selo tom="perigo">Pendente</Selo>;
}

const ROTULO_AVALIACAO: Record<"SIM" | "PARCIALMENTE" | "NAO", string> = {
  SIM: "sim",
  PARCIALMENTE: "parcialmente",
  NAO: "não",
};

/**
 * Resultados da missão (CG-056).
 *
 * O estado vazio é o ponto da tela: "nenhum produto cadastrado" é ambíguo, e
 * por isso a API separa a declaração explícita de não haver produto da simples
 * ausência de resposta. Mostrar as duas como a mesma coisa desfaria a distinção
 * que o modelo criou para o checklist de encerramento (CG-058).
 */
function Resultados({
  resultados,
  contexto,
  podeResponder,
}: {
  resultados: ResultadosDaMissao | null;
  contexto: { programa: string; ciclo: string; id: string };
  podeResponder: boolean;
}) {
  // Sem `produto-missao:read` a API recusa a consulta; a seção diz isso em vez
  // de sumir, senão a missão pareceria não ter resultado nenhum.
  if (resultados === null) {
    return (
      <Secao titulo="Resultados">
        <EstadoVazio
          titulo="Fora do seu acesso"
          descricao="Seu acesso não cobre os produtos de missão. Quem administra acessos na PROPESP pode conceder a consulta."
        />
      </Secao>
    );
  }

  if (resultados.respostaProduto === "NAO") {
    return (
      <Secao
        titulo="Resultados"
        descricao="Produtos gerados pela missão e acordos dela decorrentes."
        acoes={
          podeResponder ? (
            <ReabrirRespostaProdutos contexto={contexto} />
          ) : undefined
        }
      >
        <Aviso tom="info" titulo="Missão declarada sem produto">
          Declarado por {resultados.declaracaoSemProduto?.declaradoPor} em{" "}
          {dataHora(resultados.declaracaoSemProduto?.declaradoEm)}.
          {resultados.declaracaoSemProduto?.justificativa
            ? ` ${resultados.declaracaoSemProduto.justificativa}`
            : ""}
        </Aviso>
      </Secao>
    );
  }

  if (resultados.produtos.length === 0) {
    return (
      <Secao
        titulo="Resultados"
        descricao="Produtos gerados pela missão e acordos dela decorrentes."
        acoes={
          podeResponder ? (
            <DeclararSemProduto contexto={contexto} />
          ) : undefined
        }
      >
        <EstadoVazio
          titulo="Resposta pendente"
          descricao="Ninguém informou ainda se a missão gerou produto. Não é o mesmo que não ter gerado — o encerramento exige a resposta."
        />
      </Secao>
    );
  }

  return (
    <Secao
      titulo="Resultados"
      descricao="Produtos gerados pela missão e acordos dela decorrentes."
    >
      <Tabela
        rotulo="Produtos da missão"
        colunas={[
          { chave: "produto", texto: "Produto" },
          { chave: "situacao", texto: "Situação" },
          { chave: "envolvidos", texto: "Envolvidos" },
          { chave: "documentos", texto: "Docs.", alinhamento: "direita" },
        ]}
      >
        {resultados.produtos.map((produto) => (
          <tr key={produto.id}>
            <Celula>
              <span className="font-medium text-foreground">
                {produto.titulo}
              </span>
              <span className="block text-xs text-subtle">
                {rotulo(produto.tipo)}
                {produto.ano ? ` · ${produto.ano}` : ""}
                {produto.convenio ? ` · ${produto.convenio.titulo}` : ""}
              </span>
            </Celula>
            <Celula className="text-muted">{rotulo(produto.situacao)}</Celula>
            <Celula className="text-muted">
              {produto.instituicoes.length > 0
                ? produto.instituicoes.map((item) => item.nome).join(", ")
                : "—"}
              {produto.responsaveis.length > 0 ? (
                <span className="block text-xs text-subtle">
                  {produto.responsaveis.map((item) => item.nome).join(", ")}
                </span>
              ) : null}
            </Celula>
            <Celula direita className="text-muted">
              {inteiro(produto.quantidadeDocumentos)}
            </Celula>
          </tr>
        ))}
      </Tabela>
    </Secao>
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
  documentos,
}: {
  missao: MissaoDetalhe;
  rodadas: RodadaAnalise[];
  requisitos: AvaliacaoSubmissao;
  contexto: { programa: string; ciclo: string; id: string };
  podeEnviar: boolean;
  podeDecidir: boolean;
  podeReabrir: boolean;
  documentos: AnexoResumo[];
}) {
  const aberta = rodadas.find((rodada) => rodada.encerradaEm === null);

  // A janela e o porque dela vivem em `alteracoes-analise.ts`: `node --test`
  // nao carrega `.tsx`, e esta e a logica que merece teste.
  const ultimaDecisao = ultimaDecisaoEm(rodadas);
  const alteracoes = alteracoesDaRodada(missao.historico, {
    ultimaDecisaoEm: ultimaDecisao,
    submetidoEm: aberta?.submetidoEm,
  });

  const anexados = documentos.filter((documento) => documento.ativo);

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

      {/* O dossiê existe para o relator não trocar de aba enquanto escreve o
          parecer. É leitura, e reusa as mesmas linhas do Resumo — duas
          renderizações da mesma tabela divergiriam na primeira mudança. */}
      <Secao
        titulo="O que será analisado"
        descricao="O mesmo conteúdo do Resumo, reunido aqui para não obrigar a trocar de aba durante a leitura."
      >
        <div className="rounded-2xl border border-border bg-surface px-5 py-5">
          <p className="whitespace-pre-line text-sm text-foreground">
            {missao.objetivo}
          </p>
          <p className="mt-3 text-sm text-muted">
            {data(missao.dataInicio)} — {data(missao.dataFim)} ·{" "}
            {inteiro(missao.numeroDias)} dias ·{" "}
            {missao.redes.length > 0
              ? missao.redes.map((rede) => rede.nome).join(", ")
              : "sem rede"}
          </p>
        </div>

        <div className="mt-5" />

        <Tabela
          rotulo="Participantes da missão em análise"
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

        <div className="mt-5" />

        {/* Parceiro e contato saem daqui: são o roteiro. Uma seção separada
            para "parceiros autorizados" repetiria a mesma instituição em duas
            listas e nada diria em qual parada ela entra. */}
        <Tabela
          rotulo="Roteiro da missão em análise"
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
      </Secao>

      <Secao
        titulo="Documentos anexados"
        descricao="Abrir o arquivo faz parte da análise; o checklist abaixo diz o que a política exige, não o que existe."
      >
        {anexados.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum documento anexado"
            descricao="Documento restrito não aparece para quem não o enviou."
          />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {anexados.map((documento) => (
              <li
                key={documento.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
              >
                <span className="text-sm">
                  <span className="font-medium text-foreground">
                    {documento.legenda ?? documento.nome}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {rotulo(documento.categoria)}
                    {documento.versao > 1 ? ` · v${documento.versao}` : ""}
                    {documento.enviadoPor ? ` · ${documento.enviadoPor}` : ""}
                  </span>
                </span>
                <a
                  href={`/api/bff/anexos/${documento.id}/conteudo`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Abrir
                  <span className="sr-only"> {documento.nome}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
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

      {aberta ? (
        <Secao
          titulo={
            ultimaDecisao
              ? "Alterações desde a última decisão"
              : "Alterações antes do envio"
          }
          descricao={
            ultimaDecisao
              ? "O que mudou em resposta ao parecer anterior. É por aqui que se confere se o ajuste pedido foi feito."
              : "Como a missão chegou até aqui. A edição congela enquanto a análise está aberta."
          }
        >
          {alteracoes.length === 0 ? (
            <EstadoVazio
              titulo="Nada alterado"
              descricao={
                ultimaDecisao
                  ? "A missão foi reenviada sem nenhuma alteração registrada desde o parecer anterior."
                  : "A missão foi enviada como foi cadastrada."
              }
            />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
              {alteracoes.map((registro) => (
                <li key={registro.id} className="px-5 py-3.5 text-sm">
                  <span className="font-medium text-foreground">
                    {registro.campo ?? "Registro"}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {dataHora(registro.ocorridoEm)}
                    {registro.usuarioNome ? ` · ${registro.usuarioNome}` : ""}
                  </span>
                  {registro.valorAnterior !== registro.valorNovo ? (
                    <p className="mt-1 text-xs text-muted">
                      <span className="line-through">
                        {registro.valorAnterior ?? "—"}
                      </span>{" "}
                      → {registro.valorNovo ?? "—"}
                    </p>
                  ) : null}
                  {registro.justificativa ? (
                    <p className="mt-1 text-xs text-subtle">
                      {registro.justificativa}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
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
function Documentos({
  documentos,
  contexto,
  podeAnexar,
}: {
  documentos: AnexoResumo[];
  contexto: { programa: string; ciclo: string; id: string };
  podeAnexar: boolean;
}) {
  // A evidência sai daqui e vai para a galeria: misturá-las faria a foto do
  // jantar aparecer na mesma lista dos documentos exigidos para aprovação.
  const ativos = documentos.filter(
    (documento) => documento.ativo && !ehEvidencia(documento.categoria),
  );

  return (
    <Secao
      titulo="Documentos da missão"
      descricao="Substituir um arquivo cria versão nova e preserva a anterior — não há exclusão, só inativação."
      acoes={
        podeAnexar ? (
          <AnexarDocumento
            contexto={contexto}
            entidadeTipo="MISSAO_COMITE"
            entidadeId={contexto.id}
            titulo="Anexar documento à missão"
            descricao="Projeto e justificativa são exigidos antes do envio ao Comitê; convite, programação e orçamento são recomendados."
            categorias={CATEGORIAS_DA_MISSAO}
          />
        ) : undefined
      }
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
 * Galeria de fotos e evidências (CG-057).
 *
 * **Só chega aqui o que a API deixou passar.** Documento `RESTRITA` é filtrado
 * no servidor, na listagem e no download — a galeria não decide privacidade,
 * ela só não tem como exibir o que não recebeu. Esconder no cliente seria
 * fachada: bastaria abrir a resposta da rede.
 *
 * A foto é renderizada pelo próprio endpoint autenticado, sem miniatura
 * gerada: `/anexos/:id/conteudo` já exige sessão e permissão, e criar um
 * segundo caminho para a mesma imagem criaria um segundo lugar para errar a
 * autorização. O preço é baixar o arquivo inteiro — aceitável no limite de
 * 20 MB, e o ponto de otimizar é aqui quando incomodar.
 */
function Galeria({
  documentos,
  contexto,
  podeAnexar,
}: {
  documentos: AnexoResumo[];
  contexto: { programa: string; ciclo: string; id: string };
  podeAnexar: boolean;
}) {
  const evidencias = documentos.filter(
    (documento) => documento.ativo && ehEvidencia(documento.categoria),
  );

  return (
    <Secao
      titulo="Fotos e evidências"
      descricao="O que comprova que a missão aconteceu. Substituir preserva a versão anterior; nada é excluído."
      acoes={
        podeAnexar ? (
          <AnexarEvidencias contexto={contexto} entidadeId={contexto.id} />
        ) : undefined
      }
    >
      {evidencias.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma evidência registrada"
          descricao="Fotos, certificados, atas e listas de presença entram aqui. Documento restrito não aparece para quem não o enviou."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {evidencias.map((evidencia) => (
            <li
              key={evidencia.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              {ehFoto(evidencia.categoria) &&
              evidencia.mimeType.startsWith("image/") ? (
                <a
                  href={`/api/bff/anexos/${evidencia.id}/conteudo`}
                  target="_blank"
                  rel="noreferrer"
                  className="block bg-surface-muted"
                >
                  {/* `next/image` exigiria host permitido e otimização de uma
                      rota autenticada; a tag nativa serve e não vaza o arquivo
                      para o otimizador. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/bff/anexos/${evidencia.id}/conteudo`}
                    alt={evidencia.legenda ?? evidencia.nome}
                    className="h-40 w-full object-cover"
                  />
                </a>
              ) : (
                <div className="flex h-40 items-center justify-center bg-surface-muted px-4 text-center text-sm text-muted">
                  {rotulo(evidencia.categoria)}
                </div>
              )}

              <div className="space-y-1.5 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Selo tom="neutro">{rotulo(evidencia.categoria)}</Selo>
                  {evidencia.visibilidade === "RESTRITA" ? (
                    <Selo
                      tom="aviso"
                      titulo="Só o administrador e quem enviou têm acesso"
                    >
                      Restrita
                    </Selo>
                  ) : null}
                  {evidencia.versao > 1 ? (
                    <Selo tom="neutro">v{evidencia.versao}</Selo>
                  ) : null}
                </div>
                <p className="text-sm text-foreground">
                  {evidencia.legenda ?? evidencia.nome}
                </p>
                <p className="text-xs text-muted">
                  {[
                    evidencia.dataEvidencia
                      ? data(evidencia.dataEvidencia)
                      : null,
                    evidencia.localEvidencia,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sem data ou local informados"}
                </p>
                <a
                  href={`/api/bff/anexos/${evidencia.id}/conteudo`}
                  className="inline-block text-xs font-medium text-primary hover:underline"
                >
                  Baixar
                  <span className="sr-only"> {evidencia.nome}</span>
                </a>
              </div>
            </li>
          ))}
        </ul>
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
function Prestacao({
  prestacao,
  podeVer,
  missao,
  contexto,
  podeEscrever,
  podeEnviar,
  podeRevisar,
}: {
  prestacao: PrestacaoMissao | null;
  /** `false` quando falta `prestacao:read` — diferente de não haver prestação. */
  podeVer: boolean;
  missao: MissaoDetalhe;
  contexto: { programa: string; ciclo: string; id: string };
  podeEscrever: boolean;
  podeEnviar: boolean;
  podeRevisar: boolean;
}) {
  if (!podeVer) {
    return (
      <Secao titulo="Prestação de contas">
        <EstadoVazio
          titulo="Fora do seu acesso"
          descricao="Seu acesso não cobre a prestação de contas desta missão. Quem administra acessos na PROPESP pode conceder a consulta."
        />
      </Secao>
    );
  }

  if (!prestacao) {
    return (
      <Secao
        titulo="Prestação de contas"
        acoes={podeEscrever ? <IniciarPrestacao contexto={contexto} /> : undefined}
      >
        <EstadoVazio
          titulo="Prestação não iniciada"
          descricao="Ela abre automaticamente quando a viagem é marcada como realizada, ou pode ser iniciada agora."
        />
      </Secao>
    );
  }

  const semComprovante = prestacao.despesas.filter(
    (despesa) => despesa.documentos.length === 0,
  );

  return (
    <>
      <Secao
        titulo="Prestação de contas"
        descricao="Todos os valores em reais: a conversão de despesa feita no exterior acontece antes do lançamento."
        acoes={
          <div className="flex flex-wrap gap-2">
            {podeEnviar ? (
              <EnviarPrestacao
                contexto={contexto}
                reenvio={prestacao.status === "COM_PENDENCIA"}
              />
            ) : null}
            {podeRevisar ? (
              <>
                <ValidarPrestacao
                  contexto={contexto}
                  total={prestacao.total}
                />
                <DevolverPrestacao contexto={contexto} />
              </>
            ) : null}
          </div>
        }
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

        {/*
          O parecer significa coisas diferentes conforme o estado: em
          `COM_PENDENCIA` é o que falta corrigir, e em `VALIDADA` é o registro
          do que foi conferido. Mostrar os dois como "Parecer" faria a pendência
          parecer aprovação.
        */}
        {prestacao.parecer ? (
          <div
            role={prestacao.status === "COM_PENDENCIA" ? "status" : undefined}
            className={
              prestacao.status === "COM_PENDENCIA"
                ? "mt-4 rounded-2xl border-l-4 border-warning bg-warning-soft px-4 py-3.5 text-sm text-on-warning-soft"
                : "mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted"
            }
          >
            <p className="font-semibold">
              {prestacao.status === "COM_PENDENCIA"
                ? "Pendência a corrigir"
                : "Parecer"}
            </p>
            <p className="mt-1">{prestacao.parecer}</p>
          </div>
        ) : null}

        <p className="mt-4 text-sm text-muted">
          {DESCRICAO_PRESTACAO[prestacao.status]}
        </p>

        {prestacao.enviadaEm || prestacao.validadaEm ? (
          <p className="mt-1.5 text-xs text-subtle">
            {prestacao.enviadaEm
              ? `Enviada em ${data(prestacao.enviadaEm)}${prestacao.enviadaPor ? ` por ${prestacao.enviadaPor}` : ""}.`
              : ""}
            {prestacao.validadaEm
              ? ` Validada em ${data(prestacao.validadaEm)}${prestacao.validadaPor ? ` por ${prestacao.validadaPor}` : ""}.`
              : ""}
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

      {prestacao.totalPorPessoa.length > 0 ? (
        <Secao
          titulo="Por participante"
          descricao="Despesa sem pessoa específica — inscrição institucional, por exemplo — fica fora deste recorte e continua no total geral."
        >
          <Tabela
            rotulo="Totais por participante"
            colunas={[
              { chave: "pessoa", texto: "Participante" },
              { chave: "total", texto: "Total", alinhamento: "direita" },
            ]}
          >
            {prestacao.totalPorPessoa.map((linha) => (
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

      <Secao
        titulo="Despesas"
        acoes={
          podeEscrever ? (
            <NovaDespesa
              contexto={contexto}
              participantes={missao.participantes}
              exercicioPadrao={Number(missao.dataInicio.slice(0, 4))}
            />
          ) : undefined
        }
      >
        {/*
          A indicação de pendência é por despesa, não por documento: o que a
          pessoa precisa saber é qual lançamento ainda não tem comprovante.
        */}
        {semComprovante.length > 0 ? (
          <div
            role="status"
            className="mb-4 rounded-2xl border-l-4 border-warning bg-warning-soft px-4 py-3.5 text-sm text-on-warning-soft"
          >
            <p className="font-semibold">
              {semComprovante.length === 1
                ? "1 despesa sem comprovante"
                : `${inteiro(semComprovante.length)} despesas sem comprovante`}
            </p>
            <p className="mt-1">
              {semComprovante.map((despesa) => despesa.descricao).join(" · ")}
            </p>
          </div>
        ) : null}

        {prestacao.despesas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma despesa lançada"
            descricao="A prestação existe, mas ainda não tem lançamento. Por isso o total aparece como “A definir” e não como R$ 0,00."
          />
        ) : (
          <ul className="space-y-4">
            {prestacao.despesas.map((despesa) => (
              <CartaoDespesa
                key={despesa.id}
                despesa={despesa}
                contexto={contexto}
                participantes={missao.participantes}
                podeEscrever={podeEscrever}
              />
            ))}
          </ul>
        )}
      </Secao>
    </>
  );
}

/**
 * Uma despesa com o que ela tem de específico e os documentos dela.
 *
 * Deixou de ser linha de tabela quando ganhou cotações, documentos e ações: a
 * tabela ficaria com uma célula gigante e o resto vazio, e a rolagem
 * horizontal esconderia justamente a informação nova.
 */
/** O que cada estado significa para quem olha, não o rótulo do enum. */
const DESCRICAO_PRESTACAO: Record<SituacaoPrestacao, string> = {
  NAO_INICIADA: "A prestação ainda não foi aberta.",
  EM_PREENCHIMENTO:
    "Em preenchimento. Lance as despesas e envie para revisão quando estiver completa.",
  ENVIADA:
    "Em revisão. O lançamento fica bloqueado até a decisão, para que o revisor não valide um valor diferente do que leu.",
  COM_PENDENCIA:
    "Devolvida para correção. O lançamento está liberado de novo, e um novo envio recomeça a revisão.",
  VALIDADA:
    "Validada. É o único estado que abate o aporte anual do Comitê, e a prestação não aceita mais alteração.",
};

function CartaoDespesa({
  despesa,
  contexto,
  participantes,
  podeEscrever,
}: {
  despesa: DespesaMissao;
  contexto: { programa: string; ciclo: string; id: string };
  participantes: ParticipanteMissao[];
  podeEscrever: boolean;
}) {
  const trecho = despesa.passagem
    ? [despesa.passagem.origem, despesa.passagem.destino]
        .filter(Boolean)
        .join(" → ")
    : despesa.diaria
      ? `${data(despesa.diaria.dataInicio)} a ${data(despesa.diaria.dataFim)}`
      : null;

  return (
    <li className="rounded-2xl border border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{despesa.descricao}</p>
          <p className="mt-0.5 text-xs text-muted">
            {rotulo(despesa.tipo)}
            {trecho ? ` · ${trecho}` : ""}
            {despesa.participante ? ` · ${despesa.participante}` : ""}
            {` · exercício ${despesa.exercicio}`}
          </p>
        </div>
        <div className="text-right">
          <Moeda valor={despesa.valorTotal} forte />
          {despesa.documentos.length === 0 ? (
            <span className="mt-1 block">
              <Selo tom="aviso">Sem comprovante</Selo>
            </span>
          ) : null}
        </div>
      </div>

      {despesa.passagem && despesa.passagem.cotacoes.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-subtle">
            Cotações
          </p>
          <ul className="mt-1.5 space-y-1">
            {despesa.passagem.cotacoes.map((cotacao) => (
              <li
                key={cotacao.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted"
              >
                <span>{cotacao.empresa}</span>
                <span className="flex items-center gap-3">
                  <Moeda valor={cotacao.valor} />
                  {podeEscrever ? (
                    <AnexarDocumento
                      contexto={contexto}
                      entidadeTipo="COTACAO_PASSAGEM"
                      entidadeId={cotacao.id}
                      rotuloBotao="Anexar PDF"
                      titulo={`Cotação ${cotacao.empresa}`}
                      descricao="Cada cotação tem o PDF próprio: é ele que justifica a escolha da passagem."
                      categorias={CATEGORIAS_DA_COTACAO}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {despesa.documentos.length > 0 ? (
        <ul className="mt-3 space-y-1 border-t border-border pt-3">
          {despesa.documentos.map((documento) => (
            <li key={documento.id} className="text-sm">
              <a
                href={`/api/bff/anexos/${documento.id}/conteudo`}
                className="text-primary hover:underline"
              >
                {documento.nome}
              </a>
              <span className="ml-2 text-xs text-subtle">
                {rotulo(documento.categoria)}
                {documento.cotacaoId ? " · de uma cotação" : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {podeEscrever ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3">
          <EditarDespesa
            contexto={contexto}
            despesa={despesa}
            participantes={participantes}
          />
          <AnexarDocumento
            contexto={contexto}
            entidadeTipo="DESPESA_MISSAO"
            entidadeId={despesa.id}
            titulo={`Documento de ${despesa.descricao}`}
            descricao="A categoria é validada contra o tipo da despesa: comprovante de diária não entra numa passagem."
            categorias={categoriasDoTipo(despesa.tipo)}
          />
          <RemoverDespesa contexto={contexto} despesa={despesa} />
        </div>
      ) : null}
    </li>
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

/**
 * Traduz o 404 da API na página "não encontrada" do Next.
 *
 * Só o 404: qualquer outro erro continua subindo, porque um 500 da API
 * disfarçado de "não encontrada" esconderia a falha de quem precisa corrigi-la.
 */
async function naoEncontradaVira404<T>(promessa: Promise<T>): Promise<T> {
  try {
    return await promessa;
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  }
}
