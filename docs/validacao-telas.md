# Validação das telas

Checklist para conferir, tela por tela, se o que está implementado bate com a
especificação ([system-structl.md](../system-structl.md)) e com os números reais
das planilhas. Ordenado da tela **mais complexa para a mais simples de validar**
— complexidade aqui significa quanto cálculo/regra de negócio tem por trás, não o
tamanho da tela.

Cobre as telas hoje implementadas (ver [AGENTS.md](../AGENTS.md) §9). Fora do
escopo: tudo que depende de dado que ainda não existe (bolsista individual,
execução financeira, remanejamento) — não dá pra validar o que não foi
construído.

---

## Resumo

| # | Tela | Rota | Complexidade | Validado? |
|---|---|---|---|---|
| 1 | Plano de aplicação | `.../plano` | Alta | [ ] |
| 2 | Painel executivo | `/` | Alta | [ ] |
| 3 | Detalhe da área temática | `.../tematicas/[codigo]` | Alta | [ ] |
| 4 | Orçamento | `.../orcamento` | Média-alta | [ ] |
| 5 | Redes e áreas temáticas | `.../redes` | Média-alta | [ ] |
| 6 | PPGs (lista + detalhe) | `/ppgs`, `/ppgs/[id]` | Média | [ ] |
| 7 | Visão do ciclo | `.../[ciclo]` | Média | [ ] |
| 8 | Comitê Gestor | `.../comite-gestor` | Baixa-média | [ ] |
| 9 | Pendências | `/pendencias` | Baixa-média | [ ] |
| 10 | Catálogo de bolsas | `/catalogos/bolsas` | Baixa | [ ] |
| 11 | Modalidades e Configurações | `/catalogos/modalidades`, `/configuracoes` | Baixa | [ ] |

---

## 1. Plano de aplicação

**Rota** `.../plano` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/plano/page.tsx)

**Status da validação:** [ ] Validado

A mais complexa. É a "tela mais importante do sistema" segundo a própria spec.

- **Objetivo:** onde a equipe planeja o que será gasto nas três rubricas (Bolsas,
  Manutenção, Missões) por PPG/temática/ano.
- **Base:** substitui a aba `Plano_Bolsas` da planilha — mas estende pra
  Manutenção e Missões, que na planilha original nem existiam como plano
  detalhado (resposta Q3 da spec).
- **Resolve:** o problema central do projeto — "o cálculo mora na fórmula"
  (PROCV copiado entre abas). Em Bolsas, o valor unitário **nunca é digitado**,
  vem do catálogo (RN-01); combinação sem item no catálogo bloqueia o
  salvamento. Manutenção/Missões usam valor **estimado com justificativa
  obrigatória** — visualmente distinto de "oficial".
- **Pontos finos pra testar:** as 10 linhas UNICAMP (`BOL-024`..`BOL-033`) devem
  aparecer com quantidade 0, status `PENDENTE`, agrupadas com "aguardando
  definição de orçamento pela rede" — **nunca como zero silencioso**. Manutenção
  e Missões devem estar vazias (R$ 69.751,14/ano não programado é lacuna
  visível, não comentário).

**Observações:**

---

## 2. Painel executivo

**Rota** `/` · [page.tsx](../apps/web/src/app/(app)/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** primeira tela após login, responde "como está o programa" com 8
  indicadores, resumo por rede, por modalidade, impacto anual e alertas.
- **Base:** substitui as abas `Painel Executivo` e `Painel_UEA`.
- **Resolve:** "não há fonte única" — hoje os mesmos números aparecem (e
  divergem) em várias abas e PNGs de insight.
- **Pontos finos:** é a tela com maior superfície de validação porque agrega
  **todos** os serviços (RN-04 a RN-11). Rede sem orçamento definido tem que
  aparecer hachurada "Pendente", nunca como zero, para não distorcer médias.

**Observações:**

---

## 3. Detalhe da área temática

**Rota** `.../tematicas/[codigo]` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/tematicas/[codigo]/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** tudo sobre uma temática numa página só, em abas (Resumo, PPGs,
  Plano de aplicação, Execução*, Histórico*) — *as duas últimas ainda não
  implementadas.
- **Base:** consolidação que não existia como página própria na planilha; junta
  pedaços de `Redes_Tematicas` e das abas `Comitê *`.
- **Resolve:** "não há histórico" — a ideia da aba Histórico é reconstituir o
  que a planilha só guardou por acaso (a mudança de custo da UFMG de
  R$ 396.981,60 para R$ 519.489,70 quando sobra virou bolsa de Capacitação).
- **Pontos finos:** alerta de PPG duplicado em outra temática da mesma rede (é a
  `PEND-006`, caso PROFSAÚDE).

**Observações:**

---

## 4. Orçamento

**Rota** `.../orcamento` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/orcamento/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** matriz ano × rede/temática com bolsas disponíveis, manutenção,
  missões, total previsto, custo programado, saldo potencial, situação.
- **Base:** substitui `Orçamento_2027_2030`.
- **Resolve:** dar uma leitura única de saldo e execução por rubrica, hoje
  espalhada em fórmulas manuais.
- **Pontos finos:** RN-06 (saldo potencial) e RN-08 (divergência calculado vs
  informado). As divergências históricas que originaram `PEND-001`/`PEND-003`
  foram conciliadas; o esperado agora é zero, mantendo a regra ativa para
  detectar diferenças futuras.

**Observações:**

---

## 5. Redes e áreas temáticas

**Rota** `.../redes` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/redes/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** cartões por rede + tabela de áreas temáticas com orçamento,
  custo, saldo e utilização. Divergência aparece somente como alerta excepcional;
  os valores da conferência ficam no detalhe da temática.
- **Base:** substitui `Redes_Tematicas` e as abas `Comitê *`.
- **Resolve:** mesma frente de "fonte única", num nível acima do orçamento (por
  rede, não só por temática).
- **Pontos finos:** rede `A_DEFINIR` (UNICAMP) — orçamento em branco com rótulo
  "A definir", nunca zero.

**Observações:**

---

## 6. PPGs

**Rota** `/ppgs` (lista) e `/ppgs/[id]` (detalhe) · [lista](../apps/web/src/app/(app)/ppgs/page.tsx) · [detalhe](../apps/web/src/app/(app)/ppgs/[id]/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** cadastro e consulta dos 24 PPGs da UEA — dados institucionais,
  linhas de pesquisa, participação em redes/temáticas.
- **Base:** substitui a aba `PPGs` + slide 3 do protótipo.
- **Resolve:** ser o cadastro-raiz que todo o resto referencia (`ppgId` em
  quase tudo).
- **Pontos finos:** `notaCapes` vai até 7 (não limitar a 5 — tem PPG com nota
  7); PPG de rede nacional (BIONORTE, REAMEC etc.) precisa do sinalizador de
  recurso compartilhado.

**Observações:**

---

## 7. Visão do ciclo

**Rota** `.../[ciclo]` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** página-índice do ciclo, cartões de atalho com "número vivo"
  (ex.: "Pendências · 13 abertas") para as demais telas.
- **Base:** substitui a aba `Premissas` no papel de navegação central.
- **Resolve:** menos cálculo próprio, mais "pra onde eu vou" — mas cada número
  vivo depende de outro serviço, então um número errado aqui geralmente é
  sintoma de bug em outra tela.

**Observações:**

---

## 8. Comitê Gestor

**Rota** `.../comite-gestor` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/comite-gestor/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** orçamento paralelo (R$ 381.333,00/ano, 2026–2029) pra missões e
  articulação institucional.
- **Base:** substitui `Comitê Gestor 2026-2029`.
- **Resolve:** RN-14 — esse orçamento **nunca** pode se somar ao de bolsas em
  nenhum indicador. O aviso fixo no topo dizendo isso é regra de produto, não
  só de UI.
- **Pontos finos:** validar que ele realmente não vaza pro Painel Executivo nem
  pro Orçamento do CAPES Global.

**Observações:**

---

## 9. Pendências

**Rota** `/pendencias` · [page.tsx](../apps/web/src/app/(app)/pendencias/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** lista de trabalho da equipe (hoje 14 itens) com responsável,
  prazo, status.
- **Base:** substitui a aba `Pendencias` — que, segundo a spec, está
  desatualizada até na própria planilha (ainda anuncia 10 itens).
- **Resolve:** "decisão vira comentário solto" — aqui vira item de trabalho
  rastreável.
- **Pontos finos:** pendências de origem `AUTOMATICA` (geradas por divergência
  de saldo, catálogo sem match, PPG duplicado) não podem ser excluídas, só
  resolvidas — vale testar essa trava.

**Observações:**

---

## 10. Catálogo de bolsas

**Rota** `/catalogos/bolsas` · [page.tsx](../apps/web/src/app/(app)/catalogos/bolsas/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** a tabela oficial (60 itens, `CAT-001`..`CAT-060`) — destino ×
  modalidade × vigência → valor.
- **Base:** substitui `Catálogo Bolsas`, `Bolsas Destino Brasil`,
  `Bolsas p Exterior`.
- **Resolve:** é **a fonte de verdade de todo cálculo do sistema** (RN-01).
  Validar essa tela é, na prática, validar a raiz de tudo que depende dela —
  mas ela mesma é só leitura hoje, sem lógica própria além de mostrar os 60
  valores certos.

**Observações:**

---

## 11. Modalidades e Configurações

**Rotas** `/catalogos/modalidades` · [page.tsx](../apps/web/src/app/(app)/catalogos/modalidades/page.tsx) — e `/configuracoes` · [page.tsx](../apps/web/src/app/(app)/configuracoes/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** catálogo auxiliar de modalidades de bolsa + conta do usuário
  (papéis e permissões).
- **Base:** parte da P23 da spec (`/catalogos/modalidades` e `/configuracoes`).
- **Resolve:** suporte às outras telas (não tem processo de negócio próprio) —
  mais fácil de validar porque é essencialmente estática.

**Observações:**
