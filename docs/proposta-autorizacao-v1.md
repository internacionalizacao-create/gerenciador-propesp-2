# Autorização da V1 interna — modelo aprovado pelo responsável

Data: 2026-09-15. Estado: **modelo de autorização aprovado pelo responsável pelo
projeto nesta conversa**, após a proposta de concessões individuais de permissão
+ escopo e sua confirmação de acordo com o novo modelo. Isso não equivale
a homologação institucional nem altera permissões em execução. Implementação em
[backlog-v1.md](backlog-v1.md), V1-010 a V1-021: V1-010 tem contrato preparatório entregue; implementação
operacional de V1-011 a V1-021 permanece pendente. Detalhamento e inventário em
[contrato-autorizacao-v1.md](contrato-autorizacao-v1.md).

## Público e responsabilidade

- Uso interno na instituição, com login e autorização na API.
- Bolsistas/discentes, parceiros externos e participantes em autosserviço não
  acessam nesta fase; seus registros continuam no domínio. Um servidor também
  discente pode receber acesso nominal para seu trabalho interno.
- Administradores e responsáveis por PPG/temática são o público principal.
- O administrador decide e responde pela atribuição dos acessos, com histórico
  de autor, data e justificativa. Isso não transfere responsabilidade jurídica
  exclusiva nem dispensa o sistema de aplicar corretamente as restrições.

## Decisão adotada: concessão individual de permissão + escopo

A aplicação será a fonte de autorização de negócio. O Keycloak continua
responsável pela autenticação; seus papéis não serão o teto das permissões de
negócio nem concederão acesso automaticamente após a transição.

Cada concessão associa **usuário + permissão + escopo**. O administrador escolhe
as ações e os registros alcançados, podendo alterar ou revogar a qualquer momento.
Perfis tornam-se **modelos opcionais de preenchimento**, sem limitar a configuração.
Aplicar um modelo gera concessões explícitas revisáveis; editar o modelo depois
não altera automaticamente os usuários que já o utilizaram.

Regras aprovadas:

1. Sem concessão válida, sem acesso. Conta inativa é recusada antes de qualquer
   atalho administrativo; conta pendente recebe orientação e opção de saída.
2. Concessões são cumulativas; não há regras de negação nesta primeira versão.
3. O alcance é calculado por ação: unir apenas concessões daquela permissão.
   Dentro de uma participação ou PPG+ciclo, todos os critérios devem coincidir.
4. Permissões de consulta, criação, edição, cancelamento, aprovação, exportação
   e dados pessoais são separadas quando representam responsabilidades distintas.
5. A API aplica o recorte no SQL antes de somas, contagens e paginação; interface,
   arquivos, buscas e downloads respeitam a mesma autorização.
6. Revogação local vale na requisição seguinte, sem depender de renovação de JWT
   e sem cache global de usuário. Outra concessão válida pode manter acesso;
   sua origem deve aparecer na prévia e na explicação do acesso efetivo.
7. Administrar acessos é privilégio protegido próprio. Ninguém pode aumentar o
   próprio acesso sem autorização específica. Definir bootstrap, recuperação e
   limites desse privilégio em V1-010/017; nunca concedê-lo por autoedição comum.
8. Permissão não dispensa regra de negócio: estado do registro, documentação,
   integridade, auditoria e transições continuam obrigatórios.

O catálogo de ações e os tipos de escopo continuam definidos pelo sistema.
Flexibilidade não significa permitir SQL, condições arbitrárias ou nomes de
permissão sem implementação. A matriz deve informar quais escopos são válidos
para cada ação, inclusive operações que são necessariamente institucionais.

## Alcances

| Escopo | Registros alcançados |
|---|---|
| `GLOBAL` | Todos os registros, somente para a permissão concedida |
| Ciclo | Registros do ciclo, para ações compatíveis |
| `PPG` + `cicloId` | Dados do PPG naquele ciclo |
| `PARTICIPACAO` | Interseção exata PPG–temática pelo ID de `participacao_ppg` |
| `TEMATICA` | Registros de todos os PPGs daquela temática |
| `REDE` | Registros da rede no ciclo |

Rede e temática pertencem a um ciclo; participação o herda pela temática.
PPG é cadastro global e exige ciclo explícito para concessões do planejamento.
Concessões legadas sem ciclo exigem inventário e conversão explícita; não recebem
GLOBAL ou novos ciclos automaticamente.

Exemplo: Ana recebe consulta de planejamento na rede B, criação de linhas no
PPG A/ciclo 2027–2030 e escrita de bolsas na participação A/T1. Consultar B não
permite criar linhas em B; escrever em A/T1 não permite escrever em A/T2 ou B/T1.
Uma concessão GLOBAL de consulta não amplia nenhuma concessão de escrita.

## Modelos opcionais e políticas iniciais

Modelos sugeridos: Administrador PROPESP, Apoio administrativo, Responsável de
PPG, Responsável temático, Gestor da Rede, Comitê Gestor e Consulta interna.
Não é necessário criar um papel Keycloak por modelo, PPG ou temática.

Para os modelos iniciais, preservar as escolhas anteriores: edição de linhas,
orçamento e validação de prestação no modelo administrativo; secretaria instrui
bolsas/produtos/documentos; responsável cria linhas e gere bolsas no seu alcance;
gestor opera missões; comitê decide sobre missões. **Esses são padrões dos modelos,
não proibições por cargo**: uma atribuição individual explícita pode conceder
outra ação, sem contornar suas regras de negócio.

Sugestões por `participacao_ppg.coordenador_tematica_id` exigem confirmação do
admin. Alterar o responsável no cadastro não transfere acesso silenciosamente.
O vínculo ativo de equipe das missões deve ter sua compatibilidade tratada na
migração: não produzir acesso implícito permanente fora do novo modelo. Inventariar
as origens existentes e convertê-las em concessões explícitas revisadas, preservando
os alcances aprovados. Após a transição, mudança de equipe sugere revisão e não
concede acesso sozinha. Essa concretização mantém a regra aprovada de que a
aplicação explica e administra todas as concessões efetivas.

## Orçamento e dados pessoais

O teto é da temática/exercício, não de cada PPG. A proposta inicial de projeção
continua sendo: recorte parcial vê seus custos e quantidades; teto/saldo só são
expostos quando há cobertura autorizada da temática inteira. Uma eventual
permissão específica de consolidado compartilhado precisa ter projeção e alcance
próprios, sem revelar linhas ocultas. Não calcular saldo fictício do PPG nem
vazar valores por gráficos, totais, alertas ou denominadores. Indisponível é
`null`, não zero.

CPF completo, contatos pessoais, documentos `PESSOAL` e documentos `RESTRITA`
precisam de capacidades específicas e alcance sobre o alvo. Os modelos iniciais
reservam CPF completo/documentos pessoais a admin e secretaria; atribuições
individuais poderão ser personalizadas. `PESSOAL` e `RESTRITA` não são equivalentes.
A matriz de campos e os padrões de máscara ainda devem ser detalhados em V1-010/015.
Nunca salvar máscara como CPF nem devolver CPF completo em busca de duplicidade
para quem não pode consultá-lo.

Parceiros permanecem catálogo institucional compartilhado para quem tem a
permissão; seus históricos, contagens, produtos e PDFs aplicam o recorte das
bolsas/missões. Autor de upload não supera o alcance do alvo. Dados sem temática
identificável não entram por aproximação em participação/temática; PPG+ciclo pode
alcançá-los quando ambos forem conhecidos. Correção exige concessão apropriada.

## Fluxo administrativo e consulta

```mermaid
flowchart TD
    A[Admin autorizado seleciona usuário] --> B[Modelo opcional ou acesso vazio]
    B --> C[Seleciona ações e alcance de cada concessão]
    C --> D[Confere prévia do acesso efetivo]
    D --> E[Salva com autor, data e justificativa]
    E --> F[API verifica conta ativa e concessões por ação]
    F --> G[Aplica escopo e regras de negócio]
    G --> H[Retorna campos e documentos autorizados]
    E --> I[Admin revisa ou revoga]
    I --> D
```

Criar identidade no Keycloak e atribuir autorização local são operações distintas.
A tela de acesso não promete criar credenciais se essa integração não estiver
implementada; a V1 pode manter o provisionamento de identidade no console.

## Transição e decisões ainda necessárias

1. V1-001 registra o contrato e quais P1 entram; a aprovação deste modelo resolve
   a direção de autorização, não encerra o contrato inteiro.
2. V1-010 detalha ações, escopos compatíveis, modelos iniciais e proteção da
   administração de acesso. V1-011/012 implementam concessões e resolução central.
3. Inventariar papéis, escopos e origens de equipe legados; produzir prévia de
   conversão nominal sem multiplicar todas as permissões por todos os escopos.
   Após o corte, papel do token sozinho não concede domínio.
4. V1-013 a V1-020 cobrem leituras/escritas, campos, arquivos, administração,
   orientação e testes com personalizações fora dos modelos.
5. V1-021 confere contas nominais, recuperação e ativa a política restritiva.
   Não implantar ou alterar contas reais pelo simples registro desta decisão.

A proposta anterior de concessão por **perfil + escopo**, condicionada a papel
ativo no Keycloak, foi substituída pela decisão desta conversa. As antigas A01–A07
passam a ter este tratamento:

| ID | Situação após a decisão |
|---|---|
| A01 | Participação é padrão sugerido do modelo temático; admin pode escolher outro alcance compatível |
| A02 | Perfis são modelos opcionais; novo papel `responsavel-tematica` não é requisito |
| A03 | Adotada concessão individual permissão + escopo; PPG do planejamento exige ciclo |
| A04 | Edição/orçamento são permissões concedíveis; padrão administrativo, com regras de negócio preservadas |
| A05 | Projeção de teto/saldo continua recomendação a detalhar, sem saldo fictício por PPG |
| A06 | Dados pessoais têm capacidades específicas; padrões/máscaras a detalhar, sem exclusividade rígida por papel |
| A07 | Secretaria global é sugestão de modelo; cada permissão pode ter alcance personalizado |

As definições operacionais restantes pertencem às tarefas; não significam
necessidade de pedir novamente aprovação do modelo já escolhido.
