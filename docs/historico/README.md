# Histórico do projeto

O que este diretório guarda: o **relato** de como cada módulo chegou ao estado
em que está — task a task, com data. Saiu do `AGENTS.md` em 2026-09-22, quando
ele passou de 1.914 para pouco mais de 350 linhas.

**Nada foi apagado.** As justificativas de desenho e de segurança vieram
inteiras. A regra do corte foi a que o próprio `AGENTS.md` §7 enuncia:

> Nota que conta a história da implementação envelhece; nota que explica o
> número, não.

O que **explica uma regra ainda em vigor** ficou no `AGENTS.md`. O que conta
**quando** algo foi implementado está aqui.

## Como usar

- Vai **escrever código novo**? Comece pelo [`AGENTS.md`](../../AGENTS.md) e
  pelo [índice de `docs/`](../README.md). Não precisa ler nada daqui.
- Vai **mexer num módulo existente** e a regra não faz sentido? O porquê está
  aqui, no arquivo do módulo.
- Quer saber **por que uma decisão foi tomada e quando**? Comece por
  [decisoes-por-data.md](decisoes-por-data.md).

## Arquivos

| Arquivo | O que guarda |
|---|---|
| [decisoes-por-data.md](decisoes-por-data.md) | Índice cronológico das decisões do responsável, com ponteiro para o porquê por extenso. |
| [autorizacao.md](autorizacao.md) | A troca do modelo de papéis por concessões individuais (V1-010 a V1-022), incluindo o argumento contra semear administrador e por que não há conversão do acesso legado. |
| [comite-gestor.md](comite-gestor.md) | O módulo fechado do Comitê Gestor: missão, aprovação, prestação, anexos, encerramento, painel, relatórios, exportações e notificações. |
| [backlog-comite-gestor.md](backlog-comite-gestor.md) | As 69 fichas do backlog do Comitê Gestor, todas concluídas. |
| [bolsistas-e-mobilidade.md](bolsistas-e-mobilidade.md) | P02, P03, P04, P18/P19: cadastro individual da concessão, documentos do bolsista, parceiros, panorama, mapa e produção. |
| [eventos-externos.md](eventos-externos.md) | A entrega da P12 (V1-036/V1-037). O contrato vivo é [../eventos-externos-v1.md](../eventos-externos-v1.md). |
| [planejamento-e-catalogo.md](planejamento-e-catalogo.md) | Modelo de dados, seed, serviços de cálculo, cadastro institucional, orçamento anual, P10 e a participação PPG–temática. |
| [migrations-pre-v1/](migrations-pre-v1/) | As migrations anteriores à consolidação da base da V1, preservadas como estavam. |

## O que **não** está aqui

Documento de histórico não é backlog. A fila de trabalho da V1 está em
[../backlog-v1.md](../backlog-v1.md) e nas fichas de
[../backlog-v1/](../backlog-v1/) — vivos, e atualizados por quem executa.
