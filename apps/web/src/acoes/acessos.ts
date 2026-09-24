"use server";

import { revalidatePath } from "next/cache";

import { enviar, type EstadoDaAcao } from "@/lib/acao";
import {
  payloadConcessao,
  type DadosFormularioConcessao,
  type DadosFormularioVinculo,
} from "@/lib/formularios/acessos";

/**
 * Server Actions da administração de acessos (V1-018).
 *
 * Toda a política é da API (V1-017): autoalteração recusada, `acesso:*` exige
 * delegação, lote atômico e revogação que não pode deixar o sistema sem
 * administrador. Aqui só se monta o corpo e se diz o que revalidar — repetir a
 * regra deste lado criaria uma segunda versão dela para divergir.
 */

/**
 * A tela da conta é rota dinâmica, e a ação não conhece o segmento: por isso o
 * padrão da rota mais `"page"`, e não um caminho literal, que revalidaria uma
 * página inexistente e deixaria a lista mostrando o estado anterior.
 */
async function comRevalidacao(estado: Promise<EstadoDaAcao>) {
  const resultado = await estado;
  if (resultado.ok) {
    revalidatePath("/configuracoes/acessos", "page");
    revalidatePath("/configuracoes/acessos/[id]", "page");
  }
  return resultado;
}

export async function concederAcesso(
  usuarioId: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioConcessao,
): Promise<EstadoDaAcao> {
  const corpo = payloadConcessao(dados);

  return comRevalidacao(
    enviar(
      `/acesso/usuarios/${usuarioId}/concessoes`,
      "POST",
      corpo,
      [],
      `${corpo.concessoes.length} ação(ões) concedida(s).`,
    ),
  );
}

export async function revogarConcessao(
  concessaoId: string,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/acesso/concessoes/${concessaoId}/revogacao`,
      "POST",
      { motivo: String(formulario.get("motivo") ?? "") },
      [],
      "Acesso revogado.",
    ),
  );
}

/**
 * Liga a conta pendente à pessoa. Com `transferir`, a API tira a pessoa da
 * conta que a tem hoje e desativa aquela conta, no mesmo ato e com trilha.
 */
export async function vincularPessoa(
  usuarioId: string,
  pessoaId: string,
  _anterior: EstadoDaAcao,
  dados: DadosFormularioVinculo,
): Promise<EstadoDaAcao> {
  return comRevalidacao(
    enviar(
      `/acesso/usuarios/${usuarioId}/pessoa`,
      "POST",
      { pessoaId, motivo: dados.motivo, transferir: dados.transferir },
      [],
      dados.transferir
        ? "Conta vinculada; a conta anterior foi desativada."
        : "Conta vinculada.",
    ),
  );
}
