# Estado atual — o que existe e o que não existe

Inventário do que está construído e verificado, e do que **ainda não existe**, com o
motivo. Saiu do `AGENTS.md` §9 na reorganização de 2026-09-22, onde ficou o resumo.

Este documento envelhece por natureza: **atualize-o ao fechar uma task** que mude o
inventário. A honestidade do "não existe ainda" é o que ele tem de mais útil — uma lista
que só cresce vira propaganda, e quem chega passa a procurar no código o que a
documentação prometeu.

---

**Existe e está verificado:** autenticação e autorização completas (`AGENTS.md` §5 e §6); 56 tabelas
com a seed real; os cálculos RN-01 a RN-20, todos em SQL; as telas de planejamento (P01,
P05–P10, P14, P15, P17); o cadastro individual de bolsas e produtos (P03); panorama, mapa
e produção de mobilidade (P02, P04, P18/P19); parceiros e seu histórico (P24); os eventos
externos da CAPES (P12); e o **módulo do Comitê Gestor inteiro**, das 69 tasks fechadas à
folha de homologação marcada. Cobertura: 280 testes unitários/regressão e 733 casos de
integração em 43 suítes contra Postgres real, mais os três smokes disponíveis e 17 jornadas Playwright.

**V1-022 concluída em 2026-09-23:** o cadastro de PPG permanece institucional;
planejamento e agregados seguem `plano:read`, inclusive na resposta de edição.
Sem acesso, vêm nulos com `podeLerPlano: false`; totais parciais são identificados.
Não há escopo agregado no `/me` nem reexportação `auth/permissions.ts`.
O inventário de rotas é conferido por teste, e o navegador cobre os sete modelos,
bootstrap com dois logins, recortes distintos e revogação imediata. Detalhes em
[histórico da autorização](historico/autorizacao.md#v1-022--consolidação-do-fluxo-2026-09-23).

**Não existe ainda:**

- **Dado individual de mobilidade.** As telas de P01 a P04 e de produção existem e ficam
  vazias: as planilhas não trazem o beneficiário — sabe-se que há "1 bolsa de Doutorado
  Sanduíche de 6 meses para o PPGCLIAMB", não quem foi nem se voltou. **Nada disso é
  bug**; é a equipe que precisa cadastrar as concessões em P03.
- Relatórios gerais (P20) e importação com adaptador por programa (P21). O que falta de
  documentos e evidências (P22) é fora do Comitê Gestor.
- **Home por perfil.** A P01 é a mesma para todos; o que muda com o acesso é o menu ao
  lado dela e o bloco de mobilidade, que some sem `bolsa:read`. A decisão de 2026-09-10 a
  condicionou ao recorte de plano e orçamento, pelo argumento que continua valendo para
  qualquer home nova: **uma home do coordenador montada antes disso ou mostraria o programa
  inteiro sob o rótulo "seu PPG", ou recortaria só na tela — e recorte fora da consulta é
  justamente o que o `AGENTS.md` §6 proíbe.** Esse bloqueio caiu com a V1-013 (2026-09-17);
  hoje falta a decisão de desenho, não a base, e a home por perfil é a terceira fase da
  proposta de dashboard. A V1-019 **não a antecipou**: ela decide se a tela abre.
- Revisão de volume dos seletores de parceiro: a conciliação carrega os primeiros 200 e a
  detecção de duplicidade examina até 1.000 instituições.
- Cobertura ampla de componentes na `web`: o `node --test` não lê `.tsx` e recusa
  *parameter property*, então a lógica testável mora em `.ts` ao lado do componente
  (`multistep-logica.ts`, `toast-logica.ts`, `orcamento-por-rede-serie.ts`) e o
  resto depende do `pnpm smoke:telas`. É a ferramenta ditando a estrutura, e some com um
  runner que renderize componente.
- Interface e política definitiva de acesso dos documentos pessoais. *(Corrigido em
  2026-09-22: este item também pedia "o histórico de cancelamento, desistência, falecimento
  e substituição", que a V1-036/V1-037 entregou em 2026-09-21 — ver
  [eventos-externos-v1.md](eventos-externos-v1.md).)*
- Rate limiting, auditoria fora das edições de plano/orçamento, e observabilidade.
- Qualquer configuração de produção: HTTPS, segredos fora do repositório, Keycloak em
  modo `start` (não `start-dev`), origem de sessão externa.

---
