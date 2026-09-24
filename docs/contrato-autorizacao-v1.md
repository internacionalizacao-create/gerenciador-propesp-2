# Contrato executável de autorização — V1-010

Data: 2026-09-15. Implementa a definição do modelo aprovado em
[proposta-autorizacao-v1.md](proposta-autorizacao-v1.md). **Este contrato está
em execução desde a V1-012 (2026-09-16):** é ele que os guards cobram, rota a
rota, e o inventário abaixo é a referência para conferir um endpoint.

> **Corrigido em 2026-09-22.** Até aqui o cabeçalho ainda dizia "contrato
> preparado e unitariamente testado; ainda não aplicado aos endpoints", e
> advertia contra carregar o catálogo em `permissionsForRoles`. As duas frases
> descreviam a janela entre a V1-010 e a V1-012. `permissionsForRoles` e
> `ROLE_PERMISSIONS` **não existem mais** — papel do Keycloak não concede nada
> —, e o receio que a advertência registrava continua válido em outra forma:
> aplicar um modelo (`modelos.ts`) concede ações explícitas a uma conta, e isso
> é ato do administrador, nunca efeito colateral de mudar o catálogo.

## Entrega e limites

Fontes: `apps/api/src/auth/autorizacao-v1/`: catálogo tipado, schemas Zod de
concessão/alvo, modelos copiados sem herança e política pura de administração.
A separação temporária do catálogo legado evita alterar autorizações reais
antes de persistir concessões. **V1-011 persistiu as concessões** em
`concessao_acesso` (migration `0040`), com o mapeamento alvo↔colunas em
`autorizacao-v1/persistencia.ts`; a tabela nasce vazia, e quem a lê a cada
requisição é `autorizacao-v1/acesso-v1.service.ts` (desde a V1-012).
**Não há conversão de acesso legado** (decisão de 2026-09-16): em produção o
Keycloak só autentica, a base sobe sem conta alguma e as contas nascem do
bootstrap mais a tela de administração.
V1-012 integrou guards e `/me`; V1-013 integrou planejamento e orçamento;
V1-014 integrou escrita e referências do planejamento; V1-015 integrou bolsas,
produção, exportação de mobilidade e a projeção dos campos pessoais; V1-016
integrou os caminhos indiretos — histórico do parceiro, anexos e ficha PDF, cada
um pelo alcance da ação que ele mesmo exige; V1-017 integrou a política
administrativa; V1-019 integrou a navegação; V1-036 acrescentou `evento:read`,
`evento:create` e `evento:edit`, com os escopos de planejamento.
O mapa legado **já foi retirado** como fonte de acesso (V1-012): não há dois
mecanismos concorrentes, e não deve voltar a haver.

A dependência V1-001 está satisfeita **para a definição de autorização** pela
aprovação do responsável e seu pedido de iniciar as tarefas. Contrato funcional
completo/P1/infraestrutura continuam em andamento; não impedem este catálogo.
As escolhas abaixo concretizam tecnicamente a decisão, sem alegar homologação.

## Compatibilidade e composição

- Institucional: somente GLOBAL (catálogo, PPG como cadastro, parceiros/contatos,
  convênios, criação de pessoa de gestão e administração de acesso).
- Planejamento/bolsas/produtos/pendências: GLOBAL, CICLO, REDE, TEMATICA,
  PPG+ciclo ou PARTICIPACAO.
- Alterar orçamento: GLOBAL, CICLO, REDE ou TEMATICA; não existe orçamento
  independente da participação para editar. Consultar orçamento aceita recorte
  parcial, sem fabricar teto/saldo do PPG.
- Missões, produtos de missão, prestação e equipes: GLOBAL, CICLO ou REDE.
- Premissas: GLOBAL ou CICLO; não são dados particulares de um PPG.
- Documentos: catálogo admite alcances de planejamento, mas cada alvo restringe
  os tipos válidos ao seu domínio. Parceiro/convênio exige GLOBAL; missão exige
  GLOBAL/CICLO/REDE; bolsa permite participação. A V1-016 pôs isso em execução:
  o anexo herda o alvo pelo alcance da permissão que ele mesmo exige.

Zod recusa permissão desconhecida, campos extras, alvo ambíguo, PPG sem ciclo e
combinação ação/escopo incompatível. Existência e pertencimento dos IDs dependem
da persistência/resolução das próximas tarefas. Concessão é apenas positiva;
não há curingas nem negação. A aprovação de missão pode ser concedida a qualquer
conta interna admitida, independentemente de modelo ou papel no token.

Permissões compostas são verificadas sobre **o mesmo registro**: exportação
requer leitura e exportação em escopos que ambas alcancem. Consulta GLOBAL não
amplia exportação parcial; CPF/documento pessoal exige também leitura do alvo.
Não basta unir nomes de permissões em `/me` para autorizar o registro.

Referências de formulário usam alcance da ação solicitada, não o alcance mais
amplo de consulta. Escrita não concede automaticamente leitura de todas as
listas; conceder leitura é uma escolha explícita. Tela informa capacidades
necessárias sem salvá-las silenciosamente. Endpoint com diversas seções projeta
apenas as autorizadas; indicadores também aplicam essa interseção.

## Modelos e campos pessoais

Sete modelos: administrador, secretaria, responsável de PPG, responsável temático,
gestor da rede, comitê e consulta. São cópias editáveis de ações, **sem escopo
implícito**. Cada ação precisa de alcance compatível antes de salvar, inclusive
as consultas institucionais GLOBAL. Ninguém recebe modelo por papel Keycloak.

Os padrões mantêm separação entre operação, decisão e validação de prestação,
mas personalizações são permitidas. `acesso:delegate` é sempre escolha separada.
Não há modelo discente. Nome do modelo não permite ou proíbe ação em runtime.

`pessoa:read-cpf` libera CPF completo e `pessoa:read-contato` libera telefone/e-mail
pessoal somente no alvo autorizado. Na ausência de capacidade, CPF é mascarado
para quem já pode ler a bolsa e contatos são omitidos; buscas não revelam pessoas
fora do alcance. Modelos de acompanhamento não recebem essas capacidades;
responsáveis recebem contato e secretaria recebe ambas. Escrita pode receber CPF
para identificação sem devolver seu valor completo — a V1-015 implementou as
projeções e acrescentou `pessoa:edit-cpf`, exigida para corrigir um CPF já
cadastrado sobre todas as bolsas daquela pessoa.
Documentos PESSOAL exigem `documento:read-pessoal`; RESTRITA exige
`documento:read-restrito`. Autor do upload não cria exceção ao alcance.

## Administração, bootstrap e recuperação

`acesso:read` consulta; `acesso:write` concede/edita/revoga ações de negócio para
outras contas. Quem administra não precisa exercer pessoalmente a ação que
concede. Esse é um privilégio global amplo, explícito e auditado.

Alterar qualquer concessão `acesso:*` exige **acesso:write + acesso:delegate**.
Assim, administrar bolsas de usuários não autoriza nomear novos administradores.
`acesso:manage-identidade` governa reassociação/ativação; em V1-017, mudanças de
identidade de contas com privilégios `acesso:*` também exigem delegação, para
não contornar essa proteção. Troca de vínculo não muda concessões de dono.

A API comum proíbe toda autoalteração de concessões e identidade, inclusive pelo
delegador. V1-017 deve aplicar a política a cada concessão de um lote e ao estado
anterior e posterior de edição; falha reverte o lote inteiro. Motivo e autoria
são obrigatórios, gerados/validados no servidor. Não aceitar capacidade do ator
nem flag de bypass enviados pelo cliente. Preservar ao menos um administrador
ativo com leitura, escrita e delegação, com verificação transacional concorrente.

Bootstrap/recuperação **é** comando local privilegiado, entregue em V1-021a
(`acesso:bootstrap`), sem rota HTTP pública ou bypass por papel do token.
Operador informa `sub` existente e verificado, identidade local e motivo; a
prévia é o padrão e mostra as concessões exatas. Em
bootstrap, recusar se já existir administrador recuperável. Recuperação exige
modo explícito do comando, acesso operacional ao servidor e registro auditável;
não acontece automaticamente no boot. Conceder somente capacidades de gestão
necessárias (acesso:read/write/delegate/manage-identidade), sem GLOBAL de negócio.
Testar repetição, concorrência e conta inativa; nunca reativar silenciosamente —
os três casos têm teste de integração desde V1-021a. O que o comando ainda não
cobre é a integração com a API administrativa de V1-017, que precisa preservar
ao menos um administrador ativo em cada revogação.

## Inventário de rotas

**Conferido pelo código a cada execução da suíte unitária**
([inventario-rotas.spec.ts](../apps/api/src/auth/inventario-rotas.spec.ts), V1-022):
o teste lê os controllers, extrai de cada rota o `@RequirePermission` ou o
`@Public` e compara com a coluna *Decorador* abaixo. Rota nova sem linha, linha
de rota que não existe mais e decorador diferente do documentado reprovam o CI —
o inventário que divergia do código enganava quem o lia para decidir.

- **Decorador** é exatamente o que o `PermissionsGuard` cobra: a conta precisa
  ter **todas** as ações listadas, em algum alcance. `—` quer dizer sem
  decorador — a sessão basta para chegar ao handler, e a regra mora lá dentro;
  a coluna ao lado diz qual.
- **Regra além do decorador** é o que o serviço confere a mais: alcance do alvo
  concreto, permissão escolhida pelo corpo, projeção de campo. O teste não lê
  esta coluna; é documentação, e quem muda a regra atualiza a linha.
- **Rotas de missão (`…/comite-gestor/missoes/:id/…`)** passam também pelo
  `EscopoMissaoGuard`: fora do alcance de `missao:read`, 404; dentro dele, cada
  ação do decorador precisa alcançar alguma rede da missão, senão 403 — a
  missão já é conhecida, e o que se recusa é a ação. Até a V1-022 o guard
  conferia só a leitura, e quem lia todas as redes e editava uma editava todas.
- Listas e relatórios de missão recortam pela **interseção** dos alcances das
  ações da rota (`IdentidadeService.recorteDeMissoes`).

### acesso.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /acesso/catalogo` | `acesso:read` | — |
| `GET /acesso/alvos` | `acesso:read` | — |
| `GET /acesso/usuarios/:id/concessoes` | `acesso:read` | — |
| `POST /acesso/usuarios/:id/concessoes/previa` | `acesso:read` + `acesso:write` | Mesma política do salvar, sem gravar |
| `POST /acesso/usuarios/:id/concessoes` | `acesso:write` | Ações `acesso:*` exigem também `acesso:delegate`; sem autoalteração; lote atômico; motivo obrigatório; conta pendente (sem pessoa) é recusada |
| `POST /acesso/concessoes/:id/revogacao` | `acesso:write` | Idem; recusa revogar o último administrador recuperável |
| `GET /acesso/usuarios` | `acesso:read` | — |
| `POST /acesso/usuarios/:id/pessoa` | `acesso:manage-identidade` | Vale também para a conta pendente. Pessoa de outra conta exige `transferir: true`, e aquela conta perde a pessoa e é desativada no mesmo ato. Sem autoalteração de nenhuma das duas; `acesso:delegate` se qualquer uma administra acesso; recusa se zerar os administradores; motivo auditado nas duas |

### me.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /me` | — | Identidade da sessão e ações concedidas; faz o vínculo no primeiro acesso. Não devolve escopo agregado (V1-022) |
| `GET /me/acesso` | — | A conta lendo o próprio acesso, com o alcance de cada ação. Exigir `acesso:read` deixaria sem explicação justamente quem não tem acesso a nada |
| `GET /me/exemplo-restrito` | `plano:create` | Sonda do `smoke:login`; não representa autorização sobre uma linha |

### anexos.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /anexos` | — | `documento:read` + alcance do alvo pela permissão que o alvo exige + capacidade de visibilidade. `EVENTO_BOLSISTA` e `REMANEJAMENTO` leem com `evento:read` e escrevem com `evento:create`, no alcance do evento |
| `POST /anexos` | — | `documento:create` + alcance do alvo + capacidade de visibilidade |
| `GET /anexos/:id/historico` | — | `documento:read` + alcance do alvo + capacidade de visibilidade |
| `GET /anexos/:id/conteudo` | — | `documento:download` + alcance do alvo + capacidade de visibilidade |
| `POST /anexos/:id/substituicao` | — | `documento:replace` + alcance do alvo + capacidade de visibilidade |
| `POST /anexos/:id/inativacao` | — | `documento:deactivate` + alcance do alvo + capacidade de visibilidade |

### bolsistas.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /bolsistas` | `bolsa:read` | Alcance da ação; produtos só com `produto:read`; CPF e contato projetados por `pessoa:read-cpf`/`pessoa:read-contato` |
| `GET /bolsistas/opcoes-planejamento` | `bolsa:create` | Alcance da ação |
| `GET /bolsistas/referencias` | — | `bolsa:create` ou `bolsa:edit`, escolhida por `?acao=`; alcance da ação |
| `GET /bolsistas/instituicoes` | — | `bolsa:read`, `bolsa:create` ou `bolsa:edit`; só identificação institucional |
| `GET /bolsistas/:id` | `bolsa:read` | Alcance da ação (404 fora dele); produtos só com `produto:read`; campos pessoais como na lista |
| `POST /bolsistas` | `bolsa:create` | Alcance da ação |
| `PATCH /bolsistas/:id` | `bolsa:edit` | Alcance da ação; alterar CPF existente exige `pessoa:edit-cpf`; não leva a Cancelada/Interrompida nem desfaz situação de evento |
| `POST /bolsistas/:id/produtos` | `produto:create` | Alcance da ação |
| `PATCH /bolsistas/:id/produtos/:produtoId` | `produto:edit` | Alcance da ação |

### comite-gestor.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /pessoas` | `equipe-gestao:read` | Pessoas alcançadas pelas equipes |
| `POST /pessoas` | `equipe-gestao:create-pessoa` | — |

### contatos-parceiros.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /contatos-parceiros` | `parceiro:read` | — |
| `GET /contatos-parceiros/:id` | `parceiro:read` | Parcelas históricas por capacidade e alcance |
| `POST /contatos-parceiros` | `parceiro:create` | — |
| `PATCH /contatos-parceiros/:id` | `parceiro:edit` | — |
| `POST /contatos-parceiros/:id/principal` | `parceiro:edit` | — |
| `POST /contatos-parceiros/:id/inativacao` | `parceiro:status` | — |
| `POST /contatos-parceiros/:id/reativacao` | `parceiro:status` | — |

### convenios.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /convenios` | `convenio:read` | — |
| `GET /convenios/:id` | `convenio:read` | Parcelas históricas por capacidade e alcance |
| `POST /convenios` | `convenio:create` | — |
| `PATCH /convenios/:id` | `convenio:edit` | — |
| `POST /convenios/:id/inativacao` | `convenio:status` | — |
| `POST /convenios/:id/reativacao` | `convenio:status` | — |

### eventos-externos.controller.ts

Três controllers no mesmo arquivo: o evento nasce da bolsa ou do ciclo e depois
o `id` basta. O alcance vem de `condicaoDaBolsa` para o evento do beneficiário e
de `condicaoDoLado` para a movimentação.

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /eventos-externos/tipos` | `evento:read` | Só tipos ativos |
| `PATCH /eventos-externos/bolsistas/:id` | `evento:edit` | Alcance da bolsa; trocar o tipo exige também `bolsa:edit` |
| `PATCH /eventos-externos/movimentacoes/:id` | `evento:edit` | Sobre os dois PPGs atuais e os novos |
| `GET /bolsistas/:id/eventos` | `evento:read` | Alcance da bolsa; fora dele, 404 |
| `POST /bolsistas/:id/eventos` | `evento:create` | E `bolsa:edit`, ambos no alcance da bolsa; substituta exige `evento:create` sobre ela |
| `GET /programas/:programa/:ciclo/eventos-bolsista` | `evento:read` | Alcance por bolsa |
| `GET /programas/:programa/:ciclo/movimentacoes` | `evento:read` | Sobre **qualquer um** dos dois PPGs |
| `GET /programas/:programa/:ciclo/movimentacoes/referencias` | `evento:create` | Só temáticas com dois PPGs no alcance |
| `POST /programas/:programa/:ciclo/movimentacoes` | `evento:create` | Sobre **os dois** PPGs; fora do alcance, 403 com a sigla |

A movimentação responde **403, e não 404**, ao PPG fora do alcance: PPG e
participação são cadastro institucional, e a existência deles não é o dado
protegido. A concessão de bolsa, sim — e por isso o evento da bolsa responde 404.

### mobilidade.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /mobilidade/panorama` | `bolsa:read` | Alcance da ação |
| `GET /mobilidade/producao` | `bolsa:read` + `produto:read` | Parcela de missão exige `missao:read` + `produto-missao:read` |
| `GET /mobilidade/relatorio/exportacao/:formato` | `bolsa:read` + `bolsa:export` | Interseção dos alcances |

### notificacoes.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /notificacoes` | — | Identidade ativa + destinatário; detalhe vinculado exige autorização do alvo |
| `POST /notificacoes/:id/leitura` | — | Identidade ativa + destinatário |

### parceiros.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /parceiros` | `parceiro:read` | — |
| `GET /parceiros/candidatos` | `parceiro:read` | — |
| `GET /parceiros/:id/ficha` | `parceiro:read` + `parceiro:export` | Parcelas históricas por capacidade e alcance |
| `GET /parceiros/:id` | `parceiro:read` | Parcelas históricas por capacidade e alcance |
| `GET /parceiros/:id/historico` | `parceiro:read` | Parcelas históricas por capacidade e alcance |
| `POST /parceiros` | `parceiro:create` | — |
| `PATCH /parceiros/:id` | `parceiro:edit` | — |
| `POST /parceiros/:id/inativacao` | `parceiro:status` | — |
| `POST /parceiros/:id/conciliacao` | `parceiro:merge` | — |

### ppgs.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /ppgs` | `ppg:read` | Bolsas e custo por PPG no alcance de `plano:read`; fora dele, nulos (V1-022) |
| `GET /ppgs/:id` | `ppg:read` | Plano no alcance de `plano:read`; fora dele, `null` com `podeLerPlano: false` |
| `POST /ppgs` | `ppg:create` | Resposta também projeta o plano pelo alcance de `plano:read` |
| `PATCH /ppgs/:id` | `ppg:edit` | Resposta também projeta o plano pelo alcance de `plano:read` |
| `GET /catalogo/bolsas` | `catalogo:read` | — |
| `GET /catalogo/modalidades` | `catalogo:read` | — |
| `POST /catalogo/bolsas` | `catalogo:create` | — |
| `PATCH /catalogo/bolsas/:id` | `catalogo:edit` | — |
| `DELETE /catalogo/bolsas/:id` | `catalogo:delete` | — |
| `POST /catalogo/modalidades` | `catalogo:create` | — |
| `PATCH /catalogo/modalidades/:id` | `catalogo:edit` | — |

### programas.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /programas` | `programa:read` | — |
| `GET /programas/padrao/painel` | `painel:read` | — |
| `GET /programas/:programa` | `programa:read` | — |
| `GET /programas/:programa/:ciclo` | `programa:read` | — |
| `GET /programas/:programa/:ciclo/painel` | `painel:read` | — |
| `GET /programas/:programa/:ciclo/redes` | `orcamento:read` | Alcance da ação |
| `GET /programas/:programa/:ciclo/tematicas/:codigo` | `orcamento:read` | Alcance da ação |
| `GET /programas/:programa/:ciclo/tematicas/:codigo/participacoes/referencias` | — | `participacao:create` ou `participacao:edit`, resolvida no handler |
| `POST /programas/:programa/:ciclo/tematicas/:codigo/participacoes` | `participacao:create` | — |
| `PATCH /programas/:programa/:ciclo/tematicas/:codigo/participacoes/:id` | `participacao:edit` | — |
| `DELETE /programas/:programa/:ciclo/tematicas/:codigo/participacoes/:id` | `participacao:delete` | — |
| `GET /programas/:programa/:ciclo/orcamento` | `orcamento:read` | Alcance da ação; recorte parcial não fabrica teto nem saldo |
| `PATCH /programas/:programa/:ciclo/orcamento/:id` | `orcamento:edit` | Alcance da ação |
| `GET /programas/:programa/:ciclo/plano` | `plano:read` | Alcance da ação; referências separadas por `plano:create`/`edit`/`cancel` |
| `POST /programas/:programa/:ciclo/plano` | `plano:create` | Alcance da ação |
| `PATCH /programas/:programa/:ciclo/plano/:id` | `plano:edit` | Alcance antigo e novo |
| `GET /programas/:programa/:ciclo/plano/:id/historico` | `plano:read` | Alcance da ação |
| `POST /programas/:programa/:ciclo/plano/:id/cancelar` | `plano:cancel` | Alcance da ação |
| `GET /programas/:programa/:ciclo/comite-gestor` | `equipe-gestao:read` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/execucao` | `missao:read` + `prestacao:read` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/painel` | `missao:read` + `prestacao:read` | Interseção dos dois alcances |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/missoes` | `missao:read` | Alcance da ação |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/parceiros` | `missao:read` + `parceiro:read` | Alcance de `missao:read` |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/financas` | `prestacao:read` | Alcance de `prestacao:read` |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/resultados` | `missao:read` + `produto-missao:read` | Interseção dos dois alcances |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/:qual/exportacao/:formato` | `missao:read` | Dinâmica: leitura do relatório + exportação do domínio (finanças: `prestacao:export`; demais: `missao:export`); recorte pela interseção de todas |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/dossie` | `missao:read` + `missao:export` | Seções e documentos por capacidade |
| `GET /programas/:programa/:ciclo/comite-gestor/equipes` | `equipe-gestao:read` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/equipes` | `equipe-gestao:create` | — |
| `PATCH /programas/:programa/:ciclo/comite-gestor/equipes/:id` | `equipe-gestao:edit` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes` | `missao:read` | Alcance da ação |
| `GET /programas/:programa/:ciclo/comite-gestor/referencias-missao` | `missao:read` | Redes pelo alcance de leitura: servem de filtro das listas. O formulário que cria ou edita pode oferecer rede que a escrita recusa — criar confere `missao:create` e editar `missao:edit`, no serviço |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id` | `missao:read` | Seções por capacidade |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | `prestacao:read` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | `prestacao:create` | — |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | `prestacao:edit` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/envio` | `prestacao:submit` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/validacao` | `prestacao:review` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/devolucao` | `prestacao:review` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas` | `prestacao:create` | — |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId` | `prestacao:edit` | — |
| `DELETE /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId` | `prestacao:delete` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes` | `missao:create` | Redes no alcance de `missao:create` |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id` | `missao:edit` | Redes no alcance de `missao:edit`; não retira rede que não alcança |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/relato` | `missao:relato` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/requisitos` | `missao:read` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento` | `missao:read` | Seções por capacidade |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento/dispensa` | `missao:dispensa` | Até a V1-022 exigia `missao:decide`, e `missao:dispensa` concedida não tinha efeito |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento/revogacao` | `missao:dispensa` | Idem |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/submissao` | `missao:submit` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/decisao` | `missao:decide` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/analise/reabertura` | `missao:reopen-analise` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/analise` | `missao:read` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/situacao` | — | Conforme o destino: `missao:confirm`, `missao:cancel` ou `missao:close`, nunca OR genérico; o alcance da ação escolhida é conferido no handler (403 fora dele) |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/reabertura` | `missao:reopen-execucao` | — |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos` | `produto-missao:read` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos` | `produto-missao:create` | — |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId` | `produto-missao:edit` | — |
| `DELETE /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId` | `produto-missao:delete` | — |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/resposta` | `produto-missao:declare` | — |
| `GET /programas/:programa/:ciclo/premissas` | `premissa:read` | — |
| `GET /programas/:programa/:ciclo/pendencias` | `pendencia:read` | — |
| `POST /programas/:programa/:ciclo/pendencias` | `pendencia:create` | — |
| `PATCH /pendencias/:id` | `pendencia:resolve` | — |
| `DELETE /pendencias/:id` | `pendencia:delete` | — |

### health.controller.ts

| Método e rota | Decorador | Regra além do decorador |
|---|---|---|
| `GET /health` | Público | Sem dados do domínio |
