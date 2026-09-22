# Eventos externos da CAPES — contrato

Proposta de contrato para o registro histórico do que acontece na plataforma da
CAPES (P12 e o histórico de cancelamento, desistência, falecimento e
substituição). Tarefa de origem: **V1-035**.

> **A V1-036 implementou a persistência e a consulta em 2026-09-21** com as
> recomendações das quatro perguntas do §7, conforme o backlog autoriza: pedido
> explícito de implementar a tarefa adota a recomendação documentada. O que foi
> feito, e onde a implementação precisou ir além do texto, está no §9. A
> **V1-037** (interface) foi concluída no mesmo dia.
>
> Este documento não constitui homologação institucional.

---

## 1. O que o módulo é

O Gerenciador **é só um gerenciador** (decisão de 2026-09-19, §1 do
[AGENTS.md](../AGENTS.md)). A fonte do que acontece de fato é a plataforma da
CAPES: é lá que a bolsa é implementada, o recurso é remanejado e o bolsista
desiste. Este módulo é o **livro-razão do que já aconteceu lá**, mantido por
quem usa o sistema.

O que isso fecha, antes de qualquer campo:

- **Sem integração, importação automática ou conferência** contra a CAPES.
- **O status informado é o status.** Não há validação contra fonte externa
  porque não há fonte externa acessível.
- **Nada de alerta de "dado possivelmente desatualizado".** O sistema não tem
  como saber se está, e o aviso transferiria à tela uma dúvida insolúvel.
- O Gerenciador **não propõe, não autoriza e não paga**.

---

## 2. O que já existe no schema

A ficha manda mapear antes de propor tabelas novas. O que existe hoje:

| Tabela / enum | Estado | Serve a este módulo? |
|---|---|---|
| `remanejamento` | existe, **nunca usada** — sem endpoint e sem tela | **Sim**, com ressalvas (§2.1) |
| `statusRemanejamentoEnum` | `PROPOSTO`, `AUTORIZADO`, `EXECUTADO`, `REJEITADO` | **Parcialmente** — ver §2.1 |
| `lancamento_execucao` | existe, nunca usada | **Não.** É execução financeira (P11), fora do escopo do CAPES Global |
| `bolsa_concedida.status` | `SELECIONADO`, `EM_ANDAMENTO`, `CONCLUIDA`, `CANCELADA`, `INTERROMPIDA` | **Sim** — é o estado que o evento de beneficiário muda |
| `registro_auditoria` | em uso | **Sim** — quem registrou, quando, motivo |
| `anexo` (`entidade_anexo`) | em uso | **Sim**, para o comprovante — precisa de um tipo novo |

### 2.1 `remanejamento` serve, mas não como está

A tabela nasceu genérica, para outros programas. Três ajustes que a V1-036
precisa fazer:

- **`PROPOSTO` e `REJEITADO` não valem no CAPES Global.** Aqui não se propõe
  nem se rejeita: registra-se o consumado. A camada de domínio deve recusá-los.
  A coluna permanece porque o enum é compartilhado.
- **`ano_origem`/`ano_destino` não se aplicam.** A regra da P12 é a mesma
  temática; movimentação entre exercícios é outro programa.
- **Falta o comprovante.** `documento_autorizacao` é `varchar(200)` — guarda o
  número do ofício, não o arquivo. O arquivo entra por `anexo`.

**Recomendação: reusar `remanejamento` para o grupo A e criar uma tabela nova
para o grupo B.** São dois fatos diferentes — um move recurso, o outro muda o
estado de uma pessoa —, e forçá-los na mesma tabela deixaria metade das colunas
nula em cada linha, que é o argumento que a CG-056 já registrou sobre
`produto_bolsa`.

---

## 3. Os dois grupos de evento

### Grupo A — movimentação de recurso (`remanejamento`)

O recurso ou a vaga muda de lugar dentro da **mesma área temática**.

> O PPGCLIAMB devolveu uma bolsa de Doutorado Sanduíche de 2027 que não foi
> usada, e a CAPES a realocou para o PPGDAS, na mesma temática.

**A regra dura, que vem da P12:** origem e destino na mesma temática. Outra
temática ou outra rede é **bloqueio**, não aviso — o teto foi aprovado por
temática, e mover entre elas refaria a aprovação. A movimentação **não altera o
teto consolidado**: redistribui dentro dele.

### Grupo B — evento do beneficiário (tabela nova)

A situação da pessoa muda, e a bolsa deixa de correr como planejado.

> A bolsista desistiu em maio; interrompeu por doença; faleceu; foi substituída
> por outro aluno do mesmo PPG na mesma vaga.

Hoje **não há onde registrar isso**. A bolsa fica `EM_ANDAMENTO` para sempre, ou
alguém a edita para `CANCELADA` e a razão se perde — sem data do ato, sem
comprovante, sem quem registrou.

---

## 4. A matriz

Tipos propostos para o grupo B, com o efeito em `bolsa_concedida.status`:

| Evento | Estado anterior | Estado posterior | Campos próprios | Permissão |
|---|---|---|---|---|
| `DESISTENCIA` | `SELECIONADO`, `EM_ANDAMENTO` | `CANCELADA` | — | `bolsa:edit` + `evento:create` |
| `INTERRUPCAO` | `EM_ANDAMENTO` | `INTERROMPIDA` | previsão de retorno | idem |
| `FALECIMENTO` | qualquer ativo | `INTERROMPIDA` | — | idem |
| `SUBSTITUICAO` | `SELECIONADO`, `EM_ANDAMENTO` | `CANCELADA` na saída | bolsa que entra | idem |
| `CONCLUSAO_ANTECIPADA` | `EM_ANDAMENTO` | `CONCLUIDA` | — | idem |

Campos comuns a todos (grupos A e B):

| Campo | Obrigatório | Por quê |
|---|---|---|
| tipo | sim | o que aconteceu |
| data do ato | sim | **quando aconteceu na CAPES** |
| data do registro | automática | quando alguém anotou aqui (§7.2) |
| registrado por | automática | `sub` + nome, como o resto da auditoria |
| justificativa | sim | o motivo é o que explica o buraco no histórico anos depois |
| referência externa | não | nº do ofício, processo ou e-mail |
| comprovante | §7.4 | anexo, novo tipo em `entidade_anexo` |

**`FALECIMENTO` vai para `INTERROMPIDA`, e não para um estado próprio.** Um
`FALECIDA` no enum de status publicaria a causa em toda listagem que mostra
situação — a causa fica no evento, que é lido por quem tem a permissão. O
estado diz que a bolsa parou; o evento diz por quê.

**`SUBSTITUICAO` é um evento, não dois.** Ele aponta a bolsa que sai e a que
entra, e é isso que liga substituído e substituto. Registrar duas linhas
independentes (um cancelamento e uma concessão) perderia o vínculo — e é
exatamente o vínculo que a ficha pede para fixar.

**Permissão nova, `evento:create` / `evento:read`.** Não reusar `bolsa:edit`
sozinha: editar período é rotina de correção, registrar que alguém faleceu não
é. A leitura em separado permite conceder a consulta do histórico a quem não
mexe na bolsa. Escopos: os de `PLANEJAMENTO`, como `bolsa:*`.

---

## 5. Os efeitos — e três achados do código

A ficha pede efeitos em vagas, valores, produtos e indicadores. Fui ao código;
três coisas precisam de decisão porque **já se comportam de um jeito**.

### 5.1 `CANCELADA` libera a vaga; `INTERROMPIDA` não

`exigirVaga` conta as bolsas do item planejado no ano com
`ne(status, 'CANCELADA')` ([bolsistas.service.ts:1296](../apps/api/src/dominio/bolsistas.service.ts#L1296)).
Ou seja:

- desistência → `CANCELADA` → **a vaga volta a ficar disponível**;
- interrupção e falecimento → `INTERROMPIDA` → **a vaga segue consumida**.

Isso parece certo e é a razão de `SUBSTITUICAO` levar a saída a `CANCELADA`: sem
liberar a vaga, o substituto não entraria. **Mas nunca foi decidido** — é efeito
colateral de uma escolha de contagem. A V1-036 deve fixá-lo como regra
consciente, e o §7.3 pergunta se interrupção definitiva deve liberar.

### 5.2 O evento não muda o orçamento

O custo do plano sai de `planejamento_anual`
([orcamento.service.ts:140](../apps/api/src/dominio/orcamento.service.ts#L140)),
não de `bolsa_concedida`. **Cancelar uma bolsa não mexe no teto nem no custo
planejado** — muda o *Custo das bolsas concedidas* (D-B07), que é outro
indicador, deliberadamente separado desde a BOL-041.

Isso é o desenho certo e deve permanecer: o evento registra o que aconteceu com
a pessoa, e replanejar é ato do grupo A.

### 5.3 O panorama conta bolsa cancelada

`FiltroMobilidade.status` é **opcional e sem padrão**
([mobilidade.service.ts:46](../apps/api/src/dominio/mobilidade.service.ts#L46)):
sem filtro explícito, a bolsa cancelada entra nas contagens de mobilidade.

Com desistências registradas, "35 mobilidades" passaria a incluir quem nunca
viajou. **É o risco de dupla contagem que o aceite da ficha nomeia**, e vale
tanto para a P02 quanto para os relatórios.

**Recomendação:** o panorama passa a excluir `CANCELADA` por padrão, com o
filtro continuando disponível para quem quiser vê-las. `INTERROMPIDA` **conta** —
a viagem aconteceu, só terminou antes. Isso é mudança de comportamento da P02 e
precisa de regressão própria na V1-036.

### 5.4 Produtos

O produto sobrevive ao evento. Um artigo publicado por quem depois desistiu
continua sendo produto daquela bolsa — apagá-lo reescreveria o passado. Nenhuma
mudança necessária.

---

## 6. Três exemplos concretos

A ficha pede verificação por exemplo, sem dupla contagem nem apagamento.

**Cancelamento.** Bolsa BOL-X, `EM_ANDAMENTO`, início 03/2027. Evento
`DESISTENCIA`, ato em 12/05/2027, registrado em 03/06/2027, justificativa
"aprovada em concurso público", ofício anexado. Resultado: status `CANCELADA`;
a vaga de 2027 volta ao item planejado; o custo do plano **não muda**; o
panorama deixa de contá-la (§5.3); os produtos permanecem; o histórico mostra o
evento com as duas datas.

**Correção.** O mesmo evento foi registrado com a data errada (12/06 em vez de
12/05). **Não se apaga:** registra-se a correção sobre o evento, com auditoria
por campo, como o plano já faz. O histórico passa a mostrar o valor corrigido e
a trilha mostra a troca. Se a correção for do *tipo* do evento — era interrupção,
não desistência —, o efeito no status precisa ser reaplicado, e é aqui que a
§7.3 importa.

**Substituição.** BOL-X sai, BOL-Y entra na mesma vaga do mesmo item planejado.
Um evento `SUBSTITUICAO` apontando as duas bolsas: BOL-X vai a `CANCELADA`
(libera a vaga), BOL-Y é concedida normalmente e o evento as liga. A contagem
de mobilidades registra **uma** — BOL-X saiu do panorama pelo §5.3. Sem o
vínculo no evento, ninguém saberia depois que uma substituiu a outra.

---

## 7. As quatro perguntas em aberto

Cada uma com a recomendação, para ser aprovada ou corrigida — não respondida no
vazio. **Nenhuma delas bloqueia a V1-036 inteira**, só a parcela indicada.

### 7.1 A lista de tipos está completa?

Os cinco do §4 vêm da especificação (P12) e do que o AGENTS §9 já nomeia. A
PROPESP pode conhecer outros — prorrogação de vigência, mudança de destino,
suspensão temporária.

*Recomendação:* começar com os cinco e tratar o tipo como **dado**, não enum
fixo, seguindo a decisão da CG-019 sobre requisitos — assim um tipo novo não
exige migration. **Bloqueia:** nada; a lista inicial basta para começar.

### 7.2 Data do ato e data do registro são duas colunas?

Elas divergem em semanas: o ato acontece na CAPES e alguém anota aqui depois.

*Recomendação:* **duas colunas.** Uma só obrigaria a escolher entre "quando
aconteceu" (certo para o histórico) e "quando soubemos" (certo para auditar o
atraso do registro), e a escolha erraria metade das perguntas. A data do ato é
informada; a do registro é automática. **Bloqueia:** o schema da V1-036.

### 7.3 O evento corrige o passado ou só acompanha o plano?

Se a bolsa foi interrompida em maio, o custo de 2027 muda retroativamente?

*Recomendação:* **não corrige.** Pelo §5.2, o custo do plano já é independente
da bolsa concedida, e o Gerenciador não é a fonte do que a CAPES pagou —
recalcular seria inventar um número que ninguém conferiu. O evento muda o
estado e os indicadores de mobilidade; replanejar é ato do grupo A, explícito.
**Bloqueia:** o que a V1-036 faz com vagas e indicadores (§5.1 e §5.3).

### 7.4 O comprovante é obrigatório?

*Recomendação:* **não obrigatório, mas destacado quando ausente.** Exigi-lo
travaria o registro enquanto o ofício não chega, e o efeito previsível é o
registro nunca acontecer — o dado fica fora do sistema, que é pior que o dado
sem anexo. A lista mostra quais eventos estão sem comprovante, e isso é o que
torna a pendência conferível sem bloquear. **Bloqueia:** só a validação do
formulário na V1-037.

---

## 8. O que este contrato deixa para as tarefas seguintes

- **V1-036:** migration (tabela do grupo B, tipo novo em `entidade_anexo`,
  recusa de `PROPOSTO`/`REJEITADO`), serviços, recorte por ação e as regressões
  de §5.1 e §5.3.
- **V1-037:** telas de registro e histórico, com as duas datas visíveis e o
  aviso de comprovante ausente.
- **Catálogo de permissões:** `evento:create` e `evento:read`, com os escopos de
  planejamento, mais a rota no inventário
  ([contrato-autorizacao-v1.md](contrato-autorizacao-v1.md)).

---

## 9. O que a V1-036 implementou (2026-09-21)

Migration `0042_eventos_externos_v1036`; serviço em
[eventos-externos.service.ts](../apps/api/src/dominio/eventos-externos.service.ts);
rotas no inventário de [contrato-autorizacao-v1.md](contrato-autorizacao-v1.md).

**As quatro perguntas, com a recomendação aplicada:**

| § | Recomendação adotada | Como ficou |
|---|---|---|
| 7.1 | Tipo como dado | `tipo_evento_bolsista`, com `estados_origem`, `estado_destino`, `aceita_substituta` e `aceita_previsao_retorno`. Os cinco tipos do §4 entram pela migration e pela seed (`seed/tipos-evento-bolsista.ts`). Um tipo novo é um `insert`; `ativo = false` o retira sem apagar o histórico. |
| 7.2 | Duas datas | `data_ato` é informada e não aceita data futura; a do registro é `criado_em`. |
| 7.3 | O evento não corrige o passado | Nenhum evento toca `planejamento_anual`, teto ou custo do plano. Muda a situação da bolsa e, com ela, a vaga e o panorama. |
| 7.4 | Comprovante opcional | Anexo em `EVENTO_BOLSISTA`/`REMANEJAMENTO`; `comprovantes` volta em cada linha para a V1-037 destacar o zero. `remanejamento_autorizacao_ck`, que exigia o número do ofício, saiu. |

**Regras fixadas como decisão, e não mais como efeito colateral:**

- **Cancelada libera a vaga; interrompida não** (§5.1). Voltar de `CANCELADA`
  por correção passa por `exigirVaga`, e é recusado se alguém já ocupou a vaga.
- **O panorama exclui `CANCELADA` por padrão** (§5.3); `?status=CANCELADA` as
  mostra. O relatório exportável e o bloco da P01 herdam a mudança pela mesma
  função `condicao`.
- **Reenvio não duplica.** Todo registro carrega `chave` (UUID gerado por quem
  envia): a mesma chave devolve o registro existente, e a chave reaproveitada em
  outro alvo responde 409. O lock da bolsa (evento) e o lock consultivo do ciclo
  (movimentação) serializam os reenvios simultâneos; o índice único é o último
  anteparo.

**Onde a implementação foi além do texto do contrato:**

1. **Movimentação só aceita `EXECUTADO`.** O §2.1 mandava recusar `PROPOSTO` e
   `REJEITADO`; a RN-13 da especificação também exclui `AUTORIZADO` ("a tela não
   oferece `PROPOSTO`/`AUTORIZADO`"). Prevaleceu a regra mais estrita. Se a
   PROPESP quiser registrar "autorizado na CAPES, ainda não executado", é uma
   linha a mais no schema Zod.
2. **Permissão `evento:edit`, além de `evento:create`/`evento:read`.** Corrigir é
   verbo diferente de registrar, como em todo o catálogo. Os modelos ficaram
   assim: `evento:read` em todos (entra em "consulta"), `evento:create` e
   `evento:edit` na secretaria; o administrador recebe o catálogo inteiro.
3. **A edição da bolsa não desfaz a situação que um evento produziu.** Se o
   último evento deixou a bolsa `CANCELADA`, `PATCH /bolsistas/:id` recusa voltar
   para outra situação e diz qual evento corrigir. Situação que não veio de
   evento continua editável, e toda troca de situação pela edição passou a ser
   auditada (RN-20). Desde a **V1-037** a edição também não leva a bolsa a
   `CANCELADA` ou `INTERROMPIDA`: com a tela de registro no ar, esses estados
   só entram por evento.

**Correção** (`PATCH`, com `motivo` obrigatório): o valor corrigido fica na
linha e a trilha guarda cada campo trocado. Trocar o **tipo** reaplica o efeito
a partir do `status_anterior` fotografado, e só vale no último evento da bolsa e
enquanto a situação ainda é a que ele produziu. **Substituição não troca de
tipo**: ela liga duas bolsas, e desfazê-la por correção deixaria a substituta
sem explicação.

**Substituição em dois tempos.** A bolsa que entra só pode ser cadastrada depois
que a que sai libera a vaga, então `bolsaSubstitutaId` pode ser informado no
registro, se já existir, ou depois, pela correção. Ela precisa ocupar a mesma
vaga (mesma linha planejada e exercício) e substitui uma vez só
(`evento_bolsista_substituta_uk`).

**A movimentação é visível a quem alcança qualquer um dos lados** — quem cedeu e
quem recebeu são, os dois, parte do fato —, mas registrar e corrigir exigem
alcance sobre os dois.

**Não feito aqui:** a política de retenção do evento de
falecimento, que é dado sensível sem prazo decidido em
[retencao-v1.md](retencao-v1.md).

