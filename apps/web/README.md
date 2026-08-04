# web — gerenciador (frontend)

Frontend do sistema **gerenciador**, construído com [Next.js 16](https://nextjs.org) (App Router),
React 19 e [Tailwind CSS 4](https://tailwindcss.com). Faz parte do monorepo — veja o
[README da raiz](../../README.md) para a visão geral.

> **Atenção:** esta versão do Next.js tem mudanças de API em relação a versões anteriores. Consulte a
> documentação que acompanha o pacote em `node_modules/next/dist/docs/` antes de codar — veja
> [AGENTS.md](AGENTS.md).

## Pré-requisitos

- Dependências instaladas a partir da **raiz** do monorepo: `pnpm install`

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
src/app/
├─ layout.tsx      # root layout (fontes Geist + globals.css)
├─ page.tsx        # rota "/"
├─ globals.css     # Tailwind + design tokens
└─ favicon.ico
public/            # assets estáticos servidos na raiz da URL
```

Roteamento é por **App Router**: cada diretório em `src/app/` vira um segmento de rota, e arquivos
especiais (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) definem o comportamento do segmento.

## Estilos

Tailwind CSS 4 via plugin PostCSS ([postcss.config.mjs](postcss.config.mjs)) — não existe
`tailwind.config.js`. A configuração fica no próprio CSS, em
[src/app/globals.css](src/app/globals.css):

- `@import "tailwindcss";` carrega o framework
- `@theme inline { ... }` declara os design tokens (cores, fontes) como variáveis do tema
- as cores respeitam `prefers-color-scheme` (tema claro/escuro) via `:root`

As fontes **Geist** e **Geist Mono** são carregadas por `next/font/google` no root layout e expostas
como `--font-geist-sans` / `--font-geist-mono`.

## Scripts úteis

| Script | Ação |
|---|---|
| `dev` | Dev server com hot-reload |
| `build` | Build de produção em `.next/` |
| `start` | Serve o build de produção |
| `lint` | ESLint (`eslint-config-next`) |

## SSO (Keycloak)

A web deve autenticar contra o Keycloak (client público, fluxo *authorization code* + PKCE) e enviar o
access token para a API. A infra do Keycloak já está pronta em
[infra/](../../infra/README.md); a integração em código fica para depois.

> **Nota:** este é o scaffold inicial do `create-next-app` — a home de exemplo (`page.tsx`), os SVGs em
> `public/` e o `metadata` ("Create Next App") em `layout.tsx` serão limpos antes de codar.
