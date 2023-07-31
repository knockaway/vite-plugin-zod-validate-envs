import { EOL } from 'node:os';
import { resolve } from 'node:path';
import { createConfigLoader } from 'unconfig';
import { loadEnv, normalizePath } from 'vite';

import type { AnyZodObject } from 'zod';
import { type ConfigEnv, type Plugin, type UserConfig } from 'vite';

type PluginOptions = {
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
  return result.config;
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
  const schema = (await loadConfig(options.schemaFile)) as AnyZodObject;

  // We do not want non schema values to be removed
  const validated = schema.nonstrict().safeParse(envs);
  if (validated.success) {
    for (const key in validated.data) {
      process.env[key] = validated.data[key];
    }
  } else {
    const errors: string[] = [];
    for (const err of validated.error.issues) {
      errors.push(`Invalid value for: ${err.path[0]}`);
    }
    throw new Error(errors.join(EOL));
  }
}

export const ValidateEnvs = (options: PluginOptions): Plugin => ({
  name: 'vite-plugin-zod-validate-envs',
  config: (config, env) => validateEnvs(config, env, options),
});
