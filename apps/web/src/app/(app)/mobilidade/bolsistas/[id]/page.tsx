import Link from "next/link";

import {
  SeloSituacaoBolsa,
  SeloSituacaoProduto,
} from "@/componentes/bolsistas/situacoes";
import { EditarBolsaConcedida } from "@/componentes/formularios/form-bolsa-concedida";
import { AnexarDocumentoDoBolsista } from "@/componentes/formularios/form-documento-bolsista";
import {
  AnexarComprovante,
  CorrigirEventoBolsa,
  RegistrarEventoBolsa,
} from "@/componentes/formularios/form-evento-externo";
import {
  EditarProdutoBolsa,
  NovoProdutoBolsa,
} from "@/componentes/formularios/form-produto-bolsa";
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
import { apiFetch, apiFetchOuNada } from "@/lib/api";
import type {
  AnexoResumo,
  BolsaConcedidaDetalhe,
  EventoBolsista,
  EventosDaBolsa,
  TipoEventoBolsista,
} from "@/lib/dominio";
import { carregarMe } from "@/lib/me";
import {
  categoriasDisponiveis,
  ehDocumentoPessoal,
} from "@/lib/formularios/documentos-bolsista";
import { data, dataHora, inteiro, meses, rotulo } from "@/lib/formato";

export default async function DetalheDoBolsista({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["bolsa:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Bolsista"
        descricao="Concessão, vigência, produtos e documentos."
        me={me}
        faltando={falta}
      />
    );
  }

  const podeLerEventos = me.permissions.includes("evento:read");
  const podeRegistrarEventos = me.permissions.includes("evento:create");
  const podeCorrigirEventos = me.permissions.includes("evento:edit");
  const [bolsa, documentosPermitidos, eventos, tipos] = await Promise.all([
    apiFetch<BolsaConcedidaDetalhe>(`/bolsistas/${id}`),
    // A API ja filtra o que este usuario pode ver: documento pessoal nao chega
    // para quem nao tem `documento:read-pessoal`. A tela nao refiltra — dois
    // lugares decidindo a mesma coisa divergem na primeira mudanca.
    apiFetchOuNada<AnexoResumo[]>(
      `/anexos?entidadeTipo=BOLSA_CONCEDIDA&entidadeId=${id}`,
    ),
    podeLerEventos
      ? apiFetchOuNada<EventosDaBolsa>(`/bolsistas/${id}/eventos`)
      : null,
    podeLerEventos && (podeRegistrarEventos || podeCorrigirEventos)
      ? apiFetchOuNada<TipoEventoBolsista[]>("/eventos-externos/tipos")
      : null,
  ]);
  const documentos = documentosPermitidos ?? [];
  const podeEditarBolsa = bolsa.podeEditar;
  const podeEditarProdutos = bolsa.podeEditarProduto;
  const categoriasDeDocumento = categoriasDisponiveis(me.permissions);
  const atrasados = bolsa.produtos.filter(
    (produto) => produto.situacao === "ATRASADO",
  );

  return (
    <Pagina
      titulo={bolsa.bolsista}
      descricao={
        <>
          {bolsa.modalidade} · {bolsa.ppgSigla} ·{" "}
          <Link
            href="/mobilidade/bolsistas"
            className="text-primary hover:underline"
          >
            voltar aos bolsistas
          </Link>
        </>
      }
      acoes={
        podeEditarBolsa ? <EditarBolsaConcedida bolsa={bolsa} /> : undefined
      }
    >
      {bolsa.situacaoTemporal === "EXPIRADA" ? (
        <Aviso tom="perigo" titulo="Bolsa expirada sem conclusão registrada">
          A data final foi {data(bolsa.dataFim)}, mas a situação administrativa
          ainda é {rotulo(bolsa.status)}. Confirme a conclusão ou registre a
          ocorrência adequada.
        </Aviso>
      ) : bolsa.situacaoTemporal === "PRESTES_A_EXPIRAR" ? (
        <Aviso tom="aviso" titulo="Bolsa próxima da data final">
          A vigência termina em {data(bolsa.dataFim)}. Confira produtos
          pendentes e providências de encerramento.
        </Aviso>
      ) : null}

      {atrasados.length > 0 ? (
        <Aviso tom="perigo" titulo="Produtos com prazo vencido">
          {inteiro(atrasados.length)} entrega(s) continuam abertas depois do
          prazo individual cadastrado.
        </Aviso>
      ) : null}

      <Secao titulo="Resumo da concessão">
        <Cartoes>
          <Cartao
            titulo="Situação temporal"
            valor={<SeloSituacaoBolsa situacao={bolsa.situacaoTemporal} />}
            nota={`Situação registrada: ${rotulo(bolsa.status)}`}
          />
          <Cartao
            titulo="Período real"
            valor={data(bolsa.dataInicio)}
            nota={`até ${data(bolsa.dataFim)} · ${meses(bolsa.vigenciaMeses)}`}
          />
          <Cartao
            titulo="Valor concedido"
            valor={<Moeda valor={bolsa.valorConcedido} />}
            nota={`${rotulo(bolsa.destino)} · ${rotulo(bolsa.fluxo)}`}
          />
          <Cartao
            titulo="Produtos"
            valor={
              bolsa.podeLerProdutos
                ? inteiro(bolsa.produtos.length)
                : "Sem acesso"
            }
            nota={
              bolsa.podeLerProdutos
                ? `${inteiro(atrasados.length)} com prazo vencido`
                : "Consulta de produtos não concedida neste alcance"
            }
            destaque={atrasados.length > 0}
          />
        </Cartoes>
      </Secao>

      <Secao
        titulo="Dados do bolsista e da bolsa"
        descricao="A identidade e o período pertencem à concessão individual; modalidade e valor vêm da linha planejada."
      >
        <dl className="grid gap-4 rounded-2xl border border-border bg-surface p-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Dado rotulo="Bolsista" valor={bolsa.bolsista} />
          <Dado
            rotulo="E-mail"
            valor={
              bolsa.podeLerContato
                ? (bolsa.email ?? "Não informado")
                : "Sem acesso"
            }
          />
          <Dado
            rotulo="CPF"
            valor={
              bolsa.podeLerCpf ? (bolsa.cpf ?? "Não informado") : "Sem acesso"
            }
          />
          <Dado
            rotulo="Telefone"
            valor={
              bolsa.podeLerContato
                ? (bolsa.telefone ?? "Não informado")
                : "Sem acesso"
            }
          />
          <Dado rotulo="Nível" valor={rotulo(bolsa.nivelBeneficiario)} />
          <Dado
            rotulo="Lattes"
            valor={
              bolsa.lattes ? (
                <a
                  href={bolsa.lattes}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-primary hover:underline"
                >
                  Currículo
                </a>
              ) : (
                "Não informado"
              )
            }
          />
          <Dado
            rotulo="ORCID"
            valor={
              bolsa.orcid ? (
                <a
                  href={`https://orcid.org/${bolsa.orcid}`}
                  rel="noreferrer noopener"
                  target="_blank"
                  className="text-primary hover:underline tabular-nums"
                >
                  {bolsa.orcid}
                </a>
              ) : (
                "Não informado"
              )
            }
          />
          <Dado rotulo="PPG" valor={`${bolsa.ppgSigla} · ${bolsa.ppg}`} />
          <Dado
            rotulo="Coordenação do PPG"
            valor={bolsa.coordenadorPpg ?? "Não informado"}
          />
          <Dado
            rotulo="Linha de pesquisa"
            valor={bolsa.linhaPesquisa ?? "Não informada"}
          />
          <Dado
            rotulo="Orientador"
            valor={bolsa.orientador ?? "Não informado"}
          />
          <Dado
            rotulo="Rede e temática"
            valor={
              bolsa.rede
                ? `${bolsa.rede}${bolsa.areaTematicaCodigo ? ` · ${bolsa.areaTematicaCodigo}` : ""}`
                : "Fora do planejamento desta ferramenta"
            }
          />
          <Dado
            rotulo="Programa"
            valor={`${bolsa.programa} · ${bolsa.ciclo}`}
          />
          <Dado rotulo="Modalidade" valor={bolsa.modalidade} />
          <Dado
            rotulo="Origem"
            valor={
              bolsa.instituicaoOrigem
                ? `${bolsa.instituicaoOrigem}${bolsa.paisOrigem ? ` · ${bolsa.paisOrigem}` : ""}`
                : "Não informado"
            }
          />
          <Dado
            rotulo="Destino"
            valor={
              bolsa.instituicaoDestino
                ? `${bolsa.instituicaoDestino}${bolsa.paisDestino ? ` · ${bolsa.paisDestino}` : ""}`
                : "Não informado"
            }
          />
          <Dado
            rotulo="Linha planejada"
            valor={
              bolsa.codigoPlanejamento ? (
                <Link
                  href={`/programas/${bolsa.programaSlug}/${bolsa.ciclo}/plano`}
                  className="text-primary hover:underline"
                >
                  {bolsa.codigoPlanejamento}
                </Link>
              ) : (
                "Bolsa avulsa"
              )
            }
          />
          <Dado rotulo="Processo" valor={bolsa.processo ?? "Não informado"} />
        </dl>
        {bolsa.observacoes ? (
          <p className="mt-4 rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
            {bolsa.observacoes}
          </p>
        ) : null}
      </Secao>

      <Secao
        titulo="Produtos e entregas do bolsista"
        descricao="Cada compromisso tem prazo próprio. A situação “Atrasado” é calculada quando o prazo passa sem entrega ou validação."
        acoes={
          bolsa.podeCriarProduto ? (
            <NovoProdutoBolsa bolsaId={bolsa.id} />
          ) : undefined
        }
      >
        {!bolsa.podeLerProdutos ? (
          <p className="text-sm text-muted">
            Você não tem acesso aos produtos desta bolsa.
          </p>
        ) : bolsa.produtos.length > 0 ? (
          <Tabela
            colunas={[
              { chave: "produto", texto: "Produto" },
              { chave: "colaboracao", texto: "Colaboração" },
              { chave: "tipo", texto: "Tipo" },
              { chave: "prazo", texto: "Prazo" },
              { chave: "situacao", texto: "Situação" },
              { chave: "entrega", texto: "Entrega / evidência" },
              { chave: "acoes", texto: "Ações" },
            ]}
          >
            {bolsa.produtos.map((produto) => (
              <tr key={produto.id}>
                <Celula className="max-w-md">
                  <span className="font-medium text-foreground">
                    {produto.titulo}
                  </span>
                  {produto.descricao ? (
                    <span className="mt-1 block text-xs text-muted">
                      {produto.descricao}
                    </span>
                  ) : null}
                </Celula>
                <Celula>
                  {produto.instituicaoColaboracao ?? "—"}
                  {produto.paisColaboracao ? (
                    <span className="block text-xs text-subtle">
                      {produto.paisColaboracao}
                    </span>
                  ) : null}
                </Celula>
                <Celula>{rotulo(produto.tipo)}</Celula>
                <Celula>{data(produto.prazoEntrega)}</Celula>
                <Celula>
                  <SeloSituacaoProduto situacao={produto.situacao} />
                </Celula>
                <Celula>
                  {produto.dataEntrega ? data(produto.dataEntrega) : "—"}
                  {produto.doi ? (
                    <span className="block text-xs text-subtle">
                      DOI: {produto.doi}
                    </span>
                  ) : null}
                  {produto.link ? (
                    <a
                      href={produto.link}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-xs text-primary hover:underline"
                    >
                      Abrir evidência ↗
                    </a>
                  ) : null}
                </Celula>
                <Celula>
                  {podeEditarProdutos ? (
                    <EditarProdutoBolsa bolsaId={bolsa.id} produto={produto} />
                  ) : (
                    <Selo tom="neutro">Somente leitura</Selo>
                  )}
                </Celula>
              </tr>
            ))}
          </Tabela>
        ) : (
          <EstadoVazio
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre individualmente os artigos, trabalhos, projetos, relatórios ou outras entregas esperadas desta bolsa."
            acao={
              podeEditarProdutos ? (
                <NovoProdutoBolsa bolsaId={bolsa.id} />
              ) : undefined
            }
          />
        )}
      </Secao>

      {eventos ? (
        <EventosDaCapes
          bolsa={bolsa}
          eventos={eventos}
          tipos={tipos ?? []}
          podeRegistrar={podeRegistrarEventos && bolsa.podeEditar}
          podeCorrigir={podeCorrigirEventos}
          podeAnexar={podeRegistrarEventos}
        />
      ) : null}

      <Documentos
        bolsaId={bolsa.id}
        documentos={documentos}
        podeAnexar={podeEditarBolsa}
        categorias={categoriasDeDocumento}
      />
    </Pagina>
  );
}

/**
 * Eventos externos da CAPES (V1-037).
 *
 * O histórico separa o **ato** (o que a CAPES fez, e quando) do **registro**
 * (quem anotou aqui, e quando) e marca a **correção** — as três coisas que a
 * trilha precisa distinguir anos depois. Comprovante ausente é destacado, mas
 * não impede nada: exigi-lo faria o evento nunca ser registrado.
 */
function EventosDaCapes({
  bolsa,
  eventos,
  tipos,
  podeRegistrar,
  podeCorrigir,
  podeAnexar,
}: {
  bolsa: BolsaConcedidaDetalhe;
  eventos: EventosDaBolsa;
  tipos: TipoEventoBolsista[];
  podeRegistrar: boolean;
  podeCorrigir: boolean;
  podeAnexar: boolean;
}) {
  const registrar = podeRegistrar ? (
    <RegistrarEventoBolsa
      bolsaId={bolsa.id}
      situacao={bolsa.status}
      tipos={tipos}
      substitutas={eventos.substitutas}
    />
  ) : undefined;

  return (
    <Secao
      titulo="Eventos informados pela CAPES"
      descricao="Desistência, interrupção, substituição e outros atos que aconteceram na plataforma da CAPES. O Gerenciador registra o fato; não o autoriza."
      acoes={registrar}
    >
      {eventos.substituiu.map((evento) => (
        <Aviso key={evento.id} tom="info" titulo="Bolsa substituta">
          Esta concessão entrou na vaga de{" "}
          <Link
            href={`/mobilidade/bolsistas/${evento.bolsaConcedidaId}`}
            className="font-medium underline"
          >
            {evento.bolsista}
          </Link>
          , por substituição registrada com data do ato em{" "}
          {data(evento.dataAto)}.
        </Aviso>
      ))}

      {eventos.eventos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum evento registrado"
          descricao="Quando a CAPES informar desistência, interrupção ou substituição, registre aqui com a data do ato e a justificativa."
          acao={registrar}
        />
      ) : (
        <Tabela
          rotulo="Eventos informados pela CAPES"
          colunas={[
            { chave: "evento", texto: "Evento" },
            { chave: "ato", texto: "Data do ato" },
            { chave: "efeito", texto: "Efeito na situação" },
            { chave: "referencia", texto: "Referência e comprovante" },
            { chave: "registro", texto: "Registrado" },
            { chave: "acoes", texto: <span className="sr-only">Ações</span> },
          ]}
        >
          {eventos.eventos.map((evento) => (
            <LinhaDeEvento
              key={evento.id}
              evento={evento}
              tipos={tipos}
              substitutas={eventos.substitutas}
              podeCorrigir={podeCorrigir}
              podeAnexar={podeAnexar}
            />
          ))}
        </Tabela>
      )}
    </Secao>
  );
}

function LinhaDeEvento({
  evento,
  tipos,
  substitutas,
  podeCorrigir,
  podeAnexar,
}: {
  evento: EventoBolsista;
  tipos: TipoEventoBolsista[];
  substitutas: EventosDaBolsa["substitutas"];
  podeCorrigir: boolean;
  podeAnexar: boolean;
}) {
  return (
    <tr>
      <Celula className="max-w-sm">
        <span className="font-medium text-foreground">{evento.tipoRotulo}</span>
        {evento.corrigido ? (
          <span className="ml-2">
            <Selo tom="info">Corrigido</Selo>
          </span>
        ) : null}
        <span className="mt-1 block text-xs text-muted">
          {evento.justificativa}
        </span>
        {evento.bolsaSubstitutaId ? (
          <span className="mt-1 block text-xs">
            Entrou na vaga:{" "}
            {evento.substituto ? (
              <Link
                href={`/mobilidade/bolsistas/${evento.bolsaSubstitutaId}`}
                className="text-primary hover:underline"
              >
                {evento.substituto}
              </Link>
            ) : (
              "bolsa fora do seu acesso"
            )}
          </span>
        ) : null}
        {evento.previsaoRetorno ? (
          <span className="mt-1 block text-xs text-muted">
            Previsão de retorno: {data(evento.previsaoRetorno)}
          </span>
        ) : null}
      </Celula>
      <Celula>{data(evento.dataAto)}</Celula>
      <Celula>
        {rotulo(evento.statusAnterior)} → {rotulo(evento.statusPosterior)}
      </Celula>
      <Celula>
        {evento.referenciaExterna ?? "Sem referência"}
        <span className="mt-1 block">
          {evento.comprovantes > 0 ? (
            <Selo tom="sucesso">
              {inteiro(evento.comprovantes)} comprovante(s)
            </Selo>
          ) : (
            <Selo tom="aviso">Sem comprovante</Selo>
          )}
        </span>
      </Celula>
      <Celula>
        {dataHora(evento.registradoEm)}
        {evento.registradoPorNome ? (
          <span className="mt-0.5 block text-xs text-muted">
            {evento.registradoPorNome}
          </span>
        ) : null}
      </Celula>
      <Celula>
        <div className="flex flex-col items-start gap-2">
          {podeCorrigir ? (
            <CorrigirEventoBolsa
              evento={evento}
              tipos={tipos}
              substitutas={substitutas}
            />
          ) : null}
          {podeAnexar ? (
            <AnexarComprovante
              entidadeTipo="EVENTO_BOLSISTA"
              entidadeId={evento.id}
              bolsaId={evento.bolsaConcedidaId}
            />
          ) : null}
        </div>
      </Celula>
    </tr>
  );
}

/**
 * Documentos da concessão (BOL-021).
 *
 * **Não há exclusão**, só substituição — que cria versão nova e preserva a
 * anterior (CG-014). O download sai por `/anexos/:id/conteudo`, nunca por
 * arquivo estático: caminho público transformaria "conhecer a URL" em permissão
 * de leitura, e há documento pessoal nesta lista.
 *
 * A lista já chega filtrada pela API. O selo de documento pessoal existe para
 * quem **pode** ver os dois tipos saber, de relance, qual arquivo não circula.
 */
function Documentos({
  bolsaId,
  documentos,
  podeAnexar,
  categorias,
}: {
  bolsaId: string;
  documentos: AnexoResumo[];
  podeAnexar: boolean;
  categorias: { valor: string; texto: string }[];
}) {
  const ativos = documentos.filter((documento) => documento.ativo);

  return (
    <Secao
      titulo="Documentos do bolsista"
      descricao="Carta de aceite, plano de trabalho, relatórios e documentos pessoais. Substituir cria versão nova e preserva a anterior."
      acoes={
        podeAnexar ? (
          <AnexarDocumentoDoBolsista
            bolsaId={bolsaId}
            categorias={categorias}
          />
        ) : undefined
      }
    >
      {ativos.length === 0 ? (
        <EstadoVazio
          titulo="Nenhum documento anexado"
          descricao="Anexe a carta de aceite e o plano de trabalho quando estiverem disponíveis."
          acao={
            podeAnexar ? (
              <AnexarDocumentoDoBolsista
                bolsaId={bolsaId}
                categorias={categorias}
              />
            ) : undefined
          }
        />
      ) : (
        <Tabela
          rotulo="Documentos do bolsista"
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
              <Celula>
                {rotulo(documento.categoria)}
                {ehDocumentoPessoal(documento.categoria) ? (
                  <span className="mt-1 block">
                    <Selo tom="aviso">Pessoal</Selo>
                  </span>
                ) : null}
                {documento.retencaoAte ? (
                  <span className="mt-1 block text-xs text-muted">
                    Guardar até {data(documento.retencaoAte)}
                  </span>
                ) : null}
              </Celula>
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

function tamanhoLegivel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function Dado({
  rotulo: nome,
  valor,
}: {
  rotulo: string;
  valor: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-subtle">{nome}</dt>
      <dd className="mt-1 text-foreground">{valor}</dd>
    </div>
  );
}
