# Revisão de escopo — Módulo Bolsistas / Internacionalização

Documento recebido: `dados/novos_dados/ajustes_e_definicao/PROPOSTA DE ESTRUTURAÇÃO DO MÓDULO- BOLSISTAS.pdf`
(12 páginas, 8 módulos). Confrontado com o código em 2026-09-09.

Este documento é **análise e proposta**, não decisão. Segue o mesmo papel que
[revisao-escopo-comite-gestor-2026-09-01.md](revisao-escopo-comite-gestor-2026-09-01.md)
cumpriu para o Comitê Gestor: separar o que já existe, o que é trabalho novo e o
que **não pode ser implementado antes de uma decisão institucional**.

---

## 1. Resumo para continuidade

O PDF propõe oito módulos. Confrontados com o repositório:

| | Módulo do PDF | Situação |
|---:|---|---|
| 1 | Dashboard Internacional | **Parcial** — existe P01, mas com outra pergunta (financeira/planejamento) |
| 2 | Gestão de Missões/Mobilidades | **Decisão** — o nome colide com `missao_comite`; o conteúdo é P03 |
| 3 | Cadastro e Acompanhamento de Bolsistas | **Parcial** — P03 existe; faltam campos e **todo o eixo documental** |
| 4 | Instituições e Relacionamentos Internacionais | **Parcial forte** — base pronta (CG-017/025/026/027/049); faltam origem, situação e histórico de mobilidade |
| 5 | Gestão das Redes CAPES Global.Edu | **Parcial** — P07 cobre orçamento; faltam mobilidades, instituições e resultados por rede |
| 6 | Comitê Gestor | **Implementado além do pedido** — exceto reuniões/atas/deliberações, que **conflitam** com a CG-019 |
| 7 | Resultados e Impactos | **Parcial** — `produto_bolsa` e `produto_missao` existem; falta consolidação e tipos novos |
| 8 | Relatórios Gerenciais + Mapa Internacional | **Pendente para bolsas** — CG-068/CG-069 existem, mas só sobre missões |

**A leitura mais importante:** o PDF **não é um módulo novo**. Ele é, em boa
medida, a reescrita de P01, P02, P03, P04, P20 e P24 da
[system-structl.md](../system-structl.md) sob outro vocabulário, mais **quatro
requisitos genuinamente novos**:

1. **origem** e **situação do relacionamento** institucional (módulo 4);
2. **histórico de mobilidades por instituição** (módulo 4);
3. **documentos do bolsista** (módulo 3);
4. **dados de destino em profundidade** — departamento, programa, grupo de
   pesquisa, pesquisador responsável (módulos 2 e 4).

Os três conceitos da "Observação fundamental" do PDF — **histórico**,
**relacionamento**, **parceria** — são a contribuição conceitual do documento e
**hoje não estão separados no modelo**: `instituicao` responde só "existe", e
`convenio` responde só "há acordo". Não há onde registrar "há conversa, sem
acordo".

---

## 2. A ambiguidade central — decisão bloqueante D-B01

O módulo 2 do PDF chama-se **"Gestão de Missões/Mobilidades"**. Os campos que
ele lista são:

> Rede · Ano de execução · PPG UEA · Área temática · Modalidade (Doutorado
> Sanduíche, Professor Visitante, Capacitação 15 dias, Capacitação 1 mês) ·
> Instituição de destino · Período · Situação

Isso **não é** `missao_comite`. `missao_comite` é a viagem institucional do
Comitê Gestor: tem rodada de aprovação, prestação de contas, abatimento de
aporte, encerramento com checklist. Não tem modalidade de bolsa, não tem PPG
beneficiário, não consome vaga de planejamento.

O que o módulo 2 descreve é **`bolsa_concedida`** — a P03 que já existe.

O risco é literal e já foi enfrentado uma vez: a CG-056 recusou reaproveitar
`produto_bolsa` como produto de missão, com o argumento registrado no schema
([resultados.ts](../apps/api/src/database/schema/resultados.ts)) de que "são
duas cobranças diferentes sobre coisas diferentes". Implementar o módulo 2 sobre
`missao_comite` cometeria exatamente o erro que aquela decisão evitou, e desta
vez na tabela que sustenta aprovação e dinheiro.

Há ainda uma **duplicação interna do próprio PDF**: modalidade, período, país e
universidade de destino aparecem no módulo 2 (a mobilidade) *e* no módulo 3 (a
bolsa do bolsista). São o mesmo fato escrito duas vezes.

**D-B01 — decisão necessária:** "mobilidade" e "bolsa concedida" são um registro
só ou dois?

- **Proposta (recomendada):** são **um só**. `bolsa_concedida` é a mobilidade;
  `pessoa` é o bolsista, reutilizável entre concessões. O módulo 2 do PDF vira
  o enriquecimento de P03 + a visão consolidada P02, e o termo de interface
  passa a ser **Mobilidade**. Nada em `missao_comite` é tocado.
- **Consequência de decidir o contrário:** duas tabelas com período,
  modalidade e destino, que divergem na primeira edição — e a pergunta "quantas
  mobilidades houve?" passa a ter duas respostas.

Enquanto D-B01 não for homologada, **nenhuma migration do módulo 2 deve ser
escrita**.

---

## 3. Matriz dos oito módulos

Legenda: **Implementado** · **Parcial** · **Pendente** · **Decisão** (exige
homologação antes do código) · **Conflito** (contraria decisão já tomada).

### Módulo 1 · Dashboard Internacional

| Indicador pedido | Situação | Observação |
|---|---|---|
| Mobilidades realizadas | **Pendente** | Dado existe (`bolsa_concedida` + RN-16); não há indicador |
| Bolsistas cadastrados | **Parcial** | P03 tem o cartão "Bolsas cadastradas"; P01 não |
| Bolsistas por modalidade | **Parcial** | P01 tem `porModalidade`, mas de bolsas **planejadas**, não concedidas |
| Bolsistas por rede | **Pendente** | Só derivável por `itemPlanejado → areaTematica → rede`, e `itemPlanejadoId` é **nulável** |
| Bolsistas por país | **Pendente** | País é **texto livre** em `paisDestinoNome`; agrupar por texto conta grafias diferentes duas vezes |
| Bolsistas por instituição estrangeira | **Pendente** | Mesmo problema: `instituicaoDestinoNome` é texto |
| PPGs participantes | **Implementado** | Indicador `ppgs` em [painel.service.ts](../apps/api/src/dominio/painel.service.ts) |
| Instituições internacionais cadastradas | **Parcial** | Cadastro existe (P24); contagem não chega ao painel |
| Parcerias formalizadas | **Parcial** | `convenio` existe (CG-056), sem interface e sem contagem |
| Instituições em prospecção | **Pendente** | Depende da situação do relacionamento, que **não existe** |
| Recursos executados | **Decisão** | RN-12: no CAPES Global **não há execução na UEA** — a CAPES paga direto. O único "executado" real é o do Comitê (CG-055) |
| Produções acadêmicas geradas | **Parcial** | `produto_bolsa` e `produto_missao` existem, sem consolidação |
| Filtros (rede, ano, modalidade, país, PPG, temática) | **Pendente** | P01 hoje não tem filtro nenhum |

P01 hoje responde *"o plano cabe no orçamento?"*. O PDF pede *"o que a
internacionalização produziu?"*. São painéis diferentes, e o segundo depende de
P03 ter dados — que a seed não fornece, porque as planilhas não trazem
beneficiário individual.

### Módulo 2 · Missões/Mobilidades — campo a campo

| Campo do PDF | Hoje | Situação |
|---|---|---|
| Rede CAPES Global.Edu | derivável via `itemPlanejado → areaTematica → rede` | **Parcial** — quebra quando `itemPlanejadoId` é nulo (GCUB/Erasmus) |
| Ano de execução | derivado de `dataInicio` (usado em `exigirVaga`) | **Implementado** |
| PPG UEA | `bolsa_concedida.ppgId` | **Implementado** |
| Área temática | só via `itemPlanejado` | **Parcial** |
| Modalidade (as 4 do PDF) | `modalidade` + catálogo; as quatro estão na seed | **Implementado** |
| Instituição de destino — nome | `instituicaoDestinoNome` (**texto**); FK `instituicaoDestinoId` existe e **nunca é preenchida** | **Parcial** |
| — país | `paisDestinoNome` (**texto**); FK `paisDestinoId` idem | **Parcial** |
| — cidade | — | **Pendente** |
| — departamento/faculdade | existe em `instituicao.faculdadeDepartamento`, não na concessão | **Pendente** |
| — programa relacionado | — | **Pendente** |
| — grupo de pesquisa | — | **Pendente** |
| — pesquisador responsável | — | **Pendente** |
| — contato institucional | `contato_instituicao` existe; sem vínculo com a concessão | **Pendente** |
| Período (início, término, duração) | `dataInicio`, `dataFim`, `vigenciaMeses` | **Implementado** |
| Situação (Planejada/Em andamento/Finalizada/Cancelada) | `SELECIONADO`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`, `INTERROMPIDA` + situação temporal da RN-16 | **Decisão (D-B02)** |

**D-B02:** o PDF pede quatro situações; o sistema tem cinco estados
administrativos **mais** oito situações temporais derivadas de `current_date`
(`PROGRAMADA`, `PROXIMA`, `EM_VIGENCIA`, `PRESTES_A_EXPIRAR`, `EXPIRADA`…). As
duas dimensões existem pela mesma razão que separam aprovação e execução na
missão (CG-006): "planejada" e "ainda não começou" não são o mesmo fato. Colapsar
em quatro estados perderia os alertas de prazo, que já funcionam. A proposta é
**manter as duas dimensões e rotular** — `SELECIONADO` lê-se "Planejada",
`INTERROMPIDA` é a quinta que o PDF não previu e que a realidade exige.

**As FKs de país e instituição já existem em `bolsa_concedida` e estão mortas.**
O comentário no schema diz por quê: *"texto preserva origem e destino enquanto o
catálogo institucional não existe"*. Ele existe desde a CG-017. Ligar essas duas
colunas é o que destrava "bolsistas por país", "por instituição", o mapa (P04) e
o histórico de mobilidades do módulo 4 — é a **peça de maior alavancagem do
documento inteiro**.

### Módulo 3 · Cadastro de Bolsistas — campo a campo

| Campo do PDF | Hoje | Situação |
|---|---|---|
| Nome completo | `pessoa.nome` | **Implementado** |
| CPF | `pessoa.cpf`, validado, com RN-18 (uma modalidade por CPF/ciclo) | **Implementado** |
| E-mail | `pessoa.email`, opcional, único | **Implementado** |
| Telefone | — | **Pendente** |
| Instituição de origem | texto em `instituicaoOrigemNome`; FK existe, não usada | **Parcial** |
| Currículo Lattes | coluna `pessoa.lattes` **existe**; o formulário não captura | **Parcial** |
| ORCID | — | **Pendente** |
| PPG | herdado da linha do plano | **Implementado** |
| Nível (Mestrado/Doutorado/Docente) | `nivelBeneficiario` com 5 valores | **Implementado** (superconjunto) |
| Linha de pesquisa | `linha_pesquisa` existe **por PPG** (editável em P14), sem vínculo com a concessão | **Parcial** |
| Orientador | — | **Pendente** |
| Coordenador do PPG | derivável de `ppg.coordenadorId`; não exibido em P03 | **Parcial** |
| Modalidade | herdada do catálogo | **Implementado** |
| Agência financiadora | — (implícito: CAPES; `programa` cobre parte) | **Pendente** |
| Valor da bolsa | `valorConcedido`, vindo do catálogo | **Conflito parcial (D-B03)** |
| Período | datas completas + vigência | **Implementado** |
| País / universidade destino | texto livre | **Parcial** |
| **Documentos** (carta de aceite, plano de trabalho, relatórios, declarações, produtos) | **nada** — `entidade_anexo` não tem `BOLSA_CONCEDIDA` nem `PESSOA` | **Pendente** |

**D-B03:** o PDF lista "Valor da bolsa" como campo do formulário. A RN-01 é
explícita: valor de bolsa **nunca** vem digitado, vem do catálogo versionado, e
a CG do catálogo (2026-09-08) travou até a edição de item em uso. Manter o campo
como *exibição* e não como *entrada* é a proposta; digitá-lo reabriria a porta
que a versionagem do catálogo fechou.

**Documentos é o maior buraco concreto — e o mais barato de fechar.** Toda a
infraestrutura existe desde a CG-051/CG-052/CG-061: versionamento sem exclusão,
chave de armazenamento opaca, download por endpoint autenticado, validação por
conteúdo e não por extensão, `Content-Disposition` com fallback ASCII. Falta
acrescentar `BOLSA_CONCEDIDA` ao `entidade_anexo`, as categorias documentais do
bolsista, e herdar a permissão do alvo — exatamente como o `anexos.controller.ts`
já faz para missão, prestação e parceiro.

**Mas documentos de bolsista são dados pessoais sensíveis** (RG/CIN, CPF,
passaporte, comprovante de residência — previstos em P03 da especificação). Ver
D-B06.

### Módulo 4 · Instituições e Relacionamentos

| Item do PDF | Situação | Observação |
|---|---|---|
| Nome, país, cidade, site | **Implementado** | `instituicao` (CG-017) |
| Faculdade/Departamento | **Implementado** | `faculdadeDepartamento` |
| Área(s) de atuação | **Pendente** | Existe `area` no **contato**, não na instituição |
| Programa relacionado | **Pendente** | |
| Grupo de pesquisa | **Pendente** | |
| **Origem do relacionamento** (6 opções, obrigatório) | **Pendente** | Nada equivalente no schema |
| **Situação do relacionamento** (5 estados) | **Pendente** | Nada equivalente; é o eixo "relacionamento" da observação fundamental |
| Histórico de mobilidades na instituição | **Pendente** | `GET /parceiros/:id/historico` traz missões, contatos, eventos, documentos, convênios e produtos — **não traz bolsa** |
| Contatos (nome, cargo, depto, e-mail, telefone, área, obs.) | **Implementado** | `contato_instituicao` (CG-026): sete campos, todos presentes, com principal ativo único, deduplicação e inativação sem exclusão |
| Ficha de relacionamento consolidada | **Parcial** | O histórico é a base; falta o eixo mobilidade, as áreas e a situação. A exportação segue o padrão da CG-069 |
| Aviso "cadastro não garante bolsa/vaga" | **Pendente** | Texto de interface; barato e importante |

**D-B04 — a situação do relacionamento é derivada ou declarada?** Dois dos cinco
estados do PDF são **fatos verificáveis**: "Mobilidade realizada" (existe
`bolsa_concedida` apontando para a instituição) e "Parceria formalizada" (existe
`convenio` vigente). Os outros três — identificada, contato iniciado, cooperação
em avaliação — são **julgamento humano**, sem fato que os sustente.

Gravar os cinco como um enum editável cria o problema que a CG-058 já nomeou
sobre o checklist de encerramento: um estado guardado diverge do fato no dia
seguinte, e a tela passa a afirmar "apenas identificada" sobre uma instituição
que recebeu três bolsistas. A proposta é **híbrida**: gravar só o estágio
declarado (os três humanos) e **derivar** os dois verificáveis na leitura,
mostrando os dois lado a lado — a mesma solução das duas dimensões da CG-006.

**Origem do relacionamento**, ao contrário, é um fato histórico que só quem
cadastrou conhece: é enum gravado, obrigatório, e **imutável depois** (reescrevê-lo
apagaria a memória institucional que o PDF quer preservar).

### Módulo 5 · Gestão das Redes

| Item | Situação |
|---|---|
| Temas envolvidos | **Implementado** — P07 |
| PPGs participantes | **Implementado** — P07/P08 |
| Mobilidades | **Pendente** |
| Instituições relacionadas | **Parcial** — `instituicao_rede` existe; a P07 não mostra |
| Resultados | **Pendente** |

Já existe um consolidado por rede — a tabela da CG-067, dentro do painel do
Comitê — com missões, países, parceiros, eventos, convênios, produtos e despesa.
Ele resolve o formato; o que falta é a coluna de mobilidade. **Não criar uma
terceira tela que apura as mesmas redes**: é o argumento literal da CG-067, e ele
vale de novo aqui.

### Módulo 6 · Comitê Gestor

| Item do PDF | Situação |
|---|---|
| Integrantes | **Implementado** — `membro_equipe_gestao` |
| Instituição | **Implementado** — `pessoa.instituicaoId` |
| Função | **Implementado** — `funcao` |
| Rede vinculada | **Implementado** — `membro_equipe_gestao_rede` (e é o que sustenta o recorte da CG-028) |
| Planejamento | **Implementado** — aportes, execução, painel, relatórios |
| **Reuniões / Atas / Deliberações** | **Conflito (D-B05)** |

**D-B05:** a CG-019 homologou o **modelo B** — *o colegiado delibera fora do
sistema; o relator registra o parecer com a data da deliberação*. O sistema
**não simula reunião**, e `decisao_comite.reuniaoData` existe precisamente para
guardar a data de uma reunião que aconteceu em outro lugar. O PDF pede cadastro
de reuniões, atas e deliberações — o que reabre uma decisão fechada.

Proposta: **não** construir agenda de reuniões. O caminho compatível é permitir
**anexar a ata** à decisão já registrada (`entidade_anexo` + categoria `ATA`, que
já existe no enum) e mostrá-la no dossiê do relator. Isso entrega a memória
documental sem transformar o Gerenciador em sistema de colegiado.

### Módulo 7 · Resultados e Impactos

| Item | Situação |
|---|---|
| Artigos, livros, capítulos, eventos, trabalhos | **Implementado** — `tipo_produto_bolsa` tem os 10 tipos, incluindo `LIVRO` e `CAPITULO_LIVRO` |
| Projetos conjuntos, novas redes, novos acordos | **Implementado (missão)** — `tipo_produto_missao`: `PROJETO_PESQUISA`, `REDE_PESQUISA`, `CONVENIO`, `CAPTACAO_RECURSOS` |
| Cotutelas | **Parcial** — `TESE_COTUTELA` existe **só** em produto de missão, não em produto de bolsa |
| Orientações conjuntas | **Pendente** nos dois enums |
| Publicações internacionais | **Parcial** — `PUBLICACAO` existe, sem eixo "internacional" |
| Impacto institucional (PPG beneficiado, nº de pesquisadores, novas oportunidades, expansão) | **Pendente** — nenhum indicador consolidado |

Os dois domínios de produto continuam separados **e devem continuar** (CG-056).
O que o PDF pede é uma **leitura consolidada por cima dos dois**, que é P18/P19 —
fase 2 na especificação atual.

### Módulo 8 · Relatórios e Mapa

| Item | Situação |
|---|---|
| Relatório CAPES (mobilidades, bolsistas, instituições, valores, resultados) | **Pendente** — CG-068 cobre missões, não bolsas |
| Relatório Institucional (mapa de parceiros, países, evolução) | **Pendente** |
| Exportação | **Padrão pronto** — CG-069: síncrona, sem gravar em disco, autorização é a da própria consulta, fórmula neutralizada na escrita, XLSX escrito à mão, PDF com `pdfkit` + `pdf-lib` |
| Mapa internacional (P04) | **Pendente** — **bloqueado por país como texto livre** |

A CG-069 deixou o mecanismo pronto. O relatório de bolsas cai nele **desde que**
o filtro dos relatórios seja o mesmo da lista — a regra que a CG-068 verificou
por mutação e que vale igual aqui: não pode existir uma segunda origem.

---

## 4. Decisões bloqueantes — **todas homologadas em 2026-09-09**

As sete foram decididas conforme a proposta. A folha preenchida está em
[homologacao-bolsistas.md](homologacao-bolsistas.md), junto de uma oitava
decisão que nasceu na BOL-021 (enviar documento pessoal exige a mesma permissão
de abri-lo). A tabela abaixo permanece como registro do que se considerou.

**Nada no módulo está mais bloqueado por decisão.** O que resta é trabalho.

| # | Decisão | Proposta | Impacto se decidida ao contrário |
|---|---|---|---|
| **D-B01** | "Mobilidade" e "bolsa concedida" são um registro só? | **Sim, um só.** `bolsa_concedida` é a mobilidade | Duas tabelas com período/modalidade/destino que divergem; "quantas mobilidades?" passa a ter duas respostas |
| **D-B02** | Colapsar as situações em quatro? | **Não.** Manter estado administrativo + situação temporal (RN-16), rotulando | Perde os alertas de prazo que já funcionam |
| **D-B03** | Valor da bolsa é digitável? | **Não.** Exibição vinda do catálogo (RN-01) | Reabre a porta que a versionagem do catálogo fechou |
| **D-B04** | Situação do relacionamento é gravada ou derivada? | **Híbrida** — grava o estágio declarado, deriva mobilidade e parceria | Enum puro: a tela afirma "só identificada" sobre instituição com três bolsistas |
| **D-B05** | Cadastrar reuniões, atas e deliberações? | **Não.** Anexar a ata à decisão já registrada (modelo B da CG-019) | Reabre decisão homologada e duplica o registro do parecer |
| **D-B06** | Quem vê documento pessoal de bolsista? | **Definir antes do upload** | Ver abaixo |
| **D-B07** | O que significa "recursos executados" no CAPES Global? | **Definir** — RN-12 diz que não há execução na UEA | Indicador que sempre mostra zero, ou que mistura o aporte do Comitê com bolsas (proibido pela RN-14) |

**D-B06 é a mais séria.** Hoje P03 é aberta a quem tem `bolsa:read`, e o recorte
por PPG (`RECORTE_OBRIGATORIO`, §6 do AGENTS.md) **ainda não se aplica a bolsas**
— só a listagem e o detalhe de PPG o consultam. Acrescentar CPF, telefone,
passaporte e comprovante de residência a uma tela sem recorte multiplica o dano
de um acesso indevido. A CG-061 já resolveu o lado técnico (UUID validado,
permissão herdada do alvo, `RESTRITA` com `documento:read-restrito`); o que falta
é a política e o recorte da consulta.

A recomendação é **inverter a ordem natural**: aplicar o recorte por PPG a
`bolsa_concedida` **antes** de abrir o upload de documento pessoal, e não depois.

---

## 5. Backlog proposto

Prefixo `BOL-`. Ordem por dependência, não por valor percebido.

### Fase 0 — homologação (sem código)

- [x] **BOL-001** Folha de homologação com D-B01 a D-B07, no formato de
      [homologacao-comite-gestor.md](homologacao-comite-gestor.md).
      Concluída em 2026-09-09: [homologacao-bolsistas.md](homologacao-bolsistas.md).
- [ ] **BOL-002** Mapear os 8 módulos do PDF para as páginas P01–P04, P20, P24 da
      especificação e fixar o vocabulário de interface (**Mobilidade**, não
      "missão"). Atualizar a [system-structl.md](../system-structl.md).
      *D-B01 e D-B02 homologadas:* `bolsa_concedida` **é** a mobilidade, e a
      situação continua em duas dimensões — `SELECIONADO` passa a se ler
      "Planejada" na interface, e é a única mudança de rótulo pendente.

### Fase 1 — fundação de dados (destrava quase tudo)

- [x] **BOL-010** Ligar `bolsa_concedida.paisDestinoId` / `paisOrigemId` e
      `instituicaoDestinoId` / `instituicaoOrigemId` ao cadastro central.
      **Concluída em 2026-09-09.** *Destrava: bolsistas por país, por
      instituição, mapa (P04), histórico do módulo 4, relatórios.*

      **Nenhuma migration foi necessária** — as quatro chaves estrangeiras já
      existiam no schema desde o início e estavam mortas, porque o serviço
      gravava só o texto. A BOL-010 é serviço, API e interface.

      Decisões aplicadas (2026-09-09): país **sempre** do catálogo ISO;
      instituição do **catálogo ou digitada**, espelhando `missao_atividade`;
      busca de instituição **no servidor**, com TanStack Query.

      Quatro regras que a implementação registra:

      - **Exatamente uma coluna por ponta.** FK quando veio do catálogo, texto
        quando foi digitada — nunca as duas. Gravar ambas criaria a chance de
        discordarem quando a instituição for conciliada (CG-025), e a leitura
        teria de escolher sem conseguir justificar a escolha.
      - **`coalesce(join, texto)` na leitura**, com o join primeiro: conciliar
        ou renomear um cadastro central se propaga para a bolsa já registrada,
        e a instituição digitada continua aparecendo.
      - **Endpoint próprio com `bolsa:read`**, não `/parceiros`. Quem cadastra
        bolsa é `coordenador` ou `secretaria`, e nenhum dos dois tem
        `parceiro:read` — que governa também os contatos, com dados pessoais
        que essas funções não precisam ver para escolher uma universidade.
      - **As referências são validadas antes de `exigirVaga`**, que trava a
        linha de `planejamento_anual` com `for update`: validar depois manteria
        o lock preso durante leituras que só podem recusar a requisição.

      Verificação: 488 testes de integração, 68 unitários da API, 117 na web
      (9 novos em `test/bolsa-concedida.test.mjs`), lint, build e os dois
      smokes. O `smoke:telas` roda como `coord.teste` — que tem `bolsa:write` e
      não tem `parceiro:read` —, então a decisão de permissão está verificada
      ponta a ponta, e não só por leitura do mapa de papéis.

      O formulário migrou para React Hook Form + Zod na mesma task, como manda
      o §7 do AGENTS.md. `FormEditarBolsa` **não** migrou: a BOL-010 não o
      altera, e migrá-lo junto seria a reescrita ampla que a convenção exclui.
- [x] **BOL-011** Rede e área temática resolvidas na própria concessão, para a
      bolsa sem `itemPlanejadoId` (GCUB, Erasmus) não ficar fora de todo
      agrupamento por rede.
- [x] **BOL-012** Campos pessoais faltantes: telefone, ORCID; e capturar o
      `lattes`, cuja coluna já existe e o formulário ignora.
- [x] **BOL-013** Vínculo acadêmico: linha de pesquisa (reusando `linha_pesquisa`
      do PPG, que já é editável em P14) e orientador (`pessoa`, reutilizável).

**Concluídas em 2026-09-09, numa migration só** (`0035`), porque as três tocam
as mesmas tabelas e o mesmo formulário. Três decisões que valem registrar:

- **Rede e temática ficam na concessão, não na pessoa nem só no item.**
  `bolsa_concedida.area_tematica_id` é nulo apenas para o que já existia; a
  leitura usa `coalesce` com o item planejado. Guarda a temática e **não a
  rede**, que se deriva de `area_tematica.rede_id` — gravar as duas criaria a
  chance de discordarem.
- **Linha de pesquisa e orientador ficam na concessão, não em `pessoa`.**
  Descrevem *esta* bolsa: a linha pertence ao PPG desta concessão, e a mesma
  pessoa pode ser bolsista aqui e docente em outro programa. Em `pessoa` os dois
  campos teriam de valer para todos os vínculos ao mesmo tempo. A API **recusa**
  linha de outro PPG — a FK sozinha aceitaria, e a ficha exibiria a linha errada.
- **O orientador é informado por nome e resolvido para `pessoa`**, criando-o
  como `DOCENTE` se não existir. Exigir cadastro prévio faria a equipe deixar o
  campo vazio, que é pior que um vínculo aproximado.
- **O ORCID aceita `X` no último caractere** — é o dígito verificador do padrão,
  e tratá-lo como numérico recusaria um em cada onze ORCIDs válidos. Há `check`
  no banco e regressão dos dois lados.

### Fase 2 — acesso e documentos (nesta ordem, por D-B06)

- [x] **BOL-020** Aplicar o recorte por PPG às consultas de `bolsa_concedida`.
      **Concluída em 2026-09-09.** Cobre listagem, detalhe, opções de
      planejamento, concessão, edição e produtos.

      **A P03 não muda de comportamento hoje**, e isso é o ponto: com
      `RECORTE_OBRIGATORIO = false` e ninguém com escopo atribuído, todo mundo
      continua vendo tudo. O que a task entrega é a máquina no lugar, com os
      dois modos testados — de forma que virar a flag feche as bolsas junto com
      os PPGs, em vez de deixar a P03 aberta sem ninguém notar.

      Quatro decisões registradas no código:

      - **404, nunca 403.** A existência da concessão já é o dado protegido:
        dizer "existe, mas não é sua" entrega que aquela pessoa tem bolsa.
      - **O produto herda o recorte da bolsa**, sem recorte próprio. Sem isso
        `produto:write` seria a porta lateral — conhecer o UUID bastaria para
        escrever na bolsa de outro PPG, a mesma falha que a CG-051 fechou nos
        anexos.
      - **A escrita usa o modo permissivo**, não a regra estrita de
        `RecorteDeMissoes.alcanca`. Os dois casos só parecem iguais:
        `gestor-rede` nunca foi atribuído a ninguém, e fechar a escrita de
        missão não tira nada de ninguém; `bolsa:write` é do `coordenador`, que
        trabalha hoje sem escopo, e fechar pararia o cadastro no mesmo instante.
      - **`opcoesPlanejamento` também é recortada.** Sem isso o formulário
        ofereceria a vaga de outro PPG e a escolha só morreria na checagem de
        escrita, depois do cadastro inteiro preenchido.

      Verificação: 8 casos novos em
      [escopo-bolsas.int-spec.ts](../apps/api/test/escopo-bolsas.int-spec.ts) —
      496 de integração no total. **Seis dos oito foram verificados por
      mutação**: substituir o filtro por `true` e as checagens por `false`
      derruba-os. Os dois que sobrevivem são justamente os que devem
      sobreviver — o do modo permissivo, que espera ver tudo, e o de `atualizar`,
      que a mutação não alcançou.

      Um efeito colateral que vale conhecer: a RN-18 (uma modalidade por CPF no
      ciclo) continua **global**, como tem de ser — checá-la por PPG deixaria o
      mesmo CPF obter duas modalidades por dois PPGs. Isso significa que um
      coordenador recortado pode ouvir "este CPF já utilizou outra modalidade
      neste ciclo" sobre uma concessão que ele não enxerga. A mensagem não nomeia
      PPG nem modalidade, então não vaza mais que a existência do conflito — que
      é o mínimo para a regra ser aplicável.
- [x] **BOL-021** `BOLSA_CONCEDIDA` no `entidade_anexo` + categorias documentais
      do bolsista. **API concluída em 2026-09-09** (migration `0034`); a tela
      ainda não existe — ver abaixo.
- [x] **BOL-022** Política de visibilidade do documento pessoal.
      **Concluída em 2026-09-09**, junto da BOL-021, porque a decisão D-B06 as
      resolveu de uma vez.

      Decisões homologadas em 2026-09-09 e aplicadas:

      - **A categoria decide a visibilidade, nunca o cliente.** Documento
        acadêmico (carta de aceite, plano de trabalho, relatório, declaração,
        publicação) nasce `INTERNA` e segue o recorte por PPG; documento pessoal
        (`DOCUMENTO_IDENTIDADE`, `PASSAPORTE`, `COMPROVANTE_RESIDENCIA`) nasce
        `PESSOAL`, e o serviço **sobrescreve** o que veio no corpo — aceitar
        `INTERNA` junto de um passaporte tornaria a decisão contornável por quem
        faz o upload.
      - **`documento:read-pessoal` é permissão nova**, concedida a `admin` e
        `secretaria`. Reusar `documento:read-restrito` daria passaporte de
        bolsista ao Comitê Gestor — cujo escopo é a missão institucional — e
        deixaria de fora a secretaria, que instrui o processo na CAPES.
      - **`PESSOAL` e `RESTRITA` não são níveis, são públicos diferentes.**
        `podeVer` mapeia visibilidade → permissão com um `if` explícito, não com
        um `||` entre as duas: o `||` daria a cada permissão o alcance da outra,
        que é a decisão ao avesso.
      - **A retenção é derivada, nunca gravada**: fim da concessão + 5 anos,
        calculado na leitura e exposto só em documento pessoal. `data_fim` é
        editável, então uma coluna gravada divergiria da política na primeira
        correção de período — mesma razão pela qual o checklist da CG-058 não é
        persistido. **Não existe expurgo automático**, aqui nem em lugar nenhum
        do sistema; o campo torna a política conferível, executá-la segue sendo
        ato humano. Fica registrado como pendência.

      **Correção de segurança encontrada no caminho, e que não é do módulo:**
      `AnexosService.enviar` verificava apenas a permissão (`exigir`) enquanto
      **todas** as outras operações passavam por `exigirAcesso` — permissão
      **mais** recorte. Na prática, quem não alcançava uma missão de outra rede
      (CG-028) ainda conseguia **pendurar** um documento nela conhecendo o UUID:
      não dava para ler de volta, mas dava para injetar. Corrigido para todos os
      tipos de entidade, não só para bolsa. As suítes existentes de anexos e de
      escopo por rede continuam passando.

      Verificação: 7 casos em
      [documentos-bolsista.int-spec.ts](../apps/api/test/documentos-bolsista.int-spec.ts),
      503 de integração no total. O caso do recorte falhava antes da correção
      acima e passa depois — é a evidência de que ele mede o que promete.

      **A tela entrou em seguida, no mesmo dia**, em
      `/mobilidade/bolsistas/[id]`: seção *Documentos do bolsista* com tabela,
      download pelo endpoint autenticado e envio em sidesheet com React Hook
      Form. Três decisões de interface:

      - **A tela não refiltra o que a API já filtrou.** Documento pessoal
        simplesmente não chega para quem não tem `documento:read-pessoal`; um
        segundo filtro no cliente seria um segundo lugar para divergir.
      - **Não há seletor de visibilidade.** Quem decide é a categoria, na API.
        Oferecer a escolha faria a primeira pessoa a marcar "interna" achar que
        publicou — e não publicou.
      - **A categoria pessoal só é oferecida a quem pode abri-la.** A API
        aceitaria o envio de qualquer um com `bolsa:write`, e quem envia
        continua vendo o próprio arquivo; o que a tela evita é *convidar* o
        coordenador a juntar passaporte que ele não vai poder reabrir. É
        orientação de interface, não autorização — **vale confirmar com a
        PROPESP se o envio também deve ser restrito na API.**

      **Um arquivo por envio**, ao contrário da galeria de evidências (CG-057):
      lá o upload múltiplo funciona porque data, local e autoria descrevem a
      ocasião e valem para a seleção inteira; aqui cada arquivo tem categoria
      própria, e um envio múltiplo pediria a categoria arquivo a arquivo — que
      é o formulário de novo.

      Verificado em execução, e não só por build: com uma concessão temporária
      no banco de desenvolvimento, a página respondeu 200 com a seção e o estado
      vazio; o upload de um passaporte **enviado com `visibilidade=INTERNA` de
      propósito** foi gravado como `PESSOAL`, provando que a sobrescrita vale no
      caminho real; e a tela mostrou o selo *Pessoal* e "Guardar até
      31/08/2032" — cinco anos após o fim da concessão. O registro temporário
      foi removido depois.

### Fase 3 — relacionamento institucional (módulo 4)

*Destravada por D-B04, homologada em 2026-09-09: grava os três estágios de
julgamento humano, deriva "mobilidade realizada" e "parceria formalizada".*

- [x] **BOL-030** Origem do relacionamento: enum obrigatório e imutável em
      `instituicao`, com as seis opções do PDF.
- [x] **BOL-031** Situação do relacionamento, no modelo híbrido de D-B04:
      estágio declarado gravado, mobilidade e parceria derivadas na leitura.
- [x] **BOL-032** Áreas de atuação, programa relacionado e grupo de pesquisa na
      instituição.
- [x] **BOL-033** Histórico de mobilidades no `GET /parceiros/:id/historico` —
      **por `exists` + `selectDistinct`, nunca por `join`**: é a garantia que a
      CG-027 verificou por mutação e que uma bolsa ligada a duas redes quebraria.
      **Depende de BOL-010.** O contrato já tem a porta: `modulosPendentes`
      permanece no retorno desde a CG-056 exatamente para o próximo módulo do
      escopo entrar sem quebrar quem já consome.
- [x] **BOL-034** Ficha de relacionamento exportável, no padrão da CG-069.
- [x] **BOL-035** Aviso, na ficha e na lista, de que o cadastro não representa
      garantia de vaga, bolsa ou mobilidade futura.

**Concluída em 2026-09-09** (migration `0036`), com D-B04 já homologada.

- **A origem é gravada e imutável.** `atualizarParceiroSchema` simplesmente não
  a tem, e o campo enviado a mais é descartado — reescrevê-la apagaria a memória
  de como o relacionamento começou, que é o que o módulo existe para preservar.
  É obrigatória no cadastro e **nula no banco**, porque as instituições
  anteriores ao campo não têm como responder: um default inventaria "prospecção
  institucional" para elas.
- **Só três dos cinco estados são gravados.** "Mobilidade realizada" e "parceria
  formalizada" saem de `exists` na própria consulta — sobre `bolsa_concedida` e
  sobre `convenio` vigente. O teste prova o ponto: inserir uma bolsa faz
  `mobilidadeRealizada` virar `true` **sem ninguém editar o cadastro**, que é
  exatamente o que um enum gravado não faria.
- **`exists` e não `join`**, pela regra da CG-016: com join, a instituição que
  recebeu três bolsistas apareceria três vezes na lista.
- **O histórico traz uma linha por concessão**, com a ponta resolvida por `case`
  dentro da própria linha. A instituição pode ser origem *e* destino da mesma
  bolsa — dupla titulação —, e um `or` dentro de `join` a traria duas vezes. Há
  regressão para esse caso.
- **Áreas de atuação é texto livre, de propósito.** Sem taxonomia mantida,
  "Ciências Ambientais" e "Ciências ambientais" virariam duas áreas e toda
  contagem sairia errada — foi o que aconteceu com evento contado pelo nome
  (CG-067). O campo descreve; contar por área fica para quando houver taxonomia.
- **O aviso da BOL-035 está na ficha**, ao lado dos dois eixos de situação.

**A BOL-034 fechou a Fase 3 em 2026-09-09.** `GET /parceiros/:id/ficha` devolve
a ficha consolidada em PDF, reusando `gerarPdf` da CG-069. Três decisões:

- **PDF apenas**, e não os três formatos dos relatórios. A ficha é um
  *documento* — sete seções de natureza diferente, para circular fora do
  sistema —, não uma tabela: espremer contatos, mobilidades, missões e convênios
  num CSV único produziria uma planilha que não responde nenhuma das perguntas
  inteiras. Mesma razão do dossiê da missão.
- **A autorização é a da própria consulta**: chama `historico`, o mesmo método
  da tela, sem checagem paralela. `parceiro:read`, porque exportar é ler noutro
  formato.
- **"Pesquisadores envolvidos" é deduzido das mobilidades.** Não há cadastro de
  "pesquisador desta instituição", e inventar um criaria um vínculo que ninguém
  declarou. Quem esteve envolvido é quem aparece nas ações registradas — a única
  afirmação que os dados sustentam.

O aviso da BOL-035 vai **dentro do PDF**, e não só na tela: é a ficha que
circula fora do sistema, onde o contexto se perde.

`responderArquivo` saiu de `programas.controller.ts` para `comum/`, porque
duplicá-lo duplicaria também a armadilha do `resposta.send` — com
`@Res({ passthrough: true })` o Nest serializa o `Buffer` como JSON e o arquivo
baixado fica inútil, com os cabeçalhos ainda corretos.

### Fase 4 — visões consolidadas

- [x] **BOL-040** P02 · Panorama de mobilidade, com os filtros do PDF refletidos
      na URL. **Depende de BOL-010/011.**
- [x] **BOL-041** P01 revisto: cartões de internacionalização ao lado — e não no
      lugar — dos indicadores financeiros, com filtros. *D-B07 homologada:* o
      cartão soma o valor das concessões e se chama **Custo das bolsas
      concedidas**, nunca "executado" — a RN-12 diz que nada passa pelo caixa da
      UEA, e a RN-14 proíbe somá-lo à execução do Comitê.
- [x] **BOL-042** P04 · Mapa internacional. **Depende de BOL-010.**
- [x] **BOL-043** Mobilidades, instituições e resultados por rede, **dentro** do
      consolidado da CG-067 e não em tela nova.
- [x] **BOL-044** Relatórios de bolsas e exportações, reusando o filtro da lista
      — sem segunda origem (regra da CG-068) — e o mecanismo da CG-069.

**A BOL-040 entrou em 2026-09-09**: `GET /mobilidade/panorama` e a tela
`/mobilidade`, que saiu de "ainda por vir" no menu. É a primeira tela que
responde *o que a internacionalização produziu*, ao lado da P01, que responde
*o plano cabe no orçamento*.

- **Um filtro só, montado uma vez.** Cartões, sete quebras e a série recebem o
  mesmo objeto `SQL` — a lição da CG-066 aplicada de saída. Há regressão que
  falha se alguma quebra tiver `where` próprio.
- **O recorte por PPG entra no mesmo objeto**, então nenhuma quebra pode
  esquecê-lo: a garantia é por construção, não por disciplina de quem escrever a
  próxima consulta. Também com regressão.
- **`item_planejado` entra por `left join` em toda consulta que precisa de
  rede.** Um `join` excluiria a bolsa vinda de fora do planejamento — o buraco
  que a BOL-011 fechou.
- **A concessão com destino digitado à mão entra no total e fica fora das
  quebras por país e por instituição**, e o aviso viaja junto com o número, na
  tela. Sem ele, quem somasse as linhas acharia que a tela erra — mesma regra do
  consolidado por rede (CG-067).
- **Os filtros são navegação, não estado de cliente**: cada um muda a página
  inteira e a URL precisa ser compartilhável. TanStack Query serve busca
  incremental, que aqui não existe.

**BOL-041, BOL-043 e BOL-044 entraram em 2026-09-09**, junto da BOL-040.

- **BOL-041 · P01.** A seção *Internacionalização neste ciclo* fica **ao lado**
  dos indicadores financeiros, e não no lugar deles: a P01 responde "o plano
  cabe no orçamento?" e a seção nova responde "o que já aconteceu?". Os números
  vêm do **panorama**, filtrado por `cicloId` — não de um cálculo próprio da
  P01. Duas telas que somam as mesmas concessões por caminhos diferentes
  divergem, e quem clicasse daqui para `/mobilidade` encontraria outra
  contagem. D-B07 aplicada: o cartão se chama **Custo das bolsas concedidas**.
- **BOL-043 · consolidado por rede.** Método próprio em vez de mais colunas na
  quebra genérica: as outras sete respondem "quantas e quanto", esta responde
  também "com quantos parceiros e com que resultado". **Alcance é `distinct` e
  produto entra por subconsulta, nunca por `join`** — um join com
  `produto_bolsa` faria a bolsa de três produtos virar três linhas e inflar
  mobilidades e valor junto; há regressão exatamente para isso. Concessão sem
  temática cai em "Sem rede vinculada" em vez de sumir, e o aviso da CG-067
  sobre somar colunas de alcance viaja com a tabela.
- **BOL-044 · relatório exportável** em CSV, XLSX e PDF, pelo mecanismo da
  CG-069. **Mesmo filtro e mesmo recorte do panorama**, pela mesma função
  `condicao` — não existe segunda origem, e a regressão cruza o total do
  panorama com a contagem das linhas do relatório. A exportação leva o filtro
  da URL.

**A BOL-042 fechou a Fase 4 em 2026-09-09.** Decisão tomada: **mapa-múndi de
verdade**, com `react-simple-maps` 5 (que declara suporte a React 19) e o
topojson do `world-atlas` — as duas primeiras dependências de visualização
geográfica do projeto.

- **O casamento é pelo código numérico da ISO 3166-1.** `pais` ganhou
  `codigoNumerico` (migration `0038`), gerado da base `iso-codes` do sistema e
  **conferido contra os 249 pares ISO2/ISO3 que já existiam** — nenhuma
  divergência. Casar por nome em inglês falharia em silêncio: o topojson escreve
  "W. Sahara" onde o ICU escreve "Western Sahara", e país sem cor é
  indistinguível de país sem mobilidade.
- **A seed virou upsert** para as 249 linhas antigas receberem o campo. Com
  `onConflictDoNothing`, o mapa ficaria em branco sem nenhum erro.
- **A cor sai de `var(--token)` no SVG**, nunca resolvida em JavaScript: um
  `getComputedStyle` na montagem congelaria a cor do tema ativo, e trocar de
  tema deixaria o mapa claro sobre fundo escuro (§8 do AGENTS.md).
- **O mapa acompanha a tabela, não a substitui.** O SVG é `aria-hidden` e a
  legenda vai no `figcaption`: repetir 177 nomes de país na árvore de
  acessibilidade não ajudaria ninguém, e é a tabela que serve leitor de tela.

### Fase 5 — resultados

- [x] **BOL-050** Cotutela e orientação conjunta em `tipo_produto_bolsa`.
      **Concluída em 2026-09-09** (migration `0037`). `TESE_COTUTELA` já existia
      em `tipo_produto_missao` e faltava no de bolsa — e o lado que faltava é o
      que importa: a cotutela é acordo sobre a tese **deste** bolsista, cobrada
      dele, não um resultado institucional da viagem do Comitê.
      `ORIENTACAO_CONJUNTA` entrou nos dois.
- [x] **BOL-051** Leitura consolidada de produção sobre os dois domínios de
      produto, sem fundi-los (P18/P19). **Concluída em 2026-09-09** —
      `GET /mobilidade/producao` e a tela `/producao`, que saiu de "ainda por
      vir" no menu. **`union all`, não `join`**: as duas tabelas não se
      relacionam e não há chave que as ligue — o que existe é a pergunta comum.
      A coluna *Origem* marca cada linha, para que a soma não apague a
      diferença que a CG-056 preservou. O produto de missão só entra para quem
      tem `missao:read`, e a rota exige `bolsa:read` **e** `produto:read`: quem
      tem só uma das leituras veria metade sem saber que é metade.
- [x] **BOL-052** Ata anexável à decisão do Comitê. **Concluída em 2026-09-09**
      (migration `0037`). `DECISAO_COMITE` entrou em `entidade_anexo`, que a
      excluía de propósito — e o motivo registrado era outro: o *documento
      analisado* se prende à missão, e a decisão apenas o fotografa (CG-019).
      A ata não é documento analisado: é o registro do ato que a decisão
      descreve, e `decisao_comite` é tabela real, então o vínculo polimórfico
      tem alvo. **Só a categoria `ATA` é aceita ali** — qualquer outra
      confundiria o comprovante da deliberação com os documentos analisados.
      Escrever exige `missao:decide`, não `missao:edit`: quem registra a
      decisão é quem anexa a ata dela. O recorte por rede alcança a ata por
      duas junções até a missão. O modelo B da CG-019 permanece intocado.

---

## 6. Convenção técnica do módulo

Confirmada em 2026-09-09: implementação **e refatoração** usam a biblioteca de UI
já instalada — React Hook Form 7 + Zod 4 nos formulários, Radix/cmdk nos
primitivos ricos (`Combobox`, `Comando`), TanStack Query sobre `/api/bff/*` para
busca depois da primeira pintura. Sem dependência nova.

O `Sidesheet` continua `<dialog>` nativo. `apiFetch` continua `server-only`.
Os quatro padrões obrigatórios estão em [migracao-ui.md](migracao-ui.md) e este
módulo não abre exceção a nenhum.

Consequência já identificada: `form-bolsa-concedida.tsx` ainda usa
`useActionState` + `FormData` + `Multistep`. Pela regra do §7 do AGENTS.md, ele
migra para RHF/Zod **na primeira task que o alterar** — a BOL-010 —, e não numa
reescrita ampla à parte.

---

## 7. O que não fazer

- **Não construir o módulo 2 sobre `missao_comite`.** É o erro que a CG-056
  evitou, aqui na tabela que sustenta aprovação e dinheiro.
- **Não fundir `produto_bolsa` com `produto_missao`.** Continuam sendo duas
  cobranças sobre coisas diferentes.
- **Não tornar o valor da bolsa digitável** (RN-01, e a decisão de 2026-09-08
  sobre o catálogo).
- **Não criar cadastro de reuniões** antes de D-B05: contraria o modelo B da
  CG-019.
- **Não abrir upload de documento pessoal antes de BOL-020.**
- **Não criar tela nova por rede** — a CG-067 já decidiu que a terceira tela a
  apurar as mesmas linhas é a terceira a divergir.
- **Não agrupar por país ou instituição enquanto forem texto livre.** O aviso da
  CG-067 sobre evento contado pelo nome vale igual: o mesmo país escrito de duas
  formas conta duas vezes, e o número sai errado sem nada na tela dizendo isso.
