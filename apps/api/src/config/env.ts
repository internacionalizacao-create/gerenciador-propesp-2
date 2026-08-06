import { z } from 'zod';

/**
 * Contrato de ambiente da API. O processo se recusa a subir se alguma variavel
 * estiver faltando ou malformada — e melhor falhar no boot do que descobrir em
 * producao que a API estava aceitando tokens de um issuer errado.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  PORT: z.coerce.number().int().positive().default(3001),

  /**
   * Issuer do realm, exatamente como aparece na claim `iss` dos tokens.
   * Ex.: http://localhost:8080/realms/gerenciador
   */
  KEYCLOAK_ISSUER_URL: z.url(),

  /**
   * clientId desta API no Keycloak. Todo access token precisa trazer esse valor
   * em `aud` — e isso que impede um token emitido para outro servico de ser
   * reaproveitado aqui.
   */
  KEYCLOAK_AUDIENCE: z.string().min(1),

  /** Postgres da API. Ex.: postgresql://gerenciador:gerenciador@localhost:5432/gerenciador */
  DATABASE_URL: z.url(),

  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const detalhes = result.error.issues
      .map(
        (issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`,
      )
      .join('\n');
    throw new Error(`Variaveis de ambiente invalidas:\n${detalhes}`);
  }

  return result.data;
}
