import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { raiz, pasta, ambiente } from './e2e-ambiente.mjs';

const env = { ...process.env, ...ambiente };
const processos = [];
function executar(cmd, args, extra = {}) {
  const filho = spawn(cmd, args, { cwd: raiz, env, stdio: 'inherit', ...extra });
  return new Promise((resolve, reject) => {
    filho.on('error', reject);
    filho.on('exit', code => code === 0 ? resolve() : reject(new Error(`${cmd} terminou com ${code}`)));
  });
}
function iniciar(cmd, args, extra) {
  const filho = spawn(cmd, args, { cwd: raiz, env, stdio: 'inherit', detached: true, ...extra });
  processos.push(filho);
  filho.on('error', erro => console.error(erro.message));
}
async function esperar(url) {
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    try { if ((await fetch(url, { signal: AbortSignal.timeout(1500) })).ok) return; } catch {}
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Serviço não ficou pronto: ${url}`);
}
await mkdir(pasta, { recursive: true });
// Exclusao mutua local; nao reaproveitar um servidor ja iniciado por outra rodada.
await mkdir(`${pasta}/lock`);
const compose = ['compose', '-p', 'gerenciador-e2e', '-f', `${pasta}/compose.json`];
let encerrando = false;
async function limpar() {
  if (encerrando) return;
  encerrando = true;
  for (const filho of processos) {
    try { process.kill(-filho.pid, 'SIGTERM'); } catch {}
  }
  await executar('docker', [...compose, 'down', '--volumes', '--remove-orphans']).catch(() => {});
  await rm(`${pasta}/lock`, { recursive: true, force: true });
}
for (const sinal of ['SIGINT', 'SIGTERM']) process.on(sinal, async () => { await limpar(); process.exit(1); });
try {
  const realm = JSON.parse(await readFile(`${raiz}infra/keycloak/import/gerenciador-realm.json`, 'utf8'));
  realm.realm = 'gerenciador-e2e';
  const usuarios = ['admin', 'leitor', 'sem-acesso'].map(nome => ({
    id: randomUUID(), username: `e2e-${nome}`, enabled: true, emailVerified: true,
    firstName: 'Teste', lastName: nome, email: `${nome}@example.invalid`,
    credentials: [{ type: 'password', value: 'TesteE2e123!', temporary: false }],
  }));
  realm.users = usuarios;
  const client = realm.clients.find(c => c.clientId === 'gerenciador-web');
  client.secret = ambiente.KEYCLOAK_CLIENT_SECRET;
  client.redirectUris = [`${ambiente.APP_BASE_URL}/api/auth/callback`];
  client.webOrigins = [ambiente.APP_BASE_URL];
  client.attributes['post.logout.redirect.uris'] = `${ambiente.APP_BASE_URL}/*`;
  await mkdir(`${pasta}/import`, { recursive: true });
  await rm(ambiente.ARQUIVOS_DIR, { recursive: true, force: true });
  await writeFile(`${pasta}/import/realm.json`, JSON.stringify(realm));
  await writeFile(`${pasta}/usuarios.json`, JSON.stringify(usuarios));
  await writeFile(`${pasta}/compose.json`, JSON.stringify({ services: {
    db: { image: 'postgres:17', environment: { POSTGRES_USER: 'e2e', POSTGRES_PASSWORD: 'e2e', POSTGRES_DB: 'gerenciador_test' }, ports: ['127.0.0.1:35459:5432'], healthcheck: { test: ['CMD-SHELL', 'pg_isready -U e2e -d gerenciador_test'], interval: '2s', timeout: '3s', retries: 30 } },
    keycloak: { image: 'quay.io/keycloak/keycloak:26.7.0', command: ['start-dev', '--import-realm'], ports: ['127.0.0.1:38459:8080'], volumes: [`${pasta}/import:/opt/keycloak/data/import:ro`] },
  }}));
  await executar('docker', [...compose, 'up', '-d', '--wait']);
  await esperar(`${ambiente.KEYCLOAK_ISSUER_URL}/.well-known/openid-configuration`);
  await executar('pnpm', ['build', '--force']);
  iniciar('node', ['dist/main.js'], { cwd: `${raiz}apps/api`, env: { ...env, PORT: '33059' } });
  iniciar('pnpm', ['--filter', 'web', 'start', '--port', '33058']);
  await esperar(`${ambiente.API_BASE_URL}/health`);
  await esperar(`${ambiente.APP_BASE_URL}/login`);
  await executar('pnpm', ['--filter', 'web', 'exec', 'playwright', 'test', ...process.argv.slice(2)]);
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await limpar();
}
