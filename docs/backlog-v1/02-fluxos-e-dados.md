# Fichas de fluxos e dados — V1-030 a V1-042

Estado inicial: **Pendente**. Execução e registro de conclusão conforme o
[índice](../backlog-v1.md). Permissões e decisões já homologadas continuam valendo.
Todas as P1 deste grupo foram incluídas na V1 pelo responsável em 2026-09-18.

## V1-030 — Completar edição e ciclo de vida da missão

- **Estado / data:** Concluída — 2026-09-19.
- **Entregue:** a missão passou a percorrer o ciclo inteiro pela tela. Faltavam
  **quatro** ações, e todas usam endpoint que já existia: **editar**
  (`PATCH .../missoes/:id`), **confirmar** e **cancelar**
  (`POST .../situacao`) e **reabrir a execução** (`POST .../reabertura`).
  Encerrar já estava na aba de encerramento, com o checklist que o governa, e
  continua lá — separá-lo é o que impede o botão de prometer o que o checklist
  vai recusar.
- **A edição reusa o formulário do cadastro**, e não é um segundo formulário:
  as regras de período, responsável único e parada dentro da viagem são as
  mesmas, e mantê-las em dois lugares é garantir que divirjam. O que muda é o
  que entra (`valoresDaMissao`), para onde vai (`PATCH`) e o campo de situação,
  que **some na edição** — mudar situação é `/situacao`, com regra de origem
  própria por ação, e oferecê-lo no formulário daria dois caminhos para a mesma
  mudança, um deles sem as regras.
- **O `id` de cada participante e de cada parada viaja no payload.** O endpoint
  **reconcilia as listas inteiras**: linha sem `id` é linha nova. Sem guardá-lo
  no modelo do formulário, salvar uma edição duplicaria o roteiro e deixaria as
  linhas originais órfãs. **Verificado por mutação:** remover os `id` do corpo
  derruba o caso que prova a preservação.
- **Duas conversões que a implementação ingênua erra**, e que `valoresDaMissao`
  trata: `modoInstituicao` sai de `instituicaoDoCatalogo`, não da presença de
  `instituicaoId` — a parada com instituição digitada à mão tem nome e não tem
  id, e lê-la como "nenhuma" apagaria o nome ao salvar; e participante já
  gravado entra sempre como "existente", porque o modo "nova" descreve o ato de
  cadastrar alguém junto com a missão, e reabrir nele criaria uma segunda pessoa.
- **O seletor de participante une a equipe do ciclo aos participantes da própria
  missão.** `pessoasDoComiteGestor` descarta vínculo encerrado; sem a união, o
  participante de uma missão antiga chegaria pré-selecionado com um id ausente
  das opções — o campo renderizaria vazio e o salvamento o perderia em silêncio.
- **Reabrir a execução não é reabrir a análise**, e os dois caminhos diferem por
  uma palavra no meio da URL (CG-038). O rótulo diz "execução" por extenso, e o
  caso de integração confirma que `statusAprovacao` não se move.
- **Cancelar não apaga nada**, e a tela diz isso: documentos, despesas e relato
  continuam registrados. Sem o aviso, "cancelar" lê como "excluir" e quem hesita
  em perder o que anexou deixa a missão aberta para sempre.
- **Nenhuma regra de estado foi reimplementada na tela.** A página esconde o
  botão no estado errado — as mesmas origens que a API aceita — e quem chamar a
  rota direto recebe 409. Duas cópias da mesma regra divergem na primeira
  mudança.
- **Arquivos:** `acoes/missao.ts` e `componentes/formularios/acoes-missao.tsx`
  (novos), `componentes/formularios/form-missao-comite.tsx` (parametrizado para
  edição), `lib/formularios/missao-comite.ts` (`id` no modelo,
  `payloadEdicaoMissao`, `valoresDaMissao`) e a página de detalhe da missão.
  **Nenhuma mudança na API** — os quatro endpoints já existiam.
- **Verificações executadas:** build da API e da web, ESLint e TypeScript limpos
  nos dois; 89 testes unitários da API e **163 da web** (quatro novos: carga da
  missão gravada, preservação dos `id`, linha acrescentada sem `id` e a ausência
  do campo de situação na edição); **642 de integração em 39 suítes**, com os
  sete novos de `test/ciclo-vida-missao-v1.int-spec.ts`. Um caso verificado por
  mutação, com a fonte restaurada e a suíte reconfirmada depois.
- **Descoberto no caminho:** criar missão exige **também** `missao:read`, porque
  `validarRedes` confere a rede contra o recorte de leitura. Quem não alcança a
  rede não cria missão nela — e sem a concessão de leitura não se alcança
  nenhuma. Está anotado na fixture do teste.
- **Limitações:** `pnpm smoke:telas` não foi executado — ele pressupõe
  `--com-dados`, e a base de desenvolvimento subiu só com a estrutura
  (2026-09-18). A verificação visual da barra de ações depende de existir missão
  cadastrada, o que a base atual não tem; o que foi provado está nos testes.
  **O cadastro de produto de missão pela tela continua na V1-031.**
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
  cancelar não apaga documentos/despesas; consulta não concede edição; a ação exige concessão explícita.
- **Testes:** schemas/payloads, integração das transições existentes e jornada
  criar→analisar→decidir→confirmar→prestar→encerrar, com devolução/reabertura.

## V1-031 — Cadastrar produtos de missão na interface

- **Estado / data:** Concluída — 2026-09-19.
- **Entregue:** a seção *Resultados* da missão deixou de ser só leitura.
  Cadastrar, editar e remover produto entraram na tela, cada verbo com a sua
  permissão (`produto-missao:create`, `:edit`, `:delete`) — ler não cadastra, e
  cadastrar não implica editar. **Nenhuma mudança na API:** os quatro endpoints
  já existiam desde a CG-056.
- **Não existe botão que responda “sim”**, e a ausência é a decisão da CG-056
  levada à tela: o “sim” é a existência da linha em `produto_missao`, e um botão
  gravaria afirmação sem nada que a sustente. **Cadastrar um produto já
  responde** — a API retira a declaração negativa sozinha, com auditoria, e o
  caso de integração confirma a transição de `NAO` para `SIM`.
- **As duas ações convivem no estado declarado.** Numa missão declarada sem
  produto, *Cadastrar produto* e *Reabrir resposta* aparecem lado a lado, porque
  respondem a coisas diferentes: “errei a declaração” e “apareceu um resultado”.
  Cadastrar não exige reabrir antes.
- **Ausência não vira declaração automática**, e o caso cobra isso: missão nova
  fica em `NAO_INFORMADO`, não em `NAO`. As duas dão zero produto cadastrado, e
  o checklist de encerramento precisa distinguir — é a distinção que o modelo
  criou.
- **O checklist reflete o cadastro real sem passo extra**, porque nada dele é
  gravado (CG-058): é recalculado a cada leitura. **Verificado por mutação** —
  remover o cadastro do caso derruba a asserção.
- **A regra do convênio é bicondicional nos dois lados.** O formulário só mostra
  o campo de acordo no tipo `CONVENIO`, e o schema recusa as duas metades:
  convênio sem acordo apontado, e acordo apontado em produto que não é convênio.
  Sem `convenio:read` a lista não é buscada e o formulário **avisa** em vez de
  oferecer um seletor vazio sem explicação.
- **Responsáveis são os participantes da missão**, e não o cadastro inteiro de
  pessoas: quem viajou é quem responde pelo produto da viagem, e oferecer todo
  mundo convidaria a creditar quem não esteve lá. O `papel` dentro do produto vai
  nulo — não é o papel na missão, e derivá-lo de lá afirmaria algo que ninguém
  declarou.
- **Remover não antecipa a recusa.** A API recusa em dois casos — produto com
  documento anexado (CG-052) e último produto de missão encerrada sem declaração
  (CG-059) —, e desabilitar o botão esconderia o motivo. A recusa vem com o
  texto que diz o que fazer. O caso de integração confirma que o produto
  documentado permanece.
- **A revalidação inclui `/producao`.** O produto aparece em quatro lugares, e
  deixar a produção consolidada de fora faria o recém-cadastrado só surgir lá na
  próxima navegação completa.
- **Ano é texto no formulário, convertido no payload.** Num input numérico o
  campo vazio vira `NaN`, e `NaN` some do payload em vez de virar erro visível.
- **Arquivos:** `lib/formularios/produto-missao.ts`, `acoes/produto-missao.ts` e
  `componentes/formularios/form-produto-missao.tsx` (novos), mais a seção
  *Resultados* da página de detalhe.
- **Verificações executadas:** build da API e da web, ESLint e TypeScript limpos
  nos dois; 89 testes unitários da API e **171 da web** (oito novos: payload com
  nulos, ano vazio e fora da faixa, as duas metades da regra do convênio, carga
  do produto gravado e a ausência do botão “sim”); **648 de integração em 39
  suítes**, com seis novos em `test/ciclo-vida-missao-v1.int-spec.ts`. Um caso
  verificado por mutação, com a fonte restaurada e a suíte reconfirmada.
- **Limitações:** o cadastro de **convênio** pela tela continua fora — é a
  V1-032, e aqui o acordo só é apontado, nunca criado. **Evidências do produto**
  usam o `/anexos` que já existe (`PRODUTO_MISSAO`), e a galeria de upload
  dentro da própria linha do produto não foi construída: a contagem de
  documentos aparece na tabela, e o envio continua pela aba Documentos.
  `pnpm smoke:telas` não foi executado — pressupõe `--com-dados`, e a base de
  desenvolvimento subiu só com a estrutura. Sem missão cadastrada na base atual,
  não houve verificação visual; o que está provado está nos testes.
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
- **Aceite:** concessão de escrita permite operar; consulta isolada só permite ler; associação de produto é
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
- **Decisão do responsável em 2026-09-19:** o Gerenciador é **só um
  gerenciador**. O que muda na plataforma da CAPES é mantido atualizado aqui
  **por quem usa o sistema**, e o sistema não se encarrega disso. Isso fecha
  parte do contrato desta ficha antes de ela começar:
  - **sem integração, importação automática ou conferência** contra a CAPES —
    o módulo é um livro-razão do que já aconteceu lá, não um espelho dela;
  - **o status informado é o status**, sem validação contra fonte externa;
  - **nada de alerta de "dado possivelmente desatualizado"**: o sistema não tem
    como saber se está, e o aviso transferiria à tela uma dúvida insolúvel. A
    resposta a uma divergência é registrá-la, e a tela existe para isso.
  - O `status` `PROPOSTO` de `remanejamento` **não vale no CAPES Global**: aqui
    não se propõe nada, só se registra o ato consumado. A coluna é genérica,
    de outros programas; a camada de domínio precisa recusá-la.
  Permanecem em aberto, e são o que a ficha ainda tem de decidir: a lista de
  tipos de evento, se a data do ato e a do registro são duas colunas, se o
  evento corrige o passado ou só acompanha o plano, e se o comprovante é
  obrigatório.
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
- **Direção registrada em 2026-09-18:** validação atribuída por permissão e
  alcance, conforme sugestão do responsável. Mapear as capacidades necessárias
  aos atos existentes durante a tarefa; a identidade de quem fornece e confere
  cada dado ainda deve ser registrada. Permissão não comprova o dado nem
  substitui sua origem institucional.
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
