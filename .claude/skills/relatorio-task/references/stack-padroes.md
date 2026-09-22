# Padrões da stack — consulte antes de recomendar

Referência para o Modo 2 (decisão técnica). Duas seções: o que **já está decidido
aqui** (não reabrir sem motivo novo) e como avaliar o que **ainda não está**.

O `AGENTS.md` da raiz é a fonte da verdade. Este arquivo é o atalho; quando os
dois divergirem, o AGENTS.md vence.

---

## 1. Decisões fechadas neste repositório

Recomendar o contrário disto é reabrir discussão encerrada. Se for mesmo
necessário, diga explicitamente que contraria a decisão vigente e por quê.

| Tema | Decisão | Onde |
|---|---|---|
| Token no browser | **BFF**: cookie httpOnly com JWE, fatiado em `gr_session.N`. O JS da página nunca vê token. | `apps/web/src/lib/session.ts` |
| Cliente OIDC | `openid-client` direto, não Auth.js/NextAuth | `apps/web/src/lib/oidc.ts` |
| Login | Hospedado no Keycloak (Authorization Code + PKCE). Nenhuma senha passa por este código. | `app/api/auth/*` |
| Autorização | Concessão individual em `concessao_acesso` (ação + alvo), resolvida por requisição, **sem cache**. Papel do Keycloak não concede nada. | `apps/api/src/auth/autorizacao-v1/` |
| Recorte | Sempre **na consulta SQL**, nunca filtragem em memória. Fora do alcance responde **404**, não 403. | `alcance.ts`, `recorte-bolsa.ts` |
| Validação | **zod** em toda fronteira. Não usar `class-validator`. | `zod-validation.pipe.ts` |
| Formulário | React Hook Form + zodResolver; schema do cliente em `lib/formularios/` | §8 do AGENTS.md |
| Busca no browser | TanStack Query **só depois da primeira pintura**; carga inicial é Server Component com `apiFetch` | `lib/bff.ts` |
| Gráficos | Recharts, cor como `var(--token)` no SVG. MUI e Emotion foram removidos. | `ui/grafico.tsx` |
| CORS na API | **Desligado de propósito** — o browser nunca fala com a API direto | §7 |
| Dinheiro | Centavos com `BigInt` (`somarMoeda`). Nunca `number` antes de uma conta. Nulo é *A definir*, nunca R$ 0,00. | `lib/formato.ts` |
| Derivados | Nada persistido: cálculo é SQL na leitura (RN-01..RN-20) | `dominio/` |
| Middleware Next | É `proxy.ts` (Next 16), não `middleware.ts` | `apps/web/src/proxy.ts` |
| Build | Offline: fontes vêm do pacote `geist`, não de `next/font/google` | `test/fontes.test.mjs` |
| Integração externa | **Não existe sincronização com a CAPES.** O sistema confia no que o usuário registra. | §1 |

## 2. Armadilhas que já custaram caro (cite ao recomendar)

- **Turborepo em `envMode: "strict"`** — variável não declarada em `turbo.json`
  some; o build quebra só no CI.
- **`jose` e `openid-client` são ESM-only** — a suíte da API roda em modo ESM;
  em teste, `import { jest } from '@jest/globals'`.
- **`sql` cru do Drizzle emite coluna interpolada sem o nome da tabela** — em
  subconsulta correlacionada a condição vira sempre `false`, em silêncio.
- **Helper exportado de módulo `"use client"`** não pode ser chamado por Server
  Component: build passa, página responde 500.
- **Todo `catch` em volta de `apiFetch` precisa de `unstable_rethrow`** —
  `redirect()` sinaliza por exceção.
- **`revalidatePath` precisa da rota real**, com os segmentos dinâmicos.
- **Permissão nova exige cinco passos** (catálogo, guard, contrato, modelo,
  `exige` no menu + porta da página). Pular o quinto produz tela visível que a
  API recusa, ou tela invisível para quem pode.

## 3. Como avaliar o que ainda não está decidido

Ordem de desempate: **segurança > escalabilidade > padrão de mercado > esforço**.

Perguntas que costumam decidir antes da tabela:

1. **O dado é pessoal?** CPF, e-mail, telefone e documento pessoal têm
   capacidade própria e não saem no JSON sem alcance. Qualquer opção que os
   exponha perde em segurança, e acabou a comparação.
2. **A opção move o recorte para fora do SQL?** Se sim, é não — é a regra que o
   §6 existe para proteger.
3. **Sobrevive a múltiplas instâncias?** Estado em memória do processo (cache de
   permissão, fila em variável, `QueryClient` em módulo) não sobrevive, e o
   último já causou vazamento de cache entre usuários.
4. **Precisa de internet no build?** Se sim, perde: o alvo é intranet.
5. **Cria segunda origem para o mesmo número?** Duas consultas que respondem à
   mesma pergunta divergem na primeira mudança. Reuse a função existente.
6. **Acrescenta dependência?** O repositório já removeu MUI, Emotion e
   `exceljs` por peso. Dependência nova precisa de justificativa que a cópia de
   componente (padrão shadcn) não atenda.

Quando não souber o que o mercado usa hoje para algo específico, escreva
**"a confirmar"** na coluna Mercado. Não invente consenso.

## 4. Verificação a citar em "Próximo passo"

```bash
pnpm lint && pnpm build && pnpm test   # sempre
pnpm --filter api test:int             # tocou SQL, schema ou permissão
pnpm smoke:telas                       # tocou página (exige seed --com-dados)
pnpm smoke:acesso                       # tocou recorte ou concessão
pnpm test:e2e                          # tocou formulário ou jornada completa
```
