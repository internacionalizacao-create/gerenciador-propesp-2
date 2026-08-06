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

export interface EstadoDaAcao {
  ok: boolean;
  mensagem?: string;
  erros?: { campo: string; mensagem: string }[];
}

export const ESTADO_INICIAL: EstadoDaAcao = { ok: false };
