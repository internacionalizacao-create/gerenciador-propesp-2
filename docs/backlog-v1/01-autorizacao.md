# Fichas de autorização — V1-010 a V1-021

Estado inicial de todas: **Pendente**. Prioridade: **P0**. Regras de execução,
dependências e registro de conclusão no [índice](../backlog-v1.md).
Contrato de produto: [proposta de autorização](../proposta-autorizacao-v1.md).

## V1-010 — Matriz executável de perfis e permissões

- **Depende de:** V1-001.
- **Objetivo:** traduzir as escolhas registradas para um catálogo coerente,
  incluindo responsáveis temáticos e exclusão de autosserviço na V1.
- **Arquivos:** `apps/api/src/auth/permissions.ts`, `permissions.spec.ts`,
  `auth-user.ts`, realm versionado, `apps/web/src/lib/dominio.ts` e navegação.
- **Implementação:** reutilizar papéis atuais; adicionar o perfil temático
  escolhido; retirar acesso de domínio de `discente`; manter `docente` somente
  conforme contrato. Documentar migração nominal sem promover contas antigas.
  Catalogar projeções de dados pessoais por permissão se necessário. Preservar
  `plano:edit`, validação de prestação e cadastro institucional administrativos.
  Preparar atualização não destrutiva de realm, sem executá-la em ambiente real.
- **Aceite:** cada ação da matriz tem permissão clara; papel desconhecido ou
  apenas discente não obtém domínio; coordenador+discente conserva as permissões
  internas legítimas; gestor não decide missão e comitê não valida prestação.
- **Testes:** unidade da matriz incluindo múltiplos papéis e papéis legados;
  verificar o JSON do realm. Não ativar usuários nem fechar escopos nesta tarefa.

## V1-011 — Concessões vinculadas a perfil e alvo

- **Depende de:** V1-010.
- **Objetivo:** representar PPG+ciclo, participação, temática e rede sem perder
  FKs nem permitir combinações artificiais.
- **Arquivos:** `database/schema/acesso.ts`, `comum.ts`, `programa.ts`, migrations,
  seed, `auth/acesso.controller.ts` (DTO compatível), scripts de banco.
- **Implementação:** adicionar perfil da concessão, alvos explícitos e ciclo de
  PPG conforme A03; checks de exclusividade, índices e unicidade com política
  de reativação. Separar dados do domínio de concessões. Produzir inventário
  de concessões antigas e conversão explícita por perfil/ciclo; ambiguidades
  ficam para atribuição, nunca recebem GLOBAL automaticamente. Manter autor,
  data e trilha de revogação. Migração de estrutura não deve ampliar acesso.
- **Aceite:** participação inválida é recusada por FK; PPG sem ciclo na nova
  concessão é recusado; concessões de perfis diferentes não colidem; seed/testes
  se atualizam; reexecutar o procedimento de migração não duplica atribuições.
- **Testes:** migration em banco vazio e com fixture legada; constraints,
  revogação/reativação e inventário de tabelas. Não aplicar em banco real.

## V1-012 — Resolver central de autorização por ação

- **Depende de:** V1-011.
- **Objetivo:** calcular recorte elegível para cada permissão/domínio sem
  multiplicar permissões de um papel pelos escopos de outro.
- **Arquivos:** `auth/identidade.service.ts`, `escopo.ts`, guards, `auth.module.ts`,
  `auth-user.ts`; testes `acesso`, `escopo` e `escopo-rede`.
- **Implementação:** carregar identidade ativa e concessões, cruzar perfil
  concedido com papel vigente no token, resolver por ação; expor condições SQL
  reutilizáveis. OR entre concessões completas; AND entre alvos de uma concessão.
  Manter vínculo de equipe para missões e `missao:all-redes` restrito ao domínio.
  Recusar conta inativa antes dos atalhos de admin; definir orientação para
  identidade sem concessões. Nenhum singleton com cache de usuário.
- **Aceite:** secretaria GLOBAL + coordenador PPG A escreve plano só em A;
  coordenador A + gestor rede B escreve bolsas só em A e missões só em B;
  concessões A/T1 e B/T2 não permitem A/T2; outro ciclo não passa; revogação local
  vale na próxima requisição; atribuição sem papel correspondente é ineficaz.
- **Testes:** unidade dos predicados e integração com combinações acima, conta
  inativa e dados sem temática. Preservar escopo de missão já homologado.

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
  cancelamento com Zod. Manter escrita de orçamento e edição de linha no admin.
- **Aceite:** alterar ID/ciclo no request não amplia alcance; criação no PPG
  certo mas temática errada é recusada; transferência não contorna recorte;
  cancelamento não remove concessões nem histórico; recusas não deixam escrita
  parcial; permissão ausente e objeto oculto seguem convenção 403/404 da API.
- **Testes:** chamadas diretas aos endpoints, troca de alvo, múltiplos papéis,
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
- **Aceite:** lista, busca, detalhe e produção têm o mesmo alcance; conta de
  acompanhamento não recebe CPF completo no JSON; coordenador consegue cadastrar
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

- **Depende de:** V1-012.
- **Objetivo:** listar, sugerir, atribuir, revogar e explicar acesso de forma
  auditável, sem administrar papéis do Keycloak implicitamente.
- **Arquivos:** `auth/acesso.controller.ts`, `identidade.service.ts`, schemas,
  testes `acesso.int-spec.ts`; extrair serviço quando necessário.
- **Implementação:** DTOs para todos os alvos; validação de perfil, ciclo e
  duplicidade; sugestões baseadas em participação/pessoa com prévia, nunca
  concessão automática. Expor ações efetivas e origem (explícita ou equipe).
  Registrar autor/motivo e conferir identidade antes de reassociação. Informar
  quando atribuição depende de papel ainda não observado no Keycloak.
- **Aceite:** só admin administra; chamadas repetidas têm resultado definido;
  revogar uma origem não oculta outra ainda válida; conta inativa não ganha
  eficácia; listar concessão não inventa papel a partir de dado antigo do token.
- **Testes:** não admin, reassociação conflitante, sugestões sem efeito, auditoria,
  múltiplas origens e resultado antes/depois de revogar.

## V1-018 — Tela de administração de acesso

- **Depende de:** V1-017.
- **Objetivo:** permitir que admin configure usuários sem terminal.
- **Arquivos:** `app/(app)/configuracoes/`, novos formulários/ações, navegação,
  contratos; seguir sidesheet, RHF/Zod e consulta inicial no servidor.
- **Implementação:** lista de contas, vínculo com pessoa, concessões atuais,
  seletor de perfil/ciclo/alvo e prévia de alcance; sugestões confirmadas
  individualmente ou em lote revisável. Explicar acesso de equipe e papel no
  Keycloak. Revogação com motivo e feedback; mostrar ausência de alcance.
- **Aceite:** admin distingue PPG de participação, concede e revoga; usuário sem
  permissão não vê ações e é recusado pela API; não há botão enganoso que prometa
  remover acesso ainda herdado por outra origem; sugestões não são salvas ao abrir.
- **Testes:** validação de formulários e jornada real de concessão/revogação,
  preservação de dados em erro e navegação por teclado.

## V1-019 — Shell, navegação e conta pendente

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
  participações cruzadas e missão multirrede; contas para cada papel e combinações.
  Conferir GET/POST/PATCH/DELETE, referências, paginação, filtros, exportação,
  downloads, revogação, inatividade e entrada apenas com discente.
- **Aceite:** matriz com caso permitido e negado para cada família de endpoint;
  nenhuma concessão cartesiana; leitura ampla não vira escrita ampla;
  encerramento de vínculo não mantém acesso herdado; seed-aceite admin passa.
- **Testes:** todas as suítes pertinentes e smoke por perfil; registrar resultados
  executados, condições e limitações, sem copiar contagens históricas.

## V1-021 — Atribuir contas e ativar modo restritivo

- **Depende de:** V1-018 a V1-020; implantação real usa também V1-051.
- **Objetivo:** tornar efetiva a política preparada, com atribuições nominais.
- **Arquivos:** mecanismo de modo restritivo em `escopo.ts`, rotina de migração,
  tela de acesso, documentação operacional; ambiente só no escopo autorizado.
- **Implementação:** gerar prévia das contas admitidas e sugestões por
  participação; obter/aplicar lista nominal do responsável, conferir admin de
  recuperação e usuários de teste; ativar ausência de escopo = ausência de dados.
  Desativar contas de demonstração no ambiente institucional por procedimento
  revisável. Não promover todos os usuários a GLOBAL para evitar bloqueios.
- **Aceite:** cada conta operacional tem papel/escopo conferidos; contas novas
  aguardam atribuição; nenhum discente entra pelo papel isolado; rollback
  documentado preserva restrição em vez de reabrir leitura global.
- **Testes:** ensaio com contas fictícias e smoke nominal autorizado após ativação;
  não declarar tarefa concluída só porque mudou a constante no código.
