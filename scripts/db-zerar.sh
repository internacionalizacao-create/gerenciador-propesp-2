#!/usr/bin/env bash
#
# Esvazia os dados operacionais para percorrer o fluxo do sistema do zero,
# preservando o que a interface nao sabe cadastrar e os acessos ja vinculados.
#
# Por que nao e um `truncate` de tudo (o que `pnpm db:seed --reset` faz):
# programa, ciclo, rede coordenadora, area tematica, participacao PPG-tematica,
# teto orcamentario anual, aporte do Comite e catalogo ISO de paises **nao tem
# endpoint de escrita** em lugar nenhum da API. Um banco sem eles nao e um banco
# em branco, e um banco onde nao existe rota: `/programas/capes-global/...` some,
# e nenhuma tela oferece como recriar. O que sobra e a carcaca de planejamento
# vinda da planilha — e e sobre ela que o cadastro manual acontece.
#
# O que vai embora e exatamente o que se cadastra pela tela: linhas de plano,
# bolsas concedidas e produtos, missoes com roteiro, analise, prestacao e
# despesas, parceiros e contatos, convenios, anexos, avisos, pendencias e a
# trilha de auditoria.
#
# Os vinculos de login (`usuario_sistema`) e as pessoas por tras
# deles ficam — inclusive o admin. Zerar o vinculo nao impediria o login, porque
# `/me` recria a pessoa no primeiro acesso, mas recriaria com identidade nova e
# escopo vazio.
#
# Uso (a partir da raiz do monorepo):
#   ./scripts/db-zerar.sh                   # zera o operacional
#   ./scripts/db-zerar.sh --com-catalogo    # zera tambem modalidades e catalogo de bolsas
#   ./scripts/db-zerar.sh --sim             # sem confirmacao
#
set -euo pipefail
# shellcheck disable=SC1091
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/db-comum.sh"

CONFIRMAR=sim
COM_CATALOGO=nao
SEM_BACKUP=nao
while [[ $# -gt 0 ]]; do
  case "$1" in
    --sim|-y) CONFIRMAR=nao ;;
    --com-catalogo) COM_CATALOGO=sim ;;
    --sem-backup) SEM_BACKUP=sim ;;
    *) erro "opcao desconhecida: $1" ;;
  esac
  shift
done

# --- Classificacao das tabelas -----------------------------------------------
#
# As duas listas cobrem `public` por inteiro, e o script confere isso antes de
# apagar qualquer coisa: tabela nova no schema pararia aqui, em vez de sobreviver
# a zeragem em silencio e aparecer meses depois como dado fantasma.

# Base estrutural: sem tela de cadastro, ou fora do fluxo que se quer exercitar.
PRESERVAR=(
  pais                      # catalogo ISO fechado, carregado por migration/seed
  programa ciclo            # sem endpoint de criacao; sem eles nao existe rota
  rede_coordenadora area_tematica participacao_ppg
  ppg                       # tem cadastro (P14), mas participacao_ppg depende dele
  orcamento_tematica        # teto e composicao aprovados fora do sistema; so PATCH
  orcamento_comite_gestor   # aporte anual por rede; sem endpoint de criacao
  # `tabela_valores` nunca sai: nao ha endpoint que crie uma, e `criarItem`
  # resolve a tabela vigente antes de inserir — sem ela o catalogo fica sem
  # cadastro possivel pela tela.
  tabela_valores
  modalidade item_catalogo_bolsa      # --com-catalogo move estas duas para ZERAR
  requisito_submissao       # politica documental: dado, nao codigo (CG-019/CG-058)
  premissa fonte_documental linha_pesquisa
  usuario_sistema                                 # vinculo das contas
  # Concessoes individuais (V1-011): zera-las
  # tiraria o acesso de quem ja foi configurado, e o cadastro do zero seria
  # feito por uma conta sem alcance nenhum.
  concessao_acesso
  pessoa instituicao                              # limpeza seletiva, mais abaixo
)

# Operacional: tudo isto se cadastra pela interface.
ZERAR=(
  item_planejado planejamento_anual
  bolsa_concedida produto_bolsa
  membro_equipe_gestao membro_equipe_gestao_rede membro_comite
  missao_comite missao_rede atividade_missao missao_participante
  rodada_analise decisao_comite decisao_documento
  produto_missao produto_missao_rede produto_missao_instituicao
  produto_missao_responsavel
  dispensa_requisito_encerramento
  prestacao_contas_missao despesa_missao despesa_passagem despesa_diaria
  cotacao_passagem
  convenio convenio_rede
  contato_instituicao instituicao_rede
  anexo notificacao registro_auditoria
  pendencia
  lancamento_execucao remanejamento
)

if [[ "$COM_CATALOGO" == sim ]]; then
  # Modalidade sai junto com os itens de proposito: `permiteBrasil` e
  # `permiteExterior` sao derivados do catalogo, e modalidade sem item ofereceria
  # na P10 a combinacao que `resolverItem` recusa depois.
  PRESERVAR=("${PRESERVAR[@]/#modalidade/}")
  PRESERVAR=("${PRESERVAR[@]/#item_catalogo_bolsa/}")
  ZERAR+=(item_catalogo_bolsa modalidade)
fi

exigir_container

titulo "Conferindo a cobertura do schema"
NO_BANCO="$(psql_valor "select tablename from pg_tables where schemaname='public' order by 1")"
CLASSIFICADAS="$(printf '%s\n' "${PRESERVAR[@]}" "${ZERAR[@]}" | grep -v '^$' | sort)"
DESCONHECIDAS="$(comm -23 <(printf '%s\n' "$NO_BANCO" | sort) <(printf '%s\n' "$CLASSIFICADAS"))"
FANTASMAS="$(comm -13 <(printf '%s\n' "$NO_BANCO" | sort) <(printf '%s\n' "$CLASSIFICADAS"))"
if [[ -n "$DESCONHECIDAS" ]]; then
  erro "tabela nao classificada em scripts/db-zerar.sh:
$(printf '%s\n' "$DESCONHECIDAS" | sed 's/^/         /')
       Decida se ela e base (PRESERVAR) ou operacional (ZERAR) antes de zerar."
fi
[[ -n "$FANTASMAS" ]] && aviso "classificadas e inexistentes no banco: $(printf '%s ' $FANTASMAS)"
ok "$(printf '%s\n' "$NO_BANCO" | wc -l) tabelas classificadas — $(printf '%s\n' "${ZERAR[@]}" | grep -cv '^$') serao esvaziadas"
avisar_api_no_ar

titulo "O que sera apagado"
INVENTARIO_ANTES="$(psql_valor "$(cat "${RAIZ}/scripts/db-inventario.sql")")"
COM_DADOS=0
for tabela in "${ZERAR[@]}"; do
  [[ -z "$tabela" ]] && continue
  linha="$(printf '%s\n' "$INVENTARIO_ANTES" | grep "^${tabela} " || true)"
  [[ -z "$linha" || "${linha##* }" == 0 ]] && continue
  printf '     %s\n' "$linha"
  COM_DADOS=$((COM_DADOS + 1))
done
[[ "$COM_DADOS" == 0 ]] && info "(nada — o operacional ja esta vazio)"

if [[ "$CONFIRMAR" == sim ]]; then
  printf '\n'
  read -r -p "   digite \"zerar\" para continuar: " resposta
  [[ "$resposta" == zerar ]] || erro "cancelado"
fi

if [[ "$SEM_BACKUP" == nao ]]; then
  titulo "Backup de seguranca antes de apagar"
  "${RAIZ}/scripts/db-backup.sh" -m "antes-de-zerar" | grep -v '^$' | sed 's/^/  /'
fi

titulo "Esvaziando o operacional"
encerrar_conexoes
ALVOS="$(printf '"%s", ' "${ZERAR[@]}" | sed 's/, $//')"
# Uma instrucao so, e `cascade` por seguranca: a ordem topologica das FKs muda a
# cada evolucao do schema, e acertar a mao aqui seria quebrar na proxima migration.
psql_exec -c "truncate table ${ALVOS} restart identity cascade;"
ok "tabelas operacionais vazias"

titulo "Limpando pessoas e instituicoes orfas"
# Pessoa so fica se sustenta algo preservado: um login, a coordenacao de uma
# tematica ou a coordenacao de um PPG. As demais entraram pelo fluxo (equipe do
# Comite, participante de missao, orientador de bolsa) e nao tem mais dono.
APAGADAS_PESSOA="$(psql_valor "
  with removidas as (
    delete from pessoa p
     where not exists (select 1 from usuario_sistema u where u.pessoa_id = p.id)
       and not exists (select 1 from participacao_ppg pp where pp.coordenador_tematica_id = p.id)
       and not exists (select 1 from ppg g where g.coordenador_id = p.id or g.vice_coordenador_id = p.id)
    returning 1)
  select count(*) from removidas")"
info "pessoas removidas: ${APAGADAS_PESSOA}"

# Instituicao: ficam a UEA (tipo PROPRIA, dona das pessoas) e as que sustentam
# rede coordenadora ou aporte do Comite. Parceiro cadastrado pela tela sai.
APAGADAS_INST="$(psql_valor "
  with removidas as (
    delete from instituicao i
     where i.tipo <> 'PROPRIA'
       and not exists (select 1 from rede_coordenadora r where r.instituicao_id = i.id)
       and not exists (select 1 from orcamento_comite_gestor o where o.instituicao_id = i.id)
       and not exists (select 1 from pessoa p where p.instituicao_id = i.id)
    returning 1)
  select count(*) from removidas")"
info "instituicoes removidas: ${APAGADAS_INST}"

titulo "Anexos em disco"
if [[ -d "$ARQUIVOS_DIR" ]] && [[ -n "$(ls -A "$ARQUIVOS_DIR" 2>/dev/null)" ]]; then
  # A tabela `anexo` foi truncada: o que sobra no disco nao e alcancavel por
  # nenhum endpoint, so ocupa espaco e confunde quem for depurar armazenamento.
  rm -rf "${ARQUIVOS_DIR:?}"/*
  ok "${ARQUIVOS_DIR} esvaziado"
else
  info "nada a limpar em ${ARQUIVOS_DIR}"
fi

titulo "Estado final"
psql_valor "$(cat "${RAIZ}/scripts/db-inventario.sql")" | grep -v ' 0$' | sed 's/^/     /'

printf '\n'
info "Logins preservados:"
psql_valor "select format('  %-30s %s', coalesce(u.email, u.username, u.sub), p.nome)
              from usuario_sistema u join pessoa p on p.id = u.pessoa_id
             order by 1" | sed 's/^/   /'
printf '\n'
info "Reinicie o \`pnpm dev\` (a API cai com o encerramento das conexoes) e"
info "siga o guia:"
info "docs/guia-cadastro-do-zero.md"
printf '\n'
