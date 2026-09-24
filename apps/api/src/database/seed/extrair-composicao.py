#!/usr/bin/env python3
"""
Extrai a composicao de bolsas por rede/tematica/PPG do `Levantamento de Bolsas.xlsx`.

Decisao do responsavel em 2026-09-22: as abas "Copia de Comite ..." entram na
extracao. Elas nao sao duplicatas — sao revisoes, e cada rede se comporta de um
jeito:

  UNICAMP  a copia e auto-suficiente (traz orcamento) e e posterior: registra o
           ajuste "25 -> 21 bolsas" que a principal desconhece.
  UFMG     a copia NAO traz orcamento nenhum (0 de 6 linhas) e perde lancamentos
           que a principal tem. Sozinha ela nao serve.

Por isso o extrator **nao escolhe**: ele le as duas, e onde discordam grava o
conflito em `conflitos`, com o valor de cada aba. Escolher em silencio
gravaria numero de plano que ninguem decidiu — e plano errado contamina custo,
saldo e utilizacao de teto de uma rede inteira.

Uso (a partir da raiz do monorepo):
    python3 apps/api/src/database/seed/extrair-composicao.py
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def abrir(caminho):
    z = zipfile.ZipFile(caminho)
    ss = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            ss.append(''.join(t.text or '' for t in si.iter(f"{{{NS['m']}}}t")))
    rels = {rel.get('Id'): rel.get('Target').lstrip('/').replace('xl/', '')
            for rel in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    abas = {}
    for s in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
        abas[s.get('name')] = 'xl/' + rels.get(s.get(f"{{{NS['r']}}}id"), '')
    return z, ss, abas


def indice(ref):
    letras = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for c in letras:
        n = n * 26 + ord(c) - 64
    return n - 1


def mesclas_verticais(raiz):
    """{(coluna, linha_destino): linha_origem} para cada mescla vertical.

    Celula mesclada sobre varias linhas **declara** que o valor vale para todas
    elas: na planilha o orcamento e lancado por tematica, na primeira linha do
    grupo, e as linhas dos demais PPGs ficam visualmente cobertas pela mesma
    celula. Ler so a primeira linha perderia o orcamento de todos os outros.
    """
    mc = raiz.find('m:mergeCells', NS)
    mapa = {}
    for m in (mc if mc is not None else []):
        ini, fim = m.get('ref').split(':')
        c1, l1 = re.match(r'([A-Z]+)(\d+)', ini).groups()
        c2, l2 = re.match(r'([A-Z]+)(\d+)', fim).groups()
        if c1 != c2:                      # mescla horizontal: nao propaga valor
            continue
        for l in range(int(l1) + 1, int(l2) + 1):
            mapa[(indice(ini), l)] = int(l1)
    return mapa


def linhas(z, ss, path, propagar=()):
    """`propagar`: colunas cuja mescla vertical **replica** o valor nas linhas.

    So valem aqui as colunas que descrevem a **tematica** — orcamento, nome,
    responsavel —, porque uma celula mesclada sobre cinco PPGs diz que aquele
    orcamento e o do grupo. Coluna de **modalidade ou quantidade** nunca entra:
    ali a mescla significa um lancamento unico pertencente ao grupo, e replica-lo
    o contaria uma vez por PPG. Foi o que aconteceu na primeira versao desta
    funcao — a UNICAMP saltou de 23 para 29 lancamentos, todos inventados.
    """
    raiz_ = ET.fromstring(z.read(path))
    mesclas = {k: v for k, v in mesclas_verticais(raiz_).items() if k[0] in propagar}
    por_linha = {}
    out = []
    for row in raiz_.iter(f"{{{NS['m']}}}row"):
        cells = {}
        for c in row.findall('m:c', NS):
            v = c.find('m:v', NS)
            t = c.get('t')
            if t == 'inlineStr':
                isn = c.find('m:is', NS)
                val = ''.join(x.text or '' for x in isn.iter(f"{{{NS['m']}}}t")) if isn is not None else ''
            elif v is None:
                continue
            elif t == 's':
                val = ss[int(v.text)]
            else:
                val = v.text
            if val not in (None, ''):
                cells[indice(c.get('r'))] = val
        n = int(row.get('r'))
        por_linha[n] = cells
        if cells:
            out.append((n, cells))

    # Propaga o valor da primeira linha de cada mescla vertical para as demais.
    for (coluna, destino), origem in mesclas.items():
        valor = por_linha.get(origem, {}).get(coluna)
        if valor is not None and destino in por_linha:
            por_linha[destino].setdefault(coluna, valor)

    return [c for _, c in out]


def texto(v):
    return ' '.join((v or '').split()) or None


def numero(v):
    """Primeiro numero de uma celula. '3 (bolsas pra setembro)' -> 3."""
    if v is None:
        return None
    m = re.search(r'\d+(?:[.,]\d+)?', str(v))
    return float(m.group(0).replace(',', '.')) if m else None


VALOR = re.compile(r'R?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d+)?)')


def _brl(s):
    s = s.strip()
    if ',' in s:                      # formato pt-BR: ponto e milhar
        s = s.replace('.', '').replace(',', '.')
    try:
        return f'{float(s):.2f}'
    except ValueError:
        return None


def dinheiro(v):
    """Primeiro valor da celula. 'R$ 538.291,22' -> '538291.22'.

    Le **o primeiro** e nao todos os digitos: a UNESP lanca as tres rubricas na
    mesma celula ('R$ X para Bolsas\nR$ Y para Manutencao\n...'), e juntar os
    digitos de todas produziria um numero que nao existe em lugar nenhum.
    Preserva None; nao inventa zero.
    """
    if not v:
        return None
    m = VALOR.search(str(v))
    return _brl(m.group(1)) if m else None


RUBRICAS = {'bolsa': 'BOLSAS', 'manuten': 'MANUTENCAO', 'miss': 'MISSOES'}


def rubricas(v):
    """'R$ X para Bolsas / R$ Y para Manutencao' -> {'BOLSAS': 'X', ...}.

    So a UNESP decompoe o orcamento por rubrica na planilha; nas outras a
    celula traz um valor unico e esta funcao devolve {}, que e a resposta certa
    — inventar a divisao seria fabricar numero de orcamento.
    """
    if not v:
        return {}
    saida = {}
    for parte in str(v).split('\n'):
        m = VALOR.search(parte)
        if not m:
            continue
        for pista, nome in RUBRICAS.items():
            if pista in parte.lower():
                saida[nome] = _brl(m.group(1))
                break
    return saida


def corpo(ls, coluna_ppg):
    """Linhas de PPG de uma aba de comite, sem cabecalho, titulo e OBS."""
    i = next(i for i, r in enumerate(ls) if 'Rede Coordenadora' in (r.get(0) or ''))
    return [r for r in ls[i + 1:]
            if texto(r.get(coluna_ppg)) and 'OBS' not in (r.get(0) or '')]


# --------------------------------------------------------------------------- #
# UFMG e UNICAMP tem layouts diferentes, e as copias tem layouts diferentes das
# principais. Cada leitor abaixo conhece o seu, e todos devolvem a mesma forma:
# {ppg, lancamentos: [{modalidade, quantidade, vigenciaMeses}], ...}
# --------------------------------------------------------------------------- #
def ler_ufmg_principal(ls):
    """Rotulo, quantidade e vigencia em colunas separadas (12-14, 15-17, 18-20)."""
    saida = []
    for r in corpo(ls, 2):
        lanc = []
        for rot, q, v in ((12, 13, 14), (15, 16, 17), (18, 19, 20)):
            if numero(r.get(q)) and texto(r.get(rot)) not in (None, '-'):
                lanc.append({'modalidade': texto(r.get(rot)),
                             'quantidade': numero(r.get(q)),
                             'vigenciaMeses': numero(r.get(v))})
        saida.append({'tematica': texto(r.get(1)), 'ppg': texto(r.get(2)),
                      'notaPpg': numero(r.get(3)), 'responsavel': texto(r.get(4)),
                      'orcamentoTotal': dinheiro(r.get(5)),
                      'orcamentoUtilizado': dinheiro(r.get(6)),
                      'orcamentoRubricas': rubricas(r.get(5)),
                      'lancamentos': lanc})
    return saida


def ler_ufmg_copia(ls):
    """Sem coluna de quantidade: o valor na coluna da modalidade E a quantidade."""
    rotulos = {8: 'Professor Visitante Junior', 10: 'Professor Visitante Senior',
               12: 'Doutorado Sanduiche', 14: 'Capacitacao'}
    saida = []
    for r in corpo(ls, 2):
        lanc = []
        for q, rot in rotulos.items():
            if numero(r.get(q)):
                lanc.append({'modalidade': rot, 'quantidade': numero(r.get(q)),
                             'vigenciaMeses': numero(r.get(q + 1))})
        saida.append({'tematica': texto(r.get(1)), 'ppg': texto(r.get(2)),
                      'notaPpg': numero(r.get(3)), 'responsavel': texto(r.get(4)),
                      'orcamentoTotal': dinheiro(r.get(5)),
                      'orcamentoUtilizado': dinheiro(r.get(6)),
                      'orcamentoRubricas': rubricas(r.get(5)),
                      'lancamentos': lanc})
    return saida


def ler_unicamp(ls, col_ppg, col_orc):
    """Tres pares (modalidade, quantidade). A quantidade vem em texto livre."""
    saida = []
    for r in corpo(ls, col_ppg):
        lanc = []
        for c in (10, 12, 14):
            mod = texto(r.get(c))
            if mod and mod != '-' and numero(r.get(c + 1)) is not None:
                lanc.append({'modalidade': mod,
                             'quantidade': numero(r.get(c + 1)),
                             'quantidadeTexto': texto(r.get(c + 1))})
        saida.append({'tematica': texto(r.get(1)), 'ppg': texto(r.get(col_ppg)),
                      'notaPpg': numero(r.get(col_ppg + 1)),
                      'responsavel': texto(r.get(col_ppg + 2)),
                      'orcamentoTotal': dinheiro(r.get(col_orc)),
                      'orcamentoUtilizado': dinheiro(r.get(col_orc + 1)),
                      'orcamentoRubricas': rubricas(r.get(col_orc)),
                      'lancamentos': lanc})
    return saida


MODALIDADES_TEXTO = (
    ('doutorado sanduíche', 'Doutorado Sanduiche'), ('doutorado sanduiche', 'Doutorado Sanduiche'),
    ('professor visitante sênior', 'Professor Visitante Senior'),
    ('professor visitante senior', 'Professor Visitante Senior'),
    ('professor visitante junior', 'Professor Visitante Junior'),
    ('professor visitante', 'Professor Visitante'), ('capacita', 'Capacitacao'),
)


def ler_unesp(ls):
    """
    A UNESP nao tem colunas por modalidade: lanca em **texto livre**.

        "1 bolsa doutorado sanduiche (6 meses) PPGCLIAMB"
        "3 bolsas Capacitacao (2 de 1 mes e 1 de 0,5 mes)"
        "1 bolsa doutorado sanduiche (5 meses)-71.896,90 + Capacitacao (1 mes)"

    Cada lancamento guarda o `_textoOriginal` e um `_confianca`. Texto que
    descreve mais de uma bolsa, ou vigencia que o padrao nao alcanca, sai como
    `revisar` — nao como numero inventado. Quem conferir precisa ver a frase de
    onde o numero saiu, senao a revisao vira aposta.
    """
    saida = []
    for r in corpo(ls, 3):
        lanc = []
        for col, destino in ((13, 'EXTERIOR'), (14, 'BRASIL')):
            bruto = texto(r.get(col))
            if not bruto or bruto == '-':
                continue
            for parte in re.split(r'\s+\+\s+', bruto):
                mod = next((nome for pista, nome in MODALIDADES_TEXTO
                            if pista in parte.lower()), None)
                if not mod:
                    continue
                qtd = numero(parte)
                vig = re.search(r'\((?:.*?)?(\d+(?:[.,]\d+)?)\s*m[eê]s', parte, re.I) \
                    or re.search(r'(\d+(?:[.,]\d+)?)\s*m[eê]s', parte, re.I)
                duvida = (parte.lower().count('bolsa') > 1
                          or ' e ' in parte.lower().split('(')[-1]
                          or qtd is None or vig is None)
                lanc.append({
                    'modalidade': mod, 'destino': destino,
                    'quantidade': qtd,
                    'vigenciaMeses': float(vig.group(1).replace(',', '.')) if vig else None,
                    '_textoOriginal': parte,
                    '_confianca': 'revisar' if duvida else 'direta',
                })
        saida.append({'tematica': texto(r.get(1)), 'ppg': texto(r.get(3)),
                      'notaPpg': numero(r.get(4)), 'responsavel': texto(r.get(5)),
                      'orcamentoTotal': dinheiro(r.get(7)),
                      'orcamentoUtilizado': dinheiro(r.get(8)),
                      'orcamentoRubricas': rubricas(r.get(7)),
                      'mesImplementacao': texto(r.get(12)),
                      'lancamentos': lanc})
    return saida


def chave(l):
    """Modalidade normalizada, para comparar 'PV (1 mes)' entre abas diferentes."""
    m = (l['modalidade'] or '').lower()
    if 'junior' in m:
        return 'PV_JUNIOR'
    if 'senior' in m or 'sênior' in m:
        return 'PV_SENIOR'
    if 'sanduíche' in m or 'sanduiche' in m:
        return 'DOUTORADO_SANDUICHE'
    if 'capacita' in m:
        return 'CAPACITACAO'
    if 'visitante' in m:
        return 'PROFESSOR_VISITANTE'
    return m.upper().replace(' ', '_')


def comparar(rede, principal, copia):
    """
    Diferencas entre as duas abas, por PPG e modalidade.

    Nao resolve nada: quem decide qual versao vale e o responsavel pelos dados
    (V1-038). Gravar a escolha aqui a esconderia de quem precisa revisa-la.
    """
    conflitos = []
    for p, c in zip(principal, copia):
        if p['ppg'] != c['ppg']:
            conflitos.append({'rede': rede, 'ppg': p['ppg'], 'campo': 'ordem das linhas',
                              'principal': p['ppg'], 'copia': c['ppg']})
            continue
        mp = {chave(l): l for l in p['lancamentos']}
        mc = {chave(l): l for l in c['lancamentos']}
        for k in sorted(set(mp) | set(mc)):
            a, b = mp.get(k), mc.get(k)
            if a and not b:
                conflitos.append({'rede': rede, 'ppg': p['ppg'], 'modalidade': k,
                                  'tipo': 'so na principal', 'principal': a, 'copia': None})
            elif b and not a:
                conflitos.append({'rede': rede, 'ppg': p['ppg'], 'modalidade': k,
                                  'tipo': 'so na copia', 'principal': None, 'copia': b})
            elif a['quantidade'] != b['quantidade'] or a.get('vigenciaMeses') != b.get('vigenciaMeses'):
                conflitos.append({'rede': rede, 'ppg': p['ppg'], 'modalidade': k,
                                  'tipo': 'valor diferente', 'principal': a, 'copia': b})
        for campo in ('orcamentoTotal', 'orcamentoUtilizado'):
            if p[campo] != c[campo]:
                conflitos.append({'rede': rede, 'ppg': p['ppg'], 'campo': campo,
                                  'tipo': 'valor diferente',
                                  'principal': p[campo], 'copia': c[campo]})
    return conflitos


# --------------------------------------------------------------------------- #
# Resolucao das divergencias — decisao do responsavel em 2026-09-22.
#
# As duas redes com copia se comportam de formas opostas, e por isso a regra
# nao e a mesma para as duas:
#
#   UNICAMP  a copia **vence inteira**. Ela traz orcamento, troca a modalidade
#            de "15 dias" para "1 mes" em toda a rede e registra o ajuste
#            "25 -> 21 bolsas". E uma revisao completa, e revisao substitui.
#            Isso inclui o Doutorado Sanduiche que ela retira de Medicina
#            Tropical: reconduzi-lo desfaria o ajuste de -4 que ela existe para
#            registrar.
#
#   UFMG     **uniao**, porque a copia nao e revisao completa — o orcamento
#            esta vazio em 6 de 6 linhas e ela perde lancamentos. Entra tudo da
#            principal (inclusive o PV Senior de Propriedade Intelectual, que a
#            copia nao tem) mais as quatro Capacitacoes que so a copia estrutura.
#
# A excecao: a Capacitacao de Ciencias Aplicadas, que existe **so na principal**
# e esta digitada dentro da coluna "Bolsa PV (SENIOR)" — dado na coluna errada.
# Descartada por decisao do responsavel: das duas leituras possiveis (erro de
# digitacao ou lancamento real posto no unico espaco livre), a primeira e a
# unica compativel com as "quatro Capacitacoes UFMG" que o backlog ja registrava.
# O descarte fica em `descartes`, com o valor, para nao virar dado perdido.
# --------------------------------------------------------------------------- #
DESCARTES = [
    {'rede': 'UFMG', 'ppgContem': 'Ciências Aplicadas', 'modalidade': 'CAPACITACAO',
     'motivo': ('So na aba principal, e digitada na coluna "Bolsa PV (SENIOR)". '
                'Descartada por decisao do responsavel em 2026-09-22: mante-la '
                'daria cinco Capacitacoes UFMG, e o levantamento registra quatro.')},
]


def resolver(redes):
    """Aplica as regras acima. Devolve (composicao, descartes_aplicados)."""
    composicao, aplicados = {}, []

    def descarte_de(rede, ppg, mod):
        for d in DESCARTES:
            if d['rede'] == rede and d['ppgContem'] in (ppg or '') and d['modalidade'] == mod:
                return d
        return None

    for rede, v in redes.items():
        if rede == 'UNICAMP':
            composicao[rede] = {'_regra': 'copia vence inteira (revisao completa)',
                                'ppgs': v['copia']}
            continue
        if rede == 'UFMG':
            linhas_ = []
            for p, c in zip(v['principal'], v['copia']):
                lanc, vistos = [], set()
                for l in p['lancamentos']:
                    k = chave(l)
                    d = descarte_de(rede, p['ppg'], k)
                    if d:
                        aplicados.append({**d, 'ppg': p['ppg'], 'valorDescartado': l})
                        continue
                    lanc.append(l)
                    vistos.add(k)
                for l in c['lancamentos']:          # o que so a copia tem
                    if chave(l) not in vistos:
                        lanc.append({**l, '_origem': 'Cópia de Comitê UFMG'})
                linhas_.append({**p, 'lancamentos': lanc})   # orcamento: so a principal tem
            composicao[rede] = {'_regra': 'uniao; orcamento da principal; Capacitacoes da copia',
                                'ppgs': linhas_}
            continue
        composicao[rede] = {'_regra': 'aba unica', 'ppgs': v['principal']}
    return composicao, aplicados


def main():
    raiz = Path(__file__).resolve().parents[5]
    arq = raiz / 'Levantamento de Bolsas.xlsx'
    if not arq.exists():
        sys.exit(f'nao encontrei {arq}')
    z, ss, abas = abrir(arq)
    # Colunas por aba cuja mescla vertical descreve a tematica, e so elas.
    ler = lambda nome, prop: linhas(z, ss, abas[nome], propagar=prop)

    redes = {
        'UNICAMP': {'principal': ler_unicamp(ler('Comitê UNICAMP', (1, 5, 7, 8)), 3, 7),
                    'copia': ler_unicamp(ler('Cópia de Comitê UNICAMP', (1, 4, 5, 6, 7)), 2, 5)},
        'UFMG': {'principal': ler_ufmg_principal(ler('Comitê UFMG', (1, 4, 5, 6))),
                 'copia': ler_ufmg_copia(ler('Cópia de Comitê UFMG', (1, 4)))},
        'UNESP': {'principal': ler_unesp(ler('Comitê UNESP', (1, 5, 7, 8))), 'copia': None},
    }

    conflitos = []
    for rede, v in redes.items():
        if v['copia']:
            conflitos += comparar(rede, v['principal'], v['copia'])

    composicao, descartes = resolver(redes)

    saida = {
        '_origem': 'Levantamento de Bolsas.xlsx',
        '_extraido_em': '2026-09-22',
        '_aviso': ('As abas "Cópia de ..." são revisões, não duplicatas. Este arquivo '
                   'guarda as duas versões e lista as divergências em `conflitos`; '
                   'nenhuma foi escolhida automaticamente.'),
        'composicao': composicao,
        'descartes': descartes,
        'redes': redes,
        'conflitos': conflitos,
    }
    destino = Path(__file__).parent / 'planilha' / 'composicao-bolsas.json'
    destino.write_text(json.dumps(saida, ensure_ascii=False, indent=2), encoding='utf-8')

    print(f'gravado: {destino.relative_to(raiz)}')
    for rede, v in redes.items():
        n = sum(len(x['lancamentos']) for x in v['principal'])
        nc = sum(len(x['lancamentos']) for x in (v['copia'] or []))
        print(f'  {rede:8s} principal: {len(v["principal"]):2d} PPGs / {n:2d} lançamentos'
              + (f' | cópia: {len(v["copia"]):2d} PPGs / {nc:2d} lançamentos' if v['copia'] else ''))
    print(f'\nconflitos registrados: {len(conflitos)} (resolvidos pelas regras em `resolver`)')
    for rede, v in composicao.items():
        n = sum(len(x['lancamentos']) for x in v['ppgs'])
        cap = sum(1 for x in v['ppgs'] for l in x['lancamentos'] if chave(l) == 'CAPACITACAO')
        print(f'  {rede:8s} {len(v["ppgs"]):2d} PPGs / {n:2d} lançamentos'
              f' ({cap} capacitações) — {v["_regra"]}')
    for d in descartes:
        print(f'  descartado: {d["rede"]} · {d["ppg"][:34]} · {d["modalidade"]}'
              f' = {d["valorDescartado"]["quantidade"]:g}x{d["valorDescartado"].get("vigenciaMeses")}m')


if __name__ == '__main__':
    main()
