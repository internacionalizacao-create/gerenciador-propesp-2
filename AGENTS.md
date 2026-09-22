# Gerenciador PROPESP — contexto do projeto

Documento de referência para quem (pessoa ou LLM) vai mexer neste repositório sem
tê-lo escrito. Descreve o que existe hoje, por que está assim, e o que ainda não
existe. **Mantenha-o atualizado quando mudar arquitetura ou convenção.**

Última revisão: 2026-09-21.

**Decisões da V1 em 2026-09-18:** todas as P1 incluídas; preparação para Docker;
backup diário de madrugada; validação atribuída por permissão, com responsáveis
nominais ainda a registrar. Na V1-015, CPF, e-mail pessoal e telefone não serão
enviados sem capacidade específica e alcance. Cadastro pode informar CPF sem
capacidade de leitura; edição preserva CPF ausente do payload e sua alteração
exige capacidade específica mais edição. Política aprovada **e implementada na
V1-015** no mesmo dia. Contrato e detalhes em
[docs/backlog-v1.md](docs/backlog-v1.md).

**Planejamento da V1 interna (2026-09-15):** a fila atual de trabalho está em
[docs/backlog-v1.md](docs/backlog-v1.md), com fichas detalhadas para execução
sob demanda. A [proposta de autorização](docs/proposta-autorizacao-v1.md)
registra o modelo aprovado pelo responsável em 2026-09-15: concessões individuais
de permissão + escopo na aplicação, Keycloak para autenticação e perfis como
modelos opcionais. O público é interno, sem autosserviço de bolsistas/externos.
Esses documentos não significam homologação institucional.
A V1-010 entregou o contrato em `apps/api/src/auth/autorizacao-v1/` (catálogo,
concessões Zod, modelos e política administrativa), com o inventário rota a rota
em [docs/contrato-autorizacao-v1.md](docs/contrato-autorizacao-v1.md).
A V1-011 criou a persistência dessas concessões (`concessao_acesso`, migration
`0040`) e **V1-012/V1-017 as puseram em execução em 2026-09-16**: o
`JwtAuthGuard` resolve o acesso da conta a cada requisição e preenche
`request.user.permissions`; `permissionsForRoles`, `ROLE_PERMISSIONS`,
`missao:all-redes`, o escopo global por papel `admin` e o modo permissivo
`RECORTE_OBRIGATORIO` deixaram de existir. **Sem concessão, sem acesso** — e
conceder é a API de `/acesso` (V1-017) ou a tela **Acessos**, em
`/configuracoes/acessos` (V1-018). **V1-019 pôs a interface no mesmo regime**
(2026-09-17): o menu é montado pelas ações concedidas, cada página confere o que
precisa antes de consultar, e tela fora do acesso responde **200 com explicação**
— nunca mais o erro genérico. **V1-013 foi concluída em 2026-09-17:** plano,
orçamento, painel, programas e ciclos recortam linhas e agregados pela ação de
leitura; alcance parcial mostra custo próprio sem expor teto ou saldo da
temática. **V1-014 também foi concluída em 2026-09-17:** criação, edição,
cancelamento, orçamento e referências de formulário usam o alcance da própria
ação. **V1-015 e V1-016 foram concluídas em 2026-09-18:** bolsas, produção,
panorama, exportação, histórico do parceiro, anexos e ficha PDF recortam pela
ação exercida, e CPF, e-mail e telefone só saem no JSON para quem tem a
capacidade específica **e** alcance sobre aquele alvo. `escopoDe` sobrou em
`ppgs.service.ts` e no `/me`, onde ainda descreve o escopo agregado da conta.
**V1-020 e V1-021 fecharam o bloco:** a matriz cruzada entrou em regressão — dois
ciclos, temática compartilhada, conta inativa e revogação — e o runbook de
ativação, o comando `acesso:contas` e o ensaio de rollback ficaram prontos.
**Conceder acesso às pessoas reais é ato de operação, não tarefa pendente:** a
tela de Acessos é agnóstica e o admin concede sob demanda, conforme cada pessoa
faz o primeiro login.

**Conta sem concessão não enxerga nada**, e isso é o comportamento certo. Em
desenvolvimento, o caminho curto é semear o administrador junto com a base:

```bash
pnpm db:seed --reset --admin-sub <id do usuário no Keycloak>
```

O `<id>` é o `sub` daquele realm, visível no console ou em `GET /me` depois do
primeiro login — ele muda a cada `kc:import --force`, e por isso não há valor
padrão. Sem `--admin-sub`, nenhuma conta é criada e o caminho continua sendo
`pnpm --filter api acesso:bootstrap --sub <sub> --motivo "..." --aplicar`
seguido de `./scripts/acesso-dev.sh`, que faz a dança de dois logins que a
política exige — ninguém amplia o próprio acesso, nem em desenvolvimento.

**Cuidado com o `acesso-dev.sh` num banco recém-resetado:** ele faz o login
OIDC, mas o vínculo local nasce em `GET /me`, que o script não chama. Abra a
aplicação (ou chame `/api/bff/me`) uma vez com cada conta antes de rodá-lo.

**O roteiro de ativação e de rollback está em
[docs/ativacao-acesso-v1.md](docs/ativacao-acesso-v1.md)** (V1-021e): instalação
nova, primeiro administrador, retirada das contas de demonstração e as cinco
saídas de rollback. A regra que governa todas elas: **voltar atrás preserva a
restrição** — não existe chave que reabra a leitura para todos, e a ausência
dela é o desenho, não uma lacuna. `pnpm --filter api acesso:contas` desativa e
reativa conta por comando local, e **recusa desativar o último administrador
recuperável**: desativar fecha tudo de uma vez, `acesso:*` incluído, e uma
instalação sem administrador ativo não consegue conceder nada a ninguém.

**Decisão do responsável, 2026-09-16: em produção o Keycloak só autentica.**
Nenhum papel de negócio é criado ou atribuído lá; quem responde "o que esta
pessoa pode fazer, e sobre o quê" é `concessao_acesso`, concedida pelo admin na
aplicação, ação a ação. A implantação começa com a base consolidada (catálogo,
PPGs, programa, ciclo, redes) e, desde **2026-09-18**, com **um administrador
semeado**: `pnpm db:seed --admin-sub <id do Keycloak>` grava a conta e o catálogo
inteiro em GLOBAL. As demais contas são cadastradas depois, pela tela de
administração (V1-018).

**Isso contraria o desenho anterior, e o responsável decidiu assim sabendo
disso.** O argumento contra semear continua escrito em
[bootstrap.ts](apps/api/src/auth/autorizacao-v1/bootstrap.ts): instalação que
nasce com conta previsível de acesso total não distingue o administrador
legítimo de quem apenas conhece o padrão. **O que segura o risco é não haver
padrão algum** — sem `--admin-sub` nenhuma conta é criada, não há busca por
e-mail nem "primeiro usuário do realm", e o `sub` muda a cada import do realm,
então a conta semeada só existe se alguém olhou aquele Keycloak e digitou o
identificador. `pnpm --filter api acesso:bootstrap` (V1-021a) continua existindo
e continua sendo o caminho quando não se quer conta semeada — comando local, sem
rota HTTP equivalente, prévia por padrão, que concede só as capacidades de
gestão de acesso e recusa quando já existe administrador recuperável.

Por isso **não existe conversão do acesso legado**: numa base que começa limpa
não há o que converter. O planejador e o relatório de conversão, escritos na
V1-011, foram removidos em 2026-09-16 junto com os dados de acesso emulados no
banco de desenvolvimento. O que sobreviveu daquela tarefa é a tabela, o
mapeamento alvo↔colunas (`autorizacao-v1/persistencia.ts`) e o bootstrap.
Antes de iniciar uma task, confira suas dependências e o código: o
[diagnóstico de 2026-09-15](docs/diagnostico-v1-2026-09-15.md) registra divergências
entre descrições antigas abaixo e funcionalidades já entregues.

---

## 1. O que é o sistema

Sistema de gestão da PROPESP (Pró-Reitoria de Pesquisa e Pós-Graduação) para o
PPGE e demais programas de pós-graduação, com foco no planejamento de recursos
de internacionalização: bolsas, orçamento por rede e área temática, mobilidade
IN/OUT e resultados individuais. Uso institucional, dados pessoais de alunos e servidores — o
que justifica o rigor na parte de autenticação/autorização.

**É um gerenciador, e só** (decisão do responsável, 2026-09-19). A fonte do que
acontece de fato é a plataforma da CAPES: é lá que a bolsa é implementada, o
recurso é remanejado e o bolsista desiste. **Manter o Gerenciador atualizado é
responsabilidade de quem o usa**, não obrigação do sistema.

Três consequências de desenho, e elas valem para qualquer módulo novo:

1. **Não existe sincronização com a CAPES** — nem integração, nem importação
   automática, nem conferência contra a plataforma. Nada aqui tenta adivinhar o
   que mudou lá. Carregar uma planilha que alguém entrega (V1-073) é outra
   coisa: continua sendo alguém registrando, com prévia e conferência humana.
2. **O sistema confia no que o usuário registra.** Status informado à mão é o
   status; não há validação contra fonte externa porque não há fonte externa
   acessível.
3. **Divergir não é erro do sistema.** Se o plano aqui não reflete a CAPES, o
   que falta é alguém registrar — e a saída é a tela que registra, nunca um
   alerta de "dado possivelmente desatualizado", que só transferiria para a
   interface uma dúvida que o sistema não tem como resolver.

Isso não afrouxa o rigor no que é **próprio** do Gerenciador: cálculo, recorte
de acesso e trilha de auditoria continuam exatos, porque deles o sistema é a
fonte.

**Estado atual: o núcleo de planejamento está de pé.** Autenticação, modelo de
dados com a seed real, serviços de cálculo (RN-01 a RN-20), telas de planejamento
anual e o cadastro individual de bolsas/produtos existem e são verificados. As planilhas
não fornecem beneficiários, então P03 começa vazio e será alimentado pela equipe.
No CAPES Global não há execução financeira na UEA: a CAPES paga diretamente. Falta
o registro histórico de movimentações externas, relatórios e dashboards,
panorama/mapa de mobilidade e o escopo local por PPG/temática na autorização.
**O módulo do Comitê Gestor está completo**: cadastro, aprovação, prestação,
abatimento do aporte, produtos, evidências, encerramento com checklist, escopo
por rede, painel, relatórios, exportação e caixa de entrada. As 69 tasks do
backlog estão fechadas, e a folha de homologação, inteiramente marcada. Ver §9.

A visão de arquitetura e os fluxos de negócio/técnicos estão em
[docs/arquitetura-sistema.md](docs/arquitetura-sistema.md). A especificação
funcional completa — 23 páginas previstas na origem, mais a P24 de parceiros,
vinda do escopo ampliado do Comitê Gestor — está em
[system-structl.md](system-structl.md).

---

## 2. Stack e versões

| Peça | Versão | Observação |
|---|---|---|
| Node | 24.20.0 | fixado em [.nvmrc](.nvmrc) — rode `nvm use`; o CI lê o mesmo arquivo |
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
        permissions.ts        reexporta o tipo Permission do catálogo V1
        permissions.guard.ts  aplica @RequirePermission (global)
        token-verifier.service.ts  valida o JWT contra o JWKS do realm
        identidade.service.ts liga `sub` do Keycloak a `pessoa`; deriva escopo
        escopo.ts             traduz escopo em condição SQL
        autorizacao-v1/       catálogo, concessões, modelos e resolver de acesso
          catalogo.ts           as ações e os alvos que cada uma aceita
          acesso-v1.service.ts  resolve as concessões da conta por requisição
          alcance.ts            compõe o alcance e o traduz em SQL
          concessoes.service.ts administração das concessões (V1-017)
          bootstrap.ts          primeiro administrador, por comando local
        desativacao.ts        desativa e reativa conta, por comando local
        acesso.controller.ts  concede, revoga e reassocia pessoa
        me.controller.ts      GET /me, GET /me/acesso e a sonda restrita
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
        eventos-externos.service.ts  P12 — eventos da CAPES e movimentações (V1-036)
        ciclo.service.ts      P06/P07/P08/P17 e dados internos de premissas/fontes
        ppgs.service.ts       P14
        pendencias.service.ts P13 (sem tela; consulta e resolucao pela API)
        comite-gestor.service.ts  P17 — pessoas e equipes
        missoes-comite.service.ts P17 — criação, consulta, edição, ciclo de vida e relato de missões
        resultados.service.ts  CG-056 — produtos da missão e convênios do parceiro
        encerramento.service.ts   CG-058 — checklist de encerramento e dispensas
        *.controller.ts       rotas REST, uma permissão por endpoint
      config/env.ts        validação de ambiente com zod (falha no boot)
      database/            schema Drizzle, migrations e seed
        seed/admin.ts        administrador semeado, so com --admin-sub
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
        acesso.ts          o que falta para a tela abrir; nomes do catálogo
        me.ts              /me e /me/acesso, deduplicados por requisição
        navegacao.ts       menu por capacidade, e o que ainda não existe
      acoes/               Server Actions (ppgs, plano, bolsistas, catalogo)
      componentes/
        layout/            menu lateral, sub-nav do ciclo, troca de tema
        ui/sidesheet.tsx   painel lateral sobre <dialog> nativo
        ui/multistep.tsx   formulário em etapas, tudo montado num <form> só
        ui/campos.tsx      inputs, chips, marcadores
        ui/basicos.tsx     Página, Seção, Cartão, Tabela, Moeda, Selo, Aviso
        ui/toast.tsx       feedback global de ações, com provider e hook
        ui/sem-acesso.tsx  a tela de quem não tem a permissão daquela página
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
          catalogos/                  P15 e P23, com cadastro e edicao (admin)
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
  smoke-acesso.sh          duas contas, dois recortes: a matriz pela sessão real
  db-comum.sh              base dos scripts de banco (container, credenciais, avisos)
  db-backup.sh             dump + anexos + inventário; --congelar define o baseline
  db-restaurar.sh          devolve o banco a um backup, conferindo a contagem
  db-zerar.sh              esvazia o operacional, preserva a base e os logins
  db-inventario.sql        contagem exata de linhas por tabela
  acesso-dev.sh            provisiona acesso das contas de teste (só desenvolvimento)
  api.sh                   chama a API autenticado, pelo BFF (atos ainda sem tela)
docs/
  autenticacao.md          detalhamento da arquitetura de auth
  eventos-externos-v1.md   contrato da P12 e dos eventos de bolsista (V1-035)
  retencao-v1.md           o que se guarda, por quanto tempo, e o que falta decidir
  migracao-ui.md           inventário e padrões da migração da UI local
  guia-cadastro-do-zero.md roteiro do fluxo completo com o banco zerado
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

Os papéis destes usuários **não concedem mais nada** (V1-012): servem só para
reconhecer a conta no console. Para que qualquer um deles enxergue algo, é
preciso conceder — pelo bootstrap (`pnpm --filter api acesso:bootstrap`, que dá
só a gestão de acessos) e depois pela API de `/acesso`.

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
pnpm db:seed --reset    # APAGA o dominio e recarrega a base estrutural
pnpm db:studio          # inspetor visual do Drizzle
```

**A seed sobe a base estrutural, não a planilha inteira** (decisão de
2026-09-18). Programa, ciclo, redes, temáticas, participações, PPGs,
modalidades, catálogo, teto anual e aporte do Comitê entram; plano de aplicação,
equipes do Comitê e pendências ficam de fora, porque a interface os cadastra. O
corte segue a classificação de [db-zerar.sh](scripts/db-zerar.sh), e não uma
lista própria — duas definições de "base" divergiriam na primeira tabela nova.

```bash
pnpm db:seed --reset --admin-sub <id>   # ja deixa o administrador pronto
pnpm db:seed --reset --com-dados        # inclui plano, equipes e pendencias
```

**`--com-dados` é o que o teste de aceite da migração exige:** sem plano não há
custo, saldo nem utilização para conferir contra `system-structl.md` §8.3. A
função `executarSeed` mantém `operacional: true` como padrão justamente para que
os testes de integração não precisem saber disso; quem inverte é a CLI.

### Congelar, restaurar e zerar o banco

```bash
pnpm db:congelar                 # dump + anexos + inventario em backups/, como baseline
pnpm db:backup -m "rotulo"       # snapshot datado, sem mexer no baseline
pnpm db:restaurar                # volta ao baseline (ou a um .dump informado)
pnpm db:zerar                    # esvazia o operacional; preserva base e logins
pnpm db:zerar --com-catalogo     # zera tambem modalidades e itens de catalogo
pnpm api GET me                  # chama a API autenticado, pelo BFF
```

**`pnpm db:zerar` não é `pnpm db:seed --reset`.** O reset apaga tudo — inclusive
as contas e as concessões, que o `db:zerar` preserva — e recarrega a base do
zero. Os dois chegam a um estado parecido por caminhos diferentes: o `db:zerar`
**mantém** quem já estava configurado, e o reset devolve o banco ao dia um. O
`db:zerar`
esvazia só o que a interface alimenta (35 das 56 tabelas), e **falha se aparecer
tabela nova não classificada** — sem essa checagem, a tabela da próxima migration
sobreviveria à zeragem em silêncio.

Os vínculos de `usuario_sistema` e os escopos ficam, o `admin` incluído: o login
continua funcionando porque o Keycloak é outro banco, e preservar o vínculo evita
que `/me` recrie a pessoa com identidade nova e escopo vazio.

**O backup inclui `apps/api/arquivos/`.** Anexo vive fora do banco; restaurar só
o dump devolveria linhas de `anexo` cujo download responde 404.

**Os três comandos encerram as conexões ao banco, e isso derruba a API** — sem
encerrá-las, `truncate` e `drop schema` ficam presos no lock do pool. O processo
do Nest termina e o `--watch` não o reinicia, porque nenhum arquivo mudou:
reinicie o `pnpm dev`. Os scripts avisam quando detectam a API no ar.

O roteiro de cadastro sobre a base zerada está em
[docs/guia-cadastro-do-zero.md](docs/guia-cadastro-do-zero.md), com os atos que
ainda não têm tela (confirmar missão, produto de missão, convênio, pendência) e
a chamada de `pnpm api` de cada um.

O banco de testes (`gerenciador_test`) precisa existir uma vez:

```bash
docker exec gerenciador-api-db psql -U gerenciador -d postgres \
  -c "CREATE DATABASE gerenciador_test;"
```

### Build reproduzível

**O build não precisa de internet** (V1-052, 2026-09-19). Ele precisa de
`pnpm install`, como qualquer projeto; o que saiu foi a busca de um arquivo de
terceiros **no meio da compilação do código**.

A tipografia vinha de `next/font/google`, que baixa os `.woff2` durante o build
e depois os serve do próprio domínio. O runtime nunca falou com o Google — o
build sim, e um build de intranet que depende de saída para a internet é um
build que quebra no dia em que a saída não existe. Hoje as fontes vêm do pacote
`geist`, que as traz em `node_modules` e as carrega por `next/font/local`.

**Os nomes das variáveis CSS não mudaram** (`--font-geist-sans`,
`--font-geist-mono`), então `globals.css` e os tokens ficaram intactos. O import
de volta é uma linha, e a falha só apareceria num servidor sem rede: por isso
[test/fontes.test.mjs](apps/web/test/fontes.test.mjs) o barra, junto com
`@import` de fonte externa no CSS — esse seria pior, porque faria o **navegador**
de cada pessoa buscar no Google.

Para conferir num ambiente isolado de verdade:

```bash
rm -rf apps/web/.next
unshare -rn sh -c 'ip link set lo up; apps/web/node_modules/.bin/next build'
```

O `ip link set lo up` é necessário porque o Turbopack conversa com os próprios
processos por loopback — sem ele a falha é de isolamento, não de rede externa.

**`.nvmrc`, CI e operação usam o mesmo Node.** O CI lê o arquivo
(`node-version-file: .nvmrc`) e o pnpm sai de `packageManager` no
`package.json`. Ao mudar de versão, mude o `.nvmrc` — é dele que os outros dois
derivam.

### Verificação

```bash
pnpm lint && pnpm build && pnpm test        # raiz: lint, build, unitarios
pnpm --filter api test:int                  # integracao (exige Postgres no ar)
pnpm smoke:login                            # fluxo de login completo, apps no ar
pnpm smoke:login docente.teste docente123   # confere o 403 do endpoint restrito
pnpm smoke:telas                            # abre cada tela e confere os numeros
pnpm smoke:acesso                           # a matriz de acesso, por perfil
pnpm test:e2e                               # jornadas no navegador (Playwright), ambiente descartável
```

**`pnpm test:e2e` (V1-059)** não usa os serviços de desenvolvimento: sobe
Postgres e Keycloak próprios (`gerenciador-e2e`, portas 33058/33059/35459/38459),
faz o build de produção, semeia cada jornada do zero e derruba tudo no fim. As
jornadas vivem em `apps/web/e2e/`. Ela já achou defeito que teste de fonte não
via: o campo `Data` controlado apagava a data que o React Hook Form preenchia, e
as edições abriam em branco.

**Integração no CI (V1-058):** o job `integration` provisiona Postgres 17
com healthcheck e executa `pnpm --filter api test:int --no-cache`. Node vem de
`.nvmrc` e pnpm de `packageManager`, nos dois jobs. Instala `poppler-utils`,
`unzip` e `libreoffice-calc` para ler os arquivos exportados de verdade.
Cada suíte aplica migrations e prepara suas fixtures; `seed-aceite` carrega a
seed operacional e confere seus indicadores. `maxWorkers: 1` mantém as suítes
serializadas; não execute dois comandos de integração sobre o mesmo banco.

**A trava de testes aceita somente `gerenciador_test` em loopback**, sem query
ou fragmento na URL. O servidor precisa confirmar `current_database()` antes
de migrations e de cada limpeza. Não use esse nome para dados reais nem
encaminhe a porta local para um banco institucional. O `globalSetup` verifica
conexão e utilitários antes das suítes; falha de conexão tem mensagem única,
sem senha. Os pools são fechados se a preparação falhar, e teardown tolera
contexto não criado. `pnpm --filter api test:infra` verifica essa proteção,
incluindo conexão recusada, sem precisar de Postgres disponível.

`test:int` inclui o **teste de aceite da migração**: com a seed carregada, o
sistema tem que reproduzir os indicadores das planilhas
([system-structl.md](system-structl.md) §8.3). Se algum falhar, ou a fórmula está
errada ou o dado migrou sujo.

`smoke:acesso` (V1-020) cobre a outra metade: o `smoke:telas` percorre as telas
de **uma** conta que enxerga tudo, e este prova que **duas contas veem coisas
diferentes** — quais ações `/me` devolve, se a tela fora do alcance responde 200
com a explicação certa das três de `SemAcesso`, se a API recusa com 403 o que a
tela esconde, e se revogar vale na requisição seguinte. Ele afirma sobre o
**acesso**, nunca sobre o volume, e por isso roda igual depois de qualquer seed.

`smoke:telas` fecha o círculo do outro lado: faz login de verdade, abre cada
tela e procura os números na resposta HTML. **Ele pressupõe `--com-dados`**
desde que a seed passou a subir só a base (2026-09-18): sem as linhas da
planilha, as asserções de número não têm o que encontrar. É o que impede um serviço correto de
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

Desde 2026-09-16 (V1-012): o Keycloak autentica, e quem autoriza são as
concessões individuais guardadas na aplicação.

```
Keycloak emite:  sub (quem é a pessoa) — o papel não concede nada
Guard resolve:   concessao_acesso(sub) -> ações + alcance de cada uma
Controller pede: @RequirePermission('plano:create')
```

O catálogo vive em
[autorizacao-v1/catalogo.ts](apps/api/src/auth/autorizacao-v1/catalogo.ts) e o
resolver em
[acesso-v1.service.ts](apps/api/src/auth/autorizacao-v1/acesso-v1.service.ts);
`permissions.ts` sobrou como reexportação do tipo. Uma consulta por requisição,
**sem cache** — é o que faz a revogação valer na requisição seguinte.

**Para adicionar uma permissão nova:**

1. Acrescente a chave em `CATALOGO_PERMISSOES_V1`, com rótulo em português e os
   tipos de alvo que ela aceita.
2. Use `@RequirePermission('sua:permissao')` no handler.
3. Acrescente a rota ao inventário de
   [docs/contrato-autorizacao-v1.md](docs/contrato-autorizacao-v1.md).
4. Se a ação couber num modelo, inclua-a em `modelos.ts` — modelo é ponto de
   partida da tela, não papel: editá-lo não muda quem já foi configurado.
5. Se ela destrava uma tela, ponha-a no `exige` do item de menu e na porta da
   página (§8): sem isso, ou a tela não aparece para quem pode, ou aparece para
   quem a API vai recusar.

**Duas formas que o decorador não expressa**, e por isso moram no handler: ação
que depende do corpo (a transição de situação da missão confere
`missao:confirm`/`cancel`/`close` conforme o destino) e permissão que só se
conhece em runtime (a exportação de relatório exige a leitura daquele relatório
mais a exportação do domínio).

**Não crie papel novo no realm** esperando que ele conceda algo: papel deixou de
ser fonte de autorização. O equivalente é um **modelo** em `modelos.ts`, que a
tela oferece como ponto de partida e que vira concessões explícitas ao ser
aplicado.

### Identidade local e escopo de acesso

Papel responde **o que pode fazer**. Desde 2026-09-05 há mais duas perguntas,
em tabelas separadas de propósito:

| Pergunta | Onde vive |
|---|---|
| Quem é? | `usuario_sistema` — liga `sub` a `pessoa` |
| O que pode fazer, e sobre o quê? | `concessao_acesso` — esta conta, esta ação, este alvo |

O alvo é `GLOBAL`, `CICLO`, `PPG`+ciclo, `REDE`, `TEMATICA` ou `PARTICIPACAO`.
**As duas perguntas vivem na mesma linha** desde V1-012, porque é assim que elas
são feitas: não "quais PPGs esta conta enxerga", mas "em quais PPGs ela pode
lançar bolsa" — e a resposta pode diferir da de "consultar o plano".

`escopo_acesso` foi removida na migration `0041`: toda autorização e todo
alcance vêm de `concessao_acesso`. O vínculo de equipe continua sendo fato de
cadastro, não concessão.

**O vínculo se faz no primeiro acesso, por e-mail.** O admin cria a conta no
Keycloak com o mesmo e-mail da pessoa já cadastrada e
[identidade.service.ts](apps/api/src/auth/identidade.service.ts) liga as duas em
`GET /me` — é o caminho das pessoas já registradas em missões. Sem
correspondência, cria pessoa nova: recusar o login deixaria o usuário preso sem
nenhuma tela para pedir ajuda. Criar pessoa **não concede acesso** — a conta
nasce sem concessões e a atribuição é feita pelo administrador na tela
**Acessos**.

O vínculo acontece em `/me`, e não no guard: o guard roda em toda requisição, e
pagar uma escrita por chamada para resolver algo que muda uma vez na vida da
conta seria desperdício.

**Sem concessão, sem dado.** O modo permissivo (`RECORTE_OBRIGATORIO`) existiu
enquanto a permissão vinha do papel e o escopo de ninguém estava configurado;
saiu com V1-012, porque conta não configurada já não tem ação alguma a exercer e
um recorte permissivo só vazaria dado de quem foi configurado pela metade —
alguém com alcance de rede veria todos os PPGs.

Uma sutileza que a implementação ingênua erra: quem tem alcance **de rede** e
nenhum de PPG não está "sem configuração" — foi configurado para outra dimensão,
e liberar todos os PPGs para ele seria vazamento.

O recorte entra **na consulta**, nunca numa filtragem em memória: filtrar fora
do banco traz a tabela inteira para a aplicação e vaza a contagem real em
qualquer soma feita antes do filtro. PPG fora do escopo responde **404, não
403** — "existe, mas não é seu" já entrega que o PPG existe.

**Escopo por rede no módulo de missões (CG-028).** Desde 2026-09-07 o recorte
vale para missões, e não só para PPGs. Três coisas o definem:

1. **"Minha rede" é o alcance de `missao:read`** — desde V1-012, e não mais o
   vínculo de equipe, que virou fato de cadastro sem efeito de acesso.
2. **"Ver todas as redes" é concessão, não permissão.** `missao:all-redes` não
   existe mais: quem decide sobre as três redes tem `missao:read` em `GLOBAL`, e
   concessão por ciclo alcança as redes daquele ciclo. Isso não concede escrita
   nenhuma — a escrita é outra ação, com o seu próprio alcance.
3. **Missão sem rede cadastrada** (anteriores à CG-016) só aparece para quem não
   é recortado; é o que `RecorteDeMissoes.semRecorte` responde.

O recorte de leitura de **uma** missão é o `EscopoMissaoGuard`, global: as
rotas de missão têm todas a mesma forma, e verificação espalhada por serviço é
verificação que a próxima rota esquece. Ele responde **404, nunca 403**. A
**listagem** continua se recortando na consulta. A **escrita** é separada:
`validarRedes` recusa criar ou mover missão para rede alheia, e retirar de uma
missão multirrede a rede que você não alcança é 403. **Documento herda o escopo
do alvo**, senão o anexo seria a porta lateral do recorte.

**A granularidade apertou, e a indireção pagou-se**: trocar a fonte de
autorização de papel para concessão individual não exigiu que nenhum controller
mencionasse papel, porque nenhum mencionava. O que mudou foi de onde
`user.permissions` vem, mais a troca dos nomes das ações pelos do catálogo.

---

## 7. Convenções de código

- **Código interno não aparece na tela.** `RN-09`, `CG-028`, `D-10`, `PEND-006`
  vão em comentário, teste e documentação — nunca em rótulo, nota, dica ou
  mensagem de erro. Na tela, a regra se explica pelo que ela faz ("aporte
  anual repetido nos 4 exercícios"), não pelo número dela. A limpeza de
  2026-09-10 tirou 33 ocorrências (web e API) e achou três que, além do código, afirmavam
  como futuro o que já estava entregue ("o escopo por rede entra na CG-028").
  Nota que conta a história da implementação envelhece; nota que explica o
  número, não.
- **Idioma.** Domínio, mensagens de erro ao usuário e comentários em português.
  Comentários **sem acentuação** (padrão do repositório); **texto que o usuário
  lê é sempre acentuado**. A distinção importa porque a fronteira não é óbvia:
  a mensagem de uma exceção da API chega inteira à tela, repassada por
  `traduzirErro` ([acao.ts](apps/web/src/lib/acao.ts)), e por isso conta como
  texto de interface, não como comentário. Em 2026-09-09 as mensagens e rótulos que
  ainda estavam sem acento foram corrigidos (197 strings, 26 arquivos de
  `apps/api/src`), junto das asserções de teste que casavam com o texto antigo. Identificadores de código e nomes de
  permissão seguem em inglês minúsculo (`plano:write`) e **não se acentuam nem
  dentro de uma mensagem** — `Permissão necessária: prestacao:read`.
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
  que estava ativo. **A cor de uma rede sai do nome, nunca da posição**:
  `identidadeDaRede` em [lib/redes.ts](apps/web/src/lib/redes.ts) dá à rede a
  mesma cor na P10, na P09 e na P01, junto com `chaveDaRede` (o `?rede=`). Até
  2026-09-10 o gráfico da P09 coloria pelo índice e, em ordem alfabética, dava
  à UFMG a cor que a P10 dá à UNESP. O resto usa `CORES_SERIE`.
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
  `window.history.pushState`, restaurada por `popstate` — sem isso, quem manda
  o link de uma busca mandaria a lista inteira. Retry não insiste em 4xx: 401/403 não melhoram.
- **`initialData` só vale na criação da consulta.** Depois de uma Server Action
  o servidor manda a lista nova e o cache continuaria mostrando a velha — o
  parceiro gravava e não aparecia. A lista de parceiros regrava o cache e
  invalida `["parceiros"]` quando `dadosIniciais` muda. Os formulários também
  invalidam consultas inativas após salvar. A lista usa `refetchOnMount: "always"`
  para conferir snapshots restaurados pelo histórico do Next: a primeira
  pintura continua no servidor, com uma conferência pelo BFF após montar.
- **Server Action revalida a rota real, não um apelido.** A tela de parceiros
  mora em `programas/[programa]/[ciclo]`; `revalidatePath("/parceiros")` não
  revalidava nada. Quando a ação não conhece os segmentos, use o padrão com
  o tipo: `revalidatePath("/programas/[programa]/[ciclo]/parceiros", "page")`.

### Peças de interface que valem conhecer antes de criar outras

| Peça | Onde | Para quê |
|---|---|---|
| `Sidesheet` / `AbrirSidesheet` | [ui/sidesheet.tsx](apps/web/src/componentes/ui/sidesheet.tsx) | Todo cadastro entra por painel lateral. É `<dialog>` nativo — foco preso, `Esc`, fundo inerte e `::backdrop` vêm do navegador. O conteúdo permanece montado durante a animação de saída. |
| `RodapeDoPainel` / `CLASSE_CORPO_PAINEL` | [ui/painel-formulario.tsx](apps/web/src/componentes/ui/painel-formulario.tsx) | Corpo rolável (`px-6 py-5`, sem `space-y`: os campos já trazem `mb-4`) e rodapé com `Botao` de todo formulário em sidesheet. Existe porque onze formulários do Comitê e do bolsista escreviam isso à mão e colavam os campos na borda. |
| `Multistep` | [ui/multistep.tsx](apps/web/src/componentes/ui/multistep.tsx) | Formulário longo em etapas. **Todos os passos ficam montados** e o inativo usa o atributo `hidden`: só assim o `FormData` do submit traz o formulário inteiro, e campos `required` de passo oculto não travam o envio. |
| `Selecoes` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Grupo de caixas de seleção que devolve uma lista (as redes de uma missão, por exemplo). É `fieldset`/`legend`, e todas as caixas compartilham o `name`: o React Hook Form junta as marcadas em array e o `FormData` as devolve em `getAll`. |
| `Texto` / `Selecao` / `Data` / `AreaTexto` | [ui/campos.tsx](apps/web/src/componentes/ui/campos.tsx) | Campos visuais aceitam `registro={register("campo")}` do React Hook Form e mantêm os tokens e mensagens acessíveis do sistema. |
| `useErrosDaAcao` | [ui/formulario.ts](apps/web/src/componentes/ui/formulario.ts) | Reaplica os erros de campo devolvidos pela API no React Hook Form; use um mapa apenas quando o nome da API diferir do nome visual. |
| `RolagemHorizontal` | [ui/rolagem.tsx](apps/web/src/componentes/ui/rolagem.tsx) | Envolve conteúdo que rola na horizontal — a `Tabela` já usa. Dá `tabIndex` ao contêiner **só quando ele transborda de verdade**, medido no cliente: fixo criaria parada de tabulação morta em cada tabela numa tela larga, e ausente deixa as colunas escondidas inalcançáveis pelo teclado. |
| `Combobox` / `CampoCombobox` | [ui/combobox.tsx](apps/web/src/componentes/ui/combobox.tsx) | Seleção única **com busca**, para lista longa (as 200+ instituições da CG-045). Lista curta continua no `Selecao` nativo, que já vem acessível e não carrega JavaScript. O valor sai num `<input type="hidden">`, então o `FormData` do `Multistep` continua trazendo o campo; no React Hook Form vai por `Controller`, não por `register`. |
| `Grafico` / `DicaMoeda` | [ui/grafico.tsx](apps/web/src/componentes/ui/grafico.tsx) | Moldura responsiva do Recharts com `<figure>`/`<figcaption>`: o SVG é uma árvore de `<path>` sem texto útil, e sem a legenda amarrada o gráfico some para quem usa leitor de tela. |
| `CartaoKpi` / `BarraDeProporcao` | [painel/kpis.tsx](apps/web/src/componentes/painel/kpis.tsx) | Indicador com barra e linha de contexto — número sozinho diz pouco. A barra é `aria-hidden` porque o valor já está escrito, e com `semaforo` segue a faixa da RN-07. |
| `identidadeDaRede` / `chaveDaRede` | [lib/redes.ts](apps/web/src/lib/redes.ts) | Cor e `?rede=` de cada rede, pelo nome. Toda tela que pinta ou linka rede passa por aqui. |
| `Botao` | [ui/botao.tsx](apps/web/src/componentes/ui/botao.tsx) | Variantes com CVA (`primario`, `contorno`, `suave`, `fantasma`, `perigo`). `comoFilho` renderiza num `<Link>` em vez de `<button>`. |
| `SemAcesso` | [ui/sem-acesso.tsx](apps/web/src/componentes/ui/sem-acesso.tsx) | A resposta da página que o acesso da conta não cobre: 200 com explicação, e três textos distintos (vínculo pendente, conta sem concessão, acesso que não cobre esta tela). Use junto de `faltando` ([lib/acesso.ts](apps/web/src/lib/acesso.ts)), **antes** de consultar a API. |
| `Moeda` | [ui/basicos.tsx](apps/web/src/componentes/ui/basicos.tsx) | Nulo vira *A definir* em itálico, **nunca** R$ 0,00 (§9.2 da especificação). |
| `somarMoeda` | [lib/formato.ts](apps/web/src/lib/formato.ts) | Soma em centavos com `BigInt`. Dinheiro nunca passa por `number` antes de uma conta. Cada parcela é truncada para centavos **antes** da soma, e a ordem importa: mil parcelas de 8,615 dão 8.610,00 aqui e 8.615,00 numa soma em `number` — está fixado em `test/dinheiro.test.mjs`. Se **tudo** for nulo o resultado é nulo, nunca zero. |
| `ToastProvider` / `useToastDaAcao` | [ui/toast.tsx](apps/web/src/componentes/ui/toast.tsx) | Confirma ações depois que o sidesheet fecha. Erros de validação continuam junto ao formulário. |

**Ajustes de usabilidade de 2026-09-14:** as notificações globais aparecem no
canto superior direito. `Pagina.voltar` oferece um botão com seta acima do
título, usado nos detalhes de PPG e temática. `Ajuda` em
[ui/ajuda.tsx](apps/web/src/componentes/ui/ajuda.tsx) explica títulos por mouse,
foco ou toque, com fechamento por `Esc` e posicionamento fora da rolagem da
tabela. Os textos financeiros ficam em `lib/ajuda-orcamento.ts` e acompanham
as fórmulas da API: **saldo de bolsas não inclui manutenção e missões**.
No catálogo, os cartões mostram itens publicados, modalidades com valor e
itens por destino; versão, data-base e câmbio ficam em uma linha de contexto.
Fonte continua no cadastro, mas saiu da tabela principal.

**Validação do PPG:** o formulário usa `noValidate` para que um campo inválido
em etapa oculta não bloqueie o envio antes do React Hook Form. Todos os campos
estão mapeados por etapa e os erros fazem a navegação voltar ao campo a corrigir.
Os limites do schema do cliente acompanham `ppgSchema` na API; conceito CAPES
é inteiro. Mantenha estável o mapa passado a `useErrosDaAcao`: recriá-lo a cada
render reaplica os erros do servidor continuamente. Sigla duplicada retorna
409 com erro associado ao campo, tanto no cadastro quanto na edição.

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
rodapé. **Mostra só o que existe** desde 2026-09-10: os módulos futuros seguem
em [navegacao.ts](apps/web/src/lib/navegacao.ts) com `disponivel: false` e o
motivo, mas o `MenuLateral` os filtra — item "em breve" lia como sistema
inacabado nas apresentações. No celular ele continua como gaveta completa. Preserve esse comportamento
ao incluir novos itens: todo item precisa de rótulo acessível mesmo quando apenas
o ícone estiver visível.

**Desde V1-019 o menu também filtra por capacidade**: cada item declara em
`exige` as ações da tela dele, e quem não as tem não o vê. São dois filtros com
razões diferentes — `disponivel` é escopo futuro, `exige` é acesso —, e juntá-los
faria o módulo por vir sumir da régua num ambiente sem concessões. Item novo
precisa de `exige` com **as mesmas ações que o guard cobra** do endpoint
principal da tela; e a tela, da porta correspondente (`faltando` + `SemAcesso`),
senão o link some do menu e a URL continua respondendo erro.

---

## 9. O que existe / o que não existe

**Existe:**

- **Autenticação/autorização**: login e logout OIDC completos, sessão renovada
  automaticamente, guards globais, catálogo de permissões, realm versionado.
- **Documentos do bolsista (BOL-021/BOL-022, 2026-09-09)**: `BOLSA_CONCEDIDA`
  em `entidade_anexo`, com as categorias do bolsista e a política de
  visibilidade. **A categoria decide a visibilidade, nunca o cliente** — o
  serviço sobrescreve, senão bastaria enviar `INTERNA` junto de um passaporte.
  Acadêmico (carta de aceite, plano de trabalho, relatório, declaração,
  publicação) é `INTERNA` e segue o recorte por PPG; pessoal
  (`DOCUMENTO_IDENTIDADE`, `PASSAPORTE`, `COMPROVANTE_RESIDENCIA`) é `PESSOAL`.
  - **`PESSOAL` e `RESTRITA` não são níveis, são públicos diferentes.** O Comitê
    Gestor abre `RESTRITA` e não abre `PESSOAL`; a `secretaria` abre `PESSOAL` e
    não abre `RESTRITA`. Por isso `documento:read-pessoal` é permissão própria,
    e `podeVer` mapeia visibilidade → permissão com um `if` explícito: um `||`
    entre as duas daria a cada uma o alcance da outra.
  - **A retenção é derivada, nunca gravada** — fim da concessão + 5 anos,
    calculada na leitura. `data_fim` é editável, e coluna gravada divergiria na
    primeira correção de período. **Não há expurgo automático** em lugar nenhum
    do sistema; o campo torna a política conferível, executá-la é ato humano.
    O inventário completo — o que se guarda, por quanto tempo e o que ainda não
    tem prazo — está em [docs/retencao-v1.md](docs/retencao-v1.md) (V1-039),
    junto com o limite honesto: **descartar um documento não o remove dos
    backups anteriores**, porque um dump é retrato do banco inteiro.
  - **A tela é a seção *Documentos do bolsista*** em
    `/mobilidade/bolsistas/[id]`, com envio em sidesheet (RHF + Zod) e download
    por `/anexos/:id/conteudo`. **Não há seletor de visibilidade** — quem decide
    é a categoria, e oferecer a escolha faria quem marcasse "interna" achar que
    publicou. **A tela não refiltra** o que a API já filtrou. A categoria
    pessoal só é *oferecida* a quem tem `documento:read-pessoal`, e **a API
    recusa o envio de quem não a tem** (homologado em 2026-09-09): enviar
    documento pessoal exige a mesma permissão de abri-lo. Sem essa simetria, o
    coordenador coletava passaporte de aluno que só ele próprio reabriria
    depois. **403 e não 404** — a concessão é visível, o que se recusa é a ação.
  - **`enviar` passou a usar `exigirAcesso`** (permissão **mais** recorte).
    Antes usava só `exigir`, enquanto todas as outras operações já checavam o
    recorte — quem não alcançava uma missão de outra rede conseguia *pendurar*
    documento nela conhecendo o UUID. Não dava para ler de volta; dava para
    injetar. A correção vale para todos os tipos de entidade.
- **Relacionamento institucional (BOL-030 a BOL-033/035, 2026-09-09)**:
  `instituicao` ganhou origem, estágio, áreas de atuação, programa relacionado e
  grupo de pesquisa. **A origem é imutável** — `atualizarParceiroSchema` não a
  tem, e o campo enviado a mais é descartado; reescrevê-la apagaria a memória de
  como o relacionamento começou. É obrigatória no cadastro e nula no banco, para
  não inventar resposta para as instituições anteriores ao campo.
  - **Só três dos cinco estados do documento são gravados.** "Mobilidade
    realizada" e "parceria formalizada" são **derivados** por `exists` sobre
    `bolsa_concedida` e `convenio` vigente, e aparecem ao lado do estágio
    declarado, nunca no lugar dele. Gravá-los criaria a divergência do dia
    seguinte — a ficha dizendo "apenas identificada" sobre quem recebeu três
    bolsistas. `exists` e não `join`, senão a instituição apareceria uma vez por
    bolsa (CG-016).
  - **O histórico de mobilidades é uma linha por concessão**, com a ponta
    (recebeu/enviou) resolvida por `case`: a instituição pode ser origem *e*
    destino da mesma bolsa numa dupla titulação, e um `or` dentro de `join` a
    traria duas vezes.
  - **Rede, temática e PPG do parceiro** (2026-09-10): a rede é a declarada em
    `instituicao_rede`; temática e PPG são **derivados** das bolsas que
    passaram pela instituição, em `HistoricoParceiro.vinculos`, agrupados no
    banco (a página do parceiro não agrega nada) com a temática da própria
    concessão vencendo a da linha de plano. Declarar os dois à mão criaria o
    vínculo que diverge da primeira bolsa que o contrariar. Com P03 vazia, a
    seção mostra o estado vazio — o vínculo nasce com a primeira concessão.
  - **Áreas de atuação é texto livre de propósito**: sem taxonomia mantida, duas
    grafias viram duas áreas e a contagem sai errada — o mesmo defeito do evento
    contado pelo nome (CG-067). O campo descreve, não conta.
- **Panorama de mobilidade (P02, BOL-040, 2026-09-09)**: `/mobilidade` e
  `GET /mobilidade/panorama`. É a tela que responde *o que a internacionalização
  produziu*; a P01 responde *o plano cabe no orçamento*, e por isso as duas
  coexistem. **Um filtro só, montado uma vez**, servindo cartões, sete quebras e
  a série — a lição da CG-066 aplicada de saída, com regressão que falha se
  alguma quebra ganhar `where` próprio. **O recorte por PPG entra no mesmo
  objeto**, então nenhuma quebra pode esquecê-lo. `item_planejado` entra por
  `left join` em toda consulta que precisa de rede: um `join` excluiria a bolsa
  vinda de fora do planejamento. **Concessão com destino digitado à mão entra no
  total e fica fora das quebras por país e instituição**, com o aviso na tela —
  sem ele, quem somasse as linhas acharia que a tela erra (CG-067).
  - **A P01 é um painel, não um relatório** (2026-09-10). Cinco blocos, do
    geral ao detalhe, cada um respondendo uma pergunta e levando à tela onde
    ela se resolve: (1) quatro KPIs com contexto — aporte, teto de bolsas
    comprometido, bolsas do exercício e composições aprovadas no ciclo; (2) um
    cartão por rede, com a coordenação recolhida em `<details>`; (3) o **mapa
    de composição**, temáticas × exercícios, ao lado de *Precisa de ação*; (4)
    bolsas por modalidade em gráfico, com a tabela em "Ver dados"; (5) a
    mobilidade realizada, que sem concessões vira uma faixa discreta em vez de
    gráficos zerados. O exercício é escolhido em `?ano=` (ano fora do ciclo cai
    no primeiro, como no resto do ciclo).
    - **O mapa de composição é a peça central.** Só 2027 vem composto, e isso
      fazia "bolsas no ano" e "bolsas no ciclo" mostrarem o mesmo 22 enquanto o
      dinheiro multiplicava por 4 — quem lia supunha "por semestre". A grade
      mostra 8 de 48 composições aprovadas e a UNICAMP sem nenhuma. É uma
      `<table>` com cabeçalho de linha e coluna, e cada estado tem símbolo e
      texto além da cor. Vem de `Painel.composicao`, derivado de
      `porTematica` — nenhum número novo.
    - **Teto comprometido só sobre composição aprovada** (`uso-teto-ano`, e
      `LinhaRede.utilizacao` por rede), o mesmo recorte do saldo potencial. Pôr
      o teto da UNICAMP no denominador faria a rede pendente parecer folga, e
      os 88% de 2027 virariam 46%. A cor segue o semáforo da RN-07.
    - **Rede sem composição mostra *A definir*, não R$ 0,00** — a API devolve
      custo e bolsas zerados porque não há linha, e zero leria "decidiram
      zero bolsas".
    - **Não existe coordenador de rede**: a coordenação é por participação
      PPG–temática, e UNICAMP-T1 tem dois. `Painel.coordenacao` lista temática
      a temática; eleger um nome por rede esconderia os outros.
    - `Painel.indicadores` continua no contrato: é a superfície do teste de
      aceite da migração. A tela escolhe os indicadores pela `chave`.
  - **A P01 mostra os mesmos números** numa seção própria (BOL-041), buscando o
    panorama filtrado por `cicloId` — não recalcula. **Ao lado** dos indicadores
    financeiros, nunca no lugar: são perguntas diferentes, e fundi-las faria
    compromisso parecer execução. O cartão se chama *Custo das bolsas
    concedidas* (D-B07), nunca "executado".
  - **O consolidado por rede (BOL-043)** tem método próprio, não a quebra
    genérica: alcance é `distinct` e produto entra por **subconsulta**, porque
    um `join` com `produto_bolsa` faria a bolsa de três produtos virar três
    linhas e inflar mobilidades e valor. Concessão sem temática cai em "Sem rede
    vinculada" em vez de sumir.
  - **O relatório exportável (BOL-044)** usa a mesma função `condicao` do
    panorama — não existe segunda origem, e a regressão cruza o total do
    panorama com a contagem das linhas.
- **Ata da decisão (BOL-052)**: `DECISAO_COMITE` em `entidade_anexo`, aceitando
  **somente** a categoria `ATA`. A exclusão anterior era sobre *documento
  analisado*, que se prende à missão (CG-019); a ata é o registro do ato que a
  decisão descreve. Escrever exige `missao:decide` — quem registra a decisão é
  quem anexa a ata dela —, e o recorte por rede a alcança por duas junções até a
  missão. **Não substitui o modelo B**: o colegiado segue deliberando fora do
  sistema.
- **Mapa e destinos (P04, BOL-042)**: `/mobilidade/mapa`, com `react-simple-maps`
  e o topojson do `world-atlas` — as duas primeiras dependências de visualização
  geográfica. **O casamento é pelo código ISO 3166-1 numérico**, que `pais`
  ganhou na migration `0038`, gerado da base `iso-codes` e conferido contra os
  249 pares ISO2/ISO3 existentes. Casar por nome em inglês falharia em silêncio
  ("W. Sahara" no arquivo × "Western Sahara" no ICU), e país sem cor é
  indistinguível de país sem mobilidade. **A seed virou upsert** para as linhas
  antigas receberem o campo. A cor sai de `var(--token)` no SVG, nunca resolvida
  em JavaScript. O SVG é `aria-hidden`: quem serve leitor de tela é a tabela.
- **Produção consolidada (P18/P19, BOL-051)**: `/producao` e
  `GET /mobilidade/producao`. **`union all`, não `join`** — as duas tabelas de
  produto não se relacionam, e o que existe é a pergunta comum. A coluna
  *Origem* marca cada linha para a soma não apagar a diferença que a CG-056
  preservou. Exige `bolsa:read` **e** `produto:read`; produto de missão só entra
  para quem tem `missao:read`. Desde 2026-09-11 o produto de bolsa exige
  **instituição e país de colaboração** (texto, migration `0039`; nulos só nos
  anteriores ao campo), e a tela os mostra em colunas próprias.
- **Ficha do parceiro (BOL-034)**: `GET /parceiros/:id/ficha`, PDF único pelo
  `gerarPdf` da CG-069. **PDF apenas**, porque a ficha é documento e não tabela.
  A autorização é a da própria consulta — chama `historico`, o mesmo método da
  tela. "Pesquisadores envolvidos" é deduzido das mobilidades: não há cadastro
  de pesquisador da instituição, e inventá-lo criaria vínculo que ninguém
  declarou. `responderArquivo` mora em
  [comum/resposta-arquivo.ts](apps/api/src/comum/resposta-arquivo.ts) desde
  então — duplicá-lo duplicaria a armadilha do `resposta.send`.
- **Eventos externos da CAPES (P12, V1-036, 2026-09-21)**: API de registro,
  consulta e correção, contrato em
  [docs/eventos-externos-v1.md](docs/eventos-externos-v1.md) (§9 diz o que foi
  implementado). **O Gerenciador registra o que já aconteceu na CAPES** — não
  propõe, não autoriza, não paga e não persegue (§1). Dois grupos, duas tabelas:
  - **Movimentação de recurso** reusa `remanejamento`: origem e destino têm de
    ser PPGs **da mesma área temática**, e outra temática ou rede é bloqueio.
    Só `EXECUTADO` é aceito (RN-13). **Não toca no plano nem no teto** — o custo
    sai de `planejamento_anual`, e replanejar continua sendo ato da P10.
  - **Evento do beneficiário** (`evento_bolsista`): desistência, interrupção,
    falecimento, substituição e conclusão antecipada. **O tipo é dado**
    (`tipo_evento_bolsista`), e o efeito na situação da bolsa também: estados de
    origem e de destino são colunas, e um tipo novo é um `insert`.
    `FALECIMENTO` leva a *Interrompida*, sem estado próprio — um `FALECIDA` no
    enum publicaria a causa em toda listagem.
  - **Cancelada libera a vaga; interrompida não.** Era efeito colateral de
    `exigirVaga` e virou regra: voltar de `CANCELADA` por correção passa pela
    vaga e é recusado se alguém já a ocupou.
  - **O panorama deixou de contar `CANCELADA`** sem filtro explícito, e com ele o
    relatório exportável e o bloco de mobilidade da P01 — pela mesma função
    `condicao`. Sem isso a substituição contaria a vaga duas vezes.
  - **Reenvio não duplica**: todo registro traz `chave` (UUID de quem envia); a
    mesma chave devolve o registro existente e, noutro alvo, é 409.
  - **Correção não apaga**: o valor corrigido fica na linha e a trilha guarda o
    campo trocado, com o motivo — **sem o texto** de justificativa e
    observação, que podem descrever doença ou morte. Trocar o tipo reaplica o
    efeito a partir do `status_anterior` fotografado, só no último evento da
    bolsa; substituição não troca de tipo.
  - **A edição da bolsa não desfaz a situação que um evento produziu**, e toda
    troca de situação pela edição passou a ser auditada.
  - **Tela (V1-037)**: seção *Eventos informados pela CAPES* no detalhe da
    bolsa (registrar, corrigir, anexar comprovante) e a P12 em
    `.../remanejamentos` ("Eventos da CAPES"), com as movimentações e os
    eventos do ciclo. Os formulários só oferecem o que a API aceitaria e dizem
    o efeito antes de salvar. **A edição da bolsa não leva mais a
    *Cancelada*/*Interrompida*** — isso é evento.
  - Permissões próprias, `evento:read`, `evento:create` e `evento:edit`: corrigir
    período é rotina, registrar que alguém faleceu não é. O registro do evento
    exige também `bolsa:edit`; a movimentação exige alcance sobre **os dois**
    PPGs para escrever e sobre **qualquer um** para ler. Comprovante é anexo
    opcional (`EVENTO_BOLSISTA`, `REMANEJAMENTO`) e cada linha diz quantos tem.
- **Modelo de dados**: 56 tabelas em 16 módulos de schema Drizzle
  ([apps/api/src/database/schema/](apps/api/src/database/schema/)), com migrations.
  Segue [system-structl.md](system-structl.md) §4.
- **Seed com os dados reais** das planilhas e respostas formais
  ([apps/api/src/database/seed/](apps/api/src/database/seed/)): 24 PPGs, 60 itens
  de catálogo, 23 linhas de plano (18 aprovadas, 4 UFMG pendentes e 1 cancelada),
  48 orçamentos anuais e 14 pendências históricas (5 abertas).
  **A produção passou a subir só com a base estrutural** (decisão de 2026-09-18,
  que substitui a de 2026-09-08): plano, equipes e pendências ficam para a
  equipe cadastrar pela interface. Os dados da planilha continuam no código e
  entram com `--com-dados`, que é como o teste de aceite segue valendo contra
  eles. As correções confirmadas depois da
  extração ficam em
  [dados-capes-global.ts](apps/api/src/database/seed/dados-capes-global.ts), e
  não no arquivo gerado pelo `extrair-planilhas.py`: uma nova extração não pode
  apagar decisão de negócio que não estava na planilha.
- **Serviços de cálculo**: RN-01 a RN-20 em
  [apps/api/src/dominio/](apps/api/src/dominio/), todos em SQL e sem nenhum
  derivado persistido. A API expõe programas, ciclo, redes, temáticas, orçamento,
  plano, bolsas concedidas e produtos individuais, comitê gestor, premissas,
  PPGs, pendências e catálogo.
- **Telas de planejamento**: P01, P05, P06, P07, P08, P09, P10, P14, P15,
  P17, Parceiros e as configurações da conta. Cadastro de PPG e de linha de plano em
  sidesheet com formulário em etapas.
- **Cadastro institucional é do `admin`** (decisão de 2026-09-08). Catálogo de
  bolsas, modalidades e PPGs têm cadastro e edição pela interface, e as três
  telas escondem os botões de quem não tem a permissão. `ppg:write` **saiu do
  `coordenador`** na mesma decisão: renomear ou reenquadrar um PPG mexe no
  recorte de quem vê o quê e no plano de todos que apontam para ele.
  - **Publicar item de catálogo é livre; alterar item em uso não é.** Se a
    combinação (destino, modalidade, vigência) não existia, nenhuma linha de
    plano podia estar usando-a — item novo não muda custo nenhum já calculado,
    e é ele que destrava o cadastro manual da composição, que antes morria no
    422 de RN-01 sem saída que não fosse migração. Já um item citado por linha
    de plano tem destino, modalidade, vigência e valor **travados**: reescrever
    o preço mudaria, em silêncio, o custo de um planejamento aprovado — é para
    isso que a tabela é versionada. Fonte, observação e valor em dólar seguem
    editáveis porque nenhum cálculo os lê. A tela mostra a contagem de usos
    antes de abrir o formulário, e o campo travado vira texto em vez de input
    desabilitado (React Hook Form devolve `undefined` para campo desabilitado, e
    o payload chegaria sem destino nem valor).
  - Não há exclusão de item **em uso**, só do que nunca foi usado — o erro de
    digitação recém-cometido. Modalidade não se exclui nunca: `ativa = false`.
  - `permiteBrasil`/`permiteExterior` continuam **derivados do catálogo**, e o
    serviço os atualiza ao publicar o primeiro item de cada destino. Marcá-los à
    mão ofereceria, na P10, combinação que `resolverItem` recusaria depois.
- **P13 não tem mais tela** (decisão de 2026-09-08). O alerta *Pendências em
  aberto* da P01 sobreviveu à remoção apontando para `/pendencias` e virou um
  card que levava a 404; saiu em 2026-09-09, e o indicador homônimo saiu em
  2026-09-10 — contagem que não abre em lugar nenhum. As pendências continuam na
  seed, no banco e na API (`GET/POST /:programa/:ciclo/pendencias`,
  `PATCH /pendencias/:id`) para consulta e resolução; o que saiu foi a página,
  o item de menu e o cartão do painel do ciclo. O smoke de login usa `/ppgs`
  como rota protegida de referência.
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
  - **As duas pontas da mobilidade saem do cadastro central desde a BOL-010**
    (2026-09-09). País é **sempre** do catálogo ISO; instituição vem do
    catálogo **ou** digitada, espelhando `missao_atividade` — exigir catálogo
    travaria o cadastro, porque a base nasce com a UEA e as três redes e quem
    tem `bolsa:write` não tem `parceiro:write`. **Exatamente uma coluna por
    ponta é gravada**: a FK quando veio do catálogo, o texto quando foi
    digitada; gravar as duas as faria discordar na primeira conciliação
    (CG-025). A leitura usa `coalesce(join, texto)`, com o join primeiro, para
    que renomear ou conciliar um parceiro se propague à bolsa já registrada.
  - **O destino voltou a ser digitado em 2026-09-11**, por pedido da equipe:
    país e instituição de destino são dois campos de texto, sem catálogo. A
    origem continua como acima. `resolverPontas` reconhece a grafia do
    catálogo (sem caixa, acento nem pontuação; país também pelo código ISO de
    2 ou 3 letras) e, quando coincide, grava a FK e não o texto — é o que
    mantém o país no mapa e a bolsa no histórico do parceiro. O panorama
    agrupa destino por `coalesce(FK, texto normalizado)`, então o digitado
    entra nas quebras e o aviso "fica fora das quebras" deixou de existir.
  - O formulário é o seletor com busca: país filtra **no cliente** (lista ISO
    fechada, já carregada pelo Server Component) e instituição filtra **no
    servidor** (`GET /bolsistas/instituicoes?busca=`, com TanStack Query), porque
    o cadastro institucional existe para crescer e o filtro no cliente deixaria
    de funcionar em silêncio, cortado pelo teto do serviço.
  - **`GET /bolsistas/referencias` é endpoint próprio, com `bolsa:read`**, e não
    um reuso de `/parceiros`: quem cadastra bolsa é `coordenador` ou
    `secretaria`, e nenhum dos dois tem `parceiro:read` — que governa também os
    contatos, com dados pessoais que essas funções não precisam ver para
    escolher uma universidade.
  - **Contexto acadêmico na concessão (BOL-011 a BOL-013)**: temática, linha de
    pesquisa e orientador ficam em `bolsa_concedida`, não em `pessoa` — descrevem
    *esta* bolsa, e a mesma pessoa pode ser bolsista aqui e docente em outro
    programa. A API recusa linha de pesquisa de outro PPG (a FK sozinha
    aceitaria). O orientador é informado por nome e criado como `DOCENTE` se não
    existir: exigir cadastro prévio faria a equipe deixar o campo vazio.
    Telefone e ORCID ficam em `pessoa`; o ORCID aceita `X` no último caractere,
    que é o dígito verificador do padrão.
  - **P03 é recortada por PPG desde a BOL-020** (2026-09-09), em leitura e em
    escrita, sempre **na consulta** e nunca em memória. Concessão fora do escopo
    responde **404, nunca 403**: a existência da bolsa já é o dado protegido —
    dizer "existe, mas não é sua" entrega que aquela pessoa tem uma concessão.
    **O produto herda o recorte da bolsa** e não tem recorte próprio; sem isso
    `produto:write` seria a porta lateral, e conhecer o UUID bastaria para
    escrever na bolsa de outro PPG.
  - **Desde a V1-015 cada ação tem o seu próprio alcance** (2026-09-18), e o
    modo permissivo acabou junto com a flag. Ler, cadastrar, editar e lançar
    produto são quatro perguntas separadas: quem tem `bolsa:read` global e
    `bolsa:edit` em um PPG enxerga o ciclo inteiro e só edita ali. O recorte
    mora em [recorte-bolsa.ts](apps/api/src/auth/autorizacao-v1/recorte-bolsa.ts)
    e é **uma função para todas as consultas** — a temática da concessão
    prevalece, o item planejado só completa registros anteriores ao campo, e
    subconsulta sem classificação vira `false` explícito, porque `NULL` dentro
    de `not` e de `bool_and` passaria batido. Cobertura em
    [escopo-bolsas.int-spec.ts](apps/api/test/escopo-bolsas.int-spec.ts) e
    [recorte-bolsas-v1.int-spec.ts](apps/api/test/recorte-bolsas-v1.int-spec.ts).
  - **Campo pessoal é projetado no SQL, nunca filtrado depois** (V1-015): CPF sai
    sob `pessoa:read-cpf`, e-mail e telefone sob `pessoa:read-contato`, cada um
    **cruzado com o alcance daquela bolsa**. Sem a capacidade o campo vem nulo e
    um `podeLerCpf`/`podeLerContato` acompanha a linha, para a tela escrever
    *Sem acesso* em vez de *Não informado* — ausência de permissão e ausência de
    dado não são a mesma frase. **Não há máscara parcial**: meio CPF ainda é CPF.
  - **Cadastrar CPF e ler CPF são capacidades distintas.** Quem tem
    `bolsa:create` informa o CPF sem poder consultá-lo depois; na edição, CPF
    não reenviado é **preservado**, e corrigir um CPF existente exige
    `pessoa:edit-cpf` mais `bolsa:edit` sobre **todas** as bolsas daquela pessoa
    — `pessoa` é compartilhada, e alcançar uma bolsa não autoriza reescrever a
    identidade que outras usam. A correção trava a linha com `for update` e
    grava auditoria por campo.
  - **Duplicidade não revela cadastro alheio.** CPF repetido, e-mail de outra
    pessoa e colisão concorrente (`23505`) respondem todos a **mesma** frase
    genérica, pedindo revisão à equipe autorizada. Mensagens distintas seriam um
    oráculo: bastaria variar o CPF até a recusa mudar de texto para descobrir
    quem já está cadastrado. E-mail nunca troca a identidade de uma pessoa
    existente — só o CPF identifica.
- **Comitê Gestor e Administração (P17, equipes e cadastro de missões)**:
  cadastro de vínculos por ciclo, separação entre as duas equipes, criação
  reutilizável de pessoas, vigência, auditoria e acesso provisório exclusivo de
  `admin`. A P17 possui as abas Visão geral, Missões e Equipes; Missões lista,
  filtra e pagina, e o cadastro multietapas grava roteiro repetível e
  participantes sem valores financeiros. A API cobre criação, detalhe, edição,
  ciclo de vida e relato. **Desde a V1-030 (2026-09-19) o ciclo inteiro é
  percorrível pela tela:** editar, confirmar, cancelar e reabrir a execução
  entraram na página de detalhe, e encerrar continua na aba própria, junto do
  checklist que o governa. A edição **reusa o formulário do cadastro** — as
  regras são as mesmas, e mantê-las em dois lugares é garantir que divirjam —,
  com duas diferenças: o campo de situação some (mudar situação é `/situacao`,
  com regra de origem por ação) e **o `id` de cada participante e parada viaja
  no payload**, porque o endpoint reconcilia as listas inteiras e linha sem `id`
  é linha nova. Sem ele, salvar uma edição duplicaria o roteiro. O
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
  obrigatória e aviso do que será transferido. **V1-042 (2026-09-20)** pagina
  a lista em SQL: `GET /parceiros` retorna `itens`, `total`, `pagina`, `tamanho`,
  `paginas` e `resumo`. Padrão 50, máximo 200; ordenação por nome e ID. Filtros
  e página ficam na URL, e voltar/avançar restaura os controles. Resumo e total
  usam o conjunto filtrado inteiro. Página que deixou de existir oferece
  retorno à última disponível. `parceiro:read` continua GLOBAL (catálogo
  compartilhado); rede é filtro, não concessão. A seleção de parceiro dentro da missão
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

  **O anexo herda o alcance da permissão que ele mesmo exige** (V1-016,
  2026-09-18). `exigirAcesso` toma o alcance de `POLITICA[tipo][acao]` — a
  mesma permissão que acabou de cobrar — e confere o alvo no banco. Antes o
  documento da prestação era recortado por `missao:read` embora cobrasse
  `prestacao:read`, e quem tivesse leitura de missão numa rede e de prestação
  noutra baixava o comprovante da rede errada. **Alvo inexistente e alvo fora do
  alcance respondem a mesma coisa** — *Documento não encontrado* —, porque
  mensagens distintas deixariam mapear quais missões existem trocando o UUID até
  o texto mudar. Instituição e convênio seguem sem recorte: não pendem de missão
  nenhuma.

  **O histórico do parceiro é recortado parcela a parcela** (V1-016). O cadastro
  continua compartilhado — `listar`, `detalhar` e `candidatos` não recortam
  nada, e é isso que faz o catálogo servir de catálogo —, mas bolsa responde a
  `bolsa:read`, missão/roteiro/evento a `missao:read`, produto a
  `produto-missao:read` **mais** o alcance da missão que o gerou, e convênio a
  `convenio:read`. O convênio **não** segue a missão de origem: o acordo
  sobrevive à viagem (CG-056). O recorte entra na consulta inclusive no
  agregado, porque `vinculos` conta mobilidades e somar antes de filtrar
  publicaria o número real. **Cuidado com `or` sem parênteses**: a condição dos
  produtos era `exists (...) or exists (...)` sozinha no `where`, e ao entrar num
  `and` com o recorte a precedência ligou o `and` só ao segundo `exists`.
  `HistoricoParceiro.acesso` diz por seção se a ação foi concedida, para o estado
  vazio não afirmar "não houve mobilidade" a quem apenas não pode consultá-la.

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
  e `modulosPendentes` ficou vazia. **O cadastro de produto entrou na tela com a V1-031**
  (2026-09-19): criar, editar e remover na seção *Resultados*, cada verbo com a
  sua permissão. **Continua sem botão que responda "sim"** — o "sim" é a
  existência da linha, e cadastrar já retira a declaração negativa, com
  auditoria. Na missão declarada sem produto, *Cadastrar* e *Reabrir resposta*
  ficam lado a lado: respondem a "apareceu um resultado" e a "errei a
  declaração", que são coisas diferentes. O campo de acordo só aparece no tipo
  `CONVENIO`, nos dois sentidos da regra bicondicional, e os responsáveis
  oferecidos são **os participantes da missão** — creditar quem não viajou seria
  afirmar o que ninguém declarou. **O convênio ganhou tela na V1-032**
  (2026-09-20), mas **na página do parceiro, não aqui**: o acordo se ancora na
  instituição e sobrevive à viagem — dentro da missão ele continua sendo
  apontado, nunca criado. Lá estão cadastrar, editar, inativar e reativar, cada
  um escondido pela sua própria permissão (`convenio:create`, `:edit`,
  `:status`), sem exclusão e com justificativa obrigatória nos dois sentidos da
  inativação. O histórico do parceiro passou a trazer também `numeroProcesso`,
  `objetivo`, `observacoes` e as **redes** do acordo, porque é dele que o
  formulário de edição se preenche e a API reconcilia a lista de redes inteira;
  as redes vêm por consulta à parte, nunca por `join`, senão o acordo de duas
  redes viraria duas linhas na ficha.

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

  **Os textos deste módulo estão acentuados**, como os de toda a API desde
  2026-09-09 — ver §7. Nenhum documento de
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

    **Os relatórios estratégicos (CG-068)** são a aba *Relatórios* da P17 e
  `GET .../comite-gestor/relatorios/{missoes|parceiros|financas|resultados}`.
  **Não existe uma segunda origem**, e é isso que o critério de aceite exige: o
  filtro dos relatórios **é** o da lista (`filtroMissoesSchema` menos a
  paginação), o relatório de missões chama `listar`, e os outros três partem de
  `condicaoDoRecorte` — a mesma função que monta o `where` da lista, extraída
  dela para isso. Verificado por mutação e cruzado com a CG-055: o `validado` do
  relatório financeiro bate com o da execução orçamentária, apurados por
  caminhos diferentes. `totais.missoes` é `pagina.total`, **nunca**
  `resumo.total` — o resumo responde só ao escopo porque conta *por* status.
  Instituição digitada à mão não vira parceiro mas aparece em "sem cadastro":
  contá-la infla, escondê-la faz o número parecer completo. O teto de linhas do
  relatório não é o `tamanho` da lista, que protege a tabela do browser.
  Finanças usa `prestacao:read`, e não `missao:read`.

    **Exportações e dossiê (CG-069)** saem por
  `.../relatorios/:qual/exportacao/:formato` e `.../missoes/:id/dossie`.
  **Síncronas e sem gravar em disco** — não há o que expirar nem o que varrer, e
  não sobra exportação no servidor para ser servida depois a quem não podia
  vê-la. **A autorização é a da própria consulta**: cada exportação chama o
  mesmo serviço da tela, com o mesmo usuário e recorte. **Fórmula é neutralizada
  na escrita** (`=`, `+`, `-`, `@`, tab, CR ganham aspa simples), nunca na
  leitura — o arquivo já saiu. O **XLSX é escrito à mão** (ZIP + OOXML) para não
  trazer `exceljs`, e é validado abrindo no LibreOffice. O **PDF usa duas
  bibliotecas com papéis distintos**: `pdfkit` desenha, `pdf-lib` concatena os
  anexos — é a concatenação que torna "PDF único" verdade. Anexo corrompido é
  pulado e volta em `X-Anexos-Ignorados`. **Use `resposta.send`, nunca
  `return`:** com `@Res({ passthrough: true })` o Nest serializa o `Buffer` como
  JSON e o arquivo baixado fica inútil, com os cabeçalhos ainda corretos. E
  **asserção sobre bytes de PDF passa por vácuo**, porque pdfkit comprime o
  texto: extraia com `pdftotext`.

    **Notificações (D-11 / CG-039)** são um **outbox durável** mais a caixa de
  entrada em `/avisos` — fora de `programas/[programa]/[ciclo]`, porque o aviso
  é da pessoa e sobrevive ao ciclo. **A notificação é gravada na mesma transação
  do fato**: é o que faz a decisão nunca depender do canal de aviso. **Não há
  e-mail** enquanto não houver servidor SMTP, e por isso as notificações nascem
  `NAO_APLICAVEL` — se nascessem `PENDENTE`, ligar o e-mail um dia despejaria
  meses de aviso atrasado de uma vez. **Falha de canal mantém `PENDENTE`, nunca
  `FALHOU`:** marcar falha transformaria indisponibilidade momentânea em aviso
  perdido. "Viagem encerrada sem prestação" é varrido ao abrir a caixa, com o
  critério do painel, e a idempotência vem do índice parcial
  `notificacao_pendencia_uk` — não de checar antes do insert. Envio de prestação
  **não** notifica: caixa que avisa de tudo vira ruído. Decisão concorrente
  responde **409**, traduzido do código `23505` e não da mensagem.

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
interface é **Coordenador de Temática**, não “membro do comitê”.

**A participação PPG–temática passou a ser administrada pela tela (V1-034,
2026-09-20)**, na página da temática: associar, editar e remover, com as
permissões institucionais `participacao:create`, `:edit` e `:delete`. O escopo é
`GLOBAL` pelo mesmo argumento que tirou `ppg:write` do coordenador — **a
participação é ela própria alvo de concessão**, e quem a cria decide, de lado, o
que outras contas passam a alcançar. Três regras que a implementação ingênua
erra:

1. **Remover é recusado quando há concessão apontando para o vínculo**, ativa ou
   já revogada, porque `concessao_acesso.participacao_id` é **`on delete
   cascade`**: o `delete` apagaria as concessões dentro do banco, sem trilha e
   sem ninguém ter revogado nada — inclusive as revogadas, que são o único
   registro de quem teve aquele acesso. A saída para o vínculo que já teve
   concessão é marcá-lo *não contemplado* na edição.
2. **Trocar o responsável não transfere acesso.** Quem sai continua com o que
   lhe foi concedido, e quem entra continua sem nada — são duas perguntas
   separadas desde a V1-012. A troca grava auditoria por campo.
3. **A edição não troca o PPG**, pela mesma razão do item de catálogo em uso: a
   linha de plano que aponta para o par antigo passaria a descrever um programa
   que ninguém decidiu.

**Armadilha de SQL que ficou documentada no código:** dentro de um `sql` cru, o
Drizzle emite a coluna interpolada **sem o nome da tabela**. Numa subconsulta
correlacionada, `pp.ppg_id = ${s.ppg.id}` vira `pp.ppg_id = "id"` e casa com o
`id` da tabela interna — a condição responde sempre `false`, em silêncio, porque
continua sendo SQL válido. Qualifique a coluna externa à mão.

Edição de linha
existente exige `plano:edit` (só `admin`), preserva código/rubrica e grava uma
entrada de auditoria por campo alterado. O exercício também fica em `?ano=`: somente
2027 vem composto; 2028–2030 começam vazios e nunca copiam a quantidade automaticamente.
- **Testes**: 280 unitários/regressões (89 API + 191 na web para toast, datas,
  React Hook Form/Zod, erros do multistep, formulários de parceiro,
  acessibilidade, contraste dos tokens, cálculos monetários, montagem de série
  do gráfico, links do painel, pontas da mobilidade, cor das redes, caminhos
  do BFF, concessão de acesso, menu por capacidade e preservação do CPF na
  edição) mais 717 casos de integração em 43 suítes contra Postgres real —
  entre eles os 29 dos eventos externos da V1-036/037
  ([eventos-externos-v1.int-spec.ts](apps/api/test/eventos-externos-v1.int-spec.ts)),
  entre eles os 14 do recorte por ação da V1-015
  ([recorte-bolsas-v1.int-spec.ts](apps/api/test/recorte-bolsas-v1.int-spec.ts),
  que confere CSV, XLSX e PDF reais para a exportação não reintroduzir o campo
  que o JSON removeu), os oito dos caminhos indiretos da V1-016
  ([recorte-indiretos-v1.int-spec.ts](apps/api/test/recorte-indiretos-v1.int-spec.ts)),
  os 13 da matriz cruzada da V1-020
  ([matriz-acesso-v1.int-spec.ts](apps/api/test/matriz-acesso-v1.int-spec.ts),
  com dois ciclos e temática compartilhada — sem os dois ciclos o erro
  cartesiano do alvo `PPG` não aparece) e os oito casos da escrita do catálogo
  ([catalogo.int-spec.ts](apps/api/test/catalogo.int-spec.ts)), incluindo a
  recusa de alterar item que já custeia linha de plano. As duas garantias de não duplicação da linha
  histórica do parceiro foram verificadas por mutação: trocar o `exists` +
  `selectDistinct` por um `join` faz ambas falharem.
- **Base de interface para o que vem**: `Recharts` com o primeiro gráfico na P09
  (total previsto por rede e exercício), `Combobox` com busca para as listas
  longas da CG-045, e TanStack Query sobre `/api/bff` com a lista de parceiros
  como referência. O MUI e o Emotion saíram — ver §8.
- Smoke de login (`pnpm smoke:login`) e de telas (`pnpm smoke:telas`) ponta a
  ponta; CI de lint/build/test.

**Não existe ainda:**

- **Dado individual de mobilidade.** As telas de P01 a P04, produção e
  relatórios existem desde 2026-09-09, mas ficam vazias: as planilhas de origem
  não trazem o beneficiário — sabe-se que há "1 bolsa de Doutorado Sanduíche de
  6 meses para o PPGCLIAMB", não quem foi nem se voltou. Nada disso é bug; é a
  equipe que precisa cadastrar as concessões em P03.
  Em 2026-09-09 a equipe entregou a *Proposta de estruturação do módulo
  Bolsistas* (8 módulos), que reescreve P01–P04, P20 e P24 sob outro
  vocabulário e acrescenta origem/situação do relacionamento institucional,
  histórico de mobilidade por instituição e documentos do bolsista. A auditoria
  integral, as sete decisões bloqueantes e o backlog `BOL-` estão em
  [docs/revisao-escopo-bolsistas-2026-09-09.md](docs/revisao-escopo-bolsistas-2026-09-09.md),
  e a folha de homologação das sete decisões em
  [docs/homologacao-bolsistas.md](docs/homologacao-bolsistas.md).
  **As sete decisões (D-B01 a D-B07) foram homologadas em 2026-09-09**,
  conforme a proposta de cada uma. As que já viraram código estão nas BOL-010,
  BOL-020, BOL-021 e BOL-022; D-B04, D-B05 e D-B07 destravam trabalho ainda não
  iniciado. Duas valem como regra permanente: **`bolsa_concedida` é a
  mobilidade** — não existe, nem deve existir, uma tabela separada para ela —, e
  **`missao_comite` não é reusada para mobilidade de bolsista**, pelo mesmo
  argumento que a CG-056 registrou sobre `produto_bolsa`.
- Relatórios (P20), importação com adaptador por programa (P21) e produção
  consolidada (P18/P19). Documentos e evidências (P22) existem no escopo da
  missão desde a CG-051/CG-057; o que falta de P22 é fora do Comitê Gestor. O documento novo
  do Comitê propõe trazer parte de P18–P20/P22 para o fluxo da missão, mas a fase
  e a prioridade ainda dependem da CG-005. Produtos individuais por bolsa
  continuam em P03 e **não** foram reutilizados como produto de missão: a
  CG-056 criou domínio próprio (`produto_missao`), separado de `produto_bolsa`.
- Revisão de volume dos seletores de parceiro: a conciliação ainda carrega
  os primeiros 200, e a detecção de duplicidade examina até 1.000 instituições
  antes de comparar. A lista principal já está paginada (V1-042). Parceiros
  continuam sendo catálogo compartilhado, protegido por `parceiro:read` GLOBAL;
  o histórico é recortado separadamente por ação.
- **Home por perfil.** A P01 é a mesma para todos os perfis, e **continua assim
  até existir o recorte de plano e orçamento** (decisão de 2026-09-10). Uma
  home do coordenador montada antes disso ou mostraria o programa inteiro sob
  o rótulo "seu PPG", ou recortaria só na tela — e recorte fora da consulta é
  justamente o que o §6 proíbe. Quando o recorte chegar, a home por perfil é a
  terceira fase da proposta de dashboard. **A V1-019 não a antecipou**: ela
  decide se a tela abre, e a P01 continua a mesma para todos — o que muda com o
  acesso é o menu ao lado dela e o bloco de mobilidade, que some sem
  `bolsa:read`.
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
- **Sessão expirada leva ao login, e isso depende de três peças** (2026-09-11).
  Layout e página renderizam **em paralelo**: o `requireSession()` do layout
  redirecionava, mas a página já tinha chamado a API e estourado antes — e, sem
  nenhum `error.tsx` no projeto, o erro virava a tela de erro do Next. Agora
  `apiFetch` manda para `/login` quando não há sessão ou quando a API responde
  401; o `proxy.ts` corta antes de renderizar quando `refreshExpiresAt` já
  passou (e apaga o cookie morto); e `app/(app)/error.tsx` é a rede embaixo dos
  dois. **Todo `catch` em volta de `apiFetch` precisa de `unstable_rethrow`** —
  `redirect()` sinaliza por exceção, e engoli-la traz o erro de volta.
- **`proxy.ts` enumera rotas públicas, não protegidas.** Com o sistema inteiro
  atrás de login, listar o que é protegido significaria lembrar de cada tela
  nova, e esquecer falharia em silêncio.
