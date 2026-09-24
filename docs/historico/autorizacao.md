# Histórico — Autorização agnóstica (V1-010 a V1-022)

Saiu do `AGENTS.md` na reorganização de 2026-09-22. Conta **como** o modelo de
papéis do Keycloak foi substituído por concessões individuais na aplicação, task
a task. O modelo **em vigor** e como estendê-lo estão no `AGENTS.md` §6; o
inventário rota a rota, em [../contrato-autorizacao-v1.md](../contrato-autorizacao-v1.md);
o modelo aprovado, em [../proposta-autorizacao-v1.md](../proposta-autorizacao-v1.md);
o roteiro de ativação e rollback, em [../ativacao-acesso-v1.md](../ativacao-acesso-v1.md).

**A fila de trabalho atual não está aqui** — está em
[../backlog-v1.md](../backlog-v1.md) e no bloco do topo do `AGENTS.md`.

---

## A troca do modelo, task a task

**Planejamento da V1 interna (2026-09-15):** a fila atual de trabalho está em
[docs/backlog-v1.md](../backlog-v1.md), com fichas detalhadas para execução
sob demanda. A [proposta de autorização](../proposta-autorizacao-v1.md)
registra o modelo aprovado pelo responsável em 2026-09-15: concessões individuais
de permissão + escopo na aplicação, Keycloak para autenticação e perfis como
modelos opcionais. O público é interno, sem autosserviço de bolsistas/externos.
Esses documentos não significam homologação institucional.
A V1-010 entregou o contrato em `apps/api/src/auth/autorizacao-v1/` (catálogo,
concessões Zod, modelos e política administrativa), com o inventário rota a rota
em [docs/contrato-autorizacao-v1.md](../contrato-autorizacao-v1.md).
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
[docs/ativacao-acesso-v1.md](../ativacao-acesso-v1.md)** (V1-021e): instalação
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
[bootstrap.ts](../../apps/api/src/auth/autorizacao-v1/bootstrap.ts): instalação que
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
[diagnóstico de 2026-09-15](../diagnostico-v1-2026-09-15.md) registra divergências
entre descrições antigas abaixo e funcionalidades já entregues.


---

## A indireção do catálogo de permissões pagou-se

**A granularidade apertou, e a indireção pagou-se**: trocar a fonte de
autorização de papel para concessão individual não exigiu que nenhum controller
mencionasse papel, porque nenhum mencionava. O que mudou foi de onde
`user.permissions` vem, mais a troca dos nomes das ações pelos do catálogo.


---

## Identidade local e escopo de acesso — a redação de origem

O `AGENTS.md` §6 resume estas regras em lista curta desde 2026-09-22. O texto
integral fica aqui, porque é nele que o raciocínio aparece por extenso.

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
[identidade.service.ts](../../apps/api/src/auth/identidade.service.ts) liga as duas em
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


## V1-022 — Consolidação do fluxo (2026-09-23)

A retomada encontrou implementadas a retirada do escopo agregado, a migração
para `PermissaoV1`, o inventário por metadados e correções no alcance das ações
de missão, relatórios, dispensa e reassociação de identidade. A validação
completou as jornadas de navegador e fechou a resposta de escrita dos PPGs.

Defeitos encontrados e regressões:

- A consulta institucional de PPG trazia custos e plano fora de `plano:read`.
  Lista e detalhe agora recortam no SQL; `podeLerPlano` distingue falta de acesso
  de planejamento vazio. `planoRecortado` avisa que o total é parcial.
- A edição do cadastro ainda devolvia o plano completo. POST e PATCH passam
  explicitamente o alcance de `plano:read` à resposta; escrita de cadastro não
  concede leitura de planejamento. A página também usava `ppg:create` para
  oferecer edição; agora exige `ppg:edit`.
- A leitura global de missões permitia ações concedidas só em uma rede. O guard
  confere cada ação; transições conferem a ação escolhida pelo corpo, e
  relatórios/exportações cruzam seus alcances. Dispensa exige `missao:dispensa`.
- A reassociação de identidade não aplicava as restrições administrativas:
  agora recusa autoalteração, exige delegação ao alterar conta administrativa e
  registra motivo na auditoria.
- O inventário citava permissões antigas e omitia endpoints. A tabela única
  confere com os metadados dos controllers na suíte unitária; uma alteração
  proposital de `POST /ppgs` para `ppg:read` foi rejeitada, e o documento foi
  restaurado. O README da API aponta para essa fonte única.

`apps/web/e2e/autorizacao.spec.ts` cobre os sete modelos aplicados pela tela,
prévia sem efeito, permissões no `/me`, todos os itens disponíveis de menu com
capacidade exigida, respostas reais da API e revogação sem novo login. Outra
jornada compara duas contas com PPGs distintos. O bootstrap parte de nenhuma
conta local: primeiro login, CLI em prévia e aplicação, segundo login,
delegação e concessão de negócio por outra pessoa; autoampliação é recusada.
Modelos completos são exercitados em GLOBAL; os alcances parciais têm jornada
própria e regressões SQL por PPG/ciclo, ciclo, rede, temática e participação,
inclusive concessões sobrepostas.

O smoke do desenvolvimento não foi executado: ele altera concessões de
`docente.teste`. O percurso foi realizado no realm e banco descartáveis do e2e.
A homologação institucional continua na V1-060; esta entrega é aceite técnico.

Validação final: lint e build aprovados; 280 testes unitários (89 API, 191 web),
733 testes de integração em 43 suítes e 17 jornadas de navegador.
