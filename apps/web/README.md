# web — gerenciador (frontend)

Frontend do sistema **gerenciador**, construído com [Next.js 16](https://nextjs.org) (App Router),
React 19 e [Tailwind CSS 4](https://tailwindcss.com). Faz parte do monorepo — veja o
[README da raiz](../../README.md) para a visão geral.

> **Atenção:** esta versão do Next.js tem mudanças de API em relação a versões anteriores. Consulte a
> documentação que acompanha o pacote em `node_modules/next/dist/docs/` antes de codar — veja
> [AGENTS.md](AGENTS.md).

## Pré-requisitos

- Dependências instaladas a partir da **raiz** do monorepo: `pnpm install`
- Infra no ar (Keycloak): `pnpm infra:up` (a partir da raiz)
- Ambiente configurado: `cp .env.example .env.local` — o app **não sobe** com
  ambiente incompleto ([src/lib/env.ts](src/lib/env.ts) valida com zod)

## Como rodar

A partir da **raiz** do monorepo (recomendado):

```bash
pnpm --filter web dev       # dev server -> http://localhost:3000
pnpm --filter web build     # build de produção -> .next/
pnpm --filter web start     # serve o build
```

Ou tudo de uma vez (api + web) via turbo: `pnpm dev`.

> **Porta:** o Next sobe em `http://localhost:3000` por padrão. Como o Nest usa a mesma porta, a
> convenção do monorepo é manter a **web em 3000** e subir a **api em 3001**. Para trocar:
> `pnpm --filter web dev --port 3002` ou `PORT=3002 pnpm --filter web dev`.

## Estrutura

```
src/
├─ proxy.ts             # checagem otimista de sessão (era middleware.ts no Next 15)
├─ lib/
│  ├─ env.ts            #   `server-only`: ambiente validado com zod
│  ├─ session.ts        #   sessão selada em JWE, fatiada em cookies
│  ├─ auth-transaction.ts #  state/nonce/PKCE do login em andamento
│  ├─ oidc.ts           #   cliente openid-client (discovery)
│  ├─ auth.ts           #   getSession / requireSession / renovação
│  ├─ api.ts            #   apiFetch — chama a API com o Bearer
│  ├─ acao.ts           #   `server-only`: envio e tradução de erro das ações
│  ├─ acao-tipos.ts     #   contrato das ações — este SIM pode ir ao cliente
│  ├─ dominio.ts        #   espelho dos tipos que a API devolve
│  ├─ formato.ts        #   moeda, percentual, rótulos, somarMoeda (BigInt)
│  └─ navegacao.ts      #   menu, incluindo os módulos que ainda não existem
├─ acoes/               # Server Actions: ppgs, plano, pendencias
├─ componentes/
│  ├─ layout/           #   menu lateral, sub-nav do ciclo, troca de tema
│  ├─ ui/               #   sidesheet, multistep, campos, tabela, cartão, selo
│  └─ formularios/      #   os cadastros que vão dentro do sidesheet
└─ app/
   ├─ layout.tsx        # root layout (fontes Geist, globals.css, script de tema)
   ├─ globals.css       # Tailwind + design tokens
   ├─ login/page.tsx    # tela de entrada — única rota pública
   ├─ api/auth/…        # login, callback e logout (fluxo OIDC)
   ├─ api/bff/[...path] # proxy do browser para a API, injetando o token
   └─ (app)/            # tudo que exige login; o shell mora no layout do grupo
      ├─ page.tsx                 #   P01 painel executivo
      ├─ programas/               #   P05 e as telas do ciclo (P06–P10, P17)
      ├─ ppgs/                    #   P14 lista e detalhe
      ├─ pendencias/              #   P13
      ├─ catalogos/               #   P15 e P23
      └─ configuracoes/           #   conta, papéis e permissões
public/                 # assets estáticos servidos na raiz da URL
```

> **`lib/acao.ts` é `server-only`; `lib/acao-tipos.ts` não.** Client Component
> que precise de `ESTADO_INICIAL` importa do segundo. Importar o primeiro do
> cliente quebra o build de propósito — é o que impede `apiFetch`, e com ele o
> caminho do token, de entrar no bundle do browser.

Roteamento é por **App Router**: cada diretório em `src/app/` vira um segmento de rota, e arquivos
especiais (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) definem o comportamento do segmento.

> **`middleware.ts` não existe mais no Next 16** — o arquivo equivalente é
> [src/proxy.ts](src/proxy.ts), e a função exportada se chama `proxy`.

## Estilos

Tailwind CSS 4 via plugin PostCSS ([postcss.config.mjs](postcss.config.mjs)) — não existe
`tailwind.config.js`. A configuração fica no próprio CSS, em
[src/app/globals.css](src/app/globals.css):

- `@import "tailwindcss";` carrega o framework
- `@theme inline { ... }` declara os design tokens (cores, fontes) como variáveis do tema

As fontes **Geist** e **Geist Mono** são carregadas por `next/font/google` no root layout e expostas
como `--font-geist-sans` / `--font-geist-mono`.

## Tema e cores

A paleta institucional é **verde floresta**, com tema claro e escuro. Use sempre o **nome semântico**
do token, nunca o hex — assim o dark mode funciona de graça:

```jsx
<div className="bg-surface text-foreground border border-border">
  <button className="bg-primary text-on-primary hover:bg-primary-hover">Salvar</button>
</div>
```

Convenção dos nomes: `on-X` é a cor de texto/ícone que deve ser usada **sobre** o fundo `X`
(`text-on-primary` sobre `bg-primary`). Os tokens de status têm as duas variantes — sólida
(`bg-danger` + `text-on-danger`) e suave (`bg-danger-soft` + `text-on-danger-soft`).

> **Sucesso não é o verde da marca.** O verde floresta é reservado para marca e ação principal;
> "sucesso" usa um teal (`--success`) para os dois não se confundirem em telas cheias de status.

Os pares de cor foram verificados contra a **WCAG 2.1**: texto normal ≥ 4.5:1 (AA), texto principal
≥ 7:1 (AAA), e bordas de input/anel de foco ≥ 3:1 (critério 1.4.11). Ao criar um token novo, verifique
o contraste antes de usar.

### Claro / escuro

O tema é controlado pelo atributo `data-theme` no `<html>`, não por `prefers-color-scheme` direto:

- [theme-toggle.tsx](src/app/theme-toggle.tsx) — seletor Claro / Escuro / **Sistema**, persistido em
  `localStorage` e sincronizado entre abas. Em "Sistema", acompanha mudanças do SO em tempo real.
- [layout.tsx](src/app/layout.tsx) — script inline no `<head>` que aplica o tema salvo **antes da
  primeira pintura**, evitando flash branco no reload. Por isso o `<html>` tem `suppressHydrationWarning`.
- [globals.css](src/app/globals.css) — `@custom-variant dark` faz o prefixo `dark:` do Tailwind
  responder ao `data-theme`, para os casos pontuais em que um token semântico não resolve.

A rota `/` é hoje uma página de demonstração da paleta — sirva-se dela para conferir os tokens e
substitua quando começar a construir as telas de verdade.

## Scripts úteis

| Script | Ação |
|---|---|
| `dev` | Dev server com hot-reload |
| `build` | Build de produção em `.next/` |
| `start` | Serve o build de produção |
| `lint` | ESLint (`eslint-config-next`) |

## Autenticação — este app é o BFF

O Next não é só a interface: ele é o **Backend-for-Frontend** da autenticação.
Faz a troca do `code` por tokens no servidor (client *confidencial*, com secret) e
guarda o resultado criptografado em cookie httpOnly. **O JavaScript do browser
nunca recebe um token.**

Como buscar dados da API, conforme o contexto:

```ts
// Server Component / Server Action — direto, sem salto HTTP extra
import { apiFetch } from "@/lib/api";
const me = await apiFetch<Me>("/me");

// Página protegida — redireciona para /login se não houver sessão
import { requireSession } from "@/lib/auth";
const session = await requireSession();
```

```ts
// Client Component — passa pelo proxy, que injeta o Bearer no servidor
const res = await fetch("/api/bff/me");
```

Regras que não podem ser quebradas:

- **Nada de `NEXT_PUBLIC_`** nas variáveis de auth. `src/lib/env.ts` usa
  `server-only`; importá-lo de um Client Component quebra o build de propósito.
- **Não exponha o access token para o cliente**, nem via prop de Server Component.
  Se uma tela precisar de dados da API no browser, use `/api/bff/*`.
- A UI pode esconder botões conforme `permissions`, mas quem **decide** é o guard
  da API. Esconder não é autorizar.

Arquitetura completa em [docs/autenticacao.md](../../docs/autenticacao.md).

> **Nota:** ainda restam sobras do `create-next-app` — os SVGs de exemplo em `public/`
> (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) não são usados e podem ser apagados.
