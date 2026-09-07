# Gerenciador PROPESP — contexto do projeto

Documento de referência para quem (pessoa ou LLM) vai mexer neste repositório sem
tê-lo escrito. Descreve o que existe hoje, por que está assim, e o que ainda não
existe. **Mantenha-o atualizado quando mudar arquitetura ou convenção.**

Última revisão: 2026-09-07.

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
o registro histórico de movimentações externas, relatórios e dashboards,
panorama/mapa de mobilidade e o escopo local por PPG/temática na autorização.
**O ciclo da missão do Comitê fechou de ponta a ponta**: cadastro, aprovação,
prestação, abatimento do aporte, produtos, evidências e encerramento com
checklist. Ver §9.

A visão de arquitetura e os fluxos de negócio/técnicos estão em
[docs/arquitetura-sistema.md](docs/arquitetura-sistema.md). A especificação
funcional completa — 23 páginas previstas na origem, mais a P24 de parceiros,
vinda do escopo ampliado do Comitê Gestor — está em
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
| Recharts | 3.x | visualizações; substituiu o MUI X Charts, que saiu junto com `@mui/material` e Emotion |
| TanStack Query | 5.x | busca no browser, só depois da primeira pintura; ver §8 |
| shadcn/ui | por cópia | não é dependência: os componentes entram no repositório e são traduzidos para os tokens daqui |
| Radix UI / cmdk | 1.x | primitivos por baixo do popover e do combobox |
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
        identidade.service.ts liga `sub` do Keycloak a `pessoa`; resolve escopo
        escopo.ts             traduz escopo em condição SQL (RECORTE_OBRIGATORIO)
        acesso.controller.ts  admin concede/revoga escopo e reassocia pessoa
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
        resultados.service.ts  CG-056 — produtos da missão e convênios do parceiro
        encerramento.service.ts   CG-058 — checklist de encerramento e dispensas
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
        bff.ts             cliente HTTP do browser, só fala com /api/bff
        utils.ts           `cn` (clsx + tailwind-merge)
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
        ui/botao.tsx       variantes de botão com CVA
        ui/popover.tsx     Radix Popover vestido com os tokens daqui
        ui/comando.tsx     lista filtrável por teclado (cmdk)
        ui/combobox.tsx    seleção única com busca
        ui/grafico.tsx     base dos gráficos Recharts
        formularios/       cadastros que vão dentro do sidesheet
        graficos/          um arquivo por gráfico, Client Components
        consultas/         provider do TanStack Query e telas que consultam
                           do browser
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

# compartilhar temporariamente web + login com a equipe (exige ngrok autenticado)
pnpm ngrok:demo                # api:3333 web:3334 keycloak:8888; Ctrl+C restaura
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

### Identidade local e escopo de acesso

Papel responde **o que pode fazer**. Desde 2026-09-05 há mais duas perguntas,
em tabelas separadas de propósito:

| Pergunta | Onde vive |
|---|---|
| O que pode fazer? | papel no Keycloak → `permissionsForRoles` |
| Quem é? | `usuario_sistema` — liga `sub` a `pessoa` |
| Sobre o quê? | `escopo_acesso` — `GLOBAL`, `PPG` ou `REDE` |

**O vínculo se faz no primeiro acesso, por e-mail.** O admin cria a conta no
Keycloak com o mesmo e-mail da pessoa já cadastrada e
[identidade.service.ts](apps/api/src/auth/identidade.service.ts) liga as duas em
`GET /me` — é o caminho das pessoas já registradas em missões. Sem
correspondência, cria pessoa nova: recusar o login deixaria o usuário preso sem
nenhuma tela para pedir ajuda. Criar pessoa **não concede acesso** — escopo
nasce vazio e é ato do `admin`, por `/acesso/usuarios/:id/escopos`.

O vínculo acontece em `/me`, e não no guard: o guard roda em toda requisição, e
pagar uma escrita por chamada para resolver algo que muda uma vez na vida da
conta seria desperdício.

**`RECORTE_OBRIGATORIO` em [escopo.ts](apps/api/src/auth/escopo.ts) é a decisão
mais consequente do módulo.** Enquanto for `false`, conta **sem escopo nenhum**
continua vendo tudo; quem já tem escopo cadastrado já é recortado hoje. O modo
permissivo existe porque ligar o recorte antes de a PROPESP atribuir os escopos
deixaria todo coordenador sem enxergar nada, no mesmo instante e sem explicação.
Trocar para `true` fecha o sistema. Os dois modos têm teste.

Uma sutileza que a implementação ingênua erra: quem tem escopo **de rede** e
nenhum de PPG não está "sem configuração" — foi configurado para outra dimensão,
e liberar todos os PPGs para ele seria vazamento. Por isso a checagem olha os
dois tipos antes de concluir que ninguém configurou nada.

O recorte entra **na consulta**, nunca numa filtragem em memória: filtrar fora
do banco traz a tabela inteira para a aplicação e vaza a contagem real em
qualquer soma feita antes do filtro. PPG fora do escopo responde **404, não
403** — "existe, mas não é seu" já entrega que o PPG existe.

**Escopo por rede no módulo de missões (CG-028).** Desde 2026-09-07 o recorte
vale para missões, e não só para PPGs. Três coisas o definem:

1. **"Minha rede" é o vínculo ativo** em `membro_equipe_gestao_rede`, em união
   com `escopo_acesso`. Vínculo com `data_fim` preenchido não autoriza mais.
2. **`missao:all-redes` desliga o recorte** e é concedida a `admin` e
   `comite-gestor`. É a única permissão do catálogo que fala de *quais linhas*;
   a exceção existe para não fazer o serviço perguntar pelo papel. Quem decide
   precisa ver o que vai decidir — um Comitê recortado receberia fila
   incompleta. Ela não concede escrita.
3. **Aqui não há modo permissivo.** `RECORTE_OBRIGATORIO = false` poupa quem
   ainda não tem escopo no mundo do PPG; no das missões essa pessoa não existe,
   porque a única permissão que chega ao recorte é a do Gestor da Rede. Sem
   rede no escopo, nenhuma missão passa.

O recorte de leitura de **uma** missão é o `EscopoMissaoGuard`, global: as
rotas de missão têm todas a mesma forma, e verificação espalhada por serviço é
verificação que a próxima rota esquece. Ele responde **404, nunca 403**. A
**listagem** continua se recortando na consulta. A **escrita** é separada:
`validarRedes` recusa criar ou mover missão para rede alheia, e retirar de uma
missão multirrede a rede que você não alcança é 403. **Documento herda o escopo
do alvo**, senão o anexo seria a porta lateral do recorte.

**Quando a granularidade apertar** (permissão direta por usuário, delegação
temporária), o ponto de mudança é `permissionsForRoles` — e só ele. Nenhum
controller precisa mudar, porque nenhum menciona papel. Foi por isso que a
indireção existe desde o começo.

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
- **Gráficos são Recharts.** O MUI saiu inteiro (`@mui/material`,
  `@mui/x-charts`, `@mui/material-nextjs` e os três pacotes do Emotion): estava
  instalado desde o começo e nunca desenhou um gráfico — o único import em todo
  o `src` era o `AppRouterCacheProvider`. Com ele foi embora a camada CSS `mui`
  do `globals.css` e o segundo sistema de estilo.
- A base fica em [ui/grafico.tsx](apps/web/src/componentes/ui/grafico.tsx), e
  cada gráfico em `componentes/graficos/`. **Passe a cor como `var(--token)`
  direto no SVG**, nunca resolvida em JavaScript: assim a troca de tema repinta
  sozinha, enquanto um `getComputedStyle` na montagem congelaria a cor do tema
  que estava ativo. Rede usa `CORES_REDE` (`network-1..3`, os mesmos tons das
  abas da P10); o resto usa `CORES_SERIE`.
- **Valor nulo não vira barra zerada.** `null` chega ao Recharts como `null` e
  desenha um vazio — é a mesma regra do componente `Moeda` (§9.2 da
  especificação), e num gráfico ela importa mais, porque barra rente ao eixo é
  indistinguível de orçamento zerado. A `DicaMoeda` escreve *A definir*.
- O gráfico acompanha a tabela, não a substitui: ele mostra a forma, a tabela
  mostra o número. Só a tabela é precisa para quem usa leitor de tela.

### shadcn/ui: cópia adaptada, não dependência

O shadcn entra por cópia de código, e **os tokens dele colidem com os daqui**.
No shadcn, `muted` é fundo e o texto é `muted-foreground`; neste sistema
`--muted` **é cor de texto**. Colar um componente sem traduzir produz texto
cinza sobre fundo cinza. Traduza sempre:

| shadcn | aqui |
|---|---|
| `bg-background` / `text-foreground` | iguais, pode manter |
| `bg-card`, `bg-popover` | `bg-surface` |
| `bg-muted`, `bg-accent` | `bg-surface-muted` |
| `text-muted-foreground` | `text-muted` (ou `text-subtle`, se for secundário) |
| `border-input` | `border-border-strong` |
| `text-destructive`, `bg-destructive` | `text-danger`, `bg-danger` |
| `bg-primary text-primary-foreground` | `bg-primary text-on-primary` |
| `ring-ring` | `ring-ring` (o token existe) |

O `components.json` existe para o `npx shadcn add <x>` saber onde escrever, mas
**o componente gerado nunca entra como veio**: traduza as classes pela tabela e
troque `rounded-md` pelos raios daqui (`rounded-xl` em campo, `rounded-2xl` em
contêiner). A única peça adotada como infraestrutura é o `cn`
([lib/utils.ts](apps/web/src/lib/utils.ts)).

Nada de migrar o que já existe: `basicos.tsx`, `campos.tsx` e o `Sidesheet`
ficam como estão. O `<dialog>` nativo continua sendo a decisão — foco preso,
`Esc` e fundo inerte vindos do navegador valem mais que a uniformidade.

### TanStack Query: só depois da primeira pintura

- **Não use para o carregamento inicial de uma tela.** Dado que o Server
  Component pode buscar continua sendo buscado lá, com `apiFetch`, sem salto
  HTTP extra nem estado de carregamento. O Query serve à interação depois:
  busca conforme se digita, filtro que não vale uma navegação.
- O cliente do browser é [lib/bff.ts](apps/web/src/lib/bff.ts) e fala só com
  `/api/bff/*` — o token nunca chega ao JavaScript da página. **`apiFetch`
  continua `server-only`;** os dois não se misturam.
- O `QueryClient` nasce dentro de `useState`, nunca em módulo: em módulo seria
  singleton do processo do servidor e o cache de um usuário logado poderia ser
  servido ao próximo.
- O padrão está em
  [consultas/lista-parceiros.tsx](apps/web/src/componentes/consultas/lista-parceiros.tsx):
  `initialData` recebe o que o servidor já buscou, `keepPreviousData` evita a
  tabela piscar em branco a cada tecla, e a URL continua refletindo o filtro por
  `window.history.replaceState` — sem isso, quem manda o link de uma busca
  mandaria a lista inteira. Retry não insiste em 4xx: 401/403 não melhoram.

### Peças de interface que valem conhecer antes de criar outras

| Peça | Onde | Para quê |
|---|---|---|
| `Sidesheet` / `AbrirSidesheet` | [ui/sidesheet.tsx](apps/web/src/componentes/ui/sidesheet.tsx) | Todo cadastro entra por painel lateral. É `<dialog>` nativo — foco preso, `Esc`, fundo inerte e `::backdrop` vêm do navegador. O conteúdo permanece montado durante a animação de saída. |
| `Multistep` | [ui/multistep.tsx](apps/web/src/componentes/ui/multistep.tsx) | Formulário longo em etapas. **Todos os passos ficam montados** e o inativo usa o atributo `hidden`: só assim o `FormData` do submit traz o formulário inteiro, e campos `required` de passo oculto não travam o envio. |
| `Selecoes` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Grupo de caixas de seleção que devolve uma lista (as redes de uma missão, por exemplo). É `fieldset`/`legend`, e todas as caixas compartilham o `name`: o React Hook Form junta as marcadas em array e o `FormData` as devolve em `getAll`. |
| `Texto` / `Selecao` / `Data` / `AreaTexto` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Campos visuais aceitam `registro={register("campo")}` do React Hook Form e mantêm os tokens e mensagens acessíveis do sistema. |
| `useErrosDaAcao` | [ui/formulario.ts](apps/web/src/componentes/ui/formulario.ts) | Reaplica os erros de campo devolvidos pela API no React Hook Form; use um mapa apenas quando o nome da API diferir do nome visual. |
| `RolagemHorizontal` | [ui/rolagem.tsx](apps/web/src/componentes/ui/rolagem.tsx) | Envolve conteúdo que rola na horizontal — a `Tabela` já usa. Dá `tabIndex` ao contêiner **só quando ele transborda de verdade**, medido no cliente: fixo criaria parada de tabulação morta em cada tabela numa tela larga, e ausente deixa as colunas escondidas inalcançáveis pelo teclado. |
| `Combobox` / `CampoCombobox` | [ui/combobox.tsx](apps/web/src/componentes/ui/combobox.tsx) | Seleção única **com busca**, para lista longa (as 200+ instituições da CG-045). Lista curta continua no `Selecao` nativo, que já vem acessível e não carrega JavaScript. O valor sai num `<input type="hidden">`, então o `FormData` do `Multistep` continua trazendo o campo; no React Hook Form vai por `Controller`, não por `register`. |
| `Grafico` / `DicaMoeda` | [ui/grafico.tsx](apps/web/src/componentes/ui/grafico.tsx) | Moldura responsiva do Recharts com `<figure>`/`<figcaption>`: o SVG é uma árvore de `<path>` sem texto útil, e sem a legenda amarrada o gráfico some para quem usa leitor de tela. |
| `Botao` | [ui/botao.tsx](apps/web/src/componentes/ui/botao.tsx) | Variantes com CVA (`primario`, `contorno`, `suave`, `fantasma`, `perigo`). `comoFilho` renderiza num `<Link>` em vez de `<button>`. |
| `Moeda` | [ui/basicos.tsx](apps/web/src/componentes/ui/basicos.tsx) | Nulo vira *A definir* em itálico, **nunca** R$ 0,00 (§9.2 da especificação). |
| `somarMoeda` | [lib/formato.ts](apps/web/src/lib/formato.ts) | Soma em centavos com `BigInt`. Dinheiro nunca passa por `number` antes de uma conta. Cada parcela é truncada para centavos **antes** da soma, e a ordem importa: mil parcelas de 8,615 dão 8.610,00 aqui e 8.615,00 numa soma em `number` — está fixado em `test/dinheiro.test.mjs`. Se **tudo** for nulo o resultado é nulo, nunca zero. |
| `ToastProvider` / `useToastDaAcao` | [ui/toast.tsx](apps/web/src/componentes/ui/toast.tsx) | Confirma ações depois que o sidesheet fecha. Erros de validação continuam junto ao formulário. |

Cadastro novo: crie o formulário em `componentes/formularios/`, a Server Action
em `acoes/`, o schema Zod em `lib/formularios/` e chame por `AbrirSidesheet` na
página. Use `useForm` com `zodResolver`, `useWatch` para campos condicionais e
`useErrosDaAcao` para rejeições da API. Formulário curto não precisa de multistep
— fatiar quatro campos em etapas troca rolagem por cliques. Use `useToastDaAcao`
para o sucesso da Server Action; não leve erros de campo para o toast, porque
eles precisam permanecer próximos do controle que deve ser corrigido.

**Acessibilidade que já está resolvida e não deve regredir** (CG-064): o
sidesheet é `<dialog>` nativo, então foco preso, `Esc` e fundo inerte vêm do
navegador — não reimplemente isso; `Campo` amarra dica e erro ao controle por
`aria-describedby`, e só o `role="alert"` não basta, porque quem volta ao campo
depois não ouviria nada; coluna de ações precisa de rótulo `sr-only`, nunca
`<th>` vazio; e tabela larga rola dentro de `RolagemHorizontal`, que a torna
alcançável pelo teclado.

O menu lateral nasce recolhido no desktop e pode ser expandido pelo controle no
rodapé. No celular ele continua como gaveta completa. Preserve esse comportamento
ao incluir novos itens: todo item precisa de rótulo acessível mesmo quando apenas
o ícone estiver visível.

---

## 9. O que existe / o que não existe

**Existe:**

- **Autenticação/autorização**: login e logout OIDC completos, sessão renovada
  automaticamente, guards globais, catálogo de permissões, realm versionado.
- **Modelo de dados**: 53 tabelas em 13 módulos de schema Drizzle
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
  P17, Parceiros e as configurações da conta. Cadastro de PPG e de linha de plano em
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
  A CG-017 já criou a fundação de parceiros: dados institucionais completos,
  `instituicao_rede` N:N e contatos reutilizáveis. A CG-025 acrescentou API de
  instituições, candidatos a duplicidade, confirmação explícita e conciliação
  auditada sem apagar a origem. A CG-026 fez o mesmo para os contatos, no escopo
  de cada instituição: e-mail (ou nome mais telefone) repetido é bloqueio,
  homônimo apenas exige confirmação, o contato principal troca dentro de uma
  transação e não há exclusão — só inativação, porque a missão referencia o `id`
  central. A auditoria desses registros guarda quais campos mudaram, nunca os
  valores pessoais. A CG-027 fecha a leitura: `GET /parceiros/:id/historico`
  devolve redes, contatos, missões com atividades, eventos e documentos em uma
  linha por missão. Ela usa `exists` mais `selectDistinct` sobre a missão, nunca
  `join` com atividade ou rede — senão a missão de duas redes, ou a que visita o
  mesmo parceiro em duas paradas, apareceria repetida. Produtos e convênios
  entraram na CG-056 como seções próprias e `modulosPendentes` ficou vazia — o
  campo permanece no contrato para o módulo seguinte. A CG-049
  levou isso à interface em `/programas/[programa]/[ciclo]/parceiros`: lista com
  busca e filtro por rede, cadastro e edição em sidesheet, contatos com troca de
  principal e inativação/reativação, e o detalhe histórico. **O alerta de
  duplicidade fica dentro do formulário, nunca em diálogo por cima** — é assim
  que ele não apaga o que já foi digitado; `EstadoDaAcao.candidatos` carrega o
  409 até a tela. `POSSIVEL` oferece "cadastrar assim mesmo"; `INEQUIVOCA` não
  oferece botão, porque a API recusa mesmo confirmada. Não há ação de excluir em
  lugar nenhum: a saída é inativar. A conciliação também tem interface — a
  origem vira o cadastro inativo e o escolhido permanece, com justificativa
  obrigatória e aviso do que será transferido. A lista avisa quando bate no
  limite de 200 do serviço, em vez de cortar em silêncio; paginação de verdade
  exigiria mudar o contrato da API. A seleção de parceiro dentro da missão
  continua na CG-045. A CG-018 ampliou missão, atividade e participante:
  responsável único por papel, destino/evento completos, contato central,
  período individual e dias inclusivos derivados. A API cobre esses campos; a
  interface ainda não.

  **Regras financeiras homologadas na CG-009** (documento da equipe de
  orçamento): o sistema trabalha **somente em BRL** — não existe moeda de origem
  nem cotação, e a conversão acontece antes do lançamento; **prestação
  `VALIDADA` abate o aporte anual** do Comitê Gestor (implementação na CG-055),
  e nada abate antes disso; os requisitos de encerramento são **agnósticos ao
  tipo de missão**; os tipos de despesa são passagem, diária, hospedagem,
  transporte, inscrição em evento, seguro e outros; os formatos de documento
  aceitos eram PDF, JPG, PNG, DOC/DOCX e XLS/XLSX — **DOC/XLS saíram em
  2026-09-07**, por decisão do responsável de que o PDF basta por enquanto
  (documento do Office é o vetor clássico de macro e não há antivírus ainda);
  e a prestação abre
  **automaticamente** quando a viagem é marcada como realizada.

  **Modelo documental decidido na CG-014**, antes de qualquer upload:
  [docs/modelo-documental.md](docs/modelo-documental.md). Em resumo — a tabela
  genérica `anexo` **evolui** em vez de ganhar uma irmã; substituir um arquivo
  cria versão nova e preserva a anterior (não há exclusão); nada é servido por
  URL estática, todo download passa por endpoint autenticado com chave de
  armazenamento opaca; e o tipo do arquivo é validado pelo **conteúdo**, não
  pela extensão. Os "documentos analisados" de um parecer são tabela de ligação,
  nunca vínculo direto — senão anexar um arquivo depois mudaria retroativamente
  o que o Comitê diz ter analisado.

  **Upload de documentos (CG-051)** vive em `/anexos` e segue o modelo acima.
  O disco de desenvolvimento é `ARQUIVOS_DIR`, que por padrão resolve para
  `apps/api/arquivos/` — ignorado pelo git desde 2026-09-05, porque o primeiro
  upload criava o diretório dentro do repositório e nada ali pode ser
  versionado. O
  controller **não** tem `@RequirePermission`: a permissão é a da entidade de
  destino (`missao:edit`, `prestacao:write`, `parceiro:write`) e só se sabe
  depois de ler o corpo — um decorador fixo teria de escolher a mais fraca.
  Antivírus não existe; o ponto de inserção é `validarArquivo`, antes de
  `armazenamento.guardar`.

  **Documentos da prestação (CG-052)** reutilizam a mesma API: anexos de
  passagem, diária e outras despesas apontam para `DESPESA_MISSAO`; cada PDF de
  cotação aponta para seu `COTACAO_PASSAGEM`. A categoria é validada contra o
  tipo da despesa. Como `anexo` é polimórfico e não possui FK, o serviço de
  prestação recusa remover uma despesa documentada ou apagar, durante edição,
  uma cotação que tenha documento — preservar a linha é o que mantém o vínculo
  histórico válido.

  **Segurança documental (CG-061)** valida UUID antes do banco, rejeita nome
  com caracteres de controle e monta `Content-Disposition` com fallback ASCII
  mais `filename*` UTF-8. Conhecer o UUID não contorna a permissão herdada do
  alvo. Isolamento horizontal entre dois perfis com a mesma permissão continua
  pertencendo à CG-028/CG-029, porque a matriz provisória ainda dá acesso ao
  módulo somente a `admin`.

  **Aprovação da missão (CG-019)** entrou em 2026-09-05, depois de o
  responsável aceitar o **modelo B**: o colegiado delibera fora do sistema —
  reunião semanal, podendo haver semana sem reunião — e o relator registra o
  parecer com a data dessa deliberação. A aprovação é dimensão própria
  (`missao_comite.status_aprovacao`), independente do status de execução. O
  banco garante uma rodada aberta por missão, uma decisão por rodada, data de
  reunião só nas decisões terminais e justificativa obrigatória na reabertura.
  **Os requisitos documentais são dados** (`requisito_submissao`), por decisão
  explícita: uma lista fixa no código impediria cadastrar um tipo novo de
  missão. Falta ligar `sub` do Keycloak a `pessoa` para aplicar "somente o
  responsável envia" — é pré-requisito da CG-037.

  **Submissão para análise (CG-037)** entrou em 2026-09-05:
  `GET .../missoes/:id/requisitos` devolve o checklist e
  `POST .../missoes/:id/submissao` abre a rodada (`missao:submit`). Os
  requisitos vêm de `requisito_submissao`, **nunca de constante**. Recusa é
  422 com a lista de pendências. **Somente o responsável envia** — verificável
  desde que existe o vínculo `sub` → `pessoa`; `admin` passa sempre, senão uma
  missão cujo responsável saiu ficaria travada. **A edição congela em
  `EM_ANALISE`:** sem isso o Comitê aprovaria texto diferente do que leu.
  Notificação durável (D-11) ficou de fora — é proposta não homologada.

  **O `/me` nunca deve falhar por causa do vínculo de identidade.** Quando o
  `sub` do Keycloak não pode ser ligado a uma pessoa — o caso real foi o realm
  recriado, com todos os `sub` novos e o e-mail apontando para pessoa já
  vinculada —, `resolver` devolve `null`, o `/me` responde `pessoaId: null` e
  `vinculoPendente: true`, e a sessão segue válida. Antes disso a resposta era
  500 e a aplicação inteira parava. Repontar a pessoa automaticamente seria
  pior: bastaria criar conta com um e-mail conhecido para herdar identidade e
  escopos. Quem desempata é `POST /acesso/usuarios/:id/pessoa`.

  **Decisões do Comitê (CG-038)** completam o fluxo:
  `POST .../missoes/:id/decisao` (`missao:decide`),
  `POST .../missoes/:id/analise/reabertura` (`missao:reopen`) e
  `GET .../missoes/:id/analise`. **Atenção ao caminho da reabertura:**
  `.../missoes/:id/reabertura`, sem `analise`, é outra coisa — reabre a
  *execução* de uma missão concluída, não a *análise* decidida. Os documentos
  analisados são **fotografados** no instante da decisão, com nome e versão:
  sem isso um upload posterior reescreveria o que o Comitê diz ter lido. Não há
  designação de relator, nem quórum, nem notificação.

  **A tela da missão (CG-045)** está em
  `/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]`, com quatro abas:
  `Resumo` (padrão, sem `?aba=`), `Análise`, `Documentos` e `Prestação`. As
  duas dimensões da CG-006 aparecem sempre juntas e rotuladas — mostrar só uma
  faria "aprovada" ser lido como "realizada". Análise traz checklist, histórico
  de rodadas e as ações de enviar, decidir e reabrir; Documentos e Prestação
  são **leitura**, porque anexar arquivo e lançar despesa pela interface são a
  CG-053 (concluída junto). O download sai por `/anexos/:id/conteudo`, nunca
  por arquivo estático. Prestação nula mostra "Prestação não iniciada" —
  ausência de prestação é ausência de linha, não o estado `NAO_INICIADA`.

  **Execução orçamentária (CG-055)** vive em
  `GET .../comite-gestor/execucao` e aparece na aba Visão geral, ao lado — e
  não no lugar — da tabela de aportes por rede. **Somente `VALIDADA` abate o
  aporte**: `saldoOficial` é `orçamento − validado`, e os outros três estados
  ocupam colunas próprias justamente para que isso fique visível. Uma coluna
  única "executado" obrigaria a escolher entre esconder o que ainda não vale e
  fazer parecer que já vale. **O dinheiro agrupa por `despesa.exercicio`; as
  missões, pelas datas** — a segunda usa o mesmo critério do filtro `?ano=` da
  lista, para o número não mudar ao clicar. O consolidado do ciclo **não é a
  soma das colunas**: missão que atravessa dois exercícios está nas duas
  linhas, e a contagem do total é distinta. Exercício com despesa e sem aporte
  aparece com saldo negativo, porque esconder o estouro atrás de um nulo seria
  pior. `somarOuNulo` existe ao lado de `somarMoeda` em `orcamento.service.ts`
  porque o zero de `somarMoeda` é certo para temática sem linha e errado para
  prestação nunca iniciada.

  **A lista de missões passou a mostrar a prestação real.** O
  `'NAO_INICIADA'::text` fixo virou `left join` em `prestacao_contas_missao`
  (`prestacao_missao_uk` garante que a junção não duplique linha, o que
  importaria porque `count(*) over ()` dá o total da página), e `valorPrestado`
  soma as despesas em **qualquer** estado — filtrar por `VALIDADA` faria a
  missão em preenchimento parecer sem lançamento. O detalhe da missão devolve
  situação e totais reais; `prestacao` continua nulo lá porque o corpo dela sai
  de `GET .../prestacao`, e duplicar a resposta abriria espaço para divergirem.

  **Ciclo de vida da prestação (CG-054):** `/prestacao/envio`
  (`prestacao:write`), `/prestacao/validacao` e `/prestacao/devolucao`
  (`prestacao:review`). Os quatro estados governam o que a tela oferece.
  **`COM_PENDENCIA` volta a aceitar lançamento** — devolver sem reabrir a edição
  deixaria o responsável sem como corrigir; `ENVIADA` congela para o revisor não
  validar outra coisa; `VALIDADA` congela em definitivo, porque abate o aporte.
  Não há rodada numerada como na análise da missão: é a trilha de auditoria que
  conta o vaivém. Prestação sem despesa não é enviada, e o reenvio limpa o
  parecer da devolução.

  **Produtos da missão e convênios (CG-056)** entraram em 2026-09-06.
  `produto_missao` é domínio próprio, separado de `produto_bolsa`: são duas
  cobranças sobre coisas diferentes, e reaproveitar a tabela deixaria
  `bolsa_concedida_id` nulo em metade das linhas. **A resposta "gerou produto?"
  não é booleano:** o "sim" já é a existência de linha em `produto_missao`, e só
  a resposta **negativa** é gravada
  (`missao_comite.sem_produto_declarado_em/_por/_justificativa`), porque zero
  produto significa tanto "não gerou" quanto "ninguém respondeu" e o checklist de
  encerramento (CG-058) precisa distinguir as duas. Cadastrar produto retira a
  declaração, com auditoria. **O convênio não pertence à missão**: ancora-se na
  `instituicao`, guarda a missão só como origem (FK `set null`) e vive em
  `/convenios`, sem `:programa/:ciclo` no caminho — um acordo sobrevive à viagem
  e ao ciclo. Produto usa `missao:read`/`missao:write` (resultado, mesmo verbo do
  relato — não `missao:edit`, que congela em análise); convênio usa
  `parceiro:read`/`parceiro:write`. Nenhuma permissão nova. `produto_missao` do
  tipo `CONVENIO` exige um acordo apontado, e só ele pode apontar — o `check` é
  bicondicional porque as duas metades escondem coisas diferentes. Não há
  exclusão de convênio (só inativação, FK `restrict`) nem remoção de produto
  documentado (regra da CG-052). `entidade_anexo` ganhou `PRODUTO_MISSAO` e
  `CONVENIO`. O histórico do parceiro ganhou as seções `convenios` e `produtos`,
  e `modulosPendentes` ficou vazia. **A interface é leitura**, com uma exceção: a
  seção *Resultados* traz a resposta "gerou produto?" desde a CG-046 — só a
  **negativa**, porque o "sim" se responde cadastrando o produto e um botão
  "Sim" gravaria afirmação sem nada que a sustente. O cadastro de produto e o
  de convênio pela tela ainda não existem.

  **Encerramento da missão (CG-058)** entrou em 2026-09-06, e mudou o
  significado de `CONCLUIR`: a transição passa pelo **checklist inteiro**, não
  só pelo relato, e `CONCLUIDA` deixa de dizer "a viagem acabou" para dizer
  "encerrada e acertada" — a missão fica `CONFIRMADA` enquanto a prestação
  corre. `GET .../missoes/:id/encerramento` devolve a lista;
  `.../encerramento/dispensa` e `.../encerramento/revogacao` exigem
  `missao:decide`, que já é exatamente "admin e Comitê" — nenhuma permissão
  nova foi criada.

  **Nada do checklist é gravado**, e a proibição é da própria task: um
  `prestacao_ok` guardado divergiria no dia em que a prestação fosse devolvida,
  e a missão encerraria com base numa foto velha. Cinco fatos vêm de consulta
  (relato, roteiro relatado, resposta sobre produtos, prestação validada,
  avaliação dos objetivos) e os documentos vêm de `requisito_submissao` com
  `momento = 'ENCERRAMENTO'` — dado, não código, como na CG-019.

  Quatro regras que a implementação ingênua erra: **dispensado não vira
  atendido** (o requisito segue não cumprido, com a justificativa ao lado —
  pintá-lo de verde apagaria a exceção onde ela precisa ser vista); **estado
  errado é impedimento, não pendência** (não há o que preencher para resolver
  "já foi encerrada", e misturar os dois faria a tela oferecer uma ação
  inexistente); **revogar não apaga a linha** — daí `revogada_em` e o índice de
  unicidade **parcial**, sem o qual dispensar de novo depois de revogar
  colidiria; e **a justificativa segue a avaliação**, porque manter a explicação
  de um insucesso que deixou de existir faria a tela contradizer a resposta. A
  dispensa vale **só para a missão apontada**: por tipo seria mudança de
  política disfarçada de exceção.

  A avaliação (`SIM | PARCIALMENTE | NAO`) é opcional no relato e obrigatória
  para encerrar — travar o relato pela avaliação impediria salvar o texto pela
  metade. A justificativa é exigida só quando não foi plenamente alcançado;
  `missao_comite_avaliacao_ck` garante a assimetria no banco.

  **Os textos deste módulo estão acentuados** porque viram rótulo de tabela na
  tela, ao contrário das mensagens da maior parte da API. Nenhum documento de
  encerramento foi semeado: quais a PROPESP exige é política institucional, e a
  lista é dado.

  **O relato da missão (CG-046)** são **dois** formulários no Resumo, e a
  separação é decisão de 2026-09-06: o relato edita o planejado e um botão à
  parte acrescenta a parada extra. Os dois usam o mesmo `PATCH .../relato`, e
  isso só funciona porque a API **insere** atividade não prevista em vez de
  reconciliar — o relato manda `atividadesNaoPrevistas: []` sem apagar as
  existentes, e a extra manda `atividades: []` sem tocar nas planejadas.
  **O formulário da extra reenvia o relato atual inalterado**, porque o
  endpoint exige `relatoGeral` e mandar vazio apagaria o texto; por isso o botão
  só aparece depois que há relato. A justificativa da avaliação some no `SIM` no
  payload, e não só na tela: o valor digitado antes continua no estado do React
  Hook Form. `AtividadeMissao.status` é o enum nos dois lados, não `string`.

  **O dossiê do relator (CG-048)** ocupa a aba Análise: "O que será analisado"
  (objetivo, período, redes, participantes e roteiro, reusando as linhas do
  Resumo), "Documentos anexados" (os arquivos, ao lado do checklist que diz o
  que a política exige — são perguntas diferentes) e **"Alterações desde a
  última decisão"**, que trouxe `missao.historico` para a tela pela primeira
  vez. **A janela tem duas bordas:** da última decisão até o reenvio. Sem a de
  baixo, a rodada já lida volta à lista; sem a de cima, entram mudanças
  posteriores ao envio, que são de **execução** e não da proposta — os dois
  eixos são independentes (CG-006) e a missão avança enquanto a análise corre.
  **O corte é por tempo, não por lista de campos**, que envelheceria em
  silêncio. A lógica vive em `lib/formularios/alteracoes-analise.ts` porque
  `node --test` não carrega `.tsx`.

  **A fila de análise (CG-047)** é a quarta aba da P17 (`?aba=analise`). **O que
  define a fila é a rodada aberta** (`encerrada_em is null`), não o
  `status_aprovacao` sozinho: os dois andam juntos hoje, mas quem responde
  "aguarda decisão desde quando" é a rodada. Ela reusa `listar` com dois filtros
  novos (`statusAprovacao` e `rodada`) — um serviço próprio duplicaria a
  superfície de filtro e divergiria na primeira mudança. **`rodada` casa com a
  rodada em aberto, nunca com a encerrada:** missão devolvida para ajustes
  aguarda quem a reenvie, não o Comitê. "Análise" e "reanálise" não são estados,
  são o número da rodada. `diasEsperando` conta dias civis em `America/Manaus`
  (`diasDesde`), e o destaque cai em **7 dias** porque a reunião é semanal —
  passar disso significa que a missão atravessou uma reunião. A fila carrega no
  máximo 100 e avisa quando há mais. **O recorte por rede do critério de aceite
  chegou com a CG-028** e valeu para a fila sem uma linha de mudança, porque ela
  usa o mesmo `listar` — era o que essa decisão comprava.

  **Fotos e evidências (CG-057)** ficam numa galeria própria na aba Documentos,
  separada da tabela: misturá-las faria a foto do jantar aparecer na lista dos
  documentos exigidos para aprovação. Os dois critérios de aceite já vinham da
  CG-051 — `podeVer` filtra `RESTRITA` na listagem **e** no download, e
  substituir preserva a versão anterior. **`autoria` não é `enviado_por`:** quem
  sobe o arquivo costuma ser a secretaria, e creditar a autoria a ela publicaria
  o nome errado; um é rastro interno, o outro sai na galeria. Metadados (data,
  local, autoria, visibilidade) valem para **toda a seleção**, porque descrevem
  a ocasião e não o arquivo — e é isso que torna aceitável não pedir legenda por
  foto. **Upload múltiplo é N requisições, não lote:** um lote obrigaria a
  escolher entre desfazer arquivos válidos e esconder a falha; um a um, o
  resultado honesto é o parcial. A foto é servida pelo próprio
  `/anexos/:id/conteudo`, sem miniatura gerada — um segundo caminho para a mesma
  imagem seria um segundo lugar para errar a autorização. **`RESTRITA` é visível a quem
  tem `documento:read-restrito` — `admin` e Comitê Gestor — e a quem enviou**
  (homologado em 2026-09-07). O Comitê entrou porque a matriz aprovada lhe dá
  leitura de todos os documentos, e a regra herdada da CG-014 o deixava de fora.
  A checagem era `roles.includes('admin')` dentro do serviço, papel no lugar de
  permissão — o que a indireção do §6 existe para evitar.

  **O painel do Comitê (CG-066)** é a seção *Panorama das missões*, na aba
  Visão geral, servida por `GET .../comite-gestor/painel?ano=&redeId=`.
  **Nenhum número dali é novo**: cada indicador reusa as expressões da lista de
  missões — situação temporal derivada de `current_date`, situação da prestação
  vinda de `coalesce` sobre o `left join` —, porque dois SQL que respondem à
  mesma pergunta divergem na primeira mudança e quem clica no cartão
  encontraria outra contagem do lado de lá. **Todo cartão é um link** com o
  filtro na URL, carregando o recorte ativo.

  **O recorte é o mesmo objeto `SQL`**, montado uma vez e passado a cartões,
  quebras e pendências — o critério de aceite fica garantido por construção, e
  não por disciplina de quem escrever a próxima consulta. Rede entra por
  `exists`, nunca por `join` (CG-016); as duas garantias foram verificadas por
  mutação.

  **Pendência é uma linha por missão, com todos os motivos juntos** — uma linha
  por motivo faria a lista prometer mais trabalho do que existe. Cada motivo
  diz de quem é a vez. São seis, todos da mesma forma (alguém precisa agir e
  não agiu); prestação em preenchimento normal não entra, e missão cancelada
  nunca entra. Rede que não é do ciclo **cai em "todas"**, não num painel de
  zeros, que seria indistinguível de um ciclo sem missão. Parceiro é a
  instituição cadastrada, nunca o nome digitado à mão; convênio conta pela
  missão de origem. A página busca os aportes **antes** do painel porque é
  deles que sai a lista de exercícios contra a qual o `?ano=` é conferido.

  **O consolidado por rede (CG-067)** é uma tabela dentro do mesmo painel, e
  não página nova — seria a terceira tela a apurar as mesmas missões, e a
  terceira a divergir. Cada rede traz missões, países, parceiros, eventos,
  convênios, produtos e despesa (validada e lançada em colunas separadas).
  **A linha "Total do ciclo" não é a soma da coluna, e a tela diz isso**: a
  missão de duas redes pertence às duas, e o total vem de um cômputo próprio
  sobre o recorte inteiro. Na prática as linhas somam 3 missões onde o total diz
  2 — sem o aviso, quem confere na calculadora acha que a tela erra. Contagem de
  alcance é `distinct`, e **dinheiro nunca passa por `join missao_rede`**
  (verificado por mutação). **Evento é contado pelo nome informado na
  atividade**, com espaços e caixa normalizados: D-10 deixou o cadastro de
  evento para a F2, então o mesmo congresso escrito de duas formas conta duas
  vezes — e o aviso viaja junto com o dado.

    **Missão encerrada não volta a "resposta indefinida" (CG-059).** Encerrar
  afirma que os requisitos foram atendidos, e o checklist é recalculado a cada
  leitura — remover o único produto depois faria a afirmação virar mentira em
  silêncio, deixando uma missão fechada exibindo pendência. **O congelamento é
  só o necessário:** recusa-se a operação que *zera a resposta* (remover o
  último produto sem declaração, ou limpar a declaração sem produto).
  Cadastrar, editar e remover um entre vários continuam liberados numa missão
  encerrada — o artigo publicado meses depois da viagem é o caso normal, e
  travar tudo empurraria o registro para fora do sistema. A saída é reabrir a
  missão, que deixa rastro de quem autorizou. Duas regras relacionadas: **missão
  que não aconteceu encerra** (roteiro inteiro `NAO_REALIZADA` é roteiro
  relatado; quem registra o fracasso é a avaliação `NAO`), e **missão cancelada
  não encerra** — com `pendencias` vazio, porque é impedimento, não pendência.

  **Cuidado ao criar helper para uma tela:** função exportada de módulo
  `"use client"` não pode ser chamada pelo Server Component. O build passa e a
  página responde 500 — foi o que aconteceu com as categorias de documento por
  tipo de despesa, hoje em
  [documentos-despesa.ts](apps/web/src/lib/formularios/documentos-despesa.ts).
  Lógica que os dois lados usam vai num `.ts` neutro.

  **Os papéis `gestor-rede` e `comite-gestor` já podem ser atribuídos**
  (CG-028, 2026-09-07): missões, painel, formulário e documentos consultam o
  escopo por rede. Um `gestor-rede` **sem vínculo de equipe vê lista vazia** —
  não o ciclo inteiro —, e é assim que a PROPESP descobre que falta cadastrar o
  vínculo. `comite-gestor` perdeu `prestacao:review`: a matriz aprovada reserva
  a validação da prestação ao Administrador.

  **Não iniciar a antiga CG-045:** obter o aceite
  institucional de CG-005 a CG-009 antes de alterar novamente o contrato da
  missão. O PDF não substitui silenciosamente as decisões confirmadas.

Na P10, a leitura segue `programa → rede → temática → PPG`. A rota `.../plano`
tem a aba **Visão geral** e uma aba por rede, persistida em `?rede=`; não crie
rotas ou serviços duplicados para cada rede. Cada participação PPG–temática
aponta para um `coordenadorTematicaId`; uma pessoa pode coordenar vários PPGs e
uma temática pode ter coordenadores diferentes conforme o PPG. O termo de
interface é **Coordenador de Temática**, não “membro do comitê”. Edição de linha
existente exige `plano:edit` (só `admin`), preserva código/rubrica e grava uma
entrada de auditoria por campo alterado. O exercício também fica em `?ano=`: somente
2027 vem composto; 2028–2030 começam vazios e nunca copiam a quantidade automaticamente.
- **Testes**: 154 unitários/regressões (68 API + 86 na web para toast, datas,
  React Hook Form/Zod, erros do multistep, formulários de parceiro,
  acessibilidade, contraste dos tokens, cálculos monetários, montagem de série
  do gráfico e caminhos do BFF) + 441 de integração contra Postgres
  real. As duas garantias de não duplicação da linha
  histórica do parceiro foram verificadas por mutação: trocar o `exists` +
  `selectDistinct` por um `join` faz ambas falharem.
- **Base de interface para o que vem**: `Recharts` com o primeiro gráfico na P09
  (total previsto por rede e exercício), `Combobox` com busca para as listas
  longas da CG-045, e TanStack Query sobre `/api/bff` com a lista de parceiros
  como referência. O MUI e o Emotion saíram — ver §8.
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
- Relatórios (P20), importação com adaptador por programa (P21) e produção
  consolidada (P18/P19). Documentos e evidências (P22) existem no escopo da
  missão desde a CG-051/CG-057; o que falta de P22 é fora do Comitê Gestor. O documento novo
  do Comitê propõe trazer parte de P18–P20/P22 para o fluxo da missão, mas a fase
  e a prioridade ainda dependem da CG-005. Produtos individuais por bolsa
  continuam em P03 e **não** foram reutilizados como produto de missão: a
  CG-056 criou domínio próprio (`produto_missao`), separado de `produto_bolsa`.
- Seleção de parceiro **dentro da missão**, conciliação pela interface e
  paginação da lista de parceiros. A CG-049 entregou o lado do parceiro
  (lista, busca, cadastro, edição, contatos e histórico); o que falta dela
  depende da CG-045, ainda bloqueada. A visibilidade por rede é a CG-028 —
  hoje parceiros e contatos são exclusivos do `admin`.
- **Escopo aplicado além de PPGs.** O recorte já existe e funciona (ver §6),
  mas por enquanto só a listagem e o detalhe de PPG o consultam. Plano, bolsas,
  orçamento, missões e parceiros continuam sem recorte — é trabalho mecânico,
  uma consulta por vez, e cada uma precisa de regressão própria.
- Cobertura ampla de componentes na `web`. O `node --test` carrega TypeScript em
  modo strip-only: não lê `.tsx` e recusa *parameter property*
  (`constructor(readonly x: number)`). Por isso a lógica testável mora em `.ts`
  ao lado do componente (`multistep-logica.ts`, `toast-logica.ts`,
  `orcamento-por-rede-serie.ts`) e o resto depende do `pnpm smoke:telas`. É a
  ferramenta ditando a estrutura, e some com um runner que renderize componente
  (Vitest + Testing Library).
- Interface e política definitiva de acesso dos documentos pessoais, além do
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
- **`pnpm ngrok:demo` publica os dados de desenvolvimento.** Ele usa API `3333`,
  web `3334`, Keycloak `8888` e gateway `3335`, com uma URL HTTPS única para web
  e autenticação. Mantém API/Postgres fora do túnel e altera temporariamente
  hostname/redirects do client OIDC. Encerre com `Ctrl+C` para restaurar o issuer
  e a porta local `8080`; após encerramento forçado, rode `pnpm infra:up` antes de
  voltar ao `pnpm dev`.
- **`apps/web/src/lib/acao.ts` é `server-only`.** Client Component que precisar do
  contrato das Server Actions importa de `acao-tipos.ts`. Importar `acao.ts` do
  cliente quebra o build de propósito — foi o que impediu `apiFetch` de vazar
  para o bundle do browser na primeira versão dos formulários.
- **`proxy.ts` enumera rotas públicas, não protegidas.** Com o sistema inteiro
  atrás de login, listar o que é protegido significaria lembrar de cada tela
  nova, e esquecer falharia em silêncio.
