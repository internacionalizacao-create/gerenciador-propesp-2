"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import { dataBrParaIso } from "@/lib/formato";
import type { DadosFormularioMembroEquipe } from "@/lib/formularios/comite-gestor";
import {
  payloadCriacaoMissao,
  type DadosFormularioMissaoComite,
} from "@/lib/formularios/missao-comite";

interface ContextoComite {
  programa: string;
  ciclo: string;
}

function dadosDoVinculo(dados: DadosFormularioMembroEquipe) {
  return {
    tipoEquipe: dados.tipoEquipe,
    funcao: dados.funcao,
    dataInicio: dataBrParaIso(dados.dataInicio),
    dataFim: dataBrParaIso(dados.dataFim),
    observacoes: opcional(dados.observacoes),
  };
}

export async function criarMembroEquipe(
  contexto: ContextoComite,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioMembroEquipe,
): Promise<EstadoDaAcao> {
  const novaPessoa = dados.modoPessoa === "nova";
  const base = `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`;

  return enviar(
    `${base}/equipes`,
    "POST",
    {
      ...dadosDoVinculo(dados),
      pessoaId: novaPessoa ? undefined : opcional(dados.pessoaId),
      novaPessoa: novaPessoa
        ? {
            nome: dados.nomePessoa,
            email: opcional(dados.emailPessoa),
            cpf: opcional(dados.cpfPessoa),
            tipo: dados.tipoPessoa,
          }
        : undefined,
    },
    [base],
    "Membro adicionado à equipe.",
  );
}

export async function atualizarMembroEquipe(
  contexto: ContextoComite & { id: string },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioMembroEquipe,
): Promise<EstadoDaAcao> {
  const base = `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`;
  return enviar(
    `${base}/equipes/${contexto.id}`,
    "PATCH",
    dadosDoVinculo(dados),
    [base],
    "Vínculo atualizado.",
  );
}

export async function criarMissaoComite(
  contexto: ContextoComite,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioMissaoComite,
): Promise<EstadoDaAcao> {
  const base = `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`;
  return enviar(
    `${base}/missoes`,
    "POST",
    payloadCriacaoMissao(dados),
    [base],
    "Missão cadastrada.",
  );
}

function opcional(valor: string): string | undefined {
  const normalizado = valor.trim();
  return normalizado === "" ? undefined : normalizado;
}
