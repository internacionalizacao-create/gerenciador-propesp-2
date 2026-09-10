# Pacote de homologação — Módulo Bolsistas / Internacionalização

Origem: `dados/novos_dados/ajustes_e_definicao/PROPOSTA DE ESTRUTURAÇÃO DO MÓDULO- BOLSISTAS.pdf`,
auditado em [revisao-escopo-bolsistas-2026-09-09.md](revisao-escopo-bolsistas-2026-09-09.md).

Materializa a **BOL-001**. Contém as sete decisões que bloqueiam o módulo, com a
proposta técnica, o argumento que a sustenta e — o que mais importa — **o que
acontece se for decidido ao contrário**.

**Todas as sete foram homologadas em 2026-09-09**, conforme a proposta de cada
uma. A folha de aprovação preenchida está no fim, com o que cada decisão já
produziu. O texto de cada seção permanece como registro do que se considerou —
é o que permite reconstituir *por que* o sistema é como é, e não só *como* ele é.

---

## Por que este documento e não código

Duas das sete decisões mudam o modelo de dados de forma irreversível na prática:
D-B01 define se "mobilidade" é uma tabela nova ou a que já existe, e D-B04 define
se a situação do relacionamento é um campo gravado ou uma leitura derivada.
Migration escrita antes da resposta é migration que a resposta joga fora — e, no
caso de D-B01, junto com os dados que ela já tiver movido.

As outras cinco não mudam o schema, mas mudam o que o sistema **afirma**. Um
sistema institucional que afirma a coisa errada é pior que um incompleto: a
CG-058 registrou isso ao proibir gravar o checklist de encerramento, e a CG-067
ao avisar na tela que a linha "Total do ciclo" não é a soma da coluna.

O precedente é o [pacote do Comitê Gestor](homologacao-comite-gestor.md): as
fundações estruturais avançaram, as decisões institucionais esperaram o aceite, e
as 69 tasks fecharam sem retrabalho de modelo.

---

## Como usar

Cada decisão traz **Proposta**, **Por quê** e **Se for decidido ao contrário**.
Para homologar, marque a folha de aprovação no fim. Divergindo da proposta,
registre a decisão tomada — é ela que vira a regra, e o texto acima dela passa a
ser apenas o registro do que se considerou.

---

## D-B01 — "Mobilidade" e "bolsa concedida" são o mesmo registro?

**A questão.** O módulo 2 do PDF chama-se "Gestão de Missões/Mobilidades" e lista
rede, ano, PPG, área temática, modalidade (Doutorado Sanduíche, Professor
Visitante, Capacitação 15 dias, Capacitação 1 mês), instituição de destino,
período e situação. Esses são os campos de `bolsa_concedida`, não os de
`missao_comite`.

**Proposta: são o mesmo registro.** `bolsa_concedida` **é** a mobilidade;
`pessoa` é o bolsista, reutilizável entre concessões. O módulo 2 do PDF vira o
enriquecimento de P03 mais a visão consolidada P02. O termo de interface passa a
ser **Mobilidade**. `missao_comite` não é tocada.

**Por quê.**

1. `missao_comite` é a viagem institucional do Comitê: tem rodada de aprovação,
   prestação de contas, abatimento de aporte e encerramento com checklist. Não
   tem modalidade de bolsa, não tem PPG beneficiário, não consome vaga de
   planejamento anual. Nenhuma das duas naturezas cabe na outra.
2. O precedente é literal. A CG-056 recusou reaproveitar `produto_bolsa` como
   produto de missão, e o argumento está gravado no schema: *"são duas cobranças
   diferentes sobre coisas diferentes"*. Fundir missão e mobilidade cometeria o
   mesmo erro, desta vez na tabela que sustenta aprovação e dinheiro.
3. **O próprio PDF já duplica.** Modalidade, período, país e universidade de
   destino aparecem no módulo 2 (a mobilidade) *e* no módulo 3 (a bolsa do
   bolsista). É o mesmo fato escrito duas vezes, e o documento não diz qual dos
   dois manda.

**Se for decidido ao contrário** (mobilidade como tabela nova): duas tabelas com
período, modalidade e destino, que divergem na primeira edição feita em uma só.
"Quantas mobilidades houve em 2027?" passa a ter duas respostas, e a P01 e o
mapa terão de escolher uma sem que a tela consiga justificar a escolha.

---

## D-B02 — Colapsar a situação da mobilidade em quatro estados?

**A questão.** O PDF pede Planejada · Em andamento · Finalizada · Cancelada. O
sistema tem cinco estados administrativos (`SELECIONADO`, `EM_ANDAMENTO`,
`CONCLUIDA`, `CANCELADA`, `INTERROMPIDA`) **mais** oito situações temporais
derivadas de `current_date` pela RN-16 (`PROGRAMADA`, `PROXIMA`, `EM_VIGENCIA`,
`PRESTES_A_EXPIRAR`, `EXPIRADA`, e as três terminais).

**Proposta: manter as duas dimensões e apenas rotular.** `SELECIONADO` lê-se
"Planejada" na interface. As duas aparecem sempre juntas, como as duas dimensões
da missão na CG-006.

**Por quê.** "Planejada" e "ainda não começou" não são o mesmo fato: o primeiro é
ato administrativo, o segundo é o calendário. É a mesma razão que separou
aprovação de execução na missão. Os alertas de prazo de P03 — bolsa a 30 dias do
fim, bolsa expirada sem conclusão registrada — saem inteiramente da dimensão
temporal, e hoje funcionam.

`INTERROMPIDA` é o quinto estado que o PDF não previu e que a realidade exige:
bolsista que desiste no meio não é "Cancelada" (que nunca começou) nem
"Finalizada" (que cumpriu o período).

**Se for decidido ao contrário:** perdem-se os alertas de prazo, e a bolsa
interrompida passa a ser registrada como uma das duas coisas que ela não é.

---

## D-B03 — O valor da bolsa é digitável?

**A questão.** O módulo 3 do PDF lista "Valor da bolsa" entre os campos do
cadastro do bolsista.

**Proposta: não.** O valor continua vindo do catálogo versionado (RN-01) e
aparece no formulário como **exibição**, não como entrada.

**Por quê.** A RN-01 é a regra que garante que nenhum custo de bolsa venha de
valor digitado, e o `check` `item_planejado_bolsa_catalogo_ck` a sustenta no
banco. A decisão de 2026-09-08 sobre o catálogo foi além: item já citado por
linha de plano tem destino, modalidade, vigência e valor **travados**, porque
reescrever o preço mudaria em silêncio o custo de um planejamento aprovado.

**Se for decidido ao contrário:** reabre-se exatamente a porta que a versionagem
do catálogo fechou, e o custo de uma concessão deixa de ser reconstituível a
partir da tabela oficial.

---

## D-B04 — A situação do relacionamento institucional é gravada ou derivada?

**A questão.** O módulo 4 pede cinco situações: instituição identificada ·
mobilidade realizada · contato institucional iniciado · cooperação em avaliação ·
parceria formalizada.

**Proposta: híbrida.** Gravar apenas o **estágio declarado** — identificada,
contato iniciado, cooperação em avaliação. **Derivar na leitura** os dois que são
fatos verificáveis: "mobilidade realizada" (existe `bolsa_concedida` apontando
para a instituição) e "parceria formalizada" (existe `convenio` vigente). A ficha
mostra os dois eixos lado a lado.

**Por quê.** Três dos cinco são julgamento humano e não têm fato que os sustente
— só alguém pode dizer que há tratativas. Os outros dois **já estão no banco**, e
gravá-los cria o problema que a CG-058 nomeou ao proibir persistir o checklist de
encerramento: um estado guardado diverge do fato no dia seguinte. Aqui o sintoma
seria a ficha afirmando "apenas identificada" sobre uma instituição que já
recebeu três bolsistas.

**Origem do relacionamento é o caso oposto e vai gravada:** é fato histórico que
só quem cadastrou conhece, é obrigatória no PDF, e deve ser **imutável depois** —
reescrevê-la apagaria justamente a memória institucional que o documento quer
preservar.

**Se for decidido ao contrário** (enum puro, editável nos cinco): a ficha passa a
afirmar coisas que o próprio banco contradiz, e ninguém percebe até alguém
conferir à mão.

---

## D-B05 — Cadastrar reuniões, atas e deliberações do Comitê?

**A questão.** O módulo 6 pede cadastro de reuniões, atas e deliberações.

**Proposta: não construir agenda de reuniões.** Permitir **anexar a ata** à
decisão já registrada, usando a categoria `ATA`, que já existe em
`categoria_anexo`, e exibi-la no dossiê do relator (CG-048).

**Por quê.** A CG-019 homologou o **modelo B**: o colegiado delibera fora do
sistema — reunião semanal, podendo haver semana sem reunião — e o relator
registra o parecer com a data dessa deliberação. `decisao_comite.reuniaoData`
existe precisamente para guardar a data de uma reunião que aconteceu em outro
lugar, e o schema registra por que não se calcula essa data a partir de um
calendário: *"registraria deliberação que não aconteceu"*.

A proposta entrega a memória documental que o PDF quer — a ata fica no sistema,
ligada à decisão que ela fundamenta — sem transformar o Gerenciador em sistema de
colegiado.

**Se for decidido ao contrário:** reabre-se uma decisão fechada e passa a haver
dois registros do mesmo parecer (a deliberação cadastrada e a decisão da rodada),
que divergem na primeira correção feita em um só.

---

## D-B06 — Quem vê documento pessoal de bolsista?

**A questão.** O módulo 3 pede anexo de carta de aceite, plano de trabalho,
relatórios, declarações e produtos. A P03 da especificação vai além: RG antigo ou
CIN, CPF, passaporte e comprovante de residência.

**Proposta: definir a política antes do upload, e aplicar o recorte por PPG
antes da política.** Concretamente, **BOL-020 (recorte) precede BOL-021
(upload)**, e não o contrário.

**Por quê.** Hoje P03 é aberta a quem tem `bolsa:read`, e o recorte por PPG
(`RECORTE_OBRIGATORIO`, §6 do AGENTS.md) **ainda não se aplica a bolsas** — só a
listagem e o detalhe de PPG o consultam. Acrescentar passaporte e comprovante de
residência a uma tela sem recorte multiplica o dano de um acesso indevido, e o
dano é de dado pessoal de aluno e servidor.

O lado técnico já está resolvido pela CG-061: UUID validado antes do banco,
permissão herdada da entidade de destino, `RESTRITA` visível só a
`documento:read-restrito` e a quem enviou, `Content-Disposition` com fallback
ASCII. O que falta é a política institucional e o recorte da consulta.

**Se for decidido ao contrário** (upload primeiro, recorte depois): existe uma
janela — de duração desconhecida, porque depende da próxima priorização — em que
qualquer conta com `bolsa:read` abre o passaporte de qualquer bolsista de
qualquer PPG.

**Perguntas que só a PROPESP responde:**

1. Documento pessoal (RG/CIN, CPF, passaporte, comprovante de residência) nasce
   `INTERNA` ou `RESTRITA`?
2. O coordenador do PPG vê o documento pessoal do bolsista do próprio PPG?
3. Há prazo de retenção, como os 4 anos decididos para comprovantes de missão?

---

## D-B07 — O que significa "recursos executados" no dashboard?

**A questão.** O módulo 1 pede o indicador "Recursos executados".

**Proposta: definir antes de exibir.** Há três leituras possíveis e nenhuma é
óbvia.

**Por quê.** A RN-12 é explícita: no CAPES Global **não há execução financeira na
UEA** — a CAPES paga diretamente ao beneficiário. Não existe, no sistema, o dado
"quanto foi pago em bolsas". As três leituras candidatas:

| Leitura | O que seria | Problema |
|---|---|---|
| Custo das bolsas concedidas | soma de `valorConcedido` das concessões | É compromisso, não desembolso; a UEA não pagou nada |
| Execução do Comitê Gestor | `validado` da CG-055 | A RN-14 **proíbe** somá-lo ao de bolsas; seria outro orçamento na mesma caixa |
| Nada | indicador ausente | Honesto, mas o PDF pede |

**Se for decidido ao contrário** (exibir sem definir): ou o cartão mostra sempre
zero, ou mistura os dois orçamentos que a RN-14 mantém separados desde o início.

---

## Convenção técnica obrigatória para este módulo

Confirmada em 2026-09-09. Toda implementação e toda refatoração do módulo usam a
biblioteca de UI já instalada, sem dependência nova:

- **Formulário** — React Hook Form 7 + Zod 4, schema em `lib/formularios/`,
  `zodResolver`, `useErrosDaAcao` para rejeição da API e `useToastDaAcao` só para
  sucesso. Controle rico vai por `Controller`, nunca por `register`.
- **Primitivos ricos** — Radix (Popover) e cmdk por baixo de `ui/combobox.tsx` e
  `ui/comando.tsx`. O `Sidesheet` permanece `<dialog>` nativo e **não** deve ser
  trocado por modal de biblioteca: foco preso, `Esc` e fundo inerte vêm do
  navegador.
- **Busca no browser** — TanStack Query sobre `/api/bff/*`, só depois da primeira
  pintura, com `initialData` do Server Component, `keepPreviousData` e o filtro
  refletido na URL. `apiFetch` continua `server-only`.

Consequência prática registrada: `componentes/formularios/form-bolsa-concedida.tsx`
ainda usa `useActionState` + `FormData` + `Multistep`. Pela regra do §7 do
AGENTS.md, ele **migra para RHF/Zod na primeira task que o alterar** — que será a
BOL-010. Não haverá reescrita ampla separada.

O detalhamento vive em [migracao-ui.md](migracao-ui.md); este módulo não abre
exceção a nenhum dos seus quatro padrões obrigatórios.

---

## Folha de aprovação

**Todas homologadas em 2026-09-09**, conforme a proposta.

| # | Decisão | Decisão tomada | Aprovada |
|---|---|---|:--:|
| D-B01 | Mobilidade × bolsa concedida | Um registro só; `bolsa_concedida` **é** a mobilidade | [x] |
| D-B02 | Situação da mobilidade | Manter as duas dimensões; `SELECIONADO` lê-se "Planejada" | [x] |
| D-B03 | Valor da bolsa | Não digitável; exibição vinda do catálogo (RN-01) | [x] |
| D-B04 | Situação do relacionamento | Híbrida: três estágios gravados, dois derivados | [x] |
| D-B05 | Reuniões e atas | Não há cadastro; a ata anexa-se à decisão já registrada | [x] |
| D-B06 | Documento pessoal | Por categoria; `documento:read-pessoal`; recorte antes do upload; guarda até o fim da concessão + 5 anos | [x] |
| D-B07 | "Recursos executados" | Custo das concessões, rotulado como custo — nunca "executado" | [x] |

### O que cada decisão já produziu

| # | Estado |
|---|---|
| D-B01 | **Aplicada.** Nenhuma tabela nova; a BOL-010 enriqueceu `bolsa_concedida`. |
| D-B02 | **Já era o comportamento**; falta apenas rotular `SELECIONADO` como "Planejada" na interface. |
| D-B03 | **Já era o comportamento**; o formulário nunca ofereceu o campo. |
| D-B04 | **Destrava a Fase 3** (BOL-030 a BOL-035). Nada implementado ainda. |
| D-B05 | **Destrava a BOL-052.** Nada implementado ainda. |
| D-B06 | **Implementada** nas BOL-020, BOL-021 e BOL-022, com a tela. |
| D-B07 | **Destrava a BOL-041** (P01 revisto). Nada implementado ainda. |

### Decisão adicional, tomada em 2026-09-09

**Enviar documento pessoal exige a mesma permissão de abri-lo.** A BOL-021
deixou a API aceitando o envio de qualquer um com `bolsa:write`, e o
coordenador acabava podendo **coletar** passaporte de aluno que só ele próprio
reabriria depois — coleta de dado pessoal sem ninguém que a consuma. A simetria
foi fechada no serviço; a tela já não oferecia a categoria, e é a checagem da
API que transforma isso em autorização em vez de sugestão. **403 e não 404**: a
concessão é visível para quem chegou até ali, e o que se recusa é a ação.

---

## O que não muda com este documento

- Nenhuma migration foi gerada, nenhum enum alterado, nenhum endpoint mudou.
- As tasks do Comitê Gestor continuam válidas; nada em `missao_comite`,
  `produto_missao` ou `convenio` é tocado por este módulo.
- A RN-14 (o orçamento do Comitê Gestor não se mistura ao das bolsas) permanece
  intocada em todas as propostas acima.
- A RN-01 (valor de bolsa vem do catálogo) e a RN-18 (uma modalidade por CPF no
  ciclo) permanecem como estão.

---

## O que já pode andar sem esperar a folha

**BOL-010 é correta sob qualquer resposta a D-B01** e é a peça de maior
alavancagem do documento: `bolsa_concedida` já tem `paisDestinoId`,
`paisOrigemId`, `instituicaoDestinoId` e `instituicaoOrigemId` como chaves
estrangeiras — e as quatro estão mortas, porque o serviço grava só o texto. O
comentário no schema diz por quê: *"texto preserva origem e destino enquanto o
catálogo institucional não existe"*. Ele existe desde a CG-017.

Ligá-las destrava bolsistas por país, por instituição, o mapa (P04), o histórico
de mobilidades da ficha institucional e os relatórios — e é também a task que
naturalmente exercita as três tecnologias da convenção acima: `Combobox`
(Radix + cmdk) com busca sobre as 200+ instituições, `Controller` do React Hook
Form, e TanStack Query sobre `/api/bff/parceiros`, no padrão de
`consultas/lista-parceiros.tsx`.
