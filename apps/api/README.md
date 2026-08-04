# api — gerenciador (backend)

Backend do sistema **gerenciador**, construído com [NestJS 11](https://nestjs.com/). Faz parte do
monorepo — veja o [README da raiz](../../README.md) para a visão geral.

## Pré-requisitos

- Dependências instaladas a partir da **raiz** do monorepo: `pnpm install`
- Infra de banco no ar (Postgres da API): `pnpm infra:up` (a partir da raiz)

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
não foi definido — escolha ao começar a codar.

## Scripts úteis

| Script | Ação |
|---|---|
| `dev` | Dev com hot-reload (usado pelo `pnpm dev` da raiz) |
| `start:dev` | Alias de `dev` |
| `build` | Compila para `dist/` |
| `test` / `test:e2e` / `test:cov` | Testes unitários / e2e / cobertura |
| `lint` | ESLint (`--fix`) |

## SSO (Keycloak)

A API deve validar tokens emitidos pelo Keycloak (client confidencial/bearer-only). A infra do Keycloak
já está pronta em [infra/](../../infra/README.md); a integração em código fica para depois.

> **Nota:** este é o scaffold inicial do Nest — o código de exemplo (`app.*.ts`) será limpo antes de codar.
