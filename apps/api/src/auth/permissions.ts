import {
  CATALOGO_PERMISSOES_V1,
  type PermissaoV1,
} from './autorizacao-v1/catalogo';

/**
 * Catalogo de permissoes da API — hoje, o da V1 (`autorizacao-v1/catalogo.ts`).
 *
 * Este arquivo guardava, ate 2026-09-16, o mapa `papel -> permissoes` que era a
 * fonte de autorizacao. Ele **deixou de existir**: papel do Keycloak nao concede
 * mais nada, e quem responde "o que esta conta pode fazer" e `concessao_acesso`,
 * resolvida a cada requisicao por `autorizacao-v1/acesso-v1.service.ts`.
 *
 * O arquivo continua aqui, e nao foi apagado, porque `@RequirePermission` e meia
 * centena de imports apontam para `Permission` — e o tipo, agora, e simplesmente
 * o do catalogo novo. Trocar o caminho do import em 116 decoradores nao tornaria
 * nada mais claro do que este paragrafo.
 *
 * Os verbos seguem o dominio de system-structl.md, nao o CRUD generico, e cada
 * rota tem sua acao no inventario de docs/contrato-autorizacao-v1.md.
 */

export type Permission = PermissaoV1;

export const PERMISSIONS = Object.keys(
  CATALOGO_PERMISSOES_V1,
) as readonly Permission[];
