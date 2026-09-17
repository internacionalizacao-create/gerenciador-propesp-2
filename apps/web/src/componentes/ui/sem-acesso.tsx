import Link from "next/link";

import { Aviso, Pagina } from "@/componentes/ui/basicos";
import { descreverPermissao } from "@/lib/acesso";
import type { Me } from "@/lib/dominio";

/**
 * Tela de quem chegou a uma página que o acesso dela não cobre (V1-019).
 *
 * Responde 200 com uma explicação, e não a fronteira de erro: **403 não é
 * defeito**. Até aqui qualquer tela nessa situação caía em "não foi possível
 * carregar esta página", que lê como sistema quebrado e manda a pessoa abrir
 * chamado pelo motivo errado.
 *
 * **São três situações diferentes, e dizer a mesma coisa nas três seria pior
 * que não dizer nada:**
 *
 * 1. *Vínculo pendente* — o login funcionou, mas a conta não pôde ser ligada a
 *    um cadastro de pessoa. Não adianta pedir permissão: não há a quem
 *    conceder até alguém reassociar a identidade.
 * 2. *Conta sem acesso nenhum* — o caso normal de quem acabou de entrar pela
 *    primeira vez. Listar a permissão que falta nesta tela faria a pessoa pedir
 *    uma ação solta quando o que falta é a configuração inteira.
 * 3. *Acesso configurado que não cobre esta tela* — aí sim a lista do que falta
 *    é exatamente o que ela tem a pedir.
 */
export function SemAcesso({
  titulo,
  descricao,
  me,
  faltando,
}: {
  titulo: string;
  descricao?: string;
  me: Me;
  /** Ações do catálogo que a conta não tem. Nunca vazio. */
  faltando: readonly string[];
}) {
  if (me.vinculoPendente) {
    return (
      <Pagina titulo={titulo} descricao={descricao}>
        <Aviso tom="aviso" titulo="Sua conta ainda não está associada a um cadastro">
          Você entrou, mas o sistema não conseguiu ligar esta conta a uma pessoa
          já cadastrada — normalmente porque o e-mail do seu login aponta para um
          cadastro que pertence a outra conta. Enquanto isso não for resolvido,
          nenhum acesso pode ser concedido a você. Peça a quem administra
          acessos na PROPESP para reassociar a sua identidade.
        </Aviso>
      </Pagina>
    );
  }

  if (me.permissions.length === 0) {
    return (
      <Pagina titulo={titulo} descricao={descricao}>
        <Aviso tom="info" titulo="Sua conta ainda não recebeu acesso">
          <p>
            Entrar e ter acesso são coisas separadas: a credencial abre a porta,
            e o que você pode ver e fazer é concedido depois, ação a ação, por
            quem administra acessos na PROPESP. Sua conta já aparece para eles —
            ela entra na lista no primeiro login, que você acabou de fazer.
          </p>
          <p className="mt-3">
            Diga a quem for conceder <strong>quais telas</strong> você precisa
            usar: o acesso é dado por ação e por alcance (um PPG, uma rede, um
            ciclo), não em bloco.
          </p>
        </Aviso>
      </Pagina>
    );
  }

  return (
    <Pagina titulo={titulo} descricao={descricao}>
      <Aviso tom="aviso" titulo="Seu acesso não cobre esta tela">
        <p>
          {faltando.length > 1
            ? "Esta tela precisa de todas as permissões abaixo, e sua conta ainda não as tem."
            : "Esta tela precisa da permissão abaixo, e sua conta ainda não a tem."}{" "}
          Quem administra acessos na PROPESP pode conceder o que falta.
        </p>
        <ul className="mt-3 space-y-1">
          {faltando.map((permissao) => (
            <li key={permissao}>
              {descreverPermissao(permissao)}{" "}
              <span className="font-mono text-xs opacity-70">{permissao}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          Para ver o que sua conta pode hoje, abra{" "}
          <Link href="/configuracoes" className="underline underline-offset-2">
            Sua conta
          </Link>
          .
        </p>
      </Aviso>
    </Pagina>
  );
}
