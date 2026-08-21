import { Selo } from "@/componentes/ui/basicos";
import type { ProdutoBolsa, SituacaoTemporalBolsa } from "@/lib/dominio";
import { rotulo } from "@/lib/formato";

export function SeloSituacaoBolsa({
  situacao,
}: {
  situacao: SituacaoTemporalBolsa;
}) {
  const tom: Record<
    SituacaoTemporalBolsa,
    "neutro" | "primario" | "sucesso" | "aviso" | "perigo"
  > = {
    PROGRAMADA: "neutro",
    PROXIMA: "primario",
    EM_VIGENCIA: "sucesso",
    PRESTES_A_EXPIRAR: "aviso",
    EXPIRADA: "perigo",
    CONCLUIDA: "sucesso",
    CANCELADA: "neutro",
    INTERROMPIDA: "perigo",
  };

  return <Selo tom={tom[situacao]}>{rotulo(situacao)}</Selo>;
}

export function SeloSituacaoProduto({
  situacao,
}: {
  situacao: ProdutoBolsa["situacao"];
}) {
  const tons = {
    PREVISTO: "neutro",
    EM_DESENVOLVIMENTO: "primario",
    ENTREGUE: "info",
    VALIDADO: "sucesso",
    CANCELADO: "neutro",
    ATRASADO: "perigo",
  } as const;

  return <Selo tom={tons[situacao]}>{rotulo(situacao)}</Selo>;
}
