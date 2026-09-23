# Histórico — Núcleo de planejamento, catálogo e P10

Saiu do `AGENTS.md` na reorganização de 2026-09-22: modelo de dados, seed,
serviços de cálculo, cadastro institucional, orçamento anual, a P10 e a
administração da participação PPG–temática (V1-034). Justificativas inteiras.

---

## Modelo de dados, seed e serviços

### Modelo de dados

**Modelo de dados**: 56 tabelas em 16 módulos de schema Drizzle
([apps/api/src/database/schema/](../../apps/api/src/database/schema/)), com migrations.
Segue [system-structl.md](../../system-structl.md) §4.
### Seed com os dados reais

**Seed com os dados reais** das planilhas e respostas formais
([apps/api/src/database/seed/](../../apps/api/src/database/seed/)): 24 PPGs, 60 itens
de catálogo, 23 linhas de plano (18 aprovadas, 4 UFMG pendentes e 1 cancelada),
48 orçamentos anuais e 14 pendências históricas (5 abertas).
**A produção passou a subir só com a base estrutural** (decisão de 2026-09-18,
que substitui a de 2026-09-08): plano, equipes e pendências ficam para a
equipe cadastrar pela interface. Os dados da planilha continuam no código e
entram com `--com-dados`, que é como o teste de aceite segue valendo contra
eles. As correções confirmadas depois da
extração ficam em
[dados-capes-global.ts](../../apps/api/src/database/seed/dados-capes-global.ts), e
não no arquivo gerado pelo `extrair-planilhas.py`: uma nova extração não pode
apagar decisão de negócio que não estava na planilha.
### Serviços de cálculo

**Serviços de cálculo**: RN-01 a RN-20 em
[apps/api/src/dominio/](../../apps/api/src/dominio/), todos em SQL e sem nenhum
derivado persistido. A API expõe programas, ciclo, redes, temáticas, orçamento,
plano, bolsas concedidas e produtos individuais, comitê gestor, premissas,
PPGs, pendências e catálogo.
### Telas de planejamento

**Telas de planejamento**: P01, P05, P06, P07, P08, P09, P10, P14, P15,
P17, Parceiros e as configurações da conta. Cadastro de PPG e de linha de plano em
sidesheet com formulário em etapas.
### Cadastro institucional é do `admin`

**Cadastro institucional é do `admin`** (decisão de 2026-09-08). Catálogo de
bolsas, modalidades e PPGs têm cadastro e edição pela interface, e as três
telas escondem os botões de quem não tem a permissão. `ppg:write` **saiu do
`coordenador`** na mesma decisão: renomear ou reenquadrar um PPG mexe no
recorte de quem vê o quê e no plano de todos que apontam para ele.
- **Publicar item de catálogo é livre; alterar item em uso não é.** Se a
    combinação (destino, modalidade, vigência) não existia, nenhuma linha de
    plano podia estar usando-a — item novo não muda custo nenhum já calculado,
    e é ele que destrava o cadastro manual da composição, que antes morria no
    422 de RN-01 sem saída que não fosse migração. Já um item citado por linha
    de plano tem destino, modalidade, vigência e valor **travados**: reescrever
    o preço mudaria, em silêncio, o custo de um planejamento aprovado — é para
    isso que a tabela é versionada. Fonte, observação e valor em dólar seguem
    editáveis porque nenhum cálculo os lê. A tela mostra a contagem de usos
    antes de abrir o formulário, e o campo travado vira texto em vez de input
    desabilitado (React Hook Form devolve `undefined` para campo desabilitado, e
    o payload chegaria sem destino nem valor).
- Não há exclusão de item **em uso**, só do que nunca foi usado — o erro de
    digitação recém-cometido. Modalidade não se exclui nunca: `ativa = false`.
- `permiteBrasil`/`permiteExterior` continuam **derivados do catálogo**, e o
    serviço os atualiza ao publicar o primeiro item de cada destino. Marcá-los à
    mão ofereceria, na P10, combinação que `resolverItem` recusaria depois.
### P13 não tem mais tela

**P13 não tem mais tela** (decisão de 2026-09-08). O alerta *Pendências em
aberto* da P01 sobreviveu à remoção apontando para `/pendencias` e virou um
card que levava a 404; saiu em 2026-09-09, e o indicador homônimo saiu em
2026-09-10 — contagem que não abre em lugar nenhum. As pendências continuam na
seed, no banco e na API (`GET/POST /:programa/:ciclo/pendencias`,
`PATCH /pendencias/:id`) para consulta e resolução; o que saiu foi a página,
o item de menu e o cartão do painel do ciclo. O smoke de login usa `/ppgs`
como rota protegida de referência.
### Edição anual de orçamento

**Edição anual de orçamento**: P09 permite ao `admin` alterar as três rubricas
de uma área temática em um exercício, registrar fonte, situação, justificativa
e auditoria por campo. O consolidado da rede continua calculado.
### Premissas e fontes internas (antiga P16)

**Premissas e fontes internas (antiga P16)**: a página foi retirada da interface.
Tabelas, seed e endpoint permanecem para rastreabilidade e futuro uso em P22;
decisões confirmadas ficam em [system-structl.md](../../system-structl.md).

---

## P10, participação PPG–temática e edição de linha

Na P10, a leitura segue `programa → rede → temática → PPG`. A rota `.../plano`
tem a aba **Visão geral** e uma aba por rede, persistida em `?rede=`; não crie
rotas ou serviços duplicados para cada rede. Cada participação PPG–temática
aponta para um `coordenadorTematicaId`; uma pessoa pode coordenar vários PPGs e
uma temática pode ter coordenadores diferentes conforme o PPG. O termo de
interface é **Coordenador de Temática**, não “membro do comitê”.

**A participação PPG–temática passou a ser administrada pela tela (V1-034,
2026-09-20)**, na página da temática: associar, editar e remover, com as
permissões institucionais `participacao:create`, `:edit` e `:delete`. O escopo é
`GLOBAL` pelo mesmo argumento que tirou `ppg:write` do coordenador — **a
participação é ela própria alvo de concessão**, e quem a cria decide, de lado, o
que outras contas passam a alcançar. Três regras que a implementação ingênua
erra:

1. **Remover é recusado quando há concessão apontando para o vínculo**, ativa ou
   já revogada, porque `concessao_acesso.participacao_id` é **`on delete
   cascade`**: o `delete` apagaria as concessões dentro do banco, sem trilha e
   sem ninguém ter revogado nada — inclusive as revogadas, que são o único
   registro de quem teve aquele acesso. A saída para o vínculo que já teve
   concessão é marcá-lo *não contemplado* na edição.
2. **Trocar o responsável não transfere acesso.** Quem sai continua com o que
   lhe foi concedido, e quem entra continua sem nada — são duas perguntas
   separadas desde a V1-012. A troca grava auditoria por campo.
3. **A edição não troca o PPG**, pela mesma razão do item de catálogo em uso: a
   linha de plano que aponta para o par antigo passaria a descrever um programa
   que ninguém decidiu.

**Armadilha de SQL que ficou documentada no código:** dentro de um `sql` cru, o
Drizzle emite a coluna interpolada **sem o nome da tabela**. Numa subconsulta
correlacionada, `pp.ppg_id = ${s.ppg.id}` vira `pp.ppg_id = "id"` e casa com o
`id` da tabela interna — a condição responde sempre `false`, em silêncio, porque
continua sendo SQL válido. Qualifique a coluna externa à mão.

Edição de linha
existente exige `plano:edit` (só `admin`), preserva código/rubrica e grava uma
entrada de auditoria por campo alterado. O exercício também fica em `?ano=`: somente
2027 vem composto; 2028–2030 começam vazios e nunca copiam a quantidade automaticamente.

---

## Cobertura de testes, como estava em 2026-09-21

### Testes

**Testes**: 280 unitários/regressões (89 API + 191 na web para toast, datas,
React Hook Form/Zod, erros do multistep, formulários de parceiro,
acessibilidade, contraste dos tokens, cálculos monetários, montagem de série
do gráfico, links do painel, pontas da mobilidade, cor das redes, caminhos
do BFF, concessão de acesso, menu por capacidade e preservação do CPF na
edição) mais 717 casos de integração em 43 suítes contra Postgres real —
entre eles os 29 dos eventos externos da V1-036/037
([eventos-externos-v1.int-spec.ts](../../apps/api/test/eventos-externos-v1.int-spec.ts)),
entre eles os 14 do recorte por ação da V1-015
([recorte-bolsas-v1.int-spec.ts](../../apps/api/test/recorte-bolsas-v1.int-spec.ts),
que confere CSV, XLSX e PDF reais para a exportação não reintroduzir o campo
que o JSON removeu), os oito dos caminhos indiretos da V1-016
([recorte-indiretos-v1.int-spec.ts](../../apps/api/test/recorte-indiretos-v1.int-spec.ts)),
os 13 da matriz cruzada da V1-020
([matriz-acesso-v1.int-spec.ts](../../apps/api/test/matriz-acesso-v1.int-spec.ts),
com dois ciclos e temática compartilhada — sem os dois ciclos o erro
cartesiano do alvo `PPG` não aparece) e os oito casos da escrita do catálogo
([catalogo.int-spec.ts](../../apps/api/test/catalogo.int-spec.ts)), incluindo a
recusa de alterar item que já custeia linha de plano. As duas garantias de não duplicação da linha
histórica do parceiro foram verificadas por mutação: trocar o `exists` +
`selectDistinct` por um `join` faz ambas falharem.
### Base de interface para o que vem

**Base de interface para o que vem**: `Recharts` com o primeiro gráfico na P09
(total previsto por rede e exercício), `Combobox` com busca para as listas
longas da CG-045, e TanStack Query sobre `/api/bff` com a lista de parceiros
como referência. O MUI e o Emotion saíram — ver §8.
- Smoke de login (`pnpm smoke:login`) e de telas (`pnpm smoke:telas`) ponta a
ponta; CI de lint/build/test.

