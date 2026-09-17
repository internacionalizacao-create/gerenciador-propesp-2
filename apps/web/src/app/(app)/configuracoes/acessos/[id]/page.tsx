import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { RevogarAcesso } from "@/componentes/formularios/acoes-acesso";
import { ConcederAcesso } from "@/componentes/formularios/form-concessao";
import {
  Aviso,
  Celula,
  EstadoVazio,
  Pagina,
  Secao,
  Selo,
  Tabela,
} from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import { carregarMe } from "@/lib/me";
import type {
  AlvosDeAcesso,
  CatalogoDeAcesso,
  ConcessoesDaConta,
} from "@/lib/dominio";
import { dataHora } from "@/lib/formato";
import { NOME_DO_MODULO } from "@/lib/acesso";
import { descreverAlcance } from "@/lib/formularios/acessos";

export const metadata: Metadata = {
  title: "Acesso da conta — Gerenciador PROPESP",
};

/**
 * Acessos de uma conta (V1-018).
 *
 * Mostra **o que vale hoje e o que já valeu**: concessão revogada continua na
 * lista, marcada, porque "quem teve acesso e até quando" é a pergunta que a
 * auditoria faz — e uma tela que some com a linha responde só metade dela.
 *
 * Os nomes dos alvos são resolvidos aqui, no servidor, a partir de
 * `/acesso/alvos`: a lista de concessões traz UUID, e UUID na tela não é
 * revisável por ninguém.
 */
export default async function AcessoDaConta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await carregarMe();

  // Mesma porta da lista: sem `acesso:read` a API responde 403, e a tela diz o
  // que falta em vez de virar erro genérico.
  if (!me.permissions.includes("acesso:read")) notFound();

  const [dados, catalogo, alvos] = await Promise.all([
    apiFetch<ConcessoesDaConta>(`/acesso/usuarios/${id}/concessoes`),
    apiFetch<CatalogoDeAcesso>("/acesso/catalogo"),
    apiFetch<AlvosDeAcesso>("/acesso/alvos"),
  ]);

  const podeAdministrar = me.permissions.includes("acesso:write");
  const ehAPropriaConta = me.id === dados.conta.sub;

  const nomes = {
    ciclos: Object.fromEntries(alvos.ciclos.map((c) => [c.id, c.nome])),
    ppgs: Object.fromEntries(
      alvos.ppgs.map((p) => [p.id, p.sigla ?? p.nome]),
    ),
    redes: Object.fromEntries(alvos.redes.map((r) => [r.id, r.nome])),
    tematicas: Object.fromEntries(
      alvos.tematicas.map((t) => [t.id, t.codigo]),
    ),
    participacoes: Object.fromEntries(
      alvos.participacoes.map((p) => [p.id, `${p.ppg ?? p.ppgNome} em ${p.tematica}`]),
    ),
  };

  const rotuloDaAcao = new Map(
    catalogo.permissoes.map((acao) => [acao.permissao, acao.rotulo]),
  );

  const ativas = dados.concessoes.filter((c) => c.ativo);
  const revogadas = dados.concessoes.filter((c) => !c.ativo);

  return (
    <Pagina
      voltar={{ href: "/configuracoes/acessos", rotulo: "Acessos" }}
      titulo={dados.conta.pessoaNome}
      descricao={`${dados.conta.email ?? dados.conta.username ?? dados.conta.sub} · ${
        dados.conta.ativo ? "conta ativa" : "conta inativa"
      }`}
      acoes={
        podeAdministrar && !ehAPropriaConta ? (
          <ConcederAcesso
            usuarioId={dados.conta.id}
            pessoaNome={dados.conta.pessoaNome}
            catalogo={catalogo}
            alvos={alvos}
          />
        ) : undefined
      }
    >
      {ehAPropriaConta ? (
        <Aviso tom="aviso" titulo="Esta é a sua própria conta">
          Ninguém altera o próprio acesso por aqui, nem quem administra acessos.
          A regra é da API, e existe para que administrar acessos não vire, em
          dois passos, acesso a tudo. Peça a outro administrador.
        </Aviso>
      ) : null}

      {!dados.conta.ativo ? (
        <Aviso tom="aviso" titulo="Conta inativa">
          Enquanto estiver inativa, esta conta não exerce nenhuma das concessões
          abaixo — elas continuam registradas, mas não valem.
        </Aviso>
      ) : null}

      <Secao
        titulo={`Acesso em vigor (${ativas.length})`}
        descricao="Cada linha é uma ação em um alcance. Leitura e escrita são linhas distintas: conceder a consulta não concede o cadastro."
      >
        {ativas.length === 0 ? (
          <EstadoVazio
            titulo="Sem acesso a nada"
            descricao="A pessoa consegue entrar, mas nenhuma tela mostra dado algum até a primeira concessão."
          />
        ) : (
          <Tabela
            rotulo="Concessões em vigor"
            colunas={[
              { chave: "modulo", texto: "Módulo" },
              { chave: "acao", texto: "Ação" },
              { chave: "alcance", texto: "Onde vale" },
              { chave: "origem", texto: "Concedida em" },
              {
                chave: "acoes",
                texto: <span className="sr-only">Ações</span>,
                alinhamento: "direita",
              },
            ]}
          >
            {ativas.map((concessao) => (
              <tr key={concessao.id}>
                <Celula>
                  <span className="text-muted">
                    {NOME_DO_MODULO[concessao.permissao.split(":")[0]] ??
                      concessao.permissao.split(":")[0]}
                  </span>
                </Celula>
                <Celula>
                  {rotuloDaAcao.get(concessao.permissao) ?? concessao.permissao}
                  <span className="ml-2 font-mono text-xs text-subtle">
                    {concessao.permissao}
                  </span>
                </Celula>
                <Celula>{descreverAlcance(concessao.escopo, nomes)}</Celula>
                <Celula>
                  <span className="text-muted">
                    {dataHora(concessao.concedidoEm)}
                  </span>
                  {concessao.origem ? (
                    <span className="ml-2">
                      <Selo titulo="Modelo que sugeriu esta concessão; não a governa depois">
                        modelo {concessao.origem}
                      </Selo>
                    </span>
                  ) : null}
                </Celula>
                <Celula direita>
                  {podeAdministrar && !ehAPropriaConta ? (
                    <RevogarAcesso
                      concessaoId={concessao.id}
                      descricao={`${
                        rotuloDaAcao.get(concessao.permissao) ??
                        concessao.permissao
                      } · ${descreverAlcance(concessao.escopo, nomes)}`}
                    />
                  ) : null}
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>

      {revogadas.length > 0 ? (
        <Secao
          titulo={`Acesso revogado (${revogadas.length})`}
          descricao="Fica registrado: a pergunta da auditoria é quem teve acesso e até quando. Reconceder a mesma ação no mesmo alcance reativa esta linha, em vez de criar outra."
        >
          <Tabela
            rotulo="Concessões revogadas"
            colunas={[
              { chave: "acao", texto: "Ação" },
              { chave: "alcance", texto: "Onde valia" },
              { chave: "revogada", texto: "Revogada em" },
            ]}
          >
            {revogadas.map((concessao) => (
              <tr key={concessao.id} className="text-muted">
                <Celula>
                  {rotuloDaAcao.get(concessao.permissao) ?? concessao.permissao}
                </Celula>
                <Celula>{descreverAlcance(concessao.escopo, nomes)}</Celula>
                <Celula>
                  {concessao.revogadoEm ? dataHora(concessao.revogadoEm) : "—"}
                </Celula>
              </tr>
            ))}
          </Tabela>
        </Secao>
      ) : null}
    </Pagina>
  );
}
