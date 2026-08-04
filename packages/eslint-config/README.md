# @gerenciador/eslint-config

Config ESLint base (flat config, ESLint 9) compartilhada. Exporta ignores comuns + regras recomendadas
do JavaScript, para serem compostas com a config específica de cada app.

## Como adotar em um app

`package.json` do app:

```jsonc
"devDependencies": {
  "@gerenciador/eslint-config": "workspace:*"
}
```

`eslint.config.mjs` do app:

```js
import { base } from "@gerenciador/eslint-config";
// ...imports da config do framework (ex.: eslint-config-next / typescript-eslint)

export default [
  ...base,
  // ...regras específicas do framework
];
```

> **Nota:** `api` e `web` já vêm com `eslint.config.mjs` próprios do Nest/Next. Adoção opcional,
> recomendada ao limpar os projetos.
