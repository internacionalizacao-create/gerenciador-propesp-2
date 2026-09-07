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
 * **Enquanto for `false`, usuario sem escopo configurado continua vendo tudo.**
 *
 * Esta e a decisao mais consequente deste arquivo, e por isso esta explicita e
 * num lugar so. O recorte esta sendo introduzido num sistema em que ninguem
 * tem escopo cadastrado ainda: ligar o modo restritivo antes de a PROPESP
 * atribuir os escopos deixaria todo coordenador sem enxergar nada, no mesmo
 * instante, sem nenhuma tela dizendo por que.
 *
 * Quem ja tem escopo cadastrado **ja e recortado hoje** — o modo permissivo nao
 * enfraquece quem foi configurado, so poupa quem ainda nao foi.
 *
 * Trocar para `true` fecha o sistema: sem escopo, sem dado. Faca isso quando os
 * escopos estiverem atribuidos, e nao antes. Os dois modos tem teste.
 */
export const RECORTE_OBRIGATORIO = false;

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
  // Sem escopo de PPG. Um usuario que tem escopo **de rede** e nenhum de PPG
  // nao esta "sem configuracao": ele foi configurado para outra dimensao, e
  // deixa-lo ver todos os PPGs seria vazamento. Por isso a checagem olha os
  // dois tipos antes de concluir que ninguem configurou nada.
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO ? SEM_RECORTE : NADA;
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
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO ? SEM_RECORTE : NADA;
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
 * Por que o recorte de missao nao tem o modo permissivo do PPG.
 *
 * `RECORTE_OBRIGATORIO = false` existe para nao cegar, de um dia para o outro,
 * quem ja usava o sistema antes de a PROPESP atribuir escopos. Essa pessoa
 * existe no mundo do PPG — todo coordenador — e nao existe no das missoes: a
 * unica permissao que chega ate aqui e a do Gestor da Rede, papel que **nunca
 * foi atribuido a ninguem** (ver `permissions.ts`). `admin` e Comite Gestor nao
 * passam por este caminho, porque tem `missao:all-redes`.
 *
 * Manter o modo permissivo aqui seria, portanto, so um buraco: bastaria
 * conceder `gestor-rede` a alguem sem vinculo de equipe para que essa pessoa
 * enxergasse as tres redes — exatamente o que a CG-028 existe para impedir. Sem
 * rede no escopo, o gestor ve uma lista vazia e a PROPESP descobre que falta
 * cadastrar o vinculo; com o modo permissivo, ele veria tudo e ninguem
 * descobriria nada.
 */
export const SEM_ESCOPO_NENHUMA_MISSAO = true;

/** Verdadeiro quando o usuario pode ver aquele PPG. */
export function podeVerPpg(escopo: EscopoAcesso, ppgId: string): boolean {
  if (escopo.global) return true;
  if (escopo.ppgIds.includes(ppgId)) return true;
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO;
}

/** Verdadeiro quando o usuario pode ver aquela rede. */
export function podeVerRede(escopo: EscopoAcesso, redeId: string): boolean {
  if (escopo.global) return true;
  if (escopo.redeIds.includes(redeId)) return true;
  return semNenhumEscopo(escopo) && !RECORTE_OBRIGATORIO;
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
 * `true` quando este usuario **nao** e recortado por rede no modulo de missoes.
 *
 * Le a permissao, nunca o papel: e a mesma indirecao que faz nenhum controller
 * mencionar `admin` ou `comite-gestor`. Ver `missao:all-redes` no catalogo.
 */
export function alcancaTodasAsRedes(usuario: {
  permissions: readonly string[];
}): boolean {
  return usuario.permissions.includes('missao:all-redes');
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
    /** `missao:all-redes`: nao ha recorte a aplicar. */
    private readonly irrestrito: boolean,
  ) {}

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

/** Nenhum escopo de nenhum tipo: conta que ainda nao foi configurada. */
function semNenhumEscopo(escopo: EscopoAcesso): boolean {
  return (
    !escopo.global && escopo.ppgIds.length === 0 && escopo.redeIds.length === 0
  );
}
