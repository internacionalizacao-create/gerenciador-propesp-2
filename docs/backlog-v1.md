# Backlog executável da V1 interna

Criado em 2026-09-15 a partir do [diagnóstico](diagnostico-v1-2026-09-15.md) e da
[proposta de autorização](proposta-autorizacao-v1.md). São **47 tarefas** para
execução sob demanda. Nenhuma tarefa de implementação está concluída por efeito
da criação deste documento. Não substituir os históricos CG/BOL nem reabrir suas
decisões silenciosamente.

## Direção desta versão

**Definido pelo responsável:** implantação interna na instituição; bolsistas e
usuários externos não acessam nesta fase; foco em admin e responsáveis por
temática/PPG. Autorização será preparada com o modelo existente e uma proposta
técnica inicial, sem aguardar uma resposta geral da PROPESP.

**Decisão do responsável em 2026-09-16:** em produção o Keycloak **só
autentica** — nenhum papel de negócio criado ou atribuído lá. A base sobe com o
consolidado (catálogo, PPGs, programa, ciclo, redes) e sem conta alguma; o
primeiro administrador vem do comando de bootstrap e os demais são cadastrados
pela tela de administração. Não há conversão de acesso legado a fazer.

**Modelo aprovado pelo responsável em 2026-09-15:** concessões individuais de
permissão + escopo, administradas na aplicação; Keycloak autentica e perfis são
modelos opcionais. Substitui a proposta anterior de perfil–escopo condicionado
a papel do Keycloak. Máscaras de campos, projeção do orçamento e detalhes dos
modelos ainda serão especificados nas tarefas. Rede
interna não elimina login, HTTPS ou recorte de dados.

**Fora da V1 interna:** autosserviço de bolsista/participante, acesso externo e
execução financeira da UEA para pagamentos diretos da CAPES. O último é exclusão
de domínio; não deve virar tarefa de implementação CAPES Global.

## Como executar com LLM

1. Selecionar um ID e ler sua ficha e dependências. Não iniciar todo o backlog.
2. Ler AGENTS aplicáveis e os arquivos indicados; confirmar o estado atual do
   código. As referências são ponto de partida, não limite de investigação.
3. Preservar alterações locais e registrar a decisão usada. Pedido explícito
   para implementar uma tarefa com a recomendação documentada autoriza essa
   escolha; não pedir a mesma confirmação novamente. Uma resposta institucional
   ausente não pode ser inventada nem marcada como aprovada.
4. Realizar API, interface, migração e testes que a ficha exigir. Se o recorte
   precisar ser dividido, registrar subtarefas e deixar o pai em andamento.
5. Rodar as verificações adequadas; relatar bloqueios ambientais separadamente
   de falhas de negócio. Não declarar homologação com base só em testes de fonte.
6. Atualizar ficha/índice com resultado, evidência, riscos e documentos afetados.
   Só concluir quando todos os critérios de aceite forem satisfeitos.

Estados: `Pendente`, `Em andamento`, `Bloqueada (motivo explícito)`, `Concluída`,
`Adiada por decisão`. Estado dos IDs: **Pendente**, exceto V1-001, **Em andamento** pelo
registro da decisão de autorização, V1-010, **Concluída como contrato
preparatório** (2026-09-15), e V1-011, **Concluída** (2026-09-15) com a tabela
`concessao_acesso` criada, **V1-012 e V1-017 concluídas** em 2026-09-16 — a
autorização em execução passou a ser a das concessões, e o papel do Keycloak não
concede mais nada —, **V1-018 e V1-019 concluídas** em 2026-09-17 — a tela de
administração de acessos e a navegação por acesso efetivo —, e V1-021, **Em andamento**, com o bootstrap entregue; a
conversão do legado foi cancelada porque a produção começa sem conta nenhuma. Os demais critérios do contrato seguem abertos;
a autorização em execução já usa as concessões; faltam os recortes por ação
(V1-013–016) e a regressão (V1-020) — a tela (V1-018) e a navegação (V1-019)
foram concluídas em 2026-09-17. Evidências na ficha. Dependência
pendente significa ordem de execução; não é prova de impedimento externo.

Prioridades: **P0** necessária para liberação ampla interna; **P1** entregar ou
excluir expressamente da V1; **P2** evolução opcional. Selecionar uma P2 não
promove automaticamente todas as outras para o escopo da V1.

Regras comuns de aceite: autorização na API e no SQL; Server Actions/BFF do
projeto; RHF + Zod em formulários novos/alterados; tokens semânticos e textos
acentuados; dinheiro exato e nulo distinto de zero; nenhuma alteração destrutiva
de dados reais como preparação de testes. Não reimportar realm com `--force`
para adicionar papel em ambiente já usado. Mudança de schema atualiza migrations,
seed e classificação dos scripts de banco. Testes de integração só no banco
dedicado com trava de segurança.

Modelo de solicitação:

> Implemente V1-013 seguindo docs/backlog-v1.md e sua ficha. Use as decisões
> registradas em docs/proposta-autorizacao-v1.md. Confira as dependências e o
> estado atual antes de editar, execute os testes pertinentes e atualize a ficha
> com os resultados. Não execute tarefas seguintes automaticamente.

Registro ao concluir cada ficha:

```text
Estado / data:
Decisão de produto aplicada:
Arquivos e migrations alterados:
Verificações executadas e resultados:
Critérios de aceite satisfeitos:
Limitações e tarefas ainda necessárias:
Commit ou referência revisável, se houver:
```

## Índice e dependências

As fichas dos quatro grupos abaixo fazem parte deste backlog. IDs na coluna de
dependências são obrigatórios, exceto quando a ficha indicar uma condição.

| ID | Prioridade | Entrega | Depende de |
|---|---|---|---|
| V1-001 | P0 | Contrato da V1 e decisões iniciais | — |
| V1-002 | P1 | Reconciliação da documentação e vocabulário | 001 |
| V1-010 | P0 | Catálogo de permissões e modelos opcionais — concluído (preparatório) | 001 (autorização decidida) |
| V1-011 | P0 | Schema de concessões por permissão/escopo/ciclo — concluído (tabela inerte) | 010 |
| V1-012 | P0 | Resolução central de acesso por ação — concluída | 011 |
| V1-013 | P0 | Recorte de leitura de planejamento e indicadores | 012 |
| V1-014 | P0 | Recorte de escrita e referências de formulários | 012 |
| V1-015 | P0 | Bolsas, produção e campos pessoais | 012 |
| V1-016 | P0 | Históricos, documentos e exportações | 013, 015 |
| V1-017 | P0 | API administrativa das concessões — concluída | 012 |
| V1-018 | P0 | Interface de atribuição e revisão de acesso — concluída | 017 |
| V1-019 | P0 | Navegação e orientação por acesso efetivo — concluída | 013, 015, 017 (entregue antes de 013/015: não dependia delas) |
| V1-020 | P0 | Regressão da matriz de autorização | 013–019 |
| V1-021 | P0 | Atribuição nominal e ativação restritiva — em andamento (subtarefas a–e; b entregue) | 018–020 |
| V1-030 | P0 | Ciclo de vida completo da missão na web | 001 |
| V1-031 | P0 | Produtos de missão na web | 001 |
| V1-032 | P1 | Gestão de convênios na web | 016 |
| V1-033 | P1 | Tratamento de pendências | 012 |
| V1-034 | P1 | Gestão de participações PPG–temática | 011 |
| V1-035 | P1 | Contrato dos eventos externos CAPES | 001 |
| V1-036 | P1 | API e histórico de eventos externos | 014, 035 |
| V1-037 | P1 | Interface dos eventos externos | 036 |
| V1-038 | P1 | Completar e conferir dados institucionais | 034 |
| V1-039 | P1 | Política e procedimentos de retenção | 001 |
| V1-040 | P1 | Homologar relatórios prioritários | 016 |
| V1-041 | P1 | Qualidade e reconciliação de destinos | 015 |
| V1-042 | P1 | Paginação de parceiros | 016 |
| V1-050 | P0 | Plano de implantação interna | 001 |
| V1-051 | P0 | Ambiente de produção na intranet | 050, 052 |
| V1-052 | P0 | Build reproduzível e fontes | — |
| V1-053 | P0 | Backup completo e agendado | 050 |
| V1-054 | P0 | Ensaio de recuperação e atualização | 051, 053 |
| V1-055 | P1 | Logs, prontidão e alertas operacionais | 051 |
| V1-056 | P1 | Limites de requisições e operações caras | 050 |
| V1-057 | P1 | Auditoria transversal | 012 |
| V1-058 | P0 | Integração no CI e runtime alinhado | 052 |
| V1-059 | P0 | Jornadas automatizadas no navegador | 020, 030, 031, 058 |
| V1-060 | P0 | Homologação e aceite da versão interna | Ver ficha |
| V1-070 | P2 | E-mail institucional | 050 |
| V1-071 | P2 | Inspeção antimalware de anexos | 039, 050 |
| V1-072 | P2 | Home por responsabilidade | 019, 020 |
| V1-073 | P2 | Importação por programa | 014, 041 |
| V1-074 | P2 | Administração de programas/ciclos/redes | 034 |
| V1-075 | P2 | Central de relatórios | 040 |
| V1-076 | P2 | Central de documentos | 016, 039 |
| V1-077 | P2 | Acesso futuro de participante/bolsista | Decisão futura |
| V1-078 | P2 | Revisão de linhas pelo responsável | 014, 057 |

Fichas: [autorização](backlog-v1/01-autorizacao.md),
[fluxos e dados](backlog-v1/02-fluxos-e-dados.md),
[operação e qualidade](backlog-v1/03-operacao-e-qualidade.md),
[evoluções](backlog-v1/04-evolucoes.md).

## V1-001 — Registrar contrato e escolhas iniciais

- **Estado / data:** Em andamento — 2026-09-15.
- **Decisão registrada:** responsável aprovou nesta conversa o modelo individual
  permissão + escopo, com modelos opcionais, configuração revisável pelo admin,
  negação por ausência de concessão, auditoria e revogação na requisição seguinte.
  A proposta de autorização e as fichas foram ajustadas documentalmente; nenhuma
  permissão em execução foi alterada. Não representa homologação institucional.
- **Ainda necessário:** selecionar/adiar P1, detalhar projeções de orçamento/dados
  pessoais e registrar responsáveis por dados/infraestrutura. Não concluir a
  tarefa só pela aprovação do modelo.

- **Objetivo:** fixar o que será considerado V1 concluída e as decisões A01–A07
  da proposta, sem aguardar o questionário inteiro nem presumir aceite da PROPESP.
- **Referências:** proposta de autorização, diagnóstico, `system-structl.md`,
  homologações CG/BOL e mensagem do responsável sobre uso interno.
- **Passos:** registrar recomendação adotada ou alternativa para cada A01–A07;
  indicar quais P1 entram e quais ficam adiadas com motivo; registrar donos dos
  dados institucionais e da infraestrutura quando conhecidos; deixar desconhecidos
  explícitos, com tarefa correspondente. Vincular cada escolha à sua origem/data.
- **Aceite:** público sem bolsistas/externos definido; política de múltiplos
  papéis, teto compartilhado e dados pessoais sem ambiguidades; escopo de V1
  rastreável por IDs. Decisão técnica do responsável não rotulada como decisão
  institucional. Nenhum acesso real alterado nesta tarefa documental.
- **Verificação:** revisão cruzada de todas as P0/P1, sem IDs órfãos ou escolhas
  incompatíveis com decisões preservadas. Sem teste automatizado novo.

## V1-002 — Reconciliar documentação e vocabulário

- **Objetivo:** eliminar pendências fictícias e descrições contraditórias sem
  apagar o histórico de CG/BOL.
- **Referências:** `AGENTS.md` §1/§6/§9, `docs/arquitetura-sistema.md`,
  `docs/autenticacao.md`, `system-structl.md` §11, `docs/validacao-telas.md`,
  questionário e BOL-002 em `docs/revisao-escopo-bolsistas-2026-09-09.md`.
- **Passos:** conferir cada afirmação com rotas/serviços; distinguir API, tela,
  dado preenchido e homologação; mapear oito módulos BOL às páginas existentes;
  resolver o rótulo `SELECIONADO` conforme decisão registrada, sem mudar enum ou
  transição por mera troca de texto; referenciar este backlog como fila atual.
- **Aceite:** documentos não dizem que mapa, produção, usuário local ou upload
  não existem; “Comitê completo” explicita limitações da interface; não marcar
  validação de tela sem execução; contagens históricas mantêm data e contexto.
- **Verificação:** links locais válidos e busca por afirmações antigas; se mudar
  rótulo, executar regressões afetadas. Não reescrever funcionalidades.

## Cobertura do diagnóstico

| Pendência original | IDs responsáveis |
|---|---|
| Autorização, perfis e gestão de acesso | 001, 010–021 |
| Missões/produtos sem operação completa na tela | 030–031 |
| Convênios e pendências por API | 032–033 |
| Base estrutural e dados institucionais | 034, 038, 074 |
| Eventos externos CAPES | 035–037 |
| Retenção, dados pessoais, antivírus | 015–016, 039, 071 |
| Relatórios e exportações | 016, 040, 075 |
| Destinos e paginação | 041–042 |
| Produção, fontes, backup e recuperação | 050–054 |
| Observabilidade, limites e auditoria | 055–057 |
| CI, navegador e aceite | 058–060 |
| Documentação/vocabulário | 002 |
| SMTP, home, importação, documentos e acesso futuro | 070, 072–073, 076–077 |

Ordem sugerida: 001 → 010 → 011 → 012 → recortes 013–017 → 018–021.
Depois, fechar as operações da V1 e executar o aceite. Preparação de build e
infraestrutura pode avançar independentemente quando houver informação suficiente.
Isso descreve dependências de trabalho, não uma instrução de delegação automática.
