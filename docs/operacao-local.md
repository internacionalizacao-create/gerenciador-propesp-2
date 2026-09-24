# Runbook — ambiente local, banco e verificação

Como levantar o Gerenciador numa máquina, o que cada comando de banco faz e o
que cada suíte de teste responde. Saiu do `AGENTS.md` §4 na reorganização de
2026-09-22, inteiro: lá ficou o essencial para começar a trabalhar, aqui está o
detalhe e o porquê de cada cuidado.

Ver também: [ativacao-acesso-v1.md](ativacao-acesso-v1.md) (instalação nova e
rollback), [guia-cadastro-do-zero.md](guia-cadastro-do-zero.md) (percorrer o
fluxo com a base limpa) e [autenticacao.md](autenticacao.md).

---

## Subir o ambiente

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

## Usuários de teste (só no realm de desenvolvimento)

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
| **Admin do realm `gerenciador`** (usuário acima) | `admin` / `admin123` | <http://localhost:3000> (app) **ou** <http://localhost:8080/admin/gerenciador/console> (console, só este realm) | Dentro do app, **nada** — o papel do Keycloak deixou de conceder permissão na V1-012, e o que esta conta enxerga depende das concessões em `concessao_acesso`. *(Corrigido em 2026-09-22: até aqui esta célula ainda descrevia o mapa `papel -> permissões` de `permissions.ts`, que não existe mais.)* No console: usuários, papéis, eventos e clients — só do realm `gerenciador`, por causa do papel `realm-admin` do client `realm-management`. |

São usuários diferentes em realms diferentes — só coincide o username `admin` e
a UI de login do Keycloak, por isso a confusão é fácil.

## O que mais o realm configura

- **Política de senha**: `length(8) and digits(1) and notUsername and notEmail`.
  Vale só para senha nova (troca ou reset) — as senhas dos usuários de teste
  acima já satisfazem e não são reavaliadas no import.
- **Locale**: pt-BR é o padrão da tela de login hospedada (Keycloak já traduz;
  não há tema customizado). Inglês continua disponível como alternativa.
- **"Lembrar-me"**: quando marcado, a sessão SSO do Keycloak dura até 7 dias
  ociosa / 30 dias no total, em vez do padrão (30 min / 10 h). Isso é a sessão
  do *Keycloak*, não a da aplicação — o cookie `gr_session` continua limitado a
  8h, ver [autenticacao.md](autenticacao.md) §4.
- **Eventos de login/admin ficam gravados** no Postgres do Keycloak (não
  aparecem em `docker logs` — o listener `jboss-logging` loga em nível `INFO`,
  abaixo do `WARN` padrão do container). Para consultar: console → *Realm
  settings → Events* → *User events*/*Admin events*, ou
  `GET /admin/realms/gerenciador/events` com um token de admin. Isso é auditoria
  nativa do Keycloak, não a auditoria da aplicação (ainda não existe — `AGENTS.md` §9).

## Banco de dados

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
corte segue a classificação de [db-zerar.sh](../scripts/db-zerar.sh), e não uma
lista própria — duas definições de "base" divergiriam na primeira tabela nova.

```bash
pnpm db:seed --reset --admin-sub <id>   # ja deixa o administrador pronto
pnpm db:seed --reset --com-dados        # inclui plano, equipes e pendencias
```

**`--com-dados` é o que o teste de aceite da migração exige:** sem plano não há
custo, saldo nem utilização para conferir contra `system-structl.md` §8.3. A
função `executarSeed` mantém `operacional: true` como padrão justamente para que
os testes de integração não precisem saber disso; quem inverte é a CLI.

## Congelar, restaurar e zerar o banco

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
[docs/guia-cadastro-do-zero.md](guia-cadastro-do-zero.md), com os atos que
ainda não têm tela (confirmar missão, produto de missão, convênio, pendência) e
a chamada de `pnpm api` de cada um.

O banco de testes (`gerenciador_test`) precisa existir uma vez:

```bash
docker exec gerenciador-api-db psql -U gerenciador -d postgres \
  -c "CREATE DATABASE gerenciador_test;"
```

## Build reproduzível

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
[test/fontes.test.mjs](../apps/web/test/fontes.test.mjs) o barra, junto com
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

## Verificação

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

A V1-022 acrescentou `autorizacao.spec.ts`: sete modelos concedidos pela tela,
conferência do menu e API, revogação imediata, duas contas de recortes distintos
e bootstrap com dois logins reais. A fixture `semContas` deixa a base sem
identidades locais para provar o primeiro vínculo e o CLI. Para executar só
acesso: `pnpm test:e2e acesso.spec.ts autorizacao.spec.ts`.

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
([system-structl.md](../system-structl.md) §8.3). Se algum falhar, ou a fórmula está
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

