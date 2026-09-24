# Gerenciador PROPESP — contexto do projeto

Referência para quem (pessoa ou LLM) vai mexer neste repositório sem tê-lo escrito: o que o
sistema é, como rodá-lo, as regras que não podem ser quebradas e onde está o resto.
**Mantenha-o atualizado quando mudar arquitetura ou convenção.** Última revisão: 2026-09-23.

**Não é changelog.** O relato de *quando* cada peça entrou está em
[docs/historico/](docs/historico/README.md), com as justificativas inteiras — o corte de
2026-09-22 moveu 1.500 linhas para lá sem apagar nada, pela regra do §7: nota que conta a
história da implementação envelhece; nota que explica o número, não. O índice da
documentação é [docs/README.md](docs/README.md).

## A fila de trabalho agora

**Decisões da V1 em 2026-09-18:** todas as P1 incluídas; preparação para Docker; backup
diário de madrugada; validação atribuída por permissão. **Os responsáveis foram registrados
em 2026-09-22 e a V1-001 foi concluída:** dados institucionais e aceite da versão com a
equipe da PROPESP; infraestrutura, backup e alertas com a equipe de T.I. da PROPESP.
**Atribuição de equipe é a forma final do registro**, decidida na mesma data: não há
interlocutor nominal a levantar, e as fichas de infraestrutura não devem voltar a cobrá-lo.
**V1-054 foi adiada na mesma data**, para depois da segunda rodada de consolidação do banco.

**Recorte de 2026-09-22: a V1 se concentra no fluxo de autorização.** DNS, implantação,
backup, observabilidade, limites, dados institucionais, relatórios e reconciliação de
documentação estão **adiados por decisão do responsável**. A **V1-022 foi concluída em
2026-09-23**: recorte por ação também nas respostas de PPG, retirada do escopo agregado,
inventário de rotas conferido pelo código e percurso automatizado com sessão real.
O trabalho ativo segue na **V1-057**, auditoria dos atos de acesso. Adiar não é dispensar: as fichas continuam
exigíveis antes de qualquer publicação na intranet, e a homologação da versão segue sendo a
V1-060. Na V1-015, CPF, e-mail pessoal e telefone não serão enviados sem capacidade
específica e alcance. Cadastro pode informar CPF sem capacidade de leitura; edição preserva
CPF ausente do payload e sua alteração exige capacidade específica mais edição. Política
aprovada **e implementada na V1-015** no mesmo dia. Fichas e contrato em
[docs/backlog-v1.md](docs/backlog-v1.md).

Antes de iniciar uma task, confira suas dependências **no código**, não só na documentação.

---

## 1. O que é o sistema

Gestão da PROPESP (Pró-Reitoria de Pesquisa e Pós-Graduação) para o PPGE e os demais
programas de pós-graduação, com foco no planejamento de recursos de internacionalização:
bolsas, orçamento por rede e área temática, mobilidade IN/OUT e resultados individuais. Uso
institucional, com dados pessoais de alunos e servidores — o que justifica o rigor em
autenticação e autorização. Arquitetura em
[docs/arquitetura-sistema.md](docs/arquitetura-sistema.md); especificação em
[system-structl.md](system-structl.md).

**É um gerenciador, e só** (decisão do responsável, 2026-09-19). A fonte do que acontece de
fato é a plataforma da CAPES: é lá que a bolsa é implementada, o recurso é remanejado e o
bolsista desiste. **Manter o Gerenciador atualizado é responsabilidade de quem o usa**, não
obrigação do sistema. Três consequências, e valem para qualquer módulo novo:

1. **Não existe sincronização com a CAPES** — nem integração, nem importação automática, nem
   conferência contra a plataforma. Nada aqui tenta adivinhar o que mudou lá. Carregar uma
   planilha que alguém entrega (V1-073) é outra coisa: continua sendo alguém registrando,
   com prévia e conferência humana.
2. **O sistema confia no que o usuário registra.** Status informado à mão é o status; não há
   validação contra fonte externa porque não há fonte externa acessível.
3. **Divergir não é erro do sistema.** Se o plano aqui não reflete a CAPES, o que falta é
   alguém registrar — e a saída é a tela que registra, nunca um alerta de "dado
   possivelmente desatualizado", que só transferiria para a interface uma dúvida que o
   sistema não tem como resolver.

Isso não afrouxa o rigor no que é **próprio** do Gerenciador: cálculo, recorte de acesso e
trilha de auditoria continuam exatos, porque deles o sistema é a fonte.

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
| PostgreSQL | 17 | dois bancos: um do Keycloak, um com os dados de domínio da API |
| Tailwind CSS | 4.x | tokens semânticos, ver §8 |
| Recharts | 3.x | visualizações; o MUI e o Emotion saíram inteiros do projeto |
| TanStack Query | 5.x | busca no browser, só depois da primeira pintura; ver §8 |
| React Hook Form | 7.x | formulários novos, com Zod 4 por `@hookform/resolvers` |
| shadcn/ui, Radix, cmdk | por cópia | o shadcn **não é dependência**: o componente entra no repositório e é traduzido para os tokens daqui (§8); Radix e cmdk ficam por baixo do popover e do combobox |

### Armadilhas de versão (leia antes de escrever código)

1. **`middleware.ts` não existe mais no Next 16 — virou `proxy.ts`**
   ([apps/web/src/proxy.ts](apps/web/src/proxy.ts), que exporta `proxy`). E
   **[apps/web/AGENTS.md](apps/web/AGENTS.md) avisa que este Next diverge do que os modelos
   aprenderam**: antes de usar qualquer API dele, confira em `node_modules/next/dist/docs/`
   — a documentação vem dentro do pacote.
2. **`jose` e `openid-client` são ESM-only.** O Node 24 dá `require()` em ESM sem reclamar;
   o runtime de módulos do Jest, não — por isso a suíte da API roda em modo ESM
   ([apps/api/jest.config.mjs](apps/api/jest.config.mjs)), e nela `jest` não é global:
   `import { jest } from '@jest/globals'`.
3. **Zod 4**: use `z.url()` e `z.email()` no lugar de `z.string().url()`.
4. **Turborepo 2 roda em `envMode: "strict"`.** Variável não declarada em
   `env`/`globalEnv`/`passThroughEnv` é apagada antes da task rodar, mesmo definida no
   shell; as do BFF estão em [apps/web/turbo.json](apps/web/turbo.json), e quem acrescenta
   uma em `lib/env.ts` acrescenta lá também. O sintoma é build que **só quebra no CI** — na
   máquina de quem desenvolve, o Next lê `.env.local` do disco.

---

## 3. Mapa do repositório

```
apps/api/                NestJS — resource server OAuth2
  src/auth/                guards globais (Bearer + @RequirePermission),
                           token-verifier (JWKS), identidade.service, controllers
                           de /acesso e /me
  src/auth/autorizacao-v1/ o modelo em vigor (§6): catalogo, acesso-v1.service,
                           alcance, recorte-bolsa, concessoes.service, bootstrap
  src/comum/               consultar (SQL cru tipado), zod-validation.pipe,
                           resposta-arquivo; src/config/env.ts valida o ambiente
  src/dominio/             um serviço por assunto + controllers REST, uma permissão
                           por endpoint
  src/database/            schema Drizzle (56 tabelas, 16 módulos), migrations e
                           seed; seed/admin.ts só age com --admin-sub
apps/web/                Next.js — BFF + interface
  src/lib/                 env (`server-only`), session (JWE em cookies fatiados),
                           oidc, auth (DAL), api (apiFetch), acao/acao-tipos, bff
                           (cliente do browser), acesso, navegacao, redes, formato
  src/acoes/ componentes/  Server Actions; layout/, ui/ (biblioteca local),
                           formularios/, graficos/, consultas/
  src/app/(app)/           tudo que exige login; api/ tem o fluxo OIDC e o
                           bff/[...path]; proxy.ts faz a checagem otimista de sessão
infra/ packages/ scripts/  compose + realm versionado; tsconfig e eslint; smoke-*.sh,
                           db-*.sh, acesso-dev.sh, api.sh
docs/                      ver docs/README.md
```

---

## 4. Como rodar

O runbook completo — usuários de teste, o que mais o realm configura, backup, zeragem, build
sem internet e o que cada suíte responde — está em
[docs/operacao-local.md](docs/operacao-local.md). O essencial:

```bash
nvm use && pnpm install
cp infra/.env.example infra/.env && pnpm infra:up   # keycloak 8080, dbs 5432/5433
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local        # gere um SESSION_SECRET proprio
pnpm dev                                            # web:3000  api:3001

cd apps/api
pnpm db:migrate                          # aplica migrations
pnpm db:seed --reset --admin-sub <sub>   # base estrutural + administrador
pnpm db:seed --reset --com-dados         # inclui plano, equipes e pendencias
```

**Conta sem concessão não enxerga nada**, e isso é o comportamento certo (§6). O `<sub>` é o
identificador daquele realm, e **não há valor padrão** — sem `--admin-sub` nenhuma conta é
criada, e o que segura o risco de uma instalação nascer com acesso total é não haver padrão
algum. Sem conta semeada, o caminho é `acesso:bootstrap` mais `./scripts/acesso-dev.sh`, que
faz a dança de dois logins que a política exige: **ninguém amplia o próprio acesso**, nem em
desenvolvimento.

**A seed sobe a base estrutural, não a planilha inteira**; `--com-dados` carrega o que a
interface cadastraria, e é o que o **teste de aceite da migração** exige. **`db:zerar` não é
`db:seed --reset`:** o reset apaga tudo, contas e concessões inclusive, e o `db:zerar`
preserva quem já estava configurado. Os comandos de banco **encerram as conexões e derrubam
a API** — o `--watch` não a reinicia, porque nenhum arquivo mudou.

```bash
pnpm lint && pnpm build && pnpm test   # raiz: lint, build, unitarios
pnpm --filter api test:int             # integracao (exige Postgres no ar)
pnpm smoke:login && pnpm smoke:telas && pnpm smoke:acesso
pnpm test:e2e                          # jornadas no navegador (Playwright)
```

Os smokes respondem a perguntas diferentes: `smoke:telas` abre cada tela de **uma** conta
que enxerga tudo e procura os números no HTML (**pressupõe `--com-dados`**), impedindo que
um serviço correto fique invisível por um erro na página; `smoke:acesso` prova que **duas
contas veem coisas diferentes**, afirmando sobre o acesso e nunca sobre o volume. `test:int`
inclui o teste de aceite: o sistema tem que reproduzir os indicadores das planilhas
([system-structl.md](system-structl.md) §8.3), e falha ali é fórmula errada ou dado sujo.
**A trava de testes aceita somente `gerenciador_test` em loopback** — não use esse nome para
dados reais nem encaminhe a porta local para um banco institucional.

---

## 5. Arquitetura de autenticação (resumo)

O browser guarda um cookie httpOnly com a sessão selada em JWE; o Next (BFF) troca o code
por tokens no servidor e chama a API com `Authorization: Bearer`; a API valida a assinatura
contra o JWKS do realm. Detalhes em [docs/autenticacao.md](docs/autenticacao.md). Três
decisões definem tudo o mais:

1. **BFF.** O JavaScript do browser nunca vê um token — um XSS não tem o que roubar. Chamada
   do cliente passa por `/api/bff/*`, que injeta o `Bearer` no servidor.
2. **Login hospedado no Keycloak** (Authorization Code + PKCE). Senha nenhuma passa por este
   código. MFA, política de senha, reset e federação LDAP/AD viram configuração de console,
   não código.
3. **Controllers falam em permissão, não em papel.** `@RequirePermission('plano:write')`,
   nunca `@Roles('coordenador')`.

**A autorização que vale é a da API.** O `proxy.ts` e a UI só evitam telas inúteis; se ambos
sumissem, nenhum dado vazaria, porque todo endpoint é fechado por padrão — o `JwtAuthGuard`
é global e só `@Public()` abre.

---

## 6. Modelo de autorização e como estendê-lo

O Keycloak **autentica**; quem autoriza são as concessões individuais guardadas na
aplicação. Decisão do responsável de 2026-09-16, em execução desde a V1-012: **nenhum papel
de negócio é criado ou atribuído no realm**, nem em produção.

```
Keycloak emite:  sub (quem é a pessoa) — o papel não concede nada
Guard resolve:   concessao_acesso(sub) -> ações + alcance de cada uma
Controller pede: @RequirePermission('plano:create')
```

O catálogo vive em
[autorizacao-v1/catalogo.ts](apps/api/src/auth/autorizacao-v1/catalogo.ts), o resolver em
[acesso-v1.service.ts](apps/api/src/auth/autorizacao-v1/acesso-v1.service.ts), o inventário
rota a rota em [docs/contrato-autorizacao-v1.md](docs/contrato-autorizacao-v1.md) e o
rollback em [docs/ativacao-acesso-v1.md](docs/ativacao-acesso-v1.md). **Uma consulta por
requisição, sem cache** — é o que faz a revogação valer na requisição seguinte.

**Sem concessão, sem acesso**, e não existe modo permissivo — nem deve voltar a existir:
conta não configurada não tem ação a exercer, e um recorte permissivo vazaria dado de quem
foi configurado pela metade. **Voltar atrás preserva a restrição:** não existe chave que
reabra a leitura para todos, e a ausência dela é o desenho, não uma lacuna. Por isso
`acesso:contas` **recusa desativar o último administrador recuperável** — desativar fecha
tudo de uma vez, `acesso:*` incluído, e instalação sem administrador ativo não concede nada
a ninguém.

**Para adicionar uma permissão nova:** acrescente a chave em `CATALOGO_PERMISSOES_V1`, com
rótulo e tipos de alvo; use `@RequirePermission('sua:permissao')` no handler; acrescente a
rota ao inventário; e, se ela couber num modelo, inclua-a em `modelos.ts` — modelo é ponto
de partida da tela, não papel, e editá-lo não muda quem já foi configurado. Se ela destrava
uma tela, ponha-a no `exige` do item de menu **e** na porta da página (§8): sem isso, ou a
tela não aparece para quem pode, ou aparece para quem a API vai recusar. **Não crie papel
novo no realm** esperando que conceda algo. **Duas formas o decorador não expressa**, e por
isso moram no handler: ação que depende do corpo (a situação da missão confere
`missao:confirm`/`cancel`/`close`) e permissão que só se conhece em runtime (exportar
relatório exige ler aquele relatório mais exportar o domínio).

### Identidade, alvo e alcance

`usuario_sistema` responde *quem é* (liga `sub` a `pessoa`); `concessao_acesso` responde *o
que pode fazer, e sobre o quê* — esta conta, esta ação, este alvo (`GLOBAL`, `CICLO`,
`PPG`+ciclo, `REDE`, `TEMATICA` ou `PARTICIPACAO`). **As duas perguntas vivem na mesma
linha**, porque é assim que elas são feitas: não "quais PPGs esta conta enxerga", mas "em
quais PPGs ela pode lançar bolsa" — e a resposta pode diferir da de "consultar o plano".

**O vínculo se faz no primeiro acesso, por e-mail**
([identidade.service.ts](apps/api/src/auth/identidade.service.ts), em `GET /me`). Sem
correspondência cria pessoa nova, porque recusar o login deixaria o usuário preso sem tela
para pedir ajuda — e **criar pessoa não concede acesso**. É em `/me`, não no guard, que roda
em toda requisição. **`/me` nunca deve falhar por causa do vínculo:** responde `pessoaId: null`
e `vinculoPendente: true`, e a sessão segue válida. Repontar a pessoa automaticamente
seria pior — bastaria criar conta com um e-mail conhecido para herdar identidade; quem
desempata é `POST /acesso/usuarios/:id/pessoa`.

### As regras de recorte que não podem ser quebradas

Estão em lista porque são cobradas em revisão. A redação longa, com o raciocínio de cada
uma, está em [docs/historico/](docs/historico/README.md).

- **O recorte entra na consulta, nunca numa filtragem em memória** — filtrar fora do banco
  traz a tabela inteira para a aplicação e vaza a contagem real em qualquer soma feita antes
  do filtro. Vale também para o agregado.
- **Alvo fora do alcance responde 404, não 403**: "existe, mas não é seu" já entrega que o
  PPG, a bolsa ou a missão existem. Pelo mesmo motivo, **alvo inexistente e alvo fora do
  alcance respondem a mesma mensagem** — textos distintos deixariam mapear o que existe
  trocando o UUID até a frase mudar. A exceção é a ação recusada sobre alvo que a conta
  **já** alcança: aí é 403, porque o que se recusa é a ação, não a existência.
- **Quem tem alcance de rede e nenhum de PPG não está "sem configuração"** — foi configurado
  para outra dimensão, e liberar todos os PPGs seria vazamento.
- **Documento herda o escopo do alvo**, pelo alcance da permissão que ele mesmo exige —
  senão o anexo é a porta lateral do recorte, na leitura e na escrita: pendurar arquivo em
  alvo alheio conhecendo o UUID é o mesmo furo pelo avesso.
- **Campo pessoal é projetado no SQL, nunca filtrado depois** — CPF sob `pessoa:read-cpf`,
  e-mail e telefone sob `pessoa:read-contato`, cada um cruzado com o alcance daquele alvo.
  Sem a capacidade o campo vem **nulo**, acompanhado de `podeLerCpf`/`podeLerContato` para a
  tela escrever *Sem acesso* em vez de *Não informado*: ausência de permissão e ausência de
  dado não são a mesma frase. **Não há máscara parcial** — meio CPF ainda é CPF —, e a
  exportação não pode reintroduzir o campo que o JSON removeu.
- **Duplicidade não revela cadastro alheio**: CPF repetido, e-mail de outra pessoa e colisão
  concorrente respondem a **mesma** frase genérica. Mensagens distintas seriam um oráculo —
  bastaria variar o CPF até a recusa mudar de texto.
- **A categoria do documento decide a visibilidade, nunca o cliente**, senão bastaria enviar
  `INTERNA` junto de um passaporte. E **`PESSOAL` e `RESTRITA` não são níveis, são públicos
  diferentes**: o Comitê abre `RESTRITA` e não `PESSOAL`, a secretaria o contrário. São
  permissões próprias, mapeadas com `if` explícito — um `||` entre as duas daria a cada uma
  o alcance da outra.

---

## 7. Convenções de código

- **Código interno não aparece na tela.** `RN-09`, `CG-028`, `D-10`, `PEND-006` vão em
  comentário, teste e documentação — nunca em rótulo, nota, dica ou mensagem de erro; na
  tela a regra se explica pelo que faz ("aporte anual repetido nos 4 exercícios"). **Nota
  que conta a história da implementação envelhece; nota que explica o número, não** — "o
  escopo por rede entra na CG-028" é defeito; "`exists`, senão a missão de duas redes
  apareceria duas vezes" é documentação.
- **Idioma:** tudo em português, com comentários **sem acentuação** e **texto que o usuário
  lê sempre acentuado**. A fronteira não é óbvia: a mensagem de uma exceção da API chega
  inteira à tela, repassada por `traduzirErro` ([acao.ts](apps/web/src/lib/acao.ts)), e
  conta como interface. Identificador e nome de permissão seguem em inglês minúsculo e **não
  se acentuam nem dentro de uma mensagem** — `Permissão necessária: prestacao:read`.
- **Comentários explicam o porquê, não o quê** — densidade alta nos arquivos de auth é
  proposital: são decisões de segurança que ninguém adivinha relendo.
- **Validação com zod em toda fronteira** (ambiente, claims, cookie, corpo); a API não usa
  `class-validator` e não deve carregar duas bibliotecas de validação. Formulário novo é
  React Hook Form + Zod, com o schema do cliente em `lib/formularios/` — e a API valida de
  novo, porque é ela a fronteira autoritativa.
- **Nada de `NEXT_PUBLIC_`** nas variáveis de auth: `lib/env.ts` usa `server-only`, e
  importá-lo de um Client Component quebra o build de propósito; pelo mesmo motivo
  `lib/acao.ts` é `server-only` e o cliente importa de `acao-tipos.ts` — foi o que impediu
  `apiFetch` de vazar para o bundle do browser. **A API não habilita
  CORS** — o browser nunca fala com ela direto, e vontade de ligar CORS costuma ser o
  sintoma de estar prestes a furar o desenho BFF.
- **Dinheiro nunca passa por `number` antes de uma conta:** `somarMoeda`
  ([lib/formato.ts](apps/web/src/lib/formato.ts)) soma em centavos com `BigInt`, truncando
  cada parcela **antes** da soma; se tudo for nulo o resultado é nulo, nunca zero.
- **Arquivo é validado pelo conteúdo, não pela extensão**, e nada é servido por URL
  estática: todo download passa por endpoint autenticado com chave opaca, e substituir cria
  versão nova sem apagar a anterior. Não há antivírus — o ponto de inserção é
  `validarArquivo`, antes de `armazenamento.guardar`.
- **Exportação neutraliza fórmula na escrita** (`=`, `+`, `-`, `@`, tab, CR ganham aspa
  simples), nunca na leitura, quando o arquivo já saiu; e chama o **mesmo serviço da tela**
  (o PDF é `pdfkit` para desenhar mais `pdf-lib` para concatenar anexos),
  com o mesmo usuário e recorte, porque segunda origem diverge na primeira mudança. Com
  `@Res({ passthrough: true })` use `resposta.send`, nunca `return` — o Nest serializa o
  `Buffer` como JSON e o arquivo baixado fica inútil, com os cabeçalhos corretos.
- **Armadilha de SQL do Drizzle:** dentro de um `sql` cru a coluna interpolada sai **sem o
  nome da tabela**; numa subconsulta correlacionada, `pp.ppg_id = ${s.ppg.id}` vira
  `pp.ppg_id = "id"` e casa com o `id` da tabela interna — a condição responde sempre
  `false`, em silêncio, porque continua sendo SQL válido. Qualifique a coluna à mão.
- **`exists`, nunca `join`, para relação N:N que você só quer testar.** Missão de duas
  redes, parceiro visitado em duas paradas e bolsa com três produtos viram linhas
  duplicadas, e o número inflado passa despercebido. Pelo mesmo motivo, o total de um
  conjunto que se sobrepõe **não é a soma das linhas**, e a tela precisa dizer isso.
- **Nenhum derivado é persistido** — retenção, "mobilidade realizada" e checklist de
  encerramento são calculados na leitura: coluna gravada diverge na primeira correção, e a
  tela passa a afirmar o que já não é verdade.

---

## 8. Tema e interface

O detalhe está em [docs/guia-interface.md](docs/guia-interface.md) — tokens, tradução do
shadcn, TanStack Query, o catálogo de componentes e a acessibilidade já resolvida. O que não
pode regredir:

- **Use sempre o token semântico**, nunca hex nem cor crua do Tailwind, e nunca classe
  montada dinamicamente (`bg-${cor}`): o Tailwind 4 escaneia o texto do fonte. **O
  componente do shadcn nunca entra como veio** — lá `muted` é fundo, aqui `--muted` **é cor
  de texto**, e colar sem traduzir produz texto cinza sobre fundo cinza.
- **Cor de gráfico vai como `var(--token)` direto no SVG**, nunca resolvida em JavaScript:
  assim a troca de tema repinta sozinha. **A cor de uma rede sai do nome, nunca da posição**
  ([lib/redes.ts](apps/web/src/lib/redes.ts)).
- **Valor nulo não vira zero.** `Moeda` escreve *A definir*, e no gráfico `null` desenha um
  vazio — barra rente ao eixo é indistinguível de orçamento zerado. O gráfico acompanha a
  tabela e não a substitui: só ela é precisa para quem usa leitor de tela.
- **Cadastro entra por `Sidesheet`**, que é `<dialog>` nativo — foco preso, `Esc` e fundo
  inerte vêm do navegador, não reimplemente isso. No `Multistep` todos os passos ficam
  montados, com o inativo em `hidden`, senão o `FormData` não traz o formulário inteiro.
- **Tela fora do acesso responde 200 com explicação**, nunca erro genérico: use `faltando`
  ([lib/acesso.ts](apps/web/src/lib/acesso.ts)) e `SemAcesso` **antes** de consultar a API.
  O menu monta-se pelas ações concedidas — [navegacao.ts](apps/web/src/lib/navegacao.ts) usa
  `exige` para acesso e `disponivel` para escopo futuro, e juntar os dois faria o módulo por
  vir sumir da régua num ambiente sem concessões.
- **O TanStack Query não serve ao carregamento inicial**; o que o Server Component pode
  buscar continua sendo buscado lá, com `apiFetch`. O `QueryClient` nasce dentro de
  `useState`, nunca em módulo — seria singleton do processo do servidor, e o cache de um
  usuário logado poderia ser servido ao próximo.
- **Server Action revalida a rota real, não um apelido**
  (`revalidatePath("/programas/[programa]/[ciclo]/parceiros", "page")`), e **função
  exportada de módulo `"use client"` não pode ser chamada pelo Server Component** — o build
  passa e a página responde 500; o que os dois lados usam vai num `.ts` neutro.

---

## 9. Estado atual, em duas linhas

**Existe e está verificado:** autenticação e autorização completas (§5, §6); 56 tabelas com
a seed real; os cálculos RN-01 a RN-20, todos em SQL; as telas de planejamento (P01, P05–P10,
P14, P15, P17); bolsas e produtos individuais (P03); panorama, mapa e produção de mobilidade
(P02, P04, P18/P19); parceiros (P24); eventos externos da CAPES (P12); e o **módulo do
Comitê Gestor inteiro**, com as 69 tasks fechadas.

**Não existe ainda**, entre outros: dado individual de mobilidade (a P03 começa vazia porque
as planilhas não trazem o beneficiário — **não é bug**), relatórios gerais (P20), importação
por programa (P21), home por perfil, rate limiting, auditoria fora das edições de
plano/orçamento, observabilidade e qualquer configuração de produção. O inventário completo,
com o motivo de cada ausência, está em [docs/estado-atual.md](docs/estado-atual.md) —
**atualize-o ao fechar uma task**.

---

## 10. Cuidados ao mexer

- **Trocar `SESSION_SECRET` derruba todas as sessões ativas** — efeito desejado em caso de
  vazamento, incômodo se for sem querer. **`pnpm kc:import --force` apaga o realm inteiro**,
  usuários criados pelo console inclusive: o JSON é a fonte da verdade.
- O segredo do client (`dev-web-secret-nao-use-em-producao`) está versionado de propósito,
  para o ambiente de desenvolvimento subir sem passos manuais. **Qualquer outro ambiente
  precisa de um segredo novo, gerado no console.**
- O cookie de sessão passa de 4 KB e por isso é fatiado em `gr_session.0`, `gr_session.1`.
  Se mexer no conteúdo da sessão, confira o tamanho — o limite defensivo é 8 fatias.
- Comandos que sobem servidor (`pnpm dev`) são persistentes; não os encadeie em scripts que
  precisam terminar. **`pnpm ngrok:demo` publica os dados de desenvolvimento**: usa API
  `3333`, web `3334`, Keycloak `8888` e gateway `3335`, mantém API e Postgres fora do túnel
  e altera temporariamente hostname e redirects do client OIDC;
  encerre com `Ctrl+C` para restaurar e, após encerramento forçado, rode `pnpm infra:up`
  antes de voltar ao `pnpm dev`.
- **Sessão expirada leva ao login, e isso depende de três peças.** Layout e página
  renderizam **em paralelo**: o `requireSession()` do layout redirecionava, mas a página já
  tinha chamado a API e estourado antes — e, sem nenhum `error.tsx` no projeto, o erro
  virava a tela de erro do Next. Hoje `apiFetch` manda para `/login` quando não há sessão ou
  quando a API responde 401; o `proxy.ts` corta antes de renderizar quando
  `refreshExpiresAt` já passou (e apaga o cookie morto); e `app/(app)/error.tsx` é a rede
  embaixo dos dois. **Todo
  `catch` em volta de `apiFetch` precisa de `unstable_rethrow`** — `redirect()` sinaliza por
  exceção, e engoli-la traz o erro de volta.
- **`proxy.ts` enumera rotas públicas, não protegidas.** Com o sistema inteiro atrás de
  login, listar o que é protegido significaria lembrar de cada tela nova, e esquecer
  falharia em silêncio.
- **Não reabra decisão homologada sem aceite institucional.** Um PDF novo da equipe não
  substitui silenciosamente o que já foi confirmado; a folha de cada módulo está em
  [docs/README.md](docs/README.md), seção *Registros*.
