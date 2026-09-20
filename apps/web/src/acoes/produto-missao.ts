"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadProdutoMissao,
  type DadosFormularioProdutoMissao,
} from "@/lib/formularios/produto-missao";

/**
 * Produtos da missão (V1-031).
 *
 * Cada verbo tem a sua permissão — `produto-missao:create`, `:edit`,
 * `:delete` —, e a declaração negativa continua em `relato.ts`, com
 * `:declare`. A separação é a da CG-056: **cadastrar produto é dizer "sim"**, e
 * o "sim" não é um botão, é a existência da linha. Só o "não" é gravado.
 *
 * Por isso não existe aqui nada que "responda sim": quem cadastra um produto já
 * respondeu, e a API retira a declaração negativa sozinha, com auditoria.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const rota = ({ programa, ciclo, id }: Contexto) =>
  `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;

/**
 * Revalida também a produção consolidada e o painel.
 *
 * O produto aparece em quatro lugares — missão, painel do Comitê, relatório de
 * resultados e `/producao` (P18/P19) —, e todos leem do mesmo domínio. Deixar
 * `/producao` de fora faria o produto recém-cadastrado só aparecer lá na
 * próxima navegação completa.
 */
const revalidar = (contexto: Contexto) => [
  rota(contexto),
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`,
  "/producao",
];

export async function criarProdutoMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioProdutoMissao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/produtos`,
    "POST",
    payloadProdutoMissao(dados),
    revalidar(contexto),
    "Produto cadastrado.",
  );
}

export async function atualizarProdutoMissao(
  contexto: Contexto & { produtoId: string },
  _anterior: EstadoDaAcao,
  dados: DadosFormularioProdutoMissao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/produtos/${contexto.produtoId}`,
    "PATCH",
    payloadProdutoMissao(dados),
    revalidar(contexto),
    "Produto atualizado.",
  );
}

/**
 * Remove o produto.
 *
 * A API recusa em dois casos, e a tela **não os antecipa**: produto com
 * documento anexado (CG-052 — preservar a linha é o que mantém o vínculo
 * histórico válido) e o último produto de uma missão encerrada sem declaração
 * negativa (CG-059 — encerrar afirmou que havia resultado, e remover faria a
 * afirmação virar mentira em silêncio). Nos dois, a recusa vem com o motivo, e
 * é ele que diz o que fazer.
 */
export async function removerProdutoMissao(
  contexto: Contexto & { produtoId: string },
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/produtos/${contexto.produtoId}`,
    "DELETE",
    undefined,
    revalidar(contexto),
    "Produto removido.",
  );
}
