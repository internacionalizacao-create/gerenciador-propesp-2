import type { Metadata } from "next";
import Link from "next/link";

import {
  AnexarComprovante,
  CorrigirMovimentacao,
  RegistrarMovimentacao,
} from "@/componentes/formularios/form-evento-externo";
import {
  Aviso,
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
import { apiFetch, apiFetchOuNada } from "@/lib/api";
import type {
  Ciclo,
  EventoBolsista,
  Movimentacao,
  ReferenciasMovimentacao,
} from "@/lib/dominio";
import { data, dataHora, inteiro, rotulo } from "@/lib/formato";
import { carregarMe } from "@/lib/me";

export const metadata: Metadata = {
  title: "Eventos da CAPES — Gerenciador PROPESP",
};

/**
 * P12 · Eventos da CAPES (V1-037).
 *
 * **Livro-razão do que já aconteceu na plataforma da CAPES**, e não tela de
 * pedido: o Gerenciador não propõe, não autoriza e não paga (RN-13, §1 do
 * AGENTS). Duas partes, porque são dois fatos diferentes:
 *
 * - a **movimentação de recurso** entre PPGs da mesma temática, que se
 *   registra aqui;
 * - os **eventos dos bolsistas** do ciclo, que se registram na página da
 *   própria bolsa — é lá que está a situação que o evento muda — e aparecem
 *   aqui só para consulta.
 */
export default async function EventosDaCapesPagina({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo } = await params;
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["evento:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Eventos da CAPES"
        descricao="Movimentações de recurso e eventos de bolsistas registrados a partir da plataforma da CAPES."
        me={me}
        faltando={falta}
      />
    );
  }

  const base = `/programas/${programa}/${ciclo}`;
  const podeRegistrar = me.permissions.includes("evento:create");
  const podeCorrigir = me.permissions.includes("evento:edit");
  const [movimentacoes, eventos, referencias] = await Promise.all([
    apiFetch<{ ciclo: Ciclo; movimentacoes: Movimentacao[] }>(
      `${base}/movimentacoes`,
    ),
    apiFetch<{ eventos: EventoBolsista[] }>(`${base}/eventos-bolsista`),
    podeRegistrar
      ? apiFetchOuNada<ReferenciasMovimentacao>(
          `${base}/movimentacoes/referencias`,
        )
      : null,
  ]);
  const podeCadastrar = Boolean(referencias && referencias.tematicas.length > 0);

  return (
    <Pagina
      titulo="Eventos da CAPES"
      descricao={`${movimentacoes.ciclo.programaNome} · ciclo ${movimentacoes.ciclo.cicloNome}`}
    >
      <Aviso tom="info" titulo="Registro, não autorização">
        Esta tela guarda o que já aconteceu na plataforma da CAPES, com a data
        do ato e quem registrou. Nada aqui solicita, autoriza ou executa
        movimentação, e o registro não altera o plano nem o teto das temáticas.
      </Aviso>

      <Secao
        titulo="Movimentações de recurso"
        descricao="Recurso ou vaga que a CAPES transferiu entre PPGs da mesma área temática."
        acoes={
          podeCadastrar && referencias ? (
            <RegistrarMovimentacao
              programa={programa}
              ciclo={ciclo}
              referencias={referencias}
            />
          ) : undefined
        }
      >
        {podeRegistrar && !podeCadastrar ? (
          <p className="mb-4 text-sm text-muted">
            Seu acesso não alcança dois PPGs de uma mesma temática, e a
            movimentação precisa dos dois lados.
          </p>
        ) : null}
        {movimentacoes.movimentacoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma movimentação registrada"
            descricao="Quando a CAPES transferir recurso ou vaga entre PPGs da mesma temática, registre aqui com a data do ato."
          />
        ) : (
          <Tabela
            rotulo="Movimentações de recurso"
            colunas={[
              { chave: "codigo", texto: "Registro" },
              { chave: "tematica", texto: "Temática" },
              { chave: "ppgs", texto: "De → para" },
              { chave: "rubrica", texto: "Rubrica" },
              { chave: "valor", texto: "Valor", alinhamento: "direita" },
              { chave: "referencia", texto: "Referência e comprovante" },
              { chave: "registro", texto: "Registrado" },
              { chave: "acoes", texto: <span className="sr-only">Ações</span> },
            ]}
          >
            {movimentacoes.movimentacoes.map((linha) => (
              <tr key={linha.id}>
                <Celula className="max-w-xs">
                  <span className="font-medium text-foreground">
                    {linha.codigo}
                  </span>
                  {linha.corrigido ? (
                    <span className="ml-2">
                      <Selo tom="info">Corrigido</Selo>
                    </span>
                  ) : null}
                  <span className="mt-1 block text-xs text-muted">
                    Ato em {data(linha.dataAto)} · exercício {linha.ano}
                  </span>
                  <span className="mt-1 block text-xs text-muted">
                    {linha.justificativa}
                  </span>
                </Celula>
                <Celula>
                  {linha.areaTematicaCodigo}
                  <span className="block text-xs text-subtle">
                    {linha.rede}
                  </span>
                </Celula>
                <Celula>
                  {linha.ppgOrigemSigla} → {linha.ppgDestinoSigla}
                </Celula>
                <Celula>
                  {rotulo(linha.rubrica)}
                  {linha.modalidade || linha.quantidade ? (
                    <span className="block text-xs text-subtle">
                      {[
                        linha.modalidade,
                        linha.quantidade
                          ? `${inteiro(linha.quantidade)} bolsa(s)`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </Celula>
                <Celula direita>
                  <Moeda valor={linha.valor} />
                </Celula>
                <Celula>
                  {linha.referenciaExterna ?? "Sem referência"}
                  <span className="mt-1 block">
                    {linha.comprovantes > 0 ? (
                      <Selo tom="sucesso">
                        {inteiro(linha.comprovantes)} comprovante(s)
                      </Selo>
                    ) : (
                      <Selo tom="aviso">Sem comprovante</Selo>
                    )}
                  </span>
                </Celula>
                <Celula>
                  {dataHora(linha.registradoEm)}
                  {linha.registradoPorNome ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {linha.registradoPorNome}
                    </span>
                  ) : null}
                </Celula>
                <Celula>
                  <div className="flex flex-col items-start gap-2">
                    {podeCorrigir && referencias ? (
                      <CorrigirMovimentacao
                        movimentacao={linha}
                        referencias={referencias}
                      />
                    ) : null}
                    {podeRegistrar ? (
                      <AnexarComprovante
                        entidadeTipo="REMANEJAMENTO"
                        entidadeId={linha.id}
                      />
                    ) : null}
                  </div>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Eventos de bolsistas"
        descricao="Desistências, interrupções e substituições do ciclo. O registro e a correção são feitos na página de cada bolsa."
      >
        {eventos.eventos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum evento de bolsista registrado"
            descricao="Os eventos aparecem aqui assim que forem registrados na página da bolsa."
          />
        ) : (
          <Tabela
            rotulo="Eventos de bolsistas"
            colunas={[
              { chave: "bolsista", texto: "Bolsista" },
              { chave: "evento", texto: "Evento" },
              { chave: "ato", texto: "Data do ato" },
              { chave: "efeito", texto: "Efeito na situação" },
              { chave: "comprovante", texto: "Comprovante" },
              { chave: "registro", texto: "Registrado" },
            ]}
          >
            {eventos.eventos.map((evento) => (
              <tr key={evento.id}>
                <Celula>
                  <Link
                    href={`/mobilidade/bolsistas/${evento.bolsaConcedidaId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {evento.bolsista}
                  </Link>
                  <span className="block text-xs text-subtle">
                    {evento.ppgSigla}
                  </span>
                </Celula>
                <Celula>
                  {evento.tipoRotulo}
                  {evento.corrigido ? (
                    <span className="ml-2">
                      <Selo tom="info">Corrigido</Selo>
                    </span>
                  ) : null}
                </Celula>
                <Celula>{data(evento.dataAto)}</Celula>
                <Celula>
                  {rotulo(evento.statusAnterior)} →{" "}
                  {rotulo(evento.statusPosterior)}
                </Celula>
                <Celula>
                  {evento.comprovantes > 0 ? (
                    <Selo tom="sucesso">
                      {inteiro(evento.comprovantes)} comprovante(s)
                    </Selo>
                  ) : (
                    <Selo tom="aviso">Sem comprovante</Selo>
                  )}
                </Celula>
                <Celula>
                  {dataHora(evento.registradoEm)}
                  {evento.registradoPorNome ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      {evento.registradoPorNome}
                    </span>
                  ) : null}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </Pagina>
  );
}
