# Backlog — Comitê Gestor e Administração

Última atualização: 2026-09-01.

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
folha de aprovação. **São propostas, não decisões.** Nada dali entra em código
antes do aceite da equipe.

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
  relato na interface (CG-045 e CG-046), além de todo o Épico 5 — prestação,
  despesas e PDFs.
- [x] O novo documento de expectativas foi auditado contra as 40 seções e o
  resultado foi documentado sem alterar regras de negócio ainda não homologadas.
- [ ] Aprovação do Comitê, parceiros, contatos, escopo por rede, produtos,
  convênios, evidências, dashboards estratégicos e relatórios foram incluídos
  como novas tasks, mas ainda não foram implementados.
- [~] O pacote que torna CG-005 a CG-009 decidíveis foi produzido em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md). As cinco tasks
  passaram a `[~]`: a parte técnica está pronta, o aceite institucional não.
- [x] CG-022 e CG-040 foram concluídas em 2026-09-01: contagem de missões por
  membro e filtro de exercício da tabela de aportes.
- [x] CG-016 foi concluída em 2026-09-01: a missão pertence a uma ou mais redes
  (`missao_rede`), com filtro, coluna, auditoria por rede e a garantia de que a
  missão multirrede aparece e conta uma única vez.
- [x] Após a revisão, o backlog possui 70 tasks rastreáveis: 23 concluídas, 10
  em andamento e 37 pendentes. Esses números são retrato de 2026-09-01 e devem
  ser atualizados quando um checkbox mudar.

Próxima ação obrigatória: **obter o aceite da folha de aprovação** de
[homologacao-comite-gestor.md](homologacao-comite-gestor.md), que fecha CG-005 a
CG-009. A CG-045 continua não sendo a próxima: rede, aprovação, parceiros e
documentos alterarão o contrato da página de detalhe.

As duas tasks que podiam avançar sem depender do aceite foram entregues em
2026-09-01: **CG-022** (contagem de missões por membro) e **CG-040** (filtro de
exercício).

Em seguida, ainda em 2026-09-01 e por decisão registrada do responsável pelo
projeto, as decisões **estruturais** do pacote (CG-006 e CG-007) passaram a ser
tratadas como aceitas para desbloquear a **CG-016**, que foi concluída. As
decisões **institucionais** continuam pendentes e nada que dependa delas foi
implementado: modelo B de aprovação (CG-008), formatos/retenção de documentos
(CG-009/D-08), perfil Participante (D-12) e a matriz definitiva de acesso
(CG-003). A folha de aprovação continua valendo — o aceite formal ainda é o que
fecha CG-005 a CG-009.

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

- [~] **CG-009 — Reconciliar orçamento, despesas, documentos e encerramento**

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

### Épico 1 — Fundação do domínio

- [~] **CG-010 — Criar enums do módulo**

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

- [ ] **CG-013 — Criar schema da prestação de contas**

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

- [ ] **CG-014 — Definir o modelo documental e o armazenamento**

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

- [~] **CG-015 — Gerar e verificar migrations**

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

- [ ] **CG-017 — Modelar parceiros, redes e contatos**

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

- [ ] **CG-018 — Ampliar identificação, destino, evento e participantes**

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

- [ ] **CG-019 — Criar schema de submissão e decisões do Comitê**

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

- [ ] **CG-025 — Implementar cadastro e deduplicação de parceiros**

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

- [ ] **CG-026 — Implementar contatos dos parceiros**

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

- [ ] **CG-027 — Construir histórico consolidado do parceiro**

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

- [ ] **CG-029 — Testar parceiros, contatos e escopo**

  Cobrir deduplicação, conciliação, inativação, contato principal, histórico,
  missão multirrede e isolamento entre perfis/redes.

  Dependências: CG-025 a CG-028.

  Critério de aceite: integração usa PostgreSQL real e inclui tentativas de
  acesso horizontal indevido.

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

- [ ] **CG-037 — Implementar submissão para análise**

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

- [ ] **CG-038 — Implementar decisões e rodadas de ajustes**

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

- [ ] **CG-045 — Construir o detalhe da missão**

  Criar página com resumo, redes, roteiro, participantes, parceiros, contatos,
  documentos, aprovação, relato, prestação, produtos e histórico, preservando
  espaço para crescimento sem transformar tudo em um único formulário.

  Esta task foi reordenada em 2026-09-01: não começar com o contrato anterior.
  Rede, aprovação e parceiro mudam a hierarquia e as ações do detalhe.

  Dependências: CG-032, CG-016 a CG-019, CG-025/CG-026 e CG-037/CG-038.

  Critério de aceite: missão sem prestação abre normalmente e mostra o estado
  “Prestação não iniciada”; missão em análise mostra a rodada e as ações
  permitidas sem misturar edição, decisão e prestação.

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

- [ ] **CG-049 — Construir cadastro e histórico de parceiros**

  Criar lista, busca, cadastro, edição, contatos e detalhe histórico da
  instituição, com seleção/reutilização dentro da missão.

  Dependências: CG-025 a CG-027 e CG-045.

  Critério de aceite: usuário encontra e reutiliza parceiro existente; alerta
  de possível duplicidade não apaga o formulário.

### Épico 5 — Prestação de contas e documentos

- [ ] **CG-050 — Implementar CRUD e cálculos de despesas**

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

- [ ] **CG-051 — Implementar upload e download seguro de documentos**

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

- [ ] **CG-052 — Associar documentos às despesas**

  - documento de passagem;
  - comprovante ou memória de cálculo de diária;
  - documento individual de cada cotação;
  - vários documentos homologados por despesa;
  - metadados de autoria e data;
  - substituição versionada, sem apagar silenciosamente a versão anterior.

  Dependências: CG-050 e CG-051.

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

- [ ] **CG-061 — Cobrir segurança dos documentos**

  Testar usuário sem permissão, IDs adulterados, MIME falso, arquivo acima do
  limite, nome malicioso e acesso a documento de outra missão.

  Dependências: CG-051 e CG-052.

- [~] **CG-062 — Criar regressões da interface**

  Cobrir multistep, datas, roteiro repetível, cadastro e seleção de pessoas,
  cálculos monetários, estados da prestação e mensagens de erro.

  Dependências: CG-041 a CG-059 e CG-066 a CG-069.

  Progresso em 2026-09-01: o cadastro de missão ganhou regressões do schema,
  período do roteiro, participante duplicado, cadastro persistente de pessoa,
  tradução de erros aninhados e ausência de campos financeiros no payload.
  Detalhe, relato, cálculos e estados da prestação permanecem pendentes.

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

- [ ] **CG-064 — Revisar acessibilidade e responsividade**

  Verificar teclado, foco dos sidesheets, rótulos, anúncios de erro/sucesso,
  tabelas no celular e contraste dos estados.

  Dependência: interface concluída.

- [ ] **CG-065 — Atualizar a documentação do projeto**

  Atualizar `AGENTS.md`, `system-structl.md`, arquitetura, catálogo de
  permissões, regras financeiras, parceiros, aprovação, armazenamento e backup
  de documentos.

  Dependência: comportamento implementado e validado.

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
- [ ] Definir missão/evento multirrede e “Minha rede” (CG-007).
- [ ] Definir quórum, relator ou autoridade individual do Comitê (CG-008).
- [ ] Confirmar se haverá titular/suplente nas duas equipes ou apenas função em
  texto controlado.
- [ ] Separar orçamento estimado pré-aprovação de despesa efetiva (CG-009).
- [ ] Definir a regra institucional para escolher o exercício de cada despesa;
  o modelo já prevê que ele será informado explicitamente.
- [ ] Confirmar quais outras despesas integram o MVP (CG-009).
- [ ] Definir formatos, tamanho máximo, antivírus, backup e retenção dos
  documentos (CG-009/CG-014).
- [ ] Definir obrigatoriedade condicional e dispensa no checklist (CG-009).
- [ ] Decidir se evento é cadastro reutilizável ou atividade da missão (D-10).
- [ ] Decidir se instituição livre será proibida ou conciliada como provisória
  (D-06).
- [ ] Definir canal de notificações e política de retentativa (D-11).
- [ ] Definir vínculo entre usuário Keycloak e pessoa local (D-12).
- [ ] Definir visibilidade e retenção dos contatos, fotos e comprovantes
  pessoais (D-13).
- [ ] Definir quem pode validar uma prestação quando os acessos deixarem de ser
  exclusivos do `admin`.
- [ ] Definir se despesas em moeda estrangeira precisarão guardar moeda, valor
  original, cotação e valor convertido; o MVP proposto trabalha com o valor
  oficial em reais.
