# Infra — Keycloak (SSO) + Postgres

Ambiente Docker para desenvolvimento: um **Keycloak** (SSO) com **Postgres dedicado**, e um **Postgres
dedicado para a API** NestJS.

## Serviços

| Serviço | Imagem | Porta (host) | Descrição |
|---|---|---|---|
| `keycloak` | `quay.io/keycloak/keycloak:26.3` | `8080` | Servidor SSO (modo `start-dev`) |
| `keycloak-db` | `postgres:17` | `5433` | Banco do Keycloak |
| `api-db` | `postgres:17` | `5432` | Banco da API |

## Uso (a partir da raiz do monorepo)

```bash
cp infra/.env.example infra/.env      # ajuste senhas se quiser
pnpm infra:up                         # sobe tudo em background
pnpm infra:logs                       # acompanha os logs
pnpm infra:down                       # derruba (mantém os volumes/dados)
```

- Console admin do Keycloak: <http://localhost:8080> (login com `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`).
- Para apagar também os dados: `docker compose -f infra/docker-compose.yml down -v`.

## Conexão dos bancos (para a API)

```
# API
postgresql://gerenciador:gerenciador@localhost:5432/gerenciador

# Keycloak (normalmente você não acessa direto)
postgresql://keycloak:keycloak@localhost:5433/keycloak
```

## Realm / SSO

O diretório [keycloak/import](keycloak/import) é montado em `/opt/keycloak/data/import` e é lido no boot
(`--import-realm`). Coloque ali o export do seu realm (`realm-export.json`) para provisioná-lo
automaticamente. Veja [keycloak/README.md](keycloak/README.md).

> **Nota:** a tag `26.3` do Keycloak é um ponto de partida — confirme a versão estável mais recente da
> série 26.x antes de subir em outros ambientes.
