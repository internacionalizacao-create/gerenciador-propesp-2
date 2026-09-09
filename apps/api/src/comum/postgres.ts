/**
 * Erros do Postgres que viram resposta de negocio.
 *
 * Verificado pelo **codigo**, e nao pela mensagem: a mensagem e localizavel e
 * muda entre versoes do servidor, e um `includes('duplicate key')` que parasse
 * de casar devolveria 500 de novo sem ninguem notar.
 */
export function violouUnicidade(erro: unknown): boolean {
  if (typeof erro !== 'object' || erro === null) return false;
  const codigo = (erro as { code?: unknown; cause?: { code?: unknown } }).code;
  const causa = (erro as { cause?: { code?: unknown } }).cause?.code;
  return codigo === '23505' || causa === '23505';
}
