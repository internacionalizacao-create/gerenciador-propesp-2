#!/usr/bin/env bash
# Percorre todas as telas com sessao real e confere que renderizam com dado.
set -uo pipefail

WEB=http://localhost:3000
JAR=$(mktemp)
USUARIO=${1:-coord.teste}
SENHA=${2:-coord123}

# --- login (mesmo caminho do smoke) ---
LOGIN=$(curl -s -c "$JAR" -o /dev/null -w '%{redirect_url}' "${WEB}/api/auth/login?returnTo=/")
PAGINA=$(curl -s -b "$JAR" -c "$JAR" "$LOGIN")
ACAO=$(printf '%s' "$PAGINA" | grep -o 'action="[^"]*"' | head -1 | sed 's/action="//;s/"$//' | sed 's/&amp;/\&/g')
CALLBACK=$(curl -s -b "$JAR" -c "$JAR" -o /dev/null -w '%{redirect_url}' -X POST "$ACAO" \
  --data-urlencode "username=${USUARIO}" --data-urlencode "password=${SENHA}" --data-urlencode "credentialId=")
curl -s -b "$JAR" -c "$JAR" -o /dev/null "$CALLBACK"

FALHAS=0

testar() {
  local rota="$1" esperado="$2"
  local corpo
  corpo=$(curl -s -b "$JAR" "${WEB}${rota}")
  local codigo
  codigo=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" "${WEB}${rota}")

  if [[ "$codigo" != "200" ]]; then
    printf '  \033[1;31mFALHA\033[0m %-52s HTTP %s\n' "$rota" "$codigo"
    FALHAS=$((FALHAS + 1))
    return
  fi
  if ! grep -qF "$esperado" <<<"$corpo"; then
    printf '  \033[1;31mFALHA\033[0m %-52s sem "%s"\n' "$rota" "$esperado"
    FALHAS=$((FALHAS + 1))
    return
  fi
  printf '  \033[1;32mok\033[0m    %-52s %s\n' "$rota" "$esperado"
}

# Confere tambem o caminho browser -> BFF -> API usando a mesma sessao. A tela
# inicial pode renderizar com dado do servidor mesmo se uma consulta interativa
# posterior estiver quebrada; este recorte fecha as duas pontas sem criar dado.
testar_bff() {
  local rota="$1" esperado="$2"
  local resposta corpo codigo
  resposta=$(curl -s -b "$JAR" -w $'\n%{http_code}' "${WEB}${rota}")
  codigo=${resposta##*$'\n'}
  corpo=${resposta%$'\n'*}

  if [[ "$codigo" != "200" ]] || ! grep -qF "$esperado" <<<"$corpo"; then
    printf '  \033[1;31mFALHA\033[0m %-52s BFF HTTP %s sem "%s"\n' "$rota" "$codigo" "$esperado"
    FALHAS=$((FALHAS + 1))
    return
  fi
  printf '  \033[1;32mok\033[0m    %-52s BFF %s\n' "$rota" "$esperado"
}

echo "Renderizacao das telas como ${USUARIO}:"
testar "/"                                                   "2.315.444,58"
testar "/"                                                   "1.033.513,40"
testar "/"                                                   "147.091,05"
testar "/programas"                                          "CAPES Global"
testar "/programas/capes-global/2027-2030"                   "Aporte anual conhecido"
testar "/programas/capes-global/2027-2030/redes"             "UNESP-T4"
testar "/programas/capes-global/2027-2030/redes"             "268,75"
testar "/programas/capes-global/2027-2030/redes"             "PPGs contemplados"
testar "/programas/capes-global/2027-2030/redes"             "Coordenação temática"
testar "/programas/capes-global/2027-2030/redes"             "PPGs no tema"
testar "/programas/capes-global/2027-2030/redes"             "Total recurso"
testar "/programas/capes-global/2027-2030/tematicas/UNESP-T4" "233.854,04"
testar "/programas/capes-global/2027-2030/tematicas/UNESP-T4" "2.808,64"
testar "/programas/capes-global/2027-2030/orcamento"         "9.261.778,32"
testar "/programas/capes-global/2027-2030/orcamento?ano=2027" "Total recurso"
testar "/programas/capes-global/2027-2030/plano"             "Visão geral"
testar "/programas/capes-global/2027-2030/plano"             "Panorama por rede"
testar "/programas/capes-global/2027-2030/plano?rede=unesp"  "BOL-001"
testar "/programas/capes-global/2027-2030/plano?rede=ufmg"   "BOL-021"
testar "/programas/capes-global/2027-2030/plano?rede=ufmg"   "140.018,40"
testar "/programas/capes-global/2027-2030/plano?rede=unicamp" "Nenhuma linha nesta temática"
if [[ "$USUARIO" == "admin" ]]; then
  testar "/programas/capes-global/2027-2030/orcamento?ano=2027" "Editar"
  testar "/programas/capes-global/2027-2030/plano?rede=unesp" "Editar"
  testar "/programas/capes-global/2027-2030/plano?rede=unesp" "Histórico"
  testar "/programas/capes-global/2027-2030/comite-gestor" "381.333,00"
  # O recorte por exercicio fica na URL e vale para a tabela de aportes.
  testar "/programas/capes-global/2027-2030/comite-gestor?ano=2027" "Aporte de 2027"
  testar "/programas/capes-global/2027-2030/comite-gestor?ano=2027" "381.333,00"
  # Exercicio fora do ciclo e ignorado, e nao quebra a pagina.
  testar "/programas/capes-global/2027-2030/comite-gestor?ano=1999" "Total anual"
  # CG-055: execucao orcamentaria. As ancoras sao os rotulos, e nao valores: o
  # quanto ja foi validado depende do banco e viraria falso alarme no primeiro
  # lancamento. O que precisa existir sempre e a separacao entre o que abate o
  # aporte e o que nao abate.
  testar "/programas/capes-global/2027-2030/comite-gestor" "Execução orçamentária"
  testar "/programas/capes-global/2027-2030/comite-gestor" "Saldo oficial"
  testar "/programas/capes-global/2027-2030/comite-gestor" "Não validado"
  testar "/programas/capes-global/2027-2030/comite-gestor?ano=2027" "Saldo oficial"
  testar_bff "/api/bff/programas/capes-global/2027-2030/comite-gestor/execucao" '"saldoOficial"'
  # CG-047: fila de analise. As ancoras sao os rotulos dos indicadores, que
  # existem mesmo com a fila vazia; o numero depende do banco.
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=analise" "Aguardando decisão"
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=analise" "Reanálise"
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=analise" "Há 7 dias ou mais"
  # O recorte por rodada fica na URL e nao quebra a pagina quando nao casa.
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=analise&rodada=9" "Nada aguardando decisão"
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=equipes" "Adicionar membro"
  # Ancora no cabecalho da coluna, e nao no rotulo "Missões" da aba: so o
  # cabecalho e alinhado a direita.
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=equipes" 'text-right">Missões</th>'
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes" "Missões no recorte"
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes" "Nova missão"
  # CG-016: a missao pertence a uma ou mais redes, e o recorte por rede fica na URL.
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes" "Todas as redes"
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes" "UNICAMP"
  # CG-063: a sessao real tambem atravessa o BFF nas consultas que sustentam o
  # formulario e a lista. E somente leitura para nao poluir a base do smoke.
  testar_bff "/api/bff/programas/capes-global/2027-2030/comite-gestor/missoes" '"itens"'
  testar_bff "/api/bff/programas/capes-global/2027-2030/comite-gestor/referencias-missao" '"redes"'
  # Os dois vazios sao diferentes: sem nenhuma missao o que falta e o cadastro;
  # com um filtro de escopo que nao casa, o que falta e ampliar o recorte. Este
  # segundo vale sempre; o primeiro so quando o banco de fato nao tem missao —
  # a seed nao traz, mas qualquer cadastro manual invalidaria a assercao e
  # transformaria o smoke em fonte de falso alarme. Mesma logica dos parceiros.
  testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes&busca=inexistente" "Nenhuma missão para este filtro"
  # CG-049: parceiros. A busca vem antes do cadastro porque o problema que a
  # deduplicacao resolve e o cadastro repetido.
  testar "/programas/capes-global/2027-2030/parceiros" "Novo parceiro"
  testar "/programas/capes-global/2027-2030/parceiros" "Todas as redes"
  # O vazio de filtro vale sempre: nenhum parceiro casa com essa busca.
  testar "/programas/capes-global/2027-2030/parceiros?busca=inexistente" "Nenhum parceiro para este filtro"
  # Ja o vazio de cadastro depende do estado do banco. A seed nao traz
  # parceiros, mas qualquer cadastro feito a mao invalidaria a asercao — por
  # isso ela so roda quando a lista esta de fato vazia. Os dois vazios sao
  # textos diferentes de proposito: um pede cadastro, o outro pede ampliar o
  # recorte.
  testar "/programas/capes-global/2027-2030/parceiros?inativos=true" "Incluir inativos"
else
  testar "/programas/capes-global/2027-2030/comite-gestor" "Acesso restrito"
  # A restricao de parceiros e a mesma do Comite Gestor enquanto a CG-028 nao
  # define o escopo por rede.
  testar "/programas/capes-global/2027-2030/parceiros" "Acesso restrito"
fi
testar "/mobilidade/bolsistas"                              "Bolsistas e bolsas concedidas"
testar "/ppgs"                                               "PPG CLIAMB"
testar "/pendencias"                                         "PEND-001"
testar "/catalogos/bolsas"                                   "CAT-053"
testar "/catalogos/bolsas"                                   "82.902,20"
testar "/catalogos/modalidades"                              "Doutorado Sanduíche"
testar "/configuracoes"                                      "plano:write"

# Detalhe de PPG precisa de um id vindo da lista.
ID=$(curl -s -b "$JAR" "${WEB}/ppgs" | grep -o '/ppgs/[0-9a-f-]\{36\}' | head -1)
[[ -n "$ID" ]] && testar "$ID" "Dados institucionais"

# Detalhe do parceiro so existe se algum tiver sido cadastrado. A seed nao traz
# parceiros, entao a ausencia aqui e esperada e nao deve falhar o smoke.
if [[ "$USUARIO" == "admin" ]]; then
  PARCEIROS="/programas/capes-global/2027-2030/parceiros"
  PID=$(curl -s -b "$JAR" "${WEB}${PARCEIROS}" \
    | grep -o "${PARCEIROS}/[0-9a-f-]\{36\}" | head -1)
  if [[ -n "$PID" ]]; then
    testar "$PID" "Dados institucionais"
    testar "$PID" "Voltar para parceiros"
    # Produtos e convenios aparecem nomeados, nunca zerados (CG-027).
    testar "$PID" "Ainda sem registro no sistema"
  else
    # Banco sem parceiro: o que se verifica e o estado vazio de cadastro.
    testar "$PARCEIROS" "Nenhum parceiro cadastrado"
  fi

  # CG-045: detalhe da missao, so quando houver alguma cadastrada. A seed nao
  # traz missoes, e o smoke nao cria — criar deixaria dado permanente, porque o
  # dominio nao tem exclusao.
  MISSOES="/programas/capes-global/2027-2030/comite-gestor/missoes"
  MID=$(curl -s -b "$JAR" "${WEB}/programas/capes-global/2027-2030/comite-gestor?aba=missoes" \
    | grep -o "${MISSOES}/[0-9a-f-]\{36\}" | head -1)
  if [[ -z "$MID" ]]; then
    testar "/programas/capes-global/2027-2030/comite-gestor?aba=missoes" "Nenhuma missão cadastrada"
  else
    testar "$MID" "Voltar para missões"
    testar "$MID" "Roteiro"
    testar "$MID" "Participantes"
    # As duas dimensoes da CG-006 aparecem juntas: mostrar so uma faria
    # "aprovada" ser lido como "realizada".
    testar "$MID" "Situação perante o Comitê Gestor"
    testar "$MID" "Situação de execução da missão"
    # CG-045 fatia 2: aba de analise. O numero da rodada nao e procuravel como
    # "1a rodada" porque o React quebra `{numero}ª rodada` em dois nos de texto;
    # a ancora e o sufixo, que sobrevive a isso.
    testar "${MID}?aba=analise" "Situação da análise"
    testar "${MID}?aba=analise" "Documentos exigidos"
    testar "${MID}?aba=analise" "Histórico"
    # Fatia 3. As asserções ficam nos títulos das seções, que existem em
    # qualquer estado: "Prestação não iniciada" e "Nenhum documento anexado"
    # dependem do banco e virariam falso alarme no primeiro lançamento.
    testar "${MID}?aba=documentos" "Documentos da missão"
    testar "${MID}?aba=prestacao" "Prestação de contas"
    # CG-057: galeria de fotos e evidencias. A ancora e o titulo da secao, que
    # existe mesmo vazia; "Restrita" depende do banco e viraria falso alarme.
    testar "${MID}?aba=documentos" "Fotos e evidências"
    testar "${MID}?aba=documentos" "Adicionar evidências"
    # CG-053: as acoes so aparecem para quem tem `prestacao:write`, e por isso
    # ficam no bloco do admin. "Anexar documento" cobre o caminho de upload.
    testar "${MID}?aba=documentos" "Anexar documento"
    # CG-054: a descricao do estado da prestacao existe em qualquer um dos
    # quatro, ao contrario das acoes, que dependem de onde a missao esta.
    testar "${MID}?aba=prestacao" "Prestação de contas"
    # CG-046: acoes do relato. "Registrar relato" vira "Editar relato" quando
    # ja existe um, entao a ancora estavel e a secao, nao o rotulo do botao.
    testar "$MID" "Roteiro"
    testar "$MID" "relato"
    # CG-058: checklist de encerramento. As ancoras sao os rotulos dos
    # requisitos, que existem em qualquer estado da missao — "Atendido" e
    # "Pendente" dependem do banco e virariam falso alarme.
    testar "$MID" "Encerramento"
    testar "$MID" "Prestação de contas validada"
    testar "$MID" "Avaliação dos objetivos"
    testar_bff "/api/bff${MISSOES}/${MID##*/}/encerramento" '"podeEncerrar"'
    # Aba inexistente cai no resumo em vez de quebrar.
    testar "${MID}?aba=inexistente" "Roteiro"
  fi
fi

echo
if [[ "$FALHAS" -eq 0 ]]; then
  printf '\033[1;32mtodas as telas renderizaram com os numeros esperados\033[0m\n'
else
  printf '\033[1;31m%s verificacao(oes) falharam\033[0m\n' "$FALHAS"
  exit 1
fi
