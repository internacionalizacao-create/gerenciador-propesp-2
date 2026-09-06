"use server";

import { enviar, enviarArquivo, texto, type EstadoDaAcao } from "@/lib/acao";
import { montarCorpoDaDespesa } from "@/lib/formularios/despesa-payload";

/**
 * Server Actions da prestação de contas (CG-053).
 *
 * **Tudo em reais.** A conversão de despesa feita no exterior acontece antes do
 * lançamento (CG-009), então não há moeda de origem nem cotação de câmbio — e
 * `valorTotal` viaja como string decimal do começo ao fim, nunca como `number`.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const rota = ({ programa, ciclo, id }: Contexto) =>
  `/programas/${programa}/${ciclo}/comite-gestor/missoes/${id}/prestacao`;

const revalidar = (contexto: Contexto) => [
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor/missoes/${contexto.id}`,
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor`,
];

/** Abre a prestação manualmente; ela também abre sozinha na realização. */
export async function iniciarPrestacao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    rota(contexto),
    "POST",
    {},
    revalidar(contexto),
    "Prestação iniciada.",
  );
}

export async function criarDespesa(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/despesas`,
    "POST",
    montarCorpoDaDespesa(formulario),
    revalidar(contexto),
    "Despesa lançada.",
  );
}

export async function atualizarDespesa(
  contexto: Contexto & { despesaId: string },
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/despesas/${contexto.despesaId}`,
    "PATCH",
    montarCorpoDaDespesa(formulario),
    revalidar(contexto),
    "Despesa atualizada.",
  );
}

/**
 * Remove a despesa.
 *
 * A API recusa quando ela tem documento: o vínculo de `anexo` é polimórfico e
 * não tem chave estrangeira, então apagar a linha deixaria o documento órfão e
 * o histórico mentiria (CG-052). A mensagem da API explica isso e é repassada
 * inteira.
 */
export async function removerDespesa(
  contexto: Contexto & { despesaId: string },
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/despesas/${contexto.despesaId}`,
    "DELETE",
    undefined,
    revalidar(contexto),
    "Despesa removida.",
  );
}

/**
 * Anexa documento a uma despesa, a uma cotação ou à própria missão.
 *
 * O alvo vem do formulário porque a permissão exigida depende dele — é por isso
 * que `/anexos` não tem `@RequirePermission` fixo na API: ela lê o corpo e
 * aplica a permissão da entidade de destino.
 */
export async function anexarDocumento(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const arquivo = formulario.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, mensagem: "Escolha um arquivo para anexar." };
  }

  const corpo = new FormData();
  corpo.append("arquivo", arquivo);
  corpo.append("entidadeTipo", String(formulario.get("entidadeTipo") ?? ""));
  corpo.append("entidadeId", String(formulario.get("entidadeId") ?? ""));
  corpo.append("categoria", String(formulario.get("categoria") ?? "OUTRO"));

  const legenda = texto(formulario, "legenda");
  if (legenda) corpo.append("legenda", legenda);

  return enviarArquivo(
    "/anexos",
    corpo,
    revalidar(contexto),
    "Documento anexado.",
  );
}

/**
 * Envia a prestação para revisão (CG-054).
 *
 * Serve para o primeiro envio e para o reenvio depois de uma devolução: os dois
 * partem de estado editável. A API recusa quando não há despesa nenhuma —
 * prestação sem lançamento tem total nulo, e validar a ausência de informação
 * não significa nada.
 */
export async function enviarPrestacao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/envio`,
    "POST",
    {},
    revalidar(contexto),
    "Prestação enviada para revisão.",
  );
}

/**
 * Valida a prestação.
 *
 * **É o único estado que abate o aporte** (CG-009). Exige `prestacao:review`,
 * não `prestacao:write`: preparar e revisar são atos distintos, mesmo enquanto
 * só o `admin` tem as duas permissões.
 */
export async function validarPrestacao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/validacao`,
    "POST",
    { parecer: texto(formulario, "parecer") },
    revalidar(contexto),
    "Prestação validada.",
  );
}

/** Devolve com pendência; a prestação volta a aceitar lançamento. */
export async function devolverPrestacao(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  return enviar(
    `${rota(contexto)}/devolucao`,
    "POST",
    { parecer: texto(formulario, "parecer") },
    revalidar(contexto),
    "Prestação devolvida para correção.",
  );
}
