# Proposta de autorização da V1 interna

Data: 2026-09-15. Estado: **proposta técnica para revisão do responsável pelo
projeto**, sem homologação institucional presumida e sem alteração de permissões
em execução. Implementação organizada em [backlog-v1.md](backlog-v1.md).

## Premissas já estabelecidas

- A primeira versão funcionará na rede interna da instituição.
- Bolsistas/discentes, parceiros externos e participantes em autosserviço não
  terão acesso nesta fase. Seus registros continuam existindo no domínio.
- Administradores e responsáveis por PPG/temática são o público principal.
- O responsável pelo projeto quer preparar uma política inicial sem aguardar o
  retorno do questionário da PROPESP. As sugestões abaixo são base de trabalho;
  não são respostas fictícias da equipe.
- Rede interna define onde o serviço é alcançado. O login e a autorização da API
  continuam definindo quem pode consultar e alterar cada informação.

## Papéis sugeridos

| Nome na interface | Papel técnico | Responsabilidade | Escopo recomendado |
|---|---|---|---|
| Administrador PROPESP | `admin`, existente | Cadastros institucionais, orçamento, correções auditadas, acesso, validação da prestação e suporte | Global; contas nominais, poucas pessoas |
| Apoio administrativo PROPESP | `secretaria`, existente | Instruir concessões, produtos, documentos pessoais e pendências; não conceder acesso nem decidir/validar missões | Global explicitamente atribuído para o planejamento/bolsistas, ou recorte se necessário |
| Responsável de PPG | `coordenador`, existente | Criar linhas, gerir concessões/produtos e acompanhar pendências do PPG | PPG + ciclo; um usuário pode ter vários |
| Responsável por temática/participação | `responsavel-tematica`, novo | Mesmo conjunto operacional do coordenador, restrito às participações atribuídas | Participação PPG–temática como padrão; temática inteira apenas por concessão explícita |
| Gestor da Rede | `gestor-rede`, existente | Ler planejamento da rede; gerir e submeter suas missões e prestações | Rede do ciclo; vínculo ativo da equipe continua válido nas missões |
| Comitê Gestor | `comite-gestor`, existente | Ler e deliberar sobre missões de todas as redes; sem editar propostas ou validar prestação | Missões de todas as redes conforme regra atual; leitura global do planejamento deve ser atribuída explicitamente |
| Consulta interna | `docente`, legado, sem distribuir inicialmente | Se houver necessidade real, acompanhar apenas o recorte atribuído e apontar pendências | Participação/temática; não é perfil automático de todo docente |

Não criar nesta etapa um papel por PPG ou por temática. “PPG A” é dado de escopo,
não um papel do Keycloak. Não criar um novo papel genérico “gestor” que misture
responsável acadêmico, aprovador de missão e administrador.

`discente` não concede acesso ao domínio da V1. A implementação deve retirar o
conjunto atual de leitura desse papel e tratar contas legadas, sem apagar pessoas
ou bolsas. `docente` não vira `responsavel-tematica` automaticamente: revisar
atribuições nominais. Um servidor que também seja discente entra pelo papel de
trabalho autorizado; a existência do papel discente não deve negar outro papel
válido. Conta sem nenhum papel interno admitido não entra no domínio.

## Escopos e seu significado

| Escopo proposto | Registros alcançados | Exemplo |
|---|---|---|
| `GLOBAL` | Todos, apenas para as ações concedidas pelo perfil associado | Secretaria global pode instruir bolsas, mas não alterar orçamento |
| `PPG` + `cicloId` | Dados do PPG naquele ciclo, inclusive suas várias temáticas | Coordenação do PPG A no ciclo 2027–2030 |
| `PARTICIPACAO` | Interseção exata PPG–temática, pelo ID de `participacao_ppg` | PPG A na temática T1; não PPG A em T2 nem PPG B em T1 |
| `TEMATICA` | Todos os PPGs e registros daquela temática | Pessoa formalmente encarregada da temática inteira |
| `REDE` | Temáticas e registros da rede no ciclo | Gestor acompanha sua rede e opera as missões permitidas |

Temática e rede já pertencem a um ciclo; participação o herda pela temática.
PPG é cadastro global, por isso exige ciclo na concessão proposta. Concessões
legadas sem ciclo não podem ser reinterpretadas silenciosamente: a migração
deve produzir relatório e atribuições explícitas para os ciclos existentes.

O vínculo `participacao_ppg.coordenador_tematica_id` serve para **sugerir** as
atribuições iniciais. Admin confere e concede. Alterar esse cadastro não promove
automaticamente alguém nem transfere escopos silenciosamente. A fonte efetiva
de autorização continua sendo uma concessão rastreável. Mudanças posteriores
devem indicar acessos possivelmente desatualizados para revisão.

O vínculo ativo de equipe que já autoriza missões por rede será preservado nesse
domínio. Não transformá-lo em uma concessão genérica de escrita no planejamento.

## Ações por perfil

Todas as células dependem do escopo efetivo e do estado do registro. “Gerir” não
significa ignorar a aprovação, a documentação obrigatória ou a auditoria.

| Ação | Admin | Secretaria | Responsável PPG/temática | Gestor da Rede | Comitê Gestor |
|---|---|---|---|---|---|
| Ler plano e indicadores | Global | Atribuído | Próprio recorte | Sua rede | Atribuído |
| Criar/cancelar linha de plano | Sim | Não | Próprio recorte, regras atuais | Não | Não |
| Editar linha existente | Sim, auditado | Não | Não nesta primeira política | Não | Não |
| Alterar orçamento/catálogo/PPG institucional | Sim | Não | Não | Não | Não |
| Cadastrar/editar concessão e produto de bolsa | Sim | Atribuído | Próprio recorte | Não | Não |
| Ler registros acadêmicos de mobilidade | Global | Atribuído | Próprio recorte | Sua rede, sem documentos pessoais | Atribuído, sem documentos pessoais |
| Tratar pendências | Sim | Atribuído | Próprio recorte | Leitura | Leitura |
| Criar/editar/confirmar/cancelar missão | Sim | Não | Não, salvo outro perfil específico | Própria rede | Não |
| Submeter missão | Sim | Não | Não | Própria rede, como responsável | Não |
| Aprovar/reprovar/devolver missão | Sim | Não | Não | Não | Sim |
| Reabrir análise | Sim | Não | Não | Não | Não |
| Lançar/enviar prestação | Sim | Não | Não | Própria rede | Não |
| Validar/devolver prestação | Sim | Não | Não | Não | Não |
| Gerir parceiro/convênio | Sim | Não | Não | Sim, catálogo compartilhado atual | Leitura |
| Conceder/revogar escopo | Sim | Não | Não | Não | Não |

A manutenção de `plano:edit` exclusivamente no admin preserva a decisão já
registrada. “Gerenciar suas informações” dá ao responsável criação de linhas,
concessões, produtos e pendências; ampliar edição de composição aprovada exige
um fluxo próprio de revisão, listado como evolução, não uma troca silenciosa
de permissão. Cancelamentos preservam as restrições existentes e relações com
concessões; não são uma alternativa para apagar dados aprovados.

## Como evitar ampliação acidental de acesso

**Uma concessão deve associar perfil + escopo**, e não apenas usuário + alvo.
O papel ativo no Keycloak continua sendo o teto de permissões; a concessão local
não substitui nem cria o papel. Proposta: evoluir `escopo_acesso` com perfil e
alvos explícitos, mantendo FKs, validações, autor e revogação.

Autorização para uma ação = união dos escopos dos perfis ativos **que concedem
essa ação**. Avaliar cada concessão inteira: dentro de participação/PPG+ciclo
há interseção; entre concessões elegíveis há união. Não cruzar listas soltas de
PPGs e temáticas, pois isso criaria combinações nunca concedidas.

Exemplo: Ana tem `coordenador` no PPG A e `gestor-rede` na rede B. Ela lê os dois
recortes; cria linha apenas no PPG A; administra missão apenas na rede B.
`permissionsForRoles` pode continuar como catálogo/checagem preliminar; a união
global de permissões não basta para decidir escrita de uma linha.

Segundo exemplo: secretaria GLOBAL + coordenação do PPG A não autoriza criar
linha em qualquer PPG. O GLOBAL só vale para ações do perfil secretaria.
Remover papel no Keycloak torna a concessão local correspondente ineficaz assim
que as novas claims forem observadas; considerar a janela atual do token.
Revogação local deve valer na requisição seguinte, sem cache global de usuário.

Resolver perfis e escopos num componente central da API. Controllers continuam
pedindo permissões. Serviços recebem um recorte por ação/domínio e o aplicam
no SQL. Não espalhar `roles.includes` pelos serviços nem filtros na memória.

Conta local inativa deve ser recusada antes de atalhos globais, inclusive admin.
Conta sem papel/escopo admitido tem apenas o fluxo necessário para identificação,
logout e orientação de acesso pendente; não recebe domínio por ausência de dados.

## Orçamento compartilhado e consolidados

O teto é da temática/exercício, não de cada PPG. Não calcular “saldo do seu PPG”
subtraindo o custo de um PPG do teto da temática inteira.

- Admin e recortes que cobrem a temática inteira podem ver seu teto/saldo.
- Responsável por participação/PPG vê custos, quantidades e situação das próprias
  linhas. Teto/saldo compartilhados ficam indisponíveis com explicação, salvo
  quando o resolver comprovar cobertura de toda a temática.
- Nenhum valor escondido pode aparecer indiretamente em total de rede,
  denominador de percentual, gráfico, contador, exportação ou alerta.
- `null` significa indisponível/a definir; não produzir zero fictício.
- Não ratear teto entre PPGs sem regra de negócio aprovada. Divulgação futura
  de um consolidado institucional comum será uma permissão/projeção específica.

## Dados pessoais, parceiros e anexos

- Documentos de categoria `PESSOAL`: admin e secretaria com alcance da bolsa,
  preservando `documento:read-pessoal`; responsável acadêmico não recebe esse
  acesso por ter criado a concessão. Documentos acadêmicos seguem o alvo.
- Proposta para campos: CPF completo apenas admin/secretaria; responsáveis
  operacionais veem CPF mascarado e contato necessário no próprio recorte;
  leitura de acompanhamento por rede/comitê não inclui CPF completo, telefone
  ou e-mail pessoal. Definir projeções na API, inclusive busca e exportação.
- Formulário de concessão pode receber CPF para identificação sem devolver
  identificadores completos em listas/duplicidades. A edição deve aceitar
  preservar o CPF existente; nunca salvar a máscara como CPF. Testar esse fluxo.
- `RESTRITA` de missão mantém a política já homologada; não equivale a
  `PESSOAL` de bolsista. Autor do upload não deve burlar o escopo do alvo.
- Catálogo institucional de parceiros continua compartilhado para quem tem
  permissão. Seus históricos de bolsas/missões, contagens, produtos, dossiês e
  ficha PDF precisam aplicar o recorte de cada domínio. Ler um parceiro não
  concede acesso a todas as pessoas que já passaram por ele.
- Dados sem classificação suficiente não autorizam por aproximação. Bolsa sem
  temática identificável não entra em escopo de participação/temática; admin
  trata a classificação. Escopo de PPG pode alcançá-la pelo PPG+ciclo quando
  ambos forem conhecidos. Mesma regra em filtros e downloads.

## Transição recomendada

1. Revisar esta proposta com o responsável pelo projeto; registrar alternativas
   escolhidas no backlog, sem atribuir aceite à PROPESP.
2. Preparar schema, resolver, matriz de permissões e migração de concessões em
   desenvolvimento. Preservar identidades e auditar atribuições legadas.
3. Aplicar recortes de leitura/escrita e campos em todos os caminhos; revisar
   missões, referências de formulários, buscas, documentos e exportações.
4. Entregar tela de administração com sugestões por participação e visualização
   das ações efetivas. Nenhuma sugestão se ativa sozinha.
5. Testar com duas temáticas, dois PPGs, redes e ciclos distintos, incluindo
   múltiplos papéis, ausência de escopo e conta inativa.
6. Cadastrar nominalmente os usuários internos, conferir seus acessos e ativar
   modo restritivo. Garantir admin de recuperação ativo. Reverter eventual
   implantação com procedimento controlado; não voltar a “todos veem tudo”.

## Decisões para revisar antes da primeira implementação

| ID | Recomendação proposta | Alternativa que muda a implementação |
|---|---|---|
| A01 | Participação como padrão do responsável temático; PPG/TEMATICA explícitos | Dar toda a temática automaticamente pelo nome do cargo |
| A02 | Manter admin/secretaria/coordenador e adicionar `responsavel-tematica` | Um único perfil operacional com rótulos por concessão |
| A03 | Associar cada concessão ao perfil; ciclo explícito para PPG | Proibir múltiplos perfis para evitar combinação; menos flexível |
| A04 | Edição de linha e orçamento continua administrativa | Criar revisão/aprovação de alterações propostas pelo responsável |
| A05 | Teto/saldo apenas para cobertura completa da temática | Tornar consolidados compartilhados visíveis por permissão própria |
| A06 | CPF completo só admin/secretaria; documentos pessoais idem | CPF completo também para responsável operacional, com permissão específica |
| A07 | Secretaria global explícita no seu domínio | Secretaria limitada a PPG/rede conforme atribuição |

Essas escolhas já têm recomendação suficiente para preparar as tarefas. Só a
tarefa selecionada deve ser implementada sob demanda; não executar a ativação
de contas ou de produção porque este documento existe.
