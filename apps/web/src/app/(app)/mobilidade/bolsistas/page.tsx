import Link from "next/link";

import { SeloSituacaoBolsa } from "@/componentes/bolsistas/situacoes";
import { NovaBolsaConcedida } from "@/componentes/formularios/form-bolsa-concedida";
import {
  Aviso,
  Cartao,
  Cartoes,
  Celula,
  EstadoVazio,
  Moeda,
  Pagina,
  Tabela,
} from "@/componentes/ui/basicos";
import { ProvedorDeConsultas } from "@/componentes/consultas/provedor";
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { apiFetch, apiFetchOuNada } from "@/lib/api";
import type {
  BolsaConcedidaResumo,
  OpcaoBolsaPlanejada,
  ReferenciasBolsa,
} from "@/lib/dominio";
import { carregarMe } from "@/lib/me";
import { data, inteiro, rotulo } from "@/lib/formato";

export default async function Bolsistas() {
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["bolsa:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Bolsistas"
        descricao="Concessões individuais, vigência e produtos de cada bolsa."
        me={me}
        faltando={falta}
      />
    );
  }

  const [bolsas, opcoes, referencias] = await Promise.all([
    apiFetch<BolsaConcedidaResumo[]>("/bolsistas"),
    apiFetchOuNada<OpcaoBolsaPlanejada[]>("/bolsistas/opcoes-planejamento"),
    // Primeira pagina do seletor: o Server Component busca, e o TanStack Query
    // so entra depois da pintura, quando a pessoa digita (AGENTS.md secao 8).
    me.permissions.includes("bolsa:create")
      ? apiFetch<ReferenciasBolsa>("/bolsistas/referencias?acao=bolsa:create")
      : Promise.resolve(null),
  ]);

  const podeCadastrar =
    me.permissions.includes("bolsa:create") &&
    (opcoes ?? []).some((opcao) =>
      opcao.porAno.some((ano) => ano.vagasDisponiveis > 0),
    );
  const emCurso = bolsas.filter((bolsa) =>
    ["EM_VIGENCIA", "PRESTES_A_EXPIRAR"].includes(bolsa.situacaoTemporal),
  );
  const alertas = bolsas.filter((bolsa) =>
    ["PRESTES_A_EXPIRAR", "EXPIRADA"].includes(bolsa.situacaoTemporal),
  );

  return (
    <Pagina
      titulo="Bolsistas e bolsas concedidas"
      descricao="Acompanhamento individual do beneficiário, do período real e dos produtos que ele deve entregar."
      acoes={
        podeCadastrar && referencias ? (
          <ProvedorDeConsultas>
            <NovaBolsaConcedida
              opcoes={opcoes ?? []}
              referencias={referencias}
            />
          </ProvedorDeConsultas>
        ) : undefined
      }
    >
      {alertas.length > 0 ? (
        <Aviso tom="aviso" titulo="Prazos que pedem atenção">
          {inteiro(alertas.length)} bolsa(s) estão próximas do fim ou passaram
          da data final sem uma conclusão registrada.
        </Aviso>
      ) : null}

      <div className="mb-8">
        <Cartoes>
          <Cartao
            titulo="Bolsas cadastradas"
            valor={inteiro(bolsas.length)}
            nota="Uma pessoa por concessão"
          />
          <Cartao
            titulo="Em vigência"
            valor={inteiro(emCurso.length)}
            nota="Inclui as próximas de expirar"
          />
          <Cartao
            titulo="Alertas de prazo"
            valor={inteiro(alertas.length)}
            nota="Expiradas ou a até 30 dias do fim"
            destaque={alertas.length > 0}
          />
          <Cartao
            titulo="Produtos a acompanhar"
            valor={
              bolsas.some((bolsa) => bolsa.produtosPendentes === null)
                ? "Acesso parcial"
                : inteiro(
                    bolsas.reduce(
                      (total, bolsa) => total + (bolsa.produtosPendentes ?? 0),
                      0,
                    ),
                  )
            }
            nota="Previstos ou ainda em desenvolvimento"
          />
        </Cartoes>
      </div>

      {bolsas.length > 0 ? (
        <Tabela
          colunas={[
            { chave: "bolsista", texto: "Bolsista" },
            { chave: "ppg", texto: "PPG / programa" },
            { chave: "bolsa", texto: "Bolsa" },
            { chave: "periodo", texto: "Período real" },
            { chave: "valor", texto: "Valor", alinhamento: "direita" },
            { chave: "situacao", texto: "Situação" },
            { chave: "produtos", texto: "Produtos", alinhamento: "direita" },
            { chave: "acoes", texto: "Ações" },
          ]}
        >
          {bolsas.map((bolsa) => (
            <tr key={bolsa.id}>
              <Celula>
                <Link
                  href={`/mobilidade/bolsistas/${bolsa.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {bolsa.bolsista}
                </Link>
                <span className="block text-xs text-subtle">
                  {rotulo(bolsa.nivelBeneficiario)}
                </span>
              </Celula>
              <Celula>
                <span className="font-medium text-foreground">
                  {bolsa.ppgSigla}
                </span>
                <span className="block text-xs text-subtle">
                  {bolsa.programa} · {bolsa.ciclo}
                </span>
              </Celula>
              <Celula>
                {bolsa.modalidade}
                <span className="block text-xs text-subtle">
                  {bolsa.codigoPlanejamento ?? "Bolsa avulsa"} ·{" "}
                  {rotulo(bolsa.destino)}
                </span>
                <span className="block text-xs text-subtle">
                  {bolsa.instituicaoOrigem ?? "Origem não informada"}
                  {bolsa.paisOrigem ? ` · ${bolsa.paisOrigem}` : ""}
                </span>
                <span className="block text-xs text-subtle">
                  → {bolsa.instituicaoDestino ?? "Destino não informado"}
                  {bolsa.paisDestino ? ` · ${bolsa.paisDestino}` : ""}
                </span>
              </Celula>
              <Celula>
                {data(bolsa.dataInicio)} a {data(bolsa.dataFim)}
              </Celula>
              <Celula direita>
                <Moeda valor={bolsa.valorConcedido} />
              </Celula>
              <Celula>
                <SeloSituacaoBolsa situacao={bolsa.situacaoTemporal} />
              </Celula>
              <Celula direita>
                {bolsa.produtos === null
                  ? "Sem acesso"
                  : inteiro(bolsa.produtos)}
                {(bolsa.produtosPendentes ?? 0) > 0 ? (
                  <span className="block text-xs text-warning">
                    {inteiro(bolsa.produtosPendentes ?? 0)} a acompanhar
                  </span>
                ) : null}
              </Celula>
              <Celula>
                <Link
                  href={`/mobilidade/bolsistas/${bolsa.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Abrir →
                </Link>
              </Celula>
            </tr>
          ))}
        </Tabela>
      ) : (
        <EstadoVazio
          titulo="Nenhuma bolsa concedida a uma pessoa"
          descricao="As planilhas trazem apenas o planejamento agregado. Use “Conceder bolsa” quando o beneficiário e as datas completas forem conhecidos."
          acao={
            podeCadastrar && referencias ? (
              <ProvedorDeConsultas>
                <NovaBolsaConcedida
                  opcoes={opcoes ?? []}
                  referencias={referencias}
                />
              </ProvedorDeConsultas>
            ) : undefined
          }
        />
      )}
    </Pagina>
  );
}
