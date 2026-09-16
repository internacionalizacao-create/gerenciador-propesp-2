#
# Base comum dos scripts de banco (backup, restauracao e zeragem).
#
# Tudo roda com o cliente que vive dentro do container do Postgres, e nao com o
# psql/pg_dump da maquina: a versao bate com a do servidor por construcao, e nao
# depende de ninguem ter instalado o cliente 17 localmente.
#
# Nao executa nada por si — os scripts fazem `source` deste arquivo.

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${RAIZ}/backups}"
BASELINE="${BACKUP_DIR}/baseline.dump"
BASELINE_ARQUIVOS="${BACKUP_DIR}/baseline-arquivos.tar.gz"
# Anexos da CG-051. Ficam fora do banco, entao backup que ignora este diretorio
# restaura linhas de `anexo` cujo download responde 404.
ARQUIVOS_DIR="${ARQUIVOS_DIR:-${RAIZ}/apps/api/arquivos}"

# Credenciais do mesmo arquivo que o compose usa.
if [[ -f "${RAIZ}/infra/.env" ]]; then
  # shellcheck disable=SC1091
  set -a; source "${RAIZ}/infra/.env"; set +a
fi
CONTAINER="${API_DB_CONTAINER:-gerenciador-api-db}"
DB_NAME="${API_DB_NAME:-gerenciador}"
DB_USER="${API_DB_USER:-gerenciador}"

titulo() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
info()   { printf '   %s\n' "$*"; }
ok()     { printf '   \033[1;32mok\033[0m   %s\n' "$*"; }
aviso()  { printf '   \033[1;33maviso\033[0m %s\n' "$*"; }
erro()   { printf '\n\033[1;31mFALHA\033[0m %s\n\n' "$*" >&2; exit 1; }

exigir_container() {
  docker inspect -f '{{.State.Running}}' "$CONTAINER" 2>/dev/null | grep -q true \
    || erro "container ${CONTAINER} nao esta rodando. Rode: pnpm infra:up"
}

# psql silencioso, uma instrucao por invocacao, abortando na primeira falha.
psql_exec() {
  docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -q \
    -U "$DB_USER" -d "$DB_NAME" "$@"
}

# Uma linha de resultado, sem cabecalho nem espacos.
psql_valor() {
  docker exec -i "$CONTAINER" psql -tAX -U "$DB_USER" -d "$DB_NAME" -c "$1"
}

# Encerra as outras conexoes ao banco. Sem isso, `drop schema` e `truncate`
# ficam esperando num lock que a API (pool aberto) nunca solta sozinha.
encerrar_conexoes() {
  docker exec -i "$CONTAINER" psql -tAX -U "$DB_USER" -d postgres -c "
    select pg_terminate_backend(pid)
      from pg_stat_activity
     where datname = '${DB_NAME}' and pid <> pg_backend_pid()" >/dev/null
}

tamanho_humano() { du -h "$1" 2>/dev/null | cut -f1; }

# Avisa quando a API esta no ar.
#
# `encerrar_conexoes` mata o pool dela, e o NestJS nao sobrevive a isso: o
# processo termina e o `--watch` nao o traz de volta, porque nenhum arquivo
# mudou. Quem descobre depois acha que o script corrompeu o banco, quando o que
# caiu foi a aplicacao.
avisar_api_no_ar() {
  local url="${API_HEALTH_URL:-http://localhost:3001/health}"
  if curl -sf -m 2 -o /dev/null "$url" 2>/dev/null; then
    aviso "a API esta respondendo em ${url} e vai cair quando as conexoes"
    aviso "forem encerradas — reinicie o \`pnpm dev\` depois deste comando"
  fi
}
