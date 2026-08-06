# Keycloak — realm do sistema (SSO)

O realm `gerenciador` é **versionado** em
[import/gerenciador-realm.json](import/gerenciador-realm.json). Esse arquivo é a
fonte da verdade: quem clonar o repositório sobe um Keycloak idêntico ao de todo
mundo, sem passo manual no console.

## O que o realm define

**Clients**

| clientId | Tipo | Para quê |
|---|---|---|
| `gerenciador-web` | confidencial, Standard Flow + PKCE (S256) | o BFF do Next. Faz a troca do code por tokens usando o client secret. |
| `gerenciador-api` | sem nenhum fluxo habilitado | existe para ser a `aud` dos access tokens — a API recusa token que não a traga. |

O client `gerenciador-web` carrega um *audience mapper* que insere
`gerenciador-api` na claim `aud` dos tokens que emite.

**Papéis de realm:** `admin`, `coordenador`, `secretaria`, `docente`, `discente`.
O que cada um concede é decidido na API, não aqui — ver
[apps/api/src/auth/permissions.ts](../../apps/api/src/auth/permissions.ts).

**Usuários de teste** (só fazem sentido em desenvolvimento):

| usuário | senha | papéis |
|---|---|---|
| `admin.teste` | `admin123` | `admin` |
| `coord.teste` | `coord123` | `coordenador`, `docente` |
| `docente.teste` | `docente123` | `docente` |

**Durações:** access token 5 min · sessão SSO ociosa 30 min · máxima 10 h.
Proteção contra força bruta ligada (5 tentativas).

## Import automático

Esta pasta é montada em `/opt/keycloak/data/import` e lida no boot
(`start-dev --import-realm`). O import automático **só acontece se o realm ainda
não existir** — em um volume já criado, nada muda.

## Reaplicar o arquivo em um Keycloak que já está rodando

```bash
pnpm kc:import           # cria; recusa se o realm já existir
pnpm kc:import --force   # APAGA o realm e recria
```

> `--force` destrói usuários, sessões e qualquer ajuste feito pelo console. Se
> você configurou algo pela UI e quer manter, exporte antes (veja abaixo).

## Exportar o realm depois de mexer pelo console

```bash
docker exec -it gerenciador-keycloak \
  /opt/keycloak/bin/kc.sh export --dir /tmp/export --realm gerenciador --users realm_file

docker cp gerenciador-keycloak:/tmp/export/gerenciador-realm.json ./infra/keycloak/import/
```

O export vem muito mais verboso que o arquivo mantido à mão (traz todos os
defaults do Keycloak). Prefira editar o JSON versionado diretamente quando a
mudança for pequena.

## Produção

Nada aqui serve para produção como está:

- o container roda `start-dev` (sem HTTPS, sem cache distribuído);
- o client secret está versionado — gere um novo pelo console;
- os usuários de teste precisam sair;
- `sslRequired` está como `external` e a federação com o diretório institucional
  (LDAP/AD) ainda não foi configurada.
