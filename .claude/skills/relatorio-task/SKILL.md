---
name: relatorio-task
description: Formato curto e direto para relatar o fim de uma task, o que falta nela ou uma decisão técnica pendente, com opções comparadas e recomendação baseada em mercado, segurança e escalabilidade. Use SEMPRE que concluir uma task do backlog, quando o usuário perguntar "o que falta", "o que ficou pendente", "qual o status", "o que decidir", ou quando houver uma escolha técnica a fazer (lib, arquitetura, auth, banco, deploy) em projetos web — especialmente monorepo pnpm com NestJS, Next.js e Keycloak. Use mesmo que o usuário não peça explicitamente um resumo.
---

# Relatório de Task

O usuário desenvolve com vibecoding a partir de um backlog de tasks. Relatórios longos cansam e escondem o que importa. O objetivo aqui é: **ler em 30 segundos e saber o que foi feito, o que falta e o que decidir.**

## Regras gerais

- Sem preâmbulo ("Ótimo!", "Vou resumir..."). Comece pelo cabeçalho.
- Máximo ~25 linhas por relatório. Se passar disso, corte detalhes, não informação essencial.
- Bullets de 1 linha. Nada de parágrafos explicativos.
- Não repita código que já foi escrito; cite o arquivo.
- Não explique conceitos básicos da stack (o usuário conhece NestJS, Next.js, Keycloak, pnpm).
- Escreva em português.
- Se não tiver certeza de algo (ex.: o que o mercado usa), diga "a confirmar" em vez de inventar.

Escolha o modo conforme a situação. Se houver task concluída **e** decisão pendente, use o Modo 1 e anexe o Modo 2 no final.

## Modo 1 — Task concluída / status

```
## ✅ <nome da task> — <Concluída | Parcial | Bloqueada>

**Feito**
- <entrega 1>
- <entrega 2>

**Arquivos:** `apps/api/...`, `apps/web/...`, `packages/...`

**Falta**
- 🔴 <bloqueante>
- 🟡 <importante, não bloqueia>
- ⚪ <melhoria opcional>
(ou "Nada pendente")

**Próximo passo:** <uma ação concreta>
```

Prioridades:
- 🔴 Bloqueante: impede funcionar, deploy ou gera falha de segurança.
- 🟡 Importante: dívida técnica que custa caro se esperar (testes, validação, logs).
- ⚪ Opcional: refino, DX, performance não crítica.

Omita seções vazias (exceto "Falta", que diz "Nada pendente").

## Modo 2 — Decisão técnica

Use quando existe mais de um caminho razoável. Traga 2 a 3 opções, nunca mais.

```
## ⚠️ Decisão: <tema>

**Contexto:** <1–2 linhas: por que isso precisa ser decidido agora>

| Opção | Segurança | Escalabilidade | Mercado | Esforço |
|---|---|---|---|---|
| A — <nome> | Alta | Alta | Padrão | Médio |
| B — <nome> | Média | Alta | Comum | Baixo |

**✔ Recomendo: A** — <1–2 linhas do porquê>
**Evite B se:** <condição em que B vira problema>
**Para aplicar:** <1 linha do que muda no código>
```

Colunas:
- **Segurança**: Alta / Média / Baixa (exposição de token, superfície de ataque, OWASP).
- **Escalabilidade**: aguenta múltiplas instâncias, stateless, cache, horizontal.
- **Mercado**: Padrão (o que a maioria de projetos sérios usa) / Comum / Nicho.
- **Esforço**: Baixo / Médio / Alto para implementar agora.

Critério de desempate, nesta ordem: **segurança > escalabilidade > padrão de mercado > esforço**. Em vibecoding é tentador escolher o mais rápido; só recomende a opção de menor esforço quando ela não perde em segurança.

Se a decisão for trivial ou houver claramente uma única opção correta, não monte tabela: diga "Decisão: X, porque Y" em uma linha.

Para padrões e referências da stack, consulte `references/stack-padroes.md` antes de recomendar.

## Exemplo

**Pedido:** "o que falta na task de login?"

```
## ✅ Login com Keycloak — Parcial

**Feito**
- Fluxo Authorization Code + PKCE no Next.js
- Guard JWT no NestJS validando via JWKS

**Arquivos:** `apps/web/src/auth.ts`, `apps/api/src/auth/jwt.guard.ts`

**Falta**
- 🔴 Refresh token não renova; sessão cai em 5 min
- 🟡 Roles do Keycloak não mapeadas para os guards
- ⚪ Página de erro de login customizada

**Próximo passo:** implementar rotação do refresh token no callback `jwt` do Auth.js

## ⚠️ Decisão: onde guardar o token no frontend

**Contexto:** necessário para corrigir a renovação de sessão.

| Opção | Segurança | Escalabilidade | Mercado | Esforço |
|---|---|---|---|---|
| A — Cookie httpOnly (sessão server-side) | Alta | Alta | Padrão | Médio |
| B — localStorage | Baixa | Alta | Nicho | Baixo |

**✔ Recomendo: A** — token fica fora do alcance de XSS e o Next.js já roda no servidor.
**Evite B se:** houver qualquer conteúdo de terceiros ou input de usuário renderizado.
**Para aplicar:** usar sessão do Auth.js com cookie httpOnly + `secure` + `sameSite=lax`.
```
