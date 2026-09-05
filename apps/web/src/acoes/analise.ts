"use server";

import { enviar, texto, type EstadoDaAcao } from "@/lib/acao";
import { dataBrParaIso } from "@/lib/formato";

/**
 * Server Actions da análise da missão (CG-037 e CG-038).
 *
 * As três operações movem a dimensão de **aprovação**, nunca a de execução —
 * são eixos independentes (CG-006), e misturá-los aqui faria aprovar uma missão
 * marcá-la como realizada.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const rota = ({ programa, ciclo, id }: Contexto) =>
  `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}`;

/** Caminhos que precisam ser revalidados: o detalhe e a lista que o precede. */
const revalidar = (contexto: Contexto) => [
  rota(contexto),
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`,
];

/**
 * Envia a missão para análise (CG-037).
 *
 * Sem corpo: quem envia vem do token, e o que falta vem do banco. A recusa por
 * documento faltando volta como 422 com a lista, que `traduzirErro` repassa em
 * `pendencias` para a tela dizer o que anexar.
 */
export async function submeterMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/submissao`,
    "POST",
    {},
    revalidar(contexto),
    "Missão enviada para análise do Comitê.",
  );
}

/**
 * Registra a decisão que encerra a rodada aberta (CG-038).
 *
 * `reuniaoData` só acompanha aprovar e reprovar: solicitar ajustes é ato do
 * relator, não deliberação do colegiado. A API recusa a combinação errada, e o
 * formulário esconde o campo — as duas barreiras, porque só a segunda seria
 * contornável.
 */
export async function decidirMissao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const acao = texto(formulario, "acao");

  return enviar(
    `${rota(contexto)}/decisao`,
    "POST",
    {
      acao,
      parecer: texto(formulario, "parecer"),
      // O campo `Data` entrega DD/MM/AAAA; a API só aceita ISO. Em ajustes o
      // campo nem existe, e mandar `undefined` é o que o schema espera — mandar
      // string vazia seria recusado com a mensagem errada.
      reuniaoData:
        acao === "SOLICITAR_AJUSTES"
          ? undefined
          : (dataBrParaIso(texto(formulario, "reuniaoData")) ?? undefined),
      observacoes: texto(formulario, "observacoes"),
    },
    revalidar(contexto),
    "Decisão registrada.",
  );
}

/**
 * Reabre análise já decidida (CG-038), exclusivo de `admin`.
 *
 * Cria rodada nova; a decisão anterior permanece no histórico. O caminho tem
 * `analise` no meio de propósito: `.../reabertura` sem ele reabre a *execução*
 * de uma missão concluída, que é outra coisa.
 */
export async function reabrirAnalise(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/analise/reabertura`,
    "POST",
    { justificativa: texto(formulario, "justificativa") },
    revalidar(contexto),
    "Análise reaberta.",
  );
}
