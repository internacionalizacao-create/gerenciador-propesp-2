import js from "@eslint/js";

/**
 * Config ESLint base (flat config, ESLint 9) compartilhada pelo monorepo.
 * Componha com a config específica do framework em cada app, por exemplo:
 *
 *   import { base } from "@gerenciador/eslint-config";
 *   export default [...base, ...configDoFramework];
 */
export const base = [
  {
    ignores: [
      "**/dist/**",
      "**/.next/**",
      "**/out/**",
      "**/coverage/**",
      "**/node_modules/**"
    ]
  },
  js.configs.recommended
];

export default base;
