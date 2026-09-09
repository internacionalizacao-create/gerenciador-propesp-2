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
| 9 | Catálogo de bolsas | `/catalogos/bolsas` | Baixa | [ ] |
| 10 | Modalidades e Configurações | `/catalogos/modalidades`, `/configuracoes` | Baixa | [ ] |
| 11 | Parceiros (lista + histórico) | `.../parceiros`, `.../parceiros/[id]` | Média | [ ] |

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
  recurso compartilhado. Desde 2026-09-08 o botão de cadastro/edição só aparece
  para quem tem `ppg:write`, que é só o `admin`.

**Observações:**

---

## 7. Visão do ciclo

**Rota** `.../[ciclo]` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** página-índice do ciclo, cartões de atalho com "número vivo"
  (ex.: "PPGs participantes · 24 programas") para as demais telas.
- **Base:** substitui a aba `Premissas` no papel de navegação central.
- **Resolve:** menos cálculo próprio, mais "pra onde eu vou" — mas cada número
  vivo depende de outro serviço, então um número errado aqui geralmente é
  sintoma de bug em outra tela.

**Observações:**

---

## 8. Comitê Gestor e Administração

**Rota** `.../comite-gestor` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/comite-gestor/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** orçamento paralelo (R$ 381.333,00/ano, 2026–2029) pra missões e
  articulação institucional.
- **Base:** substitui `Comitê Gestor 2026-2029`.
- **Resolve:** RN-14 — esse orçamento **nunca** pode se somar ao de bolsas em
  nenhum indicador. A decisão atual remove o aviso visual fixo, sem alterar a
  regra de cálculo; ver [backlog-comite-gestor.md](backlog-comite-gestor.md).
- **Pontos finos:** validar que ele realmente não vaza pro Painel Executivo nem
  pro Orçamento do CAPES Global.
- **Implementado em 2026-08-31:** três abas, origem do orçamento, equipes
  separadas, cadastro reutilizável de pessoa, vigência e edição auditável. Acesso
  provisório exclusivo de `admin`.
- **Implementado em 2026-09-01:** lista, filtros, paginação e cadastro
  multietapas de missão com roteiro repetível, participantes e criação
  persistente de pessoa, sem campos financeiros. O detalhe da missão ainda está
  pendente.
- **Composição formal em 2026-09-01:** conferir 2 pessoas em Comitê Gestor, 8 em
  Administração e as redes UFMG/UNESP/UNICAMP correspondentes aos três PDFs. O
  botão de novo membro deve continuar disponível para o `admin`.

**Observações:**

---

## 9. Catálogo de bolsas

**Rota** `/catalogos/bolsas` · [page.tsx](../apps/web/src/app/(app)/catalogos/bolsas/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** a tabela oficial (60 itens, `CAT-001`..`CAT-060`) — destino ×
  modalidade × vigência → valor.
- **Base:** substitui `Catálogo Bolsas`, `Bolsas Destino Brasil`,
  `Bolsas p Exterior`.
- **Resolve:** é **a fonte de verdade de todo cálculo do sistema** (RN-01).
  Validar essa tela é, na prática, validar a raiz de tudo que depende dela.
- **Pontos finos:** o `admin` publica e edita item (`catalogo:write`); os demais
  perfis só leem, e nem veem os botões. Item **já usado** por linha de plano
  mostra a contagem em "Em uso", abre o formulário com destino, modalidade,
  vigência e valor como texto travado, e não oferece "Remover" — a API recusa
  as duas coisas. Vale testar: publicar item novo destrava a combinação que a
  P10 recusava com 422, e o valor de um item em uso continua intocável.

**Observações:**

---

## 10. Modalidades e Configurações

**Rotas** `/catalogos/modalidades` · [page.tsx](../apps/web/src/app/(app)/catalogos/modalidades/page.tsx) — e `/configuracoes` · [page.tsx](../apps/web/src/app/(app)/configuracoes/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** catálogo auxiliar de modalidades de bolsa + conta do usuário
  (papéis e permissões).
- **Base:** parte da P23 da spec (`/catalogos/modalidades` e `/configuracoes`).
- **Resolve:** suporte às outras telas (não tem processo de negócio próprio).
- **Pontos finos:** cadastro e edição de modalidade são do `admin`. Os destinos
  cobertos **não se editam à mão**: passam a valer quando o primeiro item de
  catálogo daquele destino é publicado. Não há exclusão — desmarcar "ativa"
  tira de circulação sem quebrar item nem bolsa que a citam.

**Observações:**

---

## 11. Parceiros (lista + histórico)

**Rotas** `.../parceiros` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/parceiros/page.tsx) — e `.../parceiros/[id]` · [page.tsx](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/parceiros/[id]/page.tsx)

**Status da validação:** [ ] Validado

- **Objetivo:** manter uma instituição parceira **uma única vez** e reutilizá-la
  em várias redes e missões, com o histórico do que já aconteceu com ela.
- **Base:** não vem de planilha nenhuma. Nasceu do documento de escopo do Comitê
  Gestor de 2026-09-01 (P24 da spec), então não há número prévio para conferir —
  aqui se valida comportamento, não valor.
- **Resolve:** o mesmo parceiro cadastrado três vezes com grafias diferentes, que
  é justamente o que a conciliação depois teria de desfazer.
- **Pontos finos, na ordem em que vale testar:**
  1. **O alerta de duplicidade não pode apagar o formulário.** Preencha um
     cadastro inteiro, use um nome que já existe e confirme que nada do que foi
     digitado se perde quando os candidatos aparecem.
  2. **Nome idêntico bloqueia; parecido apenas avisa.** O primeiro caso não
     oferece botão de seguir adiante — a API recusa mesmo confirmada. O segundo
     oferece, e é o caminho legítimo para instituições homônimas.
  3. **Uma linha por missão.** Uma missão de duas redes, ou que visita o parceiro
     em duas paradas do roteiro, tem que aparecer **uma vez só** no histórico.
  4. **Conciliação transfere e não apaga.** Depois de conciliar, a origem fica
     inativa apontando para o destino, some da lista padrão, reaparece com o selo
     `conciliado` em "incluir inativos" e continua abrindo.
  5. **Não existe excluir** — nem parceiro, nem contato, em lugar nenhum da tela.
  6. **Produtos e convênios aparecem nomeados como pendentes, nunca como zero.**
- **Cuidado ao validar:** a página inteira, inclusive os dados pessoais dos
  contatos, é exclusiva de `admin` nesta etapa. Com `coord.teste` o esperado é
  "Acesso restrito" — e nenhum nome de parceiro ou de contato no HTML.

**Observações:**
