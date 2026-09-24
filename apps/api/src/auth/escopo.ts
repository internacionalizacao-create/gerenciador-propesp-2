import { sql, type SQL } from 'drizzle-orm';

/**
 * Recorte de missoes por rede (CG-028), montado a partir de `missao:read`.
 *
 * Cada recorte nasce do alcance das acoes exigidas. Duas acoes da mesma conta
 * podem alcancar redes diferentes; nao se deve unir seus alvos num escopo
 * agregado da conta. Para outros dominios, use `condicaoDoAlcance`.
 */
export interface EscopoAcesso {
  /** Enxerga tudo. Quando verdadeiro, a lista e irrelevante. */
  readonly global: boolean;
  readonly ppgIds: readonly string[];
  readonly redeIds: readonly string[];
}

/** Nao ha o que recortar. */
const SEM_RECORTE = sql`true`;

/** Recorta tudo: nenhuma linha passa. Sem concessao, sem dado. */
const NADA = sql`false`;

/** Condicao para uma coluna que guarda `rede_id`. */
function filtroPorRede(escopo: EscopoAcesso, coluna: SQL): SQL {
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
 * `missao:read` em GLOBAL continua enxergando, entao nada fica orfao de vez.
 * Sem rede no escopo, nenhuma missao passa.
 *
 * `coluna` entra como fragmento SQL cru — quem chama escreve `sql`m.id``.
 */
function filtroMissaoPorRede(escopo: EscopoAcesso, coluna: SQL): SQL {
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
   * E o que `missao:read` em GLOBAL produz, e tambem o que os testes de dominio
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
   * Regra estrita, sem modo permissivo: sem rede no escopo, nenhuma passa — um
   * gestor sem vinculo nao cria missao em rede nenhuma.
   */
  alcanca(redeId: string): boolean {
    return (
      this.irrestrito ||
      this.escopo.global ||
      this.escopo.redeIds.includes(redeId)
    );
  }
}
