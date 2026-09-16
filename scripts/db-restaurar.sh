#!/usr/bin/env bash
#
# Devolve o banco ao estado de um backup — por padrao, o baseline congelado.
#
# Derruba os schemas `public` e `drizzle` antes de restaurar, em vez de usar
# `pg_restore --clean`: com o drop explicito o resultado e o conteudo do dump e
# mais nada, sem depender de o dump conhecer cada objeto criado depois dele.
# `drizzle.__drizzle_migrations` entra junto, senao o drizzle-kit passaria a
# achar que ha migration aplicada que o banco restaurado nao tem.
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/db-restaurar.sh                     # baseline.dump
#   ./scripts/db-restaurar.sh 20260911-214500.dump
#   ./scripts/db-restaurar.sh --sim               # sem confirmacao (CI/scripts)
#
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-comum.sh"

CONFIRMAR=sim
ALVO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sim|-y) CONFIRMAR=nao ;;
    -*) erro "opcao desconhecida: $1" ;;
    *) ALVO="$1" ;;
  esac
  shift
done

DUMP="$BASELINE"
if [[ -n "$ALVO" ]]; then
  # Aceita caminho completo ou so o nome do arquivo dentro de backups/.
  [[ -f "$ALVO" ]] && DUMP="$ALVO" || DUMP="${BACKUP_DIR}/${ALVO}"
fi
[[ -f "$DUMP" ]] || erro "backup nao encontrado: ${DUMP}
       Congele o estado atual com: pnpm db:congelar"

TAR="${DUMP%.dump}-arquivos.tar.gz"
INVENTARIO="${DUMP%.dump}.inventario.txt"

exigir_container

titulo "Restauracao"
info "origem:  $(basename "$DUMP") ($(tamanho_humano "$DUMP"), $(date -r "$DUMP" '+%d/%m/%Y %H:%M'))"
info "destino: banco ${DB_NAME} no container ${CONTAINER}"
aviso "o conteudo atual do banco sera SUBSTITUIDO"
avisar_api_no_ar

if [[ "$CONFIRMAR" == sim ]]; then
  read -r -p "   digite \"restaurar\" para continuar: " resposta
  [[ "$resposta" == restaurar ]] || erro "cancelado"
fi

titulo "Derrubando o conteudo atual"
encerrar_conexoes
# `client_min_messages` calado: o cascade do drop lista ~110 objetos e o ruido
# esconderia um erro de verdade no meio.
psql_exec -c "set client_min_messages = warning;
              drop schema if exists public cascade;
              drop schema if exists drizzle cascade;
              create schema public;
              grant all on schema public to \"${DB_USER}\";
              grant all on schema public to public;"
ok "schemas public e drizzle recriados vazios"

titulo "Aplicando o dump"
# --single-transaction: dump que falha no meio nao deixa base meio restaurada.
docker exec -i "$CONTAINER" pg_restore -U "$DB_USER" -d "$DB_NAME" \
  --no-owner --no-privileges --single-transaction < "$DUMP" \
  || erro "pg_restore falhou — o banco permanece vazio, restaure outro backup"
ok "dados restaurados"

titulo "Anexos em disco"
if [[ -f "$TAR" ]]; then
  rm -rf "$ARQUIVOS_DIR"
  mkdir -p "$ARQUIVOS_DIR"
  tar -xzf "$TAR" -C "$ARQUIVOS_DIR"
  ok "$(basename "$TAR") extraido em ${ARQUIVOS_DIR}"
else
  aviso "sem tar de anexos ao lado do dump — downloads de anexo podem falhar"
fi

titulo "Conferencia"
ATUAL="$(psql_valor "$(cat "${RAIZ}/scripts/db-inventario.sql")")"
if [[ -f "$INVENTARIO" ]]; then
  if diff -q "$INVENTARIO" <(printf '%s\n' "$ATUAL") >/dev/null; then
    ok "todas as tabelas voltaram com a contagem registrada no backup"
  else
    aviso "contagem diferente da registrada no backup:"
    diff "$INVENTARIO" <(printf '%s\n' "$ATUAL") | sed 's/^/     /' || true
  fi
else
  printf '%s\n' "$ATUAL" | grep -v ' 0$' | sed 's/^/     /'
fi

printf '\n'
info "Reinicie o \`pnpm dev\`: o NestJS nao sobrevive ao encerramento das"
info "conexoes e o --watch nao o reinicia sozinho."
printf '\n'
