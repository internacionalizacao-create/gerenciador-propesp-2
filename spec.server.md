Recomendação objetiva: para 100 usuários cadastrados, eu sugeriria uma VM com **8 vCPU, 16 GB de RAM e 200 GB SSD/NVMe**. Se for adquirir um servidor físico dedicado, compraria **8 núcleos, 32 GB ECC e 2×480 GB SSD em RAID1**, deixando possibilidade de expansão.

## Perfis de capacidade

| Cenário | CPU | RAM | Disco útil | Observação |
|---|---:|---:|---:|---|
| Piloto/homologação | 2 vCPU | 4 GB | 50 GB SSD | Sobe, mas sem margem segura |
| Mínimo de produção | 4 vCPU | 8 GB | 100 GB SSD | Até aproximadamente 20–30 simultâneos |
| Recomendado | **8 vCPU** | **16 GB** | **200 GB SSD/NVMe** | 100 cadastrados, picos e crescimento |
| 100 realmente simultâneos | 8 vCPU | **32 GB** | 250–500 GB SSD | Duas réplicas Web/API e observabilidade |

“100 usuários cadastrados” é bem diferente de 100 pessoas carregando telas ao mesmo tempo. Estou assumindo inicialmente 100 contas e pico de 20–30 usuários ativos.

## Por que essa configuração

Medições locais em modo de produção:

- Web Next: aproximadamente 130 MiB ociosa e 200 MiB após teste sintético com concorrência 50.
- API Nest: aproximadamente 110 MiB ociosa e 140 MiB após o teste.
- Keycloak `start-dev`: aproximadamente 770 MiB ocioso.
- PostgreSQL da aplicação: banco atual com aproximadamente 9,7 MiB.
- PostgreSQL do Keycloak: aproximadamente 14,2 MiB.

Os bancos atuais são minúsculos. O consumo relevante vem do Keycloak, do SSR/BFF do Next, do cache do PostgreSQL, do sistema operacional e da margem operacional.

O dimensionamento oficial do Keycloak considera **1.250 MB de memória-base**, inclusive para até 10 mil sessões em cache, e recomenda folga expressiva de CPU. Para uma instalação pequena, reservar **2 vCPU e 2 GiB** ao Keycloak é conservador. [Dimensionamento oficial do Keycloak](https://www.keycloak.org/high-availability/multi-cluster/concepts-memory-and-cpu-sizing)

Mesmo que os 100 usuários façam login ao longo de apenas um minuto, isso representa aproximadamente 1,67 login por segundo, muito abaixo da referência oficial de 15 logins por segundo por vCPU.

## Especificação para aquisição física

Eu colocaria na solicitação:

- Processador x86-64 moderno, classe servidor.
- **8 núcleos físicos / 16 threads**, com boa frequência por núcleo.
- **32 GB de RAM ECC**, preferencialmente 2×16 GB e slots livres para expansão até 64 GB.
- **2×480 GB SSD enterprise em RAID1**.
- Usar 2×960 GB se documentos e anexos forem armazenados localmente.
- Controladora RAID com monitoramento, ou espelhamento equivalente bem administrado.
- Duas interfaces de rede 1 GbE, se a infraestrutura permitir redundância.
- Fonte redundante, gerenciamento remoto e UPS.
- Destino de backup externo, como NAS ou servidor de backup.

RAID1 protege contra a falha de um disco, mas não substitui backup e não torna uma máquina única altamente disponível.

Se já existir VMware, Proxmox ou outra infraestrutura de virtualização confiável, eu preferiria criar uma VM com:

```text
8 vCPU
16 GB RAM reservada
200 GB SSD/NVMe
Linux 64-bit
IP estático
```

Evitaria overcommit agressivo de RAM e CPU para essa VM.

## Orçamento inicial por componente

Para um host com 16 GB:

| Componente | Memória inicial | CPU disponível |
|---|---:|---:|
| Reverse proxy | 256 MiB | 0,5–1 vCPU |
| Web Next | 768 MiB | até 2 vCPU |
| API Nest | 768 MiB | até 2 vCPU |
| Keycloak | **2 GiB** | até 2 vCPU |
| PostgreSQL da API | 2 GiB | até 2 vCPU |
| PostgreSQL do Keycloak | 1–1,5 GiB | até 1–2 vCPU |
| SO, cache e monitoramento | 4–6 GiB | compartilhado |

Esses valores são pontos de partida, não limites finais rígidos. O PostgreSQL utiliza também o cache do sistema operacional; por isso não convém entregar toda a RAM aos containers. [Recursos de memória do PostgreSQL 17](https://www.postgresql.org/docs/17/runtime-config-resource.html)

O pool atual da API, com dez conexões por réplica, é suficiente como início. Eu também configuraria o pool do Keycloak próximo de dez conexões nessa escala, em vez de deixar um teto desnecessariamente grande.

## Requisitos de software e rede

- Ubuntu Server 24.04 LTS ou distribuição Linux equivalente suportada.
- Docker Engine e Docker Compose Plugin.
- IP estático.
- Dois nomes DNS, por exemplo:
  - `gerenciador.propesp.instituicao.br`
  - `auth.gerenciador.propesp.instituicao.br`
- Certificados HTTPS válidos.
- NTP configurado; horário incorreto quebra validação de tokens.
- SMTP para recuperação de senha do Keycloak.
- Firewall permitindo externamente apenas 80/443.
- SSH e console do Keycloak restritos à rede administrativa ou VPN.
- Registry privado ou acesso controlado às imagens.
- Espaço de backup fora da máquina.

## Armazenamento

Sugestão de organização lógica:

```text
60 GB   sistema operacional e imagens
100 GB  bancos e volumes
20 GB   logs e temporários
20 GB   margem operacional
```

O backup deve ir para outro equipamento. Eu adotaria:

- Backup diário dos dois PostgreSQL.
- Retenção de pelo menos 7 diários, 4 semanais e 6–12 mensais.
- Cópia criptografada em NAS/servidor externo.
- Teste de restauração periódico.
- Rotação obrigatória dos logs Docker.

Se os módulos futuros começarem a guardar documentos, coloque os arquivos em NAS ou object storage. O banco deve manter apenas metadados e caminhos.

## Validação antes da entrada em produção

Algumas páginas do projeto podem gerar de cinco a sete chamadas à API durante um carregamento. Por isso, antes da compra definitiva ou do go-live, faria um teste autenticado com 25, 50 e 100 usuários virtuais, cobrindo:

- Login no Keycloak.
- Painel.
- Plano P10.
- Lista e detalhe de PPG.
- Pendências.
- Uma pequena proporção de gravações.

Critérios sugeridos:

- Erros abaixo de 1%.
- p95 de navegação abaixo de 2 segundos.
- CPU sustentada abaixo de 70–75%.
- RAM abaixo de 80%, sem swap constante.
- Pool do banco sem esgotamento.
- Readiness permanecendo saudável.

Uma máquina única é suficiente em capacidade, mas continua sendo ponto único de falha. Se a instituição exigir alta disponibilidade, a decisão muda para dois hosts ou banco externo redundante — não por causa dos 100 usuários, mas pelo SLA.