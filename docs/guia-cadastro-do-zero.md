# Guia: percorrer o sistema com o banco zerado

Roteiro para exercitar o fluxo completo do Gerenciador com a base limpa, na
ordem em que as dependências realmente existem. Cada passo diz **quem** faz
(papel), **onde** (tela) e **o que trava** se o passo anterior não foi feito.

Escrito e verificado em 2026-09-11, com o banco de desenvolvimento zerado por
`pnpm db:zerar`.

---

## 1. Antes de zerar: congele o que existe hoje

```bash
pnpm db:congelar -m "antes do cadastro manual"
```

Grava três arquivos em `backups/`:

| Arquivo | Conteúdo |
|---|---|
| `<data>.dump` | dump `pg_dump -Fc` do banco de domínio inteiro |
| `<data>-arquivos.tar.gz` | os anexos de `apps/api/arquivos/`, que vivem fora do banco |
| `<data>.inventario.txt` | contagem exata de linhas por tabela, para conferir a volta |

`--congelar` copia os três para `baseline.*` — é o **ponto de retorno padrão**.
`pnpm db:backup` (sem `--congelar`) faz um snapshot datado sem mexer no baseline.

Para voltar ao estado congelado, a qualquer momento:

```bash
pnpm db:restaurar                      # o baseline
pnpm db:restaurar 20260911-221457-....dump   # um snapshot específico
```

A restauração derruba `public` e `drizzle`, aplica o dump numa única transação,
reextrai os anexos e confere a contagem tabela por tabela contra o inventário.

> `backups/` está no `.gitignore`: são dumps completos, com dados pessoais de
> alunos e servidores. Apagar a pasta perde o ponto de retorno — congele de novo.

> **Pare o `pnpm dev` antes, ou reinicie depois.** Os dois comandos encerram as
> conexões abertas ao banco (sem isso, `truncate` e `drop schema` ficam presos
> num lock que o pool da API nunca solta). O NestJS não sobrevive a isso: o
> processo termina e o `--watch` **não** o traz de volta, porque nenhum arquivo
> mudou. Os scripts avisam quando detectam a API no ar. Verificado em
> 2026-09-11 — foi exatamente o que aconteceu.

---

## 2. Zerar

```bash
pnpm db:zerar
```

Pede confirmação (digite `zerar`), faz um backup de segurança automático e
esvazia **34 das 54 tabelas** — todas as que se alimentam pela interface.

### O que fica, e por quê

`pnpm db:zerar` não é `pnpm db:seed --reset`. O reset apaga tudo, inclusive o que
**nenhum endpoint da API sabe criar**: programa, ciclo, rede coordenadora, área
temática, participação PPG–temática, teto orçamentário anual, aporte do Comitê e
o catálogo ISO de países. Sem isso não existe nem rota — `/programas/capes-global/2027-2030`
desaparece e nenhuma tela oferece como recriar. O que sobra depois de zerar é a
carcaça de planejamento vinda das planilhas, e é sobre ela que o cadastro manual
acontece:

| Preservado | Por quê |
|---|---|
| 249 países ISO | catálogo fechado, carregado por migration |
| 6 programas, 1 ciclo (2027–2030) | sem endpoint de criação |
| 3 redes, 12 temáticas, 24 PPGs, 24 participações | sem endpoint de criação (participação é pré-requisito de toda linha de plano) |
| 48 orçamentos por temática/ano, 12 aportes do Comitê | são atos aprovados fora do sistema; a API só tem `PATCH` |
| 7 modalidades, 60 itens de catálogo | `pnpm db:zerar --com-catalogo` apaga estes dois |
| 1 tabela de valores | preservada **sempre**: nenhum endpoint cria uma, e publicar item resolve a tabela vigente antes de inserir |
| 5 requisitos de submissão | política documental é dado, não código |
| 3 vínculos de login + as pessoas deles | **inclui o `admin`** |
| UEA + as 3 instituições das redes | sustentam pessoas, redes e aportes |

### O login continua funcionando

O Keycloak é outro banco: zerar o domínio não toca em usuário, senha ou papel.
Os três vínculos locais (`usuario_sistema`) são preservados, e o script lista
quais no final:

```
admin@propesp.local            Ana Administradora
coord.teste@propesp.local      Carlos Coordenador
docente.teste@propesp.local    Marina Docente
```

Mesmo que fossem apagados, `GET /me` recriaria a pessoa no primeiro acesso — mas
com identidade nova e escopo vazio. Preservar evita esse ruído.

### Confirmado com o banco zerado

As 17 telas do sistema respondem 200 (painel, mobilidade, mapa, bolsistas,
produção, programas, PPGs, catálogos, avisos, configurações, ciclo, redes,
orçamento, plano, Comitê Gestor, parceiros). O cadastro de linha de plano e de
missão funciona, e a numeração reinicia em `BOL-001` / `MCG-001`.

---

## 3. Ordem dos cadastros

Todos os passos abaixo são feitos como **`admin` / `admin123`** em
<http://localhost:3000>, exceto onde outro papel é indicado. O `admin` tem todas
as permissões do catálogo.

### Fase A — conferir a base (nada a cadastrar)

| # | Onde | O que verificar |
|---|---|---|
| A1 | **Cadastros → PPGs** | 24 PPGs. Cadastre aqui se faltar algum (`ppg:write`, só `admin`). |
| A2 | **Cadastros → Catálogo de bolsas** e **Modalidades** | 60 itens e 7 modalidades. Item **novo** é livre; item **em uso** tem destino, modalidade, vigência e valor travados — a tela mostra a contagem de usos antes de abrir o formulário. |
| A3 | **Planejamento → Redes e temáticas** | 3 redes, 12 temáticas, com coordenador por participação PPG–temática. |
| A4 | **Planejamento → Orçamento** | 48 linhas (temática × exercício). Ajuste as três rubricas por exercício aqui, com fonte e justificativa — a auditoria grava campo por campo. |

> **Se você usou `--com-catalogo`**, A2 deixa de ser conferência e passa a ser
> cadastro: crie as modalidades primeiro, depois os itens (a tabela de valores
> vigente continua lá, é ela que recebe os itens novos). A linha de plano de
> rubrica **BOLSAS** só existe se houver item casando destino + modalidade +
> vigência — a API recusa com 422 quando não há match. Modalidade sai junto com
> os itens de propósito: `permiteBrasil`/`permiteExterior` são derivados do
> catálogo, e modalidade sem item ofereceria na P10 a combinação que a resolução
> de preço recusa depois.

### Fase B — plano de aplicação (P10)

| # | Onde | Como |
|---|---|---|
| B1 | **Planejamento → Plano de aplicação** | Aba por rede, exercício em `?ano=`. "Nova linha" abre o formulário em etapas. |
| B2 | | **BOLSAS**: escolha temática, PPG, destino, modalidade e vigência — o valor vem do catálogo, não se digita. **MANUTENÇÃO** e **MISSÕES**: valor estimado + justificativa obrigatória. |
| B3 | | A quantidade é por exercício: 2028–2030 nascem vazios e **nunca** copiam a composição de 2027. Repita por ano. |

Editar linha já criada exige `plano:edit` (só `admin`) e grava auditoria por
campo. Cancelar não apaga: muda o status para `CANCELADO`.

**O que trava:** a API recusa PPG que não participa da temática escolhida — é a
participação da Fase A3 que autoriza a linha.

### Fase C — bolsistas e mobilidade (P03)

| # | Onde | Como |
|---|---|---|
| C1 | **Visão geral → Bolsistas** | "Nova concessão" parte de uma **linha planejada** da Fase B: `itemPlanejadoId` é obrigatório — sem plano, não há vaga a conceder. |
| C2 | | Pessoa (CPF), origem (país do catálogo ISO + instituição do catálogo ou digitada), destino (país e instituição **digitados**), datas completas, temática, linha de pesquisa e orientador por nome. |
| C3 | | Uma modalidade por CPF por ciclo — a segunda concessão da mesma modalidade é recusada. |
| C4 | detalhe do bolsista | **Produtos** (artigo, capítulo, etc., com instituição e país de colaboração) e **Documentos do bolsista**. |

Sobre documentos: **a categoria decide a visibilidade**, não você. Acadêmico
(carta de aceite, plano de trabalho, relatório, declaração, publicação) é
`INTERNA`; pessoal (identidade, passaporte, comprovante de residência) é
`PESSOAL` e só é oferecido a quem tem `documento:read-pessoal` — `admin` e
`secretaria`. Não há seletor de visibilidade, de propósito.

Depois de C1, **P01, P02 (Mobilidade), P04 (Mapa) e Produção param de estar
vazias** — elas não têm cadastro próprio, são leituras das concessões.

O `coordenador` (`coord.teste` / `coord123`) também cadastra bolsa e produto;
o `admin` não é obrigatório aqui.

### Fase D — parceiros (CG-049)

| # | Onde | Como |
|---|---|---|
| D1 | **Planejamento → Parceiros** | Cadastro em sidesheet. **A origem do relacionamento é imutável** — é obrigatória e não aparece na edição. |
| D2 | | Duplicidade: `POSSIVEL` oferece "cadastrar assim mesmo" dentro do próprio formulário; `INEQUIVOCA` não oferece botão. |
| D3 | | Contatos: e-mail (ou nome + telefone) repetido é bloqueio; homônimo só pede confirmação. Trocar o principal é transação. Não há exclusão — só inativar. |
| D4 | detalhe do parceiro | Histórico: redes, contatos, missões, mobilidades, convênios, produtos. Ficha em PDF por `GET /parceiros/:id/ficha`. |

"Mobilidade realizada" e "parceria formalizada" são **derivados** das bolsas e
convênios — aparecem ao lado do estágio declarado, nunca no lugar dele.

### Fase E — Comitê Gestor: equipes e missão

| # | Onde | Como |
|---|---|---|
| E1 | **Comitê Gestor → aba Equipes** | Cadastre os vínculos do ciclo, separando Comitê Gestor e Administração, com redes e vigência. Pessoa nova se cria aqui mesmo. |
| E2 | **aba Missões → Nova missão** | Formulário em etapas: título, objetivo, período, **pelo menos uma rede**, roteiro (uma atividade por parada, dentro do período) e participantes — **exatamente um `RESPONSAVEL`**. Status inicial `RASCUNHO` ou `PLANEJADA`. |
| E3 | missão → aba **Documentos** | Anexe os documentos exigidos e as **fotos/evidências** (galeria própria, metadados valem para a seleção inteira). PDF, JPG e PNG apenas — DOC e XLS saíram em 2026-09-07. |
| E4 | missão → aba **Análise** | **Enviar para análise** (`missao:submit`): a API confere o checklist de `requisito_submissao` e responde 422 com a lista de pendências. **Somente o responsável envia** — `admin` passa sempre. A edição congela em `EM_ANALISE`. |
| E5 | aba Análise | **Registrar decisão** (`missao:decide`): aprovar, reprovar ou devolver para ajustes, com a data da reunião em que o colegiado deliberou fora do sistema. Os documentos analisados são fotografados no instante da decisão. |
| E6 | aba Análise | **Reabrir análise** (`missao:reopen`) quando a proposta mudar. Cuidado: `/reabertura` sem `analise` no caminho reabre a **execução**, não a análise. |
| E7 | missão → aba **Resumo** | Depois da viagem: **relato geral** (um formulário) e **parada não prevista** (outro, que só aparece quando já há relato). Responda a avaliação dos objetivos — `SIM`, `PARCIALMENTE` ou `NAO`, com justificativa quando não foi plenamente alcançado. |
| E8 | aba Resumo → Resultados | Se não houve produto, registre a **declaração negativa** — só a negativa é gravada; o "sim" se responde cadastrando o produto (ver §4). |

Aprovação e execução são **dimensões independentes**: uma missão pode estar
`APROVADA` e ainda `PLANEJADA`, e a tela mostra as duas sempre.

### Fase F — prestação de contas

| # | Onde | Como |
|---|---|---|
| F1 | missão → aba **Prestação** | "Iniciar prestação" (`prestacao:write`). Prestação nula mostra "Prestação não iniciada" — é ausência de linha, não um estado. |
| F2 | | Lance as despesas: passagem (com cotações), diária, hospedagem, transporte, inscrição, seguro, outros. **Somente BRL** — a conversão acontece antes do lançamento. |
| F3 | | Anexe o documento de cada despesa e o PDF de cada cotação. Despesa documentada não pode ser removida — o vínculo do anexo é polimórfico e a linha o sustenta. |
| F4 | | **Enviar** (`prestacao:write`) congela a edição. Prestação sem despesa não é enviada. |
| F5 | | **Validar** ou **devolver** (`prestacao:review`, só `admin`). `COM_PENDENCIA` volta a aceitar lançamento; o reenvio limpa o parecer. |
| F6 | Comitê Gestor → Visão geral | **Somente `VALIDADA` abate o aporte**. `saldoOficial` é `orçamento − validado`; os outros três estados ficam em colunas próprias. |

### Fase G — encerramento

| # | Onde | Como |
|---|---|---|
| G1 | missão | Confirme a missão (ver §4 — ainda sem botão). |
| G2 | aba Resumo | **Encerrar missão** aparece com `missao:write` e status `CONFIRMADA`. A API recalcula o checklist inteiro na hora: relato, roteiro relatado, resposta sobre produtos, prestação validada, avaliação dos objetivos e os documentos de `momento = 'ENCERRAMENTO'`. |
| G3 | aba Encerramento | Requisito que a PROPESP não vai exigir desta missão: **dispensar** (`missao:decide`), com justificativa. Dispensado **não vira atendido** — continua não cumprido, com a justificativa ao lado. |

Nenhum documento de encerramento vem semeado: quais a PROPESP exige é política
institucional, e a lista é dado (`requisito_submissao`).

### Fase H — leituras que não se cadastram

Depois das fases acima, confira que os números aparecem. Nenhuma destas telas
tem cadastro próprio:

- **Painel (P01)** — KPIs, cartão por rede, mapa de composição temáticas × exercícios, bolsas por modalidade, mobilidade realizada. Exercício em `?ano=`.
- **Mobilidade (P02)**, **Mapa (P04)**, **Produção (P18/P19)**.
- **Comitê Gestor → Visão geral** — aportes, execução orçamentária, *Panorama das missões* (cada cartão é um link com o filtro na URL) e consolidado por rede. A linha "Total do ciclo" **não é a soma das colunas**, e a tela avisa: missão de duas redes pertence às duas.
- **Comitê Gestor → aba Análise** — a fila, definida pela rodada aberta; destaque em 7 dias, porque a reunião é semanal.
- **Comitê Gestor → aba Relatórios** — missões, parceiros, finanças, resultados, com exportação CSV/XLSX/PDF e o dossiê da missão em PDF único.
- **Avisos** — caixa de entrada. Não há e-mail (sem SMTP), então as notificações nascem `NAO_APLICAVEL`.

---

## 4. O que ainda não tem tela

Estes atos existem na API e **não têm botão**. Use o helper `pnpm api`, que faz o
login OIDC de verdade e chama pelo BFF (nenhum client do realm aceita
password grant, e ligar isso afrouxaria o realm):

```bash
pnpm api GET me
pnpm api GET "programas/capes-global/2027-2030/comite-gestor/missoes?tamanho=5"
USUARIO=coord.teste SENHA=coord123 pnpm api GET ppgs
```

| Ato | Chamada |
|---|---|
| **Confirmar missão** (`PLANEJADA` → `CONFIRMADA`) — pré-requisito do encerramento | `pnpm api POST ".../comite-gestor/missoes/<id>/situacao" '{"acao":"CONFIRMAR","justificativa":"..."}'` |
| **Cancelar missão** | mesma rota, `{"acao":"CANCELAR","justificativa":"..."}` |
| **Editar missão** (a tela só cria) | `PATCH ".../comite-gestor/missoes/<id>"` |
| **Produto da missão** | `POST ".../comite-gestor/missoes/<id>/produtos"` |
| **Convênio** (não pertence à missão: fica em `/convenios`, sem `:programa/:ciclo`) | `POST "convenios"` |
| **Pendências** (P13 não tem mais tela) | `GET`/`POST ".../pendencias"`, `PATCH "pendencias/:id"` |

O caminho do `situacao` é o gargalo prático: **Encerrar missão** só aparece com
status `CONFIRMADA`, e não existe botão para confirmar. Verificado em
2026-09-11 — a transição responde 201 e a missão passa a `CONFIRMADA`.

---

## 5. Fora do escopo do sistema hoje

Não procure por estas telas; elas não existem, e as duas primeiras são decisão,
não pendência:

- **Execução financeira (P11)** — no CAPES Global a CAPES paga direto, e nada passa pelo caixa da UEA.
- **Remanejamentos (P12)** — o sistema vai apenas *registrar* movimentação já feita na CAPES, sempre dentro da mesma temática.
- **Home por perfil** — a P01 é a mesma para todos até o recorte de plano e orçamento existir.
- **Recorte por PPG em plano, orçamento e parceiros** — hoje só PPGs e bolsas são recortados. `RECORTE_OBRIGATORIO` segue `false`: conta sem escopo nenhum ainda vê tudo.
- **Acessos** — concedidos ação por ação, com alcance, na tela **Acessos** ou
  pelas rotas de `/acesso/usuarios/:id/concessoes`.

---

## 6. Resumo dos comandos

```bash
pnpm db:congelar              # congela o estado atual como baseline
pnpm db:congelar -m "rotulo"  # idem, com rótulo no nome do arquivo
pnpm db:backup                # snapshot datado, sem mexer no baseline
pnpm db:restaurar             # volta ao baseline
pnpm db:restaurar <arq.dump>  # volta a um snapshot específico
pnpm db:zerar                 # limpa o operacional, preserva base e logins
pnpm db:zerar --com-catalogo  # limpa também modalidades e catálogo de bolsas
pnpm api GET me               # chama a API autenticado, pelo BFF
```

Todos aceitam `--sim` para pular a confirmação, e `db:zerar` aceita
`--sem-backup` para não gerar o snapshot automático.

Para voltar aos dados das planilhas em vez de um backup:
`cd apps/api && pnpm db:seed --reset`.
