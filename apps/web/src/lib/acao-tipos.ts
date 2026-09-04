/**
 * Contrato entre as Server Actions e os formulários.
 *
 * Fica separado de `acao.ts` porque **este módulo é importado por Client
 * Components** (`useActionState` precisa do estado inicial). `acao.ts` é
 * `server-only` e traz `apiFetch` junto — importá-lo do cliente quebra o build
 * de propósito, para que o caminho do token nunca chegue ao bundle do browser.
 *
 * Foi exatamente isso que aconteceu na primeira versão: o formulário de
 * pendência importou `ESTADO_INICIAL` de `acao.ts` e o build parou. A separação
 * abaixo é a correção, e o `server-only` continua sendo a rede.
 */

/**
 * Cadastro que a API apontou como possivelmente o mesmo (CG-025/CG-026).
 *
 * `INEQUIVOCA` a API recusa sempre; `POSSIVEL` ela devolve para a pessoa
 * decidir entre reutilizar o cadastro existente ou confirmar que são de fato
 * diferentes — homônimo dentro da mesma instituição é caso real.
 */
export interface CandidatoDuplicidade {
  id: string;
  nome: string;
  sigla?: string | null;
  email?: string | null;
  telefone?: string | null;
  ativo: boolean;
  classificacao: "INEQUIVOCA" | "POSSIVEL";
  motivos: string[];
}

export interface EstadoDaAcao {
  ok: boolean;
  mensagem?: string;
  erros?: { campo: string; mensagem: string }[];
  /**
   * Só vem no 409 de duplicidade. Fica fora de `erros` porque não pertence a um
   * campo: é uma decisão sobre o cadastro inteiro, e a tela precisa mostrá-la
   * sem descartar o que a pessoa já digitou.
   */
  candidatos?: CandidatoDuplicidade[];
}

export const ESTADO_INICIAL: EstadoDaAcao = { ok: false };
