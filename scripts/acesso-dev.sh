#!/usr/bin/env bash
#
# Provisiona acesso de **desenvolvimento** para os usuarios de teste.
#
# Desde V1-012 o papel do Keycloak nao concede nada: conta recem-criada entra e
# nao ve tela nenhuma. Isso e o comportamento certo — e torna inutilizavel o
# ambiente local recem-subido, alem de derrubar o `pnpm smoke:telas`, que
# percorre as telas com dado.
#
# Este script faz, com dois logins reais, a danca que a politica exige:
#
#   1. o administrador do bootstrap (que so tem `acesso:*`) concede a outra
#      conta as capacidades de administrar acesso;
#   2. essa outra conta concede ao administrador o modelo completo.
#
# Os dois passos existem porque **ninguem altera as proprias concessoes**
# (V1-017). Nao e burocracia do script: e a regra que impede `acesso:write` de
# virar acesso a tudo em dois passos, e ela vale igual em producao — la, com
# duas pessoas.
#
# **Nao use isto fora de desenvolvimento.** Em producao as concessoes sao
# nominais, ação a ação, pela tela de Acessos; conceder o modelo inteiro em
# GLOBAL a todo mundo desfaz o recorte que a V1 existe para ter.
#
# Pre-requisitos: infra no ar, `pnpm dev` rodando e o bootstrap ja executado
# para o `admin` (ver `pnpm --filter api acesso:bootstrap`).
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/acesso-dev.sh                  # admin + coord.teste
#   ./scripts/acesso-dev.sh secretaria.teste secretaria123
#
set -uo pipefail

WEB=${WEB:-http://localhost:3000}
PARCEIRO_USUARIO=${1:-coord.teste}
PARCEIRO_SENHA=${2:-coord123}
ADMIN_USUARIO=${ADMIN_USUARIO:-admin}
ADMIN_SENHA=${ADMIN_SENHA:-admin123}

azul() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
ok() { printf '   \033[1;32mok\033[0m   %s\n' "$1"; }
erro() { printf '   \033[1;31mfalha\033[0m %s\n' "$1" >&2; exit 1; }

# Faz o login OIDC de verdade e deixa a sessao no jar; devolve o caminho dele.
entrar() {
  local usuario="$1" senha="$2" jar
  jar=$(mktemp)

  local login pagina acao callback
  login=$(curl -s -c "$jar" -o /dev/null -w '%{redirect_url}' "${WEB}/api/auth/login?returnTo=/")
  pagina=$(curl -s -b "$jar" -c "$jar" "$login")
  acao=$(printf '%s' "$pagina" | grep -o 'action="[^"]*"' | head -1 | sed 's/action="//;s/"$//' | sed 's/&amp;/\&/g')
  callback=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{redirect_url}' -X POST "$acao" \
    --data-urlencode "username=${usuario}" --data-urlencode "password=${senha}" --data-urlencode "credentialId=")
  curl -s -b "$jar" -c "$jar" -o /dev/null "$callback"

  printf '%s' "$jar"
}

chamar() {
  local jar="$1" metodo="$2" rota="$3" corpo="${4:-}"
  if [[ -n "$corpo" ]]; then
    curl -s -b "$jar" -X "$metodo" -H 'Content-Type: application/json' \
      --data "$corpo" "${WEB}/api/bff/${rota}"
  else
    curl -s -b "$jar" -X "$metodo" "${WEB}/api/bff/${rota}"
  fi
}

# Id local da conta, a partir da lista de contas que a API ja expoe.
conta_de() {
  local jar="$1" usuario="$2"
  chamar "$jar" GET acesso/usuarios |
    node -e '
      let bruto = "";
      process.stdin.on("data", (p) => (bruto += p));
      process.stdin.on("end", () => {
        const alvo = process.argv[1];
        const contas = JSON.parse(bruto);
        const conta = contas.find(
          (c) => c.username === alvo || c.email?.startsWith(alvo + "@"),
        );
        process.stdout.write(conta ? conta.id : "");
      });
    ' "$usuario"
}

# Corpo do lote com o modelo inteiro em GLOBAL.
#
# `extra` acrescenta acoes fora do modelo — na pratica, `acesso:delegate`, que
# **nenhum modelo traz**: delegar a administracao e escolha separada por
# decisao do contrato (V1-010), e sem ela a conta que recebe o modelo
# administrador nao consegue, por sua vez, nomear outro administrador.
lote_do_modelo() {
  local jar="$1" modelo="$2" motivo="$3" extra="${4:-}"
  chamar "$jar" GET acesso/catalogo |
    node -e '
      let bruto = "";
      process.stdin.on("data", (p) => (bruto += p));
      process.stdin.on("end", () => {
        const [modelo, motivo, extra] = process.argv.slice(1);
        const catalogo = JSON.parse(bruto);
        const escolhido = catalogo.modelos.find((m) => m.id === modelo);
        if (!escolhido) {
          process.stderr.write(`modelo ${modelo} nao existe\n`);
          process.exit(1);
        }
        const acoes = [
          ...new Set([
            ...escolhido.permissoes,
            ...(extra ? extra.split(",").filter(Boolean) : []),
          ]),
        ];
        process.stdout.write(
          JSON.stringify({
            motivo,
            origem: escolhido.id,
            concessoes: acoes.map((permissao) => ({
              permissao,
              escopo: { tipo: "GLOBAL" },
            })),
          }),
        );
      });
    ' "$modelo" "$motivo" "$extra"
}

MOTIVO="Provisionamento de ambiente de desenvolvimento."

azul "1. Entrando como ${ADMIN_USUARIO} (administrador do bootstrap)"
JAR_ADMIN=$(entrar "$ADMIN_USUARIO" "$ADMIN_SENHA")
ID_ADMIN=$(conta_de "$JAR_ADMIN" "$ADMIN_USUARIO")
[[ -n "$ID_ADMIN" ]] || erro "o ${ADMIN_USUARIO} nao tem 'acesso:read'. Rode antes: pnpm --filter api acesso:bootstrap"
ok "conta ${ADMIN_USUARIO}: ${ID_ADMIN}"

azul "2. Entrando como ${PARCEIRO_USUARIO} (cria o vinculo local)"
JAR_PARCEIRO=$(entrar "$PARCEIRO_USUARIO" "$PARCEIRO_SENHA")
ID_PARCEIRO=$(conta_de "$JAR_ADMIN" "$PARCEIRO_USUARIO")
[[ -n "$ID_PARCEIRO" ]] || erro "conta de ${PARCEIRO_USUARIO} nao apareceu; o login falhou?"
ok "conta ${PARCEIRO_USUARIO}: ${ID_PARCEIRO}"

azul "3. ${ADMIN_USUARIO} concede a ${PARCEIRO_USUARIO} o modelo completo + delegacao"
RESPOSTA=$(chamar "$JAR_ADMIN" POST "acesso/usuarios/${ID_PARCEIRO}/concessoes" \
  "$(lote_do_modelo "$JAR_ADMIN" administrador "$MOTIVO" acesso:delegate)")
printf '%s' "$RESPOSTA" | grep -q '"itens"' || erro "recusado: ${RESPOSTA}"
ok "modelo administrador concedido em GLOBAL"

azul "4. ${PARCEIRO_USUARIO} concede o mesmo a ${ADMIN_USUARIO}"
# Aqui esta o motivo dos dois logins: o passo 3 nao poderia ter sido feito
# pelo proprio alvo, e este nao pode ser feito por quem o recebeu de si mesmo.
RESPOSTA=$(chamar "$JAR_PARCEIRO" POST "acesso/usuarios/${ID_ADMIN}/concessoes" \
  "$(lote_do_modelo "$JAR_ADMIN" administrador "$MOTIVO")")
printf '%s' "$RESPOSTA" | grep -q '"itens"' || erro "recusado: ${RESPOSTA}"
ok "modelo administrador concedido em GLOBAL"

azul "Pronto"
printf '   As duas contas enxergam o sistema inteiro neste ambiente.\n'
printf '   Confira com: pnpm smoke:telas %s %s\n\n' "$PARCEIRO_USUARIO" "$PARCEIRO_SENHA"
