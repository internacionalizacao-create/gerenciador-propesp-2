"use server";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadEdicaoMissao,
  type DadosFormularioMissaoComite,
} from "@/lib/formularios/missao-comite";

/**
 * Ciclo de vida da execução da missão (V1-030).
 *
 * As duas dimensões da CG-006 continuam separadas, e estas ações são todas da
 * **execução**: confirmar, cancelar e reabrir dizem o que aconteceu com a
 * viagem. Enviar, decidir e reabrir a *análise* vivem em `analise.ts` e falam
 * da aprovação — uma missão aprovada pode não ter acontecido, e uma cancelada
 * pode ter sido aprovada antes.
 *
 * **Encerrar (`CONCLUIR`) mora em `encerramento.ts`**, e não aqui, porque desde
 * a CG-058 ele deixou de ser uma transição simples: passa pelo checklist
 * inteiro e carrega as ações de dispensa junto.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const rota = ({ programa, ciclo, id }: Contexto) =>
  `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;

const revalidar = (contexto: Contexto) => [
  rota(contexto),
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`,
];

/**
 * Confirma a missão: ela deixa de ser plano e passa a ser viagem contratada.
 *
 * A API aceita só a partir de `RASCUNHO` ou `PLANEJADA`, e é ela quem decide —
 * a tela esconde o botão nos outros estados, mas quem chama direto recebe 409.
 */
export async function confirmarMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/situacao`,
    "POST",
    { acao: "CONFIRMAR", justificativa: null },
    revalidar(contexto),
    "Missão confirmada.",
  );
}

/**
 * Cancela a missão. **A justificativa é obrigatória**, e a API a exige também.
 *
 * É a única saída que encerra a missão sem que ela tenha acontecido, e por isso
 * o motivo precisa ficar no histórico. Cancelar **não apaga nada**: documentos,
 * despesas e o que já foi relatado continuam onde estão — o que muda é o estado
 * da missão, e quem olhar depois precisa achar o rastro completo.
 */
export async function cancelarMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: { justificativa: string },
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/situacao`,
    "POST",
    { acao: "CANCELAR", justificativa: dados.justificativa },
    revalidar(contexto),
    "Missão cancelada.",
  );
}

/**
 * Reabre a **execução** de uma missão encerrada ou cancelada.
 *
 * `.../reabertura`, sem `analise` no caminho — o vizinho
 * `.../analise/reabertura` reabre a decisão do Comitê, que é outra coisa
 * (CG-038). Confundir os dois é fácil e o efeito é bem diferente.
 *
 * É operação administrativa, fora do fluxo normal: exige
 * `missao:reopen-execucao` e justificativa de pelo menos 10 caracteres, porque
 * desfazer um encerramento precisa dizer quem autorizou e por quê.
 */
export async function reabrirExecucaoDaMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: { justificativa: string },
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/reabertura`,
    "POST",
    { justificativa: dados.justificativa },
    revalidar(contexto),
    "Execução da missão reaberta.",
  );
}

/**
 * Edita o planejamento da missão.
 *
 * **Participantes e roteiro vão com `id`** quando já existiam: o endpoint
 * reconcilia a lista inteira, e mandar sem `id` criaria linhas novas deixando
 * as antigas órfãs — o roteiro dobraria de tamanho a cada salvamento.
 *
 * A API congela a edição enquanto a missão está `EM_ANALISE` (CG-037): sem
 * isso o Comitê aprovaria texto diferente do que leu. A tela não reimplementa
 * essa regra; ela esconde o botão e deixa a recusa para a API.
 */
export async function atualizarMissaoComite(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioMissaoComite,
): Promise<EstadoDaAcao> {
  return enviar(
    rota(contexto),
    "PATCH",
    payloadEdicaoMissao(dados),
    revalidar(contexto),
    "Missão atualizada.",
  );
}
