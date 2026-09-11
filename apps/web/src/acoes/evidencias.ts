"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";

import { apiFetch } from "@/lib/api";
import { traduzirErro, texto, type EstadoDaAcao } from "@/lib/acao";

/**
 * Galeria de fotos e evidências da missão (CG-057).
 *
 * **Upload múltiplo é N requisições, não um endpoint em lote.** Um lote
 * obrigaria a decidir o que fazer quando o terceiro arquivo falha: desfazer os
 * dois primeiros seria pior — eles subiram e são válidos —, e ignorar a falha
 * esconderia dela. Enviando um a um, o resultado honesto é o parcial, e a tela
 * diz qual arquivo ficou de fora e por quê.
 */

interface Contexto {
  programa: string;
  ciclo: string;
  id: string;
}

const revalidar = (contexto: Contexto) => [
  `/programas/${contexto.programa}/${contexto.ciclo}/comite-gestor/missoes/${contexto.id}`,
];

export async function anexarEvidencias(
  contexto: Contexto,
  _anterior: EstadoDaAcao,
  formulario: FormData,
): Promise<EstadoDaAcao> {
  const arquivos = formulario
    .getAll("arquivos")
    .filter((item): item is File => item instanceof File && item.size > 0);

  if (arquivos.length === 0) {
    return { ok: false, mensagem: "Escolha ao menos um arquivo." };
  }

  // Os metadados de evidência valem para todos os arquivos da seleção: eles
  // descrevem o momento, não o arquivo. A legenda individual se ajusta depois,
  // e por isso não há um campo de legenda por arquivo aqui.
  const comuns = {
    entidadeTipo: String(formulario.get("entidadeTipo") ?? ""),
    entidadeId: String(formulario.get("entidadeId") ?? ""),
    categoria: String(formulario.get("categoria") ?? "OUTRO"),
    visibilidade: String(formulario.get("visibilidade") ?? "INTERNA"),
    legenda: texto(formulario, "legenda"),
    dataEvidencia: texto(formulario, "dataEvidencia"),
    localEvidencia: texto(formulario, "localEvidencia"),
  };

  const falhas: string[] = [];
  let enviados = 0;

  for (const arquivo of arquivos) {
    const corpo = new FormData();
    corpo.append("arquivo", arquivo);
    for (const [campo, valor] of Object.entries(comuns)) {
      if (valor) corpo.append(campo, valor);
    }

    try {
      await apiFetch("/anexos", { method: "POST", body: corpo });
      enviados += 1;
    } catch (erro) {
      unstable_rethrow(erro);
      const traduzido = traduzirErro(erro);
      falhas.push(`${arquivo.name}: ${traduzido.mensagem ?? "falhou"}`);
    }
  }

  for (const rota of revalidar(contexto)) revalidatePath(rota);

  if (falhas.length === 0) {
    return {
      ok: true,
      mensagem:
        enviados === 1
          ? "Evidência anexada."
          : `${enviados} evidências anexadas.`,
    };
  }

  // Sucesso parcial não é sucesso: o toast fecharia o painel e esconderia o que
  // não subiu. `pendencias` carrega a lista até a tela, como no 422 da
  // submissão (CG-037).
  return {
    ok: false,
    mensagem:
      enviados > 0
        ? `${enviados} de ${arquivos.length} enviados; o resto falhou.`
        : "Nenhum arquivo foi aceito.",
    pendencias: falhas,
  };
}
