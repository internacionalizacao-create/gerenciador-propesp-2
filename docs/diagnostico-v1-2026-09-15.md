# Diagnóstico para fechamento da V1 — 2026-09-15

Revisão da documentação e do código presente no workspace, incluindo alterações
locais ainda não commitadas. Não altera as decisões homologadas nem implementa
as pendências. As prioridades abaixo são recomendações para decisão.

**Conclusão:** há uma base funcional ampla, mas a V1 ainda precisa fechar fluxos
pela interface, completar autorização por escopo e preparar a operação. Não é
correto tratar todo o escopo original como entregue porque o backlog do Comitê
está marcado como concluído. Também não é correto reimplementar mapa, panorama,
produção ou relatórios que já existem.

## Implementado e conferido no código

| Área | Implementação encontrada | Limite relevante |
|---|---|---|
| Autenticação | Keycloak, BFF, sessão, guards de autenticação e permissões, identidade local | Preparação para produção e escopos ainda incompletos |
| Planejamento | Programas/ciclo, redes/temáticas, orçamento anual, plano, cálculo de custos e saldos, auditoria de alterações de plano/orçamento | Base estrutural depende da seed; leitura e parte da escrita sem recorte local |
| Cadastros | PPGs, modalidades e catálogo de bolsas com criação/edição | Criar PPG não substitui cadastrar sua participação em uma temática |
| Bolsistas | Concessão, edição, produtos, documentos, origem/destino e datas | Dados reais dependem de alimentação; histórico de eventos externos não entregue |
| Mobilidade | Panorama, mapa, exportação de mobilidades e produção consolidada | Qualidade geográfica depende do reconhecimento dos destinos digitados |
| Parceiros | Cadastro, contatos, conciliação, histórico e ficha PDF | Paginação e tratamento dos vínculos legados merecem acabamento |
| Comitê Gestor | Equipes, criação de missão, análise, decisão, relato, despesas/prestação, evidências e checklist de encerramento | Edição, confirmação/cancelamento da missão e cadastro de produtos não estão completos na interface |
| Relatórios | Quatro relatórios do Comitê, CSV/XLSX/PDF, dossiê e exportação de mobilidade | Não há central geral `/relatorios`; falta definir se ela é requisito da V1 |
| Convênios | Modelo, API de cadastro/edição/inativação/reativação e leitura nos históricos | Não há tela própria de gestão |
| Avisos | Caixa de entrada e registro durável de notificações | Sem canal SMTP |
| Recuperação | Scripts de backup/restauração do domínio e anexos | Não equivalem a uma política operacional de backup, inclusive do Keycloak |

Evidências: [rotas da web](../apps/web/src/app/),
[controller de programas e missões](../apps/api/src/dominio/programas.controller.ts),
[mobilidade](../apps/api/src/dominio/mobilidade.controller.ts),
[convênios](../apps/api/src/dominio/convenios.controller.ts) e
[guia de cadastro](guia-cadastro-do-zero.md).

## Pendências recomendadas antes da liberação operacional

| Prioridade | Pendência confirmada | Entrega / critério de aceite |
|---|---|---|
| P0 | **Escopo de leitura e escrita do planejamento incompleto.** Plano, orçamento, redes/temáticas e painel não aplicam o recorte do usuário. Criar/cancelar linha de plano recebe permissão, mas não resolve o escopo local. | Definir quais consolidados são compartilhados; aplicar restrições de leitura e escrita na API; testar acesso direto por ID e agregações entre PPGs/temáticas. |
| P0 | **Conta sem escopo continua permissiva.** `RECORTE_OBRIGATORIO = false`. Os tipos disponíveis são GLOBAL, PPG e REDE; temática não é escopo explícito. | Definir o modelo do Coordenador de Temática, atribuir escopos e então ativar o modo restritivo. Conta sem atribuição deve ter orientação clara e não obter acesso global por ausência de configuração. |
| P0 | **Missão não percorre todo o fluxo pela interface.** Há API para editar, confirmar, cancelar e reabrir execução; as ações correspondentes não estão expostas integralmente na web. O encerramento exige `CONFIRMADA`. | Criar/editar → enviar → ajustar → reenviar → decidir → confirmar → prestar contas → encerrar, sem terminal; incluir cancelamento e reabertura conforme permissão. Reabrir análise já existe e é outro ato. |
| P0 | **Produtos de missão têm leitura e declaração negativa na tela, mas cadastro/edição pela API.** | Registrar produto real e suas associações/evidências pela interface; encerrar missão que gerou produtos sem intervenção técnica. |
| P0 | **Ambiente de produção não está definido no repositório.** Infra usa Keycloak `start-dev`; não há implantação de produção de web/API aqui. | Definir hospedagem, domínio/HTTPS, segredos, contas reais, persistência de anexos, migrations, publicação e retorno à versão anterior. Homologar nesse ambiente. |
| P0 | **Recuperação operacional incompleta.** Scripts existentes cobrem domínio/anexos, mas não uma rotina completa de recuperação de identidades e infraestrutura. | Backup agendado, cópia externa, retenção, responsável e restauração ensaiada de domínio + anexos + banco/configuração do Keycloak. Definir tolerância a perda de dados e tempo de recuperação. |
| P0 | **Homologação ponta a ponta ainda não comprovada para a versão atual.** `validacao-telas.md` mantém itens em aberto; CI só roda lint/build/unitários. | Rodar integração com Postgres, smoke de login/telas e jornadas reais por perfil, incluindo formulários, upload/download, erros e acesso negado. Marcar aceite com evidências da mesma versão que será publicada. |
| P1 | **Administração de acesso depende da API e do console Keycloak.** Não há tela local de escopos. | Tela para vínculo pessoa–usuário e concessão/revogação de escopos; definir se criação de contas/papéis continuará no console. |
| P1 | **Convênios e pendências dependem da API para gestão.** | Entregar gestão de convênios e uma forma acessível de tratar pendências, ou excluir expressamente essas operações do escopo operacional da V1. |
| P1 | **Base estrutural não é administrável integralmente.** Não há criação de programa/ciclo/rede/temática/participação pelo fluxo normal. | Se a V1 atende apenas CAPES Global 2027–2030, aceitar uma carga inicial administrada e documentada; se deve cadastrar novos ciclos/programas, implementar esse fluxo. Garantir inclusão de participação de PPG novo. |
| P1 | **Movimentações externas CAPES não implementadas.** P12 indisponível; histórico de cancelamento/desistência/falecimento/substituição permanece por definir. | Fechar vocabulário, campos, evidências e efeitos nos registros; implementar histórico auditável, limitado à mesma temática. O sistema registra atos externos. |
| P1 | **Auditoria e operação transversais parciais.** Existem trilhas em partes do domínio e eventos no Keycloak, mas não cobertura uniforme. | Definir atos que precisam registrar autor/data/motivo, logs operacionais, alertas, verificação de dependências e proteção contra excesso de requisições. `/health` hoje é apenas liveness. |

P0 indica bloqueador recomendado para liberação a usuários reais; P1 exige
entrega ou exclusão explícita do contrato da V1. Um piloto assistido apenas por
administradores tem exigências operacionais diferentes de uma liberação ampla.

Evidências principais:
[escopo](../apps/api/src/auth/escopo.ts),
[permissões](../apps/api/src/auth/permissions.ts),
[gestão de acesso](../apps/api/src/auth/acesso.controller.ts),
[ações de equipes/missões](../apps/web/src/acoes/comite-gestor.ts),
[detalhe da missão](../apps/web/src/app/(app)/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]/page.tsx),
[infraestrutura](../infra/docker-compose.yml),
[backup](../scripts/db-backup.sh),
[CI](../.github/workflows/ci.yml).

## Decisões e dados institucionais

1. **Público da V1:** somente equipe administrativa ou também coordenadores,
   gestores de rede, docentes, discentes e participantes? Isso define o aceite
   de autorização. O perfil Participante com acesso por missão continua F2.
2. **Recorte do planejamento:** quem pode consultar consolidados e quem pode
   lançar/cancelar linhas de qual PPG/temática? Não restringir automaticamente
   o cadastro institucional de parceiros: o código registra que ele é
   compartilhado, para evitar duplicidades. Separar essa decisão do acesso aos
   históricos e dados associados.
3. **Dados do plano:** valores de manutenção de UFMG/UNICAMP e distribuição por
   PPG/ano; aprovação das quatro Capacitações da UFMG; composição da UNICAMP;
   composições dos exercícios seguintes e beneficiários efetivos. São pendências
   documentadas; não foi feita auditoria dos dados atuais do banco.
4. **Documentos e privacidade:** definir operação de descarte/retenção de dados
   pessoais e contatos e decisão sobre antivírus. Formatos e acesso a documentos
   de bolsistas já foram homologados; não reabrir esses itens como se não
   houvesse política. A retenção mínima de quatro anos dos documentos do Comitê
   também já consta como decidida.
5. **Relatórios:** homologar quais entregas existentes atendem à prestação
   institucional e quais modelos/filtros adicionais são obrigatórios. A ausência
   de `/relatorios` não significa ausência de exportação.
6. **Entrada em produção:** escolher infraestrutura e responsáveis por operação,
   recuperação e suporte. Definir se caixa de entrada basta ou se e-mail é
   condição de lançamento; SMTP ainda depende de informação institucional.

Fontes: [checklist funcional](../system-structl.md#112-confirmações-ainda-pendentes),
[decisões do Comitê](homologacao-comite-gestor.md),
[decisões de bolsistas](homologacao-bolsistas.md) e
[pendências futuras do Comitê](backlog-comite-gestor.md#pendências-para-decisão-futura).

## Acabamento e escopo que pode ser posterior

- Home por perfil, depois de completar o recorte do planejamento.
- Importação com adaptadores por programa (P21), se cadastro manual/carga inicial
  forem suficientes para a V1.
- Central geral de relatórios/documentos, preservando as funcionalidades já
  presentes nos módulos.
- Paginação de parceiros e revisão de listas com volume real.
- Padronização de destinos digitados: há reconhecimento automático de país e
  instituição. Destino não reconhecido entra nas tabelas, mas país sem código
  numérico não colore o mapa; a tela avisa. Definir conferência/reconciliação dos
  dados, especialmente para o histórico por parceiro.
- BOL-002: consolidar o mapeamento dos oito módulos e o vocabulário. O backlog
  mantém a tarefa aberta e `SELECIONADO` ainda aparece como “Selecionado”, embora
  a homologação tenha proposto “Planejada”.
- Testes de interface que preencham formulários e percorram fluxos. As regressões
  atuais incluem lógica e inspeção de fonte; não comprovam sozinhas interação
  completa no navegador.

**Fora do escopo CAPES Global por decisão:** execução financeira da UEA para os
pagamentos feitos diretamente pela CAPES (P11). A prestação das missões do
Comitê tem domínio próprio e já existe. Não confundir as duas coisas.

## Documentação que precisa de reconciliação

- A introdução e o bloco “Não existe ainda” do `AGENTS.md` ainda citam como
  ausentes entregas que o próprio §9 descreve e o código confirma.
- `arquitetura-sistema.md` ainda trata partes do Comitê como bloqueadas e lista
  panorama, mapa e produção como próximos blocos.
- `autenticacao.md` ainda afirma ausência de usuário local, embora
  `usuario_sistema` e `IdentidadeService` existam.
- `system-structl.md` mantém decisões sobre documentos em aberto apesar das
  homologações posteriores.
- “Comitê completo / 69 tasks fechadas” precisa distinguir implementação de API
  de conclusão do trabalho pela interface. O guia de cadastro já documenta as
  operações que exigem terminal.
- As contagens históricas de testes não devem ser usadas como resultado de
  validação da revisão atual.

## Verificações executadas nesta revisão

- Lint da API, sem `--fix`: passou. Lint da web: passou.
- `turbo run test --force`: passou sem cache; API com 69 testes/13 suítes e web
  com 24 arquivos de teste aprovados na saída deste runner.
- Build sem cache: API passou; web falhou ao baixar Geist/Geist Mono do Google
  Fonts neste ambiente. Não certifica o build web atual; decidir disponibilidade
  de rede no build ou fontes locais e repetir a verificação.
- Integração: tentativa sem sucesso na conexão/inicialização do Postgres de
  testes; 29 suítes falharam, com 517 testes falhando e 9 passando. A falha
  comum está na preparação do banco; não são 517 defeitos de negócio confirmados.
  Alguns `afterAll` também acessam contexto inexistente após a falha de setup.
- Smoke de login/telas e homologação no navegador não executados nesta revisão.
- Node disponível: 24.20.0; `.nvmrc` declara 24.13.0. Repetir o aceite no runtime
  declarado para a entrega.

## Ordem sugerida

1. Fixar público, escopo funcional da V1 e matriz de acesso.
2. Completar autorização e atribuição de escopos.
3. Fechar missões/produtos e demais operações obrigatórias pela interface.
4. Completar os dados institucionais e homologar relatórios/documentos.
5. Preparar produção, recuperação e observabilidade.
6. Rodar a validação completa, reconciliar documentação e registrar o aceite.

Critério de conclusão: usuários dos perfis aprovados percorrem todos os fluxos
incluídos sem terminal, veem/alteram apenas o que lhes cabe, os números conferem,
os documentos são recuperáveis e a versão publicada tem aceite reproduzível.
