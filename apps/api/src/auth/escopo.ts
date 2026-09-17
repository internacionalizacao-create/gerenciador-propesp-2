import { sql, type SQL } from 'drizzle-orm';

import type { EscopoAcesso } from './identidade.service';

/**
 * Traducao do escopo de acesso para condicao SQL.
 *
 * A autorizacao por papel responde "pode listar PPG?". Esta camada responde a
 * outra metade — "**quais** PPGs?" — e ela precisa estar na consulta, nao na
 * interface: esconder item de menu nao e autorizacao, e a API e a fronteira que
 * de fato protege o dado.
 */

/**
 * **Sem concessao, sem dado** — e nao ha mais modo permissivo (V1-012).
 *
 * Ate 2026-09-16 existia aqui um `RECORTE_OBRIGATORIO = false` que liberava
 * tudo para quem nao tivesse escopo cadastrado. Ele existia porque o recorte
 * chegou a um sistema onde permissao vinha do papel e escopo de ninguem estava
 * configurado: fechar de uma vez cegaria todo coordenador sem explicacao.
 *
 * Esse risco acabou junto com o papel. Hoje a permissao **tambem** vem da
 * concessao, entao conta sem configuracao ja nao tem acao nenhuma para exercer,
 * e um recorte permissivo so serviria para vazar dado de quem foi configurado
 * pela metade — alguem com alcance de rede veria todos os PPGs.
 */

/** Nao ha o que recortar: o usuario ve tudo dentro do que o papel permite. */
const SEM_RECORTE = sql`true`;

/** Recorta tudo: nenhuma linha passa. */
const NADA = sql`false`;

/**
 * Condicao para uma coluna que guarda `ppg_id`.
 *
 * `coluna` entra como fragmento SQL cru — quem chama escreve `sql`p.ppg_id``,
 * nunca texto vindo do usuario.
 */
export function filtroPorPpg(escopo: EscopoAcesso, coluna: SQL): SQL {
  if (escopo.global) return SEM_RECORTE;
  if (escopo.ppgIds.length > 0) {
    return sql`${coluna} in (${sql.join(
      escopo.ppgIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
  }
  // Sem alcance de PPG nenhum: nao ha o que liberar. Quem tem alcance de rede
  // e nenhum de PPG nao esta "sem configuracao" — foi configurado para outra
  // dimensao, e entregar-lhe todos os PPGs seria vazamento.
  return NADA;
}

/** Condicao para uma coluna que guarda `rede_id`. */
export function filtroPorRede(escopo: EscopoAcesso, coluna: SQL): SQL {
  if (escopo.global) return SEM_RECORTE;
  if (escopo.redeIds.length > 0) {
    return sql`${coluna} in (${sql.join(
      escopo.redeIds.map((id) => sql`${id}::uuid`),
      sql`, `,
    )})`;
  }
  return NADA;
}

/**
 * Condicao sobre uma **missao**: pertence a alguma rede do escopo (CG-028).
 *
 * `exists` sobre `missao_rede`, nunca `join` — a mesma regra da CG-016. Um
 * `join` faria a missao de duas redes aparecer duas vezes na lista de quem tem
 * escopo nas duas, e mentir em todo `count` construido sobre ela.
 *
 * **Missao sem nenhuma rede fica invisivel para quem e recortado.** Sao
 * missoes anteriores a CG-016, e a alternativa — liberar as sem rede — daria a
 * cada gestor acesso a um conjunto que nao e de rede nenhuma. Quem tem
 * `missao:all-redes` continua enxergando, entao nada fica orfao de vez.
 *
 * **Aqui nao ha modo permissivo**, ao contrario do PPG: sem rede no escopo,
 * nenhuma missao passa, independentemente de `RECORTE_OBRIGATORIO`. Ver
 * `SEM_ESCOPO_NENHUMA_MISSAO`.
 *
 * `coluna` entra como fragmento SQL cru — quem chama escreve `sql`m.id``.
 */
export function filtroMissaoPorRede(escopo: EscopoAcesso, coluna: SQL): SQL {
  if (escopo.global) return SEM_RECORTE;
  if (escopo.redeIds.length === 0) return NADA;
  return sql`exists (
    select 1 from missao_rede mr
     where mr.missao_id = ${coluna}
       and mr.rede_id in (${sql.join(
         escopo.redeIds.map((id) => sql`${id}::uuid`),
         sql`, `,
       )})
  )`;
}

/**
 * Missao sem rede no alcance: nenhuma linha passa, e nunca houve excecao aqui.
 *
 * Este comentario sobreviveu a troca do modelo porque a regra sobreviveu: o
 * recorte de missao nunca teve modo permissivo, nem quando o do PPG tinha.
 */
export const SEM_ESCOPO_NENHUMA_MISSAO = true;

/** Verdadeiro quando o usuario pode ver aquele PPG. */
export function podeVerPpg(escopo: EscopoAcesso, ppgId: string): boolean {
  return escopo.global || escopo.ppgIds.includes(ppgId);
}

/** Verdadeiro quando o usuario pode ver aquela rede. */
export function podeVerRede(escopo: EscopoAcesso, redeId: string): boolean {
  return escopo.global || escopo.redeIds.includes(redeId);
}

/**
 * Verdadeiro quando o usuario alcanca uma missao com estas redes.
 *
 * `redesDaMissao` vazio e missao sem rede — ver `filtroMissaoPorRede`. Sem
 * modo permissivo, pela razao explicada em `SEM_ESCOPO_NENHUMA_MISSAO`.
 */
export function podeVerMissao(
  escopo: EscopoAcesso,
  redesDaMissao: readonly string[],
): boolean {
  if (escopo.global) return true;
  return redesDaMissao.some((rede) => escopo.redeIds.includes(rede));
}

/**
 * Recorte de missoes ja resolvido, pronto para entrar em qualquer consulta.
 *
 * Existe para que o servico de listagem receba **uma condicao**, e nao o
 * escopo cru mais a regra de quando ignora-lo: duas listagens que refizessem
 * essa decisao acabariam divergindo, e a que divergisse para o lado permissivo
 * seria o vazamento. `sobre` recebe a coluna porque cada consulta da um alias
 * proprio a `missao_comite`.
 */
export class RecorteDeMissoes {
  /**
   * Sem recorte nenhum.
   *
   * E o que `missao:all-redes` produz, e tambem o que os testes de dominio
   * usam: eles verificam a regra de negocio, e nao o recorte — este tem suite
   * propria, onde a ausencia de leitura entre redes e o proprio objeto de
   * teste.
   */
  static irrestrito(): RecorteDeMissoes {
    return new RecorteDeMissoes(
      { global: true, ppgIds: [], redeIds: [] },
      true,
    );
  }

  constructor(
    private readonly escopo: EscopoAcesso,
    /** Concessao `GLOBAL` de `missao:read`: nao ha recorte a aplicar. */
    private readonly irrestrito: boolean,
  ) {}

  /**
   * `true` quando nada e recortado.
   *
   * Existe porque "alcanca alguma destas redes" responde errado para a **missao
   * sem rede nenhuma** (as anteriores a CG-016): a lista vazia nao casa com
   * alcance nenhum, e quem enxerga tudo perderia o acesso a elas.
   */
  get semRecorte(): boolean {
    return this.irrestrito || this.escopo.global;
  }

  /** Condicao sobre a coluna que identifica a **missao** (`m.id`). */
  sobre(coluna: SQL): SQL {
    return this.irrestrito
      ? SEM_RECORTE
      : filtroMissaoPorRede(this.escopo, coluna);
  }

  /**
   * Condicao sobre a coluna que identifica a **rede** (`r.id`).
   *
   * Serve as quebras por rede. Sem ela, o gestor de uma rede leria "UNICAMP: 0
   * missoes" — uma afirmacao que ele nao tem como saber e que e simplesmente
   * falsa. Rede que a pessoa nao alcanca nao aparece com zero: nao aparece.
   */
  sobreRede(coluna: SQL): SQL {
    if (this.irrestrito || this.escopo.global) return SEM_RECORTE;
    if (this.escopo.redeIds.length === 0) return NADA;
    return filtroPorRede(this.escopo, coluna);
  }

  /**
   * `true` quando esta rede esta dentro do alcance do usuario.
   *
   * Usa a mesma regra estrita das missoes, e nao `podeVerRede`: o modo
   * permissivo daquele deixaria um gestor sem vinculo criar missao em qualquer
   * rede — escrita, e nao so leitura.
   */
  alcanca(redeId: string): boolean {
    return (
      this.irrestrito ||
      this.escopo.global ||
      this.escopo.redeIds.includes(redeId)
    );
  }
}
