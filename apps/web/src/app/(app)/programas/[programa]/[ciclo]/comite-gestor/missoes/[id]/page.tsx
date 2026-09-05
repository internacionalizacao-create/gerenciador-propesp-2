import Link from "next/link";

import {
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import type {
  AtividadeMissao,
  Me,
  MissaoDetalhe,
  ParticipanteMissao,
  StatusAprovacaoMissao,
  StatusMissao,
} from "@/lib/dominio";
import { data, inteiro, rotulo } from "@/lib/formato";

/**
 * CG-045 · Detalhe da missão — resumo, roteiro e participantes.
 *
 * Primeira fatia da página. A arquitetura da informação aceita em 2026-09-05
 * coloca prestação, documentos, análise e produtos **dentro** desta página, em
 * abas, em vez das telas globais que o PDF propunha — as demais entram nas
 * fatias seguintes e por isso a navegação de abas ainda não existe aqui.
 *
 * Tudo vem de `GET .../missoes/:id`. A tela não soma nem deriva nada: os dias
 * inclusivos, os totais e a situação temporal já chegam calculados.
 */
export default async function MissaoDetalhePagina({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string; id: string }>;
}) {
  const { programa, ciclo, id } = await params;
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

  const missao = await apiFetch<MissaoDetalhe>(
    `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`,
  );

  const responsaveis = missao.participantes.filter(
    (pessoa) => pessoa.papel === "RESPONSAVEL",
  );

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
    </Pagina>
  );
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
