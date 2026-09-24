# Autenticação e autorização

Como o login funciona neste sistema, o que cada decisão está defendendo, e o que
ainda falta. Complementa o resumo em [AGENTS.md](../AGENTS.md) §5.

---

## 1. As três peças

| Peça | Papel | Onde |
|---|---|---|
| **Keycloak** | Autentica. É o único que vê a senha. Emite tokens. | container Docker, realm `gerenciador` |
| **Next.js** | *Backend-for-Frontend*: guarda os tokens, renova, e fala com a API em nome do usuário. Também renderiza a interface. | [apps/web](../apps/web) |
| **NestJS** | *Resource server*: valida o token e decide o que cada um pode. | [apps/api](../apps/api) |

O ponto que organiza tudo: **o browser nunca recebe um token.** Ele recebe um
cookie criptografado que só o servidor do Next sabe abrir.

---

## 2. O fluxo de login, passo a passo

```
 Browser              Next (BFF)                  Keycloak              API
    │                     │                          │                   │
    │ GET /pendencias     │                          │                   │
    ├────────────────────►│ proxy.ts: sem sessão     │                   │
    │◄────────────────────┤ 307 /login?returnTo=…    │                   │
    │                     │                          │                   │
    │ clica "Entrar"      │                          │                   │
    ├────────────────────►│ GET /api/auth/login      │                   │
    │                     │ gera state, nonce,       │                   │
    │                     │ code_verifier            │                   │
    │◄────────────────────┤ 307 + cookie gr_auth_tx  │                   │
    │                                                │                   │
    │ tela de login (usuário digita a senha AQUI)    │                   │
    ├───────────────────────────────────────────────►│                   │
    │◄───────────────────────────────────────────────┤ 302 …?code=&state=│
    │                     │                          │                   │
    ├────────────────────►│ GET /api/auth/callback   │                   │
    │                     │ confere state,           │                   │
    │                     │ troca code+verifier ────►│                   │
    │                     │◄──── access/refresh/id ──┤                   │
    │                     │ confere nonce, sela JWE  │                   │
    │◄────────────────────┤ 307 /pendencias          │                   │
    │                     │  + gr_session.0/.1       │                   │
    │                     │                          │                   │
    │ GET /pendencias     │                          │                   │
    ├────────────────────►│ abre a sessão            │                   │
    │                     │ GET /me ─────────────────┼──────────────────►│
    │                     │   Authorization: Bearer  │  valida via JWKS  │
    │                     │◄─────────────────────────┼───────────────────┤
    │◄────────────────────┤ HTML pronto              │                   │
```

Arquivos: [login/route.ts](../apps/web/src/app/api/auth/login/route.ts),
[callback/route.ts](../apps/web/src/app/api/auth/callback/route.ts),
[proxy.ts](../apps/web/src/proxy.ts).

---

## 3. O que cada proteção está impedindo

| Mecanismo | Ataque que ele bloqueia |
|---|---|
| **PKCE (S256)** | Interceptar o `code` na volta e trocá-lo por token. Sem o `code_verifier` — que ficou no cookie — o `code` sozinho não vale nada. |
| **`state`** | Um site hostil forçar o browser a completar um login com a conta *do atacante* (CSRF de login). O `state` amarra a resposta à requisição que o gerou. |
| **`nonce`** | Reapresentar um ID token capturado antes. |
| **Cookie httpOnly + JWE** | XSS roubar credencial. O JS não lê o cookie, e mesmo que lesse, o conteúdo é cifrado. |
| **`SameSite=Lax`** | POST vindo de outro site carregar o cookie de sessão (CSRF). |
| **Conferência de `Origin`** em `/api/bff/*` | O mesmo, para browsers antigos — segunda tranca. |
| **`aud` obrigatório na API** | Reaproveitar aqui um token emitido para outro serviço do mesmo realm. |
| **`iss` obrigatório** | Token de outro realm/servidor. |
| **`algorithms: ['RS256']`** fixo | Token `alg: none` ou assinado com HMAC usando a chave pública como segredo. |
| **Checagem de `typ !== 'Bearer'`** | Usar o `id_token` (assinado pelo mesmo realm, passa em tudo mais) como credencial de acesso. |
| **Logout via POST** | `<img src="/api/auth/logout">` em qualquer página deslogar o usuário. |
| **`returnTo` normalizado** | Transformar o login em redirecionador aberto (`?returnTo=https://site-falso`). |
| **`__Host-` no nome do cookie** (quando há HTTPS) | Subdomínio comprometido sobrescrever a sessão. |

Os quatro últimos itens da validação de token têm teste dedicado em
[token-verifier.service.spec.ts](../apps/api/src/auth/token-verifier.service.spec.ts).

---

## 4. A sessão

Conteúdo: `access_token`, `refresh_token`, `id_token`, `expiresAt` e um resumo do
usuário. Selado como **JWE compacto** (`dir` + `A256GCM`) com a `SESSION_SECRET`,
em [session.ts](../apps/web/src/lib/session.ts).

Dois detalhes que não são óbvios:

**Fatiamento.** A sessão selada passa de 4600 bytes e o limite prático de um
cookie é ~4 KB. Ela é cortada em `gr_session.0`, `gr_session.1`, … e remontada na
leitura. Sobras de uma sessão anterior mais longa são apagadas na escrita — se não
fossem, seriam concatenadas na próxima leitura e corromperiam o texto cifrado.

**Renovação.** O access token dura 5 minutos. `getSession()` renova sozinho quando
faltam menos de 30 segundos. Em Server Component o cookie é somente leitura, então
a gravação falha em silêncio de propósito: a sessão renovada vale para aquele
render, e a próxima navegação (que passa por `proxy.ts` ou por um Route Handler)
consegue persistir.

Ciclo de vida: access token 5 min · sessão SSO ociosa 30 min · máximo 10 h ·
cookie 8 h (deliberadamente menor que o máximo do SSO).

**Expiração.** O cookie durar 8 h não quer dizer que a sessão viva 8 h: os
tokens de dentro morrem antes, e o envelope selado continua íntegro. Três peças
garantem que isso termine no login, e não num erro de renderização:

1. O Keycloak informa `refresh_expires_in` (o ocioso do SSO), guardado como
   `refreshExpiresAt`. Passado esse instante, renovar não tem como dar certo —
   o `proxy.ts` corta antes de renderizar, **sem chamada de rede**, e apaga o
   cookie morto, que de outro modo repetiria o caminho a cada navegação.
2. `apiFetch` manda para o login quando não há sessão ou quando a API responde
   **401** (token dentro da validade, mas já invalidado — logout no console,
   revogação, realm recriado). Antes ele lançava um erro que ninguém tratava.
3. `app/(app)/error.tsx` é a rede embaixo das duas, para o que sobrar.

O ponto que tornava isso um erro de tela: **layout e página renderizam em
paralelo**. O `requireSession()` do layout redirecionava, mas a página já tinha
chamado a API e estourado antes — e o projeto não tinha nenhum `error.tsx`.
Hoje os dois terminam em `irParaLogin()`
([sessao-encerrada.ts](../apps/web/src/lib/sessao-encerrada.ts)), que preserva o
`returnTo` a partir do cabeçalho que o proxy injeta. **Todo `catch` em volta de
`apiFetch` precisa de `unstable_rethrow`**: `redirect()` sinaliza por exceção, e
engoli-la traz o erro de volta.

No browser, `lib/bff.ts` faz o equivalente: 401 vindo de `/api/bff/*` leva para
o login em vez de virar "não foi possível atualizar a lista".

---

## 5. Do papel à permissão

A API valida o token localmente contra o JWKS do realm — sem `introspection`, sem
uma chamada de rede por requisição. O preço: revogar um usuário no Keycloak só faz
efeito quando o access token expira. Por isso o realm emite tokens de 5 minutos.

```
token: realm_access.roles = ["coordenador", "docente", "offline_access"]
   │
   │ permissionsForRoles()        <- único ponto de tradução
   ▼
AuthUser.permissions = ["plano:read", "plano:write", "orcamento:read", …]
   │
   │ PermissionsGuard             <- lê @RequirePermission do handler
   ▼
200 ou 403
```

Ambos os guards são **globais** ([auth.module.ts](../apps/api/src/auth/auth.module.ts)):
o padrão de todo endpoint é "exige login". Abrir um endpoint exige escrever
`@Public()` — um ato visível no diff. O inverso (esquecer de proteger) não seria.

Papel do Keycloak não concede nada: o catálogo de ações está em
[catalogo.ts](../apps/api/src/auth/autorizacao-v1/catalogo.ts), e quem as concede
são as concessões da aplicação. Instruções para estender:
[AGENTS.md](../AGENTS.md) §6.

---

## 6. Verificando que ainda funciona

```bash
pnpm smoke:login                            # coord.teste — espera 200 no restrito
pnpm smoke:login docente.teste docente123   # espera 403 no restrito
pnpm --filter api test                      # 18 testes de auth
```

O smoke test percorre o login inteiro sem browser e confere, entre outras coisas,
que o corpo do cookie não contém nenhum trecho de texto legível — a verificação
concreta de que o token não vaza para o cliente.

---

## 7. Limitações conhecidas

- **Papéis são globais.** `coordenador` não é "coordenador do PPGE". Quando o
  escopo por programa entrar, `permissionsForRoles` deixa de bastar: a decisão
  passará a depender do recurso, não só do usuário. O desenho já isola isso em uma
  função, mas a assinatura vai mudar.
- **Revogação leva até 5 minutos.** Consequência aceita da validação local. Se
  algum dia precisar ser imediato, o caminho é *back-channel logout* do Keycloak
  ou uma lista de sessões revogadas consultada pela API.
- **Sem persistência de usuário.** Não há tabela local ligada ao `sub`. Assim que
  houver, decidir o provisionamento (JIT no primeiro login é o usual).
- **Corrida na renovação.** Duas requisições simultâneas com o token vencendo
  podem renovar em paralelo. Hoje é inofensivo porque o realm não rotaciona
  refresh token; se `revokeRefreshToken` for ligado, uma das duas perde a sessão.
- **Sem back-channel logout.** Logout feito direto no console do Keycloak não
  apaga o cookie aqui; a sessão só cai na próxima tentativa de renovação — ou
  no primeiro 401 da API, que desde 2026-09-11 leva ao login em vez de virar
  erro de tela (§4).
- **Nada disso está pronto para produção**: HTTPS, segredos fora do repositório,
  Keycloak em modo `start`, e revisão das durações de sessão continuam pendentes.
