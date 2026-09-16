#!/usr/bin/env bash
#
# Congela o estado atual do banco de dominio num arquivo restauravel.
#
# Sao dois artefatos, e os dois importam: o dump do Postgres e o tar dos anexos
# gravados em disco (ARQUIVOS_DIR). Restaurar so o banco traria de volta as
# linhas de `anexo` apontando para arquivos que nao existem mais — download 404
# numa base que parece inteira.
#
# Formato `custom` (-Fc) e nao SQL plano: o pg_restore escolhe a ordem dos
# objetos e resolve as dependencias sozinho, e o arquivo ja vem comprimido.
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/db-backup.sh               # snapshot datado em backups/
#   ./scripts/db-backup.sh --congelar    # idem, e passa a ser o baseline
#   ./scripts/db-backup.sh --congelar -m "antes de zerar"
#
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-comum.sh"

CONGELAR=nao
ROTULO=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --congelar|--baseline) CONGELAR=sim ;;
    -m|--rotulo) shift; ROTULO="$1" ;;
    *) erro "opcao desconhecida: $1" ;;
  esac
  shift
done

exigir_container
mkdir -p "$BACKUP_DIR"

SUFIXO=""
if [[ -n "$ROTULO" ]]; then
  # Rotulo entra no nome do arquivo, entao so aceita o que e seguro como nome.
  SUFIXO="-$(printf '%s' "$ROTULO" | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//' | cut -c1-40)"
fi
SELO="$(date +%Y%m%d-%H%M%S)"
DUMP="${BACKUP_DIR}/${SELO}${SUFIXO}.dump"
TAR="${BACKUP_DIR}/${SELO}${SUFIXO}-arquivos.tar.gz"

titulo "Dump do banco ${DB_NAME}"
docker exec -i "$CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc --no-owner \
  > "$DUMP" || { rm -f "$DUMP"; erro "pg_dump falhou"; }
ok "$(basename "$DUMP") ($(tamanho_humano "$DUMP"))"

# Contagem gravada ao lado: e o que permite conferir depois de um restore que a
# base voltou completa, sem abrir a aplicacao.
INVENTARIO="${DUMP%.dump}.inventario.txt"
psql_valor "$(cat "${RAIZ}/scripts/db-inventario.sql")" > "$INVENTARIO"
ok "$(basename "$INVENTARIO")"

titulo "Anexos em disco"
if [[ -d "$ARQUIVOS_DIR" ]] && [[ -n "$(ls -A "$ARQUIVOS_DIR" 2>/dev/null)" ]]; then
  tar -czf "$TAR" -C "$ARQUIVOS_DIR" .
  ok "$(basename "$TAR") ($(tamanho_humano "$TAR"))"
else
  aviso "nada em ${ARQUIVOS_DIR} — nenhum anexo para guardar"
  TAR=""
fi

if [[ "$CONGELAR" == sim ]]; then
  titulo "Definindo como baseline"
  cp -f "$DUMP" "$BASELINE"
  if [[ -n "$TAR" ]]; then cp -f "$TAR" "$BASELINE_ARQUIVOS"; else rm -f "$BASELINE_ARQUIVOS"; fi
  cp -f "$INVENTARIO" "${BASELINE%.dump}.inventario.txt"
  ok "baseline.dump atualizado — e este que pnpm db:restaurar devolve"
fi

printf '\n'
info "Restaurar este arquivo:  pnpm db:restaurar $(basename "$DUMP")"
[[ "$CONGELAR" == sim ]] && info "Restaurar o baseline:    pnpm db:restaurar"
printf '\n'
