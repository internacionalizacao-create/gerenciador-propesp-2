#!/usr/bin/env bash
#
# Chama a API autenticado, pelo mesmo caminho que o browser usa.
#
# Existe porque alguns atos do fluxo ainda nao tem botao na interface —
# confirmar missao, cadastrar produto de missao, convenio, pendencia — e
# percorrer o fluxo inteiro exigiria esperar as telas.
#
# Vai pelo BFF (`/api/bff/*`) e nao direto na API: nenhum client do realm tem
# `directAccessGrants` habilitado (e ligar isso seria afrouxar o realm para
# conveniencia de script), enquanto o BFF ja injeta o Bearer a partir do cookie
# de sessao. O login e o fluxo OIDC de verdade, igual ao do smoke.
#
# Pre-requisitos: infra no ar (`pnpm infra:up`) e apps rodando (`pnpm dev`).
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/api.sh GET  me
#   ./scripts/api.sh GET  "programas/capes-global/2027-2030/comite-gestor/missoes?tamanho=5"
#   ./scripts/api.sh POST "programas/capes-global/2027-2030/comite-gestor/missoes/<id>/situacao" \
#                         '{"acao":"CONFIRMAR","justificativa":null}'
#
#   USUARIO=coord.teste SENHA=coord123 ./scripts/api.sh GET ppgs
#
set -uo pipefail

METODO="${1:?uso: api.sh METODO rota [corpo-json]}"
ROTA="${2:?uso: api.sh METODO rota [corpo-json]}"
CORPO="${3:-}"

USUARIO="${USUARIO:-admin}"
SENHA="${SENHA:-admin123}"
WEB="${APP_BASE_URL:-http://localhost:3000}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

falhar() { printf '\033[1;31mFALHA\033[0m %s\n' "$*" >&2; exit 1; }

AUTH_URL=$(curl -s -o /dev/null -w '%{redirect_url}' -c "$JAR" "${WEB}/api/auth/login?returnTo=/")
[[ -n "$AUTH_URL" ]] || falhar "a web nao respondeu em ${WEB} (pnpm dev esta rodando?)"

FORM=$(curl -s -c "$JAR" -b "$JAR" "$AUTH_URL" \
  | grep -oP 'action="\K[^"]+' | head -1 | sed 's/&amp;/\&/g')
[[ -n "$FORM" ]] || falhar "sem formulario de login no Keycloak"

CALLBACK=$(curl -s -o /dev/null -w '%{redirect_url}' -c "$JAR" -b "$JAR" \
  -d "username=${USUARIO}" --data-urlencode "password=${SENHA}" "$FORM")
[[ "$CALLBACK" == *code=* ]] || falhar "login recusado para ${USUARIO}"

curl -s -o /dev/null -c "$JAR" -b "$JAR" "$CALLBACK"
grep -q 'gr_session' "$JAR" || falhar "sessao nao foi gravada"

ARGS=(-s -b "$JAR" -X "$METODO" -H 'Accept: application/json'
      -w '\n<<< HTTP %{http_code}\n')
[[ -n "$CORPO" ]] && ARGS+=(-H 'Content-Type: application/json' --data-raw "$CORPO")

RESPOSTA="$(curl "${ARGS[@]}" "${WEB}/api/bff/${ROTA}")"
# jq e opcional: sem ele a resposta sai crua, que ainda serve para ler o erro.
CORPO_RESP="${RESPOSTA%$'\n'<<< HTTP*}"
if command -v jq >/dev/null && printf '%s' "$CORPO_RESP" | jq . >/dev/null 2>&1; then
  printf '%s' "$CORPO_RESP" | jq .
  printf '%s\n' "${RESPOSTA##*$'\n'}"
else
  printf '%s\n' "$RESPOSTA"
fi
