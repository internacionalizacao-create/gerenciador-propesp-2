#!/usr/bin/env bash
# Percorre todas as telas com sessao real e confere que renderizam com dado.
set -uo pipefail

WEB=http://localhost:3000
JAR=$(mktemp)
USUARIO=${1:-coord.teste}
SENHA=${2:-coord123}

# --- login (mesmo caminho do smoke) ---
LOGIN=$(curl -s -c "$JAR" -o /dev/null -w '%{redirect_url}' "${WEB}/api/auth/login?returnTo=/")
PAGINA=$(curl -s -b "$JAR" -c "$JAR" "$LOGIN")
ACAO=$(printf '%s' "$PAGINA" | grep -o 'action="[^"]*"' | head -1 | sed 's/action="//;s/"$//' | sed 's/&amp;/\&/g')
CALLBACK=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{redirect_url}' -X POST "$ACAO" \
  --data-urlencode "username=${USUARIO}" --data-urlencode "password=${SENHA}" --data-urlencode "credentialId=")
curl -s -b "$JAR" -c "$JAR" -o /dev/null "$CALLBACK"

FALHAS=0

testar() {
  local rota="$1" esperado="$2"
  local corpo
  corpo=$(curl -s -b "$JAR" "${WEB}${rota}")
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "${WEB}${rota}")

  if [[ "$codigo" != "200" ]]; then
    printf '  \033[1;31mFALHA\033[0m %-52s HTTP %s\n' "$rota" "$codigo"
    FALHAS=$((FALHAS + 1))
    return
  fi
  if ! grep -qF "$esperado" <<<"$corpo"; then
    printf '  \033[1;31mFALHA\033[0m %-52s sem "%s"\n' "$rota" "$esperado"
    FALHAS=$((FALHAS + 1))
    return
  fi
  printf '  \033[1;32mok\033[0m    %-52s %s\n' "$rota" "$esperado"
}

echo "Renderizacao das telas como ${USUARIO}:"
testar "/"                                                   "2.315.444,58"
testar "/"                                                   "1.033.513,40"
testar "/"                                                   "147.091,05"
testar "/programas"                                          "CAPES Global"
testar "/programas/capes-global/2027-2030"                   "Aporte anual conhecido"
testar "/programas/capes-global/2027-2030/redes"             "UNESP-T4"
testar "/programas/capes-global/2027-2030/redes"             "268,75"
testar "/programas/capes-global/2027-2030/tematicas/UNESP-T4" "233.854,04"
testar "/programas/capes-global/2027-2030/tematicas/UNESP-T4" "2.808,64"
testar "/programas/capes-global/2027-2030/orcamento"         "9.261.778,32"
testar "/programas/capes-global/2027-2030/plano"             "Visão geral"
testar "/programas/capes-global/2027-2030/plano"             "Panorama por rede"
testar "/programas/capes-global/2027-2030/plano?rede=unesp"  "BOL-001"
testar "/programas/capes-global/2027-2030/plano?rede=ufmg"   "BOL-021"
testar "/programas/capes-global/2027-2030/plano?rede=ufmg"   "140.018,40"
testar "/programas/capes-global/2027-2030/plano?rede=unicamp" "Nenhuma linha nesta temática"
if [[ "$USUARIO" == "admin" ]]; then
  testar "/programas/capes-global/2027-2030/plano?rede=unesp" "Editar"
  testar "/programas/capes-global/2027-2030/plano?rede=unesp" "Histórico"
fi
testar "/programas/capes-global/2027-2030/comite-gestor"     "381.333,00"
testar "/programas/capes-global/2027-2030/premissas"         "6.59"
testar "/mobilidade/bolsistas"                              "Bolsistas e bolsas concedidas"
testar "/ppgs"                                               "PPG CLIAMB"
testar "/pendencias"                                         "PEND-001"
testar "/catalogos/bolsas"                                   "CAT-053"
testar "/catalogos/bolsas"                                   "82.902,20"
testar "/catalogos/modalidades"                              "Doutorado Sanduíche"
testar "/configuracoes"                                      "plano:write"

# Detalhe de PPG precisa de um id vindo da lista.
ID=$(curl -s -b "$JAR" "${WEB}/ppgs" | grep -o '/ppgs/[0-9a-f-]\{36\}' | head -1)
[[ -n "$ID" ]] && testar "$ID" "Dados institucionais"

echo
if [[ "$FALHAS" -eq 0 ]]; then
  printf '\033[1;32mtodas as telas renderizaram com os numeros esperados\033[0m\n'
else
  printf '\033[1;31m%s verificacao(oes) falharam\033[0m\n' "$FALHAS"
  exit 1
fi
