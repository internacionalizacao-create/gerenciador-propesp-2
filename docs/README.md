# Índice da documentação

Este diretório tem três tipos de documento, e confundi-los custa caro: um
**contrato** descreve o que o sistema faz hoje e é cobrado por teste; um
**runbook** é para executar, com o sistema na frente; um **registro** é a foto
de uma decisão ou de uma auditoria, e não se atualiza — envelhece de propósito.

O ponto de partida é o [`AGENTS.md`](../AGENTS.md) na raiz: o que é o sistema,
como rodar, o modelo de autorização e as convenções. A especificação funcional
completa é [`system-structl.md`](../system-structl.md).

---

## Contratos vivos — descrevem o sistema como ele é hoje

| Documento | O que responde |
|---|---|
| [arquitetura-sistema.md](arquitetura-sistema.md) | O sistema em duas perspectivas: o que resolve (negócio) e como uma ação sai da tela e chega ao banco (técnica). |
| [autenticacao.md](autenticacao.md) | Como o login funciona, o que cada decisão defende e o que falta. Detalha o `AGENTS.md` §5. |
| [contrato-autorizacao-v1.md](contrato-autorizacao-v1.md) | O inventário **rota a rota**: qual ação cada endpoint cobra e sobre que alvo. Consulte antes de criar endpoint. |
| [guia-interface.md](guia-interface.md) | Tema e tokens, tradução do shadcn, TanStack Query, as peças de UI e a acessibilidade que não deve regredir. Detalha o `AGENTS.md` §8. |
| [eventos-externos-v1.md](eventos-externos-v1.md) | O contrato da P12: movimentação de recurso e evento do beneficiário, com o que é aceito e o que é recusado. |
| [modelo-documental.md](modelo-documental.md) | Como anexo, versão, visibilidade e download funcionam — decidido antes do primeiro upload. |
| [retencao-v1.md](retencao-v1.md) | O que se guarda, por quanto tempo, e o que ainda não tem prazo. Nenhum descarte é automático. |
| [migracao-ui.md](migracao-ui.md) | O inventário da biblioteca local de UI e o que ainda falta migrar. |
| [estado-atual.md](estado-atual.md) | O que existe e está verificado, e o que **não existe ainda**, com o motivo. Atualize ao fechar uma task que mude o inventário. |

## Runbooks — para executar com o sistema na frente

| Documento | Quando usar |
|---|---|
| [operacao-local.md](operacao-local.md) | Subir o ambiente numa máquina, usuários de teste, banco, backup, zeragem, build sem internet e o que cada suíte de teste responde. |
| [ativacao-acesso-v1.md](ativacao-acesso-v1.md) | Pôr uma instalação nova em operação, semear o primeiro administrador e as cinco saídas de rollback. |
| [guia-cadastro-do-zero.md](guia-cadastro-do-zero.md) | Percorrer o fluxo completo com o banco zerado, na ordem em que as dependências existem. |
| [validacao-telas.md](validacao-telas.md) | Conferir tela a tela contra a especificação e os números das planilhas. |

## Fila de trabalho — viva, atualizada por quem executa

| Documento | O que é |
|---|---|
| [backlog-v1.md](backlog-v1.md) | As tarefas da V1 interna, seu estado e suas dependências. **É aqui que se olha para saber o que fazer.** |
| [backlog-v1/](backlog-v1/) | As fichas detalhadas, por bloco: [autorização](backlog-v1/01-autorizacao.md), [fluxos e dados](backlog-v1/02-fluxos-e-dados.md), [operação e qualidade](backlog-v1/03-operacao-e-qualidade.md), [evoluções](backlog-v1/04-evolucoes.md). |

## Registros — fotos de uma decisão ou auditoria; não se atualizam

| Documento | Do que é a foto |
|---|---|
| [proposta-autorizacao-v1.md](proposta-autorizacao-v1.md) | O modelo de autorização aprovado pelo responsável em 2026-09-15. Aprovação do responsável, não homologação institucional. |
| [diagnostico-v1-2026-09-15.md](diagnostico-v1-2026-09-15.md) | A revisão que originou o backlog da V1, com as divergências entre documentação e código naquela data. |
| [homologacao-comite-gestor.md](homologacao-comite-gestor.md) | As decisões CG-005 a CG-009 tornadas decidíveis, com a folha de aceite. |
| [homologacao-bolsistas.md](homologacao-bolsistas.md) | As sete decisões D-B01 a D-B07 do módulo Bolsistas. |
| [revisao-escopo-comite-gestor-2026-09-01.md](revisao-escopo-comite-gestor-2026-09-01.md) | A auditoria do escopo ampliado que a equipe entregou em 2026-09-01. |
| [revisao-escopo-bolsistas-2026-09-09.md](revisao-escopo-bolsistas-2026-09-09.md) | A auditoria da proposta de estruturação do módulo Bolsistas. |
| [questionario-perfis-acesso.md](questionario-perfis-acesso.md) | O questionário de perfis, sem respostas presumidas. Suas descrições sobre ausência de recorte **já não refletem o código**; não oriente implementação por ele. |

## Histórico — o relato de como se chegou aqui

[historico/](historico/README.md) guarda o que o `AGENTS.md` contava sobre
**quando** cada peça entrou, com as justificativas inteiras: o
[Comitê Gestor](historico/comite-gestor.md) e suas
[69 fichas](historico/backlog-comite-gestor.md), os
[bolsistas e a mobilidade](historico/bolsistas-e-mobilidade.md), a
[autorização](historico/autorizacao.md), os
[eventos externos](historico/eventos-externos.md), o
[planejamento e o catálogo](historico/planejamento-e-catalogo.md), as
[migrations anteriores à consolidação](historico/migrations-pre-v1/) e o índice de
[decisões por data](historico/decisoes-por-data.md).

---

## Ao criar um documento novo

Diga no cabeçalho **qual dos quatro tipos ele é** e acrescente-o à tabela certa
aqui. Documento sem tipo declarado é lido como contrato pela pessoa seguinte —
e um registro lido como contrato manda implementar coisa que já mudou.
