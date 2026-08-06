#!/usr/bin/env bash
#
# (Re)importa o realm `gerenciador` em um Keycloak que ja esta rodando.
#
# O mesmo arquivo import/gerenciador-realm.json e lido automaticamente pelo
# container no boot (`start-dev --import-realm`), mas so quando o realm ainda
# nao existe. Este script existe para reaplicar o arquivo sem derrubar a infra.
#
# Uso (a partir da raiz do monorepo):
#   ./infra/keycloak/import-realm.sh          # cria; recusa se o realm ja existir
#   ./infra/keycloak/import-realm.sh --force  # APAGA o realm existente e recria
#
# --force destroi usuarios, sessoes e qualquer ajuste feito pelo console.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REALM_FILE="${SCRIPT_DIR}/import/gerenciador-realm.json"
REALM_NAME="gerenciador"
KC_URL="${KEYCLOAK_URL:-http://localhost:8080}"

# Le as credenciais de admin do infra/.env (mesmo arquivo usado pelo compose).
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
fi
KC_ADMIN="${KEYCLOAK_ADMIN:-admin}"
KC_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

log() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merro:\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$REALM_FILE" ]] || die "realm nao encontrado: $REALM_FILE"

log "autenticando em ${KC_URL} como ${KC_ADMIN}"
TOKEN="$(curl -fsS -X POST "${KC_URL}/realms/master/protocol/openid-connect/token" \
  -d "client_id=admin-cli" -d "grant_type=password" \
  -d "username=${KC_ADMIN}" --data-urlencode "password=${KC_PASS}" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')"
[[ -n "$TOKEN" ]] || die "nao consegui obter o token de admin (o Keycloak esta no ar? \`pnpm infra:up\`)"

EXISTS="$(curl -s -o /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" "${KC_URL}/admin/realms/${REALM_NAME}")"

if [[ "$EXISTS" == "200" ]]; then
  if [[ "$FORCE" != "1" ]]; then
    die "o realm '${REALM_NAME}' ja existe. Use --force para APAGAR e recriar (perde usuarios e sessoes)."
  fi
  log "apagando realm existente '${REALM_NAME}'"
  curl -fsS -X DELETE -H "Authorization: Bearer ${TOKEN}" \
    "${KC_URL}/admin/realms/${REALM_NAME}" >/dev/null
fi

log "importando ${REALM_FILE}"
curl -fsS -X POST "${KC_URL}/admin/realms" \
  -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  --data-binary "@${REALM_FILE}" >/dev/null

log "realm '${REALM_NAME}' pronto: ${KC_URL}/admin/master/console/#/${REALM_NAME}"
