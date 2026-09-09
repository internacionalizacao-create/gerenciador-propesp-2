# Migração das telas para a biblioteca de UI

Estado: em execução desde 2026-09-09. Este documento materializa MUI-001,
MUI-002/MUI-003 e MUI-020. A sigla histórica das
tasks foi mantida, mas **MUI não é uma dependência deste projeto**. A biblioteca
de UI é local: componentes inspirados em shadcn/ui, com Radix/cmdk nos
primitivos necessários e tokens semânticos em `apps/web/src/app/globals.css`.

Não se deve instalar Material UI para esta migração. Isso duplicaria tema,
estilos e primitivas sem resolver uma necessidade do produto.

## Inventário da biblioteca

`apps/web/package.json` declara React 19, Tailwind 4, Radix Popover, cmdk,
React Hook Form 7, Zod 4, TanStack Query 5, CVA e Lucide. `components.json`
aponta shadcn para `src/componentes/ui`, mas os componentes são cópia adaptada:
tokens crus do shadcn não podem entrar.

| Necessidade | Componente local | Observação |
| --- | --- | --- |
| Botão | `ui/botao.tsx` | CVA; `comoFilho` para links |
| Campos, select, checkbox | `ui/campos.tsx` | Funciona com `register`; mantém label, dica e erro ligados por ARIA |
| Combobox | `ui/combobox.tsx`, `ui/campo-combobox.tsx` | Use `Controller` no React Hook Form |
| Alerta, badge, cartão, tabela, vazio, skeleton, paginação | `ui/basicos.tsx` | Tabela preserva rolagem horizontal acessível |
| Sidesheet | `ui/sidesheet.tsx` | `dialog` nativo; não substituir por modal de biblioteca |
| Tabs | Links de rota com `aria-current` | As abas do plano têm identidade de rede e permanecem específicas |
| Toast | `ui/toast.tsx` | Sucesso e erro têm urgências ARIA distintas |
| Query | `consultas/provedor.tsx`, `lib/bff.ts` | BFF somente; cliente por montagem |

## Matriz de escopo e regressão

| Rota | Componentes atuais / alvo | Dados iniciais | Mutação | Testes e risco |
| --- | --- | --- | --- | --- |
| `/login` | layout local, `Selo`, `Aviso`, `Botao` | sessão no servidor | navegação GET para OIDC | `returnTo`, erro, foco; não renderizar senha/token |
| `/catalogos/bolsas` | `Pagina`, cartões, tabela desktop/cartões móveis, selo, sidesheet e filtros locais | `apiFetch` servidor: catálogo, modalidades, `me` | ações de catálogo | RN-01, versão, nulo ≠ zero, leitura sem `catalogo:write` |
| `/catalogos/modalidades` | `Pagina`, tabela, selo, sidesheet + RHF/Zod | `apiFetch` servidor: modalidades, `me` | ações de modalidade | destinos derivados, ativa/inativa, `catalogo:write` |
| `/ppgs` | `Pagina`, cartões, tabela; alvo inclui busca Query | `apiFetch` servidor: PPGs, `me` | Server Actions de PPG | totais monetários, escopo, URL e cache por usuário |
| `/ppgs/[id]` | seções, tabela, aviso, vazio; alvo inclui tabs/cartões locais | `apiFetch` servidor: PPG, `me` | edição de PPG | 404/recorte, dados institucionais e teclado |
| `/programas/[programa]/[ciclo]/plano` | tabs por link, cartões, tabelas, sidesheet | `apiFetch` servidor: plano, PPGs, catálogo, redes, `me` | ações de linha do plano | RN-01, RN-04–RN-09, centavos, nulo ≠ zero, URL de ano/rede |

As ações de item e modalidade já recebem objetos tipados de formulários RHF/Zod.
PPG e linha de plano ainda usam `FormData`/estado local e são migrações próprias
das tasks MUI-042 e MUI-052; não serão alterados junto de mudanças visuais.

## Padrões obrigatórios

1. Server Components fazem a primeira leitura por `apiFetch`; Query só começa
   após a pintura, com `initialData`, URL como fonte do filtro e
   `keepPreviousData` quando houver troca de recorte.
2. O browser usa somente `buscarNoBff`/`caminhoBff`; `apiFetch` é server-only.
   O `QueryClient` é criado dentro de `useState`, como em `ProvedorDeConsultas`.
   Erros 4xx não recebem retry.
3. Formulário novo usa `useForm`, `zodResolver`, schema em `lib/formularios`,
   `useErrosDaAcao` para erros da API e `useToastDaAcao` apenas para sucesso.
   Componente rico usa `Controller`; valores monetários permanecem strings até a
   Server Action/API, nunca `number`.
4. Alterações passam por Server Actions existentes e preservam autorização e
   revalidação. Não há chamada direta à API, CORS ou token no cliente.

## Primeiro incremento

MUI-010 foi iniciado na tela de login: ela reutiliza `Selo`, `Aviso` e `Botao`
locais, mantendo o link GET para o fluxo OIDC hospedado no Keycloak. Não há
formulário local, senha, token ou mudança no `returnTo`.

MUI-020 migrou o Catálogo de Bolsas para uma tabela em telas médias/grandes e
cartões em tela estreita, com selo de destino, vazio e filtros `q`/`destino`
compartilháveis na URL. Não há busca ou paginação na API da tabela vigente; o
recorte é local, portanto TanStack Query não se aplica e a primeira leitura
continua única no servidor.

MUI-021 consolidou as regressões automatizadas de catálogo: lista carregada,
busca/destino sem resultado, ações ocultas sem `catalogo:write`, tokens nos dois
temas e as duas apresentações responsivas. O roteiro manual registrado para a
homologação é: alternar tema, tabular até busca/destino/ações e, com leitor de
tela, conferir o nome da região de rolagem da tabela e os rótulos dos filtros.

MUI-030 migrou a leitura de Modalidades para tabela em desktop e cartões em
mobile, incluindo estado vazio. Os destinos, a situação e a contagem de itens
seguem visíveis por texto e selo; a tela explica que a vigência é do item de
catálogo, nunca uma regra implícita da modalidade.

MUI-031 confirmou a aplicação da convenção RHF/Zod no formulário de
Modalidades: schema local, `zodResolver`, erros de campo devolvidos pela API,
Server Actions existentes e botões locais. Não usa `Controller`, pois todos os
controles são nativos e não há controle rico a integrar.

MUI-032 acrescentou regressões para a lista responsiva/vazia, destinos, estado
ativo, explicação de vigência, schema inválido/válido, RHF, erros da API,
Server Actions, permissão e revalidação das rotas de catálogo.

MUI-040 migrou PPGs para filtros locais de busca, nível e situação, refletidos
em `q`, `nivel` e `situacao` na URL. Como o endpoint `/ppgs` não aceita esses
parâmetros, a primeira lista autorizada continua vindo do servidor e o recorte
não refaz uma chamada BFF idêntica a cada tecla; logo TanStack Query não se
aplica neste contrato. A lista também ganhou cartões móveis, vazio e indicadores
que acompanham o recorte atual.

MUI-041 manteve o detalhe de PPG integralmente no servidor, trocou os dados
institucionais por cartões semânticos e preservou seções, selos, tabelas e
vazios. Não foram criadas tabs artificiais: os blocos são leitura sequencial e
os títulos de seção já fornecem navegação sem esconder conteúdo. ID inexistente
ou fora do escopo segue para 404, sem revelar a existência do PPG.

MUI-042 migrou o formulário multietapa de PPG para React Hook Form e Zod. O
schema e o payload tipado ficam em `lib/formularios/ppg.ts`; as Server Actions
recebem o objeto validado e preservam a mesma API, revalidações e semântica de
campos opcionais. Chips agora podem ser controlados pelo formulário, portanto
as linhas de pesquisa não dependem mais de serialização `FormData`.

MUI-043 acrescentou regressões para schema/payload do PPG, filtros e URL,
estados responsivos e vazios, detalhe 404, cartões, RHF/Zod e revalidações das
Server Actions. A permissão continua autoritativa na API; a interface apenas
oculta o cadastro quando `ppg:write` não está presente.

## Planejamento: recorte e regressão (MUI-050)

Rota incluída: `/programas/[programa]/[ciclo]/plano`, com `ano` e `rede` na
URL. A página começa sempre no Server Component e busca plano, PPGs, catálogo,
redes e permissões em paralelo. A migração não move esses cálculos ao browser.

| Subfluxo | Origem / ação | Regressões obrigatórias |
| --- | --- | --- |
| Visão geral | plano e redes do exercício | totais por rede, PPG, temática e coordenador continuam em centavos |
| Abas por rede | `rede` na URL; identidade `network-1..3` | aba persiste ao recarregar/compartilhar; cor não é o único indicador |
| Exercício | `ano` na URL | todos os cartões, tabelas e links usam o mesmo exercício |
| Linhas do plano | `LinhaPlano`; criar/editar/cancelar por Server Action | status, histórico e autorização não mudam por componente visual |
| Bolsa | catálogo por destino/modalidade/vigência | RN-01: combinação ausente é recusada; valor unitário não é digitável |
| Orçamento | aportes, custo, saldo e utilização | RN-04 a RN-09; `null` é “A definir”, nunca zero; dinheiro permanece string/numeric/centavos |

O CAPES Global não incorpora o orçamento do Comitê Gestor nesta rota. Aporte,
saldo e divergência continuam calculados no domínio; a UI apenas mostra os
valores, usando `Moeda` e `somarMoeda`, que nunca somam em `number`.

MUI-051 aplicou o botão local aos seletores de exercício sem trocar links por
estado de cliente. Abas por rede e links de visão geral continuam navegando por
`ano` e `rede`; a primeira leitura, cálculos, cartões, badges e tabelas do
Plano seguem no Server Component e os números continuam sendo os do domínio.

MUI-053 consolidou regressões de Plano para RN-01, estimativas, valores
monetários textuais, URL de ano/rede, carga no servidor, RHF/Zod e seletor
acessível. TanStack Query permanece ausente de propósito: não existe contrato
de filtro remoto para a rota, e recarregar o plano a cada tecla só duplicaria a
consulta autorizada do servidor.

## Auditoria de acessibilidade (MUI-060)

As rotas migradas mantêm componentes semânticos e tokens em ambos os temas:

- Login: link OIDC com nome visível, alerta de erro e nenhum campo de senha.
- Catálogos e PPGs: filtros têm `label`; tabelas largas usam região rolável
  nomeada e cartões móveis não dependem de cor para destino/situação.
- Formulários: `Campo` vincula dica/erro por `aria-describedby`; erros usam
  `role=alert`; sidesheet é `dialog` nativo com título, descrição e fechar
  nomeado.
- Plano: exercício e redes são links com `aria-current`; tabelas preservam
  cabeçalhos legíveis e valores nulos continuam textuais.

As regressões em `acessibilidade.test.mjs` verificam os vínculos ARIA, foco da
rolagem horizontal, cabeçalhos de ações, contraste AA claro/escuro e urgência
dos toasts. A checagem manual de homologação continua cobrir teclado e leitor
de tela nas larguras móvel e desktop.
