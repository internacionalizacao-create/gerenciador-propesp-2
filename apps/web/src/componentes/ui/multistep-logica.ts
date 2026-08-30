export interface ErroDeCampo {
  campo: string;
  mensagem: string;
}

/** Remove repeticoes que podem surgir de schemas Zod compostos. */
export function errosUnicos(erros: readonly ErroDeCampo[] = []): ErroDeCampo[] {
  return erros.filter(
    (erro, indice) =>
      erros.findIndex(
        (outro) =>
          outro.campo === erro.campo && outro.mensagem === erro.mensagem,
      ) === indice,
  );
}

/** Localiza a primeira etapa que contem um campo rejeitado pela API. */
export function indiceDaPrimeiraEtapaComErro(
  camposPorEtapa: readonly (readonly string[])[],
  erros: readonly ErroDeCampo[] = [],
): number {
  return camposPorEtapa.findIndex((campos) =>
    erros.some((erro) => campos.includes(erro.campo)),
  );
}
