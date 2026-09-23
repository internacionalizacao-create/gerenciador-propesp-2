# Guia de interface — tema, componentes e convenções da `web`

Contrato **vivo** da interface. Saiu do `AGENTS.md` §8 na reorganização de
2026-09-22, inteiro: o `AGENTS.md` guarda só a lista curta do que não pode
regredir, e o detalhe — com o porquê de cada regra — está aqui.

Ver também: [migracao-ui.md](migracao-ui.md) (o inventário da biblioteca local
de UI e o que ainda falta migrar) e [validacao-telas.md](validacao-telas.md)
(a conferência tela a tela contra a especificação).

---

## Tema e tokens

O tema institucional (verde floresta, claro/escuro) já existe em
[apps/web/src/app/globals.css](../apps/web/src/app/globals.css), com tokens
semânticos: `bg-surface`, `text-muted`, `border-border-strong`, `bg-danger-soft` +
`text-on-danger-soft` etc.

- **Use sempre o token semântico, nunca o hex nem cor crua do Tailwind.**
- Na P10, as redes usam `network-1`, `network-2` e `network-3` como identidade
  de navegação. Esses tons não representam estado; alerta continua usando os
  tokens `warning`/`danger`/`info` apropriados.
- O Tailwind 4 escaneia o texto do fonte: classes montadas dinamicamente
  (`bg-${cor}`) não geram CSS. Escreva por extenso.
- A troca de tema roda antes da primeira pintura via script inline em
  [layout.tsx](../apps/web/src/app/layout.tsx), para não piscar.
- `ThemeSynchronizer`, montado no layout raiz, acompanha mudanças do tema do
  sistema operacional quando a preferência salva é `system`; esse listener não
  deve ficar condicionado à presença visual do seletor.
- **Gráficos são Recharts.** O MUI saiu inteiro (`@mui/material`,
  `@mui/x-charts`, `@mui/material-nextjs` e os três pacotes do Emotion): estava
  instalado desde o começo e nunca desenhou um gráfico — o único import em todo
  o `src` era o `AppRouterCacheProvider`. Com ele foi embora a camada CSS `mui`
  do `globals.css` e o segundo sistema de estilo.
- A base fica em [ui/grafico.tsx](../apps/web/src/componentes/ui/grafico.tsx), e
  cada gráfico em `componentes/graficos/`. **Passe a cor como `var(--token)`
  direto no SVG**, nunca resolvida em JavaScript: assim a troca de tema repinta
  sozinha, enquanto um `getComputedStyle` na montagem congelaria a cor do tema
  que estava ativo. **A cor de uma rede sai do nome, nunca da posição**:
  `identidadeDaRede` em [lib/redes.ts](../apps/web/src/lib/redes.ts) dá à rede a
  mesma cor na P10, na P09 e na P01, junto com `chaveDaRede` (o `?rede=`). Até
  2026-09-10 o gráfico da P09 coloria pelo índice e, em ordem alfabética, dava
  à UFMG a cor que a P10 dá à UNESP. O resto usa `CORES_SERIE`.
- **Valor nulo não vira barra zerada.** `null` chega ao Recharts como `null` e
  desenha um vazio — é a mesma regra do componente `Moeda` (§9.2 da [especificação](../system-structl.md)), e num gráfico ela importa mais, porque barra rente ao eixo é
  indistinguível de orçamento zerado. A `DicaMoeda` escreve *A definir*.
- O gráfico acompanha a tabela, não a substitui: ele mostra a forma, a tabela
  mostra o número. Só a tabela é precisa para quem usa leitor de tela.

## shadcn/ui: cópia adaptada, não dependência

O shadcn entra por cópia de código, e **os tokens dele colidem com os daqui**.
No shadcn, `muted` é fundo e o texto é `muted-foreground`; neste sistema
`--muted` **é cor de texto**. Colar um componente sem traduzir produz texto
cinza sobre fundo cinza. Traduza sempre:

| shadcn | aqui |
|---|---|
| `bg-background` / `text-foreground` | iguais, pode manter |
| `bg-card`, `bg-popover` | `bg-surface` |
| `bg-muted`, `bg-accent` | `bg-surface-muted` |
| `text-muted-foreground` | `text-muted` (ou `text-subtle`, se for secundário) |
| `border-input` | `border-border-strong` |
| `text-destructive`, `bg-destructive` | `text-danger`, `bg-danger` |
| `bg-primary text-primary-foreground` | `bg-primary text-on-primary` |
| `ring-ring` | `ring-ring` (o token existe) |

O `components.json` existe para o `npx shadcn add <x>` saber onde escrever, mas
**o componente gerado nunca entra como veio**: traduza as classes pela tabela e
troque `rounded-md` pelos raios daqui (`rounded-xl` em campo, `rounded-2xl` em
contêiner). A única peça adotada como infraestrutura é o `cn`
([lib/utils.ts](../apps/web/src/lib/utils.ts)).

Nada de migrar o que já existe: `basicos.tsx`, `campos.tsx` e o `Sidesheet`
ficam como estão. O `<dialog>` nativo continua sendo a decisão — foco preso,
`Esc` e fundo inerte vindos do navegador valem mais que a uniformidade.

## TanStack Query: só depois da primeira pintura

- **Não use para o carregamento inicial de uma tela.** Dado que o Server
  Component pode buscar continua sendo buscado lá, com `apiFetch`, sem salto
  HTTP extra nem estado de carregamento. O Query serve à interação depois:
  busca conforme se digita, filtro que não vale uma navegação.
- O cliente do browser é [lib/bff.ts](../apps/web/src/lib/bff.ts) e fala só com
  `/api/bff/*` — o token nunca chega ao JavaScript da página. **`apiFetch`
  continua `server-only`;** os dois não se misturam.
- O `QueryClient` nasce dentro de `useState`, nunca em módulo: em módulo seria
  singleton do processo do servidor e o cache de um usuário logado poderia ser
  servido ao próximo.
- O padrão está em
  [consultas/lista-parceiros.tsx](../apps/web/src/componentes/consultas/lista-parceiros.tsx):
  `initialData` recebe o que o servidor já buscou, `keepPreviousData` evita a
  tabela piscar em branco a cada tecla, e a URL continua refletindo o filtro por
  `window.history.pushState`, restaurada por `popstate` — sem isso, quem manda
  o link de uma busca mandaria a lista inteira. Retry não insiste em 4xx: 401/403 não melhoram.
- **`initialData` só vale na criação da consulta.** Depois de uma Server Action
  o servidor manda a lista nova e o cache continuaria mostrando a velha — o
  parceiro gravava e não aparecia. A lista de parceiros regrava o cache e
  invalida `["parceiros"]` quando `dadosIniciais` muda. Os formulários também
  invalidam consultas inativas após salvar. A lista usa `refetchOnMount: "always"`
  para conferir snapshots restaurados pelo histórico do Next: a primeira
  pintura continua no servidor, com uma conferência pelo BFF após montar.
- **Server Action revalida a rota real, não um apelido.** A tela de parceiros
  mora em `programas/[programa]/[ciclo]`; `revalidatePath("/parceiros")` não
  revalidava nada. Quando a ação não conhece os segmentos, use o padrão com
  o tipo: `revalidatePath("/programas/[programa]/[ciclo]/parceiros", "page")`.

## Peças de interface que valem conhecer antes de criar outras

| Peça | Onde | Para quê |
|---|---|---|
| `Sidesheet` / `AbrirSidesheet` | [ui/sidesheet.tsx](../apps/web/src/componentes/ui/sidesheet.tsx) | Todo cadastro entra por painel lateral. É `<dialog>` nativo — foco preso, `Esc`, fundo inerte e `::backdrop` vêm do navegador. O conteúdo permanece montado durante a animação de saída. |
| `RodapeDoPainel` / `CLASSE_CORPO_PAINEL` | [ui/painel-formulario.tsx](../apps/web/src/componentes/ui/painel-formulario.tsx) | Corpo rolável (`px-6 py-5`, sem `space-y`: os campos já trazem `mb-4`) e rodapé com `Botao` de todo formulário em sidesheet. Existe porque onze formulários do Comitê e do bolsista escreviam isso à mão e colavam os campos na borda. |
| `Multistep` | [ui/multistep.tsx](../apps/web/src/componentes/ui/multistep.tsx) | Formulário longo em etapas. **Todos os passos ficam montados** e o inativo usa o atributo `hidden`: só assim o `FormData` do submit traz o formulário inteiro, e campos `required` de passo oculto não travam o envio. |
| `Selecoes` | [ui/campos.tsx](../apps/web/src/componentes/ui/campos.tsx) | Grupo de caixas de seleção que devolve uma lista (as redes de uma missão, por exemplo). É `fieldset`/`legend`, e todas as caixas compartilham o `name`: o React Hook Form junta as marcadas em array e o `FormData` as devolve em `getAll`. |
| `Texto` / `Selecao` / `Data` / `AreaTexto` | [ui/campos.tsx](../apps/web/src/componentes/ui/campos.tsx) | Campos visuais aceitam `registro={register("campo")}` do React Hook Form e mantêm os tokens e mensagens acessíveis do sistema. |
| `useErrosDaAcao` | [ui/formulario.ts](../apps/web/src/componentes/ui/formulario.ts) | Reaplica os erros de campo devolvidos pela API no React Hook Form; use um mapa apenas quando o nome da API diferir do nome visual. |
| `RolagemHorizontal` | [ui/rolagem.tsx](../apps/web/src/componentes/ui/rolagem.tsx) | Envolve conteúdo que rola na horizontal — a `Tabela` já usa. Dá `tabIndex` ao contêiner **só quando ele transborda de verdade**, medido no cliente: fixo criaria parada de tabulação morta em cada tabela numa tela larga, e ausente deixa as colunas escondidas inalcançáveis pelo teclado. |
| `Combobox` / `CampoCombobox` | [ui/combobox.tsx](../apps/web/src/componentes/ui/combobox.tsx) | Seleção única **com busca**, para lista longa (as 200+ instituições da CG-045). Lista curta continua no `Selecao` nativo, que já vem acessível e não carrega JavaScript. O valor sai num `<input type="hidden">`, então o `FormData` do `Multistep` continua trazendo o campo; no React Hook Form vai por `Controller`, não por `register`. |
| `Grafico` / `DicaMoeda` | [ui/grafico.tsx](../apps/web/src/componentes/ui/grafico.tsx) | Moldura responsiva do Recharts com `<figure>`/`<figcaption>`: o SVG é uma árvore de `<path>` sem texto útil, e sem a legenda amarrada o gráfico some para quem usa leitor de tela. |
| `CartaoKpi` / `BarraDeProporcao` | [painel/kpis.tsx](../apps/web/src/componentes/painel/kpis.tsx) | Indicador com barra e linha de contexto — número sozinho diz pouco. A barra é `aria-hidden` porque o valor já está escrito, e com `semaforo` segue a faixa da RN-07. |
| `identidadeDaRede` / `chaveDaRede` | [lib/redes.ts](../apps/web/src/lib/redes.ts) | Cor e `?rede=` de cada rede, pelo nome. Toda tela que pinta ou linka rede passa por aqui. |
| `Botao` | [ui/botao.tsx](../apps/web/src/componentes/ui/botao.tsx) | Variantes com CVA (`primario`, `contorno`, `suave`, `fantasma`, `perigo`). `comoFilho` renderiza num `<Link>` em vez de `<button>`. |
| `SemAcesso` | [ui/sem-acesso.tsx](../apps/web/src/componentes/ui/sem-acesso.tsx) | A resposta da página que o acesso da conta não cobre: 200 com explicação, e três textos distintos (vínculo pendente, conta sem concessão, acesso que não cobre esta tela). Use junto de `faltando` ([lib/acesso.ts](../apps/web/src/lib/acesso.ts)), **antes** de consultar a API. |
| `Moeda` | [ui/basicos.tsx](../apps/web/src/componentes/ui/basicos.tsx) | Nulo vira *A definir* em itálico, **nunca** R$ 0,00 (§9.2 da especificação). |
| `somarMoeda` | [lib/formato.ts](../apps/web/src/lib/formato.ts) | Soma em centavos com `BigInt`. Dinheiro nunca passa por `number` antes de uma conta. Cada parcela é truncada para centavos **antes** da soma, e a ordem importa: mil parcelas de 8,615 dão 8.610,00 aqui e 8.615,00 numa soma em `number` — está fixado em `test/dinheiro.test.mjs`. Se **tudo** for nulo o resultado é nulo, nunca zero. |
| `ToastProvider` / `useToastDaAcao` | [ui/toast.tsx](../apps/web/src/componentes/ui/toast.tsx) | Confirma ações depois que o sidesheet fecha. Erros de validação continuam junto ao formulário. |

**Ajustes de usabilidade de 2026-09-14:** as notificações globais aparecem no
canto superior direito. `Pagina.voltar` oferece um botão com seta acima do
título, usado nos detalhes de PPG e temática. `Ajuda` em
[ui/ajuda.tsx](../apps/web/src/componentes/ui/ajuda.tsx) explica títulos por mouse,
foco ou toque, com fechamento por `Esc` e posicionamento fora da rolagem da
tabela. Os textos financeiros ficam em `lib/ajuda-orcamento.ts` e acompanham
as fórmulas da API: **saldo de bolsas não inclui manutenção e missões**.
No catálogo, os cartões mostram itens publicados, modalidades com valor e
itens por destino; versão, data-base e câmbio ficam em uma linha de contexto.
Fonte continua no cadastro, mas saiu da tabela principal.

**Validação do PPG:** o formulário usa `noValidate` para que um campo inválido
em etapa oculta não bloqueie o envio antes do React Hook Form. Todos os campos
estão mapeados por etapa e os erros fazem a navegação voltar ao campo a corrigir.
Os limites do schema do cliente acompanham `ppgSchema` na API; conceito CAPES
é inteiro. Mantenha estável o mapa passado a `useErrosDaAcao`: recriá-lo a cada
render reaplica os erros do servidor continuamente. Sigla duplicada retorna
409 com erro associado ao campo, tanto no cadastro quanto na edição.

Cadastro novo: crie o formulário em `componentes/formularios/`, a Server Action
em `acoes/`, o schema Zod em `lib/formularios/` e chame por `AbrirSidesheet` na
página. Use `useForm` com `zodResolver`, `useWatch` para campos condicionais e
`useErrosDaAcao` para rejeições da API. Formulário curto não precisa de multistep
— fatiar quatro campos em etapas troca rolagem por cliques. Use `useToastDaAcao`
para o sucesso da Server Action; não leve erros de campo para o toast, porque
eles precisam permanecer próximos do controle que deve ser corrigido.

**Acessibilidade que já está resolvida e não deve regredir** (CG-064): o
sidesheet é `<dialog>` nativo, então foco preso, `Esc` e fundo inerte vêm do
navegador — não reimplemente isso; `Campo` amarra dica e erro ao controle por
`aria-describedby`, e só o `role="alert"` não basta, porque quem volta ao campo
depois não ouviria nada; coluna de ações precisa de rótulo `sr-only`, nunca
`<th>` vazio; e tabela larga rola dentro de `RolagemHorizontal`, que a torna
alcançável pelo teclado.

O menu lateral nasce recolhido no desktop e pode ser expandido pelo controle no
rodapé. **Mostra só o que existe** desde 2026-09-10: os módulos futuros seguem
em [navegacao.ts](../apps/web/src/lib/navegacao.ts) com `disponivel: false` e o
motivo, mas o `MenuLateral` os filtra — item "em breve" lia como sistema
inacabado nas apresentações. No celular ele continua como gaveta completa. Preserve esse comportamento
ao incluir novos itens: todo item precisa de rótulo acessível mesmo quando apenas
o ícone estiver visível.

**Desde V1-019 o menu também filtra por capacidade**: cada item declara em
`exige` as ações da tela dele, e quem não as tem não o vê. São dois filtros com
razões diferentes — `disponivel` é escopo futuro, `exige` é acesso —, e juntá-los
faria o módulo por vir sumir da régua num ambiente sem concessões. Item novo
precisa de `exige` com **as mesmas ações que o guard cobra** do endpoint
principal da tela; e a tela, da porta correspondente (`faltando` + `SemAcesso`),
senão o link some do menu e a URL continua respondendo erro.

---

