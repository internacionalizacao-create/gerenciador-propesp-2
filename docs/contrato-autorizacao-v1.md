# Contrato executável de autorização — V1-010

Data: 2026-09-15. Implementa a definição do modelo aprovado em
[proposta-autorizacao-v1.md](proposta-autorizacao-v1.md). **Contrato preparado e
unitariamente testado; ainda não aplicado aos endpoints.** Os papéis legados,
guards, realm e navegação continuam em execução até a migração coordenada.
Não carregar este catálogo em `permissionsForRoles`: isso concederia ações novas
a contas antigas sem revisão nominal.

## Entrega e limites

Fontes: `apps/api/src/auth/autorizacao-v1/`: catálogo tipado, schemas Zod de
concessão/alvo, modelos copiados sem herança e política pura de administração.
A separação temporária do catálogo legado evita alterar autorizações reais
antes de persistir concessões. **V1-011 persistiu as concessões** em
`concessao_acesso` (migration `0040`), com o mapeamento alvo↔colunas em
`autorizacao-v1/persistencia.ts`; a tabela nasce vazia e ainda não tem leitor.
**Não há conversão de acesso legado** (decisão de 2026-09-16): em produção o
Keycloak só autentica, a base sobe sem conta alguma e as contas nascem do
bootstrap mais a tela de administração.
V1-012 integra guards e `/me`; V1-013–016 integram
os domínios; V1-017 integra a política administrativa; V1-019 integra a navegação.
Após a transição, retirar o mapa legado como fonte de acesso. Não manter dois
mecanismos permissivos concorrentes.

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
  GLOBAL/CICLO/REDE; bolsa permite participação. V1-016 valida o alvo e herança.

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
para identificação sem devolver seu valor completo. V1-015 implementa projeções.
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

## Inventário de rotas e autorização de destino

Levantamento dos controllers presentes nesta revisão. Coluna atual mostra os
decoradores, não toda a proteção interna de serviços. A coluna destino é o
contrato de migração, **não uma afirmação de proteção já ativa**. Rotas futuras
herdam o catálogo e precisam de entrada explícita neste inventário.

### acesso.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /acesso/usuarios` | acesso:read | acesso:read |
| `POST /acesso/usuarios/:id/escopos` | acesso:write | acesso:write; acesso:delegate adicional para permissões acesso:* |
| `DELETE /acesso/escopos/:id` | acesso:write | acesso:write; acesso:delegate adicional para permissões acesso:* |
| `POST /acesso/usuarios/:id/pessoa` | acesso:write | acesso:manage-identidade; sem autoalteração e sem contornar delegação |

### me.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /me` | Serviço/identidade | Identidade/sessão, sem liberar domínio |
| `GET /me/acesso` | Serviço/identidade | Nenhuma: é a conta lendo o próprio acesso, com o alcance nomeado (V1-019). Exigir `acesso:read` deixaria sem explicação justamente quem não tem acesso a nada. |
| `GET /me/exemplo-restrito` | plano:write | plano:create (sonda; não representa autorização sobre uma linha) |

### anexos.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /anexos` | Serviço/identidade | documento:read + leitura/alcance do alvo + capacidade de visibilidade |
| `POST /anexos` | Serviço/identidade | documento:create + leitura/alcance do alvo + capacidade de visibilidade |
| `GET /anexos/:id/historico` | Serviço/identidade | documento:read + leitura/alcance do alvo + capacidade de visibilidade |
| `GET /anexos/:id/conteudo` | Serviço/identidade | documento:download + leitura/alcance do alvo + capacidade de visibilidade |
| `POST /anexos/:id/substituicao` | Serviço/identidade | documento:replace + leitura/alcance do alvo + capacidade de visibilidade |
| `POST /anexos/:id/inativacao` | Serviço/identidade | documento:deactivate + leitura/alcance do alvo + capacidade de visibilidade |

### bolsistas.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /bolsistas` | bolsa:read + produto:read | bolsa:read; produtos somente com produto:read |
| `GET /bolsistas/opcoes-planejamento` | bolsa:read | Referências de bolsa:create ou bolsa:edit, alcance da ação |
| `GET /bolsistas/referencias` | bolsa:read | Referências de bolsa:create ou bolsa:edit, alcance da ação |
| `GET /bolsistas/instituicoes` | bolsa:read | bolsa:read; somente identificação institucional |
| `GET /bolsistas/:id` | bolsa:read + produto:read | bolsa:read; produtos somente com produto:read |
| `POST /bolsistas` | bolsa:write | bolsa:create |
| `PATCH /bolsistas/:id` | bolsa:write | bolsa:edit |
| `POST /bolsistas/:id/produtos` | produto:write | produto:create |
| `PATCH /bolsistas/:id/produtos/:produtoId` | produto:write | produto:edit |

### comite-gestor.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /pessoas` | equipe-gestao:read | equipe-gestao:read (pessoas alcançadas pelas equipes) |
| `POST /pessoas` | equipe-gestao:write | equipe-gestao:create-pessoa |

### contatos-parceiros.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /contatos-parceiros` | parceiro:read | parceiro:read |
| `GET /contatos-parceiros/:id` | parceiro:read | parceiro:read; parcelas históricas por capacidade e alcance |
| `POST /contatos-parceiros` | parceiro:write | parceiro:create |
| `PATCH /contatos-parceiros/:id` | parceiro:write | parceiro:edit |
| `POST /contatos-parceiros/:id/principal` | parceiro:write | parceiro:edit |
| `POST /contatos-parceiros/:id/inativacao` | parceiro:write | parceiro:status |
| `POST /contatos-parceiros/:id/reativacao` | parceiro:write | parceiro:status |

### convenios.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /convenios` | parceiro:read | convenio:read |
| `GET /convenios/:id` | parceiro:read | convenio:read; parcelas históricas por capacidade e alcance |
| `POST /convenios` | parceiro:write | convenio:create |
| `PATCH /convenios/:id` | parceiro:write | convenio:edit |
| `POST /convenios/:id/inativacao` | parceiro:write | convenio:status |
| `POST /convenios/:id/reativacao` | parceiro:write | convenio:status |

### mobilidade.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /mobilidade/panorama` | bolsa:read | bolsa:read |
| `GET /mobilidade/producao` | bolsa:read + produto:read | bolsa:read + produto:read; parcela de missão exige produto-missao:read |
| `GET /mobilidade/relatorio/exportacao/:formato` | bolsa:read | bolsa:read + bolsa:export |

### notificacoes.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /notificacoes` | Serviço/identidade | Identidade ativa + destinatário; detalhe vinculado exige autorização do alvo |
| `POST /notificacoes/:id/leitura` | Serviço/identidade | Identidade ativa + destinatário; detalhe vinculado exige autorização do alvo |

### parceiros.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /parceiros` | parceiro:read | parceiro:read |
| `GET /parceiros/candidatos` | parceiro:read | parceiro:read |
| `GET /parceiros/:id/ficha` | parceiro:read | parceiro:read + parceiro:export; parcelas históricas por capacidade e alcance |
| `GET /parceiros/:id` | parceiro:read | parceiro:read; parcelas históricas por capacidade e alcance |
| `GET /parceiros/:id/historico` | parceiro:read | parceiro:read; parcelas históricas por capacidade e alcance |
| `POST /parceiros` | parceiro:write | parceiro:create |
| `PATCH /parceiros/:id` | parceiro:write | parceiro:edit |
| `POST /parceiros/:id/inativacao` | parceiro:write | parceiro:status |
| `POST /parceiros/:id/conciliacao` | parceiro:write | parceiro:merge |

### ppgs.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /ppgs` | ppg:read | ppg:read |
| `GET /ppgs/:id` | ppg:read | ppg:read |
| `POST /ppgs` | ppg:write | ppg:create |
| `PATCH /ppgs/:id` | ppg:write | ppg:edit |
| `GET /catalogo/bolsas` | catalogo:read | catalogo:read |
| `GET /catalogo/modalidades` | catalogo:read | catalogo:read |
| `POST /catalogo/bolsas` | catalogo:write | catalogo:create |
| `PATCH /catalogo/bolsas/:id` | catalogo:write | catalogo:edit |
| `DELETE /catalogo/bolsas/:id` | catalogo:write | catalogo:delete |
| `POST /catalogo/modalidades` | catalogo:write | catalogo:create |
| `PATCH /catalogo/modalidades/:id` | catalogo:write | catalogo:edit |

### programas.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /programas` | programa:read | programa:read |
| `GET /programas/padrao/painel` | painel:read | painel:read |
| `GET /programas/:programa` | programa:read | programa:read |
| `GET /programas/:programa/:ciclo` | programa:read | programa:read |
| `GET /programas/:programa/:ciclo/painel` | painel:read | painel:read |
| `GET /programas/:programa/:ciclo/redes` | orcamento:read | orcamento:read |
| `GET /programas/:programa/:ciclo/tematicas/:codigo` | orcamento:read | orcamento:read |
| `GET /programas/:programa/:ciclo/orcamento` | orcamento:read | orcamento:read |
| `PATCH /programas/:programa/:ciclo/orcamento/:id` | orcamento:write | orcamento:edit |
| `GET /programas/:programa/:ciclo/plano` | plano:read | plano:read |
| `POST /programas/:programa/:ciclo/plano` | plano:write | plano:create |
| `PATCH /programas/:programa/:ciclo/plano/:id` | plano:edit | plano:edit |
| `GET /programas/:programa/:ciclo/plano/:id/historico` | plano:read | plano:read |
| `POST /programas/:programa/:ciclo/plano/:id/cancelar` | plano:write | plano:cancel |
| `GET /programas/:programa/:ciclo/comite-gestor` | equipe-gestao:read | equipe-gestao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/execucao` | equipe-gestao:read | missao:read + prestacao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/painel` | equipe-gestao:read | missao:read + prestacao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/missoes` | missao:read | missao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/parceiros` | missao:read | missao:read + parceiro:read |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/financas` | prestacao:read | prestacao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/resultados` | missao:read | missao:read + produto-missao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/relatorios/:qual/exportacao/:formato` | missao:read | Dinâmica: leitura do relatório + exportação do domínio (finanças: prestacao:export; demais: missao:export) |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/dossie` | missao:read | missao:read + missao:export; seções/documentos por capacidade |
| `GET /programas/:programa/:ciclo/comite-gestor/equipes` | equipe-gestao:read | equipe-gestao:read |
| `POST /programas/:programa/:ciclo/comite-gestor/equipes` | equipe-gestao:write | equipe-gestao:create |
| `PATCH /programas/:programa/:ciclo/comite-gestor/equipes/:id` | equipe-gestao:write | equipe-gestao:edit |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes` | missao:read | missao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/referencias-missao` | missao:read | Referências da ação solicitada: missao:create ou missao:edit, alcance da ação |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id` | missao:read | missao:read; seções por capacidade |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | prestacao:read | prestacao:read |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | prestacao:write | prestacao:create |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao` | prestacao:write | prestacao:edit |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/envio` | prestacao:write | prestacao:submit |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/validacao` | prestacao:review | prestacao:review |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/devolucao` | prestacao:review | prestacao:review |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas` | prestacao:write | prestacao:create |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId` | prestacao:write | prestacao:edit |
| `DELETE /programas/:programa/:ciclo/comite-gestor/missoes/:id/prestacao/despesas/:despesaId` | prestacao:write | prestacao:delete |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes` | missao:write | missao:create |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id` | missao:edit | missao:edit |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/relato` | missao:write | missao:relato |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/requisitos` | missao:read | missao:read |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento` | missao:read | missao:read; seções por capacidade |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento/dispensa` | missao:decide | missao:dispensa |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/encerramento/revogacao` | missao:decide | missao:dispensa |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/submissao` | missao:submit | missao:submit |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/decisao` | missao:decide | missao:decide |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/analise/reabertura` | missao:reopen | missao:reopen-analise |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/analise` | missao:read | missao:read |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/situacao` | missao:write | Conforme destino: missao:confirm / missao:cancel / missao:close; nunca OR genérico |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/reabertura` | missao:edit | missao:reopen-execucao |
| `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos` | missao:read | produto-missao:read |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos` | missao:write | produto-missao:create |
| `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId` | missao:write | produto-missao:edit |
| `DELETE /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/:produtoId` | missao:write | produto-missao:delete |
| `POST /programas/:programa/:ciclo/comite-gestor/missoes/:id/produtos/resposta` | missao:write | produto-missao:declare |
| `GET /programas/:programa/:ciclo/premissas` | premissa:read | premissa:read |
| `GET /programas/:programa/:ciclo/pendencias` | pendencia:read | pendencia:read |
| `POST /programas/:programa/:ciclo/pendencias` | pendencia:write | pendencia:create |
| `PATCH /pendencias/:id` | pendencia:write | pendencia:resolve |
| `DELETE /pendencias/:id` | pendencia:write | pendencia:delete |

### health.controller.ts

| Método e rota | Permissão atual / fronteira | Contrato V1 |
|---|---|---|
| `GET /health` | Público | Público; sem dados do domínio |

## Verificações desta entrega

- Node 24.13.0, conforme `.nvmrc`.
- Suíte unitária da API: 14 suítes, 86 testes aprovados (17 novos casos).
- Lint dos arquivos novos e verificação TypeScript estrita isolada: aprovados.
- Checagem de tipos da API completa impedida por dependências ausentes `pdfkit`,
  `pdf-lib` e tipos PDFKit; não atribuída à autorização.
- Não houve migration, alteração de realm, usuários reais ou ativação de guards.
  Integração SQL e navegador ficam com as tarefas de persistência e aplicação.
