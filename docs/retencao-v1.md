# Retenção de documentos e dados pessoais

Inventário do que o sistema guarda, por quanto tempo, e o que ainda não tem
prazo decidido. Tarefa de origem: **V1-039**.

> **Nenhum descarte foi implementado, e nenhum prazo foi inventado.** Onde a
> instituição ainda não decidiu, a linha diz *decisão pendente* e nomeia quem
> precisa decidir. Este documento não constitui homologação institucional nem
> autoriza remoção de dado algum.

---

## 1. O ponto de partida: hoje nada é apagado

Três fatos conferidos no código, e eles definem o resto do documento:

| O quê | Estado |
|---|---|
| Arquivo em disco | **Nunca removido.** `armazenamento.service.ts` não tem `unlink` |
| Anexo no banco | **Nunca excluído.** Substituir cria versão nova e preserva a anterior (CG-014); a saída é `ativo = false` |
| Contato de parceiro | **Nunca excluído.** Só inativação (CG-026), porque a missão referencia o `id` |
| Backup | **Sem expurgo.** `db-backup.sh` não apaga snapshot antigo |

Isso não é lacuna a corrigir às pressas: **preservar é o comportamento seguro**,
e a decisão de apagar é que precisa de autorização. O que falta é tornar a
política **conferível**, que é o objetivo desta tarefa.

---

## 2. A única regra já decidida

**Documento pessoal de bolsista: fim da concessão + 5 anos** (BOL-021,
homologada em 2026-09-09). Vale para `DOCUMENTO_IDENTIDADE`, `PASSAPORTE` e
`COMPROVANTE_RESIDENCIA`.

Duas propriedades que a V1-036 e qualquer rotina futura precisam preservar:

- **O prazo é derivado, nunca gravado.** Sai de `bolsa_concedida.data_fim` na
  leitura ([anexos.service.ts:331](../apps/api/src/dominio/anexos.service.ts#L331)).
  `data_fim` é editável, e uma coluna gravada divergiria da política no dia em
  que a equipe corrigisse o período — a mesma razão pela qual o checklist de
  encerramento não é persistido.
- **O relógio começa no fim da concessão, não no upload.** A guarda existe
  porque a finalidade existe; ela se encerra quando a finalidade se encerra.

**Não há expurgo automático**, e o campo `retencaoAte` só torna a política
conferível. Executá-la continua sendo ato humano — o §5 propõe como.

---

## 3. A tabela: categoria → prazo → marco → responsável → ação

`A definir` significa que a PROPESP ainda não decidiu. **Enquanto estiver
assim, o dado é guardado** — é o padrão seguro, e está assim hoje.

### 3.1 Documentos

| Categoria | Prazo | Marco inicial | Responsável | Ação |
|---|---|---|---|---|
| Documento pessoal de bolsista (identidade, passaporte, comprovante de residência) | **5 anos** ✔ | fim da concessão | *a nomear* | prévia → descarte autorizado |
| Documento acadêmico do bolsista (carta de aceite, plano de trabalho, relatório) | A definir | fim da concessão | *a nomear* | guardar |
| Documento de aprovação da missão (projeto, convite, programação, justificativa, orçamento) | A definir | encerramento da missão | *a nomear* | guardar |
| Comprovante de prestação de contas (passagem, bilhete, nota fiscal, diárias, cotação) | A definir — **provável prazo contábil externo** | validação da prestação | *a nomear* | guardar |
| Galeria e evidências (fotos, certificado, ata, notícia, publicação) | A definir | — | *a nomear* | guardar |

**O comprovante de prestação é o que mais precisa de decisão externa.** Ele
responde a prazo de guarda contábil que não é do sistema nem da PROPESP — e
propor um número aqui seria inventar obrigação legal.

### 3.2 Dados pessoais fora de documento

| Dado | Onde | Prazo | Observação |
|---|---|---|---|
| CPF | `pessoa.cpf` | A definir | É a **chave de identificação** da bolsa (uma modalidade por CPF/ciclo). Apagá-lo quebra a regra retroativamente |
| E-mail, telefone | `pessoa` | A definir | É o que liga a conta do Keycloak à pessoa em `/me` |
| Nome, ORCID, Lattes | `pessoa` | **Não se apaga** | Dado acadêmico público; sustenta produto e histórico |
| Contato de parceiro | `contato_instituicao` | A definir | Inativação já existe; o dado permanece |
| Evento externo do beneficiário (desistência, interrupção, **falecimento**, substituição) | `evento_bolsista` | A definir | V1-036. O tipo e a justificativa podem revelar saúde e morte; por isso `FALECIMENTO` leva a bolsa a *Interrompida*, sem estado próprio, e o evento só se lê com `evento:read`. A trilha de correção guarda que a justificativa mudou, não o texto. Não se apaga: é o que explica o buraco no histórico da bolsa |

**CPF e contato não podem ser tratados como documento.** O documento se apaga
sem quebrar nada; estes dois são referenciados por linhas que precisam
continuar existindo. A saída provável é **anonimizar em vez de apagar**, e isso
é decisão, não implementação — está no §6.

### 3.3 Trilhas

| O quê | Prazo | Por quê |
|---|---|---|
| `registro_auditoria` | **Não se apaga** | É a prova de quem fez o quê. Já guarda **quais campos** mudaram, nunca os valores pessoais ([contatos-parceiros.service.ts:213](../apps/api/src/dominio/contatos-parceiros.service.ts#L213)) — então reter a trilha não é reter o dado |
| Histórico de missão, concessões revogadas | **Não se apaga** | Explicam decisões tomadas |

---

## 4. Backups: o limite honesto

**Um backup não é alcançado por descarte seletivo.** O dump é um retrato do
banco inteiro; remover uma linha dele exigiria reescrever o arquivo, o que
destrói justamente a propriedade que faz dele backup.

Consequências que qualquer política precisa aceitar:

- **Descartar um documento não o remove dos backups anteriores.** O dado sai do
  sistema vivo e continua nos retratos antigos até eles expirarem.
- **Por isso a retenção dos backups é parte da política de retenção**, e não só
  uma decisão de operação. Ela está pendente na V1-053, junto com destino e
  horário.
- **Prometer "remoção completa" é promessa que o sistema não cumpre.** O
  procedimento do §5 diz o que faz e o que não faz.

---

## 5. Procedimento proposto — três passos, e só o terceiro apaga

Desenhado para que a parte destrutiva seja a menor e a mais autorizada. Espelha
o `acesso:bootstrap` e o `acesso:contas`: **prévia por padrão, `--aplicar` para
gravar, auditoria sempre**.

**1. Inventário (leitura pura).** Lista o que passou do prazo, por categoria,
com a bolsa de origem e o marco que disparou a contagem. Não toca em nada.
Pode rodar sempre, por qualquer pessoa com a permissão de leitura.

**2. Prévia do descarte.** Sobre o inventário, mostra exatamente o que seria
apagado — arquivo, linha, ou ambos —, o que fica preservado e o que **continua
nos backups**. Ainda não apaga.

**3. Descarte autorizado.** Só com flag explícita, só sobre um inventário
conferido, e **cada item vira uma linha de auditoria**: o que saiu, por que
prazo, quem autorizou. A trilha permanece depois de o dado sair — é ela que
prova que o descarte foi regra cumprida e não perda.

**Guarda excepcional** suspende o descarte de um item nomeado, com motivo e
prazo. Existe porque processo administrativo, auditoria e litígio interrompem
prazo de guarda, e sem esse mecanismo o descarte regular apagaria prova em
curso. Uma guarda ativa **bloqueia o item na etapa 3** e aparece no inventário.

**Repetir a etapa 3 é seguro:** o item já descartado não aparece no inventário
seguinte, e não há segunda remoção.

---

## 6. O que precisa de decisão — e quem decide

| # | Pergunta | Quem | Bloqueia |
|---|---|---|---|
| 1 | Prazo do comprovante de prestação de contas | **Contabilidade/PROPESP** — é prazo legal externo | a linha da prestação; nada mais |
| 2 | Prazo dos documentos acadêmicos e de missão | PROPESP | as linhas correspondentes |
| 3 | CPF e contatos: **anonimizar ou guardar?** | PROPESP + responsável pelos dados | a §3.2; **não** bloqueia documentos |
| 4 | Retenção dos backups | Infraestrutura (V1-053) | o §4; cruza com a implantação |
| 5 | **Quem é o responsável pelos dados pessoais** | Responsável pelo sistema | a coluna "responsável" inteira |

A **5** é a mais estrutural e a mais barata: sem um nome, o procedimento do §5
não tem quem o execute, e toda linha da tabela fica com um dono vago. É a mesma
pendência que a V1-001 registra para dados e infraestrutura.

---

## 7. Inspeção de anexos (V1-071)

A ficha manda registrar a decisão e a prioridade. O estado:

- **Não existe antivírus**, e o ponto de inserção já está identificado:
  `validarArquivo`, antes de `armazenamento.guardar` (CG-051).
- **O risco já foi reduzido sem antivírus:** DOC/DOCX e XLS/XLSX saíram dos
  formatos aceitos em 2026-09-07, por decisão do responsável — documento do
  Office é o vetor clássico de macro. Restam PDF, JPG e PNG, e o tipo é
  validado **pelo conteúdo**, não pela extensão.
- **A prioridade continua P2**, e a razão é essa redução: com o vetor principal
  fora e o público interno, a inspeção deixou de ser condição para operar. Ela
  volta a ser prioritária se os formatos do Office voltarem, ou se o acesso
  deixar de ser interno.
- **Decisões que a V1-071 ainda precisa** (registradas lá, não aqui): serviço,
  síncrono ou quarentena, e o que fazer quando o inspetor está indisponível —
  recusar o upload ou aceitar sem inspeção é escolha de política.

---

## 8. O que esta tarefa não fez

- **Não implementou rotina de descarte.** O §5 é proposta; a implementação
  depende das decisões do §6, e implementá-la antes obrigaria a escolher prazos
  no lugar da instituição.
- **Não simulou descarte com dados fictícios.** A verificação da ficha prevê
  isso *"se implementar rotina"* — como nenhuma foi implementada, o que foi
  verificado é o inventário: categorias, regra dos 5 anos, ausência de
  `unlink`, ausência de expurgo de backup e o formato da auditoria.
- **Não alterou comportamento algum.** Nenhum dado foi descartado, nenhum prazo
  foi gravado, nenhum arquivo saiu do disco.
