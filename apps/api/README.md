# api — gerenciador (backend)

Backend do sistema **gerenciador**, construído com [NestJS 11](https://nestjs.com/). Faz parte do
monorepo — veja o [README da raiz](../../README.md) para a visão geral.

## Pré-requisitos

- Dependências instaladas a partir da **raiz** do monorepo: `pnpm install`
- Infra no ar (Keycloak + Postgres): `pnpm infra:up` (a partir da raiz)
- Ambiente configurado: `cp .env.example .env` — a API **não sobe** com ambiente
  incompleto ([src/config/env.ts](src/config/env.ts) valida com zod no boot)

## Como rodar

A partir da **raiz** do monorepo (recomendado):

```bash
pnpm --filter api dev           # dev com watch
pnpm --filter api build         # build de produção -> dist/
pnpm --filter api start:prod    # roda o build (node dist/main)
```

Ou tudo de uma vez (api + web) via turbo: `pnpm dev`.

> **Porta:** a API sobe em `http://localhost:3001` — o [main.ts](src/main.ts) lê `process.env.PORT` com
> fallback `3001`, para não conflitar com a web (que fica na `3000`). Para trocar:
> `PORT=3002 pnpm --filter api dev`.

> **Importante:** o script precisa se chamar `dev` para o `turbo run dev` (ou seja, o `pnpm dev` da
> raiz) encontrá-lo. O `start:dev` foi mantido como alias, mas o turbo só enxerga o `dev`.

## Banco de dados

O Postgres dedicado da API é provido pela infra (`pnpm infra:up`):

```
postgresql://gerenciador:gerenciador@localhost:5432/gerenciador
```

Credenciais/porta em [infra/.env.example](../../infra/.env.example). O ORM (Prisma/TypeORM/etc.) ainda
não foi definido — escolha ao começar a codar. **A API ainda não se conecta a este banco.**

## Scripts úteis

| Script | Ação |
|---|---|
| `dev` | Dev com hot-reload (usado pelo `pnpm dev` da raiz) |
| `start:dev` | Alias de `dev` |
| `build` | Compila para `dist/` |
| `test` / `test:e2e` / `test:cov` | Testes unitários / e2e / cobertura |
| `lint` | ESLint (`--fix`) |

## Autenticação e autorização

A API é um **resource server OAuth2**: valida localmente o access token do Keycloak
contra o JWKS do realm, conferindo assinatura, `iss`, `aud` e `typ`. Não há chamada
de rede por requisição, e também não há CORS — quem fala com a API é o BFF do Next,
nunca o browser.

Os dois guards são **globais**, então todo endpoint exige login por padrão:

```ts
@Public()                              // abre o endpoint
@RequirePermission('plano:write')      // exige a permissão (implica login)
@CurrentUser() user: AuthUser          // injeta o usuário autenticado
```

Código em [src/auth/](src/auth); catálogo de permissões e mapa papel → permissão em
[src/auth/permissions.ts](src/auth/permissions.ts); arquitetura completa em
[docs/autenticacao.md](../../docs/autenticacao.md).

### Endpoints atuais

| Rota | Acesso |
|---|---|
| `GET /health` | público |
| `GET /me` | autenticado |
| `GET /me/exemplo-restrito` | exige `plano:write` — sonda usada pelo `pnpm smoke:login` |
| `GET /programas` · `GET /programas/:slug` | `programa:read` |
| `GET /programas/padrao/painel` | `painel:read` — painel do ciclo aberto por padrão |
| `GET /programas/:programa/:ciclo` | `programa:read` — índice do ciclo (P06) |
| `GET /programas/:programa/:ciclo/painel` | `painel:read` (P01) |
| `GET /programas/:programa/:ciclo/redes` | `orcamento:read` (P07) |
| `GET /programas/:programa/:ciclo/tematicas/:codigo` | `orcamento:read` (P08) |
| `GET /programas/:programa/:ciclo/orcamento` | `orcamento:read` (P09) |
| `GET /programas/:programa/:ciclo/plano` | `plano:read` (P10) |
| `POST /programas/:programa/:ciclo/plano` | `plano:write` |
| `POST /programas/:programa/:ciclo/plano/:id/cancelar` | `plano:write` |
| `GET /programas/:programa/:ciclo/comite-gestor` | `orcamento:read` (P17) |
| `GET /programas/:programa/:ciclo/premissas` | `premissa:read` (P16) |
| `GET /programas/:programa/:ciclo/pendencias` · `POST` | `pendencia:read` / `pendencia:write` (P13) |
| `PATCH /pendencias/:id` · `DELETE /pendencias/:id` | `pendencia:write` |
| `GET /ppgs` · `GET /ppgs/:id` | `ppg:read` (P14) |
| `POST /ppgs` · `PATCH /ppgs/:id` | `ppg:write` |
| `GET /catalogo/bolsas` · `GET /catalogo/modalidades` | `catalogo:read` (P15, P23) |

O endereço carrega slug e nome de ciclo (`/programas/capes-global/2027-2030`) em
vez de UUID: dá para ler a URL e saber de que ciclo se trata, o que importa
quando um número é conferido contra um relatório impresso.

### Testes

`pnpm test` roda em **modo ESM** (`jest.config.mjs`), porque `jose` é ESM-only.
Dentro de um teste, `jest` não é global: `import { jest } from '@jest/globals'`.
