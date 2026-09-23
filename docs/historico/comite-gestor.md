# Histórico — Comitê Gestor (CG-001 a CG-069)

Módulo **fechado**: as 69 tasks do backlog estão concluídas e a folha de
homologação, inteiramente marcada. O relato abaixo saiu do `AGENTS.md` na
reorganização de 2026-09-22 — ele contava *quando* cada peça entrou, e isso
consumia contexto de quem chega para trabalhar em outra coisa.

**O porquê continua valendo.** Nada aqui foi apagado: as justificativas de
desenho e de segurança estão inteiras, e é delas que se parte antes de mexer em
missão, prestação, anexo, parecer ou encerramento. O `AGENTS.md` guarda só as
regras transversais; o detalhe de cada decisão está aqui.

Ver também: [backlog-comite-gestor.md](backlog-comite-gestor.md) (as 69 fichas),
[../homologacao-comite-gestor.md](../homologacao-comite-gestor.md) (as decisões
homologadas), [../revisao-escopo-comite-gestor-2026-09-01.md](../revisao-escopo-comite-gestor-2026-09-01.md)
(a auditoria do escopo ampliado) e [../modelo-documental.md](../modelo-documental.md).

---

## O módulo, como ficou

**Comitê Gestor e Administração (P17, equipes e cadastro de missões)**:
cadastro de vínculos por ciclo, separação entre as duas equipes, criação
reutilizável de pessoas, vigência, auditoria e acesso provisório exclusivo de
`admin`. A P17 possui as abas Visão geral, Missões e Equipes; Missões lista,
filtra e pagina, e o cadastro multietapas grava roteiro repetível e
participantes sem valores financeiros. A API cobre criação, detalhe, edição,
ciclo de vida e relato. **Desde a V1-030 (2026-09-19) o ciclo inteiro é
percorrível pela tela:** editar, confirmar, cancelar e reabrir a execução
entraram na página de detalhe, e encerrar continua na aba própria, junto do
checklist que o governa. A edição **reusa o formulário do cadastro** — as
regras são as mesmas, e mantê-las em dois lugares é garantir que divirjam —,
com duas diferenças: o campo de situação some (mudar situação é `/situacao`,
com regra de origem por ação) e **o `id` de cada participante e parada viaja
no payload**, porque o endpoint reconcilia as listas inteiras e linha sem `id`
é linha nova. Sem ele, salvar uma edição duplicaria o roteiro. O
catálogo ISO de países é carregado por migration e seed. A composição formal
das redes UFMG, UNESP e UNICAMP também é carregada por migration e seed: 10
pessoas, 10 vínculos consolidados e 19 associações em
`membro_equipe_gestao_rede`, sem bloquear novos cadastros manuais. A Visão
geral filtra a tabela de aportes por exercício em `?ano=`, e a aba Equipes
mostra quantas missões do ciclo cada pessoa integrou — a contagem é por pessoa,
porque participante sem vínculo de equipe também conta. A missão pertence a
uma ou mais redes coordenadoras (`missao_rede`, mínimo uma, do mesmo ciclo):
a lista filtra por rede em `?redeId=`, e a missão multirrede aparece e conta
**uma única vez** em "todas as redes" porque filtro e leitura usam `exists` e
subconsulta, nunca `join`. O backlog rastreável
está em [backlog-comite-gestor.md](backlog-comite-gestor.md), e as
decisões que faltam homologar antes da próxima etapa estão em
[docs/homologacao-comite-gestor.md](../homologacao-comite-gestor.md).
Em 2026-09-01, a equipe entregou uma especificação ampliada de 40 seções para
aprovação, parceiros, contatos, produtos, documentos, convênios, indicadores
e relatórios. A auditoria integral está em
[docs/revisao-escopo-comite-gestor-2026-09-01.md](../revisao-escopo-comite-gestor-2026-09-01.md).
A CG-017 já criou a fundação de parceiros: dados institucionais completos,
`instituicao_rede` N:N e contatos reutilizáveis. A CG-025 acrescentou API de
instituições, candidatos a duplicidade, confirmação explícita e conciliação
auditada sem apagar a origem. A CG-026 fez o mesmo para os contatos, no escopo
de cada instituição: e-mail (ou nome mais telefone) repetido é bloqueio,
homônimo apenas exige confirmação, o contato principal troca dentro de uma
transação e não há exclusão — só inativação, porque a missão referencia o `id`
central. A auditoria desses registros guarda quais campos mudaram, nunca os
valores pessoais. A CG-027 fecha a leitura: `GET /parceiros/:id/historico`
devolve redes, contatos, missões com atividades, eventos e documentos em uma
linha por missão. Ela usa `exists` mais `selectDistinct` sobre a missão, nunca
`join` com atividade ou rede — senão a missão de duas redes, ou a que visita o
mesmo parceiro em duas paradas, apareceria repetida. Produtos e convênios
entraram na CG-056 como seções próprias e `modulosPendentes` ficou vazia — o
campo permanece no contrato para o módulo seguinte. A CG-049
levou isso à interface em `/programas/[programa]/[ciclo]/parceiros`: lista com
busca e filtro por rede, cadastro e edição em sidesheet, contatos com troca de
principal e inativação/reativação, e o detalhe histórico. **O alerta de
duplicidade fica dentro do formulário, nunca em diálogo por cima** — é assim
que ele não apaga o que já foi digitado; `EstadoDaAcao.candidatos` carrega o
409 até a tela. `POSSIVEL` oferece "cadastrar assim mesmo"; `INEQUIVOCA` não
oferece botão, porque a API recusa mesmo confirmada. Não há ação de excluir em
lugar nenhum: a saída é inativar. A conciliação também tem interface — a
origem vira o cadastro inativo e o escolhido permanece, com justificativa
obrigatória e aviso do que será transferido. **V1-042 (2026-09-20)** pagina
a lista em SQL: `GET /parceiros` retorna `itens`, `total`, `pagina`, `tamanho`,
`paginas` e `resumo`. Padrão 50, máximo 200; ordenação por nome e ID. Filtros
e página ficam na URL, e voltar/avançar restaura os controles. Resumo e total
usam o conjunto filtrado inteiro. Página que deixou de existir oferece
retorno à última disponível. `parceiro:read` continua GLOBAL (catálogo
compartilhado); rede é filtro, não concessão. A seleção de parceiro dentro da missão
continua na CG-045. A CG-018 ampliou missão, atividade e participante:
responsável único por papel, destino/evento completos, contato central,
período individual e dias inclusivos derivados. A API cobre esses campos; a
interface ainda não.

---

## Regras financeiras (CG-009)

**Regras financeiras homologadas na CG-009** (documento da equipe de
orçamento): o sistema trabalha **somente em BRL** — não existe moeda de origem
nem cotação, e a conversão acontece antes do lançamento; **prestação
`VALIDADA` abate o aporte anual** do Comitê Gestor (implementação na CG-055),
e nada abate antes disso; os requisitos de encerramento são **agnósticos ao
tipo de missão**; os tipos de despesa são passagem, diária, hospedagem,
transporte, inscrição em evento, seguro e outros; os formatos de documento
aceitos eram PDF, JPG, PNG, DOC/DOCX e XLS/XLSX — **DOC/XLS saíram em
2026-09-07**, por decisão do responsável de que o PDF basta por enquanto
(documento do Office é o vetor clássico de macro e não há antivírus ainda);
e a prestação abre
**automaticamente** quando a viagem é marcada como realizada.

---

## Documentos: modelo, upload e segurança (CG-014, CG-051, CG-052, CG-061)

**Modelo documental decidido na CG-014**, antes de qualquer upload:
[docs/modelo-documental.md](../modelo-documental.md). Em resumo — a tabela
genérica `anexo` **evolui** em vez de ganhar uma irmã; substituir um arquivo
cria versão nova e preserva a anterior (não há exclusão); nada é servido por
URL estática, todo download passa por endpoint autenticado com chave de
armazenamento opaca; e o tipo do arquivo é validado pelo **conteúdo**, não
pela extensão. Os "documentos analisados" de um parecer são tabela de ligação,
nunca vínculo direto — senão anexar um arquivo depois mudaria retroativamente
o que o Comitê diz ter analisado.

**Upload de documentos (CG-051)** vive em `/anexos` e segue o modelo acima.
O disco de desenvolvimento é `ARQUIVOS_DIR`, que por padrão resolve para
`apps/api/arquivos/` — ignorado pelo git desde 2026-09-05, porque o primeiro
upload criava o diretório dentro do repositório e nada ali pode ser
versionado. O
controller **não** tem `@RequirePermission`: a permissão é a da entidade de
destino (`missao:edit`, `prestacao:write`, `parceiro:write`) e só se sabe
depois de ler o corpo — um decorador fixo teria de escolher a mais fraca.
Antivírus não existe; o ponto de inserção é `validarArquivo`, antes de
`armazenamento.guardar`.

**Documentos da prestação (CG-052)** reutilizam a mesma API: anexos de
passagem, diária e outras despesas apontam para `DESPESA_MISSAO`; cada PDF de
cotação aponta para seu `COTACAO_PASSAGEM`. A categoria é validada contra o
tipo da despesa. Como `anexo` é polimórfico e não possui FK, o serviço de
prestação recusa remover uma despesa documentada ou apagar, durante edição,
uma cotação que tenha documento — preservar a linha é o que mantém o vínculo
histórico válido.

---

## Recorte de anexos e do histórico do parceiro (V1-016)

**O anexo herda o alcance da permissão que ele mesmo exige** (V1-016,
2026-09-18). `exigirAcesso` toma o alcance de `POLITICA[tipo][acao]` — a
mesma permissão que acabou de cobrar — e confere o alvo no banco. Antes o
documento da prestação era recortado por `missao:read` embora cobrasse
`prestacao:read`, e quem tivesse leitura de missão numa rede e de prestação
noutra baixava o comprovante da rede errada. **Alvo inexistente e alvo fora do
alcance respondem a mesma coisa** — *Documento não encontrado* —, porque
mensagens distintas deixariam mapear quais missões existem trocando o UUID até
o texto mudar. Instituição e convênio seguem sem recorte: não pendem de missão
nenhuma.

**O histórico do parceiro é recortado parcela a parcela** (V1-016). O cadastro
continua compartilhado — `listar`, `detalhar` e `candidatos` não recortam
nada, e é isso que faz o catálogo servir de catálogo —, mas bolsa responde a
`bolsa:read`, missão/roteiro/evento a `missao:read`, produto a
`produto-missao:read` **mais** o alcance da missão que o gerou, e convênio a
`convenio:read`. O convênio **não** segue a missão de origem: o acordo
sobrevive à viagem (CG-056). O recorte entra na consulta inclusive no
agregado, porque `vinculos` conta mobilidades e somar antes de filtrar
publicaria o número real. **Cuidado com `or` sem parênteses**: a condição dos
produtos era `exists (...) or exists (...)` sozinha no `where`, e ao entrar num
`and` com o recorte a precedência ligou o `and` só ao segundo `exists`.
`HistoricoParceiro.acesso` diz por seção se a ação foi concedida, para o estado
vazio não afirmar "não houve mobilidade" a quem apenas não pode consultá-la.

**Segurança documental (CG-061)** valida UUID antes do banco, rejeita nome
com caracteres de controle e monta `Content-Disposition` com fallback ASCII
mais `filename*` UTF-8. Conhecer o UUID não contorna a permissão herdada do
alvo. Isolamento horizontal entre dois perfis com a mesma permissão continua
pertencendo à CG-028/CG-029, porque a matriz provisória ainda dá acesso ao
módulo somente a `admin`.

---

## Aprovação, submissão e decisão (CG-019, CG-037, CG-038)

**Aprovação da missão (CG-019)** entrou em 2026-09-05, depois de o
responsável aceitar o **modelo B**: o colegiado delibera fora do sistema —
reunião semanal, podendo haver semana sem reunião — e o relator registra o
parecer com a data dessa deliberação. A aprovação é dimensão própria
(`missao_comite.status_aprovacao`), independente do status de execução. O
banco garante uma rodada aberta por missão, uma decisão por rodada, data de
reunião só nas decisões terminais e justificativa obrigatória na reabertura.
**Os requisitos documentais são dados** (`requisito_submissao`), por decisão
explícita: uma lista fixa no código impediria cadastrar um tipo novo de
missão. Falta ligar `sub` do Keycloak a `pessoa` para aplicar "somente o
responsável envia" — é pré-requisito da CG-037.

**Submissão para análise (CG-037)** entrou em 2026-09-05:
`GET .../missoes/:id/requisitos` devolve o checklist e
`POST .../missoes/:id/submissao` abre a rodada (`missao:submit`). Os
requisitos vêm de `requisito_submissao`, **nunca de constante**. Recusa é
422 com a lista de pendências. **Somente o responsável envia** — verificável
desde que existe o vínculo `sub` → `pessoa`; `admin` passa sempre, senão uma
missão cujo responsável saiu ficaria travada. **A edição congela em
`EM_ANALISE`:** sem isso o Comitê aprovaria texto diferente do que leu.
Notificação durável (D-11) ficou de fora — é proposta não homologada.

**O `/me` nunca deve falhar por causa do vínculo de identidade.** Quando o
`sub` do Keycloak não pode ser ligado a uma pessoa — o caso real foi o realm
recriado, com todos os `sub` novos e o e-mail apontando para pessoa já
vinculada —, `resolver` devolve `null`, o `/me` responde `pessoaId: null` e
`vinculoPendente: true`, e a sessão segue válida. Antes disso a resposta era
500 e a aplicação inteira parava. Repontar a pessoa automaticamente seria
pior: bastaria criar conta com um e-mail conhecido para herdar identidade e
escopos. Quem desempata é `POST /acesso/usuarios/:id/pessoa`.

**Decisões do Comitê (CG-038)** completam o fluxo:
`POST .../missoes/:id/decisao` (`missao:decide`),
`POST .../missoes/:id/analise/reabertura` (`missao:reopen`) e
`GET .../missoes/:id/analise`. **Atenção ao caminho da reabertura:**
`.../missoes/:id/reabertura`, sem `analise`, é outra coisa — reabre a
*execução* de uma missão concluída, não a *análise* decidida. Os documentos
analisados são **fotografados** no instante da decisão, com nome e versão:
sem isso um upload posterior reescreveria o que o Comitê diz ter lido. Não há
designação de relator, nem quórum, nem notificação.

---

## A tela da missão (CG-045)

**A tela da missão (CG-045)** está em
`/programas/[programa]/[ciclo]/comite-gestor/missoes/[id]`, com quatro abas:
`Resumo` (padrão, sem `?aba=`), `Análise`, `Documentos` e `Prestação`. As
duas dimensões da CG-006 aparecem sempre juntas e rotuladas — mostrar só uma
faria "aprovada" ser lido como "realizada". Análise traz checklist, histórico
de rodadas e as ações de enviar, decidir e reabrir; Documentos e Prestação
são **leitura**, porque anexar arquivo e lançar despesa pela interface são a
CG-053 (concluída junto). O download sai por `/anexos/:id/conteudo`, nunca
por arquivo estático. Prestação nula mostra "Prestação não iniciada" —
ausência de prestação é ausência de linha, não o estado `NAO_INICIADA`.

---

## Execução orçamentária e prestação (CG-054, CG-055)

**Execução orçamentária (CG-055)** vive em
`GET .../comite-gestor/execucao` e aparece na aba Visão geral, ao lado — e
não no lugar — da tabela de aportes por rede. **Somente `VALIDADA` abate o
aporte**: `saldoOficial` é `orçamento − validado`, e os outros três estados
ocupam colunas próprias justamente para que isso fique visível. Uma coluna
única "executado" obrigaria a escolher entre esconder o que ainda não vale e
fazer parecer que já vale. **O dinheiro agrupa por `despesa.exercicio`; as
missões, pelas datas** — a segunda usa o mesmo critério do filtro `?ano=` da
lista, para o número não mudar ao clicar. O consolidado do ciclo **não é a
soma das colunas**: missão que atravessa dois exercícios está nas duas
linhas, e a contagem do total é distinta. Exercício com despesa e sem aporte
aparece com saldo negativo, porque esconder o estouro atrás de um nulo seria
pior. `somarOuNulo` existe ao lado de `somarMoeda` em `orcamento.service.ts`
porque o zero de `somarMoeda` é certo para temática sem linha e errado para
prestação nunca iniciada.

**A lista de missões passou a mostrar a prestação real.** O
`'NAO_INICIADA'::text` fixo virou `left join` em `prestacao_contas_missao`
(`prestacao_missao_uk` garante que a junção não duplique linha, o que
importaria porque `count(*) over ()` dá o total da página), e `valorPrestado`
soma as despesas em **qualquer** estado — filtrar por `VALIDADA` faria a
missão em preenchimento parecer sem lançamento. O detalhe da missão devolve
situação e totais reais; `prestacao` continua nulo lá porque o corpo dela sai
de `GET .../prestacao`, e duplicar a resposta abriria espaço para divergirem.

**Ciclo de vida da prestação (CG-054):** `/prestacao/envio`
(`prestacao:write`), `/prestacao/validacao` e `/prestacao/devolucao`
(`prestacao:review`). Os quatro estados governam o que a tela oferece.
**`COM_PENDENCIA` volta a aceitar lançamento** — devolver sem reabrir a edição
deixaria o responsável sem como corrigir; `ENVIADA` congela para o revisor não
validar outra coisa; `VALIDADA` congela em definitivo, porque abate o aporte.
Não há rodada numerada como na análise da missão: é a trilha de auditoria que
conta o vaivém. Prestação sem despesa não é enviada, e o reenvio limpa o
parecer da devolução.

---

## Produtos e convênios (CG-056)

**Produtos da missão e convênios (CG-056)** entraram em 2026-09-06.
`produto_missao` é domínio próprio, separado de `produto_bolsa`: são duas
cobranças sobre coisas diferentes, e reaproveitar a tabela deixaria
`bolsa_concedida_id` nulo em metade das linhas. **A resposta "gerou produto?"
não é booleano:** o "sim" já é a existência de linha em `produto_missao`, e só
a resposta **negativa** é gravada
(`missao_comite.sem_produto_declarado_em/_por/_justificativa`), porque zero
produto significa tanto "não gerou" quanto "ninguém respondeu" e o checklist de
encerramento (CG-058) precisa distinguir as duas. Cadastrar produto retira a
declaração, com auditoria. **O convênio não pertence à missão**: ancora-se na
`instituicao`, guarda a missão só como origem (FK `set null`) e vive em
`/convenios`, sem `:programa/:ciclo` no caminho — um acordo sobrevive à viagem
e ao ciclo. Produto usa `missao:read`/`missao:write` (resultado, mesmo verbo do
relato — não `missao:edit`, que congela em análise); convênio usa
`parceiro:read`/`parceiro:write`. Nenhuma permissão nova. `produto_missao` do
tipo `CONVENIO` exige um acordo apontado, e só ele pode apontar — o `check` é
bicondicional porque as duas metades escondem coisas diferentes. Não há
exclusão de convênio (só inativação, FK `restrict`) nem remoção de produto
documentado (regra da CG-052). `entidade_anexo` ganhou `PRODUTO_MISSAO` e
`CONVENIO`. O histórico do parceiro ganhou as seções `convenios` e `produtos`,
e `modulosPendentes` ficou vazia. **O cadastro de produto entrou na tela com a V1-031**
(2026-09-19): criar, editar e remover na seção *Resultados*, cada verbo com a
sua permissão. **Continua sem botão que responda "sim"** — o "sim" é a
existência da linha, e cadastrar já retira a declaração negativa, com
auditoria. Na missão declarada sem produto, *Cadastrar* e *Reabrir resposta*
ficam lado a lado: respondem a "apareceu um resultado" e a "errei a
declaração", que são coisas diferentes. O campo de acordo só aparece no tipo
`CONVENIO`, nos dois sentidos da regra bicondicional, e os responsáveis
oferecidos são **os participantes da missão** — creditar quem não viajou seria
afirmar o que ninguém declarou. **O convênio ganhou tela na V1-032**
(2026-09-20), mas **na página do parceiro, não aqui**: o acordo se ancora na
instituição e sobrevive à viagem — dentro da missão ele continua sendo
apontado, nunca criado. Lá estão cadastrar, editar, inativar e reativar, cada
um escondido pela sua própria permissão (`convenio:create`, `:edit`,
`:status`), sem exclusão e com justificativa obrigatória nos dois sentidos da
inativação. O histórico do parceiro passou a trazer também `numeroProcesso`,
`objetivo`, `observacoes` e as **redes** do acordo, porque é dele que o
formulário de edição se preenche e a API reconcilia a lista de redes inteira;
as redes vêm por consulta à parte, nunca por `join`, senão o acordo de duas
redes viraria duas linhas na ficha.

---

## Encerramento e checklist (CG-058, CG-059)

**Encerramento da missão (CG-058)** entrou em 2026-09-06, e mudou o
significado de `CONCLUIR`: a transição passa pelo **checklist inteiro**, não
só pelo relato, e `CONCLUIDA` deixa de dizer "a viagem acabou" para dizer
"encerrada e acertada" — a missão fica `CONFIRMADA` enquanto a prestação
corre. `GET .../missoes/:id/encerramento` devolve a lista;
`.../encerramento/dispensa` e `.../encerramento/revogacao` exigem
`missao:decide`, que já é exatamente "admin e Comitê" — nenhuma permissão
nova foi criada.

**Nada do checklist é gravado**, e a proibição é da própria task: um
`prestacao_ok` guardado divergiria no dia em que a prestação fosse devolvida,
e a missão encerraria com base numa foto velha. Cinco fatos vêm de consulta
(relato, roteiro relatado, resposta sobre produtos, prestação validada,
avaliação dos objetivos) e os documentos vêm de `requisito_submissao` com
`momento = 'ENCERRAMENTO'` — dado, não código, como na CG-019.

Quatro regras que a implementação ingênua erra: **dispensado não vira
atendido** (o requisito segue não cumprido, com a justificativa ao lado —
pintá-lo de verde apagaria a exceção onde ela precisa ser vista); **estado
errado é impedimento, não pendência** (não há o que preencher para resolver
"já foi encerrada", e misturar os dois faria a tela oferecer uma ação
inexistente); **revogar não apaga a linha** — daí `revogada_em` e o índice de
unicidade **parcial**, sem o qual dispensar de novo depois de revogar
colidiria; e **a justificativa segue a avaliação**, porque manter a explicação
de um insucesso que deixou de existir faria a tela contradizer a resposta. A
dispensa vale **só para a missão apontada**: por tipo seria mudança de
política disfarçada de exceção.

A avaliação (`SIM | PARCIALMENTE | NAO`) é opcional no relato e obrigatória
para encerrar — travar o relato pela avaliação impediria salvar o texto pela
metade. A justificativa é exigida só quando não foi plenamente alcançado;
`missao_comite_avaliacao_ck` garante a assimetria no banco.

**Os textos deste módulo estão acentuados**, como os de toda a API desde
2026-09-09 — ver `AGENTS.md` §7. Nenhum documento de
encerramento foi semeado: quais a PROPESP exige é política institucional, e a
lista é dado.

---

## Relato, dossiê e fila de análise (CG-046, CG-047, CG-048)

**O relato da missão (CG-046)** são **dois** formulários no Resumo, e a
separação é decisão de 2026-09-06: o relato edita o planejado e um botão à
parte acrescenta a parada extra. Os dois usam o mesmo `PATCH .../relato`, e
isso só funciona porque a API **insere** atividade não prevista em vez de
reconciliar — o relato manda `atividadesNaoPrevistas: []` sem apagar as
existentes, e a extra manda `atividades: []` sem tocar nas planejadas.
**O formulário da extra reenvia o relato atual inalterado**, porque o
endpoint exige `relatoGeral` e mandar vazio apagaria o texto; por isso o botão
só aparece depois que há relato. A justificativa da avaliação some no `SIM` no
payload, e não só na tela: o valor digitado antes continua no estado do React
Hook Form. `AtividadeMissao.status` é o enum nos dois lados, não `string`.

**O dossiê do relator (CG-048)** ocupa a aba Análise: "O que será analisado"
(objetivo, período, redes, participantes e roteiro, reusando as linhas do
Resumo), "Documentos anexados" (os arquivos, ao lado do checklist que diz o
que a política exige — são perguntas diferentes) e **"Alterações desde a
última decisão"**, que trouxe `missao.historico` para a tela pela primeira
vez. **A janela tem duas bordas:** da última decisão até o reenvio. Sem a de
baixo, a rodada já lida volta à lista; sem a de cima, entram mudanças
posteriores ao envio, que são de **execução** e não da proposta — os dois
eixos são independentes (CG-006) e a missão avança enquanto a análise corre.
**O corte é por tempo, não por lista de campos**, que envelheceria em
silêncio. A lógica vive em `lib/formularios/alteracoes-analise.ts` porque
`node --test` não carrega `.tsx`.

**A fila de análise (CG-047)** é a quarta aba da P17 (`?aba=analise`). **O que
define a fila é a rodada aberta** (`encerrada_em is null`), não o
`status_aprovacao` sozinho: os dois andam juntos hoje, mas quem responde
"aguarda decisão desde quando" é a rodada. Ela reusa `listar` com dois filtros
novos (`statusAprovacao` e `rodada`) — um serviço próprio duplicaria a
superfície de filtro e divergiria na primeira mudança. **`rodada` casa com a
rodada em aberto, nunca com a encerrada:** missão devolvida para ajustes
aguarda quem a reenvie, não o Comitê. "Análise" e "reanálise" não são estados,
são o número da rodada. `diasEsperando` conta dias civis em `America/Manaus`
(`diasDesde`), e o destaque cai em **7 dias** porque a reunião é semanal —
passar disso significa que a missão atravessou uma reunião. A fila carrega no
máximo 100 e avisa quando há mais. **O recorte por rede do critério de aceite
chegou com a CG-028** e valeu para a fila sem uma linha de mudança, porque ela
usa o mesmo `listar` — era o que essa decisão comprava.

---

## Fotos e evidências (CG-057)

**Fotos e evidências (CG-057)** ficam numa galeria própria na aba Documentos,
separada da tabela: misturá-las faria a foto do jantar aparecer na lista dos
documentos exigidos para aprovação. Os dois critérios de aceite já vinham da
CG-051 — `podeVer` filtra `RESTRITA` na listagem **e** no download, e
substituir preserva a versão anterior. **`autoria` não é `enviado_por`:** quem
sobe o arquivo costuma ser a secretaria, e creditar a autoria a ela publicaria
o nome errado; um é rastro interno, o outro sai na galeria. Metadados (data,
local, autoria, visibilidade) valem para **toda a seleção**, porque descrevem
a ocasião e não o arquivo — e é isso que torna aceitável não pedir legenda por
foto. **Upload múltiplo é N requisições, não lote:** um lote obrigaria a
escolher entre desfazer arquivos válidos e esconder a falha; um a um, o
resultado honesto é o parcial. A foto é servida pelo próprio
`/anexos/:id/conteudo`, sem miniatura gerada — um segundo caminho para a mesma
imagem seria um segundo lugar para errar a autorização. **`RESTRITA` é visível a quem
tem `documento:read-restrito` — `admin` e Comitê Gestor — e a quem enviou**
(homologado em 2026-09-07). O Comitê entrou porque a matriz aprovada lhe dá
leitura de todos os documentos, e a regra herdada da CG-014 o deixava de fora.
A checagem era `roles.includes('admin')` dentro do serviço, papel no lugar de
permissão — o que a indireção do `AGENTS.md` §6 existe para evitar.

---

## Painel e consolidado por rede (CG-066, CG-067)

**O painel do Comitê (CG-066)** é a seção *Panorama das missões*, na aba
Visão geral, servida por `GET .../comite-gestor/painel?ano=&redeId=`.
**Nenhum número dali é novo**: cada indicador reusa as expressões da lista de
missões — situação temporal derivada de `current_date`, situação da prestação
vinda de `coalesce` sobre o `left join` —, porque dois SQL que respondem à
mesma pergunta divergem na primeira mudança e quem clica no cartão
encontraria outra contagem do lado de lá. **Todo cartão é um link** com o
filtro na URL, carregando o recorte ativo.

**O recorte é o mesmo objeto `SQL`**, montado uma vez e passado a cartões,
quebras e pendências — o critério de aceite fica garantido por construção, e
não por disciplina de quem escrever a próxima consulta. Rede entra por
`exists`, nunca por `join` (CG-016); as duas garantias foram verificadas por
mutação.

**Pendência é uma linha por missão, com todos os motivos juntos** — uma linha
por motivo faria a lista prometer mais trabalho do que existe. Cada motivo
diz de quem é a vez. São seis, todos da mesma forma (alguém precisa agir e
não agiu); prestação em preenchimento normal não entra, e missão cancelada
nunca entra. Rede que não é do ciclo **cai em "todas"**, não num painel de
zeros, que seria indistinguível de um ciclo sem missão. Parceiro é a
instituição cadastrada, nunca o nome digitado à mão; convênio conta pela
missão de origem. A página busca os aportes **antes** do painel porque é
deles que sai a lista de exercícios contra a qual o `?ano=` é conferido.

**O consolidado por rede (CG-067)** é uma tabela dentro do mesmo painel, e
não página nova — seria a terceira tela a apurar as mesmas missões, e a
terceira a divergir. Cada rede traz missões, países, parceiros, eventos,
convênios, produtos e despesa (validada e lançada em colunas separadas).
**A linha "Total do ciclo" não é a soma da coluna, e a tela diz isso**: a
missão de duas redes pertence às duas, e o total vem de um cômputo próprio
sobre o recorte inteiro. Na prática as linhas somam 3 missões onde o total diz
2 — sem o aviso, quem confere na calculadora acha que a tela erra. Contagem de
alcance é `distinct`, e **dinheiro nunca passa por `join missao_rede`**
(verificado por mutação). **Evento é contado pelo nome informado na
atividade**, com espaços e caixa normalizados: D-10 deixou o cadastro de
evento para a F2, então o mesmo congresso escrito de duas formas conta duas
vezes — e o aviso viaja junto com o dado.

---

## Relatórios, exportações e dossiê (CG-068, CG-069)

**Os relatórios estratégicos (CG-068)** são a aba *Relatórios* da P17 e
`GET .../comite-gestor/relatorios/{missoes|parceiros|financas|resultados}`.
**Não existe uma segunda origem**, e é isso que o critério de aceite exige: o
filtro dos relatórios **é** o da lista (`filtroMissoesSchema` menos a
paginação), o relatório de missões chama `listar`, e os outros três partem de
`condicaoDoRecorte` — a mesma função que monta o `where` da lista, extraída
dela para isso. Verificado por mutação e cruzado com a CG-055: o `validado` do
relatório financeiro bate com o da execução orçamentária, apurados por
caminhos diferentes. `totais.missoes` é `pagina.total`, **nunca**
`resumo.total` — o resumo responde só ao escopo porque conta *por* status.
Instituição digitada à mão não vira parceiro mas aparece em "sem cadastro":
contá-la infla, escondê-la faz o número parecer completo. O teto de linhas do
relatório não é o `tamanho` da lista, que protege a tabela do browser.
Finanças usa `prestacao:read`, e não `missao:read`.

**Exportações e dossiê (CG-069)** saem por
`.../relatorios/:qual/exportacao/:formato` e `.../missoes/:id/dossie`.
**Síncronas e sem gravar em disco** — não há o que expirar nem o que varrer, e
não sobra exportação no servidor para ser servida depois a quem não podia
vê-la. **A autorização é a da própria consulta**: cada exportação chama o
mesmo serviço da tela, com o mesmo usuário e recorte. **Fórmula é neutralizada
na escrita** (`=`, `+`, `-`, `@`, tab, CR ganham aspa simples), nunca na
leitura — o arquivo já saiu. O **XLSX é escrito à mão** (ZIP + OOXML) para não
trazer `exceljs`, e é validado abrindo no LibreOffice. O **PDF usa duas
bibliotecas com papéis distintos**: `pdfkit` desenha, `pdf-lib` concatena os
anexos — é a concatenação que torna "PDF único" verdade. Anexo corrompido é
pulado e volta em `X-Anexos-Ignorados`. **Use `resposta.send`, nunca
`return`:** com `@Res({ passthrough: true })` o Nest serializa o `Buffer` como
JSON e o arquivo baixado fica inútil, com os cabeçalhos ainda corretos. E
**asserção sobre bytes de PDF passa por vácuo**, porque pdfkit comprime o
texto: extraia com `pdftotext`.

---

## Notificações (D-11 / CG-039)

**Notificações (D-11 / CG-039)** são um **outbox durável** mais a caixa de
entrada em `/avisos` — fora de `programas/[programa]/[ciclo]`, porque o aviso
é da pessoa e sobrevive ao ciclo. **A notificação é gravada na mesma transação
do fato**: é o que faz a decisão nunca depender do canal de aviso. **Não há
e-mail** enquanto não houver servidor SMTP, e por isso as notificações nascem
`NAO_APLICAVEL` — se nascessem `PENDENTE`, ligar o e-mail um dia despejaria
meses de aviso atrasado de uma vez. **Falha de canal mantém `PENDENTE`, nunca
`FALHOU`:** marcar falha transformaria indisponibilidade momentânea em aviso
perdido. "Viagem encerrada sem prestação" é varrido ao abrir a caixa, com o
critério do painel, e a idempotência vem do índice parcial
`notificacao_pendencia_uk` — não de checar antes do insert. Envio de prestação
**não** notifica: caixa que avisa de tudo vira ruído. Decisão concorrente
responde **409**, traduzido do código `23505` e não da mensagem.

**Missão encerrada não volta a "resposta indefinida" (CG-059).** Encerrar
afirma que os requisitos foram atendidos, e o checklist é recalculado a cada
leitura — remover o único produto depois faria a afirmação virar mentira em
silêncio, deixando uma missão fechada exibindo pendência. **O congelamento é
só o necessário:** recusa-se a operação que *zera a resposta* (remover o
último produto sem declaração, ou limpar a declaração sem produto).
Cadastrar, editar e remover um entre vários continuam liberados numa missão
encerrada — o artigo publicado meses depois da viagem é o caso normal, e
travar tudo empurraria o registro para fora do sistema. A saída é reabrir a
missão, que deixa rastro de quem autorizou. Duas regras relacionadas: **missão
que não aconteceu encerra** (roteiro inteiro `NAO_REALIZADA` é roteiro
relatado; quem registra o fracasso é a avaliação `NAO`), e **missão cancelada
não encerra** — com `pendencias` vazio, porque é impedimento, não pendência.

**Cuidado ao criar helper para uma tela:** função exportada de módulo
`"use client"` não pode ser chamada pelo Server Component. O build passa e a
página responde 500 — foi o que aconteceu com as categorias de documento por
tipo de despesa, hoje em
[documentos-despesa.ts](../../apps/web/src/lib/formularios/documentos-despesa.ts).
Lógica que os dois lados usam vai num `.ts` neutro.

---

## Escopo por rede (CG-028) e o que ficou avisado

**Os papéis `gestor-rede` e `comite-gestor` já podem ser atribuídos**
(CG-028, 2026-09-07): missões, painel, formulário e documentos consultam o
escopo por rede. Um `gestor-rede` **sem vínculo de equipe vê lista vazia** —
não o ciclo inteiro —, e é assim que a PROPESP descobre que falta cadastrar o
vínculo. `comite-gestor` perdeu `prestacao:review`: a matriz aprovada reserva
a validação da prestação ao Administrador.

**Não iniciar a antiga CG-045:** obter o aceite
institucional de CG-005 a CG-009 antes de alterar novamente o contrato da
missão. O PDF não substitui silenciosamente as decisões confirmadas.


---

## Escopo por rede nas missões (CG-028), na íntegra

Saiu do `AGENTS.md` §6 na reorganização de 2026-09-22; lá ficou a versão curta.


**Escopo por rede no módulo de missões (CG-028).** Desde 2026-09-07 o recorte
vale para missões, e não só para PPGs. Três coisas o definem:

1. **"Minha rede" é o alcance de `missao:read`** — desde V1-012, e não mais o
   vínculo de equipe, que virou fato de cadastro sem efeito de acesso.
2. **"Ver todas as redes" é concessão, não permissão.** `missao:all-redes` não
   existe mais: quem decide sobre as três redes tem `missao:read` em `GLOBAL`, e
   concessão por ciclo alcança as redes daquele ciclo. Isso não concede escrita
   nenhuma — a escrita é outra ação, com o seu próprio alcance.
3. **Missão sem rede cadastrada** (anteriores à CG-016) só aparece para quem não
   é recortado; é o que `RecorteDeMissoes.semRecorte` responde.

O recorte de leitura de **uma** missão é o `EscopoMissaoGuard`, global: as
rotas de missão têm todas a mesma forma, e verificação espalhada por serviço é
verificação que a próxima rota esquece. Ele responde **404, nunca 403**. A
**listagem** continua se recortando na consulta. A **escrita** é separada:
`validarRedes` recusa criar ou mover missão para rede alheia, e retirar de uma
missão multirrede a rede que você não alcança é 403. **Documento herda o escopo
do alvo**, senão o anexo seria a porta lateral do recorte.
