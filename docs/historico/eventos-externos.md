# Histórico — Eventos externos da CAPES (P12, V1-036 / V1-037)

Saiu do `AGENTS.md` na reorganização de 2026-09-22. O **contrato vivo** está em
[../eventos-externos-v1.md](../eventos-externos-v1.md) — este arquivo guarda o
relato da entrega e as justificativas de desenho.

**A regra de fundo é a do `AGENTS.md` §1:** o Gerenciador registra o que já
aconteceu na CAPES; não propõe, não autoriza, não paga e não persegue.

---

## O que a V1-036 e a V1-037 entregaram

**Eventos externos da CAPES (P12, V1-036, 2026-09-21)**: API de registro,
consulta e correção, contrato em
[docs/eventos-externos-v1.md](../eventos-externos-v1.md) (a seção "O que foi implementado" desse contrato diz o que foi
implementado). **O Gerenciador registra o que já aconteceu na CAPES** — não
propõe, não autoriza, não paga e não persegue (`AGENTS.md` §1). Dois grupos, duas tabelas:
- **Movimentação de recurso** reusa `remanejamento`: origem e destino têm de
  ser PPGs **da mesma área temática**, e outra temática ou rede é bloqueio.
  Só `EXECUTADO` é aceito (RN-13). **Não toca no plano nem no teto** — o custo
  sai de `planejamento_anual`, e replanejar continua sendo ato da P10.
- **Evento do beneficiário** (`evento_bolsista`): desistência, interrupção,
  falecimento, substituição e conclusão antecipada. **O tipo é dado**
  (`tipo_evento_bolsista`), e o efeito na situação da bolsa também: estados de
  origem e de destino são colunas, e um tipo novo é um `insert`.
  `FALECIMENTO` leva a *Interrompida*, sem estado próprio — um `FALECIDA` no
  enum publicaria a causa em toda listagem.
- **Cancelada libera a vaga; interrompida não.** Era efeito colateral de
  `exigirVaga` e virou regra: voltar de `CANCELADA` por correção passa pela
  vaga e é recusado se alguém já a ocupou.
- **O panorama deixou de contar `CANCELADA`** sem filtro explícito, e com ele o
  relatório exportável e o bloco de mobilidade da P01 — pela mesma função
  `condicao`. Sem isso a substituição contaria a vaga duas vezes.
- **Reenvio não duplica**: todo registro traz `chave` (UUID de quem envia); a
  mesma chave devolve o registro existente e, noutro alvo, é 409.
- **Correção não apaga**: o valor corrigido fica na linha e a trilha guarda o
  campo trocado, com o motivo — **sem o texto** de justificativa e
  observação, que podem descrever doença ou morte. Trocar o tipo reaplica o
  efeito a partir do `status_anterior` fotografado, só no último evento da
  bolsa; substituição não troca de tipo.
- **A edição da bolsa não desfaz a situação que um evento produziu**, e toda
  troca de situação pela edição passou a ser auditada.
- **Tela (V1-037)**: seção *Eventos informados pela CAPES* no detalhe da
  bolsa (registrar, corrigir, anexar comprovante) e a P12 em
  `.../remanejamentos` ("Eventos da CAPES"), com as movimentações e os
  eventos do ciclo. Os formulários só oferecem o que a API aceitaria e dizem
  o efeito antes de salvar. **A edição da bolsa não leva mais a
  *Cancelada*/*Interrompida*** — isso é evento.
- Permissões próprias, `evento:read`, `evento:create` e `evento:edit`: corrigir
  período é rotina, registrar que alguém faleceu não é. O registro do evento
  exige também `bolsa:edit`; a movimentação exige alcance sobre **os dois**
  PPGs para escrever e sobre **qualquer um** para ler. Comprovante é anexo
  opcional (`EVENTO_BOLSISTA`, `REMANEJAMENTO`) e cada linha diz quantos tem.
