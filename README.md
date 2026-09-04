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
- ngrok CLI autenticado (somente para compartilhar o ambiente local)

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

Comece pela **[arquitetura do sistema](docs/arquitetura-sistema.md)** para entender
o negócio, os componentes e os principais fluxos. Detalhes de login ficam em
**[docs/autenticacao.md](docs/autenticacao.md)**; convenções e estado atual do
projeto para quem vai alterar o código ficam em **[AGENTS.md](AGENTS.md)**.

## Scripts (raiz)

| Comando | Ação |
|---|---|
| `pnpm dev` | Sobe todos os apps em modo dev (turbo) |
| `pnpm build` | Builda todos os apps |
| `pnpm lint` | Linta todos os apps |
| `pnpm test` | Roda testes |
| `pnpm smoke:login` | Percorre o fluxo de login inteiro sem browser |
| `pnpm ngrok:demo` | Sobe o demo em portas próprias e publica uma URL HTTPS pelo ngrok |
| `pnpm kc:import` | Reimporta o realm em um Keycloak já rodando |
| `pnpm infra:up` / `infra:down` | Sobe / derruba a infra Docker |
| `pnpm infra:logs` | Acompanha os logs da infra |

Filtrar por app: `pnpm --filter api <script>` ou `pnpm --filter web <script>`.

> **Portas:** a `web` fica na `3000` e a `api` na `3001` (o `main.ts` da API lê `process.env.PORT` com
> fallback `3001`), então não há conflito entre os dois.

> **Nota:** para um app entrar no `pnpm dev`, ele precisa ter um script chamado **`dev`** no seu
> `package.json` — o `turbo run dev` ignora silenciosamente quem não tiver, sem erro nenhum.

### Compartilhar o ambiente para testes

Com o ambiente local configurado, o CLI autenticado (`ngrok config check`) e
qualquer `pnpm dev` anterior encerrado, rode:

```bash
pnpm ngrok:demo
```

O comando sobe a API em `3333`, a web em `3334`, o Keycloak em `8888` e usa
`3335` como gateway local do túnel. Ele aplica as migrations e imprime uma única
URL HTTPS. Essa URL atende tanto a aplicação quanto o login hospedado no
Keycloak; API e bancos não são publicados. Os mesmos usuários, papéis e dados do
ambiente local são usados — para acesso total ao app, use o usuário de teste
`admin`. Mantenha o terminal aberto e pressione `Ctrl+C` para derrubar o túnel e
restaurar o Keycloak local na porta `8080`.

Se sua conta tiver mais de um domínio, é possível escolher o endpoint:

```bash
NGROK_URL=https://seu-dominio.ngrok-free.app pnpm ngrok:demo
```

Não use esse comando como hospedagem de produção: ele publica o banco de
desenvolvimento por meio da aplicação e os usuários de teste continuam válidos.

### Users for development

usuário	senha	papéis
admin	admin123	admin (+ realm-admin do client realm-management)
coord.teste	coord123	coordenador, docente
docente.teste	docente123	docente
secretaria.teste	secretaria123	secretaria
discente.teste	discente123	discente
