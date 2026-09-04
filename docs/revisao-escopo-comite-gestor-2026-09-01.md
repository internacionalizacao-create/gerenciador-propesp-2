# Revisão de escopo — Comitê Gestor, Parceiros e Resultados

Data da revisão: 2026-09-01.
Última atualização de implementação: 2026-09-02.

Fonte analisada:
`dados/novos_dados/ajustes_e_definicao/Módulo de Gestão de Missões, Comitê Gestor, Parceiros e Resultados.pdf`.

Este documento registra a comparação entre as 40 seções da fonte, o backlog da
P17 e o código existente. Ele é um artefato de continuidade: outro agente deve
conseguir retomar o trabalho sem precisar reconstruir a análise da conversa.

## Resumo para continuidade

- A leitura integral das 28 páginas foi concluída.
- Nenhuma regra nova do PDF foi implementada durante esta revisão.
- A fundação já entregue continua válida: pessoas reutilizáveis, equipes,
  composição formal das redes, cadastro/lista/detalhe da missão na API, roteiro,
  participantes, ciclo de vida anterior, auditoria e relato do realizado.
- Depois da revisão, CG-016 a CG-018 implementaram as fundações estruturais de
  missões multirrede, parceiros/contatos e o contrato ampliado da missão.
  Parceiros possuem API própria desde a CG-025; a interface permanece pendente.
- O documento novo amplia o produto para aprovação colegiada, parceiros,
  contatos, documentos, prestação, produtos, convênios, evidências, indicadores,
  relatórios e exportações.
- Não iniciar a antiga próxima task CG-045 antes de concluir CG-005 a CG-009. O
  contrato do detalhe será alterado pelas decisões de aprovação, redes,
  parceiros e documentos.
- A próxima task recomendada é **CG-005 — Homologar o novo escopo e as fases**.
- Em 2026-09-01, o pacote que torna CG-005 a CG-009 decidíveis foi escrito em
  [homologacao-comite-gestor.md](homologacao-comite-gestor.md): classificação
  das 40 seções, modelo de estados com migração, matrizes de rede e escopo,
  governança da aprovação e tabela requisito–momento–efeito financeiro. As
  decisões D-01 a D-14 abaixo têm resposta proposta ali; nenhuma foi aplicada
  ao código.
- Baseline verificada antes desta revisão: 33 testes unitários da API, 173 de
  integração, regressões da web, lint e builds aprovados.
- O repositório já possuía alterações não commitadas das entregas anteriores.
  Preserve-as; não use comandos destrutivos para tentar obter uma árvore limpa.

## Legenda da matriz

- **Atendido**: comportamento existente satisfaz a expectativa essencial.
- **Parcial**: existe uma fundação aproveitável, mas faltam dados ou fluxo.
- **Pendente**: não existe implementação de produto para o requisito.
- **Decisão**: há conflito ou ambiguidade que precisa de homologação antes do
  desenvolvimento.

## Matriz integral das 40 seções

| Seção | Expectativa | Situação atual | Encaminhamento |
|---:|---|---|---|
| 1 | Planejar, aprovar, acompanhar, prestar contas e avaliar missões das três redes | **Parcial** | Missões existem; aprovação, prestação e avaliação completa entram em CG-037 a CG-039 e CG-050 a CG-059. |
| 2 | Estrutura rede → parceiros/missões → aprovação → realização → resultados | **Parcial** | Redes, missões e o schema de parceiros existem. Cadastro de parceiros, aprovação e produtos ainda precisam dos domínios de serviço. |
| 3 | Administrador, Gestor da Rede, Comitê Gestor e Participante | **Decisão** | Acesso atual é provisoriamente exclusivo de `admin`. Concluir CG-003, CG-007 e CG-028. |
| 4 | Dashboard principal do Comitê com oito indicadores clicáveis | **Parcial** | A P17 possui orçamento, equipes e resumo básico de missões. Criar CG-066. |
| 5 | Filtros por rede, país, período, evento e status | **Parcial** | Rede, país, período e status existem; faltam instituição e taxonomia completa de eventos/status. |
| 6 | Visão de todas as redes e visão da própria rede | **Parcial** | A missão já é multirrede e aparece uma vez em “Todas”; o escopo do usuário ainda depende da CG-028. |
| 7 | Cadastro independente de instituições parceiras e vínculo multirrede | **Implementado** | Dados completos e `instituicao_rede` N:N existem desde CG-017; CRUD, candidatos e conciliação foram entregues na CG-025, e a CG-049 trouxe lista, busca, cadastro, edição e conciliação para a interface. |
| 8 | Vários contatos por instituição | **Implementado** | `contato_instituicao`, a regra de um principal ativo e a API completa (CG-026, com auditoria minimizada). A interface de contatos — cadastro, edição, troca de principal, inativação e reativação — entrou na CG-049. |
| 9 | Histórico permanente do parceiro | **Implementado** | `GET /parceiros/:id/historico` (CG-027) consolida redes, contatos, missões, atividades, eventos e documentos sem duplicar missão multirrede, e a CG-049 o apresenta na página do parceiro. Produtos e convênios seguem nomeados como pendentes até a CG-056. |
| 10 | Identificação da missão, rede, responsável, unidade e tipo | **Implementado na API** | Código, nome, objetivo, redes, unidade, tipo e responsável único existem; falta apresentar os campos na interface. |
| 11 | Destino com região, local, endereço, saída, retorno e dias | **Implementado na API** | A atividade guarda os dados não derivados; número de dias inclusivo é calculado. Falta interface. |
| 12 | Evento detalhado e relacionado a uma ou mais redes | **Implementado na API** | D-10 foi aplicada: evento permanece atividade no MVP e herda redes da missão, com seus dados próprios completos. Falta interface. |
| 13 | Instituições e contatos relacionados à missão | **Implementado na API** | Atividade referencia instituição e contato centrais, tipo e objetivo do relacionamento; as APIs de instituições (CG-025) e de contatos (CG-026) existem. A apresentação depende da CG-049. |
| 14 | Participantes com cargo, área e período individual | **Implementado na API** | Associação guarda cargo, área e período, com fallback integral para clientes antigos. Falta interface. |
| 15 | Documentos prévios, upload múltiplo e vários formatos | **Pendente/Decisão** | Existe apenas tabela genérica não integrada. Definir formatos/armazenamento em CG-009 e CG-014; implementar CG-051/CG-052. |
| 16 | Enviar missão ao Comitê e entrar em análise | **Pendente** | Não existe submissão. CG-037. |
| 17 | Tela de análise com resumo, documentos e histórico | **Pendente** | A API de detalhe é base aproveitável. Expandir contrato e criar CG-047/CG-048. |
| 18 | Aprovar, solicitar ajustes ou reprovar | **Pendente** | `CONFIRMAR` não equivale a aprovação colegiada. CG-006, CG-008 e CG-038. |
| 19 | Histórico imutável de decisões e documentos analisados | **Pendente** | Auditoria genérica existe, mas não substitui parecer formal. CG-019 e CG-038. |
| 20 | Após aprovação e viagem, abrir prestação | **Decisão** | A passagem do tempo não deve afirmar que a viagem ocorreu. Definir confirmação manual e abertura assistida em CG-006/CG-009. |
| 21 | Passagens com dados operacionais e documentos | **Pendente** | Expandir CG-013 e implementar CG-050 a CG-053. |
| 22 | Cotações de passagens com PDF individual | **Pendente** | Incluir cotação como entidade própria na revisão da CG-013/CG-050. |
| 23 | Diárias por beneficiário, período e local | **Pendente** | Já previstas parcialmente em CG-013/CG-050; ampliar campos. |
| 24 | Hospedagem, transporte, inscrição, seguro e outras despesas | **Decisão/Pendente** | O backlog anterior previa apenas passagens e diárias. Homologar em CG-009 e implementar modelo extensível em CG-013/CG-050. |
| 25 | Produtos gerados pela missão | **Pendente** | Produto de bolsa é outro domínio e não deve ser reutilizado sem modelagem. CG-056. |
| 26 | Convênio vinculado a produto, instituições e documento | **Pendente** | Antes era fase 2; o PDF o promove ao módulo. CG-056. |
| 27 | Galeria de fotos categorizada | **Pendente** | CG-057. |
| 28 | Evidências documentais categorizadas | **Pendente** | CG-014, CG-051, CG-052 e CG-057. |
| 29 | Relatório final estruturado e avaliação do objetivo | **Parcial** | Relato geral, resultados e atividades existem na API; faltam contatos, desdobramentos e avaliação. CG-046 e CG-058. |
| 30 | Checklist condicional para encerrar | **Pendente/Decisão** | Hoje só há relato mínimo. Definir obrigatoriedade condicional e implementar CG-058. |
| 31 | Dashboard com fila de análise | **Parcial** | Lista de missões existe; fila e status de aprovação não. CG-047 e CG-066. |
| 32 | Dashboard por rede | **Pendente** | CG-067. |
| 33 | Indicadores estratégicos de missões, parceiros, resultados e finanças | **Pendente** | CG-066, CG-067 e CG-068. |
| 34 | Relatórios por domínio e filtros | **Pendente** | CG-068. |
| 35 | Exportar PDF, Excel, CSV e relatório final completo | **Pendente** | CG-069. |
| 36 | Estrutura conceitual de entidades | **Parcial** | Pessoa, rede, missão, participante, atividade, instituição e auditoria existem; demais entidades serão adicionadas por tasks específicas. |
| 37 | Evitar duplicidade de instituições e contatos | **Implementado** | Instituições têm bloqueio inequívoco, candidatos, confirmação explícita e conciliação auditada pela CG-025. Contatos ganharam na CG-026 a mesma disciplina no escopo da instituição, com índice único de e-mail normalizado e confirmação para homônimo. A CG-049 apresenta os candidatos dentro do formulário, sem apagá-lo. |
| 38 | Fluxo completo em 25 passos | **Parcial** | Cadastro até participantes existe; aprovação, prestação, produtos e conclusão ampliada permanecem pendentes. |
| 39 | Novo menu completo do módulo | **Decisão** | O menu atual evita fragmentar funcionalidades sem dados. Validar arquitetura da informação em CG-005 antes de criar rotas. |
| 40 | Registrar a história da internacionalização | **Objetivo** | Diretriz aceita para orientar parceiros, contatos, histórico, produtos e indicadores, sujeita à homologação das regras detalhadas. |

## Decisões que não podem ser inferidas pelo desenvolvedor

### D-01 — Autoridade e fases do documento

Confirmar se todas as 40 seções são obrigatórias no MVP ou se o documento define
a visão final. Recomendação: homologar como visão final e dividir em entregas,
porque aprovação, armazenamento e escopo por rede exigem decisões de segurança.

### D-02 — Dimensões de estado

O PDF mistura aprovação, tempo, realização, prestação e encerramento em uma
lista única. Recomendação: manter dimensões independentes:

```text
aprovação: RASCUNHO → EM_ANALISE → AJUSTES_SOLICITADOS
                              └→ APROVADA | REPROVADA

execução: FUTURA | EM_ANDAMENTO | REALIZADA | CANCELADA
prestação: NAO_INICIADA | EM_PREENCHIMENTO | ENVIADA | COM_PENDENCIA | VALIDADA
encerramento: ABERTA | CONCLUIDA
```

### D-03 — Rede da missão e do evento

Definir se uma missão pode pertencer a várias redes. O próprio PDF permite que
evento e parceiro sejam multirrede. Recomendação: `missao_rede` muitos-para-
muitos, com pelo menos uma rede, evitando uma coluna singular que precise ser
substituída depois.

### D-04 — Governança da aprovação

Definir quem pode emitir a decisão, se uma decisão individual representa o
Comitê, se existe quórum, se há votação e quem pode reabrir uma análise. Até
essa definição, não implementar `APROVAR` como um simples botão de admin.

### D-05 — Estimativa antes da viagem versus despesa efetiva

A decisão anterior excluiu valores do cadastro inicial; o PDF pede “Orçamento”
nos documentos anteriores à aprovação. Recomendação: permitir estimativa ou
documento de orçamento para análise sem criar despesa e sem reduzir saldo. A
execução oficial continua vindo apenas da prestação validada.

### D-06 — Instituição canônica e texto livre

Hoje uma atividade aceita instituição cadastrada ou texto livre. O PDF exige
base única. Recomendação: texto livre cria referência provisória sujeita a
conciliação, ou deixa de ser aceito após existir o cadastro de parceiros. Não
criar silenciosamente instituições definitivas com base em qualquer texto.

### D-07 — Realização da viagem

Data final ultrapassada só significa situação temporal encerrada; não comprova
que a viagem ocorreu. Recomendação: o sistema pode abrir uma pendência ou
habilitar a prestação automaticamente, mas a realização precisa de confirmação
explícita e auditada.

### D-08 — Documentos, imagens e arquivos Office

Definir formatos, tamanho, antivírus, visualização, retenção e backup. A antiga
CG-051 previa somente PDF. Recomendação: começar com PDF/JPG/PNG e tratar Office
como download sem renderização, se forem realmente obrigatórios.

### D-09 — Checklist de encerramento

Os itens precisam ser condicionais. Convênio, cotação, diária, passagem e foto
não existirão em toda missão. Definir condições e quem pode justificar uma
dispensa.

### D-10 — Evento reutilizável

O menu proposto trata evento como cadastro independente, mas a missão atual o
trata como atividade. Definir se o mesmo evento poderá reunir várias missões e
redes. Se sim, criar entidade `evento`; se não, manter atividade e evitar uma
rota artificial.

### D-11 — Notificações

Definir canal: apenas caixa de entrada do sistema, e-mail institucional ou
ambos. Recomendação técnica: gravar notificação/outbox durável antes de integrar
um provedor externo.

### D-12 — Identidade e pessoa

O acesso de participante exige vincular o `sub` do Keycloak a `pessoa`, lacuna
já conhecida no projeto. Definir provisionamento e recuperação de vínculo antes
de liberar documentos pessoais a participantes.

### D-13 — Dados pessoais e contatos internacionais

Definir base legal, visibilidade, retenção e auditoria para telefone, e-mail,
documentos financeiros, fotos e comprovantes. Indicadores consolidados não
podem conceder acesso automático aos documentos pessoais de origem.

### D-14 — Moeda estrangeira

Permanece pendente decidir se despesas guardam moeda original, cotação e valor
convertido. Não usar `number` para cálculos monetários em nenhuma alternativa.

## Impacto recomendado no modelo

Os nomes abaixo orientam as tasks. Os três primeiros já foram implementados como
fundações estruturais; os demais continuam propostas ainda não homologadas:

- `missao_rede` — implementado na CG-016;
- `instituicao_rede` — implementado na CG-017;
- `contato_instituicao` — implementado na CG-017;
- `missao_instituicao` ou `relacionamento_missao_parceiro`;
- `evento` — não criado no MVP conforme D-10; permanece atividade da missão;
- `decisao_comite` e vínculo dos documentos analisados;
- evolução segura de `anexo` para documento versionado;
- `prestacao_contas_missao`, `despesa_missao` e `cotacao_passagem`;
- `produto_missao` e `convenio`;
- `evidencia_missao` ou categorização documental equivalente;
- checklist calculado a partir das entidades, não uma coleção de booleanos
  duplicando estado.

## Ordem de retomada

1. CG-005 a CG-009 — homologar escopo e regras.
2. CG-016 a CG-019 — evoluir o modelo central.
3. CG-025 a CG-029 — parceiros, contatos e escopo por rede na API.
4. CG-014/CG-051 — fundação documental, antes da submissão se a homologação
   exigir documentos prévios.
5. CG-037 a CG-039 — submissão e decisão do Comitê.
6. CG-047, depois CG-045 e CG-048/CG-049 — fila, detalhe, análise e parceiros
   na interface.
7. CG-013, CG-050 e CG-052 a CG-055 — prestação e documentos financeiros.
8. CG-056 a CG-058, depois CG-046 e CG-059 — produtos, convênios,
   evidências, encerramento e interface do relato final.
9. CG-066 a CG-069 — dashboards, relatórios e exportações.
10. CG-060 a CG-065 — qualidade transversal e documentação final.

## Regra para atualizar o backlog

Não desmarcar como “não feita” uma task entregue corretamente segundo a regra
anterior. Criar task de evolução e apontar a task impactada. Assim o backlog
preserva o que foi desenvolvido e explica por que uma segunda alteração passou
a ser necessária.
