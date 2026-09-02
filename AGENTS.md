# Gerenciador PROPESP — contexto do projeto

Documento de referência para quem (pessoa ou LLM) vai mexer neste repositório sem
tê-lo escrito. Descreve o que existe hoje, por que está assim, e o que ainda não
existe. **Mantenha-o atualizado quando mudar arquitetura ou convenção.**

Última revisão: 2026-09-01.

---

## 1. O que é o sistema

Sistema de gestão da PROPESP (Pró-Reitoria de Pesquisa e Pós-Graduação) para o
PPGE e demais programas de pós-graduação, com foco no planejamento de recursos
de internacionalização: bolsas, orçamento por rede e área temática, mobilidade
IN/OUT e resultados individuais. Uso institucional, dados pessoais de alunos e servidores — o
que justifica o rigor na parte de autenticação/autorização.

**Estado atual: o núcleo de planejamento está de pé.** Autenticação, modelo de
dados com a seed real, serviços de cálculo (RN-01 a RN-20), telas de planejamento
anual e o cadastro individual de bolsas/produtos existem e são verificados. As planilhas
não fornecem beneficiários, então P03 começa vazio e será alimentado pela equipe.
No CAPES Global não há execução financeira na UEA: a CAPES paga diretamente. Falta
o registro histórico de movimentações externas, as missões do Comitê Gestor,
documentos, relatórios, panorama/mapa de mobilidade e o escopo local por
PPG/temática na autorização. Ver §9.

A visão de arquitetura e os fluxos de negócio/técnicos estão em
[docs/arquitetura-sistema.md](docs/arquitetura-sistema.md). A especificação
funcional completa, com as 23 páginas previstas, está em
[system-structl.md](system-structl.md).

---

## 2. Stack e versões

| Peça | Versão | Observação |
|---|---|---|
| Node | 24.13.0 | fixado em [.nvmrc](.nvmrc) — rode `nvm use` |
| pnpm | 11.x | workspaces; lockfile único na raiz |
| Turborepo | 2.x | orquestra `dev`/`build`/`lint`/`test` |
| Next.js | **16.2.12** | App Router, Turbopack, React 19.2.4 |
| NestJS | 11.x | Express, TypeScript, CommonJS |
| Keycloak | 26.7.0 | container Docker, modo `start-dev` |
| PostgreSQL | 17 | dois bancos: um do Keycloak e um com os dados de domínio da API |
| Tailwind CSS | 4.x | tokens semânticos, ver §8 |
| MUI X Charts | 9.x Community | visualizações; `@mui/material` e Emotion são apenas dependências de integração |
| React Hook Form | 7.x | estado e validação dos formulários novos, integrado ao Zod 4 por `@hookform/resolvers` |

### Armadilhas de versão (leia antes de escrever código)

1. **`middleware.ts` não existe mais no Next 16 — virou `proxy.ts`.** O arquivo
   está em [apps/web/src/proxy.ts](apps/web/src/proxy.ts) e exporta uma função
   chamada `proxy`. O build lista isso como `ƒ Proxy (Middleware)`.
2. **`apps/web/AGENTS.md` avisa que este Next diverge do que os modelos
   aprenderam.** Antes de usar qualquer API do Next, confira em
   `node_modules/next/dist/docs/` (a documentação vem dentro do pacote).
3. **`jose` e `openid-client` são ESM-only.** O Node 24 dá `require()` em ESM sem
   reclamar, mas o runtime de módulos do Jest não. Por isso a suíte da API roda
   em modo ESM — ver [apps/api/jest.config.mjs](apps/api/jest.config.mjs). Em
   testes, `jest` não é global: `import { jest } from '@jest/globals'`.
4. **Zod 4**: use `z.url()` e `z.email()` no lugar de `z.string().url()`.
5. **Turborepo 2 roda em `envMode: "strict"`.** Variável de ambiente que não
   estiver declarada em `env`/`globalEnv`/`passThroughEnv` é apagada antes da
   task rodar, mesmo definida no shell. As variáveis do BFF estão em
   [apps/web/turbo.json](apps/web/turbo.json); ao acrescentar uma em
   `lib/env.ts`, acrescente lá também. O sintoma é build que só quebra no CI:
   na máquina de quem desenvolve o Next lê `apps/web/.env.local` do disco e
   nunca depende do que o turbo repassou.

---

## 3. Mapa do repositório

```
apps/
  api/                     NestJS — resource server OAuth2
    src/
      auth/                autenticação e autorização
        auth-user.ts          claims do token -> AuthUser (schema zod)
        auth.decorators.ts    @Public, @RequirePermission, @CurrentUser
        auth.module.ts        registra os dois guards como globais
        jwt-auth.guard.ts     exige Bearer válido (global)
        permissions.ts        catálogo de permissões + mapa papel -> permissões
        permissions.guard.ts  aplica @RequirePermission (global)
        token-verifier.service.ts  valida o JWT contra o JWKS do realm
        me.controller.ts      GET /me e a sonda GET /me/exemplo-restrito
      comum/
        consultar.ts       envelope tipado para SQL cru
        zod-validation.pipe.ts  valida o corpo das requisições
      dominio/             planejamento, orçamento e governança
        contexto.service.ts   resolve programa + ciclo a partir da URL
        orcamento.service.ts  RN-04 a RN-09 em SQL (custo, saldo, divergência)
        painel.service.ts     P01 — indicadores, alertas, IN/OUT
        catalogo.service.ts   RN-01 — resolução de preço, recusa sem match
        plano.service.ts      P10 — três rubricas, edição e auditoria por campo
        bolsistas.service.ts  P03 — concessões, datas, alertas e produtos individuais
        ciclo.service.ts      P06/P07/P08/P17 e dados internos de premissas/fontes
        ppgs.service.ts       P14
        pendencias.service.ts P13
        comite-gestor.service.ts  P17 — pessoas e equipes
        missoes-comite.service.ts P17 — criação, consulta, edição, ciclo de vida e relato de missões
        *.controller.ts       rotas REST, uma permissão por endpoint
      config/env.ts        validação de ambiente com zod (falha no boot)
      database/            schema Drizzle, migrations e seed
      health/              GET /health (público)
  web/                     Next.js — BFF + interface
    src/
      lib/
        env.ts             ambiente validado, `server-only`
        session.ts         sessão selada em JWE, fatiada em cookies
        auth-transaction.ts state/nonce/PKCE do login em andamento
        oidc.ts            cliente openid-client (discovery)
        auth.ts            DAL: getSession / requireSession / renovarSessao
        api.ts             apiFetch — chama a API com o Bearer
        acao.ts            `server-only`: enviar/traduzirErro das Server Actions
        acao-tipos.ts      contrato das ações, importável do cliente
        dominio.ts         espelho dos tipos da API
        formato.ts         moeda, percentual, rótulos de enum, somarMoeda
        navegacao.ts       menu, incluindo o que ainda não existe
      acoes/               Server Actions (ppgs, plano, bolsistas, pendencias)
      componentes/
        layout/            menu lateral, sub-nav do ciclo, troca de tema
        ui/sidesheet.tsx   painel lateral sobre <dialog> nativo
        ui/multistep.tsx   formulário em etapas, tudo montado num <form> só
        ui/campos.tsx      inputs, chips, marcadores
        ui/basicos.tsx     Página, Seção, Cartão, Tabela, Moeda, Selo, Aviso
        ui/toast.tsx       feedback global de ações, com provider e hook
        formularios/       cadastros que vão dentro do sidesheet
      app/
        (app)/             tudo que exige login — o shell mora no layout
          page.tsx                    P01 painel executivo
          programas/                  P05 e as telas do ciclo (P06..P10, P17)
          ppgs/                       P14 lista e detalhe
          pendencias/                 P13
          catalogos/                  P15 e P23
          configuracoes/              conta, papéis e permissões
        api/auth/login|callback|logout/route.ts   fluxo OIDC
        api/bff/[...path]/route.ts                proxy browser -> API
        login/page.tsx     tela de entrada (única rota pública)
      proxy.ts             checagem otimista de sessão
infra/
  docker-compose.yml       keycloak + keycloak-db + api-db
  keycloak/
    import/gerenciador-realm.json   realm versionado (fonte da verdade)
    import-realm.sh                 reimporta em um Keycloak já rodando
packages/
  tsconfig/                base de TSConfig compartilhada
  eslint-config/           base de ESLint compartilhada
scripts/
  smoke-login.sh           percorre o login inteiro sem browser
  smoke-telas.sh           abre cada tela logado e confere os números
docs/
  autenticacao.md          detalhamento da arquitetura de auth
```

---

## 4. Como rodar

```bash
nvm use
pnpm install

# infra
cp infra/.env.example infra/.env
pnpm infra:up                  # keycloak (8080), keycloak-db (5433), api-db (5432)

# ambiente dos apps
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
# gere um SESSION_SECRET próprio:
#   openssl rand -base64 32 | tr '+/' '-_' | tr -d '='

pnpm dev                       # web:3000  api:3001
```

O realm `gerenciador` é importado sozinho no primeiro boot do Keycloak. Para
reaplicar o arquivo em um Keycloak já rodando: `pnpm kc:import --force`
(**apaga o realm e recria** — perde usuários e sessões criados pelo console).

### Usuários de teste (só no realm de desenvolvimento)

| usuário | senha | papéis |
|---|---|---|
| `admin` | `admin123` | `admin` (+ `realm-admin` do client `realm-management`) |
| `coord.teste` | `coord123` | `coordenador`, `docente` |
| `docente.teste` | `docente123` | `docente` |
| `secretaria.teste` | `secretaria123` | `secretaria` |
| `discente.teste` | `discente123` | `discente` |

Cobrem os cinco papéis que `permissionsForRoles`
([permissions.ts](apps/api/src/auth/permissions.ts)) já reconhece.

**Dois "admin" diferentes, não confundir:**

| | usuário / senha | onde loga | o que administra |
|---|---|---|---|
| **Admin do Keycloak** (bootstrap, do container) | `admin` / `admin` (`infra/.env`) | <http://localhost:8080>, realm `master` | Todos os realms — troque para `gerenciador` no seletor do console. |
| **Admin do realm `gerenciador`** (usuário acima) | `admin` / `admin123` | <http://localhost:3000> (app) **ou** <http://localhost:8080/admin/gerenciador/console> (console, só este realm) | Dentro do app: permissão total (`orcamento:write`, `catalogo:write` etc., via papel `admin` em [permissions.ts](apps/api/src/auth/permissions.ts)). No console: usuários, papéis, eventos e clients — só do realm `gerenciador`, por causa do papel `realm-admin` do client `realm-management`. |

São usuários diferentes em realms diferentes — só coincide o username `admin` e
a UI de login do Keycloak, por isso a confusão é fácil.

### O que mais o realm configura

- **Política de senha**: `length(8) and digits(1) and notUsername and notEmail`.
  Vale só para senha nova (troca ou reset) — as senhas dos usuários de teste
  acima já satisfazem e não são reavaliadas no import.
- **Locale**: pt-BR é o padrão da tela de login hospedada (Keycloak já traduz;
  não há tema customizado). Inglês continua disponível como alternativa.
- **"Lembrar-me"**: quando marcado, a sessão SSO do Keycloak dura até 7 dias
  ociosa / 30 dias no total, em vez do padrão (30 min / 10 h). Isso é a sessão
  do *Keycloak*, não a da aplicação — o cookie `gr_session` continua limitado a
  8h, ver [docs/autenticacao.md](docs/autenticacao.md) §4.
- **Eventos de login/admin ficam gravados** no Postgres do Keycloak (não
  aparecem em `docker logs` — o listener `jboss-logging` loga em nível `INFO`,
  abaixo do `WARN` padrão do container). Para consultar: console → *Realm
  settings → Events* → *User events*/*Admin events*, ou
  `GET /admin/realms/gerenciador/events` com um token de admin. Isso é auditoria
  nativa do Keycloak, não a auditoria da aplicação (ainda não existe, §9).

### Banco de dados

```bash
cd apps/api
pnpm db:generate        # gera migration a partir do schema
pnpm db:migrate         # aplica no banco de DATABASE_URL
pnpm db:seed --reset    # APAGA o dominio e recarrega os dados das planilhas
pnpm db:studio          # inspetor visual do Drizzle
```

O banco de testes (`gerenciador_test`) precisa existir uma vez:

```bash
docker exec gerenciador-api-db psql -U gerenciador -d postgres \
  -c "CREATE DATABASE gerenciador_test;"
```

### Verificação

```bash
pnpm lint && pnpm build && pnpm test        # raiz: lint, build, unitarios
pnpm --filter api test:int                  # integracao (exige Postgres no ar)
pnpm smoke:login                            # fluxo de login completo, apps no ar
pnpm smoke:login docente.teste docente123   # confere o 403 do endpoint restrito
pnpm smoke:telas                            # abre cada tela e confere os numeros
```

`test:int` inclui o **teste de aceite da migração**: com a seed carregada, o
sistema tem que reproduzir os indicadores das planilhas
([system-structl.md](system-structl.md) §8.3). Se algum falhar, ou a fórmula está
errada ou o dado migrou sujo.

`smoke:telas` fecha o círculo do outro lado: faz login de verdade, abre cada
tela e procura os números na resposta HTML. É o que impede um serviço correto de
ficar invisível por causa de um erro na página. A `web` também roda regressões
pequenas em `node:test`; o smoke continua sendo a cobertura das páginas completas.

---

## 5. Arquitetura de autenticação (resumo)

Detalhes e justificativas em [docs/autenticacao.md](docs/autenticacao.md). O
essencial:

```
                    cookie httpOnly (JWE, opaco)
   Browser  ◄───────────────────────────────────►  Next.js (BFF)
      │                                                  │
      │ nunca vê token                                   │ Authorization: Bearer
      │                                                  ▼
      │                                            NestJS (API)
      │                                                  │ valida assinatura
      ▼                                                  ▼ contra o JWKS
   login/senha ────────────────────────────────►   Keycloak (realm gerenciador)
```

Três decisões que definem tudo o mais:

1. **BFF.** O Next faz a troca do code por tokens no servidor e guarda os tokens
   criptografados em cookie httpOnly. O JavaScript do browser nunca tem acesso a
   um token — um XSS não tem o que roubar. Chamadas do lado do cliente passam por
   `/api/bff/*`, que injeta o `Bearer` no servidor.
2. **Login hospedado no Keycloak** (Authorization Code + PKCE). Senha nenhuma
   passa por este código. MFA, política de senha, reset e federação LDAP/AD viram
   configuração de console, não código.
3. **Controllers falam em permissão, não em papel.** `@RequirePermission('plano:write')`,
   nunca `@Roles('coordenador')`. O papel é apenas a forma atual de conceder — ver §6.

**A autorização que vale é a da API.** O `proxy.ts` e a UI só evitam telas
inúteis; se ambos sumissem, nenhum dado vazaria, porque todo endpoint é fechado
por padrão (o `JwtAuthGuard` é global e só `@Public()` abre).

---

## 6. Modelo de autorização e como estendê-lo

Hoje: papel de realm no Keycloak → conjunto de permissões finas na API.

```
Keycloak emite:  realm_access.roles = ["coordenador", "docente"]
API traduz:      permissionsForRoles(roles) -> ["plano:read", "plano:write", ...]
Controller pede: @RequirePermission('plano:write')
```

O mapa vive em [apps/api/src/auth/permissions.ts](apps/api/src/auth/permissions.ts).

**Para adicionar uma permissão nova:**

1. Acrescente a string em `PERMISSIONS` (o tipo `Permission` é derivado dela, então
   o TypeScript passa a aceitá-la em `@RequirePermission`).
2. Conceda-a aos papéis certos em `ROLE_PERMISSIONS`.
3. Use `@RequirePermission('sua:permissao')` no handler.
4. Cubra no teste de `permissionsForRoles` se a regra for interessante.

**Para adicionar um papel novo:** crie no realm
([infra/keycloak/import/gerenciador-realm.json](infra/keycloak/import/gerenciador-realm.json))
e mapeie em `ROLE_PERMISSIONS`. Papel sem entrada no mapa simplesmente não concede
nada — não é erro (o Keycloak injeta `offline_access` e `uma_authorization` em
todo token).

**Quando a granularidade apertar** (permissão direta por usuário, escopo por
programa de pós-graduação, delegação temporária), o ponto de mudança é
`permissionsForRoles` — e só ele. Nenhum controller precisa mudar, porque nenhum
menciona papel. Foi por isso que a indireção existe desde o começo.

---

## 7. Convenções de código

- **Idioma.** Domínio, mensagens de erro ao usuário e comentários em português.
  Comentários **sem acentuação** (padrão do repositório). Identificadores de
  código e nomes de permissão em inglês minúsculo (`plano:write`).
- **Comentários explicam o porquê, não o quê.** Densidade alta nos arquivos de
  auth é proposital: são decisões de segurança que ninguém adivinha relendo.
- **Validação com zod, em toda fronteira** — ambiente, claims de token, payload de
  cookie. A API não usa `class-validator`: quando o primeiro DTO aparecer, use zod
  também, para o projeto não carregar duas bibliotecas de validação.
- **Formulários novos usam React Hook Form + Zod.** Defina o schema do cliente em
  `lib/formularios/`, passe-o ao `zodResolver` e envie o objeto tipado para a
  Server Action. A API continua sendo a fronteira autoritativa e valida novamente.
  Formulários legados que usam `FormData` devem ser migrados quando forem alterados,
  não numa reescrita ampla sem necessidade.
- **Nada de `NEXT_PUBLIC_`** nas variáveis de auth. `apps/web/src/lib/env.ts` usa
  `server-only`: importá-lo de um Client Component quebra o build de propósito.
- **A API não habilita CORS**, e isso é intencional — o browser nunca fala com ela
  direto. Se você sentir vontade de ligar CORS, provavelmente está prestes a
  furar o desenho BFF.

---

## 8. Tema e interface

O tema institucional (verde floresta, claro/escuro) já existe em
[apps/web/src/app/globals.css](apps/web/src/app/globals.css), com tokens
semânticos: `bg-surface`, `text-muted`, `border-border-strong`, `bg-danger-soft` +
`text-on-danger-soft` etc.

- **Use sempre o token semântico, nunca o hex nem cor crua do Tailwind.**
- Na P10, as redes usam `network-1`, `network-2` e `network-3` como identidade
  de navegação. Esses tons não representam estado; alerta continua usando os
  tokens `warning`/`danger`/`info` apropriados.
- O Tailwind 4 escaneia o texto do fonte: classes montadas dinamicamente
  (`bg-${cor}`) não geram CSS. Escreva por extenso.
- A troca de tema roda antes da primeira pintura via script inline em
  [layout.tsx](apps/web/src/app/layout.tsx), para não piscar.
- `ThemeSynchronizer`, montado no layout raiz, acompanha mudanças do tema do
  sistema operacional quando a preferência salva é `system`; esse listener não
  deve ficar condicionado à presença visual do seletor.
- **MUI fica restrito aos gráficos.** `@mui/x-charts` Community está instalado
  com todos os tipos de gráfico dessa edição. `@mui/material`, Emotion e
  `@mui/material-nextjs` existem porque são dependências da integração, não para
  substituir os componentes e tokens próprios do sistema.
- O `AppRouterCacheProvider` do adaptador para Next 16 fica no layout raiz com a
  camada CSS `mui` abaixo de `components` e `utilities`. Ao criar um gráfico,
  importe pelo subpath específico (por exemplo, `@mui/x-charts/BarChart`) e use
  as variáveis semânticas de `globals.css` para cores, inclusive no tema escuro.

### Peças de interface que valem conhecer antes de criar outras

| Peça | Onde | Para quê |
|---|---|---|
| `Sidesheet` / `AbrirSidesheet` | [ui/sidesheet.tsx](apps/web/src/componentes/ui/sidesheet.tsx) | Todo cadastro entra por painel lateral. É `<dialog>` nativo — foco preso, `Esc`, fundo inerte e `::backdrop` vêm do navegador. O conteúdo permanece montado durante a animação de saída. |
| `Multistep` | [ui/multistep.tsx](apps/web/src/componentes/ui/multistep.tsx) | Formulário longo em etapas. **Todos os passos ficam montados** e o inativo usa o atributo `hidden`: só assim o `FormData` do submit traz o formulário inteiro, e campos `required` de passo oculto não travam o envio. |
| `Selecoes` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Grupo de caixas de seleção que devolve uma lista (as redes de uma missão, por exemplo). É `fieldset`/`legend`, e todas as caixas compartilham o `name`: o React Hook Form junta as marcadas em array e o `FormData` as devolve em `getAll`. |
| `Texto` / `Selecao` / `Data` / `AreaTexto` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Campos visuais aceitam `registro={register("campo")}` do React Hook Form e mantêm os tokens e mensagens acessíveis do sistema. |
| `useErrosDaAcao` | [ui/formulario.ts](apps/web/src/componentes/ui/formulario.ts) | Reaplica os erros de campo devolvidos pela API no React Hook Form; use um mapa apenas quando o nome da API diferir do nome visual. |
| `Moeda` | [ui/basicos.tsx](apps/web/src/componentes/ui/basicos.tsx) | Nulo vira *A definir* em itálico, **nunca** R$ 0,00 (§9.2 da especificação). |
| `somarMoeda` | [lib/formato.ts](apps/web/src/lib/formato.ts) | Soma em centavos com `BigInt`. Dinheiro nunca passa por `number` antes de uma conta. |
| `ToastProvider` / `useToastDaAcao` | [ui/toast.tsx](apps/web/src/componentes/ui/toast.tsx) | Confirma ações depois que o sidesheet fecha. Erros de validação continuam junto ao formulário. |

Cadastro novo: crie o formulário em `componentes/formularios/`, a Server Action
em `acoes/`, o schema Zod em `lib/formularios/` e chame por `AbrirSidesheet` na
página. Use `useForm` com `zodResolver`, `useWatch` para campos condicionais e
`useErrosDaAcao` para rejeições da API. Formulário curto não precisa de multistep
— fatiar quatro campos em etapas troca rolagem por cliques. Use `useToastDaAcao`
para o sucesso da Server Action; não leve erros de campo para o toast, porque
eles precisam permanecer próximos do controle que deve ser corrigido.

O menu lateral nasce recolhido no desktop e pode ser expandido pelo controle no
rodapé. No celular ele continua como gaveta completa. Preserve esse comportamento
ao incluir novos itens: todo item precisa de rótulo acessível mesmo quando apenas
o ícone estiver visível.

---

## 9. O que existe / o que não existe

**Existe:**

- **Autenticação/autorização**: login e logout OIDC completos, sessão renovada
  automaticamente, guards globais, catálogo de permissões, realm versionado.
- **Modelo de dados**: 31 tabelas em 8 módulos de schema Drizzle
  ([apps/api/src/database/schema/](apps/api/src/database/schema/)), com migrations.
  Segue [system-structl.md](system-structl.md) §4.
- **Seed com os dados reais** das planilhas e respostas formais
  ([apps/api/src/database/seed/](apps/api/src/database/seed/)): 24 PPGs, 60 itens
  de catálogo, 23 linhas de plano (18 aprovadas, 4 UFMG pendentes e 1 cancelada),
  48 orçamentos anuais e 14 pendências históricas (5 abertas).
- **Serviços de cálculo**: RN-01 a RN-20 em
  [apps/api/src/dominio/](apps/api/src/dominio/), todos em SQL e sem nenhum
  derivado persistido. A API expõe programas, ciclo, redes, temáticas, orçamento,
  plano, bolsas concedidas e produtos individuais, comitê gestor, premissas,
  PPGs, pendências e catálogo.
- **Telas de planejamento**: P01, P05, P06, P07, P08, P09, P10, P13, P14, P15,
  P17 e as configurações da conta. Cadastro de PPG e de linha de plano em
  sidesheet com formulário em etapas; pendência em sidesheet simples.
- **Edição anual de orçamento**: P09 permite ao `admin` alterar as três rubricas
  de uma área temática em um exercício, registrar fonte, situação, justificativa
  e auditoria por campo. O consolidado da rede continua calculado.
- **Premissas e fontes internas (antiga P16)**: a página foi retirada da interface.
  Tabelas, seed e endpoint permanecem para rastreabilidade e futuro uso em P22;
  decisões confirmadas ficam em [system-structl.md](system-structl.md).
- **Recorte inicial de Bolsistas (P03)**: concessão individual a partir de uma linha planejada, com
  vaga por exercício, CPF, origem e destino, datas completas, alertas temporais, regra de uma
  modalidade por CPF/ciclo e cadastro/acompanhamento de produtos por pessoa. Não há
  seed de beneficiários porque a planilha não os traz.
- **Comitê Gestor e Administração (P17, equipes e cadastro de missões)**:
  cadastro de vínculos por ciclo, separação entre as duas equipes, criação
  reutilizável de pessoas, vigência, auditoria e acesso provisório exclusivo de
  `admin`. A P17 possui as abas Visão geral, Missões e Equipes; Missões lista,
  filtra e pagina, e o cadastro multietapas grava roteiro repetível e
  participantes sem valores financeiros. A API cobre criação, detalhe, edição,
  ciclo de vida e relato; a página de detalhe ainda não existe e foi reordenada
  para depois da homologação do escopo ampliado. O
  catálogo ISO de países é carregado por migration e seed. A composição formal
  das redes UFMG, UNESP e UNICAMP também é carregada por migration e seed: 10
  pessoas, 10 vínculos consolidados e 19 associações em
  `membro_equipe_gestao_rede`, sem bloquear novos cadastros manuais. A Visão
  geral filtra a tabela de aportes por exercício em `?ano=`, e a aba Equipes
  mostra quantas missões do ciclo cada pessoa integrou — a contagem é por pessoa,
  porque participante sem vínculo de equipe também conta. A missão pertence a
  uma ou mais redes coordenadoras (`missao_rede`, mínimo uma, do mesmo ciclo):
  a lista filtra por rede em `?redeId=`, e a missão multirrede aparece e conta
  **uma única vez** em "todas as redes" porque filtro e leitura usam `exists` e
  subconsulta, nunca `join`. O backlog rastreável
  está em [docs/backlog-comite-gestor.md](docs/backlog-comite-gestor.md), e as
  decisões que faltam homologar antes da próxima etapa estão em
  [docs/homologacao-comite-gestor.md](docs/homologacao-comite-gestor.md).
  Em 2026-09-01, a equipe entregou uma especificação ampliada de 40 seções para
  aprovação, parceiros, contatos, produtos, documentos, convênios, indicadores
  e relatórios. A auditoria integral está em
  [docs/revisao-escopo-comite-gestor-2026-09-01.md](docs/revisao-escopo-comite-gestor-2026-09-01.md).
  **Não iniciar a antiga CG-045:** a próxima task obrigatória é CG-005, seguida
  de CG-006 a CG-009, para homologar fases e regras antes de alterar o contrato
  da missão. O PDF não substitui silenciosamente as decisões confirmadas.

Na P10, a leitura segue `programa → rede → temática → PPG`. A rota `.../plano`
tem a aba **Visão geral** e uma aba por rede, persistida em `?rede=`; não crie
rotas ou serviços duplicados para cada rede. Cada participação PPG–temática
aponta para um `coordenadorTematicaId`; uma pessoa pode coordenar vários PPGs e
uma temática pode ter coordenadores diferentes conforme o PPG. O termo de
interface é **Coordenador de Temática**, não “membro do comitê”. Edição de linha
existente exige `plano:edit` (só `admin`), preserva código/rubrica e grava uma
entrada de auditoria por campo alterado. O exercício também fica em `?ano=`: somente
2027 vem composto; 2028–2030 começam vazios e nunca copiam a quantidade automaticamente.
- **Testes**: 51 unitários/regressões (33 API + 18 na web para toast, datas,
  React Hook Form/Zod e erros do multistep) + 181 de integração contra
  Postgres real.
- Smoke de login (`pnpm smoke:login`) e de telas (`pnpm smoke:telas`) ponta a
  ponta; CI de lint/build/test.

**Não existe ainda:**

- **Mapa (P04) e panorama de mobilidade (P02).** P03 já permite cadastrar as
  concessões, mas as planilhas de origem não têm o dado individual: sabe-se que
  há "1 bolsa de Doutorado Sanduíche de 6 meses para o PPGCLIAMB", não quem foi
  nem se voltou. As visões consolidadas dependem desse cadastro começar.
- **Registro de movimentações externas (P12).** Deve aceitar apenas origem/destino
  da mesma temática e registrar o que já aconteceu na CAPES, com status manual e
  auditoria. O Gerenciador não propõe, autoriza ou executa. A estrutura genérica de
  execução financeira permanece no schema para outros programas, mas P11 é fora do
  escopo do CAPES Global porque os pagamentos são feitos diretamente pela CAPES.
- Relatórios (P20), importação com adaptador por programa (P21), documentos e
  evidências (P22), convênios e produção consolidada (P18/P19). O documento novo
  do Comitê propõe trazer parte de P18–P20/P22 para o fluxo da missão, mas a fase
  e a prioridade ainda dependem da CG-005. Produtos individuais por bolsa já
  existem em P03 e não devem ser reutilizados como produto de missão sem a
  modelagem da CG-056.
- **Escopo por PPG na autorização.** `coordenador` é global, não "coordenador do
  PPGDA". Continua sendo o próximo ponto de pressão: coordenadores lançam dados
  desde o MVP ([system-structl.md](system-structl.md) §3.5), toda entidade já
  carrega `ppgId`, e o ponto de mudança é `permissionsForRoles` mais um filtro
  por escopo nas consultas de listagem.
- Vínculo entre o `sub` do Keycloak e um registro local de `pessoa`. A identidade
  vive só no token; o provisionamento (JIT no primeiro login é o usual) ainda
  precisa ser decidido.
- Cobertura ampla de componentes na `web`; hoje há 16 regressões em
  `node:test` (toast, conversão/validação de datas, erros do multistep e cadastro
  de missão), além do `pnpm smoke:telas` para as páginas.
- Upload/versionamento e política de acesso dos documentos pessoais, além do
  histórico de cancelamento, desistência, falecimento e substituição.
- Rate limiting, auditoria abrangente fora das edições de plano/orçamento e
  observabilidade.
- Qualquer configuração de produção: HTTPS, segredos fora do repositório,
  Keycloak em modo `start` (não `start-dev`), origem de sessão externa.

---

## 10. Cuidados ao mexer

- **Trocar `SESSION_SECRET` derruba todas as sessões ativas.** É o efeito
  desejado em caso de vazamento, e um incômodo se for sem querer.
- **`pnpm kc:import --force` apaga o realm inteiro**, incluindo usuários criados
  à mão pelo console. O arquivo JSON é a fonte da verdade; mudanças feitas só
  pela UI se perdem.
- O segredo do client (`dev-web-secret-nao-use-em-producao`) está versionado de
  propósito, para o ambiente de desenvolvimento subir sem passos manuais.
  **Qualquer outro ambiente precisa de um segredo novo, gerado no console.**
- O cookie de sessão passa de 4 KB e por isso é fatiado em `gr_session.0`,
  `gr_session.1`. Se você mexer no conteúdo da sessão, confira o tamanho — o
  limite defensivo é 8 fatias.
- Comandos que sobem servidor (`pnpm dev`) são persistentes; não os encadeie em
  scripts que precisam terminar.
- **`apps/web/src/lib/acao.ts` é `server-only`.** Client Component que precisar do
  contrato das Server Actions importa de `acao-tipos.ts`. Importar `acao.ts` do
  cliente quebra o build de propósito — foi o que impediu `apiFetch` de vazar
  para o bundle do browser na primeira versão dos formulários.
- **`proxy.ts` enumera rotas públicas, não protegidas.** Com o sistema inteiro
  atrás de login, listar o que é protegido significaria lembrar de cada tela
  nova, e esquecer falharia em silêncio.
