# Fichas de operação e qualidade — V1-050 a V1-060

Estado inicial: **Pendente**. Seguir o [índice](../backlog-v1.md). Preparar arquivos
e ensaios é diferente de implantar na rede institucional. Usar dados fictícios
nas verificações e registrar qual ambiente foi efetivamente validado.

## V1-050 — Definir implantação interna e responsabilidades

- **Prioridade/dependência:** P0; V1-001.
- **Objetivo:** ter um desenho operacional concreto para a intranet.
- **Referências:** `infra/docker-compose.yml`, `spec.server.md`, env examples,
  arquitetura BFF, scripts de banco e compartilhamento ngrok.
- **Passos:** levantar servidor/VM, DNS interno, certificado confiável pelos
  navegadores, conectividade, armazenamento, acesso administrativo e responsáveis.
  Definir URLs estáveis de web/issuer, caminho BFF→API, portas privadas, persistência,
  publicação/migrations, logs, janela de manutenção, recuperação e suporte.
  Declarar necessidade de rede para instalação/build separada do acesso em runtime.
- **Aceite:** diagrama/configuração planejada, inventário de segredos sem valores,
  volumes, portas, donos e checklist de implantação; nenhuma dependência de ngrok;
  informação desconhecida identificada por responsável/impacto, sem inventar DNS.
- **Verificação:** leitura cruzada dos envs/turbo e resolução do fluxo de login
  para um navegador da rede; decisão de hospedagem registrada antes de V1-051.

## V1-051 — Implantação de produção na intranet

- **Prioridade/dependência:** P0; V1-050 e V1-052.
- **Objetivo:** empacotar e ensaiar execução persistente de web/API/SSO/bancos.
- **Arquivos:** infraestrutura, Dockerfiles ou serviço escolhido em V1-050,
  proxy reverso, env examples, scripts de deploy e documentação de operação.
- **Implementação:** builds de produção, Keycloak `start`, HTTPS/URLs/cookies,
  segredos externos ao código, diretório de anexos persistente com permissões,
  bancos/API sem exposição a estações usuárias, reinício e shutdown adequados.
  Aplicar migrations uma vez por atualização. Preparar provisionamento de contas
  reais e exclusão das credenciais de demonstração do ambiente, sem apagar realm.
  Não habilitar CORS nem expor tokens para viabilizar acesso na intranet.
- **Aceite:** login/logout/renovação pelo hostname interno; anexos sobrevivem a
  reinício/substituição do processo; health funciona; atualização tem versão
  identificável e rollback; acesso direto a bancos/API não é necessário ao browser.
- **Testes:** ensaio de instalação limpa, atualização e reinício em homologação;
  smoke com hostname/certificado e contas internas de teste.

## V1-052 — Build reproduzível e fontes disponíveis

- **Prioridade/dependência:** P0; independente.
- **Objetivo:** resolver a dependência de download de Geist no build observada
  no diagnóstico e reproduzir o build com o runtime declarado.
- **Arquivos:** `.nvmrc`, package/lockfiles, layout raiz/fontes, turbo/env e CI.
- **Implementação:** escolher fontes locais licenciadas/versionadas ou uma
  política explícita de acesso no ambiente de build; preferir resultado que não
  dependa de Google Fonts para servir a aplicação interna. Conferir Node/pnpm
  usados, documentar instalação e preservar tipografia/tokens. Não trocar a stack.
- **Aceite:** build limpo sem cache funciona no ambiente documentado; runtime
  não baixa fontes de terceiros; `.nvmrc`, CI e operação concordam; nenhuma
  variável BFF necessária é removida pelo modo strict do Turbo.
- **Testes:** lint e build sem cache, conferência visual da tipografia e inspeção
  de requisições de fonte; distinguir download de dependências do build do código.

## V1-053 — Backup completo e agendado

- **Prioridade/dependência:** P0; V1-050.
- **Objetivo:** proteger domínio, anexos, identidades e configuração necessária
  para recuperação, evoluindo os scripts existentes.
- **Arquivos:** `scripts/db-backup.sh`, `db-comum.sh`, inventário/restauração,
  armazenamento de anexos, infraestrutura e runbook.
- **Implementação:** incluir banco Keycloak, manifestos/checksums, versão de
  schema/aplicação e estratégia segura de recuperação de segredos. Fixar um ponto
  consistente entre dump/inventário/anexos (janela ou mecanismo documentado),
  retenção, agendamento, destino externo e acesso restrito. Falha gera resultado
  não zero e alerta sem imprimir credenciais. Não tratar export do realm como
  substituto do banco real de identidades.
- **Aceite:** pacote restaurável completo, cópia fora do host, capacidade e
  retenção definidas; backup parcial não aparece como sucesso; documentação não
  promete consistência de três cópias feitas em momentos arbitrários com escrita.
- **Testes:** dados sintéticos com anexo/versionamento, falha em cada etapa,
  checksums e agendamento ensaiado; restauração completa em V1-054.

## V1-054 — Ensaio de recuperação, atualização e rollback

- **Prioridade/dependência:** P0; V1-051 e V1-053.
- **Objetivo:** demonstrar recuperação real, não apenas existência de dumps.
- **Arquivos:** scripts de restauração, configuração de produção e runbook;
  ambiente isolado com volumes/bancos distintos.
- **Passos:** restaurar domínio, anexos e Keycloak; reconstruir configurações;
  conferir schema, inventário, usuários, papéis e escopos; testar download e
  login. Ensaiar atualização com migration e retorno compatível, distinguindo
  rollback de código de reversão de schema; registrar tempo e perda potencial.
- **Aceite:** procedimento executado do início ao fim por instruções reproduzíveis;
  metas escolhidas de tempo/perda atendidas ou lacuna registrada; restauração não
  aponta para produção; anexos referenciados existem e restrições continuam valendo.
- **Testes:** smoke após restauração e atualização, amostras de hashes e matriz
  mínima de acesso. Não restaurar sobre o banco em uso como forma de teste.

## V1-055 — Observabilidade, prontidão e suporte

- **Prioridade/dependência:** P1; V1-051.
- **Objetivo:** detectar indisponibilidade e diagnosticar erros sem expor dados.
- **Arquivos:** `main.ts`, health controller, filtros/logs da API, BFF, deploy.
- **Implementação:** separar liveness de prontidão das dependências indispensáveis;
  correlação de requisições, logs estruturados com política de mascaramento,
  retenção/rotação e alertas de erro/espaço/backup. Prontidão não expõe URL de
  banco, tokens ou detalhes internos ao usuário. Definir quem recebe e atende.
- **Aceite:** banco/anexos indisponíveis produzem diagnóstico útil; login/token/CPF
  e conteúdo de documentos não aparecem em log; alertas são verificáveis e
  desligamento/reinício não apagam evidência operacional essencial.
- **Testes:** falhas induzidas em homologação, propagação de correlação, verificação
  de sanitização e alerta de backup; sem monitoramento que envie dados a terceiros
  por padrão.

## V1-056 — Limitar requisições e operações caras

- **Prioridade/dependência:** P1; V1-050.
- **Objetivo:** conter abuso/erros de clientes sem bloquear toda a instituição
  porque o BFF ou um NAT concentra o endereço de origem.
- **Arquivos:** `main.ts`, guards/middleware, BFF, endpoints de upload/exportação,
  proxy institucional; envs/turbo quando necessário.
- **Implementação:** limites por usuário/autenticação e limites adequados nas
  bordas públicas; política específica para upload/dossiê/exportação; tamanho,
  concorrência e timeout. Configurar confiança no proxy conhecido, sem confiar
  em cabeçalho arbitrário do cliente; limites compartilhados se houver réplicas.
- **Aceite:** 429/feedback recuperável; duas contas atrás do mesmo BFF não gastam
  uma cota de usuário única; fluxo normal de formulário/upload continua funcionando;
  nenhuma mudança depende de CORS ou expõe API ao navegador.
- **Testes:** excesso controlado, usuários distintos/NAT, IP falsificado, upload
  grande e liberação após janela; registrar limites e justificativa operacional.

## V1-057 — Auditoria dos atos relevantes

- **Prioridade/dependência:** P1; V1-012.
- **Objetivo:** cobrir lacunas de rastreabilidade preservando trilhas existentes.
- **Arquivos:** schema/governança, serviços de plano/orçamento/bolsas/acesso/
  parceiros/documentos, histórico e controles administrativos.
- **Implementação:** inventariar o que já registra autor/data/motivo; definir
  catálogo mínimo para mudanças de acesso, concessões, cancelamentos, vínculos
  e atos administrativos. Reutilizar mecanismo existente quando adequado;
  auditar na transação da mudança, proteger leitura do histórico e evitar cópia
  de CPF, segredo, documento ou conteúdo pessoal desnecessário no evento.
- **Aceite:** ato concluído deixa evento, rollback não produz sucesso fictício;
  antes/depois ou campos alterados suficientes para explicar o ato sem duplicar
  dado sensível; histórico é recortado; logs técnicos não substituem auditoria.
- **Testes:** autoria, atomicidade, recorte, falha e ausência de campos proibidos;
  regressões da auditoria já existente de plano/orçamento.

## V1-058 — Integração no CI e ambiente de testes confiável

- **Prioridade/dependência:** P0; V1-052.
- **Objetivo:** executar regras SQL/migrations no CI e distinguir erro de ambiente.
- **Arquivos:** `.github/workflows/ci.yml`, `jest.integration.mjs`,
  `test/db-teste.ts`, hooks de integração, `.nvmrc` e env examples.
- **Implementação:** Postgres dedicado com healthcheck, migrations e seed de
  teste; manter isolamento/serialização adequados. Validar destino antes de
  truncar; dar erro de conexão claro sem imprimir senha. Corrigir teardown que
  acessa contexto não criado. Instalar utilitários necessários às verificações
  reais de PDF/planilhas ou registrar suites que exijam job próprio.
- **Aceite:** CI executa unitários e integrações em runtime declarado; banco real
  não pode ser alvo; migration/constraint/seed-aceite falham de forma útil;
  indisponibilidade de banco não gera centenas de erros de teardown ocultando causa.
- **Testes:** pipeline com banco limpo; simulação de URL não autorizada e banco
  indisponível; evidência de execução, sem depender de cache antigo.

## V1-059 — Jornadas no navegador por perfil

- **Prioridade/dependência:** P0; V1-020, V1-030, V1-031 e V1-058.
- **Objetivo:** verificar interações reais além de HTML e inspeção estática.
- **Arquivos:** suites web, scripts smoke, configuração de runner de navegador,
  fixtures e CI/homologação. Escolher runner na tarefa e justificar integração.
- **Implementação:** login real com perfis fictícios; concessão/produto/documento;
  missão com ajuste/aprovação/confirmação/prestação/encerramento; gestão de acesso;
  upload/download/exportação; erro de formulário sem perda de dados; sessão
  expirada. Incluir operações P1 incorporadas à V1. Sem mock que contorne guards.
- **Aceite:** teclado/foco de sidesheet funcionam; controles respeitam perfil;
  backend rejeita requests adulterados; testes isolados não dependem da ordem
  nem de nomes/UUIDs da base institucional; artefatos de falha sem dados reais.
- **Testes:** rodar suite no ambiente preparado e CI compatível; cobrir os
  caminhos críticos sem criar testes que apenas repitam nomes de componentes.

## V1-060 — Homologação e aceite da V1 interna

- **Prioridade/dependência:** P0; todas as P0 anteriores concluídas e todas as P1
  explicitamente entregues ou adiadas no contrato V1-001. Em especial V1-021,
  V1-054 e V1-059. Atribuição nominal/ativação exige ambiente e autorização aplicáveis.
- **Objetivo:** vincular uma versão concreta a resultados e aceite revisáveis.
- **Referências:** backlog, `validacao-telas.md`, guia de cadastro, CI, runbooks,
  diagnóstico e homologações anteriores.
- **Passos:** registrar versão/commit, ambiente, perfis, dados e participantes;
  executar lint/build/test/int/smokes pertinentes e jornadas reais; conferir
  números, documentos e restauração. Reconciliar documentação, listar limitações
  aceitas, responsáveis e procedimento de suporte. Fazer verificação de mudanças
  locais para não homologar artefato diferente do que será implantado.
- **Aceite:** equipe percorre fluxos incluídos sem terminal; isolamento por perfil
  demonstrado; evidências da mesma versão publicada; dados pendentes não rotulados
  como defeitos nem como concluídos; nenhum checkbox marcado por suposição.
- **Verificação:** ata/checklist de aceite técnico e, quando houver, institucional,
  identificados separadamente. Build sem cache e restauração efetivamente ensaiados.
