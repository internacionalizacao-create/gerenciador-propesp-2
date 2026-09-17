import { z } from "zod";

import type { AlcanceConcessao, TipoAlvoAcesso } from "@/lib/dominio";

/**
 * Formulário de concessão de acesso (V1-018).
 *
 * **Um alcance por lote, não um por ação.** A ficha admite alcance por ação ou
 * por grupo; a tela escolheu o grupo, porque a matriz de 79 ações × 6 alcances
 * numa única página é revisável só no papel — ninguém confere 474 combinações
 * antes de salvar. Conceder alcances diferentes é repetir o formulário, e o
 * resultado no banco é o mesmo: uma linha por ação e alvo.
 *
 * O schema do cliente existe para a pessoa ver o erro antes do salto; a API
 * valida tudo de novo, e é ela quem recusa ação incompatível com o alvo.
 */

export const formularioConcessaoSchema = z
  .object({
    permissoes: z
      .array(z.string())
      .min(1, "Escolha ao menos uma ação para conceder."),
    tipoAlvo: z.enum([
      "GLOBAL",
      "CICLO",
      "PPG",
      "REDE",
      "TEMATICA",
      "PARTICIPACAO",
    ]),
    /** Id do alvo escolhido; vazio quando o alcance é GLOBAL. */
    alvoId: z.string().optional(),
    /**
     * Ciclo do PPG. É campo próprio porque o alvo `PPG` tem **dois** ids, e
     * derivar o ciclo do "ciclo atual da tela" faria a concessão mudar de
     * significado conforme a página em que a pessoa estivesse.
     */
    cicloDoPpg: z.string().optional(),
    motivo: z
      .string()
      .trim()
      .min(5, "Diga por que este acesso está sendo concedido.")
      .max(2000),
    /** Modelo que preencheu a seleção, quando houve um. Explicativo. */
    origem: z.string().optional(),
  })
  .superRefine((valor, contexto) => {
    if (valor.tipoAlvo !== "GLOBAL" && !valor.alvoId) {
      contexto.addIssue({
        code: "custom",
        path: ["alvoId"],
        message: "Escolha o alcance desta concessão.",
      });
    }
    if (valor.tipoAlvo === "PPG" && !valor.cicloDoPpg) {
      contexto.addIssue({
        code: "custom",
        path: ["cicloDoPpg"],
        message: "O acesso a um PPG vale em um ciclo; escolha qual.",
      });
    }
  });

export type DadosFormularioConcessao = z.infer<
  typeof formularioConcessaoSchema
>;

/** Monta o alcance no formato que a API grava. */
export function alcanceDoFormulario(
  dados: DadosFormularioConcessao,
): AlcanceConcessao {
  const alvoId = dados.alvoId ?? "";

  switch (dados.tipoAlvo) {
    case "GLOBAL":
      return { tipo: "GLOBAL" };
    case "CICLO":
      return { tipo: "CICLO", cicloId: alvoId };
    case "PPG":
      return { tipo: "PPG", ppgId: alvoId, cicloId: dados.cicloDoPpg ?? "" };
    case "REDE":
      return { tipo: "REDE", redeId: alvoId };
    case "TEMATICA":
      return { tipo: "TEMATICA", tematicaId: alvoId };
    case "PARTICIPACAO":
      return { tipo: "PARTICIPACAO", participacaoId: alvoId };
  }
}

/** Corpo do lote, do jeito que `/acesso/usuarios/:id/concessoes` espera. */
export function payloadConcessao(dados: DadosFormularioConcessao) {
  const escopo = alcanceDoFormulario(dados);

  return {
    motivo: dados.motivo,
    ...(dados.origem ? { origem: dados.origem } : {}),
    concessoes: dados.permissoes.map((permissao) => ({ permissao, escopo })),
  };
}

/**
 * Alcances que **todas** as ações escolhidas aceitam.
 *
 * Interseção, e não união: oferecer um alcance que só metade das ações admite
 * produziria um lote recusado inteiro pela API — e a pessoa descobriria isso
 * depois de escolher tudo. Com a interseção, escolher uma ação institucional
 * junto de uma de planejamento reduz o seletor a `GLOBAL`, que é a verdade.
 */
export function alcancesCompativeis(
  permissoes: readonly string[],
  catalogo: readonly { permissao: string; escopos: TipoAlvoAcesso[] }[],
): TipoAlvoAcesso[] {
  const escolhidas = catalogo.filter((acao) =>
    permissoes.includes(acao.permissao),
  );
  if (escolhidas.length === 0) return [];

  return escolhidas
    .map((acao) => acao.escopos)
    .reduce((comuns, escopos) =>
      comuns.filter((tipo) => escopos.includes(tipo)),
    );
}

/**
 * Agrupa as ações pelo domínio antes dos dois-pontos.
 *
 * O catálogo já nomeia o módulo em cada chave (`plano:create`), então o grupo
 * sai do próprio nome em vez de uma segunda lista para manter em dia — que
 * divergiria na primeira ação nova.
 */
export function agruparPorModulo<T extends { permissao: string }>(
  acoes: readonly T[],
): { modulo: string; acoes: T[] }[] {
  const grupos = new Map<string, T[]>();

  for (const acao of acoes) {
    const modulo = acao.permissao.split(":")[0];
    grupos.set(modulo, [...(grupos.get(modulo) ?? []), acao]);
  }

  return [...grupos.entries()]
    .map(([modulo, lista]) => ({ modulo, acoes: lista }))
    .sort((a, b) => a.modulo.localeCompare(b.modulo, "pt-BR"));
}

/** Rótulo do módulo para o cabeçalho do grupo. */

/** Texto do alcance para quem lê a lista, sem UUID. */
export function descreverAlcance(
  escopo: AlcanceConcessao,
  nomes: {
    ciclos?: Record<string, string>;
    ppgs?: Record<string, string>;
    redes?: Record<string, string>;
    tematicas?: Record<string, string>;
    participacoes?: Record<string, string>;
  } = {},
): string {
  const nome = (mapa: Record<string, string> | undefined, id: string) =>
    mapa?.[id] ?? "alvo não encontrado";

  switch (escopo.tipo) {
    case "GLOBAL":
      return "Todo o sistema";
    case "CICLO":
      return `Ciclo ${nome(nomes.ciclos, escopo.cicloId)}`;
    case "PPG":
      return `${nome(nomes.ppgs, escopo.ppgId)} · ciclo ${nome(nomes.ciclos, escopo.cicloId)}`;
    case "REDE":
      return `Rede ${nome(nomes.redes, escopo.redeId)}`;
    case "TEMATICA":
      return `Temática ${nome(nomes.tematicas, escopo.tematicaId)}`;
    case "PARTICIPACAO":
      return `Participação ${nome(nomes.participacoes, escopo.participacaoId)}`;
  }
}
