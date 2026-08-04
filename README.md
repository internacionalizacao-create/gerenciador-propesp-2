# gerenciador (PROPESP)

Monorepo do sistema **gerenciador**, orquestrado com [pnpm workspaces](https://pnpm.io/workspaces) e
[Turborepo](https://turbo.build/repo).

## Stack

| App/Pacote | Descrição | Local |
|---|---|---|
| `api` | Backend NestJS | [apps/api](apps/api) |
| `web` | Frontend Next.js (App Router + Tailwind) | [apps/web](apps/web) |
| `@gerenciador/tsconfig` | TSConfig base compartilhado | [packages/tsconfig](packages/tsconfig) |
| `@gerenciador/eslint-config` | Config ESLint base compartilhada | [packages/eslint-config](packages/eslint-config) |
| Infra (Keycloak + Postgres) | SSO e bancos de dados | [infra](infra) |

## Pré-requisitos

- Node **24.13.0** (veja [.nvmrc](.nvmrc) — rode `nvm use`)
- pnpm **11.x** (`corepack enable` ou instalação global)
- Docker + Docker Compose (para a infra do Keycloak/Postgres)

## Primeiros passos

```bash
nvm use                 # usa a versão do .nvmrc
pnpm install            # instala tudo (lockfile único na raiz)

# infra (Keycloak + Postgres)
cp infra/.env.example infra/.env
pnpm infra:up           # sobe keycloak, keycloak-db e api-db
# Keycloak: http://localhost:8080  (admin / admin — veja infra/.env)

# desenvolvimento
pnpm dev                # sobe api + web via turbo
```

## Scripts (raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Sobe todos os apps em modo dev (turbo) |
| `pnpm build` | Builda todos os apps |
| `pnpm lint` | Linta todos os apps |
| `pnpm test` | Roda testes |
| `pnpm infra:up` / `infra:down` | Sobe / derruba a infra Docker |
| `pnpm infra:logs` | Acompanha os logs da infra |

Filtrar por app: `pnpm --filter api <script>` ou `pnpm --filter web <script>`.

> **Nota:** por padrão Nest e Next escutam na porta `3000`. Ao começar a codar, rode a API em outra
> porta (ex.: `PORT=3001`) para evitar conflito com a `web`.
