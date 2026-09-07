/**
 * Recorte das alterações que o relator precisa ver (CG-048).
 *
 * Vive fora do componente porque `node --test` não carrega `.tsx` — e esta é
 * exatamente a lógica que merece teste: são duas bordas, e errar qualquer uma
 * passa despercebido na tela.
 */

export interface RegistroDeAlteracao {
  acao: string;
  ocorridoEm: string;
}

/**
 * A janela vai da última decisão até o reenvio: é o que o responsável mudou
 * **em resposta ao parecer**.
 *
 * Sem a borda de baixo (`ultimaDecisao`), a rodada anterior volta à lista e
 * obriga a garimpar o que já foi lido. Sem a de cima (`submetidoEm`), entram as
 * mudanças posteriores ao envio — que existem e são de **execução**, não da
 * proposta: aprovação e execução são eixos independentes (CG-006), e a missão
 * avança de planejada a concluída enquanto a análise corre. A edição da
 * proposta congela em `EM_ANALISE` (CG-037), então nada de proposta cabe
 * depois do envio.
 *
 * O corte é por **tempo**, não por lista de campos: uma lista de campos
 * relevantes envelheceria em silêncio no dia em que um campo novo aparecesse.
 */
export function alteracoesDaRodada<T extends RegistroDeAlteracao>(
  historico: readonly T[],
  janela: { ultimaDecisaoEm?: string; submetidoEm?: string },
): T[] {
  return historico.filter(
    (registro) =>
      registro.acao === "EDICAO" &&
      (!janela.ultimaDecisaoEm ||
        registro.ocorridoEm > janela.ultimaDecisaoEm) &&
      (!janela.submetidoEm || registro.ocorridoEm <= janela.submetidoEm),
  );
}

/** Encerramento mais recente entre as rodadas já decididas. */
export function ultimaDecisaoEm(
  rodadas: readonly { encerradaEm: string | null }[],
): string | undefined {
  return rodadas
    .map((rodada) => rodada.encerradaEm)
    .filter((valor): valor is string => valor !== null)
    .sort()
    .at(-1);
}
