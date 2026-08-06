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
import { NovaLinhaDePlano } from "@/componentes/formularios/nova-linha-plano";
import { apiFetch } from "@/lib/api";
import type {
  Ciclo,
  LinhaPlano,
  LinhaPpg,
  LinhaRede,
  LinhaTematica,
  Membro,
  TabelaVigente,
} from "@/lib/dominio";
import { inteiro, meses, rotulo, somarMoeda } from "@/lib/formato";

interface RespostaPlano {
  ciclo: Ciclo;
  linhas: LinhaPlano[];
}

interface RespostaRedes {
  ano: number;
  redes: (LinhaRede & { areas: (LinhaTematica & { membros: Membro[] })[] })[];
}

/**
 * P10 · Plano de aplicação — a tela mais importante do sistema.
 *
 * As três rubricas ficam na mesma tela, separadas por seção. A coluna "origem do
 * valor" existe para que nunca haja dúvida sobre qual número é oficial e qual é
 * estimado: misturar os dois sem aviso é como um valor sem lastro entra num
 * relatório de prestação de contas parecendo tabelado.
 */
export default async function PlanoDeAplicacao({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string }>;
}) {
  const { programa, ciclo: cicloNome } = await params;
  const base = `/programas/${programa}/${cicloNome}`;

  const [plano, ppgs, catalogo, redes] = await Promise.all([
    apiFetch<RespostaPlano>(`${base}/plano`),
    apiFetch<LinhaPpg[]>("/ppgs"),
    apiFetch<TabelaVigente>(`/catalogo/bolsas?programa=${programa}`),
    apiFetch<RespostaRedes>(`${base}/redes`),
  ]);

  const areas = redes.redes.flatMap((rede) =>
    rede.areas.map((a) => ({
      id: a.areaTematicaId,
      codigo: a.codigo,
      nome: a.nome,
      rede: rede.rede,
    })),
  );

  const bolsas = plano.linhas.filter((l) => l.rubrica === "BOLSAS");
  const manutencao = plano.linhas.filter((l) => l.rubrica === "MANUTENCAO");
  const missoes = plano.linhas.filter((l) => l.rubrica === "MISSOES");

  const programadas = bolsas.filter((l) => l.status === "PROGRAMADO");
  const pendentes = bolsas.filter((l) => l.status === "PENDENTE");

  return (
    <Pagina
      titulo="Plano de aplicação"
      descricao="O que será gasto, nas três rubricas. Em bolsas o valor vem do catálogo oficial; em manutenção e missões é estimativa justificada."
      acoes={
        <NovaLinhaDePlano
          programa={programa}
          ciclo={cicloNome}
          ppgs={ppgs}
          areas={areas}
          catalogo={catalogo.itens}
        />
      }
    >
      <Cartoes>
        <Cartao
          titulo="Bolsas programadas"
          valor={inteiro(
            programadas.reduce((total, l) => total + l.quantidadeAnual, 0),
          )}
          nota={`em ${inteiro(programadas.length)} linhas de planejamento`}
        />
        <Cartao
          titulo="Custo anual das bolsas"
          valor={
            <Moeda valor={somarMoeda(programadas.map((l) => l.custoAnual))} />
          }
          nota="Quantidade × valor do catálogo"
        />
        <Cartao
          titulo="Linhas pendentes"
          valor={inteiro(pendentes.length)}
          nota="Aguardando definição de orçamento pela rede"
        />
        <Cartao
          titulo="Manutenção e missões"
          valor={inteiro(manutencao.length + missoes.length)}
          nota="Linhas planejadas nessas rubricas"
        />
      </Cartoes>

      <div className="mt-10" />

      <Secao
        titulo="Bolsas"
        descricao="O valor unitário nunca é digitado: vem do catálogo vigente (RN-01). Combinação sem item no catálogo não pode ser salva."
      >
        <TabelaDeBolsas linhas={programadas} anos={plano.ciclo.anos} />
      </Secao>

      {pendentes.length > 0 ? (
        <Secao
          titulo="Linhas pendentes"
          descricao="Existem no plano com quantidade zero e sem modalidade, aguardando a rede informar o orçamento. Aparecem aqui em vez de sumir — some quem já foi decidido, não quem falta decidir."
        >
          <Tabela
            colunas={[
              { chave: "codigo", texto: "Código" },
              { chave: "ppg", texto: "PPG" },
              { chave: "tematica", texto: "Temática" },
              { chave: "obs", texto: "Situação" },
            ]}
          >
            {pendentes.map((linha) => (
              <tr key={linha.id}>
                <Celula>
                  <span className="font-mono text-xs">{linha.codigo}</span>
                </Celula>
                <Celula>{linha.ppgSigla}</Celula>
                <Celula>{linha.tematica ?? "—"}</Celula>
                <Celula className="text-muted">
                  {linha.validacaoPendencia ??
                    "Aguardando definição de orçamento pela rede."}
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      <Secao
        titulo="Manutenção"
        descricao="Não há tabela oficial para esta rubrica; todo valor é estimativa e exige justificativa."
      >
        {manutencao.length > 0 ? (
          <TabelaDeApoio linhas={manutencao} />
        ) : (
          <EstadoVazio
            titulo="Nenhum item de manutenção planejado"
            descricao={
              <>
                Há orçamento nesta rubrica e nenhum item programado. Os anexos
                das redes informam o valor global, mas não detalham em que será
                gasto — é a pendência <strong>PEND-009</strong>. A lacuna aparece
                aqui de propósito: é informação que a planilha não dava.
              </>
            }
          />
        )}
      </Secao>

      <Secao
        titulo="Missões"
        descricao="Visitas técnicas, eventos, articulação institucional e bancas."
      >
        {missoes.length > 0 ? (
          <TabelaDeApoio linhas={missoes} />
        ) : (
          <EstadoVazio
            titulo="Nenhuma missão planejada"
            descricao={
              <>
                Mesmo caso da manutenção: orçamento sem detalhamento, registrado
                como <strong>PEND-010</strong>.
              </>
            }
          />
        )}
      </Secao>

      <Aviso tom="info" titulo="Por que uma linha nunca é excluída">
        Em ciclo não encerrado, remover uma linha apagaria o registro do que já
        foi planejado. O sistema cancela, com justificativa, e mantém o
        histórico — foi a ausência disso que fez a programação anterior da UFMG
        só sobreviver porque alguém criou uma aba à mão.
      </Aviso>
    </Pagina>
  );
}

function TabelaDeBolsas({
  linhas,
  anos,
}: {
  linhas: LinhaPlano[];
  anos: number[];
}) {
  if (linhas.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhuma bolsa programada"
        descricao="Use “Nova linha” para começar o plano deste ciclo."
      />
    );
  }

  return (
    <Tabela
      colunas={[
        { chave: "codigo", texto: "Código" },
        { chave: "ppg", texto: "PPG" },
        { chave: "tematica", texto: "Temática" },
        { chave: "modalidade", texto: "Modalidade" },
        { chave: "destino", texto: "Destino" },
        { chave: "vigencia", texto: "Vigência" },
        { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
        { chave: "mes", texto: "Mês" },
        { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
        { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
        { chave: "ciclo", texto: "Custo no ciclo", alinhamento: "direita" },
        { chave: "fluxo", texto: "Fluxo" },
      ]}
      rodape={
        <tr>
          <Celula>Total</Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula direita>
            {inteiro(linhas.reduce((t, l) => t + l.quantidadeAnual, 0))}
          </Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula direita>
            <Moeda valor={somarMoeda(linhas.map((l) => l.custoAnual))} forte />
          </Celula>
          <Celula direita>
            <Moeda valor={somarMoeda(linhas.map((l) => l.custoCiclo))} forte />
          </Celula>
          <Celula>{anos.length} exercícios</Celula>
        </tr>
      }
    >
      {linhas.map((linha) => (
        <tr key={linha.id}>
          <Celula>
            <span className="font-mono text-xs">{linha.codigo}</span>
          </Celula>
          <Celula>
            <span className="font-medium text-foreground">
              {linha.ppgSigla}
            </span>
          </Celula>
          <Celula>{linha.tematica ?? "—"}</Celula>
          <Celula>{linha.modalidade ?? "—"}</Celula>
          <Celula>
            <Selo tom={linha.destino === "BRASIL" ? "info" : "primario"}>
              {linha.destino === "BRASIL" ? "Brasil" : "Exterior"}
            </Selo>
          </Celula>
          <Celula>{meses(linha.vigenciaMeses)}</Celula>
          <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
          <Celula>{rotulo(linha.mesImplementacao)}</Celula>
          <Celula direita>
            <Moeda valor={linha.valorUnitario} />
            <span className="mt-0.5 block">
              <OrigemDoValor linha={linha} />
            </span>
          </Celula>
          <Celula direita>
            <Moeda valor={linha.custoAnual} />
          </Celula>
          <Celula direita>
            <Moeda valor={linha.custoCiclo} />
          </Celula>
          <Celula>
            <Selo tom={linha.fluxo === "IN" ? "sucesso" : "neutro"}>
              {linha.fluxo ?? "—"}
            </Selo>
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

function TabelaDeApoio({ linhas }: { linhas: LinhaPlano[] }) {
  return (
    <Tabela
      colunas={[
        { chave: "codigo", texto: "Código" },
        { chave: "ppg", texto: "PPG" },
        { chave: "descricao", texto: "Descrição" },
        { chave: "qtd", texto: "Qtd./ano", alinhamento: "direita" },
        { chave: "unit", texto: "Valor unitário", alinhamento: "direita" },
        { chave: "custo", texto: "Custo/ano", alinhamento: "direita" },
        { chave: "justificativa", texto: "Justificativa da estimativa" },
      ]}
      rodape={
        <tr>
          <Celula>Total</Celula>
          <Celula>—</Celula>
          <Celula>—</Celula>
          <Celula direita>
            {inteiro(linhas.reduce((t, l) => t + l.quantidadeAnual, 0))}
          </Celula>
          <Celula>—</Celula>
          <Celula direita>
            <Moeda valor={somarMoeda(linhas.map((l) => l.custoAnual))} forte />
          </Celula>
          <Celula>—</Celula>
        </tr>
      }
    >
      {linhas.map((linha) => (
        <tr key={linha.id}>
          <Celula>
            <span className="font-mono text-xs">{linha.codigo}</span>
          </Celula>
          <Celula>{linha.ppgSigla}</Celula>
          <Celula className="max-w-xs">{linha.descricao ?? "—"}</Celula>
          <Celula direita>{inteiro(linha.quantidadeAnual)}</Celula>
          <Celula direita>
            <Moeda valor={linha.valorUnitario} />
            <span className="mt-0.5 block">
              <OrigemDoValor linha={linha} />
            </span>
          </Celula>
          <Celula direita>
            <Moeda valor={linha.custoAnual} />
          </Celula>
          <Celula className="max-w-sm text-muted">
            {linha.justificativaEstimativa ?? (
              <span className="italic text-danger">Sem justificativa</span>
            )}
          </Celula>
        </tr>
      ))}
    </Tabela>
  );
}

/**
 * O selo que distingue número oficial de estimativa.
 *
 * É a informação mais importante da tabela depois do próprio valor: quem lê um
 * relatório precisa saber se aquele R$ 82.902,20 saiu de uma portaria da CAPES
 * ou do palpite de alguém.
 */
function OrigemDoValor({ linha }: { linha: LinhaPlano }) {
  if (linha.origemValor === "CATALOGO") {
    return (
      <Selo tom="sucesso" titulo={`Item ${linha.itemCatalogoCodigo} do catálogo vigente`}>
        oficial · {linha.itemCatalogoCodigo}
      </Selo>
    );
  }

  if (linha.origemValor === "ESTIMADO") {
    return (
      <Selo tom="aviso" titulo="Valor digitado, não tabelado">
        estimado
      </Selo>
    );
  }

  return (
    <Selo tom="neutro" titulo="Sem valor definido">
      sem valor
    </Selo>
  );
}
