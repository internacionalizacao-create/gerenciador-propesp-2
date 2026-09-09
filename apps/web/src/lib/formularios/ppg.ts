import { z } from "zod";

const opcional = (maximo: number) => z.string().trim().max(maximo);

export const formularioPpgSchema = z.object({
  nome: z.string().trim().min(3, "Informe o nome do PPG.").max(240),
  sigla: z.string().trim().min(2, "Informe a sigla do PPG.").max(40),
  unidade: opcional(240),
  nivel: z.enum(["", "MESTRADO", "DOUTORADO", "MESTRADO_DOUTORADO", "MESTRADO_PROFISSIONAL"]),
  modalidade: z.enum(["", "ACADEMICO", "PROFISSIONAL"]),
  notaCapes: z.string().refine((valor) => valor === "" || (Number(valor) >= 1 && Number(valor) <= 7), "O conceito CAPES vai de 1 a 7."),
  areaCapes: opcional(240),
  situacao: z.enum(["ATIVO", "EM_IMPLANTACAO", "INATIVO"]),
  emRede: z.boolean(),
  redeAcademica: opcional(240),
  observacoes: opcional(4000),
  linhasPesquisa: z.array(z.string().trim().min(1).max(500)).max(100),
});

export type DadosFormularioPpg = z.infer<typeof formularioPpgSchema>;

const nulo = (valor: string) => valor.trim() || null;

export function payloadPpg(dados: DadosFormularioPpg) {
  return {
    nome: dados.nome.trim(), sigla: dados.sigla.trim(), unidade: nulo(dados.unidade),
    nivel: nulo(dados.nivel), modalidade: nulo(dados.modalidade),
    notaCapes: dados.notaCapes === "" ? null : Number(dados.notaCapes),
    areaCapes: nulo(dados.areaCapes), situacao: dados.situacao,
    emRede: dados.emRede, redeAcademica: nulo(dados.redeAcademica),
    observacoes: nulo(dados.observacoes), linhasPesquisa: dados.linhasPesquisa,
  };
}
