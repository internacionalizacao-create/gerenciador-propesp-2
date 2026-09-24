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

Código em [src/auth/](src/auth); catálogo de permissões em
[src/auth/autorizacao-v1/catalogo.ts](src/auth/autorizacao-v1/catalogo.ts) — papel
do Keycloak não concede nada; quem concede são as concessões da aplicação;
arquitetura completa em
[docs/autenticacao.md](../../docs/autenticacao.md).

### Endpoints atuais

O [inventário de rotas e autorização](../../docs/contrato-autorizacao-v1.md#inventário-de-rotas)
lista cada endpoint, seu decorador e as regras de alcance. O teste
`src/auth/inventario-rotas.spec.ts` confere essa tabela contra os metadados dos
controllers em cada execução de `pnpm test`.

O endereço carrega slug e nome de ciclo (`/programas/capes-global/2027-2030`) em
vez de UUID: dá para ler a URL e saber de que ciclo se trata, o que importa
quando um número é conferido contra um relatório impresso.

### Testes

`pnpm test` roda em **modo ESM** (`jest.config.mjs`), porque `jose` é ESM-only.
Dentro de um teste, `jest` não é global: `import { jest } from '@jest/globals'`.
