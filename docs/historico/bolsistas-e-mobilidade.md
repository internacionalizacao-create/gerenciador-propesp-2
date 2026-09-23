# Histórico — Bolsistas e mobilidade (P02, P03, P04, P18/P19, BOL-0xx)

Saiu do `AGENTS.md` na reorganização de 2026-09-22. Reúne o relato das telas de
mobilidade e do cadastro individual de bolsas, com as justificativas de desenho
e de segurança inteiras — nada foi apagado.

**O que segue valendo e mora no `AGENTS.md`**: o recorte entra na consulta e
nunca em memória; alvo fora do alcance responde 404, não 403; campo pessoal é
projetado no SQL, nunca filtrado depois. Aqui está o detalhe de cada uma.

Ver também: [../revisao-escopo-bolsistas-2026-09-09.md](../revisao-escopo-bolsistas-2026-09-09.md)
(a auditoria do escopo ampliado), [../homologacao-bolsistas.md](../homologacao-bolsistas.md)
(as sete decisões D-B01 a D-B07) e [../retencao-v1.md](../retencao-v1.md).

---

## Cadastro individual da concessão (P03)

### Recorte inicial de Bolsistas (P03)

Concessão individual a partir de uma linha planejada, com
vaga por exercício, CPF, origem e destino, datas completas, alertas temporais, regra de uma
modalidade por CPF/ciclo e cadastro/acompanhamento de produtos por pessoa. Não há
seed de beneficiários porque a planilha não os traz.
- **As duas pontas da mobilidade saem do cadastro central desde a BOL-010**
(2026-09-09). País é **sempre** do catálogo ISO; instituição vem do
catálogo **ou** digitada, espelhando `missao_atividade` — exigir catálogo
travaria o cadastro, porque a base nasce com a UEA e as três redes e quem
tem `bolsa:write` não tem `parceiro:write`. **Exatamente uma coluna por
ponta é gravada**: a FK quando veio do catálogo, o texto quando foi
digitada; gravar as duas as faria discordar na primeira conciliação
(CG-025). A leitura usa `coalesce(join, texto)`, com o join primeiro, para
que renomear ou conciliar um parceiro se propague à bolsa já registrada.
- **O destino voltou a ser digitado em 2026-09-11**, por pedido da equipe:
país e instituição de destino são dois campos de texto, sem catálogo. A
origem continua como acima. `resolverPontas` reconhece a grafia do
catálogo (sem caixa, acento nem pontuação; país também pelo código ISO de
2 ou 3 letras) e, quando coincide, grava a FK e não o texto — é o que
mantém o país no mapa e a bolsa no histórico do parceiro. O panorama
agrupa destino por `coalesce(FK, texto normalizado)`, então o digitado
entra nas quebras e o aviso "fica fora das quebras" deixou de existir.
- O formulário é o seletor com busca: país filtra **no cliente** (lista ISO
fechada, já carregada pelo Server Component) e instituição filtra **no
servidor** (`GET /bolsistas/instituicoes?busca=`, com TanStack Query), porque
o cadastro institucional existe para crescer e o filtro no cliente deixaria
de funcionar em silêncio, cortado pelo teto do serviço.
- **`GET /bolsistas/referencias` é endpoint próprio, com `bolsa:read`**, e não
um reuso de `/parceiros`: quem cadastra bolsa é `coordenador` ou
`secretaria`, e nenhum dos dois tem `parceiro:read` — que governa também os
contatos, com dados pessoais que essas funções não precisam ver para
escolher uma universidade.
- **Contexto acadêmico na concessão (BOL-011 a BOL-013)**: temática, linha de
pesquisa e orientador ficam em `bolsa_concedida`, não em `pessoa` — descrevem
*esta* bolsa, e a mesma pessoa pode ser bolsista aqui e docente em outro
programa. A API recusa linha de pesquisa de outro PPG (a FK sozinha
aceitaria). O orientador é informado por nome e criado como `DOCENTE` se não
existir: exigir cadastro prévio faria a equipe deixar o campo vazio.
Telefone e ORCID ficam em `pessoa`; o ORCID aceita `X` no último caractere,
que é o dígito verificador do padrão.
- **P03 é recortada por PPG desde a BOL-020** (2026-09-09), em leitura e em
escrita, sempre **na consulta** e nunca em memória. Concessão fora do escopo
responde **404, nunca 403**: a existência da bolsa já é o dado protegido —
dizer "existe, mas não é sua" entrega que aquela pessoa tem uma concessão.
**O produto herda o recorte da bolsa** e não tem recorte próprio; sem isso
`produto:write` seria a porta lateral, e conhecer o UUID bastaria para
escrever na bolsa de outro PPG.
- **Desde a V1-015 cada ação tem o seu próprio alcance** (2026-09-18), e o
modo permissivo acabou junto com a flag. Ler, cadastrar, editar e lançar
produto são quatro perguntas separadas: quem tem `bolsa:read` global e
`bolsa:edit` em um PPG enxerga o ciclo inteiro e só edita ali. O recorte
mora em [recorte-bolsa.ts](../../apps/api/src/auth/autorizacao-v1/recorte-bolsa.ts)
e é **uma função para todas as consultas** — a temática da concessão
prevalece, o item planejado só completa registros anteriores ao campo, e
subconsulta sem classificação vira `false` explícito, porque `NULL` dentro
de `not` e de `bool_and` passaria batido. Cobertura em
[escopo-bolsas.int-spec.ts](../../apps/api/test/escopo-bolsas.int-spec.ts) e
[recorte-bolsas-v1.int-spec.ts](../../apps/api/test/recorte-bolsas-v1.int-spec.ts).
- **Campo pessoal é projetado no SQL, nunca filtrado depois** (V1-015): CPF sai
sob `pessoa:read-cpf`, e-mail e telefone sob `pessoa:read-contato`, cada um
**cruzado com o alcance daquela bolsa**. Sem a capacidade o campo vem nulo e
um `podeLerCpf`/`podeLerContato` acompanha a linha, para a tela escrever
*Sem acesso* em vez de *Não informado* — ausência de permissão e ausência de
dado não são a mesma frase. **Não há máscara parcial**: meio CPF ainda é CPF.
- **Cadastrar CPF e ler CPF são capacidades distintas.** Quem tem
`bolsa:create` informa o CPF sem poder consultá-lo depois; na edição, CPF
não reenviado é **preservado**, e corrigir um CPF existente exige
`pessoa:edit-cpf` mais `bolsa:edit` sobre **todas** as bolsas daquela pessoa
— `pessoa` é compartilhada, e alcançar uma bolsa não autoriza reescrever a
identidade que outras usam. A correção trava a linha com `for update` e
grava auditoria por campo.
- **Duplicidade não revela cadastro alheio.** CPF repetido, e-mail de outra
pessoa e colisão concorrente (`23505`) respondem todos a **mesma** frase
genérica, pedindo revisão à equipe autorizada. Mensagens distintas seriam um
oráculo: bastaria variar o CPF até a recusa mudar de texto para descobrir
quem já está cadastrado. E-mail nunca troca a identidade de uma pessoa
existente — só o CPF identifica.

---

## Documentos do bolsista, parceiros, panorama, mapa e produção

### Documentos do bolsista (BOL-021/BOL-022, 2026-09-09)

`BOLSA_CONCEDIDA`
em `entidade_anexo`, com as categorias do bolsista e a política de
visibilidade. **A categoria decide a visibilidade, nunca o cliente** — o
serviço sobrescreve, senão bastaria enviar `INTERNA` junto de um passaporte.
Acadêmico (carta de aceite, plano de trabalho, relatório, declaração,
publicação) é `INTERNA` e segue o recorte por PPG; pessoal
(`DOCUMENTO_IDENTIDADE`, `PASSAPORTE`, `COMPROVANTE_RESIDENCIA`) é `PESSOAL`.
- **`PESSOAL` e `RESTRITA` não são níveis, são públicos diferentes.** O Comitê
Gestor abre `RESTRITA` e não abre `PESSOAL`; a `secretaria` abre `PESSOAL` e
não abre `RESTRITA`. Por isso `documento:read-pessoal` é permissão própria,
e `podeVer` mapeia visibilidade → permissão com um `if` explícito: um `||`
entre as duas daria a cada uma o alcance da outra.
- **A retenção é derivada, nunca gravada** — fim da concessão + 5 anos,
calculada na leitura. `data_fim` é editável, e coluna gravada divergiria na
primeira correção de período. **Não há expurgo automático** em lugar nenhum
do sistema; o campo torna a política conferível, executá-la é ato humano.
O inventário completo — o que se guarda, por quanto tempo e o que ainda não
tem prazo — está em [docs/retencao-v1.md](../retencao-v1.md) (V1-039),
junto com o limite honesto: **descartar um documento não o remove dos
backups anteriores**, porque um dump é retrato do banco inteiro.
- **A tela é a seção *Documentos do bolsista*** em
`/mobilidade/bolsistas/[id]`, com envio em sidesheet (RHF + Zod) e download
por `/anexos/:id/conteudo`. **Não há seletor de visibilidade** — quem decide
é a categoria, e oferecer a escolha faria quem marcasse "interna" achar que
publicou. **A tela não refiltra** o que a API já filtrou. A categoria
pessoal só é *oferecida* a quem tem `documento:read-pessoal`, e **a API
recusa o envio de quem não a tem** (homologado em 2026-09-09): enviar
documento pessoal exige a mesma permissão de abri-lo. Sem essa simetria, o
coordenador coletava passaporte de aluno que só ele próprio reabriria
depois. **403 e não 404** — a concessão é visível, o que se recusa é a ação.
- **`enviar` passou a usar `exigirAcesso`** (permissão **mais** recorte).
Antes usava só `exigir`, enquanto todas as outras operações já checavam o
recorte — quem não alcançava uma missão de outra rede conseguia *pendurar*
documento nela conhecendo o UUID. Não dava para ler de volta; dava para
injetar. A correção vale para todos os tipos de entidade.
### Relacionamento institucional (BOL-030 a BOL-033/035, 2026-09-09)

`instituicao` ganhou origem, estágio, áreas de atuação, programa relacionado e
grupo de pesquisa. **A origem é imutável** — `atualizarParceiroSchema` não a
tem, e o campo enviado a mais é descartado; reescrevê-la apagaria a memória de
como o relacionamento começou. É obrigatória no cadastro e nula no banco, para
não inventar resposta para as instituições anteriores ao campo.
- **Só três dos cinco estados do documento são gravados.** "Mobilidade
realizada" e "parceria formalizada" são **derivados** por `exists` sobre
`bolsa_concedida` e `convenio` vigente, e aparecem ao lado do estágio
declarado, nunca no lugar dele. Gravá-los criaria a divergência do dia
seguinte — a ficha dizendo "apenas identificada" sobre quem recebeu três
bolsistas. `exists` e não `join`, senão a instituição apareceria uma vez por
bolsa (CG-016).
- **O histórico de mobilidades é uma linha por concessão**, com a ponta
(recebeu/enviou) resolvida por `case`: a instituição pode ser origem *e*
destino da mesma bolsa numa dupla titulação, e um `or` dentro de `join` a
traria duas vezes.
- **Rede, temática e PPG do parceiro** (2026-09-10): a rede é a declarada em
`instituicao_rede`; temática e PPG são **derivados** das bolsas que
passaram pela instituição, em `HistoricoParceiro.vinculos`, agrupados no
banco (a página do parceiro não agrega nada) com a temática da própria
concessão vencendo a da linha de plano. Declarar os dois à mão criaria o
vínculo que diverge da primeira bolsa que o contrariar. Com P03 vazia, a
seção mostra o estado vazio — o vínculo nasce com a primeira concessão.
- **Áreas de atuação é texto livre de propósito**: sem taxonomia mantida, duas
grafias viram duas áreas e a contagem sai errada — o mesmo defeito do evento
contado pelo nome (CG-067). O campo descreve, não conta.
### Panorama de mobilidade (P02, BOL-040, 2026-09-09)

`/mobilidade` e
`GET /mobilidade/panorama`. É a tela que responde *o que a internacionalização
produziu*; a P01 responde *o plano cabe no orçamento*, e por isso as duas
coexistem. **Um filtro só, montado uma vez**, servindo cartões, sete quebras e
a série — a lição da CG-066 aplicada de saída, com regressão que falha se
alguma quebra ganhar `where` próprio. **O recorte por PPG entra no mesmo
objeto**, então nenhuma quebra pode esquecê-lo. `item_planejado` entra por
`left join` em toda consulta que precisa de rede: um `join` excluiria a bolsa
vinda de fora do planejamento. **Concessão com destino digitado à mão entra no
total e fica fora das quebras por país e instituição**, com o aviso na tela —
sem ele, quem somasse as linhas acharia que a tela erra (CG-067).
- **A P01 é um painel, não um relatório** (2026-09-10). Cinco blocos, do
geral ao detalhe, cada um respondendo uma pergunta e levando à tela onde
ela se resolve: (1) quatro KPIs com contexto — aporte, teto de bolsas
comprometido, bolsas do exercício e composições aprovadas no ciclo; (2) um
cartão por rede, com a coordenação recolhida em `<details>`; (3) o **mapa
de composição**, temáticas × exercícios, ao lado de *Precisa de ação*; (4)
bolsas por modalidade em gráfico, com a tabela em "Ver dados"; (5) a
mobilidade realizada, que sem concessões vira uma faixa discreta em vez de
gráficos zerados. O exercício é escolhido em `?ano=` (ano fora do ciclo cai
no primeiro, como no resto do ciclo).
- **O mapa de composição é a peça central.** Só 2027 vem composto, e isso
    fazia "bolsas no ano" e "bolsas no ciclo" mostrarem o mesmo 22 enquanto o
    dinheiro multiplicava por 4 — quem lia supunha "por semestre". A grade
    mostra 8 de 48 composições aprovadas e a UNICAMP sem nenhuma. É uma
    `<table>` com cabeçalho de linha e coluna, e cada estado tem símbolo e
    texto além da cor. Vem de `Painel.composicao`, derivado de
    `porTematica` — nenhum número novo.
- **Teto comprometido só sobre composição aprovada** (`uso-teto-ano`, e
    `LinhaRede.utilizacao` por rede), o mesmo recorte do saldo potencial. Pôr
    o teto da UNICAMP no denominador faria a rede pendente parecer folga, e
    os 88% de 2027 virariam 46%. A cor segue o semáforo da RN-07.
- **Rede sem composição mostra *A definir*, não R$ 0,00** — a API devolve
    custo e bolsas zerados porque não há linha, e zero leria "decidiram
    zero bolsas".
- **Não existe coordenador de rede**: a coordenação é por participação
    PPG–temática, e UNICAMP-T1 tem dois. `Painel.coordenacao` lista temática
    a temática; eleger um nome por rede esconderia os outros.
- `Painel.indicadores` continua no contrato: é a superfície do teste de
    aceite da migração. A tela escolhe os indicadores pela `chave`.
- **A P01 mostra os mesmos números** numa seção própria (BOL-041), buscando o
panorama filtrado por `cicloId` — não recalcula. **Ao lado** dos indicadores
financeiros, nunca no lugar: são perguntas diferentes, e fundi-las faria
compromisso parecer execução. O cartão se chama *Custo das bolsas
concedidas* (D-B07), nunca "executado".
- **O consolidado por rede (BOL-043)** tem método próprio, não a quebra
genérica: alcance é `distinct` e produto entra por **subconsulta**, porque
um `join` com `produto_bolsa` faria a bolsa de três produtos virar três
linhas e inflar mobilidades e valor. Concessão sem temática cai em "Sem rede
vinculada" em vez de sumir.
- **O relatório exportável (BOL-044)** usa a mesma função `condicao` do
panorama — não existe segunda origem, e a regressão cruza o total do
panorama com a contagem das linhas.
### Ata da decisão (BOL-052)

`DECISAO_COMITE` em `entidade_anexo`, aceitando
**somente** a categoria `ATA`. A exclusão anterior era sobre *documento
analisado*, que se prende à missão (CG-019); a ata é o registro do ato que a
decisão descreve. Escrever exige `missao:decide` — quem registra a decisão é
quem anexa a ata dela —, e o recorte por rede a alcança por duas junções até a
missão. **Não substitui o modelo B**: o colegiado segue deliberando fora do
sistema.
### Mapa e destinos (P04, BOL-042)

`/mobilidade/mapa`, com `react-simple-maps`
e o topojson do `world-atlas` — as duas primeiras dependências de visualização
geográfica. **O casamento é pelo código ISO 3166-1 numérico**, que `pais`
ganhou na migration `0038`, gerado da base `iso-codes` e conferido contra os
249 pares ISO2/ISO3 existentes. Casar por nome em inglês falharia em silêncio
("W. Sahara" no arquivo × "Western Sahara" no ICU), e país sem cor é
indistinguível de país sem mobilidade. **A seed virou upsert** para as linhas
antigas receberem o campo. A cor sai de `var(--token)` no SVG, nunca resolvida
em JavaScript. O SVG é `aria-hidden`: quem serve leitor de tela é a tabela.
### Produção consolidada (P18/P19, BOL-051)

`/producao` e
`GET /mobilidade/producao`. **`union all`, não `join`** — as duas tabelas de
produto não se relacionam, e o que existe é a pergunta comum. A coluna
*Origem* marca cada linha para a soma não apagar a diferença que a CG-056
preservou. Exige `bolsa:read` **e** `produto:read`; produto de missão só entra
para quem tem `missao:read`. Desde 2026-09-11 o produto de bolsa exige
**instituição e país de colaboração** (texto, migration `0039`; nulos só nos
anteriores ao campo), e a tela os mostra em colunas próprias.
### Ficha do parceiro (BOL-034)

`GET /parceiros/:id/ficha`, PDF único pelo
`gerarPdf` da CG-069. **PDF apenas**, porque a ficha é documento e não tabela.
A autorização é a da própria consulta — chama `historico`, o mesmo método da
tela. "Pesquisadores envolvidos" é deduzido das mobilidades: não há cadastro
de pesquisador da instituição, e inventá-lo criaria vínculo que ninguém
declarou. `responderArquivo` mora em
[comum/resposta-arquivo.ts](../../apps/api/src/comum/resposta-arquivo.ts) desde
então — duplicá-lo duplicaria a armadilha do `resposta.send`.

---

## O dado individual que ainda não existe, e a proposta de 2026-09-09

Bloco "Não existe ainda" do `AGENTS.md` §9, na íntegra. A versão curta ficou lá.

- **Dado individual de mobilidade.** As telas de P01 a P04, produção e
relatórios existem desde 2026-09-09, mas ficam vazias: as planilhas de origem
não trazem o beneficiário — sabe-se que há "1 bolsa de Doutorado Sanduíche de
6 meses para o PPGCLIAMB", não quem foi nem se voltou. Nada disso é bug; é a
equipe que precisa cadastrar as concessões em P03.
Em 2026-09-09 a equipe entregou a *Proposta de estruturação do módulo
Bolsistas* (8 módulos), que reescreve P01–P04, P20 e P24 sob outro
vocabulário e acrescenta origem/situação do relacionamento institucional,
histórico de mobilidade por instituição e documentos do bolsista. A auditoria
integral, as sete decisões bloqueantes e o backlog `BOL-` estão em
[docs/revisao-escopo-bolsistas-2026-09-09.md](../revisao-escopo-bolsistas-2026-09-09.md),
e a folha de homologação das sete decisões em
[docs/homologacao-bolsistas.md](../homologacao-bolsistas.md).
**As sete decisões (D-B01 a D-B07) foram homologadas em 2026-09-09**,
conforme a proposta de cada uma. As que já viraram código estão nas BOL-010,
BOL-020, BOL-021 e BOL-022; D-B04, D-B05 e D-B07 destravam trabalho ainda não
iniciado. Duas valem como regra permanente: **`bolsa_concedida` é a
mobilidade** — não existe, nem deve existir, uma tabela separada para ela —, e
**`missao_comite` não é reusada para mobilidade de bolsista**, pelo mesmo
argumento que a CG-056 registrou sobre `produto_bolsa`.
- Relatórios (P20), importação com adaptador por programa (P21) e produção
consolidada (P18/P19). Documentos e evidências (P22) existem no escopo da
missão desde a CG-051/CG-057; o que falta de P22 é fora do Comitê Gestor. O documento novo
do Comitê propõe trazer parte de P18–P20/P22 para o fluxo da missão, mas a fase
e a prioridade ainda dependem da CG-005. Produtos individuais por bolsa
continuam em P03 e **não** foram reutilizados como produto de missão: a
CG-056 criou domínio próprio (`produto_missao`), separado de `produto_bolsa`.
- Revisão de volume dos seletores de parceiro: a conciliação ainda carrega
os primeiros 200, e a detecção de duplicidade examina até 1.000 instituições
antes de comparar. A lista principal já está paginada (V1-042). Parceiros
continuam sendo catálogo compartilhado, protegido por `parceiro:read` GLOBAL;
o histórico é recortado separadamente por ação.
