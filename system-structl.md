# Sistema de Mapeamento da Internacionalização da Pós-Graduação — estrutura

Especificação funcional e de dados do sistema que substitui as planilhas hoje usadas
pela PROPESP/UEA para gerir bolsas, orçamento e mobilidade internacional da
pós-graduação.

**Última revisão:** 2026-09-05
**Fontes:** `dados/levamtamento de bolsas/`, incluindo a planilha atualizada
`Planejamento_CAPES_Global_2027_2030_Atualizado_UNICAMP_UFMG.xlsx`;
`dados/remanejamento/Guia_Orientacoes_Remanejamento_Transformacao_CAPES_Global final (1).pdf`;
`respostas/`; `dados/Planejamento_CAPES_Global_Consolidado_UFMG_Comite_Gestor/`;
`dados/insights/`; `dados/sugestaov1-prototipo/`.
**Estado da implementação:** autenticação/autorização, modelo de dados (40 tabelas),
seed com os dados reais, **serviços de cálculo (RN-01 a RN-20), telas de
planejamento anual, cadastro individual de bolsas/produtos e fundações de
missões, parceiros, prestação e documentos do Comitê Gestor** estão
implementados e testados.

| Página | Situação |
|---|---|
| P01, P05, P06, P07, P08, P09, P10, P13, P14, P15, P17, P23 | **implementadas** |
| P24 (parceiros) | **implementada em parte**: lista, busca, cadastro, contatos, histórico e conciliação; falta a seleção dentro da missão, a paginação e o escopo por rede |
| P16 | **retirada da interface**: premissas, fontes e decisões permanecem na documentação interna e no backend para rastreabilidade |
| P03 | **recorte inicial implementado**: concessão planejada, CPF, destino, datas, alertas e produtos individuais; anexos ainda pendentes |
| P02, P04 | dependem das bolsas concedidas que a equipe ainda cadastrará; o dado não existe nas planilhas |
| P11 | **fora do escopo do CAPES Global**: pagamentos são feitos diretamente pela CAPES; não há execução financeira no caixa da UEA |
| P12 | previsto apenas como **registro histórico** de movimentação já feita na CAPES, dentro da mesma temática |
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
11. [Checklist de decisões e pendências](#11-checklist-de-decisões-e-pendências)

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
3. Acompanha **orçamento, composição anual e saldo potencial**; no CAPES Global,
   registra movimentações externas sem executar ou autorizar remanejamentos.
4. Registra o **bolsista individual** — quem foi, para onde, quando, por quanto tempo.
5. Consolida a **mobilidade IN/OUT de todos os programas** numa visão única.
6. Guarda **pendências e decisões** como itens de trabalho, não como comentários soltos.
7. Fecha o ciclo com **convênios e produtos da cooperação** (fase 2).

### Recorte

| Dentro | Fora (por ora) |
|---|---|
| Planejamento orçamentário de programas de mobilidade | Execução financeira, folha, empenho e pagamento do CAPES Global |
| Cadastro de PPGs, redes, áreas temáticas, comitês | Gestão acadêmica do PPG (matrícula, disciplinas, defesas) |
| Bolsas planejadas e concedidas | Seleção/edital dos bolsistas (o sistema registra o resultado) |
| Convênios internacionais e produtos da cooperação (fase 2) | Currículo Lattes / integração CAPES Sucupira (fase 3) |
| Painéis gerenciais e exportações | BI corporativo |

### Instituição-sujeito

O sistema é da **UEA (Universidade do Estado do Amazonas)**, operado pela **PROPESP**.
UNESP, UFMG e UNICAMP aparecem como **redes coordenadoras externas** do programa
CAPES Global — não como instituições usuárias. Todos os PPGs cadastrados são da UEA,
e todos os Coordenadores de Temática têm e-mail `@uea.edu.br`.

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
| **Coordenador de Temática** | Docente responsável por um ou mais PPGs dentro de uma área temática. Cada participação PPG–temática tem um coordenador; a mesma pessoa pode coordenar vários PPGs. |
| **PPG** | Programa de Pós-Graduação da UEA. Tem sigla, nota CAPES, nível e área. |
| **Modalidade** | Tipo de bolsa: Professor Visitante, Professor Visitante Sênior, Professor Visitante Junior, Jovem Talento, Pós-doutorado, Doutorado Sanduíche, Capacitação. |
| **Destino** | `Brasil` ou `Exterior`. Determina qual tabela de valores se aplica. |
| **Vigência** | Duração da bolsa em meses. Aceita `0,5` (até 15 dias). |
| **Catálogo de bolsas** | Lista oficial e fechada (destino × modalidade × vigência → valor). No CAPES Global há 60 itens, `CAT-001` a `CAT-060`, sem cadastro de novas modalidades. |
| **Rubrica** | Natureza do recurso: `Bolsas`, `Manutenção`, `Missões`. |
| **Bolsa planejada** | Linha do plano anual: "PPG X recebe N bolsas da modalidade Y por Z meses, em Março". |
| **Bolsa concedida** | A bolsa planejada atribuída a uma pessoa concreta. |
| **Fluxo IN/OUT** | `IN` = alguém entra na UEA (bolsa com destino Brasil). `OUT` = alguém da UEA sai (destino Exterior). |
| **Implementação** | Mês em que a bolsa entra em vigor. Hoje só `Março` e `Setembro` (editais). |
| **Saldo potencial** | Orçamento de bolsas − custo da composição anual aprovada. Só é exibido como disponível quando a composição daquele exercício está aprovada. |
| **Sobra informada** | Valor que a equipe/rede informa como disponível na CAPES. É preservado separadamente do saldo calculado para evidenciar divergências. |
| **Movimentação/remanejamento** | Realocação registrada na plataforma CAPES. Para o Gerenciador, só é válida dentro da mesma temática; o sistema registra o fato, não propõe, autoriza nem executa. |
| **Pagamento direto CAPES** | Todo recurso do CAPES Global é pago diretamente pela CAPES. Não há entrada desse dinheiro no caixa da UEA. |
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
                          │   Coordenador de Temática responsável pelo PPG
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

- **22** = bolsas da composição aprovada de 2027 (2 IN + 20 OUT)
- **18** = linhas aprovadas que produzem essas 22 unidades
- **4** = propostas adicionais de Capacitação da UFMG, ainda pendentes

O sistema deve usar **sempre** "quantidade de bolsas" (unidades) nos indicadores
financeiros, e chamar a linha de plano de **"linha de planejamento"**, nunca de
"bolsa". Ver [§9](#9-inconsistências-encontradas-nos-dados).

### 3.5 Quem usa o sistema

Duas populações lançam dados (resposta **Q2**), e isso muda o desenho de autorização.

| Perfil | Quem é | O que faz |
|---|---|---|
| **Gestão PROPESP** | Equipe da Pró-Reitoria | Enxerga e edita tudo, registra orçamento e situações informadas pela CAPES e fecha o ciclo. Não autoriza atos em nome da CAPES. |
| **Coordenação de PPG** | Coordenador e vice de cada programa | Lança e edita **o que é do seu PPG**: plano, bolsistas, documentos, produtos e convênios. Enxerga o consolidado, mas em modo leitura. |
| **Coordenador de Temática** | Docente responsável por uma área | Visualiza todos os PPGs e bolsistas das temáticas que coordena. |
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
- Movimentações externas e mudança de status são registradas pela PROPESP com
  autoria e data; o Gerenciador não substitui a decisão da CAPES.
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
id PK · nome · nomeNormalizado UK · sigla
tipo (PROPRIA | REDE_COORDENADORA | PARCEIRA_INTERNACIONAL)
paisId FK? · cidade? · estadoRegiao? · tipoOrganizacao?
faculdadeDepartamento? · site? · emailInstitucional? · telefone? · endereco?
observacoes? · cadastroProvisorio · ativo · criadoEm · atualizadoEm
```

**`InstituicaoRede`** — associação N:N entre parceiro e redes coordenadoras.
```
id PK · instituicaoId FK · redeId FK · criadoEm · atualizadoEm
UK (instituicaoId, redeId)
```

**`ContatoInstituicao`** — contatos reutilizáveis da instituição parceira.
```
id PK · instituicaoId FK · nome · nomeNormalizado
cargo? · departamento? · area? · email? · telefone? · paisId FK?
idiomaComunicacao? · principal · observacoes? · ativo · criadoEm · atualizadoEm
```

Há no máximo um contato principal ativo por instituição. A chave normalizada de
instituição elimina diferenças inequívocas de caixa, acento, pontuação e espaço;
siglas e traduções exigem conciliação humana. Contatos são entidades centrais:
missões futuras os referenciam por id, sem copiar seus dados pessoais.

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
id PK · nome · email? · cpf? (11 dígitos, único) · documento? · tipo (DOCENTE | DISCENTE | PESQUISADOR | EXTERNO)
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

**`ParticipacaoPpg`** — qual PPG participa de qual área temática.
```
id PK · areaTematicaId FK · ppgId FK
coordenadorTematicaId FK → Pessoa
situacao (CONTEMPLADO | CADASTRO_PRELIMINAR | NAO_CONTEMPLADO)
modalidadesPrevistas[]? · observacoes?
```
> Precisa de **unique(areaTematicaId, ppgId)**. O PROFSAÚDE foi formalmente
> confirmado somente em `UNICAMP-T1`; a antiga dúvida `PEND-006` está resolvida.
> Cada participação tem exatamente um Coordenador de Temática. Uma temática pode
> ter vários coordenadores quando eles cuidam de PPGs diferentes, e uma pessoa
> pode coordenar vários PPGs — é o caso de `UNICAMP-T1`.

**`MembroEquipeGestao`** — composição operacional da P17, sem relação com o
comitê temático acima.
```
id PK · cicloId FK · pessoaId FK
tipoEquipe (COMITE_GESTOR | ADMINISTRACAO) · funcao
dataInicio · dataFim? · observacoes?
```
> A mesma pessoa pode integrar as duas equipes e pode ser reutilizada em várias
> missões. Vínculos encerrados não são apagados; períodos sobrepostos na mesma
> equipe são recusados. Este vínculo é dado de negócio e não concede papel no
> Keycloak.

**`MembroEquipeGestaoRede`** — redes cujos documentos formais fundamentam o
vínculo consolidado.
```
id PK · membroEquipeId FK · redeId FK
unique(membroEquipeId, redeId)
```
> A composição formal de UFMG, UNESP e UNICAMP contém 19 ocorrências, mas apenas
> 10 pessoas e 10 vínculos de equipe. A associação preserva as redes sem duplicar
> a pessoa nem impedir membros cadastrados manualmente sem rede específica.

**`MissaoComite`** — viagem institucional efetiva, separada de
`ItemPlanejado(MISSOES)` e inicialmente sem qualquer valor financeiro.
```
id PK · cicloId FK · codigo · tipo? · unidadeDepartamento? · titulo · objetivo
dataInicio · dataFim
status (RASCUNHO | PLANEJADA | CONFIRMADA | CONCLUIDA | CANCELADA)
relatoGeral? · resultados? · observacoes?
```

**`MissaoParticipante`**
```
id PK · missaoId FK · pessoaId FK · membroEquipeId FK?
papel (RESPONSAVEL | PARTICIPANTE | APOIO) · cargo? · area?
dataInicio · dataFim · observacoes?
```
> A pessoa é única por missão e `membroEquipeId` é opcional, pois participantes
> externos às duas equipes também são permitidos. A API exige exatamente um
> responsável e o banco impede dois responsáveis na mesma missão.

**`AtividadeMissao`** — cada parada ou compromisso do roteiro.
```
id PK · missaoId FK · ordem · tipo (VISITA_TECNICA | EVENTO | ARTICULACAO | BANCA | OUTRO)
titulo · paisId FK · cidade? · estadoRegiao? · local? · endereco?
instituicaoId FK? ou instituicaoNome? · contatoInstituicaoId FK?
tipoRelacionamento? · objetivoRelacionamento?
eventoNome? · eventoTipo? · eventoSite? · objetivoParticipacao?
relacaoInternacionalizacao?
dataInicio · dataFim · planejamento? · relatoRealizado? · resultados?
status (PLANEJADA | REALIZADA | NAO_REALIZADA) · observacoes?
```
> O país fica na atividade, não na missão, para que uma viagem registre vários
> países, cidades, universidades e eventos sem duplicar a missão.
> No MVP, evento permanece uma atividade: instituição, datas e redes não são
> duplicadas em campos concorrentes. O número de dias de missão, atividade e
> participação é inclusivo e calculado em UTC, nunca persistido.

### 4.3 Catálogo de valores

**`Modalidade`**
```
id PK · nome · destinosPermitidos[] (BRASIL | EXTERIOR)
publicoAlvo (DOCENTE | DISCENTE | POS_DOC | AMBOS) · ativa
```

**`TabelaValores`** — versão do catálogo. Existe porque a CAPES pode reajustar
valores. A `PEND-007`, que registrava esse risco, foi resolvida quando orçamento
por exercício, justificativa e auditoria passaram a existir; o histórico continua
sem poder ser sobrescrito.
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
> No CAPES Global, as modalidades vêm exclusivamente das listas **Bolsa destino
> Brasil** e **Bolsa p/ exterior**. Usuários não cadastram novos tipos.

### 4.4 Orçamento

**`OrcamentoTematica`** — uma linha por área temática por ano.
```
id PK · areaTematicaId FK · ano
valorBolsas · valorManutencao · valorMissoes
status (DEFINIDO | A_DEFINIR)
statusComposicao (A_DEFINIR | EM_ELABORACAO | APROVADA)
fonte? · observacoes?
```
> Orçamento e composição são fatos diferentes: a UNICAMP já tem teto de bolsas,
> mas ainda não tem modalidades e quantidades aprovadas. Os dois estados nunca
> devem ser condensados num único “aprovado”.
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

**`PlanejamentoAnual`** — quantidade por ano. A composição de modalidades pode
mudar entre os exercícios, embora o valor consolidado anual do programa permaneça
o mesmo (resposta **Q15**). Cada ano permanece explícito para registrar quais tipos
e quantidades foram escolhidos naquele exercício.
```
id PK · itemPlanejadoId FK · ano · quantidade
```

> **Nota sobre a seed:** todas as redes têm orçamento de manutenção, mas somente a
> UNESP informou os valores (R$ 69.751,14/ano somando manutenção e missões). UFMG e
> UNICAMP ficam com valor nulo, exibido como **A definir**, nunca R$ 0,00. Não há
> itens detalhados de manutenção/missão na fonte.

**`BolsaConcedida`**
```
id PK · itemPlanejadoId FK? · ppgId FK · pessoaId FK
programaId FK · cicloId FK · modalidadeId FK · destino
nivelBeneficiario (MESTRADO | DOUTORADO | POS_DOC | DOCENTE | MOBILIDADE_BREVE)
origem: paisOrigemId FK? · instituicaoOrigemId FK?
paisOrigemNome · instituicaoOrigemNome
paisDestinoId FK? · instituicaoDestinoId FK?
paisDestinoNome · instituicaoDestinoNome
dataInicio · dataFim · vigenciaMeses · valorConcedido
fluxo (IN | OUT)
status (SELECIONADO | EM_ANDAMENTO | CONCLUIDA | CANCELADA | INTERROMPIDA)
processo? · observacoes?
```
> `itemPlanejadoId` é opcional: bolsas de outros programas (GCUB, Erasmus) podem
> chegar sem passar por planejamento nesta ferramenta. Quando preenchido, aponta
> obrigatoriamente para um item de `rubrica = BOLSAS`.
> `nivelBeneficiario` inclui `MOBILIDADE_BREVE`, termo que veio da sua anotação.
> Para o CAPES Global, CPF, país e universidade/instituição de origem e de destino
> são obrigatórios no cadastro. Os textos são preservados mesmo antes de existir um
> catálogo completo de instituições.

**`ProdutoBolsa`** — entrega cobrada de um bolsista específico.
```
id PK · bolsaConcedidaId FK · tipo
titulo · descricao? · prazoEntrega · status
dataEntrega? · doi? · link? · observacoes?
```
> Os tipos cobrem artigo, trabalho, projeto, relatório, publicação, livro,
> capítulo de livro, patente, evento e outros. Produto entregue ou validado exige
> `dataEntrega`. Este registro individual não substitui a visão consolidada P19.

### 4.6 Estrutura financeira genérica — não usada pelo CAPES Global

As tabelas abaixo permanecem no modelo multiprograma, mas **não alimentam o CAPES
Global**. A equipe confirmou que todos os recursos desse programa são pagos
diretamente pela CAPES e que o Gerenciador não acompanhará empenho, pagamento,
cancelamento ou estorno.

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
> No CAPES Global essa estrutura será usada, quando implementada, somente como
> registro histórico de movimentação já feita na CAPES, com origem e destino na
> mesma temática. Os estados propositivos permanecem apenas para outros programas.

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

**`Anexo`** — documentos (edital, resultado final, documentos do bolsista,
plano de trabalho, produto final, carta oficial excepcional, convênios).
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
Se não houver correspondência exata, **não interpole nem cadastre uma modalidade
nova**: a combinação não pode ser usada no CAPES Global.

> Exemplos verificados: Exterior/Doutorado Sanduíche/6m → R$ 82.902,20 (`CAT-053`);
> Brasil/Professor Visitante/1m → R$ 21.650,00 (`CAT-002`).

### RN-02 · Regra dos 15 dias (Professor Visitante)
Bolsa de até 15 dias (inclusive) usa `vigencia = 0,5`. De 16 dias a um mês, usa
`vigencia = 1`. Regra textual do anexo de bolsas no Brasil.

### RN-03 · Conversão de bolsas no exterior
A CAPES calcula a conversão com uma cotação máxima de segurança. O sistema recebe
e armazena o **valor final em BRL**, já incluído no orçamento aprovado. Depois da
aprovação esse valor em reais fica congelado: nenhuma tela consulta câmbio ao vivo
ou recalcula bolsas antigas. A cotação de **6,59** permanece apenas como memória da
versão da tabela que originou os valores atuais.

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
> Valor ainda não informado permanece nulo/A definir. UFMG e UNICAMP não recebem
> R$ 0,00 fictício para manutenção.

### RN-06 · Saldo potencial
```
saldoPotencial = valorBolsas − Σ custoNoAno das bolsas PROGRAMADAS da temática
```
> Verificado: UNESP-T4 = 233.854,04 − 231.045,40 = **2.808,64** ✓
> Em 2027, UNESP + composição original aprovada da UFMG deixam **R$ 147.091,05**.
> A UNICAMP tem orçamento, mas composição a definir; por isso seu teto não é
> apresentado como saldo livre. Propostas `PENDENTE` também não consomem saldo.

### RN-07 · Utilização do orçamento
```
utilizacao = custoBolsasProgramado / valorBolsas
```
Semáforo sugerido: < 90% atenção (recurso ocioso) · 90–100% saudável · > 100% estouro.
> Verificado sobre a composição original aprovada: UFMG-T1 = 54.697,00 /
> 89.500,00 = **61,11%**. A Capacitação adicional continua pendente.

### RN-08 · Divergência de saldo
```
divergencia = saldoCalculado − saldoInformado
```
Quando ≠ 0, cria alerta e pendência. As divergências históricas da UNESP-T3 e da
UNESP-T1 foram conciliadas com a equipe. Para a UNESP-T3, a equipe validou o
saldo calculado de **R$ 1.457,39** e orientou desconsiderar o valor divergente do
anexo. Na UNESP-T1, a composição atualizada totaliza R$ 261.095,80; contra o teto
de R$ 261.364,55, o saldo calculado e o informado são ambos **R$ 268,75**.

### RN-09 · Projeção plurianual
O **valor consolidado anual do programa não muda**, mas a composição de bolsas
pode mudar a cada exercício. O programa escolhe, em cada ano, entre as modalidades
já elencadas, preservando a distinção entre destino Brasil e destino exterior
(resposta **Q15**).
```
orcamentoCiclo = orcamentoAnual × númeroDeAnos
```
> Verificado com a planilha atualizada: 2.315.444,58 × 4 = **9.261.778,32** de
> orçamento conhecido (inclui somente os R$ 69.751,14 de apoio conhecidos da
> UNESP; manutenção de UFMG/UNICAMP segue a definir).
> Portanto, uma modalidade não precisa se repetir em todos os anos. O sistema
> mantém cada exercício separado. A seed registra as bolsas conhecidas apenas em
> 2027; 2028–2030 começam sem modalidade/quantidade, até decisão formal.

### RN-10 · Classificação IN/OUT
```
destino = BRASIL   → fluxo = IN   (mobilidade com entrada no Brasil)
destino = EXTERIOR → fluxo = OUT  (mobilidade com destino no exterior)
```
> **Convenção validada institucionalmente** (resposta **Q5** e confirmação da
> `PEN-012`).
> O campo `fluxo` continua sobrescrevível com justificativa, para os casos de borda
> — por exemplo, um bolsista estrangeiro que já reside no Brasil.

### RN-11 · Contagem de bolsas
Indicadores financeiros e de mobilidade usam **soma de quantidades**, não contagem de
linhas. Ver [§3.4](#34-bolsa-é-ambíguo--e-isso-já-causou-erro).
> Verificado para a composição aprovada de 2027: 22 bolsas (2 IN + 20 OUT) a
> partir de 18 linhas. As 4 Capacitações adicionais da UFMG estão `PENDENTE`.

### RN-12 · Sem execução financeira interna no CAPES Global
Todos os recursos são pagos diretamente pela CAPES. O Gerenciador **não** registra
empenho, pagamento, cancelamento, estorno nem fluxo de caixa da UEA para esse
programa. “Saldo” nesta especificação é diferença entre teto e composição aprovada,
não conciliação bancária. A estrutura financeira genérica só poderá ser usada por
outros programas com política própria.

### RN-13 · Registro de movimentação externa
Para o CAPES Global, a movimentação é permitida **somente dentro da mesma área
temática**. Pode mudar a distribuição entre PPGs/bolsas dessa temática, mas nunca
cruza temática ou rede. O Gerenciador não solicita, autoriza ou executa: apenas
registra o que já ocorreu na CAPES, com valor, origem, destino, data, usuário e
evidência disponível. A tela não oferece estados `PROPOSTO`/`AUTORIZADO` para esse
programa.

### RN-14 · Orçamento do Comitê Gestor
É **paralelo**. Nunca deve ser somado ao orçamento de bolsas em nenhum indicador.
Painéis que mostram os dois precisam separá-los visualmente e dizer isso por escrito.
> R$ 381.333,00/ano (UFMG 120.000 + UNESP 121.333 + UNICAMP 140.000), 2026–2029.

### RN-15 · Efetivação
```
taxaEfetivacao = Σ bolsas concedidas / Σ bolsas planejadas (mesmo ano/temática)
```
Métrica nova, impossível na planilha atual.

### RN-16 · Situação temporal da bolsa concedida
A situação é derivada das **datas completas** informadas pela equipe, sem persistir
um estado que envelheceria no banco:

- antes do início: `PROGRAMADA`; nos 60 dias anteriores: `PROXIMA`;
- do início até 31 dias antes do fim: `EM_VIGENCIA`;
- nos 30 dias finais: `PRESTES_A_EXPIRAR`;
- depois do fim, sem conclusão: `EXPIRADA`;
- `CONCLUIDA`, `CANCELADA` e `INTERROMPIDA` prevalecem sobre o calendário.

### RN-17 · Produtos individuais da bolsa
Cada produto pertence a uma única `BolsaConcedida`. Um produto aberto cujo
`prazoEntrega` já passou é apresentado como `ATRASADO`; entrega e validação exigem
data de entrega. Assim a cobrança responde diretamente qual bolsista ainda deve
qual artigo, trabalho, projeto ou outra entrega.

### RN-18 · Uma modalidade por CPF no ciclo
Um mesmo CPF pode usar apenas **uma modalidade de bolsa** durante todo o ciclo
CAPES Global 2027–2030. O sistema normaliza e valida o CPF e bloqueia uma nova
concessão quando já houver concessão desse CPF em modalidade diferente. Essa regra
não significa, por si só, “uma única linha”: repetições da mesma modalidade devem
ser analisadas conforme o edital.

### RN-19 · Confirmação e documentos do bolsista
O beneficiário só é confirmado pela PROPESP com base no resultado final do edital.
Para cada concessão devem poder ser anexados: RG antigo **ou** CIN, CPF, passaporte,
comprovante de residência, plano de trabalho e produto final. Edital e resultado
final também ficam no sistema. Carta oficial é armazenada somente quando houver
caso excepcional; o Gerenciador não a gera.

### RN-20 · Fonte externa e auditoria manual
Situações de aprovação, cancelamento, desistência, falecimento, substituição e
movimentação são informadas manualmente, porque acontecem na CAPES. O sistema confia
no estado informado, mas registra obrigatoriamente autoria, data/hora e histórico;
nunca sobrescreve silenciosamente o fato anterior.

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
          ├─ Movimentações       .../remanejamentos
          ├─ Comitê Gestor       .../comite-gestor
          └─ Parceiros           .../parceiros
              └─ Detalhe            .../parceiros/[id]
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
   - Aporte anual conhecido — R$ 2.315.444,58
   - Projeção nominal do ciclo — R$ 9.261.778,32
   - Bolsas aprovadas em 2027 — 22
   - Custo das bolsas aprovadas em 2027 — R$ 1.033.513,40
   - PPGs mapeados — 24
   - Bolsas programadas no ciclo — 22; 2028–2030 ainda não têm composição
   - Saldo potencial aprovado em 2027 — R$ 147.091,05; exclui a UNICAMP
   - Pendências abertas — 7 de 14 registradas
2. **Resumo por rede** — tabela + barras. Colunas: rede, orçamento anual, custo de
   bolsas, apoio (manutenção + missões), orçamento do ciclo, PPGs. Rede sem orçamento
   definido aparece hachurada com o rótulo "Pendente", **nunca como zero**.
3. **Resumo por modalidade** — modalidade, destino, qtd/ano, custo/ano, qtd e custo no ciclo.
4. **Impacto anual e do ciclo** — linha por indicador, coluna por ano.
5. **Alertas gerenciais** — composições anuais a definir, divergência de saldo (0),
   PPGs sem bolsa definida (10), apoio sem plano e pendências. Cada alerta leva ao registro.

**Regras**
- Todo cartão informa a **data-base** e distingue teto orçamentário de composição
  anual aprovada. A UNICAMP entra no aporte, mas não no saldo livre enquanto sua
  distribuição não for aprovada.
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
   > Composição aprovada de 2027: 2 IN e 20 OUT. As quatro Capacitações da UFMG
   > ficam fora até aprovação formal.
3. **Distribuição por modalidade** — barras, com valor e quantidade.
4. **Por programa** — quanto cada programa representa da mobilidade total.
5. **Série temporal** — evolução ao longo dos anos do ciclo.
6. **Leitura executiva** — bloco de texto com as conclusões, editável pela equipe
   (é o que os PNGs de insight fazem hoje à mão).

**Ações** exportar PNG/PDF do painel · exportar dados em CSV/XLSX.

---

### P03 · Bolsistas
**Rota** `/mobilidade/bolsistas` · **Recorte inicial implementado — sem seed individual** · **MVP**

Lista de todas as bolsas concedidas a pessoas.

**Colunas** beneficiário · nível · PPG · programa · modalidade · destino (país/universidade) ·
período · vigência · valor · fluxo · status

**Filtros previstos** iguais aos de P02, mais: status, período de vigência,
com/sem produto registrado. Ainda não fazem parte do recorte inicial.

**Ações**
- **Conceder bolsa** — parte de uma linha de planejamento e atribui a uma pessoa.
  O formulário pré-preenche modalidade, vigência e valor, e mostra quantas vagas
  daquela linha ainda estão livres.
- Editar as datas e a situação administrativa da concessão.
- Cadastrar e acompanhar produtos individualmente por bolsa concedida.

**Evolução restante de P03** — filtros, anexos dos documentos exigidos, histórico
auditável dos estados externos, retorno e justificativa estruturada de cancelamento.

**Regras**
- Ao conceder, exige uma vaga no `PlanejamentoAnual` do ano da data inicial e
  impede consumo concorrente ou acima da quantidade planejada.
- As datas de início e fim são completas, aparecem como `DD/MM/AAAA` na
  interface e alimentam os alertas da RN-16. A API e o banco continuam usando
  `AAAA-MM-DD`, com conversão sem fuso na Server Action.
- Produto aberto com prazo vencido alimenta o alerta individual da RN-17.
- CPF é obrigatório e um mesmo CPF não pode usar modalidades diferentes dentro
  do ciclo 2027–2030 (RN-18).
- País e universidade/instituição de origem e de destino são obrigatórios.
- O status é informado manualmente pela equipe; confirmação do beneficiário vem
  do resultado final do edital, não de um protocolo do Gerenciador.
- Devem ser anexáveis RG antigo ou CIN, CPF, passaporte, comprovante de residência,
  plano de trabalho e produto final. Essa parte documental ainda não foi implementada.

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

Lista somente os programas ativos. Por enquanto exibe apenas o CAPES Global.
Cada cartão apresenta nome, órgão financiador, ciclos, orçamento, linhas e PPGs.

**Ações** criar programa · abrir · arquivar.

**Seed** CAPES Global ativo. GCUB, Erasmus+, PDSE, Move La América e PROAFRI são
preservados como cadastros inativos para possível uso futuro e não aparecem na
interface nem aceitam acesso por rota.

---

### P06 · Visão do programa / ciclo
**Rota** `/programas/[programa]/[ciclo]` · **Central do ciclo** · **MVP**

Página-índice do ciclo criada a partir da função de navegação que a aba `Premissas`
exercia na planilha. Exibe cartões de atalho para redes, orçamento, plano de bolsas,
movimentações externas, pendências e comitê gestor — cada um com um número vivo
(ex.: "Pendências · 5 abertas").

---

### P07 · Redes e áreas temáticas
**Rota** `.../redes` · **Substitui** `Redes_Tematicas` e as abas `Comitê *` · **MVP**

**Blocos**
1. Cartões por rede: orçamento anual, temáticas, PPGs, status, IN/OUT.
2. Tabela de áreas temáticas agrupada por rede. Colunas: código, área, PPGs
   contemplados, Coordenadores de Temática por PPG, quantidade de PPGs no tema, orçamento
   (bolsas/manutenção/missões/total), custo calculado,
   custo informado, saldo e utilização. A divergência não ocupa uma coluna fixa.

**Regras**
- Divergência ≠ 0 exibe alerta, marca a linha em vermelho e abre acesso rápido a
  "criar pendência". Os valores calculado, informado e a diferença aparecem no
  detalhe da temática.
- A UNICAMP mostra o orçamento de bolsas aprovado e, separadamente, a composição
  `A_DEFINIR`; manutenção sem valor aparece como **A definir**, jamais zero.

**Ações** nova rede · nova área temática · gerenciar Coordenadores de Temática · vincular PPGs.

---

### P08 · Detalhe da área temática
**Rota** `.../tematicas/[codigo]` · **MVP**

Tudo sobre uma temática em uma página.

**Abas internas**
- **Resumo** — orçamento por rubrica, custo, saldo, utilização e Coordenadores de Temática por PPG.
- **PPGs** — participantes, nota, situação, modalidades previstas, participação no
  custo (%), com alerta de PPG duplicado em outra temática.
- **Plano de aplicação** — as linhas daquela temática nas três rubricas, com custo e projeção.
- **Movimentações** — histórico do que já foi realizado na plataforma CAPES.
- **Histórico** — trilha de auditoria (quem mudou orçamento/plano, quando, por quê).
  > É o que teria preservado a programação da UFMG antes da transformação das sobras.

---

### P09 · Orçamento
**Rota** `.../orcamento` · **Substitui** `Orçamento_2027_2030` · **MVP**

Matriz ano × rede/temática com: orçamento aprovado de bolsas, manutenção e missões,
status da composição anual, custo programado e saldo potencial. Valores não informados
ficam nulos/A definir. A tela não exibe execução financeira da UEA, porque os pagamentos
são feitos diretamente pela CAPES.

**Modos de visualização** por ano · por rede · por temática · consolidado do ciclo.

**Ações** registrar o orçamento formalmente aprovado por área temática e exercício,
com fonte, justificativa e auditoria por campo · exportar (previsto). O teto
nominal pode repetir-se nos quatro anos, mas a composição de bolsas nunca é replicada
automaticamente.

**Regras**
- O orçamento em BRL fica congelado após aprovação; alteração exige novo ato formal,
  justificativa e auditoria.
- Composição anual tem estado próprio: `A_DEFINIR`, `EM_ELABORACAO` ou `APROVADA`.
- Célula editável e célula calculada precisam ser visualmente distintas.

---

### P10 · Plano de aplicação
**Rota** `.../plano` · **Substitui** `Plano_Bolsas` · **MVP** · *tela mais importante do sistema*

Onde a equipe planeja o que será gasto, nas **três rubricas**. A aba original só tem
bolsas; manutenção e missões passam a ter o mesmo tratamento (resposta **Q3**).

**Navegação principal** — exercício (`?ano=`), depois `Visão geral` · `UNESP` ·
`UFMG` · `UNICAMP` (`?rede=`). Atualizar, compartilhar e voltar no navegador
preservam ambos os recortes sem criar páginas que duplicam regras.

**Organização da tela** — a Visão geral consolida indicadores operacionais,
dimensão institucional (redes, temáticas, PPGs e Coordenadores de Temática) e um
comparativo clicável entre redes. Cada aba de rede mostra somente o seu plano,
repete os quatro cartões de resumo e agrupa as rubricas dentro de uma tabela por
temática. As linhas identificam o Coordenador de Temática correspondente ao PPG.

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
- A seleção aceita somente as modalidades e vigências do catálogo fechado do CAPES
  Global. Combinação inexistente é erro; não há cadastro de nova modalidade.
- Modalidade, quantidade e implementação pertencem a um exercício específico.
  2028–2030 começam vazios e não herdam automaticamente 2027.
- Linha com `status = PENDENTE` não consome orçamento nem vaga.
- Uma linha nunca é excluída em ciclo vigente — é cancelada, preservando o histórico.
- Coordenador de PPG só enxerga e edita linhas do seu PPG (§3.5).
- Administrador pode corrigir uma linha existente, exceto código e rubrica. A
  edição guarda usuário, data/hora, justificativa e valores anterior/novo por
  campo. Em `VIGENTE`, justificativa é obrigatória; em `PLANEJAMENTO`, opcional;
  em `ENCERRADO`, edição é bloqueada.

**Estados especiais**
- Em 2027 há 18 linhas/22 bolsas aprovadas e quatro propostas de Capacitação da
  UFMG (`BOL-020`..`BOL-023`) pendentes, todas previstas para setembro de 2027.
- A UNICAMP possui orçamento, PPGs elegíveis e nenhuma linha artificial: modalidades,
  quantidades, vigências, implementação e beneficiários ainda serão definidos.
- 2028–2030 começam sem linhas/quantidades aprovadas.
- Manutenção e missões começam sem plano detalhado. Somente a UNESP possui valor
  informado (R$ 69.751,14/ano); UFMG e UNICAMP ficam como **A definir**.

---

### P11 · Execução financeira — fora do escopo do CAPES Global

Os recursos e bolsas são pagos diretamente pela CAPES; não entram no caixa da UEA.
Logo, o Gerenciador não registra empenho, pagamento, cancelamento ou estorno como
execução financeira institucional e não calcula “valor líquido” desses lançamentos.
A estrutura genérica do banco fica reservada para outros programas que realmente
tenham execução local, mas não deve ser exposta no ciclo CAPES Global.

---

### P12 · Registro de movimentações externas
**Rota prevista** `.../remanejamentos` · **Fase posterior**

Histórico do que já foi realizado na plataforma CAPES. O Gerenciador não propõe,
autoriza nem executa a movimentação.

**Formulário** data · origem e destino (PPGs) · temática · rubrica/modalidade · valor
ou quantidade · justificativa · documento comprobatório · status informado manualmente.

**Regras**
- Origem e destino devem pertencer à **mesma temática**; outra temática ou rede é bloqueada.
- A movimentação não altera o teto consolidado da temática.
- O sistema confia no status informado e grava quem registrou, quando e todo o histórico.
- Cancelamento, desistência, falecimento e substituição seguem o mesmo princípio:
  acontecem na CAPES e são registrados no Gerenciador como eventos externos.

---

### P13 · Pendências e decisões
**Rota** `/pendencias` · **Substitui** `Pendencias` · **MVP**

Lista de trabalho da equipe. A seed preserva **14 itens históricos**, dos quais
**8 permanecem abertos** após as respostas e a planilha atualizada.

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

**Ações** consultar e exportar. Para o CAPES Global, o catálogo é fechado e somente
as listas “Bolsa destino Brasil” e “Bolsa p/ exterior” podem ser usadas.

**Regras**
- Não existe cadastro de nova modalidade para o CAPES Global.
- Valores são armazenados e calculados em BRL. A cotação máxima usada pela CAPES já
  está incorporada ao valor aprovado; não há conversão cambial ao vivo.
- Após aprovação, a versão e os valores em BRL ficam congelados. Bolsas preservam o
  vínculo com a tabela usada no planejamento.
- Coordenadores de PPG e de Temática apenas consultam o catálogo.

---

### P16 · Premissas e fontes — retirada da interface

A página operacional foi removida porque premissas e fontes são contexto interno de
produto, não uma atividade que o usuário precise executar no sistema. As decisões de
negócio confirmadas permanecem nesta especificação, e as fontes continuam preservadas
nas entidades `Premissa` e `FonteDocumental`, na seed e no endpoint da API para
rastreabilidade e futuro aproveitamento em P22 (Documentos e evidências).

Valores necessários ao trabalho diário devem aparecer nas telas em que produzem efeito,
com rótulo e origem suficientes para interpretação. A existência das estruturas internas
não autoriza recriar uma rota ou item de menu para premissas sem nova decisão de produto.

---

### P17 · Comitê Gestor e Administração
**Rota** `.../comite-gestor` · **Substitui** `Comitê Gestor 2026-2029` · **MVP**

Orçamento **separado** do de bolsas: R$ 381.333,00/ano, 2026–2029, para missões e
articulação institucional.

**Implementado** — abas Visão geral, Missões e Equipes;
cartões de orçamento e equipe; tabela de origem dos aportes; cadastro separado de
membros do Comitê Gestor e da Administração, com pessoa reutilizável, função,
vigência, redes de origem e auditoria. A seed e a migration carregam a composição
formal dos documentos UFMG, UNESP e UNICAMP: 10 pessoas, 10 vínculos e 19
associações com redes, mantendo disponível o cadastro manual. A aba Missões
lista, filtra e pagina, e o cadastro
multietapas grava identificação, roteiro repetível e participantes sem qualquer
valor financeiro. Nesta etapa toda a área é exclusiva de `admin`.
Também está implementada a fundação de parceiros da CG-017: instituição com
dados completos e indicação provisória, associação N:N com redes e contatos
reutilizáveis com um único principal ativo. A CG-025 acrescentou a API de
instituições, candidatos a duplicidade e conciliação auditada; a origem não é
apagada e aponta para o cadastro canônico. A CG-026 fez o mesmo para os
contatos, e a CG-049 levou tudo isso à interface — ver **P24** abaixo.
A CG-018 ampliou o contrato de identificação, destino, evento, relacionamento
com parceiro e período individual de participante. A API já aceita e devolve os
campos, garante um responsável e calcula dias inclusivos; a interface visual
ainda será ampliada junto do formulário/detalhe.

**Ainda pendente** — página de detalhe, edição do relato realizado, prestação,
passagens, diárias e PDFs, conforme
[docs/backlog-comite-gestor.md](docs/historico/backlog-comite-gestor.md).

**Revisão de escopo em 2026-09-01** — a equipe forneceu o documento “Módulo de
Gestão de Missões, Comitê Gestor, Parceiros e Resultados”, ampliando a visão para
aprovação colegiada, parceiros, contatos, produtos, convênios, evidências,
dashboards e relatórios. A comparação integral está em
[docs/revisao-escopo-comite-gestor-2026-09-01.md](docs/revisao-escopo-comite-gestor-2026-09-01.md).
As decisões estruturais de rede sustentaram CG-016 a CG-018. Os demais detalhes
novos ainda não são decisões confirmadas: CG-005 a CG-009 devem homologar fases,
estados, governança e fronteiras financeiras/documentais. A construção da página
de detalhe CG-045 fica reordenada para depois dessa fundação, evitando
implementar um contrato já sabidamente incompleto.

**Regra** — o orçamento continua separado do orçamento de bolsas em todos os
cálculos e indicadores (RN-14), mas a tela não precisa exibir um aviso fixo sobre
essa separação.

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

> O cadastro e a cobrança **individual por bolsa** já existem em P03. Esta fase
> acrescentará autores múltiplos, convênios e a análise consolidada da produção.

---

### P20 · Relatórios e exportações
**Rota** `/relatorios` · **MVP (parcial)**

Modelos prontos, em PDF e XLSX:
- Painel executivo do ciclo
- Panorama de mobilidade (equivalente aos três PNGs de insight, gerados pelo sistema)
- Orçamento por rede e temática
- Plano de aplicação completo (bolsas, manutenção e missões)
- Movimentações externas registradas por temática
- Relação de bolsistas por período
- Produtos previstos, entregues, validados e atrasados por bolsista/bolsa

**Regra** — todo relatório carimba data/hora de geração, ciclo, filtros aplicados e
uma nota sobre dados pendentes (ex.: "composição da UNICAMP a definir").

---

### P21 · Importação de planilhas
**Rota** `/importacao` · **MVP**

Como GCUB e Erasmus já existem em planilha, importar precisa ser rotina, não exceção.

**Fluxo** upload → escolha do modelo → **pré-visualização com validação** → correção
linha a linha → confirmação → registro da importação (arquivo, quem, quando, quantas linhas).

**Modelos** catálogo de bolsas · PPGs · plano de aplicação · orçamento · bolsistas ·
produtos · movimentações externas. Execução financeira não se aplica ao CAPES Global.

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

### P22 · Documentos e evidências
**Rota** `/documentos` · **Novo** · Fase 1.5

Repositório dos documentos recebidos e usados para confirmar bolsistas, resultados
e eventos. O Gerenciador não solicita nem acompanha protocolo na plataforma CAPES.

**Documentos por bolsista/concessão**
- RG antigo **ou** CIN (novo documento de identidade), CPF, passaporte e comprovante
  de residência;
- plano de trabalho e produto final, obrigatórios para todos os bolsistas;
- edital e resultado final que fundamentam a confirmação do beneficiário;
- carta oficial apenas em caso excepcional, armazenada como anexo — não gerada pelo sistema.

**Regras**
- Metadados registram tipo, titular, origem, quem anexou, data/hora e versão.
- O acesso precisa respeitar a LGPD: documentos pessoais não acompanham a mesma
  visibilidade ampla dos indicadores consolidados.
- Substituir um arquivo não apaga silenciosamente a versão anterior.
- A geração automática de ofícios e declarações não está confirmada e fica fora do MVP.

---

### P23 · Catálogos auxiliares e configurações
**Rotas** `/catalogos/modalidades`, `/catalogos/instituicoes`, `/configuracoes` · **MVP (parcial)**

Instituições (redes e parceiras internacionais) · países · tipos de acordo · meses de
implementação · e configurações gerais (ciclo padrão, formato de exportação, identidade
visual). A tela de modalidades do CAPES Global é somente leitura, por ser catálogo fechado.

---

### P24 · Parceiros institucionais
**Rotas** `.../parceiros`, `.../parceiros/[id]` · **Origem** CG-049, escopo ampliado de
2026-09-01 · **Implementado (parcial)**

Instituições parceiras internacionais reutilizáveis por várias redes e missões. A página
**não existia na especificação original**: nasceu do documento de escopo do Comitê Gestor
e por isso vem depois de P23 na numeração.

A rota fica sob o ciclo porque o vínculo com rede é do ciclo (`rede_coordenadora` tem
`cicloId`); a instituição em si é global, e o detalhe mostra o histórico inteiro dela.

**Lista** — busca por nome, sigla, cidade ou domínio; filtro por rede; inclusão opcional
de inativos e conciliados. A busca vem antes do cadastro na hierarquia da tela porque o
problema que a deduplicação resolve é justamente o cadastro repetido.

**Detalhe** — dados institucionais, contatos, missões com suas atividades, eventos e
documentos, tudo vindo de `GET /parceiros/:id/historico`. Uma linha por missão, mesmo
quando ela pertence a mais de uma rede ou visita o parceiro em mais de uma parada.

**Cadastro e edição** — em sidesheet. Quando a API aponta duplicidade, os candidatos
aparecem **dentro do formulário**, não em diálogo por cima: a confirmação não pode custar
o que já foi digitado. Duplicidade possível oferece "cadastrar assim mesmo"; duplicidade
inequívoca não oferece botão, porque a API recusa mesmo confirmada.

**Contatos** — cadastro, edição, troca de contato principal, inativação e reativação. O
contato pertence à instituição e é referenciado pelas missões, nunca copiado para dentro
delas.

**Regra** — não existe exclusão de parceiro nem de contato em lugar nenhum da interface.
A atividade da missão referencia o `id` central, então apagar romperia o histórico; a
saída de operação é inativar, sempre com justificativa. A conciliação de duplicados
transfere relacionamentos e mantém a origem acessível, apontando para o cadastro que
permaneceu.

**Ainda pendente** — seleção/reutilização do parceiro **dentro** da missão, que depende
da página de detalhe da missão (CG-045); paginação da lista, hoje limitada a 200 com
aviso na tela quando o limite é atingido; e visibilidade por rede (CG-028). Nesta etapa
a página inteira, incluindo os dados pessoais dos contatos, é exclusiva de `admin`.

---

## 8. Seed: mapeamento planilha → banco

A seed reproduz o estado atual das planilhas, para que o sistema já nasça com o
comportamento real e a migração seja verificável.

### 8.1 Volumes

| Entidade | Registros | Origem |
|---|---|---|
| `Pais` | 249 | catálogo ISO usado por missões e mobilidade |
| `Instituicao` | 4 | UEA + UNESP, UFMG, UNICAMP |
| `Programa` | 6 | CAPES Global ativo + GCUB, Erasmus+, PDSE, Move La América e PROAFRI inativos e ocultos. |
| `Ciclo` | 2 | CAPES Global 2027–2030; Comitê Gestor 2026–2029 |
| `RedeCoordenadora` | 3 | `Redes_Tematicas` |
| `AreaTematica` | 12 | 4 por rede |
| `Pessoa` | 23 | 13 Coordenadores de Temática + 10 integrantes formalizados das equipes da P17 |
| `MembroEquipeGestao` | 10 | composição formal UFMG, UNESP e UNICAMP recebida em PDF |
| `MembroEquipeGestaoRede` | 19 | ocorrência de cada integrante nos três documentos formais |
| `ParticipacaoPpg` | 24 | Cada vínculo PPG–temática aponta para seu coordenador; uma pessoa pode aparecer em vários vínculos. |
| `Ppg` | 24 | `PPGs` |
| `ParticipacaoPpg` | 24 | `PPGs` |
| `Modalidade` | 7 | catálogo |
| `TabelaValores` | 1 | versão 2026-07-29, cotação 6,59 |
| `ItemCatalogoBolsa` | 60 | `Catálogo Bolsas` (`CAT-001`..`CAT-060`) |
| `OrcamentoTematica` | 48 | 12 temáticas × 4 anos. O orçamento está definido; a composição é aprovada só para UNESP/UFMG em 2027 (8 registros) e `A_DEFINIR` nos outros 40. |
| `ItemPlanejado` | 23 | `Plano_Bolsas`: 18 linhas aprovadas + 4 propostas UFMG pendentes + 1 linha cancelada e preservada como histórico. As 10 reservas artificiais da UNICAMP foram removidas. |
| `PlanejamentoAnual` | 92 | 23 × 4 anos; só 2027 tem quantidade, 2028–2030 começam zerados/a definir. |
| `OrcamentoComiteGestor` | 12 | 3 redes × 4 anos |
| `Premissa` | 5 | `Premissas` — a aba lista 6 itens, mas "Atualização monetária" vem **sem valor**; ele é na verdade `PEND-007`, não uma premissa |
| `FonteDocumental` | 4 | anexos Brasil/exterior + guia de remanejamento + planejamento atualizado |
| `Pendencia` | 14 | histórico preservado; 9 resolvidas e 5 abertas |
| `LancamentoExecucao` | 0 | estrutura genérica; não aplicável ao CAPES Global |
| `Remanejamento` | 0 | estrutura genérica; registro externo ainda não implementado |
| `BolsaConcedida` | 0 | a fonte não informa beneficiários; cadastro começa vazio |
| `ProdutoBolsa` | 0 | será alimentado individualmente por concessão |

### 8.2 Correspondência aba → entidade

| Aba | Entidade(s) | Observação |
|---|---|---|
| `Catálogo Bolsas` | `TabelaValores` + `ItemCatalogoBolsa` | Fonte primária. `Bolsas Destino Brasil` e `Bolsas p Exterior` são a mesma informação — usar apenas o catálogo. |
| `PPGs` | `Ppg` + `ParticipacaoPpg` | Sigla, nota, situação, modalidades previstas. |
| `Redes_Tematicas` | `RedeCoordenadora` + `AreaTematica` + `OrcamentoTematica` | A coluna de rubricas vem de células multilinha (ver §9.3). |
| `Plano_Bolsas` | `ItemPlanejado` (rubrica `BOLSAS`) + `PlanejamentoAnual` | Guardar `Texto-fonte` em `textoFonte`. |
| `Orçamento_2027_2030` | `OrcamentoTematica` | Redundante com `Redes_Tematicas`; usar como conferência, não como fonte. |
| `Execucao` | — | Gabarito vazio e não aplicável: pagamentos diretos pela CAPES. |
| `Remanejamentos` | `Remanejamento` | Gabarito vazio; no Gerenciador será somente histórico externo dentro da mesma temática. |
| `Pendencias` | `Pendencia` | 14 itens históricos, com três padrões de código (ver §9.5). |
| `Premissas` | `Premissa` + `FonteDocumental` | Conteúdo duplicado na própria aba (ver §9.4). |
| `Comitê Gestor 2026-2029` | `OrcamentoComiteGestor` | Ciclo separado. |
| `Atualização UFMG` | `RegistroAuditoria` | **Não é entidade nova** — é o registro de uma alteração. Semear como histórico. |
| `Planejamento_CAPES_Global_2027_2030_Atualizado_UNICAMP_UFMG.xlsx` | orçamento, PPGs e fontes | Atualiza UNICAMP e confirma dados de UNESP/UFMG; não aprova a composição da UNICAMP. |
| `Guia_Orientacoes_Remanejamento_Transformacao_CAPES_Global...pdf` | `FonteDocumental` + regras | Fonte do fluxo externo; o sistema não autoriza nem executa a operação. |
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
| Aporte anual conhecido | R$ 2.315.444,58 |
| Aporte nominal do ciclo | R$ 9.261.778,32 |
| Orçamento anual de bolsas | R$ 2.245.693,44 |
| Custo aprovado de bolsas em 2027 | R$ 1.033.513,40 |
| — UNESP | R$ 636.531,80 |
| — UFMG aprovada | R$ 396.981,60 |
| Propostas UFMG pendentes | 4 linhas, custo R$ 122.508,10 |
| Bolsas aprovadas em 2027 | 22 (2 IN + 20 OUT), em 18 linhas |
| Bolsas programadas em 2028–2030 | 0; composição a definir |
| Saldo potencial aprovado em 2027 | R$ 147.091,05; UNICAMP excluída até aprovar a composição |
| PPGs mapeados | 24 (UNESP 8 · UFMG 6 · UNICAMP 10) |
| Composições a definir em 2027 | 4 (UNICAMP) |
| Divergências de saldo | 0; UNESP-T1 e UNESP-T3 conciliadas |
| Pendências abertas | 7 de 14 registradas |
| Comitê Gestor/ano | R$ 381.333,00 |

---

## 9. Inconsistências encontradas nos dados

Levantadas durante a extração. **Cada uma vira uma decisão de projeto**, não apenas um
conserto pontual.

### 9.1 Três contagens históricas de "bolsas"
| Fonte | Valor | O que está contando |
|---|---|---|
| `Painel Executivo`, `Mapa_Recursos_UEA` | **25** (2 IN + 23 OUT) | soma das quantidades |
| PNG "Panorama de Bolsas" | **23** (2 IN + 21 OUT) | linhas de planejamento |
| PNG "Panorama Orçamentário" | **21** (2 IN + 19 OUT) | linhas, antes da atualização da UFMG |

O mesmo aparecia no custo: o PNG informa **R$ 1.021.849,10/ano** e a atualização
propunha **R$ 1.144.357,20/ano**. A diferença de **R$ 122.508,10** são as quatro
Capacitações da UFMG, ainda sem aprovação formal.

→ **Decisão:** RN-11 fixa "bolsa = unidade" e separa `PROGRAMADO` de `PENDENTE`.
Em 2027 o painel conta 22 bolsas aprovadas em 18 linhas e mostra as 4 propostas à parte.

### 9.2 Divergência entre saldo calculado e informado — resolvida
Na `UNESP-T3`, a equipe validou o cálculo de R$ 1.457,39 e determinou que o valor
divergente do anexo fosse desconsiderado, resolvendo `PEND-001`. Para `UNESP-T1`,
a equipe confirmou a composição de R$ 261.095,80: uma bolsa de Doutorado Sanduíche
de 6 meses; três Capacitações de 1 mês; uma bolsa de Doutorado Sanduíche de 5
meses; e uma Capacitação de 15 dias. O teto de R$ 261.364,55 deixa exatamente
R$ 268,75, igual ao saldo informado.
→ **Decisão:** PEND-002 e PEND-003 estão resolvidas. RN-08 continua comparando os
dois valores para detectar automaticamente qualquer divergência futura.

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

### 9.6 PROFSAÚDE em duas temáticas na fonte inicial — resolvida
O dado original colocava `PROFSAÚDE` em duas temáticas da UNICAMP. A equipe confirmou
que ele é elegível somente em `UNICAMP-T1` — Saúde, Natureza e Sociedade.
→ **Decisão:** a seed guarda apenas esse vínculo e marca `PEND-006` como resolvida.

### 9.7 Áreas temáticas não são as mesmas entre redes
"Saúde" aparece como `Saúde única` (UNESP-T3), `Saúde e Bem-estar` (UFMG-T3) e
`Saúde, Natureza e Sociedade` (UNICAMP-T1).

Os nomes oficiais das demais áreas da UNICAMP, confirmados pela equipe, são:
`Educação, Saberes e Culturas` (UNICAMP-T2), `Biodiversidade e Transformação
Territorial Sustentável` (UNICAMP-T3) e `Direitos Humanos, Justiça Social e
Equidade` (UNICAMP-T4).
→ **Decisão:** `AreaTematica` pertence à rede. Um agrupamento temático transversal, se
for necessário, é uma etiqueta à parte — **não** o mesmo campo.

### 9.8 O contador da planilha estava defasado
A aba `Pendencias` tem **14 itens**; o painel antigo anunciava **10**. Após incorporar
as respostas, o sistema preserva os 14 registros e calcula **6 abertos** pelo status.

É o mesmo defeito de §9.1, em outra célula: **um número escrito à mão que não sabe que
a fonte mudou.** É exatamente isso que o sistema elimina — contadores derivados de
consulta, nunca digitados.

### 9.9 UNICAMP: orçamento aprovado, composição pendente
A planilha atualizada define R$ 1.065.089,00/ano em bolsas para a UNICAMP e lista
10 PPGs elegíveis. A imagem do Comitê por Área Temática recebida em 24/08/2026
também informa, para 2027, orçamento utilizado de R$ 530.737,40 (T1),
R$ 331.122,00 (T2), R$ 97.308,80 (T3) e R$ 173.690,60 (T4). Esses valores são
preservados como alegação da fonte; as modalidades, quantidades, vigências, datas
e beneficiários serão cadastrados manualmente no Gerenciador.
→ **Decisão:** orçamento e composição têm estados separados. O teto entra no aporte,
mas não vira saldo livre e não gera linhas artificiais enquanto a composição estiver
`A_DEFINIR`.

---

## 10. Fases de entrega

### Fase 1 — MVP (substitui as planilhas)
Núcleo (PPGs, redes, temáticas, catálogo) · orçamento e plano de aplicação nas três
rubricas · composição anual de bolsas · saldos · bolsistas e produtos individuais ·
pendências · registro de movimentações externas · importação · seed com os dados reais.

**Critério de pronto:** a equipe consegue abandonar as duas planilhas, e todos os
indicadores da tabela de §8.3 batem.

> **Dependência crítica:** os coordenadores de PPG lançam dados desde o MVP (§3.5).
> Isso significa que o **escopo por PPG na autorização precisa entrar junto** — não é
> item de fase posterior. É a única peça do controle de acesso que não dá para adiar.

### Fase 1.5 — Consolidação da mobilidade e documentos
Mapa de países e universidades · taxa de efetivação · consolidação multiprograma com
GCUB e Erasmus importados · anexos pessoais, edital, resultado, plano de trabalho e
produto final (P22).

### Fase 2 — Ciclo completo
Convênios internacionais · produção consolidada · vínculo mobilidade → resultado ·
relatórios operacionais e de impacto.

### Fase 3 — Integrações
Sucupira/CAPES · Lattes · sistema financeiro institucional · SSO com o diretório da UEA
(a base de autenticação já está pronta — ver [docs/autenticacao.md](docs/autenticacao.md)).

---

## 11. Checklist de decisões e pendências

### 11.1 Confirmado formalmente

1. [x] Remanejamento é permitido somente entre PPGs da mesma temática; o
   Gerenciador apenas registra o que ocorreu na CAPES.
2. [x] Os recursos são pagos diretamente pela CAPES e não entram no caixa da UEA;
   P11 não se aplica ao CAPES Global.
3. [x] O orçamento aprovado é um teto fixo e não pode ser ultrapassado pela soma
   das bolsas da temática.
4. [x] Todos os cálculos usam BRL. Para bolsas referenciadas em dólar, o valor
   aprovado já incorpora a cotação máxima adotada pela CAPES e fica congelado.
5. [x] A regra percentual de 30% discutida anteriormente não se aplica.
6. [x] A composição da UNESP em 2027 está aprovada. `BOL-008` tem 5 meses;
   para UNESP-T3, o cálculo de R$ 1.457,39 foi validado e o valor divergente do
   anexo deve ser desconsiderado.
7. [x] A composição atualizada da UNESP-T1 custa R$ 261.095,80 e deixa saldo de
   R$ 268,75; o saldo informado e o calculado estão conciliados, sem divergência.
8. [x] A programação original da UFMG está aprovada. As quatro Capacitações
   adicionais são propostas pendentes, previstas para setembro de 2027.
9. [x] O orçamento de bolsas da UNICAMP está aprovado por temática; PPGs são
   somente elegíveis e modalidades, distribuição e beneficiários dependem dos editais.
10. [x] `PROFSAÚDE` pertence somente à UNICAMP-T1 — Saúde, Natureza e Sociedade.
11. [x] Os tetos nominais conhecidos repetem-se em 2027–2030, mas modalidades e
    quantidades podem mudar por exercício. Somente 2027 é carregado; anos futuros
    não copiam automaticamente sua composição.
12. [x] O catálogo do CAPES Global é fechado: somente as modalidades de “Bolsa
    destino Brasil” e “Bolsa p/ exterior”; não há cadastro de novas modalidades.
13. [x] Datas de concessão são completas (dia, mês e ano). Março e setembro são
    as janelas usuais de implementação.
14. [x] Um CPF pode utilizar somente uma modalidade de bolsa em todo o ciclo
    2027–2030.
15. [x] Beneficiários são confirmados pela PROPESP com base no resultado final do
    edital. O Gerenciador ignora solicitação ou acompanhamento de protocolo CAPES.
16. [x] País e universidade/instituição de origem e de destino são registrados por bolsista.
17. [x] Produtos, artigos, trabalhos e projetos são cadastrados e acompanhados
    individualmente por bolsa concedida.
18. [x] Para todos os bolsistas serão armazenados documentos pessoais (RG antigo
    ou CIN, CPF, passaporte e comprovante de residência), plano de trabalho e
    produto final; edital e resultado final também são evidências.
19. [x] Carta oficial é apenas anexada em caso excepcional; o Gerenciador não a gera.
20. [x] Status externos são informados manualmente. O sistema confia no valor
    informado e registra usuário, data/hora e histórico.
21. [x] O Coordenador de Temática visualiza todos os PPGs e bolsistas da temática
    que coordena.
22. [x] Todas as redes possuem orçamento de manutenção, mas somente o valor da
    UNESP foi informado; UFMG e UNICAMP devem aparecer como “A definir”.
23. [x] Relatórios operacionais e de produtos serão necessários.

### 11.2 Confirmações ainda pendentes

1. [ ] Confirmar formalmente se alguma bolsa deve ser repetida automaticamente em
   exercícios futuros. A regra segura atual é **não repetir**: cada composição anual
   começa vazia até aprovação.
2. [ ] Informar os valores de manutenção de UFMG e UNICAMP e, para todas as redes,
   como esse orçamento será detalhado por PPG/ano.
3. [ ] Aprovar ou rejeitar formalmente as quatro Capacitações propostas pela UFMG.
4. [ ] Definir a composição da UNICAMP: modalidades, quantidades, vigências, mês de
   implementação e distribuição entre PPGs; depois, informar os beneficiários dos editais.
5. [ ] Definir formatos, tamanho máximo, prazo de retenção e perfis de acesso aos
   documentos pessoais (decisão necessária para implementar uploads com LGPD).
6. [ ] Fechar o vocabulário de eventos/status externos e os campos obrigatórios de
   cancelamento, desistência, falecimento e substituição.
7. [ ] Definir os modelos, filtros, periodicidade e formatos dos relatórios prioritários.
8. [ ] Vincular cada usuário do Keycloak à pessoa/PPGs/temáticas locais para aplicar
   tecnicamente o escopo confirmado do Coordenador de Temática.
