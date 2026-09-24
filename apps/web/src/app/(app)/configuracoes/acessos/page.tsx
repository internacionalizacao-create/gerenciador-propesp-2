import type { Metadata } from "next";
import Link from "next/link";

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
import type { ContaDeAcesso } from "@/lib/dominio";
import { data } from "@/lib/formato";

export const metadata: Metadata = {
  title: "Acessos — Gerenciador PROPESP",
};

/**
 * Administração de acessos (V1-018) — lista de contas.
 *
 * **A conta nasce do login, não daqui.** Não há criação de usuário nesta tela,
 * e não deve haver a impressão de que há: quem cria a credencial é o Keycloak,
 * e a pessoa só aparece nesta lista depois de entrar uma vez. Separar as duas
 * coisas na tela evita a pergunta "cadastrei aqui e não consegue entrar".
 */
export default async function Acessos() {
  const me = await carregarMe();

  // Sem `acesso:read` a API responde 403, e um 403 vindo até a fronteira de
  // erro viraria a tela de "algo deu errado" — que lê como sistema quebrado
  // quando o que houve foi uma permissão ausente. A resposta honesta explica.
  if (!me.permissions.includes("acesso:read")) return <SemPermissao />;

  const contas = await apiFetch<ContaDeAcesso[]>("/acesso/usuarios");
  const podeAdministrar = me.permissions.includes("acesso:write");

  return (
    <Pagina
      titulo="Acessos"
      descricao="Quem entra no sistema e o que cada pessoa pode fazer. O acesso é concedido ação a ação, e cada concessão diz também onde vale."
    >
      <Aviso tom="info" titulo="Como uma pessoa passa a ter acesso">
        A credencial é criada no Keycloak, e é com ela que a pessoa faz o
        primeiro login — é esse login que a traz para esta lista, ainda sem
        permissão nenhuma. A partir daí, o acesso se concede aqui. Esta tela não
        cria conta nem redefine senha.
      </Aviso>

      <Secao
        titulo={`Contas (${contas.length})`}
        descricao="Contas com vínculo pendente primeiro, depois por nome. Conta inativa ou pendente não resolve acesso nenhum, mesmo com concessões ativas."
      >
        {contas.length === 0 ? (
          <EstadoVazio
            titulo="Nenhuma conta ainda"
            descricao="A primeira conta aparece aqui depois do primeiro login. O administrador inicial é criado pelo comando local de bootstrap."
          />
        ) : (
          <Tabela
            rotulo="Contas do sistema"
            colunas={[
              { chave: "pessoa", texto: "Pessoa" },
              { chave: "id", texto: "Identificação" },
              { chave: "situacao", texto: "Situação" },
              { chave: "acesso", texto: "Último acesso" },
              {
                chave: "acoes",
                texto: <span className="sr-only">Ações</span>,
                alinhamento: "direita",
              },
            ]}
          >
            {contas.map((conta) => (
              <tr key={conta.id}>
                <Celula>
                  {conta.pessoaNome ?? (
                    <span className="italic text-subtle">Sem pessoa</span>
                  )}
                </Celula>
                <Celula>
                  <span className="text-muted">
                    {conta.email ?? conta.username ?? conta.sub}
                  </span>
                </Celula>
                <Celula>
                  {conta.ativo && conta.pessoaId === null ? (
                    <Selo
                      tom="aviso"
                      titulo="O e-mail desta conta é de uma pessoa ligada a outra conta"
                    >
                      Vínculo pendente
                    </Selo>
                  ) : (
                    <Selo tom={conta.ativo ? "sucesso" : "neutro"}>
                      {conta.ativo ? "Ativa" : "Inativa"}
                    </Selo>
                  )}
                </Celula>
                <Celula>
                  {conta.ultimoAcessoEm ? data(conta.ultimoAcessoEm) : "—"}
                </Celula>
                <Celula direita>
                  <Link
                    href={`/configuracoes/acessos/${conta.id}`}
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    {podeAdministrar ? "Configurar" : "Ver acessos"}
                  </Link>
                </Celula>
              </tr>
            ))}
          </Tabela>
        )}
      </Secao>
    </Pagina>
  );
}

/**
 * Tela de quem não administra acessos.
 *
 * Diz o que falta e a quem pedir, em vez de um erro genérico: quem chega aqui
 * pelo link de outra pessoa precisa entender que não é defeito.
 */
function SemPermissao() {
  return (
    <Pagina
      titulo="Acessos"
      descricao="Administração de contas e permissões do sistema."
    >
      <Aviso tom="aviso" titulo="Você não administra acessos">
        Esta tela é de quem tem a permissão de consultar e conceder acessos.
        Para saber o que a sua conta pode fazer hoje, veja
        <Link
          href="/configuracoes"
          className="mx-1 underline underline-offset-2"
        >
          Sua conta
        </Link>
        ; para pedir uma permissão nova, fale com quem administra acessos na
        PROPESP.
      </Aviso>
    </Pagina>
  );
}
