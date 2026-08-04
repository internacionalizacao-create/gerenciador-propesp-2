# @gerenciador/tsconfig

TSConfig base compartilhado do monorepo. Contém apenas opções neutras e seguras para **qualquer** app
(NestJS ou Next.js).

## Como adotar em um app

No `tsconfig.json` do app, estenda a base e mantenha as opções específicas do framework:

```jsonc
{
  "extends": "@gerenciador/tsconfig/base.json",
  "compilerOptions": {
    // ...opções específicas do Nest/Next (module, jsx, outDir, etc.)
  }
}
```

E adicione a dependência de workspace no `package.json` do app:

```jsonc
"devDependencies": {
  "@gerenciador/tsconfig": "workspace:*"
}
```

> **Nota:** os apps `api` e `web` foram gerados pelo Nest/Next com seus próprios `tsconfig.json`.
> A adoção desta base é opcional — recomendada ao limpar/reorganizar os projetos.
