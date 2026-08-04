# Keycloak — configuração do realm (SSO)

Este é o "espaço" reservado para você configurar o Keycloak como SSO da aplicação.

## Import automático de realm

A pasta [import/](import) é montada em `/opt/keycloak/data/import` e lida no boot do container
(o comando usa `start-dev --import-realm`). Qualquer arquivo `*-realm.json` / `realm-export.json`
colocado aqui é importado automaticamente ao subir o Keycloak.

## Como exportar seu realm depois de configurá-lo pela UI

1. Configure o realm, os clients (ex.: `web` e `api`), roles e usuários pelo console (<http://localhost:8080>).
2. Exporte para dentro do container e copie para esta pasta:

```bash
# exporta o realm "gerenciador" para /tmp dentro do container
docker exec -it gerenciador-keycloak \
  /opt/keycloak/bin/kc.sh export --dir /tmp/export --realm gerenciador --users realm_file

# copia o arquivo exportado para esta pasta (import/)
docker cp gerenciador-keycloak:/tmp/export/gerenciador-realm.json ./infra/keycloak/import/
```

3. No próximo `pnpm infra:up`, o realm será recriado a partir desse arquivo.

## Sugestão de clients para o SSO

- **web** (Next.js): client público / OIDC com `Standard flow` (Authorization Code + PKCE).
- **api** (NestJS): client confidencial (bearer-only) para validar os tokens.

> Nada disso é criado automaticamente ainda — esta etapa é só a infraestrutura. A modelagem do realm/clients
> fica para quando você começar a integrar o SSO.
