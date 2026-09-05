# Backlog — Comitê Gestor e Administração

Última atualização: 2026-09-05.

Documento de continuidade para a evolução da atual P17. O objetivo é permitir
que outra pessoa ou agente retome o trabalho sem depender do histórico da
conversa.

## Revisão de escopo recebida em 2026-09-01

A equipe entregou o documento:
`dados/novos_dados/ajustes_e_definicao/Módulo de Gestão de Missões, Comitê Gestor, Parceiros e Resultados.pdf`.

As 28 páginas e 40 seções foram confrontadas com este backlog e com o código.
A matriz integral, divergências, decisões bloqueantes e ordem de retomada estão
em [revisao-escopo-comite-gestor-2026-09-01.md](revisao-escopo-comite-gestor-2026-09-01.md).

O material que torna CG-005 a CG-009 decidíveis está em
[homologacao-comite-gestor.md](homologacao-comite-gestor.md): classificação das
40 seções, modelo de estados com migração, matrizes de rede e escopo, governança
da aprovação, tabela requisito–momento–obrigatoriedade–efeito financeiro e a
folha de aprovação. **São propostas, não decisões.** Por orientação explícita do
responsável pelo projeto, somente as fundações estruturais CG-016 a CG-018
avançaram antes do aceite formal; decisões de aprovação, documentos e acesso
continuam bloqueadas.

Orientação obrigatória para continuidade:

- não iniciar CG-045 com o contrato atual;
- executar primeiro CG-005 a CG-009;
- não interpretar requisitos ainda não homologados como autorização para
  implementar decisões institucionais;
- preservar as tasks concluídas e criar evoluções vinculadas a elas;
- manter os checkboxes e registrar progresso parcial antes de encerrar cada
  turno de desenvolvimento.

## Como manter este documento

- `[ ]` não iniciado.
- `[~]` em andamento. Ao usar este estado, registre logo abaixo o que já foi
  feito e o que falta.
- `[x]` concluído e verificado.
- Não marque uma task como concluída apenas porque o código foi escrito: execute
  os testes e confira todos os critérios de aceite.
- Ao concluir uma task, acrescente a data e, quando útil, os arquivos principais
  alterados.
- Se uma decisão mudar, atualize primeiro a seção "Decisões confirmadas" e
  depois as tasks afetadas.

## Objetivo do módulo

Transformar a atual página de orçamento do Comitê Gestor em uma área chamada
**Comitê Gestor e Administração**, com três frentes:

1. visão financeira do orçamento separado do Comitê Gestor;
2. cadastro e acompanhamento de missões institucionais;
3. cadastro separado das equipes do Comitê Gestor e da Administração.

O fluxo esperado é:

```text
Pessoa/equipe
  -> cadastro da missão, sem valores
  -> roteiro e participantes
  -> registro do que foi realizado
  -> prestação com passagens, diárias e PDFs
  -> validação da prestação
  -> atualização dos indicadores do orçamento
```

## Decisões confirmadas

- [x] A tela se chamará **Comitê Gestor e Administração**.
- [x] As pessoas serão apresentadas em duas equipes separadas:
  **Comitê Gestor** e **Administração**.
- [x] Pessoas das duas equipes podem participar das missões e utilizar o
  orçamento para essa finalidade.
- [x] Qualquer pessoa pode ser incluída em uma missão. Se ela ainda não existir,
  o usuário poderá cadastrá-la durante o fluxo. O cadastro será persistente e a
  pessoa poderá ser reutilizada em missões posteriores.
- [x] Uma missão pode abranger vários países, cidades, universidades, visitas e
  eventos.
- [x] A missão é cadastrada inicialmente sem orçamento, passagem ou diária.
- [x] Cada despesa terá seu próprio exercício informado. A definição do
  exercício não será inferida apenas da data inicial da missão.
- [x] Somente valores de prestações **validadas** reduzem o saldo oficial.
  Valores em preenchimento ou enviados aparecem separadamente.
- [x] Na primeira versão, somente o papel `admin` poderá acessar a área renovada
  e executar suas operações. A matriz definitiva de acesso será definida
  posteriormente.
- [x] O aviso visual "Este orçamento não integra o orçamento de bolsas do CAPES
  Global" será removido da página.
- [x] A regra RN-14 continua válida nos cálculos: o orçamento do Comitê Gestor
  permanece separado e nunca é somado ao orçamento de bolsas.
- [x] Formulários novos do módulo usam React Hook Form com resolver Zod; a API
  continua validando novamente como fronteira autoritativa.
- [x] A composição formal recebida para UFMG, UNESP e UNICAMP é consolidada por
  pessoa e equipe. Uma pessoa repetida nos documentos possui um único vínculo,
  associado a todas as redes em que aparece.
- [x] Os documentos não informam vigência. Para a carga inicial, os vínculos
  começam em `2027-01-01`, início do ciclo CAPES Global 2027–2030, e permanecem
  sem data final até que a Administração registre o encerramento.
- [x] A carga formal não fecha o cadastro: o `admin` continua podendo inserir
  novas pessoas e novos vínculos pela aba Equipes.
- [x] Na fase provisória, os dados pessoais dos contatos de parceiros são
  acessíveis somente ao `admin`. Missões expõem apenas id e nome do contato;
  listagens de parceiros expõem apenas a contagem. Auditoria registra o campo
  alterado, mas não copia os valores pessoais. Contato referenciado não é
  apagado: fica inativo e retido para preservar o histórico até existir uma
  política institucional de descarte.

## Separações de domínio que devem ser preservadas

- `item_planejado` com rubrica `MISSOES` representa previsão no plano de
  aplicação. Não representa uma viagem efetivamente cadastrada e não deve ser
  reutilizado como missão do Comitê Gestor.
- `membro_comite` representa o comitê temático de uma área temática. Não deve
  ser reutilizado para as equipes do Comitê Gestor ou da Administração.
- `orcamento_comite_gestor` continua sendo a fonte dos aportes anuais por
  instituição.
- A missão pode existir sem prestação e sem qualquer valor financeiro.
- Ausência de prestação não significa despesa de R$ 0,00. A interface deve
  apresentar "Prestação não iniciada".
- Totais financeiros são calculados; não devem ser persistidos como colunas
  derivadas.
- Pertencer a uma equipe é um dado de negócio, não um papel de autenticação.

## Estado atual da execução

- [x] Regras iniciais consolidadas (CG-001).
- [x] Acesso provisório decidido como exclusivo de `admin` (CG-002).
- [x] Wireflow da primeira entrega validado e implementado (CG-004).
- [x] Fundação de equipes implementada: schema, migration, API, formulário,
  auditoria e acesso provisório exclusivo de `admin`.
- [x] O formulário de pessoa/membro preserva todos os valores quando a API
  devolve erro de validação; regressão coberta em 2026-08-31.
- [x] Fundação de missões implementada: banco, API e cadastro multietapas com
  participantes e roteiro em múltiplos países, ainda sem a página de detalhe.
- [x] O aviso visual foi removido; a separação RN-14 permanece nos cálculos.
- [x] A composição formal dos três PDFs foi carregada: 10 pessoas, 10 vínculos
  consolidados e 19 associações pessoa–rede, sem retirar o cadastro manual.
- [x] A P17 tem as abas Visão geral, Missões e Equipes. A aba Missões deixou de
  ser um estado informativo: já lista, filtra e pagina as missões (CG-043).
- [x] O domínio de missões do escopo anterior está completo na API: criação
  transacional, lista com filtros e resumo, detalhe, edição auditada, ciclo de
  vida e relato do realizado (CG-030 a CG-036). Aprovação, redes e parceiros são
  evoluções novas e não anulam essa entrega histórica.
- [~] A lista e o cadastro de missões estão implementados. Falta o detalhe e o
  relato na interface (CG-045 e CG-046). No Épico 5, schema, CRUD de despesas,
  upload seguro e associação de documentos estão entregues (CG-013/014 e
  CG-050 a CG-052); faltam interface, envio, revisão e indicadores.
- [x] O novo documento de expectativas foi auditado contra as 40 seções e o
  resultado foi documentado sem alterar regras de negócio ainda não homologadas.
- [~] A fundação de dados de parceiros e contatos foi implementada na CG-017.
  A API de instituições parceiras, incluindo deduplicação e conciliação, foi
  concluída na CG-025 e a API restrita de contatos na CG-026. Interface,
  aprovação do Comitê, escopo por rede, produtos, convênios, evidências,
  dashboards e relatórios continuam pendentes.
- [~] O pacote que torna CG-005 a CG-009 decidíveis foi produzido em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md). CG-005 a CG-008
  ainda aguardam aceite institucional; a CG-009 foi concluída depois com as
  respostas do documento de orçamento e decisões do responsável pelo projeto.
- [x] CG-022 e CG-040 foram concluídas em 2026-09-01: contagem de missões por
  membro e filtro de exercício da tabela de aportes.
- [x] CG-016 foi concluída em 2026-09-01: a missão pertence a uma ou mais redes
  (`missao_rede`), com filtro, coluna, auditoria por rede e a garantia de que a
  missão multirrede aparece e conta uma única vez.
- [x] CG-017 foi concluída em 2026-09-02: instituição canônica e provisória,
  dados institucionais completos, relação N:N com redes e contatos reutilizáveis
  com um único principal ativo.
- [x] CG-018 foi concluída em 2026-09-02: identificação ampliada, responsável
  único, destino/evento completos, relacionamento com parceiros, período
  individual de participantes e número de dias calculado.
- [x] CG-025 foi concluída em 2026-09-02: API de parceiros com busca, cadastro,
  edição, inativação, candidatos a duplicidade e conciliação transacional.
- [x] CG-026 foi concluída em 2026-09-02: API privada de contatos com busca,
  deduplicação, principal único, inativação, reativação e auditoria minimizada.
- [x] CG-027 foi concluída em 2026-09-02: histórico consolidado do parceiro em
  uma linha única por missão, com produtos e convênios nomeados como pendentes
  em vez de zerados.
- [~] CG-049 avançou em 2026-09-02: lista, busca, cadastro, edição, contatos,
  detalhe histórico e conciliação de parceiros na interface, com alerta de
  duplicidade que preserva o formulário. A seleção dentro da missão continua
  esperando a CG-045.
- [~] CG-063 avançou em 2026-09-02: o smoke passou a percorrer as telas de
  parceiro nos dois perfis, com o detalhe verificado quando há cadastro e o
  estado vazio quando não há.
- [~] CG-029 avançou em 2026-09-02: cobertura integrada completa de parceiros e
  contatos, incluindo a não duplicação de missão após conciliação. Só falta o
  isolamento horizontal, que depende da CG-028 existir.
- [~] CG-064 teve a primeira passagem em 2026-09-02: rolagem de tabela
  alcançável pelo teclado, erro de campo vinculado ao controle, descrição do
  sidesheet anunciada e colunas de ação nomeadas.
- [~] CG-065 teve uma passagem em 2026-09-02: a especificação funcional ganhou a
  P24 de parceiros e perdeu a afirmação — já falsa — de que nenhum contato
  pessoal era exposto pela aplicação.
- [~] CG-062 avançou em 2026-09-02: os cálculos monetários ganharam regressão,
  incluindo a ordem entre truncar e somar, verificada por mutação.
- [x] CG-013 foi concluída em 2026-09-02: schema da prestação de contas com
  especializações de passagem, cotação e diária, totais derivados e ausência de
  prestação representada pela ausência da linha.
- [x] CG-010 foi concluída em 2026-09-02: os seis vocabulários do módulo
  existem, e as cópias literais no serviço passaram a derivar do enum do banco.
- [x] CG-015 foi concluída em 2026-09-02: 25 migrations verificadas em banco
  vazio e sobre a seed, com os indicadores idênticos nos dois caminhos.
- [x] CG-050 foi concluída em 2026-09-02: CRUD de despesas da missão com
  passagem, cotações e diária, e todos os totais derivados em `numeric`.
- [x] CG-051 foi concluída em 2026-09-02: upload e download seguros, com tipo
  decidido pelo conteúdo, chave opaca, versionamento sem perda e permissão
  herdada da entidade de destino.
- [x] CG-052 foi concluída em 2026-09-05: documentos de passagem, diária e
  cotações têm categoria compatível com o alvo, preservam autoria, data e
  versões, e despesas documentadas não podem deixar anexos órfãos.
- [x] CG-061 foi concluída em 2026-09-05 para a matriz provisória de acesso:
  UUIDs e nomes maliciosos são recusados na fronteira, o download codifica o
  nome com segurança e referência direta não contorna a permissão do alvo. A
  verificação completa (lint, build, 58+64 unitários, 246 integrações e os dois
  smokes) foi executada no fechamento.
- [x] CG-014 foi concluída em 2026-09-02: modelo documental decidido e
  registrado em [modelo-documental.md](modelo-documental.md), com três pontos
  institucionais propostos e ainda por confirmar.
- [x] CG-009 foi concluída em 2026-09-02: o documento da equipe respondeu tipos
  de despesa, formatos, abertura da prestação e a natureza da estimativa; o
  responsável decidiu BRL único, abatimento do aporte por prestação validada e
  requisitos agnósticos ao tipo de missão.
- [x] O backlog possui 70 tasks rastreáveis: 37 concluídas, 11 em andamento e
  22 pendentes. Esses números são retrato de 2026-09-05 e devem ser atualizados
  quando um checkbox mudar.

Próxima ação obrigatória para retomar o fluxo funcional: **obter o aceite da
folha de aprovação** de
[homologacao-comite-gestor.md](homologacao-comite-gestor.md), que fecha CG-005 a
CG-008 e os blocos institucionais ainda abertos. A CG-009 já foi concluída. A
CG-045 continua não sendo a próxima: aprovação e escopo de acesso ainda alteram
o contrato da página de detalhe.

As duas tasks que podiam avançar sem depender do aceite foram entregues em
2026-09-01: **CG-022** (contagem de missões por membro) e **CG-040** (filtro de
exercício).

Em seguida, ainda em 2026-09-01 e por decisão registrada do responsável pelo
projeto, as decisões **estruturais** do pacote (CG-006 e CG-007) passaram a ser
tratadas como aceitas para desbloquear as **CG-016 a CG-018**, que foram
concluídas. As
decisões **institucionais** continuam pendentes e nada que dependa delas foi
implementado: modelo B de aprovação (CG-008), retenção/backup de documentos
(D-08), perfil Participante (D-12) e a matriz definitiva de acesso
(CG-003). A folha de aprovação continua valendo — o aceite formal ainda é o que
fecha CG-005 a CG-008 e os blocos restantes.

## Proposta de navegação

Rota principal existente:

```text
/programas/[programa]/[ciclo]/comite-gestor
```

Abas persistidas na URL:

- **Visão geral**;
- **Missões**;
- **Equipes**.

Detalhe de missão:

```text
/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]
```

A prestação inicialmente fica dentro do detalhe da missão. Uma futura tela
global de prestações poderá consumir o mesmo domínio e os mesmos endpoints.

## Estados recomendados

Os estados abaixo são independentes.

### Situação administrativa da missão

- `RASCUNHO`
- `PLANEJADA`
- `CONFIRMADA`
- `CONCLUIDA`
- `CANCELADA`

### Situação temporal calculada

- `FUTURA`
- `EM_ANDAMENTO`
- `ENCERRADA`

Essa situação é calculada a partir das datas e não é persistida.

### Situação da prestação

- `NAO_INICIADA`
- `EM_PREENCHIMENTO`
- `ENVIADA`
- `COM_PENDENCIA`
- `VALIDADA`

## Backlog executável

### Épico 0 — Especificação e decisões

- [x] **CG-001 — Consolidar regras do módulo**

  Decisões registradas:

  - qualquer pessoa pode participar de missão;
  - pessoa inexistente pode ser cadastrada e reutilizada;
  - as duas equipes podem utilizar o orçamento em missões;
  - uma missão pode ter múltiplos países;
  - cada despesa informa seu exercício;
  - apenas prestações validadas reduzem o saldo.

  Critério de aceite: decisões registradas neste documento sem regra financeira
  ou de participação implícita.

- [x] **CG-002 — Definir matriz provisória de acesso**

  Escopo provisório: somente `admin` acessa a área renovada e recebe as
  permissões de leitura e escrita de equipe, missão e prestação. Os demais
  papéis não recebem acesso novo nesta etapa.

  Critério de aceite: permissões novas mapeadas exclusivamente para `admin` e
  endpoints protegidos explicitamente.

- [ ] **CG-003 — Definir matriz definitiva de acesso**

  Definir futuramente:

  - quem administra as equipes;
  - quem cadastra e edita missões;
  - quem registra despesas e documentos;
  - quem envia, valida ou devolve prestações;
  - o que cada participante pode consultar;
  - se haverá escopo por missão, equipe ou pessoa;
  - como os novos perfis Administrador, Gestor da Rede, Comitê Gestor e
    Participante correspondem a papéis e permissões;
  - como o `sub` do Keycloak se vincula à pessoa local.

  Dependências: CG-005, CG-007 e CG-008, além da decisão institucional sobre os
  perfis.

  Critério de aceite: matriz papel/escopo/ação aprovada e refletida no mapa de
  permissões da API.

- [x] **CG-004 — Validar wireflow da experiência**

  Validar antes da construção:

  - visão geral;
  - lista e filtros de missões;
  - cadastro multietapas;
  - detalhe da missão;
  - cadastro rápido de pessoa;
  - equipes separadas;
  - relato realizado;
  - prestação e revisão.

  Concluída em 2026-08-31 para a primeira entrega. O cadastro de membro permite
  selecionar uma pessoa existente ou criar uma pessoa reutilizável no mesmo
  sidesheet. A P17 usa abas na query string e detalhe de missão continua
  reservado para a Entrega B.

  Critério de aceite: fluxo validado com os campos obrigatórios e ações
  disponíveis em cada estado.

- [~] **CG-005 — Homologar o novo escopo e as fases**

  Revisar com a equipe cada bloco do documento recebido e classificá-lo como:

  - obrigatório no próximo MVP;
  - entrega posterior;
  - apenas visão futura;
  - fora do escopo.

  Confirmar especialmente parceiros, contatos, evento independente, produtos,
  convênios, fotos, documentos Office, relatórios e o menu proposto.

  Dependência: nenhuma; esta é a porta de entrada da revisão.

  Critério de aceite: as 40 seções possuem fase e prioridade aprovadas, sem o
  desenvolvedor precisar inferir o que significa “poderá permitir”. Registrar
  as decisões neste backlog e na revisão de escopo.

  Progresso em 2026-09-01: a proposta de classificação das 40 seções em
  MVP/F2/VF/FE está pronta em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md), com a
  justificativa de cada linha e uma proposta de arquitetura da informação que
  recusa o menu de 12 grupos da §39 enquanto não houver dado. **Falta apenas o
  aceite da equipe** — a task só fecha quando a folha de aprovação estiver
  marcada.

- [~] **CG-006 — Redefinir o modelo de estados da missão**

  Separar e homologar:

  - situação de aprovação;
  - situação temporal;
  - confirmação de realização;
  - situação da prestação;
  - encerramento final;
  - cancelamento e reabertura.

  Não transformar automaticamente “data final ultrapassada” em “viagem
  realizada”. Definir migração dos estados atuais `PLANEJADA`, `CONFIRMADA`,
  `CONCLUIDA` e `CANCELADA` sem perder histórico.

  Dependência: CG-005.

  Critério de aceite: diagrama de transições aprovado, com origem, destino,
  permissão, justificativa e efeitos de cada ação.

  Progresso em 2026-09-01: proposta de quatro dimensões independentes
  (aprovação, execução, prestação, encerramento), com o diagrama de transições,
  a tabela origem–destino–permissão–justificativa–efeito e o mapeamento dos
  cinco status atuais, em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md). Duas escolhas da
  migração afirmam coisas sobre dados existentes (`CONFIRMADA` → `APROVADA` e
  `CONCLUIDA` → realização `REALIZADA`) e por isso precisam de aceite explícito.
  Falta o aceite.

- [~] **CG-007 — Definir redes e escopos do módulo**

  Confirmar:

  - se a missão pode pertencer a uma ou várias redes;
  - se evento, instituição e produto podem ser multirrede;
  - o significado de “Minha rede”;
  - como um Gestor da Rede é vinculado à rede;
  - como o Comitê consulta todas as redes;
  - se participante vê somente as próprias missões.

  Recomendação em análise: missão multirrede com pelo menos uma associação.

  Dependência: CG-005.

  Critério de aceite: matriz entidade–rede e matriz perfil–escopo aprovadas.

  Progresso em 2026-09-01: as duas matrizes estão propostas em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md), com `missao_rede`
  N:N de no mínimo uma rede, “Minha rede” definida a partir de
  `membro_equipe_gestao_rede` (que já tem a carga formal) e as permissões novas
  `missao:submit`, `missao:decide`, `missao:reopen` e `parceiro:read|write`.
  Falta o aceite.

- [~] **CG-008 — Definir a governança da aprovação do Comitê**

  Decidir:

  - quem pode enviar para análise;
  - se uma decisão individual representa o Comitê;
  - se existe quórum, votação ou relator;
  - quais documentos são obrigatórios antes do envio;
  - como funcionam rodadas de ajustes;
  - quem pode reabrir uma decisão;
  - o que deve constar do parecer e do histórico imutável.

  Dependências: CG-005 a CG-007.

  Critério de aceite: regra institucional suficiente para implementar aprovação
  sem reduzir o processo a uma troca de status por `admin`.

  Progresso em 2026-09-01: três modelos comparados em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md) — decisão
  individual, relator com registro colegiado e quórum no sistema — com
  recomendação pelo segundo e respostas propostas para envio, documentos
  prévios, rodadas, reabertura e conteúdo do parecer. Falta o aceite e a
  resposta à pergunta institucional sobre como o Comitê delibera.

- [x] **CG-009 — Reconciliar orçamento, despesas, documentos e encerramento**

  Resolver as diferenças entre as decisões anteriores e o documento novo:

  - estimativa/orçamento antes da aprovação versus despesa efetiva;
  - passagens, cotações, diárias e outras despesas;
  - moeda original, cotação e valor oficial em reais;
  - PDF, imagens e arquivos Office;
  - documentos e evidências obrigatórios por tipo de missão;
  - checklist condicional e justificativa de dispensa;
  - abertura da prestação após a realização.

  Preservar a regra: somente prestação validada reduz o saldo oficial.

  Dependências: CG-005, CG-006 e CG-008.

  Critério de aceite: tabela requisito–momento–obrigatoriedade–efeito financeiro
  aprovada e refletida nas tasks CG-013, CG-014 e CG-050 a CG-059.

  Progresso em 2026-09-01: a tabela está proposta em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md), junto do modelo
  de `despesa_missao` tipada com `cotacao_passagem` à parte, do checklist
  calculado e condicional, e das propostas para exercício, moeda estrangeira e
  formatos de arquivo. A regra de que só prestação validada reduz o saldo foi
  preservada em todas as alternativas. Falta o aceite e as respostas
  institucionais sobre exercício, retenção e formatos Office.

  **Concluída em 2026-09-02.** A auditoria do documento da equipe de orçamento
  (*Módulo de Gestão de Missões, Comitê Gestor, Parceiros e Resultados*, 28
  páginas) respondeu quatro dos sete itens, e o responsável pelo projeto
  decidiu os três restantes.

  Respondido pelo documento:

  - **tipos de despesa** (§24): hospedagem, transporte, inscrição em evento,
    seguro e outros, além de passagem e diária;
  - **formatos de arquivo** (§15): PDF, JPG, PNG, DOC/DOCX, XLS/XLSX;
  - **abertura da prestação** (§20): o sistema abre a etapa automaticamente
    quando a viagem é marcada como realizada — não é ação manual;
  - **estimativa antes da aprovação** (§15): o "Orçamento" é um **documento
    anexado**, não entidade estruturada. Some assim a concorrência com a
    despesa efetiva: não há dois números disputando o mesmo papel.

  Decidido pelo responsável, porque o documento é silente:

  - **moeda**: o sistema trabalha **somente em BRL**. Não há moeda de origem,
    cotação nem valor convertido; a conversão acontece antes do lançamento e o
    que se registra é o valor em real;
  - **efeito financeiro**: prestação **`VALIDADA` abate o aporte anual** do
    Comitê Gestor. Confirma a regra que já vinha sendo preservada;
  - **obrigatoriedade**: os requisitos são **agnósticos ao tipo de missão** —
    a mesma lista vale para todas e é apresentada ao usuário, em vez de variar
    por tipo.

  Tabela requisito–momento–obrigatoriedade–efeito financeiro:

  | Requisito | Momento | Obrigatoriedade | Efeito financeiro |
  |---|---|---|---|
  | Projeto, convite, programação, justificativa, orçamento | Antes da aprovação | Agnóstico | Nenhum |
  | Aprovação do Comitê registrada | Antes da realização | Obrigatório | Nenhum |
  | Viagem realizada | Fim do período | Automático | **Abre a prestação** |
  | Passagens e comprovantes | Prestação | Se houve passagem | Compõe o total |
  | Cotações | Prestação | Se houve passagem | Nenhum (evidência) |
  | Diárias e comprovante | Prestação | Se houve diária | Compõe o total |
  | Outras despesas (5 tipos) | Prestação | Se houve | Compõe o total |
  | Relatório final | Encerramento | Obrigatório | Nenhum |
  | Produtos informados (sim/não) | Encerramento | Obrigatório | Nenhum |
  | Convênio | Encerramento | Condicional | Nenhum |
  | Fotos e evidências | Encerramento | Obrigatório | Nenhum |
  | Prestação `VALIDADA` | Encerramento | Obrigatório | **Abate o aporte anual** |

  Reflexo imediato nas tasks, no mesmo dia: a **CG-013** teve o enum de despesa
  tipado (migration `0025_despesas_homologadas_cg009.sql`) e a passagem passou a
  guardar **origem e destino separados**, data do voo e forma de pagamento
  conforme a §21 (`0026_passagem_origem_destino.sql`) — trecho em texto livre
  obrigaria a interpretar string para responder "quanto foi gasto por país", que
  é pergunta do dashboard (§33). A **CG-050** acompanhou o contrato. A decisão
  de BRL único está registrada no schema, para que ninguém acrescente coluna de
  câmbio por conta própria. **CG-014** e **CG-051** herdam a lista de formatos;
  **CG-055** herda o abatimento; **CG-058** herda o checklist agnóstico.

  Resultado: **48 unitários da API, 63 regressões da web e 227 integrações
  aprovados**.

### Épico 1 — Fundação do domínio

- [x] **CG-010 — Criar enums do módulo**

  Criar ou reaproveitar, sem duplicação semântica:

  - tipo de equipe `COMITE_GESTOR | ADMINISTRACAO`;
  - papel na missão `RESPONSAVEL | PARTICIPANTE | APOIO`;
  - situações administrativas da missão;
  - tipos e situações de atividade;
  - situações da prestação;
  - tipos de despesa `PASSAGEM | DIARIA`.

  Dependência: CG-004.

  Critério de aceite: enums exportados pelo schema, utilizados pelos tipos e
  cobertos pela migration.

  Progresso em 2026-08-31: foram criados e migrados `tipo_equipe_gestao`,
  `papel_missao`, `status_missao_comite` e `status_atividade_missao`. Os enums de
  prestação e despesa permanecem pendentes até CG-013.

  Impacto registrado em 2026-09-01: o documento novo exige estados de análise,
  ajustes, aprovação e reprovação. Não alterar os enums antes da definição das
  dimensões e da migração dos estados atuais na CG-006.

  Concluída em 2026-09-02, quando a CG-013 fechou o que faltava. Os seis
  vocabulários da lista existem, estão exportados pelo schema e cobertos por
  migration: `tipo_equipe_gestao`, `papel_missao`, `status_missao_comite`,
  `tipo_missao` + `status_atividade_missao`, `status_prestacao_missao` e
  `tipo_despesa_missao`.

  **A duplicação semântica que existia foi eliminada.** `missoes-comite.service.ts`
  mantinha cópias literais dos estados da missão e da prestação; agora ambas
  derivam de `enumValues`. A cópia era o tipo de erro que passa no build e só
  aparece em produção: acrescentar um estado na migration e esquecer do arquivo
  produziria um valor que o banco aceita e a API recusa. `situacoesTemporais`
  continua literal, e corretamente — é derivada da consulta, não existe enum
  para ela no banco.

  Cobertura: 4 unitários em `database/enums.spec.ts`, incluindo a garantia de
  que `NAO_INICIADA` **não** entre em `status_prestacao_missao` e de que
  `tipo_despesa` (execução genérica, P11) não seja fundido com
  `tipo_despesa_missao` só porque o nome se parece. Resultado: **48 unitários da
  API, 54 regressões da web e 215 integrações aprovados**.

  A ressalva de 2026-09-01 continua valendo e **não é pendência desta task**: se
  a CG-006 redefinir os estados da missão, ela altera `status_missao_comite` com
  a migração dos estados atuais; e os estados de análise/aprovação pertencem ao
  schema da CG-019, não a este.

- [x] **CG-011 — Criar schema das equipes**

  Criar `membro_equipe_gestao` com:

  - ciclo;
  - pessoa;
  - tipo de equipe;
  - função;
  - papel/titularidade, se confirmado no wireflow;
  - início e fim do vínculo;
  - situação;
  - observações e timestamps.

  Regras:

  - permitir a mesma pessoa nas duas equipes;
  - impedir vínculo simultâneo duplicado na mesma equipe;
  - encerrar vínculo sem apagar o histórico;
  - indexar ciclo, pessoa e tipo de equipe.

  Dependência: CG-010.

  Critério de aceite: constraints e índices verificados por testes de
  integração.

  Concluída em 2026-08-31 em `database/schema/comite-gestor.ts`, com constraint
  de período, unicidade do vínculo aberto, validação de sobreposição no serviço
  e preservação de vínculos encerrados.

- [x] **CG-012 — Criar schema das missões**

  Criar `missao_comite` com código, ciclo, título, objetivo, período, status,
  relato geral, resultados e observações.

  Criar `missao_participante` com pessoa, vínculo de equipe quando houver,
  papel na missão e observações.

  Criar `atividade_missao` para visitas, universidades, instituições, eventos,
  cidades e países, contendo planejamento e relato realizado.

  Regras:

  - código único por ciclo;
  - data final maior ou igual à inicial;
  - participante único por missão;
  - permitir pessoa sem vínculo prévio com as duas equipes;
  - permitir vários países e atividades;
  - aceitar instituição do catálogo ou nome livre;
  - não incluir campos financeiros na missão.

  Dependência: CG-010.

  Critério de aceite: uma missão completa pode ser persistida sem criar
  prestação ou lançamento financeiro.

  Concluída em 2026-08-31 em `database/schema/comite-gestor.ts` e na migration
  `0014_past_talos.sql`. Os testes persistem pessoa sem vínculo de equipe,
  participante, duas atividades em países diferentes e instituição catalogada
  ou livre, sem criar qualquer dado financeiro.

- [x] **CG-013 — Criar schema da prestação de contas**

  Criar `prestacao_contas_missao`, no máximo uma por missão, com status, envio,
  validação, parecer e observações.

  Criar `despesa_missao` com:

  - tipo;
  - participante relacionado;
  - exercício;
  - quantidade;
  - valor unitário;
  - valor total;
  - data do documento;
  - descrição e observações.

  Prever especializações ou dados complementares, sem uma tabela única cheia de
  colunas nulas, para:

  - passagem: empresa, trecho, voo, compra e pagamento;
  - cotação de passagem e seu documento;
  - diária: beneficiário, período, quantidade, país e cidade;
  - outras despesas homologadas na CG-009.

  Regras:

  - exercício obrigatório em cada despesa;
  - valores não negativos;
  - validar quantidade x valor unitário quando ambos existirem;
  - totais sempre calculados;
  - permitir que a prestação ainda não exista.

  A estimativa apresentada antes da aprovação, se confirmada, não é despesa da
  prestação e deve permanecer separada.

  Dependências: CG-006, CG-009, CG-010 e CG-012.

  Critério de aceite: passagens, cotações, diárias e despesas homologadas podem
  ser registradas separadamente por beneficiário e exercício, e seus totais são
  derivados sem `number`.

  Concluída em 2026-09-02 em
  [database/schema/prestacao.ts](../apps/api/src/database/schema/prestacao.ts),
  migration `0024_prestacao_contas_missao.sql`. Cinco tabelas: prestação,
  despesa e as especializações de passagem, cotação e diária.

  **`NAO_INICIADA` não virou estado do enum.** A ausência de prestação é a
  ausência da linha. Guardá-la obrigaria a criar uma prestação vazia para toda
  missão cadastrada, e a lista teria de distinguir a vazia da que ninguém
  começou — a mesma coisa dita duas vezes. O vocabulário que a API e a interface
  já usavam (`NAO_INICIADA`, `EM_PREENCHIMENTO`, `ENVIADA`, `COM_PENDENCIA`,
  `VALIDADA`) foi preservado; só os quatro últimos são valores gravados.

  **As especializações são tabelas 1:1, não colunas nulas.** `despesa_passagem` e
  `despesa_diaria` têm o próprio `despesa_id` como chave primária — chave nova
  criaria um segundo jeito de endereçar a mesma linha. `cotacao_passagem` é N por
  passagem.

  **Beneficiário e quantidade não se repetem na diária.** O beneficiário é o
  `participante_id` da despesa e a quantidade é a `quantidade` dela; `quantidade`
  e `valor_unitario` são genéricos justamente para servir a "5 diárias × R$ 600"
  e a "1 passagem × R$ 4.200". Repetir criaria campos concorrentes — o erro que a
  CG-018 evitou em missão, atividade e participante.

  **`valor_total` é gravado e é o autoritativo**, não o produto: nota fiscal
  arredonda e taxa entra fora da multiplicação. A coerência é exigida por `check`
  apenas quando quantidade e unitário existem, então despesa avulsa continua
  válida informando só o total. O que **não** é persistido é o total da
  prestação: ele é somado em `numeric` no próprio Postgres, sem passar por
  ponto flutuante.

  Outras garantias no banco: exercício obrigatório e entre 2000 e 2100; valores
  não negativos; período da diária não invertido; estado e evidência coerentes
  (não há "enviada" sem data de envio, nem "validada" sem data de validação);
  uma prestação por missão; apagar a prestação leva despesas e especializações
  junto; e **participante com despesa lançada não pode ser apagado** (`restrict`),
  porque isso apagaria dinheiro já prestado.

  A estimativa anterior à aprovação **não** entra em `despesa_missao`: ela
  pertence ao fluxo de aprovação e misturá-las faria o total contar dinheiro que
  ninguém gastou.

  Fora de escopo aqui, de propósito: os tipos de despesa além de passagem e
  diária ficam em `OUTRA` com descrição até a **CG-009** homologar a lista —
  inventar agora os que "provavelmente" serão aprovados criaria valores de enum
  que a homologação teria de desfazer. O documento da cotação usa a tabela
  genérica `anexo`; o modelo documental com categoria, hash e versão é a
  **CG-014**. Reduzir saldo oficial de orçamento é a **CG-055**.

  A migration foi aplicada sobre a base de desenvolvimento já semeada e os
  aportes da P17 permaneceram intactos (R$ 1.525.332,00). Cobertura: 12
  integrações novas em `schema.int-spec.ts`; resultado geral **44 unitários da
  API, 54 regressões da web e 215 integrações aprovados**.

  A primeira coisa que a CG-050 deve fazer é trocar o
  `'NAO_INICIADA'::text` fixo de `missoes-comite.service.ts` por um `left join`
  nesta tabela — o contrato da lista já foi desenhado para não mudar de formato.

- [x] **CG-014 — Definir o modelo documental e o armazenamento**

  Avaliar a evolução da tabela genérica `anexo` para suportar:

  - categoria do documento;
  - chave segura no armazenamento;
  - hash de integridade;
  - versão;
  - visibilidade;
  - usuário que anexou;
  - vínculo com missão, submissão, decisão, despesa, prestação, produto,
    convênio ou evidência;
  - categoria e legenda;
  - data e local da evidência;
  - associação aos documentos analisados em cada parecer.

  Definir também armazenamento em desenvolvimento e produção, tamanho máximo,
  backup e política de retenção.

  Dependências: CG-004 e CG-009.

  Critério de aceite: decisão documentada antes de implementar upload.

  Concluída em 2026-09-02: a decisão está em
  [modelo-documental.md](modelo-documental.md), escrita **antes** de qualquer
  linha de upload, como o critério exige.

  As escolhas que valem registro aqui:

  - **`anexo` evolui, não nasce uma segunda tabela.** Uma tabela paralela
    obrigaria toda consulta a perguntar em dois lugares e a conciliação de
    parceiros (CG-025) a transferir as duas. O custo aceito é `entidade_id` sem
    chave estrangeira — preço do polimorfismo, mitigado com `entidade_tipo`
    fechado e verificação no serviço;
  - **as categorias vêm do documento da equipe** (§15, §27, §28) em uma coluna
    só. Três colunas exigiriam saber de antemão qual ler, e o que distingue foto
    de evidência já é a própria categoria;
  - **"documentos analisados" (§19) é tabela de ligação, não vínculo direto.** Se
    o documento apontasse para a decisão, anexar um arquivo novo depois mudaria
    retroativamente o que o parecer diz ter analisado;
  - **substituir cria versão nova e preserva a anterior.** O §19 proíbe apagar
    do histórico, e a CG-057 exige preservar a versão anterior: se o arquivo que
    o Comitê analisou pudesse ser sobrescrito, o parecer citaria um documento que
    ninguém mais vê. Não há exclusão, só inativação;
  - **nada é servido por URL estática.** Todo download passa por endpoint
    autenticado, e a chave de armazenamento é opaca — nome de arquivo enviado
    pelo usuário vira caminho previsível e vaza nome de bolsista ou número de
    processo. Validação por **conteúdo**, não por extensão;
  - **formatos** conforme a §15 homologada na CG-009; **25 MB** por arquivo, que
    acomoda PDF digitalizado e foto de celular sem virar depósito de vídeo.

  Três pontos ficaram **propostos e não decididos**, por serem institucionais e
  não técnicos: retenção após o encerramento (proposta: guarda permanente
  enquanto o ciclo existir), política de backup (depende da infraestrutura da
  UEA) e classificação de visibilidade (proposta: `INTERNA` e `RESTRITA`, sem a
  qual a exigência da CG-057 de "não expor arquivo privado" não tem como ser
  cumprida). A CG-051 implementa a proposta e o campo fica pronto para a regra
  definitiva.

- [x] **CG-015 — Gerar e verificar migrations**

  - gerar migration Drizzle;
  - aplicar em banco vazio;
  - aplicar sobre banco com a seed atual;
  - confirmar que os aportes da P17 não mudaram;
  - confirmar rollback lógico por migration corretiva, se necessário.

  Dependências: CG-011, CG-012 e CG-013.

  Critério de aceite: migration aceita pelo teste de integração e pela seed.

  Progresso em 2026-08-31: as migrations `0013_smooth_moondragon.sql`,
  `0014_past_talos.sql` e `0015_stormy_dracula.sql` (colunas de atividade não
  prevista, CG-035) foram aplicadas no banco de desenvolvimento e validadas pela
  suíte de integração, incluindo o teste de aceite da seed — os aportes da P17
  não mudaram. Falta a migration da prestação da CG-013 para concluir a task
  inteira.

  Em 2026-09-01, a migration `0016_carrega_paises_iso.sql` passou a carregar o
  catálogo ISO usado pelo roteiro e a seed foi ajustada para reproduzi-lo em um
  banco limpo. A suíte de integração permaneceu aprovada com 171 testes.

  Ainda em 2026-09-01, `0017_membros_comites_formalizados.sql` acrescentou a
  classificação `SERVIDOR` e a associação entre vínculo e rede; a carga
  idempotente `0018_carrega_membros_comites.sql` atualiza uma base existente.
  Ambas passaram em banco vazio e na suíte com 173 testes. A prestação da
  CG-013 continua sendo o item que impede concluir a task inteira.

  Em 2026-09-02, `0020_parceiros_contatos.sql` evoluiu instituições e criou a
  fundação N:N de parceiros, redes e contatos. Foi aplicada sobre a seed atual,
  com backfill das quatro instituições existentes, e validada pela suíte com
  185 integrações. A prestação da CG-013 continua sendo o item pendente.

  Ainda em 2026-09-02, `0021_amplia_missao_evento_participante.sql` ampliou o
  contrato da missão e fez backfill do período dos participantes com as datas
  integrais da missão — a única semântica que o modelo anterior representava.
  Foi aplicada sobre o banco atual e validada pela suíte com 192 integrações.
  A prestação da CG-013 continua sendo o item pendente.

  A migration `0022_parceiros_conciliacao.sql` acrescentou a referência da
  instituição substituída para sua canônica, foi aplicada sobre o banco atual e
  validada com 196 integrações. A prestação da CG-013 continua sendo o item
  pendente para concluir esta task.

  A migration `0023_contatos_parceiros_identidade.sql` acrescentou a identidade
  normalizada de e-mail. O backfill escolhe somente um canônico em cada grupo
  legado e deixa duplicados anteriores para conciliação humana, sem apagar ou
  unir contatos silenciosamente. Foi aplicada sobre o banco atual e validada
  com 200 integrações. A prestação da CG-013 continua pendente.

  Concluída em 2026-09-02, com a `0024_prestacao_contas_missao.sql` — o item que
  faltava. Os cinco pontos do checklist foram verificados:

  - **gerar migration Drizzle**: 25 migrations no repositório;
  - **aplicar sobre a seed atual**: aplicada no banco de desenvolvimento já
    carregado, sem perda;
  - **aportes da P17 não mudaram**: R$ 1.525.332,00 antes e depois;
  - **aplicar em banco vazio**: este era o único ainda não comprovado. A suíte
    de integração roda contra um banco persistente, então ela prova aplicação
    **incremental**, não do zero. Foi criado um banco limpo, as 25 migrations
    rodaram desde o nada (40 tabelas) e a seed foi carregada nele. Os
    indicadores saíram idênticos aos do banco de desenvolvimento — aportes,
    24 PPGs, 60 itens de catálogo, 23 linhas de plano e 48 orçamentos. O banco
    temporário foi removido em seguida;
  - **rollback lógico por migration corretiva**: não foi necessário, nenhuma
    migration precisou ser corrigida.

  Critério de aceite atendido nas duas pontas: `seed-aceite.int-spec.ts` continua
  aprovado dentro das **215 integrações**.

- [x] **CG-016 — Associar missões às redes**

  Criar a estrutura homologada na CG-007, preferencialmente uma associação
  muitos-para-muitos, com:

  - missão;
  - rede;
  - indicação de rede principal, somente se necessária;
  - unicidade da associação;
  - índices para lista e dashboard;
  - auditoria das alterações.

  Migrar missões existentes com regra explícita; não inferir definitivamente a
  rede apenas pela instituição visitada ou pelo participante.

  Dependências: CG-006 e CG-007.

  Critério de aceite: toda nova missão possui o vínculo exigido e uma missão
  multirrede aparece uma única vez em “Todas”, sem duplicar indicadores.

  Concluída em 2026-09-01, sobre a matriz entidade–rede proposta na CG-007
  (`missao_rede` N:N, mínimo uma rede). Decisões que valem registrar:

  - **Não há coluna de rede principal.** Nenhuma regra atual precisa eleger uma,
    e a contagem oficial já resolve o duplo pertencimento contando a missão uma
    única vez. Se a governança passar a exigir um responsável único, ele entra
    como coluna nova, sem remodelar a associação.
  - **A rede pertence a um ciclo**, então o serviço exige que rede e missão
    sejam do mesmo ciclo. A chave estrangeira sozinha aceitaria a UFMG de
    2031–2034 em uma missão de 2027–2030: dois registros válidos que juntos não
    fazem sentido.
  - **Filtro e leitura usam `exists` e subconsulta, nunca `join`.** É o que
    garante o critério de aceite: a missão multirrede aparece uma vez na lista e
    conta uma vez no resumo.
  - **Auditoria é uma entrada por rede**, não um diff de lista em um registro só,
    para o histórico responder “quando a UNESP entrou nesta missão”.
  - **Trocar a rede de missão confirmada exige justificativa**, junto de datas,
    participantes e roteiro: muda de quem é o compromisso e para qual painel ela
    passa a contar.
  - **Missões anteriores ficam sem rede, de propósito** — a task proíbe inferir
    pela instituição visitada ou pelo participante. A regra explícita, registrada
    no cabeçalho da migration `0019_flippant_roulette.sql`: leitura tolera e a
    interface mostra “Sem rede definida”; criação e edição passam a exigir pelo
    menos uma, de modo que a regularização aconteça na primeira edição, com
    autoria e auditoria. No banco de desenvolvimento não havia nenhuma missão.

  Arquivos: `database/schema/comite-gestor.ts`, `migrations/0019_flippant_roulette.sql`,
  `dominio/missoes-comite.service.ts`, `dominio/programas.controller.ts`,
  `lib/dominio.ts`, `lib/formularios/missao-comite.ts`, `ui/campos.tsx`
  (componente `Selecoes`), `formularios/form-missao-comite.tsx` e a aba Missões
  da P17 (filtro de rede e coluna).

  Cobertura: 6 integrações novas (multirrede ordenada, mínimo e duplicidade,
  rede de outro ciclo com transação desfeita, aparição única em “todas” com
  filtro por rede, auditoria por rede incluída/removida, justificativa
  obrigatória em missão confirmada) — suíte com **181 aprovados**. Duas
  regressões novas na web e duas asserções novas no `smoke:telas`. Verificado
  ponta a ponta com uma missão UFMG+UNICAMP real: uma linha na lista, “UFMG ·
  UNICAMP” na coluna, `Missões · 1` no recorte e vazio correto ao filtrar UNESP.

- [x] **CG-017 — Modelar parceiros, redes e contatos**

  Evoluir `instituicao` e criar associações para suportar:

  - dados institucionais completos;
  - várias redes relacionadas;
  - vários contatos;
  - contato principal por instituição;
  - cargo, departamento, área, idioma e canais de contato;
  - situação ativa/inativa;
  - metadados e auditoria.

  Definir regra de deduplicação e conciliação para nomes equivalentes. Dados de
  contato devem seguir as decisões de privacidade da CG-005/CG-009.

  Dependências: CG-005, CG-007 e decisão D-13 da revisão.

  Critério de aceite: instituição canônica pode servir a várias redes e seus
  contatos são reutilizados por missões sem cópia de dados.

  Concluída em 2026-09-02. A migration `0020_parceiros_contatos.sql`:

  - ampliou `instituicao` com estado/região, tipo de organização,
    faculdade/departamento, e-mail institucional, telefone, endereço,
    observações e marcador de cadastro provisório;
  - criou `instituicao_rede` N:N, com unicidade da associação;
  - criou `contato_instituicao` como fonte reutilizável, com cargo,
    departamento, área, e-mail, telefone, país, idioma, situação e observações;
  - garante no banco no máximo um contato principal ativo por instituição;
  - adicionou `nome_normalizado` às instituições e aos contatos. A função
    compartilhada elimina apenas variações inequívocas de caixa, acento,
    pontuação e espaços. A instituição tem chave única; siglas, traduções e
    homônimos de contatos continuam candidatos à conciliação humana nas
    CG-025/CG-026;
  - preserva metadados de criação/atualização. A trilha de eventos de criação,
    edição, inativação e fusão de instituições entra na API CG-025; a gestão
    individual dos contatos e sua auditoria minimizada entram na CG-026.

  A migration foi aplicada com sucesso no banco de desenvolvimento já semeado:
  UEA, UFMG, UNESP e UNICAMP receberam as chaves normalizadas. Cobertura: 3
  testes unitários da normalização e 4 integrações de multirrede, deduplicação,
  associação única e contato principal; resultado geral **36 unitários da API
  e 185 integrações aprovados**. A API posterior da CG-026 expõe dados pessoais
  somente ao `admin`; a missão continua referenciando o `id` central em vez de
  copiar seus dados.

  Arquivos: `database/schema/institucional.ts`,
  `database/schema/parceiros.ts`, `database/normalizacao.ts`, migration
  `0020_parceiros_contatos.sql`, seed e testes de schema.

- [x] **CG-018 — Ampliar identificação, destino, evento e participantes**

  Acrescentar ao modelo, conforme homologação:

  - responsável único ou regra equivalente;
  - unidade/departamento e tipo da missão;
  - região, local e endereço do destino;
  - dados completos do evento e relação com internacionalização;
  - cargo, área e período individual do participante;
  - cálculo de número de dias, sem persistir derivado desnecessário.

  Decidir em CG-005/D-10 se evento será entidade reutilizável ou continuará
  como atividade da missão.

  Dependências: CG-005 a CG-007 e CG-016.

  Critério de aceite: o cadastro representa as seções 10 a 14 do documento sem
  duplicar período, instituição ou rede em campos concorrentes.

  Concluída em 2026-09-02. Decisões implementadas:

  - o responsável continua em `missao_participante`, com papel `RESPONSAVEL`;
    a API exige exatamente um e o banco impede mais de um. Não existe uma
    segunda FK concorrente em `missao_comite`;
  - `missao_comite` recebeu tipo geral e unidade/departamento. Permanecem
    opcionais para que missões anteriores e o formulário do escopo antigo
    continuem válidos; o contrato da API já aceita e devolve ambos;
  - participante recebeu cargo, área e período individual. Quando o cliente
    antigo omite o período, a API grava saída e retorno da missão, explicitando
    a semântica anterior de participação integral;
  - atividade recebeu estado/região, local e endereço. Datas continuam sendo
    as da própria atividade, sem criar um segundo período de “destino”;
  - evento permanece atividade no MVP (D-10). Nome, tipo, site, objetivo da
    participação e relação com a internacionalização foram acrescentados;
    instituição organizadora reutiliza `instituicaoId|instituicaoNome`, datas
    reutilizam o período da atividade e redes são herdadas da missão;
  - a relação com parceiro usa a instituição central da atividade, contato por
    id, tipo de relacionamento e objetivo. A API confirma que o contato está
    ativo e pertence à instituição, sem copiar dados pessoais;
  - número de dias é calculado de forma inclusiva e em UTC para missão,
    atividade e participante; nenhuma coluna derivada foi persistida.

  A migration `0021_amplia_missao_evento_participante.sql` foi aplicada na base
  atual. O backfill atribui aos participantes antigos o período completo da
  missão, sem inferir períodos parciais. Cobertura nova: 3 testes unitários de
  dias civis, regras de schema/API para responsável, evento e período, duas
  regressões de formulário e integrações de constraints, contrato completo,
  contato–instituição e transferência transacional do responsável. Resultado:
  **39 unitários da API, 21 regressões da web e 192 integrações aprovados**.

  A interface de cadastro ainda não exibe os novos campos; ela continua
  funcional pelo fallback de compatibilidade. A inclusão visual deve ocorrer
  junto da evolução do formulário/detalhe, depois das decisões institucionais,
  sem alterar novamente o modelo desta task.

  Arquivos: `database/schema/comite-gestor.ts`, migration
  `0021_amplia_missao_evento_participante.sql`, `comum/datas.ts`,
  `dominio/missoes-comite.service.ts`, schemas de formulário e testes.

- [x] **CG-019 — Criar schema de submissão e decisões do Comitê**

  Criar estruturas para:

  - submissão e rodadas de análise;
  - decisão `APROVAR | SOLICITAR_AJUSTES | REPROVAR`;
  - parecer e observações;
  - autor e instante da decisão;
  - documentos analisados;
  - histórico imutável;
  - reabertura administrativa auditada.

  A auditoria genérica permanece, mas não substitui o registro de negócio da
  decisão.

  Dependências: CG-006, CG-008, CG-009 e CG-014.

  Critério de aceite: todas as rodadas e pareceres sobrevivem a novos envios e
  nenhuma decisão anterior é sobrescrita ou apagada.

  **Concluída em 2026-09-05**, logo após o aceite do modelo B. Entrou
  [aprovacao.ts](../apps/api/src/database/schema/aprovacao.ts) com quatro
  tabelas, mais a coluna `status_aprovacao` em `missao_comite` e a migration
  `0028_submissao_decisoes_comite`.

  **A aprovação é dimensão própria, não valor novo em `status_missao_comite`.**
  As duas se cruzam — a missão aprovada pode estar planejada, confirmada ou
  concluída —, e uma coluna única precisaria de um valor para cada combinação.

  As garantias ficaram no banco, e não no serviço que ainda será escrito:

  - `rodada_analise_aberta_uk` é índice **parcial**: no máximo uma rodada aberta
    por missão. Dois cliques em "enviar para análise" colocariam a missão duas
    vezes na fila do Comitê, e nada diria qual delas a decisão encerra —
    checagem em aplicação perde essa corrida, o índice não.
  - `decisao_comite_rodada_uk` garante uma decisão por rodada; duas seriam dois
    estados finais para o mesmo exame.
  - `decisao_comite_reuniao_ck` exige a data da reunião em `APROVAR` e
    `REPROVAR` e a proíbe em `SOLICITAR_AJUSTES` — devolver para ajuste é ato do
    relator, não deliberação do colegiado. **A data é informada, nunca
    derivada:** as reuniões são semanais, mas há semanas sem reunião, e um
    calendário calculado registraria deliberação que não houve.
  - `rodada_analise_justificativa_ck` exige justificativa na reabertura e a
    proíbe na submissão.
  - `decisao_documento` tem `on delete restrict` para o anexo: um parecer não
    pode perder a referência do que examinou.

  **Os requisitos documentais são dados, não constantes** — `requisito_submissao`
  por ciclo, tipo de missão (nulo = todos) e momento. É a decisão de 2026-09-05:
  fechar a lista no código atenderia hoje e impediria o primeiro tipo novo de
  missão. A seed carrega cinco linhas: projeto e justificativa obrigatórios;
  convite, programação e orçamento recomendados. `momento = 'ENCERRAMENTO'`
  existe para a CG-058 e ainda não é consultado.

  Dois achados durante a implementação:

  - **O índice `coalesce(tipo_missao::text, '*')` não compila:** o cast de enum
    para texto não é `IMMUTABLE` e o Postgres recusa a expressão. Foram usados
    dois índices parciais (`_geral_uk` e `_tipo_uk`), que cobrem os mesmos casos
    sem função — inclusive o caso que motivou a normalização, já que dois NULL
    não colidem em Postgres.
  - **`encerrada_em` montado com `new Date()` no cliente dispara o check**,
    porque `submetido_em` usa o `now()` do banco. É o check funcionando; os
    testes passaram a informar o par de datas.

  Cobertura: 15 regressões em
  [aprovacao.int-spec.ts](../apps/api/test/aprovacao.int-spec.ts), incluindo o
  vaivém completo (enviar → ajustes → reenviar → aprovar → reabrir → reprovar),
  que confirma que a aprovação do meio permanece no histórico. As asserções usam
  `esperarViolacao`, que confere o **nome da constraint** — casar a mensagem do
  Drizzle aprovaria o teste por qualquer falha, inclusive por erro de digitação
  no próprio teste.

  **Ainda não aplicável: "somente o responsável pela missão envia".** A regra
  depende de ligar o `sub` do Keycloak a um registro de `pessoa`, que não
  existe (`AGENTS.md` §9). A coluna `submetido_por_pessoa_id` já está gravada
  para que a verificação entre sem migração; até lá quem submete é `admin`.
  Isso é pré-requisito da CG-037, não desta task.

### Épico 2 — Pessoas e equipes na API

- [x] **CG-020 — Adicionar permissões provisórias**

  Sugestão inicial:

  - `equipe-gestao:read`;
  - `equipe-gestao:write`;
  - `missao:read`;
  - `missao:write`;
  - `missao:edit`;
  - `prestacao:read`;
  - `prestacao:write`;
  - `prestacao:review`.

  Conceder todas somente a `admin` até a conclusão da CG-003.

  A proteção deve incluir a leitura da área renovada, não apenas seus botões de
  escrita. Ao refatorar a P17, revisar a permissão do endpoint de orçamento que
  hoje usa a permissão genérica `orcamento:read`.

  Dependência: CG-002.

  Critério de aceite: testes de `permissionsForRoles` comprovam que nenhum
  outro papel recebeu acesso novo.

  Concluída em 2026-08-31. As oito permissões foram adicionadas exclusivamente
  a `admin`; o item de menu é ocultado dos demais perfis e a página apresenta
  um estado de acesso restrito se for aberta diretamente.

- [x] **CG-021 — Criar busca e cadastro reutilizável de pessoas**

  - pesquisar por nome, e-mail ou CPF;
  - reutilizar pessoa existente;
  - permitir cadastro rápido quando não houver resultado;
  - aplicar as validações já existentes de e-mail e CPF;
  - devolver a pessoa criada ao fluxo da missão sem perder o formulário.

  Dependência: CG-020.

  Critério de aceite: pessoa criada em uma missão aparece na busca de uma missão
  posterior e não é duplicada por CPF ou e-mail.

  Concluída em 2026-08-31 para uso por equipes: `GET/POST /pessoas`, busca por
  nome/e-mail/CPF, cadastro dentro da transação do vínculo e trava de duplicidade
  por CPF ou e-mail. O formulário passou a preservar os valores em erros de
  validação; o mesmo contrato será reutilizado no formulário de missão.

- [x] **CG-022 — Listar equipes**

  Endpoint por programa e ciclo, separando Comitê Gestor e Administração e
  retornando pessoa, instituição, PPG, função, vigência, situação e quantidade
  de missões.

  Dependências: CG-011 e CG-020.

  Critério de aceite: vínculos encerrados são identificados e preservados.

  Progresso em 2026-08-31: listagem separada, dados institucionais, vigência e
  situação calculada estão implementados. A quantidade de missões por membro
  depende da CG-012 e permanece pendente.

  Concluída em 2026-09-01 com a contagem de missões, que era o item que faltava.
  A contagem é **por pessoa e por ciclo**, não por vínculo: `missao_participante`
  aceita participante sem `membro_equipe_id` — quem viaja sem integrar equipe —
  e contar pelo vínculo perderia justamente essas participações. Quem está nas
  duas equipes vê o mesmo número nas duas linhas, que é a resposta correta para
  “de quantas missões esta pessoa participou”. Missão de outro ciclo não conta.
  Arquivos: `dominio/comite-gestor.service.ts`, `lib/dominio.ts` e a aba Equipes
  da P17. Cobertura: duas integrações novas em `test/comite-gestor.int-spec.ts`
  (contagem por pessoa com participação sem vínculo, e isolamento entre ciclos),
  suíte com 175 aprovados.

- [x] **CG-023 — Cadastrar, editar e encerrar membro de equipe**

  - validar payload com Zod;
  - escolher pessoa existente ou usar o cadastro reutilizável;
  - validar duplicidade e vigência;
  - encerrar sem exclusão física;
  - auditar criação e alteração.

  Dependências: CG-021 e CG-022.

  Critério de aceite: histórico da composição das equipes é preservado.

  Concluída em 2026-08-31, com validação Zod, transação para pessoa nova,
  detecção de períodos sobrepostos e auditoria por campo na edição.

- [x] **CG-024 — Testar pessoas e equipes**

  Cobrir permissões, duplicidade, CPF/e-mail, períodos inválidos, participação
  nas duas equipes, participante externo às equipes e encerramento de vínculo.

  Dependências: CG-021 a CG-023.

  Concluída em 2026-08-31: schemas unitários, constraints de banco e quatro
  fluxos integrados do serviço. Resultado geral: 32 testes unitários da API e
  118 testes de integração aprovados após a inclusão do schema de missões; a
  web também cobre a preservação dos campos em erros de validação.

- [x] **CG-025 — Implementar cadastro e deduplicação de parceiros**

  Criar API para listar, buscar, cadastrar, editar e inativar instituições
  parceiras, incluindo associações com redes. A criação deve:

  - normalizar a chave de comparação;
  - procurar possíveis equivalências;
  - impedir duplicidade inequívoca;
  - permitir conciliação administrativa sem perder relacionamentos;
  - auditar criação, edição, inativação e fusão.

  Dependências: CG-017 e CG-020.

  Critério de aceite: a mesma instituição é reutilizada por várias missões e
  redes, e uma conciliação preserva histórico, contatos e documentos.

  Concluída em 2026-09-02. A API `/parceiros` lista, pesquisa e filtra por rede,
  detalha, cadastra, edita e inativa sem apagar referências. A consulta de
  candidatos e a própria criação comparam nome normalizado, sigla, domínio do
  site, domínio do e-mail institucional e nomes semelhantes. Nome normalizado
  igual é bloqueio inequívoco; candidato apenas possível exige confirmação
  explícita do `admin`.

  A conciliação é transacional: a origem fica inativa e aponta por
  `substituida_por_id` para o cadastro canônico; redes, contatos, atividades de
  missão, pessoas e documentos institucionais são transferidos. Quando os dois
  cadastros têm contato principal, o principal do destino prevalece para não
  violar a regra de unicidade. Nenhum registro de origem ou auditoria é apagado.
  Criação, edição, redes, inativação e fusão possuem trilha em
  `registro_auditoria`.

  As permissões `parceiro:read|write` foram acrescentadas somente ao `admin`,
  preservando a matriz provisória. A migration
  `0022_parceiros_conciliacao.sql` foi aplicada sobre a base existente. Cobertura:
  2 testes unitários dos schemas e 4 fluxos integrados de busca, deduplicação,
  edição/inativação e fusão; resultado geral **41 unitários da API, 21
  regressões da web e 196 integrações aprovados**. A interface permanece na
  CG-049 e os dados pessoais dos contatos não foram expostos.

- [x] **CG-026 — Implementar contatos dos parceiros**

  Criar API para listar, cadastrar, editar e inativar contatos, definir o
  contato principal e pesquisar por nome, instituição ou e-mail.

  Regras:

  - evitar duplicidade por instituição e identidade disponível;
  - não apagar contato já citado por missão;
  - auditar mudanças;
  - aplicar autorização e visibilidade aos dados pessoais.

  Dependências: CG-017, CG-020 e decisões de privacidade.

  Critério de aceite: contato pode ser selecionado em várias missões sem copiar
  seus dados para cada uma.

  Concluída em 2026-09-02. A API `/contatos-parceiros` lista com busca por nome,
  e-mail e instituição, filtra por parceiro e por situação, detalha, cadastra,
  edita, define o principal, inativa e reativa. Não existe endpoint de exclusão:
  a atividade de missão referencia o `id` central, então a saída de operação é a
  inativação, e o teste comprova que a missão continua enxergando o contato
  inativado.

  A deduplicação é por instituição, não global — a mesma pessoa pode ser contato
  de mais de um parceiro. E-mail normalizado igual, ou nome normalizado e
  telefone iguais, é duplicidade **inequívoca** e resulta em `409`. Nome, e-mail
  ou telefone coincidindo isoladamente é apenas **possível**: a resposta devolve
  os candidatos com o motivo e exige `confirmarPossivelDuplicidade`, porque
  homônimo dentro de uma mesma instituição é real e não pode ser bloqueado. O
  índice único parcial `contato_instituicao_email_uk` fecha a corrida entre duas
  requisições simultâneas, e o erro do banco é traduzido para a mesma mensagem
  de conflito.

  A troca do contato principal é atômica: `desmarcarPrincipal` roda na mesma
  transação da promoção, de modo que o índice
  `contato_instituicao_principal_ativo_uk` nunca vê dois principais. Inativar o
  principal também o despromove, e reativar nunca devolve a condição de
  principal automaticamente — assim como reativar contato de parceiro inativo é
  recusado.

  **A auditoria é minimizada de propósito.** Nenhuma trilha guarda nome, e-mail,
  telefone ou qualquer valor pessoal: a criação grava apenas a instituição, o
  atributo `principal` e a lista de *nomes* dos campos informados; a edição
  grava a lista de campos alterados com `valorAnterior`/`valorNovo` nulos. Só
  atributos não sensíveis (`ativo`, `principal`) registram valores de fato. É a
  diferença em relação à auditoria por campo do plano e do orçamento, e é
  deliberada: `registro_auditoria` não é lugar de dado pessoal.

  As permissões reutilizam `parceiro:read|write`, exclusivas do `admin` na
  matriz provisória. A migration `0023_contatos_parceiros_identidade.sql`
  acrescenta `email_normalizado`, seu `check` de coerência e o índice único; ela
  elege um registro canônico por grupo de e-mails repetidos e **não funde nem
  apaga** os demais, deixando a conciliação para decisão humana. Foi aplicada na
  base de desenvolvimento já semeada.

  Cobertura: 3 testes unitários dos schemas e 4 fluxos integrados de
  cadastro/busca/edição, identidade inequívoca contra homônimo, principal único
  e inativação/reativação sem romper a missão; resultado geral **44 unitários da
  API, 21 regressões da web e 200 integrações aprovados**. A interface dos
  contatos permanece na CG-049 e a visibilidade por rede, na CG-028.

- [x] **CG-027 — Construir histórico consolidado do parceiro**

  Consultar, sem agregados persistidos:

  - redes;
  - contatos;
  - missões e atividades;
  - eventos;
  - produtos;
  - convênios;
  - documentos cuja permissão permita exibição.

  Dependências: CG-025, CG-026, CG-056 e CG-057. O endpoint pode nascer parcial
  e ampliar o contrato sem inventar totais para módulos ainda inexistentes.

  Critério de aceite: abrir um parceiro apresenta uma linha histórica única,
  sem duplicar missão multirrede.

  Concluída em 2026-09-02 no `GET /parceiros/:id/historico`. Nasceu parcial, como
  a própria task autoriza: entrega parceiro com suas redes, contatos, missões
  com atividades, eventos e documentos. Nada é persistido — cada seção é lida na
  hora do que os outros módulos gravaram.

  **A não duplicação tem dois caminhos, e ambos estão cobertos.** A missão entra
  por `exists` sobre `atividade_missao` e é resolvida com `selectDistinct` sobre
  a própria missão, nunca por `join` com atividade ou com `missao_rede`: sem
  isso, a missão de duas redes apareceria duas vezes, e a missão que visita o
  mesmo parceiro em duas paradas do roteiro também. Redes e atividades voltam em
  consultas próprias e são agrupadas em memória. O teste monta exatamente esse
  caso — missão de duas redes com duas atividades no mesmo parceiro — e exige
  uma única linha.

  Produtos e convênios **não** aparecem como total zero: `modulosPendentes` os
  nomeia apontando para a CG-056, porque zero afirmaria que nada aconteceu
  quando a verdade é que ainda não existe onde registrar. Quando a CG-056 e a
  CG-057 chegarem, acrescentam sua seção e saem dessa lista, sem quebrar o
  contrato.

  Evento continua sendo projeção das atividades que nomeiam um (D-10), não uma
  entidade separada. Documentos leem `anexo` em `INSTITUICAO`/`PARCEIRO`, o
  mesmo par que a conciliação da CG-025 transfere; a filtragem por permissão de
  documento ainda não existe, e hoje o endpoint inteiro é `parceiro:read`, ou
  seja, exclusivo do `admin` — a visibilidade por rede é a CG-028, e a política
  de documentos, a CG-009.

  Cobertura: 2 integrações — linha histórica de missão multirrede com duas
  paradas, e isolamento entre parceiros vizinhos (missão e documento de um não
  vazam para o outro); resultado geral **44 unitários da API, 21 regressões da
  web e 202 integrações aprovados**. Não houve migration: o histórico é
  leitura. A interface permanece na CG-049.

- [ ] **CG-028 — Aplicar autorização com escopo por rede e missão**

  Implementar a matriz aprovada na CG-003/CG-007:

  - Administrador com escopo global;
  - Gestor da Rede limitado às redes vinculadas;
  - Comitê Gestor com leitura e análise nas três redes;
  - Participante limitado às missões autorizadas;
  - vínculo seguro entre `sub` do Keycloak e `pessoa` local.

  A API deve filtrar consultas e validar cada mutação; ocultar menu não é
  autorização.

  Dependências: CG-003, CG-007, CG-016 e decisão de provisionamento de pessoa.

  Critério de aceite: testes provam ausência de leitura e escrita entre redes,
  inclusive por ID adulterado.

- [~] **CG-029 — Testar parceiros, contatos e escopo**

  Cobrir deduplicação, conciliação, inativação, contato principal, histórico,
  missão multirrede e isolamento entre perfis/redes.

  Dependências: CG-025 a CG-028.

  Critério de aceite: integração usa PostgreSQL real e inclui tentativas de
  acesso horizontal indevido.

  Situação em 2026-09-02: **tudo o que não depende da CG-028 está coberto**, em
  PostgreSQL real. Deduplicação (instituição e contato), conciliação,
  inativação/reativação, contato principal único e a troca atômica, histórico e
  missão multirrede vieram junto com as CG-025 a CG-027 — 11 fluxos integrados
  nos dois `int-spec`. O `permissions.spec.ts` já prova que `parceiro:read` e
  `parceiro:write` pertencem só ao `admin` e a nenhum dos outros quatro papéis,
  que é o acesso **vertical**.

  A lacuna que a conciliação criava sozinha foi fechada aqui: origem e destino
  atuando na **mesma** missão, cada um com sua atividade. Depois de conciliar, o
  destino fica com duas atividades naquela missão, e a linha histórica tem que
  continuar sendo uma só. O teste também garante que a origem permanece
  consultável depois de conciliada — a interface linka para ela a partir do
  aviso de cadastro conciliado; o que ela perde é o vínculo, não o acesso.

  Os dois testes de não duplicação foram verificados por mutação: trocando o
  `exists` + `selectDistinct` por um `join` com atividade, ambos falham. Não
  passam por acidente.

  **Falta apenas o isolamento horizontal** — leitura e escrita entre redes,
  inclusive por ID adulterado. Isso não é adiamento: o escopo por rede não
  existe (CG-028), e hoje todo o módulo é exclusivo do `admin`, então não há
  fronteira horizontal para violar. O teste nasce junto com a regra.

  Resultado geral: **44 unitários da API, 35 regressões da web e 203
  integrações aprovados**.

### Épico 3 — Missões na API

- [x] **CG-030 — Criar missão transacionalmente**

  - gerar código de negócio;
  - gravar dados básicos, roteiro e participantes;
  - exigir período válido e pelo menos um participante;
  - aceitar vários países e atividades;
  - não criar prestação ou lançamento financeiro;
  - desfazer toda a operação se uma parte falhar.

  Dependências: CG-012, CG-020 e CG-021.

  Critério de aceite: falha em roteiro ou participante não deixa missão parcial.

  Concluída em 2026-08-31 em `dominio/missoes-comite.service.ts` e
  `POST /programas/:programa/:ciclo/comite-gestor/missoes`. O código `MCG-NNN` é
  gerado sob `pg_advisory_xact_lock` por ciclo, para que duas requisições
  simultâneas não escolham o mesmo número antes do índice único arbitrar. Pessoa
  nova, participantes e roteiro entram na mesma transação: o teste de país
  inexistente comprova que nem a missão, nem o participante, nem a pessoa criada
  no meio do caminho sobrevivem ao rollback. Resultado: 129 testes de integração
  e 32 unitários aprovados.

- [x] **CG-031 — Listar e filtrar missões**

  Implementar filtros combináveis por exercício, período, país, equipe,
  participante, situação administrativa, situação temporal e situação da
  prestação, com paginação e ordenação.

  Dependência: CG-030.

  Critério de aceite: busca encontra código, título, instituição e evento.

  Concluída em 2026-08-31 em `MissoesComiteService.listar` e
  `GET /programas/:programa/:ciclo/comite-gestor/missoes`. Todos os filtros são
  opcionais e combináveis; a busca alcança código, título, título da atividade,
  nome do evento e a instituição tanto do catálogo quanto em texto livre. O
  exercício considera a missão que **atravessa** o ano, não apenas a que começa
  nele. A situação temporal é derivada na consulta e o filtro por equipe casa
  pela pessoa, para que a missão continue sendo da equipe mesmo quando o
  participante não apontou o vínculo. A situação da prestação já existe como
  expressão única na consulta, respondendo `NAO_INICIADA` até a CG-013 — e o
  valor prestado vem nulo, nunca R$ 0,00. Resultado: 138 testes de integração.

- [x] **CG-032 — Consultar detalhe da missão**

  Retornar dados básicos, participantes, atividades, relato, prestação, totais,
  documentos e histórico.

  Dependência: CG-030.

  Critério de aceite: valores monetários são strings decimais e a ausência de
  prestação é explícita.

  Concluída em 2026-08-31 em `MissoesComiteService.detalhe` e
  `GET /programas/:programa/:ciclo/comite-gestor/missoes/:id`. Prestação e
  documentos ainda não existem no schema (CG-013/CG-014), mas o contrato já os
  declara explicitamente — `prestacao: null`, `documentos: []` e totais nulos —
  para que a tela de detalhe possa ser construída agora sem mudar de formato
  quando a prestação chegar. Nenhum total trafega como `number`. O roteiro sai
  na ordem cadastrada, a instituição é resolvida do catálogo ou do texto livre
  com a origem indicada, o vínculo de equipe só aparece quando foi informado e o
  histórico vem da auditoria da própria missão. Resultado: 143 testes de
  integração.

- [x] **CG-033 — Editar missão com auditoria**

  - editar rascunho e missão planejada;
  - exigir justificativa para mudanças sensíveis após confirmação;
  - auditar datas, participantes, países e atividades;
  - impedir alteração financeira pelo endpoint da missão.

  Dependência: CG-032.

  Critério de aceite: cada campo sensível alterado gera registro de auditoria.

  Concluída em 2026-08-31 em `MissoesComiteService.atualizar` e
  `PATCH /programas/:programa/:ciclo/comite-gestor/missoes/:id` (`missao:edit`).

  Três decisões que valem registrar:

  - **Participantes e atividades são reconciliados, não recriados.** Quem
    permanece mantém o mesmo id, porque a despesa da prestação vai apontar para
    o participante (CG-013); apagar e recriar a cada salvamento levaria a
    prestação junto.
  - **O payload é `strict()`.** É o que faz o endpoint *recusar* um campo
    financeiro em vez de ignorá-lo em silêncio. Código e status ficam de fora:
    código é imutável e o ciclo de vida tem endpoints próprios (CG-034).
  - **A renumeração do roteiro passa por uma faixa alta.**
    `atividade_missao_ordem_uk` é imediata, então promover a segunda parada a
    primeira colidia com a linha que ainda ocupava a posição 1. O teste de
    remoção encontrou a falha; o de inversão de ordem a mantém encontrada.

  Missão confirmada exige justificativa para data, participante ou roteiro — e
  não para título ou objetivo. Missão concluída ou cancelada não é editável.
  Resultado: 155 testes de integração.

- [x] **CG-034 — Implementar ciclo de vida da missão**

  - confirmar;
  - concluir;
  - cancelar;
  - reabrir somente como operação administrativa;
  - calcular situação temporal pelas datas.

  Dependência: CG-033.

  Critério de aceite: missão cancelada não conta como realizada nem afeta
  indicadores financeiros.

  Concluída em 2026-08-31. As transições ficam fora do endpoint de edição
  porque não são alteração de conteúdo: mudam o que a missão *é* perante a
  governança.

  - `POST .../missoes/:id/situacao` (`missao:write`) — CONFIRMAR, CONCLUIR e
    CANCELAR, cada uma com sua origem permitida. Cancelar exige justificativa:
    é a única saída que encerra a missão sem que ela tenha acontecido.
  - `POST .../missoes/:id/reabertura` (`missao:edit`) — devolve missão
    concluída ou cancelada a PLANEJADA. A permissão separada é o que registra,
    já no contrato, que reabrir é operação administrativa e não parte do fluxo
    normal; a justificativa é obrigatória.

  Toda transição grava auditoria do campo `status` com origem, destino e
  justificativa. A listagem passou a devolver um `resumo` com contagens por
  status e por situação temporal: ele responde ao escopo do filtro (busca,
  exercício, período, país, equipe, participante) mas não ao próprio status,
  que é a dimensão contada. É ali que a separação exigida pelo critério fica
  visível — **encerrada no tempo não é o mesmo que realizada**: uma missão
  cancelada cujas datas já passaram conta em `ENCERRADA` e nunca em
  `realizadas`, e não leva valor a indicador financeiro algum. Resultado: 163
  testes de integração.

- [x] **CG-035 — Registrar atividades realizadas e resultados**

  - atualizar o que aconteceu em cada visita ou evento;
  - registrar resultados e encaminhamentos;
  - permitir atividade realizada que não estava prevista, com justificativa;
  - exigir relato mínimo para concluir a missão.

  Dependência: CG-034.

  Critério de aceite: planejamento e realização continuam distinguíveis.

  Concluída em 2026-08-31 em `MissoesComiteService.relatar` e
  `PATCH .../missoes/:id/relato`. O relato é endpoint separado da edição de
  propósito: **editar muda o que se pretende fazer, relatar registra o que foi
  feito**, e o endpoint de relato não alcança nenhum campo de planejamento.

  A atividade não prevista virou coluna, não dedução. A migration
  `0015_stormy_dracula.sql` acrescentou `nao_prevista` e
  `justificativa_inclusao` a `atividade_missao`, com CHECK exigindo a
  justificativa. Inferir "não prevista" de `planejamento` estar vazio pareceria
  suficiente hoje e apagaria a distinção no primeiro relatório futuro. Ela entra
  ao final do roteiro, sem planejamento, marcada como `REALIZADA` — e é
  **invisível ao endpoint de edição**: a reconciliação da CG-033 não a apaga nem
  aceita alterá-la, porque ela pertence ao relato.

  Concluir passou a exigir relato mínimo: o relato geral da missão mais o
  desfecho de cada parada do roteiro. Sem isso, "concluída" não diria nada além
  de a data ter passado. Os testes de ciclo de vida da CG-034 foram ajustados
  para registrar esse mínimo antes de concluir. Resultado: 170 testes de
  integração.

- [x] **CG-036 — Testar o domínio de missões**

  Cobrir períodos, múltiplos países, participantes, cadastro de pessoa,
  transações, estados, auditoria, filtros e autorização.

  Dependências: CG-030 a CG-035.

  Concluída em 2026-08-31 em `apps/api/test/comite-gestor.int-spec.ts`, com
  cinco blocos — criação transacional, lista e filtros, detalhe, edição com
  auditoria, ciclo de vida, relato e conclusão. A autorização continua coberta
  por `permissions.spec.ts` (CG-020), que prova que nenhum papel além de `admin`
  recebeu as permissões novas.

  Dois defeitos reais foram encontrados pelos testes, e não por leitura:

  - a criação não compilava (`participantes` inferido como `never[]`);
  - remover uma parada do roteiro colidia com `atividade_missao_ordem_uk` ao
    renumerar as seguintes.

  Resultado: 170 testes de integração e 32 unitários da API.

- [x] **CG-037 — Implementar submissão para análise**

  Criar ação explícita para enviar a missão ao Comitê:

  - validar os requisitos definidos na CG-008/CG-009;
  - criar uma rodada de análise;
  - registrar autor e instante;
  - congelar ou limitar os campos definidos como sensíveis;
  - incluir a missão na fila do Comitê;
  - produzir notificação durável conforme decisão D-11.

  Dependências: CG-006, CG-008, CG-009, CG-018 e CG-019; também CG-051 se a
  homologação exigir documentos antes da submissão.

  Critério de aceite: submissão incompleta é recusada com erros acionáveis e
  reenvio após ajustes cria nova rodada sem apagar a anterior.

  **Concluída em 2026-09-05.** Entrou
  [submissao.service.ts](../apps/api/src/dominio/submissao.service.ts), com
  `GET .../missoes/:id/requisitos` (checklist) e
  `POST .../missoes/:id/submissao` (envio, permissão `missao:submit`).

  O checklist é endpoint separado do envio de propósito: descobrir o que falta
  só na hora de enviar transformaria a conferência em tentativa e erro. A recusa
  responde **422 com a lista de pendências** — o corpo da requisição está
  correto, o que falta é estado da missão.

  **"Somente o responsável envia" agora é verificável**, porque o vínculo
  `sub` → `pessoa` existe. `admin` passa sempre: sem essa exceção a PROPESP não
  destravaria missão cujo responsável saiu da instituição. A rodada grava
  `submetido_por_pessoa_id`, não só o `sub`.

  **A edição congela durante a análise.** Sem isso o Comitê poderia aprovar um
  texto diferente do que leu, e a decisão ficaria registrada sobre uma missão
  que já não existe mais naquela forma. Solicitar ajustes devolve a edição — é
  o propósito daquela decisão. `MissaoDetalhe` e `MissaoResumo` passaram a
  expor `statusAprovacao`.

  **Notificação durável (D-11) não entrou.** A tarefa a pedia, mas D-11 é
  *proposta* na folha de homologação e não foi aceita. Construir um outbox
  agora seria implementar decisão institucional que ninguém tomou.

  Cobertura: 14 regressões em
  [submissao.int-spec.ts](../apps/api/test/submissao.int-spec.ts) — documento
  faltando com a mensagem certa, documento inativo não satisfaz requisito,
  requisito de outro tipo de missão não bloqueia, participante comum recebe
  403, envio duplicado, edição congelada, reenvio criando rodada 2 sem apagar a
  decisão da 1, missão aprovada que não volta por reenvio, cancelada e ciclo
  trocado.

- [x] **CG-038 — Implementar decisões e rodadas de ajustes**

  Implementar `APROVAR`, `SOLICITAR_AJUSTES` e `REPROVAR` conforme a governança
  homologada:

  - exigir parecer/motivo quando aplicável;
  - preservar documentos analisados;
  - impedir decisão por perfil ou rede sem escopo;
  - notificar o responsável;
  - permitir correção somente nos estados autorizados;
  - auditar reabertura administrativa.

  Dependências: CG-019, CG-028 e CG-037.

  Critério de aceite: histórico mostra todas as decisões, autores, datas e
  pareceres; aprovação anterior nunca é sobrescrita pelo reenvio.

  **Concluída em 2026-09-05**, com quatro decisões do responsável tomadas na
  mesma data:

  | Ponto | Decisão |
  |---|---|
  | Notificar o responsável (D-11) | **Fora desta task.** D-11 é proposta não homologada; construir outbox agora seria implementar decisão que ninguém tomou. |
  | Documentos analisados | **Fotografia automática** no instante da decisão. |
  | Relator | **Sem designação prévia**: quem tem `missao:decide` decide, e o parecer registra quem foi. |
  | Escopo por rede | **Só `admin` por enquanto**; a barreira por rede é a CG-028. |

  Entrou [decisao.service.ts](../apps/api/src/dominio/decisao.service.ts), com
  `POST .../missoes/:id/decisao`, `POST .../missoes/:id/analise/reabertura` e
  `GET .../missoes/:id/analise`.

  **A rota de reabertura precisou de caminho próprio.** Já existia
  `.../missoes/:id/reabertura`, que reabre a **execução** de uma missão
  concluída ou cancelada — coisa diferente de reabrir a **análise** decidida.
  São as duas dimensões da CG-006 colidindo no mesmo verbo; o TypeScript pegou
  pela duplicação do nome do método, não pela rota.

  **A fotografia dos documentos é o ponto delicado.** Copiar a lista e a versão
  de cada arquivo no instante da decisão é o que impede um upload posterior de
  reescrever retroativamente o que o Comitê diz ter analisado — se a decisão
  apontasse para "os anexos da missão", o parecer mudaria sozinho. Documento
  inativo não entra; decisão sem nenhum documento não quebra.

  Cobertura: 13 regressões em
  [decisao.int-spec.ts](../apps/api/test/decisao.int-spec.ts).

  **Um erro dos próprios testes vale registro:** as primeiras versões fixavam a
  reunião em `2027-06-25` porque a missão é de 2027. Está errado — o Comitê
  aprova **antes** da viagem, e a data de reunião no futuro é recusada de
  propósito. O check pegou o teste, não o contrário.

- [ ] **CG-039 — Testar aprovação, concorrência e notificações**

  Cobrir submissão, aprovação, ajustes, reprovação, reenvio, reabertura,
  documentos obrigatórios, duas decisões concorrentes, perfil sem permissão e
  falha na entrega da notificação.

  Dependências: CG-037 e CG-038.

  Critério de aceite: uma decisão concorrente não produz dois estados finais e
  falha de canal externo não apaga a decisão nem a notificação pendente.

### Épico 4 — Interface de equipes e missões

- [x] **CG-040 — Refatorar a página P17**

  - alterar título para "Comitê Gestor e Administração";
  - remover o aviso visual existente;
  - manter a separação RN-14 nos cálculos;
  - criar as três abas por query string;
  - preservar a tabela de aportes como "Origem do orçamento";
  - adicionar filtro de exercício.

  Dependências: CG-004 e CG-031.

  Critério de aceite: abas podem ser compartilhadas e recarregadas sem perder o
  estado principal da navegação.

  Progresso em 2026-08-31: título, remoção do aviso, três abas por query string,
  origem do orçamento e acesso exclusivo de `admin` foram implementados. O
  filtro de exercício será acrescentado quando houver missões/despesas para
  filtrar.

  Concluída em 2026-09-01 com o filtro de exercício da tabela de aportes,
  persistido em `?ano=`. São links, e não um `<select>`: o recorte fica na URL,
  pode ser compartilhado e recarregado, e a aba continua funcionando sem
  JavaScript — a mesma decisão já tomada nos filtros da aba Missões. Exercício
  que não existe no ciclo é ignorado e a página cai no estado “Todos”, em vez de
  renderizar uma tabela vazia.

  Duas correções entraram junto, porque o filtro passa por elas:

  - o rodapé da tabela repetia o total do **primeiro** exercício embaixo de cada
    coluna de ano. Com a seed atual todos os exercícios têm o mesmo valor e o
    erro não aparecia na tela; agora cada coluna soma o próprio exercício;
  - o cartão “Total anual” não dizia de qual exercício falava. Passou a nomeá-lo,
    e vira “Aporte de {ano}” quando há recorte.

- [x] **CG-041 — Construir a aba Equipes**

  - duas seções separadas;
  - contadores;
  - função, vigência e situação;
  - quantidade de missões;
  - ações de adicionar, editar e encerrar vínculo;
  - layout responsivo.

  Dependência: CG-023.

  Critério de aceite: as duas equipes nunca são misturadas visualmente.

  Concluída em 2026-08-31 com seções distintas, vigência, situação e edição. A
  contagem de missões entrou em 2026-09-01 junto da CG-022: é uma coluna própria,
  alinhada à direita, e zero sai como `0` — é um fato, não ausência de dado, e
  por isso não vira travessão.

- [x] **CG-041A — Carregar a composição formal das equipes**

  Avaliar e carregar as fontes:

  - `dados/novos_dados/mebros_dos_comites/COMITE_MEMBROS_UFMG.pdf`;
  - `dados/novos_dados/mebros_dos_comites/COMITE_MEMBROS_UNESP.pdf`;
  - `dados/novos_dados/mebros_dos_comites/COMITE_MEMBROS_UNICAMP.pdf`.

  Critérios de aceite:

  - preservar a separação Comitê Gestor/Administração e a função informada;
  - não duplicar pessoas que aparecem em mais de uma rede;
  - exibir as redes que fundamentam cada vínculo;
  - carregar tanto por seed limpa quanto por migration idempotente;
  - continuar permitindo novos cadastros manuais;
  - proteger contagens e associações por teste de integração.

  Concluída em 2026-09-01. Os três documentos contêm 19 ocorrências, que foram
  normalizadas em 10 pessoas e 10 vínculos: 2 no Comitê Gestor e 8 na
  Administração. A tabela `membro_equipe_gestao_rede` preserva as 19
  associações com UFMG, UNESP e UNICAMP; a aba Equipes ganhou a coluna Redes.
  Todos foram cadastrados como servidores da UEA, com início em `2027-01-01`
  porque os PDFs não trazem datas. Seed limpa, atualização de base existente,
  unicidade da associação e retorno da API estão cobertos pela suíte de 173
  testes de integração.

- [x] **CG-042 — Construir formulário de membro**

  Usar sidesheet com pesquisa/cadastro de pessoa, equipe, função, vigência,
  validação junto aos campos e toast somente para sucesso.

  Dependências: CG-021 e CG-023.

  Critério de aceite: cadastrar uma pessoa nova retorna ao formulário de membro
  sem perder os dados preenchidos.

  Concluída em 2026-08-31. Pessoa e vínculo são gravados na mesma chamada e na
  mesma transação, evitando pessoa órfã se o vínculo for inválido. Em
  2026-08-31, o formulário foi migrado para React Hook Form + Zod, passou a
  enviar dados tipados para a Server Action e reaplica erros da API nos campos.

- [~] **CG-043 — Construir lista de missões**

  - filtros e busca;
  - tabela responsiva;
  - estados vazios;
  - selos separados de missão e prestação;
  - valor apresentado;
  - link para detalhe;
  - botão "Nova missão".

  Dependências: CG-031 e CG-040.

  Progresso em 2026-08-31 na aba Missões da P17. Feito: resumo do recorte,
  barra de filtros, busca, tabela, paginação, estados vazios, selos e valor.

  - A barra de filtros é um `<form method="get">` de verdade. O recorte fica na
    URL, pode ser compartilhado e recarregado, e a lista funciona sem
    JavaScript. Os campos aceitos são uma lista fechada no servidor: a query
    string não é repassada cegamente à API.
  - **Os dois estados vazios dizem coisas diferentes.** Sem nenhuma missão, o
    que falta é o cadastro; com um filtro de escopo que não casa, o que falta é
    ampliar o recorte. É por isso que o `resumo` da CG-034 responde ao escopo
    mas não ao status — é ele que distingue os dois casos.
  - **Missão e prestação têm selos separados**, porque são situações
    independentes. Sem prestação o valor sai como *A definir*, nunca R$ 0,00.

  Falta, e depende das próximas tasks:

  - o **link de detalhe** já é renderizado, mas a rota
    `.../comite-gestor/missoes/[id]` só existe na CG-045. Até lá ele leva a 404.

  O botão **"Nova missão"** foi concluído junto da CG-044 em 2026-09-01.

  Verificado com `pnpm smoke:telas` (estados vazios) e com uma missão real
  criada pela API, conferindo código, país, contagem de atividades, datas,
  *A definir*, busca e o vazio de filtro.

- [x] **CG-044 — Construir cadastro multietapas da missão**

  Etapas:

  1. identificação e período;
  2. roteiro repetível com países, instituições, visitas e eventos;
  3. participantes, incluindo cadastro rápido de pessoa;
  4. revisão.

  Não incluir passagem, diária ou qualquer outro valor.

  Dependências: CG-030, CG-042 e CG-043.

  Critério de aceite: o objeto tipado contém os dados de todas as etapas e os
  erros permanecem próximos ao campo correspondente.

  Concluída em 2026-09-01 com React Hook Form, resolver Zod e `useFieldArray`.
  O sidesheet possui quatro etapas sempre montadas: identificação, roteiro
  repetível, participantes e revisão. Permite selecionar pessoa existente ou
  criar uma pessoa persistente dentro da missão, associa opcionalmente o vínculo
  de equipe e não contém qualquer campo financeiro.

  A API expõe os países e instituições existentes por endpoint protegido. A
  migration `0016_carrega_paises_iso.sql` e a seed carregam os países ISO, de
  forma que uma instalação limpa também consegue cadastrar o roteiro. Erros
  aninhados da API voltam ao campo e à etapa correspondentes sem limpar os
  demais valores.

  Verificação inicial: lint da API e da web, build das duas aplicações, 32
  testes unitários da API, 171 testes de integração e 16 regressões da web
  aprovados. Após a carga formal da CG-041A, o total atual é 33 unitários da API
  e 173 testes de integração; as 16 regressões da web permanecem aprovadas.

- [~] **CG-045 — Construir o detalhe da missão**

  Criar página com resumo, redes, roteiro, participantes, parceiros, contatos,
  documentos, aprovação, relato, prestação, produtos e histórico, preservando
  espaço para crescimento sem transformar tudo em um único formulário.

  Esta task foi reordenada em 2026-09-01: não começar com o contrato anterior.
  Rede, aprovação e parceiro mudam a hierarquia e as ações do detalhe.

  Dependências: CG-032, CG-016 a CG-019, CG-025/CG-026 e CG-037/CG-038.

  Critério de aceite: missão sem prestação abre normalmente e mostra o estado
  “Prestação não iniciada”; missão em análise mostra a rodada e as ações
  permitidas sem misturar edição, decisão e prestação.

  **Desbloqueada em 2026-09-05**, quando CG-037 e CG-038 fecharam a última
  dependência. Entregue em fatias.

  **Fatia 1 (2026-09-05): resumo, roteiro e participantes.**
  [missoes/[id]/page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]/page.tsx).
  A lista já apontava para esta rota desde a CG-041 — era link morto até agora.

  **As duas dimensões da CG-006 aparecem juntas**, com selos separados e
  rotulados ("Aprovação: …", "Execução: …"). Mostrar só uma produziria a
  leitura errada mais provável: *aprovada* lida como *realizada*, ou
  *concluída* lida como *aprovada pelo Comitê*. A lista também ganhou o selo de
  aprovação, omitido quando é `RASCUNHO` para não virar ruído.

  A tela não soma nem deriva nada: dias inclusivos, situação temporal e totais
  chegam calculados da API.

  Faltam as fatias 2 (análise: rodadas, pareceres, ações de enviar e decidir) e
  3 (documentos e prestação), além da navegação por abas — que só faz sentido
  quando houver mais de uma.

  **Um achado sério durante a verificação desta fatia**, sem relação com a
  interface: o `/me` respondia **500** e derrubava a aplicação inteira. O realm
  havia sido recriado, todos os `sub` mudaram, e o vínculo por e-mail achava a
  pessoa já ligada à conta antiga — violando `usuario_sistema_pessoa_uk`.
  Corrigido: `resolver` devolve `null` em vez de falhar, o `/me` responde
  `pessoaId: null` e `vinculoPendente: true`, e a sessão continua válida porque
  papéis e permissões vêm do token. **Repontar sozinho seria pior que falhar:**
  bastaria criar uma conta com um e-mail conhecido para herdar a pessoa e os
  escopos dela. Quem desempata é um administrador, por
  `POST /acesso/usuarios/:id/pessoa`. Duas regressões novas em
  `acesso.int-spec.ts` cobrem o caso.

- [ ] **CG-046 — Construir edição do relato da missão**

  - registrar atividade realizada;
  - resultados e encaminhamentos;
  - atividades extras justificadas;
  - instituições e pessoas efetivamente contatadas;
  - avaliação do alcance dos objetivos;
  - desdobramentos;
  - concluir missão.

  Dependências: CG-035, CG-045 e CG-058.

- [ ] **CG-047 — Construir fila de análise do Comitê**

  Exibir missões aguardando análise ou reanálise com filtros por rede, país,
  período, responsável e rodada, incluindo indicadores clicáveis que preservam
  o filtro na URL.

  Dependências: CG-031, CG-037 e CG-038.

  Critério de aceite: Comitê vê todas as redes; Gestor da Rede nunca recebe
  missão fora do seu escopo.

- [ ] **CG-048 — Construir tela de análise e parecer**

  Mostrar resumo, parceiros, contatos autorizados, participantes, roteiro,
  documentos, alterações e decisões anteriores. Disponibilizar aprovar,
  solicitar ajustes e reprovar conforme permissão, com justificativa próxima da
  ação.

  Dependências: CG-038, CG-039, CG-045 e CG-051.

  Critério de aceite: decisão confirmada aparece no histórico e uma falha não
  limpa o parecer digitado.

- [~] **CG-049 — Construir cadastro e histórico de parceiros**

  Criar lista, busca, cadastro, edição, contatos e detalhe histórico da
  instituição, com seleção/reutilização dentro da missão.

  Dependências: CG-025 a CG-027 e CG-045.

  Critério de aceite: usuário encontra e reutiliza parceiro existente; alerta
  de possível duplicidade não apaga o formulário.

  Parcialmente entregue em 2026-09-02. **A seleção de parceiro dentro da missão
  não foi feita** — é a única parte que depende de fato da CG-045, que segue
  bloqueada pelo aceite institucional. Todo o lado do parceiro está de pé em
  `/programas/[programa]/[ciclo]/parceiros`:

  - lista com busca por nome, sigla, cidade ou domínio, filtro por rede,
    inclusão opcional de inativos/conciliados e estados vazios distintos para
    "nada cadastrado" e "nada para este filtro". Os filtros são
    `<form method="get">`: o recorte fica na URL e pode ser compartilhado;
  - cadastro e edição em sidesheet com React Hook Form e Zod, incluindo redes
    (`Selecoes`), país e cadastro provisório;
  - detalhe com o histórico da CG-027 — dados institucionais, contatos,
    missões com suas atividades, eventos e documentos;
  - contatos com cadastro, edição, troca de principal, inativação e
    reativação, todas com justificativa.

  **O alerta de duplicidade cumpre o critério de aceite por construção.** Ele é
  renderizado dentro do próprio `<form>`, acima dos campos, e não em um diálogo
  por cima: como o formulário nunca é desmontado, o React Hook Form preserva
  tudo o que já foi digitado. O 409 da API traz os candidatos, e para isso
  `EstadoDaAcao` ganhou o campo `candidatos`, repassado por `traduzirErro` — sem
  ele a tela diria apenas "não foi possível salvar", escondendo justamente
  *quais* cadastros a API considerou equivalentes. Duplicidade `POSSIVEL`
  oferece o botão "cadastrar assim mesmo", que reenvia o formulário com
  `confirmarPossivelDuplicidade`; duplicidade `INEQUIVOCA` não oferece botão
  nenhum, porque a API recusa mesmo confirmada e o botão prometeria algo que
  não acontece.

  Não existe ação de excluir parceiro ou contato, em nenhum lugar da interface:
  a atividade da missão referencia o `id` central, e a saída é inativar.

  A rota fica sob o ciclo porque o vínculo com rede é do ciclo
  (`rede_coordenadora` tem `cicloId`); a instituição em si é global, e o
  detalhe mostra o histórico inteiro dela. O item de menu só aparece para quem
  tem `parceiro:read` — hoje, só o `admin`; o escopo por rede é a CG-028.

  Produtos e convênios aparecem nomeados como pendentes, nunca como zero,
  refletindo o `modulosPendentes` da CG-027.

  Cobertura: 11 regressões novas na web (schemas, `null` versus `undefined` no
  PATCH, payload do contato sem cópia dos dados da instituição, e o contrato do
  alerta de duplicidade), além de verificação manual com sessão real — criação,
  409 inequívoco, 409 possível, homônimo confirmado, lista, detalhe e o 403 de
  `coord.teste` sem vazamento de dado pessoal. Resultado geral: **44 unitários
  da API, 32 regressões da web e 202 integrações aprovados**.

  Ainda em 2026-09-02, a **conciliação ganhou interface**: no detalhe do
  parceiro, "Conciliar" escolhe o cadastro que permanece e exige justificativa.
  A escolha é assimétrica de propósito — este cadastro é a origem e vira o
  inativo — e a tela diz isso antes de confirmar, porque a operação transfere
  redes, contatos, atividades, pessoas e documentos. O botão não aparece quando
  não há candidato ativo, já que a API exige destino ativo e um painel com
  select vazio prometeria uma ação impossível. Depois da conciliação, a origem
  mostra o aviso "Cadastro conciliado" com link para o cadastro que permaneceu,
  e sai da lista padrão com o selo `conciliado` quando se pedem os inativos.

  A **paginação continua não existindo**, mas a lista deixou de mentir: quando
  o serviço devolve os 200 do limite, a tela avisa que o resultado pode estar
  cortado e pede refino. Sumir com parceiro em silêncio é pior do que admitir o
  limite. A paginação de fato exige mudar o contrato da API da CG-025 e não foi
  feita aqui.

  Falta apenas a seleção/reutilização de parceiro **dentro da missão**, que
  depende da CG-045.

### Épico 5 — Prestação de contas e documentos

- [x] **CG-050 — Implementar CRUD e cálculos de despesas**

  - passagens, cotações, diárias e tipos homologados de outras despesas;
  - participante associado;
  - exercício informado em cada despesa;
  - quantidade, valor unitário e total;
  - campos específicos definidos na CG-013;
  - auditoria;
  - totais por tipo, pessoa, missão e exercício;
  - cálculos monetários sem `number`.

  Dependências: CG-013 e CG-020.

  Critério de aceite: totais reproduzíveis a partir das despesas, sem agregado
  persistido.

  Concluída em 2026-09-02 em
  [dominio/prestacao.service.ts](../apps/api/src/dominio/prestacao.service.ts),
  sob `.../comite-gestor/missoes/:id/prestacao`. Inicia a prestação, edita
  observações e faz o CRUD de despesas com passagem, cotações e diária.

  **Nenhum total é persistido.** `total`, `totalPorTipo`, `totalPorExercicio` e
  `totalPorPessoa` saem de `sum(...)` em `numeric` no próprio Postgres e chegam
  como `string`; converter para `number` no limite do banco reintroduziria o
  erro de centavo que o `numeric` evita. Validado com um centavo solto em outro
  exercício: R$ 4.200,00 + R$ 3.000,00 + R$ 0,07 = **R$ 7.200,07**, e o centavo
  não se perde em nenhum dos recortes.

  Prestação sem despesa tem `total` **nulo**, não zero — a mesma regra de
  `somarMoeda` na web: zero afirmaria que a missão não gastou.

  **Editar despesa substitui a especialização inteira.** Editar campo a campo
  obrigaria a decidir o que fazer quando o tipo muda, e uma passagem que vira
  diária deixaria a tabela de passagem órfã. Apagar e regravar na mesma
  transação elimina esse estado intermediário; há teste que troca o tipo e
  confirma que nenhuma linha órfã sobrou.

  Outras recusas, todas verificadas contra a aplicação rodando: total que não
  corresponde a quantidade × unitário (com a mensagem no campo certo, e não a do
  `check` do banco); valor negativo; exercício fora de 2000–2100; passagem
  recebendo dados de diária e vice-versa; segunda prestação na mesma missão; e
  **participante de outra missão**, que apontaria a despesa para alguém que
  nunca viajou nela. `prestacao:read|write` barra `coord.teste` com 403 nas duas
  pontas.

  Fora de escopo aqui, de propósito: **enviar e validar** a prestação é a
  CG-054. O serviço mantém a prestação em `EM_PREENCHIMENTO` e recusa alteração
  depois que ela sai desse estado — quem já enviou não corrige a despesa por
  baixo do pano. Os tipos além de passagem e diária seguem em `OUTRA` até a
  CG-009.

  Cobertura: 11 integrações em `prestacao.int-spec.ts`; resultado geral **48
  unitários da API, 54 regressões da web e 226 integrações aprovados**. Os dados
  de teste criados na base de desenvolvimento foram removidos e os aportes da
  P17 conferidos depois (R$ 1.525.332,00).

- [x] **CG-051 — Implementar upload e download seguro de documentos**

  - aceitar apenas os formatos homologados na CG-009;
  - limite configurável de tamanho;
  - verificar MIME e assinatura do arquivo;
  - aplicar antivírus/quarentena quando exigido;
  - usar chave segura no armazenamento;
  - calcular hash;
  - autorizar upload e download;
  - aplicar política por entidade de destino, incluindo missão, submissão,
    decisão, prestação, produto e evidência;
  - nunca devolver caminho interno ao browser.

  A antiga proposta aceitava somente PDF. O PDF novo também solicita JPG, PNG,
  DOC/DOCX e XLS/XLSX; a decisão precisa ser registrada antes do código.

  Dependências: CG-009 e CG-014.

  Critério de aceite: arquivos inválidos e acessos sem permissão são recusados.

  Concluída em 2026-09-02, sobre o modelo decidido na CG-014. A tabela `anexo`
  evoluiu (migration `0027_modelo_documental.sql`) e a API vive em `/anexos`.

  **O tipo é decidido pelo conteúdo, não pela extensão.** Extensão e
  `Content-Type` vêm do cliente e mentem juntos: renomear `virus.exe` para
  `nota.pdf` muda os dois e não muda um byte do arquivo. A verificação lê a
  assinatura dos primeiros bytes **e** exige que a extensão declarada combine —
  um `.pdf` cujo conteúdo é ZIP é recusado, mesmo ZIP sendo assinatura legítima
  de `.docx`. Verificado por mutação: trocar a checagem por "confia na extensão"
  quebra 4 testes.

  **O caminho interno nunca sai.** A chave é opaca (`<ano>/<uuid>`), gerada pelo
  sistema e nunca derivada do nome enviado — nome vira caminho previsível e vaza
  dado (nome de bolsista, número de processo). O download passa por endpoint
  autenticado; sem sessão, `401`. Há também guarda contra chave que escape da
  raiz de armazenamento: hoje ela nunca dispara, porque a chave é sempre gerada
  internamente, mas o dia em que alguém aceitar chave vinda de fora a checagem
  já está no lugar certo.

  **A permissão é a da entidade de destino**, e por isso o controller não tem
  `@RequirePermission`: anexar à prestação exige `prestacao:write`, ao parceiro
  `parceiro:write`, à missão `missao:edit`. Um decorador fixo teria de escolher
  a permissão mais fraca. A tabela de política é explícita — um `default`
  permissivo faria um `entidade_tipo` novo nascer sem dono. Validado com sessão
  real: cada recusa nomeia a permissão da entidade alvo.

  Outras garantias: existência da entidade de destino conferida no serviço (o
  `entidade_id` não tem chave estrangeira, então sem isso o upload criaria órfão
  no ato); limite de 25 MB configurável por `ANEXO_TAMANHO_MAXIMO`; SHA-256
  gravado e conferido contra o arquivo original; substituição criando versão
  nova com a anterior preservada e ainda baixável pelo `id`; histórico da cadeia
  de versões; e inativação com justificativa e trilha, sem exclusão.

  `PRODUTO_MISSAO`, `CONVENIO`, `SUBMISSAO_MISSAO` e `DECISAO_COMITE` **não**
  entraram no enum de destino porque suas tabelas ainda não existem (CG-056 e
  CG-019) — aceitar upload apontando para tabela inexistente seria criar órfão
  no ato. Entram junto com as tasks delas.

  **Antivírus/quarentena não foi implementado.** O item dizia "quando exigido",
  não há scanner disponível no ambiente e a exigência não foi homologada;
  declarar suporte a antivírus sem um seria pior do que a ausência. O ponto de
  inserção é único: `validarArquivo` em `anexos.service.ts`, antes de
  `armazenamento.guardar`.

  Cobertura: 7 unitários dos formatos e 11 integrações; resultado geral **55
  unitários da API, 63 regressões da web e 238 integrações aprovados**.

- [x] **CG-052 — Associar documentos às despesas**

  - documento de passagem;
  - comprovante ou memória de cálculo de diária;
  - documento individual de cada cotação;
  - vários documentos homologados por despesa;
  - metadados de autoria e data;
  - substituição versionada, sem apagar silenciosamente a versão anterior.

  Dependências: CG-050 e CG-051.

  Concluída em 2026-09-05. A API genérica de anexos ganhou a validação de
  domínio que faltava: passagem aceita passagem, bilhete, comprovante e nota;
  diária aceita comprovante próprio; outras despesas aceitam comprovante e
  nota; e documento ligado diretamente a `COTACAO_PASSAGEM` exige a categoria
  `COTACAO`. `OUTRO` permanece disponível na despesa como escape homologado.

  Vários documentos podem apontar para a mesma despesa, enquanto cada cotação
  mantém a própria coleção pelo seu `id`. A autoria (`sub` e nome), o instante
  do envio e a substituição versionada continuam vindo da CG-051, sem criar
  uma segunda tabela documental.

  O vínculo polimórfico não possui chave estrangeira, então a proteção também
  cobre o caminho inverso: remover uma despesa documentada é recusado, e editar
  uma passagem não pode apagar silenciosamente uma cotação que já possui
  documento. Trocar o tipo da despesa também é recusado quando tornaria uma
  categoria existente incompatível.

  Não houve migration. Cobertura: quatro fluxos integrados novos em
  `anexos.int-spec.ts` e dois em `prestacao.int-spec.ts`, além dos testes já
  existentes de armazenamento, permissão e versão.

- [ ] **CG-053 — Construir interface da prestação**

  - resumo de passagem, cotação, diária e outras despesas homologadas;
  - lista por participante;
  - formulário de despesa;
  - upload, visualização quando segura e download de documentos;
  - totais apresentados;
  - indicação de documentos pendentes.

  Dependências: CG-045, CG-050 e CG-052.

- [ ] **CG-054 — Implementar envio e revisão da prestação**

  - iniciar prestação;
  - enviar;
  - bloquear edição durante análise;
  - validar;
  - devolver com pendência e justificativa;
  - corrigir e reenviar;
  - auditar todas as transições.

  Nesta etapa todas as ações continuam restritas a `admin`, apesar da separação
  conceitual entre preparar e revisar.

  Dependência: CG-053.

  Critério de aceite: somente `VALIDADA` produz execução oficial do orçamento.

- [ ] **CG-055 — Integrar prestações aos indicadores do orçamento**

  Exibir por exercício:

  - orçamento anual;
  - valor em preenchimento;
  - valor enviado/em análise;
  - valor validado;
  - saldo oficial = orçamento - validado;
  - quantidade de missões;
  - prestações pendentes.

  Preservar a tabela de aportes por rede/instituição e a separação total do
  orçamento de bolsas.

  Dependência: CG-054.

  Critério de aceite: valores não validados nunca reduzem o saldo oficial.

### Épico 6 — Produtos, evidências e encerramento

- [ ] **CG-056 — Implementar produtos da missão e convênios**

  Criar domínio próprio, separado de `produto_bolsa`, com:

  - resposta explícita “gerou produto?”;
  - tipo e descrição do produto;
  - instituições, redes e responsáveis relacionados;
  - convênio/acordo com assinatura, vigência, área, objetivo e situação;
  - documentos versionados;
  - histórico e auditoria.

  Dependências: CG-005, CG-014, CG-017, CG-045 e CG-051.

  Critério de aceite: missão sem produto registra a resposta negativa; missão
  com convênio alimenta o histórico dos parceiros sem duplicar instituição.

- [ ] **CG-057 — Implementar fotos e evidências da missão**

  Permitir upload múltiplo com categoria, legenda, data, local, descrição,
  autoria e visibilidade. Incluir evidências documentais homologadas e respeitar
  privacidade de participantes e contatos.

  Dependências: CG-009, CG-014, CG-045 e CG-051.

  Critério de aceite: galeria não expõe arquivo privado e substituição preserva
  a versão anterior.

- [ ] **CG-058 — Implementar relatório final e checklist condicional**

  Registrar:

  - objetivo previsto;
  - atividades e instituições visitadas;
  - pessoas contatadas;
  - resultados e produtos;
  - desdobramentos;
  - avaliação `SIM | PARCIALMENTE | NAO` e justificativa;
  - confirmação auditada da realização.

  Calcular o checklist de encerramento conforme tipo e fatos da missão. Não
  persistir booleanos que apenas duplicam existência/estado de outros registros.
  Permitir dispensa somente conforme regra homologada, com justificativa.

  Dependências: CG-006, CG-009, CG-035, CG-045 e CG-050 a CG-057.

  Critério de aceite: missão só encerra quando requisitos aplicáveis estão
  satisfeitos ou dispensados por usuário autorizado; item não aplicável não
  bloqueia o fluxo.

- [ ] **CG-059 — Testar resultados e encerramento**

  Cobrir resposta sem produto, vários produtos, convênio multilateral, evidência
  privada, avaliação parcial, checklist condicional, dispensa, missão não
  realizada e tentativa de encerramento incompleto.

  Dependências: CG-056 a CG-058.

### Épico 7 — Qualidade, segurança e documentação

- [ ] **CG-060 — Cobrir integração financeira**

  Testar totais por exercício, passagem e diária, prestação enviada, devolvida
  e validada, missão sem prestação, missão cancelada e reabertura.

  Dependências: CG-050 a CG-055.

- [x] **CG-061 — Cobrir segurança dos documentos**

  Testar usuário sem permissão, IDs adulterados, MIME falso, arquivo acima do
  limite, nome malicioso e acesso a documento de outra missão.

  Dependências: CG-051 e CG-052.

  Concluída em 2026-09-05 para a matriz provisória, na qual somente `admin`
  possui as permissões de prestação. A cobertura comprova recusa de usuário sem
  permissão mesmo conhecendo o UUID, alvo inexistente, UUID malformado antes da
  consulta ao banco, MIME falso, arquivo acima do limite e nome com caracteres
  de controle. O `Content-Disposition` usa fallback ASCII e `filename*` UTF-8,
  remove caminho e não permite CR/LF, aspas ou ponto e vírgula alterarem o
  cabeçalho.

  A proteção entre redes para dois usuários que possuam `prestacao:read` não é
  parte desta task porque esse segundo perfil ainda não existe: nasce com a
  CG-028 e é testado pela CG-029. Hoje, conhecer o ID de documento de outra
  missão não amplia permissões; `prestacao:read` continua obrigatória.

  Fechamento em 2026-09-05: a checagem de caractere de controle saiu de uma
  expressão regular com literais `\u0000-\u001f` — que o `no-control-regex`
  do ESLint recusa, e a entrega anterior deixou o `pnpm lint` quebrado — para a
  função `temControle`, que percorre os pontos de código. **Não foi silenciada a
  regra:** um `eslint-disable` aqui esconderia o próximo literal de controle
  escrito sem intenção. Cinco casos novos em
  [anexos.service.spec.ts](../apps/api/src/dominio/anexos.service.spec.ts)
  cobrem nome limpo, nome acentuado, CR/LF, `NUL` e `DEL`.

  Verificado de ponta a ponta em 2026-09-05: **58 unitários da API, 64
  regressões da web, 246 integrações**, `pnpm lint`, `pnpm build`,
  `pnpm smoke:login` e `pnpm smoke:telas` (nos dois usuários) aprovados.

- [~] **CG-062 — Criar regressões da interface**

  Cobrir multistep, datas, roteiro repetível, cadastro e seleção de pessoas,
  cálculos monetários, estados da prestação e mensagens de erro.

  Dependências: CG-041 a CG-059 e CG-066 a CG-069.

  Progresso em 2026-09-01: o cadastro de missão ganhou regressões do schema,
  período do roteiro, participante duplicado, cadastro persistente de pessoa,
  tradução de erros aninhados e ausência de campos financeiros no payload.
  Detalhe, relato, cálculos e estados da prestação permanecem pendentes.

  Em 2026-09-02 entraram os **cálculos monetários**, que não tinham regressão
  nenhuma apesar de sustentarem duas regras centrais: dinheiro nunca passa por
  `number` antes de uma conta, e ausência de valor não é zero — a segunda é o
  que derrubava a média do painel por causa da UNICAMP. São 11 casos em
  `apps/web/test/dinheiro.test.mjs`, cobrindo `somarMoeda`, `moeda`, `inteiro`,
  `percentual` e as fronteiras do semáforo da RN-07.

  **Um teste foi reescrito por exagerar na afirmação.** A primeira versão dizia
  que somar em `number` exibiria 69,99 em vez de 70,00; ao verificar por
  mutação, a soma em `number` com arredondamento final continuava passando —
  `toFixed` esconde o erro acumulado nessa magnitude. O que de fato separa as
  duas implementações é a **ordem entre truncar e somar**: mil parcelas de
  8,615 dão 8.610,00 truncando parcela a parcela e 8.615,00 somando em float,
  cinco reais de diferença. O teste passou a fixar isso, e a mutação agora é
  detectada por dois casos. A afirmação anterior era plausível e falsa — o tipo
  de comentário que faz um teste parecer mais forte do que é.

  Continuam pendentes os cálculos e estados da prestação, que dependem de
  CG-050 a CG-055 existirem.

- [~] **CG-063 — Ampliar o smoke de telas**

  Percorrer login, equipes, criação de pessoa, parceiro, missão, submissão,
  aprovação, relato, despesa, documento, validação, produto, encerramento e
  conferência dos indicadores.

  Dependências: CG-055 a CG-059, CG-062 e CG-066 a CG-069.

  Progresso em 2026-08-31: o smoke verifica acesso restrito para `coord.teste`,
  visão geral e aba Equipes para `admin`, e a aba Missões nos dois estados
  vazios — sem cadastro e sem resultado de filtro. Os passos de criação de
  missão, relato, despesa e validação permanecem pendentes.

  Em 2026-09-01, a presença da ação **"Nova missão"** na aba também passou a
  ser verificada. O preenchimento ponta a ponta do sidesheet continua pendente.

  Ainda em 2026-09-01, entraram o recorte por exercício da Visão geral
  (`?ano=2027` e um exercício inexistente, que precisa cair em "Todos" sem
  quebrar) e a coluna de missões da aba Equipes. Esta última ancora em
  `text-right">Missões</th>`, e não no texto "Missões": o rótulo da aba tem a
  mesma palavra, e a asserção passaria mesmo sem a coluna.

  Em 2026-09-02 entraram as telas de parceiro (CG-049): lista, filtro sem
  resultado e inclusão de inativos para o `admin`, e "Acesso restrito" para
  `coord.teste`. O detalhe do parceiro é verificado **condicionalmente** — o id
  vem da própria lista, e só quando existe algum cadastro. A asserção do estado
  vazio de cadastro roda no caso oposto, e não incondicionalmente: a seed não
  traz parceiros, mas qualquer cadastro feito à mão invalidaria a asserção e
  transformaria o smoke em fonte de falso alarme.

  Em 2026-09-05 o smoke passou a atravessar também o caminho autenticado
  browser → BFF → API para a lista e as referências do formulário de missão.
  As chamadas são somente leitura: criar missão no smoke atual deixaria dados
  permanentes porque o domínio não possui exclusão. O preenchimento visual do
  sidesheet continua dependendo de automação de navegador, ainda inexistente no
  repositório.

  **Os dois scripts estavam versionados sem o bit de execução** (modo `100644`),
  então `pnpm smoke:login` e `pnpm smoke:telas` falhavam com *Permission denied*
  em qualquer clone limpo — só funcionavam por `bash scripts/...`. Corrigido com
  `git update-index --chmod=+x` em 2026-09-05. Um smoke que não roda pelo comando
  documentado é um smoke que ninguém roda.

- [~] **CG-064 — Revisar acessibilidade e responsividade**

  Verificar teclado, foco dos sidesheets, rótulos, anúncios de erro/sucesso,
  tabelas no celular e contraste dos estados.

  Dependência: interface concluída.

  Primeira passagem em 2026-09-02, sobre a interface que existe. O que já
  estava certo e foi apenas confirmado: o sidesheet é `<dialog>` nativo com
  `showModal()`, então foco presa, `Esc` e fundo inerte vêm do navegador; o
  toast separa `alert`/`assertive` de `status`/`polite`; campo com erro já
  marcava `aria-invalid`; a página nunca rola na horizontal.

  Quatro defeitos reais foram corrigidos:

  - **Tabela larga era inalcançável pelo teclado.** As 37 tabelas do sistema
    têm `min-w-[48rem]` dentro de `overflow-x-auto`: no celular elas rolam, e
    quem usa só teclado não chegava nas colunas escondidas, porque não há
    elemento focável ali dentro. Entrou
    [ui/rolagem.tsx](../apps/web/src/componentes/ui/rolagem.tsx), que dá
    `tabIndex` ao contêiner **apenas quando ele de fato transborda** — medido no
    cliente e reavaliado no redimensionamento. Fixo, criaria uma parada de
    tabulação morta em cada tabela numa tela larga; ausente, deixa conteúdo
    inacessível. O `role="region"` só entra junto com o nome.
  - **Erro de campo não era vinculado ao controle.** O `role="alert"` anuncia no
    instante em que o erro aparece, mas quem volta ao campo depois não ouvia
    nada. `Campo` passou a gerar `aria-describedby` para dica e erro, e os
    quatro controles do sistema o expõem.
  - **A descrição do sidesheet era texto solto.** É ela que explica a
    consequência ("o cadastro fica inativo", "substitui o principal atual") —
    agora vai em `aria-describedby` do próprio diálogo.
  - **Duas colunas de ações tinham `<th>` vazio**, deixando a coluna anônima
    para quem navega célula a célula. Receberam rótulo `sr-only`.

  Verificado no HTML renderizado com sessão real: nenhum `<th>` vazio,
  `aria-labelledby`/`aria-describedby` presentes no diálogo e `aria-label` no
  botão de fechar. Cobertura: 8 regressões novas em
  `apps/web/test/acessibilidade.test.mjs`; resultado geral **44 unitários da
  API, 43 regressões da web e 203 integrações aprovados** (retrato de
  2026-09-02; hoje são 58, 64 e 246).

  Em 2026-09-05 os pares semânticos passaram a ter regressão numérica de
  contraste nos temas claro e escuro. Texto normal exige pelo menos 4,5:1;
  borda forte e anel de foco, 3:1. A menor razão atual entre os pares de estado
  é 5,24:1 (`danger` escuro), e `subtle` sobre `surface`, 4,90:1 no claro.

  Continua pendente, porque depende de tela que ainda não existe: revisão das
  telas de prestação, aprovação e dashboards.

- [~] **CG-065 — Atualizar a documentação do projeto**

  Atualizar `AGENTS.md`, `system-structl.md`, arquitetura, catálogo de
  permissões, regras financeiras, parceiros, aprovação, armazenamento e backup
  de documentos.

  Dependência: comportamento implementado e validado.

  Passagem em 2026-09-02. `AGENTS.md`, a arquitetura e a revisão de escopo vinham
  sendo atualizados a cada entrega; o que estava para trás era a
  [especificação funcional](../system-structl.md).

  **A correção mais importante foi uma afirmação que virou falsa.** A P17 ainda
  dizia: *"Ainda não há API de contatos nem interface, portanto nenhum contato
  pessoal novo é exposto pela aplicação."* Isso deixou de valer com a CG-026 e a
  CG-049. Uma frase dessas envelhecendo em silêncio é pior do que documentação
  ausente: ela afirma uma propriedade de privacidade que o sistema não tem mais.

  Também entraram: a **P24 · Parceiros institucionais** — página que não existia
  na especificação original, veio do escopo ampliado e por isso é numerada depois
  da P23 —, a rota de parceiros no mapa de navegação, a linha da P24 na tabela de
  situação e a contagem de tabelas, que estava em 28 e hoje é 35 (conferida no
  schema, não copiada). O `docs/validacao-telas.md` ganhou o item 12, com os seis
  pontos que valem teste manual e o aviso de que a tela é exclusiva de `admin`.

  Duas correções de rota durante a revisão: "9 módulos de schema" parecia errado
  (há 10 arquivos), mas está certo — `comum.ts` só tem helpers, não tabelas; e o
  `README.md` não precisou de nada, porque trata de instalação e não carrega
  afirmação de estado que envelheça.

  **Não coberto, por não haver o que documentar:** aprovação do Comitê
  (CG-008), armazenamento e backup de documentos (CG-009/CG-014). Não são
  decisões implementadas ainda; escrever sobre elas agora seria registrar
  intenção como se fosse comportamento. Regras financeiras não mudaram nesta
  frente. O catálogo de permissões continua vivendo em
  `apps/api/src/auth/permissions.ts`, com o processo de extensão descrito no
  `AGENTS.md` §6 — `parceiro:read|write` já estão lá e cobertos por teste.

  Passagem em 2026-09-05: documentação e arquitetura agora registram CG-050 a
  CG-052, incluindo as categorias de documento por tipo de despesa e as travas
  que preservam anexos polimórficos. O resumo deixou de afirmar que todo o Épico
  5 estava pendente, CG-009 foi separada das quatro homologações ainda abertas,
  e a lista de decisões futuras perdeu itens já resolvidos (tipos de despesa,
  BRL, formatos, evento como atividade e instituição provisória). Retenção,
  backup, antivírus e visibilidade definitiva permanecem corretamente abertos.

### Épico 8 — Dashboards, relatórios e exportações

- [ ] **CG-066 — Construir dashboard do Comitê Gestor**

  Exibir indicadores homologados de análise, aprovação, realização, prestação,
  conclusão, países, parceiros e convênios. Cada número deve ser clicável e
  abrir a lista correspondente com filtros na URL.

  Dependências: CG-038, CG-055, CG-056 e CG-058.

  Critério de aceite: cartões e lista de pendências usam o mesmo recorte e não
  contam missão multirrede duas vezes no consolidado.

- [ ] **CG-067 — Construir dashboard por rede**

  Consolidar missões, países, instituições, eventos, convênios, produtos e
  despesas para UFMG, UNESP e UNICAMP, respeitando “Minha rede” e “Todas”.

  Dependências: CG-016, CG-028, CG-055, CG-056 e CG-066.

  Critério de aceite: gestor vê somente redes autorizadas; Comitê e admin podem
  alternar entre rede e consolidado sem divergência de totais.

- [ ] **CG-068 — Implementar relatórios estratégicos**

  Criar relatórios de:

  - missões;
  - parceiros;
  - finanças;
  - resultados.

  Aplicar filtros por período, rede, país, instituição, evento e estado. Valores
  financeiros devem continuar como strings decimais até a apresentação.

  Dependências: CG-027, CG-055 a CG-058 e CG-067.

  Critério de aceite: total do relatório reproduz as consultas de origem para o
  mesmo filtro e não depende de agregado manual persistido.

- [ ] **CG-069 — Implementar exportações e relatório final em PDF**

  Exportar os relatórios homologados em PDF, Excel e CSV e gerar o dossiê final
  da missão com apenas os documentos/evidências permitidos ao solicitante.

  Definir processamento síncrono ou assíncrono, limites, expiração do arquivo e
  proteção contra fórmula maliciosa em CSV/Excel.

  Dependências: CG-051, CG-058 e CG-068.

  Critério de aceite: exportação mantém filtros, moeda e datas, respeita
  autorização e não expõe caminho interno nem conteúdo privado.

## Ordem recomendada de entrega

### Entrega 0 — Homologação obrigatória

CG-005 a CG-009.

Nenhuma evolução estrutural do documento novo começa antes desta entrega.

### Entrega A — Equipes, redes e parceiros

Base já entregue: CG-004, CG-010, CG-011, CG-015, CG-020 a CG-024 e CG-040 a
CG-042. Evolução: CG-016 a CG-018 e CG-025 a CG-029.

### Entrega B — Missões, submissão, aprovação e detalhe

Base já entregue: CG-012, CG-030 a CG-036, CG-043 e CG-044. Evolução: CG-019,
CG-037 a CG-039 e CG-047. Executar CG-051 antes da submissão se a CG-008 exigir
documentos prévios. Depois, CG-045 revisada e CG-048/CG-049. A CG-046 termina
após o relatório final da CG-058.

Ao final, será possível cadastrar, submeter, analisar, ajustar, aprovar e relatar
uma missão com redes, parceiros e histórico preservados.

### Entrega C — Prestação e documentos

CG-013, CG-014 e CG-050 a CG-055.

### Entrega D — Produtos, convênios, encerramento e relato final

CG-056 a CG-058, depois CG-046 e CG-059.

### Entrega E — Indicadores, relatórios e exportações

CG-066 a CG-069.

### Entrega F — Endurecimento transversal

CG-060 a CG-065, executadas continuamente e concluídas após as entregas que
servem de dependência.

## Pendências para decisão futura

Todas as pendências abaixo já possuem **proposta técnica com valor recomendado**
em [homologacao-comite-gestor.md](homologacao-comite-gestor.md). Continuam
marcadas como pendentes porque proposta não é decisão: elas só fecham com o
aceite da equipe.

- [ ] Matriz definitiva de acesso (CG-003).
- [ ] Classificar as 40 seções entre MVP, fase posterior, visão futura e fora do
  escopo (CG-005).
- [ ] Homologar dimensões e transições de estado (CG-006).
- [ ] Homologar a matriz perfil–escopo e o significado de “Minha rede”
  (CG-003/CG-007); a relação multirrede das entidades já foi implementada.
- [ ] Definir quórum, relator ou autoridade individual do Comitê (CG-008).
- [ ] Confirmar se haverá titular/suplente nas duas equipes ou apenas função em
  texto controlado.
- [ ] Definir a regra institucional para escolher o exercício de cada despesa;
  o modelo já prevê que ele será informado explicitamente.
- [ ] Definir antivírus, backup e retenção dos documentos; formatos e limite de
  25 MB configurável já estão implementados (CG-009/CG-014/CG-051).
- [ ] Definir obrigatoriedade condicional e dispensa no checklist (CG-009).
- [ ] Definir canal de notificações e política de retentativa (D-11).
- [ ] Definir vínculo entre usuário Keycloak e pessoa local (D-12).
- [ ] Definir visibilidade e retenção dos contatos, fotos e comprovantes
  pessoais (D-13).
- [ ] Definir quem pode validar uma prestação quando os acessos deixarem de ser
  exclusivos do `admin`.
