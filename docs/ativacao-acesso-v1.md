# Ativação do acesso e rollback — runbook

Procedimento para pôr uma instalação nova em operação sob o regime de
autorização da V1 (**sem concessão, sem dado**) e para voltar atrás quando algo
der errado. Escrito para quem opera o servidor, não para quem escreveu o código.

Tarefa de origem: **V1-021, subtarefa e**. Ensaiado em
[`ativacao-acesso-v1.int-spec.ts`](../apps/api/test/ativacao-acesso-v1.int-spec.ts),
que executa este roteiro inteiro contra um Postgres real com contas fictícias.

> **O que este documento não é.** Ele não constitui homologação institucional,
> não autoriza publicação em ambiente da UEA e não substitui a lista nominal de
> responsáveis, que continua pendente com o responsável pelo sistema.

---

## O regime, em uma frase

O Keycloak responde **quem é a pessoa**; quem responde **o que ela pode fazer, e
sobre o quê** é a tabela `concessao_acesso`, ação a ação. Papel do token não
concede nada. Vínculo de equipe não concede nada. Conta nova entra e não vê tela
alguma — e isso é o comportamento correto, não um defeito de instalação.

**Não existe chave que reabra o sistema.** O modo permissivo saiu na V1-012 e
não voltou; qualquer procedimento aqui que pareça "desligar a restrição" está
errado por construção. Ver §6 do [AGENTS.md](../AGENTS.md).

---

## 1. Antes de começar

| Verificação | Como |
|---|---|
| Migrations aplicadas | `pnpm db:migrate` |
| Base carregada | `pnpm db:seed --reset` (ver §4 do AGENTS) |
| Realm importado | o `gerenciador` existe e autentica |
| Nenhum administrador ainda | `pnpm --filter api acesso:contas --listar` |

A última linha é a que importa: se já houver administrador recuperável, esta
**não** é uma instalação nova, e o roteiro abaixo é o errado — vá para §5.

---

## 2. O primeiro administrador

Há dois caminhos, e a escolha é de política, não de conveniência.

### 2a. Bootstrap (recomendado em produção)

```bash
# 1. a pessoa entra uma vez no sistema — é o login que cria o vínculo local
#    (o comando não cria identidade a partir de um sub digitado)
# 2. descubra o sub dela:
pnpm --filter api acesso:contas --listar
# 3. prévia, depois aplicação:
pnpm --filter api acesso:bootstrap --sub <sub> --motivo "..."
pnpm --filter api acesso:bootstrap --sub <sub> --motivo "..." --aplicar
```

Concede **apenas** `acesso:read`, `acesso:write`, `acesso:delegate` e
`acesso:manage-identidade`, em GLOBAL. Nenhuma permissão de negócio: o
administrador que sai daqui pode conceder acesso a outras pessoas, e não ganha
o plano e as bolsas de todos os PPGs de brinde.

O comando **recusa** quando já existe administrador recuperável, e sem
`--aplicar` não grava nada.

### 2b. Administrador semeado (ambientes que se recriam)

```bash
pnpm db:seed --reset --admin-sub <sub>
```

Grava a conta e o catálogo inteiro em GLOBAL. Dispensa o bootstrap, e é a
decisão de 2026-09-18 — com a ressalva registrada no AGENTS: instalação que
nasce com conta previsível de acesso total não distingue o administrador
legítimo de quem conhece o padrão. **Não use em produção** sem decidir isso
explicitamente.

---

## 3. As demais contas

Pela tela **Acessos** (`/configuracoes/acessos`), pessoa a pessoa, ação a ação.

- Os **modelos** são ponto de partida, não papéis: aplicá-los grava concessões
  explícitas, uma linha por ação, com o alcance escolhido na aplicação. Editar
  um modelo depois **não** altera quem já foi configurado.
- **Não conceda GLOBAL para evitar bloqueio.** É a tentação da primeira semana e
  desfaz o recorte que a V1 existe para ter. Se alguém está bloqueado, o certo é
  conceder a ação que falta no alcance certo — a própria tela diz qual é.
- Ninguém amplia o próprio acesso: mexer em `acesso:*` exige `write` **e**
  `delegate`, e autoalteração é recusada. Por isso a configuração inicial precisa
  de **duas pessoas**, e não é burocracia do roteiro — é a regra que impede
  `acesso:write` de virar acesso a tudo em dois passos.

---

## 4. Retirar as contas de demonstração

**A ordem importa, e o comando a impõe.**

```bash
pnpm --filter api acesso:contas --listar
pnpm --filter api acesso:contas --sub <a> --sub <b> --motivo "..."            # prévia
pnpm --filter api acesso:contas --sub <a> --sub <b> --motivo "..." --aplicar
```

Desativar a conta fecha tudo de uma vez, `acesso:*` incluído. Por isso o comando
**recusa desativar o último administrador recuperável**: "desligar a
demonstração" numa sexta-feira é o tipo de ato que só aparece na segunda, quando
ninguém mais entra. Configure o administrador definitivo primeiro.

As **concessões não são revogadas** junto: desativar já fecha o acesso, e
apagá-las tiraria exatamente o que uma reativação precisa devolver intacto.

Um `--sub` digitado errado **recusa o lote inteiro**, em vez de seguir com o
resto: errar o identificador significa que o operador mirou noutra conta.

---

## 5. Rollback

A regra que governa esta seção inteira: **o rollback preserva a restrição.**
Voltar atrás nunca pode ser mais permissivo do que o começo. Não existe, e não
deve passar a existir, um procedimento que reabra a leitura para todos enquanto
o problema é investigado.

### 5a. Concedi demais a alguém

Revogue a concessão pela tela de Acessos. **Vale na requisição seguinte** — não
há cache de autorização e não é preciso esperar o token expirar nem derrubar a
sessão da pessoa.

### 5b. Revoguei demais e a equipe parou

Reconceda pela tela, com o alcance certo. Reconceder **reativa a mesma linha**,
não cria outra: os índices de unicidade cobrem a linha inativa de propósito,
para a consulta de acesso nunca precisar escolher entre versões da mesma
concessão. A história do vaivém fica em `registro_auditoria`.

### 5c. Desativei a conta errada

```bash
pnpm --filter api acesso:contas --sub <sub> --motivo "..." --reativar --aplicar
```

As concessões voltam intactas, porque nunca foram apagadas.

### 5d. Ficamos sem nenhum administrador

É o pior caso, e tem saída — desde que alguém tenha acesso ao servidor.

```bash
pnpm --filter api acesso:bootstrap --sub <sub> --motivo "..." --recuperacao --aplicar
```

Duas coisas que a recuperação **não** faz, e a recusa é deliberada em ambas:

- **não reativa conta inativa** — senão desativar uma conta viraria sugestão,
  desfeita por quem rodasse o outro comando;
- **não cria identidade** — a conta precisa ter entrado uma vez; fabricar
  vínculo a partir de um `sub` digitado é como se toma identidade alheia.

Enquanto isso não é feito, o sistema **segue fechado**. Não há modo aberto
temporário, e a ausência dele é o desenho.

### 5e. Voltar a versão do sistema

Se o rollback for de código e não de acesso, `concessao_acesso` e
`usuario_sistema` são dados — não voltam com o deploy. Um rollback de versão
preserva o acesso configurado, que é o que se quer: reconfigurar tudo a cada
volta atrás é onde se erra.

---

## 6. Depois de ativar

- `pnpm smoke:acesso` — prova que duas contas com recortes diferentes veem
  coisas diferentes, pela sessão real, e que revogar vale na requisição
  seguinte. Não depende do volume da seed.
- **O smoke nominal**, com as pessoas reais, depende da lista do responsável e
  do ambiente autorizado. Continua pendente, e é a última coisa entre este
  roteiro e a ativação de fato.
- Confira a trilha: cada bootstrap, recuperação e desativação grava em
  `registro_auditoria` com o operador do sistema operacional e o motivo.

---

## Por que os comandos não têm rota HTTP

Bootstrap, recuperação e desativação de conta existem **só** como comando local,
e não como tela. A barreira é o acesso ao servidor: quem consegue rodá-los já
podia alterar as linhas à mão, e a diferença é que aqui o ato fica registrado,
limitado ao que o comando concede e conferido antes de aplicar. Uma rota
equivalente transformaria "conhecer a URL certa" em caminho para criar
administrador.
