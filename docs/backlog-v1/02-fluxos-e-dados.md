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

- **Estado / data:** **Concluída em 2026-09-20.**
- **Prioridade/dependência:** P1; V1-016.
- **Objetivo:** operar acordos já suportados pela API sem scripts.
- **O que entrou:** a seção *Convênios* da página do parceiro deixou de ser
  leitura. Cadastrar, editar, inativar e reativar acontecem ali, em sidesheet,
  com React Hook Form e Zod
  ([form-convenio.tsx](../../apps/web/src/componentes/formularios/form-convenio.tsx),
  [convenio.ts](../../apps/web/src/lib/formularios/convenio.ts),
  [acoes/convenios.ts](../../apps/web/src/acoes/convenios.ts)). Nenhuma
  permissão nova: `convenio:create`, `:edit` e `:status` já existiam desde a
  CG-056.
- **Cada verbo esconde-se pela sua permissão**, e não por uma só de escrita.
  Quem pode cadastrar e não pode editar vê *Cadastrar acordo* e não vê *Editar*
  — agrupar os três ofereceria um botão que a API recusaria.
- **Não há excluir, e a ausência é a decisão da CG-056:** o produto do tipo
  `CONVENIO` aponta para o acordo e a FK é `restrict`. A saída é inativar, com
  justificativa obrigatória — **nos dois sentidos**, porque reativar também é
  ato que alguém precisa explicar depois. O acordo inativado **sai da lista
  padrão e permanece na ficha do parceiro**, marcado; sumir das duas faria
  inativar ser indistinguível de apagar, e a tela não teria de onde oferecer a
  reativação.
- **O histórico passou a trazer os campos que a edição preenche.** `numero do
  processo`, `objetivo`, `observações` e as **redes** não vinham em
  `ConvenioHistorico`, e a edição os sobrescreveria com vazio: o formulário
  manda o acordo inteiro, e `atualizarConvenio` reconcilia a lista de redes.
  Buscar o detalhe de cada linha era a alternativa, e custaria uma requisição
  por acordo só para abrir um painel.
  - **As redes vêm por consulta à parte, nunca por `join`** — a armadilha da
    CG-027 na missão multirrede. Com `join`, o acordo de duas redes viraria
    duas linhas e a ficha contaria dois acordos onde há um. **Verificado por
    mutação:** trocar por `leftJoin` faz o caso falhar.
- **A missão de origem é campo, não dono.** São oferecidas as missões que já
  tocam aquele parceiro, dentro do alcance de quem lê; o ciclo inteiro
  convidaria a atribuir o acordo a uma viagem que nunca passou ali. Deixar em
  branco é *acordo firmado fora de missão*, e vai como `null` — não como id
  vazio.
- **Vigência indeterminada continua nula**, com a dica escrita no campo: uma
  data inventada seria pior. O formulário acrescenta uma recusa que a API não
  faz — fim anterior ao início —, porque lá a comparação não existe e o período
  impossível só apareceria na leitura, meses depois.
- **A leitura derivada acompanha:** `parceriaFormalizada` sai de convênio
  vigente (BOL-030), então a ação revalida também a lista de parceiros e a
  página da missão, onde o acordo é opção do produto do tipo convênio.
- **Aceite:** concessão de escrita permite operar; consulta isolada só permite
  ler; associação de produto é preservada; inativação exige justificativa e não
  exclui; histórico respeita recorte das missões/bolsas mesmo com catálogo
  institucional compartilhado — **todos verificados**.
- **Testes:** seis casos de integração em
  [convenios-v1.int-spec.ts](../../apps/api/test/convenios-v1.int-spec.ts) — os
  campos que a edição lê, a não duplicação do acordo multirrede (por mutação), a
  jornada criar → produto associado → inativar → reativar com o produto intacto,
  o acordo inativado que permanece na ficha, a troca de redes que não toca no
  resto, e o recorte sem `convenio:read` (lista vazia **e** acesso negado, para
  o estado vazio não afirmar "não há acordo"). Mais cinco de unidade em
  [convenio.test.mjs](../../apps/web/test/convenio.test.mjs), incluindo a ida e
  volta do acordo lido do histórico.
- **Limitação declarada:** `pnpm smoke:telas` não foi executado. Ele pressupõe
  `--com-dados` desde 2026-09-18, e a base atual sobe só a estrutura.

## V1-033 — Tratar pendências pela interface

- **Estado / data:** **Encerrada sem tela — decisão do responsável em 2026-09-20.**
- **Prioridade/dependência:** P1; V1-012.
- **Decisão:** a equipe não precisa de tela de pendências no Gerenciador. As
  pendências continuam sendo **documentação de trabalho** — o que elas já eram
  na planilha de origem —, e o registro segue na seed, no banco e na API. Isso
  **confirma** a decisão de 2026-09-08, que retirou a página, o item de menu e o
  cartão do painel; a ficha original a contrariava, e o responsável a manteve.
- **Por que isso não deixa lacuna:** pendência não governa nada. Nenhum cálculo,
  recorte ou transição de estado a consulta — ela descreve um assunto em aberto
  para quem trabalha no plano. Um item de trabalho sem efeito sobre o sistema é
  exatamente o que cabe em documento, e a tela só acrescentaria uma superfície
  a manter e a recortar por acesso.
- **O que permanece, e é suficiente:** `GET/POST /:programa/:ciclo/pendencias` e
  `PATCH /pendencias/:id`, com as regras que já valiam — resolver exige o texto
  da resolução (mínimo 10 caracteres), e o código `PEND-00n` é sequencial por
  ciclo.
- **A exclusão física fica como está, e a ficha pedia para decidir isso
  explicitamente.** `remover` apaga a linha, mas **só quando a origem é
  `MANUAL`**: pendência `AUTOMATICA` — divergência de saldo, PPG duplicado,
  catálogo sem correspondência — responde 403 e só pode ser resolvida
  ([pendencias.service.ts:145](../../apps/api/src/dominio/pendencias.service.ts#L145)).
  A evidência que a ficha queria proteger é justamente a automática, e ela já
  está protegida; o que se apaga é o item que alguém acabou de digitar errado,
  o mesmo critério do catálogo. Trocar por inativação só faria sentido junto de
  uma tela que a mostrasse, e não haverá tela.
- **O que não foi feito, e por quê:** nenhuma página, ação, formulário ou
  recorte por alvo. O recorte de acesso das pendências só passaria a importar
  com leitura pela interface; enquanto o consumo é por API administrativa, o
  `JwtAuthGuard` mais a permissão do endpoint bastam.
- **Se um dia voltar:** o que a ficha original pedia continua valendo como
  desenho — alcance resolvido no SQL pelo alvo, pendência sem alvo suficiente
  tratada como administrativa, e nada de conceder acesso global por ausência de
  PPG. Reabrir esta ficha é decisão do responsável, não consequência de outra
  tarefa.

## V1-034 — Administrar participação PPG–temática

- **Estado / data:** **Concluída em 2026-09-20.**
- **Prioridade/dependência:** P1; V1-011.
- **Objetivo:** tornar utilizável um PPG novo no planejamento do ciclo atual.
- **O que entrou:** API e tela para associar PPG a área temática, definir o
  responsável, editar e remover o vínculo —
  [participacoes.service.ts](../../apps/api/src/dominio/participacoes.service.ts),
  quatro rotas sob `.../tematicas/:codigo/participacoes`, e a seção *PPGs
  participantes* da página da temática. Antes da V1-034 o vínculo só nascia
  pela seed, e um PPG cadastrado depois ficava inutilizável: **sem participação
  não há par válido para a linha de plano, e sem linha de plano não há bolsa.**
- **Três permissões novas, institucionais:** `participacao:create`, `:edit` e
  `:delete`. O escopo é `GLOBAL` pelo mesmo argumento que tirou `ppg:write` do
  coordenador — **a participação é ela própria alvo de concessão**, e quem a
  cria decide, de lado, o que outras contas passam a alcançar. Entram
  automaticamente no modelo `administrador` e em nenhum outro.
- **O achado que mudou o desenho:** `concessao_acesso.participacao_id` é
  **`on delete cascade`**. Apagar a participação apagaria, dentro do banco e sem
  trilha nenhuma, cada concessão que a tinha como alvo — inclusive as **já
  revogadas**, que são o único registro de que alguém teve aquele acesso e de
  quem o retirou. Seria a revogação silenciosa que a V1-012 existe para
  impedir, agravada por destruir a própria prova.
  - Por isso a remoção é **recusada** enquanto houver concessão apontando para
    o vínculo, com dois textos diferentes: concessão ativa manda revogá-la em
    **Acessos**; concessão já revogada não tem saída por remoção, e a
    orientação é marcar a participação como *não contemplado* na edição, que
    deixa o vínculo sem efeito e preserva os dois históricos.
  - **Verificado por mutação:** desligar as duas guardas faz os dois casos
    passarem — e o `delete` leva a concessão junto.
- **Trocar o responsável não transfere acesso.** O coordenador anterior
  continua com o que lhe foi concedido, e o novo continua sem nada: são duas
  perguntas separadas desde a V1-012, e a tela diz isso no próprio painel. A
  troca grava **uma linha de auditoria por campo**, com quem saiu e quem entrou.
- **A edição não troca o PPG.** Trocar o PPG de uma participação existente não é
  editar — é desfazer um vínculo e criar outro, e a linha de plano que aponta
  para o par antigo passaria a descrever um programa que ninguém decidiu. O
  campo vira texto, como no item de catálogo em uso, e a saída é remover e
  associar de novo.
- **Plano e bolsa também impedem a remoção**, com a contagem na recusa. O botão
  **não** é desabilitado: desabilitar esconderia o motivo, e é o motivo que diz
  o que fazer — a mesma escolha da remoção de produto (V1-031).
- **Uma armadilha de SQL ficou documentada no código:** dentro de um `sql` cru,
  o Drizzle emite a coluna interpolada **sem o nome da tabela**, então
  `pp.ppg_id = ${s.ppg.id}` virava `pp.ppg_id = "id"` e casava com o `id` de
  `participacao_ppg` — a subconsulta respondia sempre `false`, em silêncio,
  porque continuava sendo SQL válido. A coluna externa passou a ser escrita
  qualificada à mão.
- **Aceite:** PPG novo ganha participação e fica disponível para linha válida;
  PPG pode participar de mais de uma temática (o caso do PROFSAÚDE); troca de
  responsável não transfere acessos; registros usados não são apagados em
  cascata — **todos verificados**.
- **Testes:** nove casos de integração em
  [participacoes-v1.int-spec.ts](../../apps/api/test/participacoes-v1.int-spec.ts)
  e quatro de unidade em
  [participacao.test.mjs](../../apps/web/test/participacao.test.mjs).
- **Limitação declarada:** `pnpm smoke:telas` não foi executado, pelo mesmo
  motivo das fichas anteriores.

## V1-035 — Especificar eventos externos da CAPES

- **Estado / data:** Concluída — 2026-09-20. **Nenhuma mutation**, como a ficha
  exige: o contrato está em
  [eventos-externos-v1.md](../eventos-externos-v1.md).
- **O schema foi mapeado antes de propor tabela nova**, e o resultado mudou a
  proposta: `remanejamento` **serve** ao grupo A com três ajustes (recusar
  `PROPOSTO`/`REJEITADO`, ignorar `ano_origem`/`ano_destino`, anexo em vez de
  `documento_autorizacao`), e `lancamento_execucao` **não serve** — é execução
  financeira, fora do escopo do CAPES Global. O grupo B ganha tabela própria
  pelo mesmo argumento que a CG-056 usou sobre `produto_bolsa`: forçar os dois
  fatos na mesma tabela deixaria metade das colunas nula em cada linha.
- **Três achados do código que exigiam decisão porque já se comportam:**
  - **`CANCELADA` libera a vaga; `INTERROMPIDA` não.** `exigirVaga` conta com
    `ne(status, 'CANCELADA')`. É o que faz a substituição funcionar — sem
    liberar, o substituto não entra —, mas nunca foi decidido: é efeito
    colateral de uma escolha de contagem, e a V1-036 precisa fixá-lo como regra
    consciente.
  - **O evento não mexe no orçamento.** O custo do plano sai de
    `planejamento_anual`, não de `bolsa_concedida`; cancelar muda o *Custo das
    bolsas concedidas* (D-B07), que é outro indicador desde a BOL-041.
  - **O panorama conta bolsa cancelada.** `FiltroMobilidade.status` é opcional e
    sem padrão, então com desistências registradas "35 mobilidades" passaria a
    incluir quem nunca viajou — é a dupla contagem que o aceite nomeia. A
    recomendação é excluir `CANCELADA` por padrão e manter `INTERROMPIDA`, o que
    **muda o comportamento da P02** e pede regressão própria na V1-036.
- **Matriz entregue:** cinco tipos do grupo B com estado anterior/posterior,
  campos comuns e permissão. Duas decisões de modelagem ficam registradas:
  `FALECIMENTO` vai a `INTERROMPIDA` e **não ganha estado próprio** — um
  `FALECIDA` no enum publicaria a causa em toda listagem de situação —, e
  `SUBSTITUICAO` é **um** evento apontando as duas bolsas, porque duas linhas
  independentes perderiam o vínculo que a ficha pede para fixar.
- **Permissão nova proposta** (`evento:create`/`evento:read`), e não reuso de
  `bolsa:edit`: corrigir período é rotina, registrar que alguém faleceu não é.
- **Três exemplos concretos** — cancelamento, correção e substituição —
  percorridos com o efeito em vaga, custo, panorama, produtos e histórico.
  Correção **não apaga**: registra-se sobre o evento, com auditoria por campo.
- **As quatro perguntas continuam abertas, com recomendação cada uma**, e o
  documento diz **o que cada uma bloqueia**: a lista de tipos não bloqueia nada
  (tipo como dado, à moda da CG-019); as duas datas bloqueiam o schema; "corrige
  o passado?" bloqueia o tratamento de vagas e indicadores; o comprovante
  obrigatório bloqueia só a validação do formulário na V1-037. Nenhuma delas
  trava a V1-036 inteira, que era o que o aceite pedia.
- **Verificação:** leitura de `schema/execucao.ts`, `schema/comum.ts`,
  `bolsistas.service.ts` (`exigirVaga`), `orcamento.service.ts` e
  `mobilidade.service.ts`; links do documento conferidos. Nenhum fato
  institucional foi inventado — o que falta está no §7, nomeado.
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

- **Estado / data:** Concluída — 2026-09-21. Resumo técnico no §9 de
  [eventos-externos-v1.md](../eventos-externos-v1.md).
- **Decisão de produto aplicada:** as recomendações das quatro perguntas do
  contrato (§7), como o backlog autoriza para pedido explícito de implementar a
  tarefa: **tipo como dado**, **duas datas** (ato informado, registro
  automático), **o evento não corrige o passado** (nada toca plano, teto ou
  custo) e **comprovante opcional**, com a contagem de anexos em cada linha.
  Três pontos foram além do texto do contrato e estão justificados no §9:
  movimentação aceita só `EXECUTADO` (a RN-13 exclui também `AUTORIZADO`);
  `evento:edit` separado de `evento:create`; e a edição da bolsa não desfaz a
  situação produzida por evento. **Nenhuma resposta institucional foi
  presumida**: o que a PROPESP ainda pode mudar (lista de tipos, prazo de guarda
  do evento de falecimento) ficou como dado ou como "A definir".
- **Arquivos e migrations:** migration `0042_eventos_externos_v1036`
  (`tipo_evento_bolsista` com os cinco tipos, `evento_bolsista`, colunas de
  registro em `remanejamento`, saída de `remanejamento_autorizacao_ck`, alvos
  `EVENTO_BOLSISTA`/`REMANEJAMENTO` em `entidade_anexo`);
  `schema/eventos-externos.ts`, `schema/execucao.ts`, `schema/comum.ts`;
  `seed/tipos-evento-bolsista.ts` e `seed.ts`;
  `dominio/eventos-externos.service.ts` e `.controller.ts`; `recorte-bolsa.ts`
  (`condicaoDoLado`); `catalogo.ts` e `modelos.ts` (`evento:*`);
  `bolsistas.service.ts` (`exigirVaga` exportada, trava da situação produzida
  por evento, auditoria da troca de situação); `mobilidade.service.ts`
  (cancelada fora do panorama por padrão); `anexos.service.ts` (política,
  categorias e recorte dos comprovantes); `scripts/db-zerar.sh` (as duas
  tabelas classificadas: tipos preservados, eventos zerados).
- **Verificações:** `pnpm lint`, `pnpm build` e `pnpm test` (89 unitários da API,
  184 da web) passando. `pnpm --filter api test:int`: 43 suítes; a nova
  [eventos-externos-v1.int-spec.ts](../../apps/api/test/eventos-externos-v1.int-spec.ts)
  tem 26 casos — cada tipo de evento, repetição sequencial e simultânea (mesma
  chave e eventos concorrentes na mesma bolsa), rollback de correção que
  esbarra na vaga, recorte por PPG, exigência de `bolsa:edit`, substituição em
  dois tempos, panorama e relatório, comprovante, garantias do banco e uma
  rodada pela camada HTTP com guard e Zod reais. **Duas mutações conferidas:**
  devolver as canceladas ao panorama e tirar a exigência de `bolsa:edit` fazem,
  cada uma, um caso falhar. `schema.int-spec.ts` trocou o caso da constraint
  removida pelo novo `remanejamento_quantidade_ck`.
- **Critérios de aceite:**
  - evento fora da temática ou do alcance recusado — movimentação entre
    temáticas é 422, PPG fora do alcance é 403, bolsa fora do alcance é 404;
  - reenvio não duplica efeito — a mesma chave devolve o mesmo registro, também
    em paralelo;
  - substituição preserva o beneficiário anterior — a bolsa que sai continua
    com a pessoa dela, cancelada, e o evento aponta a que entra;
  - nenhum pagamento fictício — nada é gravado em `lancamento_execucao`, e o
    custo por temática e `planejamento_anual` são comparados antes e depois;
  - falha de gravação não deixa estado parcial — a correção recusada pela vaga
    não muda nem o evento nem a bolsa nem a trilha.
- **Limitações e tarefas seguintes:**
  - **V1-037** faz a tela. Até lá o formulário da bolsa ainda leva a *Cancelada*
    ou *Interrompida* sem evento; bloquear isso agora deixaria a equipe sem
    caminho pela interface.
  - Substituição não troca de tipo por correção.
  - A movimentação não ajusta o plano; se a CAPES realocou uma vaga, a linha da
    P10 continua sendo editada à parte.
  - `pnpm smoke:telas` e `smoke:acesso` não foram executados: não há tela nova.
  - A migration não foi aplicada ao banco de desenvolvimento, só ao de testes.
- **Commit:** não criado nesta execução.

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

- **Estado / data:** Concluída — 2026-09-21.
- **Decisão aplicada:** comprovante opcional e destacado quando ausente (§7.4
  do contrato); o evento do bolsista se registra na página da bolsa, e a P12
  consulta os do ciclo e registra as movimentações.
- **Entregue:**
  - seção *Eventos informados pela CAPES* no detalhe da bolsa: registrar,
    corrigir (com motivo) e anexar comprovante; histórico com data do ato,
    data do registro, autor, efeito na situação, selo *Corrigido* e *Sem
    comprovante*; aviso na bolsa que entrou por substituição;
  - tela P12 em `/programas/[programa]/[ciclo]/remanejamentos` ("Eventos da
    CAPES", no menu com `exige: ["evento:read"]`): movimentações com registro e
    correção, e os eventos de bolsistas do ciclo;
  - formulários RHF + Zod em `lib/formularios/eventos-externos.ts`: só
    oferecem tipos que partem da situação atual, temáticas com dois PPGs no
    alcance e substitutas da mesma vaga; mostram o efeito antes de salvar;
    chave de envio por formulário aberto;
  - API: `GET .../movimentacoes/referencias` e `substitutas` em
    `GET /bolsistas/:id/eventos`; **a edição da bolsa passou a recusar
    Cancelada/Interrompida** (e o formulário não as oferece).
- **Verificações:** lint, build, 191 testes da web (7 novos em
  `eventos-externos.test.mjs`), integração da API completa, 3 casos novos em
  `eventos-externos-v1.int-spec.ts`. No dev: migration `0042` aplicada; a P12
  responde 200 com a explicação de acesso e a API 403 para conta sem
  `evento:read`.
- **Limitações:** a jornada completa no navegador fica com a V1-059; o banco de
  dev não tem bolsas, e o administrador semeado antes de 2026-09-21 **não tem
  `evento:*`** — conceder pela tela de Acessos (ato de operação).

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

- **Estado / data:** Concluída — 2026-09-20. O inventário e o procedimento estão
  em [retencao-v1.md](../retencao-v1.md). **Nenhum dado foi descartado, nenhum
  prazo foi gravado e nenhum arquivo saiu do disco.**
- **O ponto de partida, conferido no código:** hoje **nada é apagado** — não há
  `unlink` em `armazenamento.service.ts`, anexo se inativa (CG-014), contato se
  inativa (CG-026) e `db-backup.sh` não expurga snapshot. Isso não é lacuna a
  corrigir às pressas: preservar é o comportamento seguro, e apagar é que exige
  autorização. O que faltava era tornar a política **conferível**.
- **Tabela entregue** no formato que o aceite pede — categoria → prazo **ou
  decisão pendente** → marco → responsável → ação —, separando documento,
  dado pessoal fora de documento e trilha. A única regra decidida é a dos
  documentos pessoais do bolsista (fim da concessão + 5 anos, BOL-021), e o
  documento registra as duas propriedades que ela exige: **prazo derivado,
  nunca gravado**, e relógio a partir do fim da concessão, não do upload.
- **CPF e contatos não são tratados como documento**, e a distinção é o achado
  da tarefa: documento se apaga sem quebrar nada, mas o CPF é a chave da regra
  de uma modalidade por CPF/ciclo, e o e-mail é o que liga a conta do Keycloak
  à pessoa. Apagá-los quebraria regra retroativamente — a saída provável é
  **anonimizar**, e isso é decisão, não implementação.
- **A trilha não é o dado.** `registro_auditoria` já grava **quais campos**
  mudaram, nunca os valores pessoais, então retê-la indefinidamente não retém
  dado pessoal — o que permite a regra "auditoria não se apaga" conviver com
  qualquer prazo escolhido.
- **O limite dos backups está escrito, e não prometido:** um dump é retrato do
  banco inteiro, e descarte seletivo não o alcança. Descartar um documento **não
  o remove dos backups anteriores**; por isso a retenção dos backups é parte da
  política, e não só operação — cruza com a V1-053. O aceite pedia exatamente
  não prometer remoção de backup imutável.
- **Procedimento em três passos**, com a parte destrutiva sendo a menor:
  inventário (leitura pura) → prévia → descarte autorizado por flag explícita,
  com auditoria por item. Espelha `acesso:bootstrap` e `acesso:contas`. **Guarda
  excepcional** suspende o descarte de um item nomeado, porque processo,
  auditoria e litígio interrompem prazo de guarda — sem ela o descarte regular
  apagaria prova em curso. Repetir o passo 3 é seguro: o descartado não volta ao
  inventário.
- **V1-071 registrada, como a ficha manda:** não há antivírus, o ponto de
  inserção é `validarArquivo`, e a **prioridade continua P2** porque o vetor
  principal já saiu — DOC/XLS foram removidos dos formatos aceitos em
  2026-09-07 e o tipo é validado pelo conteúdo. Ela volta a ser prioritária se
  os formatos do Office voltarem ou se o acesso deixar de ser interno.
- **Cinco decisões nomeadas, cada uma com quem decide e o que bloqueia.** A mais
  estrutural e mais barata é a **5**: sem um responsável pelos dados pessoais, o
  procedimento não tem quem o execute e toda linha fica com dono vago — é a
  mesma pendência que a V1-001 já registra.
- **Verificação:** leitura de `anexos.service.ts` (derivação dos 5 anos e
  `CATEGORIAS_PESSOAIS`), `categoriaAnexoEnum`, `armazenamento.service.ts`,
  `contatos-parceiros.service.ts` (formato da auditoria) e `db-backup.sh`;
  links conferidos.
- **Limitação declarada:** **não houve simulação com dados fictícios.** A
  verificação da ficha a prevê *"se implementar rotina"*, e nenhuma foi
  implementada — implementá-la antes das decisões do §6 obrigaria a escolher
  prazos no lugar da instituição. O que foi verificado é o inventário.
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

- **Estado / data:** Concluída — 2026-09-20.
- **Entrega:** `GET /parceiros` retorna `{ itens, total, pagina, tamanho, paginas,
  resumo }`, com filtros antes de `LIMIT/OFFSET`, ordem por nome/ID, padrão 50
  e limite 200. Página é inteiro positivo até 2.147.483.647; entradas inválidas
  na API retornam 400 e página inválida na URL da tela volta a 1.
- **Visibilidade:** `parceiro:read` aceita somente GLOBAL, conforme V1-016:
  cadastro compartilhado não herda alcance de bolsa/missão. Rede é filtro da
  consulta, aplicado também ao total e resumo. Sem a capacidade, a API recusa
  inclusive a contagem; o histórico continua recortado por ação.
- **Interface:** URL guarda busca, rede, inativos e página; `pushState`/`popstate`
  preservam voltar/avançar e recarregar. Filtro novo volta à página 1;
  `keepPreviousData` mantém a tabela durante a busca. Cadastro, edição,
  inativação e conciliação invalidam também consultas fora da tela; ao remontar,
  a lista confere o snapshot restaurado pelo Next via BFF. Página que
  perdeu o último registro oferece retorno à última disponível.
- **Correções encontradas pelos testes:** a agregação sem JOIN removia a
  qualificação de `instituicao.id` no Drizzle, fazendo a subconsulta resolver
  o ID na tabela interna. A qualificação explícita corrige `semRede` e
  `comMissao`. A jornada também detectou cache antigo ao voltar do detalhe.
  Testes de ordem usam nomes distintos: o schema atual proíbe homônimos.
- **Medição reproduzível:** 10.000 parceiros sintéticos no banco dedicado,
  `test/paginacao-parceiros-v1.int-spec.ts`, consulta e composição do serviço
  com serialização do retorno. Em uma execução local: primeira página 20,91 ms /
  32.034 bytes; página 200: 33,84 ms / 32.036 bytes; busca `099`: 20,50 ms /
  32.026 bytes, 120 resultados, 50 enviados. São observações locais, sem SLA
  nem alegação de desempenho com histórico denso de missões/contatos.
- **Revisão de outras listas:** a consulta de candidatos levou 6,65 ms e
  retornou zero para `Sintetica 099` no mesmo volume. A inspeção confirmou
  `LIMIT 1000` **antes** da comparação em memória: rapidez não prova
  completude. O seletor de conciliação ainda recebe os primeiros 200 parceiros;
  a mudança de contrato preserva seu limite anterior. Esses dois limites
  preexistentes ficam registrados para seleção/busca no servidor em trabalho
  específico; não houve reescrita geral de listas nesta tarefa.
- **Evidências:** 42 testes de integração nas suítes de paginação, parceiros
  e recorte indireto; 89 unitários da API; suíte web incluindo normalização de
  página; builds da API/web e lint dos arquivos alterados. Jornada em
  `apps/web/e2e/parceiros.spec.ts` passou em Chromium com login real e banco
  descartável: 51 cadastros, voltar/avançar/recarregar, inativação da última
  linha da página 2, recuperação, busca vazia, criação, edição sem duplicação,
  retorno à busca anterior, parâmetros inválidos (400) e sem concessão (403).
- **Comandos de verificação:**
  `pnpm --filter api test:int --runTestsByPath test/paginacao-parceiros-v1.int-spec.ts test/parceiros.int-spec.ts test/recorte-indiretos-v1.int-spec.ts`;
  `pnpm --filter api test`; `pnpm --filter web test`;
  `node scripts/e2e.mjs parceiros.spec.ts` (inclui build dos dois apps).
  Para exibir a medição, executar a suíte de paginação isoladamente com
  `--silent=false`. Os containers E2E são removidos ao terminar; nenhuma base
  operacional foi alterada.

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
