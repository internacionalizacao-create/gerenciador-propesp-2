#!/usr/bin/env bash
#
# Percorre o fluxo de login inteiro sem browser e confere as garantias que
# importam: PKCE, state, nonce, cookie opaco, papeis, permissoes e logout.
#
# Serve para responder "a autenticacao ainda esta de pe?" em um comando, sem
# depender de alguem clicar na tela.
#
# Pre-requisitos: infra no ar (`pnpm infra:up`) e apps rodando (`pnpm dev`).
#
# Uso:
#   ./scripts/smoke-login.sh                       # coord.teste
#   ./scripts/smoke-login.sh docente.teste docente123
#
set -uo pipefail

USUARIO="${1:-coord.teste}"
SENHA="${2:-coord123}"
WEB="${APP_BASE_URL:-http://localhost:3000}"

JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

FALHAS=0
titulo() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
ok()     { printf '   \033[1;32mok\033[0m   %s\n' "$*"; }
falha()  { printf '   \033[1;31mFALHA\033[0m %s\n' "$*"; FALHAS=$((FALHAS + 1)); }
checa()  { if [[ "$1" == "sim" ]]; then ok "$2"; else falha "$2"; fi; }
contem() { grep -q -- "$2" <<<"$1" && echo sim || echo nao; }

titulo "1. Inicio do fluxo — GET /api/auth/login"
AUTH_URL=$(curl -s -o /dev/null -w '%{redirect_url}' -c "$JAR" \
  "${WEB}/api/auth/login?returnTo=/pendencias")
if [[ -z "$AUTH_URL" ]]; then
  falha "a app nao redirecionou para o Keycloak (ela esta rodando?)"
  exit 1
fi
checa "$(contem "$AUTH_URL" 'response_type=code')"        "Authorization Code Flow"
checa "$(contem "$AUTH_URL" 'code_challenge_method=S256')" "PKCE com S256"
checa "$(contem "$AUTH_URL" 'state=')"                     "state (anti-CSRF)"
checa "$(contem "$AUTH_URL" 'nonce=')"                     "nonce (anti-replay)"
checa "$(grep -q 'gr_auth_tx' "$JAR" && echo sim || echo nao)" "cookie de transacao gravado"

titulo "2. Autenticacao no Keycloak como ${USUARIO}"
FORM=$(curl -s -c "$JAR" -b "$JAR" "$AUTH_URL" \
  | grep -oP 'action="\K[^"]+' | head -1 | sed 's/&amp;/\&/g')
[[ -n "$FORM" ]] && ok "tela de login do Keycloak carregou" || falha "sem formulario de login"

CALLBACK=$(curl -s -o /dev/null -w '%{redirect_url}' -c "$JAR" -b "$JAR" \
  -d "username=${USUARIO}" --data-urlencode "password=${SENHA}" "$FORM")
checa "$(contem "$CALLBACK" 'code=')" "Keycloak devolveu um authorization code"

titulo "3. Troca do code por tokens — GET /api/auth/callback"
DESTINO=$(curl -s -o /dev/null -w '%{redirect_url}' -c "$JAR" -b "$JAR" "$CALLBACK")
checa "$(contem "$DESTINO" '/pendencias')" "redirecionou para o returnTo"
checa "$(grep -q 'gr_session.0' "$JAR" && echo sim || echo nao)" "sessao gravada em cookie"
checa "$(grep -q '#HttpOnly_' "$JAR" && echo sim || echo nao)" "cookie marcado HttpOnly"

titulo "4. O cookie nao carrega token legivel"
SELADA="$(awk -F'\t' '$6 ~ /^gr_session\./ {print $6"\t"$7}' "$JAR" | sort | cut -f2 | tr -d '\n')"
echo "   ${#SELADA} bytes em $(grep -c 'gr_session\.' "$JAR") fatia(s) de cookie"
python3 - "$SELADA" <<'PY'
import base64, re, sys

VERDE, VERMELHO = '\033[1;32mok\033[0m', '\033[1;31mFALHA\033[0m'
def b64(s): return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))

segs = sys.argv[1].split('.')
if len(segs) != 5:
    print(f'   {VERMELHO} nao e um JWE compacto (esperado 5 segmentos, veio {len(segs)})')
    sys.exit(1)

print(f'   {VERDE}   cabecalho JWE: {b64(segs[0]).decode()}')

corpo = b64(segs[3])
# Procurar palavras especificas nao serve: em ~3 KB de bytes aleatorios qualquer
# sequencia curta aparece por acaso. O que denuncia vazamento e um TRECHO longo
# de ASCII imprimivel — algo que texto cifrado praticamente nunca produz
# (12 bytes seguidos tem chance ~1 em 10^10 por posicao).
trechos = [t for t in re.findall(rb'[\x20-\x7e]{12,}', corpo)]
if trechos:
    print(f'   {VERMELHO} texto legivel dentro do corpo cifrado: {trechos[:3]}')
    sys.exit(1)

print(f'   {VERDE}   corpo cifrado e opaco ({len(corpo)} bytes, nenhum trecho legivel)')
PY
checa "$([[ $? -eq 0 ]] && echo sim || echo nao)" "cookie de sessao nao expoe token"

titulo "5. Pagina protegida — a API responde atraves do BFF"
ME=$(curl -s -b "$JAR" "${WEB}/api/bff/me")
checa "$(contem "$ME" '"roles"')"       "a API respondeu /me atraves do BFF"
echo "   papeis    : $(python3 -c 'import json,sys;print(", ".join(json.loads(sys.argv[1])["roles"]))' "$ME" 2>/dev/null)"
echo "   permissoes: $(python3 -c 'import json,sys;print(", ".join(json.loads(sys.argv[1])["permissions"]))' "$ME" 2>/dev/null)"

titulo "6. Autorizacao — GET /me/exemplo-restrito (exige plano:write)"
CODIGO=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "${WEB}/api/bff/me/exemplo-restrito")
if grep -q '"plano:write"' <<<"$ME"; then
  checa "$([[ "$CODIGO" == "200" ]] && echo sim || echo nao)" "usuario COM a permissao recebeu 200 (veio $CODIGO)"
else
  checa "$([[ "$CODIGO" == "403" ]] && echo sim || echo nao)" "usuario SEM a permissao recebeu 403 (veio $CODIGO)"
fi

titulo "7. A API recusa quem chega sem token"
SEM=$(curl -s -o /dev/null -w '%{http_code}' "${API_BASE_URL:-http://localhost:3001}/me")
checa "$([[ "$SEM" == "401" ]] && echo sim || echo nao)" "GET /me direto na API sem Bearer = 401 (veio $SEM)"

titulo "8. Logout"
SAIDA=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JAR" -c "$JAR" -X POST "${WEB}/api/auth/logout")
checa "$(contem "$SAIDA" 'protocol/openid-connect/logout')" "logout tambem encerra a sessao no Keycloak"
APOS=$(curl -s -o /dev/null -w '%{redirect_url}' -b "$JAR" "${WEB}/pendencias")
checa "$(contem "$APOS" '/login')" "/pendencias volta a exigir login"

titulo "Resultado"
if [[ "$FALHAS" -eq 0 ]]; then
  printf '   \033[1;32mtodas as verificacoes passaram\033[0m\n'
else
  printf '   \033[1;31m%s verificacao(oes) falharam\033[0m\n' "$FALHAS"
  exit 1
fi
