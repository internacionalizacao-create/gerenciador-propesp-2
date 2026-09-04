import type { LinhaRede } from "@/lib/dominio";

export interface PontoDaSerie {
  ano: string;
  [rede: string]: number | string | null;
}

/**
 * Transforma as linhas da API na matriz ano x rede que o Recharts consome.
 *
 * Fica em arquivo proprio, sem JSX, por duas razoes. A regra que ela guarda e
 * de dominio, nao de desenho; e o `node --test` carrega TypeScript em modo
 * strip-only, que nao le `.tsx` — sem a separacao a regra abaixo ficaria sem
 * teste. Mesma convencao de `multistep-logica.ts` e `toast-logica.ts`.
 *
 * A regra: `null` precisa CONTINUAR null ate o Recharts, que desenha um
 * vazio — a leitura certa de "A definir". Trocar por 0 aqui pintaria uma barra
 * rente ao eixo, indistinguivel de um orcamento zerado de verdade.
 *
 * A conversao para `number` serve so para calcular altura de barra em pixels.
 * Nenhum total sai daqui: soma de dinheiro continua em `somarMoeda`, que
 * trabalha em centavos com BigInt.
 */
export function montarSerie(
  redes: readonly LinhaRede[],
  anos: readonly number[],
): { nomes: string[]; dados: PontoDaSerie[]; temAlgumValor: boolean } {
  const nomes = [...new Set(redes.map((linha) => linha.rede))];

  const dados = anos.map((ano) => {
    const ponto: PontoDaSerie = { ano: String(ano) };
    for (const nome of nomes) {
      const linha = redes.find((l) => l.ano === ano && l.rede === nome);
      ponto[nome] =
        linha?.totalPrevisto == null ? null : Number(linha.totalPrevisto);
    }
    return ponto;
  });

  const temAlgumValor = dados.some((ponto) =>
    nomes.some((nome) => ponto[nome] !== null),
  );

  return { nomes, dados, temAlgumValor };
}
