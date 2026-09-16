# Fichas de fluxos e dados — V1-030 a V1-042

Estado inicial: **Pendente**. Execução e registro de conclusão conforme o
[índice](../backlog-v1.md). Permissões e decisões já homologadas continuam valendo.

## V1-030 — Completar edição e ciclo de vida da missão

- **Prioridade/dependência:** P0; V1-001.
- **Objetivo:** percorrer o ciclo operacional sem chamar a API pelo terminal.
- **Arquivos:** `dominio/programas.controller.ts`, `missoes-comite.service.ts`,
  `apps/web/src/acoes/comite-gestor.ts`, `encerramento.ts`, formulário da missão
  e página de detalhe; schemas RHF/Zod.
- **Implementação:** reutilizar endpoints para edição, confirmação, cancelamento
  e reabertura da execução. Pré-preencher formulário, preservar participantes e
  roteiro; exigir justificativa quando a regra pedir. Separar claramente
  reabertura da análise (já existente) e reabertura da execução. Respeitar estados
  congelados e relações com aprovação/prestação. Não criar novo enum de status.
- **Aceite:** missão planejada pode ser confirmada e encerrada pela tela; edição
  válida preserva dados; ação inválida é recusada também via request direto;
  cancelar não apaga documentos/despesas; comitê não ganha edição por ver a tela.
- **Testes:** schemas/payloads, integração das transições existentes e jornada
  criar→analisar→decidir→confirmar→prestar→encerrar, com devolução/reabertura.

## V1-031 — Cadastrar produtos de missão na interface

- **Prioridade/dependência:** P0; V1-001.
- **Objetivo:** permitir encerrar missão que efetivamente produziu resultados.
- **Arquivos:** `resultados.service.ts`, endpoints de produtos da missão,
  `acoes/relato.ts`, página de missão, novos formulário/schema/action.
- **Implementação:** listar opções autorizadas; cadastrar/editar/remover conforme
  endpoints e regras atuais; associar instituições, responsáveis, convênio e
  evidências. Manter declaração negativa separada de lista vazia. Não reutilizar
  `produto_bolsa` para missão nem criar API paralela.
- **Aceite:** produto cadastrado aparece em missão/produção/relatório sem
  duplicação; histórico e encerramento refletem resultado; ausência de produto
  não vira declaração negativa automática; vínculos de documentos são preservados.
- **Testes:** formulário, permissões/estado, produto com múltiplas instituições,
  evidências e checklist de encerramento após cadastro real pela tela.

## V1-032 — Gerir convênios pela interface

- **Prioridade/dependência:** P1; V1-016.
- **Objetivo:** operar acordos já suportados pela API sem scripts.
- **Arquivos:** `convenios.controller.ts`, `resultados.service.ts`,
  `database/schema/resultados.ts`, página do parceiro, navegação, novas ações.
- **Implementação:** escolher navegação simples entre lista e detalhe do parceiro;
  criar/editar/inativar/reativar pelos endpoints existentes; exibir instituição,
  vigência, situação e vínculos. Não tratar convênio como propriedade exclusiva
  de uma missão. Atualizar leitura derivada de parceria formalizada.
- **Aceite:** gestor autorizado/admin opera; comitê lê; associação de produto é
  preservada; inativação exige justificativa e não exclui; histórico respeita
  recorte das missões/bolsas mesmo com catálogo institucional compartilhado.
- **Testes:** jornada de criação→produto associado→inativação→reativação,
  validação de datas e recusas por permissão.

## V1-033 — Tratar pendências pela interface

- **Prioridade/dependência:** P1; V1-012.
- **Objetivo:** equipe registra e resolve pendências sem terminal, com alcance
  compatível com seu objeto.
- **Arquivos:** `pendencias.service.ts`, `programas.controller.ts`,
  `database/schema/governanca.ts`, painel, novas páginas/ações/formulários.
- **Implementação:** inventariar tipos/alvos existentes; resolver alcance no SQL
  pelo alvo. Pendência sem alvo suficiente fica administrativa até classificação;
  não conceder acesso global por ausência de PPG. Expor lista/filtros, criação,
  resolução e histórico/motivo. Rever exclusão física existente para não apagar
  evidência; documentar a decisão em vez de trocar comportamento silenciosamente.
- **Aceite:** responsável opera apenas pendências elegíveis; URL de painel leva
  ao registro correto; resolução atualiza indicadores; não duplica pendência
  histórica da seed nem dá resposta institucional em nome da equipe.
- **Testes:** integração por PPG/participação, registro sem alvo, transições e
  contadores; jornada de abertura/resolução com validação de justificativa.

## V1-034 — Administrar participação PPG–temática

- **Prioridade/dependência:** P1; V1-011.
- **Objetivo:** tornar utilizável um PPG novo no planejamento do ciclo atual.
- **Arquivos:** `database/schema/programa.ts`, `ppgs.service.ts`,
  `ciclo.service.ts`, `programas.controller.ts`, páginas PPG/temática e formulários.
- **Implementação:** API e UI administrativas para associar PPG à temática e
  definir responsável; validar ciclo, unicidade e referências. Definir mudança
  de responsável com histórico; impedir remoção que deixe plano/bolsa órfãos.
  Mostrar impacto nas concessões de acesso e sugerir revisão, sem conceder/revogar
  silenciosamente por editar cadastro de domínio.
- **Aceite:** PPG novo ganha participação e fica disponível para linha válida;
  PPG pode participar de mais de uma temática; troca de responsável não transfere
  automaticamente acessos; registros usados não são apagados em cascata.
- **Testes:** integração de criação/duplicidade/alteração com plano existente e
  regressão de isolamento; formulário administrativo completo.

## V1-035 — Especificar eventos externos da CAPES

- **Prioridade/dependência:** P1; V1-001.
- **Objetivo:** fechar contrato antes de implementar movimentações e histórico.
- **Referências:** `system-structl.md` (P12 e regras), `schema/execucao.ts`,
  `schema/planejamento.ts`, `bolsistas.service.ts`, homologação BOL.
- **Implementação documental:** propor tipos de evento, origem/destino, data do
  ato e do registro, responsável, referência externa, evidência, justificativa,
  status manual e correção por evento. Distinguir movimentação orçamentária de
  cancelamento/desistência/falecimento/substituição de beneficiário. Fixar efeitos
  em vagas, produtos, valores, vínculo entre substituído/substituto e indicadores.
  Mapear o schema existente antes de propor tabelas novas.
- **Aceite:** matriz evento→campos→efeitos→permissão→estado anterior/posterior;
  movimentação só na mesma temática; Gerenciador registra ato externo, não
  autoriza/paga. Perguntas não respondidas ficam explícitas e bloqueiam somente
  a parcela dependente de V1-036; não inventar fatos institucionais.
- **Verificação:** exemplos concretos com cancelamento, correção e substituição,
  sem dupla contagem nem apagamento de histórico. Nenhuma mutation nesta tarefa.

## V1-036 — Persistir e consultar eventos externos

- **Prioridade/dependência:** P1; V1-014 e contrato pertinente de V1-035 escolhido.
- **Objetivo:** implementar atos externos com rastreabilidade e consistência.
- **Arquivos:** schema/execução/planejamento, migrations/seed, novos serviços e
  controllers, escopo e auditoria, inventário dos scripts de banco.
- **Implementação:** reutilizar ou evoluir schema conforme contrato; validação
  Zod, transação e prevenção de registro repetido conforme referência definida;
  conferir origem/destino e ação sobre ambos; correção preserva evento anterior.
  Não atualizar derivados financeiros por fora dos serviços de cálculo.
- **Aceite:** evento fora da temática/alcance é recusado; reenvio não duplica
  efeito; substituição preserva beneficiário anterior; nenhum pagamento fictício
  é criado; falha de gravação não deixa saldo/histórico parcialmente atualizado.
- **Testes:** integrações de cada evento aprovado, repetição, concorrência quando
  houver consumo de vaga/saldo, rollback, recorte e regressão dos indicadores.

## V1-037 — Registrar eventos externos pela interface

- **Prioridade/dependência:** P1; V1-036.
- **Objetivo:** operação institucional com prévia de efeitos e histórico legível.
- **Arquivos:** rota P12/navegação, detalhe da bolsa/plano quando pertinente,
  novos formulários RHF/Zod, ações e contratos.
- **Implementação:** usar termos de registro externo; selecionar apenas alvos
  elegíveis; mostrar consequências já definidas, referência e evidência; permitir
  consultar/corrigir conforme contrato. Separar campos de ato externo de campos
  de auditoria gerados pelo sistema.
- **Aceite:** fluxo completo sem terminal; mensagem não sugere autorização da
  CAPES pelo sistema; erro preserva preenchimento; histórico distingue ato,
  registro e correção; indicadores após ação conferem com a API.
- **Testes:** formulários e jornada representativa de cada família de evento,
  acesso negado e tentativa de origem/destino incompatíveis.

## V1-038 — Completar dados institucionais e composições

- **Prioridade/dependência:** P1; V1-034; dados formais da equipe/responsável.
- **Objetivo:** separar dado ainda não informado de funcionalidade faltante.
- **Referências:** `system-structl.md` §11, seed/dados-capes-global, P09/P10/P03,
  guia de cadastro, fontes institucionais entregues durante a tarefa.
- **Passos:** inventariar situação atual do banco por leitura autorizada; listar
  manutenção UFMG/UNICAMP, distribuição por PPG/ano, quatro Capacitações UFMG,
  composição UNICAMP, exercícios futuros e beneficiários. Preparar planilha/lista
  de coleta com origem/data. Registrar somente dados fornecidos, pelas interfaces
  e APIs; alterações de seed apenas quando representarem correção formal da base.
- **Aceite:** cada lacuna tem dado comprovado ou responsável/status explícito;
  não repetir bolsa automaticamente em outro exercício; valores desconhecidos
  permanecem nulos; beneficiários não são fabricados; fontes e auditoria conferem.
- **Verificação:** reconciliação de totais e amostras com os documentos recebidos;
  não executar reset de seed nem usar produção como fixture de testes.

## V1-039 — Retenção de documentos e dados pessoais

- **Prioridade/dependência:** P1; V1-001.
- **Objetivo:** transformar a retenção em procedimento executável sem presumir
  um prazo institucional para dados que ainda não têm decisão.
- **Referências:** homologações CG/BOL, `anexos.service.ts`, armazenamento,
  schema de contatos/pessoa/anexo, backup e questionário histórico.
- **Passos:** registrar regra já decidida de documentos do Comitê e distinguir
  contatos/identificadores/documentos de bolsista; levantar marco inicial, guarda
  excepcional e impacto em backups. Definir responsáveis e proposta de operação
  com inventário/dry-run; execução destrutiva só se especificamente autorizada.
  Registrar decisão sobre inspeção de anexos e sua prioridade em V1-071.
- **Aceite:** tabela categoria→prazo ou decisão pendente→marco→responsável→ação;
  procedimento preserva indicadores/histórico e não promete remoção de backups
  imutáveis; nenhum descarte automático sem regra escolhida.
- **Verificação:** simulação com dados fictícios e revisão das dependências;
  se implementar rotina, testar prévia, repetição e exclusões de guarda excepcional.

## V1-040 — Homologar relatórios institucionais prioritários

- **Prioridade/dependência:** P1; V1-016.
- **Objetivo:** aproveitar relatórios existentes e identificar lacunas reais.
- **Arquivos:** `relatorios.service.ts`, `mobilidade.service.ts`, exportadores,
  relatórios do Comitê, ficha de parceiro e dossiê.
- **Passos:** inventariar saídas atuais e exemplares sintéticos; definir com o
  responsável modelos obrigatórios, filtros, data de referência e destinatário.
  Para cada lacuna aceita criar subtask com colunas/fórmulas/exemplo esperado;
  implementar apenas o que foi selecionado, pela consulta comum aos formatos.
- **Aceite:** matriz relatório→uso→filtros→formatos→aceite; totais reconciliados;
  campos pessoais/escopo iguais aos da consulta; central `/relatorios` não é
  criada sem necessidade (V1-075); aprovação institucional ausente fica registrada.
- **Testes:** arquivos realmente abertos/extraídos, números e filtros cruzados
  com tela/SQL, fórmula maliciosa neutralizada e documento restrito ausente.

## V1-041 — Conferir e reconciliar destinos digitados

- **Prioridade/dependência:** P1; V1-015.
- **Objetivo:** reduzir destinos sem país ISO/parceiro reconhecido sem perder
  liberdade de cadastro nem unir instituições por semelhança incerta.
- **Arquivos:** `bolsistas.service.ts` (reconhecimento), `mobilidade.service.ts`,
  `parceiros.service.ts`, formulário de bolsa, mapa e histórico de parceiro.
- **Implementação:** listar dados não reconhecidos dentro do escopo; oferecer
  candidatos com prévia de vínculo, preservar texto original e auditar correção.
  Validar país/instituição e homônimos; não usar sigla como identidade inequívoca.
  Alterar associação apenas com seleção explícita; não inventar coordenadas.
- **Aceite:** dado não reconhecido continua nas tabelas com aviso; correção muda
  mapa/histórico sem duplicar bolsa; candidatos de outro alcance não revelam dados;
  um mesmo nome em países distintos não é unido automaticamente.
- **Testes:** nomes normalizados, ambiguidade, país por ISO, correção/reversão e
  igualdade dos totais antes/depois de classificação.

## V1-042 — Paginar parceiros e revisar volume das listas

- **Prioridade/dependência:** P1; V1-016.
- **Objetivo:** evitar carregar o cadastro inteiro mantendo busca e filtros.
- **Arquivos:** `parceiros.service.ts/controller.ts`,
  `componentes/consultas/lista-parceiros.tsx`, página server, contratos/BFF.
- **Implementação:** paginação no SQL com ordenação estável/desempate por ID,
  tamanho validado e limitado, total autorizado; URL preserva filtros/página;
  Query mantém dados durante busca e atualiza após mutations. Revisar outras
  listas por medição, sem reescrita geral por precaução.
- **Aceite:** navegar/voltar/recarregar preserva busca; filtro novo reinicia página;
  cadastro/edição atualiza cache sem duplicidade; lista vazia e última página
  removida têm tratamento; total não ignora política de visibilidade.
- **Testes:** integração de limites/filtros/ordem, entradas inválidas e jornada
  de busca com criação/edição; registrar medição com volume sintético representativo.
