#!/usr/bin/env python3
"""
Extrai os dados das planilhas originais para JSON versionado.

Roda uma vez (ou quando as planilhas forem atualizadas). O JSON gerado em
`planilha/` é o que a seed consome — ele fica no repositório porque é o dado
migrado, e precisa ser auditável sem depender dos .xlsx, que não são versionados.

Uso (a partir de apps/api):
    python3 src/database/seed/extrair-planilhas.py ../../dados
"""

import base64
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {
    "m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
}

CAPES = (
    "Planejamento_CAPES_Global_Consolidado_UFMG_Comite_Gestor/"
    "Planejamento_CAPES_Global_Consolidado_UFMG_Comite_Gestor.xlsx"
)


# --------------------------------------------------------------------------- #
# Leitura do .xlsx (um zip de XML) usando só a biblioteca padrão.
# --------------------------------------------------------------------------- #
def abrir(caminho):
    z = zipfile.ZipFile(caminho)

    compartilhados = []
    if "xl/sharedStrings.xml" in z.namelist():
        raiz = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in raiz.findall("m:si", NS):
            compartilhados.append(
                "".join(t.text or "" for t in si.iter(f"{{{NS['m']}}}t"))
            )

    rels = {}
    raiz = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    for rel in raiz:
        rels[rel.get("Id")] = rel.get("Target").lstrip("/").replace("xl/", "")

    abas = {}
    raiz = ET.fromstring(z.read("xl/workbook.xml"))
    for sheet in raiz.find("m:sheets", NS):
        alvo = rels.get(sheet.get(f"{{{NS['r']}}}id"), "")
        abas[sheet.get("name")] = f"xl/{alvo}"

    return z, compartilhados, abas


def indice_coluna(ref):
    letras = re.match(r"([A-Z]+)", ref).group(1)
    n = 0
    for ch in letras:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def ler(z, compartilhados, caminho):
    linhas = []
    raiz = ET.fromstring(z.read(caminho))
    dados = raiz.find("m:sheetData", NS)
    if dados is None:
        return linhas

    for row in dados:
        celulas = {}
        for c in row:
            ref = c.get("r") or ""
            if not ref:
                continue
            tipo, v = c.get("t"), c.find("m:v", NS)
            if tipo == "s" and v is not None:
                valor = compartilhados[int(v.text)]
            elif tipo == "inlineStr":
                is_ = c.find("m:is", NS)
                valor = (
                    "".join(t.text or "" for t in is_.iter(f"{{{NS['m']}}}t"))
                    if is_ is not None
                    else ""
                )
            else:
                valor = v.text if v is not None else ""
            if valor not in (None, ""):
                celulas[indice_coluna(ref)] = valor
        largura = max(celulas) + 1 if celulas else 0
        linhas.append([celulas.get(i, "") for i in range(largura)])
    return [l for l in linhas if any(str(c).strip() for c in l)]


# --------------------------------------------------------------------------- #
# Normalização
# --------------------------------------------------------------------------- #
def txt(linha, i):
    """Célula como texto limpo. Trata os lixos de digitação da planilha:
    espaço sobrando, parêntese solto no fim de e-mail, quebra de linha."""
    if i >= len(linha):
        return None
    v = str(linha[i]).replace("\n", " ").strip().rstrip(")").strip()
    return v or None


def num(linha, i):
    if i >= len(linha):
        return None
    v = str(linha[i]).strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def dinheiro(valor):
    """Formata como string de 2 casas — o formato que o Postgres `numeric` recebe."""
    return None if valor is None else f"{valor:.2f}"


# As duas planilhas escrevem a mesma modalidade de jeitos diferentes
# ("Doutorado sanduíche" no anexo Brasil, "Doutorado Sanduíche" no exterior).
# Sem esta tabela, a mesma bolsa viraria duas modalidades distintas no banco.
MODALIDADES = {
    "professor visitante": "Professor Visitante",
    "professor visitante senior": "Professor Visitante Sênior",
    "professor visitante sênior": "Professor Visitante Sênior",
    "professor visitante junior": "Professor Visitante Junior",
    "professor visitante júnior": "Professor Visitante Junior",
    "jovem talento": "Jovem Talento",
    "pos-doutorado": "Pós-doutorado",
    "pós-doutorado": "Pós-doutorado",
    "doutorado sanduiche": "Doutorado Sanduíche",
    "doutorado sanduíche": "Doutorado Sanduíche",
    "capacitacao": "Capacitação",
    "capacitação": "Capacitação",
}

MESES = {
    "janeiro": "JANEIRO", "fevereiro": "FEVEREIRO", "março": "MARCO",
    "marco": "MARCO", "abril": "ABRIL", "maio": "MAIO", "junho": "JUNHO",
    "julho": "JULHO", "agosto": "AGOSTO", "setembro": "SETEMBRO",
    "outubro": "OUTUBRO", "novembro": "NOVEMBRO", "dezembro": "DEZEMBRO",
}


def modalidade(bruto):
    if not bruto:
        return None
    chave = bruto.strip().lower()
    if chave not in MODALIDADES:
        raise SystemExit(f"Modalidade desconhecida na planilha: {bruto!r}")
    return MODALIDADES[chave]


def mes(bruto):
    return MESES.get(bruto.strip().lower()) if bruto else None


def destino(bruto):
    if not bruto:
        return None
    return "BRASIL" if bruto.strip().lower().startswith("brasil") else "EXTERIOR"


# --------------------------------------------------------------------------- #
# Extratores por aba
# --------------------------------------------------------------------------- #
def extrair_catalogo(linhas):
    itens = []
    for l in linhas[3:]:
        codigo = txt(l, 0)
        if not codigo or not codigo.startswith("CAT-"):
            continue
        itens.append({
            "codigo": codigo,
            "destino": destino(txt(l, 1)),
            "modalidade": modalidade(txt(l, 2)),
            "vigenciaMeses": f"{num(l, 3):.1f}",
            "valorUsd": dinheiro(num(l, 4)),
            "valorBrl": dinheiro(num(l, 5)),
            "fonte": txt(l, 6),
            "observacao": txt(l, 7),
        })
    return itens


def extrair_ppgs(linhas):
    ppgs = []
    for l in linhas[3:]:
        nome = txt(l, 3)
        if not nome:
            continue
        situacao = (txt(l, 7) or "").lower()
        ppgs.append({
            "rede": txt(l, 0),
            "temaId": txt(l, 1),
            "nome": nome,
            "sigla": txt(l, 4),
            "notaCapes": int(num(l, 5)) if num(l, 5) else None,
            "membroComite": txt(l, 6),
            "situacao": (
                "CONTEMPLADO" if situacao.startswith("contemplado")
                else "CADASTRO_PRELIMINAR"
            ),
            "modalidadesPrevistas": txt(l, 14),
            "observacoes": txt(l, 15),
        })
    return ppgs


def extrair_tematicas(linhas):
    temas = []
    for l in linhas[3:]:
        codigo = txt(l, 1)
        if not codigo:
            continue
        definido = (txt(l, 5) or "").lower().startswith("definido")
        membros = [m.strip() for m in (txt(l, 3) or "").split(";") if m.strip()]
        temas.append({
            "rede": txt(l, 0),
            "codigo": codigo,
            "nome": txt(l, 2),
            "membros": membros,
            "qtdPpgs": int(num(l, 4)) if num(l, 4) else 0,
            "statusOrcamento": "DEFINIDO" if definido else "A_DEFINIR",
            "valorBolsas": dinheiro(num(l, 6)),
            "valorManutencao": dinheiro(num(l, 7)),
            "valorMissoes": dinheiro(num(l, 8)),
            "custoBolsasInformado": dinheiro(num(l, 11)),
            "saldoInformado": dinheiro(num(l, 13)),
            "observacoes": txt(l, 23),
        })
    return temas


def extrair_plano(linhas):
    itens = []
    for l in linhas[3:]:
        codigo = txt(l, 0)
        if not codigo or not codigo.startswith("BOL-"):
            continue
        qtd = num(l, 7)
        vig = num(l, 8)
        pendente = (txt(l, 10) or "").lower().startswith("pend") or not vig
        itens.append({
            "codigo": codigo,
            "rede": txt(l, 1),
            "temaId": txt(l, 2),
            "ppg": txt(l, 4),
            "destino": destino(txt(l, 5)),
            "modalidade": modalidade(txt(l, 6)),
            "quantidadeAnual": int(qtd) if qtd else 0,
            "vigenciaMeses": f"{vig:.1f}" if vig else None,
            "mesImplementacao": mes(txt(l, 9)),
            "status": "PENDENTE" if pendente else "PROGRAMADO",
            "valorUnitario": dinheiro(num(l, 11)),
            "fluxo": (txt(l, 25) or "").upper() if txt(l, 25) in ("IN", "OUT") else None,
            "textoFonte": txt(l, 23),
            "validacao": txt(l, 24),
        })
    return itens


def extrair_pendencias(linhas):
    pend = []
    for l in linhas[3:]:
        codigo = txt(l, 0)
        if not codigo or not codigo.upper().startswith(("PEND-", "PEN-")):
            continue
        pend.append({
            "codigo": codigo,
            "escopoRede": txt(l, 1),
            "escopoTema": txt(l, 2),
            "assunto": txt(l, 3),
            "descricao": txt(l, 4),
            "impacto": txt(l, 5),
            "responsavel": txt(l, 6),
            "prazo": txt(l, 7),
            "status": txt(l, 8),
        })
    return pend


def extrair_premissas(linhas):
    premissas, vistos = [], set()
    for l in linhas:
        item = txt(l, 0)
        # A aba repete o mesmo bloco duas vezes (§9.4); a chave evita duplicar.
        if not item or item in vistos:
            continue
        if txt(l, 3) in ("Premissa institucional", "Entrada oficial do anexo",
                         "Restrição da fonte", "Premissa gerencial"):
            vistos.add(item)
            premissas.append({
                "item": item,
                "valor": txt(l, 1),
                "unidade": txt(l, 2),
                "natureza": txt(l, 3),
                "fonte": txt(l, 4),
                "dataBase": "2026-07-29",
                "responsavel": txt(l, 6),
                "observacoes": txt(l, 7),
            })
    return premissas


def extrair_comite_gestor(linhas):
    linhas_cg = []
    for l in linhas:
        nome = txt(l, 0)
        if nome in ("UFMG", "UNESP", "UNICAMP") and num(l, 1):
            linhas_cg.append({
                "rede": nome,
                "valorAnual": dinheiro(num(l, 1)),
                "anos": [2026, 2027, 2028, 2029],
            })
    return linhas_cg


# --------------------------------------------------------------------------- #
def main():
    raiz = Path(sys.argv[1] if len(sys.argv) > 1 else "../../dados")
    z, sh, abas = abrir(raiz / CAPES)
    aba = lambda nome: ler(z, sh, abas[nome])

    saida = {
        "_origem": CAPES,
        "_extraidoEm": "2026-08-04",
        "catalogo": extrair_catalogo(aba("Catálogo Bolsas")),
        "ppgs": extrair_ppgs(aba("PPGs")),
        "tematicas": extrair_tematicas(aba("Redes_Tematicas")),
        "plano": extrair_plano(aba("Plano_Bolsas")),
        "pendencias": extrair_pendencias(aba("Pendencias")),
        "premissas": extrair_premissas(aba("Premissas")),
        "comiteGestor": extrair_comite_gestor(aba("Comitê Gestor 2026-2029")),
    }

    # Emite TypeScript, e não JSON: a API compila para CommonJS e os testes rodam
    # em ESM. Ler arquivo em runtime exigiria `__dirname` num lado e
    # `import.meta.url` no outro. Um módulo comum funciona nos dois e ainda passa
    # pelo compilador.
    destino_arq = Path(__file__).parent / "planilha" / "capes-global.ts"
    destino_arq.parent.mkdir(parents=True, exist_ok=True)
    corpo = json.dumps(saida, ensure_ascii=False, indent=2)
    destino_arq.write_text(
        "// GERADO POR src/database/seed/extrair-planilhas.py — NAO EDITE A MAO.\n"
        f"// Origem: {CAPES}\n"
        "// Para atualizar: python3 src/database/seed/extrair-planilhas.py ../../dados\n"
        "\n"
        f"export const planilhaCapesGlobal = {corpo} as const;\n",
        encoding="utf-8",
    )

    for chave, valor in saida.items():
        if isinstance(valor, list):
            print(f"  {chave:<14} {len(valor):>3} registros")
    print(f"\ngravado em {destino_arq}")


if __name__ == "__main__":
    main()
