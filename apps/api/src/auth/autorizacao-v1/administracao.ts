import type { PermissaoV1 } from './catalogo';

/**
 * Politica pura a integrar na API administrativa em V1-017.
 * As capacidades devem vir do resolver local, nunca do corpo ou dos papeis JWT.
 * Autoalteracao fica fora da API comum, inclusive para quem pode delegar.
 */
export function podeAdministrarConcessao(entrada: {
  atorId: string;
  alvoId: string;
  atorAtivo: boolean;
  capacidadesGlobais: readonly PermissaoV1[];
  permissao: PermissaoV1;
}): boolean {
  const { atorId, alvoId, atorAtivo, capacidadesGlobais, permissao } = entrada;
  if (!atorAtivo || atorId === alvoId) return false;
  if (!capacidadesGlobais.includes('acesso:write')) return false;
  return (
    !permissao.startsWith('acesso:') ||
    capacidadesGlobais.includes('acesso:delegate')
  );
}
