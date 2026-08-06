# Sistema de Mapeamento da Internacionalização da Pós-Graduação — estrutura

Especificação funcional e de dados do sistema que substitui as planilhas hoje usadas
pela PROPESP/UEA para gerir bolsas, orçamento e mobilidade internacional da
pós-graduação.

**Última revisão:** 2026-08-05
**Fontes:** `dados/levamtamento de bolsas/`, `dados/Planejamento_CAPES_Global_Consolidado_UFMG_Comite_Gestor/`, `dados/insights/`, `dados/sugestaov1-prototipo/`
**Estado da implementação:** autenticação/autorização, modelo de dados (26 tabelas),
seed com os dados reais, **serviços de cálculo (RN-01 a RN-14) e as telas de
planejamento** estão implementados e testados.

| Página | Situação |
|---|---|
| P01, P05, P06, P07, P08, P09, P10, P13, P14, P15, P16, P17, P23 | **implementadas** |
| P02, P03, P04 | dependem de bolsa concedida a pessoa — dado que não existe nas planilhas |
| P11, P12 | as abas de origem estão vazias; modelo e RN-12/RN-13 prontos, falta a tela |
| P18, P19 | fase 2 |
| P20, P21, P22 | dependem dos módulos acima |

Ver [AGENTS.md](AGENTS.md) §9 para o detalhamento do que existe e do que falta.

---

## Sumário

1. [Objetivo e recorte](#1-objetivo-e-recorte)
2. [Glossário do domínio](#2-glossário-do-domínio)
3. [Conceitos estruturantes](#3-conceitos-estruturantes)
4. [Modelo de dados](#4-modelo-de-dados)
5. [Regras de negócio e cálculos](#5-regras-de-negócio-e-cálculos)
6. [Mapa de navegação](#6-mapa-de-navegação)
7. [Páginas — detalhamento](#7-páginas--detalhamento)
8. [Seed: mapeamento planilha → banco](#8-seed-mapeamento-planilha--banco)
9. [Inconsistências encontradas nos dados](#9-inconsistências-encontradas-nos-dados)
10. [Fases de entrega](#10-fases-de-entrega)
11. [Perguntas e respostas](#11-perguntas-e-respostas)

---

## 1. Objetivo e recorte

### O problema

A equipe da PROPESP controla hoje, em planilhas Excel, o planejamento e a execução
de recursos de internacionalização da pós-graduação da UEA. As planilhas fazem o
trabalho, mas custam caro:

- **O cálculo mora na fórmula.** O custo de uma bolsa depende de uma tabela de
  valores oficial; hoje isso é `PROCV` copiado entre abas, e qualquer arraste errado
  passa despercebido.
- **Não há fonte única.** Os mesmos números aparecem em `Comitê UFMG`,
  `Redes_Tematicas`, `Mapa_Recursos_UEA`, `Painel Executivo` e nos PNGs de insight —
  e já **divergem entre si** (ver [§9](#9-inconsistências-encontradas-nos-dados)).
- **Não há histórico.** Quando a UFMG transformou sobras em bolsas de Capacitação,
  o custo anual saltou de R$ 396.981,60 para R$ 519.489,70. A planilha guarda o
  depois; o antes só sobreviveu porque alguém criou uma aba `Atualização UFMG`.
- **O dado individual não existe.** Sabe-se que há "1 bolsa de Doutorado Sanduíche
  de 6 meses para o PPGCLIAMB", mas não quem é o bolsista, para qual universidade
  foi, nem se voltou.
- **Cada programa é uma planilha nova.** CAPES Global tem a sua; GCUB e Erasmus têm
  as suas; PDSE, Move La América e PROAFRI virão.

### O que o sistema faz

Substitui essas planilhas por um sistema web que:

1. Mantém **uma tabela oficial de valores de bolsa** e calcula todo custo a partir dela.
2. Organiza o planejamento em **programa → ciclo → rede → área temática → PPG → bolsa**.
3. Acompanha **orçamento, execução financeira, saldo e remanejamento** por rubrica.
4. Registra o **bolsista individual** — quem foi, para onde, quando, por quanto tempo.
5. Consolida a **mobilidade IN/OUT de todos os programas** numa visão única.
6. Guarda **pendências e decisões** como itens de trabalho, não como comentários soltos.
7. Fecha o ciclo com **convênios e produtos da cooperação** (fase 2).

### Recorte

| Dentro | Fora (por ora) |
|---|---|
| Planejamento e execução orçamentária de programas de mobilidade | Folha de pagamento, empenho no SIAFI/SIGEFA |
| Cadastro de PPGs, redes, áreas temáticas, comitês | Gestão acadêmica do PPG (matrícula, disciplinas, defesas) |
| Bolsas planejadas e concedidas | Seleção/edital dos bolsistas (o sistema registra o resultado) |
| Convênios internacionais e produtos da cooperação (fase 2) | Currículo Lattes / integração CAPES Sucupira (fase 3) |
| Painéis gerenciais e exportações | BI corporativo |

### Instituição-sujeito

O sistema é da **UEA (Universidade do Estado do Amazonas)**, operado pela **PROPESP**.
UNESP, UFMG e UNICAMP aparecem como **redes coordenadoras externas** do programa
CAPES Global — não como instituições usuárias. Todos os PPGs cadastrados são da UEA,
e todos os membros de comitê têm e-mail `@uea.edu.br`.

---

## 2. Glossário do domínio

Os termos abaixo vêm das planilhas e devem ser usados no código, na interface e nas
conversas com a equipe. **Não invente sinônimos.**

| Termo | Significado |
|---|---|
| **Programa de mobilidade** | Fonte de recurso e conjunto de regras para internacionalização. Ex.: CAPES Global, GCUB, Erasmus+, PDSE, Move La América, PROAFRI. |
| **Ciclo** | Período de vigência de um programa. CAPES Global: 2027–2030. Comitê Gestor: 2026–2029. |
| **Rede coordenadora** | Instituição que coordena um consórcio nacional dentro do programa. No CAPES Global: UNESP, UFMG, UNICAMP. |
| **Área temática** | Eixo temático dentro de uma rede, com orçamento próprio. Identificado por código (`UNESP-T4`). **Cada rede tem as suas** — os nomes não coincidem entre redes. |
| **Membro do comitê** | Docente da UEA responsável por uma área temática. Uma área pode ter mais de um. |
| **PPG** | Programa de Pós-Graduação da UEA. Tem sigla, nota CAPES, nível e área. |
| **Modalidade** | Tipo de bolsa: Professor Visitante, Professor Visitante Sênior, Professor Visitante Junior, Jovem Talento, Pós-doutorado, Doutorado Sanduíche, Capacitação. |
| **Destino** | `Brasil` ou `Exterior`. Determina qual tabela de valores se aplica. |
| **Vigência** | Duração da bolsa em meses. Aceita `0,5` (até 15 dias). |
| **Catálogo de bolsas** | Tabela oficial (destino × modalidade × vigência → valor). 60 itens, `CAT-001` a `CAT-060`. |
| **Rubrica** | Natureza do recurso: `Bolsas`, `Manutenção`, `Missões`. |
| **Bolsa planejada** | Linha do plano anual: "PPG X recebe N bolsas da modalidade Y por Z meses, em Março". |
| **Bolsa concedida** | A bolsa planejada atribuída a uma pessoa concreta. |
| **Fluxo IN/OUT** | `IN` = alguém entra na UEA (bolsa com destino Brasil). `OUT` = alguém da UEA sai (destino Exterior). |
| **Implementação** | Mês em que a bolsa entra em vigor. Hoje só `Março` e `Setembro` (editais). |
| **Saldo potencial** | Orçamento de bolsas − custo das bolsas programadas. Ainda não executado. |
| **Sobra** | Saldo efetivamente disponível após a execução, passível de remanejamento. |
| **Remanejamento** | Transferência formalmente autorizada de saldo entre temáticas, PPGs, rubricas ou anos. |
| **Aporte vinculado** | Recurso destinado a ações da UEA, mesmo que pago pela rede coordenadora. **Não é o mesmo que entrada em caixa** (pendência `PEN-011`). |
| **Comitê Gestor** | Orçamento à parte (R$ 381.333,00/ano, 2026–2029) para missões e articulação institucional. **Não se soma ao orçamento de bolsas.** |
| **Produto da cooperação** | Resultado gerado pela mobilidade: publicação, tese em cotutela, projeto, patente. |

---

## 3. Conceitos estruturantes

### 3.1 A hierarquia

```
Instituição (UEA)
 │
 ├── PPG ──────────────── Linha de pesquisa
 │    │                   Coordenador / Vice
 │    └── Pessoa (docente, discente)
 │
 └── Programa de mobilidade (CAPES Global, GCUB, Erasmus, PDSE, …)
      │
      └── Ciclo (2027–2030)
           │
           ├── Premissas do modelo (cotação, reajuste, período)
           ├── Catálogo de bolsas (versão vigente)
           ├── Orçamento do Comitê Gestor
           │
           └── Rede coordenadora (UNESP)
                │
                └── Área temática (UNESP-T4) ──── Membro(s) do comitê
                     │
                     ├── Orçamento por ano e rubrica
                     │
                     └── Participação do PPG (PPG CLIAMB, "Contemplado")
                          │
                          └── Bolsa planejada (BOL-001)
                               │   modalidade, vigência, qtd/ano, mês
                               │
                               └── Bolsa concedida
                                       pessoa, país, universidade,
                                       período real, status
```

### 3.2 Por que "programa" é a raiz

O CAPES Global é o caso mais complexo e o único com dados hoje, mas o sistema nasce
multiprograma. Isso significa que **nada específico do CAPES Global pode vazar para o
núcleo**:

- "Rede coordenadora" e "área temática" são estruturas do CAPES Global. Erasmus não
  tem redes; PDSE não tem áreas temáticas. Logo, a bolsa se liga ao **PPG e ao
  programa** obrigatoriamente, e a rede/temática são **opcionais**.
- Cada programa traz seu próprio conjunto de modalidades e sua própria tabela de
  valores.
- O que é comum a todos: PPG, pessoa, país, universidade, fluxo IN/OUT, período,
  produto da cooperação. É isso que a visão consolidada de mobilidade agrega.

### 3.3 Duas camadas de bolsa

A distinção mais importante do modelo:

| | Bolsa planejada | Bolsa concedida |
|---|---|---|
| Responde | "Quanto vamos gastar e com quê?" | "Quem foi, para onde?" |
| Origem | Planilha `Plano_Bolsas` | Não existe hoje |
| Quantidade | Agregada (`qtd. anual = 2`) | Uma linha por pessoa |
| Momento | Planejamento, antes do edital | Após seleção |
| Alimenta | Orçamento, saldo, projeção | Mapa de mobilidade, IN/OUT, produtos |

Uma bolsa planejada de quantidade 2 gera, na prática, duas bolsas concedidas. O
sistema deve mostrar **quantas foram efetivadas contra quantas foram planejadas** —
métrica que hoje ninguém consegue produzir.

### 3.4 "Bolsa" é ambíguo — e isso já causou erro

As três fontes contam bolsas de formas diferentes:

- **25** = soma das quantidades anuais (o número correto para custo)
- **23** = número de linhas do plano (`BOL-001`..`BOL-023`)
- **21** = idem, antes das 4 Capacitações que a UFMG acrescentou

O sistema deve usar **sempre** "quantidade de bolsas" (unidades) nos indicadores
financeiros, e chamar a linha de plano de **"linha de planejamento"**, nunca de
"bolsa". Ver [§9](#9-inconsistências-encontradas-nos-dados).

### 3.5 Quem usa o sistema

Duas populações lançam dados (resposta **Q2**), e isso muda o desenho de autorização.

| Perfil | Quem é | O que faz |
|---|---|---|
| **Gestão PROPESP** | Equipe da Pró-Reitoria | Enxerga e edita tudo. Publica catálogo, define orçamento, autoriza remanejamento, fecha o ciclo. |
| **Coordenação de PPG** | Coordenador e vice de cada programa | Lança e edita **o que é do seu PPG**: plano, bolsistas, execução, produtos, convênios. Enxerga o consolidado, mas em modo leitura. |
| **Membro de comitê temático** | Docente responsável por uma área | Acompanha sua temática e valida decisões que a envolvem. |
| **Consulta** | Direção, auditoria | Só leitura de painéis e relatórios. |

**A consequência técnica é grande.** A autorização deixa de depender só de quem é o
usuário e passa a depender **do recurso que ele está tocando**:

```
hoje  (implementado)   permissoesDe(usuario)              → pode ou não pode
depois (necessário)    permissaoSobre(usuario, recurso)   → pode neste PPG, não naquele
```

Um coordenador do PPGDA tem `bolsa:write`, mas **só sobre bolsas do PPGDA**. Isso é
exatamente o escopo por programa antecipado em [AGENTS.md](AGENTS.md) §9 como o
primeiro ponto de pressão do modelo de permissões — e a resposta Q2 confirma que ele
chega junto com o primeiro módulo de domínio, não depois.

**Regras que decorrem disso:**

- Toda entidade de domínio carrega `ppgId` (direto ou por caminho navegável até um).
  Sem isso não há como filtrar por escopo.
- Toda listagem é filtrada por escopo no **servidor**, nunca escondendo linha na
  interface.
- Ações que atravessam PPGs — remanejar entre PPGs, publicar catálogo, fechar
  orçamento — são exclusivas da PROPESP.
- O coordenador vê o consolidado institucional (é informação de governança, não
  sigilo), mas não edita.

> O controle de acesso está fora do escopo desta rodada, por decisão sua. Este bloco
> existe para que o **modelo de dados já nasça com o escopo possível** — retrofitar
> `ppgId` depois é o tipo de mudança que toca todas as consultas do sistema.

---

## 4. Modelo de dados

Notação: `PK` chave primária, `FK` chave estrangeira, `?` opcional, `[]` lista.

### 4.1 Núcleo institucional

**`Instituicao`** — UEA, e também as instituições parceiras/coordenadoras.
```
id PK · nome · sigla · tipo (PROPRIA | REDE_COORDENADORA | PARCEIRA_INTERNACIONAL)
paisId FK? · cidade? · site? · ativo
```

**`Pais`** — catálogo ISO.
```
id PK · codigoIso2 · codigoIso3 · nome · continente
```

**`Ppg`** — Programa de Pós-Graduação da UEA. Campos do protótipo (slide 3).
```
id PK · nome · sigla · unidade (campus/escola)
nivel (MESTRADO | DOUTORADO | MESTRADO_DOUTORADO | MESTRADO_PROFISSIONAL)
modalidade (ACADEMICO | PROFISSIONAL)
notaCapes (1..7) · areaCapes · situacao (ATIVO | INATIVO | EM_IMPLANTACAO)
coordenadorId FK? → Pessoa · viceCoordenadorId FK? → Pessoa
emRede? (bool)  ·  redeAcademica? (ex.: BIONORTE, REAMEC, PROFMAT)
observacoes?
```
> `notaCapes` vai até 7 — `PPG em Medicina Tropical` tem nota 7. Não limite a 5.
> `emRede`: vários PPGs são de rede nacional (BIONORTE, REAMEC, PROFÁGUA, PROFMAT,
> PROFSAÚDE, PROFNIT, EDUCANORTE). Isso afeta a leitura da titularidade do recurso.

**`LinhaPesquisa`**
```
id PK · ppgId FK · nome · descricao? · ativa
```

**`Pessoa`** — docentes, discentes, pesquisadores. Serve para comitê e bolsista.
```
id PK · nome · email? · documento? · tipo (DOCENTE | DISCENTE | PESQUISADOR | EXTERNO)
ppgId FK? · lattes? · instituicaoId FK? · ativo
```

### 4.2 Programa e estrutura

**`Programa`**
```
id PK · nome · sigla · slug · orgaoFinanciador (CAPES, UE, GCUB, …)
descricao? · usaRedes (bool) · usaAreasTematicas (bool) · ativo
```
> `usaRedes` / `usaAreasTematicas` permitem que o Erasmus conviva com o CAPES Global
> sem carregar estruturas vazias.

**`Ciclo`**
```
id PK · programaId FK · nome ("2027–2030") · anoInicio · anoFim
status (PLANEJAMENTO | VIGENTE | ENCERRADO) · observacoes?
```

**`RedeCoordenadora`**
```
id PK · cicloId FK · instituicaoId FK · nome
statusOrcamento (DEFINIDO | A_DEFINIR) · observacoes?
```

**`AreaTematica`**
```
id PK · redeId FK · codigo ("UNESP-T4") · nome · temaNumero?
statusOrcamento (DEFINIDO | A_DEFINIR) · observacoes?
```

**`MembroComite`** — N:N entre pessoa e área temática.
```
id PK · areaTematicaId FK · pessoaId FK · papel (TITULAR | SUPLENTE) · desde? · ate?
```

**`ParticipacaoPpg`** — qual PPG participa de qual área temática.
```
id PK · areaTematicaId FK · ppgId FK
situacao (CONTEMPLADO | CADASTRO_PRELIMINAR | NAO_CONTEMPLADO)
modalidadesPrevistas[]? · observacoes?
```
> Precisa de **unique(areaTematicaId, ppgId)** e de um alerta quando o mesmo PPG
> aparece em duas temáticas da mesma rede — é a pendência `PEND-006` (PROFSAÚDE).

### 4.3 Catálogo de valores

**`Modalidade`**
```
id PK · nome · destinosPermitidos[] (BRASIL | EXTERIOR)
publicoAlvo (DOCENTE | DISCENTE | POS_DOC | AMBOS) · ativa
```

**`TabelaValores`** — versão do catálogo. Existe porque a CAPES pode reajustar
(pendência `PEND-007`), e o histórico não pode ser sobrescrito.
```
id PK · programaId FK · versao · dataBase · cotacaoDolar (6.59)
referenciaNormativa ("Portaria nº 1/2020; Portaria nº 33/2023")
vigenteDe · vigenteAte? · observacoes?
```

**`ItemCatalogoBolsa`**
```
id PK · tabelaValoresId FK · codigo ("CAT-001")
destino (BRASIL | EXTERIOR) · modalidadeId FK · vigenciaMeses (decimal, aceita 0.5)
valorUsd? · valorBrl · fonte · observacao?
```
> **unique(tabelaValoresId, destino, modalidadeId, vigenciaMeses)** — é a chave de
> busca do cálculo de custo.

### 4.4 Orçamento

**`OrcamentoTematica`** — uma linha por área temática por ano.
```
id PK · areaTematicaId FK · ano
valorBolsas · valorManutencao · valorMissoes
status (DEFINIDO | A_DEFINIR) · fonte? · observacoes?
```
> **Derivado:** `totalPrevisto = valorBolsas + valorManutencao + valorMissoes`.
> Não persista o total; calcule.

**`OrcamentoComiteGestor`** — orçamento paralelo, não somável ao de bolsas.
```
id PK · cicloId FK · instituicaoId FK (rede) · ano · valorAnual · observacoes?
```

**`Premissa`** — parâmetros e convenções do modelo (aba `Premissas`).
```
id PK · cicloId FK · item · valor · unidade · natureza
fonte · dataBase · responsavel · observacoes?
```

**`FonteDocumental`**
```
id PK · cicloId FK · nome · conteudoUtilizado · escopo
status (INCORPORADO | PENDENTE) · arquivoOrigem? · anexoId FK?
dataRecebimento · referenciaNormativa? · observacoes?
```

### 4.5 Planejamento (as três rubricas)

Manutenção e Missões têm plano detalhado, igual ao de bolsas (resposta **Q3**). As três
rubricas compartilham a mesma espinha — temática, PPG, quantidade, mês, custo, projeção
plurianual — e diferem só no que define o valor unitário. Por isso o planejamento é
**uma entidade com discriminador de rubrica**, e não três tabelas paralelas.

O ganho é direto: `total programado` de uma temática vira uma soma só, e o orçamento
fecha com as três rubricas usando o mesmo código.

**`ItemPlanejado`**
```
id PK · codigo ("BOL-001" | "MAN-001" | "MIS-001") · cicloId FK
rubrica (BOLSAS | MANUTENCAO | MISSOES)      ← discriminador
areaTematicaId FK? · ppgId FK   (temática é opcional: outros programas não têm)
descricao · quantidadeAnual · mesImplementacao (MARCO | SETEMBRO | …)
valorUnitarioInformado?         ← usado quando não há catálogo (ver abaixo)
status (PROGRAMADO | PENDENTE | CANCELADO)
textoFonte?                     ← frase original da planilha, para auditoria
validacaoPendencia? · observacoes?

— exclusivo de rubrica = BOLSAS —
destino (BRASIL | EXTERIOR) · modalidadeId FK · vigenciaMeses
itemCatalogoId FK?              ← resolvido no cálculo; nulo vira pendência
fluxo (IN | OUT)

— exclusivo de rubrica = MISSOES —
tipoMissao (VISITA_TECNICA | EVENTO | ARTICULACAO | BANCA | OUTRO)
paisDestinoId FK? · instituicaoDestinoId FK?
numeroParticipantes? · numeroDiarias? · incluiPassagem (bool)

— exclusivo de rubrica = MANUTENCAO —
tipoDespesa (MATERIAL_CONSUMO | SERVICO | EQUIPAMENTO | PUBLICACAO | OUTRO)
```

> **Como sai o valor unitário:**
> `BOLSAS` → obrigatoriamente do catálogo (RN-01). Digitar valor é proibido.
> `MANUTENCAO` e `MISSOES` → não há tabela oficial; usa `valorUnitarioInformado`,
> que é uma estimativa e precisa de justificativa. Esta assimetria é real e deve
> aparecer na interface — o usuário tem que enxergar qual número é oficial e qual é
> estimado.
>
> **Derivado:** `custoAnual = quantidadeAnual × valorUnitario`.

**`PlanejamentoAnual`** — quantidade por ano. Hoje a premissa é repetir o mesmo valor
em 2027–2030, mas o modelo não deve assumir isso.
```
id PK · itemPlanejadoId FK · ano · quantidade
```

> **Nota sobre a seed:** os anexos de UNESP e UFMG informam os valores globais de
> manutenção e missões, mas **não detalham em que serão gastos** — é exatamente o que
> `PEND-009` e `PEND-010` registram. Logo, a seed nasce com R$ 69.751,14/ano de
> manutenção e missões no orçamento e **zero itens planejados** nessas rubricas. O
> sistema vai mostrar essa lacuna como recurso não programado, que é o comportamento
> correto — e é a informação que a planilha hoje não dá.

**`BolsaConcedida`**
```
id PK · itemPlanejadoId FK? · ppgId FK · pessoaId FK
programaId FK · cicloId FK · modalidadeId FK · destino
nivelBeneficiario (MESTRADO | DOUTORADO | POS_DOC | DOCENTE | MOBILIDADE_BREVE)
paisDestinoId FK · instituicaoDestinoId FK?
dataInicio · dataFim · vigenciaMeses · valorConcedido
fluxo (IN | OUT)
status (SELECIONADO | EM_ANDAMENTO | CONCLUIDA | CANCELADA | INTERROMPIDA)
processo? · observacoes?
```
> `itemPlanejadoId` é opcional: bolsas de outros programas (GCUB, Erasmus) podem
> chegar sem passar por planejamento nesta ferramenta. Quando preenchido, aponta
> obrigatoriamente para um item de `rubrica = BOLSAS`.
> `nivelBeneficiario` inclui `MOBILIDADE_BREVE`, termo que veio da sua anotação.

### 4.6 Execução financeira

**`LancamentoExecucao`**
```
id PK · codigo ("EXEC-001") · cicloId FK · data · ano
areaTematicaId FK? · ppgId FK? · rubrica (BOLSAS | MANUTENCAO | MISSOES)
descricao · documentoProcesso?
valorEmpenhado · valorPago · valorCancelado
status (NAO_INICIADO | EMPENHADO | PAGO | CANCELADO)
bolsaConcedidaId FK? · observacoes?
```
> **Derivado:** `valorLiquido = valorPago − valorCancelado` (resposta **Q1**).
> Note que `valorEmpenhado` **não entra** no líquido: empenho é compromisso, não
> desembolso. Ele serve para o indicador de comprometimento, separado do executado.

**`Remanejamento`**
```
id PK · codigo ("REM-001") · cicloId FK · data · ano
redeId FK? · temaOrigemId FK? · temaDestinoId FK?
ppgOrigemId FK? · ppgDestinoId FK? · rubrica · valor
justificativa · documentoAutorizacao? · anexoId FK?
status (PROPOSTO | AUTORIZADO | EXECUTADO | REJEITADO) · observacoes?
```

### 4.7 Governança

**`Pendencia`**
```
id PK · codigo ("PEND-001") · cicloId FK
escopoTipo (GERAL | REDE | AREA_TEMATICA | PPG) · escopoId?
assunto · descricao · impacto · nivelImpacto (ALTA | MEDIA | BAIXA)?
responsavelSugerido · prazoMomento?
status (PENDENTE | EM_ANALISE | MONITORAR | RESOLVIDA)
resolucao? · resolvidaEm? · resolvidaPorId FK?
```

**`Anexo`** — documentos (portarias, autorizações, convênios).
```
id PK · nome · mimeType · tamanho · caminho · enviadoPorId FK · enviadoEm
entidadeTipo · entidadeId    (polimórfico)
```

**`RegistroAuditoria`** — quem mudou o quê. Requisito direto do problema "não há
histórico".
```
id PK · entidadeTipo · entidadeId · acao (CRIACAO | EDICAO | EXCLUSAO)
campo? · valorAnterior? · valorNovo? · usuarioId · em · justificativa?
```

### 4.8 Fase 2 — convênios e produção

**`Convenio`**
```
id PK · instituicaoParceiraId FK · paisId FK
tipoAcordo (INTERCAMBIO_PESQUISA | DUPLA_TITULACAO | COOPERACAO_TECNICA |
            INTERCAMBIO_ACADEMICO | MOBILIDADE_DOCENTE | COTUTELA)
dataInicio · dataFim · descricao · anexoId FK?
status (VIGENTE | ENCERRADO | EM_TRAMITACAO) · ppgs[] (N:N)
```

**`ProdutoCooperacao`**
```
id PK · tipo (PUBLICACAO | TESE_COTUTELA | PROJETO | PATENTE | EVENTO | LIVRO)
titulo · ano · ppgId FK · convenioId FK? · bolsaConcedidaId FK?
autores[] · doi? · link? · status (PUBLICADO | EM_REVISAO | SUBMETIDO)
paisesEnvolvidos[] · instituicoesEnvolvidas[]
```

---

## 5. Regras de negócio e cálculos

Todas as fórmulas abaixo foram **verificadas contra os dados reais** das planilhas.
Os totais conferem até o centavo.

### RN-01 · Valor unitário da bolsa
Busca no catálogo vigente por `(destino, modalidade, vigenciaMeses)`.
Se não houver correspondência exata, **não interpole**: gere uma pendência.

> Exemplos verificados: Exterior/Doutorado Sanduíche/6m → R$ 82.902,20 (`CAT-053`);
> Brasil/Professor Visitante/1m → R$ 21.650,00 (`CAT-002`).

### RN-02 · Regra dos 15 dias (Professor Visitante)
Bolsa de até 15 dias (inclusive) usa `vigencia = 0,5`. De 16 dias a um mês, usa
`vigencia = 1`. Regra textual do anexo de bolsas no Brasil.

### RN-03 · Conversão de bolsas no exterior
`valorBrl = valorUsd × cotacao`, com `cotacao` vinda de `Premissa` (hoje **6,59**).
O valor já inclui adicional de cidade de alto custo, estimado para 70% das bolsas.
**A cotação é parâmetro do ciclo, nunca constante no código.**

### RN-04 · Custo de uma linha de planejamento
```
custoAnual = quantidadeAnual × valorUnitario
custoNoAno(a) = quantidade(a) × valorUnitario
custoCiclo    = Σ custoNoAno(a), a ∈ anos do ciclo
```

### RN-05 · Orçamento da área temática
```
totalPrevisto = valorBolsas + valorManutencao + valorMissoes
```
> Verificado: UNESP-T4 = 233.854,04 + 10.555,60 + 21.999,60 = **266.409,24** ✓

### RN-06 · Saldo potencial
```
saldoPotencial = valorBolsas − Σ custoAnual das bolsas da temática
```
> Verificado: UNESP-T4 = 233.854,04 − 231.045,40 = **2.808,64** ✓
> Soma de todas as temáticas definidas = **36.247,25/ano** ✓ (= 144.989,00 em 4 anos)

### RN-07 · Utilização do orçamento
```
utilizacao = custoBolsasProgramado / valorBolsas
```
Semáforo sugerido: < 90% atenção (recurso ocioso) · 90–100% saudável · > 100% estouro.
> Verificado: UFMG-T1 = 82.572,70 / 89.500,00 = **92,26%** ✓

### RN-08 · Divergência de saldo
```
divergencia = saldoCalculado − saldoInformado
```
Quando ≠ 0, cria alerta e pendência. **Isto já ocorre em duas temáticas** e foi o que
gerou `PEND-001` e `PEND-003`.
> UNESP-T3: 1.457,39 vs 1.251,29 → divergência **206,10**
> UNESP-T1: 11.933,05 vs 927,56 → divergência **11.005,49**

### RN-09 · Projeção plurianual
Premissa vigente: **repetir o valor nominal, sem reajuste**, em todos os anos do ciclo.
```
orcamentoCiclo = orcamentoAnual × númeroDeAnos
```
> Verificado: 1.250.355,59 × 4 = **5.001.422,36** ✓
> A premissa é explícita e revisável (`PEND-007`). O sistema deve permitir sobrescrever
> o valor de um ano específico sem quebrar os demais.

### RN-10 · Classificação IN/OUT
```
destino = BRASIL   → fluxo = IN   (alguém entra na UEA)
destino = EXTERIOR → fluxo = OUT  (alguém da UEA sai)
```
> **Convenção validada institucionalmente** (resposta **Q5**; resolve `PEN-012`).
> O campo `fluxo` continua sobrescrevível com justificativa, para os casos de borda
> — por exemplo, um bolsista estrangeiro que já reside no Brasil.

### RN-11 · Contagem de bolsas
Indicadores financeiros e de mobilidade usam **soma de quantidades**, não contagem de
linhas. Ver [§3.4](#34-bolsa-é-ambíguo--e-isso-já-causou-erro).
> Verificado: 25 bolsas/ano (2 IN + 23 OUT) a partir de 23 linhas de planejamento.

### RN-12 · Execução financeira
```
valorLiquido       = valorPago − valorCancelado
totalExecutado     = Σ valorLiquido dos lançamentos do ano/temática
totalComprometido  = Σ valorEmpenhado − Σ valorCancelado
percentualExecucao = totalExecutado / totalPrevisto
saldoAposExecucao  = totalPrevisto − totalExecutado + remanejamentoLiquido
saldoDisponivel    = totalPrevisto − totalComprometido + remanejamentoLiquido
```
> **Executado** e **comprometido** são indicadores diferentes e ambos importam.
> Um empenho de R$ 50.000 ainda não pago não aparece no executado, mas o dinheiro
> já não está livre. Painéis que mostram só um dos dois induzem a erro de decisão —
> mostre os dois lado a lado.
>
> Como o recurso é **transferido à UEA** (premissa de trabalho da resposta **Q4**),
> a execução aqui representa movimento de caixa institucional, não apenas
> acompanhamento de um gasto feito por terceiro. Ver [§11](#11-perguntas-e-respostas)
> — isso ainda precisa de confirmação formal.

### RN-13 · Remanejamento
Só entra no cálculo quando `status = AUTORIZADO` ou `EXECUTADO`. Exige
`documentoAutorizacao`. `PROPOSTO` aparece nos painéis como "em trâmite", separado.
```
remanejamentoLiquido(tema) = Σ entradas − Σ saídas (autorizadas)
```
> **Remanejamento é permitido entre PPGs, entre temáticas e entre anos** (resposta
> **Q6**). O sistema, portanto, oferece os três movimentos.
>
> Atenção a uma distinção que a resposta não elimina: **a PROPESP querer remanejar não
> é a CAPES autorizar.** `PEND-008` perguntava pela regra do financiador. Enquanto o
> normativo não estiver anexado, o sistema permite o lançamento, exige documento de
> autorização para sair de `PROPOSTO`, e sinaliza remanejamento entre anos como o de
> maior risco — é o que costuma esbarrar em anualidade orçamentária.

### RN-14 · Orçamento do Comitê Gestor
É **paralelo**. Nunca deve ser somado ao orçamento de bolsas em nenhum indicador.
Painéis que mostram os dois precisam separá-los visualmente e dizer isso por escrito.
> R$ 381.333,00/ano (UFMG 120.000 + UNESP 121.333 + UNICAMP 140.000), 2026–2029.

### RN-15 · Efetivação
```
taxaEfetivacao = Σ bolsas concedidas / Σ bolsas planejadas (mesmo ano/temática)
```
Métrica nova, impossível na planilha atual.

---

## 6. Mapa de navegação

```
Painel                    /
Mobilidade                /mobilidade
  ├─ Panorama                /mobilidade
  ├─ Bolsistas               /mobilidade/bolsistas
  └─ Mapa e destinos         /mobilidade/mapa
Documentos oficiais       /documentos
Programas                 /programas
  └─ CAPES Global            /programas/capes-global
      └─ Ciclo 2027–2030     /programas/capes-global/2027-2030
          ├─ Redes e temáticas   .../redes
          │   └─ Área temática   .../tematicas/[codigo]
          ├─ Orçamento           .../orcamento
          ├─ Plano de aplicação  .../plano
          ├─ Execução            .../execucao
          ├─ Remanejamentos      .../remanejamentos
          ├─ Comitê Gestor       .../comite-gestor
          └─ Premissas e fontes  .../premissas
PPGs                      /ppgs
  ├─ Detalhe                 /ppgs/[id]
  └─ Cadastro                /ppgs/novo
Pendências                /pendencias
Convênios       (fase 2)  /convenios
Produção        (fase 2)  /producao
Catálogos                 /catalogos
  ├─ Bolsas                  /catalogos/bolsas
  ├─ Modalidades             /catalogos/modalidades
  └─ Instituições e países   /catalogos/instituicoes
Relatórios                /relatorios
Importação                /importacao
Configurações             /configuracoes
```

---

## 7. Páginas — detalhamento

### P01 · Painel executivo
**Rota** `/` · **Substitui** abas `Painel Executivo` e `Painel_UEA` · **MVP**

Primeira tela após o login. Responde "como está o programa" em dez segundos.

**Blocos**

1. **Faixa de indicadores** (8 cartões)
   - Aporte anual conhecido — R$ 1.250.355,59
   - Projeção do ciclo — R$ 5.001.422,36
   - Bolsas programadas/ano — 25
   - Custo anual das bolsas — R$ 1.144.357,20
   - PPGs mapeados — 24
   - Bolsas no ciclo — 100
   - Saldo potencial/ano — R$ 36.247,25
   - Pendências abertas — 14
2. **Resumo por rede** — tabela + barras. Colunas: rede, orçamento anual, custo de
   bolsas, apoio (manutenção + missões), orçamento do ciclo, PPGs. Rede sem orçamento
   definido aparece hachurada com o rótulo "Pendente", **nunca como zero**.
3. **Resumo por modalidade** — modalidade, destino, qtd/ano, custo/ano, qtd e custo no ciclo.
4. **Impacto anual e do ciclo** — linha por indicador, coluna por ano.
5. **Alertas gerenciais** — temáticas sem orçamento (4), divergências de saldo (2),
   PPGs sem bolsa definida (10), saldo potencial do ciclo. Cada alerta leva ao registro.

**Regras**
- Todo cartão informa a **data-base** e se inclui ou não a UNICAMP.
- Valores pendentes nunca são tratados como zero em médias ou percentuais.
- Filtro global de ciclo e programa no topo, persistido na sessão.

**Estado vazio** — sem ciclo cadastrado, oferece "Importar planilha" e "Criar ciclo".

---

### P02 · Panorama de mobilidade
**Rota** `/mobilidade` · **Substitui** `Mapa_Recursos_UEA` §3 e §4 + a "aba só com mobilidade" da sua anotação · **MVP**

Visão **consolidada de todos os programas**. É aqui que CAPES Global, GCUB, Erasmus,
PDSE, Move La América e PROAFRI aparecem lado a lado.

**Filtros** (todos combináveis, refletidos na URL)
programa · ciclo/ano · fluxo IN/OUT · modalidade · nível do beneficiário
(mestrado, doutorado, pós-doc, docente, mobilidade breve) · país · universidade ·
PPG · rede · situação

**Blocos**
1. **Cartões** — ações/ano, IN, OUT, valor IN, valor OUT, países envolvidos, PPGs envolvidos.
2. **IN × OUT** — comparativo por ano e no ciclo, com % de cada lado.
   > Hoje: 2 IN (8%) e 23 OUT (92%). O desequilíbrio é uma informação estratégica, não um defeito.
3. **Distribuição por modalidade** — barras, com valor e quantidade.
4. **Por programa** — quanto cada programa representa da mobilidade total.
5. **Série temporal** — evolução ao longo dos anos do ciclo.
6. **Leitura executiva** — bloco de texto com as conclusões, editável pela equipe
   (é o que os PNGs de insight fazem hoje à mão).

**Ações** exportar PNG/PDF do painel · exportar dados em CSV/XLSX.

---

### P03 · Bolsistas
**Rota** `/mobilidade/bolsistas` · **Novo — não existe na planilha** · **MVP**

Lista de todas as bolsas concedidas a pessoas.

**Colunas** beneficiário · nível · PPG · programa · modalidade · destino (país/universidade) ·
período · vigência · valor · fluxo · status

**Filtros** iguais aos de P02, mais: status, período de vigência, com/sem produto registrado.

**Ações**
- **Conceder bolsa** — parte de uma linha de planejamento e atribui a uma pessoa.
  O formulário pré-preenche modalidade, vigência e valor, e mostra quantas vagas
  daquela linha ainda estão livres.
- Registrar bolsa avulsa (programas sem planejamento no sistema).
- Editar, cancelar (com justificativa obrigatória), registrar retorno.
- Vincular produto da cooperação (fase 2).

**Regras**
- Ao conceder, valida se `quantidade concedida < quantidade planejada`. Se exceder,
  exige justificativa e gera pendência.
- Bolsa concedida com `dataFim` no passado e status `EM_ANDAMENTO` gera alerta.

---

### P04 · Mapa e destinos
**Rota** `/mobilidade/mapa` · **Novo** · Fase 1.5

Mapa-múndi com países de origem/destino, e ranking de universidades parceiras.
Cumpre a anotação *"mapear in e out — país e universidade"*.

**Blocos** mapa com intensidade por país · tabela de países (IN, OUT, valor, PPGs) ·
tabela de universidades de destino · vínculo com convênios existentes (fase 2), sinalizando
mobilidade para instituição **sem** convênio formal — informação de governança relevante.

---

### P05 · Programas
**Rota** `/programas` · **Novo (estrutural)** · **MVP**

Lista dos programas de mobilidade. Cartão por programa: nome, órgão financiador,
ciclos, orçamento total, bolsas, status.

**Ações** criar programa · abrir · arquivar.

**Seed** CAPES Global (com dados) + GCUB, Erasmus+, PDSE, Move La América, PROAFRI
cadastrados **sem dados**, para que a estrutura multiprograma seja visível desde o
primeiro dia.

---

### P06 · Visão do programa / ciclo
**Rota** `/programas/[programa]/[ciclo]` · **Substitui** aba `Premissas` (navegação) · **MVP**

Página-índice do ciclo, equivalente à "central de navegação" que a aba `Premissas` tenta
ser. Cartões de atalho para redes, orçamento, plano de bolsas, execução, remanejamentos,
pendências, comitê gestor e premissas — cada um com um número vivo (ex.: "Pendências · 13 abertas").

Inclui a **legenda de uso** herdada da planilha, traduzida para o sistema:
| Planilha | Sistema |
|---|---|
| Amarelo — preencher/validar | Campo editável com aviso de validação pendente |
| Azul — entrada editável | Campo editável comum |
| Verde — vínculo entre abas | Valor calculado, somente leitura, com link para a origem |
| Vermelho — divergência/alerta | Alerta em destaque + pendência associada |

---

### P07 · Redes e áreas temáticas
**Rota** `.../redes` · **Substitui** `Redes_Tematicas` e as abas `Comitê *` · **MVP**

**Blocos**
1. Cartões por rede: orçamento anual, temáticas, PPGs, status, IN/OUT.
2. Tabela de áreas temáticas agrupada por rede. Colunas: código, área, membro(s) do
   comitê, PPGs, status, orçamento (bolsas/manutenção/missões/total), custo calculado,
   custo informado, saldo, **divergência**, utilização.

**Regras**
- Divergência ≠ 0 marca a linha em vermelho e abre acesso rápido a "criar pendência".
- Rede `A_DEFINIR` (UNICAMP) mostra as temáticas e PPGs, com orçamento em branco e
  o rótulo "A definir" — **jamais zero**.

**Ações** nova rede · nova área temática · gerenciar membros do comitê · vincular PPGs.

---

### P08 · Detalhe da área temática
**Rota** `.../tematicas/[codigo]` · **MVP**

Tudo sobre uma temática em uma página.

**Abas internas**
- **Resumo** — orçamento por rubrica, custo, saldo, utilização, membros do comitê.
- **PPGs** — participantes, nota, situação, modalidades previstas, participação no
  custo (%), com alerta de PPG duplicado em outra temática.
- **Plano de aplicação** — as linhas daquela temática nas três rubricas, com custo e projeção.
- **Execução** — lançamentos financeiros.
- **Histórico** — trilha de auditoria (quem mudou orçamento/plano, quando, por quê).
  > É o que teria preservado a programação da UFMG antes da transformação das sobras.

---

### P09 · Orçamento
**Rota** `.../orcamento` · **Substitui** `Orçamento_2027_2030` · **MVP**

Matriz ano × rede/temática com as colunas da planilha: bolsas disponíveis, manutenção,
missões, total previsto, custo programado, demais rubricas, total programado, saldo
potencial, execução por rubrica, remanejamento líquido, total executado, saldo após
execução, % execução, sobra, estouro, situação.

**Modos de visualização** por ano · por rede · por temática · consolidado do ciclo.

**Ações** editar orçamento de uma temática/ano · replicar para os demais anos (aplicando
RN-09) · registrar reajuste · exportar.

**Regras**
- Editar exige justificativa quando o ciclo está `VIGENTE`.
- `Situação` derivada: `NÃO INICIADA` · `EM EXECUÇÃO` · `CONCLUÍDA` · `ESTOURO`.
- Célula editável e célula calculada precisam ser visualmente distintas.

---

### P10 · Plano de aplicação
**Rota** `.../plano` · **Substitui** `Plano_Bolsas` · **MVP** · *tela mais importante do sistema*

Onde a equipe planeja o que será gasto, nas **três rubricas**. A aba original só tem
bolsas; manutenção e missões passam a ter o mesmo tratamento (resposta **Q3**).

**Abas internas** — `Bolsas` · `Manutenção` · `Missões` · `Consolidado`
Cada rubrica tem colunas próprias; o consolidado soma tudo contra o orçamento.

#### Aba Bolsas
**Tabela** código · rede · temática · PPG · destino · modalidade · vigência ·
qtd. anual · mês · status · **valor unitário (do catálogo)** · **custo anual (calculado)** ·
qtd. e custo por ano · totais do ciclo · fluxo IN/OUT · texto-fonte · validação.

```
PPG            [busca]                    Rede/Temática  [derivado do PPG]
Destino        ( ) Brasil  ( ) Exterior
Modalidade     [select — filtrado por destino]
Vigência       [select — só as vigências existentes no catálogo]
                 → valor unitário aparece aqui, em tempo real (somente leitura)
Quantidade     [número]   Mês de implementação [Março | Setembro | outro]
Fluxo          [IN/OUT — sugerido por RN-10, sobrescrevível com justificativa]
Texto-fonte    [texto livre — a frase original do anexo]
```

#### Aba Missões
```
Descrição      [texto]                    PPG / Temática [busca]
Tipo           [visita técnica | evento | articulação | banca | outro]
Destino        [país] [instituição]
Participantes  [número]   Diárias [número]   [ ] Inclui passagem
Valor unitário [moeda — ESTIMADO]  Justificativa da estimativa [texto]
Quantidade     [número]   Mês [select]
```

#### Aba Manutenção
```
Descrição      [texto]                    PPG / Temática [busca]
Tipo de despesa [material de consumo | serviço | equipamento | publicação | outro]
Valor unitário [moeda — ESTIMADO]  Justificativa da estimativa [texto]
Quantidade     [número]   Mês [select]
```

**Regras**
- Em Bolsas, o valor unitário **nunca** é digitado; vem do catálogo (RN-01).
  Combinação sem item no catálogo bloqueia o salvamento e oferece "registrar pendência".
- Em Manutenção e Missões, o valor é **estimado** e exige justificativa. A interface
  marca esses valores com um selo visual distinto de "oficial" — misturar os dois sem
  aviso é como um número errado entra num relatório de prestação de contas.
- Ao salvar, recalcula o saldo da temática **por rubrica** e avisa se ultrapassar.
- Linha com `status = PENDENTE` (caso UNICAMP) é aceita sem modalidade nem quantidade.
- Uma linha nunca é excluída em ciclo vigente — é cancelada, preservando o histórico.
- Coordenador de PPG só enxerga e edita linhas do seu PPG (§3.5).

**Estados especiais**
- As 10 linhas UNICAMP (`BOL-024`..`BOL-033`) existem com quantidade 0 e status
  `PENDENTE`, agrupadas com o aviso *"aguardando definição de orçamento pela rede"*.
- As abas Manutenção e Missões começam **vazias**, com R$ 69.751,14/ano de orçamento
  não programado. É `PEND-009` e `PEND-010` visíveis como lacuna, não como comentário.

---

### P11 · Execução financeira
**Rota** `.../execucao` · **Substitui** `Execucao` · **MVP**

Registro de empenhos, pagamentos e estornos. A aba original está **vazia** (100 linhas
de gabarito) — o sistema começa sem dados aqui.

**Colunas** código · data · ano · rede · temática · PPG · rubrica · descrição ·
documento/processo · empenhado · pago · cancelado · **líquido (calculado)** · status.

**Ações** novo lançamento · anexar documento · vincular a bolsa concedida · importar CSV.

**Regras**
- Vincular a lançamento a uma bolsa concedida é opcional, mas quando existe, alimenta
  o custo real por bolsista.
- Status derivado dos valores, sobrescrevível.
- Somatórios por rubrica alimentam P09 e P01.

---

### P12 · Remanejamentos
**Rota** `.../remanejamentos` · **Substitui** `Remanejamentos` · **MVP**

Transferências de saldo. Aba original também **vazia** (50 linhas de gabarito).

**Fluxo** `PROPOSTO` → `AUTORIZADO` → `EXECUTADO` (ou `REJEITADO`)

**Formulário** origem (rede/temática/PPG) · destino · rubrica · valor · justificativa ·
documento de autorização (anexo obrigatório para autorizar).

**Regras**
- Só `AUTORIZADO`/`EXECUTADO` afeta saldo (RN-13).
- Valida se a origem tem saldo suficiente; se não, alerta sem bloquear (a regra oficial
  ainda não existe — `PEND-008`).
- Visualização em Sankey origem → destino, opcional.

---

### P13 · Pendências e decisões
**Rota** `/pendencias` · **Substitui** `Pendencias` · **MVP**

Lista de trabalho da equipe. Hoje são **14 itens** e eles não têm dono nem prazo real
— e o painel da própria planilha ainda anuncia 10 (ver §9.8).

**Visões** lista (com filtros) · kanban por status · agrupada por rede.

**Colunas** código · escopo · assunto · pendência/decisão · impacto · nível ·
responsável · prazo/momento · status.

**Ações** nova pendência · atribuir responsável · mudar status · **resolver** (exige
texto de resolução) · comentar · vincular a temática/PPG/bolsa.

**Regras**
- Pendências geradas automaticamente pelo sistema (divergência de saldo, catálogo sem
  correspondência, PPG duplicado) nascem com origem `AUTOMATICA` e não podem ser
  excluídas — só resolvidas.
- O contador de pendências abertas aparece em P01 e P06.

---

### P14 · PPGs
**Rota** `/ppgs`, `/ppgs/[id]`, `/ppgs/novo` · **Substitui** `PPGs` + slide 3 do protótipo · **MVP**

**Lista** — busca, filtros por nível, modalidade, nota, situação, rede, temática.
Colunas: PPG, sigla, nível, nota, unidade, coordenador, situação, bolsas/ano, custo/ano.

**Formulário** (do protótipo)
```
Dados institucionais
  Nome do PPG · Unidade · Nível · Modalidade · Situação · Conceito CAPES · Área CAPES
  Coordenador · Vice-coordenador
Linhas temáticas / de pesquisa
  [campo + botão adicionar] → chips removíveis
Participação em redes
  [programa, rede, área temática, situação]
```

**Detalhe do PPG** — abas: dados, linhas de pesquisa, participações, bolsas planejadas,
bolsistas, convênios (fase 2), produção (fase 2), histórico.

**Regras**
- `notaCapes` de 1 a 7.
- PPG em rede nacional (BIONORTE, REAMEC, …) é sinalizado, porque o recurso pode ser
  compartilhado com outras instituições.

---

### P15 · Catálogo de bolsas
**Rota** `/catalogos/bolsas` · **Substitui** `Catálogo Bolsas`, `Bolsas Destino Brasil`, `Bolsas p Exterior` · **MVP**

A tabela oficial. **É a fonte de verdade de todo cálculo do sistema.**

**Blocos**
1. Cabeçalho da versão vigente: versão, data-base, cotação, normativa, vigência.
2. Tabela dos 60 itens, agrupada por destino e modalidade. Colunas: código, destino,
   modalidade, vigência, USD, BRL, fonte, observação.
3. Notas normativas (regra dos 15 dias, composição do valor, adicional de alto custo).

**Ações** nova versão da tabela · editar item (só em versão não vigente) · importar de
planilha · comparar versões · exportar.

**Regras**
- **A PROPESP é a autoridade sobre o catálogo** (resposta **Q10**): ela replica o anexo
  da CAPES e publica a versão institucional. Coordenadores de PPG só consultam.
- **Versão vigente é imutável.** Reajuste cria versão nova; bolsas já planejadas mantêm
  o vínculo com a versão em que foram calculadas.
- Ao publicar nova versão, o sistema lista quais linhas de plano mudam de valor e por
  quanto, antes de confirmar.
- Toda versão registra a norma de origem e o anexo do documento da CAPES.

---

### P16 · Premissas e fontes
**Rota** `.../premissas` · **Substitui** `Premissas` · **MVP**

Documenta as convenções do modelo. Sem isso, ninguém entende de onde vêm os números.

**Blocos**
1. **Premissas-chave** — item, valor, unidade, natureza, fonte, data-base, responsável,
   observações. (período do modelo, repetição anual sem reajuste, cotação 6,59,
   tratamento da UNICAMP, tratamento das sobras, atualização monetária)
2. **Fontes documentais** — nome, conteúdo, escopo, status, arquivo, data de recebimento,
   referência normativa, com anexo.

**Regras** — alterar uma premissa que entra em cálculo (ex.: cotação) exibe o impacto
antes de confirmar e fica registrada na auditoria.

---

### P17 · Comitê Gestor
**Rota** `.../comite-gestor` · **Substitui** `Comitê Gestor 2026-2029` · **MVP**

Orçamento **separado** do de bolsas: R$ 381.333,00/ano, 2026–2029, para missões e
articulação institucional.

**Blocos** cartões (total anual, total do ciclo, maior aporte, redes) · tabela por rede
e ano · distribuição percentual · síntese executiva.

**Regra** — um aviso fixo no topo: *"Este orçamento não integra o orçamento de bolsas
CAPES Global."* Foi o que o PNG do painel do Comitê Gestor precisou dizer por escrito.

---

### P18 · Convênios internacionais — *fase 2*
**Rota** `/convenios` · **Origem** slides 4 e 5 do protótipo

**Lista** universidade parceira · país · tipo de acordo · vigência · status · PPGs · ações.
**Filtros** país, tipo de acordo, status, PPG.
**Cartões** países parceiros · alunos em intercâmbio · acordos ativos.
**Formulário** (painel lateral, como no protótipo) universidade · país · tipo · datas ·
descrição · upload de documentação (PDF/DOCX, máx. 10 MB).

**Regra** — convênio a vencer nos próximos 6 meses gera alerta.

---

### P19 · Produção e produtos da cooperação — *fase 2*
**Rota** `/producao` · **Origem** slide 8 do protótipo + sua anotação *"uma área para cadastrar o produto da cooperação"*

Fecha o ciclo: recurso → mobilidade → **resultado**.

**Blocos** lista de produtos (título, tipo, autores, PPG, ano, status, países) ·
produção por ano/PPG/área · distribuição por tipo · vínculo com bolsa e convênio de origem.

**Regra** — todo produto pode apontar para a bolsa e/ou o convênio que o originou. É o
que permite responder "o que rendeu o dinheiro investido".

---

### P20 · Relatórios e exportações
**Rota** `/relatorios` · **MVP (parcial)**

Modelos prontos, em PDF e XLSX:
- Painel executivo do ciclo
- Panorama de mobilidade (equivalente aos três PNGs de insight, gerados pelo sistema)
- Orçamento por rede e temática
- Plano de aplicação completo (bolsas, manutenção e missões)
- Prestação de contas por temática
- Relação de bolsistas por período

**Regra** — todo relatório carimba data/hora de geração, ciclo, filtros aplicados e
uma nota sobre dados pendentes (ex.: "UNICAMP sem orçamento definido").

---

### P21 · Importação de planilhas
**Rota** `/importacao` · **MVP**

Como GCUB e Erasmus já existem em planilha, importar precisa ser rotina, não exceção.

**Fluxo** upload → escolha do modelo → **pré-visualização com validação** → correção
linha a linha → confirmação → registro da importação (arquivo, quem, quando, quantas linhas).

**Modelos** catálogo de bolsas · PPGs · plano de aplicação · orçamento · execução · bolsistas.

**Adaptador por programa.** Cada programa traz planilha com estrutura própria
(resposta **Q9**) — GCUB, Erasmus e CAPES Global não compartilham layout. Em vez de
um importador genérico que tenta adivinhar, cada programa tem seu **mapeamento de
colunas**, definido uma vez e reutilizado:

```
Adaptador "GCUB 2026"
  coluna "Nome do aluno"      → bolsista.nome
  coluna "Univ. Destino"      → instituicaoDestino
  coluna "Início"             → dataInicio        (formato dd/mm/aaaa)
  valor fixo                  → programa = GCUB
  regra                       → fluxo = OUT
```

O mapeamento é editável pela própria equipe na interface, sem depender de
desenvolvimento a cada planilha nova. É o que impede o sistema de virar refém do
formato de quem envia o arquivo.

**Regras**
- Nada é gravado antes da confirmação.
- Erros e avisos são separados: erro bloqueia a linha, aviso não.
- Toda importação pode ser desfeita enquanto nenhum dado dela foi editado.
- O arquivo original fica guardado como anexo da importação — quando o número
  divergir depois, dá para voltar à fonte.

---

### P22 · Documentos oficiais
**Rota** `/documentos` · **Novo** (resposta **Q7**) · Fase 1.5

O sistema gera os documentos que hoje são redigidos à mão a partir dos números da
planilha — que é justamente onde o número desatualizado costuma entrar.

**Modelos previstos**
- Ofício de solicitação de implementação de bolsa
- Termo de concessão / compromisso do bolsista
- Ofício de remanejamento (a partir de um `Remanejamento` autorizado)
- Portaria de designação de membro de comitê
- Declaração de participação em mobilidade
- Relatório de prestação de contas por temática

**Como funciona** modelo com marcadores (`{{ppg.nome}}`, `{{bolsa.valor}}`) →
preenchimento automático a partir do registro de origem → pré-visualização →
geração em PDF/DOCX → anexo fica vinculado ao registro que o originou.

**Regras**
- Todo documento gerado guarda **quem gerou, quando e com quais dados** — se o valor
  mudar depois, o documento emitido continua sendo o que foi assinado.
- Documento gerado a partir de registro com pendência aberta sai com marca d'água
  de rascunho.
- Numeração sequencial por tipo e ano, sem lacuna.

> **A definir com a equipe:** quais modelos são realmente necessários no primeiro
> momento, e se algum deles tem forma obrigatória definida pela CAPES ou pela
> Procuradoria da UEA. Isso está na lista de perguntas ([§11](#11-perguntas-e-respostas), Q11).

---

### P23 · Catálogos auxiliares e configurações
**Rotas** `/catalogos/modalidades`, `/catalogos/instituicoes`, `/configuracoes` · **MVP (parcial)**

Modalidades · instituições (redes, parceiras internacionais) · países · tipos de acordo ·
meses de implementação · e as configurações gerais (ciclo padrão, formato de exportação,
identidade visual).

---

## 8. Seed: mapeamento planilha → banco

A seed reproduz o estado atual das planilhas, para que o sistema já nasça com o
comportamento real e a migração seja verificável.

### 8.1 Volumes

| Entidade | Registros | Origem |
|---|---|---|
| `Instituicao` | 4 | UEA + UNESP, UFMG, UNICAMP |
| `Programa` | 6 | CAPES Global (com dados) + GCUB, Erasmus+, PDSE, Move La América, PROAFRI (vazios) |
| `Ciclo` | 2 | CAPES Global 2027–2030; Comitê Gestor 2026–2029 |
| `RedeCoordenadora` | 3 | `Redes_Tematicas` |
| `AreaTematica` | 12 | 4 por rede |
| `Pessoa` (membros de comitê) | 13 | abas `Comitê *` |
| `MembroComite` | 13 | UNICAMP-T1 tem 2 membros; ninguém se repete entre temáticas |
| `Ppg` | 24 | `PPGs` |
| `ParticipacaoPpg` | 24 | `PPGs` |
| `Modalidade` | 7 | catálogo |
| `TabelaValores` | 1 | versão 2026-07-29, cotação 6,59 |
| `ItemCatalogoBolsa` | 60 | `Catálogo Bolsas` (`CAT-001`..`CAT-060`) |
| `OrcamentoTematica` | 48 | 12 temáticas × 4 anos (16 delas `A_DEFINIR`) |
| `ItemPlanejado` | 33 | `Plano_Bolsas` — todas de `rubrica = BOLSAS` (23 programadas + 10 pendentes). Manutenção e missões: **0 itens** (§4.5) |
| `PlanejamentoAnual` | 132 | 33 × 4 anos |
| `OrcamentoComiteGestor` | 12 | 3 redes × 4 anos |
| `Premissa` | 5 | `Premissas` — a aba lista 6 itens, mas "Atualização monetária" vem **sem valor**; ele é na verdade `PEND-007`, não uma premissa |
| `FonteDocumental` | 2 | `Premissas` |
| `Pendencia` | 14 | `Pendencias` — o painel da planilha diz 10 (ver §9.8) |
| `LancamentoExecucao` | 0 | aba vazia |
| `Remanejamento` | 0 | aba vazia |
| `BolsaConcedida` | 0 | não existe hoje |

### 8.2 Correspondência aba → entidade

| Aba | Entidade(s) | Observação |
|---|---|---|
| `Catálogo Bolsas` | `TabelaValores` + `ItemCatalogoBolsa` | Fonte primária. `Bolsas Destino Brasil` e `Bolsas p Exterior` são a mesma informação — usar apenas o catálogo. |
| `PPGs` | `Ppg` + `ParticipacaoPpg` | Sigla, nota, situação, modalidades previstas. |
| `Redes_Tematicas` | `RedeCoordenadora` + `AreaTematica` + `OrcamentoTematica` | A coluna de rubricas vem de células multilinha (ver §9.3). |
| `Plano_Bolsas` | `ItemPlanejado` (rubrica `BOLSAS`) + `PlanejamentoAnual` | Guardar `Texto-fonte` em `textoFonte`. |
| `Orçamento_2027_2030` | `OrcamentoTematica` | Redundante com `Redes_Tematicas`; usar como conferência, não como fonte. |
| `Execucao` | `LancamentoExecucao` | Vazia — só cria a estrutura. |
| `Remanejamentos` | `Remanejamento` | Vazia. |
| `Pendencias` | `Pendencia` | 13 itens, com dois padrões de código (ver §9.5). |
| `Premissas` | `Premissa` + `FonteDocumental` | Conteúdo duplicado na própria aba (ver §9.4). |
| `Comitê Gestor 2026-2029` | `OrcamentoComiteGestor` | Ciclo separado. |
| `Atualização UFMG` | `RegistroAuditoria` | **Não é entidade nova** — é o registro de uma alteração. Semear como histórico. |
| `Painel Executivo`, `Painel_UEA`, `Mapa_Recursos_UEA` | — | **Nada a semear.** São visões calculadas; viram P01 e P02. |
| `Comitê UNESP/UFMG/UNICAMP` | conferência | Origem dos dados já consolidados nas demais abas. |

### 8.3 Regra de ouro da seed

**Semeie apenas dados de entrada; nunca semeie derivados.** Custo anual, saldo,
utilização, percentuais e totais devem sair do código de cálculo. Se um valor calculado
pelo sistema não bater com o da planilha, é bug de fórmula ou dado sujo — e é
exatamente isso que a seed precisa expor.

**Teste de aceite da migração** — com a seed carregada, o sistema deve reproduzir:

| Indicador | Valor esperado |
|---|---|
| Aporte anual conhecido | R$ 1.250.355,59 |
| Aporte do ciclo | R$ 5.001.422,36 |
| Custo anual de bolsas | R$ 1.144.357,20 |
| — UNESP | R$ 624.867,50 |
| — UFMG | R$ 519.489,70 |
| Bolsas/ano | 25 (2 IN + 23 OUT) |
| Bolsas no ciclo | 100 |
| Saldo potencial/ano | R$ 36.247,25 |
| Saldo potencial do ciclo | R$ 144.989,00 |
| PPGs mapeados | 24 (UNESP 8 · UFMG 6 · UNICAMP 10) |
| Temáticas sem orçamento | 4 |
| Divergências de saldo | 2 |
| Pendências abertas | 14 (a planilha exibe 10 — §9.8) |
| Comitê Gestor/ano | R$ 381.333,00 |

---

## 9. Inconsistências encontradas nos dados

Levantadas durante a extração. **Cada uma vira uma decisão de projeto**, não apenas um
conserto pontual.

### 9.1 Três contagens diferentes de "bolsas"
| Fonte | Valor | O que está contando |
|---|---|---|
| `Painel Executivo`, `Mapa_Recursos_UEA` | **25** (2 IN + 23 OUT) | soma das quantidades |
| PNG "Panorama de Bolsas" | **23** (2 IN + 21 OUT) | linhas de planejamento |
| PNG "Panorama Orçamentário" | **21** (2 IN + 19 OUT) | linhas, antes da atualização da UFMG |

O mesmo aparece no custo: o PNG informa **R$ 1.021.849,10/ano** e a planilha
**R$ 1.144.357,20/ano**. A diferença é exatamente **R$ 122.508,10** — as quatro bolsas
de Capacitação que a UFMG acrescentou depois.

→ **Decisão:** RN-11 fixa "bolsa = unidade". Painéis carimbam data-base. Um valor
recalculado nunca sai desatualizado.

### 9.2 Divergência entre saldo calculado e informado
`UNESP-T3`: R$ 206,10 · `UNESP-T1`: R$ 11.005,49 — origem de `PEND-001` e `PEND-003`.
→ **Decisão:** RN-08 detecta e cria pendência automaticamente.

### 9.3 Três valores numa célula só
Em `Comitê UNESP`, o orçamento vem como texto multilinha:
```
R$ 233.854,04 para Bolsas
R$ 10.555,60 para Manutenção
R$ 21.999,60 para Missão
```
→ **Decisão:** rubrica é coluna própria (`valorBolsas`, `valorManutencao`, `valorMissoes`).

### 9.4 Conteúdo duplicado e dados fora de grade
- `Premissas` repete o mesmo bloco duas vezes (linhas 6–19 e 20–33).
- `Comitê UNICAMP` tem uma linha com tabulações embutidas que não virou colunas, e uma
  anotação solta (*"No projeto está em Saúde"*).
- E-mails com espaço ou parêntese sobrando: `slemos@uea.edu.br `, `jvicente@uea.edu.br)`.
- Valor malformado `R$ 25.37,87`, interpretado como R$ 2.537,87 (a própria planilha
  registra a correção).

→ **Decisão:** a importação (P21) valida e normaliza antes de gravar; a seed já entra limpa.

### 9.5 Codificação inconsistente de pendências
Convivem `PEND-001`, `PEND-011-UFMG`, `PEN-011`, `PEN-012`, `PEN-013` — três padrões.
As três últimas ainda usam colunas com significado diferente das demais.
→ **Decisão:** código gerado pelo sistema, sequencial por ciclo.

### 9.6 PPG em duas temáticas
`PROFSAÚDE` aparece em `UNICAMP-T1` (Saúde, Natureza e Sociedade) e em "Tecnologias e
Inovação para os Territórios" — é `PEND-006`, risco de dupla contagem.
→ **Decisão:** o sistema permite, mas sinaliza e exige decisão explícita sobre qual
temática contabiliza o orçamento.

### 9.7 Áreas temáticas não são as mesmas entre redes
"Saúde" aparece como `Saúde única` (UNESP-T3), `Saúde e Bem-estar` (UFMG-T3) e
`Saúde, Natureza e Sociedade` (UNICAMP-T1).
→ **Decisão:** `AreaTematica` pertence à rede. Um agrupamento temático transversal, se
for necessário, é uma etiqueta à parte — **não** o mesmo campo.

### 9.8 O contador de pendências está defasado
A aba `Pendencias` tem **14 itens**; o `Painel Executivo` anuncia **10**. A diferença
são justamente os quatro últimos (`PEND-011-UFMG`, `PEN-011`, `PEN-012`, `PEN-013`),
acrescentados depois de o painel ter sido calculado.

É o mesmo defeito de §9.1, em outra célula: **um número escrito à mão que não sabe que
a fonte mudou.** É exatamente isso que o sistema elimina — contadores derivados de
consulta, nunca digitados.

### 9.9 UNICAMP sem orçamento
10 PPGs mapeados, 4 temáticas, zero recurso definido (`PEND-004`, `PEND-005`, `PEN-013`).
→ **Decisão:** `A_DEFINIR` é um estado de primeira classe. Nenhum indicador trata
pendente como zero; todo total diz o que está de fora.

---

## 10. Fases de entrega

### Fase 1 — MVP (substitui as planilhas)
Núcleo (PPGs, redes, temáticas, catálogo) · orçamento e plano de aplicação nas três
rubricas · painéis e indicadores · pendências, execução e remanejamento · importação ·
seed com os dados reais.

**Critério de pronto:** a equipe consegue abandonar as duas planilhas, e todos os
indicadores da tabela de §8.3 batem.

> **Dependência crítica:** os coordenadores de PPG lançam dados desde o MVP (§3.5).
> Isso significa que o **escopo por PPG na autorização precisa entrar junto** — não é
> item de fase posterior. É a única peça do controle de acesso que não dá para adiar.

### Fase 1.5 — Mobilidade individual e documentos
Bolsistas · mapa de países e universidades · taxa de efetivação · consolidação
multiprograma com GCUB e Erasmus importados · geração de documentos oficiais (P22).

### Fase 2 — Ciclo completo
Convênios internacionais · produtos da cooperação · vínculo mobilidade → resultado ·
relatórios de impacto.

### Fase 3 — Integrações
Sucupira/CAPES · Lattes · sistema financeiro institucional · SSO com o diretório da UEA
(a base de autenticação já está pronta — ver [docs/autenticacao.md](docs/autenticacao.md)).

---

## 11. Perguntas e respostas

### 11.1 Respondidas — 2026-08-04

| # | Pergunta | Resposta | Onde entrou |
|---|---|---|---|
| **Q1** | Fórmula do valor líquido | `pago − cancelado` | RN-12. `empenhado` virou indicador separado de comprometimento. |
| **Q2** | Quem opera o sistema | PROPESP **e** coordenadores de PPG, que cuidam dos próprios programas | §3.5. Autorização passa a depender do recurso, não só do usuário. |
| **Q3** | Manutenção e missões têm plano detalhado? | Sim, como as bolsas | §4.5 (`ItemPlanejado` com rubrica) e P10 (três abas). |
| **Q4** | O recurso é transferido à UEA? | *Sem informação — adotado como premissa de trabalho* | RN-12. **Continua em aberto** (ver §11.2). |
| **Q5** | Convenção IN/OUT validada? | Sim | RN-10. Resolve `PEN-012`. |
| **Q6** | Remanejamento entre PPGs, temáticas e anos? | Sim | RN-13. Ressalva sobre a regra da CAPES abaixo. |
| **Q7** | Gerar documentos oficiais? | Sim | Nova página P22. |
| **Q9** | Planilhas de GCUB e Erasmus seguem o mesmo formato? | Não — cada uma tem sua peculiaridade | P21 ganha adaptador de mapeamento por programa. |
| **Q10** | Autoridade sobre o catálogo | PROPESP | P15. |

### 11.2 Ainda em aberto

| # | Pergunta | Por que ainda importa |
|---|---|---|
| **Q4** | Confirmar formalmente que o recurso é transferido à UEA, e quais rubricas. | Foi adotado como premissa, não como fato — a própria planilha registra isso em `PEN-011`. Se parte for paga direto pela rede coordenadora, "execução" muda de significado e o módulo financeiro precisa distinguir caixa de compromisso. **É a premissa mais cara de corrigir depois.** |
| **Q6b** | A **CAPES** autoriza remanejamento entre anos? | Q6 respondeu o que a PROPESP quer fazer; `PEND-008` pergunta o que o financiador permite. Remanejar entre exercícios costuma esbarrar em anualidade orçamentária. Até haver normativo anexado, o sistema permite e sinaliza o risco. |
| **Q8** | Há prazo institucional amarrado ao ciclo 2027–2030? | Não respondida. Define a ordem das fases — se o edital de março de 2027 for o alvo, o plano de aplicação precisa estar pronto antes da execução. |
| **Q11** | Quais modelos de documento são necessários primeiro, e algum tem forma obrigatória (CAPES ou Procuradoria)? | Nova, decorrente de Q7. Determina o esforço de P22. |
| **Q12** | Um coordenador enxerga dados financeiros de outros PPGs? | Nova, decorrente de Q2. Assumi que **sim, em leitura** (é governança, não sigilo). Se for sigiloso, muda todas as consultas dos painéis. |
| **Q13** | Manutenção e missões têm alguma tabela de referência (diária, teto de passagem), ou é estimativa livre? | Nova, decorrente de Q3. Se houver teto institucional, o sistema valida; se não, fica só a justificativa. |
| **Q14** | Quando o coordenador lança um bolsista, isso precisa de aprovação da PROPESP? | Nova, decorrente de Q2. Define se existe fluxo de submissão/homologação ou se o lançamento já vale. |
