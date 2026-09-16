# Fichas de evolução — V1-070 a V1-078

Estado inicial: **Pendente**; prioridade **P2**. Estas fichas preservam todas as
pendências identificadas, mas só entram na entrega quando selecionadas pelo
responsável. Se uma política institucional exigir antivírus/e-mail, por exemplo,
promover a tarefa e atualizar o contrato no [índice](../backlog-v1.md).

## V1-070 — Canal de e-mail institucional

- **Depende de:** V1-050 e parâmetros do SMTP fornecidos por responsável.
- **Objetivo:** acrescentar e-mail à caixa de entrada/outbox existentes.
- **Arquivos:** `notificacoes.service.ts`, schema/notificação, configuração de
  ambiente, worker/processamento escolhido e telas de avisos.
- **Implementação:** envio servidor-servidor, segredo externo, templates mínimos
  com link interno, tentativas/idempotência e observabilidade. Tratar registros
  antigos `NAO_APLICAVEL` sem disparar e-mails retroativos por acidente; evitar
  dados pessoais/anexos no corpo. Não enviar mensagens reais em teste.
- **Aceite:** falha de SMTP não reverte decisão nem perde aviso; retentativa não
  duplica notificação; sem SMTP a caixa interna continua funcionando; destinatário
  é resolvido pela política existente, não por lista inventada.
- **Testes:** servidor simulado/capturador, indisponibilidade, repetição e
  desligamento do canal; teste institucional apenas com destinatário autorizado.

## V1-071 — Inspeção antimalware de anexos

- **Depende de:** V1-039 e V1-050; decisão sobre serviço e comportamento de falha.
- **Objetivo:** acrescentar inspeção ao pipeline já validado por conteúdo.
- **Arquivos:** `arquivos/`, `anexos.service.ts`, armazenamento/configuração e UI
  de upload se houver processamento assíncrono.
- **Implementação:** definir síncrono/quarentena, timeout, tamanho máximo,
  indisponibilidade e descarte conforme política. Arquivo em quarentena não é
  servido nem incluído em dossiê. Nunca usar malware real como fixture; usar
  simulador/string de teste controlada aceita pelo serviço escolhido.
- **Aceite:** detectado é recusado/isolado, falha não libera silenciosamente;
  upload, versionamento e autorização continuam coerentes; limpeza de arquivo
  temporário e status de erro são rastreáveis sem expor conteúdo.
- **Testes:** limpo, detectado, timeout, serviço fora, download de quarentena,
  rollback/limpeza; documentar custo operacional.

## V1-072 — Home por responsabilidade

- **Depende de:** V1-019 e V1-020.
- **Objetivo:** priorizar trabalho do usuário com dados já recortados.
- **Arquivos:** P01/layout, `painel.service.ts`, navegação e componentes do painel.
- **Implementação:** definir blocos de admin, responsável e gestor/comitê; múltiplos
  perfis recebem composição previsível ou seletor, sem escolher um papel aleatório.
  Reutilizar consultas autorizadas; exibir alcance e próxima ação pertinente.
- **Aceite:** nenhuma soma ou endpoint paralelo ignora escopo; responsável não vê
  “saldo do PPG” fictício; acesso pendente continua compreensível; links têm
  destino autorizado e filtros persistidos.
- **Testes:** comparativo de dados com páginas de origem e smoke por combinação
  de papéis; acessibilidade e estados vazios.

## V1-073 — Importação com adaptador por programa

- **Depende de:** V1-014 e V1-041; arquivo/modelo de entrada acordado.
- **Objetivo:** carregar dados em lote com prévia e regras equivalentes ao cadastro.
- **Arquivos:** serviços de domínio existentes, novo adaptador/importação,
  schema de lote se necessário, UI de prévia e relatório de erros.
- **Implementação:** parsing separado de domínio, validar cada linha/referência,
  dry-run, política explícita de atomicidade e duplicidade; reprocessamento
  idempotente; limites de tamanho e permissões por registro. Não chamar seed reset
  nem escrever diretamente ignorando catálogo, escopo, vaga ou auditoria.
- **Aceite:** prévia sem escrita; erros localizados; resultado reconciliável por
  lote; reenvio não duplica; linha fora do escopo não entra; beneficiários reais
  não vão para fixtures ou logs.
- **Testes:** arquivos sintéticos válidos/inválidos, colunas ausentes, duplicidade,
  erro parcial/total, reprocessamento e dois programas sem mistura de regras.

## V1-074 — Administrar programas, ciclos, redes e temáticas

- **Depende de:** V1-034; decisão de ampliar além da carga inicial do ciclo atual.
- **Objetivo:** criar base estrutural pela aplicação sem depender da seed.
- **Arquivos:** schema/programa/orçamento/catálogo, `contexto.service.ts`,
  `ciclo.service.ts`, controllers e UI administrativa.
- **Implementação:** dividir em subtarefas por entidade antes de codificar;
  definir slug/período/estado, redes/temáticas, participações, tetos/aportes e
  tabela de valores inicial. Operar valores desconhecidos como nulos; proibir
  exclusão de entidades referenciadas. Não copiar bolsas entre exercícios.
- **Aceite:** ciclo novo tem rota/contexto válidos, cadastros mínimos e estados
  vazios utilizáveis; nenhuma concessão de acesso de ciclo anterior vaza para
  o novo; manter CAPES Global e seed-aceite existentes.
- **Testes:** instalação sem ciclo e criação completa, duplicidade/período,
  inativação com vínculos e isolamento entre ciclos/programas.

## V1-075 — Central de relatórios

- **Depende de:** V1-040.
- **Objetivo:** facilitar descoberta dos relatórios existentes quando houver
  necessidade real de uma entrada única.
- **Arquivos:** navegação, nova rota `/relatorios`, contratos e filtros existentes.
- **Implementação:** catálogo por capacidade/uso, links e filtros persistidos;
  reusar consultas e exportadores. Diferenciar relatório operacional de documento
  institucional homologado. Sem nova engine de relatórios genéricos na primeira entrega.
- **Aceite:** só oferece relatórios autorizados; filtros reproduzem mesmas linhas
  e totais do módulo original; a central não é condição para exports já existentes.
- **Testes:** navegação por perfil, URL compartilhada/filtros e comparação dos
  arquivos com origem; nenhuma segunda implementação de soma financeira.

## V1-076 — Central de documentos

- **Depende de:** V1-016 e V1-039.
- **Objetivo:** buscar documentos entre módulos mantendo vínculo e visibilidade.
- **Arquivos:** `anexos.service.ts/controller.ts`, armazenamento, nova consulta/UI.
- **Implementação:** pesquisa paginada no universo autorizado, filtro por categoria/
  alvo/período, acesso à entidade de origem e versões. Avaliar associação de fontes
  legadas de planejamento, sem converter todo arquivo em anexo público ou exigir
  recadastro. Preservar regras de documento pessoal/restrito.
- **Aceite:** busca/total/snippet não revelam documento de alvo oculto; download
  usa autorização existente; versões e retenção consistentes; não criar pasta
  global que substitua a vinculação ao domínio.
- **Testes:** arquivo em cada tipo de alvo, nomes sensíveis, duas permissões de
  visibilidade, paginação e revogação entre listagem e download.

## V1-077 — Futuro acesso de participante/bolsista

- **Depende de:** decisão futura de incluir esse público; não executar na V1 interna.
- **Objetivo:** manter rastreada a pendência de autosserviço sem conceder leitura
  global ao papel discente existente.
- **Referências:** identidade local, vínculo pessoa–bolsa/participante, homologações
  CG/BOL, auth, anexos e política de campos.
- **Primeira entrega quando selecionada:** especificação de identidade comprovada,
  concessão pessoal, ações permitidas, recuperação de conta e exposição de rede;
  separar consulta da própria bolsa de prestação de missão. Só então decompor
  implementação em tarefas menores com decisão de acesso externo/interno.
- **Aceite:** contrato explícito de “meus registros”; nenhum aluno vê outro por
  PPG compartilhado; vínculo por e-mail não é usado para dispensar prova de
  identidade em canal externo; não mudar matriz V1 enquanto ficha estiver adiada.
- **Testes previstos:** duas pessoas do mesmo PPG, e-mail alterado/ambíguo,
  substituição de beneficiário, documento próprio/alheio e revogação.

## V1-078 — Revisão de linhas proposta pelo responsável

- **Depende de:** V1-014 e V1-057; decisão explícita de ampliar além da política atual.
- **Objetivo:** permitir correção operacional sem dar edição irrestrita de
  composição aprovada.
- **Arquivos:** `plano.service.ts`, schemas de planejamento/governança,
  formulário de plano, API/ações e histórico.
- **Primeira entrega:** especificar campos editáveis, rascunho, proposta de
  alteração, quem aprova, comparação antes/depois, conflitos concorrentes e
  efeito em concessões existentes. Só depois implementar o fluxo selecionado.
- **Aceite:** não basta adicionar `plano:edit` ao coordenador; mudança aprovada
  mantém auditoria e regras de catálogo/vaga; responsável não altera registros
  fora do escopo nem reescreve o passado de bolsas já concedidas.
- **Testes:** alteração devolvida/aprovada, concorrência, perda de acesso durante
  análise, linha em uso e preservação dos custos/indicadores históricos definidos.
