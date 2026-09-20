import { fileURLToPath } from 'node:url';
export const raiz = fileURLToPath(new URL('../', import.meta.url));
export const pasta = `${raiz}.e2e`;
// Portas exclusivas: nunca reutilizar os servicos de desenvolvimento.
export const ambiente = {
  APP_BASE_URL: 'http://localhost:33058',
  API_BASE_URL: 'http://127.0.0.1:33059',
  KEYCLOAK_ISSUER_URL: 'http://localhost:38459/realms/gerenciador-e2e',
  KEYCLOAK_CLIENT_ID: 'gerenciador-web',
  KEYCLOAK_CLIENT_SECRET: 'e2e-client-secret',
  KEYCLOAK_AUDIENCE: 'gerenciador-api',
  SESSION_SECRET: 'Q0ktcGxhY2Vob2xkZXItMzItYnl0ZXMtLS0tLS0tLS0',
  DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:35459/gerenciador_test',
  TEST_DATABASE_URL: 'postgresql://e2e:e2e@127.0.0.1:35459/gerenciador_test',
  ARQUIVOS_DIR: `${pasta}/arquivos`,
};
