import type { Metadata } from "next";

import { Pagina, Secao, Selo } from "@/componentes/ui/basicos";
import { apiFetch } from "@/lib/api";
import { requireSession } from "@/lib/auth";
import type { Me } from "@/lib/dominio";

export const metadata: Metadata = {
  title: "Sua conta — Gerenciador PROPESP",
};

/**
 * Conta e permissões do usuário logado.
 *
 * Papéis e permissões vêm de `GET /me`, não do cookie de sessão: quem decide o
 * que o usuário pode é o dono do dado. Esta tela é a janela para conferir isso
 * sem abrir o console do Keycloak — e é útil justamente quando alguém recebe um
 * 403 e não entende por quê.
 */
export default async function Configuracoes() {
  const sessao = await requireSession();
  const me = await apiFetch<Me>("/me");

  const papeis = me.roles.filter(
    (papel) => !["offline_access", "uma_authorization"].includes(papel),
  );

  return (
    <Pagina
      titulo="Sua conta"
      descricao="Identidade, papéis e permissões, como a API os enxerga."
    >
      <Secao titulo="Identificação">
        <dl className="grid gap-4 rounded-xl border border-border bg-surface p-5 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-subtle">Nome</dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {me.name ?? sessao.user.username ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-subtle">
              Usuário
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {me.username ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-subtle">
              E-mail
            </dt>
            <dd className="mt-0.5 text-sm text-foreground">
              {me.email ?? "—"}
            </dd>
          </div>
        </dl>
      </Secao>

      <Secao
        titulo="Papéis"
        descricao="Concedidos no Keycloak e lidos da claim realm_access.roles. Papéis internos do provedor de identidade ficam de fora — não significam nada para o domínio."
      >
        <div className="flex flex-wrap gap-2">
          {papeis.length > 0 ? (
            papeis.map((papel) => (
              <Selo key={papel} tom="primario">
                {papel}
              </Selo>
            ))
          ) : (
            <p className="text-sm text-muted">Nenhum papel de domínio.</p>
          )}
        </div>
      </Secao>

      <Secao
        titulo="Permissões"
        descricao="Derivadas dos papéis pela API. A interface usa isso para esconder ações; quem realmente barra é o guard no endpoint."
      >
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {me.permissions.map((permissao) => (
            <li
              key={permissao}
              className="rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs text-foreground"
            >
              {permissao}
            </li>
          ))}
        </ul>
      </Secao>

      <Secao
        titulo="Sessão"
        descricao="O token nunca chega ao navegador. Ele fica cifrado num cookie httpOnly e só o servidor do Next o abre para chamar a API."
      >
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          A sessão é renovada automaticamente enquanto houver refresh token
          válido. Sair encerra a sessão aqui e também no Keycloak.
        </p>
      </Secao>
    </Pagina>
  );
}
