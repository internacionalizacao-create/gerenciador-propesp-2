# Fichas de operação e qualidade — V1-050 a V1-060

Estado inicial: **Pendente**. Seguir o [índice](../backlog-v1.md). Preparar arquivos
e ensaios é diferente de implantar na rede institucional. Usar dados fictícios
nas verificações e registrar qual ambiente foi efetivamente validado.
Todas as P1 deste grupo foram incluídas na V1 pelo responsável em 2026-09-18.

## V1-050 — Definir implantação interna e responsabilidades

- **Prioridade/dependência:** P0; V1-001.
- **Decisão em 2026-09-18:** preparar execução do sistema em Docker. A escolha
  cobre o empacotamento de web/API/SSO/bancos; host, DNS, certificado e responsável
  de infraestrutura permanecem pendentes para implantação. Documentar as lacunas
  sem impedir a preparação local dos artefatos.
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
- **Decisão em 2026-09-18:** usar Docker para preparar a execução do sistema.
  Preparação e ensaio local não equivalem a publicação ou aceite na intranet.
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

- **Estado / data:** Concluída — 2026-09-19.
- **O diagnóstico estava certo, e a distinção importa:** `next/font/google`
  **serve** as fontes do próprio domínio — o runtime nunca falou com o Google —,
  mas **baixa** os arquivos durante o build. Um build de intranet que depende de
  saída para a internet é um build que quebra no dia em que a saída não existe.
- **Entregue:** o pacote `geist@1.7.2` (Vercel, OFL) traz os `.woff2` em
  `node_modules` e os carrega por `next/font/local`. A fonte passa a vir pelo
  lockfile, como qualquer dependência — e instalar dependências é um passo que o
  ambiente de build já precisa poder fazer, diferente de buscar um arquivo de
  terceiros no meio da compilação. É exatamente a distinção que o aceite da
  ficha pede.
- **Zero impacto na tipografia:** o pacote declara as **mesmas** variáveis
  (`--font-geist-sans`, `--font-geist-mono`) que `globals.css` já consumia, então
  nenhum token mudou. A conferência visual se reduz a isso, e está fixada em
  teste em vez de depender de olhar.
- **Provado nos dois sentidos, com a rede desligada de verdade**
  (`unshare -rn`, com loopback de pé — sem ele a falha é do Turbopack falando
  com os próprios processos, não de rede externa):
  - o código **antigo** falha com
    `There was an issue establishing a connection while requesting
    https://fonts.googleapis.com/css2?family=Geist...`;
  - o código **novo** compila limpo, e a saída não tem uma referência a
    `googleapis` ou `gstatic`. Os dois `.woff2` saem em `.next/static/media/`.
- **Regressão:** [fontes.test.mjs](../../apps/web/test/fontes.test.mjs) barra o
  import de volta — ele reaparece com uma linha e a falha só apareceria num
  servidor sem rede. O caso casa o **import**, não a menção, senão o comentário
  que explica a decisão seria marcado como o defeito. Um segundo caso barra
  `@import` de fonte externa no CSS, que seria pior: faria o **navegador** de
  cada pessoa buscar no Google. **Verificado por mutação.**
- **Turbo em modo estrito conferido, não presumido:** as seis variáveis do BFF
  estão declaradas em `apps/web/turbo.json`, e o build foi executado **com o
  `.env.local` escondido**, passando só o que o CI passa. Sem a lista completa
  ele falharia ali — que é justamente a falha que só reproduz no CI.
- **`.nvmrc` passou de 24.13.0 para 24.20.0**, que é a versão em que tudo isto
  foi verificado. O pin anterior não era executado por ninguém — nem pela
  máquina de desenvolvimento, nem nos registros de V1-011 —, e pin que ninguém
  usa é reprodutibilidade de fachada. O CI lê o arquivo e o pnpm sai de
  `packageManager`, então os três concordam por construção.
- **Arquivos:** `apps/web/package.json` (+`geist`), `pnpm-lock.yaml`,
  `apps/web/src/app/layout.tsx`, `.nvmrc`, `apps/web/test/fontes.test.mjs`
  (novo) e a seção "Build reproduzível" do AGENTS. **A stack não mudou**, como a
  ficha exige.
- **Verificações executadas:** `pnpm lint` limpo (uma sobra de fixture da V1-030
  foi removida no caminho), build sem cache, build offline, build sem
  `.env.local`, e 174 testes da web.
- **Limitações:** a conferência visual da tipografia foi feita pela igualdade
  das variáveis CSS e pelos arquivos emitidos, não por inspeção de tela — as
  fontes são as mesmas famílias, do mesmo fornecedor, em arquivo variável. A
  **inspeção de requisições de fonte no navegador** não foi executada; o que a
  substitui é a ausência de referência a `googleapis`/`gstatic` na saída do
  build, que é onde a requisição nasceria.
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
- **Decisão em 2026-09-18:** executar backup diário durante a madrugada.
  Documentar horário exato e fuso na implementação, além de destino, retenção e
  responsável pelo acompanhamento. O agendamento ainda não foi implementado.
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
- **Pendente após a decisão de 2026-09-18:** frequência diária de madrugada
  aprovada para backup; perda máxima aceitável e prazo máximo de restauração
  ainda não definidos. Não apresentar o intervalo entre backups como garantia
  de recuperação, pois ela depende de sucesso, consistência e restauração testada.
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

- **Estado / data:** Em andamento — 2026-09-19. Implementação preparada;
  falta registrar a primeira execução do workflow no GitHub Actions.
- **Dependência conferida:** V1-052 entregue; Node 24.20.0 e pnpm 11.20.0
  executados localmente e derivados de `.nvmrc`/`packageManager` nos dois jobs.
- **Implementação:** job `integration` com Postgres 17 descartável, healthcheck,
  execução serial sem cache do Jest e leitores `poppler-utils`, `unzip` e
  `libreoffice-calc`. Migrations aplicadas pelo helper e seed operacional
  conferida pela suíte `seed-aceite`; sem reaproveitar banco de desenvolvimento.
- **Proteção:** URL aceita somente loopback e banco exato `gerenciador_test`,
  sem query/fragmento; confirmação do banco conectado antes de migrar/limpar.
  Verificação global de infraestrutura impede iniciar centenas de testes sem
  banco/utilitários. Falha de conexão não imprime URL, senha ou causa do driver.
  Falha de preparação fecha o pool; encerramentos toleram contexto ausente.
- **Arquivos:** workflow, `apps/api/jest.integration.mjs`, `package.json` da API,
  `.env.example`, helpers e hooks em `apps/api/test`, regressões
  `ambiente-teste.test.mjs`, AGENTS e índice. Nenhuma migration de domínio.
- **Verificações executadas:** `pnpm lint`, `pnpm test` e `pnpm build --force`
  passaram. `pnpm --filter api test:infra`: 12 testes passaram. Integração
  `--no-cache` em Postgres 17 novo, container `gerenciador-v1058-test`, porta
  local 55458: **39 suítes / 648 testes passaram** (98,8 s). Container removido
  após o ensaio. Simulações pelo comando real `test:int`, com URL recusada e
  porta indisponível, retornaram não zero antes das suítes, sem senha nem erro
  de teardown. Nenhum dado operacional foi apagado.
- **Aceite atendido localmente:** migrations/seed em banco limpo, exportações
  por leitores reais, runtime alinhado, proteção de destino e diagnóstico único
  de indisponibilidade. **Ainda necessário:** evidência do job hospedado após
  publicação das alterações; não há execução remota presumida nem homologação.
- **Referência revisável:** diff local, sem commit criado nesta tarefa.
- **Limitação operacional:** nome reservado exclusivamente a testes; loopback
  não identifica o destino remoto de um túnel configurado pelo operador. Não
  encaminhar essa porta a dados reais. Não rodar duas integrações simultâneas
  no mesmo banco. A execução local não equivale a execução hospedada no GitHub.

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

- **Decisões em 2026-09-18:** todas as P1 estão incluídas e devem ser entregues,
  salvo posterior adiamento explícito. O responsável sugeriu validação/aceite
  por permissão: operações no sistema usam concessões e alcance, sem cargo
  fixo. Registrar participantes nominais e evidências do aceite da versão;
  possuir uma permissão não constitui homologação. Nenhuma nova interface de
  homologação foi definida por esta decisão.
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
