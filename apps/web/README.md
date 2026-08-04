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
├─ layout.tsx        # root layout (fontes Geist, globals.css, script de tema)
├─ page.tsx          # rota "/" — demonstração da paleta
├─ theme-toggle.tsx  # seletor claro/escuro/sistema (client component)
├─ globals.css       # Tailwind + design tokens
└─ favicon.ico
public/              # assets estáticos servidos na raiz da URL
```

Roteamento é por **App Router**: cada diretório em `src/app/` vira um segmento de rota, e arquivos
especiais (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`) definem o comportamento do segmento.

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

## SSO (Keycloak)

A web deve autenticar contra o Keycloak (client público, fluxo *authorization code* + PKCE) e enviar o
access token para a API. A infra do Keycloak já está pronta em
[infra/](../../infra/README.md); a integração em código fica para depois.

> **Nota:** ainda restam sobras do `create-next-app` — os SVGs de exemplo em `public/`
> (`next.svg`, `vercel.svg`, `file.svg`, `globe.svg`, `window.svg`) não são usados e podem ser apagados.
