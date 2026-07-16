# vite-plugin-zod-validate-envs

Vite plugin to validate and transform environment variables using [Zod](https://zod.dev/) at build or dev time.

## Usage

```shell
$ pnpm add -D @knockaway/vite-plugin-zod-validate-envs
```

```ts
// vite.config.ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { ValidateEnvs } from '@knockaway/vite-plugin-zod-validate-envs';

export default defineConfig({
  // List ValidateEnvs first. It writes the validated values back to process.env
  // from a pre-order `config` hook, so plugins that read env from their own
  // pre-order hook (e.g. SvelteKit's, which inlines `$env/static/*`) observe the
  // transformed values rather than the raw ones.
  plugins: [ValidateEnvs({ schemaFile: resolve('config/validate-envs') })],
});
```

`schemaFile` is **extensionless** — the plugin appends `ts`, `cts`, `mts`, `js`, `cjs`
and `mjs` when resolving it.

```ts
// validate-envs.ts
import { z } from 'zod';

export default z.object({
  OTEL_SERVICE_NAME: z.string().toLowerCase(),
  VERCEL_GIT_COMMIT_SHA: z.string().transform((val) => val.substring(0, 8)),
  ENABLED_FLAG: z.enum(['true', 'false']),
});
```
