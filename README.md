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
# O realm `gerenciador` é importado sozinho no primeiro boot.

# ambiente dos apps
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# gere um SESSION_SECRET próprio para apps/web/.env.local:
#   openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

# desenvolvimento
pnpm dev                # sobe api + web via turbo
# web -> http://localhost:3000   |   api -> http://localhost:3001
```

Entre em <http://localhost:3000> e use um dos usuários de teste, por exemplo
`coord.teste` / `coord123`. Sem seed, o painel abre em estado vazio — carregue os
dados com `pnpm --filter api db:seed --reset`.

## Autenticação

O login é feito no Keycloak (Authorization Code + PKCE) e o Next atua como
**Backend-for-Frontend**: os tokens ficam criptografados em um cookie httpOnly e
nunca chegam ao JavaScript do browser. A API valida o JWT contra o JWKS do realm
e autoriza por permissão (`@RequirePermission('plano:write')`).

Detalhes em **[docs/autenticacao.md](docs/autenticacao.md)**; visão geral do
projeto para quem está chegando (ou para um LLM) em **[AGENTS.md](AGENTS.md)**.

## Scripts (raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Sobe todos os apps em modo dev (turbo) |
| `pnpm build` | Builda todos os apps |
| `pnpm lint` | Linta todos os apps |
| `pnpm test` | Roda testes |
| `pnpm smoke:login` | Percorre o fluxo de login inteiro sem browser |
| `pnpm kc:import` | Reimporta o realm em um Keycloak já rodando |
| `pnpm infra:up` / `infra:down` | Sobe / derruba a infra Docker |
| `pnpm infra:logs` | Acompanha os logs da infra |

Filtrar por app: `pnpm --filter api <script>` ou `pnpm --filter web <script>`.

> **Portas:** a `web` fica na `3000` e a `api` na `3001` (o `main.ts` da API lê `process.env.PORT` com
> fallback `3001`), então não há conflito entre os dois.

> **Nota:** para um app entrar no `pnpm dev`, ele precisa ter um script chamado **`dev`** no seu
> `package.json` — o `turbo run dev` ignora silenciosamente quem não tiver, sem erro nenhum.


### Users for development

usuário	senha	papéis
admin.teste	admin123	admin
coord.teste	coord123	coordenador, docente
docente.teste	docente123	docente