import Link from "next/link";

import {
  EditarParticipacao,
  NovaParticipacao,
  RemoverParticipacao,
  type ReferenciasParticipacao,
} from "@/componentes/formularios/form-participacao";
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
  Utilizacao,
} from "@/componentes/ui/basicos";
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { apiFetch, apiFetchOuNada } from "@/lib/api";
import { carregarMe } from "@/lib/me";
import { Ajuda } from "@/componentes/ui/ajuda";
import { AJUDA_ORCAMENTO } from "@/lib/ajuda-orcamento";
import type { DetalheTematica } from "@/lib/dominio";
import { inteiro, meses, moeda, rotulo } from "@/lib/formato";

/**
 * P08 · Detalhe da área temática.
 *
 * Tudo sobre uma temática numa página: orçamento, PPGs, plano e a participação
 * de cada PPG no custo — número que na planilha ninguém conseguia produzir sem
 * refazer a conta à mão.
 */
export default async function DetalheDaTematica({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string; codigo: string }>;
}) {
  const { programa, ciclo, codigo } = await params;
  const base = `/programas/${programa}/${ciclo}`;

  const me = await carregarMe();
  const falta = faltando(me.permissions, ["orcamento:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Área temática"
        descricao="Orçamento, PPGs e plano de uma temática."
        me={me}
        faltando={falta}
      />
    );
  }

  const area = await apiFetch<DetalheTematica>(
    `${base}/tematicas/${encodeURIComponent(codigo)}`,
  );

  // V1-034 · administrar a participação PPG–temática.
  //
  // Os três verbos são permissões distintas e institucionais: associar um PPG
  // cria, de lado, um alvo de concessão. As referências só são buscadas por
  // quem pode associar — o endpoint exige `participacao:create`, e pedi-las
  // sempre gastaria um 403 por render.
  const podeAssociar = me.permissions.includes("participacao:create");
  const podeEditarParticipacao = me.permissions.includes("participacao:edit");
  const podeRemoverParticipacao =
    me.permissions.includes("participacao:delete");
  const contexto = { programa, ciclo, codigo };
  const referencias =
    podeAssociar || podeEditarParticipacao
      ? await apiFetchOuNada<ReferenciasParticipacao>(
          `${base}/tematicas/${encodeURIComponent(codigo)}/participacoes/referencias`,
        )
      : null;

  const divergente =
    area.divergencia !== null && Number(area.divergencia) !== 0;

  return (
    <Pagina
      titulo={`${area.codigo} · ${area.nome}`}
      descricao={`Rede ${area.rede}`}
      voltar={{ href: `${base}/redes`, rotulo: "Voltar às redes" }}
    >
      {area.statusOrcamento === "A_DEFINIR" ? (
        <Aviso tom="aviso" titulo="Orçamento a definir">
          Esta área temática tem PPGs e Coordenadores de Temática cadastrados, mas a rede
          ainda não informou o orçamento. Os valores ficam em branco de propósito
          — preenchê-los com zero distorceria os indicadores do painel.
        </Aviso>
      ) : null}

      {divergente ? (
        <Aviso tom="perigo" titulo="Divergência de saldo">
          O sistema calcula <Moeda valor={area.saldoPotencial} /> de saldo. O
          valor de referência registrado é <Moeda valor={area.saldoInformado} />.
          A diferença é <Moeda valor={area.divergencia} /> e precisa de decisão.
        </Aviso>
      ) : null}

      <Secao titulo={`Resumo do exercício ${area.ano}`}>
        <Cartoes>
          <Cartao titulo={<Ajuda rotulo="Orçamento de bolsas">{AJUDA_ORCAMENTO.bolsas}</Ajuda>} valor={moeda(area.valorBolsas)} />
          <Cartao
            titulo={<Ajuda rotulo="Manutenção e missões">{AJUDA_ORCAMENTO.apoio}</Ajuda>}
            valor={moeda(area.apoio)}
          />
          <Cartao
            titulo={<Ajuda rotulo="Custo programado">{AJUDA_ORCAMENTO.custo}</Ajuda>}
            valor={moeda(area.custoBolsas)}
            nota={`${inteiro(area.bolsas)} bolsas por ano`}
          />
          <Cartao
            titulo={<Ajuda rotulo="Saldo de bolsas">{AJUDA_ORCAMENTO.saldo}</Ajuda>}
            valor={moeda(area.saldoPotencial)}
            destaque
          />
        </Cartoes>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>Utilização do orçamento:</span>
          <Utilizacao fracao={area.utilizacao} />
        </div>
      </Secao>

      <Secao
        titulo="Coordenadores de Temática"
      >
        {area.coordenadores.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {area.coordenadores.map((coordenador) => (
              <li
                key={coordenador.ppgId}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
              >
                <span className="font-medium text-foreground">
                  {coordenador.nome}
                </span>
                <span className="ml-2 text-xs text-subtle">
                  {coordenador.ppgSigla}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EstadoVazio
            titulo="Nenhum coordenador designado"
            descricao="A temática existe no planejamento, mas seus PPGs ainda não têm Coordenador de Temática."
          />
        )}
      </Secao>

      <Secao
        titulo="PPGs participantes"
        descricao="O vínculo é o que torna o PPG utilizável no plano deste ciclo. Ele não concede acesso a ninguém: quem enxerga o quê continua sendo decidido em Acessos."
        acoes={
          podeAssociar && referencias ? (
            <NovaParticipacao contexto={contexto} referencias={referencias} />
          ) : undefined
        }
      >
        {area.participacoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum PPG participa desta temática"
            descricao="Associe ao menos um programa antes de cadastrar linhas de plano: sem participação não há par válido para a linha apontar."
          />
        ) : (
          <Tabela
            colunas={[
              { chave: "ppg", texto: "PPG" },
              { chave: "responsavel", texto: "Coordenador de Temática" },
              { chave: "nota", texto: "Nota CAPES", alinhamento: "direita" },
              { chave: "situacao", texto: "Situação" },
              { chave: "modalidades", texto: "Modalidades previstas" },
              { chave: "custo", texto: "Custo anual", alinhamento: "direita" },
              {
                chave: "acoes",
                texto: <span className="sr-only">Ações</span>,
                alinhamento: "direita",
              },
            ]}
            rodape={
              <tr>
                <Celula>Total</Celula>
                <Celula>—</Celula>
                <Celula direita>—</Celula>
                <Celula>—</Celula>
                <Celula>—</Celula>
                <Celula direita>
                  <Moeda valor={area.custoTotal} forte />
                </Celula>
                <Celula direita>—</Celula>
              </tr>
            }
          >
            {area.participacoes.map((p) => (
              <tr key={p.id}>
                <Celula>
                  <Link
                    href={`/ppgs/${p.ppgId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {p.sigla}
                  </Link>
                  <span className="block text-xs text-subtle">{p.ppg}</span>
                </Celula>
                <Celula className="text-muted">
                  {p.coordenadorTematica ?? (
                    <span className="italic text-subtle">
                      Responsável não encontrado
                    </span>
                  )}
                  {p.coordenadorTematicaEmail ? (
                    <span className="block text-xs text-subtle">
                      {p.coordenadorTematicaEmail}
                    </span>
                  ) : null}
                </Celula>
                <Celula direita>{p.notaCapes ?? "—"}</Celula>
                <Celula>
                  <Selo
                    tom={p.situacao === "CONTEMPLADO" ? "sucesso" : "neutro"}
                  >
                    {rotulo(p.situacao)}
                  </Selo>
                </Celula>
                <Celula className="max-w-sm text-muted">
                  {p.modalidadesPrevistas ?? "—"}
                </Celula>
                <Celula direita>
                  <Moeda valor={p.custoAnual} />
                </Celula>
                <Celula direita>
                  <span className="flex justify-end gap-3">
                    {podeEditarParticipacao && referencias ? (
                      <EditarParticipacao
                        contexto={contexto}
                        participacao={p}
                        referencias={referencias}
                      />
                    ) : null}
                    {podeRemoverParticipacao ? (
                      <RemoverParticipacao contexto={contexto} participacao={p} />
                    ) : null}
                  </span>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Plano de aplicação da temática"
        descricao="Linhas nas três rubricas, com o valor unitário já resolvido."
        acoes={
          <Link
            href={`${base}/plano`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Abrir o plano completo →
          </Link>
        }
      >
        {area.plano.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "ppg", texto: "PPG" },
              { chave: "modalidade", texto: "Modalidade" },
              { chave: "destino", texto: "Destino" },
              { chave: "vigencia", texto: "Vigência" },
              { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
              { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
              { chave: "custo", texto: "Custo anual", alinhamento: "direita" },
              { chave: "status", texto: "Status" },
            ]}
          >
            {area.plano.map((linha) => (
              <tr key={linha.id}>
                <Celula>
                  <span className="font-mono text-xs">{linha.codigo}</span>
                </Celula>
                <Celula>{linha.ppgSigla}</Celula>
                <Celula>{linha.modalidade ?? "—"}</Celula>
                <Celula>{rotulo(linha.destino)}</Celula>
                <Celula>{meses(linha.vigenciaMeses)}</Celula>
                <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
                <Celula direita>
                  <Moeda valor={linha.valorUnitario} />
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.custoAnual} />
                </Celula>
                <Celula>
                  <Selo
                    tom={linha.status === "PROGRAMADO" ? "sucesso" : "aviso"}
                  >
                    {rotulo(linha.status)}
                  </Selo>
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhuma linha de planejamento"
            descricao="A temática tem orçamento, mas nada foi programado ainda."
          />
        )}
      </Secao>

      <Secao
        titulo="Projeção plurianual"
        descricao="O teto nominal repete-se nos exercícios, mas cada composição anual é independente."
      >
        <Tabela
          colunas={[
            { chave: "ano", texto: "Exercício" },
            { chave: "orcamento", texto: "Orçamento bolsas", alinhamento: "direita" },
            { chave: "custo", texto: "Custo programado", alinhamento: "direita" },
            { chave: "saldo", texto: "Saldo", alinhamento: "direita" },
            { chave: "bolsas", texto: "Bolsas", alinhamento: "direita" },
          ]}
        >
          {area.porAno.map((ano) => (
            <tr key={ano.ano}>
              <Celula>{ano.ano}</Celula>
              <Celula direita>
                <Moeda valor={ano.valorBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.custoBolsas} />
              </Celula>
              <Celula direita>
                <Moeda valor={ano.saldoPotencial} />
              </Celula>
              <Celula direita>{inteiro(ano.bolsas)}</Celula>
            </tr>
          ))}
        </Tabela>
      </Secao>
    </Pagina>
  );
}
