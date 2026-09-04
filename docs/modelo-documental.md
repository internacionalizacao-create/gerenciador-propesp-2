# Modelo documental e armazenamento (CG-014)

Decisão registrada em 2026-09-02, antes de implementar upload (CG-051), como
manda o critério de aceite da CG-014.

Três origens alimentam este documento, e vale distinguir de onde vem cada
decisão, porque o peso é diferente:

- **O documento da equipe de orçamento** (*Módulo de Gestão de Missões, Comitê
  Gestor, Parceiros e Resultados*) — é demanda, não sugestão. Onde ele decide,
  seguimos.
- **Decisões técnicas** tomadas aqui, que ele não menciona e que não são escolha
  institucional: chave de armazenamento, integridade, versionamento.
- **Pendências institucionais** — retenção, backup e visibilidade. Estão
  propostas com um padrão, mas precisam de confirmação (ver §7).

---

## 1. A tabela `anexo` evolui; não nasce uma segunda

Hoje `anexo` guarda nome, mime, tamanho, caminho, `entidade_tipo`/`entidade_id`
e quem enviou. Ela já é usada por instituições parceiras, e a conciliação da
CG-025 já transfere anexos entre cadastros.

**Decisão: evoluir esta tabela, não criar `documento_missao` ao lado.** Uma
segunda tabela obrigaria toda consulta de documento a perguntar em dois lugares
e a decidir, caso a caso, qual delas vale — e a conciliação de parceiros teria de
transferir os dois. O `entidade_tipo`/`entidade_id` já resolve o vínculo
polimórfico que a §36 do documento desenha (documentos pendurados em missão,
prestação, produtos, fotos e evidências).

O custo dessa escolha é conhecido: `entidade_id` não tem chave estrangeira, então
o banco não impede um `id` órfão. É o preço do polimorfismo, e o mitigamos com
o `entidade_tipo` fechado por enum (§3) mais verificação no serviço.

---

## 2. Categorias — vêm do documento, não inventadas

O documento define três conjuntos, e eles são **distintos de propósito**:

| Conjunto | Onde | Valores |
|---|---|---|
| Documentos da missão (pré-aprovação) | §15 | Projeto, Convite, Programação, Justificativa, Orçamento, Outros |
| Fotos | §27 | Reuniões, Evento, Visitas, Assinaturas, Instituições, Participantes, Outros |
| Evidências documentais | §28 | Certificados, Programações, Atas, Notícias, Publicações, Apresentações, Lista de presença, Convites, Declarações, Outros |

Somam-se os comprovantes da prestação (§21–24): passagem, bilhete, comprovante,
nota fiscal, comprovante de diárias e o PDF de cada cotação (§22).

**Decisão: uma única coluna `categoria`, com o vocabulário da união dos
conjuntos.** Separar em três colunas exigiria saber de antemão qual delas ler, e
o que distingue uma foto de uma evidência já é a categoria em si — não precisa de
um segundo campo dizendo a mesma coisa.

---

## 3. Vínculos

`entidade_tipo` passa a ser fechado, com os alvos que a §36 desenha e as tasks
preveem:

```
MISSAO_COMITE · ATIVIDADE_MISSAO · PRESTACAO_CONTAS_MISSAO · DESPESA_MISSAO
COTACAO_PASSAGEM · PRODUTO_MISSAO · CONVENIO · INSTITUICAO · SUBMISSAO_MISSAO
DECISAO_COMITE
```

Fechar o vocabulário é o que permite a checagem de existência no serviço e
impede que um `entidade_tipo` escrito errado esconda o documento para sempre.

**Documentos analisados em cada parecer (§19).** O documento exige que a decisão
registre *quais* documentos foram analisados, e que nada seja apagado do
histórico. Isso **não** é `entidade_tipo = 'DECISAO_COMITE'`: o documento
pertence à missão e é apenas *citado* pela decisão. Portanto entra como tabela de
ligação `decisao_documento (decisao_id, anexo_id)` na CG-019 — se fosse vínculo
direto, anexar um documento novo depois mudaria retroativamente o que o parecer
diz ter analisado.

---

## 4. Campos novos

| Campo | Por quê |
|---|---|
| `categoria` | §2 acima. |
| `chave_armazenamento` | Identificador opaco no storage, gerado pelo sistema. **Não** é o nome do arquivo: nome enviado pelo usuário vira caminho previsível e vaza informação (nome de bolsista, número de processo). |
| `hash_sha256` | Integridade. Permite provar que o arquivo não mudou e detectar duplicata exata antes de gravar de novo. |
| `versao` + `substitui_id` | §5 abaixo. |
| `enviado_por_id` | Hoje só existe `enviado_por` como texto. Para auditoria séria é preciso o `sub` do usuário, não um nome que muda. |
| `legenda`, `data_evidencia`, `local_evidencia` | Exigidos pela §27 para a galeria. Ficam nulos fora dela. |
| `visibilidade` | §7 — pendente de confirmação. |

`tamanho` e `mime_type` já existem e continuam.

---

## 5. Versionamento: substituir sem apagar

**Decisão: substituição cria uma linha nova apontando para a anterior
(`substitui_id`), e a anterior permanece.** A CG-057 exige que "substituição
preserve a versão anterior", e o §19 exige que o histórico de decisão não seja
apagado — se o arquivo que o Comitê analisou pudesse ser sobrescrito, o parecer
passaria a citar um documento que ninguém mais consegue ver.

A consulta padrão devolve só a versão corrente (a que ninguém substituiu); o
histórico é explícito.

**Não há exclusão de documento**, pela mesma razão que não há exclusão de parceiro
nem de contato: a saída é inativar.

---

## 6. Armazenamento

| | Desenvolvimento | Produção |
|---|---|---|
| Local | Disco do container, volume nomeado | A definir pela infraestrutura da UEA — object storage compatível com S3 é o alvo |
| Caminho | `arquivos/<ano>/<uuid>` | idem, como chave do bucket |
| Acesso | Sempre pela API, nunca URL pública | idem |

**Decisão: o arquivo nunca é servido por URL estática.** Todo download passa por
endpoint autenticado que checa permissão e devolve o conteúdo. Servir por caminho
público transformaria "quem conhece a URL" em permissão de leitura, e há dado
pessoal aqui (bilhete com nome, lista de presença, declaração).

Por isso a `chave_armazenamento` é opaca: mesmo que um caminho vaze, ele não
revela de quem é o documento nem permite adivinhar o vizinho.

**Formatos aceitos (§15, homologado na CG-009):** PDF, JPG, PNG, DOC/DOCX,
XLS/XLSX. A validação é por **conteúdo**, não só pela extensão — extensão é
sugestão do cliente, e aceitar `.pdf` sem olhar os bytes é como confiar no
`Content-Type` que o browser mandou.

**Tamanho máximo proposto: 25 MB por arquivo.** O documento não fala em limite.
25 MB acomoda PDF digitalizado e foto de celular sem virar depósito de vídeo.

---

## 7. Pendências institucionais

Estas três não são escolha técnica e ficam propostas, não decididas:

1. **Retenção.** Por quanto tempo o documento precisa ser guardado depois do
   encerramento da missão? A prestação de contas costuma ter prazo legal, e ele
   define se há descarte programado ou guarda permanente. **Proposta: guarda
   permanente enquanto o ciclo existir**, que é o comportamento seguro na
   ausência de regra.
2. **Backup.** Frequência e retenção das cópias, e se o storage de produção já
   provê versionamento próprio. Depende da infraestrutura da UEA.
3. **Visibilidade.** O documento não classifica documento por sigilo. **Proposta:
   dois níveis — `INTERNA` (padrão; quem tem permissão no módulo vê) e
   `RESTRITA` (só administrador e quem enviou)**, aplicada a documentos com dado
   pessoal sensível. A CG-057 exige que "galeria não exponha arquivo privado", e
   sem algum eixo de visibilidade essa exigência não tem como ser cumprida.

Enquanto não houver decisão, a CG-051 implementa a proposta acima e o campo fica
pronto para receber a regra definitiva.

---

## 8. Reflexo nas tasks

- **CG-051** implementa upload/download com esta estrutura, a validação por
  conteúdo e o endpoint autenticado.
- **CG-052** liga documento a despesa por `entidade_tipo = 'DESPESA_MISSAO'` e
  `'COTACAO_PASSAGEM'` — a cotação tem PDF próprio (§22).
- **CG-019** cria `decisao_documento`, pelo motivo do §3.
- **CG-057** usa `categoria`, `legenda`, `data_evidencia`, `local_evidencia` e
  `visibilidade`.
- **CG-061** cobre a segurança: extensão mentindo sobre o conteúdo, acesso sem
  permissão e URL adivinhada.
