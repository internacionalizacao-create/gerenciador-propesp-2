# Pacote de homologação — Comitê Gestor, Parceiros e Resultados

Data: 2026-09-01.

Este documento existe para tornar **decidíveis** as tasks CG-005 a CG-009 do
[backlog-comite-gestor.md](backlog-comite-gestor.md). Ele não implementa nada e
não altera regra de negócio: cada item abaixo é uma **proposta com valor
recomendado**, para a equipe aprovar, ajustar ou rejeitar.

Fonte das expectativas:
`dados/novos_dados/ajustes_e_definicao/Módulo de Gestão de Missões, Comitê Gestor, Parceiros e Resultados.pdf`
(40 seções). A auditoria seção a seção está em
[revisao-escopo-comite-gestor-2026-09-01.md](revisao-escopo-comite-gestor-2026-09-01.md);
aqui está a **decisão proposta** para cada ponto que aquela auditoria deixou em
aberto.

## Por que este documento e não código

O PDF é redigido em "deverá" e "poderá", com listas de checkbox não marcadas.
Ele descreve muito bem a **visão**, e por isso é uma boa base oficial — mas não
responde às perguntas que mudam o schema e a segurança: quem aprova, se uma
missão pertence a uma ou a várias redes, o que reduz saldo, quem pode ver o
comprovante de diária de outra pessoa. Implementar essas respostas por inferência
significaria gravar decisões institucionais em migration, e migration de estado
aprovado é cara de desfazer.

O caminho mais barato é o inverso: propor a resposta, colher o aceite, depois
migrar uma vez só.

## Como usar

1. Leia cada bloco (CG-005 a CG-009) e a folha de aprovação no final.
2. Para cada linha, marque **Aceito**, **Ajustar** (dizendo como) ou **Rejeitar**.
3. As decisões aceitas voltam para o backlog: a seção "Decisões confirmadas"
   passa a citá-las e as tasks dependentes saem de bloqueio.
4. Só depois disso as tasks CG-016 em diante começam.

Legenda de fase usada em todo o documento:

| Sigla | Significado |
|---|---|
| **MVP** | obrigatório na próxima entrega |
| **F2** | entrega posterior, já modelada mas não construída agora |
| **VF** | visão futura: registrada, sem data |
| **FE** | fora do escopo deste módulo |

---

## CG-005 — Classificação das 40 seções

Critério aplicado à coluna "Fase proposta": entra no MVP o que é necessário para
**fechar o ciclo completo de uma missão** — cadastrar, submeter, analisar,
aprovar, realizar, prestar contas, relatar e concluir — nas três redes, mais a
base de parceiros que a §37 exige para não nascer duplicada. Fica para F2 o que
**lê** esse acervo (painéis, relatórios, exportações, galeria): são telas que
dependem de haver dado, e hoje não há.

| § | Expectativa do PDF | Fase proposta | Justificativa da proposta |
|---:|---|:---:|---|
| 1 | Planejar, aprovar, acompanhar, prestar contas e avaliar missões das três redes | **MVP** | É o enunciado do módulo; define o recorte de tudo abaixo. |
| 2 | Estrutura rede → parceiros/missões → aprovação → realização → resultados | **MVP** | Diretriz de modelagem, já compatível com o schema atual. |
| 3 | Perfis Administrador, Gestor da Rede, Comitê Gestor, Participante | **MVP** para os três primeiros; **F2** para Participante | Participante exige vincular o `sub` do Keycloak a `pessoa` (D-12), lacuna conhecida do projeto, e dar acesso a documento pessoal antes disso é risco desnecessário. |
| 4 | Dashboard do Comitê com oito indicadores clicáveis | **F2** | Seis dos oito indicadores (em análise, aprovadas, prestação pendente, parceiros, convênios) só existem depois de CG-037 a CG-039 e CG-056. |
| 5 | Filtros por rede, país, período, evento e status | **MVP** para rede, país, período e status; **F2** para tipo de evento | País, período e status já existem em `missoes-comite.service.ts`; rede e status novo entram junto com CG-016 e CG-006. Tipo de evento depende de §12. |
| 6 | Visão "Todas as redes" e visão "Minha rede" | **MVP** | É a espinha do escopo. Sem isso, o Gestor da Rede não pode existir. |
| 7 | Cadastro independente de instituições parceiras, multirrede | **MVP** | A §37 é regra fundamental, e hoje `instituicao` tem só nome, sigla, país, cidade e site. |
| 8 | Vários contatos por instituição | **MVP** | §13 exige escolher o contato da missão; sem cadastro, viraria texto livre — o oposto da §37. |
| 9 | Histórico permanente do parceiro | **F2** | É consulta consolidada: precisa de missões com rede, convênios e produtos já gravados. |
| 10 | Identificação: número, rede, responsável, unidade, tipo, nome, objetivo | **MVP** | Código, título, objetivo e tipo existem; faltam rede, responsável único e unidade. |
| 11 | Destino com região, local, endereço, saída, retorno e dias | **MVP** | Ampliação barata de `atividade_missao`. **Número de dias é calculado**, nunca persistido. |
| 12 | Evento detalhado, relacionado a uma ou mais redes | **MVP** como campos da atividade; **F2** como entidade `evento` reutilizável | Ver D-10. Promover a entidade agora criaria uma rota e um cadastro sem massa de dados que justifique a deduplicação. |
| 13 | Instituições e contatos relacionados à missão, com tipo de relacionamento | **MVP** | É o elo que transforma viagem em base de relacionamento (§40). |
| 14 | Participantes com cargo, área e período individual | **MVP** | Ampliação de `missao_participante`; período individual é o que permite diária correta. |
| 15 | Documentos prévios, upload múltiplo, vários formatos | **MVP** para PDF/JPG/PNG; **F2** para DOC/DOCX/XLS/XLSX | Ver D-08. Office não é renderizável no navegador e amplia a superfície de antivírus e de vazamento. |
| 16 | Enviar missão ao Comitê e entrar em análise | **MVP** | Sem submissão, aprovação não existe. |
| 17 | Tela de análise com resumo, documentos e histórico | **MVP** | É onde o Comitê trabalha. |
| 18 | Aprovar, solicitar ajustes ou reprovar | **MVP** | Ver CG-008 para a governança. |
| 19 | Histórico imutável de decisões e documentos analisados | **MVP** | Requisito de auditoria institucional; a auditoria genérica atual não substitui parecer formal. |
| 20 | Após aprovação e viagem, abrir prestação | **MVP**, com confirmação explícita | Ver D-07: a passagem do tempo não afirma que a viagem ocorreu. |
| 21 | Passagens com dados operacionais e documentos | **MVP** | |
| 22 | Cotações de passagens com PDF individual | **MVP** | É exigência de conformidade da compra; sem ela a prestação não fecha. |
| 23 | Diárias por beneficiário, período e local | **MVP** | |
| 24 | Hospedagem, transporte, inscrição, seguro e outras despesas | **MVP**, com modelo extensível | Ver CG-009: um único `despesa_missao` tipado evita cinco tabelas quase iguais. |
| 25 | Produtos gerados pela missão | **MVP** (registro) | É o que a §40 chama de resultado; sem ele o módulo volta a ser "cadastro de viagens". |
| 26 | Convênio vinculado a produto, instituições e documento | **MVP** (registro + PDF) | O PDF o promove de fase 2 para o núcleo. |
| 27 | Galeria de fotos categorizada | **F2** | Valor real, custo alto: miniatura, armazenamento, retenção e imagem de pessoa (D-13). |
| 28 | Evidências documentais categorizadas | **MVP** para a categoria do documento; **F2** para a galeria | Categorizar o que já sobe é barato; a vitrine é que é cara. |
| 29 | Relatório final estruturado e avaliação do objetivo | **MVP** | Já há relato e resultados; faltam contatos, desdobramentos e a avaliação Sim/Parcialmente/Não. |
| 30 | Checklist condicional para encerrar | **MVP** | Ver CG-009 e D-09: checklist **calculado**, nunca coleção de booleanos. |
| 31 | Dashboard com fila de análise | **MVP** | A fila é operacional: sem ela o Comitê não sabe o que analisar. Distinta dos cards da §4. |
| 32 | Dashboard por rede | **F2** | |
| 33 | Indicadores estratégicos | **F2** | |
| 34 | Relatórios por domínio e filtros | **F2** | |
| 35 | Exportar PDF, Excel, CSV e relatório final em PDF | **F2** | |
| 36 | Estrutura conceitual de entidades | **MVP** (diretriz) | Compatível com o modelo proposto em CG-009. |
| 37 | Evitar duplicidade de instituições e contatos | **MVP** (regra) | Ver D-06: hoje a unicidade é por nome exato, insuficiente para variações. |
| 38 | Fluxo completo em 25 passos | **MVP** como fluxo-alvo | Os passos 21 (fotos) e 25 (indicadores) caem em F2 conforme as linhas acima. |
| 39 | Novo menu completo do módulo | **F2** / decisão | Ver a nota abaixo. |
| 40 | Registrar a história da internacionalização | **MVP** (diretriz) | Justifica parceiros, contatos, produtos e histórico serem MVP. |

### Nota sobre a §39 (menu)

O menu proposto tem 12 grupos de primeiro nível e trata Eventos, Participantes,
Documentos e Prestação como áreas globais. **Proposta: não adotá-lo agora.**

Motivo: um menu que expõe "Cotações", "Diárias" e "Fotos" como destinos próprios
antes de existir uma única cotação cadastrada produz oito telas vazias, e telas
vazias ensinam o usuário a não clicar. A informação é a mesma, o que muda é a
porta de entrada.

Proposta de arquitetura da informação para o MVP:

```text
Comitê Gestor e Administração
  ├── Visão geral        (orçamento, aportes, fila de análise — §31)
  ├── Missões            (lista, filtros, nova missão)
  │     └── Missão       (detalhe: resumo, documentos, análise, prestação,
  │                       produtos, relatório final — tudo em abas)
  ├── Parceiros          (instituições, contatos, histórico)
  └── Equipes            (Comitê Gestor e Administração)
```

A prestação, os produtos e os documentos vivem **dentro do detalhe da missão**,
que é onde o usuário está quando precisa deles. Quando houver volume, as telas
globais da §39 podem ser criadas consumindo os mesmos endpoints, sem migração.

---

## CG-006 — Modelo de estados da missão

### O problema com a lista do PDF

A §5 do PDF oferece como "Status" uma lista única:
Rascunho, Em análise, Ajustes solicitados, Aprovada, Reprovada, Viagem realizada,
Prestação pendente, Concluída, Cancelada.

Ela mistura cinco perguntas diferentes. Uma missão aprovada, já viajada, com
prestação em preenchimento tem que responder às três coisas ao mesmo tempo — e
um campo único obriga a escolher qual verdade contar. É o que produz o clássico
"a missão sumiu do filtro Aprovadas depois que virou Prestação pendente".

**Proposta: quatro dimensões independentes**, e o filtro da §5 passa a ser um
atalho que combina dimensões, não uma coluna.

### Dimensão 1 — Aprovação (persistida)

```text
                    ┌──────────────────────┐
                    ▼                      │ reenviar
  RASCUNHO ──enviar──> EM_ANALISE ──ajustes──> AJUSTES_SOLICITADOS
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
          APROVADA                REPROVADA
              │                       │
              └────── reabrir ────────┘
                         │
                         ▼
                    EM_ANALISE
```

| Transição | De | Para | Permissão | Exige justificativa | Efeitos |
|---|---|---|---|:---:|---|
| Enviar | `RASCUNHO`, `AJUSTES_SOLICITADOS` | `EM_ANALISE` | `missao:submit` | não | Congela a edição dos campos analisados; entra na fila; grava rodada. |
| Solicitar ajustes | `EM_ANALISE` | `AJUSTES_SOLICITADOS` | `missao:decide` | **sim** | Devolve a edição ao responsável; notifica; grava parecer. |
| Aprovar | `EM_ANALISE` | `APROVADA` | `missao:decide` | parecer | Habilita confirmação de realização; grava parecer e documentos analisados. |
| Reprovar | `EM_ANALISE` | `REPROVADA` | `missao:decide` | **sim** | Encerra o fluxo; não impede reabertura formal. |
| Reabrir análise | `APROVADA`, `REPROVADA` | `EM_ANALISE` | `missao:reopen` | **sim** | Nunca apaga a decisão anterior: nova rodada. |

Regra que a proposta assume: **nenhuma decisão é apagada ou sobrescrita**. Cada
decisão é uma linha nova em `decisao_comite`, com rodada, usuário, data/hora,
ação, parecer e a lista dos documentos que existiam no momento da análise (§19).

### Dimensão 2 — Execução

Duas partes, e a distinção é o ponto principal da D-07.

**Situação temporal — calculada, nunca persistida** (já implementada em
[missoes-comite.service.ts:711](../apps/api/src/dominio/missoes-comite.service.ts#L711)):

`FUTURA` | `EM_ANDAMENTO` | `ENCERRADA`

**Realização — persistida e confirmada por pessoa**:

| Estado | Significado |
|---|---|
| `NAO_CONFIRMADA` | O período pode ter passado; ninguém afirmou que a viagem ocorreu. |
| `REALIZADA` | Alguém confirmou, com data e autoria auditadas. |
| `NAO_REALIZADA` | Confirmou-se que não ocorreu, com justificativa. |

A §20 do PDF diz "Após o período da viagem: VIAGEM REALIZADA". **Proposta:
recusar essa automação.** O sistema pode, ao passar a data final de uma missão
aprovada, abrir uma pendência ("confirmar realização") e destacar a missão na
fila — mas quem afirma que a viagem aconteceu é uma pessoa, porque essa
afirmação é o que autoriza gastar dinheiro público em prestação de contas.

### Dimensão 3 — Prestação (persistida)

```text
NAO_INICIADA → EM_PREENCHIMENTO → ENVIADA ──> VALIDADA
                      ▲                 │
                      └── COM_PENDENCIA ┘
```

| Transição | Permissão | Exige justificativa | Efeito financeiro |
|---|---|:---:|---|
| Abrir | `prestacao:write` | não | nenhum |
| Enviar | `prestacao:write` | não | nenhum |
| Apontar pendência | `prestacao:review` | **sim** | nenhum |
| Validar | `prestacao:review` | não | **único momento em que o valor reduz o saldo oficial** |
| Reabrir validada | `prestacao:review` | **sim** | Devolve o valor ao saldo e registra a reversão. |

A regra já confirmada no backlog — *somente prestação validada reduz o saldo* —
fica preservada e passa a ter um ponto único de aplicação.

### Dimensão 4 — Encerramento (persistida)

`ABERTA` | `CONCLUIDA` | `CANCELADA`

Concluir exige o checklist da CG-009 satisfeito. Cancelar é possível a partir de
qualquer combinação, exige justificativa e **não apaga** despesas ou documentos
já gravados.

### Migração dos estados atuais

Hoje `status_missao_comite` tem cinco valores em uma coluna só. A proposta os
distribui sem perder histórico:

| Status atual | Aprovação | Realização | Prestação | Encerramento |
|---|---|---|---|---|
| `RASCUNHO` | `RASCUNHO` | `NAO_CONFIRMADA` | `NAO_INICIADA` | `ABERTA` |
| `PLANEJADA` | `RASCUNHO` | `NAO_CONFIRMADA` | `NAO_INICIADA` | `ABERTA` |
| `CONFIRMADA` | `APROVADA` | `NAO_CONFIRMADA` | `NAO_INICIADA` | `ABERTA` |
| `CONCLUIDA` | `APROVADA` | `REALIZADA` | `NAO_INICIADA` | `CONCLUIDA` |
| `CANCELADA` | mantém o valor anterior conhecido | `NAO_CONFIRMADA` | `NAO_INICIADA` | `CANCELADA` |

Duas escolhas nessa tabela precisam de aceite explícito, porque afirmam coisas
sobre dados já existentes:

1. **`CONFIRMADA` vira `APROVADA`.** Hoje "confirmar" é um ato administrativo de
   `admin`, não uma decisão colegiada. Traduzi-lo como aprovação registra uma
   aprovação que talvez nunca tenha sido deliberada. A alternativa é mapear para
   `RASCUNHO` e exigir que todas as missões confirmadas passem pela análise. Como
   hoje as missões existentes são de teste, a **recomendação é mapear para
   `APROVADA` e gravar uma decisão de origem `MIGRACAO`** no histórico, deixando
   explícito que aquela aprovação não teve parecer.
2. **`CONCLUIDA` vira realização `REALIZADA`.** Mesma observação: a conclusão
   atual é um ato administrativo. A decisão de migração fica igualmente marcada.

A coluna `status` antiga **não é removida na mesma migration**: fica por uma
versão, preenchida, para conferência e rollback lógico (CG-015).

---

## CG-007 — Redes e escopos

### Matriz entidade–rede

| Entidade | Relação com rede | Justificativa |
|---|---|---|
| `missao_comite` | **N:N**, mínimo 1 (`missao_rede`) | O PDF permite evento e parceiro multirrede (§12, §7); uma missão conjunta das três redes é o caso que o módulo mais quer registrar. Uma coluna singular teria de ser substituída depois. |
| `instituicao` (parceiro) | **N:N** (`instituicao_rede`) | Explícito na §7 e no diagrama da §37. |
| `contato_instituicao` | Herda a instituição | Contato é da instituição, não da rede. |
| Evento (campos da atividade) | Herda a missão | Enquanto for atividade. Se virar entidade (F2), passa a N:N. |
| `produto_missao` | Herda a missão | |
| `convenio` | **N:N** com instituição; rede herdada da missão de origem | |
| `pessoa` | Sem vínculo direto | Pessoa não pertence a rede; o vínculo é pela equipe. |
| `membro_equipe_gestao` | **N:N** (`membro_equipe_gestao_rede`, já existe) | Já implementado na carga formal. |

Regra de contagem que a proposta assume: **uma missão multirrede aparece uma vez
em "Todas as redes"**. Nos painéis por rede ela aparece em cada rede, e o total
das três redes por isso não é a soma — os relatórios devem dizer isso na tela.

### Matriz perfil–escopo

"Minha rede" = conjunto das redes associadas ao vínculo ativo da pessoa em
`membro_equipe_gestao_rede`. É a definição mais barata e a única que já tem
dado carregado.

| Perfil | Missões | Parceiros/contatos | Documentos | Decisão do Comitê | Prestação |
|---|---|---|---|---|---|
| **Administrador** (`admin`) | todas | todas | todos | não decide, administra | valida |
| **Gestor da Rede** | cria e edita as da sua rede; lê as da sua rede | lê todas; cria e edita | anexa nas suas | não | preenche e envia as suas |
| **Comitê Gestor** | lê todas | lê todas | lê todos | **sim** | lê |
| **Participante** (F2) | lê aquelas de que participa | não | só os seus próprios | não | não |

Consequência técnica: `permissionsForRoles` deixa de bastar. O escopo por rede é
um **filtro nas consultas**, não uma permissão — a permissão diz *o que* a pessoa
pode fazer, o escopo diz *sobre quais linhas*. O ponto de mudança continua sendo
[permissions.ts](../apps/api/src/auth/permissions.ts) mais um resolvedor de
escopo aplicado nos serviços de listagem, exatamente como o AGENTS.md §9 já
antecipa para o escopo por PPG.

Permissões novas propostas:

| Permissão | Concedida a |
|---|---|
| `missao:submit` | `admin`, Gestor da Rede |
| `missao:decide` | `admin`, Comitê Gestor |
| `missao:reopen` | `admin` |
| `parceiro:read` / `parceiro:write` | leitura ampla; escrita a `admin` e Gestor da Rede |

Os papéis "Gestor da Rede" e "Comitê Gestor" ainda não existem no realm. Criá-los
é parte da CG-003, e a proposta é que o acesso continue **exclusivo de `admin`**
até que a CG-003 seja homologada — o MVP funciona assim, e ninguém perde acesso.

---

## CG-008 — Governança da aprovação

Este é o bloco que o desenvolvedor não pode inferir de jeito nenhum: a diferença
entre "o admin clicou em aprovar" e "o Comitê Gestor deliberou" é institucional,
não técnica.

Três modelos possíveis, do mais simples ao mais formal:

| Modelo | Como funciona | Custo | Risco |
|---|---|---|---|
| **A — Decisão individual** | Qualquer membro do Comitê com `missao:decide` aprova sozinho; o parecer registra quem foi. | baixo | O sistema afirma "aprovado pelo Comitê" quando houve uma pessoa. |
| **B — Relator + registro colegiado** (recomendado) | Um membro relata e emite o parecer; o parecer identifica a reunião/data em que o Comitê deliberou. O sistema registra a decisão e sua origem, sem simular votação. | baixo | Depende de o relator informar a deliberação corretamente. |
| **C — Quórum no sistema** | Cada membro vota; a decisão só se consolida ao atingir o quórum configurado. | alto | Exige presença de todos no sistema, notificação e desempate. |

**Recomendação: modelo B.** Ele registra a verdade (uma pessoa operou o sistema,
o colegiado deliberou fora dele) sem construir uma máquina de votação que a
equipe teria de operar em todas as missões. Se depois a UEA quiser o modelo C,
`decisao_comite` já terá rodada e autoria, e a votação vira uma tabela filha.

Pontos que precisam de resposta explícita:

| Pergunta | Proposta |
|---|---|
| Quem envia para análise? | O responsável pela missão ou o Gestor da Rede. |
| Documentos obrigatórios antes do envio? | Projeto da missão e justificativa. Convite, programação e orçamento ficam **condicionais** (ver CG-009). |
| Rodadas de ajustes têm limite? | Não. Cada retorno é uma rodada numerada. |
| Quem pode reabrir uma decisão? | Somente `admin`, com justificativa, e nunca apagando a decisão anterior. |
| O que consta do parecer? | Usuário, data/hora, ação, texto do parecer, observações e a lista de documentos existentes no momento da análise (§19). |
| A missão pode ser editada em análise? | Não nos campos analisados. Anexar documento novo é permitido e fica registrado na rodada. |

---

## CG-009 — Orçamento, despesas, documentos e encerramento

### Tabela requisito–momento–obrigatoriedade–efeito financeiro

| Requisito | Momento | Obrigatoriedade proposta | Efeito no saldo |
|---|---|---|---|
| Estimativa de custo da missão | Antes do envio | Opcional | **Nenhum.** É previsão para análise. |
| Documento "Orçamento" (§15) | Antes do envio | Condicional: obrigatório se houver estimativa | Nenhum |
| Projeto da missão | Antes do envio | **Obrigatório** | Nenhum |
| Justificativa | Antes do envio | **Obrigatório** | Nenhum |
| Convite | Antes do envio | Condicional: obrigatório se tipo = `EVENTO` | Nenhum |
| Programação | Antes do envio | Condicional: obrigatório se tipo = `EVENTO` | Nenhum |
| Cotações de passagem | Prestação | Condicional: obrigatório se houver passagem | Nenhum (são comparativo, não gasto) |
| Passagem | Prestação | Condicional: obrigatório se houver deslocamento aéreo | **Sim, ao validar** |
| Diária | Prestação | Condicional: obrigatório se houver diária paga | **Sim, ao validar** |
| Outras despesas | Prestação | Opcional | **Sim, ao validar** |
| Comprovante por despesa | Prestação | **Obrigatório** por despesa lançada | Bloqueia o envio da prestação, não o saldo |
| Confirmação de realização | Após o período | **Obrigatório** para abrir prestação | Nenhum |
| Relatório final | Após a realização | **Obrigatório** para concluir | Nenhum |
| Produtos (Sim/Não) | Após a realização | **Obrigatório responder**; a lista é condicional ao "Sim" | Nenhum |
| Convênio assinado (PDF) | Após a realização | Condicional: obrigatório se produto = `CONVENIO` | Nenhum |
| Fotos/evidências | Após a realização | Opcional (F2) | Nenhum |

**A regra permanece intacta: o saldo oficial só se move quando a prestação é
validada.** Estimativa, documento de orçamento e despesa em preenchimento não
tocam em saldo — é o que separa previsão de execução e o que mantém a RN-14.

### Modelo de despesas proposto

Uma tabela `despesa_missao` tipada, e não uma tabela por tipo:

```text
prestacao_contas_missao (1 por missão)
  ├── despesa_missao        tipo: PASSAGEM | DIARIA | HOSPEDAGEM | TRANSPORTE
  │                               | INSCRICAO | SEGURO | OUTRO
  │     ├── campos comuns:  descrição, valor, data, beneficiário, exercício
  │     ├── campos de passagem: empresa, voo, origem, destino, data da compra,
  │     │                       forma de pagamento
  │     └── campos de diária:   quantidade, valor unitário, período, país, cidade
  └── cotacao_passagem      vinculada à despesa de passagem, com PDF próprio
```

Motivo: os campos comuns (valor, data, beneficiário, exercício, comprovante) são
a maioria, e todo indicador financeiro da §33 quer somar tipos diferentes. Cinco
tabelas quase iguais transformariam cada soma em cinco `union`.

Três decisões pendentes dentro deste bloco:

| Questão | Proposta |
|---|---|
| **Exercício da despesa** | Informado explicitamente em cada despesa, com valor pré-preenchido pelo ano da data do pagamento. O `admin` pode alterar. Regra institucional de "qual exercício" precisa vir da equipe; o modelo já a acomoda. |
| **Moeda estrangeira** (D-14) | MVP grava **apenas o valor oficial em reais**. Se a equipe confirmar necessidade, acrescentar moeda, valor original e cotação é aditivo e não migra o que já existe. Em nenhuma hipótese o cálculo passa por `number`. |
| **Formatos e retenção** (D-08) | MVP: PDF, JPG e PNG, até 20 MB por arquivo, verificados por tipo real e não por extensão. Office como download sem renderização, só se confirmado obrigatório. Retenção e backup precisam de resposta institucional. |

### Checklist de encerramento

**Calculado, nunca uma coleção de booleanos.** Cada item é uma consulta ao estado
real; um booleano gravado se descola do dado no dia em que alguém apaga uma
despesa.

| Item da §30 | Condição para ser exigido |
|---|---|
| Missão cadastrada | sempre |
| Aprovação registrada | sempre |
| Viagem realizada | sempre (realização = `REALIZADA`) |
| Passagens anexadas | se existir despesa `PASSAGEM` |
| Cotações anexadas | se existir despesa `PASSAGEM` |
| Diárias anexadas | se existir despesa `DIARIA` |
| Outros comprovantes | se existir despesa de outro tipo |
| Relatório final preenchido | sempre |
| Produtos informados | sempre (a resposta Sim/Não é obrigatória) |
| Convênio anexado | se houver produto do tipo `CONVENIO` |
| Fotos/evidências | nunca obrigatório no MVP |

**Dispensa:** proposta é que apenas `admin` possa dispensar um item condicional,
sempre com justificativa registrada na auditoria. Item incondicional não é
dispensável.

---

## Respostas propostas às decisões D-01 a D-14

Consolidação, para a equipe marcar rapidamente. O detalhe de cada uma está nos
blocos acima e na [revisão de escopo](revisao-escopo-comite-gestor-2026-09-01.md).

| # | Decisão | Proposta |
|---|---|---|
| D-01 | Autoridade e fases | Homologar o PDF como **visão final**, dividido em MVP/F2/VF conforme CG-005. |
| D-02 | Dimensões de estado | Quatro dimensões independentes (CG-006), com a migração ali descrita. |
| D-03 | Rede da missão | `missao_rede` N:N, mínimo uma rede. |
| D-04 | Governança da aprovação | Modelo **B** — relator com registro da deliberação colegiada. |
| D-05 | Estimativa vs. despesa | Estimativa permitida antes da aprovação, **sem efeito no saldo**. |
| D-06 | Instituição canônica | Texto livre cria **referência provisória**, sinalizada e sujeita a conciliação; nunca vira instituição definitiva em silêncio. |
| D-07 | Realização da viagem | **Confirmação explícita e auditada.** O sistema abre pendência, não afirma o fato. |
| D-08 | Documentos e formatos | PDF/JPG/PNG no MVP; Office como download, se confirmado. Retenção e backup pendentes de resposta institucional. |
| D-09 | Checklist | Calculado e condicional; dispensa só por `admin` com justificativa. |
| D-10 | Evento reutilizável | **F2.** Permanece campo da atividade no MVP. |
| D-11 | Notificações | Gravar **outbox durável** no MVP e exibir caixa de entrada no sistema; e-mail institucional em F2. |
| D-12 | Identidade e pessoa | Vínculo `sub` ↔ `pessoa` é **pré-requisito do perfil Participante**, portanto F2. |
| D-13 | Dados pessoais | Comprovante financeiro e documento pessoal visíveis apenas a `admin`, ao Comitê em análise e ao próprio titular. Indicador consolidado **nunca** dá acesso ao documento de origem. |
| D-14 | Moeda estrangeira | Valor oficial em reais no MVP; ampliação aditiva se confirmada. |

---

## Folha de aprovação

Marque cada bloco. Um bloco aceito destrava as tasks da última coluna.

| Bloco | Decisão | Destrava |
|---|---|---|
| CG-005 — classificação das 40 seções | ☑ **Aceito em 2026-09-07** | recorte de todas as entregas |
| CG-005 — arquitetura da informação (§39) | ☑ **Aceito em 2026-09-05** | CG-040, CG-045, CG-047 |
| CG-006 — quatro dimensões de estado | ☑ **Aceito em 2026-09-07** | CG-010, CG-016, CG-034 |
| CG-006 — migração dos estados atuais | ☑ **Aceito em 2026-09-07** | CG-015 |
| CG-007 — matriz entidade–rede | ☑ **Aceito em 2026-09-07** | CG-016, CG-017 |
| CG-007 — matriz perfil–escopo e "Minha rede" | ☑ **Aceito em 2026-09-07** | CG-003, CG-028 |
| CG-008 — modelo B de aprovação | ☑ **Aceito em 2026-09-05, com um ajuste** | CG-019, CG-037, CG-038, CG-047, CG-048 |
| CG-009 — tabela requisito–momento–efeito | ☑ **Aceito em 2026-09-07** | CG-013, CG-050, CG-055 |
| CG-009 — modelo de despesas e cotações | ☑ **Aceito em 2026-09-07** | CG-013, CG-050 |
| CG-009 — formatos, tamanho e retenção | ☑ **Aceito em 2026-09-07** | CG-014, CG-051, CG-061 |
| CG-009 — checklist condicional e dispensa | ☑ **Aceito em 2026-09-07** | CG-058 |

### Decisões tomadas em 2026-09-05

O responsável pelo projeto aceitou a arquitetura da informação e o **modelo B**,
com um ajuste e uma restrição:

| Ponto | Proposta | Decisão |
|---|---|---|
| Quem envia para análise | Responsável pela missão **ou** Gestor da Rede | **Somente o responsável pela missão** |
| Documentos obrigatórios | Projeto + justificativa; demais condicionais | Aceito, **porém a lista não pode ser fechada no código**: cada missão pode exigir documentos diferentes, e um tipo novo não pode ficar impedido de ser cadastrado |
| Limite de rodadas | Sem limite, cada retorno numerado | Aceito |
| Quem reabre decisão | Somente `admin`, com justificativa | Aceito |
| Deliberação do Comitê | — | **Reunião semanal**, podendo haver semana sem reunião |

Consequências diretas de projeto:

1. **A data da reunião é informada, nunca derivada.** Como há semanas sem
   reunião, um calendário semanal calculado registraria deliberação que não
   houve. O relator informa a data, e o sistema só verifica que é uma data real
   e não futura.
2. **Os requisitos de submissão são dados, não código.** Uma constante com
   `['PROJETO', 'JUSTIFICATIVA']` atenderia hoje e bloquearia o primeiro tipo de
   missão diferente — exatamente o que a decisão proíbe. Por isso a CG-019 cria
   `requisito_submissao`, consultável por ciclo e tipo de missão.
3. **"Somente o responsável envia" ainda não é aplicável.** A regra depende de
   ligar o `sub` do Keycloak a um registro de `pessoa`, o que não existe (ver
   `AGENTS.md` §9). A coluna já está no schema; enquanto o vínculo não existir,
   quem submete é `admin`, e a restrição fica registrada como pendência.

### Decisões tomadas em 2026-09-07

O responsável **aceitou a matriz perfil–escopo** desta seção como está, o que
homologa a CG-003 e destrava a CG-028. Da matriz decorre que **quem valida a
prestação continua sendo o Administrador** — a coluna já dizia isso, e nenhuma
permissão nova é criada.

E respondeu as cinco perguntas que estavam abertas:

| Pergunta | Decisão | Efeito |
|---|---|---|
| Qual data define o **exercício** da despesa | **Manter como está**: quem lança informa | Nenhuma mudança. O campo `exercicio` continua obrigatório e livre, e não vira derivado de `data_documento` nem da viagem |
| **Retenção** de comprovantes e cotações | **4 anos** | Nada é apagado hoje — não existe exclusão em lugar nenhum do módulo, só inativação — então o sistema já excede o mínimo. Vira piso para o dia em que houver expurgo, e requisito da política de backup do `ARQUIVOS_DIR` |
| **DOC/XLS obrigatórios?** | **Só PDF por enquanto** | DOC/DOCX e XLS/XLSX saíram de `TIPOS_PERMITIDOS`. JPG e PNG ficam: são a galeria de evidências (CG-057), não documento |
| **Titular e suplente** nas equipes | **Só função em texto** | Nenhuma mudança: `membro_equipe_gestao.funcao` já é `varchar`. A ideia de modelar suplência sai do escopo |
| **Documentos exigidos no encerramento** | **Genérico e agnóstico** | Nenhum é semeado. O mecanismo (`requisito_submissao` com `momento = 'ENCERRAMENTO'`) fica pronto e vazio, e o checklist roda com os cinco fatos. Uma exigência cadastrada passa a valer sem deploy |

Sobre a retirada do Office: a restrição vale por si, não só pela simplificação.
Documento do Office é o vetor clássico de macro, e este projeto **ainda não tem
antivírus** — o ponto de inserção está marcado em `validarArquivo`, e até ele
existir cada formato a menos é uma porta a menos. Arquivos já enviados
continuam válidos e baixáveis: a validação acontece no envio, não na leitura.

### Decisões tomadas em 2026-09-07 (segunda rodada)

O responsável aceitou **as quatro folhas restantes como estão** — CG-005, CG-006,
CG-007 e CG-009. Não houve ajuste, e a folha acima passou a estar inteiramente
marcada.

O que isso significa na prática: **o código já seguia todas elas**. As tasks
foram construídas sobre as propostas deste documento desde 2026-09-01, e o que
faltava era o registro do aceite, não a implementação. Duas consequências,
porém, valem ser ditas em voz alta, porque afirmam coisas sobre dados que já
existem:

- **A migração de estados da CG-006** dá `CONFIRMADA → aprovação APROVADA` e
  `CONCLUIDA → realização REALIZADA` às missões cadastradas antes das quatro
  dimensões existirem. É uma afirmação sobre o passado, feita sem documento que
  a comprove — e por isso precisava de aceite explícito, não de inferência.
- **A classificação das 40 seções da CG-005** fixa o que fica fora do MVP. O
  Participante (F2) é o caso que mais aparece: ele está na matriz perfil–escopo
  e **não** foi implementado na CG-028, exatamente porque a folha o marca como
  fase seguinte.

Três decisões novas foram tomadas junto, e essas mudam ou dirigem código:

| Ponto | Decisão | Efeito |
|---|---|---|
| Relatórios oficiais (CG-068) | Os quatro: **missões, parceiros, finanças e resultados** | Define o escopo da CG-068 e, por consequência, o que a CG-069 exporta |
| Dossiê final da missão (CG-069) | **PDF único** | Foto e comprovante entram renderizados; não há pacote a montar do lado de quem recebe |
| Visibilidade de documento `RESTRITA` | **Administrador, Comitê Gestor e quem enviou** | Fechou uma contradição: a matriz da CG-003 dá ao Comitê leitura de todos os documentos, e a regra herdada da CG-014 o deixava de fora |

A visibilidade virou a permissão `documento:read-restrito`, concedida a `admin` e
`comite-gestor`. Antes a regra era `usuario.roles.includes('admin')` **dentro do
serviço** — papel no lugar de permissão, exatamente o que a indireção do módulo
de autorização existe para evitar. Quem enviou continua vendo o próprio arquivo
sem depender da permissão: é o único jeito de conferir o que acabou de subir, e
essa pessoa já conhece o conteúdo.

### Perguntas que só a equipe pode responder

Todas foram respondidas. O registro fica para quem precisar reconstituir por que
o sistema é como é:

1. ~~O Comitê Gestor delibera em reunião?~~ **Respondido em 2026-09-05:**
   reunião semanal, podendo haver semana sem reunião.
2. ~~Qual a regra institucional para escolher o **exercício** de uma despesa?~~
   **Respondido em 2026-09-07:** manter como está — quem lança informa.
3. ~~Existe exigência de **retenção mínima** dos comprovantes e das cotações?~~
   **Respondido em 2026-09-07:** 4 anos.
4. ~~Documentos Office (DOC/XLS) são realmente obrigatórios ou o PDF basta?~~
   **Respondido em 2026-09-07:** o PDF basta por enquanto.
5. ~~Haverá **titular e suplente** nas equipes?~~ **Respondido em 2026-09-07:**
   apenas função em texto.
6. ~~Quem valida uma prestação quando o acesso deixar de ser exclusivo de
   `admin`?~~ **Respondido em 2026-09-07:** o Administrador, como já previa a
   matriz perfil–escopo.

---

## O que não muda com este documento

- Nenhuma migration foi gerada, nenhum enum foi alterado, nenhum endpoint mudou.
- As tasks já concluídas continuam válidas; as evoluções serão tasks novas
  vinculadas a elas, conforme a regra da revisão de escopo.
- A separação RN-14 (o orçamento do Comitê Gestor não se mistura ao das bolsas)
  permanece intocada em todas as propostas acima.
