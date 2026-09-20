import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AcoesDoContato,
  ConciliarParceiroBotao,
  InativarParceiroBotao,
} from "@/componentes/formularios/acoes-parceiro";
import {
  EditarContato,
  NovoContato,
} from "@/componentes/formularios/form-contato-parceiro";
import {
  AlternarConvenio,
  EditarConvenio,
  NovoConvenio,
} from "@/componentes/formularios/form-convenio";
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
import { SemAcesso } from "@/componentes/ui/sem-acesso";
import { faltando } from "@/lib/acesso";
import { ApiError, apiFetch, apiFetchOuNada } from "@/lib/api";
import { carregarMe } from "@/lib/me";
import type {
  HistoricoParceiro,
  PaginaParceiros,
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
  const me = await carregarMe();
  const falta = faltando(me.permissions, ["parceiro:read"]);
  if (falta.length > 0) {
    return (
      <SemAcesso
        titulo="Parceiro"
        descricao="Histórico da instituição parceira."
        me={me}
        faltando={falta}
      />
    );
  }

  const [historico, referencias, ativos] = await Promise.all([
    buscarHistorico(id),
    // Exige `missao:read`; sem ela o histórico continua, sem os formulários
    // que dependem de rede e país.
    apiFetchOuNada<ReferenciasMissao>(
      `/programas/${programa}/${ciclo}/comite-gestor/referencias-missao`,
    ),
    // Destinos possíveis da conciliação. A API exige destino ativo, então a
    // lista padrão (só ativos) já é o conjunto certo.
    //
    // Mantem o limite anterior do seletor. A lista principal agora pagina;
    // este seletor ainda oferece os primeiros 200 (revisao de volume V1-042).
    apiFetch<PaginaParceiros>("/parceiros?tamanho=200"),
  ]);

  const {
    parceiro,
    contatos,
    mobilidades,
    vinculos,
    missoes,
    eventos,
    documentos,
    convenios,
    produtos,
    acesso,
  } = historico;
  // Seção vazia por falta de concessão não é seção vazia por falta de fato.
  // O texto de cada estado vazio afirma uma das duas, e afirmar a errada
  // publicaria "não houve mobilidade" para quem apenas não pode consultá-la.
  const podeEscrever = me.permissions.includes("parceiro:edit");
  // Os três verbos do convênio são permissões distintas (V1-032), e a tela
  // esconde cada botão pela sua: agrupá-los numa só ofereceria a quem só pode
  // cadastrar uma edição que a API recusaria.
  const podeCriarConvenio = me.permissions.includes("convenio:create");
  const podeEditarConvenio = me.permissions.includes("convenio:edit");
  const podeAlternarConvenio = me.permissions.includes("convenio:status");
  // As missões oferecidas como origem são as que já tocam este parceiro — as
  // mesmas da seção acima, e dentro do alcance de quem lê. Oferecer o ciclo
  // inteiro convidaria a atribuir o acordo a uma viagem que nunca passou aqui.
  const referenciasConvenio = {
    redes: referencias?.redes ?? [],
    missoes: missoes.map((missao) => ({
      id: missao.id,
      codigo: missao.codigo,
      titulo: missao.titulo,
    })),
  };
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
              redes={referencias?.redes ?? []}
              paises={referencias?.paises ?? []}
            />
            <ConciliarParceiroBotao
              parceiro={parceiro}
              candidatos={ativos.itens.filter(
                (item) => item.id !== parceiro.id,
              )}
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
        <Cartao
          titulo="Missões"
          valor={acesso.missoes ? inteiro(missoes.length) : "Sem acesso"}
        />
        <Cartao titulo="Eventos" valor={inteiro(eventos.length)} />
        <Cartao
          titulo="Contatos ativos"
          valor={inteiro(contatos.filter((c) => c.ativo).length)}
        />
        <Cartao titulo="Documentos" valor={inteiro(documentos.length)} />
      </Cartoes>

      <div className="mt-10" />

      {/*
        Resposta ao "a que rede, PPG e temática este parceiro está ligado". A
        rede é a declarada no cadastro; temática e PPG vêm das bolsas que
        passaram pela instituição, agrupadas pela API. Declarar os dois à mão
        criaria o vínculo que diverge da primeira bolsa que o contrariar.
      */}
      <Secao
        titulo="Vínculo com o CAPES Global"
        descricao="Redes com que a instituição se relaciona e as temáticas e PPGs em que houve mobilidade."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Redes coordenadoras:</span>
          {parceiro.redes.length > 0 ? (
            parceiro.redes.map((rede) => (
              <Selo key={rede.id} tom="primario">
                {rede.nome}
              </Selo>
            ))
          ) : (
            <span className="italic text-subtle">Nenhuma rede vinculada</span>
          )}
        </div>
        {!acesso.bolsas ? (
          <EstadoVazio
            titulo="Sem acesso ao vínculo por mobilidade"
            descricao="Temática e PPG são derivados das bolsas concedidas, cuja consulta não foi concedida a esta conta. As redes acima continuam visíveis, porque são declaradas no cadastro."
          />
        ) : vinculos.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma mobilidade com esta instituição"
            descricao="Temática e PPG aparecem aqui assim que houver, dentro do seu alcance, bolsa concedida com origem ou destino nesta instituição."
          />
        ) : (
          <Tabela
            rotulo="Temáticas e PPGs com mobilidade"
            colunas={[
              { chave: "rede", texto: "Rede" },
              { chave: "tematica", texto: "Temática" },
              { chave: "ppgs", texto: "PPGs" },
              { chave: "mobilidades", texto: "Mobilidades", alinhamento: "direita" },
            ]}
          >
            {vinculos.map((vinculo) => (
              <tr key={vinculo.tematicaCodigo ?? "sem-tematica"}>
                <Celula>{vinculo.rede ?? "—"}</Celula>
                <Celula>
                  {vinculo.tematicaCodigo ? (
                    <>
                      <span className="font-mono text-xs text-muted">
                        {vinculo.tematicaCodigo}
                      </span>{" "}
                      {vinculo.tematica}
                    </>
                  ) : (
                    <span className="italic text-subtle">Sem temática informada</span>
                  )}
                </Celula>
                <Celula>{vinculo.ppgs.join(", ")}</Celula>
                <Celula direita className="tabular-nums">
                  {inteiro(vinculo.mobilidades)}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

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
        {!acesso.bolsas ? (
          <EstadoVazio
            titulo="Sem acesso às mobilidades"
            descricao="A consulta de bolsas concedidas não foi concedida a esta conta. O cadastro do parceiro continua disponível."
          />
        ) : mobilidades.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma mobilidade registrada"
            descricao="Nenhuma bolsa concedida dentro do seu alcance aponta para esta instituição. Isso não diz nada sobre o relacionamento — diz apenas que não houve mobilidade que você acompanhe."
          />
        ) : (
          <Tabela
            rotulo="Histórico de mobilidades"
            colunas={[
              { chave: "ano", texto: "Ano", alinhamento: "direita" },
              { chave: "bolsista", texto: "Bolsista" },
              { chave: "ppg", texto: "PPG" },
              { chave: "tematica", texto: "Temática" },
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
                <Celula>{mobilidade.tematicaCodigo ?? "—"}</Celula>
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
              paises={referencias?.paises ?? []}
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
                          paises={referencias?.paises ?? []}
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
        {!acesso.missoes ? (
          <EstadoVazio
            titulo="Sem acesso às missões"
            descricao="A consulta de missões não foi concedida a esta conta. O cadastro do parceiro continua disponível."
          />
        ) : missoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma missão registrada"
            descricao="As missões dentro do seu alcance aparecem aqui quando uma atividade do roteiro apontar para este parceiro."
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
          descricao="Eventos citados nas atividades das missões com esta instituição."
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

      {/*
        Convênios (V1-032).
        A seção existe mesmo vazia, e o texto do vazio distingue as duas
        ausências — não há acordo, ou a conta não alcança a consulta. Os verbos
        são três permissões distintas, e não uma só de escrita: cadastrar um
        acordo, corrigir o que está escrito nele e tirá-lo de circulação são
        atos diferentes.
      */}
      <Secao
        titulo="Convênios"
        descricao="Acordos firmados com esta instituição. O convênio continua valendo depois da missão que o originou — por isso ele mora aqui, e não dentro dela."
        acoes={
          acesso.convenios && podeCriarConvenio && parceiro.ativo ? (
            <NovoConvenio
              instituicaoId={parceiro.id}
              referencias={referenciasConvenio}
            />
          ) : undefined
        }
      >
        {!acesso.convenios ? (
          <EstadoVazio
            titulo="Sem acesso aos convênios"
            descricao="A consulta de convênios não foi concedida a esta conta. O cadastro do parceiro continua disponível."
          />
        ) : convenios.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum acordo cadastrado"
            descricao="Registre aqui o acordo formal com a instituição. Enquanto não houver nenhum vigente, o relacionamento aparece como “sem parceria formalizada”, que é leitura derivada e não se edita à mão."
          />
        ) : (
          <Tabela
            rotulo="Convênios do parceiro"
            colunas={[
              { chave: "acordo", texto: "Acordo" },
              { chave: "situacao", texto: "Situação" },
              { chave: "vigencia", texto: "Vigência" },
              { chave: "origem", texto: "Origem" },
              {
                chave: "acoes",
                texto: <span className="sr-only">Ações</span>,
                alinhamento: "direita",
              },
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
                    {convenio.numeroProcesso
                      ? ` · processo ${convenio.numeroProcesso}`
                      : ""}
                  </span>
                  {convenio.redes.length > 0 ? (
                    <span className="mt-1 block text-xs text-muted">
                      {convenio.redes.map((rede) => rede.nome).join(", ")}
                    </span>
                  ) : null}
                </Celula>
                <Celula>
                  <Selo tom={convenio.ativo ? "neutro" : "aviso"}>
                    {convenio.ativo ? rotulo(convenio.situacao) : "Inativado"}
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
                <Celula direita>
                  <span className="flex justify-end gap-2">
                    {podeEditarConvenio && convenio.ativo ? (
                      <EditarConvenio
                        convenio={convenio}
                        referencias={referenciasConvenio}
                      />
                    ) : null}
                    {podeAlternarConvenio ? (
                      <AlternarConvenio convenio={convenio} />
                    ) : null}
                  </span>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      {produtos.length > 0 ? (
        <Secao
          titulo="Produtos"
          descricao="Resultados de missão que envolvem este parceiro, pela instituição relacionada ou pelo convênio."
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
          descricao="Arquivos vinculados à instituição."
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

async function buscarHistorico(id: string): Promise<HistoricoParceiro> {
  try {
    return await apiFetch<HistoricoParceiro>(`/parceiros/${id}/historico`);
  } catch (erro) {
    // Id inexistente, ou de instituição que não é parceira, vira a página de
    // "não encontrado" — antes o 404 da API subia como erro e a tela dava 500.
    if (erro instanceof ApiError && erro.status === 404) notFound();
    throw erro;
  }
}
