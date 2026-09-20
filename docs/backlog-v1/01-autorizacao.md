# Fichas de autorização — V1-010 a V1-021

Estado: **V1-010–021 concluídas.** A autorização em execução é a das
concessões, com API, tela, recorte de leitura do planejamento, o recorte por
ação das bolsas com projeção dos campos pessoais (V1-015), os caminhos indiretos
fechados (V1-016), a matriz inteira sob regressão (V1-020) e o runbook de
ativação com ensaio de rollback (V1-021). **Conceder acesso às pessoas reais é
ato de operação pela tela de Acessos**, que é agnóstica e funciona sob demanda —
não é entregável de nenhuma ficha. Prioridade: **P0**. Regras de execução,
dependências e registro de conclusão no [índice](../backlog-v1.md).
Contrato de produto: [proposta de autorização](../proposta-autorizacao-v1.md).

## V1-010 — Catálogo de permissões e modelos opcionais

- **Estado / data:** Concluída — 2026-09-15, definição executável do catálogo;
  ativação da autorização permanece nas tarefas seguintes.
- **Decisão aplicada:** modelo individual aprovado; dependência V1-001 satisfeita
  para autorização pelo pedido de iniciar este bloco, sem concluir o restante
  do contrato da versão. Detalhes técnicos em
  [contrato-autorizacao-v1.md](../contrato-autorizacao-v1.md).
- **Entrega:** 79 permissões tipadas, seis tipos de alcance, schemas Zod,
  sete modelos opcionais copiados, política pura contra autoalteração e delegação
  indevida; inventário de 123 rotas e procedimento de bootstrap/recuperação definido.
- **Arquivos entregues:** `auth/autorizacao-v1/{catalogo,concessao,modelos,
  administracao,autorizacao-v1.spec}.ts`, contrato e documentos de acompanhamento.
  Sem migration nesta etapa. Diff local revisável, sem commit criado.
- **Verificações:** Node 24.13.0; 14 suítes/86 testes unitários aprovados;
  ESLint dos arquivos novos e TypeScript estrito isolado aprovados; diff sem
  erro de whitespace. API completa não teve checagem de tipos aprovada: dependências
  PDF ausentes (`pdfkit`, `pdf-lib`, namespace PDFKit). `pnpm exec` tentou instalar
  dependências e falhou no store SQLite/rede; verificações executadas diretamente
  pelos binários já instalados, sem alterar dependências.
- **Aceite / limites:** catálogo e combinações validados, personalização sem papel
  e modelos sem propagação comprovados em unidade; política administrativa testada.
  O contrato de destino cobre as rotas, mas os guards/serviços legados **ainda não
  usam** as novas concessões. Remover autorização por papel em V1-012, aplicar
  recortes/projeções em V1-013–016, integrar administração em V1-017 e navegação
  em V1-019. Isolamento SQL e revogação real serão provados nessas tarefas, não
  pelos testes puros desta entrega. Nenhuma conta ou realm foi alterado.
- **Depende de:** parcela de autorização de V1-001, já decidida.
- **Objetivo:** traduzir a decisão aprovada de concessões individuais em ações
  explícitas, sem condicionar autorização de negócio a papéis do Keycloak.
- **Arquivos:** `auth/permissions.ts`, guards, `auth-user.ts`, testes, realm
  versionado, contratos web e navegação.
- **Implementação:** inventariar endpoints e separar consulta, criação, edição,
  cancelamento, aprovação, exportação e dados pessoais conforme responsabilidade.
  Definir escopos válidos por ação e modelos opcionais de preenchimento. Aplicar
  modelo cria concessões explícitas; editar modelo não altera contas existentes.
  Proteger administração de acesso, bootstrap/recuperação e autoedição: aumento
  do próprio acesso exige autorização específica. Definir esse mecanismo e sua
  auditoria antes de implementar, sem fallback automático pelo papel `admin`.
- **Aceite:** toda ação possui permissão verificável; papel do token sozinho não
  concede domínio após a transição; modelos podem ser personalizados, inclusive
  aprovação fora do modelo Comitê. Estados e regras de negócio continuam valendo.
  Catálogo diferencia permissões de campo/documento e escopos institucionais.
- **Testes:** catálogo, compatibilidade ação/escopo, modelos e privilégio de
  administrar acesso; nenhuma alteração em contas reais nesta tarefa.

## V1-011 — Concessões vinculadas a permissão e alvo

- **Estado / data:** Concluída — 2026-09-15. Persistência e plano de conversão
  entregues; **nada lê a tabela ainda** e nenhum acesso real mudou.
- **Decisão de produto aplicada:** modelo individual de 2026-09-15, com as
  escolhas de V1-010. Três decisões técnicas registradas aqui: (1) a permissão é
  `varchar` validado por Zod contra o catálogo, e não enum do banco — o catálogo
  é código e muda a cada rota, e `ALTER TYPE` não remove valor; um `check` de
  formato mais teste de catálogo cobrem o que o enum cobriria; (2) enum novo
  `tipo_alvo_concessao` em vez de ampliar `tipo_escopo_acesso`, cujo `check` só
  sabe amarrar PPG e rede; (3) `escopo_acesso` permanece em execução até V1-012
  trocar o resolver — as duas tabelas coexistem de propósito.
- **Arquivos e migrations:** `database/schema/{acesso,comum}.ts`, migration
  `0040_concessoes_acesso_v1011` (+ snapshot e journal),
  `auth/autorizacao-v1/persistencia.ts` e spec,
  `test/concessoes.int-spec.ts`, `scripts/db-zerar.sh` (classificação),
  `AGENTS.md`. Seed não recebeu concessão alguma: conceder pela seed seria a
  “concessão automática” que a ficha proíbe.
- **Verificações executadas:** Node 24.14.1 (`.nvmrc` fixa 24.13.0; divergência
  do ambiente local, não do projeto). Unitários da API: 16 suítes, 116 testes
  aprovados (29 novos). Integração: `concessoes.int-spec` 21/21, e as suítes de
  acesso, escopo por rede e schema reexecutadas — 112 aprovados no conjunto;
  suíte completa 482 aprovados. Build (`nest build`) e ESLint limpos. Conferência
  estática de `db-zerar.sh`: 55 tabelas, nenhuma não classificada. Bloqueios
  ambientais, não de negócio: `pdfkit`/`pdf-lib` não estavam instalados (falha de
  V1-010, resolvida aqui com `pnpm install --filter api`, lockfile intocado), e
  `test/exportacao.int-spec` falha em um caso porque o LibreOffice desta máquina
  converte o XLSX para CSV em latin-1 — sem relação com esta tarefa.
- **Critérios de aceite satisfeitos:** alvo inválido, ambíguo ou com coluna extra
  é recusado pelo `check`; PPG exige ciclo; a unicidade inclui a permissão, então
  ações distintas convivem no mesmo alvo; revogar exige data e reconceder reativa
  a mesma linha; a auditoria sobrevive à conta apagada; `origem` é explicativa,
  nunca herança dinâmica. Os critérios sobre a **conversão** (idempotência, não
  ampliar, vínculo de equipe sem autorização implícita) foram satisfeitos e
  testados em 2026-09-15, mas o código que os sustentava saiu no dia seguinte —
  ver abaixo; hoje eles não têm implementação nem teste.
- **Retirado em 2026-09-16:** o planejador de conversão, o inventário do legado
  e o relatório revisável (`migracao.ts`, `inventario.ts`, `relatorio-*.ts`, o
  comando `acesso:relatorio` e seus testes), junto com `chaveDaConcessao`, que só
  a conversão usava. Motivo: o responsável definiu que a produção começa com a
  base consolidada e **sem conta nenhuma**, e as contas nascem depois do
  bootstrap, pela tela — não há acesso legado para converter. Os dados de acesso
  emulados no banco de desenvolvimento foram apagados na mesma decisão (backup
  `20260916-224010-antes-de-limpar-acessos.dump`).
- **Limitações e tarefas necessárias:** nenhum guard, serviço ou consulta lê
  `concessao_acesso` — é V1-012. O bootstrap do primeiro administrador já existe
  (V1-021a).
- **Depende de:** V1-010.
- **Objetivo:** representar usuário + permissão + escopo com integridade e trilha.
- **Arquivos:** `database/schema/acesso.ts`, `comum.ts`, `programa.ts`, migrations,
  seed, DTOs de acesso e classificação dos scripts de banco.
- **Implementação:** alvos GLOBAL, ciclo, PPG+ciclo, participação, temática e rede
  conforme compatibilidade de V1-010; FKs/checks, índices, unicidade, revogação e
  reativação. Guardar autor, data, justificativa e origem/modelo quando aplicável.
  Inventariar papéis, escopos e vínculos de equipe legados para conversão nominal
  revisável. Não multiplicar permissões de todos os papéis por todos os escopos.
  Ambiguidades ficam pendentes; nunca conceder GLOBAL automaticamente.
- **Aceite:** alvo inválido ou incompatível é recusado; PPG do planejamento exige
  ciclo; permissões distintas não colidem; conversão idempotente não amplia
  acesso; origem em modelo é explicativa, não herança dinâmica. Vínculos de
  equipe são tratados na migração sem criar autorização implícita permanente.
- **Testes:** migration vazia/legada, constraints, auditoria, reativação e
  inventário de tabelas. Não aplicar em banco real.

## V1-012 — Resolver central de autorização por ação

- **Estado / data:** Concluída — 2026-09-16. **A autorização em execução passou
  a ser a das concessões**: o papel do Keycloak não concede mais nada.
- **Entregue:** `auth/autorizacao-v1/alcance.ts` (composição do alcance e
  tradução para SQL) e `acesso-v1.service.ts` (resolução por `sub`, uma consulta
  por requisição, sem cache), com `test/resolver-acesso.int-spec.ts` — 13 casos
  contra Postgres real. Decisões: **OR entre concessões, AND dentro do alvo**, e
  por isso o PPG é guardado em par com o ciclo (verificado por mutação: separar
  as listas faz o mesmo PPG de outro ciclo vazar); **dimensão que a consulta não
  expõe não autoriza** — a concessão por temática é ignorada numa consulta sem
  coluna de temática, nunca aproximada pelo PPG; **ausência de concessão nega**,
  sem o modo permissivo do `RECORTE_OBRIGATORIO`; conta inativa ou sem vínculo
  resolve vazio; permissão fora do catálogo é ignorada; revogar vale na
  requisição seguinte, sem trocar o token.
- **A virada, entregue junto com V1-017:** os 116 `@RequirePermission` passaram
  aos nomes do catálogo conforme o inventário do contrato; o `JwtAuthGuard`
  resolve o acesso a cada requisição e preenche `permissions`; `toAuthUser` não
  deriva mais nada do token; `permissionsForRoles`, `ROLE_PERMISSIONS`,
  `missao:all-redes`, o escopo global por papel `admin` e o modo permissivo
  `RECORTE_OBRIGATORIO` foram removidos; o vínculo de equipe deixou de
  autorizar. O recorte de missões passou a sair do alcance de `missao:read`
  (GLOBAL não recorta; concessão por ciclo alcança as redes dele).
- **Duas decisões que o inventário exigia e o decorador não expressa:** a
  transição de situação da missão confere a permissão **por destino**
  (`missao:confirm`/`cancel`/`close`) depois de ler o corpo, porque um decorador
  único teria de aceitar qualquer uma das três; e a exportação de relatório
  confere leitura do relatório **mais** exportação do domínio, que só se conhece
  em runtime.
- **Ponte declarada:** `escopoDe` devolve a união dos alvos de todas as ações
  concedidas, sem dizer de qual ação veio cada PPG — serve às consultas que
  ainda não receberam recorte por ação (V1-015 e V1-016) e perde o ciclo da
  concessão de PPG. Quem já tiver o recorte por ação usa
  `AcessoResolvido.alcance(permissao)`.
- **Dois bugs reais encontrados pelo caminho**, ambos no vínculo de identidade e
  ambos corrigidos: o primeiro login em duas abas violava o e-mail único de
  `pessoa`, e a aba perdedora ainda via a pessoa "já vinculada" — à própria
  conta — e caía em vínculo pendente, que só um administrador desfazia.
- **Depende de:** V1-011.
- **Objetivo:** calcular alcance por permissão a partir das concessões locais.
- **Arquivos:** `auth/identidade.service.ts`, `escopo.ts`, guards, `auth.module.ts`,
  `auth-user.ts`, testes de acesso/escopo/rede e contratos de `/me`.
- **Implementação:** carregar conta ativa e concessões da ação, sem usar papéis
  do token como teto ou concessão automática; produzir predicados SQL. OR entre
  concessões completas e AND entre critérios de cada alvo. Sem negações nesta V1.
  Ausência de concessão nega acesso; revogação vale na requisição seguinte sem
  renovação de JWT. Recusar inativos inclusive administradores; sem cache global.
  Substituir origens implícitas por concessões explícitas conforme migração,
  inclusive alcance de missões. Não manter bypass global por papel antigo.
- **Aceite:** consulta GLOBAL + criação PPG A permite criar só em A; escrita de
  bolsas A/T1 não permite A/T2 ou B/T1; outro ciclo não passa; leitura de rede B
  não amplia escrita em A. Remover uma concessão preserva apenas outras válidas;
  token antigo não ressuscita revogação. Concessão personalizada funciona sem
  papel correspondente no Keycloak. Recuperação usa mecanismo protegido definido.
- **Testes:** predicados e integração das combinações, ausência de concessão,
  inatividade, tokens legados e dados sem classificação; isolamento de missões.

## V1-013 — Recortar leitura de plano, orçamento e painel

- **Estado / data:** Concluída — 2026-09-17.
- **Entregue:** o alcance já resolvido pelo guard entra em programas, ciclo
  padrão, plano/histórico, orçamento, redes, temática e painel. Linhas e
  agregados são recortados no SQL; alvo PPG/participação recebe custo próprio,
  mas teto, fonte, saldo, divergência e utilização ficam nulos até haver
  cobertura integral da temática. URL de ciclo fora do alcance responde 404.
- **Verificações:** builds da API e da web, lint da API, 89 testes unitários e
  os 588 testes de integração; 5 casos novos em
  `recorte-planejamento.int-spec.ts`. O smoke OIDC com `admin` passou depois da
  migration `0041` no banco local.
- **Limitação:** o smoke nominal por perfil fica na V1-021e/V1-020; bolsas e
  caminhos indiretos continuam nas V1-015–016.
- **Depende de:** V1-012.
- **Objetivo:** proteger consultas e agregados sem fabricar orçamento por PPG.
- **Arquivos:** `dominio/programas.controller.ts`, `plano.service.ts`,
  `orcamento.service.ts`, `painel.service.ts`, `ciclo.service.ts`, páginas
  P01/P05–P10 e contratos `lib/dominio.ts`.
- **Implementação:** passar usuário/recorte às consultas, incluindo ciclo padrão,
  redes, temáticas, históricos e contadores; aplicar antes de soma/paginação.
  Expor teto/saldo só quando houver cobertura autorizada da temática inteira;
  mostrar custo próprio nos recortes parciais. Ajustar denominadores, gráficos,
  alertas, seletores e estados vazios sem recalcular na web.
- **Aceite:** duas contas de PPGs distintos não leem linhas uma da outra; totais
  correspondem às linhas visíveis; temática compartilhada não oferece seu saldo
  como saldo do PPG; URL direta fora do alcance responde 404; consulta admin
  preserva os números de aceite da seed; nenhum ciclo é escolhido por dados
  ocultos quando houver alternativa visível.
- **Testes:** integrações com temática de dois PPGs, ciclos distintos e escopos
  sobrepostos sem duplicação; regressões do painel e smoke por perfil.

## V1-014 — Recortar escrita e referências do planejamento

- **Estado / data:** Concluída — 2026-09-17.
- **Entregue:** criação valida ciclo, PPG, temática e participação contra
  `plano:create`; edição exige que o registro anterior e o novo alvo estejam no
  alcance de `plano:edit`; cancelamento e orçamento ocultos respondem 404. O
  cancelamento usa schema Zod. A resposta do plano separa referências de
  criação e edição, a interface só oferece edição no item alcançado, e as
  opções de vagas usam `bolsa:create`.
- **Verificações:** builds da API e da web, lint, 89 testes unitários e 592
  testes de integração. Quatro casos novos cobrem referências, UUID externo,
  transferência, rollback, cancelamento e orçamento fora do alcance.
- **Limitação:** o recorte completo dos próprios registros de bolsa e seus
  campos pessoais pertence à V1-015.
- **Depende de:** V1-012.
- **Objetivo:** impedir lançamento/cancelamento por UUID ou payload fora do
  recorte, inclusive quando a tela não oferece a opção.
- **Arquivos:** `programas.controller.ts`, `plano.service.ts`,
  `orcamento.service.ts`, `bolsistas.service.ts` (opções), ações e formulários
  de plano/orçamento; `escopo` e schemas Zod.
- **Implementação:** exigir alcance da ação em criação/cancelamento/edição;
  validar ciclo, PPG, temática, participação, objeto anterior e novo alvo.
  Referências retornam só opções elegíveis para a operação. Validar corpo de
  cancelamento com Zod. Orçamento e edição exigem permissões explícitas; o modelo
  administrativo é apenas o padrão, não uma exclusividade de papel.
- **Aceite:** alterar ID/ciclo no request não amplia alcance; criação no PPG
  certo mas temática errada é recusada; transferência não contorna recorte;
  cancelamento não remove concessões nem histórico; recusas não deixam escrita
  parcial; permissão ausente e objeto oculto seguem convenção 403/404 da API.
- **Testes:** chamadas diretas aos endpoints, troca de alvo, concessões personalizadas,
  rollback e cancelamento de linha com vínculos; catálogo/cálculos preservados.

## V1-015 — Bolsistas, produção e minimização de campos

- **Estado / data:** Concluída — 2026-09-18.
- **Entregue:** o recorte de bolsa deixou de ser por PPG e passou a ser **por
  ação**, em `auth/autorizacao-v1/recorte-bolsa.ts`: uma função usada por
  listagem, detalhe, criação, edição, produtos, panorama, produção, relatório e
  exportação. A temática da concessão prevalece sobre a do item planejado, que
  só completa registros anteriores ao campo, e alvo `PARTICIPACAO` resolve pelo
  par PPG–temática. Bolsa sem classificação **não passa**: a subconsulta devolve
  `NULL` e o `coalesce(..., false)` a nega explicitamente, porque `NULL` dentro
  de `not` e de `bool_and` escaparia. Missão multirrede entra por `exists`, uma
  vez só.
- **Campos pessoais projetados no SQL:** CPF sob `pessoa:read-cpf`, e-mail e
  telefone sob `pessoa:read-contato`, cada um **cruzado com o alcance daquela
  bolsa** — capacidade global não vale sobre alvo fora do alcance. Sem a
  capacidade o campo vem nulo e a linha carrega `podeLerCpf`/`podeLerContato`,
  para a tela escrever *Sem acesso* em vez de *Não informado*. Sem máscara
  parcial, como a decisão manda. A contagem de produtos segue a mesma regra e é
  nula sem `produto:read`; `bolsa:read` deixou de exigir `produto:read` junto,
  na rota, no menu e na porta da página.
- **Permissão nova `pessoa:edit-cpf`**, no modelo de administrador. Cadastrar
  CPF continua sendo `bolsa:create` — quem cadastra informa sem poder consultar.
  Na edição o CPF é opcional e **ausente significa preservar**; corrigir um CPF
  existente exige `pessoa:edit-cpf` mais `bolsa:edit` sobre **todas** as bolsas
  daquela pessoa, porque `pessoa` é compartilhada e alcançar uma bolsa não
  autoriza reescrever a identidade que as outras usam. A correção trava a linha
  com `for update`, grava auditoria por campo e faz rollback junto com o resto.
  `pessoa:read-contato` saiu do modelo de responsável.
- **Duplicidade não vira oráculo:** CPF repetido, e-mail pertencente a outra
  pessoa e colisão concorrente (`23505` em `pessoa_cpf_uk`/`pessoa_email_uk`)
  respondem todos a **mesma** frase genérica. Mensagens distintas deixariam
  descobrir quem já está cadastrado variando o CPF até o texto mudar. E-mail
  nunca troca a identidade de uma pessoa existente — só o CPF identifica.
- **Exportação não reintroduz o que o JSON removeu:** o relatório exige a
  interseção de `bolsa:read` com `bolsa:export` e reaplica a projeção de CPF; a
  célula nula sai vazia em vez de `"null"`. O schema do CPF ganhou `regex` antes
  do `transform`, senão uma máscara de asteriscos seria limpa em dígitos e
  passaria pelo validador.
- **Interface:** a edição migrou de `FormData` para React Hook Form + Zod, com o
  campo *Corrigir CPF* aparecendo só sob `podeAlterarCpf` e vazio significando
  preservar. Botões de editar e de lançar produto passaram a seguir o que a API
  respondeu sobre aquela linha, não a permissão bruta do token. Cartão e coluna
  de produtos dizem *Sem acesso*, e o consolidado por rede do panorama diz *Sem
  acesso ao total* em vez de somar o que não pode ler.
- **Arquivos:** `auth/autorizacao-v1/{recorte-bolsa,catalogo,modelos}.ts`,
  `auth/identidade.service.ts` (`acessoDe`), `dominio/bolsistas.{service,
  controller}.ts`, `dominio/mobilidade.{service,controller}.ts`,
  `exportacao/exportacao.service.ts`; na web, `acoes/bolsistas.ts`,
  `lib/{dominio,acesso,navegacao}.ts`, `lib/formularios/bolsa-concedida.ts`,
  `componentes/formularios/form-bolsa-concedida.tsx` e as páginas de
  `/mobilidade`. **Sem migration:** a política é de projeção e alcance, e nada
  disso é coluna nova.
- **Verificações executadas:** build da API e da web, ESLint e TypeScript
  limpos nos dois; 89 testes unitários da API e 159 da web; **606 testes de
  integração em 35 suítes**, entre eles os 14 casos novos de
  `test/recorte-bolsas-v1.int-spec.ts`, que cobrem participação/temática,
  PPG+ciclo, projeção por capacidade, escrita sem leitura, preservação e
  correção de CPF com rollback, pessoa compartilhada fora do alcance,
  duplicidade, produto de missão, revogação na chamada seguinte e os arquivos
  reais de CSV, XLSX e PDF. Os erros de tipo em `acesso.int-spec.ts`,
  `comite-gestor.int-spec.ts` e `dominio.int-spec.ts` são anteriores a esta
  tarefa e não foram introduzidos por ela.
- **Limitações:** parceiros, anexos, convênios, contatos e as fichas/dossiês em
  PDF continuam na ponte legada — é a V1-016, que esta tarefa destrava.
  `anexos.service.ts` ainda decide o anexo de bolsa por `podeVerPpg`. A
  regressão da matriz inteira é a V1-020, e nenhuma conta real foi alterada
  aqui. Sem execução de `pnpm smoke:telas` nesta entrega.
- **Depende de:** V1-012.
- **Decisão aprovada em 2026-09-18:** CPF, e-mail pessoal e telefone só são
  retornados com capacidade específica e alcance sobre o alvo; sem capacidade,
  não enviar os valores, nem CPF parcialmente mascarado. Nome e dados acadêmicos
  permanecem na consulta autorizada. Modelos de administrador e secretaria
  incluem as capacidades por padrão, com concessões individuais personalizáveis.
  Quem pode cadastrar pode informar CPF sem poder lê-lo completo; edição sem
  CPF preserva o valor existente. Alteração de CPF existente exige capacidade
  específica de dados pessoais e edição no alcance do alvo. Duplicidade não
  revela cadastro fora do alcance. Esta decisão não marca a tarefa como entregue.
- **Objetivo:** estender o recorte atual de PPG a participação/temática e aplicar
  a política de campos sem quebrar concessão e edição.
- **Arquivos:** `bolsistas.service.ts`, `mobilidade.service.ts`, respectivos
  controllers, schemas de formulário, telas P02–P04/produção e `lib/dominio.ts`.
- **Implementação:** resolver temática da concessão/linha conforme regra atual;
  recortar listagem, detalhe, opções, produtos e agregados. Projetar CPF/contatos
  no servidor por capacidade e alcance. Preservar CPF na edição sem reenviar
  máscara; tratar identificação/duplicidade sem revelar cadastro alheio.
  Exportação não pode reintroduzir campos removidos. Dados sem classificação
  recebem tratamento explícito conforme a proposta, sem fallback permissivo.
- **Aceite:** lista, busca, detalhe e produção têm o mesmo alcance; conta sem capacidade de
  CPF completo não o recebe no JSON; coordenador consegue cadastrar
  e editar sem corromper CPF; dados não classificados aparecem ao admin para
  correção; totais de panorama/mapa/exportação são coerentes.
- **Testes:** integração de recorte e payloads por capacidade; cadastro com CPF
  sem capacidade de leitura; edição sem CPF preserva o valor, alteração sem
  capacidade é recusada e máscara nunca é persistida; bolsas com e sem
  item/temática; produto de missão mantém seu domínio.

## V1-016 — Proteger caminhos indiretos e exportações

- **Estado / data:** Concluída — 2026-09-18.
- **Entregue:** o histórico do parceiro deixou de ser o caminho indireto para o
  que a tela do próprio domínio recusa mostrar. **O cadastro segue
  compartilhado** — `listar`, `detalhar` e `candidatos` não recortam nada, e é
  isso que faz o catálogo servir de catálogo —, mas cada parcela do histórico
  passou a responder à ação que a cobre: bolsa por `bolsa:read`, missão, roteiro
  e evento por `missao:read`, produto por `produto-missao:read` **mais** o
  alcance da missão que o gerou, convênio por `convenio:read`. O convênio não
  segue a missão de origem de propósito: o acordo sobrevive à viagem e ao ciclo
  (CG-056), e recortá-lo pela missão o esconderia de quem cuida de convênio e
  não participa daquela rede.
- **O recorte entra na consulta, inclusive no agregado.** `vinculos` conta
  mobilidades por temática; somar antes de filtrar publicaria o número real a
  quem não pode ver as linhas. É a mesma regra do §6 do AGENTS, no lugar onde
  ela é mais fácil de esquecer.
- **Um `or` sem parênteses derrubava o recorte, e o teste pegou.** A condição
  dos produtos era `exists (...) or exists (...)` como cláusula única; ao entrar
  num `and` com o recorte, a precedência ligou o `and` só ao segundo `exists` e
  o produto vinculado pela instituição voltou a passar inteiro. Enquanto a
  condição era sozinha no `where`, a falta de parênteses não aparecia.
- **O anexo passou a cobrar o alcance da própria permissão exercida.** Até aqui
  o documento da prestação era recortado pelo alcance de `missao:read`, embora a
  permissão cobrada fosse `prestacao:read`: quem tivesse leitura de missão numa
  rede e de prestação noutra baixava o comprovante da rede errada. Agora
  `exigirAcesso` resolve o acesso, toma o alcance de `POLITICA[tipo][acao]` — a
  mesma permissão que acabou de exigir — e confere o alvo no banco. `escopoDe` e
  `podeVerPpg` saíram de `anexos.service.ts`.
- **A recusa ficou uniforme, e isso é mudança de comportamento.** Alvo
  inexistente e alvo fora do alcance respondem os dois *Documento não
  encontrado*. Antes, quem tinha alcance global recebia "a entidade não existe"
  — um oráculo: bastaria variar o UUID até o texto mudar para mapear quais
  missões existem. O caso de `anexos.int-spec.ts` que fixava a mensagem antiga
  foi reescrito para cobrar o que de fato importava ali: **nenhum órfão é
  gravado**. Instituição e convênio continuam sem recorte, porque não pendem de
  missão nenhuma.
- **A ficha PDF do parceiro usa a consulta da tela**, com o acesso de quem
  pediu. "Pesquisadores envolvidos" é deduzido das mobilidades: sem o recorte, o
  arquivo publicaria o nome do bolsista de outro PPG — e arquivo, uma vez
  baixado, circula por fora do sistema.
- **A tela distingue vazio de sem acesso.** `HistoricoParceiro.acesso` diz, por
  seção, se a ação foi concedida. Sem ele o estado vazio afirmaria "não houve
  mobilidade" para quem apenas não pode consultá-la — a mesma distinção que a
  V1-015 fez com `podeLerCpf`. O campo responde pela **concessão**, não pelo
  alcance: quem tem a ação noutra rede recebe `true` e lê "nada dentro do seu
  alcance", porque dizer "sem acesso" ali esconderia que a ação existe.
- **Arquivos:** `auth/autorizacao-v1/recorte-bolsa.ts` (`condicaoDaMissao` ganhou
  as colunas, porque o alias gerado pelo Drizzle não é `mc`),
  `dominio/parceiros.{service,controller}.ts`, `dominio/anexos.service.ts`,
  `exportacao/exportacao.service.ts`; na web, `lib/dominio.ts` e a página do
  parceiro. **Sem migration:** nada disso é coluna nova.
- **Fixtures corrigidas:** `escopo-rede.int-spec.ts` concedia apenas
  `missao:read` e bastava enquanto o anexo usava um alcance genérico de missão;
  agora concede as ações do modelo no mesmo alvo, que é o que a tela de acessos
  faz ao aplicá-lo. `acessoGlobalDeTeste` entrou em `fixtures.ts` para as suítes
  que verificam **cálculo** e não autorização — as de recorte continuam
  resolvendo de `concessao_acesso` pelo resolver real.
- **Verificações executadas:** build da API e da web, ESLint e TypeScript limpos
  nos dois; 89 testes unitários da API e 159 da web; **614 testes de integração
  em 36 suítes**, entre eles os 8 casos novos de
  `test/recorte-indiretos-v1.int-spec.ts` — parceiro pesquisável sem alcance,
  bolsa e contagem de vínculos, missão com roteiro e evento, produto exigindo as
  duas ações, convênio independente da missão, troca de UUID na leitura e na
  injeção, e o caso que separa `prestacao:read` de `missao:read`. Os erros de
  tipo em `acesso.int-spec.ts`, `comite-gestor.int-spec.ts` e
  `dominio.int-spec.ts` são anteriores a esta tarefa.
- **Limitações:** o dossiê da missão já passava por `anexos.listar`/`baixar` e
  herdou a correção sem mudança própria, mas **não há caso novo extraindo o
  conteúdo do PDF** nesta entrega — a asserção sobre bytes de PDF exige
  `pdftotext` (CG-069), e o que foi verificado aqui é a ficha do parceiro pela
  consulta recortada. A regressão de fórmula em CSV/XLSX continua a da V1-015.
  A regressão da matriz inteira é a V1-020. Nenhuma conta real foi alterada, e
  `pnpm smoke:telas` não foi executado.
- **Depende de:** V1-013 e V1-015.
- **Objetivo:** preservar catálogo compartilhado de parceiros sem abrir seus
  históricos restritos nem documentos por referência indireta.
- **Arquivos:** serviços/controllers de parceiros, resultados, convênios,
  anexos, contatos, relatórios/exportação; `arquivos/`; ficha PDF e dossiê.
- **Implementação:** inventariar caminhos por entidade; aplicar recorte nas
  parcelas de histórico, contagem e vínculos; distinguir contato institucional
  autorizado de dado pessoal de bolsista. Upload/listagem/versão/download herdam
  alvo e visibilidade; escopo do remetente não substitui alcance do alvo.
  Exportações usam mesmas consultas/projeções das telas.
- **Aceite:** parceiro global permanece pesquisável; bolsa/missão alheia não
  aparece no histórico, ficha ou contagem; trocar UUID de anexo não permite
  leitura nem injeção; `PESSOAL` não é liberado pelo acesso `RESTRITA`;
  arquivos reais PDF/XLSX/CSV respeitam a mesma política dos dados JSON.
- **Testes:** integração entre dois recortes, versões/descargas, ficha/dossiê
  com extração de conteúdo; regressão de fórmula em CSV/XLSX e de formato.

## V1-017 — Administrar concessões pela API

- **Estado / data:** Concluída — 2026-09-16, entregue junto com a virada de
  V1-012 (sem ela, o sistema ficaria sem nenhuma forma de conceder).
- **Entregue:** `auth/autorizacao-v1/concessoes.service.ts` e quatro rotas em
  `acesso.controller.ts` — catálogo de ações e modelos, concessões de uma conta,
  prévia e aplicação de lote, revogação. `test/concessoes-admin.int-spec.ts`
  cobre 13 casos, todos de política: autoalteração recusada inclusive para quem
  delega; `acesso:*` exige `write` **e** `delegate`, verificado **por item** —
  uma linha de `acesso:delegate` escondida num lote de leituras derruba o lote;
  capacidade recortada por PPG não administra acesso (administrar concessão
  alheia não é ato recortável); conta inativa não administra; lote atômico;
  reconceder reativa em vez de duplicar; e a revogação recusa deixar o sistema
  sem nenhuma conta ativa com leitura, escrita e delegação — com
  `pg_advisory_xact_lock`, senão duas revogações simultâneas veriam, cada uma, o
  outro administrador ainda ativo.
- **Prévia é rota própria**, e não um `?previa=true` no POST: um parâmetro que
  decide entre gravar e não gravar é o tipo de coisa que se erra uma vez.
- **Falta:** a tela (V1-018) e a explicação do acesso efetivo ao lado de cada
  concessão (hoje a prévia diz o efeito por item, não o alcance remanescente
  após uma revogação).
- **Depende de:** V1-012.
- **Objetivo:** atribuir, editar, revogar e explicar concessões individuais.
- **Arquivos:** `auth/acesso.controller.ts`, serviço de acesso/identidade,
  schemas e `acesso.int-spec.ts`.
- **Implementação:** catálogo/modelos, DTOs de permissão+alvo, validação de
  compatibilidade, prévia de acesso efetivo e sugestões sem escrita. Aplicação
  de modelo gera concessões editáveis. Toda alteração registra autor/data/motivo;
  proteger endpoints pelo privilégio de administrar acessos de V1-010, inclusive
  tentativas de autoelevação, reassociação de identidade e concessão do próprio
  privilégio. Não depender de papéis de negócio observados no token.
- **Aceite:** não autorizado é recusado; repetição tem resultado definido;
  alteração é atômica; prévia explica cada origem e alcance remanescente após
  revogação; conta inativa não ganha eficácia; autoelevação sem autorização
  específica é negada; recuperação administrativa é verificável.
- **Testes:** chamadas diretas, payload adulterado, concessão personalizada,
  autoelevação, reassociação conflitante, auditoria, rollback e revogação.

## V1-018 — Tela de administração de acesso

- **Estado / data:** Concluída — 2026-09-17.
- **Entregue:** `/configuracoes/acessos` (contas) e `/configuracoes/acessos/[id]`
  (concessões de uma conta), com `form-concessao.tsx` (conceder, em sidesheet,
  com RHF + Zod), `acoes-acesso.tsx` (revogar com motivo), `acoes/acessos.ts`,
  `lib/formularios/acessos.ts` e o item de menu — visível só para quem tem
  `acesso:read`. Na API, `GET /acesso/alvos` alimenta o seletor de alcance.
- **Decisões de tela, com o porquê:**
  - **Um alcance por lote, não um por ação.** A ficha admitia ação ou grupo; a
    matriz de 79 ações × 6 alcances numa página é revisável só no papel.
    Alcances diferentes são duas concessões, e o banco fica igual.
  - **O seletor de alcance é a interseção** dos alcances que todas as ações
    marcadas aceitam. Marcar uma ação institucional junto de uma de
    planejamento reduz o seletor a `GLOBAL` — que é a verdade, em vez de deixar
    montar um lote que a API recusaria inteiro.
  - **PPG tem campo de ciclo próprio**, e não herdado da tela em que a pessoa
    está: herdar faria a concessão mudar de significado conforme a navegação.
  - **Prévia antes de salvar**, pelo BFF: mostra quantas seriam criadas,
    reativadas e já ativas. Trocar a seleção invalida a prévia, senão a pessoa
    confere uma lista e salva outra.
  - **Modelo preenche e sai de cena**: marca as ações e grava concessões
    explícitas, com `origem` apenas explicativa.
  - **Revogar é painel com motivo**, não botão que age no clique; a linha
    revogada continua na tela, porque a pergunta da auditoria é até quando
    valeu. Não existe excluir.
  - **A própria conta não se administra pela tela** — a API já recusa, e
    oferecer o caminho faria a pessoa descobrir no erro.
  - **Sem `acesso:read`, a tela explica** em vez de virar erro genérico: 403
    chegando à fronteira de erro lê como sistema quebrado.
- **Verificações:** 11 testes novos em `web/test/acessos.test.mjs` (148 no
  total), `tsc`, ESLint e build limpos. **Percurso real**: infra e apps no ar,
  login OIDC, bootstrap do primeiro administrador, concessão pela API e as duas
  telas conferidas logado — a lista mostra as contas, o detalhe mostra
  "PPG CLIAMB · ciclo 2027-2030" e "Todo o sistema" em vez de UUID, e a conta
  sem `acesso:read` recebe 200 com explicação (antes da correção, 500).
- **Limitações:** não há edição de concessão existente (revogar e conceder de
  novo faz o mesmo, e a reativação reaproveita a linha); a prévia diz o efeito
  por item, mas não o **alcance remanescente** depois de uma revogação, que a
  ficha pede e fica para V1-019/020; e a tela não cria conta no Keycloak.
- **Depende de:** V1-017.
- **Objetivo:** administrador escolhe exatamente ações e alcances por usuário.
- **Arquivos:** `app/(app)/configuracoes/`, ações/formulários, navegação e contratos;
  sidesheet, RHF/Zod e consulta inicial no servidor.
- **Implementação:** vínculo com pessoa; começar vazio ou com modelo opcional;
  ações por módulo, alcance por ação/grupo e prévia antes de salvar. Permitir
  personalização, edição e revogação com motivo. Grupos visuais se desdobram em
  concessões explícitas; leitura ampla não amplia escrita. Mostrar histórico e
  origens do acesso. Explicar provisionamento da identidade no Keycloak separado
  da autorização local, sem prometer criação de conta ainda não implementada.
- **Aceite:** admin distingue PPG de participação; configura ação fora do modelo,
  vê resultado efetivo, revoga e compreende acessos remanescentes. Abrir tela não
  ativa sugestões; mudanças de modelo não alteram usuários anteriores; API
  também recusa autoelevação e operações sem privilégio.
- **Testes:** jornada real vazio/modelo→personalizar→salvar→editar→revogar,
  validação, foco/teclado e preservação de dados em erro.

## V1-019 — Shell, navegação e conta pendente

- **Estado / data:** Concluída — 2026-09-17. Entregue **antes** de V1-013 e
  V1-015, que a ficha listava como dependência: as duas tratam do recorte
  *dentro* das consultas de plano e bolsas, e nada aqui depende delas — o que
  esta tarefa usa é a lista de ações de `/me`, que existe desde V1-012. Esperar
  deixaria de pé, todo esse tempo, o 500 que a V1-018 encontrou.
- **Entregue:**
  - **Menu por capacidade.** Cada item de `lib/navegacao.ts` declara em `exige`
    as ações da tela, e `menu()` filtra. Item sem `exige` (Avisos) aparece
    sempre, porque o endpoint dele é da própria pessoa.
  - **Porta de acesso em toda página** protegida: `faltando(me.permissions, …)`
    mais o componente `SemAcesso`, que responde 200 explicando o que falta.
  - **Conta pendente**, em dois estados distintos e com textos distintos:
    vínculo não resolvido (não há a quem conceder) e conta sem concessão
    nenhuma (o caso normal do primeiro login). O aviso vive na casca `(app)`,
    porque o que falta não é aquela tela.
  - **`GET /me/acesso`** (sem `@RequirePermission`: é a conta lendo a si mesma)
    devolve cada ação com o alcance **nomeado**, por `autorizacao-v1/descricao.ts`.
    A tela "Sua conta" foi reescrita em cima disso: saíram os papéis do Keycloak
    — que não concedem nada desde V1-012 e liam como se concedessem — e entrou
    "onde vale" ao lado de cada ação.
  - **`apiFetchOuNada`** para a consulta secundária cujo 403 é resposta
    legítima: a P01 sem `bolsa:read` perde o bloco de mobilidade e continua de
    pé; o Plano sem `orcamento:read`/`catalogo:read`/`ppg:read` mostra a visão
    geral sem as abas de rede e sem oferecer cadastro; Parceiros sem
    `missao:read` perde o filtro por rede, não a lista.
- **Decisões, com o porquê:**
  - **A porta é por página, não um `redirect` dentro de `apiFetch`.** Página e
    layout renderizam em paralelo (AGENTS.md §10), então o layout não consegue
    impedir a consulta da página; e um 403 virando redirect atingiria também as
    Server Actions, onde a resposta certa é a mensagem junto do botão.
  - **403 em consulta secundária não é igual a 403 na tela.** `apiFetchOuNada`
    só engole o 403 — 404, 500 e falha de rede continuam estourando, senão a
    tela mentiria dizendo que a pessoa não tem acesso.
  - **Onde nulo já significava outra coisa, a consulta é condicional.** Na aba
    Prestação, `null` é "prestação não iniciada" (CG-045); tolerar o 403 ali
    juntaria as duas ausências numa só.
  - **Menu curto é a resposta certa** para conta recém-criada, e não um sinal de
    sistema quebrado — o que explica isso é a tela "Sua conta".
  - **`carregarMe` usa o `cache` do React**, que vale dentro de uma requisição:
    um `Map` de módulo serviria as permissões de um usuário ao seguinte e
    desfaria a revogação que a API faz valer na requisição seguinte.
- **Verificações:** 9 testes novos em `web/test/navegacao.test.mjs` (157 no
  total), 3 em `concessoes-admin.int-spec` (17/17) e 5 unitários de
  `descricao.spec.ts` (89 unitários na API); `tsc`, ESLint e build limpos nos
  dois pacotes. **Percurso real**, com apps no ar e login OIDC: conta sem
  concessão abre `/`, `/producao`, `/ppgs`, `/plano`, `/comite-gestor` e
  `/configuracoes/acessos` — **todas 200 com explicação**, onde antes havia 500
  —, e o menu dela tem só "Avisos"; concedidos `painel:read` no ciclo e
  `plano:read` no PPG CLIAMB, o menu passa a três itens, a P01 abre sem o bloco
  de mobilidade, o Plano abre sem abas de rede e `/orcamento` explica o que
  falta; `/me/acesso` responde "PPG CLIAMB no ciclo 2027-2030", sem UUID. As
  concessões temporárias foram revogadas ao fim, e a revogação valeu na
  requisição seguinte, sem novo login.
- **Limitações:** V1-013/V1-014 já recortam leitura e escrita do planejamento;
  bolsas, parceiros e missões restantes continuam nas V1-015–016. Esta tarefa decide **se a tela
  abre**; link dentro
  de conteúdo (os cartões da P01, por exemplo) ainda pode apontar para tela que
  a conta não abre, e o destino explica em vez de errar; e a P01 continua única
  para todos os perfis (AGENTS.md §9).
- **Depende de:** V1-013, V1-015 e V1-017.
- **Objetivo:** cada perfil acessa telas úteis e entende ausência de atribuição.
- **Arquivos:** layout `(app)`, `lib/navegacao.ts`, menu, configurações, `/me`,
  página inicial e tratamento de erros.
- **Implementação:** montar navegação por capacidades efetivas; estado de acesso
  pendente com logout/orientação, sem carregar antes dados protegidos. Garantir
  páginas que exigem múltiplas permissões e o caso sem ciclo visível. Mostrar
  alcance em linguagem institucional, sem códigos internos. Home continua única
  e recortada; personalização de layout fica em V1-072.
- **Aceite:** conta sem escopo não gera loop de login nem 500; comitê/gestor não
  desembocam em tela impossível de usar; editar URL não supera a proteção API;
  alternar usuário não reaproveita dados de cache da sessão anterior.
- **Testes:** smoke por perfil, login/logout/expiração e estado pendente;
  inspeção de requests, não só ausência de botão.

## V1-020 — Regressão integral da matriz de acesso

- **Estado / data:** Concluída — 2026-09-18.
- **Entregue:** `test/matriz-acesso-v1.int-spec.ts` (13 casos) e
  `scripts/smoke-acesso.sh` (`pnpm smoke:acesso`). A suíte **não repete** as
  anteriores: `recorte-bolsas-v1` prova o alcance das bolsas, `recorte-indiretos-v1`
  os caminhos indiretos, `escopo-rede` as missões e `concessoes-admin` a política
  administrativa. Esta cruza o que cada uma deixa de fora.
- **Fixture próprio, e não `criarBase`:** dois ciclos, três redes, uma temática
  compartilhada por dois PPGs, participações cruzadas, uma linha de plano por
  combinação PPG × ciclo, bolsas e missão multirrede. `criarBase` tem um ciclo
  só, e **um ciclo só não consegue exibir o erro cartesiano** — que é o caso
  central desta tarefa.
- **O caso que justifica a fixture:** conta com `plano:read` em (PPG X, ciclo 1)
  e em (PPG Y, ciclo 2). Se o alcance guardasse duas listas soltas — PPGs {X,Y}
  e ciclos {1,2} —, o produto delas liberaria X no ciclo 2 e Y no ciclo 1, que
  ninguém concedeu. **Verificado por mutação:** trocar o par por só o PPG em
  `condicaoDoAlcance` derruba o caso.
- **Temática compartilhada versus participação:** as duas concessões parecem
  equivalentes e não são — T1 pertence a X e a Y, e o alcance de temática traz
  os dois PPGs enquanto o de participação traz um. Sem uma temática
  compartilhada no fixture a diferença não aparece.
- **Leitura ampla não vira escrita ampla**, provado em dois domínios: plano
  (lê os dois ciclos, edita só o PPG concedido, e o alheio responde **404**) e
  bolsa (lista as duas, `podeEditar` só numa). **Verificado por mutação:**
  passar o alcance de leitura no lugar do de escrita derruba o caso.
- **Cruzamento de capacidade com alvo:** `pessoa:read-cpf` em GLOBAL **não**
  alcança bolsa fora de `bolsa:read`, e `bolsa:export` em GLOBAL não amplia o
  relatório nem destrava o CPF. São os dois cruzamentos que a V1-015 fixou, aqui
  conferidos junto do resto da matriz.
- **Estado da conta, ponta a ponta:** conta inativa perde tudo **inclusive
  `acesso:*`** (senão quem administra acesso se reativaria sozinho); `sub` sem
  linha em `usuario_sistema` não autoriza nada; revogar vale na consulta
  seguinte, sem cache. E **nem papel do token nem vínculo de equipe concedem** —
  o caso monta a equipe e a rede e confirma que o acesso continua vazio.
- **Modelos:** aplicar um grava **concessões explícitas**, uma linha por ação,
  com o alcance escolhido na aplicação e nunca GLOBAL por padrão. É por isso que
  editar `modelos.ts` depois não mexe em quem já foi configurado — não há
  ponteiro para o modelo, há linhas.
- **`pnpm smoke:acesso` é o smoke por perfil que faltava.** O `smoke:telas`
  percorre as telas de **uma** conta que enxerga tudo; este prova que **duas
  contas veem coisas diferentes**, pela sessão real. Ele afirma sobre o acesso e
  não sobre o volume — quais ações `/me` devolve, se a tela fora do alcance
  responde 200 com a explicação **certa** das três de `SemAcesso`, se a API
  recusa com 403 o que a tela esconde, e se a revogação vale na requisição
  seguinte. Por isso roda igual num banco com a planilha inteira e num que subiu
  só a base estrutural.
- **Verificações executadas:** **627 testes de integração em 37 suítes**, 89
  unitários da API, 159 da web, build e ESLint limpos nos dois apps; e
  `pnpm smoke:acesso` verde contra a instância local. Dois casos foram
  verificados por mutação, com a fonte restaurada e a suíte reconfirmada depois.
- **Limitações:** o `pnpm smoke:telas` **não foi executado** e hoje falharia por
  construção — ele afirma números da planilha que a seed de base não carrega
  (decisão de 2026-09-18). Não é regressão desta tarefa, mas é uma verificação
  que deixou de servir como padrão até rodar com `--com-dados` ou trocar as
  asserções por estrutura. A matriz cobre planejamento, bolsas, campos pessoais,
  parceiros/missões e exportação; **prestação e anexos entram por
  `recorte-indiretos-v1`**, não aqui. Nenhuma conta real foi alterada.
- **Depende de:** V1-013 a V1-019.
- **Objetivo:** provar isolamento de linhas, campos, arquivos e ações antes da
  ativação. A tarefa amplia a cobertura sem substituir os testes de cada entrega.
- **Arquivos:** suites `acesso`, `escopo-bolsas`, `escopo-rede`, `mobilidade`,
  `relatorios`, `anexos`, smoke; inventário de endpoints protegido por domínio.
- **Implementação:** fixture com dois ciclos, PPGs compartilhando temática,
  participações cruzadas e missão multirrede; contas com modelos iniciais e concessões personalizadas fora deles.
  Conferir GET/POST/PATCH/DELETE, referências, paginação, filtros, exportação,
  downloads, revogação, inatividade e token sem concessões locais. Incluir
  autoelevação, bootstrap/recuperação e mudanças de modelo sem propagação.
- **Aceite:** matriz com caso permitido e negado para cada família de endpoint;
  nenhuma concessão cartesiana; leitura ampla não vira escrita ampla;
  nenhum vínculo de equipe ou papel concede acesso implícito após a transição; seed-aceite admin passa.
- **Testes:** todas as suítes pertinentes e smoke por perfil; registrar resultados
  executados, condições e limitações, sem copiar contagens históricas.

## V1-021 — Atribuir contas e ativar modo restritivo

- **Estado / data:** Concluída — 2026-09-19. Subtarefas **a, d e e entregues**;
  **b e c canceladas** pela decisão de produção limpa.
- **A "lista nominal" não é entregável do sistema** (esclarecido pelo
  responsável em 2026-09-19, e a ficha dizia o contrário). A tela de Acessos é
  **agnóstica por construção**: ela lista quem já tem conta local e o admin
  concede ação a ação, sob demanda. O fluxo completo é *pessoa entra pela
  primeira vez → `/me` cria o vínculo → ela aparece em Acessos → o admin
  concede o que ela precisa*. Não há lista a obter antes, nem cadastro em lote
  a executar: a lista **se preenche sozinha** conforme as pessoas entram.
  Registrar quem recebeu o quê continua útil como **evidência de homologação**
  (V1-060), e é lá que isso pertence — não aqui, como pré-requisito.
- **O smoke nominal também não trava nada.** O que ele acrescentaria sobre o
  `pnpm smoke:acesso` (V1-020) é rodar com as pessoas reais, no ambiente real —
  ato de implantação, não verificação de código. O comportamento que ele
  provaria já está provado contra Postgres real e contra a sessão HTTP.
- **Entregue na subtarefa e (2026-09-18):**
  - **Runbook de ativação e rollback** em
    [ativacao-acesso-v1.md](../ativacao-acesso-v1.md), escrito para quem opera o
    servidor. Cobre instalação nova, primeiro administrador pelos dois caminhos,
    cadastro das demais contas, retirada das contas de demonstração e cinco
    cenários de rollback.
  - **Comando de desativação e reativação de contas**
    (`pnpm --filter api acesso:contas`), que a ficha pedia sob "desativar contas
    de demonstração por procedimento revisável" e não existia — `usuario_sistema.ativo`
    só era lido, nunca escrito. Espelha o bootstrap: prévia por padrão,
    `--aplicar` para gravar, `--reativar` como modo explícito, auditoria com o
    operador do sistema operacional, e **sem rota HTTP equivalente**.
  - **A regra que o comando impõe:** não se desativa o último administrador
    recuperável. Desativar fecha tudo de uma vez, `acesso:*` incluído, e uma
    instalação sem administrador ativo não consegue conceder nada a ninguém —
    o bootstrap exige conta que já entrou, e a recuperação exige conta ativa.
    A ordem correta é dar acesso ao definitivo **antes** de desligar o
    provisório, e o comando recusa a ordem inversa.
  - **As concessões não são revogadas junto da desativação**, de propósito:
    desativar já fecha o acesso, e apagá-las tiraria o que uma reativação
    precisa devolver intacto.
  - **Um `--sub` errado recusa o lote inteiro**, em vez de seguir com o resto:
    errar o identificador significa que o operador mirou noutra conta.
- **Ensaio executado:** `test/ativacao-acesso-v1.int-spec.ts`, oito casos contra
  Postgres real com contas fictícias, percorrendo o runbook inteiro — instalação
  sem administrador, bootstrap criando exatamente um, recusa de desativar o
  único, retirada na ordem certa, preservação e devolução das concessões, lote
  com `sub` errado, administrador perdido recuperado, e a recusa da recuperação
  em reativar conta inativa. O CLI também foi exercitado ponta a ponta contra o
  banco de desenvolvimento (listagem, prévia, recusa do último administrador,
  aplicação, auditoria conferida e reativação devolvendo o ambiente).
- **O rollback preserva a restrição**, e é o critério de aceite da ficha: as
  cinco saídas documentadas devolvem acesso a quem devia ter, e **nenhuma
  reabre leitura global** — não existe chave para isso desde que o modo
  permissivo saiu na V1-012. O ensaio confirma que a conta que nunca teve
  concessão continua sem nada depois do rollback.
- **Descoberta do ensaio:** reconceder **reativa a mesma linha**, não cria
  outra. Os índices de unicidade cobrem a linha inativa de propósito, para a
  consulta de acesso nunca precisar escolher entre versões da mesma concessão;
  a história do vaivém fica em `registro_auditoria`. O primeiro ensaio tentou
  inserir e bateu na constraint — está agora fixado como asserção.
- **Verificações:** 635 testes de integração em 38 suítes, 89 unitários da API,
  159 da web, build e ESLint limpos, e `pnpm smoke:acesso` verde.
- **O que acontece na implantação, e não aqui:** conceder acesso às pessoas
  reais pela tela de Acessos, conforme elas entram, e registrar em V1-060 quem
  recebeu o quê. São atos de operação, cobertos pelo
  [runbook](../ativacao-acesso-v1.md); nada no sistema fica esperando por eles.
- **Subtarefas** (a ordem importa; ver a justificativa em cada uma):
  - **a — bootstrap e recuperação de administrador.** *Entregue em 2026-09-15:*
    `pnpm --filter api acesso:bootstrap --sub <sub> --motivo "..." [--aplicar]
    [--recuperacao] [--listar]`. Vem antes da ativação: sem caminho protegido
    para recriar um administrador, ligar a restrição pode deixar todo mundo do
    lado de fora ao mesmo tempo. Pertence também a V1-017.
  - **b e c — conversão e aplicação do legado: canceladas em 2026-09-16.** A
    produção começa sem conta nenhuma, então não há acesso legado a converter
    nem lista nominal de migração a aplicar; o cadastro inicial é feito pela
    tela de administração (V1-018), pessoa a pessoa, depois do bootstrap. O
    relatório entregue em 2026-09-15 foi removido junto com o código que o
    sustentava.
  - **d — remoção dos caminhos legados de autorização implícita:** *entregue em
    2026-09-17.*
    `permissionsForRoles` como fonte, o escopo global que `escopoDe` concede ao
    papel `admin`, as redes do vínculo de equipe em `identidade.service.ts`,
    `missao:all-redes` e a própria `escopo_acesso`.
  - **e — ativação** do "sem concessão, sem dado", com smoke nominal e rollback
    documentado. *Entregue em 2026-09-18:* runbook, comando de desativação,
    ensaio com contas fictícias e o smoke por perfil (`pnpm smoke:acesso`, da
    V1-020) — o realm local voltou a ter as quatro contas de teste, o que
    destravou a política de dupla administração. A atribuição às pessoas reais
    é ato de implantação pela tela de Acessos, não entregável desta ficha.
  - **Por que d antes de e:** se o vínculo de equipe, o escopo legado e o papel
    continuarem valendo depois da virada, o modo restritivo não fecha nada — a
    conta entra pelo caminho antigo e ninguém percebe.
- **Entregue na subtarefa a:** `auth/autorizacao-v1/{bootstrap,bootstrap-cli}.ts`
  e `test/bootstrap-acesso.int-spec.ts`. Decisões: a prévia é o padrão e só
  `--aplicar` grava; concede **apenas** `acesso:read/write/delegate/manage-identidade`
  em GLOBAL, nunca permissão de negócio; não cria identidade (a conta precisa ter
  entrado uma vez) nem reativa conta inativa; bootstrap recusa quando já existe
  administrador recuperável — definido como conta ativa com leitura, escrita e
  delegação, porque quem não delega não consegue nomear substituto — e a
  recuperação é modo explícito; cada ato entra em `registro_auditoria` com motivo
  e operador do sistema operacional. Um `pg_advisory_xact_lock` impede que dois
  bootstraps simultâneos criem dois administradores; **verificado por mutação**:
  sem o lock, o teste de concorrência falha. Verificado com 12 testes de
  integração e execução do CLI ponta a ponta (prévia, aplicação, recusa na
  repetição e listagem).
- **Depende de:** V1-018 a V1-020; implantação real usa também V1-051.
- **Objetivo:** tornar efetiva a política preparada, com atribuições nominais.
- **Arquivos:** mecanismo de modo restritivo em `escopo.ts`, rotina de migração,
  tela de acesso, documentação operacional; ambiente só no escopo autorizado.
- **Implementação:** gerar prévia das contas admitidas e sugestões por
  participação; obter/aplicar lista nominal do responsável, conferir admin de
  recuperação e usuários de teste; ativar ausência de concessão = ausência de dados. Conferir a conversão de
  papéis/escopos/equipes e remover caminhos legados de autorização implícita.
  Desativar contas de demonstração no ambiente institucional por procedimento
  revisável. Não promover todos os usuários a GLOBAL para evitar bloqueios.
- **Aceite:** cada conta operacional tem permissões/escopos conferidos; contas novas
  aguardam atribuição; nenhum discente entra pelo papel isolado; rollback
  documentado preserva restrição em vez de reabrir leitura global.
- **Testes:** ensaio com contas fictícias e smoke nominal autorizado após ativação;
  não declarar tarefa concluída só porque mudou a constante no código.
