---
name: run-gerenciador
description: Sobe, roda e dirige o Gerenciador PROPESP (monorepo pnpm com NestJS, Next.js, Keycloak e Postgres) numa máquina limpa. Use para rodar, subir, iniciar ou reiniciar a aplicação; abrir uma tela; tirar print ou screenshot; clicar num formulário; chamar a API autenticado; conceder acesso a uma conta de teste; ou confirmar que uma mudança funciona no app de verdade, e não só nos testes. Traz o driver.mjs, que faz o login OIDC real e dirige o browser.
---

# Rodar o Gerenciador PROPESP

Cinco processos: `keycloak`, `keycloak-db` e `api-db` em Docker, mais a API (3001)
e o Next (3000) pelo `pnpm dev`. Nada é visível sem login, e **conta sem
concessão não enxerga tela nenhuma** — é o regime da V1, não defeito.

Por isso o caminho do agente é o **`driver.mjs`**: ele faz o login hospedado no
Keycloak, guarda a sessão em disco, navega, fotografa, clica e chama a API pelo
BFF. Não há `chromium-cli` neste container; o chromium vem do Playwright que já é
dependência de `apps/web`.

Todos os caminhos abaixo são relativos à **raiz do repositório**.

## Pré-requisitos

Node 24.20.0 (`.nvmrc`), pnpm 11, Docker. Sem pacote de sistema a instalar — o
chromium do Playwright já está em `~/.cache/ms-playwright`.

```bash
. ~/.nvm/nvm.sh && nvm use
pnpm install
for par in "infra/.env.example infra/.env" "apps/api/.env.example apps/api/.env" \
           "apps/web/.env.example apps/web/.env.local"; do
  set -- $par; [ -f "$2" ] || cp "$1" "$2"
done
```

## Subir o ambiente

**1. Containers.** `infra:up` volta em ~12s, mas o Postgres ainda não aceita
conexão — espere de verdade (ver Gotchas):

```bash
pnpm infra:up
curl -s -o /dev/null -w "keycloak %{http_code}\n" --retry 40 --retry-delay 2 \
  --retry-connrefused --retry-all-errors \
  http://localhost:8080/realms/gerenciador/.well-known/openid-configuration
docker exec gerenciador-api-db bash -c \
  'for i in $(seq 1 150); do pg_isready -U gerenciador -q && exit 0; sleep 2; done; exit 1'
```

**2. Banco, com um administrador semeado.** O `--admin-sub` é o `sub` do usuário
`admin` **neste import do realm**; ele muda a cada `kc:import --force`, então é
sempre consultado, nunca fixado:

```bash
SUB=$(curl -s -d client_id=admin-cli -d username=admin -d password=admin \
  -d grant_type=password \
  http://localhost:8080/realms/master/protocol/openid-connect/token |
  node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).access_token' |
  xargs -I{} curl -s -H "Authorization: Bearer {}" \
    'http://localhost:8080/admin/realms/gerenciador/users?username=admin&exact=true' |
  node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8"))[0].id')
echo "$SUB"

cd apps/api && pnpm db:migrate && \
  pnpm db:seed --reset --com-dados --admin-sub "$SUB" && cd ../..
```

`--com-dados` é obrigatório se você for usar `pnpm smoke:telas`: sem as linhas da
planilha não há número para conferir. A seed termina dizendo
`86 acoes concedidas em GLOBAL`.

**3. Apps.** `pnpm dev` é persistente — deixe num processo à parte:

```bash
pnpm dev                       # web:3000  api:3001
curl -s -o /dev/null -w "api %{http_code}\n" --retry 60 --retry-delay 2 \
  --retry-connrefused --retry-all-errors http://localhost:3001/health
curl -s -o /dev/null -w "web %{http_code}\n" --retry 60 --retry-delay 2 \
  --retry-connrefused --retry-all-errors http://localhost:3000/login
```

## Rodar (caminho do agente): `driver.mjs`

```bash
# 19 telas: login, screenshot, título, erros de console e detecção de "sem acesso"
node .claude/skills/run-gerenciador/driver.mjs tour

# uma tela só
node .claude/skills/run-gerenciador/driver.mjs abrir /programas/capes-global/2027-2030/plano

# a API, autenticado, pelo BFF
node .claude/skills/run-gerenciador/driver.mjs api GET /programas/capes-global/2027-2030/painel
node .claude/skills/run-gerenciador/driver.mjs api GET /me/acesso

# outra conta: pasta e sessão próprias
GR_USUARIO=docente.teste GR_SENHA=docente123 \
  node .claude/skills/run-gerenciador/driver.mjs tour / /ppgs

# destrava uma conta de teste (modelo inteiro em GLOBAL) -- só desenvolvimento
node .claude/skills/run-gerenciador/driver.mjs conceder coord.teste coord123
```

As imagens vão para `.claude/skills/run-gerenciador/saida/<usuario>/` (ignorado
pelo git). A sessão fica em `saida/.sessao-<usuario>.json` e é reusada: a segunda
invocação não repete o login.

**Interagir** é o `repl`, alimentado por stdin:

```bash
printf 'ir /ppgs\nclicar Novo PPG\nfoto sidesheet-novo-ppg\ntexto dialog\nsair\n' |
  node .claude/skills/run-gerenciador/driver.mjs repl
```

Comandos: `ir <rota>`, `clicar <texto do botão ou link>`,
`preencher <seletor> <valor>`, `foto [nome]`, `texto [seletor]`, `eval <js>`,
`url`, `sair`. Cada um responde e imprime `>> pronto`, então dá para dirigir por
tmux (`send-keys` / `capture-pane`) do mesmo jeito.

Contas do realm de desenvolvimento: `admin`/`admin123` (a semeada, com tudo),
`coord.teste`/`coord123`, `docente.teste`/`docente123`,
`secretaria.teste`/`secretaria123`.

## Rodar (caminho humano)

`pnpm dev` e abrir <http://localhost:3000>. Idêntico ao de cima, só que a sessão
mora no browser; útil quando se quer *ver* a animação do sidesheet, inútil sem
display.

## Testes

```bash
pnpm test                      # 15 suítes, 89 casos na API + regressões da web
pnpm smoke:login               # o fluxo OIDC inteiro, sem browser
pnpm smoke:telas               # abre cada tela e procura os números (exige --com-dados)
pnpm smoke:acesso              # duas contas, dois recortes
```

A integração (43 suítes, 717 casos, ~100s) precisa do banco de teste, criado uma
vez:

```bash
docker exec gerenciador-api-db psql -U gerenciador -d postgres \
  -c "CREATE DATABASE gerenciador_test;"
pnpm --filter api test:int
```

`pnpm test:e2e` (Playwright, ambiente descartável próprio) existe e **não** faz
parte deste caminho: ele sobe containers próprios e faz build de produção, o que
conflita com o `pnpm dev` em execução.

## Gotchas

- **`pnpm infra:up` mente sobre estar pronto.** Se o volume do `api-db` vier de
  uma parada suja, o Postgres faz `fsync` do data directory inteiro antes de
  aceitar conexão — aqui foram **~5 minutos** com o container marcado
  `unhealthy`. E o erro que aparece não fala em banco: o `db:migrate` trava no
  spinner e a seed morre com `Failed query: select count(*)::int from "programa"`.
  Espere com o laço de `pg_isready` acima; ele roda **dentro** do container.
- **`./scripts/acesso-dev.sh` não funciona com administrador semeado.** A conta
  criada por `--admin-sub` entra na lista com `username` e `email` nulos, e o
  script procura por username: ele aborta com `o admin nao tem 'acesso:read'`,
  que é **falso** — o admin tem as 86 ações. Use
  `driver.mjs conceder <usuario> <senha>`, que casa por `sub`.
- **`pnpm smoke:telas` roda como `coord.teste`**, que numa base recém-semeada tem
  zero concessões. As 27 falhas que ele acusa parecem regressão e são o regime
  "sem concessão, sem acesso". Rode `conceder coord.teste coord123` antes.
- **O vínculo local nasce em `GET /me`**, não no guard. Conta que nunca abriu a
  aplicação não aparece na lista do administrador. O driver sempre chama `/me`
  depois do login — é por isso que `conceder` loga como o alvo antes de conceder.
- **Não existe página em `/catalogos`** — só `/catalogos/bolsas` e
  `/catalogos/modalidades`. A lista completa sai de
  `find apps/web/src/app/\(app\) -name page.tsx`.
- **Sidesheet é `<dialog>` nativo e só cobre a viewport.** Um screenshot
  `fullPage` com o painel aberto sai com o painel flutuando sobre metros de
  página não escurecida. O `foto` detecta `dialog[open]` e fotografa só a
  viewport; ele avisa quando faz isso.
- **Clique em aba do Next não é navegação pesada.** As abas (`?aba=missoes`) são
  `<Link>`: esperar só por `networkidle` devolve o controle antes da troca, e a
  foto sai com a aba anterior ainda ativa. O `clicar` espera a URL mudar **ou**
  um `dialog[open]` aparecer, com teto de 5s.
- **`playwright` não resolve da raiz** (pnpm, e ele é dependência de `apps/web`).
  O driver usa `createRequire` a partir de `apps/web/package.json` e importa
  `@playwright/test` — `playwright` e `playwright-core` **não** resolvem nem de lá.
- **Trocar de conta sem trocar `GR_USUARIO`** reusaria a sessão gravada da conta
  anterior. Cada conta tem pasta e arquivo de sessão próprios.

## Troubleshooting

| Sintoma | Causa | Saída |
|---|---|---|
| `Failed query: select count(*)::int from "programa"` | Postgres ainda subindo | laço de `pg_isready`; `docker logs gerenciador-api-db` mostra `syncing data directory` |
| `db:migrate` parado no spinner `applying migrations...` | idem | idem |
| `o admin nao tem 'acesso:read'` no `acesso-dev.sh` | admin semeado, sem username | `driver.mjs conceder` |
| Tela abre com *Sua conta ainda não recebeu acesso* | conta sem concessão | `driver.mjs conceder <usuario> <senha>` |
| `tour` marca `[SEM ACESSO]` em tudo | idem | idem |
| `/me respondeu 401 -- sessao nao estabelecida` | `pnpm dev` fora do ar, ou sessão velha | confira `/health`; apague `saida/.sessao-<usuario>.json` e rode de novo |
| `[HTTP 404]` numa rota do `tour` | rota que não existe | confira em `apps/web/src/app/(app)/` |
| Nest morre sozinho depois de `db:zerar`/`db:restaurar`/`db:seed` | os scripts encerram as conexões do pool | reinicie o `pnpm dev`; nenhum arquivo mudou, então o `--watch` não reinicia |
