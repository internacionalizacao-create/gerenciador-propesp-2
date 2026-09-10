import Link from "next/link";

import {
  AcoesDoContato,
  ConciliarParceiroBotao,
  InativarParceiroBotao,
} from "@/componentes/formularios/acoes-parceiro";
import {
  EditarContato,
  NovoContato,
} from "@/componentes/formularios/form-contato-parceiro";
import { EditarParceiro } from "@/componentes/formularios/form-parceiro";
import {
  Aviso,
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
  HistoricoParceiro,
  Me,
  Parceiro,
  ReferenciasMissao,
} from "@/lib/dominio";
import { data, inteiro, rotulo } from "@/lib/formato";

/**
 * CG-049 · Histórico do parceiro.
 *
 * Toda a página vem de `GET /parceiros/:id/historico` (CG-027), que já entrega
 * a linha histórica sem duplicar missão multirrede. A tela não recalcula nem
 * agrega nada — se um número aqui divergir da API, o erro é da API.
 */
export default async function ParceiroDetalhe({
  params,
}: {
  params: Promise<{ programa: string; ciclo: string; id: string }>;
}) {
  const { programa, ciclo, id } = await params;
  const me = await apiFetch<Me>("/me");

  if (!me.permissions.includes("parceiro:read")) {
    return (
      <Pagina titulo="Parceiro" descricao="Histórico da instituição parceira.">
        <EstadoVazio
          titulo="Acesso restrito"
          descricao="Nesta etapa, somente o perfil administrador pode consultar parceiros e seus contatos."
        />
      </Pagina>
    );
  }

  const [historico, referencias, ativos] = await Promise.all([
    apiFetch<HistoricoParceiro>(`/parceiros/${id}/historico`),
    apiFetch<ReferenciasMissao>(
      `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
    ),
    // Destinos possiveis da conciliacao. A API exige destino ativo, entao a
    // lista padrao (so ativos) ja e o conjunto certo.
    apiFetch<Parceiro[]>("/parceiros"),
  ]);

  const {
    parceiro,
    contatos,
    mobilidades,
    missoes,
    eventos,
    documentos,
    convenios,
    produtos,
  } = historico;
  const podeEscrever = me.permissions.includes("parceiro:write");
  const base = `/programas/${programa}/${ciclo}/parceiros`;

  return (
    <Pagina
      titulo={parceiro.nome}
      descricao={
        [parceiro.sigla, parceiro.tipoOrganizacao, parceiro.pais]
          .filter(Boolean)
          .join(" · ") || "Instituição parceira internacional."
      }
      acoes={
        podeEscrever && parceiro.ativo ? (
          <div className="flex flex-wrap gap-2">
            <EditarParceiro
              parceiro={parceiro}
              redes={referencias.redes}
              paises={referencias.paises}
            />
            <ConciliarParceiroBotao
              parceiro={parceiro}
              candidatos={ativos.filter((item) => item.id !== parceiro.id)}
            />
            <InativarParceiroBotao parceiro={parceiro} />
          </div>
        ) : undefined
      }
    >
      <p className="mb-6">
        <Link href={base} className="text-sm text-primary hover:underline">
          ← Voltar para parceiros
        </Link>
      </p>

      {parceiro.ativo ? null : (
        <div
          role="status"
          className="mb-6 rounded-2xl border-l-4 border-warning bg-warning-soft px-4 py-3.5 text-sm text-on-warning-soft"
        >
          <p className="font-semibold">
            {parceiro.substituidaPorId
              ? "Cadastro conciliado"
              : "Cadastro inativo"}
          </p>
          <div className="mt-1">
            {parceiro.substituidaPorId ? (
              <>
                Este cadastro foi conciliado em{" "}
                <Link
                  href={`${base}/${parceiro.substituidaPorId}`}
                  className="font-medium underline"
                >
                  outro parceiro
                </Link>
                . O histórico permanece aqui: a conciliação não apaga a origem.
              </>
            ) : (
              "O cadastro não aceita edição enquanto estiver inativo, e as missões que o citam continuam intactas."
            )}
          </div>
        </div>
      )}

      <Cartoes>
        <Cartao titulo="Missões" valor={inteiro(missoes.length)} />
        <Cartao titulo="Eventos" valor={inteiro(eventos.length)} />
        <Cartao
          titulo="Contatos ativos"
          valor={inteiro(contatos.filter((c) => c.ativo).length)}
        />
        <Cartao titulo="Documentos" valor={inteiro(documentos.length)} />
      </Cartoes>

      <div className="mt-10" />

      {/*
        Os dois eixos lado a lado, e não um só (BOL-031). O estágio é o que a
        equipe declarou; mobilidade e parceria são fatos lidos do banco. Fundi-los
        num rótulo único obrigaria a escolher qual dos dois manda, e o escolhido
        contradiria o outro no primeiro caso divergente.
      */}
      <Secao
        titulo="Situação do relacionamento"
        acoes={
          <a
            href={`/api/bff/parceiros/${parceiro.id}/ficha`}
            className="rounded-lg border border-border-strong px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Baixar ficha (PDF)
          </a>
        }
        descricao="O estágio é declarado pela equipe. Mobilidade e parceria são deduzidas das bolsas e dos convênios registrados — não se editam aqui."
      >
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-5 py-4 text-sm">
          <Selo tom="primario">
            {rotulo(parceiro.estagioRelacionamento)}
          </Selo>
          <Selo tom={parceiro.mobilidadeRealizada ? "sucesso" : "neutro"}>
            {parceiro.mobilidadeRealizada
              ? "Mobilidade realizada"
              : "Sem mobilidade registrada"}
          </Selo>
          <Selo tom={parceiro.parceriaFormalizada ? "sucesso" : "neutro"}>
            {parceiro.parceriaFormalizada
              ? "Parceria formalizada"
              : "Sem parceria formalizada"}
          </Selo>
        </div>
        {parceiro.origemObservacao ? (
          <p className="mt-3 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
            {parceiro.origemObservacao}
          </p>
        ) : null}
        {/* BOL-035: o aviso é exigência do documento da equipe. */}
        <Aviso tom="info" titulo="O cadastro não garante vaga nem bolsa">
          O histórico registra ações já realizadas e não implica disponibilidade
          futura de vagas nem concessão automática de bolsas.
        </Aviso>
      </Secao>

      <Secao titulo="Dados institucionais">
        <dl className="grid gap-x-8 gap-y-4 rounded-2xl border border-border bg-surface px-5 py-5 sm:grid-cols-2 lg:grid-cols-3">
          <Dado rotuloTexto="Sigla" valor={parceiro.sigla} />
          <Dado rotuloTexto="Tipo de organização" valor={parceiro.tipoOrganizacao} />
          <Dado
            rotuloTexto="Faculdade ou departamento"
            valor={parceiro.faculdadeDepartamento}
          />
          <Dado
            rotuloTexto="Programa relacionado"
            valor={parceiro.programaRelacionado}
          />
          <Dado
            rotuloTexto="Grupo de pesquisa"
            valor={parceiro.grupoPesquisa}
          />
          <Dado rotuloTexto="Áreas de atuação" valor={parceiro.areasAtuacao} />
          <Dado
            rotuloTexto="Como foi identificada"
            valor={
              parceiro.origemRelacionamento
                ? rotulo(parceiro.origemRelacionamento)
                : null
            }
          />
          <Dado
            rotuloTexto="Local"
            valor={
              [parceiro.cidade, parceiro.estadoRegiao, parceiro.pais]
                .filter(Boolean)
                .join(", ") || null
            }
          />
          <Dado rotuloTexto="Site" valor={parceiro.site} ehLink />
          <Dado
            rotuloTexto="E-mail institucional"
            valor={parceiro.emailInstitucional}
          />
          <Dado rotuloTexto="Telefone" valor={parceiro.telefone} />
          <Dado rotuloTexto="Endereço" valor={parceiro.endereco} />
          <Dado
            rotuloTexto="Redes"
            valor={
              parceiro.redes.length > 0
                ? parceiro.redes.map((rede) => rede.nome).join(", ")
                : null
            }
          />
        </dl>
        {parceiro.observacoes ? (
          <p className="mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
            {parceiro.observacoes}
          </p>
        ) : null}
      </Secao>

      <Secao
        titulo="Histórico de mobilidades"
        descricao="Bolsistas da UEA que passaram por esta instituição, ou que vieram dela. Uma linha por concessão, mesmo quando a instituição é origem e destino."
      >
        {mobilidades.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma mobilidade registrada"
            descricao="Nenhuma bolsa concedida aponta para esta instituição. Isso não diz nada sobre o relacionamento — diz apenas que não houve mobilidade."
          />
        ) : (
          <Tabela
            rotulo="Histórico de mobilidades"
            colunas={[
              { chave: "ano", texto: "Ano", alinhamento: "direita" },
              { chave: "bolsista", texto: "Bolsista" },
              { chave: "ppg", texto: "PPG" },
              { chave: "modalidade", texto: "Modalidade" },
              { chave: "ponta", texto: "Papel" },
              { chave: "periodo", texto: "Período" },
            ]}
          >
            {mobilidades.map((mobilidade) => (
              <tr key={mobilidade.id}>
                <Celula direita className="tabular-nums">
                  {mobilidade.ano}
                </Celula>
                <Celula>
                  <span className="font-medium text-foreground">
                    {mobilidade.bolsista}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {rotulo(mobilidade.nivelBeneficiario)}
                  </span>
                </Celula>
                <Celula>{mobilidade.ppgSigla}</Celula>
                <Celula>{mobilidade.modalidade}</Celula>
                <Celula>
                  <Selo tom="neutro">
                    {mobilidade.ponta === "DESTINO"
                      ? "Recebeu"
                      : "Enviou"}
                  </Selo>
                </Celula>
                <Celula>
                  {data(mobilidade.dataInicio)} a {data(mobilidade.dataFim)}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Contatos"
        descricao="O contato pertence à instituição e é referenciado pelas missões — nunca copiado para dentro delas. Por isso não há exclusão: a saída é inativar."
        acoes={
          podeEscrever && parceiro.ativo ? (
            <NovoContato
              instituicaoId={parceiro.id}
              paises={referencias.paises}
            />
          ) : undefined
        }
      >
        {contatos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum contato cadastrado"
            descricao="Cadastre a pessoa de referência da instituição para poder indicá-la nas atividades da missão."
          />
        ) : (
          <Tabela
            rotulo="Contatos do parceiro"
            colunas={[
              { chave: "nome", texto: "Contato" },
              { chave: "cargo", texto: "Cargo e departamento" },
              { chave: "contato", texto: "E-mail e telefone" },
              {
                chave: "acoes",
                // Cabecalho vazio deixa a coluna sem nome para quem navega por
                // celula; o rotulo existe, so nao ocupa espaco.
                texto: <span className="sr-only">Ações</span>,
                alinhamento: "direita",
              },
            ]}
          >
            {contatos.map((contato) => (
              <tr key={contato.id}>
                <Celula>
                  <span className="font-medium text-foreground">
                    {contato.nome}
                  </span>
                  <span className="mt-1 block space-x-1">
                    {contato.principal ? (
                      <Selo tom="primario" titulo="Contato principal da instituição">
                        principal
                      </Selo>
                    ) : null}
                    {contato.ativo ? null : <Selo tom="neutro">inativo</Selo>}
                  </span>
                </Celula>
                <Celula className="text-muted">
                  {[contato.cargo, contato.departamento]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </Celula>
                <Celula className="text-muted">
                  {contato.email ?? "—"}
                  <span className="block text-xs text-subtle">
                    {contato.telefone ?? "sem telefone"}
                  </span>
                </Celula>
                <Celula direita>
                  {podeEscrever ? (
                    <span className="flex justify-end gap-2">
                      {contato.ativo ? (
                        <EditarContato
                          contato={contato}
                          instituicaoId={parceiro.id}
                          paises={referencias.paises}
                        />
                      ) : null}
                      <AcoesDoContato
                        contato={contato}
                        instituicaoId={parceiro.id}
                      />
                    </span>
                  ) : null}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      <Secao
        titulo="Missões"
        descricao="Uma linha por missão, mesmo quando ela pertence a mais de uma rede ou visita este parceiro em mais de uma parada do roteiro."
      >
        {missoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma missão registrada"
            descricao="As missões aparecem aqui quando uma atividade do roteiro apontar para este parceiro."
          />
        ) : (
          <ul className="space-y-4">
            {missoes.map((missao) => (
              <li
                key={missao.id}
                className="rounded-2xl border border-border bg-surface px-5 py-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">
                    <span className="text-subtle">{missao.codigo}</span>{" "}
                    {missao.titulo}
                  </p>
                  <Selo tom="info">{rotulo(missao.status)}</Selo>
                </div>
                <p className="mt-1 text-xs text-subtle">
                  {data(missao.dataInicio)} a {data(missao.dataFim)} ·{" "}
                  {missao.ciclo} ·{" "}
                  {missao.redes.map((rede) => rede.nome).join(", ") ||
                    "sem rede"}
                </p>
                <ul className="mt-3 space-y-2">
                  {missao.atividades.map((atividade) => (
                    <li
                      key={atividade.id}
                      className="rounded-xl bg-surface-muted px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-foreground">
                        {atividade.titulo}
                      </span>
                      <span className="block text-xs text-muted">
                        {data(atividade.dataInicio)} a{" "}
                        {data(atividade.dataFim)}
                        {atividade.cidade ? ` · ${atividade.cidade}` : ""}
                        {atividade.pais ? ` · ${atividade.pais}` : ""}
                        {atividade.contatoNome
                          ? ` · contato: ${atividade.contatoNome}`
                          : ""}
                      </span>
                      {atividade.objetivoRelacionamento ? (
                        <span className="mt-1 block text-xs text-subtle">
                          {atividade.objetivoRelacionamento}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {eventos.length > 0 ? (
        <Secao
          titulo="Eventos"
          descricao="Projeção das atividades que nomeiam um evento; o evento ainda não é entidade própria (decisão D-10)."
        >
          <Tabela
            rotulo="Eventos do parceiro"
            colunas={[
              { chave: "evento", texto: "Evento" },
              { chave: "missao", texto: "Missão" },
              { chave: "periodo", texto: "Período" },
            ]}
          >
            {eventos.map((evento) => (
              <tr key={evento.atividadeId}>
                <Celula>
                  <span className="font-medium text-foreground">
                    {evento.nome}
                  </span>
                  <span className="block text-xs text-subtle">
                    {evento.tipo ?? "tipo não informado"}
                  </span>
                </Celula>
                <Celula className="text-muted">{evento.missaoCodigo}</Celula>
                <Celula className="text-muted">
                  {data(evento.dataInicio)} a {data(evento.dataFim)}
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      {convenios.length > 0 ? (
        <Secao
          titulo="Convênios"
          descricao="Acordos firmados com esta instituição. O convênio sobrevive à missão que o originou (CG-056)."
        >
          <Tabela
            rotulo="Convênios do parceiro"
            colunas={[
              { chave: "acordo", texto: "Acordo" },
              { chave: "situacao", texto: "Situação" },
              { chave: "vigencia", texto: "Vigência" },
              { chave: "origem", texto: "Origem" },
            ]}
          >
            {convenios.map((convenio) => (
              <tr key={convenio.id}>
                <Celula>
                  <span className="font-medium text-foreground">
                    {convenio.titulo}
                  </span>
                  <span className="block text-xs text-subtle">
                    {rotulo(convenio.tipoAcordo)}
                    {convenio.area ? ` · ${convenio.area}` : ""}
                  </span>
                </Celula>
                <Celula>
                  <Selo tom={convenio.ativo ? "neutro" : "aviso"}>
                    {convenio.ativo
                      ? rotulo(convenio.situacao)
                      : "Inativado"}
                  </Selo>
                </Celula>
                <Celula className="text-muted">
                  {data(convenio.dataInicio)} a{" "}
                  {convenio.dataFim ? data(convenio.dataFim) : "indeterminada"}
                  <span className="block text-xs text-subtle">
                    Assinatura: {data(convenio.dataAssinatura)}
                  </span>
                </Celula>
                <Celula className="text-muted">
                  {convenio.missaoOrigemCodigo ?? "fora de missão"}
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      {produtos.length > 0 ? (
        <Secao
          titulo="Produtos"
          descricao="Resultados de missão que envolvem este parceiro, pela instituição relacionada ou pelo convênio (CG-056)."
        >
          <Tabela
            rotulo="Produtos ligados ao parceiro"
            colunas={[
              { chave: "produto", texto: "Produto" },
              { chave: "situacao", texto: "Situação" },
              { chave: "missao", texto: "Missão" },
            ]}
          >
            {produtos.map((produto) => (
              <tr key={produto.id}>
                <Celula>
                  <span className="font-medium text-foreground">
                    {produto.titulo}
                  </span>
                  <span className="block text-xs text-subtle">
                    {rotulo(produto.tipo)}
                    {produto.ano ? ` · ${produto.ano}` : ""}
                  </span>
                </Celula>
                <Celula className="text-muted">
                  {rotulo(produto.situacao)}
                </Celula>
                <Celula className="text-muted">{produto.missaoCodigo}</Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      {documentos.length > 0 ? (
        <Secao
          titulo="Documentos"
          descricao="Metadados dos arquivos já vinculados à instituição. O download seguro e a política de acesso entram na CG-051."
        >
          <Tabela
            rotulo="Documentos do parceiro"
            colunas={[
              { chave: "nome", texto: "Arquivo" },
              { chave: "envio", texto: "Envio" },
            ]}
          >
            {documentos.map((documento) => (
              <tr key={documento.id}>
                <Celula>
                  <span className="font-medium text-foreground">
                    {documento.nome}
                  </span>
                  <span className="block text-xs text-subtle">
                    {documento.mimeType}
                  </span>
                </Celula>
                <Celula className="text-muted">
                  {data(documento.enviadoEm)}
                  <span className="block text-xs text-subtle">
                    {documento.enviadoPor ?? "autoria não registrada"}
                  </span>
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}

      <ModulosPendentes historico={historico} />
    </Pagina>
  );
}

/**
 * Produtos e convênios não são mostrados como "0".
 *
 * Zero afirmaria que a missão não gerou nada; a verdade é que ainda não existe
 * onde registrar. A API devolve os módulos nomeados justamente para a tela
 * poder dizer isso (CG-027).
 */
function ModulosPendentes({ historico }: { historico: HistoricoParceiro }) {
  if (historico.modulosPendentes.length === 0) return null;

  const nomes: Record<string, string> = {
    PRODUTOS: "Produtos",
    CONVENIOS: "Convênios",
  };

  return (
    <p className="mt-4 rounded-2xl border border-dashed border-border-strong px-5 py-4 text-sm text-muted">
      <span className="font-medium text-foreground">
        Ainda sem registro no sistema:
      </span>{" "}
      {historico.modulosPendentes
        .map((item) => `${nomes[item.modulo] ?? item.modulo} (${item.task})`)
        .join(" · ")}
      . Não são zero — é que o módulo ainda não existe, e mostrar zero afirmaria
      que nada aconteceu.
    </p>
  );
}

function Dado({
  rotuloTexto,
  valor,
  ehLink,
}: {
  rotuloTexto: string;
  valor: string | null;
  ehLink?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
        {rotuloTexto}
      </dt>
      <dd className="mt-1 text-sm text-foreground">
        {valor ? (
          ehLink ? (
            <a
              href={valor}
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              {valor}
            </a>
          ) : (
            valor
          )
        ) : (
          <span className="text-subtle">—</span>
        )}
      </dd>
    </div>
  );
}
