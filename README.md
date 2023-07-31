# vite-plugin-zod-validate-envs

Vite plugin to validate and transform environment variables using [Zod](https://zod.dev/) at build or dev time.

## Usage

```shell
$ pnpm add -D @kevbook/vite-plugin-zod-validate-envs
```

```ts
// vite.config.ts
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { validateEnvs } from '@kevbook/vite-plugin-zod-validate-envs';

export default defineConfig({
  plugins: [validateEnvs({ schemaFile: resolve('config/validate-envs') })],
});
```

```ts
// validate-envs.ts
import { z } from 'zod';

export default z.object({
  OTEL_SERVICE_NAME: z.string().toLowerCase(),
  VERCEL_GIT_COMMIT_SHA: z.string().transform((val) => val.substring(0, 8)),
  ENABLED_FLAG: z.enum(['true', 'false']),
});
```
