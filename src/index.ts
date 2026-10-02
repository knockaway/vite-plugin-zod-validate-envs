import { EOL } from 'node:os';
import { resolve } from 'node:path';
import { createConfigLoader } from 'unconfig';
import { loadEnv, normalizePath } from 'vite';

import type { ZodType } from 'zod';
import { type ConfigEnv, type Plugin, type UserConfig } from 'vite';

type PluginOptions = {
  // A file that exports a default Zod schema
  schemaFile: string;
};

// Save the process envs state
const PROCESS_ENVS = Object.assign({}, process.env);

/**
 * Load the zod schema defined in the "schemaFile" using unconfig
 */
const loadConfig = async function (schemaFile: string) {
  const loader = createConfigLoader({
    sources: [
      {
        files: schemaFile,
        extensions: ['ts', 'cts', 'mts', 'js', 'cjs', 'mjs'],
      },
    ],
  });
  const result = await loader.load();
  // unconfig hands the default export back wrapped in a function, so unwrap it
  // when it is one, but still accept a bare schema.
  const schema =
    typeof result.config === 'function' ? result.config() : result.config;
  if (typeof schema?.safeParse !== 'function') {
    throw new Error('Schema file must export Zod schema as default');
  }
  return schema as ZodType<Record<string, string>>;
};

/**
 * Main plugin function
 */
async function validateEnvs(
  userConfig: UserConfig,
  envConfig: ConfigEnv,
  options: PluginOptions,
) {
  // Restore the process envs state
  for (const key in process.env) delete process.env[key];
  Object.assign(process.env, PROCESS_ENVS);

  if (!options?.schemaFile) {
    throw new Error(
      'Missing schemaFile option for vite-plugin-zod-validate-envs',
    );
  }

  // Resolve the root and envDir
  const resolvedRoot = normalizePath(
    userConfig.root ? resolve(userConfig.root) : process.cwd(),
  );
  const envDir = userConfig.envDir
    ? normalizePath(resolve(resolvedRoot, userConfig.envDir))
    : resolvedRoot;

  const envs = loadEnv(envConfig.mode, envDir, userConfig.envPrefix || '');
  const schema = await loadConfig(options.schemaFile);

  // We do not want non schema values to be removed
  const validated = schema.safeParse(envs);
  if (validated.success) {
    for (const key in validated.data) {
      process.env[key] = validated.data[key];
    }
  } else {
    const errors: string[] = [];
    for (const err of validated.error.issues) {
      errors.push(`Invalid value for: ${String(err.path[0])}`);
    }
    throw new Error(errors.join(EOL));
  }
}

export const ValidateEnvs = (options: PluginOptions): Plugin => ({
  name: 'vite-plugin-zod-validate-envs',
  // Vite sorts `config` hooks by their `order` before falling back to plugin
  // array position, so a plugin declaring `order: 'pre'` runs ahead of any
  // plain `config` hook no matter where it sits in `plugins`. Consumers that
  // read process.env from such a hook (e.g. SvelteKit's
  // vite-plugin-sveltekit-setup, which snapshots env for $env/static/* and has
  // used `order: 'pre'` since 2.56.0) would otherwise observe the raw,
  // untransformed values. Declaring `order: 'pre'` here puts us in the same
  // bucket, where array position applies again and this plugin can be ordered
  // first. Note `enforce: 'pre'` would not help: hook order outranks enforce.
  config: {
    order: 'pre',
    handler: (config, env) => validateEnvs(config, env, options),
  },
});
