import type { Metadata } from "next";
import Link from "next/link";

import { Aviso, EstadoVazio, Pagina, Secao } from "@/componentes/ui/basicos";
import { requireSession } from "@/lib/auth";
import { NOME_DO_MODULO } from "@/lib/acesso";
import { carregarMe, carregarMeuAcesso } from "@/lib/me";

export const metadata: Metadata = {
  title: "Sua conta — Gerenciador PROPESP",
};

/**
 * Conta e acesso efetivo do usuário logado.
 *
 * Esta é a tela que responde "por que não vejo tal coisa?", e por isso ela
 * mudou com a V1-019: não lista mais papéis do Keycloak como se concedessem
 * algo — desde V1-012 não concedem —, e o acesso aparece **com o alcance de
 * cada ação**, em português. "Consultar plano" não diz nada sem o "onde": a
 * mesma ação pode valer num PPG, numa rede ou no sistema inteiro.
 *
 * Nenhuma permissão é exigida aqui, de propósito: é a conta lendo a si mesma,
 * e exigir algo faria justamente quem não tem nada ficar sem a explicação.
 */
export default async function Configuracoes() {
  const sessao = await requireSession();
  const me = await carregarMe();
  const acesso = await carregarMeuAcesso();

  // Agrupado pelo domínio do próprio nome da ação, como na tela de Acessos: é
  // por módulo que a pessoa pensa ("bolsas", "plano"), não por verbo.
  const modulos = new Map<string, typeof acesso.acoes>();
  for (const acao of acesso.acoes) {
    const modulo = acao.permissao.split(":")[0];
    modulos.set(modulo, [...(modulos.get(modulo) ?? []), acao]);
  }
  const grupos = [...modulos.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <Pagina
      titulo="Sua conta"
      descricao="Quem você é para o sistema e o que o seu acesso cobre hoje."
    >
      {me.vinculoPendente ? (
        <Aviso tom="aviso" titulo="Vínculo pendente">
          Seu login funcionou, mas esta conta não pôde ser ligada a um cadastro
          de pessoa — normalmente porque o e-mail aponta para um cadastro que já
          pertence a outra conta. Enquanto isso não for resolvido, nenhum acesso
          pode ser concedido a você. Quem administra acessos na PROPESP resolve
          isso reassociando a identidade.
        </Aviso>
      ) : null}

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
        titulo={`Seu acesso (${acesso.acoes.length} ${acesso.acoes.length === 1 ? "ação" : "ações"})`}
        descricao="Cada linha é uma ação e onde ela vale. Leitura e escrita são concessões distintas, e uma não implica a outra."
      >
        {acesso.acoes.length === 0 ? (
          <EstadoVazio
            titulo="Nenhum acesso concedido ainda"
            descricao="Entrar e ter acesso são coisas separadas: a credencial abre a porta, e o que você vê é concedido depois, ação a ação, por quem administra acessos na PROPESP. Diga a eles quais telas você precisa usar — o acesso é dado por ação e por alcance (um PPG, uma rede, um ciclo), não em bloco."
          />
        ) : (
          <div className="space-y-5">
            {grupos.map(([modulo, acoes]) => (
              <div
                key={modulo}
                className="rounded-xl border border-border bg-surface p-5"
              >
                <h3 className="text-sm font-semibold text-foreground">
                  {NOME_DO_MODULO[modulo] ?? modulo}
                </h3>
                <ul className="mt-3 space-y-2">
                  {acoes.map((acao) => (
                    <li key={acao.permissao} className="text-sm">
                      <span className="text-foreground">{acao.rotulo}</span>
                      <span className="ml-2 font-mono text-xs text-subtle">
                        {acao.permissao}
                      </span>
                      <span className="mt-0.5 block text-muted">
                        {acao.alcance.join(" · ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Secao>

      <Secao
        titulo="Como o acesso é concedido"
        descricao="Entender isto evita o pedido errado."
      >
        <div className="space-y-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          <p>
            <strong className="text-foreground">Entrar é uma coisa;</strong> ver
            e fazer é outra. A credencial vem do provedor de identidade da
            instituição, e é o que permite entrar. O que você pode fazer dentro
            do sistema é concedido aqui dentro, ação a ação, por quem administra
            acessos.
          </p>
          <p>
            <strong className="text-foreground">Toda concessão tem alcance.</strong>{" "}
            A mesma ação pode valer em um PPG de um ciclo, em uma rede, em uma
            área temática ou no sistema inteiro — e é o alcance que decide quais
            linhas você enxerga nas telas.
          </p>
          <p>
            <strong className="text-foreground">Nada é herdado.</strong> Estar
            na equipe de uma rede, ou ter um papel no provedor de identidade, não
            concede acesso: só a concessão registrada concede.
          </p>
          {me.permissions.includes("acesso:read") ? (
            <p>
              Você administra acessos: a tela é{" "}
              <Link
                href="/configuracoes/acessos"
                className="underline underline-offset-2"
              >
                Acessos
              </Link>
              .
            </p>
          ) : null}
        </div>
      </Secao>

      <Secao
        titulo="Sessão"
        descricao="O token nunca chega ao navegador. Ele fica cifrado num cookie httpOnly e só o servidor do Next o abre para chamar a API."
      >
        <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted">
          A sessão é renovada automaticamente enquanto houver refresh token
          válido. Sair encerra a sessão aqui e também no Keycloak. Revogar uma
          concessão vale na requisição seguinte — não é preciso sair e entrar.
        </p>
      </Secao>
    </Pagina>
  );
}
