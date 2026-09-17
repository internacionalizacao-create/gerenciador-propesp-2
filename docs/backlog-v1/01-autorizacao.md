# Fichas de autorização — V1-010 a V1-021

Estado: **V1-010, V1-011, V1-012, V1-017 e V1-018 concluídas** — a autorização
em execução é a das concessões, com API e tela de administração —, e **V1-021 em
andamento** (bootstrap entregue; conversão do legado cancelada em 2026-09-16,
porque a produção começa sem conta nenhuma). Faltam os recortes por ação
(V1-013–016), a navegação por capacidade (V1-019) e a regressão (V1-020). Prioridade: **P0**. Regras de execução,
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
  ainda não receberam recorte por ação (V1-013 a V1-016) e perde o ciclo da
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

- **Depende de:** V1-012.
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
- **Testes:** integração de recorte e payloads por perfil; fluxo de edição com
  máscara; bolsas com e sem item/temática; produto de missão mantém seu domínio.

## V1-016 — Proteger caminhos indiretos e exportações

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
- **Limitações:** o recorte por ação nas consultas continua sendo V1-013–016 —
  esta tarefa decide **se a tela abre**, não quais linhas ela traz; link dentro
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

- **Estado / data:** Em andamento — 2026-09-16. Subtarefa **a** entregue; **b e
  c canceladas** pela decisão de produção limpa; restam **d** e **e**. Nenhuma
  concessão foi aplicada e o modo restritivo continua desligado.
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
  - **d — remoção dos caminhos legados de autorização implícita:**
    `permissionsForRoles` como fonte, o escopo global que `escopoDe` concede ao
    papel `admin`, as redes do vínculo de equipe em `identidade.service.ts`,
    `missao:all-redes` e a própria `escopo_acesso`.
  - **e — ativação** do "sem concessão, sem dado", com smoke nominal e rollback
    documentado.
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
