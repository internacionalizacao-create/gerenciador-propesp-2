#!/usr/bin/env bash
#
# Smoke da matriz de acesso, por perfil (V1-020).
#
# O `smoke:telas` percorre as telas de **uma** conta que enxerga tudo, e prova
# que a interface renderiza. Este prova a outra metade: que **duas contas
# diferentes veem coisas diferentes**, pela sessao real, do browser ate o SQL.
#
# ## Por que ele nao depende dos numeros da seed
#
# As assercoes sao sobre o **acesso**, nao sobre o volume: quais acoes `/me`
# devolve, se a tela fora do alcance responde 200 com explicacao em vez de erro,
# e se revogar vale na requisicao seguinte. Isso vale igual num banco com a
# planilha inteira e num que subiu so a base estrutural — e e o que permite
# roda-lo depois de qualquer `pnpm db:seed`.
#
# ## Pre-requisitos
#
#   - infra e `pnpm dev` no ar;
#   - o administrador ja configurado (`pnpm db:seed --admin-sub <id>`, ou o
#     `acesso:bootstrap` seguido de `./scripts/acesso-dev.sh`);
#   - `docente.teste` existindo no realm — ele e a cobaia, e **termina sem
#     concessao alguma**, como comecou.
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/smoke-acesso.sh
#
set -uo pipefail

WEB=${WEB:-http://localhost:3000}
ADMIN_USUARIO=${ADMIN_USUARIO:-admin}
ADMIN_SENHA=${ADMIN_SENHA:-admin123}
COBAIA_USUARIO=${COBAIA_USUARIO:-docente.teste}
COBAIA_SENHA=${COBAIA_SENHA:-docente123}

FALHAS=0
ok() { printf '  \033[1;32mok\033[0m    %s\n' "$1"; }
falha() {
  printf '  \033[1;31mFALHA\033[0m %s\n' "$1" >&2
  FALHAS=$((FALHAS + 1))
}
azul() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }
abortar() {
  printf '\n\033[1;31m%s\033[0m\n\n' "$1" >&2
  exit 1
}

# --- sessao -------------------------------------------------------------------

entrar() {
  local usuario="$1" senha="$2" jar login pagina acao callback
  jar=$(mktemp)
  login=$(curl -s -c "$jar" -o /dev/null -w '%{redirect_url}' \
    "${WEB}/api/auth/login?returnTo=/")
  pagina=$(curl -s -b "$jar" -c "$jar" "$login")
  acao=$(printf '%s' "$pagina" | grep -o 'action="[^"]*"' | head -1 |
    sed 's/action="//;s/"$//;s/&amp;/\&/g')
  callback=$(curl -s -b "$jar" -c "$jar" -o /dev/null -w '%{redirect_url}' \
    -X POST "$acao" --data-urlencode "username=${usuario}" \
    --data-urlencode "password=${senha}" --data-urlencode "credentialId=")
  [[ -n "$callback" ]] || abortar "Login de ${usuario} recusado pelo Keycloak."
  curl -s -b "$jar" -c "$jar" -o /dev/null "$callback"
  # `/me` e quem cria o vinculo local: sem esta chamada a conta nao existe em
  # `usuario_sistema`, e a API de acesso nao a encontra para conceder nada.
  curl -s -b "$jar" -o /dev/null "${WEB}/api/bff/me"
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

codigo_de() {
  curl -s -o /dev/null -w '%{http_code}' -b "$1" "${WEB}${2}"
}

corpo_de() { curl -s -b "$1" "${WEB}${2}"; }

# Acoes que `/me` devolve, uma por linha e ordenadas.
acoes_de() {
  chamar "$1" GET me | node -e '
    let bruto = "";
    process.stdin.on("data", (p) => (bruto += p));
    process.stdin.on("end", () => {
      const me = JSON.parse(bruto);
      process.stdout.write([...me.permissions].sort().join("\n"));
    });
  '
}

conta_de() {
  chamar "$1" GET acesso/usuarios | node -e '
    let bruto = "";
    process.stdin.on("data", (p) => (bruto += p));
    process.stdin.on("end", () => {
      const alvo = process.argv[1];
      const conta = (JSON.parse(bruto) ?? []).find(
        (c) => c.username === alvo || c.email?.startsWith(alvo + "@"),
      );
      process.stdout.write(conta ? conta.id : "");
    });
  ' "$2"
}

# --- 1. administrador ---------------------------------------------------------

azul "1. Administrador"
JAR_ADMIN=$(entrar "$ADMIN_USUARIO" "$ADMIN_SENHA")
ACOES_ADMIN=$(acoes_de "$JAR_ADMIN")
if grep -q '^acesso:write$' <<<"$ACOES_ADMIN"; then
  ok "administra acessos ($(wc -l <<<"$ACOES_ADMIN") ações concedidas)"
else
  abortar "O ${ADMIN_USUARIO} nao tem acesso:write. Configure-o antes:
  pnpm db:seed --reset --admin-sub <id do Keycloak>"
fi

# --- 2. conta sem concessao ---------------------------------------------------

azul "2. ${COBAIA_USUARIO} sem concessao alguma"
JAR_COBAIA=$(entrar "$COBAIA_USUARIO" "$COBAIA_SENHA")
ID_COBAIA=$(conta_de "$JAR_ADMIN" "$COBAIA_USUARIO")
[[ -n "$ID_COBAIA" ]] || abortar "A conta de ${COBAIA_USUARIO} nao apareceu em /acesso/usuarios."

if [[ -z "$(acoes_de "$JAR_COBAIA")" ]]; then
  ok "nenhuma ação concedida — conta nova nao herda nada do papel"
else
  falha "conta nova veio com ações concedidas"
fi

# **200 com explicacao, nunca erro generico** (V1-019). Tela fora do acesso nao
# pode responder 500 nem 403: quem entrou precisa entender por que nao ve nada.
for rota in / /ppgs /mobilidade/bolsistas; do
  codigo=$(codigo_de "$JAR_COBAIA" "$rota")
  if [[ "$codigo" == "200" ]]; then
    ok "${rota} responde 200 sem acesso"
  else
    falha "${rota} respondeu HTTP ${codigo} (esperado 200 com explicação)"
  fi
done

# `SemAcesso` tem tres textos distintos, e a conta recem-criada tem que cair no
# do meio: "sem concessao" e diferente de "vinculo pendente" (nem ha a quem
# conceder) e de "o acesso nao cobre esta tela" (tem acesso, so nao aqui).
# Conferir o texto exato e o que impede a tela de explicar a coisa errada.
if grep -qF "Sua conta ainda não recebeu acesso" <<<"$(corpo_de "$JAR_COBAIA" /ppgs)"; then
  ok "/ppgs explica que a conta ainda não recebeu acesso"
else
  falha "/ppgs nao mostrou o texto de conta sem concessão"
fi

# A API e a autorizacao que vale: a sonda restrita recusa mesmo sem tela.
codigo=$(codigo_de "$JAR_COBAIA" /api/bff/me/exemplo-restrito)
if [[ "$codigo" == "403" ]]; then
  ok "a API recusa o endpoint restrito (403), e nao so a tela"
else
  falha "endpoint restrito respondeu HTTP ${codigo} (esperado 403)"
fi

# --- 3. concessao estreita ----------------------------------------------------

azul "3. ${COBAIA_USUARIO} com uma unica acao concedida"
RESPOSTA=$(chamar "$JAR_ADMIN" POST "acesso/usuarios/${ID_COBAIA}/concessoes" \
  '{"motivo":"Smoke da matriz de acesso (V1-020).","concessoes":[{"permissao":"ppg:read","escopo":{"tipo":"GLOBAL"}}]}')
grep -q '"itens"' <<<"$RESPOSTA" || abortar "Concessao recusada: ${RESPOSTA}"

ACOES=$(acoes_de "$JAR_COBAIA")
if [[ "$ACOES" == "ppg:read" ]]; then
  ok "/me devolve exatamente a ação concedida"
else
  falha "/me devolveu [$(tr '\n' ' ' <<<"$ACOES")], esperado apenas ppg:read"
fi

# O lado **permitido** da matriz: a mesma tela, a mesma conta, resposta
# diferente depois da concessao. Assercao sobre o acesso e nao sobre o volume,
# entao vale igual num banco com a planilha e num que subiu so a base.
if grep -qF "Sua conta ainda não recebeu acesso" <<<"$(corpo_de "$JAR_COBAIA" /ppgs)"; then
  falha "/ppgs continuou negando depois da concessão de ppg:read"
else
  ok "/ppgs passou a abrir com ppg:read"
fi

# E o lado **negado**, na mesma conta e no mesmo instante: uma acao concedida
# nao destrava as vizinhas, e `ppg:read` nao e `plano:read`.
if grep -qF "Seu acesso não cobre esta tela" <<<"$(corpo_de "$JAR_COBAIA" /programas)"; then
  ok "/programas segue fora do alcance com apenas ppg:read"
else
  falha "/programas abriu com apenas ppg:read"
fi

# --- 4. revogacao -------------------------------------------------------------

azul "4. Revogacao"
CONCESSAO=$(chamar "$JAR_ADMIN" GET "acesso/usuarios/${ID_COBAIA}/concessoes" |
  node -e '
    let bruto = "";
    process.stdin.on("data", (p) => (bruto += p));
    process.stdin.on("end", () => {
      const dados = JSON.parse(bruto);
      const lista = Array.isArray(dados) ? dados : (dados.concessoes ?? dados.itens ?? []);
      const alvo = lista.find((c) => c.permissao === "ppg:read" && c.ativo !== false);
      process.stdout.write(alvo ? alvo.id : "");
    });
  ')
[[ -n "$CONCESSAO" ]] || abortar "Nao encontrei a concessao recem-criada para revogar."

RESPOSTA=$(chamar "$JAR_ADMIN" POST "acesso/concessoes/${CONCESSAO}/revogacao" \
  '{"motivo":"Fim do smoke da matriz de acesso."}')

# **Sem cache de autorizacao**: a proxima requisicao ja nao enxerga.
if [[ -z "$(acoes_de "$JAR_COBAIA")" ]]; then
  ok "revogar vale na requisição seguinte, sem novo login"
else
  falha "a ação continuou valendo após a revogação: ${RESPOSTA}"
fi

# --- resultado ----------------------------------------------------------------

if [[ "$FALHAS" -gt 0 ]]; then
  printf '\n\033[1;31m%s verificacao(oes) falharam\033[0m\n\n' "$FALHAS"
  exit 1
fi
printf '\n\033[1;32mA matriz de acesso respondeu igual da tela ao SQL\033[0m\n\n'
